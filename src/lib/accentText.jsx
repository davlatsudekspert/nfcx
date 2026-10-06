// SARLAVHADAGI URG'U (oltin rang) — TARJIMADA SO'Z TARTIBI BUZILMASIN.
//
// Ilgari sarlavha ikki alohida t() dan yig'ilardi:
//   {t('NFC ID kartangizni o‘zingizga mos')} <span>{t('dizaynda tayyorlang')}</span>
// O'zbekchada to'g'ri, lekin rus/ingliz tilida bo'laklar alohida
// tarjima qilinib, jumla chalkash chiqardi ("Your NFC ID card, your way
// design it your way"). Endi butun jumla BITTA kalit, urg'u qismi
// [[...]] bilan belgilanadi — tarjimon uni jumlaning istalgan joyiga
// qo'yadi.
export function accentText(text, className) {
  const parts = String(text || '').split(/\[\[|\]\]/);
  if (parts.length < 3) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <span key={i} className={className}>{p}</span> : p));
}
