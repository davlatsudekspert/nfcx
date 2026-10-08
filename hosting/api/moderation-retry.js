// hosting/api/moderation-retry.js — TEKSHIRILMAGAN FAYLLARNI QAYTA TEKSHIRISH (2026-10).
//
// Yuklash paytida Gemini javob bermagan (yoki filtr o'chiq bo'lgan) fayllar
// admin navbatida `reason='unchecked'` bilan turadi va ular bilan chop
// etilgan post/istoriya `content_pending` da yashirin (content-guard.js).
// Kunlik cron (worker.js `scheduled`, wrangler.jsonc `triggers.crons`) shu
// navbatning eng eskilarini qayta tekshiradi — filtr YOQIQ bo'lsagina:
//   * ruxsat — shikoyat yopiladi (`system:recheck`), kontent ochiladi;
//   * bloklandi — kontent admin o'chirishi bilan AYNAN bir yo'l
//     (`deleteContentAsAdmin`: dalil arxivi + o'chirish + deleted_uploads),
//     hech qayerga bog'lanmagan fayl esa arxivlanib ombordan o'chiriladi;
//     `content_scan_blocks` ga dalil (`logBlockedUpload`);
//   * yana tekshirilmadi — navbatda qoladi (keyingi safar).
// Vaqt byudjeti bor (video tekshiruvi 45 s gacha) — cron chegarasiga urilmasin.

import { moderationEnabled, moderateImage, moderateVideo, logBlockedUpload } from './image-moderation.js';
import { clearPendingUrl, denyUploads, ensureGuardSchema } from './content-guard.js';
import { deleteContentAsAdmin } from './moderation.js';
import { archiveMediaStmt } from './content-archive.js';

const BY = 'system:recheck';
const EXT_TYPE = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

function typeOf(obj, url) {
  const h = new Headers();
  try { obj.writeHttpMetadata?.(h); } catch { /* metadata yo'q */ }
  const t = h.get('content-type') || obj?.httpMetadata?.contentType || '';
  return String(t || EXT_TYPE[String(url).split('.').pop().toLowerCase()] || '').toLowerCase();
}

// Fayl qaysi kontentda ishlatilgan (kutilayotganlar birinchi).
async function contentsUsing(env, url) {
  const out = [];
  const seen = new Set();
  const add = (kind, id) => { const k = `${kind}:${id}`; if (!seen.has(k)) { seen.add(k); out.push({ kind, id: Number(id) }); } };
  const tries = [
    ['', `SELECT kind, id FROM content_pending WHERE url = ?`, 1],
    ['post', `SELECT id FROM posts WHERE image_url = ? OR video_url = ? OR instr(COALESCE(media_json, ''), ?) > 0`, 3],
    ['company_post', `SELECT id FROM company_posts WHERE image_url = ? OR video_url = ? OR instr(COALESCE(media_json, ''), ?) > 0`, 3],
    ['story', `SELECT id FROM stories WHERE image_url = ? OR video_url = ?`, 2],
  ];
  for (const [kind, sql, n] of tries) {
    try {
      const rows = await env.DB.prepare(sql).bind(...Array(n).fill(url)).all();
      for (const r of rows?.results || []) add(kind || r.kind, r.id);
    } catch { /* jadval/ustun yo'q */ }
  }
  return out;
}

export async function retryUncheckedMedia(env, H, { limit = 20, budgetMs = 5 * 60_000 } = {}) {
  const stats = { checked: 0, approved: 0, blocked: 0, still: 0, skipped: !moderationEnabled(env) || !env.UPLOADS };
  if (stats.skipped) return stats;
  const started = Date.now();
  await ensureGuardSchema(env).catch(() => {});
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      `SELECT r.id, r.target_id, r.note FROM content_reports r
        WHERE r.target_kind = 'media' AND r.reason = 'unchecked' AND r.status = 'new'
        ORDER BY EXISTS (SELECT 1 FROM content_pending p WHERE p.url = r.target_id) DESC, r.created_at ASC
        LIMIT ?`
    ).bind(Math.max(1, Math.min(100, Number(limit) || 20))).all()).results || [];
  } catch { return stats; }
  for (const rep of rows) {
    if (Date.now() - started > budgetMs) break;
    const url = String(rep.target_id || '');
    if (!/^\/uploads\/[A-Za-z0-9._-]{1,200}$/.test(url)) continue;
    const key = url.slice(1);
    let obj = null;
    try { obj = await env.UPLOADS.get(key); } catch { obj = null; }
    if (!obj) { stats.still++; continue; }
    const type = typeOf(obj, url);
    let verdict = { allowed: true, checked: false };
    try {
      if (type.startsWith('video/')) {
        verdict = await moderateVideo(env, obj, type, obj.size);
      } else if (type.startsWith('image/')) {
        const bytes = new Uint8Array(typeof obj.arrayBuffer === 'function' ? await obj.arrayBuffer() : obj.body);
        verdict = await moderateImage(env, bytes, type);
      }
    } catch { verdict = { allowed: true, checked: false }; }
    stats.checked++;
    if (!verdict.checked) { stats.still++; continue; }
    const now = H.nowTs();
    if (verdict.allowed) {
      await env.DB.prepare(`UPDATE content_reports SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE id = ?`)
        .bind(now, BY, Number(rep.id)).run().catch(() => {});
      await clearPendingUrl(env, url);
      stats.approved++;
      continue;
    }
    // BLOKLANDI — admin o'chirishi bilan bir xil yo'l.
    const reason = `auto_${verdict.category || 'blocked'}`.slice(0, 40);
    const used = await contentsUsing(env, url);
    for (const c of used) {
      await deleteContentAsAdmin(env, H, c.kind, c.id, { adminLabel: BY, resolvedBy: BY, reason }).catch((e) => {
        console.error('recheck delete', c.kind, String(e?.message || e).slice(0, 120));
      });
    }
    if (!used.length) {
      const actor = String(rep.note || '').split(' · ')[1] || '';
      try {
        await archiveMediaStmt(env, url, { admin: BY, reason, actor }).run();
        await denyUploads(env, [url]);
        await env.UPLOADS.delete(key).catch(() => {});
      } catch (e) {
        console.error('recheck media', String(e?.message || e).slice(0, 120));
      }
    }
    await env.DB.prepare(`UPDATE content_reports SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE id = ?`)
      .bind(now, BY, Number(rep.id)).run().catch(() => {});
    await logBlockedUpload(env, String(rep.note || '').split(' · ')[1] || 'unknown', verdict.category, 'recheck');
    stats.blocked++;
  }
  return stats;
}

// ═══ ADMIN RO'YXATINI OCHGANDA — TEZ QAYTA TEKSHIRUV ═══════════════════
//
// Kunlik cron'ni kutmasdan: admin `GET /api/admin/reports` ni ochganda eng
// eski (kutilayotgan kontentga bog'langan birinchi) 3 ta tekshirilmagan
// fayl qayta tekshiriladi. Umumiy vaqt ~20 s, 10 daqiqada bir martadan
// ko'p emas (isolate xotirasi + `admin_settings.moderation_retry_list_at`).
// Ro'yxat so'rovini HECH QACHON buzmaydi: xato yutiladi, muddat o'tsa
// ro'yxat kutmasdan davom etadi.
export const LIST_RETRY_LIMIT = 3;
export const LIST_RETRY_BUDGET_MS = 20_000;
export const LIST_RETRY_EVERY_MS = 10 * 60_000;
const LIST_RETRY_KEY = 'moderation_retry_list_at';
let listRetryAt = 0;
export function __resetListRetry() { listRetryAt = 0; }

export async function retryOnAdminList(env, H, { budgetMs = LIST_RETRY_BUDGET_MS, now = Date.now() } = {}) {
  let timer = null;
  try {
    if (!moderationEnabled(env) || !env.UPLOADS) return { ran: false, reason: 'off' };
    if (now - listRetryAt < LIST_RETRY_EVERY_MS) return { ran: false, reason: 'recent' };
    listRetryAt = now;
    try {
      const row = await env.DB.prepare(`SELECT value FROM admin_settings WHERE key = ?`).bind(LIST_RETRY_KEY).first();
      const last = Date.parse(String(row?.value || ''));
      if (Number.isFinite(last) && now - last < LIST_RETRY_EVERY_MS) { listRetryAt = last; return { ran: false, reason: 'recent' }; }
      await env.DB.prepare(
        `INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(LIST_RETRY_KEY, new Date(now).toISOString()).run();
    } catch { /* belgi yozilmasa ham isolate oralig'i ishlaydi */ }
    const TIMEOUT = Symbol('timeout');
    const run = retryUncheckedMedia(env, H, { limit: LIST_RETRY_LIMIT, budgetMs }).catch(() => null);
    const stats = await Promise.race([run, new Promise((resolve) => { timer = setTimeout(() => resolve(TIMEOUT), budgetMs); })]);
    return stats === TIMEOUT ? { ran: true, timedOut: true } : { ran: true, timedOut: false, stats };
  } catch {
    return { ran: false, reason: 'error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
