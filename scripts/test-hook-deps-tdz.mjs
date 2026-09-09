// HOOK BOG'LIQLIKLARI: e'lon qilinishidan OLDIN ishlatilgan o'zgaruvchi.
//
// NIMA UCHUN BU TEST BOR: 2026-09-09 da ProfilePage'dagi `useEffect`
// bog'liqliklar ro'yxatida `isOwner` ishlatildi, `isOwner` esa o'sha
// funksiyada ANCHA PASTDA `const` bilan e'lon qilingan edi.
// Bog'liqliklar ro'yxati render paytida DARHOL hisoblanadi, shuning
// uchun brauzerda "Cannot access 'isOwner' before initialization"
// chiqdi va BUTUN PROFIL SAHIFASI ochilmay qoldi.
//
// `npm run build` bunga hech qanday xato bermaydi: sintaksis to'g'ri,
// xato faqat ishga tushganda bilinadi. Shuning uchun tekshiruv shu
// yerda.
//
//   node scripts/test-hook-deps-tdz.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let pass = 0, fail = 0;
const ok = (label) => { console.log('PASS -', label); pass++; };
const bad = (label, detail) => { console.log('FAIL -', label, `\n    ${detail}`); fail++; };

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function collect(dir) {
  const out = [];
  for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...collect(path.join(dir, e.name)));
    else if (/\.jsx?$/.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}

// Satr va izohlarni olib tashlaymiz — ular ichidagi matn tahlilni
// chalg'itmasin. Uzunlik saqlanadi, shunda o'rinlar (index) siljimaydi.
function blank(src) {
  let out = '';
  let i = 0;
  const keep = (n) => { out += ' '.repeat(n); i += n; };
  while (i < src.length) {
    const c = src[i];
    const two = src.slice(i, i + 2);
    if (two === '//') { const end = src.indexOf('\n', i); const n = (end === -1 ? src.length : end) - i; keep(n); continue; }
    if (two === '/*') { const end = src.indexOf('*/', i + 2); const n = (end === -1 ? src.length : end + 2) - i; keep(n); continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === '\\') j += 1; j += 1; }
      keep(Math.min(j + 1, src.length) - i); continue;
    }
    out += c; i += 1;
  }
  return out;
}

const files = [...collect('src/pages'), ...collect('src/components')];
const problems = [];

for (const rel of files) {
  const src = blank(readFileSync(path.join(root, rel), 'utf8'));
  // Hook bog'liqliklari ro'yxati: `}, [a, b, c]);`
  const depsRe = /\}\s*,\s*\[([^\]]*)\]\s*\)/g;
  let m;
  while ((m = depsRe.exec(src)) !== null) {
    const at = m.index;
    const names = new Set(
      (m[1].match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [])
        // `a?.b` va `a.b` da faqat BIRINCHI qism o'zgaruvchi.
        .filter((n, k, arr) => k === 0 || !/[.?]/.test(m[1][m[1].indexOf(arr[k])  - 1] || ''))
    );
    for (const name of names) {
      // Nom qayerda e'lon qilingan? (const/let/var/function/parametr,
      // destrukturizatsiya ham hisobga olinadi.)
      const declRe = new RegExp(`(?:const|let|var|function)\\s+(?:[^;=]*?\\b)?${name}\\b`, 'g');
      const positions = [];
      let d;
      while ((d = declRe.exec(src)) !== null) positions.push(d.index);
      if (!positions.length) continue;                 // import yoki global — tegishli emas
      if (positions.some((p) => p < at)) continue;      // oldinroq e'lon bor — xavfsiz
      problems.push(`${rel}: "${name}" bog'liqliklar ro'yxatida ishlatilgan, lekin e'lon qilinishi PASTDA (belgi ${at})`);
    }
  }
}

if (problems.length === 0) ok(`${files.length} ta faylda e'londan oldin ishlatilgan bog'liqlik yo'q`);
else for (const p of problems) bad('e’londan oldin ishlatilgan', p);

// Tekshiruvning O'ZI ishlayotganini isbotlaymiz: sun'iy namunada
// muammo ANIQLANISHI kerak, aks holda "hammasi yaxshi" degan javob
// hech narsani bildirmaydi.
{
  const sample = `function P(){ useEffect(() => {}, [later]); const later = 1; }`;
  const s = blank(sample);
  const m2 = /\}\s*,\s*\[([^\]]*)\]\s*\)/.exec(s);
  const pos = new RegExp(`(?:const|let|var|function)\\s+(?:[^;=]*?\\b)?later\\b`).exec(s).index;
  check_selftest(m2 && pos > m2.index);
}
function check_selftest(v) {
  if (v) ok('tekshiruvning o‘zi sun’iy namunadagi muammoni topadi');
  else bad('o‘z-o‘zini tekshirish', 'sun’iy namuna aniqlanmadi — tekshiruv ishlamayapti');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
