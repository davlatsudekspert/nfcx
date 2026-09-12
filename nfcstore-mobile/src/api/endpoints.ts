import { apiFetch } from './client';
import type {
  AuthMe,
  Card,
  CatalogItem,
  CatalogRecord,
  Company,
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
 * POST /api/companies/:id/follow — BITTA endpoint ikki yo'nalish uchun:
 * bosilganda holat teskarisiga o'giriladi va yangi holat qaytadi.
 * O'z kompaniyasiga obuna bo'lish 409 `cannot_follow_self` beradi.
 */
export const toggleFollowCompany = (companyId: string) =>
  apiFetch<FollowResult>(`/companies/${encodeURIComponent(companyId)}/follow`, {
    method: 'POST',
  });

/* ══ Shaxsiy karta profili ══════════════════════════════════════════ */

/** GET /api/records/:code -> shaxsiy karta (ochiq profil) */
export const getRecord = (code: string) =>
  apiFetch<{ record: Card }>(`/records/${encodeURIComponent(code)}`).then((r) => r.record);

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
  TapInfo,
};
