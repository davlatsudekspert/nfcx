// Katalogdagi sovg'a kartasi + profil foni media (50 MB) testi.
//   node scripts/test-catalog-gift-and-bg-upload.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const j = async (pathname, init) => {
  const r = await worker.fetch(req(pathname, init), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};

// ═══ 1. KATALOG: sovg'a vs pullik karta ═══
// Sovg'a MANBASI: nfc_gifts jadvalidagi status='activated' yozuv — ya'ni
// admin rezerv qilgan va oluvchi faollashtirgan karta. Narx 0 bo'lgani
// uchun EMAS: quyida narxi 0 bo'lgan, lekin sovg'a BO'LMAGAN karta ham
// sinaladi va u sovg'a deb belgilanmasligi kerak.
{
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type, tg) VALUES ('GIFT01', 'Ali', 0, 3000, 1, 'personal', 'davlatsudekspert')`).run();
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type, tg) VALUES ('PAID01', 'Vali', 149000, 2000, 1, 'personal', 'someuser')`).run();
  // Narxi 0, lekin sovg'a EMAS (masalan admin qo'lda 0 qo'ygan)
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('ZERO01', 'Hasan', 0, 1500, 1, 'personal')`).run();
  await env.DB.prepare(
    `INSERT INTO nfc_gifts (code, recipient_name, note, value, activation_code, status, created_at)
     VALUES ('GIFT01', 'Ali', '', 0, 'ACT123', 'activated', ?)`
  ).bind(new Date().toISOString()).run();
  // Faollashtirilmagan (faqat rezerv) sovg'a — hali sovg'a deb ko'rsatilmaydi
  await env.DB.prepare(
    `INSERT INTO nfc_gifts (code, recipient_name, note, value, activation_code, status, created_at)
     VALUES ('PAID01', 'Vali', '', 0, 'ACT999', 'reserved', ?)`
  ).bind(new Date().toISOString()).run();

  const r = await j('/api/records');
  const by = Object.fromEntries((r.body || []).map((x) => [x.code, x]));

  check('activated gift card -> isGift true', by.GIFT01?.isGift, true);
  check('purchased card -> isGift false', by.PAID01?.isGift, false);
  check('purchased card keeps its real price', by.PAID01?.price, 149000);
  check('price 0 alone does NOT mark a card as a gift', by.ZERO01?.isGift, false);
  check('reserved (not activated) gift is not shown as a gift yet', by.PAID01?.isGift, false);

  // Katalog kartasi faqat ASOSIY ISMNI ko'rsatadi — API `tg` ni hali
  // qaytaradi (boshqa joylarda kerak), lekin katalog UI uni chizmaydi.
  check('catalog API still returns the plain display name', by.GIFT01?.name, 'Ali');

  const s = await j('/api/records/search?q=Ali');
  const hit = (s.body?.records || []).find((x) => x.code === 'GIFT01');
  check('search results carry isGift too', hit?.isGift, true);
}

// ═══ 2. PROFIL FONI MEDIA — 50 MB ═══
const MAX = 50 * 1024 * 1024;
const gif = (n) => { const b = new Uint8Array(n); b.set([0x47, 0x49, 0x46, 0x38], 0); return b; };
const webm = (n) => { const b = new Uint8Array(n); b.set([0x1a, 0x45, 0xdf, 0xa3], 0); return b; };
const mp4 = (n) => { const b = new Uint8Array(n); b.set([...'....ftypisom'].map((c) => c.charCodeAt(0)), 0); return b; };
const upload = async (bytes, type, ck = cookie.user) => {
  const headers = { 'content-type': type, cookie: ck, 'cf-connecting-ip': '203.0.113.9', 'content-length': String(bytes.length) };
  const r = await worker.fetch(new Request('https://nfcstore.uz/api/upload-profile-bg', { method: 'POST', headers, body: bytes }), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};

check('exact limit constant is 52 428 800 bytes', MAX, 52428800);

{
  const ok = await upload(gif(2 * 1024 * 1024), 'image/gif');
  check('GIF under the limit is accepted', ok.status, 200);
  checkTrue('accepted GIF is stored under /uploads/ with a .gif name', /^\/uploads\/profilebg_[0-9a-f]+\.gif$/.test(ok.body?.url || ''));

  const v = await upload(webm(3 * 1024 * 1024), 'video/webm');
  check('WebM under the limit is accepted', v.status, 200);
  checkTrue('accepted WebM keeps a .webm name', /\.webm$/.test(v.body?.url || ''));

  const m = await upload(mp4(1024 * 1024), 'video/mp4');
  check('MP4 under the limit is accepted', m.status, 200);

  // Chegaraning AYNAN o'zi o'tishi kerak
  const edge = await upload(gif(MAX), 'image/gif');
  check('a file of exactly 50 MB is accepted', edge.status, 200);
}

// 50 MB dan KATTA -> 413, saqlanmaydi
{
  const before = env.UPLOADS._store.size;
  const big = await upload(gif(MAX + 1), 'image/gif');
  check('over the limit -> 413 too_large', [big.status, big.body?.error], [413, 'too_large']);
  check('413 response tells the client the limit in MB', big.body?.limitMb, 50);
  check('an oversized file is NOT written to storage', env.UPLOADS._store.size, before);
}

// content-length yolg'on bo'lsa ham haqiqiy hajm bo'yicha rad etiladi
{
  const bytes = gif(MAX + 1024);
  const r = await worker.fetch(new Request('https://nfcstore.uz/api/upload-profile-bg', {
    method: 'POST', body: bytes,
    headers: { 'content-type': 'image/gif', cookie: cookie.user, 'cf-connecting-ip': '203.0.113.9', 'content-length': '10' },
  }), env);
  check('a lying content-length does not bypass the limit -> 413', r.status, 413);
}

// MIME / sehrli baytlar
{
  const bad = await upload(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 'image/gif');
  check('bytes that are not GIF/MP4/WebM -> 422 bad_file', [bad.status, bad.body?.error], [422, 'bad_file']);

  const mismatch = await upload(gif(1024), 'video/mp4');
  check('declared MIME not matching the real bytes -> 422', [mismatch.status, mismatch.body?.error], [422, 'bad_file']);

  const octet = await upload(gif(1024), 'application/octet-stream');
  check('generic octet-stream is allowed when the bytes are a real GIF', octet.status, 200);

  const empty = await upload(new Uint8Array(0), 'image/gif');
  check('empty body -> 422', empty.status, 422);
}

// Ownership / auth
{
  const anon = await worker.fetch(new Request('https://nfcstore.uz/api/upload-profile-bg', {
    method: 'POST', body: gif(1024),
    headers: { 'content-type': 'image/gif', 'cf-connecting-ip': '203.0.113.9' },
  }), env);
  check('anonymous upload -> 401', anon.status, 401);

  // Faqat o'z profilining fonini o'zgartira oladi (yozuvni saqlash bosqichi)
  const foreign = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.other, json: { name: 'X', bgUrl: '/uploads/profilebg_deadbeef.gif' } });
  check("another user cannot set someone else's profile background -> 403", [foreign.status, foreign.body?.error], [403, 'forbidden']);

  const own = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', bgUrl: '/uploads/profilebg_deadbeef.mp4' } });
  checkTrue('the owner CAN set their own video background', own.status < 400);
  check('the saved background url is kept as-is', own.body?.bgUrl, '/uploads/profilebg_deadbeef.mp4');
}

// Boshqa upload limitlari O'ZGARMAGAN
{
  const bigVideo = await worker.fetch(new Request('https://nfcstore.uz/api/upload-card-video', {
    method: 'POST', body: webm(11 * 1024 * 1024),
    headers: { 'content-type': 'video/webm', cookie: cookie.user, 'cf-connecting-ip': '203.0.113.9' },
  }), env);
  check('post/card video limit is still 10 MB (unchanged) -> 413', bigVideo.status, 413);
}

done();
