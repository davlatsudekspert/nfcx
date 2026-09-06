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
