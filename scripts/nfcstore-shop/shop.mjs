#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// NFCSTORE DO'KONI — YANGI MAHSULOTLAR (egasi, 2026-09-27)
//
// "Oxirgi qilingan stiker, avtostiker, kartalarni rasmlarini NFCSTORE
// do'koniga qo'yib qo'yish kerak, narxini tez kunda deb" — "hammasini
// chiroyli qilib".
//
// ┌─ XAVFSIZLIK ─────────────────────────────────────────────────────┐
// │ • STANDART — DRY RUN. `plan.json` da `"apply": true` bo'lmasa     │
// │   birorta ham yozish so'rovi ketmaydi (faqat kirish va o'qish).  │
// │ • FAQAT O'Z DO'KONIM: hisob `/api/companies/mine` da             │
// │   `companyId` ni ko'rmasa — to'xtaydi.                           │
// │ • MAVJUD MAHSULOT faqat `expectName` mos kelsa o'zgaradi; boshqa │
// │   birov tahrirlagan bo'lsa — to'xtaydi. Hech narsa O'CHIRILMAYDI │
// │   (rollback faqat shu skript QO'SHGANINI o'chiradi).             │
// │ • YOZISHDAN OLDIN SNAPSHOT (artefakt) — rollback uchun.          │
// │ • LOGIN/PAROL faqat muhitdan, hech qayerga chiqmaydi (email ham).│
// │ • "Narxi tez kunda" serverda bo'lmasa (catalogSchema < 3) —      │
// │   yozilmaydi: aks holda saytda "0 so'm" chiqardi.                │
// └──────────────────────────────────────────────────────────────────┘
//
//   NFCSTORE_LOGIN=... NFCSTORE_PASSWORD=... node scripts/nfcstore-shop/shop.mjs
// ═══════════════════════════════════════════════════════════════════════
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { NfcstoreApi } from '../lib/nfcstore-api.js';

const HERE = new URL('.', import.meta.url);
const BASE = process.env.NFCSTORE_BASE || 'https://nfcstore.uz';
const OUT = process.env.SHOP_OUT || 'shop-report';
const SUMMARY = process.env.GITHUB_STEP_SUMMARY || '';

const line = (s = '') => console.log(s);
const rule = (c = '─') => line(c.repeat(74));
const summary = (s) => (SUMMARY ? appendFile(SUMMARY, s + '\n').catch(() => {}) : Promise.resolve());

export async function loadPlan(url = new URL('plan.json', HERE)) {
  const plan = JSON.parse(await readFile(url, 'utf8'));
  const problems = [];
  if (!/^[A-Z0-9]{3,15}$/.test(String(plan.companyId || ''))) problems.push('companyId noto‘g‘ri');
  const all = [...(plan.updates || []), ...(plan.items || [])];
  for (const [i, it] of all.entries()) {
    const name = it.set?.name ?? it.name ?? it.expectName;
    if (!name) problems.push(`#${i}: nom yo‘q`);
    // Yangilashda rasm ixtiyoriy: bo'lmasa mavjud rasmlar qoladi
    // (faqat `dropImages` dagilari olib tashlanadi).
    const needImages = !(plan.updates || []).includes(it);
    if (needImages && (!Array.isArray(it.images) || !it.images.length)) problems.push(`${name}: rasm yo‘q`);
    if ((it.images || []).length > 6) problems.push(`${name}: 6 tadan ko‘p rasm (server 6 tasini saqlaydi)`);
  }
  for (const u of plan.updates || []) {
    if (!u.id || !u.expectName) problems.push(`${u.set?.name ?? u.expectName}: id/expectName yo‘q`);
    if (u.dropImages && !Array.isArray(u.dropImages)) problems.push(`${u.expectName}: dropImages ro‘yxat emas`);
    // `replaceImages`: { "/uploads/eski.png": "img/yangi.jpg" } — o'sha
    // rasmning yengil nusxasi, tartib va muqova saqlanadi.
    if (u.replaceImages && (typeof u.replaceImages !== 'object' || Array.isArray(u.replaceImages))) problems.push(`${u.expectName}: replaceImages obyekt emas`);
    if (u.replaceImages && u.images) problems.push(`${u.expectName}: images va replaceImages birga bo‘lmaydi`);
  }
  const names = all.map((it) => it.set?.name ?? it.name ?? it.expectName);
  if (new Set(names).size !== names.length) problems.push('nomlar takrorlanadi');
  return { plan, problems };
}

async function imageBytes(rel) {
  const url = new URL(rel, HERE);
  const info = await stat(url).catch(() => null);
  if (!info) return null;
  return readFile(url);
}

const mime = (rel) => (/\.png$/i.test(rel) ? 'image/png' : 'image/jpeg');

// Server bir hisobga 15 daqiqada 5 ta kirish beradi (qat'iy oyna; rad
// etilgan urinish hisoblanmaydi). Workflow E2E bilan bitta navbatda,
// lekin oldingi E2E oynani to'ldirib ketgan bo'lishi mumkin — shuning
// uchun 429 da 5 daqiqadan kutib, 4 marta qayta urinamiz: jami 20 daqiqa
// 15 daqiqalik oynadan uzun, ya'ni oyna albatta yangilanadi.
const LOGIN_WAIT_MS = Number(process.env.SHOP_LOGIN_WAIT_MS || 5 * 60_000);
async function loginPatiently(api, email, password, retries = 4) {
  for (let i = 0; ; i++) {
    try {
      return await api.login(email, password);
    } catch (e) {
      if (e.status !== 429 || i >= retries) throw e;
      line(`Kirish chegarasi to‘lgan (429) — ${Math.round(LOGIN_WAIT_MS / 60_000)} daqiqa kutamiz (${i + 1}/${retries}).`);
      await new Promise((r) => setTimeout(r, LOGIN_WAIT_MS));
    }
  }
}

async function main() {
  const { plan, problems } = await loadPlan();
  const APPLY = plan.apply === true;
  rule('═');
  line(`NFCSTORE DO‘KONI — ${APPLY ? 'APPLY (yozadi)' : 'DRY RUN (faqat o‘qiydi)'}`);
  line(`Server: ${BASE} · do‘kon: ${plan.companyId}`);
  rule('═');
  if (problems.length) {
    problems.forEach((p) => line(`REJA XATOSI: ${p}`));
    process.exit(2);
  }

  // 1) Rasmlar joyidami — kirishdan OLDIN.
  const missing = [];
  for (const it of [...(plan.updates || []), ...(plan.items || [])]) {
    for (const rel of [...(it.images || []), ...Object.values(it.replaceImages || {})]) if (!(await imageBytes(rel))) missing.push(rel);
  }
  for (const rel of Object.values(plan.company?.logoReplace || {})) if (!(await imageBytes(rel))) missing.push(rel);
  if (missing.length) {
    missing.forEach((m) => line(`RASM YO‘Q: ${m}`));
    if (APPLY) process.exit(2);
  }

  const email = process.env.NFCSTORE_LOGIN || '';
  const password = process.env.NFCSTORE_PASSWORD || '';
  if (!email || !password) {
    line('XATO: NFCSTORE_LOGIN / NFCSTORE_PASSWORD berilmagan.');
    process.exit(2);
  }
  const api = new NfcstoreApi({ base: BASE });
  await loginPatiently(api, email, password);
  line('Kirildi (hisob ma’lumoti chop etilmaydi).');

  // 2) Egalik — ro'yxat SERVERDAN.
  const mine = await api.myCompanies();
  const owns = (mine?.companies || []).some((c) => c.companyId === plan.companyId);
  line(`${plan.companyId} shu hisobniki: ${owns ? 'HA' : 'YO‘Q'}`);
  await summary(`### NFCSTORE do‘koni — ${APPLY ? 'APPLY' : 'DRY RUN'}\n\n* ${plan.companyId} shu hisobniki: **${owns ? 'HA' : 'YO‘Q'}**`);
  if (!owns) { await api.logout(); process.exit(3); }

  // 3) Joriy katalog va snapshot.
  const { company } = await api.getCompany(plan.companyId);
  const catalog = company?.catalog || [];
  const schema = Number(company?.catalogSchema || 1);
  line(`Katalogda: ${catalog.length} ta · catalogSchema=${schema} (3 = "Narxi tez kunda" bor)`);
  await summary(`* Katalogda hozir: ${catalog.length} ta · catalogSchema=${schema}`);
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/snapshot-before.json`, JSON.stringify({ at: new Date().toISOString(), catalog }, null, 2));

  // 4) Reja jadvali.
  const rows = [];
  const byId = new Map(catalog.map((c) => [String(c.id), c]));
  const byName = new Map(catalog.map((c) => [String(c.name), c]));
  for (const u of plan.updates || []) {
    const cur = byId.get(String(u.id));
    const want = u.set?.name ?? u.expectName;
    const drop = u.dropImages || [];
    let status;
    if (!cur) status = 'TOPILMADI — o‘tkaziladi';
    else if (cur.name !== u.expectName && cur.name !== want) status = `TO‘XTADI: nomi "${cur.name}" (kutilgan "${u.expectName}")`;
    else if (
      cur.name === want && cur.priceSoon
      && (u.set?.description == null || cur.description === u.set.description)
      && !drop.some((x) => (cur.images || []).includes(x))
      && !Object.keys(u.replaceImages || {}).some((x) => (cur.images || []).includes(x) || cur.imageUrl === x)
    ) status = 'allaqachon yangilangan';
    else status = 'YANGILANADI';
    const imgCount = u.images ? u.images.length : (cur?.images || []).filter((x) => !drop.includes(x)).length;
    rows.push({ kind: 'yangilash', name: want, was: cur ? `${cur.name} · ${cur.price ? cur.price + ' so‘m' : 'narxsiz'}` : '—', images: imgCount, status, u, cur });
  }
  for (const it of plan.items || []) {
    const cur = byName.get(it.name);
    rows.push({ kind: 'yangi', name: it.name, was: '—', images: it.images.length, status: cur ? 'mavjud — o‘tkaziladi' : 'QO‘SHILADI', it, cur });
  }
  // Kompaniya logotipi: o'sha rasmning yengil nusxasi (faqat logoUrl
  // yuboriladi — server PATCH'i qolgan maydonlarni saqlaydi).
  const logoSwap = Object.entries(plan.company?.logoReplace || {});
  const logoTodo = logoSwap.filter(([from]) => company?.logoUrl === from);
  for (const [from] of logoSwap) {
    line(`  logotip   │ ${from.slice(-40).padEnd(44)} │ ${company?.logoUrl === from ? 'ALMASHTIRILADI' : 'allaqachon / boshqa logo — tegilmaydi'}`);
  }
  line('');
  for (const r of rows) line(`  ${r.kind.padEnd(9)} │ ${r.name.slice(0, 44).padEnd(44)} │ ${String(r.images).padStart(2)} rasm │ ${r.status}`);
  await summary(['', '| Amal | Mahsulot | Avval | Rasm | Holat |', '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.kind} | ${r.name} | ${r.was} | ${r.images} | ${r.status} |`)].join('\n'));

  const blocked = rows.filter((r) => r.status.startsWith('TO‘XTADI'));
  if (blocked.length) { line('\nKimdir mahsulotni tahrirlagan — hech narsa yozilmadi.'); await api.logout(); process.exit(4); }

  if (!APPLY) {
    line('\nDRY RUN — hech narsa yozilmadi. Yozish uchun plan.json da "apply": true.');
    await summary('\n**DRY RUN — hech narsa yozilmadi.**');
    await api.logout();
    return;
  }
  if (schema < 3) {
    line('\nTO‘XTADI: serverda "Narxi tez kunda" hali yo‘q (catalogSchema < 3). Avval sayt/server deploy.');
    await summary('\n**TO‘XTADI: serverda "Narxi tez kunda" hali yo‘q — avval deploy.**');
    await api.logout();
    process.exit(5);
  }

  // 5) YOZISH. Har rasm bir marta yuklanadi.
  const uploaded = new Map();
  const upload = async (rel) => {
    if (uploaded.has(rel)) return uploaded.get(rel);
    const res = await api.uploadFile(await imageBytes(rel), mime(rel));
    const url = String(res?.url || '');
    if (!url) throw new Error(`rasm manzili qaytmadi: ${rel}`);
    uploaded.set(rel, url);
    return url;
  };
  const report = { at: new Date().toISOString(), created: [], updated: [] };
  for (const r of rows) {
    if (r.status !== 'YANGILANADI' && r.status !== 'QO‘SHILADI') continue;
    const src = r.u || r.it;
    const urls = [];
    for (const rel of src.images || []) urls.push(await upload(rel));
    if (r.u && !r.u.images) {
      // Faqat narx/nom/tavsif (+ ixtiyoriy rasmni olib tashlash): boshqa
      // maydonlarga tegilmaydi — server PATCH'i yuborilmaganini saqlaydi.
      const drop = r.u.dropImages || [];
      const body = { ...(r.u.set || {}), promotionPrice: null, priceSoon: true };
      const swap = r.u.replaceImages || {};
      if (Object.keys(swap).length) {
        const to = new Map();
        for (const [old, rel] of Object.entries(swap)) to.set(old, await upload(rel));
        const cur = (r.cur.images || []).length ? r.cur.images : [r.cur.imageUrl].filter(Boolean);
        body.images = cur.map((x) => to.get(x) || x);
        body.imageUrl = to.get(r.cur.imageUrl) || body.images[0];
      }
      if (drop.length) {
        const keep = (r.cur.images || []).filter((x) => !drop.includes(x));
        if (!keep.length) throw new Error(`${r.name}: hamma rasm olib tashlanardi`);
        body.images = keep;
        body.imageUrl = keep[0];
      }
      await api.patchCatalogItem(plan.companyId, r.u.id, body);
      report.updated.push({ id: r.u.id, restore: pick(r.cur) });
      line(`  ✓ yangilandi: ${r.name}`);
      continue;
    }
    const body = {
      ...(r.u ? r.u.set : { name: r.it.name, category: r.it.category, description: r.it.description }),
      kind: 'product',
      marketCategory: 'electronics',
      price: 0,
      promotionPrice: null,
      priceSoon: true,
      available: true,
      imageUrl: urls[0],
      images: urls,
    };
    if (r.u) {
      await api.patchCatalogItem(plan.companyId, r.u.id, body);
      report.updated.push({ id: r.u.id, restore: pick(r.cur) });
      line(`  ✓ yangilandi: ${body.name}`);
    } else {
      const res = await api.addCatalogItem(plan.companyId, body);
      const made = (res?.company?.catalog || []).find((c) => c.name === body.name);
      report.created.push({ id: made?.id || '', name: body.name });
      line(`  ✓ qo‘shildi: ${body.name}`);
    }
  }
  for (const [from, rel] of logoTodo) {
    const url = await upload(rel);
    await api.patchCompany(plan.companyId, { logoUrl: url });
    report.company = { restore: { logoUrl: from }, logoUrl: url };
    line(`  ✓ logotip almashtirildi: ${url}`);
  }
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));

  // 6) TEKSHIRUV — tashrifchi ko'zi bilan (kirmagan holda).
  const pub = await fetch(`${BASE}/api/companies/${plan.companyId}`, { headers: { accept: 'application/json' } }).then((x) => x.json());
  const want = rows.filter((r) => r.status === 'YANGILANADI' || r.status === 'QO‘SHILADI').map((r) => r.name);
  const bad = want.filter((n) => {
    const c = (pub?.company?.catalog || []).find((x) => x.name === n);
    return !c || !c.priceSoon || !(c.images || []).length;
  });
  const leak = 'ownerEmail' in (pub?.company || {});
  if (report.company && pub?.company?.logoUrl !== report.company.logoUrl) bad.push('logotip saytda yangilanmadi');
  line(`\nTekshiruv: ${want.length - bad.length}/${want.length} mahsulot saytda "Narxi tez kunda" bilan ko‘rinadi.`);
  await summary(`\n* Tekshiruv: **${want.length - bad.length}/${want.length}** mahsulot saytda "Narxi tez kunda" bilan\n* Ochiq javobda egasining emaili: ${leak ? '**BOR (xato)**' : 'yo‘q'}`);
  await api.logout();
  if (bad.length) { bad.forEach((n) => line(`  ✗ ${n}`)); process.exit(6); }
}

// Rollback uchun eski qiymatlar (faqat o'zgartiriladigan maydonlar).
function pick(c) {
  if (!c) return null;
  return {
    name: c.name, category: c.category, description: c.description,
    price: c.price, promotionPrice: c.promotionPrice, kind: c.kind,
    marketCategory: c.marketCategory, imageUrl: c.imageUrl, images: c.images,
    available: c.available, priceSoon: false,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { line(`XATO: ${e.message}`); process.exit(1); });
}
