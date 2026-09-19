// BOG'LANGAN NFC QURILMALARI — /api/my/nfc-devices
//
// Bu yo'l produksiyada 404 qaytarardi va "bog'langan kartalar" ekrani
// HECH QACHON ishlamagan. Sababi ikki bosqichli edi:
//   1) marshrut `userAccountApi` ichida bor edi, lekin `coreApi()`
//      uni o'sha funksiyaga yubormasdi;
//   2) tuzatilgandan keyin ham `coreApi()` ning O'ZI chaqirilmasdi —
//      tashqi shartga qo'shilmagan edi.
// Ya'ni "handler bor" degani "so'rov yetib boradi" degani EMAS.
//
// Shuning uchun bu test manba matnini o'qimaydi — haqiqiy worker'ga
// HTTP so'rov yuboradi va javobni tekshiradi.
//
//   node scripts/test-nfc-devices.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const call = async (path, init) => {
  const r = await worker.fetch(req(path, init), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};

// ── 1) SO'ROV YETIB BORADIMI ─────────────────────────────────────────
{
  const r = await call('/api/my/nfc-devices', { headers: { cookie: cookie.user } });
  check('1) kirgan foydalanuvchi -> 200', r.status, 200);
  checkTrue('1) "not_found" QAYTMAYDI (marshrut yetib bordi)', r.body?.error !== 'not_found');
  checkTrue('1) ro‘yxat qaytadi', Array.isArray(r.body?.devices || r.body));
}

// ── 2) QURILMA YO'Q — BO'SH RO'YXAT, XATO EMAS ───────────────────────
{
  const r = await call('/api/my/nfc-devices', { headers: { cookie: cookie.user } });
  const list = r.body?.devices || r.body;
  check('2) qurilma yo‘q -> bo‘sh ro‘yxat', Array.isArray(list) ? list.length : -1, 0);
}

// ── 3) KIRMAGAN ODAM ─────────────────────────────────────────────────
{
  const r = await call('/api/my/nfc-devices');
  check('3) kirmagan -> 401', r.status, 401);
}

// ── 4) QURILMA BOR HOLATI ────────────────────────────────────────────
// Ustun nomlari AYNAN produksiya sxemasidan: `owner_user_id`,
// `linked_code`, `blocked_by_owner`. Testni "o'ziga qulay" nomlar
// bilan yozish uni soxta yashil qilardi.
let deviceId = 0;
{
  const ins = await env.DB.prepare(
    `INSERT INTO physical_cards (chip_token, linked_code, owner_user_id, active, blocked_by_owner)
     VALUES ('SECRET-CHIP-TOKEN-1234', 'VIP001', 1, 1, 0) RETURNING id`,
  ).first();
  deviceId = Number(ins?.id || 0);
  checkTrue('4) sinov qurilmasi yaratildi', deviceId > 0);

  const r = await call('/api/my/nfc-devices', { headers: { cookie: cookie.user } });
  check('4) o‘z qurilmasi ko‘rinadi', r.body?.devices?.length, 1);
  check('4) bog‘langan profil ko‘rinadi', r.body?.devices?.[0]?.linkedCode, 'VIP001');

  // TO'LIQ CHIP TOKEN HECH QACHON CHIQMAYDI — u bilan kartani
  // soxtalashtirish mumkin bo'lardi. Faqat oxirgi 4 belgi.
  const raw = JSON.stringify(r.body || {});
  checkTrue('4) to‘liq chip token chiqmaydi', !raw.includes('SECRET-CHIP-TOKEN-1234'));
  check('4) faqat oxirgi 4 belgi', r.body?.devices?.[0]?.tokenTail, '1234');

  // Begona foydalanuvchi ko'rmaydi.
  const other = await call('/api/my/nfc-devices', { headers: { cookie: cookie.other } });
  check('4) begona qurilmalar ko‘rinmaydi', other.body?.devices?.length, 0);
}

// ── 5) YOZISH — FAQAT O'ZINIKIGA ─────────────────────────────────────
{
  const mine = await call(`/api/my/nfc-devices/${deviceId}`, {
    method: 'PUT', json: { blocked: true }, headers: { cookie: cookie.user },
  });
  check('5) o‘z qurilmasini bloklay oladi', mine.status, 200);
  check('5) holat darhol qaytadi', mine.body?.devices?.[0]?.blockedByOwner, true);

  const unblock = await call(`/api/my/nfc-devices/${deviceId}`, {
    method: 'PUT', json: { blocked: false }, headers: { cookie: cookie.user },
  });
  check('5) blokdan chiqaradi', unblock.body?.devices?.[0]?.blockedByOwner, false);

  // BEGONA — qurilma borligi ham bilinmasin.
  const foreign = await call(`/api/my/nfc-devices/${deviceId}`, {
    method: 'PUT', json: { blocked: true }, headers: { cookie: cookie.other },
  });
  check('5) begonanikiga tegib bo‘lmaydi', foreign.status, 404);
  check('5) begonaga "yo‘q" deyiladi', foreign.body?.error, 'not_found');

  const anon = await call(`/api/my/nfc-devices/${deviceId}`, { method: 'PUT', json: { blocked: true } });
  check('5) kirmagan -> 401', anon.status, 401);
}

// ── 6) PROFIL BOG'LASH — FAQAT O'Z NFC ID SI ─────────────────────────
// Aks holda begona profilni o'z kartangizga bog'lab qo'yish mumkin
// bo'lardi va karta bosilganda o'sha odamning profili ochilardi.
{
  await env.DB.prepare(
    `INSERT INTO cards (code, name, price, ts, user_id, profile_type)
     VALUES ('OTHERONE', 'Begona', 0, 1000, 2, 'personal')`,
  ).run().catch(() => {});

  const foreignCode = await call(`/api/my/nfc-devices/${deviceId}`, {
    method: 'PUT', json: { linkedCode: 'OTHERONE' }, headers: { cookie: cookie.user },
  });
  check('6) begona NFC ID ni bog‘lab bo‘lmaydi', foreignCode.status, 403);
  check('6) sababi not_your_code', foreignCode.body?.error, 'not_your_code');

  const bad = await call(`/api/my/nfc-devices/${deviceId}`, {
    method: 'PUT', json: { linkedCode: 'yaroqsiz kod!' }, headers: { cookie: cookie.user },
  });
  check('6) yaroqsiz kod -> 422', bad.status, 422);
  check('6) sababi bad_code', bad.body?.error, 'bad_code');

  const ok = await call(`/api/my/nfc-devices/${deviceId}`, {
    method: 'PUT', json: { linkedCode: 'VIP001' }, headers: { cookie: cookie.user },
  });
  check('6) o‘z NFC ID si bog‘lanadi', ok.status, 200);
  check('6) bog‘lanish saqlandi', ok.body?.devices?.[0]?.linkedCode, 'VIP001');
}

// ── 7) FRONTEND HOLATI ───────────────────────────────────────────────
// Backend tayyor, lekin saytda bu ekran HALI YO'Q: `dbListNfcDevices`
// va `dbUpdateNfcDevice` eksport qilingan-u, ularni hech kim
// chaqirmaydi. Buni JIM qoldirmaslik uchun shu yerda qayd etiladi —
// ekran qo'shilganda bu tekshiruv o'zi eslatadi.
{
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('../src', import.meta.url).pathname;
  const files = [];
  (function walk(d) {
    for (const n of readdirSync(d)) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) walk(f);
      else if (/\.jsx?$/.test(n)) files.push(f);
    }
  })(root);
  const used = files.some((f) => !f.endsWith('db.js')
    && /dbListNfcDevices|dbUpdateNfcDevice/.test(readFileSync(f, 'utf8')));
  console.log(used
    ? 'IZOH  - saytda NFC qurilmalari ekrani ULANGAN'
    : 'IZOH  - saytda NFC qurilmalari ekrani HALI YO‘Q (backend tayyor, UI kerak)');
}

done('NFC qurilmalari');
