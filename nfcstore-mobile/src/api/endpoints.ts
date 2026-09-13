import { ApiError, apiFetch } from './client';
import type {
  AuthMe,
  Card,
  CatalogItem,
  CatalogRecord,
  Company,
  CompanyAvailability,
  CompanyInput,
  CompanyOrder,
  CompanyPost,
  CompanyStats,
  CompanyStory,
  FollowResult,
  FollowStats,
  GiftOffers,
  PaymentsSettings,
  PhysicalPricing,
  PublicCompany,
  PurchasePending,
  RecordInput,
  StoryAuthor,
  TapInfo,
} from './types';

/* ══ Sessiya va o'z ID'lari ═════════════════════════════════════════ */

/** GET /api/auth/me -> {user, cards} */
export const getMe = () => apiFetch<AuthMe>('/auth/me');

/** GET /api/companies/mine -> {companies} (egasining barcha kompaniyalari) */
export const getMyCompanies = () =>
  apiFetch<{ companies: Company[] }>('/companies/mine').then((r) => r.companies);

/* ══ Kompaniya profili ══════════════════════════════════════════════ */

/** GET /api/companies/:id -> {company} */
export const getCompany = (companyId: string) =>
  apiFetch<{ company: Company }>(`/companies/${encodeURIComponent(companyId)}`).then(
    (r) => r.company,
  );

/** GET /api/companies/:id/posts -> {posts} (OCHIQ — mehmonga ham ko'rinadi) */
export const getCompanyPosts = (companyId: string) =>
  apiFetch<{ posts: CompanyPost[] }>(
    `/companies/${encodeURIComponent(companyId)}/posts`,
  ).then((r) => r.posts);

/** GET /api/companies/:id/stories -> {stories} */
export const getCompanyStories = (companyId: string) =>
  apiFetch<{ stories: CompanyStory[] }>(
    `/companies/${encodeURIComponent(companyId)}/stories`,
  ).then((r) => r.stories);

/**
 * GET /api/stories/feed -> {feed}
 *
 * Profildagi istorya qatorining MANBASI. Backend (worker.js:8098)
 * faqat SIZ OBUNA BO'LGAN odamlarning muddati o'tmagan istoryalarini
 * qaytaradi va bitta odamning bir nechta istoryasini BITTA yozuvga
 * yig'adi — ya'ni javob to'g'ridan-to'g'ri "dumaloqchalar qatori".
 *
 * Kirmagan foydalanuvchiga bo'sh ro'yxat qaytadi (401 emas), shuning
 * uchun so'rov xato bermaydi va qator shunchaki ko'rinmaydi.
 */
export const getStoriesFeed = () =>
  apiFetch<{ feed: StoryAuthor[] }>('/stories/feed').then((r) => r.feed ?? []);

/**
 * POST /api/companies/:id/follow — BITTA endpoint ikki yo'nalish uchun:
 * bosilganda holat teskarisiga o'giriladi va yangi holat qaytadi.
 * O'z kompaniyasiga obuna bo'lish 409 `cannot_follow_self` beradi.
 */
export const toggleFollowCompany = (companyId: string) =>
  apiFetch<FollowResult>(`/companies/${encodeURIComponent(companyId)}/follow`, {
    method: 'POST',
  });

/* ══ Shaxsiy karta profili ══════════════════════════════════════════ */

/**
 * GET /api/records/:code -> shaxsiy karta (ochiq profil).
 *
 * DIQQAT: bu endpoint yozuvni O'RAMASDAN, to'g'ridan-to'g'ri qaytaradi
 * (worker.js:5322 `return json(rec)`), boshqa endpointlardagidek
 * `{record: …}` EMAS. Ilgari bu yerda `.record` ochilardi va natija
 * `undefined` bo'lib qolardi; TanStack Query v5 esa `undefined` ni XATO
 * deb hisoblaydi, shuning uchun har qanday SHAXSIY profil "Ma'lumotni
 * yuklab bo'lmadi" ekraniga tushardi va almashtirgichdan shaxsiy ID
 * tanlab ham bo'lmasdi.
 */
export const getRecord = (code: string) =>
  apiFetch<Card>(`/records/${encodeURIComponent(code)}`);

/**
 * Obuna statistikasi. Kompaniyadan FARQLI: shaxsiy kartada uchta alohida
 * endpoint bor (toggle yo'q), shuning uchun `followCard`/`unfollowCard`
 * ham alohida.
 */
export const getFollowStats = (code: string) =>
  apiFetch<FollowStats>(`/follow-stats/${encodeURIComponent(code)}`);

/** POST /api/follow/:code — allaqachon obuna bo'lsa 409 ALREADY_FOLLOWING. */
export const followCard = (code: string) =>
  apiFetch<{ ok: boolean }>(`/follow/${encodeURIComponent(code)}`, { method: 'POST' });

/** POST /api/unfollow/:code — obuna bo'lmasa ham xato bermaydi (idempotent). */
export const unfollowCard = (code: string) =>
  apiFetch<{ ok: boolean }>(`/unfollow/${encodeURIComponent(code)}`, { method: 'POST' });

/* ══ Katalog (ochiq direktoriya) ════════════════════════════════════ */

/**
 * GET /api/records — DIQQAT: javob YALANG'OCH massiv, `{records}` emas
 * (worker.js:5087). Qidiruv esa `{records}` qaytaradi — shuning uchun
 * ikki funksiya bir xil shaklga keltiradi.
 *
 * Ro'yxatda ro'yxatdan o'tishdagi avtomatik ID'lar YO'Q: server
 * `catalogVisibleSql` bilan ularni chiqarib tashlaydi, ya'ni bu
 * haqiqatan "band qilingan profillar" direktoriyasi.
 */
export const getCatalogRecords = () => apiFetch<CatalogRecord[]>('/records');

/** GET /api/records/search?q= — kamida 2 belgi, aks holda bo'sh ro'yxat. */
export const searchRecords = (q: string) =>
  apiFetch<{ records: CatalogRecord[] }>(
    `/records/search?q=${encodeURIComponent(q)}`,
  ).then((r) => r.records);

/** GET /api/companies — faqat FAOL kompaniyalar, maxfiy maydonlarsiz. */
export const getPublicCompanies = () =>
  apiFetch<{ companies: PublicCompany[] }>('/companies').then((r) => r.companies);

/* ══ Yangi NFC ID sotib olish ═══════════════════════════════════════ */

/**
 * Kod bandmi? Alohida "tekshirish" endpointi YO'Q — sayt ham shunday
 * qiladi: profil so'raladi, 404 kelsa kod bo'sh.
 */
export const isCodeTaken = (code: string): Promise<boolean> =>
  getRecord(code)
    .then(() => true)
    .catch((e) => {
      if (e instanceof ApiError && e.status === 404) return false;
      throw e;
    });

/**
 * POST /api/records/:code — shaxsiy NFC ID sotib olish.
 *
 * Narxni SERVER hisoblaydi (`personalPurchaseQuote`), clientdan kelgan
 * summaga ishonilmaydi. Javob 202 bilan kutilayotgan buyurtma va
 * `payLink` qaytaradi — to'lov oqimi ILOVADA QURILMAYDI, shu havola
 * ochiladi (saytdagi naqshning o'zi).
 */
export const buyRecord = (code: string, record: RecordInput) =>
  apiFetch<PurchasePending>(`/records/${encodeURIComponent(code)}`, {
    method: 'POST',
    body: record,
  });

/**
 * PUT /api/records/:code — profilni yangilash.
 *
 * DIQQAT: server yozuvni TO'LIQ ALMASHTIRADI (`updateRecord`), ya'ni
 * yuborilmagan maydon O'CHADI. Shuning uchun chaqiruvchi avval mavjud
 * yozuvni o'qib, uning ustiga o'zgarishni qo'yib yuborishi shart —
 * `recordToInput()` shu ish uchun.
 */
export const updateRecord = (code: string, record: RecordInput) =>
  apiFetch<Card>(`/records/${encodeURIComponent(code)}`, { method: 'PUT', body: record });

/**
 * Mavjud kartani PUT uchun tayyor shaklga o'tkazadi — maydonlar
 * yo'qolib ketmasligi uchun.
 */
export function recordToInput(card: Card): RecordInput {
  return {
    name: card.name,
    role: card.role,
    avatarUrl: card.avatarUrl,
    phone: card.phone,
    email: card.email,
    tg: card.tg,
    instagram: card.instagram,
    facebook: card.facebook,
    twitter: card.twitter,
    linkedin: card.linkedin,
    website: card.website,
    about: card.about,
    city: card.city,
    address: card.address,
    profileType: card.profileType,
    hidePhone: card.hidePhone,
    musicUrls: card.musicUrls,
    extraLinks: card.extraLinks,
  };
}

/* ══ Yangi Company ID ═══════════════════════════════════════════════ */

/** GET /api/companies/check?id=... — nom bo'shmi va narxi qancha. */
export const checkCompanyId = (id: string) =>
  apiFetch<CompanyAvailability>(`/companies/check?id=${encodeURIComponent(id)}`);

/**
 * POST /api/companies — yangi Company ID.
 *
 * `auto: true` bo'lsa server tasodifiy BEPUL ID beradi va to'lov
 * so'ralmaydi. Nom tanlansa — narxi bor va to'lovdan keyin faollashadi.
 * Ikkala holatda ham kompaniya `pending_review` holatida yaratiladi:
 * admin tasdiqlagach faol bo'ladi.
 */
export const createCompany = (input: CompanyInput) =>
  apiFetch<{ company: Company }>('/companies', { method: 'POST', body: input }).then(
    (r) => r.company,
  );

/** worker.js:248 dagi `COMPANY_CATEGORIES` — boshqa qiymat rad etiladi. */
export const COMPANY_CATEGORIES = [
  { key: 'restaurant', label: 'Restoran' },
  { key: 'cafe', label: 'Kafe' },
  { key: 'market', label: 'Market' },
  { key: 'shop', label: "Do'kon" },
  { key: 'services', label: 'Xizmatlar' },
  { key: 'construction', label: 'Qurilish' },
  { key: 'clinic', label: 'Klinika' },
  { key: 'pharmacy', label: 'Dorixona' },
  { key: 'education', label: "Ta'lim" },
  { key: 'other', label: 'Boshqa' },
] as const;

/* ══ NFC teginish ═══════════════════════════════════════════════════ */

/**
 * GET /api/tap/:chipToken -> {active, linkedCode}
 *
 * Saytda bu navigatsiya uchun EMAS, faollik tekshiruvi uchun ishlatiladi
 * (src/pages/ProfilePage.jsx): karta bloklangan yoki boshqa profilga
 * o'tgan bo'lsa "karta faol emas" ko'rsatiladi. Kod esa URL yo'lidan
 * keladi. `linkedCode` faqat teg ichida kod bo'lmagan holatda kerak.
 */
export const getTapTarget = (chipToken: string) =>
  apiFetch<TapInfo>(`/tap/${encodeURIComponent(chipToken)}`, { anonymous: true });

/* ══ Home ekrani ════════════════════════════════════════════════════ */

export const getPhysicalPricing = () =>
  apiFetch<PhysicalPricing>('/settings/physical-nfc-pricing', { anonymous: true });

/** Kirmagan foydalanuvchiga bo'sh ro'yxat qaytaradi (401 emas). */
export const getGiftOffers = () => apiFetch<GiftOffers>('/gift-offers');

export const getPaymentsSettings = () =>
  apiFetch<PaymentsSettings>('/settings/payments-enabled', { anonymous: true });

/* ══ Dashboard ══════════════════════════════════════════════════════ */

/** GET /api/companies/:id/stats?days=N — N 7..90 orasiga qisiladi. */
export const getCompanyStats = (companyId: string, days = 30) =>
  apiFetch<CompanyStats>(
    `/companies/${encodeURIComponent(companyId)}/stats?days=${days}`,
  );

export const getCompanyOrders = (companyId: string) =>
  apiFetch<{ orders: CompanyOrder[] }>(
    `/companies/${encodeURIComponent(companyId)}/orders`,
  ).then((r) => r.orders);

/** PATCH /api/companies/:id/orders/:orderId — buyurtma holatini o'zgartirish. */
export const setOrderStatus = (companyId: string, orderId: number, status: string) =>
  apiFetch<unknown>(
    `/companies/${encodeURIComponent(companyId)}/orders/${orderId}`,
    { method: 'PATCH', body: { status } },
  );

/* ══ Katalog boshqaruvi (egasi) ═════════════════════════════════════
   Rasm yuklash bu bosqichda YO'Q (kelishilgan): yangi mahsulot rasmsiz
   qo'shiladi, rasm keyin veb orqali biriktiriladi.                    */

export type CatalogItemInput = {
  name: string;
  price: number;
  promotionPrice?: number | null;
  description?: string;
  category?: string;
  available?: boolean;
};

export const createCatalogItem = (companyId: string, input: CatalogItemInput) =>
  apiFetch<{ company: Company }>(`/companies/${encodeURIComponent(companyId)}/catalog`, {
    method: 'POST',
    body: input,
  }).then((r) => r.company);

export const updateCatalogItem = (
  companyId: string,
  itemId: string,
  patch: Partial<CatalogItemInput>,
) =>
  apiFetch<{ company: Company }>(
    `/companies/${encodeURIComponent(companyId)}/catalog/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: patch },
  ).then((r) => r.company);

export const deleteCatalogItem = (companyId: string, itemId: string) =>
  apiFetch<{ company: Company }>(
    `/companies/${encodeURIComponent(companyId)}/catalog/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  ).then((r) => r.company);

export type {
  AuthMe,
  Card,
  CatalogItem,
  CatalogRecord,
  Company,
  CompanyAvailability,
  CompanyInput,
  CompanyOrder,
  CompanyPost,
  CompanyStats,
  CompanyStory,
  FollowResult,
  FollowStats,
  GiftOffers,
  PaymentsSettings,
  PhysicalPricing,
  PublicCompany,
  PurchasePending,
  RecordInput,
  StoryAuthor,
  TapInfo,
};
