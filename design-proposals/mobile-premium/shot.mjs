// Ekranlarni PNG'ga render qiladi. Ishga tushirish: node shot.mjs
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('../..');                 // repo ildizi
const OUT  = path.resolve('screenshots');
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.ttf':'font/ttf', '.svg':'image/svg+xml' };

// Kichik statik server — ES modul file:// dan yuklanmaydi, shuning uchun HTTP kerak
const srv = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404).end('404'); }
});
await new Promise(r => srv.listen(0, r));
const PORT = srv.address().port;
const BASE = `http://127.0.0.1:${PORT}/design-proposals/mobile-premium/index.html`;

const screens = process.argv.slice(2).length ? process.argv.slice(2)
  : Object.keys((await import('./screens.js')).S);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', e => problems.push('JS: ' + e.message));
page.on('requestfailed', r => problems.push('YUKLANMADI: ' + r.url().replace(`http://127.0.0.1:${PORT}`, '')));

for (const s of screens) {
  await page.goto(`${BASE}?screen=${s}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(220);
  await page.locator('.phone').first().screenshot({ path: path.join(OUT, `${s}.png`) });
  console.log('✓', s);
}
await browser.close(); srv.close();
if (problems.length) { console.log('\n⚠ MUAMMO:'); [...new Set(problems)].forEach(p => console.log(' ', p)); }
else console.log('\nMuammo yo\'q.');
