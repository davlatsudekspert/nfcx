/**
 * Company form vocabulary + validation, shared by the 5-step creation flow
 * and the dashboard's editable sections so both enforce exactly the same
 * rules and both send exactly the same field set.
 *
 * Only fields `POST /api/companies` / `PATCH /api/companies/:id` really
 * accept are modelled here (src/api/companies.ts) — nothing is collected
 * that the backend would silently drop.
 */
import { API_ORIGIN } from '../../native/cookies';
import { safeText } from '../../lib/format';
import type { TierKey } from '../../lib/codeTiers';
import type { DraftCompanyProfile } from '../../navigation/types';

const TIER_KEYS: ReadonlyArray<TierKey> = ['exclusive', 'premium', 'gold', 'silver', 'free'];

/** `/companies/check` types `tier` as a bare string — only adopt it when it is
 * one of the real tiers, so a surprise value can never reach a tier-keyed map. */
export function asTierKey(value: unknown): TierKey | undefined {
  return typeof value === 'string' && (TIER_KEYS as ReadonlyArray<string>).includes(value)
    ? (value as TierKey)
    : undefined;
}

/**
 * The exact `COMPANY_CATEGORIES` enum the Worker validates against was not
 * extracted during the Phase 1 audit, so this stays the same conservative
 * slug set the flow already shipped with. It is safe either way: only
 * `food`/`food-*` and `retail`/`retail-*` change the auto-selected catalog
 * module (`businessModule()`, android/docs/02-API_MAP.md §2.5); everything
 * else falls into "services". A slug the server rejects surfaces its real
 * error — it is never silently coerced.
 */
export const COMPANY_CATEGORIES: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'food', label: 'Oziq-ovqat / Restoran' },
  { slug: 'retail', label: "Savdo / Do'kon" },
  { slug: 'construction', label: 'Qurilish' },
  { slug: 'beauty', label: "Go'zallik" },
  { slug: 'it', label: 'IT / Raqamli' },
  { slug: 'education', label: "Ta'lim" },
  { slug: 'services', label: 'Boshqa xizmatlar' },
];

export function categoryLabel(slug: string | undefined): string {
  const found = COMPANY_CATEGORIES.find((c) => c.slug === slug);
  return found ? found.label : safeText(slug);
}

export const COMPANY_ID_MIN = 3;
export const COMPANY_ID_MAX = 15;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 600;

/** Letters only, uppercase — matches what Step 1 sends to `/companies/check`. */
export function normalizeCompanyId(raw: string): string {
  return raw.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, COMPANY_ID_MAX);
}

export function companyIdError(id: string): string | null {
  if (id.length === 0) return null;
  if (id.length < COMPANY_ID_MIN) return `Kamida ${COMPANY_ID_MIN} ta harf kerak.`;
  return null;
}

export type BusinessField = 'displayName' | 'city' | 'phone' | 'description';
export type ContactField = 'telegram' | 'whatsapp' | 'website';

export interface BusinessValues {
  displayName: string;
  city: string;
  phone: string;
  description: string;
}

export interface ContactValues {
  telegram: string;
  whatsapp: string;
  website: string;
}

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const DIGITS_RE = /\D/g;

export function validateBusiness(values: BusinessValues): FieldErrors<BusinessField> {
  const errors: FieldErrors<BusinessField> = {};

  if (values.displayName.trim().length < 2) {
    errors.displayName = "Nom kamida 2 belgidan iborat bo'lsin.";
  }
  if (values.city.trim().length < 2) {
    errors.city = 'Shaharni kiriting.';
  }
  const digits = values.phone.replace(DIGITS_RE, '');
  if (digits.length < 9) {
    errors.phone = "Telefon raqami to'liq emas.";
  }
  const description = values.description.trim();
  if (description.length < DESCRIPTION_MIN) {
    errors.description = `Tavsif kamida ${DESCRIPTION_MIN} belgi bo'lsin.`;
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Tavsif ${DESCRIPTION_MAX} belgidan oshmasin.`;
  }

  return errors;
}

export function validateContacts(values: ContactValues): FieldErrors<ContactField> {
  const errors: FieldErrors<ContactField> = {};

  const telegram = values.telegram.trim().replace(/^@/, '');
  if (telegram && !/^[A-Za-z0-9_]{3,32}$/.test(telegram)) {
    errors.telegram = "Telegram username 3-32 ta harf/raqam bo'lsin.";
  }

  const whatsapp = values.whatsapp.replace(DIGITS_RE, '');
  if (values.whatsapp.trim() && (whatsapp.length < 9 || whatsapp.length > 15)) {
    errors.whatsapp = "WhatsApp raqami to'liq emas.";
  }

  const website = values.website.trim();
  if (website && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(website)) {
    errors.website = "Havola noto'g'ri (masalan: nfcstore.uz).";
  }

  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some((v) => !!v);
}

/** '' -> undefined, so an untouched optional field is never sent as an empty string. */
export function optional(value: string | undefined | null): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? undefined : trimmed;
}

export function normalizeTelegram(value: string | undefined): string | undefined {
  return optional((value ?? '').replace(/^@/, ''));
}

export function normalizeWhatsapp(value: string | undefined): string | undefined {
  const digits = (value ?? '').replace(DIGITS_RE, '');
  return digits === '' ? undefined : digits;
}

export function normalizeWebsite(value: string | undefined): string | undefined {
  const trimmed = optional(value);
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * `POST /api/upload` answers with a path relative to the API origin
 * ("/uploads/x.jpg"); `<Image>` needs an absolute URL.
 */
export function absoluteUploadUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Public web URL of a company page — mirrors `linking.ts`'s `company/:id`. */
export function companyPublicUrl(companyId: string): string {
  return `${API_ORIGIN}/company/${encodeURIComponent(companyId)}`;
}

/** The create payload, built once so Step 5 and the review card agree. */
export function buildCreatePayload(draft: DraftCompanyProfile) {
  return {
    companyId: draft.companyId,
    displayName: draft.displayName.trim(),
    city: draft.city.trim(),
    phone: draft.phone.trim(),
    description: draft.description.trim(),
    category: draft.category,
    subcategory: optional(draft.subcategory),
    address: optional(draft.address),
    telegram: normalizeTelegram(draft.telegram),
    whatsapp: normalizeWhatsapp(draft.whatsapp),
    website: normalizeWebsite(draft.website),
    logoUrl: optional(draft.logoUrl),
    coverUrl: optional(draft.coverUrl),
  };
}

/**
 * What still blocks `POST /companies/:id/submit` client-side. The Worker is
 * the real authority — this only tells the owner *why* the button is off
 * instead of letting them hit a 422.
 */
export function missingForSubmit(company: {
  displayName?: string;
  city?: string;
  phone?: string;
  description?: string;
  category?: string;
}): string[] {
  const missing: string[] = [];
  if (!company.displayName || company.displayName.trim().length < 2) missing.push('Kompaniya nomi');
  if (!company.category) missing.push('Kategoriya');
  if (!company.city || company.city.trim().length < 2) missing.push('Shahar');
  if (!company.phone || company.phone.replace(DIGITS_RE, '').length < 9) missing.push('Telefon');
  if (!company.description || company.description.trim().length < DESCRIPTION_MIN) {
    missing.push(`Tavsif (${DESCRIPTION_MIN}+ belgi)`);
  }
  return missing;
}
