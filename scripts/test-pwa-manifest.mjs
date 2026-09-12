// PROFILNI BOSH EKRANGA QO'SHISH — AYNAN O'SHA PROFIL OCHILSIN.
//
// Egasining shikoyati: "nfcstore.uz/vip001 ni add to home screen qilsak
// homepage url chiqib qolyapti, biz tanlagan silka chiqmayapti".
//
// Sababi: butun saytda BITTA statik manifest bor edi va uning
// `start_url` i "/" — Android (Chrome) aynan shuni ochadi, qaysi
// sahifadan qo'shilganidan qat'i nazar.
//
// Endi har bir profil O'Z manifestini oladi. Bu test o'sha endpointni
// qo'riqlaydi.
//
//   node scripts/test-pwa-manifest.mjs
import { readFileSync } from 'node:fs';
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

const get = async (pathname) => {
  const r = await worker.fetch(new Request('https://nfcstore.uz' + pathname), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, type: r.headers.get('content-type') || '', body };
};

// ── 1) Jismoniy profil ───────────────────────────────────────────────
{
  const m = await get('/api/manifest/p/vip001');
  check('1) manifest qaytadi', m.status, 200);
  checkTrue('1) to‘g‘ri content-type', m.type.includes('application/manifest+json'));
  check('1) start_url AYNAN shu profil', m.body?.start_url, '/vip001?source=pwa');
  check('1) id ham shu profil', m.body?.id, '/vip001');
  checkTrue('1) nomida profil egasining ismi bor', String(m.body?.name || '').includes('Muhammad'));
  // Qamrov butun sayt: aks holda ilova ichidagi boshqa havolalar
  // brauzerda ochilib, odamni ilovadan uloqtirardi.
  check('1) qamrov — butun sayt', m.body?.scope, '/');
  checkTrue('1) ikonkalar bor', Array.isArray(m.body?.icons) && m.body.icons.length >= 2);
  checkTrue('1) maskable ikonka ham bor', (m.body?.icons || []).some((i) => i.purpose === 'maskable'));
  check('1) standalone rejim', m.body?.display, 'standalone');
}

// ── 2) Kompaniya profili ─────────────────────────────────────────────
{
  const m = await get('/api/manifest/c/biz');
  checkTrue('2) kompaniya manifesti', m.status === 200 || m.status === 404);
  if (m.status === 200) {
    check('2) start_url kompaniya sahifasi', m.body?.start_url, '/c/biz?source=pwa');
    check('2) id ham shu kompaniya', m.body?.id, '/c/biz');
  }
}

// ── 3) MAVJUD BO'LMAGAN profil uchun manifest berilmaydi ─────────────
// Bu ozodalik emas, XAVFSIZLIK: `companyId()` yaroqsiz qiymatni
// "tozalab" boshqa, MAVJUD ID ga aylantirib yuborishi mumkin
// ("BIZ777" -> "BIZ"), ya'ni odam butunlay boshqa profilni bosh
// ekraniga qo'shib qo'yardi.
{
  check('3) mavjud bo‘lmagan kod -> 404', (await get('/api/manifest/p/zzz')).status, 404);
  check('3) raqamli "kompaniya ID" tozalanib boshqasiga aylanmaydi', (await get('/api/manifest/c/biz777')).status, 404);
  check('3) juda qisqa ID -> 404', (await get('/api/manifest/c/xx')).status, 404);
  check('3) noto‘g‘ri tur -> 404', (await get('/api/manifest/z/vip001')).status, 404);
}

// ── 4) Har bir profilning `id` si BOSHQACHA ──────────────────────────
// Bir xil bo'lsa Android ularni bitta ilova deb biladi va ikkinchisini
// qo'shganda birinchisining ustiga yozadi.
{
  const a = await get('/api/manifest/p/vip001');
  const b = await get('/api/manifest/p/oth222');
  if (b.status === 200) {
    checkTrue('4) ikki profilning id si har xil', a.body.id !== b.body.id);
    checkTrue('4) ikki profilning start_url i har xil', a.body.start_url !== b.body.start_url);
  }
}

// ── 5) Mijoz tomoni: manifest havolasi almashtiriladi ────────────────
{
  const comp = readFileSync(new URL('../src/components/ProfileManifest.jsx', import.meta.url), 'utf8');
  checkTrue('5) link[rel=manifest] almashtiriladi', comp.includes('link[rel="manifest"]'));
  checkTrue('5) sahifa yopilganda eskisi qaytariladi', comp.includes("link.setAttribute('href', previous"));
  checkTrue('5) iOS yorliq nomi ham qo‘yiladi', comp.includes('apple-mobile-web-app-title'));
  for (const [label, file] of [['jismoniy', 'ProfilePage.jsx'], ['biznes', 'CompanyQuickProfilePage.jsx']]) {
    const src = readFileSync(new URL(`../src/pages/${file}`, import.meta.url), 'utf8');
    checkTrue(`5) ${label} profilga ulangan`, src.includes('<ProfileManifest'));
  }
}

// ── 6) Service worker manifestni KESHLAMAYDI ─────────────────────────
// Keshlansa, bir profilning manifesti boshqasiga berilib ketardi.
{
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  checkTrue('6) /api/* keshlanmaydi', sw.includes("url.pathname.startsWith('/api/')"));
}

done();
