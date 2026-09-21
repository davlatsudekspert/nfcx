// JONLI WORKERDA KOD KUTAYOTGAN SOZLAMALAR BORMI.
//
// ═══ NIMA UCHUN BU FAYL BOR ═══
//
// 2026-09-15 da `nfcstore.uz` ga xizmat qiladigan Worker almashdi:
// ilgari `/api/*` marshrutlari `nfcstore-api` ga tushardi, keyin
// hammasi `nfcstore-uz` ning Custom Domain'iga ko'chirildi.
//
// Kod ko'chdi. SECRETLAR KO'CHMADI — ular Worker'ga biriktirilgan
// bo'ladi, skriptga emas. `nfcstore-api` da 15 ta secret qoldi,
// `nfcstore-uz` da esa atigi 6 tasi bor edi.
//
// Eng yomoni — BU JIM BO'LDI. Kod har bir sozlamani "yo'q bo'lsa
// xizmatni o'chir" tarzida tekshiradi (bu to'g'ri qoida: bitta
// kalit tugagani butun saytni yiqitmasin). Natijada emailga kod
// yuborish bir hafta davomida indamay o'chiq turdi va faqat odam
// telefonda ro'yxatdan o'tmoqchi bo'lganda ma'lum bo'ldi.
//
// Endi har deploy'dan keyin JONLI Worker so'roq qilinadi va kod
// o'qiydigan har bir nom ro'yxat bilan solishtiriladi.
//
// ═══ MAXFIYLIK ═══
//
// Cloudflare API secret QIYMATINI umuman qaytarmaydi — faqat nom va
// tur (`secret_text`). Bu skript ham faqat NOMLAR bilan ishlaydi va
// hech qanday qiymatni o'qimaydi, yozmaydi, chiqarmaydi.
//
//   CF_API_TOKEN=... CF_ACCOUNT=... node scripts/test-worker-secrets.mjs
//
// Token yoki hisob berilmasa test O'TKAZIB YUBORILADI (mahalliy
// ishga tushirishda to'sqinlik qilmasin).

import { readFileSync } from 'node:fs';

const TOKEN = process.env.CF_API_TOKEN || '';
const ACCOUNT = process.env.CF_ACCOUNT || '';
const WORKER = process.env.CF_WORKER || 'nfcstore-uz';

// KOD YO'Q BO'LSA JIM O'CHADIGAN XIZMATLAR.
//
// Har biri: nom -> yo'qolganda nima ishlamay qoladi. Ro'yxat
// qo'lda emas — pastda manbadan o'qilgan nomlar bilan
// solishtiriladi, ya'ni kodga yangi `env.X` qo'shilsa va u shu
// yerda yozilmagan bo'lsa ham test buni aytadi.
const REQUIRED = {
  RESEND_API_KEY: 'emailga tasdiqlash kodi va parol tiklash',
  RESEND_FROM: 'emailga tasdiqlash kodi va parol tiklash',
  TELEGRAM_BOT_TOKEN: 'telefon tasdig\'i va admin xabarnomalari',
  TELEGRAM_BOT_USERNAME: 'botga ulanish havolasi',
  TELEGRAM_WEBHOOK_SECRET: 'Telegram webhook tekshiruvi',
  ADMIN_CHAT_ID: 'adminga xabarnoma',
  GEMINI_API_KEY: 'AI yordamchi',
  CLICK_MERCHANT_ID: 'Click to\'lovi',
  CLICK_SECRET_KEY: 'Click to\'lovi',
  CLICK_SERVICE_ID: 'Click to\'lovi',
  CLICK_RETURN_URL: 'Click to\'lovidan qaytish manzili',
  PAYME_KEY: 'Payme to\'lovi',
  PAYME_MERCHANT_ID: 'Payme to\'lovi',
  ANDROID_APP_FINGERPRINTS: 'Android App Links (assetlinks.json)',
};

// Ixtiyoriy — yo'qligi xato emas.
const OPTIONAL = new Set([
  'ASSISTANT_MODEL', 'ASSISTANT_OFF', 'AI_API_KEY',
  'ADMIN_IP_WHITELIST_BYPASS', 'ANDROID_APP_PACKAGE',
]);

// wrangler.jsonc o'zi qo'yadigan bog'lanishlar — secret emas.
const FROM_CONFIG = new Set([
  'ASSETS', 'DB', 'UPLOADS',
  'PAYMENTS_ENABLED', 'PAYME_SANDBOX', 'PAYME_CHECKOUT_DOMAIN',
]);

if (!TOKEN || !ACCOUNT) {
  console.log('CF_API_TOKEN / CF_ACCOUNT yo\'q — jonli tekshiruv o\'tkazib yuborildi.');
  process.exit(0);
}

// 1) Manbadan kod o'qiydigan HAR BIR nomni yig'amiz.
const source = ['hosting/worker.js', 'hosting/api/auth.js']
  .map((p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8'))
  .join('\n');
const used = new Set(
  [...source.matchAll(/env\.([A-Z][A-Z0-9_]{2,})/g)].map((m) => m[1]),
);

// Kodda ishlatilgan, lekin bu faylda tasniflanmagan nom bo'lsa —
// ro'yxat eskirgan. Bu ham xato: yangi sozlama jimgina qo'shilib,
// jonli Workerda yo'qligi sezilmay qolardi.
const untriaged = [...used].filter(
  (k) => !(k in REQUIRED) && !OPTIONAL.has(k) && !FROM_CONFIG.has(k),
);

// 2) Jonli Workerdan bog'lanish NOMLARINI olamiz.
const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${WORKER}/settings`,
  { headers: { authorization: `Bearer ${TOKEN}` } },
);
const body = await res.json().catch(() => ({}));
if (!body?.success) {
  console.error(`Worker sozlamasi o'qilmadi (${res.status}):`,
    JSON.stringify(body?.errors || {}).slice(0, 200));
  process.exit(1);
}
const live = new Set((body.result?.bindings || []).map((b) => b.name));

// 3) Solishtirish.
const missing = Object.keys(REQUIRED).filter((k) => used.has(k) && !live.has(k));

console.log(`Worker: ${WORKER} — ${live.size} ta bog'lanish.`);
for (const k of Object.keys(REQUIRED)) {
  if (!used.has(k)) continue;
  console.log(`  ${live.has(k) ? 'BOR  ' : 'YO\'Q '} ${k}`);
}

let bad = false;
if (untriaged.length) {
  bad = true;
  console.error('\nKod yangi sozlama o\'qiyapti, lekin u bu testda tasniflanmagan:');
  for (const k of untriaged) console.error(`  ${k}`);
  console.error('`scripts/test-worker-secrets.mjs` dagi REQUIRED/OPTIONAL ga qo\'shing.');
}
if (missing.length) {
  bad = true;
  console.error(`\nJONLI WORKER "${WORKER}" DA YETISHMAYDI:`);
  for (const k of missing) console.error(`  ${k}  -> ${REQUIRED[k]} ishlamaydi`);
  console.error('\nKod bu sozlamalarni "yo\'q bo\'lsa xizmatni o\'chir" deb');
  console.error('qabul qiladi, ya\'ni sayt buzilmaydi — xizmat JIMGINA o\'chadi.');
  console.error('Qiymatlarni Cloudflare panelida qo\'lda qo\'ying:');
  console.error(`  Workers & Pages -> ${WORKER} -> Settings -> Variables and Secrets`);
}
if (bad) process.exit(1);

console.log('\nHammasi joyida.');
