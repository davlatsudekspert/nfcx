import type { CatalogItem, Card, Company, CompanyPlan } from '@/api/types';
import { compactCount, hoursSummary, prettyPhone, todayWindow } from '@/lib/format';
import { resolveIsOwner, type RoleOverride } from '@/store/roleStore';

import { businessVerified, personalVerified } from './header/Badges';
import type { InfoRow } from './tabs/InfoList';

export const SITE = 'https://nfcstore.uz';

/**
 * Profil ekranining YAGONA ko'rinish modeli.
 *
 * Biznes (`/api/companies/:id`) va shaxsiy karta (`/api/records/:code`)
 * javoblari shu bitta shaklga keltiriladi — shunda ekranning o'zi
 * "biznesmi yoki shaxsiymi" degan shartlarga to'lib ketmaydi va aynan
 * bir xil komponent uchta joyda ishlatiladi: Profil tabi, NFC teginish
 * natijasi va Katalogdan ochilgan profil.
 */
export type ProfileVM = {
  kind: 'business' | 'personal';
  key: string;
  name: string;
  handle: string;
  photoUrl?: string;
  verified: boolean;
  openNow: boolean | null;
  hoursShort: string;
  role: string;
  phone: string;
  city: string;
  views: string;
  followers: string;
  third: { value: string; label: string };
  contacts: {
    phone?: string;
    telegram?: string;
    whatsapp?: string;
    instagram?: string;
    facebook?: string;
  };
  about: string;
  infoRows: InfoRow[];
  links: InfoRow[];
  catalog: CatalogItem[];
  plan?: CompanyPlan;
  hasMusic: boolean;
  isOwner: boolean;
  following: boolean;
  shareUrl: string;
  /** Biznes profilda — kompaniya ID'si. Shaxsiyda bo'lmaydi. */
  companyId?: string;
  /** Shaxsiy profilda — karta kodi. Biznesda bo'lmaydi. */
  code?: string;
  /**
   * Shaxsiy kartaga ulangan kompaniya. Saytdagi "Profilda kompaniya"
   * sozlamasi bilan bir xil: kompaniya ALOHIDA BLOK bo'lib chiqadi va
   * bosilganda kompaniya sahifasi ochiladi. NFC teginishda avtomatik
   * kompaniyaga o'tilmaydi — avval odamning o'z profili ko'rinadi.
   */
  featuredCompany?: { companyId: string; displayName: string; logoUrl: string };
};

/* ══ Biznes ═════════════════════════════════════════════════════════ */

export function businessVM(
  c: Company,
  userId: number | undefined,
  override: RoleOverride,
): ProfileVM {
  const realOwner = userId != null && String(c.ownerUserId) === String(userId);
  const id = c.companyId.toLowerCase();

  const infoRows: InfoRow[] = [];
  const hours = hoursSummary(c.hours);
  if (hours) infoRows.push({ k: 'Ish vaqti', v: hours });
  if (c.address) infoRows.push({ k: 'Manzil', v: c.address });
  if (c.phone) infoRows.push({ k: 'Telefon', v: prettyPhone(c.phone) });
  if (c.website) infoRows.push({ k: 'Veb-sayt', v: c.website });
  if (c.city) infoRows.push({ k: 'Shahar', v: c.city });
  infoRows.push({ k: 'ID kod', v: c.companyId });

  return {
    kind: 'business',
    key: `business:${c.companyId}`,
    name: c.displayName || c.companyId,
    handle: `@${id}`,
    photoUrl: c.logoUrl || undefined,
    // Biznesda tasdiqlash nishoni HOZIRCHA yo'q — Badges.tsx dagi izohga
    // qarang (`companies.verified` ustuni kutilmoqda).
    verified: businessVerified(c),
    openNow: c.openNow,
    hoursShort: todayWindow(c.hours),
    role: '',
    phone: prettyPhone(c.phone),
    city: c.city,
    views: compactCount(c.views),
    followers: compactCount(c.followers),
    third: { value: String(c.catalog.length), label: 'mahsulot' },
    contacts: {
      phone: c.phone || undefined,
      telegram: c.telegram || undefined,
      whatsapp: c.whatsapp || undefined,
      instagram: c.instagram || undefined,
      facebook: c.facebook || undefined,
    },
    about: c.description,
    infoRows,
    links: [],
    catalog: c.catalog,
    plan: c.plan,
    hasMusic: (c.music ?? []).length > 0,
    isOwner: resolveIsOwner(realOwner, override),
    following: c.following,
    shareUrl: `${SITE}/kompaniyalar/${id}`,
    companyId: c.companyId,
  };
}

/* ══ Shaxsiy karta ══════════════════════════════════════════════════ */

export type CardVMOptions = {
  /**
   * Egalik `/api/records/:code` javobidan ANIQLANMAYDI — u egasining
   * ID'sini qaytarmaydi. Shuning uchun chaqiruvchi `/api/auth/me` dagi
   * `cards[]` ro'yxatida shu kod bor-yo'qligini tekshirib beradi.
   */
  isOwner: boolean;
  override: RoleOverride;
  /** `/api/follow-stats/:code` dan. Hali yuklanmagan bo'lsa `undefined`. */
  followers?: number;
  isFollowing?: boolean;
  featuredCompany?: ProfileVM['featuredCompany'];
};

export function cardVM(card: Card, opts: CardVMOptions): ProfileVM {
  const links = personalLinks(card);

  const infoRows: InfoRow[] = [];
  if (card.role) infoRows.push({ k: 'Lavozim', v: card.role });
  if (card.city) infoRows.push({ k: 'Shahar', v: card.city });
  if (card.phone && !card.hidePhone) {
    infoRows.push({ k: 'Telefon', v: prettyPhone(card.phone) });
  }
  if (card.email) infoRows.push({ k: 'Email', v: card.email });
  if (card.website) infoRows.push({ k: 'Veb-sayt', v: card.website });
  infoRows.push({ k: 'ID kod', v: card.code });

  return {
    kind: 'personal',
    key: `personal:${card.code}`,
    name: card.name || card.code,
    handle: `@${card.code.toLowerCase()}`,
    photoUrl: card.avatarUrl || undefined,
    // Shaxsiy kartada `verified` ustuni MAVJUD, shuning uchun nishon
    // haqiqiy qiymatga bog'langan (biznesdan farqli).
    verified: personalVerified(card),
    openNow: null,
    hoursShort: '',
    role: card.role,
    phone: card.hidePhone ? '' : prettyPhone(card.phone),
    city: card.city,
    views: compactCount(card.views),
    // Hali yuklanmagan bo'lsa "…" — "—" emas: "—" "nol" degan ma'noni
    // beradi, "…" esa "kutilmoqda".
    followers: opts.followers == null ? '…' : compactCount(opts.followers),
    third: { value: String(links.length), label: 'havola' },
    contacts: {
      phone: card.hidePhone ? undefined : card.phone || undefined,
      telegram: card.tg || undefined,
      whatsapp: undefined,
      instagram: card.instagram || undefined,
      facebook: card.facebook || undefined,
    },
    about: card.about,
    infoRows,
    links,
    catalog: [],
    hasMusic: (card.musicUrls ?? []).length > 0,
    isOwner: resolveIsOwner(opts.isOwner, opts.override),
    following: !!opts.isFollowing,
    shareUrl: `${SITE}/${card.code}`,
    code: card.code,
    featuredCompany: opts.featuredCompany,
  };
}

/** Havolalar ro'yxati — to'ldirilgan soctarmoqlar + qo'shimcha havolalar. */
export function personalLinks(card: Card): InfoRow[] {
  const rows: InfoRow[] = [];
  if (card.website) rows.push({ k: 'Veb-sayt', v: card.website });
  if (card.tg) rows.push({ k: 'Telegram', v: card.tg });
  if (card.instagram) rows.push({ k: 'Instagram', v: card.instagram });
  if (card.facebook) rows.push({ k: 'Facebook', v: card.facebook });
  if (card.twitter) rows.push({ k: 'X', v: card.twitter });
  if (card.linkedin) rows.push({ k: 'LinkedIn', v: card.linkedin });
  if (card.email) rows.push({ k: 'Email', v: card.email });
  for (const extra of card.extraLinks ?? []) {
    const label = extra.label ?? extra.title;
    const url = extra.url ?? extra.href;
    if (label && url) rows.push({ k: label, v: url });
  }
  return rows;
}
