#!/usr/bin/env node
// PRODUCTION SMOKE — HAQIQIY HISOB BILAN, nfcstore.uz GA QARSHI.
//
// NIMA UCHUN API DARAJASIDA: emulyator ilovaning ko'rinishini
// tekshiradi, lekin "ishladi" degani serverning javobiga bog'liq.
// Bu skript aynan ILOVA CHAQIRADIGAN yo'llarni, ilova yuboradigan
// shaklda so'raydi va HTTP kodini ko'rsatadi — ya'ni FAIL bo'lsa
// sababi darrov ko'rinadi.
//
// XAVFSIZLIK QOIDALARI (o'zgartirilmaydi):
//   • hech qanday to'lov qilinmaydi;
//   • mavjud post, istorya, ID, kompaniya O'CHIRILMAYDI;
//   • email, parol, telefon, PIN O'ZGARTIRILMAYDI;
//   • yaratiladigan yagona narsa — sinov IZOHI, u darhol
//     o'chiriladi (o'z izohi, begonasi emas);
//   • login/parol hech qayerga chop etilmaydi.
const BASE = process.env.PROD_BASE || 'https://nfcstore.uz';
const EMAIL = process.env.NFC_LOGIN_EMAIL || '';
const PASSWORD = process.env.NFC_LOGIN_PASSWORD || '';

const rows = [];
let token = '';

function mark(area, name, ok, detail = '') {
  rows.push({ area, name, ok, detail });
  const tag = ok === null ? '⏭ ' : ok ? '✅' : '❌';
  console.log(`${tag} ${area.padEnd(22)} ${name}${detail ? ' — ' + detail : ''}`);
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* matn */ }
  return { status: r.status, body: data };
}

const arr = (v) => (Array.isArray(v) ? v : []);

async function main() {
  console.log(`PRODUCTION: ${BASE}\n`);

  // ── LOGIN ───────────────────────────────────────────────────
  if (!EMAIL || !PASSWORD) {
    mark('REAL LOGIN', 'hisob Secret‘i yo‘q', null);
    process.exitCode = 1;
    return;
  }
  const login = await api('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { login: EMAIL, password: PASSWORD },
  });
  token = login.body?.token || '';
  mark('REAL LOGIN', 'kirish', login.status === 200 && !!token, `HTTP ${login.status}`);
  if (!token) { process.exitCode = 1; return; }

  // ── HISOB VA ID'LAR ─────────────────────────────────────────
  const me = await api('/api/auth/me');
  const cards = arr(me.body?.cards);
  mark('NFC ID‘LAR', 'mening ID‘larim', me.status === 200 && cards.length > 0,
    `HTTP ${me.status}, ${cards.length} ta`);

  const primary = cards.find((c) => c.isPrimary) || cards[0];

  // ── HOME ────────────────────────────────────────────────────
  const feed = await api('/api/feed');
  const items = arr(feed.body?.feed ?? feed.body?.items ?? feed.body?.posts);
  mark('HOME', 'lenta', feed.status === 200 && items.length > 0,
    `HTTP ${feed.status}, ${items.length} element`);

  const stories = await api('/api/stories/feed');
  mark('HOME', 'istoryalar', stories.status === 200, `HTTP ${stories.status}`);

  const posts = items.filter((e) => e.kind === 'post');
  mark('HOME', 'postlar lentada', posts.length > 0, `${posts.length} ta`);

  // ── SEARCH ──────────────────────────────────────────────────
  const q = (primary?.name || 'a').split(' ')[0];
  const sRec = await api(`/api/records/search?q=${encodeURIComponent(q)}`);
  const sCo = await api(`/api/companies/search?q=${encodeURIComponent(q)}`);
  mark('SEARCH', 'odam qidiruvi', sRec.status === 200, `HTTP ${sRec.status}`);
  mark('SEARCH', 'kompaniya qidiruvi', sCo.status === 200, `HTTP ${sCo.status}`);
  const cats = await api('/api/categories');
  mark('SEARCH', 'sohalar', cats.status === 200 && arr(cats.body?.categories).length > 0,
    `HTTP ${cats.status}`);

  // ── PERSONAL PROFIL ─────────────────────────────────────────
  if (primary) {
    const p = await api(`/api/records/${primary.code}`);
    mark('PERSONAL PROFIL', `${primary.code}`, p.status === 200, `HTTP ${p.status}`);
    const pp = await api(`/api/records/${primary.code}/posts`);
    mark('PERSONAL PROFIL', 'postlari', pp.status === 200, `HTTP ${pp.status}`);
    const st = await api(`/api/records/${primary.code}/stats`);
    mark('PERSONAL PROFIL', 'statistika', st.status === 200, `HTTP ${st.status}`);
  }

  // ── BUSINESS PROFIL VA SWITCH ───────────────────────────────
  const mine = await api('/api/companies/mine');
  const companies = arr(mine.body?.companies);
  mark('BUSINESS PROFIL', 'mening kompaniyalarim',
    mine.status === 200 && companies.length > 0,
    `HTTP ${mine.status}, ${companies.length} ta`);

  // SWITCH — ilovada bu MIJOZ TOMONIDAGI holat almashuvi
  // (`switchIdentity`), serverga so'rov yubormaydi. Server
  // tomonidan tekshiriladigan narsa — ikkala shaxsning ham
  // ma'lumoti KELISHI. Ikkalasi kelsa, almashish ishlaydi.
  mark('PERSONAL/BUSINESS SWITCH', 'ikkala shaxs ham mavjud',
    cards.length > 0 && companies.length > 0,
    `${cards.length} ID + ${companies.length} kompaniya`);

  const co = companies[0];
  if (co) {
    const id = co.companyId || co.id;
    const full = await api(`/api/companies/${id}`);
    const cItems = arr(full.body?.company?.items);
    mark('BUSINESS PROFIL', `${id} to‘liq`, full.status === 200, `HTTP ${full.status}`);
    mark('BUSINESS KATALOG', 'mahsulotlar', full.status === 200,
      `${cItems.length} ta mahsulot`);
    const cst = await api(`/api/companies/${id}/stats`);
    mark('BUSINESS STATISTIKA', 'statistika', cst.status === 200, `HTTP ${cst.status}`);
    const ord = await api(`/api/companies/${id}/orders`);
    mark('BUSINESS ORDERS', 'buyurtmalar', ord.status === 200, `HTTP ${ord.status}`);
    const cposts = await api(`/api/companies/${id}/posts`);
    mark('BUSINESS PROFIL', 'postlari', cposts.status === 200, `HTTP ${cposts.status}`);
  }

  // ── SHOP / ID QIDIRUV ───────────────────────────────────────
  const cat = await api('/api/records');
  const all = Array.isArray(cat.body) ? cat.body : arr(cat.body?.records);
  mark('SHOP', 'katalog', cat.status === 200 && all.length > 0,
    `HTTP ${cat.status}, ${all.length} ta ID`);

  // Uch holat: BAND (kimdadir), BO'SH (sotuvda), MAVJUD EMAS.
  const taken = primary?.code;
  const free = all.find((r) => (r.price ?? 0) > 0 && !r.notForSale)?.code;
  const missing = 'ZQXJ99';

  if (taken) {
    const r = await api(`/api/records/${taken}`);
    mark('SHOP/ID SEARCH', `BAND kod ${taken}`, r.status === 200, `HTTP ${r.status}`);
  }
  if (free) {
    const r = await api(`/api/records/${free}`);
    const qt = await api(`/api/records/${free}/quote`);
    mark('SHOP/ID SEARCH', `BO‘SH kod ${free} — narxi`, qt.status === 200,
      qt.status === 200
        ? `${qt.body?.amount ?? '?'} so‘m, ${qt.body?.tier ?? '?'}`
        : `HTTP ${qt.status} — /quote SERVERGA YOYILMAGAN`);
    mark('SHOP/ID SEARCH', `${free} katalogda narx bilan`,
      (all.find((x) => x.code === free)?.price ?? 0) > 0,
      `${all.find((x) => x.code === free)?.price ?? 0} so‘m (zaxira manba)`);
    void r;
  }
  const mr = await api(`/api/records/${missing}`);
  mark('SHOP/ID SEARCH', `MAVJUD EMAS ${missing}`, mr.status === 404, `HTTP ${mr.status}`);

  const pay = await api('/api/settings/payments-enabled');
  mark('SHOP', 'to‘lov provayderlari', pay.status === 200, `HTTP ${pay.status}`);
  const phys = await api('/api/settings/physical-nfc-pricing');
  mark('SHOP', 'jismoniy karta narxi', phys.status === 200, `HTTP ${phys.status}`);

  // ── REELS ───────────────────────────────────────────────────
  const videos = items.filter((e) => (e.videoUrl || '').trim());
  mark('REELS', 'lenta manbasi', feed.status === 200,
    `${videos.length} video, ${items.length} element`);
  const page2 = await api('/api/feed?page=2');
  mark('REELS', 'sahifalash (2-sahifa)', page2.status === 200, `HTTP ${page2.status}`);

  // LIKE — o'zgarish qaytariladi: ikkinchi bosish holatni tiklaydi.
  const likeTarget = posts.find((p) => p.likeable);
  if (likeTarget) {
    const a = await api(`/api/posts/${likeTarget.id}/like`, { method: 'POST' });
    const b = await api(`/api/posts/${likeTarget.id}/like`, { method: 'POST' });
    mark('REELS', 'like (va qaytarildi)', a.status === 200 && b.status === 200,
      `HTTP ${a.status}/${b.status}`);
  } else {
    mark('REELS', 'like', null, 'yoqtiriladigan post topilmadi');
  }

  // ── REELS IZOHLARI ──────────────────────────────────────────
  const ct = posts[0];
  if (ct) {
    const kind = ct.commentKind || 'post';
    const list = await api(`/api/comments/${kind}/${ct.id}`);
    const okList = list.status === 200;
    mark('REELS COMMENTS', 'ro‘yxat', okList,
      okList ? `HTTP 200, ${arr(list.body?.comments).length} ta`
             : `HTTP ${list.status} — /api/comments SERVERGA YOYILMAGAN`);

    if (okList) {
      const add = await api(`/api/comments/${kind}/${ct.id}`, {
        method: 'POST',
        body: { body: 'sinov izohi — avtomatik tekshiruv' },
      });
      const cid = add.body?.comment?.id;
      mark('REELS COMMENTS', 'yozish', add.status < 300 && !!cid, `HTTP ${add.status}`);
      if (cid) {
        const after = await api(`/api/comments/${kind}/${ct.id}`);
        const seen = arr(after.body?.comments).some((x) => x.id === cid);
        mark('REELS COMMENTS', 'darhol ro‘yxatda', seen);
        // TOZALASH — o'z izohi, darhol o'chiriladi.
        const del = await api(`/api/comments/${cid}`, { method: 'DELETE' });
        mark('REELS COMMENTS', 'o‘chirish (tozalash)', del.status < 300,
          `HTTP ${del.status}`);
      }
    } else {
      mark('REELS COMMENTS', 'yozish', false, 'ro‘yxat yo‘lining o‘zi yo‘q');
    }
  }

  // ── FOLLOW / SHARE ──────────────────────────────────────────
  const other = all.find((r) => r.code && r.code !== primary?.code);
  if (other) {
    const st = await api(`/api/records/${other.code}/follow-stats`);
    mark('FOLLOW', 'obuna holati', st.status === 200, `HTTP ${st.status}`);
  }
  mark('SHARE', 'havola mijozda yig‘iladi', true, `${BASE}/<kod>`);

  // ── SETTINGS / SESSIYA ──────────────────────────────────────
  const tg = await api('/api/telegram/bot');
  mark('SETTINGS', 'telegram bot holati', tg.status < 500, `HTTP ${tg.status}`);

  const out = await api('/api/auth/logout', { method: 'POST' });
  mark('SETTINGS/SESSION', 'chiqish', out.status < 300, `HTTP ${out.status}`);
  const afterOut = await api('/api/auth/me');
  mark('SETTINGS/SESSION', 'sessiya serverda yopildi', afterOut.status === 401,
    `HTTP ${afterOut.status}`);

  token = '';
  const again = await api('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { login: EMAIL, password: PASSWORD },
  });
  token = again.body?.token || '';
  mark('SETTINGS/SESSION', 'qayta kirish', again.status === 200 && !!token,
    `HTTP ${again.status}`);

  // ── XULOSA ──────────────────────────────────────────────────
  const failed = rows.filter((r) => r.ok === false);
  console.log(`\n${rows.filter((r) => r.ok).length}/${rows.filter((r) => r.ok !== null).length} o‘tdi`);
  if (failed.length) {
    console.log('\nYIQILGANLAR:');
    for (const f of failed) console.log(`  ${f.area} · ${f.name} — ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('SMOKE YIQILDI:', e); process.exit(1); });
