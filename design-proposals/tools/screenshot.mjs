// Ishga tushirish: playwright o'rnatilgan papkadan: node design-proposals/tools/screenshot.mjs (Chromium yo'li executablePath'da)
// Prototip screenshotlari: 4 variant × 9 ekran × (1440, 390) + home RU/EN.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(//$/, '');
const OUT = path.join(ROOT, 'screenshots');
const variants = ['v1-black-gold', 'v2-platinum-executive', 'v3-midnight-digital', 'v4-clean-luxury'];
const screens = ['home', 'profile', 'dashboard', 'company', 'company-public', 'admin', 'payme', 'news', 'components'];
const exec = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exec });
const report = [];

async function shot(variant, screen, width, lang) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: width < 500 ? 2 : 1, isMobile: width < 500 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const url = `file://${ROOT}/${variant}/index.html?screen=${screen}&lang=${lang}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(250);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const hs = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.setViewportSize({ width, height: Math.min(h, 7000) });
  await page.waitForTimeout(150);
  const dir = path.join(OUT, variant);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${screen}-${width}${lang !== 'uz' ? '-' + lang : ''}.png`);
  await page.screenshot({ path: file });
  await ctx.close();
  report.push({ variant, screen, width, lang, height: h, hscroll: hs, errors: errs });
}

for (const v of variants) {
  for (const s of screens) { await shot(v, s, 1440, 'uz'); await shot(v, s, 390, 'uz'); }
  for (const l of ['ru', 'en']) { await shot(v, 'home', 1440, l); await shot(v, 'home', 390, l); await shot(v, 'profile', 390, l); await shot(v, 'dashboard', 390, l); }
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
const bad = report.filter((r) => r.hscroll || r.errors.length);
console.log('total', report.length, 'problems', bad.length);
for (const b of bad) console.log(b.variant, b.screen, b.width, b.lang, b.hscroll ? 'HSCROLL' : '', b.errors.join(' | '));
