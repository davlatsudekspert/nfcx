// HAR BIR AndroidManifest.xml YAROQLI XML MI.
//
//   node scripts/test-android-manifests.mjs
//
// ── NIMA UCHUN BU TEST BOR — HAQIQIY XATODAN ──────────────────────
//
// Ilova nomini o'zgartirganda izoh `<application ...>` tegining
// ICHIGA tushib qoldi. `flutter build apk` uni "Error parsing
// LocalFile" bilan rad etdi.
//
// Ikki narsa buni xavfli qiladi:
//
//   1. `flutter analyze` ham, `flutter test` ham manifestni
//      O'QIMAYDI — 519 ta test yashil bo'lib turaverdi;
//   2. eski ilovaning CI'si (`android-apk.yml`) faqat QO'LDA
//      ishga tushadi, ya'ni undagi bir xil xato oylab
//      sezilmasdi. U haqiqatan ham shunday bo'ldi: Nova'da
//      topilgandan keyin tekshirib ko'rilganda, `mobile/` da
//      ham o'sha xato turgan edi.
//
// Tekshiruv repozitoriyadagi HAMMA manifestni topadi — shuning
// uchun u ikkala branchda ham (`mobile/` yolg'iz yoki
// `mobile_nova/` bilan birga) ishlaydi.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { makeChecker } from './lib/d1-harness.mjs';
import { badTagOpens } from './lib/xml-wellformed.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { check, checkTrue, done } = makeChecker();

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'build', '.dart_tool', 'dist', 'archive',
]);

function findManifests(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) findManifests(p, out);
    else if (name === 'AndroidManifest.xml') out.push(p);
  }
  return out;
}

const files = findManifests(ROOT);
console.log(`Topilgan manifestlar: ${files.length} ta`);

// Kamida bittasi bo'lishi SHART — aks holda test jimgina
// hech narsa tekshirmay "o'tib" ketardi.
checkTrue('kamida bitta manifest topildi', files.length >= 1);

for (const f of files) {
  const rel = relative(ROOT, f);
  const bad = badTagOpens(readFileSync(f, 'utf8'));
  if (bad.length) {
    console.log(`\n  ${rel}:`);
    for (const b of bad) console.log(`    ${b}`);
  }
  check(`${rel}`, bad.length, 0);
}

done('AndroidManifest XML');
