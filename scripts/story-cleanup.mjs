// VIP001 (VA BOSHQA O'Z PROFILLARINGIZ) STORYLARINI TOZALASH
//
// HOLAT. Profilda 10 ta faol story bor va 10 talik chegaraga
// urilyapti — yangi story qo'shib bo'lmayapti.
//
// AVVAL SHUNI BILING. Storyni KABINETDAN o'chirish mumkin:
//   nfcstore.uz/account -> Stories bo'limi ({n}/10 hisoblagichi bilan)
// Bu skript o'sha ishning AVTOMATIK va ISBOTLI varianti — bir nechta
// profilda ko'p story bo'lsa qulay.
//
// ── XAVFSIZLIK QOIDALARI ────────────────────────────────────────────
//
//   1. STANDART HOLATDA HECH NARSA O'CHIRILMAYDI. Faqat ro'yxat.
//      O'chirish uchun `--apply` YOZISH SHART.
//   2. Faqat IKKI TOIFA o'chiriladi:
//        a) muddati o'tganlar (`expiresAt <= hozir`);
//        b) E2E test storysi — TO'LIQ marker shakli bilan
//           (scripts/lib/e2e-marker.js, 50 ta tekshiruv bilan
//           qo'riqlanadi). "test" so'zi YETARLI EMAS.
//      Haqiqiy, muddati o'tmagan storyga TEGILMAYDI.
//   3. Faqat SIZ EGASI bo'lgan NFC ID lar. Egalik `/api/auth/me`
//      dan olinadi, qo'lda yozilmaydi.
//   4. O'chirishdan OLDIN to'liq nusxa faylga yoziladi.
//   5. Parol faqat muhit o'zgaruvchisidan va hech qayerga yozilmaydi.
//   6. 10 talik chegaraga TEGILMAYDI — u serverda qoladi.
//
// ── ISHLATISH ───────────────────────────────────────────────────────
//
//   # 1) KO'RISH (hech narsa o'chmaydi) — 1-band uchun ro'yxat
//   NFCSTORE_LOGIN=... NFCSTORE_PASSWORD=... node scripts/story-cleanup.mjs
//
//   # 2) Ro'yxatni ko'rib chiqqach
//   NFCSTORE_LOGIN=... NFCSTORE_PASSWORD=... node scripts/story-cleanup.mjs --apply
//
//   # Faqat bitta profil
//   ... node scripts/story-cleanup.mjs --code VIP001
//
import { writeFileSync } from 'node:fs';
import NfcstoreApi from './lib/nfcstore-api.js';
import { isDeletableE2eStory, isE2eTestCaption, isExpired } from './lib/e2e-marker.js';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const onlyCode = (() => { const i = argv.indexOf('--code'); return i >= 0 ? (argv[i + 1] || '').toUpperCase() : ''; })();
const BASE = process.env.NFCSTORE_BASE || 'https://nfcstore.uz';
const login = process.env.NFCSTORE_LOGIN;
const password = process.env.NFCSTORE_PASSWORD;

if (!login || !password) {
  console.error('NFCSTORE_LOGIN va NFCSTORE_PASSWORD muhit o‘zgaruvchilari kerak.');
  console.error('Parolni buyruq qatoriga YOZMANG — u tarixda qolib ketadi.');
  process.exit(2);
}

const api = new NfcstoreApi({ base: BASE });
const fmt = (s) => (s ? String(s).replace('T', ' ').replace(/\.\d+Z?$/, '') : '—');

console.log(APPLY ? '⚠  O‘CHIRISH REJIMI (--apply)' : 'KO‘RISH REJIMI — hech narsa o‘chirilmaydi.');
console.log(`Manzil: ${BASE}\n`);

await api.req('POST', '/api/auth/login', { email: login, password });
const me = await api.req('GET', '/api/auth/me');
if (!me?.user?.id) { console.error('Kirish amalga oshmadi.'); process.exit(1); }

let codes = (me.cards || []).map((c) => c.code).filter(Boolean);
if (onlyCode) {
  if (!codes.map((c) => c.toUpperCase()).includes(onlyCode)) {
    console.error(`${onlyCode} sizga tegishli emas. Sizniki: ${codes.join(', ')}`);
    process.exit(1);
  }
  codes = [onlyCode];
}
console.log(`Kirildi. Tekshiriladigan NFC ID: ${codes.join(', ') || '(yo‘q)'}\n`);

const now = Date.now();
const all = [];
const toDelete = [];
let beforeCount = 0;

for (const code of codes) {
  const data = await api.req('GET', `/api/records/${encodeURIComponent(code)}/stories`);
  const stories = ((data && data.stories) || []).map((s) => ({ ...s, code }));
  beforeCount += stories.length;
  all.push(...stories);

  console.log(`── ${code}: API ${stories.length} ta story qaytardi ──`);
  console.log('   id      yaratilgan           tugaydi              tur    holat');
  for (const s of stories) {
    const expired = isExpired(s, now);
    const e2e = isDeletableE2eStory(s, codes);
    const kind = s.videoUrl ? 'video' : s.imageUrl ? 'rasm ' : 'YO‘Q ';
    const state = expired ? 'MUDDATI O‘TGAN' : e2e ? 'E2E TEST' : 'haqiqiy — tegilmaydi';
    console.log(`   ${String(s.id).padEnd(7)} ${fmt(s.createdAt).padEnd(20)} ${fmt(s.expiresAt).padEnd(20)} ${kind}  ${state}`);
    if (expired || e2e) toDelete.push({ ...s, reason: expired ? 'expired' : 'e2e' });
  }
  console.log('');
}

const expiredCount = toDelete.filter((s) => s.reason === 'expired').length;
const e2eCount = toDelete.filter((s) => s.reason === 'e2e').length;

console.log(`JAMI: ${beforeCount} ta (API ko‘rsatgan)`);
console.log(`  muddati o‘tgan : ${expiredCount}`);
console.log(`  E2E test       : ${e2eCount}`);
console.log(`  haqiqiy        : ${beforeCount - expiredCount - e2eCount}  <- TEGILMAYDI`);

// IZOH. API muddati o'tgan storyni UMUMAN qaytarmaydi (server
// `expires_at > now` bilan filtrlaydi va yangi story qo'shilganda
// eskilarini o'chiradi). Shuning uchun "muddati o'tgan" soni deyarli
// har doim 0 bo'ladi — bu XATO EMAS, aksincha 24 soatlik qoida
// ishlayotganining dalili.
if (!expiredCount) {
  console.log('\nIZOH: muddati o‘tgan story ko‘rinmadi — bu kutilgan hol.');
  console.log('      Server ularni ro‘yxatga ham qo‘shmaydi, 10 talik chegaraga ham.');
}

if (!toDelete.length) {
  console.log('\nO‘chirishga narsa yo‘q. Hamma story haqiqiy va muddati o‘tmagan.');
  console.log('Joy bo‘shatish uchun kabinetdan o‘zingiz tanlab o‘chiring:');
  console.log(`  ${BASE}/account  ->  Stories`);
  process.exit(0);
}

// Ikkinchi qavat himoya.
const unsafe = toDelete.filter((s) => s.reason === 'e2e' && !isE2eTestCaption(s.caption));
if (unsafe.length) { console.error('\nTO‘XTATILDI: qoidadan o‘tmagan obyekt ro‘yxatga tushdi.'); process.exit(1); }

if (!APPLY) {
  console.log(`\n${toDelete.length} ta nomzod. Hech narsa o‘chirilmadi.`);
  console.log('Rozi bo‘lsangiz shu buyruqni `--apply` bilan qayta ishga tushiring.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
const backup = `story-cleanup-backup-${stamp}.json`;
writeFileSync(backup, JSON.stringify({ at: new Date().toISOString(), base: BASE, codes,
  deleting: toDelete, allStories: all }, null, 2));
console.log(`\nNusxa saqlandi: ${backup}`);

let done = 0; let failed = 0;
for (const s of toDelete) {
  try {
    await api.req('DELETE', `/api/stories/${encodeURIComponent(s.id)}`);
    done += 1;
    console.log(`  o‘chirildi  [${s.code}] #${s.id} (${s.reason})`);
  } catch (e) {
    failed += 1;
    console.log(`  XATO       [${s.code}] #${s.id} — ${String(e.message).slice(0, 80)}`);
  }
}

// ── CLEANUPDAN KEYIN QAYTA TEKSHIRUV ─────────────────────────────────
let afterCount = 0;
for (const code of codes) {
  const data = await api.req('GET', `/api/records/${encodeURIComponent(code)}/stories`);
  const n = ((data && data.stories) || []).length;
  afterCount += n;
  console.log(`  ${code}: endi ${n} ta faol story`);
}

console.log(`\nTugadi: ${done} ta o‘chirildi, ${failed} ta xato.`);
console.log(`Oldin: ${beforeCount}  ->  Endi: ${afterCount}  (bo‘sh joy: ${Math.max(0, 10 - afterCount)})`);
console.log(`Qaytarish kerak bo‘lsa nusxa: ${backup}`);
