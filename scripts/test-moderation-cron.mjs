// MODERATSIYA — CRON OGOHLANTIRISHLARI (2026-10, api/content-guard.js
// `cronModerationAlerts`, worker.js `scheduled`):
//   * filtr o'chiq — kunlik cron admin'ga "moderatsiya ishlamayapti" yuboradi;
//   * navbatda tekshirilmagan/yashirin narsa bo'lsa — kuniga BITTA xulosa
//     "Tekshiruv kutilmoqda: N ta" (admin_settings belgisi bilan cheklangan);
//   * navbat bo'sh — xulosa yo'q; filtr yoqiq — "o'chiq" xabari yo'q.
// Telegram o'rniga soxta xabarchi (setAdminNotifier).
//   node scripts/test-moderation-cron.mjs   (UZ_ADAPTER_TEST=1 bilan ham)
import { setupSocial, makeChecker } from './lib/social-fixture.mjs';
import * as guard from '../hosting/api/content-guard.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, worker } = await setupSocial();

const sent = [];
guard.setAdminNotifier(async (_env, text) => { sent.push(text); return true; });
guard.__resetGuardCaches();
const runCron = async (e = env) => {
  const jobs = [];
  await worker.scheduled({ cron: '30 21 * * *', scheduledTime: Date.now() }, e, { waitUntil: (p) => jobs.push(p) });
  await Promise.all(jobs);
};
const isOff = (t) => /moderatsiya ishlamayapti/i.test(t);
const isDigest = (t) => /^Tekshiruv kutilmoqda: \d+ ta/.test(t);
const marker = (k) => sqlite.prepare(`SELECT value FROM admin_settings WHERE key = ?`).get(k)?.value || null;

// ═══ 1. Filtr o'chiq, navbat bo'sh — faqat "o'chiq" xabari ═══
await env.DB.prepare(guard.REPORTS_TABLE_SQL).run();
await guard.ensureGuardSchema(env);
await runCron();
check('1) moderation-off alert sent once', sent.filter(isOff).length, 1);
check('1) no digest for empty queue', sent.filter(isDigest).length, 0);
checkTrue('1) off marker stored', !!marker('alert_moderation_off_at'));

// ═══ 2. Navbatda 2 ta fayl + 1 yashirin post — kunlik xulosa ═══
const ts = new Date().toISOString();
for (const u of ['/uploads/c1.jpg', '/uploads/c2.jpg']) {
  sqlite.prepare(`INSERT INTO content_reports (target_kind, target_id, reporter_ip, reason, status, created_at) VALUES ('media', ?, 'system', 'unchecked', 'new', ?)`).run(u, ts);
}
sqlite.prepare(`INSERT INTO content_reports (target_kind, target_id, reporter_ip, reason, status, created_at) VALUES ('media', '/uploads/old.jpg', 'system', 'unchecked', 'resolved', ?)`).run(ts);
sqlite.prepare(`INSERT INTO content_pending (kind, id, url, created_at) VALUES ('post', 7, '/uploads/c1.jpg', ?)`).run(ts);
await runCron();
const digests = sent.filter(isDigest);
check('2) one digest', digests.length, 1);
checkTrue('2) digest counts open unchecked (2) and pending (1)', /^Tekshiruv kutilmoqda: 2 ta\./.test(digests[0] || '') && /yashirin kontent: 1 ta/.test(digests[0] || ''));
checkTrue('2) digest marker stored', !!marker('alert_daily_review_at'));
check('2) off alert rate limited (no second within 6h)', sent.filter(isOff).length, 1);

// ═══ 3. Chastota: xotira tozalansa ham baza belgisi ushlaydi ═══
guard.__resetGuardCaches();
await runCron();
check('3) no second digest same day', sent.filter(isDigest).length, 1);
const r3 = await guard.cronModerationAlerts(env, { moderationOn: false });
check('3) direct call also limited', [r3.digest, r3.moderationOffAlert, r3.unchecked, r3.pending], [false, false, 2, 1]);
// Belgi eskirgan (kecha) — yana yuboriladi.
const old = new Date(Date.now() - 25 * 3600_000).toISOString();
sqlite.prepare(`UPDATE admin_settings SET value = ? WHERE key IN ('alert_daily_review_at', 'alert_moderation_off_at')`).run(old);
guard.__resetGuardCaches();
await runCron();
check('3) next day: digest again', sent.filter(isDigest).length, 2);
check('3) next day: off alert again', sent.filter(isOff).length, 2);

// ═══ 4. Filtr yoqiq — "o'chiq" xabari yo'q; xulosa navbat bo'yicha ═══
sqlite.prepare(`UPDATE admin_settings SET value = ? WHERE key IN ('alert_daily_review_at', 'alert_moderation_off_at')`).run(old);
guard.__resetGuardCaches();
const r4 = await guard.cronModerationAlerts(env, { moderationOn: true });
check('4) moderation on: no off alert, digest yes', [r4.moderationOffAlert, r4.digest], [false, true]);
sqlite.prepare(`UPDATE content_reports SET status = 'resolved'`).run();
sqlite.prepare(`DELETE FROM content_pending`).run();
sqlite.prepare(`UPDATE admin_settings SET value = ? WHERE key = 'alert_daily_review_at'`).run(old);
guard.__resetGuardCaches();
const before = sent.length;
const r5 = await guard.cronModerationAlerts(env, { moderationOn: true });
check('4) empty queue: nothing sent', [r5.digest, sent.length], [false, before]);

// ═══ 5. Xato — tashlamaydi ═══
const broken = { ...env, DB: { prepare() { throw new Error('db down'); }, batch: async () => { throw new Error('db down'); } } };
guard.__resetGuardCaches();
const r6 = await guard.cronModerationAlerts(broken, { moderationOn: true });
check('5) db down: no throw, nothing sent', [r6.digest, r6.unchecked], [false, 0]);

done();
