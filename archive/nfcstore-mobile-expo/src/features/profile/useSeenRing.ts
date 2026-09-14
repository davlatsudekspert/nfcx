import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { CompanyPost } from '@/api/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Yangi kontent" halqasi — spetsifikatsiya 8-bo'limi.
 *
 * MUHIM: bu 24 soatda o'chadigan Stories tizimi EMAS (u ataylab keyingi
 * bosqichga qoldirilgan). Bu shunchaki MAVJUD Post funksiyasi ustidagi
 * vizual qatlam:
 *
 *   • oxirgi post 24 soat ichida bo'lsa -> halqa gradient va aylanadi
 *   • tashrifchi o'sha postni ko'rgach -> halqa kulrangga o'tadi
 *
 * "Ko'rilgan" holati QURILMADA saqlanadi (backendda bunday tushuncha
 * yo'q va uni yaratish yangi jadval talab qilardi): profil kaliti
 * bo'yicha oxirgi ko'rilgan post ID si yoziladi. Yangi post chiqsa ID
 * o'zgaradi va halqa yana yonadi.
 */
export function useSeenRing(profileKey: string, posts: CompanyPost[]) {
  const [seenId, setSeenId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const latest = latestPost(posts);
  const hasNewContent =
    !!latest && Date.now() - Date.parse(latest.createdAt) < DAY_MS;

  const storageKey = `nfcstore.seenPost.${profileKey}`;

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!alive) return;
        const parsed = raw == null ? null : Number(raw);
        setSeenId(Number.isFinite(parsed) ? parsed : null);
      })
      .catch(() => {
        if (alive) setSeenId(null);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [storageKey]);

  const markSeen = useCallback(() => {
    if (!latest) return;
    setSeenId(latest.id);
    AsyncStorage.setItem(storageKey, String(latest.id)).catch(() => {});
  }, [latest, storageKey]);

  return {
    /** Halqa yonishi kerakmi (24 soat ichida post bor). */
    hasNewContent,
    /** Ko'rilganmi — saqlangan qiymat o'qilmaguncha `true` deb turamiz,
        shunda halqa yuklanish paytida bir lahza "yonib" ketmaydi. */
    seen: !loaded || (latest != null && seenId === latest.id),
    latest,
    markSeen,
  };
}

function latestPost(posts: CompanyPost[]): CompanyPost | null {
  let best: CompanyPost | null = null;
  let bestTs = -Infinity;
  for (const p of posts) {
    const ts = Date.parse(p.createdAt);
    if (Number.isFinite(ts) && ts > bestTs) {
      bestTs = ts;
      best = p;
    }
  }
  return best;
}
