// hosting/api/trial-promo.js — MAVJUD SINOVLARNI 90 KUNGA UZAYTIRISH (BIR MARTA).
//
// ═══ NIMA UCHUN ═══
//
// Egasining qarori (2026-10-06, suhbatda aniq tasdiqlangan: "Ha 3 oy,
// 31-dekabrgacha, hozirgilarni ham uzaytir"): ishga tushirish aksiyasi —
// 2026-12-31 gacha ro'yxatdan o'tganlarga 90 kunlik bepul sinov
// (`TRIAL_DAYS_LAUNCH`, worker.js). Yangilar uni ro'yxatdan o'tishda
// oladi; bu modul ALLAQACHON ro'yxatdan o'tganlarni tenglashtiradi.
//
// ═══ QOIDA ═══
//
//   * Faqat `trial_expires_at` TO'LDIRILGAN hisob/kompaniya (sinov
//     tizimidan keyin yaratilganlar). Bo'sh — eski hisob: tegilmaydi.
//   * Yangi muddat = `created_at + 90 kun`. U FAQAT hozirgidan KEYIN
//     bo'lsa yoziladi — sinov HECH QACHON qisqarmaydi.
//   * `created_at + 90 kun` o'tib ketgan bo'lsa — tegilmaydi.
//     Ya'ni 30 kunlik sinovi tugagan, lekin 90 kun ichida ro'yxatdan
//     o'tgan odamga sinov QAYTA ochiladi (egasi shuni xohladi).
//   * O'chirilgan hisob tegilmaydi.
//   * Hech narsa o'chirilmaydi; Premium ustunlariga tegilmaydi.
//
// ═══ BIR MARTA ═══
//
// `app_migrations` jadvalidagi `launch_trial_90_v1` belgisi: avval
// `INSERT OR IGNORE`, qator haqiqatan qo'shilgandagina UPDATE ishlaydi.
// Bir vaqtda ikki chaqiruv kelsa ham faqat bittasi bajaradi. Kunlik
// cron'dan, "tugayapti" eslatmasidan OLDIN chaqiriladi — aks holda
// uzaytirilishi kerak bo'lgan odamga "sinov tugayapti" xabari ketardi.

export const LAUNCH_TRIAL_MIGRATION = 'launch_trial_90_v1';
const DAYS = 90;

// Sana uch shaklda uchraydi: 'YYYY-MM-DD HH:MM:SS', ISO ('...T...Z') va
// `H.nowTs()` / Postgres'dan ko'chganlar: 'YYYY-MM-DD HH:MM:SS.mmm+00'.
// SQLite `julianday()` '+00' ni TUSHUNMAYDI (NULL qaytaradi) — shuning
// uchun birinchi 19 belgigacha kesib, 'T' ni bo'sh joyga almashtiramiz
// (hammasi UTC). notifications.js ham shunday qiladi.
const JD = (col) => `julianday(substr(replace(${col}, 'T', ' '), 1, 19))`;
const NEW_END = (col) => `strftime('%Y-%m-%dT%H:%M:%fZ', ${JD(col)} + ${DAYS})`;
// Taxallussiz (`UPDATE t AS x` hamma SQLite versiyasida yo'q).
const WHERE = (extra = '') => `
  trial_expires_at IS NOT NULL AND created_at IS NOT NULL
  AND ${JD('created_at')} IS NOT NULL
  AND ${JD('created_at')} + ${DAYS} > julianday(?)
  AND ${JD('created_at')} + ${DAYS} > COALESCE(${JD('trial_expires_at')}, 0)
  ${extra}`;

async function hasColumn(env, table, column) {
  const r = await env.DB.prepare(`PRAGMA table_info(${table})`).all().catch(() => null);
  return (r?.results || []).some((c) => c.name === column);
}

/// Bir martalik uzaytirish. Qaytaradi: { applied: false } — avval
/// bajarilgan; { applied: true, users, companies } — hozir bajarildi.
export async function applyLaunchTrialExtension(env, { now = new Date() } = {}) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS "app_migrations" (
    name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL, detail TEXT
  )`).run();
  const nowIso = now.toISOString();

  // Ustunlar hali yo'q bo'lsa (juda eski baza) — belgini qo'ymaymiz:
  // ustunlar paydo bo'lgach keyingi cron'da bajariladi.
  const usersOk = await hasColumn(env, 'users', 'trial_expires_at');
  const companiesOk = await hasColumn(env, 'companies', 'trial_expires_at');
  if (!usersOk && !companiesOk) return { applied: false, reason: 'no_columns' };

  const flag = await env.DB.prepare(
    `INSERT OR IGNORE INTO app_migrations (name, applied_at) VALUES (?, ?)`
  ).bind(LAUNCH_TRIAL_MIGRATION, nowIso).run();
  if (!Number(flag?.meta?.changes || 0)) return { applied: false };

  let users = 0;
  let companies = 0;
  try {
    if (usersOk) {
      const deletedCol = await hasColumn(env, 'users', 'deleted_at');
      const r = await env.DB.prepare(
        `UPDATE users SET trial_expires_at = ${NEW_END('created_at')}
          WHERE ${WHERE(deletedCol ? 'AND deleted_at IS NULL' : '')}`
      ).bind(nowIso).run();
      users = Number(r?.meta?.changes || 0);
    }
    if (companiesOk) {
      const r = await env.DB.prepare(
        `UPDATE companies SET trial_expires_at = ${NEW_END('created_at')}
          WHERE ${WHERE()}`
      ).bind(nowIso).run();
      companies = Number(r?.meta?.changes || 0);
    }
  } catch (e) {
    // UPDATE yiqilsa belgi olib tashlanadi — keyingi cron qayta urinadi.
    // (UPDATE faqat muddatni UZAYTIRADI, qayta bajarilishi xavfsiz.)
    await env.DB.prepare(`DELETE FROM app_migrations WHERE name = ?`).bind(LAUNCH_TRIAL_MIGRATION).run().catch(() => {});
    throw e;
  }
  await env.DB.prepare(`UPDATE app_migrations SET detail = ? WHERE name = ?`)
    .bind(JSON.stringify({ users, companies }), LAUNCH_TRIAL_MIGRATION).run().catch(() => {});
  return { applied: true, users, companies };
}
