// ISH VAQTI — 7 kunlik jadval.
//
// Massiv indeksi = hafta kuni, 0 = YAKSHANBA (JS `Date.getDay()` bilan
// bir xil). Interfeysda esa dushanbadan boshlanadi — O'zbekistonda
// hafta shunday o'qiladi. Shu sababli `WEEK_ORDER` alohida turadi:
// SAQLASH tartibi va KO'RSATISH tartibi bir xil bo'lishi shart emas,
// lekin ikkalasi bir joyda yozilgan bo'lishi shart.

export const DAY_NAMES = [
  'Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba',
];
export const DAY_SHORT = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'];

// Ko'rsatish tartibi: dushanba ... yakshanba.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const emptyHours = () => Array.from({ length: 7 }, () => ({ closed: true, open: '', close: '' }));

// Serverdan kelgan (yoki eski/buzuq) qiymatni doim 7 elementli,
// ishonchli shaklga keltiradi.
export function normalizeHours(value) {
  const src = Array.isArray(value) ? value : [];
  return Array.from({ length: 7 }, (_, i) => {
    const d = src[i] || {};
    const open = HHMM_RE.test(String(d.open || '')) ? String(d.open) : '';
    const close = HHMM_RE.test(String(d.close || '')) ? String(d.close) : '';
    return d.closed || !open || !close ? { closed: true, open: '', close: '' } : { closed: false, open, close };
  });
}

// Bitta ham ochiq kun yo'qmi? Bo'sh jadval umuman ko'rsatilmaydi —
// "har kuni yopiq" degan yolg'on chiqmasin.
export const hoursEmpty = (hours) => !normalizeHours(hours).some((d) => !d.closed);

export const dayLabel = (d) => (d.closed ? 'Yopiq' : `${d.open}–${d.close}`);

// Standart jadval: dushanba-shanba 09:00-18:00, yakshanba yopiq.
// Egasi "Ish vaqtini qo'shish" tugmasini bosganda shu chiqadi —
// bo'sh 7 ta qatorni qo'lda to'ldirishdan ko'ra tezroq.
export function defaultHours() {
  const week = emptyHours();
  for (const i of [1, 2, 3, 4, 5, 6]) week[i] = { closed: false, open: '09:00', close: '18:00' };
  return week;
}
