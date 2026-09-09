import { companyPremiumLevel } from './exclusivePricing.js';

export const COMPANY_STATUS = {
  draft: 'Qoralama',
  pending_review: 'Admin tekshiruvida',
  approved: 'Tasdiqlangan',
  payment_pending: "To‘lov kutilmoqda",
  paid: "To‘langan",
  active: 'Faol',
  rejected: 'Rad etilgan',
  suspended: 'Vaqtincha to‘xtatilgan',
};

export const COMPANY_TIERS = {
  silver: { label: 'SILVER', price: 349000, min: 8, max: 15 },
  gold: { label: 'GOLD', price: 549000, min: 6, max: 7 },
  premium: { label: 'PREMIUM', price: 749000, min: 4, max: 5 },
  exclusive: { label: 'EXCLUSIVE', price: 990000, min: 3, max: 3 },
};

export const COMPANY_CTA = {
  restaurant: { label: 'Menyuni ko‘rish', section: 'catalog', noun: 'Taomlar' },
  cafe: { label: 'Menyuni ko‘rish', section: 'catalog', noun: 'Taomlar' },
  market: { label: 'Mahsulotlarni ko‘rish', section: 'catalog', noun: 'Mahsulotlar' },
  shop: { label: 'Mahsulotlarni ko‘rish', section: 'catalog', noun: 'Mahsulotlar' },
  services: { label: 'Xizmatlarni ko‘rish', section: 'catalog', noun: 'Xizmatlar' },
  construction: { label: 'Xizmatlarni ko‘rish', section: 'catalog', noun: 'Xizmatlar' },
  clinic: { label: 'Xizmatlarni ko‘rish', section: 'catalog', noun: 'Xizmatlar' },
  pharmacy: { label: 'Mahsulotlarni ko‘rish', section: 'catalog', noun: 'Mahsulotlar' },
  education: { label: 'Kurslarni ko‘rish', section: 'catalog', noun: 'Kurslar' },
  other: { label: 'Takliflarni ko‘rish', section: 'catalog', noun: 'Takliflar' },
};

export const companyCta = (category) => COMPANY_CTA[category] || COMPANY_CTA.other;

// ═══════════════════════════════════════════════════════════════════════
// KOMPANIYA ID — O‘ZBEK ALIFBOSI (2026-09)
//
// A–Z dan tashqari o‘zbekchaning ikkita qo‘shma harfi ham qabul qilinadi:
// O‘ va G‘ — ya'ni nfcstore.uz/c/g'oya. Ular BITTA harf hisoblanadi.
//
// KANONIK SHAKL — oddiy ASCII apostrof ('). Sababi: u URL yo‘lida
// kodlanmasdan turaveradi, telefon klaviaturasida ham, kompyuterda ham
// oson teriladi. Foydalanuvchi qaysi belgini yozishidan qat'i nazar
// (ʻ ʼ ‘ ’ ` ´ ′) hammasi shu bitta belgiga keltiriladi — aks holda
// "gʻoya" va "g'oya" ikkita BOSHQA kompaniya bo‘lib qolardi.
//
// Apostrof faqat O yoki G dan keyin ma'noga ega. Boshida, oxirida yoki
// boshqa harfdan keyin kelgani shunchaki tashlab yuboriladi — "A'B"
// kabi ID yaratib bo‘lmaydi.
//
// NARX HARFLAR BO‘YICHA: "G'OYA" — 4 harf (G‘,O,Y,A), 5 ta belgi emas.
// Belgilar sanalsa, apostrofli nomlar uzunroq ko‘rinib ARZONROQ tarifga
// tushib qolardi (8 harfdan boshlab silver) — bu ham noto‘g‘ri, ham
// adolatsiz bo‘lardi.
//
// DIQQAT: hosting/worker.js'dagi companyId()/companyIdLetters()/
// companyPricing() bilan AYNAN bir xil bo‘lishi shart (Worker modullari
// `src/` dan import qila olmaydi). scripts/test-company-id.mjs ikkalasini
// bir xil kirishlarda solishtiradi.
// ═══════════════════════════════════════════════════════════════════════
const APOSTROPHES = /[\u2018\u2019\u02BB\u02BC\u0060\u00B4\u2032]/g;

export function normalizeCompanyId(value) {
  // Apostrof variantlari NFKC'dan OLDIN ham, KEYIN ham almashtiriladi.
  // Sababi: NFKC ba'zi belgilarni apostrof BO'LMAGAN narsaga yoyadi —
  // masalan ´ (U+00B4) "bo'sh joy + qo'shiluvchi urg'u" ga aylanadi va
  // keyin butunlay yo'qolib ketardi ("g´oya" -> "GOYA", ya'ni boshqa
  // kompaniya). Oldindan almashtirilsa, u to'g'ri G'OYA bo'ladi.
  const raw = String(value || '')
    .replace(APOSTROPHES, "'")
    .normalize('NFKC')
    .replace(APOSTROPHES, "'")
    .toUpperCase()
    .replace(/[^A-Z']/g, '');
  let out = '';
  let letters = 0;
  for (const ch of raw) {
    if (ch === "'") {
      // Faqat O/G dan keyin. Bu bir vaqtning o‘zida ikkilangan
      // apostrofni ham to‘xtatadi (oldingi belgi ' bo‘lib qoladi).
      const prev = out[out.length - 1];
      if (prev === 'O' || prev === 'G') out += "'";
      continue;
    }
    if (letters >= 15) break;
    out += ch;
    letters += 1;
  }
  return out;
}

// O‘ va G‘ — bitta harf.
export function companyIdLetters(id) {
  return String(id || '').replace(/'/g, '').length;
}

export function companyIdLocalInfo(value) {
  const companyId = normalizeCompanyId(value);
  const letters = companyIdLetters(companyId);
  if (!companyId || letters < 3) return { companyId, valid: false, reason: 'Kamida 3 ta harf kiriting' };
  if (letters > 15 || !/^(?:[OG]'|[A-Z])+$/.test(companyId)) {
    return { companyId, valid: false, reason: "Faqat A–Z harflari, shuningdek O‘ va G‘ mumkin" };
  }
  const tier = letters === 3 ? 'exclusive' : letters <= 5 ? 'premium' : letters <= 7 ? 'gold' : 'silver';
  // PREMIUM NOM narxi uzunlik tarifidan USTUN — serverdagi bilan bir xil
  // qoida (hosting/worker.js `companyAvailability`). Bu yerda ham
  // hisoblanadi, chunki server javobi kelguncha (~320 ms) forma shu
  // qiymatni ko'rsatadi: aks holda KING uchun avval "990 000", keyin
  // "9 990 000" chiqib, narx tushayotgandek ko'rinardi.
  //
  // Bu BAHO, hakam emas: admin qo'lda narx qo'ygan bo'lsa (price_override)
  // yoki nom band bo'lsa — server javobi bu qiymatning ustidan yoziladi.
  const premium = companyPremiumLevel(companyId);
  return {
    companyId, valid: true, tier,
    price: premium ? premium.price : COMPANY_TIERS[tier].price,
    premiumName: !!premium,
    premiumLevel: premium ? premium.level : null,
  };
}

async function companyApi(path, options) {
  const res = await fetch('/api/companies' + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `api_error_${res.status}`);
    Object.assign(error, data);
    throw error;
  }
  return data;
}

export const checkCompanyId = (companyId) => companyApi(`/check?id=${encodeURIComponent(companyId)}`);
export const listMyCompanies = () => companyApi('/mine');
// OCHIQ kompaniyalar katalogi (faqat FAOL bo'lganlar). Kompaniyalar
// sahifasidagi ro'yxat uchun: u ilgari faqat `cards` jadvalidagi biznes
// kartalarni ko'rsatardi va haqiqiy kompaniya profillari (Company ID
// bilan) u yerga umuman tushmasdi.
export const listPublicCompanies = () => companyApi('').then((d) => d.companies || []);
export const getCompany = (companyId) => companyApi(`/${encodeURIComponent(companyId)}`);
export const createCompany = (payload) => companyApi('', { method: 'POST', body: JSON.stringify(payload) });
export const updateCompany = (companyId, payload) => companyApi(`/${encodeURIComponent(companyId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
// ── STATISTIKA ────────────────────────────────────────────────────────
// Hodisa yuborish "eng yaxshi harakat" tamoyilida: yiqilsa JIM turadi.
// Sahifa statistika uchun buzilmasligi kerak, statistika esa sahifa
// uchun emas — shuning uchun `catch` bo'sh va `await` shart emas.
export function companyEvent(companyId, kind, ref = '') {
  if (!companyId) return;
  try {
    const body = JSON.stringify({ kind, ref });
    const path = `/api/companies/${encodeURIComponent(companyId)}/event`;
    // sendBeacon — sahifa yopilayotgan bo'lsa ham yetib boradi.
    if (navigator.sendBeacon && navigator.sendBeacon(path, new Blob([body], { type: 'application/json' }))) return;
    fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* jim tur */ }
}

export const getCompanyStats = (companyId, days = 30) =>
  companyApi(`/${encodeURIComponent(companyId)}/stats?days=${days}`);

// ── BUYURTMALAR ───────────────────────────────────────────────────────
export const createCompanyOrder = (companyId, payload) =>
  companyApi(`/${encodeURIComponent(companyId)}/orders`, { method: 'POST', body: JSON.stringify(payload) });
export const listCompanyOrders = (companyId) => companyApi(`/${encodeURIComponent(companyId)}/orders`);
export const setCompanyOrderStatus = (companyId, orderId, status) =>
  companyApi(`/${encodeURIComponent(companyId)}/orders/${encodeURIComponent(orderId)}`, { method: 'PATCH', body: JSON.stringify({ status }) });

// ── POSTLAR VA ISTORYA ────────────────────────────────────────────────
// `agreed: true` — kontent qoidalariga rozilik. Server ham buni
// tekshiradi (faqat frontendda bo'lsa chetlab o'tish mumkin edi).
// Obuna bo'lish / bekor qilish — bitta endpoint, holat teskarisiga
// o'giriladi (interfeysda ham bitta tugma).
export const toggleCompanyFollow = (companyId) =>
  companyApi(`/${encodeURIComponent(companyId)}/follow`, { method: 'POST' });

export const listCompanyPosts = (companyId) => companyApi(`/${encodeURIComponent(companyId)}/posts`);
export const createCompanyPost = (companyId, payload) =>
  companyApi(`/${encodeURIComponent(companyId)}/posts`, { method: 'POST', body: JSON.stringify(payload) });
export const deleteCompanyPost = (companyId, postId) =>
  companyApi(`/${encodeURIComponent(companyId)}/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });

export const listCompanyStories = (companyId) => companyApi(`/${encodeURIComponent(companyId)}/stories`);
export const createCompanyStory = (companyId, payload) =>
  companyApi(`/${encodeURIComponent(companyId)}/stories`, { method: 'POST', body: JSON.stringify(payload) });
export const deleteCompanyStory = (companyId, storyId) =>
  companyApi(`/${encodeURIComponent(companyId)}/stories/${encodeURIComponent(storyId)}`, { method: 'DELETE' });

export const submitCompany = (companyId) => companyApi(`/${encodeURIComponent(companyId)}/submit`, { method: 'POST' });
export const beginCompanyPayment = (companyId) => companyApi(`/${encodeURIComponent(companyId)}/payment`, { method: 'POST' });
export const addCompanyItem = (companyId, payload) => companyApi(`/${encodeURIComponent(companyId)}/catalog`, { method: 'POST', body: JSON.stringify(payload) });
export const updateCompanyItem = (companyId, itemId, payload) => companyApi(`/${encodeURIComponent(companyId)}/catalog/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteCompanyItem = (companyId, itemId) => companyApi(`/${encodeURIComponent(companyId)}/catalog/${encodeURIComponent(itemId)}`, { method: 'DELETE' });

