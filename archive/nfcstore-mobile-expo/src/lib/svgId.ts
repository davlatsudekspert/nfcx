import { useId } from 'react';

/**
 * `react-native-svg` uchun xavfsiz va YAGONA `id`.
 *
 * Ikki muammoni yechadi:
 *
 *  1. Qat'iy yozilgan `id` lar TO'QNASHADI. `react-native-svg` da
 *     gradient/pattern ta'riflari bitta ro'yxatda saqlanadi, shuning
 *     uchun bir vaqtda ikki komponent "igGrad" nomini ishlatsa,
 *     ikkinchisi birinchisining ta'rifini oladi — ekranda tasodifiy
 *     rang chiqadi. Tab navigator ekranlarni xotirada saqlab turadi,
 *     ya'ni bir necha nusxa BIR VAQTDA tirik bo'ladi.
 *
 *  2. `useId()` ning o'zi yetarli emas: React qaytaradigan qiymat
 *     ichida `:` va `«»` kabi belgilar bo'ladi (masalan `:r3:`), ular
 *     esa `url(#…)` havolasini buzadi. Shuning uchun harf va raqamdan
 *     boshqasi olib tashlanadi.
 */
export function useSvgId(prefix: string): string {
  const raw = useId();
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}
