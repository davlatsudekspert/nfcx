// DEMO TO'LDIRISH SKRIPTI — TESTLAR
//
// Skript PRODUCTION ma'lumotiga yozadi, shuning uchun uning qoidalari
// haqiqiy serverga birinchi marta tegishdan OLDIN isbotlanishi kerak.
// Bu yerda soxta (mock) server bor va u AYNAN production kabi javob
// beradi: begona profilga 403, `PUT /api/records` esa yozuvni TO'LIQ
// almashtiradi.
//
//   node scripts/test-demo-fill.mjs
import { spawn } from 'node:child_process';
import { readFile, rm, mkdir } from 'node:fs/promises';
import http from 'node:http';
import { makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';
import {
  planPersonal, planCompany, filterOwned, isBlank, isMeaningful,
  inferDirection, NEVER_INVENT,
} from './lib/demo-plan.js';

const { check, checkTrue, done } = makeChecker();

// ═══ 1) SOF MANTIQ (serversiz) ═══════════════════════════════════════

// Bo'shlik aniqlash
checkTrue('1) bo‘sh matn — bo‘sh', isBlank('') && isBlank('   ') && isBlank(null) && isBlank([]));
checkTrue('1) matn bor — bo‘sh emas', !isBlank('Alisher'));
checkTrue('1) "." mazmunli emas', !isMeaningful('.') && !isMeaningful('-') && !isMeaningful('··'));
checkTrue('1) haqiqiy matn mazmunli', isMeaningful('Dasturchi'));

// Yo'nalish aniqlash
check('2) IT yo‘nalishi topiladi', inferDirection({ role: 'Backend dasturchi' }), 'it');
check('2) go‘zallik topiladi', inferDirection({ about: 'Go‘zallik saloni' }), 'beauty');
check('2) mobil topiladi', inferDirection({ displayName: 'NFC Mobile' }), 'mobile');
check('2) bo‘sh profilda yo‘nalish YO‘Q (to‘qilmaydi)', inferDirection({}), null);
check('2) tanish bo‘lmagan matnda yo‘nalish YO‘Q', inferDirection({ role: 'Qwerty zxcvb' }), null);

// ── ENG MUHIM: bo'sh maydon to'ldiriladi, to'lasi TEGILMAYDI ────────
{
  // Yo'nalish ANIQ (categorySlug) — shundagina kasb taklif qilinadi.
  // Yo'nalish noma'lum bo'lsa kasb ATAYLAB bo'sh qoladi (6-band).
  const cur = {
    code: 'AAA111', name: 'Alisher', role: '', about: '', hashtags: [],
    categorySlug: 'it', phone: '', email: '', instagram: '', tg: '',
    avatarUrl: '', bgUrl: '', theme: 'classic', accentColor: '#112233',
  };
  const p = planPersonal(cur);
  checkTrue('3) bo‘sh role to‘ldiriladi (yo‘nalish aniq bo‘lsa)', p.changes.some((c) => c.field === 'role'));
  checkTrue('3) bo‘sh about to‘ldiriladi', p.changes.some((c) => c.field === 'about'));
  checkTrue('3) body TO‘LIQ yuboriladi (PUT almashtiradi)', p.body && p.body.name === 'Alisher');
  checkTrue('3) egasining rangi saqlanadi', p.body.accentColor === '#112233');
  checkTrue('3) egasining mavzusi saqlanadi', p.body.theme === 'classic');
}

{
  const cur = {
    code: 'BBB222', name: 'Dilnoza', role: 'Shifokor',
    about: 'Men 10 yildan beri ishlayman va bemorlarni qabul qilaman.',
    hashtags: ['tibbiyot'], avatarUrl: '/uploads/x.jpg', bgUrl: '/uploads/y.jpg',
  };
  const p = planPersonal(cur);
  check('4) to‘la profilga TEGILMAYDI', p.changes.length, 0);
  checkTrue('4) skipped belgisi qo‘yiladi', p.skipped === true);
  checkTrue('4) body null (yozish yo‘q)', p.body === null);
  check('4) rasm ham so‘ralmaydi', p.media.length, 0);
}

// ── ALOQA MA'LUMOTI HECH QACHON TO'QILMAYDI ─────────────────────────
{
  const cur = { code: 'CCC333', name: 'Test', role: '', about: '', hashtags: [] };
  const p = planPersonal(cur);
  const touched = p.changes.map((c) => c.field);
  const violated = NEVER_INVENT.filter((f) => touched.includes(f));
  check('5) aloqa maydonlari TO‘QILMAYDI', violated.join(',') || '(yo‘q)', '(yo‘q)');
  // Hech bir demo matnda telefon/email/@handle bo'lmasin.
  const allText = JSON.stringify(p.body);
  checkTrue('5) demo matnda telefon raqami yo‘q', !/\+?998\d{7,}|\+\d{9,}/.test(allText));
  checkTrue('5) demo matnda email yo‘q', !/[\w.]+@[\w.]+\.\w{2,}/.test(allText));
  checkTrue('5) demo matnda @handle yo‘q', !/(^|\s)@\w{3,}/.test(allText));
}

// ── Yo'nalishsiz profil — neytral, kasb TAYINLANMAYDI ───────────────
{
  const p = planPersonal({ code: 'DDD444', name: 'Kimdir', role: '', about: '', hashtags: [] });
  check('6) yo‘nalishsizda role bo‘sh qoladi', p.body.role ?? '', '');
  checkTrue('6) neytral demo bio qo‘yiladi', /DEMO/.test(p.body.about));
  check('6) yo‘nalish "neutral"', p.direction, 'neutral');
  checkTrue('6) aniqlanmagani belgilanadi', p.directionInferred === false);
}

// ── Har profil bir xil emas ─────────────────────────────────────────
{
  const a = planPersonal({ code: 'E1', name: 'a', role: 'Dasturchi', about: '', hashtags: [] });
  const b = planPersonal({ code: 'E2', name: 'b', role: 'Dizayner', about: '', hashtags: [] });
  checkTrue('7) turli yo‘nalish — turli matn', a.body.about !== b.body.about);
  checkTrue('7) turli hashtag', JSON.stringify(a.body.hashtags) !== JSON.stringify(b.body.hashtags));
}

// ── DEMO ekani ko'rinib turadi ──────────────────────────────────────
{
  const co = planCompany({ companyId: 'NFCMOBILE', displayName: 'NFC Mobile', description: '', catalog: [] });
  check('8) yo‘nalish mobil deb topiladi', co.direction, 'mobile');
  checkTrue('8) tavsifda DEMO bor', /DEMO/.test(co.patch.description));
  checkTrue('8) katalogda 4-6 element', co.catalog.length >= 4 && co.catalog.length <= 6);
  checkTrue('8) har bir mahsulotda DEMO belgisi', co.catalog.every((i) => /DEMO/.test(i.name)));
  checkTrue('8) har bir mahsulotda "Demo narx" izohi', co.catalog.every((i) => /[Dd]emo narx/.test(i.description)));
  checkTrue('8) narxlar son', co.catalog.every((i) => Number.isFinite(i.price) && i.price > 0));
  // Taqiqlangan da'volar
  const txt = JSON.stringify(co);
  checkTrue('8) "rasmiy distributor" da’vosi yo‘q', !/rasmiy distributor/i.test(txt));
  checkTrue('8) "eng arzon" da’vosi yo‘q', !/eng arzon/i.test(txt));
  checkTrue('8) "kafolatlangan/100% original" yo‘q', !/kafolatlangan|100% original/i.test(txt));
  checkTrue('8) manzil/telefon to‘qilmaydi', !('address' in co.patch) && !('phone' in co.patch));
}

// ── Katalogda mahsulot bo'lsa — tegilmaydi ──────────────────────────
{
  const co = planCompany({
    companyId: 'X', displayName: 'Bor', description: 'Haqiqiy tavsif matni bu yerda.',
    subcategory: 'Savdo', catalog: [{ id: 1, name: 'Haqiqiy mahsulot', price: 100 }],
  });
  check('9) to‘la kompaniyaga tegilmaydi', co.changes.length, 0);
  check('9) katalogga qo‘shilmaydi', co.catalog.length, 0);
  checkTrue('9) katalog to‘la deb belgilanadi', co.catalogSkipped === true);
}

// ── Rasm: URL qo'yilmaydi, manifest chiqadi ─────────────────────────
{
  const p = planPersonal({ code: 'F1', name: 'x', role: '', about: '', hashtags: [], avatarUrl: '', bgUrl: '' });
  checkTrue('10) avatar URL yozilmaydi', !p.body.avatarUrl);
  checkTrue('10) cover URL yozilmaydi', !p.body.bgUrl);
  check('10) manifestda 2 ta rasm so‘raladi', p.media.length, 2);
  checkTrue('10) manifestda o‘lcham va tavsiya bor',
    p.media.every((m) => m.size && m.hint && m.target && m.kind));
  checkTrue('10) manifestda tashqi URL yo‘q', !JSON.stringify(p.media).includes('http'));
}

// ── Egalik filtri ───────────────────────────────────────────────────
{
  const items = [{ code: 'VIP001' }, { code: 'ddd333' }, { code: 'TTS075' }];
  const r = filterOwned(items, ['VIP001', 'TTS075'], (x) => x.code);
  check('11) o‘ziniki 2 ta', r.owned.length, 2);
  check('11) begona 1 ta', r.foreign.length, 1);
  check('11) begona aynan ddd333', r.foreign[0].code, 'ddd333');
  // Katta-kichik harf farq qilmasin
  const r2 = filterOwned([{ code: 'vip001' }], ['VIP001'], (x) => x.code);
  check('11) katta-kichik harfga bog‘liq emas', r2.owned.length, 1);
}

// ═══ 2) MOCK SERVER BILAN — HAQIQIY OQIM ═════════════════════════════
//
// Server production kabi: begona profilga 403, PUT to'liq almashtiradi.

let writes = [];
let store;
function resetStore() {
  writes = [];
  store = {
    cards: [
      { code: 'VIP001' }, { code: 'TTS075' }, { code: 'AAA000' },
    ],
    records: {
      // VIP001 — to'la (MASTER REFERENCE), tegilmasligi kerak
      VIP001: { code: 'VIP001', name: 'Egasi', role: 'Tadbirkor', about: 'Haqiqiy bio matni shu yerda turadi.', hashtags: ['biznes'], avatarUrl: '/uploads/a.jpg', bgUrl: '/uploads/b.jpg', phone: '+998901112233', theme: 'classic' },
      // TTS075 — bo'sh
      TTS075: { code: 'TTS075', name: 'Ikkinchi', role: '', about: '', hashtags: [], avatarUrl: '', bgUrl: '', phone: '', theme: 'onyx', accentColor: '#aabbcc' },
      // AAA000 — qisman
      AAA000: { code: 'AAA000', name: 'Uchinchi', role: 'Dizayner', about: '', hashtags: [], avatarUrl: '', bgUrl: '', theme: 'classic' },
      // Begona
      DDD333: { code: 'DDD333', name: 'Begona', role: '', about: '', hashtags: [] },
    },
    companies: [
      { companyId: 'NFCSTORE', displayName: 'NFCSTORE', description: 'Rasmiy NFCSTORE biznes profili va katalogi.', subcategory: 'NFC', catalog: [{ id: 9, name: 'Haqiqiy', price: 1 }], logoUrl: 'https://x/l.png', coverUrl: 'https://x/c.png' },
      { companyId: 'NFCMOBILE', displayName: 'NFC Mobile', description: '', subcategory: '', catalog: [], logoUrl: '', coverUrl: '' },
    ],
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const json = (code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
  let body = '';
  for await (const chunk of req) body += chunk;
  const parsed = body ? JSON.parse(body) : {};

  if (p === '/api/auth/login') {
    res.setHeader('set-cookie', 'sid=test; Path=/; HttpOnly');
    return json(200, { user: { id: 1, email: parsed.email } });
  }
  if (p === '/api/auth/me') return json(200, { user: { id: 1, email: 'demo@x.uz' }, cards: store.cards });
  if (p === '/api/auth/logout') return json(200, { ok: true });
  if (p === '/api/companies/mine') return json(200, { companies: store.companies });

  const recM = /^\/api\/records\/([A-Za-z0-9]+)$/.exec(p);
  if (recM) {
    const code = recM[1].toUpperCase();
    if (req.method === 'GET') {
      return store.records[code] ? json(200, store.records[code]) : json(404, { error: 'not_found' });
    }
    if (req.method === 'PUT') {
      // PRODUCTION KABI: begona profil -> 403
      if (!store.cards.some((c) => c.code === code)) return json(403, { error: 'forbidden' });
      writes.push({ method: 'PUT', code, body: parsed });
      store.records[code] = { ...parsed, code };   // TO'LIQ almashtirish
      return json(200, store.records[code]);
    }
  }

  const coM = /^\/api\/companies\/([A-Za-z0-9]+)$/.exec(p);
  if (coM) {
    const id = coM[1].toUpperCase();
    const co = store.companies.find((c) => c.companyId === id);
    if (!co) return json(403, { error: 'forbidden' });
    if (req.method === 'GET') return json(200, { company: co });
    if (req.method === 'PATCH') {
      writes.push({ method: 'PATCH', id, body: parsed });
      Object.assign(co, parsed);
      return json(200, { company: co });
    }
  }
  const catM = /^\/api\/companies\/([A-Za-z0-9]+)\/catalog$/.exec(p);
  if (catM && req.method === 'POST') {
    const id = catM[1].toUpperCase();
    const co = store.companies.find((c) => c.companyId === id);
    if (!co) return json(403, { error: 'forbidden' });
    writes.push({ method: 'POST-catalog', id, body: parsed });
    const item = { ...parsed, id: Math.floor(Math.random() * 1e6) };
    co.catalog.push(item);
    return json(201, { company: co });
  }
  const delM = /^\/api\/companies\/([A-Za-z0-9]+)\/catalog\/(\d+)$/.exec(p);
  if (delM && req.method === 'DELETE') {
    const co = store.companies.find((c) => c.companyId === delM[1].toUpperCase());
    if (co) co.catalog = co.catalog.filter((x) => String(x.id) !== delM[2]);
    writes.push({ method: 'DELETE-catalog', id: delM[1], itemId: delM[2] });
    return json(200, { company: co });
  }
  json(404, { error: 'not_found' });
});

const PORT = 4791;
await new Promise((r) => server.listen(PORT, r));

function run(extra = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/demo-fill.mjs', `--base=http://127.0.0.1:${PORT}`, ...extra], {
      env: { ...process.env, NFCSTORE_LOGIN: 'demo@x.uz', NFCSTORE_PASSWORD: 'sirsir123' },
      cwd: new URL('..', import.meta.url).pathname,
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ out, code }));
  });
}

// ── DRY RUN: bitta ham yozish bo'lmasin ─────────────────────────────
resetStore();
{
  const { out, code } = await run();
  check('12) dry-run muvaffaqiyatli tugadi', code, 0);
  check('12) DRY RUN da HECH QANDAY yozish yo‘q', writes.length, 0);
  checkTrue('12) "DRY RUN" deb yozadi', /DRY RUN/.test(out));
  checkTrue('12) PERSONAL jadvali bor', /PERSONAL/.test(out));
  checkTrue('12) BUSINESS jadvali bor', /BUSINESS/.test(out));
  checkTrue('12) UNCHANGED bo‘limi bor', /UNCHANGED/.test(out));
  checkTrue('12) BLOCKED bo‘limi bor', /BLOCKED/.test(out));
  checkTrue('12) MEDIA MANIFEST bor', /MEDIA MANIFEST/.test(out));
  checkTrue('12) to‘la VIP001 UNCHANGED da', /VIP001/.test(out));
  checkTrue('12) parol chiqmaydi', !out.includes('sirsir123'));
  checkTrue('12) login to‘liq chiqmaydi', !/demo@x\.uz/.test(out) || /de\*\*\*@x\.uz/.test(out));
}

// ── APPLY: faqat kerakli maydonlar yoziladi ─────────────────────────
resetStore();
await rm('backups', { recursive: true, force: true });
{
  const { out, code } = await run(['--apply']);
  check('13) apply muvaffaqiyatli tugadi', code, 0);
  checkTrue('13) "APPLY MODE: owned profiles only" chiqadi', /APPLY MODE: owned profiles only/.test(out));

  const puts = writes.filter((w) => w.method === 'PUT');
  checkTrue('13) VIP001 ga YOZILMADI (to‘la edi)', !puts.some((w) => w.code === 'VIP001'));
  checkTrue('13) TTS075 ga yozildi', puts.some((w) => w.code === 'TTS075'));
  checkTrue('13) AAA000 ga yozildi', puts.some((w) => w.code === 'AAA000'));
  checkTrue('13) DDD333 (begona) ga UMUMAN so‘rov yo‘q', !writes.some((w) => w.code === 'DDD333'));

  // Faqat mo'ljallangan maydonlar o'zgardi
  const tts = store.records.TTS075;
  check('14) ism o‘zgarmadi', tts.name, 'Ikkinchi');
  check('14) egasining mavzusi saqlandi', tts.theme, 'onyx');
  check('14) egasining rangi saqlandi', tts.accentColor, '#aabbcc');
  check('14) telefon BO‘SH qoldi (to‘qilmadi)', tts.phone, '');
  checkTrue('14) about to‘ldirildi', /DEMO/.test(tts.about));
  check('14) avatar BO‘SH qoldi (rasm manifestga)', tts.avatarUrl, '');

  // AAA000 — role bor edi, saqlanishi kerak
  check('15) mavjud role saqlandi', store.records.AAA000.role, 'Dizayner');
  checkTrue('15) bo‘sh about to‘ldirildi', /DEMO/.test(store.records.AAA000.about));

  // Kompaniyalar
  const nfcstore = store.companies.find((c) => c.companyId === 'NFCSTORE');
  check('16) NFCSTORE tavsifi o‘zgarmadi', nfcstore.description, 'Rasmiy NFCSTORE biznes profili va katalogi.');
  check('16) NFCSTORE katalogi o‘zgarmadi', nfcstore.catalog.length, 1);
  const mobile = store.companies.find((c) => c.companyId === 'NFCMOBILE');
  checkTrue('16) NFC Mobile tavsifi to‘ldirildi', /DEMO/.test(mobile.description));
  checkTrue('16) NFC Mobile katalogiga demo qo‘shildi', mobile.catalog.length >= 4);
  checkTrue('16) demo mahsulotlar DEMO belgisi bilan', mobile.catalog.every((i) => /DEMO/.test(i.name)));

  checkTrue('17) parol hech qayerda chiqmadi', !out.includes('sirsir123'));
}

// ── SNAPSHOT va ROLLBACK ────────────────────────────────────────────
{
  const { readdir } = await import('node:fs/promises');
  const files = await readdir('backups').catch(() => []);
  const snapFile = files.find((f) => f.startsWith('nfcstore-demo-before-'));
  checkTrue('18) snapshot fayli yaratildi', !!snapFile, files.join(','));

  if (snapFile) {
    const snap = JSON.parse(await readFile(`backups/${snapFile}`, 'utf8'));
    checkTrue('18) snapshotda shaxsiy yozuvlar bor', snap.personal.length >= 2);
    checkTrue('18) snapshotda kompaniya bor', snap.companies.length >= 1);
    checkTrue('18) snapshot TTS075 ning ESKI holatini saqlagan',
      snap.personal.find((p) => p.code === 'TTS075')?.record.about === '');
    checkTrue('18) qo‘shilgan katalog id‘lari qayd etilgan',
      (snap.companies.find((c) => c.id === 'NFCMOBILE')?.addedCatalogIds || []).length >= 4);

    // ROLLBACK
    const before = writes.length;
    const { out, code } = await run([`--rollback=backups/${snapFile}`, '--apply']);
    check('19) rollback tugadi', code, 0);
    checkTrue('19) rollback yozdi', writes.length > before);
    check('19) TTS075 about qaytarildi', store.records.TTS075.about, '');
    check('19) TTS075 role qaytarildi', store.records.TTS075.role, '');
    check('19) NFC Mobile tavsifi qaytarildi', store.companies.find((c) => c.companyId === 'NFCMOBILE').description, '');
    check('19) demo mahsulotlar o‘chirildi', store.companies.find((c) => c.companyId === 'NFCMOBILE').catalog.length, 0);
    checkTrue('19) rollback chiqishida parol yo‘q', !out.includes('sirsir123'));
  }
}

// ── ROLLBACK ham --apply talab qiladi ───────────────────────────────
{
  const { readdir } = await import('node:fs/promises');
  const files = await readdir('backups').catch(() => []);
  const snapFile = files.find((f) => f.startsWith('nfcstore-demo-before-'));
  if (snapFile) {
    const before = writes.length;
    const { out } = await run([`--rollback=backups/${snapFile}`]);
    check('20) --apply siz rollback HECH NARSA yozmaydi', writes.length, before);
    checkTrue('20) dry-run deb ogohlantiradi', /DRY RUN/.test(out));
  }
}

// ── --only / --skip ─────────────────────────────────────────────────
resetStore();
{
  await run(['--apply', '--only=TTS075']);
  const puts = writes.filter((w) => w.method === 'PUT');
  check('21) --only faqat bittasini yozadi', puts.length, 1);
  check('21) aynan TTS075', puts[0].code, 'TTS075');
}
resetStore();
{
  await run(['--apply', '--skip=TTS075']);
  const puts = writes.filter((w) => w.method === 'PUT');
  checkTrue('22) --skip chetlab o‘tadi', !puts.some((w) => w.code === 'TTS075'));
  checkTrue('22) qolganlari yoziladi', puts.some((w) => w.code === 'AAA000'));
}

// ── Credential yo'q bo'lsa ishlamasin ───────────────────────────────
{
  const child = spawn(process.execPath, ['scripts/demo-fill.mjs', `--base=http://127.0.0.1:${PORT}`], {
    env: { ...process.env, NFCSTORE_LOGIN: '', NFCSTORE_PASSWORD: '' },
    cwd: new URL('..', import.meta.url).pathname,
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  const code = await new Promise((r) => child.on('close', r));
  check('23) credentialsiz ishlamaydi', code, 2);
  checkTrue('23) nima kerakligini aytadi', /NFCSTORE_LOGIN/.test(out));
}

// ── Manba kodida parol hardcode qilinmagan ──────────────────────────
{
  const src = await readFile(new URL('./demo-fill.mjs', import.meta.url), 'utf8');
  const api = await readFile(new URL('./lib/nfcstore-api.js', import.meta.url), 'utf8');
  checkTrue('24) skriptda parol hardcode yo‘q', /process\.env\.NFCSTORE_PASSWORD/.test(src));
  checkTrue('24) standart holat DRY RUN', /const APPLY = has\('--apply'\)/.test(src));
  checkTrue('24) xato matniga so‘rov tanasi qo‘shilmaydi', !/err\.message.*body|JSON\.stringify\(body\)/.test(api.split('throw err')[0].split('const err')[1] || ''));
}

// ═══ 3) HISOB XAVFSIZLIGI — QAT'IY RO'YXAT ═══════════════════════════
//
// Login/parol FAQAT tizimga kirish uchun. Skript hech qachon parolni
// almashtirmasligi, emailni o'zgartirmasligi, 2FA yoki tiklash
// sozlamalariga tegmasligi kerak.
//
// Bu shunchaki va'da emas: API mijozida YOPIQ ro'yxat bor va quyidagi
// test uni qo'riqlaydi. Kelajakda kimdir yangi chaqiruv qo'shsa va u
// ro'yxatda bo'lmasa — test yiqiladi.
{
  // IZOHLARSIZ tekshiramiz. Bu fayldagi izoh AYNAN shu taqiqlarni
  // TUSHUNTIRADI ("change-password bu yerda YO'Q") — xom matnni
  // skanerlash o'sha tushuntirishning o'zini qoidabuzarlik deb
  // o'qirdi. Kod va izohni ajratish uchun loyihaning o'z skaneri
  // ishlatiladi (scripts/lib/strip-comments.mjs).
  const api = stripComments(await readFile(new URL('./lib/nfcstore-api.js', import.meta.url), 'utf8'));

  // Mijoz murojaat qila oladigan yo'llar (parametrlar umumlashtirilgan).
  const found = [...api.matchAll(/['`](\/api\/[^'`]*)['`]/g)]
    .map((m) => m[1].replace(/\$\{[^}]*\}/g, ':p'))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();

  const ALLOWED = [
    '/api/auth/login',            // faqat kirish
    '/api/auth/logout',           // sessiyani yopish
    '/api/auth/me',               // o'qish
    '/api/companies/:p',          // biznes maydonlari
    '/api/companies/:p/catalog',  // demo katalog qo'shish
    '/api/companies/:p/catalog/:p', // rollback: faqat SKRIPT qo'shganini o'chirish
    '/api/companies/mine',        // o'qish
    '/api/records/:p',            // profil o'qish/yozish
  ].sort();

  check('25) mijozdagi endpointlar AYNAN ruxsat etilganlar',
    found.join('\n'), ALLOWED.join('\n'));

  // Hisob xavfsizligiga tegadigan hech narsa bo'lmasin.
  const FORBIDDEN = [
    'change-password', 'request-password-code', 'reset-password',
    'change-email', '2fa', 'totp', 'recovery', 'recover',
    'delete-account', 'deactivate',
  ];
  const hit = FORBIDDEN.filter((f) => api.toLowerCase().includes(f));
  check('25) parol/email/2FA/tiklash endpointi YO‘Q', hit.join(',') || '(yo‘q)', '(yo‘q)');

  // NFC ID o'chirish serverda BOR, lekin mijozda BO'LMASLIGI shart.
  checkTrue('25) NFC ID o‘chirish metodi yo‘q',
    !/delete\s*\(\s*['`]\/api\/records/i.test(api) && !/deleteRecord/.test(api));

  // Parol faqat login chaqiruvida ishlatiladi.
  const passUses = (api.match(/password/g) || []).length;
  checkTrue('25) parol faqat login(email, password) da', passUses <= 3, `${passUses} marta uchradi`);
}

await rm('backups', { recursive: true, force: true });
await mkdir('backups', { recursive: true }).catch(() => {});
await rm('backups', { recursive: true, force: true });
server.close();
done('Demo to‘ldirish skripti');
