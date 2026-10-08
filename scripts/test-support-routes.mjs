// YORDAM SAHIFASI, SHARTLAR VA BAND QILINGAN SAHIFA NOMLARI (App Store, 2026-10).
//
// HAQIQIY XATO: App Store "Support URL" uchun tabiiy manzillar —
// nfcstore.uz/support, /contact, /terms — sayt yo'li sifatida yo'q edi.
// SPA ularni NFC ID deb o'qib "Bu ID bo'sh — bosh sahifada band qiling"
// sahifasini ochardi; bunday ID'ni esa (admin sovg'asi, auksion orqali)
// kimdir olib qo'yishi ham mumkin edi.
//
// Test uch narsani qo'riqlaydi:
//   1) src/App.jsx: /support, /contact, /help, /yordam — yordam sahifasi;
//      /terms, /eula — /shartlar ga yo'naltiriladi; NFC ID emas.
//   2) Saytdagi HAR BIR harfli sahifa nomi serverda ham band
//      (hosting/api/reserved-codes.js, server/index.js nusxasi) va
//      haqiqiy worker uni ID sifatida bermaydi.
//   3) Yordam sahifasi faqat mavjud kanallarni ko'rsatadi; maxfiylik va
//      shartlar matnlari App Store talablaridagi gaplarni yo'qotmagan.
//
//   node scripts/test-support-routes.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import worker from '../hosting/worker.js';
import { RESERVED_CODES, isReservedCode } from '../hosting/api/reserved-codes.js';
import { seoForRoute } from '../src/lib/seo.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// ── 1) SPA MARSHRUTLARI ──────────────────────────────────────────────
const app = read('src/App.jsx');
const staticBlock = app.match(/const STATIC_ROUTES = \{([\s\S]*?)\n\};/)?.[1] || '';
const staticKeys = [...staticBlock.matchAll(/^\s*(?:'([^']+)'|([A-Za-z]+)):\s*[A-Za-z]/gm)].map((m) => m[1] || m[2]);
const extraBlock = app.match(/const RESERVED = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
const extraKeys = [...extraBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);
checkTrue(`1) STATIC_ROUTES o‘qildi (${staticKeys.length})`, staticKeys.length > 20);
for (const [route, page] of [['support', 'SupportPage'], ['contact', 'SupportPage'], ['help', 'SupportPage'], ['yordam', 'SupportPage'], ['terms', 'TermsRedirect'], ['eula', 'TermsRedirect']]) {
  checkTrue(`1) /${route} → ${page}`, new RegExp(`^\\s*${route}: ${page},`, 'm').test(staticBlock));
}
checkTrue('1) yordam sahifasi if-zanjirida ham bor', /\['support', 'contact', 'help', 'yordam'\]\.includes\(lowerRoute\)\) page = <SupportPage \/>/.test(app));
checkTrue('1) /terms va /eula — /shartlar ga yo‘naltiriladi', /function TermsRedirect\(\)[\s\S]{0,120}navigate\('\/shartlar', \{ replace: true \}\)/.test(app));
// Katta harfli manzil (/Support) ham NFC ID deb o'qilmasin.
checkTrue('1) band yo‘llar tekshiruvi katta-kichik harfga qaramaydi', /!RESERVED\.has\(lowerRoute\)/.test(app));
checkTrue('1) SupportPage fayli lazy yuklanadi', /lazyPage\(\(\) => import\('\.\/pages\/SupportPage\.jsx'\)\)/.test(app));

// SEO: sarlavha "Qo'llab-quvvatlash", /terms — shartlar sarlavhasi.
check('1) SEO /support', seoForRoute('support', 'en').title, 'Support');
check('1) SEO /contact', seoForRoute('contact', 'uz').title, "Qo'llab-quvvatlash");
check('1) SEO /terms = /shartlar', seoForRoute('terms', 'ru').title, seoForRoute('shartlar', 'ru').title);

// ── 2) SAHIFA NOMLARI SERVERDA HAM BAND ──────────────────────────────
// Harfli (NFC ID shaklidagi) har bir sayt yo'li RESERVED_CODES da bo'lsin.
const siteWords = [...new Set([...staticKeys, ...extraKeys])].filter((k) => /^[a-z]{3,16}$/.test(k));
const missing = siteWords.filter((w) => !RESERVED_CODES.has(w.toUpperCase()));
check('2) saytning har bir harfli yo‘li serverda band', missing, []);
for (const w of ['SUPPORT', 'CONTACT', 'TERMS', 'HELP', 'EULA', 'ALOQA', 'SHARTLAR', 'MAXFIYLIK', 'PRIVACY']) {
  checkTrue(`2) ${w} band`, isReservedCode(w) && isReservedCode(w.toLowerCase()));
}
// Eski Express serveridagi nusxa ajralib qolmasin.
{
  const legacy = read('server/index.js').match(/const RESERVED_CODES = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
  const legacySet = new Set([...legacy.matchAll(/'([A-Z]+)'/g)].map((m) => m[1]));
  check('2) server/index.js nusxasi bir xil', [...legacySet].sort(), [...RESERVED_CODES].sort());
}

// Haqiqiy worker: band nom ID sifatida berilmaydi.
const { env } = makeEnv({ PAYMENTS_ENABLED: 'true' });
await seedBasic(env);
const call = async (path, init) => {
  const r = await worker.fetch(req(path, init), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};
for (const code of ['SUPPORT', 'CONTACT', 'TERMS', 'HELP', 'ALOQA']) {
  const r = await call(`/api/records/${code.toLowerCase()}`, { method: 'POST', cookie: cookie.user, json: { name: 'Test' } });
  check(`2) POST /api/records/${code} — 400 reserved`, [r.status, r.body?.error], [400, 'reserved']);
}
{
  const r = await call('/api/admin/nfc-gifts', { method: 'POST', cookie: cookie.admin, json: { code: 'support', recipientName: 'X' } });
  check('2) admin sovg‘a ID: SUPPORT — 422 bad_code', [r.status, r.body?.error], [422, 'bad_code']);
  const ok = await call('/api/admin/nfc-gifts', { method: 'POST', cookie: cookie.admin, json: { code: 'GIFT77', recipientName: 'X' } });
  check('2) oddiy sovg‘a ID hamon yaratiladi', ok.status, 201);
}
{
  const r = await call('/api/auction-requests', { method: 'POST', cookie: cookie.user, json: { code: 'terms' } });
  check('2) auksion so‘rovi: TERMS — 422 bad_code', [r.status, r.body?.error], [422, 'bad_code']);
}

// ── 3) MATNLAR ───────────────────────────────────────────────────────
{
  const sp = read('src/pages/SupportPage.jsx');
  checkTrue('3) yordam: Telegram @nfcstore_admin', sp.includes("href: 'https://t.me/nfcstore_admin'"));
  checkTrue('3) yordam: telefon', sp.includes("href: 'tel:+998500908277'"));
  checkTrue('3) yordam: ilova ichidagi forma (uz/ru/en)',
    sp.includes('Sozlamalar → Yordam') && sp.includes('Настройки → Поддержка') && sp.includes('Settings → Support'));
  // Yangi kontakt o'ylab topilmasin: boshqa telefon, email yoki t.me yo'q.
  const phones = sp.match(/\+998[\d ]{9,}/g) || [];
  checkTrue('3) yordam: begona telefon yo‘q', phones.every((p) => p.replace(/\D/g, '') === '998500908277'));
  checkTrue('3) yordam: mailto/email yo‘q', !/mailto:|@[a-z0-9-]+\.[a-z]{2,}/i.test(sp));
  check('3) yordam: faqat bitta Telegram manzili', [...new Set(sp.match(/t\.me\/[A-Za-z0-9_]+/g) || [])], ['t.me/nfcstore_admin']);
}
{
  const pp = read('src/pages/PrivacyPage.jsx');
  check('3) maxfiylik: uch tilda App Store', (pp.match(/App Store/g) || []).length >= 3, true);
  checkTrue('3) maxfiylik: "(Google Play)" yolg‘iz qolmagan', !/\(Google Play\)/.test(pp));
  checkTrue('3) maxfiylik: video ham Gemini da (uz)', /rasm va videolar[^"]*Google Gemini/.test(pp));
  checkTrue('3) maxfiylik: video ham Gemini da (ru)', /фото и видео[^']*Google Gemini/.test(pp));
  checkTrue('3) maxfiylik: video ham Gemini da (en)', /photos and videos[^']*Google Gemini/.test(pp));
  checkTrue('3) maxfiylik: "videolar faqat shikoyat bo‘yicha" degan eski gap yo‘q',
    !/Videos are reviewed by a moderator after reports|Videolar shikoyat orqali|Видео проверяются модератором по жалобам/.test(pp));
  // Tekshirib bo'lmagan fayl — qo'lda ko'rib chiqilguncha yashirin (content_pending).
  checkTrue('3) maxfiylik: tekshirilmagan fayl "tekshiruvsiz joylanadi" degan eski gap yo‘q',
    !/may be published without the automatic check|avtomatik tekshiruvsiz joylanishi mumkin|опубликован без автоматической проверки/.test(pp));
  checkTrue('3) maxfiylik: tekshirilmagan kontent qo‘lda ko‘rib chiqiladi (uz/ru/en)',
    pp.includes("ko'rib chiqilguncha boshqalarga ko'rsatilmaydi") && pp.includes('не показываются другим до завершения проверки') && pp.includes('not shown to others until the review is done'));
  checkTrue('3) maxfiylik: Ko‘rgazma YouTube/Instagram havolalari (uz/ru/en)',
    pp.includes("Ko'rgazma: YouTube va Instagram havolalari") && pp.includes('Витрина: ссылки на YouTube и Instagram') && pp.includes('Showcase: YouTube and Instagram links'));
  // ACCOUNT_PURGE_R2 = off — fayllar o'chadi deb va'da qilinmasin.
  const wr = read('wrangler.jsonc');
  if (/"ACCOUNT_PURGE_R2":\s*"off"/.test(wr)) {
    checkTrue('3) maxfiylik: fayllar o‘chadi degan va‘da yo‘q (R2 purge o‘chiq)',
      !/content and uploaded files are deleted|kontent va yuklangan fayllar o'chiriladi|контент и загруженные файлы/.test(pp));
    checkTrue('3) maxfiylik: fayllarning haqiqiy holati yozilgan (uz/ru/en)',
      pp.includes("hozircha fayl omboridan avtomatik o'chirilmaydi") && pp.includes('пока не удаляются из файлового хранилища') && pp.includes('not yet deleted from file storage'));
    const dp = read('src/pages/DeleteAccountPage.jsx');
    checkTrue('3) hisob o‘chirish sahifasi ham fayllar haqida rost', !/и загруженные файлы \(фото|and uploaded files \(photos|va yuklangan fayllar \(rasm/.test(dp));
  }
}
{
  const tp = read('src/pages/TermsPage.jsx');
  checkTrue('3) shartlar: nol toqat (uz/ru/en)',
    tp.includes('nol toqat') && tp.includes('нулевой терпимости') && tp.includes('zero tolerance'));
  checkTrue('3) shartlar: shikoyat va bloklash (uz/ru/en)',
    tp.includes('«Shikoyat qilish»') && tp.includes('«Пожаловаться»') && tp.includes('“Report”'));
  checkTrue('3) shartlar: hisob bloklanadi (uz/ru/en)',
    tp.includes('hisobi vaqtincha yoki butunlay bloklanishi') && tp.includes('Аккаунт нарушителя') && tp.includes('account may be suspended'));
  checkTrue('3) shartlar: 6-bo‘lim sahifaga qo‘shiladi', /sections\.push\(CONDUCT\[lang\], REQUISITES\[lang\]\)/.test(tp));
}

done('Yordam sahifasi va band nomlar');
