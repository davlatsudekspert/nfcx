// MUSIQA YUKLASH — HAQIQIY BAYTLAR BILAN
//
// EGASINING SHIKOYATI (2026-09-20): "saytda musiqa yuklayotganda
// androidda rasm yoki video so'rayapti, mp3 topsam
// 'qo'llab-quvvatlanmaydi' deyapti".
//
// SABAB. Yuklashda ikki manba solishtiriladi: brauzer E'LON QILGAN
// tur va faylning SEHRLI BAYTLARI. Mos kelmasa fayl rad etiladi —
// bu TO'G'RI himoya (kengaytmasi almashtirilgan fayl o'tmasin).
//
// Lekin bir formatning nomi ko'p: Android mp3 ni ko'pincha
// `audio/mp3` deb e'lon qiladi, standart nomi esa `audio/mpeg`.
// Natijada HAQIQIY mp3 ham rad etilardi. FLAC esa umuman
// tanilmasdi.
//
// Bu test SOXTA MIME bilan ishlamaydi — har bir fayl o'zining
// haqiqiy sehrli baytlari bilan quriladi va haqiqiy worker'ga
// yuboriladi.
//
//   node scripts/test-audio-upload.mjs
import { readFileSync } from 'node:fs';
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

// R2 o'rnini bosuvchi: nima yozilganini eslab qoladi.
const stored = [];
env.UPLOADS = {
  async put(key, body, meta) { stored.push({ key, type: meta?.httpMetadata?.contentType }); return { key }; },
  async createMultipartUpload() { throw new Error('bu testda kerak emas'); },
};

const bytesOf = (head, len = 4096) => {
  const b = new Uint8Array(len);
  for (let i = 0; i < head.length; i++) b[i] = typeof head[i] === 'string' ? head[i].charCodeAt(0) : head[i];
  return b;
};
const str = (s) => [...s].map((c) => c.charCodeAt(0));

// Har bir format — O'ZINING haqiqiy sehrli baytlari bilan.
const FILES = {
  // ID3 tegli mp3 (eng keng tarqalgan).
  mp3id3: bytesOf([...str('ID3'), 3, 0, 0, 0, 0, 0, 0]),
  // Tegsiz mp3: freym sinxronizatsiyasi.
  mp3raw: bytesOf([0xff, 0xfb, 0x90, 0x00]),
  wav: bytesOf([...str('RIFF'), 0, 0, 0, 0, ...str('WAVE')]),
  ogg: bytesOf([...str('OggS'), 0, 2, 0, 0]),
  flac: bytesOf([...str('fLaC'), 0, 0, 0, 34]),
  // M4A: ftyp brendi "M4A ".
  m4a: bytesOf([0, 0, 0, 0x20, ...str('ftypM4A '), 0, 0, 0, 0]),
  // Brendi boshqa bo'lgan mp4 konteyner (ichida faqat ovoz).
  mp4a: bytesOf([0, 0, 0, 0x20, ...str('ftypisom'), 0, 0, 0, 0]),
  webm: bytesOf([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]),
  jpg: bytesOf([0xff, 0xd8, 0xff, 0xe0]),
  pdf: bytesOf([...str('%PDF-1.4'), 10, 10, 10, 10]),
};

const upload = async (body, contentType) => {
  const r = await worker.fetch(req('/api/upload-file', {
    method: 'POST', cookie: cookie.user, ip: '203.0.113.200',
    headers: { 'content-type': contentType },
    body,
  }), env, { waitUntil() {} });
  return { status: r.status, body: await r.json().catch(() => null) };
};

// ── 1) ANDROID AYTADIGAN NOMLAR ──────────────────────────────────────
//
// Bular HAQIQIY mp3 fayllar; farq faqat brauzer e'lon qilgan nomda.
for (const declared of ['audio/mpeg', 'audio/mp3', 'audio/mpg', 'audio/mpeg3', 'audio/x-mpeg', 'audio/x-mp3']) {
  const r = await upload(FILES.mp3id3, declared);
  check(`1) mp3 "${declared}" qabul qilindi`, r.status, 200);
}
check('1) tegsiz mp3 ham', (await upload(FILES.mp3raw, 'audio/mp3')).status, 200);
// Brauzer turni umuman bilmasa ham ishlasin.
check('1) noma’lum tur -> baytlar hal qiladi', (await upload(FILES.mp3id3, 'application/octet-stream')).status, 200);

// ── 2) QOLGAN FORMATLAR ──────────────────────────────────────────────
const CASES = [
  ['wav', 'audio/wav'], ['wav', 'audio/x-wav'], ['wav', 'audio/wave'], ['wav', 'audio/vnd.wave'],
  ['ogg', 'audio/ogg'], ['ogg', 'audio/opus'], ['ogg', 'audio/vorbis'], ['ogg', 'application/ogg'],
  ['flac', 'audio/flac'], ['flac', 'audio/x-flac'],
  ['m4a', 'audio/mp4'], ['m4a', 'audio/x-m4a'], ['m4a', 'audio/m4a'],
  ['mp4a', 'audio/mp4'], ['mp4a', 'audio/x-m4a'], ['mp4a', 'audio/aac'],
  ['webm', 'audio/webm'],
];
for (const [kind, declared] of CASES) {
  check(`2) ${kind} "${declared}"`, (await upload(FILES[kind], declared)).status, 200);
}

// ── 3) HIMOYA PASAYMADI ──────────────────────────────────────────────
//
// Taxalluslar faqat BIR XIL formatning boshqa nomlari. Bir oila
// o'rniga boshqasini o'tkazib bo'lmaydi.
check('3) rasm audio deb o‘tmaydi', (await upload(FILES.jpg, 'audio/mpeg')).status, 422);
check('3) audio rasm deb o‘tmaydi', (await upload(FILES.mp3id3, 'image/jpeg')).status, 422);
check('3) pdf audio deb o‘tmaydi', (await upload(FILES.pdf, 'audio/mp3')).status, 422);
check('3) sababi aniq', (await upload(FILES.jpg, 'audio/mpeg')).body?.error, 'bad_file');
// Tanilmagan bayt — baribir rad etiladi.
check('3) axlat bayt rad etiladi', (await upload(bytesOf([1, 2, 3, 4]), 'audio/mpeg')).status, 422);

// ── 4) SAQLANGAN TUR HAQIQIY BO'LSIN ────────────────────────────────
//
// R2 ga E'LON QILINGAN emas, ANIQLANGAN tur yoziladi — aks holda
// brauzer keyin faylni noto'g'ri o'qirdi.
stored.length = 0;
await upload(FILES.mp3id3, 'audio/mp3');
check('4) mp3 audio/mpeg deb saqlandi', stored[0]?.type, 'audio/mpeg');
check('4) kengaytmasi ham', stored[0]?.key?.endsWith('.mp3'), true);
stored.length = 0;
await upload(FILES.flac, 'audio/x-flac');
check('4) flac to‘g‘ri saqlandi', stored[0]?.type, 'audio/flac');

// ── 5) MANBA QOIDALARI ───────────────────────────────────────────────
const w = readFileSync(new URL('../hosting/worker.js', import.meta.url), 'utf8');
checkTrue('5) FLAC tanilishi qo‘shilgan', /head\.slice\(0, 4\) === 'fLaC'/.test(w));
checkTrue('5) taxalluslar yuklashga ulangan', /aliases: UPLOAD_TYPE_ALIASES/.test(w));

// TANLAGICH KENGAYTMALARNI HAM KO'RSATSIN.
//
// `audio/*` ning O'ZI yetarli emas: Android'dagi fayl tanlagich
// unda rasm va video ko'rsatib, musiqani ro'yxatga qo'shmaydi.
for (const [name, file] of [
  ['shaxsiy', '../src/pages/AccountPage.jsx'],
  ['biznes', '../src/pages/CompanyWorkspacePage.jsx'],
]) {
  const src = readFileSync(new URL(file, import.meta.url), 'utf8');
  checkTrue(`5) ${name}: mp3 kengaytmasi ko‘rsatilgan`, /accept="audio\/\*,\.mp3/.test(src));
  checkTrue(`5) ${name}: m4a va wav ham`, /\.m4a/.test(src) && /\.wav/.test(src));
}

done('Musiqa yuklash');
