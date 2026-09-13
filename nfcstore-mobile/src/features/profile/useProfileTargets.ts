import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  getCompany,
  getCompanyPosts,
  getCompanyStories,
  getFollowStats,
  getMe,
  getRecord,
} from '@/api/endpoints';
import type { CompanyPost, CompanyStory } from '@/api/types';
import { useRoleStore } from '@/store/roleStore';

import { businessVM, cardVM, type ProfileVM } from './profileVM';

/**
 * ISTALGAN shaxsiy kartani kod bo'yicha ochish — NFC teginish va Katalog
 * shu hook orqali ishlaydi.
 *
 * Egalik `/api/records/:code` javobidan bilinmaydi (u egasining ID'sini
 * qaytarmaydi), shuning uchun `/api/auth/me` dagi `cards[]` ro'yxati
 * bilan solishtiriladi: kod o'sha ro'yxatda bo'lsa — bu mening kartam.
 * Bu qo'shimcha endpoint talab qilmaydi va ro'yxat baribir keshda turadi.
 */
export function useCardProfile(code: string | null) {
  const override = useRoleStore((s) => s.override);

  const recordQuery = useQuery({
    queryKey: ['record', code],
    queryFn: () => getRecord(code!),
    enabled: !!code,
  });

  const followQuery = useQuery({
    queryKey: ['follow-stats', code],
    queryFn: () => getFollowStats(code!),
    enabled: !!code,
  });

  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });

  const card = recordQuery.data;
  const linkedCompanyId = card?.companyId || null;

  // Ulangan kompaniyaning nomi va logotipi "profilda kompaniya" bloki
  // uchun kerak. Bloksiz ham profil to'liq ishlaydi, shuning uchun bu
  // so'rov muvaffaqiyatsiz bo'lsa ekran buzilmaydi.
  const companyQuery = useQuery({
    queryKey: ['company', linkedCompanyId],
    queryFn: () => getCompany(linkedCompanyId!),
    enabled: !!linkedCompanyId,
  });

  const isOwner = useMemo(() => {
    if (!code) return false;
    const mine = meQuery.data?.cards ?? [];
    return mine.some((c) => c.code.toUpperCase() === code.toUpperCase());
  }, [code, meQuery.data]);

  const vm = useMemo<ProfileVM | null>(() => {
    if (!card) return null;
    const linked = companyQuery.data;
    return cardVM(card, {
      isOwner,
      override,
      followers: followQuery.data?.followers,
      isFollowing: followQuery.data?.isFollowing,
      featuredCompany: linked
        ? {
            companyId: linked.companyId,
            displayName: linked.displayName || linked.companyId,
            logoUrl: linked.logoUrl,
          }
        : undefined,
    });
  }, [card, companyQuery.data, followQuery.data, isOwner, override]);

  return {
    vm,
    /**
     * Bo'sh ro'yxat — QASDAN, "backend yo'q" degani EMAS. Audit
     * (`hosting/worker.js`) shaxsiy kartada ham real `/api/records/:code/posts`
     * va `/api/records/:code/stories` borligini tasdiqladi, lekin bu
     * SLICE faqat Business Profile qamrovida — shaxsiy post/story
     * ekranga ulash keyingi (Personal profile) slice'ga qoldirildi.
     */
    posts: [] as CompanyPost[],
    stories: [] as CompanyStory[],
    loading: recordQuery.isLoading,
    error: recordQuery.error,
    notFound: !!recordQuery.error && !recordQuery.data,
  };
}

/** ISTALGAN kompaniyani ID bo'yicha ochish — Katalog va "profilda kompaniya" bloki. */
export function useCompanyProfile(companyId: string | null) {
  const override = useRoleStore((s) => s.override);

  const companyQuery = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId!),
    enabled: !!companyId,
  });

  const postsQuery = useQuery({
    queryKey: ['posts', companyId],
    queryFn: () => getCompanyPosts(companyId!),
    enabled: !!companyId,
  });

  const storiesQuery = useQuery({
    queryKey: ['stories', 'company', companyId],
    queryFn: () => getCompanyStories(companyId!),
    enabled: !!companyId,
  });

  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });

  const vm = useMemo<ProfileVM | null>(
    () =>
      companyQuery.data
        ? businessVM(companyQuery.data, meQuery.data?.user?.id, override)
        : null,
    [companyQuery.data, meQuery.data, override],
  );

  return {
    vm,
    posts: postsQuery.data ?? [],
    stories: (storiesQuery.data ?? []) as CompanyStory[],
    loading: companyQuery.isLoading,
    error: companyQuery.error,
    notFound: !!companyQuery.error && !companyQuery.data,
  };
}
