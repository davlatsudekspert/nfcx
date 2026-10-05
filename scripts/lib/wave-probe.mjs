// ISSIQ YO'LLARNING "TO'LQIN" SONI — O'zbekiston serveri adapteri orqali.
//
// UZ adapteri (hosting/uz-store.js) bir vaqtda kelgan so'rovlarni BITTA
// HTTP ga birlashtiradi, demak HTTP soni = ketma-ket borib-kelishlar
// (to'lqinlar) soni. Ijtimoiy imkoniyatlar (2026-10) lenta va ro'yxatlarga
// yangi ketma-ket to'lqin qo'shmasligi kerak — test shu skriptni ALOHIDA
// jarayonda ishga tushiradi (modul keshlari toza bo'lsin) va JSON oladi.
//   node scripts/lib/wave-probe.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const W = await import('../../hosting/worker.js');
const worker = W.default;
const { uzDb, uzBucket } = await import('../../hosting/uz-store.js');
const { hranaFetch } = await import('./hrana-fake.mjs');
const { s3Fetch } = await import('./s3-fake.mjs');

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../../db/d1-migration/0001-schema.sql', import.meta.url), 'utf8'));
let n = 0;
const hf = hranaFetch(sqlite);
const env = {
  DB: uzDb({ url: 'https://db.uz.test', token: 'test-token', fetch: (...a) => { n++; return hf(...a); } }),
  UPLOADS: uzBucket({ endpoint: 'https://s3.uz.test', bucket: 'b', keyId: 'k', secret: 's', fetch: s3Fetch({ bucket: 'b' }) }),
  ASSETS: { fetch: async () => new Response('nf', { status: 404 }) },
};
await W.ensureCoreSchema(env);
const go = async (p, ck) => {
  const h = { 'cf-connecting-ip': '198.51.100.9' };
  if (ck) h.cookie = `nfc_session=${ck}`;
  const r = await worker.fetch(new Request(`https://nfcstore.uz${p}`, { headers: h }), env, { waitUntil() {} });
  await r.arrayBuffer();
  return r.status;
};
await go('/api/companies/check?id=ZZZZ');
const future = new Date(Date.now() + 86_400_000).toISOString();
sqlite.exec(`INSERT INTO users (id, email, password_hash) VALUES (1,'a@x','x'),(2,'b@x','x');
INSERT INTO sessions (token,user_id,expires_at) VALUES ('t1',1,'2999-01-01'),('t2',2,'2999-01-01');
INSERT INTO cards (code,name,price,ts,user_id) VALUES ('VIP001','A',1,1,1),('OTH222','B',1,1,2);
INSERT INTO posts (code,user_id,image_url,caption,media_json) VALUES ('VIP001',1,'/uploads/a.jpg','x','[{"url":"/uploads/a.jpg","type":"image"},{"url":"/uploads/b.jpg","type":"image"}]'),('OTH222',2,'/uploads/b.jpg','y',NULL);
INSERT INTO posts (code,user_id,image_url,caption,publish_at) VALUES ('VIP001',1,'/uploads/s.jpg','reja','2999-01-01 00:00:00');
INSERT INTO companies (company_id, owner_user_id, display_name, phone, tier, price, status, created_at, updated_at) VALUES ('ACME','1','Acme','+99890','free',0,'active','2026-01-01','2026-01-01');
INSERT INTO company_catalog_items (id, company_id, name, price, created_at, updated_at) VALUES ('i1','ACME','T',100,'x','x');
INSERT INTO company_posts (id,company_id,image_url,caption,created_at) VALUES (1,'ACME','/uploads/c.jpg','z','2026-10-01T00:00:00.000Z');
INSERT INTO company_posts (id,company_id,image_url,caption,created_at,publish_at) VALUES (2,'ACME','/uploads/d.jpg','r','2026-10-01T00:00:00.000Z','${future}');
INSERT INTO post_products (target_kind,target_id,item_id,created_at) VALUES ('company_post',1,'i1','x');
INSERT INTO stories (owner_kind, owner_id, user_id, image_url, created_at, expires_at) VALUES ('card','VIP001',1,'/uploads/st.jpg','2026-10-01','2999-01-01');`);
const out = {};
for (const [p, ck] of [['/api/feed', null], ['/api/feed', 't2'], ['/api/records/VIP001/posts', null], ['/api/records/VIP001/posts', 't1'],
  ['/api/companies/ACME/posts', null], ['/api/companies/ACME/posts', 't1'], ['/api/records/VIP001/stories', 't1']]) {
  await go(p, ck); // isitish: modul sxema keshlari to'lsin
  n = 0;
  const s = await go(p, ck);
  out[`${p} ${ck || 'anon'}`] = { status: s, waves: n };
}
process.stdout.write(`\n@@${JSON.stringify(out)}`);
process.exit(0);
