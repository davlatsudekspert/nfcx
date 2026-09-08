// Yangilik havolasini ulashish — Telegram/WhatsApp/Facebook botlari uchun
// server tomonda qo'yiladigan meta teglar (hosting/worker.js).
//
// NIMA UCHUN: sayt SPA — /yangiliklar/12 uchun ham bosh sahifaning
// index.html'i qaytadi. Robotlar JavaScript ishlatmaydi, shu sabab har
// qanday yangilik havolasi bir xil umumiy sarlavha bilan, maqola matnisiz
// va rasmisiz ulashilardi. Worker endi shu yo'l uchun meta teglarni
// maqolaniki bilan almashtiradi.
//
//   node scripts/test-news-share.mjs
import worker, { ensureCoreSchema, injectNewsOg } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';
import { readFileSync } from 'node:fs';

const { check, checkTrue, done } = makeChecker();

// Haqiqiy index.html — testda soxta nusxa emas, aynan chop etiladigan fayl.
// Shunda index.html o'zgarib teg nomlari boshqacha bo'lib qolsa, test yiqiladi.
const INDEX_HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const { env } = makeEnv({
  ASSETS: {
    fetch: async (request) => {
      const p = new URL(request.url).pathname;
      if (p === '/' || p === '/index.html') {
        return new Response(INDEX_HTML, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      return new Response('not found', { status: 404 });
    },
  },
});
await ensureCoreSchema(env);
await seedBasic(env);

const now = new Date().toISOString();
await env.DB.prepare(`INSERT INTO news (id, title, body, image_url, published, created_at, updated_at)
  VALUES (1, ?, ?, ?, 1, ?, ?)`).bind(
  "Payme orqali to'lovlar ishga tushdi",
  "NFCSTORE'da endi Payme orqali to'lash mumkin.\n\nKarta narxi to'langach ID darhol biriktiriladi. Savollar bo'lsa <admin> bilan bog'laning & yozing.",
  '/uploads/news_abc123.png', now, now,
).run();
await env.DB.prepare(`INSERT INTO news (id, title, body, image_url, published, created_at, updated_at)
  VALUES (2, 'Rasmsiz yangilik', 'Qisqa matn.', '', 1, ?, ?)`).bind(now, now).run();
await env.DB.prepare(`INSERT INTO news (id, title, body, image_url, published, created_at, updated_at)
  VALUES (3, 'Chop etilmagan', 'Yashirin.', '', 0, ?, ?)`).bind(now, now).run();

const html = async (pathname) => {
  const res = await worker.fetch(req(pathname, { headers: { accept: 'text/html' } }), env);
  return { status: res.status, ctype: res.headers.get('content-type') || '', text: await res.text() };
};
const metaOf = (text, attr, key) => {
  const m = new RegExp(`<meta[^>]*\\s${attr}="${key}"[^>]*content="([^"]*)"`, 'i').exec(text);
  return m ? m[1] : null;
};

// ── 1) Maqola sahifasi o'z meta teglari bilan qaytadi ──────────────────
const a = await html('/yangiliklar/1');
check('maqola 200', a.status, 200);
checkTrue('HTML qaytadi', a.ctype.includes('text/html'));
check('og:title maqolaniki', metaOf(a.text, 'property', 'og:title'), "Payme orqali to'lovlar ishga tushdi — NFCSTORE");
check('og:type article', metaOf(a.text, 'property', 'og:type'), 'article');
check('og:url maqolaniki', metaOf(a.text, 'property', 'og:url'), 'https://nfcstore.uz/yangiliklar/1');
check('og:image maqola rasmi (to‘liq manzil)', metaOf(a.text, 'property', 'og:image'), 'https://nfcstore.uz/uploads/news_abc123.png');
check('twitter:image ham xuddi shu', metaOf(a.text, 'name', 'twitter:image'), 'https://nfcstore.uz/uploads/news_abc123.png');
checkTrue('<title> maqolaniki', a.text.includes("<title>Payme orqali to'lovlar ishga tushdi — NFCSTORE</title>"));
checkTrue('canonical maqolaniki', a.text.includes('<link rel="canonical" href="https://nfcstore.uz/yangiliklar/1" />'));

// Tavsif — maqola matnidan, bir qatorga siqilgan holda.
const desc = metaOf(a.text, 'property', 'og:description');
checkTrue('og:description maqola matnidan', desc.startsWith("NFCSTORE&#39;da endi Payme orqali to&#39;lash mumkin.") || desc.startsWith("NFCSTORE'da endi Payme orqali to'lash mumkin."));
checkTrue('tavsifda yangi qator yo‘q', !desc.includes('\n'));
check('description tegi ham yangilandi', metaOf(a.text, 'name', 'description'), desc);

// XAVFSIZLIK: maqola matnidagi < > & " belgilari HTML'ga sizib kirmaydi.
checkTrue('teg belgilari ekranlangan', desc.includes('&lt;admin&gt;') && desc.includes('&amp;'));
checkTrue('meta teg buzilmagan', !/content="[^"]*"[^>]*"/.test(desc));

// Maqola rasmi o'lchami noma'lum — 1200x630 teglari qolib ketmasligi kerak.
check('og:image:width olib tashlandi', metaOf(a.text, 'property', 'og:image:width'), null);
check('og:image:height olib tashlandi', metaOf(a.text, 'property', 'og:image:height'), null);

// SPA o'zgarishsiz: brauzer o'sha ilovani yuklaydi.
checkTrue('SPA skripti joyida', a.text.includes('/src/main.jsx') || /<script[^>]+src="[^"]*\.js"/.test(a.text));
checkTrue('<div id="root"> joyida', a.text.includes('id="root"'));

// ── 2) Rasmsiz yangilik — umumiy og-cover.png ──────────────────────────
const b = await html('/yangiliklar/2');
check('rasmsiz yangilikda og-cover', metaOf(b.text, 'property', 'og:image'), 'https://nfcstore.uz/og-cover.png');
check('umumiy rasmda o‘lcham qoladi', metaOf(b.text, 'property', 'og:image:width'), '1200');
check('og:title ikkinchi maqolaniki', metaOf(b.text, 'property', 'og:title'), 'Rasmsiz yangilik — NFCSTORE');

// ── 3) Chop etilmagan / mavjud bo'lmagan — umumiy qobiq ────────────────
// Bunday havola ulashilsa, ichki matn sizib chiqmasligi kerak.
const c = await html('/yangiliklar/3');
check('chop etilmagan yangilik 200 (SPA o‘zi hal qiladi)', c.status, 200);
checkTrue('chop etilmagan sarlavha sizmaydi', !c.text.includes('Chop etilmagan'));
check('umumiy og:title qoladi', metaOf(c.text, 'property', 'og:title'), 'NFCSTORE — raqamli profil va NFC karta');
const d = await html('/yangiliklar/999');
checkTrue('yo‘q yangilik — umumiy qobiq', !d.text.includes('Payme orqali'));

// ── 4) Ro'yxat sahifasi va boshqa yo'llar tegilmaydi ───────────────────
const list = await html('/yangiliklar');
check('ro‘yxat sahifasi umumiy og:type', metaOf(list.text, 'property', 'og:type'), 'website');

// ── 5) Baza javob bermasa sahifa baribir ochiladi ──────────────────────
const brokenEnv = { ...env, DB: { prepare: () => ({ bind: () => ({ first: async () => { throw new Error('d1 down'); } }) }) } };
const broken = await worker.fetch(req('/yangiliklar/1', { headers: { accept: 'text/html' } }), brokenEnv);
check('baza yiqilsa ham 200', broken.status, 200);

// ── 6) injectNewsOg — sof funksiya sifatida ────────────────────────────
const injected = injectNewsOg('<html><head><title>Eski</title></head><body></body></html>', {
  title: 'Sarlavha "qo\'shtirnoq" bilan',
  description: 'Tavsif',
  url: 'https://nfcstore.uz/yangiliklar/7',
  image: 'https://nfcstore.uz/x.png',
  usesFallbackImage: false,
});
checkTrue('teglar yo‘q bo‘lsa ham qo‘shiladi', injected.includes('property="og:title"') && injected.includes('property="og:url"'));
checkTrue('sarlavhadagi qo‘shtirnoq ekranlangan', injected.includes('&quot;qo\'shtirnoq&quot;'));
checkTrue('<title> almashtirildi', !injected.includes('<title>Eski</title>'));

done();
