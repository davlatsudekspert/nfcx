// ═══════════════════════════════════════════════════════════════════════
// KOMPANIYA NOMI TAQIQLANGAN SO'ZLAR FILTRI (2026-09)
//
// DIQQAT: bu faylning mantig'i hosting/worker.js ichidagi
// `companyNameBlockedD1()` bilan AYNAN bir xil bo'lishi shart (Worker
// modullari `src/` dan import qila olmaydi — build guard buni taqiqlaydi).
// scripts/test-company-name-guard.mjs ikkalasini bir xil kirishlarda
// solishtirib, ular ajralib ketmasligini kafolatlaydi.
//
// Chetlab o'tishga qarshi qatlamlar:
//  1. Unicode NFKC normalizatsiya (ﬁ, ％, to'liq kenglikdagi Ｇｏｄ v.h.)
//  2. Nol-kenglikdagi belgilar va birlashtiruvchi diakritiklar olib
//     tashlanadi (G​o​d, ĝöd)
//  3. Homoglif (o'xshash ko'rinishdagi) harflar lotinchaga qaytariladi —
//     kirill о/О, grek ο/Ο, raqam 0, kirill ԁ, ԍ va h.k.
//  4. Katta-kichik harf farqi yo'q
//
// TOPISH QOIDASI — ataylab ikki xil:
//  A) SO'Z ICHIDA: har bir so'zdan harf/raqam bo'lmagan belgilar olib
//     tashlanadi va "god" qism satr sifatida qidiriladi.
//     Bu "God", "GOD", "g.o.d", "G-O-D", "G0D", "Godiva", shuningdek
//     foydalanuvchi "go" yozib ustiga "d" bosgan holatni ham tutadi.
//  B) BOSH HARFLAR: ketma-ket kelgan BITTA harfli so'zlar birlashtiriladi
//     ("G O D" -> "god").
//
// NIMA UCHUN butun nomdan bo'shliqlar olib tashlanmaydi: unda "Chicago
// Doner" yoki "Mango Delivery" kabi mutlaqo begunoh nomlar ham
// ("chicago"+"doner" -> ...g-o-d...) noto'g'ri bloklanardi. Yuqoridagi
// ikki qoida real chetlab o'tish usullarini tutadi, lekin bunday yolg'on
// ijobiy natijalarni bermaydi.
// ═══════════════════════════════════════════════════════════════════════

export const BLOCKED_NAME_WORDS = ['god'];

const HOMOGLYPHS = {
  // "o" ko'rinishidagilar
  '\u043e': 'o', '\u041e': 'o', // kirill o, O
  '\u03bf': 'o', '\u039f': 'o', // grek omikron
  '\u0585': 'o', '\u00f8': 'o', '\u00d8': 'o',
  '0': 'o',
  '\u1d0f': 'o', // kichik bosh harf O
  // "d" ko'rinishidagilar
  '\u0501': 'd', '\u0257': 'd', '\u1d05': 'd',
  // "g" ko'rinishidagilar
  '\u050d': 'g', '\u0261': 'g', '\u0581': 'g', '\u0262': 'g',
};
function foldName(value) {
  let s = String(value == null ? '' : value);
  // 1) NFKC — to'liq kenglikdagi va moslik (compatibility) shakllarini yig'adi
  try { s = s.normalize('NFKC'); } catch { /* normalize yo'q bo'lsa davom etamiz */ }
  // 2) NFD orqali diakritiklarni ajratib tashlaymiz (g-circumflex -> g)
  try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { /* ignore */ }
  // 3) Nol-kenglikdagi va ko'rinmas belgilar (ZWSP/ZWNJ/ZWJ, LRM/RLM,
  //    yo'nalish belgilari, word-joiner, BOM, soft hyphen)
  s = s.replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff\u00ad]/g, '');
  // 4) Homogliflar
  s = s.replace(/./gu, (ch) => HOMOGLYPHS[ch] || ch);
  return s.toLowerCase();
}

// Nom taqiqlangan so'zni o'z ichiga oladimi?
export function companyNameBlocked(value) {
  const folded = foldName(value);
  if (!folded) return false;
  // Bo'shliq va shunga o'xshash ajratgichlar bo'yicha so'zlarga ajratamiz
  const words = folded.split(/[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/).filter(Boolean);

  // A) So'z ICHIDA (so'z ichidagi tinish belgilari olib tashlanadi)
  for (const w of words) {
    const letters = w.replace(/[^a-z0-9]/g, '');
    for (const bad of BLOCKED_NAME_WORDS) if (letters.includes(bad)) return true;
  }

  // B) Ketma-ket kelgan BITTA harfli so'zlar ("G O D")
  let acc = '';
  for (const w of words) {
    const letters = w.replace(/[^a-z0-9]/g, '');
    if (letters.length === 1) {
      acc += letters;
      for (const bad of BLOCKED_NAME_WORDS) if (acc.includes(bad)) return true;
    } else {
      acc = '';
    }
  }
  return false;
}
