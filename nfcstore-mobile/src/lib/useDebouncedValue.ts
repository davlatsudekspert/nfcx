import { useEffect, useState } from 'react';

/**
 * Qiymatni `delayMs` millisekund JIM turgandan keyin qaytaradi.
 *
 * Discover qidiruvida ishlatiladi: har bosilgan harf server so'roviga
 * aylanmasin (spetsifikatsiya: "har harfda keraksiz request yubormasin").
 * Foydalanuvchi yozishda davom etsa, avvalgi timeout bekor qilinadi —
 * faqat OXIRGI qiymat so'ralganidan `delayMs` o'tgach chiqadi.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
