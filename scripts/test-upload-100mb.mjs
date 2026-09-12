// BUTUN SAYT BO'YICHA FAYL CHEGARASI — 100 MB.
//
// Egasining talabi: "hamma joydagi limitni 100 MB qilib qo'y, butun
// sayt ichidagi fayl yuklash joyiga".
//
// Buni shunchaki sonni o'zgartirib bajarib bo'lmasdi. Ilgari fayllar
// base64 dataURL bo'lib ketardi: base64 hajmni ~33% ga oshiradi, ya'ni
// 100 MB fayl 133 MB satrga aylanardi — na brauzer, na Worker izolyati
// (128 MB xotira) uni ko'tarardi. Shuning uchun yuklash YO'LINING O'ZI
// almashtirildi: fayl XOM BINAR sifatida yuboriladi va server uni
// BO'LAKLAB R2 ga oqizadi (multipart), ya'ni xotirada bir vaqtda faqat
// bitta bo'lak turadi.
//
// Bu test o'sha qarorni qo'riqlaydi.
//
//   node scripts/test-upload-100mb.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

const MB = 1024 * 1024;
const LIMIT = 100 * MB;

// Sehrli baytlari HAQIQIY namunalar — server turni mijoz aytganiga
// emas, baytlarga qarab aniqlaydi.
const withHead = (head, size) => {
  const b = new Uint8Array(size);
  b.set(head, 0);
  return b;
};
const png = (n) => withHead([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], n);
const jpg = (n) => withHead([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0], n);
const mp3 = (n) => withHead([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0, 0, 0], n);
const mp4 = (n) => withHead([...'....ftypisom'].map((c) => c.charCodeAt(0)), n);
const pdf = (n) => withHead([...'%PDF-1.7\n%..'].map((c) => c.charCodeAt(0)), n);
const xlsx = (n) => withHead([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0], n);
const junk = (n) => withHead([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], n);

const post = async (path, bytes, { type = 'application/octet-stream', ck = cookie.user } = {}) => {
  const headers = { 'content-type': type, 'cf-connecting-ip': '203.0.113.44', 'content-length': String(bytes.length) };
  if (ck) headers.cookie = ck;
  const r = await worker.fetch(new Request(`https://nfcstore.uz${path}`, { method: 'POST', headers, body: bytes }), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};

// ── 1) Umumiy endpoint har xil turni qabul qiladi ────────────────────
{
  const cases = [
    ['rasm (png)', png(64 * 1024), 'image/png', '.png'],
    ['rasm (jpg)', jpg(64 * 1024), 'image/jpeg', '.jpg'],
    ['musiqa (mp3)', mp3(64 * 1024), 'audio/mpeg', '.mp3'],
    ['video (mp4)', mp4(64 * 1024), 'video/mp4', '.mp4'],
    ['hujjat (pdf)', pdf(64 * 1024), 'application/pdf', '.pdf'],
  ];
  for (const [label, bytes, type, ext] of cases) {
    const r = await post('/api/upload-file', bytes, { type });
    check(`1) ${label} qabul qilinadi`, r.status, 200);
    checkTrue(`1) ${label} -> /uploads/…${ext}`, String(r.body?.url || '').startsWith('/uploads/file_') && String(r.body?.url).endsWith(ext));
  }
  const bad = await post('/api/upload-file', junk(1024), { type: 'image/png' });
  check('1) notanish baytlar -> 422 bad_file', [bad.status, bad.body?.error], [422, 'bad_file']);
}

// ── 2) AYNAN 100 MB o'tadi, bir bayt oshgani o'tmaydi ────────────────
{
  const edge = await post('/api/upload-file', png(LIMIT), { type: 'image/png' });
  check('2) aynan 100 MB qabul qilinadi', edge.status, 200);

  const over = await post('/api/upload-file', png(LIMIT + 1), { type: 'image/png' });
  check('2) 100 MB + 1 bayt -> 413 too_large', [over.status, over.body?.error], [413, 'too_large']);
  check('2) javob chegarani MB da aytadi', over.body?.limitMb, 100);
}

// ── 3) Yolg'on content-length bilan aylanib o'tib bo'lmaydi ──────────
// Bu eng oson unutiladigan tekshiruv: ilgari bosh bo'lak umuman
// sanalmay qolgan edi va bitta katta bo'lak bilan kelgan tana
// chegarani aylanib o'tardi.
{
  const bytes = png(LIMIT + 4096);
  const r = await worker.fetch(new Request('https://nfcstore.uz/api/upload-file', {
    method: 'POST', body: bytes,
    headers: { 'content-type': 'image/png', cookie: cookie.user, 'cf-connecting-ip': '203.0.113.44', 'content-length': '10' },
  }), env);
  check('3) yolg‘on content-length chegarani aylanib o‘tmaydi -> 413', r.status, 413);
}

// ── 4) Katta fayl R2 ga BUTUNLIGICHA yoziladi ────────────────────────
// 8 MB dan katta fayl multipart bo'lib ketadi — bo'laklar noto'g'ri
// ulansa fayl jimgina buzilardi.
{
  const size = 21 * MB; // bir necha bo'lak + oxirgi kichik bo'lak
  const bytes = png(size);
  // Barmoq izi — sehrli baytlardan KEYIN boshlanadi (aks holda
  // PNG sarlavhasi buzilib, fayl rad etilardi).
  for (let i = 4096; i < size; i += 4096) bytes[i] = i % 251;
  const r = await post('/api/upload-file', bytes, { type: 'image/png' });
  check('4) 21 MB fayl qabul qilinadi', r.status, 200);
  check('4) server hajmni to‘g‘ri qaytaradi', r.body?.size, size);
  const stored = await env.UPLOADS.get('uploads/' + String(r.body.url).split('/').pop());
  checkTrue('4) fayl R2 da bor', !!stored);
  const saved = stored.body;
  check('4) saqlangan hajm asl nusxaga teng', saved.length, size);
  checkTrue('4) baytlar AYNAN bir xil (bo‘laklar to‘g‘ri ulandi)',
    saved.every((b, i) => b === bytes[i]));
}

// ── 5) Autentifikatsiya — chegara ko'tarilgani bilan ochilib qolmadi ──
{
  const anon = await post('/api/upload-file', png(1024), { type: 'image/png', ck: null });
  check('5) sessiyasiz -> 401', [anon.status, anon.body?.error], [401, 'unauthorized']);
}

// ── 6) Istorya endpointi PDF/mp3 ni QABUL QILMAYDI ───────────────────
// Umumiy endpoint turlar ro'yxatini kengaytirdi, lekin istoryaga faqat
// rasm va video tushishi kerak.
{
  const doc = await post('/api/upload-media', pdf(4096), { type: 'application/pdf' });
  check('6) istoryaga PDF -> 422 bad_file', [doc.status, doc.body?.error], [422, 'bad_file']);
  const song = await post('/api/upload-media', mp3(4096), { type: 'audio/mpeg' });
  check('6) istoryaga mp3 -> 422 bad_file', [song.status, song.body?.error], [422, 'bad_file']);
  const pic = await post('/api/upload-media', png(4096), { type: 'image/png' });
  check('6) istoryaga rasm -> 200', pic.status, 200);
}

// ── 7) Admin hujjatlari: xlsx va csv ham o'tadi ──────────────────────
{
  const sheet = await post('/api/admin/upload-doc', xlsx(8192), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ck: cookie.admin });
  check('7) xlsx qabul qilinadi', sheet.status, 200);
  checkTrue('7) xlsx -> /uploads/fin_….xlsx', String(sheet.body?.url || '').endsWith('.xlsx'));

  const csvBytes = new TextEncoder().encode('sana,summa\n2026-09-01,120000\n');
  const csv = await post('/api/admin/upload-doc', csvBytes, { type: 'text/csv', ck: cookie.admin });
  check('7) csv qabul qilinadi', csv.status, 200);

  // csv sehrli baytga ega emas — shuning uchun u FAQAT mijoz shunday
  // deganda o'tadi. Boshqa tur deb kelsa o'tmasligi kerak.
  const lying = await post('/api/admin/upload-doc', csvBytes, { type: 'application/pdf', ck: cookie.admin });
  check('7) csv ni PDF deb yuborish -> 422', lying.status, 422);

  const anon = await post('/api/admin/upload-doc', xlsx(1024), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  checkTrue('7) adminsiz hujjat yuklab bo‘lmaydi', anon.status === 401 || anon.status === 403);
}

// ── 8) Eski profil foni / karta videosi ham 100 MB ga ko'tarildi ─────
{
  const gif = withHead([0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0, 0, 0, 0, 0], 30 * MB);
  const bg = await post('/api/upload-profile-bg', gif, { type: 'image/gif' });
  check('8) 30 MB GIF fon qabul qilinadi (ilgari 50 MB chegara edi)', bg.status, 200);

  const vid = await post('/api/upload-card-video', mp4(30 * MB), { type: 'video/mp4' });
  check('8) 30 MB karta videosi qabul qilinadi (ilgari 10 MB edi)', vid.status, 200);
}

done();
