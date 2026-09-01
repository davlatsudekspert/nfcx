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
