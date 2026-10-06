// UMUMIY BILDIRISHNOMA TIZIMI — ILOVA VA SAYT UCHUN BITTA.
//
// NIMA UCHUN BITTA JADVAL VA BITTA API:
//
// Ilova va sayt uchun alohida jadval qilinsa, "o'qildi" holati ikki
// joyda saqlanardi va ular hech qachon mos kelmasdi: odam saytda
// o'qigan bildirishnoma telefonda hali ham yangi bo'lib turardi.
// Shuning uchun holat FAQAT shu yerda, backendda turadi.
//
// SAQLANADIGAN MA'LUMOT — ENG KAMI.
//
// Ism, avatar va matn bu yerda SAQLANMAYDI: ular o'qish paytida
// `cards` dan olinadi. Sabab ikkita — odam ismini o'zgartirsa eski
// bildirishnomalar ham to'g'ri ko'rinadi, va jadvalda takrorlangan
// shaxsiy ma'lumot yotmaydi.
//
// MATN TILGA BOG'LIQ EMAS.
//
// Javobda `type` (follow/like/comment) va aktyor ismi keladi; jumlani
// mijozning o'zi o'z tilida yig'adi. Serverda tayyor jumla yozilsa,
// u yozilgan tilda muzlab qolardi.

// `support_reply` (2026-10) — admin murojaatga javob berdi. Aktyori yo'q
// (tizim nomidan): `title` bo'sh keladi, nishon — `support`/<murojaat ID>.
// Ro'yxat aktyorni LEFT JOIN bilan oladi, shuning uchun bunday qator
// tushib qolmaydi va o'qilmaganlar sanog'iga ham kiradi.
//
// `trial_ending` (2026-10) — bepul sinov 3 kun ichida tugaydi. Tizim nomidan
// (aktyor NULL), nishon `trial`/<tugash sanasi YYYY-MM-DD>. Kunlik cron
// yaratadi (`runTrialEndingReminders`); matnni mijoz yig'adi — xarid
// havolasi YO'Q (App Store qoidasi: neytral eslatma).
//
// `featured_open` (2026-10) — ko'tarish sotuvi ochildi; faqat bepul navbatga
// yozilganlarga, bir marta (api/featured.js `notifyWaitlist`). Aktyorsiz,
// nishon `featured`/''. Matnni mijoz yig'adi.
const KINDS = ['follow', 'like', 'comment', 'support_reply', 'trial_ending', 'featured_open'];
const PAGE = 30;
const PAGE_MAX = 50;

let schemaReady;

// ADDITIVE MIGRATSIYA — mavjud hech narsaga tegmaydi.
//
// Katta `ensureCoreSchema` batch'iga QO'SHILMADI: u yiqilsa butun
// sayt bilan birga yiqilardi. Alohida turgani uchun bu yerdagi xato
// faqat bildirishnomalarga ta'sir qiladi.
export async function ensureSchema(env) {
  if (!env.DB) throw new Error('d1_unavailable');
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY NOT NULL,
        recipient_user_id INTEGER NOT NULL,
        actor_user_id INTEGER,
        kind TEXT NOT NULL,
        target_type TEXT NOT NULL DEFAULT '',
        target_id TEXT NOT NULL DEFAULT '',
        target_code TEXT NOT NULL DEFAULT '',
        read_at TEXT,
        created_at TEXT NOT NULL
      )`),
      // Lenta: eng yangisi birinchi.
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_notif_recipient
        ON notifications(recipient_user_id, created_at DESC)`),
      // O'qilmaganlar sanog'i.
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_notif_unread
        ON notifications(recipient_user_id, read_at)`),
      // TAKRORLANISHNI BAZANING O'ZI TO'SADI.
      //
      // Kodda "avval tekshirib, keyin yozish" ishonchsiz: ikkita
      // so'rov bir vaqtda kelsa ikkalasi ham "yo'q ekan" deb
      // topadi. `INSERT OR IGNORE` bilan birga bu indeks qat'iy
      // kafolat beradi.
      //
      // `target_id` izohda AYNAN izoh ID'si bo'ladi, ya'ni ikkita
      // alohida izoh ikkita bildirishnoma beradi — bu to'g'ri.
      // Like va obunada esa u o'zgarmaydi va takrori to'siladi.
      // NULL emas, bo'sh satr ishlatiladi: SQLite'da NULL'lar
      // bir-biriga TENG EMAS va unique indeks ularni to'smasdi.
      env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedup
        ON notifications(recipient_user_id, actor_user_id, kind, target_type, target_id)`),
    ]).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

/// BILDIRISHNOMA YARATISH — ASOSIY AMALNI HECH QACHON BUZMAYDI.
///
/// Obuna/like/izoh yozilgandan KEYIN chaqiriladi. Bu yerdagi
/// istalgan xato yutiladi va logga yoziladi: bildirishnoma
/// yozilmagani uchun odamning izohi yo'qolib ketishi mumkin emas.
export async function createNotification(env, { recipientUserId, actorUserId, kind, targetType = '', targetId = '', targetCode = '', now }) {
  try {
    if (!KINDS.includes(kind)) return false;
    const to = Number(recipientUserId) || 0;
    const from = Number(actorUserId) || 0;
    if (!to) return false;
    // O'ZIGA BILDIRISHNOMA KELMAYDI.
    //
    // O'z postiga like bosgan yoki o'z postiga izoh yozgan odamga
    // xabar berishning ma'nosi yo'q — u nima qilganini biladi.
    if (to === from) return false;

    await ensureSchema(env);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO notifications
         (recipient_user_id, actor_user_id, kind, target_type, target_id, target_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(to, from || null, kind, String(targetType || ''), String(targetId || ''), String(targetCode || ''), now).run();
    return true;
  } catch (error) {
    // Ko'rinadigan bo'lsin, lekin chaqiruvchini yiqitmasin.
    console.error('notification create', kind, error?.message);
    return false;
  }
}

/// SINOV TUGAYAPTI — KUNLIK CRON (worker.js `scheduled`).
///
/// Sinovi 3 kun ichida tugaydigan, Premium'i yo'q, o'chirilmagan har bir
/// foydalanuvchiga BITTA `trial_ending` bildirishnomasi. Nishon ID —
/// tugash sanasi (Toshkent vaqti, YYYY-MM-DD): bir sinov uchun bir marta,
/// muddat o'zgarsa (masalan uzaytirilsa) yangi sana — yangi eslatma.
///
/// NIMA UCHUN `NOT EXISTS`: aktyor NULL, SQLite'da esa NULL'lar bir-biriga
/// teng emas — `idx_notif_dedup` bunday qatorlarni to'smaydi. Shuning uchun
/// takror bitta `INSERT ... SELECT` ichidagi shart bilan to'siladi (cron
/// kuniga bir marta ishlaydi; bitta statement — atomik).
///
/// Bir ishga tushishda ko'pi bilan `limit` ta (eng yaqin tugaydiganlar
/// birinchi). Hech qachon xato otmaydi — natija `{ created }` yoki `{ error }`.
export const TRIAL_REMIND_DAYS = 3;
export async function runTrialEndingReminders(env, { now = Date.now(), limit = 500 } = {}) {
  try {
    if (!env?.DB) return { created: 0, skipped: 'no_db' };
    const info = await env.DB.prepare(`PRAGMA table_info(users)`).all();
    const cols = new Set((info?.results || []).map((c) => String(c.name)));
    if (!cols.has('trial_expires_at')) return { created: 0, skipped: 'no_column' };
    await ensureSchema(env);
    const sec = (c) => `substr(replace(${c}, 'T', ' '), 1, 19)`;
    const at = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
    const nowIso = new Date(now).toISOString();
    // Toshkent sanasi (UTC+5). `datetime()` ni normallashtirilgan qiymat bilan
    // chaqiramiz ("…+00" shaklini SQLite tanimaydi).
    const dateSql = `date(${sec('u.trial_expires_at')}, '+5 hours')`;
    const premium = cols.has('premium_expires_at')
      ? `(COALESCE(u.is_premium, 0) = 1 OR COALESCE(u.premium_expires_at, '') > ?)`
      : `(COALESCE(u.is_premium, 0) = 1)`;
    const res = await env.DB.prepare(
      `INSERT INTO notifications
         (recipient_user_id, actor_user_id, kind, target_type, target_id, target_code, created_at)
       SELECT u.id, NULL, 'trial_ending', 'trial', ${dateSql}, '', ?
         FROM users u
        WHERE u.trial_expires_at IS NOT NULL AND u.trial_expires_at <> ''
          AND u.deleted_at IS NULL
          AND ${sec('u.trial_expires_at')} > ? AND ${sec('u.trial_expires_at')} <= ?
          AND ${dateSql} IS NOT NULL
          AND NOT ${premium}
          AND NOT EXISTS (SELECT 1 FROM notifications n
                           WHERE n.recipient_user_id = u.id AND n.kind = 'trial_ending'
                             AND n.target_type = 'trial' AND n.target_id = ${dateSql})
        ORDER BY ${sec('u.trial_expires_at')} ASC, u.id ASC
        LIMIT ?`
    ).bind(
      new Date(now).toISOString().replace('T', ' ').replace('Z', '+00'),
      at(now), at(now + TRIAL_REMIND_DAYS * 86_400_000),
      ...(cols.has('premium_expires_at') ? [nowIso] : []),
      Math.max(1, Math.min(2000, Number(limit) || 500)),
    ).run();
    return { created: Number(res?.meta?.changes || 0) };
  } catch (error) {
    console.error('trial_ending', String(error?.message || error).slice(0, 160));
    return { created: 0, error: true };
  }
}

// Aktyorning ko'rsatiladigan nomi va avatari — o'qish paytida
// `cards` dan. Asosiy (is_primary) karta olinadi.
// `cards` jadvalining kaliti `code` — `id` ustuni UMUMAN YO'Q.
// Birinchi yozganimda `ac.id` bo'yicha bog'lagandim va so'rov
// "no such column: ac.id" bilan yiqildi; buni shu fayl uchun
// yozilgan testning o'zi tutdi.
const ACTOR_SQL = `
  LEFT JOIN cards ac ON ac.code = (
    SELECT code FROM cards WHERE user_id = n.actor_user_id
     ORDER BY is_primary DESC, ts ASC LIMIT 1
  )`;

const rowToItem = (r) => ({
  id: Number(r.id),
  type: String(r.kind || ''),
  // Sarlavha — aktyorning ismi. Jumlani mijoz o'z tilida yig'adi.
  title: String(r.actor_name || '').trim(),
  subtitle: '',
  actorCode: String(r.actor_code || ''),
  avatarUrl: String(r.actor_avatar || ''),
  targetType: String(r.target_type || ''),
  targetId: String(r.target_id || ''),
  code: String(r.target_code || ''),
  read: !!r.read_at,
  createdAt: String(r.created_at || ''),
});

export async function handle(request, env, url, H) {
  const path = url.pathname;
  if (!path.startsWith('/api/notifications')) return null;

  const user = await H.getCurrentUser(request, env).catch(() => null);
  if (!user) return H.json({ error: 'unauthorized' }, 401);
  await ensureSchema(env);
  // MOBIL ILOVADA REKLAMA YO'Q (egasi, 2026-10-06): `featured_open`
  // (ko'tarish sotuvi ochildi) faqat SAYTDA ko'rinadi — ilova
  // (`x-app: nova` yoki `X-Client: android|ios|mobile`) ro'yxatida ham,
  // o'qilmaganlar sonida ham yo'q.
  const fromApp = String(request.headers.get('x-app') || '').toLowerCase() === 'nova' || H.isMobileClientD1(request);
  const hideSql = fromApp ? ` AND kind <> 'featured_open'` : '';

  // ── RO'YXAT ───────────────────────────────────────────────────
  if (path === '/api/notifications' && request.method === 'GET') {
    const limit = Math.min(PAGE_MAX, Math.max(1, Number(url.searchParams.get('limit')) || PAGE));
    // Kursor — oxirgi ko'rilgan ID. Offset ishlatilmadi: yangi
    // bildirishnoma kelsa offset sahifalarni surib yuborardi va
    // bitta yozuv ikki marta ko'rinardi.
    const cursor = Number(url.searchParams.get('cursor')) || 0;
    const unreadOnly = url.searchParams.get('unread') === '1';

    const where = [`n.recipient_user_id = ?`];
    const args = [user.id];
    if (cursor > 0) { where.push(`n.id < ?`); args.push(cursor); }
    if (unreadOnly) where.push(`n.read_at IS NULL`);
    if (fromApp) where.push(`n.kind <> 'featured_open'`);

    const rows = await env.DB.prepare(
      `SELECT n.id, n.kind, n.target_type, n.target_id, n.target_code, n.read_at, n.created_at,
              ac.name AS actor_name, ac.code AS actor_code, ac.avatar_url AS actor_avatar
         FROM notifications n ${ACTOR_SQL}
        WHERE ${where.join(' AND ')}
        ORDER BY n.id DESC LIMIT ?`
    ).bind(...args, limit + 1).all();

    const all = rows.results || [];
    const items = all.slice(0, limit).map(rowToItem);

    // IZOH QAYSI KONTENTGA YOZILGAN (egasi, 2026-10-05: "izohni bossam
    // 'topilmadi' chiqyapti"). Bildirishnomada faqat izoh ID'si
    // saqlanadi; ilova esa post yoki Reels'ni ochishi kerak. Shuning
    // uchun izohning kontenti (`contentKind`, `contentId`) qo'shib
    // beriladi. Faqat ro'yxatda izoh bo'lsa so'raladi; jadval yo'q
    // yoki xato bo'lsa maydonlar shunchaki chiqmaydi.
    const commentIds = items.filter((i) => i.targetType === 'comment' && Number(i.targetId) > 0)
      .map((i) => Number(i.targetId));
    if (commentIds.length) {
      const cm = await env.DB.prepare(
        `SELECT id, target_kind, target_id FROM content_comments
          WHERE id IN (${commentIds.map(() => '?').join(',')})`
      ).bind(...commentIds).all().catch(() => null);
      const byId = new Map((cm?.results || []).map((r) => [Number(r.id), r]));
      for (const it of items) {
        const c = it.targetType === 'comment' ? byId.get(Number(it.targetId)) : null;
        if (c) {
          it.contentKind = String(c.target_kind || '');
          it.contentId = String(c.target_id || '');
        }
      }
    }
    // Layk (shaxsiy post) — kontent o'zi nishon.
    for (const it of items) {
      if (it.targetType === 'post' && !it.contentKind) {
        it.contentKind = 'post';
        it.contentId = it.targetId;
      }
    }
    const unread = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND read_at IS NULL${hideSql}`
    ).bind(user.id).first();

    return H.json({
      items,
      unreadCount: Number(unread?.n) || 0,
      nextCursor: all.length > limit ? items[items.length - 1].id : null,
    });
  }

  // ── BITTASINI O'QILDI QILISH ──────────────────────────────────
  const readMatch = path.match(/^\/api\/notifications\/(\d{1,12})\/read$/);
  if (readMatch && request.method === 'POST') {
    const id = Number(readMatch[1]);
    // EGALIK SHARTI `UPDATE` NING O'ZIDA.
    //
    // Avval o'qib, keyin tekshirib, keyin yozish uch qadam va
    // ular orasida yozuv o'zgarishi mumkin. Bitta shart bilan
    // begona yozuvga umuman tegib bo'lmaydi.
    const res = await env.DB.prepare(
      `UPDATE notifications SET read_at = ?
        WHERE id = ? AND recipient_user_id = ? AND read_at IS NULL`
    ).bind(H.nowTs(), id, user.id).run();

    if (!Number(res?.meta?.changes || 0)) {
      // O'zgarmadi — yo begona, yo yo'q, yo ALLAQACHON o'qilgan.
      // Oxirgisi xato emas: takroriy so'rov xatosiz o'tishi kerak.
      const own = await env.DB.prepare(
        `SELECT id FROM notifications WHERE id = ? AND recipient_user_id = ?`
      ).bind(id, user.id).first();
      if (!own) return H.json({ error: 'not_found' }, 404);
    }
    const unread = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND read_at IS NULL${hideSql}`
    ).bind(user.id).first();
    return H.json({ ok: true, unreadCount: Number(unread?.n) || 0 });
  }

  // ── HAMMASINI O'QILDI QILISH ──────────────────────────────────
  if (path === '/api/notifications/read-all' && request.method === 'POST') {
    await env.DB.prepare(
      `UPDATE notifications SET read_at = ? WHERE recipient_user_id = ? AND read_at IS NULL`
    ).bind(H.nowTs(), user.id).run();
    return H.json({ ok: true, unreadCount: 0 });
  }

  return null;
}
