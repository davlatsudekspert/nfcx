// Kompaniya ALOQA qo'shimchalari: Instagram, Facebook, karta raqami,
// lokatsiya, o'zi qo'shadigan havolalar va musiqa (2026-09, egasining
// so'rovi).
//
// Nima tekshiriladi:
//   • yangi ustunlar ESKI bazaga ALTER bilan qo'shiladi (0001-schema.sql
//     da ular yo'q — ya'ni bu test aynan migratsiya yo'lini yuradi);
//   • saqlangan qiymat qaytib keladi (round-trip);
//   • bo'sh koordinata `0` EMAS, `null` bo'ladi — aks holda profil
//     Gvineya ko'rfazidagi 0,0 nuqtaga tushib qolardi (bu xato shaxsiy
//     profilda bo'lgan, kompaniyada takrorlanmasin);
//   • havolalar 8 ta, musiqa 5 ta bilan CHEKLANADI (mijoz yuborgan
//     ro'yxat uzun bo'lsa ham);
//   • nomsiz yoki manzilsiz havola tashlab yuboriladi;
//   • javascript: kabi xavfli manzil o'tmaydi;
//   • PATCH da maydon YUBORILMASA — eski qiymat o'chib ketmaydi.
//
//   node scripts/test-company-contact-extras.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const call = (path, init) => worker.fetch(req(path, init), env);
const patch = async (json) => {
  const res = await call('/api/companies/NFCTEST', { method: 'PATCH', cookie: cookie.user, json });
  return { status: res.status, body: await res.json().catch(() => null) };
};

// ── Kompaniya yaratamiz (egasi — user#1) ───────────────────────────────
const created = await call('/api/companies', {
  method: 'POST', cookie: cookie.user,
  json: {
    companyId: 'NFCTEST', displayName: 'Test Kompaniya', city: 'Toshkent',
    phone: '+998901234567', category: 'other',
    description: 'Bu test uchun yaratilgan kompaniya tavsifi, yigirma belgidan uzun.',
  },
});
check('kompaniya yaratildi', created.status, 201);

// ── 1) Round-trip ──────────────────────────────────────────────────────
const saved = await patch({
  instagram: 'nfcstore_uz', facebook: 'facebook.com/nfcstore', cardNumber: '8600 1234 5678 9012',
  latitude: 41.311081, longitude: 69.240562,
  extraLinks: [{ label: 'Menyu', url: 'https://example.com/menu' }],
  music: ['https://example.com/a.mp3'],
});
check('PATCH 200', saved.status, 200);
check('instagram saqlandi', saved.body.company.instagram, 'nfcstore_uz');
check('facebook saqlandi', saved.body.company.facebook, 'facebook.com/nfcstore');
check('karta raqami saqlandi', saved.body.company.cardNumber, '8600 1234 5678 9012');
check('latitude saqlandi', saved.body.company.latitude, 41.311081);
check('longitude saqlandi', saved.body.company.longitude, 69.240562);
check('qo‘shimcha havola saqlandi', saved.body.company.extraLinks, [{ label: 'Menyu', url: 'https://example.com/menu' }]);
check('musiqa saqlandi', saved.body.company.music, ['https://example.com/a.mp3']);

// Public GET da ham ko'rinadimi (sahifa shu javobdan o'qiydi).
const publicRes = await call('/api/companies/NFCTEST', { cookie: cookie.user });
const publicBody = await publicRes.json();
check('GET da instagram bor', publicBody.company.instagram, 'nfcstore_uz');
check('GET da lokatsiya bor', [publicBody.company.latitude, publicBody.company.longitude], [41.311081, 69.240562]);

// ── 2) Yuborilmagan maydon o'chmaydi ───────────────────────────────────
const untouched = await patch({ city: 'Samarqand' });
check('yuborilmagan instagram saqlanib qoldi', untouched.body.company.instagram, 'nfcstore_uz');
check('yuborilmagan lokatsiya saqlanib qoldi', untouched.body.company.latitude, 41.311081);
check('yuborilmagan havolalar saqlanib qoldi', untouched.body.company.extraLinks.length, 1);
check('yuborilmagan musiqa saqlanib qoldi', untouched.body.company.music.length, 1);

// ── 3) Bo'sh koordinata — null, 0 EMAS ─────────────────────────────────
const cleared = await patch({ latitude: '', longitude: '' });
check('bo‘sh latitude → null', cleared.body.company.latitude, null);
check('bo‘sh longitude → null', cleared.body.company.longitude, null);
const nulled = await patch({ latitude: null, longitude: null });
check('null latitude → null', nulled.body.company.latitude, null);

// Chegaradan tashqari koordinata qabul qilinmaydi.
const outOfRange = await patch({ latitude: 999, longitude: -999 });
check('999 latitude rad etildi', outOfRange.body.company.latitude, null);
check('-999 longitude rad etildi', outOfRange.body.company.longitude, null);
// 0,0 ATAYLAB kiritilsa — bu haqiqiy qiymat, saqlanadi.
const zero = await patch({ latitude: 0, longitude: 0 });
check('ataylab 0 saqlanadi', [zero.body.company.latitude, zero.body.company.longitude], [0, 0]);

// ── 4) Cheklovlar ──────────────────────────────────────────────────────
const many = await patch({
  extraLinks: Array.from({ length: 12 }, (_, i) => ({ label: `L${i}`, url: `https://example.com/${i}` })),
  music: Array.from({ length: 9 }, (_, i) => `https://example.com/${i}.mp3`),
});
check('havolalar 8 ta bilan cheklandi', many.body.company.extraLinks.length, 8);
check('musiqa 5 ta bilan cheklandi', many.body.company.music.length, 5);

const dirty = await patch({
  extraLinks: [
    { label: '', url: 'https://example.com/nomsiz' },      // nomsiz
    { label: 'Manzilsiz', url: '' },                        // manzilsiz
    { label: 'Xavfli', url: 'javascript:alert(1)' },        // xavfli sxema
    { label: 'Yaxshi', url: 'https://example.com/ok' },
  ],
  music: ['javascript:alert(1)', '', 'https://example.com/ok.mp3'],
});
check('faqat to‘liq va xavfsiz havola qoldi', dirty.body.company.extraLinks, [{ label: 'Yaxshi', url: 'https://example.com/ok' }]);
check('xavfli musiqa manzili tashlandi', dirty.body.company.music, ['https://example.com/ok.mp3']);

// ── 5) Begona foydalanuvchi tahrirlay olmaydi ──────────────────────────
const stranger = await call('/api/companies/NFCTEST', { method: 'PATCH', cookie: cookie.other, json: { instagram: 'buzuq' } });
checkTrue('begona PATCH rad etildi', stranger.status === 403 || stranger.status === 404);

done();
