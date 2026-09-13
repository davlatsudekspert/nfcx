// ADMIN PANELIDAN FOYDALANUVCHI PROFILIGA HAVOLA.
//
// Egasining talabi: "admin profilida ro'yxatdan o'tgan foydalanuvchilar
// ustiga bossa target blank bilan o'sha odamning profiliga otishi
// kerak, faqat ko'rish bo'lsin".
//
// Uchta narsa qo'riqlanadi:
//
//   1) Havola YANGI OYNADA va `rel="noopener"` bilan ochiladi. Busiz
//      ochilgan sahifa `window.opener` orqali admin panelini boshqa
//      manzilga yo'naltirib yuborishi mumkin (tabnabbing).
//
//   2) Ko'rish hisobi SHISHMAYDI. Profilni ochish "Ko'rildi" raqamini
//      oshiradi; admin kuniga o'nlab profilni ochsa, mijozning
//      statistikasi buziladi — u esa pullik imkoniyat.
//
//   3) Kartasi YO'Q odamga havola chizilmaydi — bosilib "topilmadi"
//      sahifasiga tushmasin.
//
//   node scripts/test-admin-user-links.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const admin = read('src/pages/AdminPage.jsx');
const preview = read('src/lib/preview.js');
const profile = read('src/pages/ProfilePage.jsx');
const company = read('src/pages/CompanyQuickProfilePage.jsx');

// ── 1) Havola yangi oynada va xavfsiz ────────────────────────────────
checkTrue('havola yordamchisi ishlatiladi', admin.includes('adminPreviewUrl('));
// `target="_blank"` bo'lgan HAR BIR havolada `rel` ham bo'lishi shart.
//
// `noreferrer` YOLG'IZ ham yetarli: u zamonaviy brauzerlarda
// `noopener` ni o'z ichiga oladi. Shuning uchun tekshiruv ikkalasidan
// birini talab qiladi — aks holda allaqachon xavfsiz bo'lgan eski
// havolalar bekorga yiqilardi.
const blanks = [...admin.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map((m) => m[0]);
checkTrue('yangi oynada ochiladigan havola bor', blanks.length >= 2);
check('hammasida noopener yoki noreferrer bor',
  blanks.filter((a) => !/rel="[^"]*(noopener|noreferrer)[^"]*"/.test(a)).length, 0);
// Profil havolalari — soni emas, QOIDASI tekshiriladi: yangi joyda
// havola qo'shilsa test bekorga yiqilmasin, lekin `rel` yoki
// "preview" belgisi tushib qolsa DARHOL ushlansin.
const mine = blanks.filter((a) => /adminPreviewUrl\(|adminCompanyPreviewUrl\(/.test(a));
checkTrue('profil havolalari bor', mine.length >= 2);
check('hammasida to‘liq rel',
  mine.filter((a) => !/rel="noopener noreferrer"/.test(a)).length, 0);
// Xom satr bilan yozilgan havola bo'lmasin — "preview" belgisini
// unutib qoldirish aynan shunday sodir bo'ladi.
checkTrue('kompaniya havolasi ham yordamchi orqali',
  !/href=\{`\/c\/\$\{/.test(admin));
checkTrue('kompaniya yordamchisi preview qo‘shadi',
  /adminCompanyPreviewUrl/.test(preview) && preview.includes('/c/${encodeURIComponent(c)}?preview=1'));

// ── 2) Ko'rish hisobi shishmaydi ─────────────────────────────────────
checkTrue('havolaga preview belgisi qo‘shiladi', preview.includes("?preview=1"));
checkTrue('belgi o‘qiladi', preview.includes("get('preview') === '1'"));
checkTrue('jismoniy profil sanamaydi', /!isPreviewVisit\(\)\s*&&\s*!sessionStorage/.test(profile));
checkTrue('kompaniya profili sanamaydi', /&&\s*!isPreviewVisit\(\)\)\s*companyEvent/.test(company));

// ── 3) Kartasi yo'q odamga havola yo'q ───────────────────────────────
checkTrue('kartasiz odamda havola chizilmaydi', /u\.codes\?\.length \? \(/.test(admin));
// Bo'sh kod berilsa yordamchi BO'SH satr qaytaradi — "/?preview=1"
// kabi buzuq havola yasalmasin.
checkTrue('bo‘sh kodda havola yasalmaydi', /return c \? `\/\$\{encodeURIComponent\(c\)\}\?preview=1` : '';/.test(preview));

// ── 4) Har bir karta alohida havola ──────────────────────────────────
// Bitta odamda bir nechta profil bo'lishi mumkin; emaildagi havola
// faqat birinchisini ochadi.
checkTrue('har bir kod alohida havola', /u\.codes\.map\(\(c\) =>/.test(admin));

done();
