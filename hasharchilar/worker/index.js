// hasharchilar.uz — Hono API (Cloudflare Workers + D1 + R2)
import { Hono } from 'hono';
import { savePhoto, PhotoError } from './photos.js';
import { parsePhone, parseHasharFields, ValidationError } from './validate.js';

const app = new Hono();

// ---------- Yordamchilar ----------

/** Telefon bo'yicha foydalanuvchini topadi yoki yaratadi (ismni yangilaydi). */
async function upsertUser(db, name, phone) {
  const row = await db
    .prepare(
      `INSERT INTO users (phone, name) VALUES (?1, ?2)
       ON CONFLICT(phone) DO UPDATE SET name = excluded.name
       RETURNING id`,
    )
    .bind(phone, name)
    .first();
  return row.id;
}

/** Ro'yxat/yagona hashar uchun umumiy SELECT (qatnashuvchilar soni va rasmlar bilan). */
const HASHAR_SELECT = `
  SELECT h.id, h.title, h.description, h.address, h.lat, h.lng, h.date_time,
         h.items, h.status, h.created_at, u.name AS creator_name,
         (SELECT COUNT(*) FROM volunteers v WHERE v.hashar_id = h.id) AS volunteer_count,
         (SELECT r2_url FROM hashar_media m WHERE m.hashar_id = h.id AND m.photo_type = 'BEFORE' ORDER BY m.id DESC LIMIT 1) AS before_url,
         (SELECT r2_url FROM hashar_media m WHERE m.hashar_id = h.id AND m.photo_type = 'AFTER'  ORDER BY m.id DESC LIMIT 1) AS after_url
  FROM hashars h JOIN users u ON u.id = h.creator_id`;

const toDto = (r) => ({ ...r, items: JSON.parse(r.items || '[]') });

// ---------- Xatolarni qayta ishlash ----------

app.onError((err, c) => {
  if (err instanceof ValidationError || err instanceof PhotoError) {
    return c.json({ error: err.message }, 400);
  }
  console.error(err);
  return c.json({ error: 'Server xatosi' }, 500);
});

// ---------- Hasharlar ----------

// GET /api/hashars — kutilayotganlar sana bo'yicha, bajarilganlar eng yangisi birinchi
app.get('/api/hashars', async (c) => {
  const { results } = await c.env.DB.prepare(
    `${HASHAR_SELECT}
     ORDER BY (h.status = 'COMPLETED'),
              CASE WHEN h.status = 'PENDING' THEN h.date_time END ASC,
              h.date_time DESC
     LIMIT 300`,
  ).all();
  return c.json(results.map(toDto));
});

// POST /api/hashars — multipart/form-data: title, description, address, lat, lng,
// date_time, items (JSON), name, phone, photo (ixtiyoriy "BEFORE" rasm)
app.post('/api/hashars', async (c) => {
  const form = await c.req.formData();
  const f = parseHasharFields(form);
  const phone = parsePhone(form.get('phone'));
  const name = String(form.get('name') || '').trim().slice(0, 80);
  if (name.length < 2) throw new ValidationError('Ismingizni kiriting');

  const key = await savePhoto(c.env.PHOTOS, form.get('photo'), 'before');
  const creatorId = await upsertUser(c.env.DB, name, phone);

  const { id } = await c.env.DB.prepare(
    `INSERT INTO hashars (title, description, address, lat, lng, date_time, items, creator_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id`,
  )
    .bind(f.title, f.description, f.address, f.lat, f.lng, f.date_time, JSON.stringify(f.items), creatorId)
    .first();

  const batch = [
    // Tashkilotchi avtomatik qatnashuvchi hisoblanadi
    c.env.DB.prepare('INSERT OR IGNORE INTO volunteers (hashar_id, user_id) VALUES (?1, ?2)').bind(id, creatorId),
  ];
  if (key) {
    batch.push(
      c.env.DB.prepare("INSERT INTO hashar_media (hashar_id, photo_type, r2_url) VALUES (?1, 'BEFORE', ?2)").bind(id, `/api/media/${key}`),
    );
  }
  await c.env.DB.batch(batch);

  const row = await c.env.DB.prepare(`${HASHAR_SELECT} WHERE h.id = ?1`).bind(id).first();
  return c.json(toDto(row), 201);
});

// POST /api/hashars/:id/join — JSON { name, phone }; qayta bosilsa ham xato bermaydi
app.post('/api/hashars/:id/join', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const phone = parsePhone(body.phone);
  const name = String(body.name || '').trim().slice(0, 80);
  if (name.length < 2) throw new ValidationError('Ismingizni kiriting');

  const hashar = await c.env.DB.prepare('SELECT status FROM hashars WHERE id = ?1').bind(id).first();
  if (!hashar) return c.json({ error: 'Hashar topilmadi' }, 404);
  if (hashar.status === 'COMPLETED') return c.json({ error: 'Bu hashar yakunlangan' }, 409);

  const userId = await upsertUser(c.env.DB, name, phone);
  await c.env.DB.prepare('INSERT OR IGNORE INTO volunteers (hashar_id, user_id) VALUES (?1, ?2)').bind(id, userId).run();
  const { n } = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM volunteers WHERE hashar_id = ?1').bind(id).first();
  return c.json({ joined: true, volunteer_count: n });
});

// POST /api/hashars/:id/complete — multipart: phone (tashkilotchi), photo ("AFTER" rasm)
app.post('/api/hashars/:id/complete', async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.formData();
  const phone = parsePhone(form.get('phone'));

  const hashar = await c.env.DB.prepare(
    'SELECT h.status, u.phone FROM hashars h JOIN users u ON u.id = h.creator_id WHERE h.id = ?1',
  ).bind(id).first();
  if (!hashar) return c.json({ error: 'Hashar topilmadi' }, 404);
  if (hashar.phone !== phone) return c.json({ error: 'Faqat tashkilotchi yakunlay oladi' }, 403);

  const key = await savePhoto(c.env.PHOTOS, form.get('photo'), 'after');
  if (!key) throw new ValidationError('"Keyin" rasmini yuklang');

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE hashars SET status = 'COMPLETED' WHERE id = ?1").bind(id),
    c.env.DB.prepare("INSERT INTO hashar_media (hashar_id, photo_type, r2_url) VALUES (?1, 'AFTER', ?2)").bind(id, `/api/media/${key}`),
  ]);
  const row = await c.env.DB.prepare(`${HASHAR_SELECT} WHERE h.id = ?1`).bind(id).first();
  return c.json(toDto(row));
});

// ---------- Rasmlar (R2) ----------

app.get('/api/media/:folder/:file', async (c) => {
  const key = `${c.req.param('folder')}/${c.req.param('file')}`;
  const obj = await c.env.PHOTOS.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
});

app.notFound((c) => c.json({ error: 'Topilmadi' }, 404));

export default app;
