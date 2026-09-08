// Ixcham musiqa pleeri — maqsadli test (Node, brauzersiz qism).
//   node scripts/test-music-player.mjs
//
// Bu yerda pleerning SOF (pure) mantig'i tekshiriladi: manba tahlili,
// qo'shiq nomi va musiqa limitlari. Geometriya (yopiq qator 64-76px,
// ochilgan iframe <= 356x200, minimizatsiya, ENDED -> auto-next) brauzer
// tekshiruvida o'lchanadi — hisobotga qarang.
import worker from '../hosting/worker.js';
import { parseMusicSource, audioFileTitle, cachedYoutubeTitle, fetchYoutubeTitle } from '../src/lib/music.js';
import { MUSIC_LIMIT_FREE, MUSIC_LIMIT_PREMIUM, musicLimit } from '../src/lib/musicLimits.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const j = async (pathname, init) => {
  const r = await worker.fetch(req(pathname, init), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const tracks = (n) => Array.from({ length: n }, (_, i) => `https://cdn.example.com/uploads/song${i + 1}.mp3`);

// ═══ 1. MANBA TAHLILI — YouTube / audio / Yandex ═══
{
  check('youtu.be havolasi -> youtube', parseMusicSource('https://youtu.be/dQw4w9WgXcQ'), { kind: 'youtube', id: 'dQw4w9WgXcQ' });
  check('watch?v= havolasi -> youtube', parseMusicSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), { kind: 'youtube', id: 'dQw4w9WgXcQ' });
  check('mp3 havolasi -> audio (video YO‘Q)', parseMusicSource('https://cdn.example.com/a.mp3').kind, 'audio');
  check('m4a havolasi -> audio', parseMusicSource('https://cdn.example.com/a.m4a').kind, 'audio');
  check('ogg havolasi -> audio', parseMusicSource('https://cdn.example.com/a.ogg').kind, 'audio');
  check('yandex havolasi -> yandex', parseMusicSource('https://music.yandex.ru/album/1/track/2').kind, 'yandex');
}

// ═══ 2. IXCHAM QATORDAGI QO'SHIQ NOMI ═══
{
  check('audio fayl nomi havoladan olinadi', audioFileTitle('https://cdn.example.com/uploads/My%20Song_final.mp3'), 'My Song final');
  check('kengaytma olib tashlanadi', audioFileTitle('https://x/y/Track-01.m4a'), 'Track 01');
  check('nom topilmasa null', audioFileTitle(''), null);
  check('YouTube nomi hali keshda yo‘q', cachedYoutubeTitle('dQw4w9WgXcQ'), null);
  // oEmbed tarmoqqa chiqadi; bu muhitda bloklangan bo'lishi mumkin —
  // MUHIMI: xato tashlamasin va null qaytarsin (chaqiruvchi zaxira nom
  // "Musiqa" ni ko'rsatadi).
  const t = await fetchYoutubeTitle('dQw4w9WgXcQ');
  checkTrue('fetchYoutubeTitle xato tashlamaydi (null yoki matn)', t === null || typeof t === 'string');
}

// ═══ 3. PR #20 REGRESSIYA — MUSIQA LIMITI 5 / PREMIUM 10 ═══
{
  check('frontend limitlari 5 / 10', [MUSIC_LIMIT_FREE, MUSIC_LIMIT_PREMIUM], [5, 10]);
  const r = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', musicUrls: tracks(9) } });
  check('oddiy foydalanuvchi backendda 5 ta bilan cheklanadi', r.body?.musicUrls?.length, musicLimit(false));

  await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run();
  const p = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', musicUrls: tracks(14) } });
  check('Premium foydalanuvchi 10 tagacha', p.body?.musicUrls?.length, musicLimit(true));

  // Aralash pleylist (YouTube + audio) tartibda saqlanadi — pleer shu
  // ro'yxat bo'ylab avtomatik o'tadi.
  const mixed = ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://cdn.example.com/uploads/b.mp3', 'https://music.yandex.ru/album/1/track/2'];
  const m = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'M', musicUrls: mixed } });
  check('aralash pleylist tartibda saqlanadi', m.body?.musicUrls, mixed);
  check('...va har biri to‘g‘ri manba sifatida tahlil qilinadi',
    (m.body?.musicUrls || []).map((u) => parseMusicSource(u).kind), ['youtube', 'audio', 'yandex']);
  await env.DB.prepare(`UPDATE users SET is_premium = 0 WHERE id = 1`).run();
}

// ═══ 4. PR #21 REGRESSIYA — KATALOG (qisqa) ═══
{
  const card = (code, name, price, ts, source = null) => env.DB.prepare(
    `INSERT INTO cards (code, name, price, ts, user_id, profile_type, source) VALUES (?,?,?,?,1,'personal',?)`
  ).bind(code, name, price, ts, source).run();
  await card('12345678', 'Avtomatik ID', 0, 9000, 'registration_auto');
  await card('QWE121', 'Silver ID', 1, 3001);
  await card('QWE123', 'Bronza ID', 7, 3002);
  await card('SSS123', 'Gold ID', 0, 3003);
  await card('XYZ131', 'Sovga karta', 0, 5001);
  await env.DB.prepare(
    `INSERT INTO nfc_gifts (code, activation_code, status, created_at) VALUES ('XYZ131','ACT-X','activated','2026-01-01T00:00:00Z')`
  ).run();

  const rows = (await j('/api/records')).body || [];
  const by = Object.fromEntries(rows.map((r) => [r.code, r]));
  check('registratsiya avtomatik ID katalogda YO‘Q', by['12345678'], undefined);
  check('katalog sanog‘iga avtomatik ID qo‘shilmagan', rows.filter((r) => /^[0-9]{8}$/.test(r.code)).length, 0);
  check('Silver 99 000', by.QWE121?.price, 99000);
  check('Bronza 49 000', by.QWE123?.price, 49000);
  check('Gold 149 000', by.SSS123?.price, 149000);
  check('Premium 199 000 (BIZ777)', by.BIZ777?.price, 199000);
  check('faollashtirilgan sovg‘a -> isGift (0 so‘m emas)', by.XYZ131?.isGift, true);
  check('katalog kartasida username qo‘shilmagan', by.QWE121?.name, 'Silver ID');
  // 2026-09: VIP001 — egasi bor EKSLYUZIV ID. Ekslyuziv daraja
  // to'g'ridan-to'g'ri sotilmaydi, demak u sotuvdan o'tmagan — summa
  // ko'rsatilmaydi. Lekin u SOVG'A ham emas: hech kim uni sovg'a
  // qilmagan. Ikki belgi ajratilgan — "Sovg'a" va "Sotuvda emas".
  // Muhimi katalog va profil BIR XIL bo'lsin (avval ular farq qilardi).
  const vip = (await j('/api/records/VIP001')).body;
  check('profil narx belgisi katalog bilan bir xil manbadan', vip?.price, by.VIP001?.price ?? 0);
  check("ekslyuziv ID profilda ham \"sotuvda emas\"", [vip?.price, vip?.notForSale, vip?.isGift], [0, true, false]);
  check('...va katalogdagi belgi bilan bir xil',
    [by.VIP001?.notForSale, by.VIP001?.isGift], [vip?.notForSale, vip?.isGift]);
}

done();
