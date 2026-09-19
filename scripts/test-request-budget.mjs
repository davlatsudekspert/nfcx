// SO'ROV BUDJETI — SAYT NEGA SEKIN OCHILARDI
//
// O'lchov (haqiqiy brauzer, mock backend, 390px):
//
//   OLDIN   profil sahifasi 27 ta API so'rovi, shundan 10 tasi AYNAN
//           TAKROR
//   KEYIN   14 ta, takror 0
//
// Har bir so'rov telefondan Cloudflare va D1 gacha borib keladi.
// O'nta keraksiz borib-kelish — sayt "sekin ochilyapti" degan
// tuyg'uning asosiy sababi edi.
//
// UCH SABAB TOPILDI:
//
//   1. TAKROR. Barcha so'rovlar bitta effektda edi va bog'liqlikda
//      `user` OBYEKTI turardi. `user` sahifa ochilganda `undefined`,
//      `/api/auth/me` javob bergach obyekt bo'ladi — effekt ikki
//      marta ishlab, o'nta so'rovning hammasi takrorlanardi.
//
//   2. BUTUN KATALOG. `dbList()` (`GET /api/records`) har sahifada,
//      shartsiz yuklanardi. NFC kartani bosgan odam o'zi ko'rmoqchi
//      bo'lgan profildan oldin butun ro'yxatni kutardi; profilda esa
//      u faqat "TOP #N" nishoni uchun kerak.
//
//   3. MOS KELMAYDIGAN MODULLAR. Menyu / mahsulot / xizmat SHAXSIY
//      profilda hech qachon ko'rsatilmaydi (tab sharti shuni
//      aytadi), lekin so'rov baribir ketaverardi.
//
//   node scripts/test-request-budget.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';
import { menuEligible, productEligible, serviceEligible } from '../src/lib/access.js';

const { check, checkTrue, done } = makeChecker();
const read = (rel) => stripComments(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));
const profile = read('src/pages/ProfilePage.jsx');
const app = read('src/App.jsx');

// ── 1) TAKROR SO'ROV QAYTMASIN ───────────────────────────────────────
{
  // Bog'liqlikda `user` OBYEKTI bo'lmasin — u har render'da yangi
  // havola bo'lishi mumkin.
  checkTrue('1) effekt bog‘liqligida xom "user" yo‘q', !/\},\s*\[code,\s*user\]\)/.test(profile));
  checkTrue('1) o‘rniga foydalanuvchi IDsi ishlatiladi', /viewerId/.test(profile));
  checkTrue('1) viewerId IDdan olinadi', /const viewerId = user \? user\.id : null/.test(profile));
}

// ── 2) AUTH JAVOBI KUTILADI ──────────────────────────────────────────
// Aks holda so'rov avval "mehmon", keyin "egasi" sifatida ikki marta
// ketardi va odam bir lahza noto'g'ri holatni ko'rardi.
{
  checkTrue('2) auth tayyorligi tekshiriladi', /const authReady = user !== undefined/.test(profile));
  checkTrue('2) tayyor bo‘lmaguncha so‘rov ketmaydi', /if \(!authReady\) return;/.test(profile));
}

// ── 3) OMMAVIY VA SHAXSIY MA'LUMOT AJRATILGAN ────────────────────────
// Kim qarayotganiga bog'liq bo'lmagan narsa qayta so'ralmasin.
{
  checkTrue('3) ommaviy kontent faqat koddan bog‘liq', /\},\s*\[code\]\);/.test(profile));
  checkTrue('3) tashrifchiga bog‘liqlari alohida', /\[code, viewerId, authReady\]/.test(profile));
}

// ── 4) BUTUN KATALOG KRITIK YO'LDA EMAS ──────────────────────────────
{
  checkTrue('4) katalog shart bilan yuklanadi', /catalogPage/.test(app));
  checkTrue('4) qolgan sahifalarda kechiktiriladi', /requestIdleCallback/.test(app));
  checkTrue('4) zaxira yo‘l bor (iOS Safari)', /setTimeout\(run/.test(app));
  // Shartsiz chaqiruv qaytib kelmasin.
  checkTrue('4) shartsiz refreshCatalog yo‘q',
    !/useEffect\(\(\) => \{ refreshCatalog\(\); \}, \[refreshCatalog\]\);/.test(app));
}

// ── 5) MOS KELMAYDIGAN MODUL SO'RALMAYDI ─────────────────────────────
{
  checkTrue('5) menyu mosligiga qarab so‘raladi', /if \(menuEligible\([^)]*\)\) dbGetMenu/.test(profile));
  checkTrue('5) mahsulot mosligiga qarab', /if \(productEligible\([^)]*\)\) dbGetProducts/.test(profile));
  checkTrue('5) xizmat mosligiga qarab', /if \(serviceEligible\([^)]*\)\) dbGetServices/.test(profile));

  // Moslik qoidasining O'ZI: shaxsiy profil bu modullarni olmaydi,
  // ovqat sohasidagi biznes esa oladi. Agar bu buzilsa, yuqoridagi
  // shart tirik ma'lumotni yashirib qo'yardi.
  checkTrue('5) shaxsiy profilda menyu yo‘q', !menuEligible('personal', ''));
  checkTrue('5) shaxsiy profilda mahsulot yo‘q', !productEligible('personal', ''));
  checkTrue('5) shaxsiy profilda xizmat yo‘q', !serviceEligible('personal', ''));
  const anyBusiness = ['restoran', 'kafe', 'restaurant', 'food'].some((c) => menuEligible('business', c));
  checkTrue('5) ovqat biznesida menyu BOR', anyBusiness);
}

// ── 6) TAB SHARTI VA SO'ROV SHARTI BIR XIL ───────────────────────────
// Ikkalasi ajralib ketsa, ma'lumot kelmagan tab ko'rinib qolardi
// (yoki aksincha).
{
  for (const fn of ['menuEligible', 'productEligible', 'serviceEligible']) {
    const uses = (profile.match(new RegExp(fn, 'g')) || []).length;
    checkTrue(`6) ${fn} ham so‘rovda, ham tabda (${uses})`, uses >= 2);
  }
}

done('So‘rov budjeti');
