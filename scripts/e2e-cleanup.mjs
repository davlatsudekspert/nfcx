// PRODUKSIYADAGI E2E TEST POSTLARINI TOZALASH
//
// NIMA UCHUN. NOVA ilovasining E2E to'plami haqiqiy profilga (VIP001)
// test postlarini yozadi va o'zidan keyin tozalamaydi. Ular egasining
// ommaviy profilida yig'ilib, mijozga ko'rinadi.
//
// BU SKRIPT SAYT KODIGA KIRMAYDI — u qo'lda, bir martalik ish uchun.
//
// ── XAVFSIZLIK QOIDALARI ────────────────────────────────────────────
//
//   1. STANDART HOLATDA HECH NARSA O'CHIRILMAYDI. Faqat ro'yxat
//      ko'rsatiladi. O'chirish uchun `--apply` YOZISH SHART.
//   2. Faqat E2E to'plami qo'yadigan TO'LIQ izoh shakliga mos
//      obyektlar (scripts/lib/e2e-marker.js — 33 ta tekshiruv bilan
//      qo'riqlanadi). "test" so'zi yetarli emas.
//   3. Faqat SIZ EGASI bo'lgan NFC ID lardagi postlar. Egalik
//      `/api/auth/me` javobidan olinadi, qo'lda yozilmaydi.
//   4. Har bir o'chirishdan OLDIN to'liq nusxa faylga yoziladi
//      (qaytarib tiklash uchun).
//   5. Parol faqat muhit o'zgaruvchisidan olinadi va hech qayerga
//      (log, fayl, xato matni) yozilmaydi.
//
// ── ISHLATISH ───────────────────────────────────────────────────────
//
//   # 1) AVVAL KO'RISH (hech narsa o'chmaydi)
//   NFCSTORE_LOGIN=... NFCSTORE_PASSWORD=... node scripts/e2e-cleanup.mjs
//
//   # 2) Ro'yxatni ko'rib chiqqach, o'chirish
//   NFCSTORE_LOGIN=... NFCSTORE_PASSWORD=... node scripts/e2e-cleanup.mjs --apply
//
import { writeFileSync } from 'node:fs';
import NfcstoreApi from './lib/nfcstore-api.js';
import { isDeletableE2ePost, isE2eTestCaption } from './lib/e2e-marker.js';

const APPLY = process.argv.includes('--apply');
const BASE = process.env.NFCSTORE_BASE || 'https://nfcstore.uz';
const login = process.env.NFCSTORE_LOGIN;
const password = process.env.NFCSTORE_PASSWORD;

if (!login || !password) {
  console.error('NFCSTORE_LOGIN va NFCSTORE_PASSWORD muhit o‘zgaruvchilari kerak.');
  console.error('Parolni buyruq qatoriga YOZMANG — u tarixda qolib ketadi.');
  process.exit(2);
}

const api = new NfcstoreApi({ base: BASE });

console.log(APPLY
  ? '⚠  O‘CHIRISH REJIMI (--apply)'
  : 'KO‘RISH REJIMI — hech narsa o‘chirilmaydi. O‘chirish uchun: --apply');
console.log(`Manzil: ${BASE}\n`);

// ── 1) KIRISH ────────────────────────────────────────────────────────
// Parol faqat shu yerda ishlatiladi va hech qayerga yozilmaydi.
await api.req('POST', '/api/auth/login', { email: login, password });
const me = await api.req('GET', '/api/auth/me');
if (!me?.user?.id) { console.error('Kirish amalga oshmadi.'); process.exit(1); }

const ownedCodes = (me.cards || []).map((c) => c.code).filter(Boolean);
console.log(`Kirildi. Sizga tegishli NFC ID: ${ownedCodes.join(', ') || '(yo‘q)'}\n`);
if (!ownedCodes.length) { console.log('Profil yo‘q — qiladigan ish yo‘q.'); process.exit(0); }

// ── 2) FAQAT O'Z PROFILLARINGIZDAN O'QIYMIZ ──────────────────────────
const candidates = [];
const snapshot = [];
for (const code of ownedCodes) {
  const data = await api.req('GET', `/api/records/${encodeURIComponent(code)}/posts`);
  const posts = (data && data.posts) || [];
  const mine = posts.map((p) => ({ ...p, code }));
  const hit = mine.filter((p) => isDeletableE2ePost(p, ownedCodes));
  console.log(`${code}: ${posts.length} ta post, shundan E2E belgisi bilan ${hit.length} ta`);
  candidates.push(...hit);
  snapshot.push(...mine);
}

if (!candidates.length) {
  console.log('\nE2E test posti topilmadi — qiladigan ish yo‘q.');
  process.exit(0);
}

// ── 3) NIMA O'CHISHINI TO'LIQ KO'RSATAMIZ ────────────────────────────
console.log(`\nO‘chirishga nomzod: ${candidates.length} ta\n`);
for (const p of candidates) {
  console.log(`  [${p.code}] #${p.id}  ${String(p.caption).slice(0, 72)}`);
}

// Ikkinchi qavat himoya: har biri qoidani QAYTA o'tsin.
const unsafe = candidates.filter((p) => !isE2eTestCaption(p.caption));
if (unsafe.length) {
  console.error('\nTO‘XTATILDI: qoidadan o‘tmagan obyekt ro‘yxatga tushdi.');
  process.exit(1);
}

if (!APPLY) {
  console.log('\nHech narsa o‘chirilmadi. Yuqoridagi ro‘yxatni ko‘rib chiqing.');
  console.log('Rozi bo‘lsangiz shu buyruqni `--apply` bilan qayta ishga tushiring.');
  process.exit(0);
}

// ── 4) NUSXA — O'CHIRISHDAN OLDIN ────────────────────────────────────
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
const backup = `e2e-cleanup-backup-${stamp}.json`;
writeFileSync(backup, JSON.stringify({ at: new Date().toISOString(), base: BASE,
  ownedCodes, deleting: candidates, allPosts: snapshot }, null, 2));
console.log(`\nNusxa saqlandi: ${backup}`);

// ── 5) O'CHIRISH ─────────────────────────────────────────────────────
let done = 0; let failed = 0;
for (const p of candidates) {
  try {
    await api.req('DELETE', `/api/posts/${encodeURIComponent(p.id)}`);
    done += 1;
    console.log(`  o‘chirildi  [${p.code}] #${p.id}`);
  } catch (e) {
    failed += 1;
    console.log(`  XATO       [${p.code}] #${p.id} — ${String(e.message).slice(0, 80)}`);
  }
}
console.log(`\nTugadi: ${done} ta o‘chirildi, ${failed} ta xato.`);
console.log(`Qaytarish kerak bo‘lsa nusxa: ${backup}`);
