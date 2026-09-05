import type { CompanyStatus } from '../../api/types';

/**
 * Real status machine only — android/docs/02-API_MAP.md §2.5:
 * draft -> pending_review -> approved -> payment_pending -> active, or
 * rejected at review. No invented intermediate states.
 */
export const STATUS_LABEL: Record<CompanyStatus, string> = {
  draft: 'Qoralama',
  pending_review: "Ko'rib chiqilmoqda",
  approved: 'Tasdiqlangan',
  payment_pending: "To'lov kutilmoqda",
  active: 'Faol',
  rejected: 'Rad etilgan',
};

export const STATUS_DESCRIPTION: Record<CompanyStatus, string> = {
  draft: "Hali yuborilmagan — 'Qayta yuborish' orqali ko'rib chiqishga bering.",
  pending_review: 'Admin tomonidan ko\'rib chiqilmoqda.',
  approved: "Tasdiqlandi — to'lovni yakunlang.",
  payment_pending: "To'lov tizimi yoqilishini kuting.",
  active: 'Kompaniya profili ochiq va faol.',
  rejected: "Rad etildi — ma'lumotlarni to'g'rilab qayta yuboring.",
};
