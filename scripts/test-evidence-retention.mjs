// DALIL ARXIVI — 6 OYLIK MUDDAT (egasining qarori, 2026-09-25).
//
// O'chirilgan kontent nusxasi, izohlar arxivi va purge qilingan muallifning
// email/telefoni 6 oydan keyin avtomatik o'chadi (maxfiylik siyosatida
// yozilgan). Bu test qo'riqlaydi:
//   * yangi yozuvlarga tegilmaydi, eskisi o'chadi;
//   * "shubhali" belgilangan yozuv va legal hold dagi foydalanuvchi QOLADI;
//   * dry-run hech narsani o'zgartirmaydi;
//   * arxivdagi media manzili R2 navbatiga tushadi (fayl darhol o'chmaydi);
//   * email/telefon faqat undan arxivda hech narsa qolmaganda o'chadi;
//   * cron (runScheduledPurge) hisob o'chirish "off" bo'lsa ham ishlaydi.
//
//   node scripts/test-evidence-retention.mjs
import { makeEnv, seedBasic, makeChecker } from './lib/d1-harness.mjs';
import { ensurePurgeSchema, runEvidenceRetention, runScheduledPurge, retentionMode, EVIDENCE_RETENTION_DAYS } from '../hosting/api/account-purge.js';
import { ensureArchiveTable } from '../hosting/api/content-archive.js';
import { ensureSchema as ensureCommentSchema } from '../hosting/api/comments.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({}, { atomicBatch: true });
await seedBasic(env);
await ensurePurgeSchema(env);
await ensureArchiveTable(env);
await ensureCommentSchema(env);

const NOW = Date.parse('2026-12-31T12:00:00Z');
const OLD = '2026-05-01 10:00:00.000+00';     // 6 oydan eski
const OLD_ISO = '2026-06-01T10:00:00.000Z';   // eski, ISO shaklda
const NEW = '2026-12-01 10:00:00.000+00';     // yangi
const n = (sql, ...a) => sqlite.prepare(sql).get(...a).n;

const arch = sqlite.prepare(`INSERT INTO content_archive (id, kind, content_id, owner_kind, owner_id, user_id, image_url, video_url, file_url, body, created_at, deleted_at, reason)
  VALUES (?, 'post', ?, 'card', 'VIP001', ?, ?, NULL, NULL, 'matn', ?, ?, 'owner')`);
arch.run(1, 101, '1', '/uploads/old-1.jpg', OLD, OLD);        // eski — o'chadi
arch.run(2, 102, '1', '/uploads/old-2.jpg', OLD, OLD_ISO);    // eski (ISO) — o'chadi
arch.run(3, 103, '1', '/uploads/new-3.jpg', NEW, NEW);        // yangi — qoladi
arch.run(4, 104, '1', '/uploads/flag-4.jpg', OLD, OLD);       // eski, lekin shubhali — qoladi
arch.run(5, 105, '2', '/uploads/hold-5.jpg', OLD, OLD);       // eski, user#2 legal hold — qoladi
arch.run(6, 106, '9', '/uploads/gone-6.jpg', OLD, OLD);       // eski, purge qilingan user#9 — o'chadi
sqlite.prepare(`INSERT INTO evidence_flags (source, archive_id, note, flagged_by, flagged_at) VALUES ('content', 4, 'tergov', 'admin#1', ?)`).run(OLD);
sqlite.prepare(`INSERT INTO account_legal_holds (user_id, note, set_by, set_at) VALUES (2, 'sud so''rovi', 'admin#1', ?)`).run(OLD);

const cmt = sqlite.prepare(`INSERT INTO content_comment_archive (id, comment_id, target_kind, target_id, user_id, author_code, body, created_at, deleted_at, reason)
  VALUES (?, ?, 'post', 1, ?, 'VIP001', 'izoh', ?, ?, 'owner')`);
cmt.run(1, 201, 1, OLD, OLD);    // eski — o'chadi
cmt.run(2, 202, 1, NEW, NEW);    // yangi — qoladi
cmt.run(3, 203, 8, OLD, OLD);    // eski, purge qilingan user#8 — o'chadi
sqlite.prepare(`INSERT INTO evidence_flags (source, archive_id, note, flagged_by, flagged_at) VALUES ('comment', 99, '', 'admin#1', ?)`).run(OLD);

const ident = sqlite.prepare(`INSERT INTO evidence_identity (user_id, email, phone, captured_at) VALUES (?, ?, ?, ?)`);
ident.run(9, 'nine@x.uz', '+998900000009', OLD);   // arxivi ham eski — o'chadi
ident.run(8, 'eight@x.uz', '+998900000008', OLD);  // izohi eski — o'chadi
ident.run(7, 'seven@x.uz', '+998900000007', NEW);  // yangi — qoladi
ident.run(6, 'six@x.uz', '+998900000006', OLD);    // eski, lekin arxivda yangi yozuvi bor — qoladi
arch.run(7, 107, '6', null, NEW, NEW);

checkTrue('muddat ~6 oy', EVIDENCE_RETENTION_DAYS >= 180 && EVIDENCE_RETENTION_DAYS <= 184);
check('standart rejim — dry-run (bayroq qo‘yilmasa)', retentionMode({}), 'dry-run');

// ── dry-run: faqat sanaydi ──
const snap = () => [n(`SELECT COUNT(*) AS n FROM content_archive`), n(`SELECT COUNT(*) AS n FROM content_comment_archive`), n(`SELECT COUNT(*) AS n FROM evidence_identity`), n(`SELECT COUNT(*) AS n FROM purge_media_queue`)];
const before = snap();
const dry = await runEvidenceRetention(env, { now: NOW, mode: 'dry-run' });
check('dry-run: sanoq', [dry.content, dry.comments, dry.cutoff], [3, 2, '2026-07-01']);
check('dry-run: hech narsa o‘zgarmadi', snap(), before);

// ── on ──
const r = await runEvidenceRetention(env, { now: NOW, mode: 'on' });
check('on: o‘chirilgan sonlar', [r.content, r.comments, r.identities, r.mediaQueued], [3, 2, 2, 3]);
check('content_archive: yangi, shubhali, legal hold va user#6 yangi yozuvi qoldi',
  sqlite.prepare(`SELECT id FROM content_archive ORDER BY id`).all().map((x) => x.id), [3, 4, 5, 7]);
check('izohlar arxivi: faqat yangisi qoldi', sqlite.prepare(`SELECT id FROM content_comment_archive ORDER BY id`).all().map((x) => x.id), [2]);
check('email/telefon: yangi va arxivi qolganlar qoldi', sqlite.prepare(`SELECT user_id FROM evidence_identity ORDER BY user_id`).all().map((x) => x.user_id), [6, 7]);
check('media R2 navbatiga tushdi (fayl darhol o‘chmaydi)',
  sqlite.prepare(`SELECT url FROM purge_media_queue ORDER BY url`).all().map((x) => x.url), ['/uploads/gone-6.jpg', '/uploads/old-1.jpg', '/uploads/old-2.jpg']);
check('shubhali belgisi joyida', n(`SELECT COUNT(*) AS n FROM evidence_flags WHERE source = 'content' AND archive_id = 4`), 1);

// ── takror ishga tushsa hech narsa qilmaydi ──
const again = await runEvidenceRetention(env, { now: NOW, mode: 'on' });
check('takror: 0', [again.content, again.comments, again.identities], [0, 0, 0]);

// ── cron: hisob o'chirish "off" bo'lsa ham arxiv muddati ishlaydi ──
arch.run(8, 108, '1', '/uploads/old-8.jpg', OLD, OLD);
env.ACCOUNT_PURGE_MODE = 'off';
env.EVIDENCE_RETENTION_MODE = 'on';
const cron = await runScheduledPurge(env, {}, { now: NOW });
check('cron: purge off, arxiv muddati bajarildi', [cron.mode, cron.retention?.mode, cron.retention?.content], ['off', 'on', 1]);
env.EVIDENCE_RETENTION_MODE = 'off';
arch.run(9, 109, '1', null, OLD, OLD);
const off = await runScheduledPurge(env, {}, { now: NOW });
check('EVIDENCE_RETENTION_MODE=off — tegilmaydi', [off.retention?.mode, n(`SELECT COUNT(*) AS n FROM content_archive WHERE id = 9`)], ['off', 1]);

done();
