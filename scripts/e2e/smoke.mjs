// E2E smoke: har bir ommaviy sahifa × 5 viewport × 3 til — gorizontal scroll,
// console xatolari, sahifa yiqilishi (pageerror) va bo'sh render tekshiriladi.
//
// Ishga tushirish (Playwright + Chromium o'rnatilgan muhitda):
//   BASE=http://127.0.0.1:8899 node scripts/e2e/smoke.mjs
// Playwright repo dependency EMAS (ataylab) — NODE_PATH orqali tashqi
// o'rnatmadan foydalaning: NODE_PATH=/path/to/node_modules node scripts/e2e/smoke.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH || undefined;
const VIEWPORTS = [375, 390, 768, 1024, 1440];
const LANGS = ['uz', 'ru', 'en'];
const ROUTES = (process.env.ROUTES || '/,/narxlar,/katalog,/kompaniyalar,/auksion,/yangiliklar,/gifts,/savollar,/qollanma,/login,/register,/shartlar,/vip001,/account,/admin').split(',');
const IGNORE = [/ERR_CONNECTION_RESET/, /ERR_NAME_NOT_RESOLVED/, /fonts\.g/, /assistant\/status/];

const browser = await chromium.launch({ executablePath: EXEC });
const results = [];
for (const w of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 700, hasTouch: w < 700 });
  for (const lang of LANGS) {
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
      await page.addInitScript((l) => { try { localStorage.setItem('nfc_lang', l); } catch {} }, lang);
      let status = 0;
      try {
        // 'networkidle' EMAS: ba'zi sahifalar (auksion, xabarlar) davriy so'rov
        // yuboradi va hech qachon "idle" bo'lmaydi — 'load' + qisqa kutish yetarli.
        const res = await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 });
        status = res?.status() || 0;
        await page.waitForTimeout(1500);
      } catch (e) { errors.push('NAV ' + e.message); }
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, iw: window.innerWidth,
        text: (document.body.innerText || '').trim().length,
        lang: document.documentElement.lang,
        title: document.title,
      })).catch(() => ({ sw: 0, iw: 1, text: 0 }));
      const real = errors.filter((e) => !IGNORE.some((re) => re.test(e)));
      const r = { w, lang, route, status, hscroll: m.sw > m.iw, blank: m.text < 40, errors: real.slice(0, 3), title: m.title, htmlLang: m.lang };
      r.ok = !r.hscroll && !r.blank && real.length === 0 && status < 500;
      results.push(r);
      if (!r.ok) console.log('FAIL', JSON.stringify(r));
      await page.close();
    }
  }
  await ctx.close();
}
await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed (${VIEWPORTS.length} viewports × ${LANGS.length} langs × ${ROUTES.length} routes)`);
if (process.env.REPORT) { const { writeFileSync } = await import('node:fs'); writeFileSync(process.env.REPORT, JSON.stringify(results, null, 1)); }
process.exit(fails.length ? 1 : 0);
