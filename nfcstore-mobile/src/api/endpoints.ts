import { apiFetch } from './client';
import type {
  AuthMe,
  Card,
  Company,
  CompanyPost,
  CompanyStory,
  FollowResult,
  TapInfo,
} from './types';

/** GET /api/auth/me -> {user, cards} */
export const getMe = () => apiFetch<AuthMe>('/auth/me');

/** GET /api/companies/mine -> {companies} (egasining barcha kompaniyalari) */
export const getMyCompanies = () =>
  apiFetch<{ companies: Company[] }>('/companies/mine').then((r) => r.companies);

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
export const toggleFollow = (companyId: string) =>
  apiFetch<FollowResult>(`/companies/${encodeURIComponent(companyId)}/follow`, {
    method: 'POST',
  });

/** GET /api/records/:code -> shaxsiy karta (ochiq profil) */
export const getRecord = (code: string) =>
  apiFetch<{ record: Card }>(`/records/${encodeURIComponent(code)}`).then((r) => r.record);

/**
 * GET /api/tap/:chipToken — NFC tegi o'qilgandan keyingi birinchi so'rov.
 * `{active, linkedCode}` qaytaradi; `linkedCode` bo'yicha profil ochiladi.
 */
export const getTapTarget = (chipToken: string) =>
  apiFetch<TapInfo>(`/tap/${encodeURIComponent(chipToken)}`, { anonymous: true });

export type { AuthMe, Card, Company, CompanyPost, CompanyStory, FollowResult, TapInfo };
