// ADMIN "NFCSTORE ILOVASI" BO'LIMI — TUGMALAR HAQIQATDAN ISHLAYDIMI.
//
//   node scripts/test-admin-nova-tab.mjs
//
// ── NIMA UCHUN BU TEST BOR ────────────────────────────────────────
//
// Admin paneliga bo'lim qo'shish oson: tugma chiziladi, chiroyli
// jadval ochiladi — va hech narsa ishlamaydi, chunki chaqirilgan
// yo'l serverda yo'q. `npm run build` bunga xato bermaydi,
// `flutter analyze` ham (bu React), ya'ni xato faqat admin
// bo'limni ochganda ko'rinadi.
//
// `scripts/test-noop-audit.mjs` shu turdagi xatolar uchun yozilgan.
// Bu test o'sha g'oyani aniq bir bo'limga qo'llaydi: `NovaTab.jsx`
// chaqiradigan HAR BIR `adminApi(...)` yo'li haqiqiy worker ustida
// sinaladi.
//
// Production D1/R2 ga TEGMAYDI.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'src/components/admin/NovaTab.jsx'), 'utf8');
const { check, checkTrue, done } = makeChecker();

// ── 1. Bo'lim chaqiradigan yo'llar ───────────────────────────────
//
// `adminApi('/comments?...')` va `adminApi(`/featured/${id}/stop`)`
// ikkala shakl ham olinadi.
// USUL ham manbadan olinadi, TAXMIN QILINMAYDI.
//
// `adminApi` ning ikkinchi argumentidagi `method: 'DELETE'`
// o'qiladi; bo'lmasa GET. Taxmin qilinganda `/comments/:id`
// DELETE o'rniga GET bilan sinalib, "marshrut yo'q" degan
// YOLG'ON xato chiqqan edi.
const calls = new Map(); // "METHOD /path" -> {method, path}
for (const m of SRC.matchAll(
  /adminApi\(\s*[`'"]([^`'"]+)[`'"]\s*(?:,\s*\{([^}]*)\})?/g,
)) {
  const opts = m[2] || '';
  const mm = opts.match(/method:\s*'([A-Z]+)'/);
  const method = mm ? mm[1] : 'GET';
  calls.set(`${method} ${m[1]}`, { method, path: m[1] });
}
checkTrue('1) bo‘limdan chaqiruvlar topildi', calls.size >= 4);

// Shablon o'zgaruvchilari namuna qiymatga almashtiriladi.
const concrete = (p) => p
  .replace(/\$\{[^}]*\}/g, '1')
  .replace(/\?.*$/, '');

// ── 2. Haqiqiy worker ─────────────────────────────────────────────
const { env } = makeEnv();
await seedBasic(env);

// Sinash uchun bitta izoh va bitta slot kerak — aks holda
// `/comments/1` 404 qaytaradi va "yo'q" bilan "topilmadi" ni
// ajratish qiyinlashadi.
await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run();
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (1, 'VIP001', 1, 'post', '2026-01-01 00:00:00')`
).run();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};

await call('/api/comments/post/1', {
  method: 'POST', cookie: cookie.user, json: { body: 'sinov izohi' },
});

// ── 3. Har bir yo'l ADMIN uchun yetib boradimi ────────────────────
//
// Kutiladigan javob: 200 / 404 / 422 — hammasi "ishlovchi bor"
// degani. `{error:'not_found', path}` esa "marshrut yo'q" ning
// aniq belgisi (`worker.js` oxiridagi umumiy tutqich).
const unreachable = [];
for (const { method, path: raw } of calls.values()) {
  const path = `/api/admin${concrete(raw)}`;
  const res = await call(path, {
    method, cookie: cookie.admin, json: method === 'GET' ? undefined : { reason: 'sinov' },
  });
  if (res.status === 404 && res.body && 'path' in res.body) {
    unreachable.push(`${method} ${path}`);
  }
}
if (unreachable.length) {
  console.log('\nSERVER TANIMAYDIGAN YO‘LLAR:');
  for (const p of unreachable) console.log(`  ${p}`);
}
check('3) serverda yo‘q yo‘l soni', unreachable.length, 0);

// ── 4. ADMINSIZ HECH NARSA OCHILMAYDI ────────────────────────────
//
// Dalil arxivi va o'chirilgan izohlar ommaga ochilib qolsa —
// bu moderatsiya emas, ochiq ma'lumot bazasi bo'lardi.
for (const { method, path: raw } of calls.values()) {
  const path = `/api/admin${concrete(raw)}`;
  const res = await call(path, { method, json: method === 'GET' ? undefined : { reason: 'x' } });
  check(`4) cookie‘siz ${method} ${path}`, res.status, 401);
}

// ── 5. "QO'LDA FAOLLASHTIRISH" TUGMASI BO'LMASLIGI KERAK ─────────
//
// Slot faqat haqiqiy to'lovdan keyin yonadi. Admin panelida
// "faollashtirish" tugmasi paydo bo'lsa, u to'lovni chetlab
// o'tish yo'li bo'lardi — va buni sezish qiyin, chunki tugma
// foydali ko'rinadi.
// IZOHLAR OLIB TASHLANADI — aks holda tekshiruv O'Z HUJJATIGA
// mos kelardi: yuqorida "faollashtirish tugmasi ATAYLAB YO'Q"
// deb yozilgan va qidiruv o'sha gapni topib, "tugma bor" deb
// yiqilardi. Bu xato shu sessiyada uch marta uchradi.
const CODE = stripComments(SRC);

checkTrue('5) qo‘lda faollashtirish yo‘q',
  !/activate|faollashtir/i.test(CODE));

// Sabab so'ramaydigan o'chirish ham bo'lmasligi kerak.
checkTrue('5) o‘chirish sababi so‘raladi',
  /reason/.test(CODE) && /prompt\(/.test(CODE));

done('Admin "NFCSTORE ILOVASI"');
