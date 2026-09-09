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
//   2. www. bilan boshlangani;
//   3. SXEMASIZ domen — "nfcstore.uz", "t.me/nfcstoreuz",
//      "instagram.com/nfcstore.uz" kabi (2026-09, egasining so'rovi:
//      "havolalar ko'k bo'lsin, bosilganda kirsin"). Yangilik matnini
//      odam qo'lda yozadi va "https://" ni deyarli hech qachon
//      qo'shmaydi — shu sabab ular oddiy matn bo'lib qolardi.
//
// 3-tur ATAYLAB TOR: oxirgi bo'lak (TLD) ma'lum ro'yxatdan bo'lishi
// shart. Aks holda "narx 1.500.000" yoki "3.5 barobar" kabi matnlar
// havolaga aylanib qolardi.
const TLD = [
  'uz', 'com', 'net', 'org', 'ru', 'me', 'io', 'co', 'info', 'biz', 'tv',
  'dev', 'app', 'site', 'online', 'shop', 'store', 'pro', 'xyz',
  'edu', 'gov', 'kz', 'kg', 'tj', 'tm', 'az', 'tr', 'ae', 'us', 'uk',
];
// Domen bo'laklari + ro'yxatdagi TLD + ixtiyoriy yo'l. Oxiridagi
// `(?![a-z0-9-])` — "nfcstore.uzb" kabi so'z yarmi havola bo'lib
// qolmasligi uchun.
const BARE = `(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${TLD.join('|')})(?![a-z0-9-])(?:\\/[^\\s<>"']*)?`;
const URL_RE = new RegExp(`(?:https?:\\/\\/|www\\.)[^\\s<>"']+|${BARE}`, 'gi');

// Sxemasiz domen uchun QO'SHIMCHA shartlar (yuqoridagi regex bilan
// birga ishlaydi):
//
//   - TLD kichik harfda bo'lsin. Bu "nuqtadan keyin probel qo'yilmagan"
//     xatolarni chetlab o'tadi: "tugadi.Ishni boshladik" da "Ish" katta
//     harf bilan, ya'ni bu domen emas, oddiy matn.
//   - Oldidagi belgi harf/raqam/nuqta/`@` bo'lmasin. Shunda elektron
//     pochta manzilining yarmi ("info@nfcstore.uz" dagi domen) alohida
//     havolaga aylanib qolmaydi.
const SCHEMED_RE = /^(?:https?:\/\/|www\.)/i;
function bareDomainOk(text, index, raw) {
  if (SCHEMED_RE.test(raw)) return true;
  const host = raw.split('/')[0];
  const tld = host.slice(host.lastIndexOf('.') + 1);
  if (tld !== tld.toLowerCase()) return false;
  const prev = index > 0 ? text[index - 1] : '';
  return !prev || !/[A-Za-z0-9.@_-]/.test(prev);
}

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
    if (!bareDomainOk(text, m.index, m[0])) continue;
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
