// ═══════════════════════════════════════════════════════════════════════
// JS/JSX MANBASIDAN IZOHLARNI OLIB TASHLASH
//
// NIMA UCHUN ALOHIDA MODUL. Tekshiruv skriptlari manbada biror naqsh
// bor-yo'qligini qaraydi. Izohlar ularni chalg'itmasligi kerak: izoh
// ichida ham "confirm", "saveLabel" kabi so'zlar uchraydi va o'chirilgan
// kod izohga o'ralgan holda testni ALDAB o'tkazib yuborishi mumkin.
//
// NIMA UCHUN ODDIY REGEX EMAS. Ilgari bu ish bitta qatorli regex bilan
// qilinardi:
//
//     src.replace(/\/\*[\s\S]*?\*\//g, '')
//
// U MANBA MATNINI TUSHUNMAYDI. Loyihada esa shunday qator bor:
//
//     <input type="file" accept="image/*" ... />
//
// Regex uchun `image/*` dagi `/*` — izohning BOSHI. U keyingi haqiqiy
// `*/` gacha hamma narsani o'chirib yuboradi. Bu 2026-09 da haqiqatan
// sodir bo'ldi: AccountPage.jsx dan 117 KB kod "izoh" deb yo'q qilindi,
// tekshiruv esa mavjud kodni "yo'q" deb noto'g'ri yiqildi.
//
// Eng yomoni — u JIM ishlaydi: manbaga yangi izoh qo'shilishi juftlikni
// surib, butunlay boshqa joyni yeb qo'yishi mumkin.
//
// SHUNING UCHUN BU YERDA KICHIK SKANER. U manbani belgima-belgi o'qiydi
// va har doim qaysi holatda ekanini biladi:
//
//     oddiy kod  |  'satr'  |  "satr"  |  `shablon`  |  // izoh  |  /* izoh */
//
// Satr yoki shablon ichidagi `/*` — oddiy matn, izoh emas. Shablon
// ichidagi `${...}` esa yana kodga qaytadi (u yerda izoh bo'lishi
// mumkin).
//
// TASHQI KUTUBXONA ATAYLAB ISHLATILMADI. Bu modul deploy qo'riqchisi
// tarkibida ishlaydi; u faqat Node'ning o'ziga tayanadi, shuning uchun
// bog'liqliklar daraxti o'zgarsa ham ishlamay qolmaydi. To'g'riligi
// `scripts/test-strip-comments.mjs` da esbuild (haqiqiy parser) bilan
// yonma-yon solishtirib tasdiqlanadi.
// ═══════════════════════════════════════════════════════════════════════

// Izohni nima bilan almashtirish kerak?
//
// Bo'sh satr EMAS, bitta probel: `a/* x */b` → `a b`. Aks holda ikki
// tomondagi belgilar bir-biriga yopishib, manbada avval bo'lmagan
// yangi so'z paydo bo'lardi.
//
// Qator izohlari va ko'p qatorli izohlardagi QATOR AJRATGICHLAR
// saqlanadi — shunda olib tashlangandan keyin ham qator raqamlari va
// "shu qatorda" degan tekshiruvlar joyida qoladi.
function blank(text) {
  const newlines = text.match(/\n/g);
  return newlines ? newlines.join('') : ' ';
}

export function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;

  // Shablon satrlari ichma-ich bo'lishi mumkin:
  //   `a ${ `b ${c}` } d`
  // Shuning uchun ochilgan `${` lar sanog'i stack'da yuriladi.
  const tmplStack = [];

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    // ── Izohlar ──────────────────────────────────────────────────────
    if (c === '/' && c2 === '/') {
      let j = i + 2;
      while (j < n && src[j] !== '\n') j += 1;
      out += blank(src.slice(i, j));
      i = j;
      continue;
    }
    if (c === '/' && c2 === '*') {
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j += 1;
      j = Math.min(j + 2, n); // yopuvchi `*/` ham kiradi
      out += blank(src.slice(i, j));
      i = j;
      continue;
    }

    // ── Oddiy satrlar ────────────────────────────────────────────────
    // Ichidagi `/*` — matn. Qochirilgan belgi (`\'`) satrni yopmaydi.
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) { j += 1; break; }
        // Yopilmagan satr keyingi qatorga o'tmaydi (JS qoidasi) —
        // shunda bitta apostrof butun faylni "satr" qilib qo'ymaydi.
        if (src[j] === '\n') break;
        j += 1;
      }
      out += src.slice(i, j);
      i = j;
      continue;
    }

    // ── Shablon satri ────────────────────────────────────────────────
    if (c === '`') {
      tmplStack.push(0);
      out += c;
      i += 1;
      while (i < n && tmplStack.length) {
        if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
        if (src[i] === '`') { tmplStack.pop(); out += src[i]; i += 1; continue; }
        if (src[i] === '$' && src[i + 1] === '{') {
          // `${` ichida yana KOD boshlanadi — u yerda izoh ham,
          // yangi shablon ham bo'lishi mumkin. Shuning uchun shu
          // bo'lakni skanерning o'ziga qaytarib beramiz.
          const start = i + 2;
          let depth = 1;
          let j = start;
          while (j < n && depth) {
            const ch = src[j];
            if (ch === '{') depth += 1;
            else if (ch === '}') depth -= 1;
            else if (ch === '`' || ch === "'" || ch === '"') {
              // Ichki satrni butunlay sakrab o'tamiz, aks holda
              // undagi `}` chuqurlikni buzardi.
              const q = ch;
              j += 1;
              while (j < n) {
                if (src[j] === '\\') { j += 2; continue; }
                if (src[j] === q) break;
                if (q !== '`' && src[j] === '\n') break;
                j += 1;
              }
            }
            j += 1;
          }
          out += '${' + stripComments(src.slice(start, j - 1)) + '}';
          i = j;
          continue;
        }
        out += src[i];
        i += 1;
      }
      continue;
    }

    out += c;
    i += 1;
  }

  return out;
}

export default stripComments;
