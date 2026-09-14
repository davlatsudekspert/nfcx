// SAHIFA ISHLATAYOTGAN CSS SINFI O'SHA SAHIFAGA YUKLANADIMI.
//
// NIMA UCHUN BU TEST BOR — HAQIQIY XATODAN (uchinchi marta!).
//
// `src/company-system.css` GLOBAL EMAS: u faqat uni `import` qilgan
// sahifa bilan birga yuklanadi (Vite har sahifani alohida bo'lakka
// ajratadi). Shu sababli bir xil xato loyihada uch marta takrorlandi:
//
//   1. istorya uslublari hech qayerda yuklanmaydigan faylga yozilgan;
//   2. `.co-modal` (kontent qoidalari oynasi) shaxsiy kabinetda
//      uslubsiz chiqqan;
//   3. `.cw-upload-btn` va `.story-upload` — "＋ Istorya qo'shish"
//      tugmasi shaxsiy kabinetda brauzerning kulrang standart
//      tugmasi bo'lib ko'ringan. Yonidagi post blokida esa oltin
//      "Saqlash" tugmasi bor edi, shuning uchun egasi istoryani ham
//      o'sha tugma saqlaydi deb o'ylagan va "istorya postsiz
//      saqlanmayapti" deb xabar bergan.
//
// Xatoning butun tabiati shunda: JSX ham, CSS ham ALOHIDA olganda
// TO'G'RI ko'rinadi. Noto'g'ri narsa — ularning uchrashmasligi.
//
//   node scripts/css-scope-test.mjs
//
// TEKSHIRUV YAKUNIY EMAS: matn bo'yicha ishlaydi. "Sinf umuman
// yuklanmaydi" holatini ushlaydi, "yuklanadi, lekin qoida zaif"
// holatini emas. Aynan birinchisi uch marta xato bergan.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

// ── Barcha manba fayllari ────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const FILES = walk(SRC);

// ── 1. Qaysi sinf qaysi CSS faylda e'lon qilingan ────────────────
const cssFiles = FILES.filter((f) => f.endsWith('.css'));
const classOwners = new Map(); // sinf -> CSS fayllar to'plami
for (const file of cssFiles) {
  const text = readFileSync(file, 'utf8');
  // Selektorlardagi `.sinf-nomi`. Izohlar ichidagi matn ham tushishi
  // mumkin — bu xavfsiz tomonga xato: ortiqcha sinf faqat "bu sinf
  // shu faylda ham bor" deydi, ya'ni tekshiruv yumshoqroq bo'ladi.
  for (const m of text.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) {
    const cls = m[1];
    if (!classOwners.has(cls)) classOwners.set(cls, new Set());
    classOwners.get(cls).add(file);
  }
}

// GLOBAL CSS — `src/main.jsx` dan kelganlari. Ular har doim yuklanadi.
const MAIN = readFileSync(join(SRC, 'main.jsx'), 'utf8');
const globalCss = new Set();
for (const m of MAIN.matchAll(/import\s+'\.\/([\w.-]+\.css)'/g)) {
  globalCss.add(join(SRC, m[1]));
}
// index.css — theme.css ichidan `@import` bilan kelishi mumkin.
for (const file of [...globalCss]) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/@import\s+['"]\.\/([\w.-]+\.css)['"]/g)) {
    globalCss.add(join(SRC, m[1]));
  }
}
if (!globalCss.size) throw new Error('Global CSS topilmadi — test eskirgan.');

// TEKSHIRILADIGAN FAYL — `src/company-system.css`. U eng katta
// "mahalliy" CSS va uch marta xato bergan aynan u.
//
// Nega faqat u: tekshiruv matn bo'yicha ishlaydi va CSS'dan `.sm`,
// `.ok`, `.open` kabi qisqa sinflarni ham ajratib oladi. Bunday
// nomlar JSX'da Tailwind sinflari sifatida ham uchraydi va tekshiruv
// ularda yolg'on ogohlantirish berardi. `company-system.css` dagi
// sinflar esa deyarli hammasi `cw-`, `cq-`, `cp-`, `cc-`, `qp-`,
// `ma-` prefiksli — shovqin yo'q.
const SCOPED = join(SRC, 'company-system.css');
if (!cssFiles.includes(SCOPED)) throw new Error('company-system.css topilmadi — test eskirgan.');

// Sinf FAQAT shu faylda e'lon qilingan bo'lsa — u global emas.
const localOnly = new Map(); // sinf -> uni e'lon qilgan CSS fayllar
for (const [cls, owners] of classOwners) {
  if (!owners.has(SCOPED)) continue;
  if ([...owners].some((o) => globalCss.has(o))) continue;
  localOnly.set(cls, owners);
}
if (localOnly.size < 50) {
  throw new Error(`company-system.css dan atigi ${localOnly.size} sinf ajratildi — ajratish buzilgan.`);
}

// ── 2. Import grafi ──────────────────────────────────────────────
const codeFiles = FILES.filter((f) => /\.jsx?$/.test(f));
const deps = new Map();   // fayl -> import qilingan manba fayllar
const ownCss = new Map(); // fayl -> import qilingan CSS fayllar
for (const file of codeFiles) {
  const text = readFileSync(file, 'utf8');
  const d = new Set(); const c = new Set();
  for (const m of text.matchAll(/(?:import|from)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(file), m[1]);
    if (target.endsWith('.css')) { if (existsSync(target)) c.add(target); continue; }
    for (const cand of [target, `${target}.js`, `${target}.jsx`, join(target, 'index.js')]) {
      if (existsSync(cand) && statSync(cand).isFile()) { d.add(cand); break; }
    }
  }
  deps.set(file, d); ownCss.set(file, c);
}

// Fayl va uning butun bog'liqliklar daraxti: qaysi CSS yuklanadi va
// qaysi sinflar ishlatiladi.
const memo = new Map();
function collect(file, seen = new Set()) {
  if (memo.has(file)) return memo.get(file);
  if (seen.has(file)) return { css: new Set(), uses: new Map() };
  seen.add(file);
  const css = new Set(ownCss.get(file) || []);
  const uses = new Map(); // sinf -> uni ishlatgan fayl
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g)) {
    for (const token of (m[1] || m[2] || m[3] || '').split(/[\s{}$()?:'"`+]+/)) {
      if (token && !uses.has(token)) uses.set(token, file);
    }
  }
  for (const dep of deps.get(file) || []) {
    const sub = collect(dep, seen);
    for (const x of sub.css) css.add(x);
    for (const [k, v] of sub.uses) if (!uses.has(k)) uses.set(k, v);
  }
  const result = { css, uses };
  memo.set(file, result);
  return result;
}

// ── 3. Kirish nuqtalari — sahifalar ──────────────────────────────
const pages = codeFiles.filter((f) => f.includes(`${SRC}/pages/`) && f.endsWith('.jsx'));
if (pages.length < 10) throw new Error(`Atigi ${pages.length} sahifa topildi — test eskirgan.`);

const problems = [];
for (const page of pages) {
  const { css, uses } = collect(page);
  for (const [cls, usedIn] of uses) {
    const owners = localOnly.get(cls);
    if (!owners) continue;                       // global yoki CSS'da yo'q (Tailwind)
    if ([...owners].some((o) => css.has(o))) continue; // kerakli fayl yuklanadi
    problems.push({
      page: relative(ROOT, page),
      cls,
      usedIn: relative(ROOT, usedIn),
      owners: [...owners].map((o) => relative(ROOT, o)).join(', '),
    });
  }
}

if (problems.length) {
  console.error('\nUSLUBSIZ CHIQADIGAN SINFLAR (CSS fayli bu sahifaga yuklanmaydi):\n');
  for (const p of problems) {
    console.error(`  .${p.cls}`);
    console.error(`      ishlatilgan : ${p.usedIn}`);
    console.error(`      sahifa      : ${p.page}`);
    console.error(`      e'lon qilingan: ${p.owners}\n`);
  }
  console.error(
    'Ikki yo\'ldan biri: (1) qoidani GLOBAL faylga (src/theme.css) ko\'chiring —\n'
    + 'sinf bir nechta sahifada ishlatilsa shu to\'g\'ri; (2) sahifada mos CSS ni\n'
    + 'import qiling. Aks holda element brauzerning standart ko\'rinishida chiqadi\n'
    + 'va odam uni tugma deb ham tanimaydi.\n',
  );
  process.exit(1);
}

console.log(`OK — ${pages.length} ta sahifadagi sinflarning hammasiga CSS yetib boradi.`);
