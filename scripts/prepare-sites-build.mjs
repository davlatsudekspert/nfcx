import { copyFile, cp, mkdir, readdir } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const client = new URL('../dist/client/', import.meta.url);

// Sites exposes static assets from dist/client. Keep the original Vite output
// in dist as well because the existing Express server serves that directory.
await mkdir(client, { recursive: true });
for (const entry of await readdir(dist, { withFileTypes: true })) {
  if (['client', 'server', '.openai'].includes(entry.name)) continue;
  await cp(new URL(entry.name, dist), new URL(entry.name, client), {
    recursive: entry.isDirectory(),
  });
}

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await copyFile(
  new URL('../hosting/worker.js', import.meta.url),
  new URL('../dist/server/index.js', import.meta.url),
);

// hosting/api/* modullari — worker.js ulardan import qiladi (wrangler bundle qiladi).
await cp(new URL('../hosting/api/', import.meta.url), new URL('../dist/server/api/', import.meta.url), { recursive: true });

// Ekskluziv narxlar — src/lib/exclusivePricing.js dan generatsiya qilingan
// nusxa; worker.js undan import qiladi. Bu ham KO'CHIRILISHI SHART: aks
// holda wrangler "Could not resolve './exclusive-pricing.generated.js'"
// deb deploy'ni yiqitadi (2026-09 da aynan shunday bo'lgan — `npm run
// build` mahalliy o'tib ketadi, chunki bundle faqat deploy paytida
// yig'iladi).
await copyFile(
  new URL('../hosting/exclusive-pricing.generated.js', import.meta.url),
  new URL('../dist/server/exclusive-pricing.generated.js', import.meta.url),
);

// Himoya: hosting/ ichidagi hech bir modul '../../src/...' dan import qilmasin —
// bunday yo'l dist/server/ ichida mavjud emas va wrangler bundle'da yiqiladi.
{
  const { readFile } = await import('node:fs/promises');
  const apiDir = new URL('../hosting/api/', import.meta.url);
  const offenders = [];
  for (const f of await readdir(apiDir)) {
    if (!f.endsWith('.js')) continue;
    const src = await readFile(new URL(f, apiDir), 'utf8');
    if (/^\s*import\b[^\n]*from\s+['"]\.\.\/\.\.\/src\//m.test(src)) offenders.push(f);
  }
  const workerSrc = await readFile(new URL('../hosting/worker.js', import.meta.url), 'utf8');
  if (/^\s*import\b[^\n]*from\s+['"]\.\.\/src\//m.test(workerSrc)) offenders.push('worker.js');
  if (offenders.length) {
    console.error('prepare-sites-build: src/ import in worker modules (deploy bundle would fail):', offenders.join(', '));
    process.exit(1);
  }
}

// Himoya 2 (2026-09): dist/server/ ichidagi HAR BIR nisbiy import
// haqiqatan mavjud faylga ishora qilsin.
//
// Nima uchun kerak: `npm run build` faqat fayllarni KO'CHIRADI, bundle'ni
// esa wrangler deploy paytida yig'adi. Shu sabab yangi modul qo'shilib,
// uni ko'chirish unutilsa, mahalliy build MUAMMOSIZ o'tadi va xato faqat
// deploy'da chiqadi ("Could not resolve ..."). Aynan shunday bo'lgan.
{
  const { readFile, stat } = await import('node:fs/promises');
  const serverDir = new URL('../dist/server/', import.meta.url);
  const missing = [];
  const scan = async (dirUrl, prefix = '') => {
    for (const f of await readdir(dirUrl, { withFileTypes: true })) {
      const child = new URL(f.name + (f.isDirectory() ? '/' : ''), dirUrl);
      if (f.isDirectory()) { await scan(child, `${prefix}${f.name}/`); continue; }
      if (!f.name.endsWith('.js')) continue;
      // Izohlar tashlanadi: worker.js izohlarida "import ... from
      // '../src/lib/pricing.js'" kabi TUSHUNTIRISH matnlari bor va ular
      // haqiqiy import deb o'qilib, yolg'on xato berardi.
      const src = (await readFile(child, 'utf8'))
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[ \t]*\/\/.*$/gm, '');
      for (const m of src.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)) {
        try { await stat(new URL(m[1], child)); }
        catch { missing.push(`${prefix}${f.name} -> ${m[1]}`); }
      }
    }
  };
  await scan(serverDir);
  if (missing.length) {
    console.error('prepare-sites-build: dist/server ichida yechilmaydigan import (deploy yiqiladi):\n  ' + missing.join('\n  '));
    process.exit(1);
  }
}
