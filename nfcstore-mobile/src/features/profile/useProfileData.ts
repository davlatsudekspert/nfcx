import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import {
  getCompany,
  getCompanyPosts,
  getFollowStats,
  getMe,
  getMyCompanies,
  getRecord,
} from '@/api/endpoints';
import type { CompanyPost } from '@/api/types';
import { useActiveIdStore, type ActiveId } from '@/store/activeIdStore';
import { useAuthStore } from '@/store/authStore';
import { useRoleStore } from '@/store/roleStore';

import { businessVM, cardVM, type ProfileVM } from './profileVM';

export type AccountEntry = {
  id: ActiveId;
  key: string;
  name: string;
  handle: string;
  kind: 'Personal' | 'Business';
  photoUrl?: string;
};

export type { ProfileVM };

/**
 * Profil TABI uchun ma'lumot: almashtirgichda tanlangan FAOL ID.
 *
 * Boshqa odamning profilini ko'rsatish uchun `useCardProfile` /
 * `useCompanyProfile` ishlatiladi (useProfileTargets.ts) — ular bir xil
 * `ProfileVM` qaytaradi, shuning uchun ekran komponenti bitta.
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
  // (Home, Katalog) foydalanuvchi ma'lumotini so'rovni takrorlamasdan
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
  // birinchi mavjud ID tanlanadi. Biznes profillar oldinda — ular asosiy
  // ish yuzasi.
  useEffect(() => {
    if (!activeReady || active || !accounts.length) return;
    setActive(accounts[0].id);
  }, [activeReady, active, accounts, setActive]);

  const resolved = resolveActive(active, accounts);
  const bizId = resolved?.kind === 'business' ? resolved.companyId : null;
  const cardCode = resolved?.kind === 'personal' ? resolved.code : null;

  const companyQuery = useQuery({
    queryKey: ['company', bizId],
    queryFn: () => getCompany(bizId!),
    enabled: !!bizId,
  });

  const recordQuery = useQuery({
    queryKey: ['record', cardCode],
    queryFn: () => getRecord(cardCode!),
    enabled: !!cardCode,
  });

  // Shaxsiy kartada obunachilar soni ALOHIDA endpointda — kompaniyada u
  // profil javobining ichida keladi.
  const followQuery = useQuery({
    queryKey: ['follow-stats', cardCode],
    queryFn: () => getFollowStats(cardCode!),
    enabled: !!cardCode,
  });

  const postsQuery = useQuery({
    queryKey: ['posts', bizId],
    queryFn: () => getCompanyPosts(bizId!),
    enabled: !!bizId,
  });

  const posts: CompanyPost[] = postsQuery.data ?? [];

  const vm = useMemo<ProfileVM | null>(() => {
    if (bizId && companyQuery.data) {
      return businessVM(companyQuery.data, userId, override);
    }
    if (cardCode && recordQuery.data) {
      return cardVM(recordQuery.data, {
        // Bu ro'yxat `/api/auth/me` dan keldi, ya'ni karta har doim
        // foydalanuvchining o'ziga tegishli.
        isOwner: true,
        override,
        followers: followQuery.data?.followers,
        isFollowing: followQuery.data?.isFollowing,
      });
    }
    return null;
  }, [
    bizId,
    cardCode,
    companyQuery.data,
    recordQuery.data,
    followQuery.data,
    userId,
    override,
  ]);

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
  if (!accounts.length || !active) return null;
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
