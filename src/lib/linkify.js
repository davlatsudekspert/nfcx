// Oddiy matndagi havolalarni topish.
//
// Yangiliklar matni admin panelidan ODDIY MATN sifatida kiritiladi —
// HTML emas. Shu sabab havolalar bosilmas edi: odam matnni belgilab,
// nusxalab, brauzerga qo'lda qo'yishi kerak bo'lardi.
//
// XAVFSIZLIK: bu yerda HECH QACHON HTML yaratilmaydi va
// `dangerouslySetInnerHTML` ishlatilmaydi — funksiya faqat matnni
// bo'laklarga ajratadi, React esa har bir bo'lakni o'zi ekranlaydi.
// `href` ga faqat http/https havola tushadi (`javascript:` kabi sxemalar
// umuman regexga tushmaydi).

// Nima topiladi:
//   1. http:// yoki https:// bilan boshlangan havola;
//   2. www. bilan boshlangani (oldiga https:// qo'shiladi).
// Boshqa "domenga o'xshash" so'zlar ATAYLAB tegilmaydi — masalan
// "narx 1.500.000" yoki "3.5 barobar" kabi matnlar havolaga aylanib
// qolmasligi uchun.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

// Havola oxiridagi tinish belgilari havolaning O'ZI emas: "saytimiz —
// https://nfcstore.uz." dagi nuqta yoki "(https://t.me/x)" dagi qavs
// matnga tegishli. Ular kesib olinadi, aks holda havola ochilmaydi.
function trimTrailing(raw) {
  let url = raw;
  let cut = '';
  for (;;) {
    const last = url[url.length - 1];
    if (!last) break;
    if ('.,;:!?»"\''.includes(last)) { cut = last + cut; url = url.slice(0, -1); continue; }
    // Yopuvchi qavs faqat juftsiz bo'lsa kesiladi — Wikipedia kabi
    // havolalarda qavs havolaning ichida bo'lishi mumkin.
    if (last === ')' && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) {
      cut = last + cut; url = url.slice(0, -1); continue;
    }
    break;
  }
  return [url, cut];
}

// Matnni bo'laklarga ajratadi:
//   { type: 'text', value }  yoki  { type: 'link', href, label }
// `label` — matnda qanday yozilgan bo'lsa shunday ko'rsatiladi (www.
// ko'rinishi https:// ga aylantirilmaydi), `href` esa har doim to'liq.
export function linkifyParts(input) {
  const text = String(input || '');
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const [url, cut] = trimTrailing(m[0]);
    if (!url) continue;
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    parts.push({
      type: 'link',
      href: /^https?:\/\//i.test(url) ? url : 'https://' + url,
      label: url,
    });
    if (cut) parts.push({ type: 'text', value: cut });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}
