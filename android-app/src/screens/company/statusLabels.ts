import type { CompanyStatus } from '../../api/types';
import { color } from '../../design-system/tokens';
import { safeText } from '../../lib/format';

/**
 * Real status machine only — android/docs/02-API_MAP.md §2.5:
 * draft -> pending_review -> approved -> payment_pending -> active, or
 * rejected at review. No invented intermediate states.
 *
 * Every lookup goes through the `statusX()` helpers rather than indexing the
 * maps directly: `Company.status` is typed, but it is still a string coming
 * off the network, so an unknown value must degrade to readable copy instead
 * of rendering `undefined`.
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
  draft: "Hali yuborilmagan. Ma'lumotlarni to'ldiring va ko'rib chiqishga yuboring.",
  pending_review: "Admin ko'rib chiqmoqda. Javob kelguncha tahrirlash mumkin.",
  approved: "Tasdiqlandi. Faollashtirish uchun to'lov qadami qoldi.",
  payment_pending: "To'lov tekshirilmoqda. Tasdiqlangach profil avtomatik faollashadi.",
  active: 'Profil ochiq va mijozlarga ko‘rinadi.',
  rejected: "Rad etildi. Ma'lumotlarni to'g'rilab qayta yuboring.",
};

/** Chip/dot colour per status — semantic, never decorative. */
export const STATUS_COLOR: Record<CompanyStatus, string> = {
  draft: color.textTertiary,
  pending_review: color.info,
  approved: color.gold,
  payment_pending: color.warning,
  active: color.success,
  rejected: color.danger,
};

/** The four real lifecycle stages shown on the dashboard progress rail. */
export const LIFECYCLE_STEPS = ['Qoralama', "Ko'rib chiqish", "To'lov", 'Faol'] as const;

/**
 * Which rail stage a status sits on (1-based). `rejected` is a branch off
 * review, not a stage of its own — it maps back to stage 2 and is coloured
 * red by `STATUS_COLOR` instead of pretending to be progress.
 */
export const STATUS_STEP: Record<CompanyStatus, number> = {
  draft: 1,
  pending_review: 2,
  approved: 3,
  payment_pending: 3,
  active: 4,
  rejected: 2,
};

/** What the owner can actually do next, per status. */
export type CompanyActionTarget = 'submit' | 'payment' | 'public' | 'dashboard' | 'none';

export interface CompanyNextStep {
  /** Primary CTA label. */
  label: string;
  /** One line explaining what happens when it is used. */
  hint: string;
  target: CompanyActionTarget;
}

export const NEXT_STEP: Record<CompanyStatus, CompanyNextStep> = {
  draft: {
    label: 'Qoralamani yakunlash',
    hint: "To'ldirilgach ko'rib chiqishga yuboriladi.",
    target: 'submit',
  },
  pending_review: {
    label: 'Holatni ko‘rish',
    hint: "Admin javobini kuting — odatda ish kunlari ichida.",
    target: 'dashboard',
  },
  approved: {
    label: "To'lovga o'tish",
    hint: "To'lov yakunlangach profil faollashadi.",
    target: 'payment',
  },
  payment_pending: {
    label: "To'lov holati",
    hint: "To'lov tasdiqlanishini kuting.",
    target: 'payment',
  },
  active: {
    label: 'Ochiq sahifa',
    hint: 'Mijozlar ko‘radigan sahifani oching.',
    target: 'public',
  },
  rejected: {
    label: 'Tuzatib qayta yuborish',
    hint: "Ma'lumotlarni to'g'rilang va qayta yuboring.",
    target: 'submit',
  },
};

const FALLBACK_NEXT_STEP: CompanyNextStep = {
  label: 'Boshqarish',
  hint: "Kompaniya ma'lumotlarini ko'ring.",
  target: 'dashboard',
};

function isKnown(status: string): status is CompanyStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_LABEL, status);
}

export function statusLabel(status: string | undefined): string {
  if (status && isKnown(status)) return STATUS_LABEL[status];
  return safeText(status, 'Noma‘lum');
}

export function statusColor(status: string | undefined): string {
  if (status && isKnown(status)) return STATUS_COLOR[status];
  return color.textTertiary;
}

export function statusDescription(status: string | undefined): string {
  if (status && isKnown(status)) return STATUS_DESCRIPTION[status];
  return 'Holat aniqlanmadi. Sahifani yangilang.';
}

export function statusStep(status: string | undefined): number {
  if (status && isKnown(status)) return STATUS_STEP[status];
  return 1;
}

export function nextStep(status: string | undefined): CompanyNextStep {
  if (status && isKnown(status)) return NEXT_STEP[status];
  return FALLBACK_NEXT_STEP;
}

/** True while the owner is still allowed to push the company forward himself. */
export function canSubmit(status: string | undefined): boolean {
  return status === 'draft' || status === 'rejected';
}

/** True when the payment step is the one that stands between owner and live. */
export function needsPayment(status: string | undefined): boolean {
  return status === 'approved' || status === 'payment_pending';
}
