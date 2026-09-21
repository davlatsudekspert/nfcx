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

const KINDS = ['follow', 'like', 'comment'];
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

    const rows = await env.DB.prepare(
      `SELECT n.id, n.kind, n.target_type, n.target_id, n.target_code, n.read_at, n.created_at,
              ac.name AS actor_name, ac.code AS actor_code, ac.avatar_url AS actor_avatar
         FROM notifications n ${ACTOR_SQL}
        WHERE ${where.join(' AND ')}
        ORDER BY n.id DESC LIMIT ?`
    ).bind(...args, limit + 1).all();

    const all = rows.results || [];
    const items = all.slice(0, limit).map(rowToItem);
    const unread = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND read_at IS NULL`
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
      `SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND read_at IS NULL`
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
