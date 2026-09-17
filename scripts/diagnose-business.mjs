#!/usr/bin/env node
// BIZNES PROFILI DIAGNOSTIKASI — faqat O'QIYDI.
//
// Savol: `nfcstore.uz/c/nfcstoreuz` mavjud, lekin ilovadagi sinov
// "bu hisobda kompaniya yo'q" dedi. Sabab uchta joydan birida
// bo'lishi mumkin va ular butunlay boshqa narsalar:
//   1. kompaniya umuman yo'q yoki boshqa ID ostida;
//   2. kompaniya bor, lekin bu hisobga BOG'LANMAGAN;
//   3. ikkalasi ham joyida — muammo ILOVADA yoki SINOVDA.
//
// HECH NARSA O'ZGARTIRILMAYDI: faqat GET so'rovlari.
// MAXFIYLIK: login va parol chop etilmaydi.
const BASE = process.env.PROD_BASE || 'https://nfcstore.uz';
const EMAIL = process.env.NFC_LOGIN_EMAIL || '';
const PASSWORD = process.env.NFC_LOGIN_PASSWORD || '';
const SLUG = process.env.BIZ_SLUG || 'nfcstoreuz';

async function req(path, { token, method = 'GET', body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-client': 'android',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let j = null;
  try { j = await r.json(); } catch { /* matn */ }
  return { status: r.status, body: j };
}

async function main() {
  // ── 1. OMMAVIY KOMPANIYA ────────────────────────────────────
  const pub = await req(`/api/companies/${SLUG}`);
  console.log(`OMMAVIY /api/companies/${SLUG}: HTTP ${pub.status}`);
  const c = pub.body?.company ?? pub.body;
  if (pub.status === 200 && c) {
    console.log(`  companyId : ${c.companyId ?? c.id ?? '?'}`);
    console.log(`  nomi      : ${c.displayName ?? c.name ?? '?'}`);
    console.log(`  holati    : ${c.status ?? '?'}`);
  }

  if (!EMAIL || !PASSWORD) {
    console.log('\nHISOB BERILMAGAN — bog‘lanishni tekshirib bo‘lmadi.');
    return;
  }

  // ── 2. HISOB BILAN BOG'LANGANMI ─────────────────────────────
  const login = await req('/api/auth/login', {
    method: 'POST',
    body: { login: EMAIL, password: PASSWORD },
  });
  if (login.status !== 200 || !login.body?.token) {
    console.log(`\nKIRISH XATO: HTTP ${login.status} ${login.body?.error ?? ''}`);
    return;
  }
  const token = login.body.token;
  console.log('\nKIRISH: ok');

  // ILOVA AYNAN SHU YO'LNI CHAQIRADI (`repo.myCompanies`).
  const mine = await req('/api/companies/mine', { token });
  const list = mine.body?.companies ?? [];
  console.log(`MENING KOMPANIYALARIM /api/companies/mine: HTTP ${mine.status}`);
  console.log(`  soni: ${Array.isArray(list) ? list.length : '?'}`);
  for (const x of Array.isArray(list) ? list : []) {
    console.log(`  - ${x.companyId ?? x.id} · ${x.displayName ?? x.name} · ${x.status ?? '?'}`);
  }

  const linked = (Array.isArray(list) ? list : []).some(
    (x) => String(x.companyId ?? x.id ?? '').toLowerCase() === SLUG.toLowerCase(),
  );
  console.log(`\nBOG‘LANGANMI: ${linked ? 'HA' : 'YO‘Q'}`);

  // ── 3. ILOVA SHAXSLAR RO'YXATI ──────────────────────────────
  // Ilova `me()` va `myCompanies()` ni birga o'qiydi va shundan
  // "shaxslar" ro'yxatini yasaydi. Kartalar soni ham muhim:
  // biznes shaxsi ro'yxatda kartalardan KEYIN turadi.
  const me = await req('/api/auth/me', { token });
  console.log(`KARTALAR: ${(me.body?.cards ?? []).length}`);
}

main();
