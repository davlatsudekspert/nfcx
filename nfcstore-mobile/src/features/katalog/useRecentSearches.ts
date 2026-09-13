import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'nfcstore.discover.recentSearches';
const MAX_ITEMS = 6;

/**
 * So'nggi qidiruvlar — QURILMADA saqlanadi (`AsyncStorage`, xuddi
 * `ThemeProvider` kabi), server'ga YUBORILMAYDI. Bu foydalanuvchining
 * o'z shaxsiy amali tarixi, "production ma'lumot" emas — shuning uchun
 * mock/fake ma'lumot degan ma'noni bermaydi.
 */
export function useRecentSearches() {
  const [items, setItems] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed.filter((v) => typeof v === 'string'));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const add = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setItems((prev) => {
      const next = [clean, ...prev.filter((v) => v.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        MAX_ITEMS,
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const remove = useCallback((term: string) => {
    setItems((prev) => {
      const next = prev.filter((v) => v !== term);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return { items, ready, add, remove, clear };
}
