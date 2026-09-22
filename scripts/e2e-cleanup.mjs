// PRODUKSIYADAGI E2E TEST IZLARINI TOZALASH
//
// NIMA UCHUN. NOVA ilovasining E2E to'plami haqiqiy profilga (VIP001)
// test obyektlarini yozadi. To'plam o'zidan keyin tozalaydi, lekin
// tozalash XATO BERSA (`Litter.sweep()` faqat hisobotga yozadi va
// davom etadi) obyekt joyida qoladi. Ular egasining ommaviy
// profilida yig'ilib, mijozga ko'rinadi.
//
// 2026-09-22: egasi postda AYNAN shunday qolib ketgan IZOHNI
// ko'rsatdi ("NOVA E2E TEST — DELETE · izoh · ..."). Bu skript o'sha
// paytda faqat POSTLARNI tozalardi — izoh ham, istorya ham
// qamrab olinmagan edi, ya'ni ikkinchi himoya qatlami teshik edi.
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
// Uchala tur ham qamrab olinadi: POST, IZOH va ISTORYA.
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
//
// Har bir nomzod `kind` bilan yuriydi, chunki o'chirish yo'li
// turlicha: post `/api/posts/:id`, izoh `/api/comments/:id`,
// istorya `/api/stories/:id`. Bitta ro'yxat — bitta tasdiqlash
// va bitta zaxira nusxa.
const candidates = [];
const snapshot = [];

const owned = new Set(ownedCodes.map((c) => String(c).toUpperCase()));

for (const code of ownedCodes) {
  const enc = encodeURIComponent(code);

  // ── POSTLAR ────────────────────────────────────────────────────────
  const data = await api.req('GET', `/api/records/${enc}/posts`);
  const posts = (data && data.posts) || [];
  const mine = posts.map((p) => ({ ...p, code }));
  const hitPosts = mine.filter((p) => isDeletableE2ePost(p, ownedCodes));
  candidates.push(...hitPosts.map((p) => ({
    kind: 'post', id: p.id, code, text: p.caption, path: `/api/posts/${encodeURIComponent(p.id)}`,
  })));
  snapshot.push(...mine.map((p) => ({ kind: 'post', ...p })));

  // ── ISTORYALAR ─────────────────────────────────────────────────────
  //
  // Istorya 24 soatdan keyin ko'rinmay qoladi, lekin qatori va
  // fayli darhol o'chmaydi. Markerli istorya — bizniki.
  let stories = [];
  try {
    const sd = await api.req('GET', `/api/records/${enc}/stories`);
    stories = (sd && sd.stories) || [];
  } catch { /* istorya yo'q yoki yopiq — jim o'tamiz */ }
  const hitStories = stories.filter((st) => isE2eTestCaption(st.caption));
  candidates.push(...hitStories.map((st) => ({
    kind: 'istorya', id: st.id, code, text: st.caption, path: `/api/stories/${encodeURIComponent(st.id)}`,
  })));
  snapshot.push(...stories.map((st) => ({ kind: 'istorya', code, ...st })));

  // ── IZOHLAR ────────────────────────────────────────────────────────
  //
  // Izoh POST ichida yashiringan: ro'yxatda ko'rinmaydi, shuning
  // uchun uni faqat har bir postni ochib topish mumkin. Aynan
  // shuning uchun u e'tibordan chetda qolgan edi.
  //
  // IKKI SHART BIRGA, postdagi kabi:
  //   1) matni aynan E2E shaklida;
  //   2) MUALLIFI o'zimiz (`code` bizniki).
  // Ikkinchisisiz begona odam shunday izoh yozib, uni
  // "nomzod" qilib qo'yishi mumkin edi.
  let comments = 0;
  for (const post of mine) {
    let list = [];
    try {
      const cd = await api.req('GET', `/api/comments/post/${encodeURIComponent(post.id)}?limit=50`);
      list = (cd && cd.comments) || [];
    } catch { continue; }
    comments += list.length;
    for (const c of list) {
      if (!isE2eTestCaption(c.body)) continue;
      if (!owned.has(String(c.code || '').toUpperCase())) continue;
      candidates.push({
        kind: 'izoh', id: c.id, code, text: c.body,
        path: `/api/comments/${encodeURIComponent(c.id)}`,
      });
      snapshot.push({ kind: 'izoh', code, postId: post.id, ...c });
    }
  }

  const hit = candidates.filter((x) => x.code === code).length;
  console.log(`${code}: ${posts.length} ta post, ${stories.length} ta istorya, `
    + `${comments} ta izoh — shundan E2E belgisi bilan ${hit} ta`);
}

if (!candidates.length) {
  console.log('\nE2E test izi topilmadi — qiladigan ish yo‘q.');
  process.exit(0);
}

// ── 3) NIMA O'CHISHINI TO'LIQ KO'RSATAMIZ ────────────────────────────
console.log(`\nO‘chirishga nomzod: ${candidates.length} ta\n`);
for (const p of candidates) {
  console.log(`  ${p.kind.padEnd(7)} [${p.code}] #${p.id}  ${String(p.text).slice(0, 64)}`);
}

// Ikkinchi qavat himoya: har biri qoidani QAYTA o'tsin.
const unsafe = candidates.filter((p) => !isE2eTestCaption(p.text));
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
  ownedCodes, deleting: candidates, allItems: snapshot }, null, 2));
console.log(`\nNusxa saqlandi: ${backup}`);

// ── 5) O'CHIRISH ─────────────────────────────────────────────────────
let done = 0; let failed = 0;
for (const p of candidates) {
  try {
    await api.req('DELETE', p.path);
    done += 1;
    console.log(`  o‘chirildi  ${p.kind} [${p.code}] #${p.id}`);
  } catch (e) {
    failed += 1;
    console.log(`  XATO       ${p.kind} [${p.code}] #${p.id} — ${String(e.message).slice(0, 80)}`);
  }
}
console.log(`\nTugadi: ${done} ta o‘chirildi, ${failed} ta xato.`);
console.log(`Qaytarish kerak bo‘lsa nusxa: ${backup}`);
