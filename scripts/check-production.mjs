#!/usr/bin/env node
// ISHLAB TURGAN nfcstore.uz NI TEKSHIRADI.
//
// NIMA UCHUN KERAK: emulyator sinovi ilovani LOKAL server bilan
// yurgizadi — u haqiqiy Worker kodi, lekin PRODUCTIONGA nima
// yoyilganini bilmaydi. Ilova esa telefonda aynan nfcstore.uz ga
// boradi. Ya'ni "lokalda ishladi" — "odamning telefonida ishlaydi"
// degani EMAS: serverga yoyilmagan yangi yo'l ilovada jimgina
// "topilmadi" bo'lib chiqadi.
//
// HECH KIMNING HISOBIGA KIRILMAYDI. Kirish yo'li faqat ATAYLAB
// NOTO'G'RI FORMATDAGI login bilan tekshiriladi ("x") — u server
// tomonida formatda rad etiladi va hech qanday hisobga tegmaydi.
// Haqiqiy email bilan noto'g'ri parol yuborish esa o'sha hisobning
// urinishlarini yeb qo'yardi (15 daqiqada 5 ta) va egasini
// qulflab qo'yishi mumkin edi.
const BASE = process.env.PROD_BASE || 'https://nfcstore.uz';

const results = [];
const add = (ok, name, detail = '') => results.push({ ok, name, detail });

async function req(path, init) {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  let body = null;
  try { body = await r.json(); } catch { /* matn bo'lishi mumkin */ }
  return { status: r.status, body };
}

async function main() {
  // ── LENTA ────────────────────────────────────────────────────
  try {
    const r = await req('/api/feed');
    add(r.status === 200 && Array.isArray(r.body?.posts ?? r.body?.items ?? []),
      'Lenta (/api/feed)', `HTTP ${r.status}`);
  } catch (e) { add(false, 'Lenta (/api/feed)', String(e)); }

  // ── ILOVA CHAQIRADIGAN YO'LLAR ───────────────────────────────
  //
  // MANZILLAR `mobile/lib/data/repo.dart` DAN OLINGAN, prototip
  // matnidan emas. Birinchi urinishda bu ro'yxat taxminan
  // yozilgan edi (`/api/settings/id-pricing`) va u 404 berdi —
  // ya'ni tekshiruv ILOVADA UMUMAN BO'LMAGAN yo'lni "buzuq" deb
  // ko'rsatdi. Taxminiy manzil tekshiruvni foydasiz qiladi.
  for (const [path, name] of [
    ['/api/settings/payments-enabled', 'To‘lov yoqilganmi'],
    ['/api/settings/physical-nfc-pricing', 'Jismoniy karta narxi'],
    ['/api/records', 'Ommaviy katalog'],
    ['/api/companies', 'Kompaniyalar'],
    ['/api/categories', 'Sohalar'],
    ['/api/stories/feed', 'Istoryalar lentasi'],
  ]) {
    try {
      const r = await req(path);
      // 401 — yo'l BOR, faqat kirish talab qiladi. Bu nosozlik emas.
      add(r.status === 200 || r.status === 401, `${name} (${path})`,
        `HTTP ${r.status}`);
    } catch (e) { add(false, `${name} (${path})`, String(e)); }
  }

  // ── KIRISH YO'LI TIRIKMI ─────────────────────────────────────
  // Format xatosi 422 `bad_login` beradi — bu yo'l ishlayotganining
  // isboti va hech qanday hisobga tegmaydi.
  try {
    const r = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: 'x', password: 'x' }),
    });
    add(r.status === 422 && r.body?.error === 'bad_login',
      'Kirish yo‘li (/api/auth/login)', `HTTP ${r.status} ${r.body?.error ?? ''}`);
  } catch (e) { add(false, 'Kirish yo‘li', String(e)); }

  // ── RO'YXATDAN O'TISH YO'LI TIRIKMI ──────────────────────────
  // Bo'sh so'rov — server tekshiruvi ishlaydimi. 404 bo'lsa, yo'l
  // umuman yo'q degani.
  try {
    const r = await req('/api/auth/request-register-code', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    add(r.status !== 404,
      'Ro‘yxatdan o‘tish yo‘li (/api/auth/request-register-code)',
      `HTTP ${r.status}`);
  } catch (e) { add(false, 'Ro‘yxatdan o‘tish yo‘li', String(e)); }

  // ── BO'SH KOD NARXI ──────────────────────────────────────────
  // Bu YANGI yo'l. Serverga yoyilmagan bo'lsa, do'konda "narxi
  // qancha?" savoli ilovada javobsiz qoladi.
  try {
    const r = await req('/api/records/ZZQ8W41/quote');
    add(r.status === 200,
      'Bo‘sh kod narxi (/api/records/:code/quote)',
      r.status === 404
        ? 'HTTP 404 — SERVERGA HALI YOYILMAGAN: do‘konda "narxi qancha?" javobsiz qoladi'
        : `HTTP ${r.status}`);
  } catch (e) { add(false, 'Bo‘sh kod narxi', String(e)); }

  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  console.log(`\nPRODUCTION: ${BASE}\n`);
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'}  ${pad(r.name, 48)} ${r.detail}`);
  }
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} o‘tdi\n`);
  if (bad.length) process.exitCode = 1;
}

main();
