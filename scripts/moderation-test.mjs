// Shikoyat va bloklash API si — hosting/api/moderation.js.
//
//   node scripts/moderation-test.mjs
//
// Soxta D1 va soxta yordamchilar bilan: maqsad marshrut, tekshiruv
// va yozilayotgan SQL to'g'riligini qo'riqlash. Haqiqiy baza kerak
// emas va bo'lishi ham shart emas — bu yerda tekshiriladigan narsa
// mantiq, D1 ning o'zi emas.

import assert from 'node:assert/strict';
import * as mod from '../hosting/api/moderation.js';

// ── Soxta D1 ─────────────────────────────────────────────────────
function fakeDb() {
  const calls = [];
  const stmt = (sql) => ({
    sql,
    bind(...args) { calls.push({ sql, args }); return this; },
    async run() { return { meta: { changes: 1 } }; },
    async first() { return { id: 1, target_kind: 'post', target_id: '7', reason: 'porn', status: 'resolved', created_at: 'now' }; },
    async all() { return { results: [] }; },
  });
  return {
    calls,
    DB: {
      prepare: stmt,
      async batch() { return []; },
    },
  };
}

const H = {
  json: (body, status = 200) => ({ body, status }),
  nowTs: () => '2026-09-14 00:00:00.000+00',
  reqIp: () => '203.0.113.7',
  getCurrentUser: async () => ({ id: 42 }),
  requireAdmin: async () => ({ id: 1, username: 'admin' }),
  rateLimitD1: async () => false,
  sendTelegramMessage: () => Promise.resolve(),
  logAdminActivity: () => Promise.resolve(),
};

const req = (method, body) => ({
  method,
  headers: { get: () => '' },
  json: async () => body,
});
const u = (path, qs = '') => new URL(`https://nfcstore.uz${path}${qs}`);

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  XATO  ${name}\n        ${err.message}`);
  }
}

console.log('moderation.js:');

await check('tanimagan yo‘lga null qaytaradi', async () => {
  const env = fakeDb();
  assert.equal(await mod.handle(req('GET'), env, u('/api/nothing'), H), null);
});

await check('shikoyat: noto‘g‘ri sabab rad etiladi', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('POST', { targetKind: 'post', targetId: '7', reason: 'ninima' }),
    env, u('/api/reports'), H,
  );
  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'bad_reason');
});

await check('shikoyat: noto‘g‘ri nishon rad etiladi', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('POST', { targetKind: 'kitob', targetId: '7', reason: 'porn' }),
    env, u('/api/reports'), H,
  );
  assert.equal(res.status, 422);
});

await check('shikoyat: to‘g‘ri so‘rov yoziladi', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('POST', { targetKind: 'story', targetId: '9', reason: 'porn', note: 'x', ownerCode: 'aaa512' }),
    env, u('/api/reports'), H,
  );
  assert.equal(res.status, 201);
  const insert = env.calls.find((c) => c.sql.includes('INSERT INTO content_reports'));
  assert.ok(insert, 'INSERT yuborilmadi');
  assert.equal(insert.args[0], 'story');
  assert.equal(insert.args[1], '9');
  // Kod KATTA harfda saqlanadi — qidiruv bir xil bo'lsin.
  assert.equal(insert.args[2], 'AAA512');
  assert.equal(insert.args[3], 42, 'kim shikoyat qilgani yozilmadi');
  assert.equal(insert.args[5], 'porn');
});

await check('shikoyat: kirmagan odam ham yubora oladi', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('POST', { targetKind: 'record', targetId: 'AAA512', reason: 'spam' }),
    env, u('/api/reports'), { ...H, getCurrentUser: async () => null },
  );
  assert.equal(res.status, 201);
  const insert = env.calls.find((c) => c.sql.includes('INSERT INTO content_reports'));
  assert.equal(insert.args[3], null, 'mehmon uchun reporter_id null bo‘lishi kerak');
});

await check('shikoyat: chegaradan oshsa 429', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('POST', { targetKind: 'post', targetId: '7', reason: 'spam' }),
    env, u('/api/reports'), { ...H, rateLimitD1: async () => true },
  );
  assert.equal(res.status, 429);
});

await check('bloklash: kirmagan odamga 401', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('POST', { kind: 'record', id: 'AAA512' }),
    env, u('/api/blocks'), { ...H, getCurrentUser: async () => null },
  );
  assert.equal(res.status, 401);
});

await check('bloklash: yoziladi va kod katta harfga o‘tadi', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('POST', { kind: 'record', id: 'aaa512' }),
    env, u('/api/blocks'), H,
  );
  assert.equal(res.status, 200);
  const ins = env.calls.find((c) => c.sql.includes('INSERT OR IGNORE INTO user_blocks'));
  assert.ok(ins);
  assert.deepEqual(ins.args.slice(0, 3), [42, 'record', 'AAA512']);
});

await check('bloklash: noto‘g‘ri tur rad etiladi', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('POST', { kind: 'post', id: '7' }),
    env, u('/api/blocks'), H,
  );
  assert.equal(res.status, 422);
});

await check('blokdan chiqarish: DELETE ishlaydi', async () => {
  const env = fakeDb();
  const res = await mod.handle(req('DELETE'), env, u('/api/blocks/record/aaa512'), H);
  assert.equal(res.status, 200);
  const del = env.calls.find((c) => c.sql.includes('DELETE FROM user_blocks'));
  assert.deepEqual(del.args, [42, 'record', 'AAA512']);
});

await check('admin: navbat faqat adminga', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('GET'), env, u('/api/admin/reports'), { ...H, requireAdmin: async () => null },
  );
  assert.equal(res.status, 401);
});

await check('admin: holatni o‘zgartirish', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('PATCH', { status: 'resolved' }), env, u('/api/admin/reports/1'), H,
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.report.status, 'resolved');
});

await check('admin: noto‘g‘ri holat rad etiladi', async () => {
  const env = fakeDb();
  const res = await mod.handle(
    req('PATCH', { status: 'nimadir' }), env, u('/api/admin/reports/1'), H,
  );
  assert.equal(res.status, 422);
});

await check('sabablar ro‘yxati yopiq va to‘liq', () => {
  // Saytdagi kontent qoidalari matni nimalarni taqiqlasa, shikoyat
  // sabablarida ham o'shalar bo'lishi kerak — odam qoidada
  // o'qigan narsani bu yerda topa olsin.
  for (const r of ['porn', 'religious', 'political', 'violence', 'insult', 'illegal']) {
    assert.ok(mod.REPORT_REASONS.includes(r), `sabab yo‘q: ${r}`);
  }
});

if (failures) {
  console.error(`\n${failures} ta tekshiruv yiqildi.`);
  process.exit(1);
}
console.log('\nHammasi o‘tdi.');
