// FAQAT CRON ISHLAGAN ISOLATE — hisob purge'i karusel dalilini saqlaydimi.
//
// Production'da `scheduled()` HECH QANDAY HTTP so'rov ko'rmagan yangi
// isolate'da ishlashi mumkin: `ensureCoreSchema` chaqirilmagan, modul
// bayroqlari (masalan karusel arxivi) yoqilmagan. Ikki alohida jarayon:
//   prepare <fayl>  — avvalgi deploy: sxema to'liq (ustunlar bor);
//   cron <fayl>     — toza jarayon, faqat `worker.scheduled()`.
// Natija JSON (@@ dan keyin). scripts/test-carousel.mjs chaqiradi.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const [mode, file] = process.argv.slice(2);
const W = await import('../../hosting/worker.js');
const { uzDb, uzBucket } = await import('../../hosting/uz-store.js');
const { hranaFetch } = await import('./hrana-fake.mjs');
const { s3Fetch } = await import('./s3-fake.mjs');
const purge = await import('../../hosting/api/account-purge.js');
const archive = await import('../../hosting/api/content-archive.js');

const sqlite = new DatabaseSync(file);
const s3 = s3Fetch({ bucket: 'b' });
const env = {
  DB: uzDb({ url: 'https://db.uz.test', token: 'test-token', fetch: hranaFetch(sqlite) }),
  UPLOADS: Object.assign(uzBucket({ endpoint: 'https://s3.uz.test', bucket: 'b', keyId: 'k', secret: 's', fetch: s3 }), { _store: s3._store }),
  ASSETS: { fetch: async () => new Response('nf', { status: 404 }) },
  ACCOUNT_PURGE_MODE: 'on',
  ACCOUNT_PURGE_R2: 'on',
};

if (mode === 'prepare') {
  sqlite.exec(readFileSync(new URL('../../db/d1-migration/0001-schema.sql', import.meta.url), 'utf8'));
  await W.ensureCoreSchema(env);
  await purge.ensurePurgeSchema(env);
  process.stdout.write('\n@@{"ok":true}');
  process.exit(0);
}

// ── cron: toza jarayon ─────────────────────────────────────────────
const flagBefore = archive.archiveCarouselOn();
const up = (n) => `/uploads/post_${n.repeat(24)}.jpg`;
const IMG = { a: up('a'), b: up('b'), c: up('c'), avatar: `/uploads/${'d'.repeat(20)}.jpg` };
const deletedAt = new Date(Date.now() - 40 * 86_400_000).toISOString().replace('T', ' ').replace('Z', '+00');
sqlite.prepare(`INSERT INTO users (id, email, password_hash, deleted_at, deletion_source) VALUES (1, 'u@x', 'x', ?, 'self')`).run(deletedAt);
sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id, avatar_url) VALUES ('VIP001', 'A', 1, 1, 1, ?)`).run(IMG.avatar);
sqlite.prepare(`INSERT INTO posts (id, code, user_id, image_url, caption, media_json) VALUES (501, 'VIP001', 1, ?, 'karusel', ?)`)
  .run(IMG.a, JSON.stringify([IMG.a, IMG.b, IMG.c].map((url) => ({ url, type: 'image' }))));
for (const u of Object.values(IMG)) await env.UPLOADS.put(u.slice(1), new Uint8Array([1, 2, 3]));

const jobs = [];
await W.default.scheduled({ cron: '30 21 * * *', scheduledTime: Date.now() }, env, { waitUntil: (p) => jobs.push(p) });
await Promise.all(jobs);

const arch = sqlite.prepare(`SELECT image_url, media_json FROM content_archive WHERE kind = 'post' AND content_id = 501`).get();
const has = (u) => env.UPLOADS._store.has(u.slice(1));
const out = {
  flagBefore,
  purged: !!sqlite.prepare(`SELECT purged_at FROM users WHERE id = 1`).get()?.purged_at,
  postGone: sqlite.prepare(`SELECT COUNT(*) AS n FROM posts WHERE id = 501`).get().n === 0,
  archImage: arch?.image_url || null,
  archMedia: arch?.media_json ? JSON.parse(arch.media_json).map((m) => m.url) : null,
  r2: { a: has(IMG.a), b: has(IMG.b), c: has(IMG.c), avatar: has(IMG.avatar) },
  queueLeft: sqlite.prepare(`SELECT COUNT(*) AS n FROM purge_media_queue`).get().n,
  IMG,
};
process.stdout.write(`\n@@${JSON.stringify(out)}`);
process.exit(0);
