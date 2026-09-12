import type { CompanyHours } from '@/api/types';

/**
 * Narx — maketdagi ko'rinish: "1 200 000 so'm".
 * Ajratgich sifatida oddiy bo'shliq emas, UZUNMAS bo'shliq (U+00A0)
 * ishlatiladi: aks holda tor kartada son "1 200" va "000" bo'lib
 * ikki qatorga bo'linib ketadi.
 */
export function money(value: number): string {
  const n = Math.round(Number(value) || 0);
  return `${n.toLocaleString('uz-UZ').replace(/[\s,]/g, ' ')} so'm`;
}

/** Statistika sonlari — maketda "12.4k", "1 843". */
export function compactCount(value: number): string {
  const n = Number(value) || 0;
  if (n < 10_000) return n.toLocaleString('uz-UZ').replace(/[\s,]/g, ' ');
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

const DAY_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

/**
 * Ish vaqti qatori — maketda "Mon–Sat · 10:00–19:00".
 *
 * `hours` normalizeHoursD1() dan keladi: 7 ta yozuv, `day` 0=yakshanba.
 * Eng ko'p uchraydigan oyna tanlanadi va uning ketma-ket kunlari
 * oraliq sifatida yoziladi — har kunni sanab chiqish sarlavhaga
 * sig'maydi.
 */
export function hoursSummary(hours: CompanyHours[]): string {
  const open = (hours ?? []).filter((h) => h && !h.closed && h.open && h.close);
  if (!open.length) return '';

  const counts = new Map<string, number>();
  for (const h of open) {
    const key = `${h.open}-${h.close}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let bestKey = '';
  let bestN = 0;
  for (const [key, n] of counts) {
    if (n > bestN) {
      bestKey = key;
      bestN = n;
    }
  }
  const days = open
    .filter((h) => `${h.open}-${h.close}` === bestKey)
    .map((h) => h.day)
    .sort((a, b) => a - b);
  const [openAt, closeAt] = bestKey.split('-');

  return `${dayRange(days)} · ${openAt}–${closeAt}`;
}

/** Faqat vaqt oynasi — "10:00 – 19:00" (sarlavhadagi qisqa variant). */
export function todayWindow(hours: CompanyHours[]): string {
  const open = (hours ?? []).filter((h) => h && !h.closed && h.open && h.close);
  if (!open.length) return '';
  const counts = new Map<string, number>();
  for (const h of open) {
    const key = `${h.open} – ${h.close}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** [1,2,3,4,5,6] -> "Dush–Shan"; [1,3,5] -> "Dush, Chor, Jum" */
function dayRange(days: number[]): string {
  if (!days.length) return '';
  if (days.length === 7) return 'Har kuni';
  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  if (consecutive && days.length > 2) {
    return `${DAY_SHORT[days[0]]}–${DAY_SHORT[days[days.length - 1]]}`;
  }
  return days.map((d) => DAY_SHORT[d]).join(', ');
}

/**
 * Nisbiy vaqt — maketda "4 hours ago". O'zbekcha son+birlik shaklida
 * ("4 soat oldin"), chunki o'zbek tilida ingliz tilidagidek ko'plik
 * qo'shimchasi kerak emas.
 */
export function relativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diff = Math.max(0, Date.now() - ts);

  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daqiqa oldin`;

  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} soat oldin`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} kun oldin`;
  if (days < 30) return `${Math.floor(days / 7)} hafta oldin`;
  if (days < 365) return `${Math.floor(days / 30)} oy oldin`;
  return `${Math.floor(days / 365)} yil oldin`;
}

/**
 * Telefonni maketdagi ko'rinishga keltiradi: "+998 90 123 45 67".
 * Kutilmagan uzunlikda xom qiymat qaytariladi — buzib ko'rsatgandan
 * ko'ra o'zini ko'rsatish yaxshi.
 */
export function prettyPhone(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  return raw ?? '';
}
