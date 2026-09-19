#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// NFCSTORE — O'Z PROFILLARIMNI DEMO BILAN TO'LDIRISH (bir martalik)
//
// MAQSAD. Hisobga tegishli BO'SH NFC profillarni va biznes/kompaniya
// sahifalarini ko'rgazma uchun ko'rinadigan holatga keltirish.
//
// ┌─ XAVFSIZLIK ─────────────────────────────────────────────────────┐
// │ • STANDART HOLAT — DRY RUN. `--apply` yozilmasa, birorta ham      │
// │   yozish so'rovi yuborilmaydi. Buni test ham qo'riqlaydi.        │
// │ • FAQAT O'Z PROFILLARIM. Ro'yxat serverdan (`/api/auth/me`,      │
// │   `/api/companies/mine`) olinadi. Begona narsa uchrasa — TO'XTAB │
// │   qolinadi. Server ham o'z tomonidan 403 qaytaradi; bu ikkinchi  │
// │   qavat, birinchisining o'rnini bosmaydi.                        │
// │ • YOZISHDAN OLDIN SNAPSHOT. Har bir tegiladigan obyektning joriy │
// │   holati faylga saqlanadi va `--rollback` bilan qaytariladi.     │
// │ • FAQAT BO'SH MAYDON TO'LDIRILADI (qarang: lib/demo-plan.js).    │
// │ • ALOQA MA'LUMOTI TO'QILMAYDI: telefon, email, Instagram,        │
// │   Telegram, sayt, manzil — bo'sh bo'lsa bo'sh qoladi.            │
// │ • TO'LOV/BUYURTMAGA UMUMAN TEGILMAYDI.                           │
// └──────────────────────────────────────────────────────────────────┘
//
// FOYDALANISH
//   export NFCSTORE_LOGIN='...'        # email
//   export NFCSTORE_PASSWORD='...'
//
//   node scripts/demo-fill.mjs                       # DRY RUN (standart)
//   node scripts/demo-fill.mjs --apply               # haqiqatan yozadi
//   node scripts/demo-fill.mjs --only=VIP001,TTS075  # faqat sanab o'tilganlar
//   node scripts/demo-fill.mjs --skip=VIP001         # tegilmaydiganlar
//   node scripts/demo-fill.mjs --rollback=backups/nfcstore-demo-before-....json
//
// Parol hech qayerga — logga, faylga, xato matniga — chiqmaydi.
// ═══════════════════════════════════════════════════════════════════════
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { NfcstoreApi } from './lib/nfcstore-api.js';
import { planPersonal, planCompany, filterOwned } from './lib/demo-plan.js';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const a = args.find((x) => x.startsWith(f + '='));
  return a ? a.slice(f.length + 1) : '';
};
const list = (f) => val(f).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

const APPLY = has('--apply');
const BASE = val('--base') || process.env.NFCSTORE_BASE || 'https://nfcstore.uz';
const ONLY = list('--only');
const SKIP = list('--skip');
const ROLLBACK = val('--rollback');

// ── Chiqish formatlash ───────────────────────────────────────────────
const line = (s = '') => console.log(s);
const rule = (c = '─') => line(c.repeat(74));
function table(rows, heads) {
  if (!rows.length) { line('  (yo‘q)'); return; }
  const all = [heads, ...rows];
  const w = heads.map((_, i) => Math.min(42, Math.max(...all.map((r) => String(r[i] ?? '').length))));
  const fmt = (r) => '  ' + r.map((c, i) => String(c ?? '').slice(0, w[i]).padEnd(w[i])).join('  │  ');
  line(fmt(heads));
  line('  ' + w.map((x) => '─'.repeat(x)).join('──┼──'));
  rows.forEach((r) => line(fmt(r)));
}

function statusOf(cur, fields) {
  const filled = fields.filter((f) => {
    const v = cur[f];
    return Array.isArray(v) ? v.length > 0 : String(v ?? '').trim() !== '';
  }).length;
  return `${filled}/${fields.length} to‘ldirilgan`;
}

// ═══ ROLLBACK ════════════════════════════════════════════════════════
// Snapshot faylidagi HOLATNI qaytaradi. Bu ham yozish amali, shuning
// uchun u ham `--apply` talab qiladi: tasodifan qaytarib yuborilmasin.
async function rollback(api, file) {
  const snap = JSON.parse(await readFile(file, 'utf8'));
  line(`ROLLBACK manbai: ${file}`);
  line(`Yaratilgan: ${snap.createdAt}`);
  line(`Tiklanadi: ${snap.personal.length} shaxsiy, ${snap.companies.length} kompaniya`);
  if (!APPLY) { line('\nDRY RUN — hech narsa yozilmadi. Haqiqiy tiklash uchun: --apply'); return; }

  line('\nAPPLY MODE: owned profiles only');
  for (const p of snap.personal) {
    await api.putRecord(p.code, p.record);
    line(`  ✓ ${p.code} tiklandi`);
  }
  for (const c of snap.companies) {
    await api.patchCompany(c.id, {
      description: c.company.description ?? '',
      subcategory: c.company.subcategory ?? '',
    });
    // Skript qo'shgan katalog elementlari o'chiriladi (ular snapshotda
    // `addedCatalogIds` sifatida qayd etilgan).
    for (const itemId of c.addedCatalogIds || []) {
      await api.deleteCatalogItem(c.id, itemId).catch(() => null);
    }
    line(`  ✓ ${c.id} tiklandi (${(c.addedCatalogIds || []).length} demo mahsulot o‘chirildi)`);
  }
  line('\nRollback tugadi.');
}

// ═══ ASOSIY OQIM ═════════════════════════════════════════════════════
async function main() {
  const email = process.env.NFCSTORE_LOGIN || '';
  const password = process.env.NFCSTORE_PASSWORD || '';
  if (!email || !password) {
    line('XATO: NFCSTORE_LOGIN va NFCSTORE_PASSWORD muhit o‘zgaruvchilari kerak.');
    line('  export NFCSTORE_LOGIN=\'...\'');
    line('  export NFCSTORE_PASSWORD=\'...\'');
    process.exit(2);
  }

  const api = new NfcstoreApi({ base: BASE });
  rule('═');
  line(`NFCSTORE DEMO TO‘LDIRISH — ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  line(`Server: ${BASE}`);
  rule('═');

  // Parol faqat shu chaqiruvda; hech qayerda saqlanmaydi.
  await api.login(email, password);
  const me = await api.me();
  line(`Kirildi. Hisob: ${me?.user?.email ? me.user.email.replace(/(.{2}).*(@.*)/, '$1***$2') : '(noma’lum)'}`);

  if (ROLLBACK) return rollback(api, ROLLBACK);

  // ── 1) O'Z OBYEKTLARIM (ro'yxat SERVERDAN) ──────────────────────
  const myCards = Array.isArray(me?.cards) ? me.cards : [];
  const ownedCodes = myCards.map((c) => String(c.code).toUpperCase());
  const companiesRes = await api.myCompanies().catch((e) => {
    line(`\nOGOHLANTIRISH: /api/companies/mine ochilmadi (${e.status || '?'}) — kompaniyalar bo‘limi o‘tkazib yuboriladi.`);
    return { companies: [] };
  });
  const myCompanies = Array.isArray(companiesRes?.companies) ? companiesRes.companies : [];

  line(`Serverdan: ${myCards.length} NFC ID, ${myCompanies.length} kompaniya.`);

  // Ikkinchi qavat himoya: ro'yxatdan tashqari narsa bo'lsa TO'XTAYMIZ.
  const { foreign } = filterOwned(myCards, ownedCodes, (c) => c.code);
  if (foreign.length) {
    line(`\nTO‘XTATILDI: egalik ro‘yxatida nomuvofiqlik (${foreign.length} ta). Hech narsa yozilmadi.`);
    process.exit(3);
  }

  const wanted = (code) => (!ONLY.length || ONLY.includes(code)) && !SKIP.includes(code);

  // ── 2) SHAXSIY PROFILLAR ────────────────────────────────────────
  const personalPlans = [];
  const personalRows = [];
  const unchanged = [];
  const blocked = [];

  for (const card of myCards) {
    const code = String(card.code).toUpperCase();
    if (!wanted(code)) { unchanged.push([code, 'shaxsiy', '--only/--skip bilan chetlatildi']); continue; }
    let cur;
    try {
      cur = await api.getRecord(code);
    } catch (e) {
      blocked.push([code, 'shaxsiy', `o‘qib bo‘lmadi (${e.status || '?'})`]);
      continue;
    }
    const plan = planPersonal(cur);
    if (plan.skipped) { unchanged.push([code, 'shaxsiy', plan.reason]); continue; }
    personalPlans.push({ plan, current: cur });
    personalRows.push([
      code,
      statusOf(cur, ['name', 'role', 'about', 'avatarUrl', 'bgUrl', 'hashtags']),
      plan.changes.map((c) => c.field).join(', '),
      plan.directionInferred ? plan.direction : 'neytral (aniqlanmadi)',
    ]);
  }

  // ── 3) BIZNES / KOMPANIYALAR ────────────────────────────────────
  const companyPlans = [];
  const companyRows = [];

  for (const co of myCompanies) {
    const id = String(co.companyId || co.company_id || co.id || '');
    if (!wanted(id)) { unchanged.push([id, 'kompaniya', '--only/--skip bilan chetlatildi']); continue; }
    // To'liq (shu jumladan katalog) holatni alohida olamiz.
    let cur = co;
    try {
      const full = await api.getCompany(id);
      cur = full?.company || full || co;
    } catch { /* ro'yxatdagi qisqa yozuv bilan davom etamiz */ }

    const plan = planCompany(cur);
    if (plan.skipped) { unchanged.push([id, 'kompaniya', plan.reason]); continue; }
    companyPlans.push({ plan, current: cur });
    companyRows.push([
      id,
      statusOf(cur, ['displayName', 'description', 'subcategory', 'logoUrl', 'coverUrl']),
      plan.changes.map((c) => c.field).join(', ') || '(faqat katalog)',
      plan.catalogSkipped ? 'katalog to‘la — tegilmaydi' : `${plan.catalog.length} demo mahsulot`,
    ]);
  }

  // ── 4) HISOBOT ──────────────────────────────────────────────────
  line('');
  rule();
  line('PERSONAL');
  rule();
  table(personalRows, ['code', 'hozirgi holat', 'rejalashtirilgan', 'yo‘nalish']);

  line('');
  rule();
  line('BUSINESS / COMPANY');
  rule();
  table(companyRows, ['id', 'hozirgi holat', 'rejalashtirilgan', 'demo katalog']);

  line('');
  rule();
  line('UNCHANGED');
  rule();
  table(unchanged, ['id', 'tur', 'sabab']);

  line('');
  rule();
  line('BLOCKED');
  rule();
  table(blocked, ['id', 'tur', 'sabab']);

  // ── 5) RASM MANIFESTI ───────────────────────────────────────────
  // Skript tashqi tasodifiy URL QO'YMAYDI. Kerakli rasmlar shu yerda
  // ro'yxatlanadi; ular alohida tayyorlanib `/api/upload` orqali
  // yuklanadi.
  const media = [
    ...personalPlans.flatMap((p) => p.plan.media),
    ...companyPlans.flatMap((p) => p.plan.media),
  ];
  line('');
  rule();
  line(`MEDIA MANIFEST (${media.length} ta rasm kerak — skript o‘zi qo‘ymaydi)`);
  rule();
  table(media.map((m) => [m.target, m.kind, m.size, m.hint]), ['obyekt', 'tur', 'o‘lcham', 'tavsiya']);

  // ── 6) YOZISH ───────────────────────────────────────────────────
  if (!APPLY) {
    line('');
    rule('═');
    line('DRY RUN — HECH NARSA YOZILMADI.');
    line(`Yozish so‘rovlari: 0 (jami ${api.calls.length} ta so‘rov, hammasi o‘qish).`);
    line('Haqiqatan yozish uchun: node scripts/demo-fill.mjs --apply');
    rule('═');
    await api.logout();
    return;
  }

  line('');
  rule('═');
  line('APPLY MODE: owned profiles only');
  rule('═');

  // Snapshot — YOZISHDAN OLDIN.
  const ts = new Date().toISOString().replace(/[:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6})/, '$1-$2');
  const snapPath = `backups/nfcstore-demo-before-${ts}.json`;
  const snapshot = {
    createdAt: new Date().toISOString(),
    base: BASE,
    personal: personalPlans.map((p) => ({ code: p.plan.code, record: p.current })),
    companies: companyPlans.map((p) => ({
      id: p.plan.id,
      company: p.current,
      addedCatalogIds: [],
    })),
  };
  await mkdir('backups', { recursive: true });
  await writeFile(snapPath, JSON.stringify(snapshot, null, 2));
  line(`Snapshot: ${snapPath}`);
  line('');

  let wrote = 0;
  for (const { plan } of personalPlans) {
    try {
      await api.putRecord(plan.code, plan.body);
      wrote += 1;
      line(`  ✓ ${plan.code}: ${plan.changes.map((c) => c.field).join(', ')}`);
    } catch (e) {
      line(`  ✗ ${plan.code}: ${e.code || e.status || e.message}`);
    }
  }
  for (const { plan } of companyPlans) {
    const rec = snapshot.companies.find((c) => c.id === plan.id);
    if (plan.patch) {
      try {
        await api.patchCompany(plan.id, plan.patch);
        wrote += 1;
        line(`  ✓ ${plan.id}: ${plan.changes.map((c) => c.field).join(', ')}`);
      } catch (e) {
        line(`  ✗ ${plan.id}: ${e.code || e.status || e.message}`);
      }
    }
    for (const item of plan.catalog) {
      try {
        const res = await api.addCatalogItem(plan.id, item);
        wrote += 1;
        // Rollback uchun yangi element id'sini eslab qolamiz.
        const cat = res?.company?.catalog || [];
        const added = cat.find((x) => x.name === item.name);
        if (added?.id && rec) rec.addedCatalogIds.push(added.id);
        line(`  ✓ ${plan.id} · ${item.name}`);
      } catch (e) {
        line(`  ✗ ${plan.id} · ${item.name}: ${e.code || e.status || e.message}`);
      }
    }
  }

  // Snapshotni yangilangan katalog id'lari bilan qayta yozamiz —
  // aks holda rollback demo mahsulotlarni topa olmasdi.
  await writeFile(snapPath, JSON.stringify(snapshot, null, 2));

  line('');
  rule('═');
  line(`Tugadi. ${wrote} ta yozish amali bajarildi.`);
  line(`Rollback: node scripts/demo-fill.mjs --rollback=${snapPath} --apply`);
  rule('═');
  await api.logout();
}

main().catch((e) => {
  // Xato matnida so'rov tanasi (ya'ni parol) YO'Q — qarang:
  // lib/nfcstore-api.js dagi `req()`.
  console.error('XATO:', e.message);
  process.exit(1);
});
