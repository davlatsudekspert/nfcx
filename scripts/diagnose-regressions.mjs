#!/usr/bin/env node
// UCHTA REGRESSIYANI PRODUCTIONDA ANIQLASH — FAQAT O'QIYDI.
//
// Egasining shikoyati uchta:
//   1. biznes profillar ilovada ko'rinmay qoldi;
//   2. do'kondagi ID qidiruv umuman ishlamayapti;
//   3. Reels izohlari HTTP 404 beradi.
//
// Ularning qaysi biri ILOVA xatosi, qaysi biri SERVERGA
// YOYILMAGAN yo'l ekanini faqat jonli sayt ayta oladi. Bu skript
// shuni so'raydi va javobni xom holida chop etadi.
//
// HECH NARSA O'ZGARTIRILMAYDI: hamma so'rov GET. Yagona POST —
// kirishning o'zi, u ham Secret'dagi hisob bilan.
const BASE = process.env.PROD_BASE || 'https://nfcstore.uz';
const EMAIL = process.env.NFC_LOGIN_EMAIL || '';
const PASSWORD = process.env.NFC_LOGIN_PASSWORD || '';

async function req(path, { token, method = 'GET', body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* matn */ }
  return { status: r.status, body: data };
}

const line = (s) => console.log(s);
const head = (s) => { line(''); line('─'.repeat(64)); line(s); line('─'.repeat(64)); };

async function main() {
  head('0. KIRISH');
  if (!EMAIL || !PASSWORD) {
    line('Hisob Secret\'lari yo‘q — faqat ochiq yo‘llar tekshiriladi.');
  }

  let token = '';
  if (EMAIL && PASSWORD) {
    const r = await req('/api/auth/login', {
      method: 'POST',
      body: { login: EMAIL, password: PASSWORD },
    });
    if (r.status === 200 && r.body?.token) {
      token = r.body.token;
      line('kirish: OK');
    } else {
      line(`kirish: XATO HTTP ${r.status} ${r.body?.error ?? ''}`);
    }
  }

  // ── 1. BIZNES PROFILLAR ─────────────────────────────────────
  head('1. BIZNES PROFILLAR — /api/companies/mine');
  if (token) {
    const mine = await req('/api/companies/mine', { token });
    line(`HTTP ${mine.status}`);
    const list = mine.body?.companies ?? mine.body;
    if (Array.isArray(list)) {
      line(`soni: ${list.length}`);
      for (const c of list) {
        line(`  - id=${c.companyId ?? c.id ?? '?'} nom="${c.displayName ?? c.name ?? '?'}" holat=${c.status ?? '?'}`);
      }
      if (list.length === 0) line('  >>> RO‘YXAT BO‘SH — ilova ham shuni ko‘radi.');
      // Ilova `Company.fromJson` uchun `companyId` NI TALAB QILADI.
      const missing = list.filter((c) => !(c.companyId ?? c.id));
      if (missing.length) line(`  >>> ${missing.length} ta yozuvda companyId YO‘Q — ilova ularni o‘qiy olmaydi.`);
    } else {
      line(`  >>> JAVOB SHAKLI KUTILGANDEK EMAS: ${JSON.stringify(mine.body)?.slice(0, 300)}`);
    }

    const me = await req('/api/me', { token });
    line(`/api/me: HTTP ${me.status}, kartalar: ${(me.body?.cards ?? []).length}`);
  } else {
    line('token yo‘q — o‘tkazib yuborildi.');
  }

  // ── 2. ID QIDIRUV / NARX ────────────────────────────────────
  head('2. DO‘KON — ID qidiruv va narx');
  const catalog = await req('/api/records');
  const rows = Array.isArray(catalog.body) ? catalog.body : (catalog.body?.records ?? []);
  line(`/api/records: HTTP ${catalog.status}, soni: ${Array.isArray(rows) ? rows.length : '?'}`);

  // Ilova ikkita savol beradi: kod kimdadir bo'lsa — kimda
  // (`/api/records/:code`), bo'sh bo'lsa — qanchaga (`/quote`).
  const probes = ['VIP001', 'ABZ007', 'GLD100', 'AAA111', 'ZZZ999'];
  for (const code of probes) {
    const rec = await req(`/api/records/${code}`);
    const q = await req(`/api/records/${code}/quote`);
    line(`  ${code.padEnd(8)} record=HTTP ${rec.status}  quote=HTTP ${q.status}` +
      (q.status === 200 ? ` (${q.body?.amount ?? '?'} so‘m, ${q.body?.tier ?? '?'})` : ''));
  }
  line('');
  line('IZOH: quote 404 bo‘lsa — /api/records/:code/quote SERVERGA');
  line('YOYILMAGAN. Ilova bo‘sh kodning narxini ko‘rsata olmaydi va');
  line('"topilmadi" deb chiqaradi. Bu ilova xatosi EMAS.');

  // ── 3. IZOHLAR ──────────────────────────────────────────────
  head('3. IZOHLAR — Reels/post ostidagi varaqa');
  const feed = await req('/api/feed');
  const items = feed.body?.feed ?? feed.body?.items ?? feed.body?.posts ?? [];
  line(`/api/feed: HTTP ${feed.status}, elementlar: ${Array.isArray(items) ? items.length : '?'}`);
  const first = Array.isArray(items) ? items.find((e) => e.kind === 'post') ?? items[0] : null;
  if (first) {
    const kind = first.commentKind || (first.kind === 'story' ? 'story' : 'post');
    const id = first.id;
    line(`sinov elementi: kind=${kind} id=${id}`);
    for (const p of [`/api/comments/${kind}/${id}`, `/api/comments?kind=${kind}&id=${id}`]) {
      const c = await req(p);
      line(`  GET ${p} → HTTP ${c.status}`);
    }
  } else {
    line('lentada element yo‘q — izohni tekshirib bo‘lmadi.');
  }
  line('');
  line('IZOH: 404 bo‘lsa — hosting/api/comments.js SERVERGA yoyilmagan.');
  line('U shu branchda bor, `main` da YO‘Q.');

  head('XULOSA');
  line('Yuqoridagi HTTP kodlari qaysi muammo ILOVADA, qaysi biri');
  line('SERVERDA ekanini ko‘rsatadi. 404 — yo‘l yo‘q (yoyish kerak).');
  line('200 lekin bo‘sh — ma\'lumot yo‘q. 401/403 — huquq masalasi.');
}

main().catch((e) => {
  console.error('DIAGNOSTIKA YIQILDI:', e);
  process.exit(1);
});
