// E2E: SARLAVHA QATORI desktop kengliklarida bir-birini bosmasligi.
//
// Nega kerak: `smoke.mjs` eng keng 1440px ni tekshiradi va u faqat
// sahifaning gorizontal siljishiga qaraydi. Sarlavhadagi havolalar esa
// siljish hosil qilmasdan, QO'SHNISINING USTIGA chiqib ketardi
// (`.vz-nav` dagi `justify-content:center` toshgan kontentni ikki
// tomonga teng yoyadi) — 2026-11 da egasi aynan shuni ko'rsatdi:
// qidiruv maydoni "Yangiliklar" ni, "Ilovani yuklab olish" esa
// qo'ng'iroq ikonasini bosib turardi.
//
// Shuning uchun bu yerda SIJLISH emas, KESISHISH o'lchanadi: sarlavha
// ichidagi har bir bosiladigan element juft-juft solishtiriladi.
//
// Ishga tushirish (Playwright + Chromium o'rnatilgan muhitda):
//   BASE=http://127.0.0.1:5311 node scripts/e2e/header-fit.mjs
// Playwright repo dependency EMAS (ataylab) — NODE_PATH orqali tashqi
// o'rnatmadan foydalaning.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:5311';
const EXEC = process.env.CHROME_PATH || undefined;
// `xl` (1280) dan boshlab desktop qatori chiziladi; 1536 — `2xl`
// chegarasi, o'sha yerda qidiruv va yon bo'shliq kengayadi, shuning
// uchun eng tor holat aynan shu. 2560 — bar `max-w-[1800px]` ga
// tiraladi, ya'ni ekran kengaysa ham joy ko'paymaydi.
// Telefon/planshet kengliklari ham shu yerda: desktop uchun qo'yilgan
// `shrink-0` lar tor ekranda logotipni siqilishdan to'xtatadi, ya'ni
// ular sarlavhani ortiqcha kengaytirib yubormasligi tekshirilishi kerak.
const WIDTHS = [320, 375, 390, 768, 1024, 1280, 1366, 1440, 1536, 1600, 1728, 1920, 2560];
const LANGS = ['uz', 'ru', 'en'];

// Kirgan foydalanuvchi holati — sarlavhaning ENG TO'LA ko'rinishi
// (qo'ng'iroq, "To'lovlar", "Biznes kabinet", "Mening profilim").
const ME = {
  user: { id: 1, email: 'egasi@nfcstore.uz', name: 'Davlat' },
  cards: [{ code: '48210377', name: 'Davlat Aliyev', avatarUrl: '' }],
};

const browser = await chromium.launch({ executablePath: EXEC });
const fails = [];
let checks = 0;

for (const signedIn of [true, false]) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    for (const lang of LANGS) {
      const page = await ctx.newPage();
      if (signedIn) await page.route('**/api/auth/me', (r) => r.fulfill({ json: ME }));
      await page.goto(`${BASE}/?lang=${lang}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('header .navbar');
      // "Yana" menyusi o'lchovdan keyin chiziladi — bir kadr kutamiz.
      await page.waitForTimeout(400);

      const r = await page.evaluate(() => {
        const bar = document.querySelector('header .navbar');
        const items = [...bar.querySelectorAll('a,button,input')].filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.height > 0;
        });
        const name = (el) => (el.innerText || el.placeholder || el.getAttribute('aria-label') || el.tagName).trim().split('\n')[0].slice(0, 24);
        const hits = [];
        for (let i = 0; i < items.length; i += 1) {
          for (let j = i + 1; j < items.length; j += 1) {
            const a = items[i];
            const b = items[j];
            // Ichma-ich joylashganlar (tugma ichidagi tugma) tabiiy —
            // ular kesishgani ayb emas.
            if (a.contains(b) || b.contains(a)) continue;
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            // 1px — yaxlitlash xatosiga yon berish.
            const dx = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
            const dy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
            if (dx > 1 && dy > 1) hits.push(`${name(a)} ✕ ${name(b)} (${Math.round(dx)}px)`);
          }
        }
        const nav = bar.querySelector('nav.vz-nav');
        return {
          overlaps: hits.slice(0, 5),
          // Kesilgan havola ham bo'lmasin: menyuga tushgani
          // "Yana" ichida ko'rinadi, kesilgani esa umuman yo'qoladi.
          clipped: nav ? nav.scrollWidth > nav.clientWidth + 1 : false,
          barOverflow: bar.scrollWidth > bar.clientWidth + 1,
        };
      });

      checks += 1;
      const bad = r.overlaps.length > 0 || r.clipped || r.barOverflow;
      if (bad) {
        fails.push({ signedIn, w, lang, ...r });
        console.log('FAIL', JSON.stringify({ signedIn, w, lang, ...r }));
      }
      await page.close();
    }
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${checks - fails.length}/${checks} passed (${WIDTHS.length} kenglik × ${LANGS.length} til × kirgan/mehmon)`);
process.exit(fails.length ? 1 : 0);
