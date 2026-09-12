import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import {
  getCompany,
  getCompanyPosts,
  getMe,
  getMyCompanies,
  getRecord,
} from '@/api/endpoints';
import type { CatalogItem, Card, Company, CompanyPlan, CompanyPost } from '@/api/types';
import { compactCount, hoursSummary, prettyPhone, todayWindow } from '@/lib/format';
import { useActiveIdStore, type ActiveId } from '@/store/activeIdStore';
import { useAuthStore } from '@/store/authStore';
import { resolveIsOwner, useRoleStore } from '@/store/roleStore';
import { businessVerified, personalVerified } from './header/Badges';
import type { InfoRow } from './tabs/InfoList';

export type AccountEntry = {
  id: ActiveId;
  key: string;
  name: string;
  handle: string;
  kind: 'Personal' | 'Business';
  photoUrl?: string;
};

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
  companyId?: string;
};

const SITE = 'https://nfcstore.uz';

/**
 * Profil ekrani uchun barcha ma'lumot bir joyda yig'iladi va BITTA
 * ko'rinish modeliga (`ProfileVM`) aylantiriladi.
 *
 * Shu tarzda ekranning o'zi "biznesmi yoki shaxsiymi" degan shartlarga
 * to'lib ketmaydi: ikki tur bir xil shaklga keltiriladi va faqat
 * haqiqatan farq qiladigan joylar (tab 2 ning mazmuni, ish vaqti/rol
 * qatori) shartli qoladi.
 */
export function useProfileData() {
  const active = useActiveIdStore((s) => s.active);
  const activeReady = useActiveIdStore((s) => s.ready);
  const setActive = useActiveIdStore((s) => s.setActive);
  const setSession = useAuthStore((s) => s.setSession);
  const override = useRoleStore((s) => s.override);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });
  const companiesQuery = useQuery({ queryKey: ['companies', 'mine'], queryFn: getMyCompanies });

  // `authStore` ni javob bilan sinxronlab turamiz: boshqa ekranlar
  // (masalan Home) foydalanuvchi ma'lumotini so'rovni takrorlamasdan
  // o'qiy oladi.
  useEffect(() => {
    if (meQuery.data) setSession(meQuery.data);
  }, [meQuery.data, setSession]);

  const cards = meQuery.data?.cards ?? [];
  const companies = companiesQuery.data ?? [];
  const userId = meQuery.data?.user?.id;

  /** Almashtirgich uchun BARCHA ID lar — turidan qat'i nazar, bitta ro'yxatda. */
  const accounts = useMemo<AccountEntry[]>(() => {
    const list: AccountEntry[] = [];
    for (const c of companies) {
      list.push({
        id: { kind: 'business', companyId: c.companyId },
        key: `business:${c.companyId}`,
        name: c.displayName || c.companyId,
        handle: `@${c.companyId.toLowerCase()}`,
        kind: 'Business',
        photoUrl: c.logoUrl || undefined,
      });
    }
    for (const card of cards) {
      list.push({
        id: { kind: 'personal', code: card.code },
        key: `personal:${card.code}`,
        name: card.name || card.code,
        handle: `@${card.code.toLowerCase()}`,
        kind: 'Personal',
        photoUrl: card.avatarUrl || undefined,
      });
    }
    return list;
  }, [cards, companies]);

  // Hech narsa tanlanmagan bo'lsa (ilovaning birinchi ishga tushishi)
  // birinchi mavjud ID tanlanadi. Biznes profillar oldinda turadi,
  // chunki ular asosiy ish yuzasi.
  useEffect(() => {
    if (!activeReady || active || !accounts.length) return;
    setActive(accounts[0].id);
  }, [activeReady, active, accounts, setActive]);

  const resolved = resolveActive(active, accounts);

  const companyQuery = useQuery({
    queryKey: ['company', resolved?.kind === 'business' ? resolved.companyId : null],
    queryFn: () => getCompany((resolved as { companyId: string }).companyId),
    enabled: resolved?.kind === 'business',
  });

  const recordQuery = useQuery({
    queryKey: ['record', resolved?.kind === 'personal' ? resolved.code : null],
    queryFn: () => getRecord((resolved as { code: string }).code),
    enabled: resolved?.kind === 'personal',
  });

  const postsQuery = useQuery({
    queryKey: ['posts', resolved?.kind === 'business' ? resolved.companyId : null],
    queryFn: () => getCompanyPosts((resolved as { companyId: string }).companyId),
    enabled: resolved?.kind === 'business',
  });

  const posts: CompanyPost[] = postsQuery.data ?? [];

  const vm = useMemo<ProfileVM | null>(() => {
    if (resolved?.kind === 'business' && companyQuery.data) {
      return businessVM(companyQuery.data, userId, override);
    }
    if (resolved?.kind === 'personal' && recordQuery.data) {
      return personalVM(recordQuery.data, override);
    }
    return null;
  }, [resolved, companyQuery.data, recordQuery.data, userId, override]);

  return {
    vm,
    accounts,
    active: resolved,
    posts,
    loading:
      meQuery.isLoading ||
      companiesQuery.isLoading ||
      companyQuery.isLoading ||
      recordQuery.isLoading,
    error: meQuery.error ?? companiesQuery.error ?? companyQuery.error ?? recordQuery.error,
    refetchCompany: companyQuery.refetch,
  };
}

/**
 * Saqlangan tanlov ro'yxatda bor-yo'qligini tekshiradi: foydalanuvchi
 * kompaniyani o'chirib yuborgan bo'lsa, eski tanlov bo'sh ekranga olib
 * kelmasligi kerak.
 */
function resolveActive(
  active: ActiveId | null,
  accounts: AccountEntry[],
): ActiveId | null {
  if (!accounts.length) return null;
  if (!active) return null;
  const found = accounts.find(
    (a) =>
      (a.id.kind === 'business' &&
        active.kind === 'business' &&
        a.id.companyId === active.companyId) ||
      (a.id.kind === 'personal' &&
        active.kind === 'personal' &&
        a.id.code === active.code),
  );
  return found ? found.id : accounts[0].id;
}

function businessVM(
  c: Company,
  userId: number | undefined,
  override: ReturnType<typeof useRoleStore.getState>['override'],
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
    // Biznesda tasdiqlash nishoni HOZIRCHA yo'q — Badges.tsx dagi
    // izohga qarang (companies.verified ustuni kutilmoqda).
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

function personalVM(
  card: Card,
  override: ReturnType<typeof useRoleStore.getState>['override'],
): ProfileVM {
  // `/api/auth/me` faqat O'Z kartalarini qaytaradi, ya'ni bu ro'yxatdan
  // ochilgan shaxsiy profil har doim egasining o'zi. Boshqa odamning
  // kartasi NFC tap yoki Katalog orqali ochilganda bu funksiya
  // `override` bilan emas, `false` bilan chaqiriladi (keyingi bosqich).
  const links = personalLinks(card);

  const infoRows: InfoRow[] = [];
  if (card.role) infoRows.push({ k: 'Lavozim', v: card.role });
  if (card.city) infoRows.push({ k: 'Shahar', v: card.city });
  if (card.phone && !card.hidePhone) {
    infoRows.push({ k: 'Telefon', v: prettyPhone(card.phone) });
  }
  if (card.email) infoRows.push({ k: 'Email', v: card.email });
  infoRows.push({ k: 'ID kod', v: card.code });

  return {
    kind: 'personal',
    key: `personal:${card.code}`,
    name: card.name || card.code,
    handle: `@${card.code.toLowerCase()}`,
    photoUrl: card.avatarUrl || undefined,
    // Shaxsiy kartada `verified` ustuni MAVJUD, shuning uchun nishon
    // haqiqiy qiymatga bog'langan.
    verified: personalVerified(card),
    openNow: null,
    hoursShort: '',
    role: card.role,
    phone: card.hidePhone ? '' : prettyPhone(card.phone),
    city: card.city,
    views: compactCount(card.views),
    // Shaxsiy kartada obunachilar `/api/follow` klasterida, alohida
    // so'rov talab qiladi — keyingi bosqichda ulanadi.
    followers: '—',
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
    isOwner: resolveIsOwner(true, override),
    following: false,
    shareUrl: `${SITE}/${card.code}`,
  };
}

/** Havolalar ro'yxati — to'ldirilgan soctarmoqlar + qo'shimcha havolalar. */
function personalLinks(card: Card): InfoRow[] {
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
