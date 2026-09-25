// hosting/api/music.js — NFCSTORE MUSIQA KUTUBXONASI (2026-09-25).
//
// Egasi: "reelsga musiqa qo'shadigan qilish kerak — rasm yoki video
// ustiga". 1-bosqich: admin kutubxonaga trek yuklaydi, ilova esa faqat
// YOQILGAN treklarni ko'radi. Treklar — egasining o'z kanalidagi
// qo'shiqlar va erkin litsenziyali (CC0 / public domain) musiqa.
// Har trekda `source` (manba / litsenziya) saqlanadi: shikoyat bo'lsa,
// qayerdan olingani darhol ko'rinadi.
//
// Fayllar mavjud R2 yo'li orqali yuklanadi: POST /api/admin/upload-audio
// (oqim, 100 MB) → `/uploads/music_…` manzili → shu modulga yoziladi.
//
// Marshrutlar:
//   GET    /api/music                 ?genre=&q= → { tracks, genres }  (ommaviy, faqat yoqilganlar)
//   GET    /api/admin/music           (admin)    → { tracks }
//   POST   /api/admin/music           (manager+) { title, artist, genre, source, audioUrl, clipUrl?, durationSec? }
//   PATCH  /api/admin/music/:id       (manager+) { title?, artist?, genre?, source?, enabled?, sort? }
//   DELETE /api/admin/music/:id       (manager+) — ishlatilgan trek o'chirilmaydi (409), yashiriladi

export const GENRES = ['Ta’sirli', 'Romantik', 'Quvnoq', 'Energiya', 'Zamonaviy', 'Milliy', 'Biznes', 'Chill', 'Klassik', 'Boshqa'];

let ready = null;
export function ensureMusic(env) {
  ready ||= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS music_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT 'Boshqa',
      duration_sec INTEGER NOT NULL DEFAULT 0,
      audio_url TEXT NOT NULL,
      clip_url TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      uses INTEGER NOT NULL DEFAULT 0,
      sort INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_music_enabled ON music_tracks(enabled, genre, sort)`),
  ]).catch((e) => { ready = null; throw e; });
  return ready;
}

const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
// Faqat o'zimizning R2 audio fayli: `/uploads/…` va audio kengaytmasi.
const audioUrl = (v) => {
  const s = String(v ?? '').trim();
  return /^\/uploads\/[\w\-./]{1,200}\.(mp3|m4a|aac|ogg|oga|wav)$/i.test(s) && !s.includes('..') ? s : '';
};
const genreOf = (v) => (GENRES.includes(String(v)) ? String(v) : 'Boshqa');

function toJson(r, admin = false) {
  const t = {
    id: Number(r.id),
    title: r.title,
    artist: r.artist || '',
    genre: r.genre || 'Boshqa',
    durationSec: Number(r.duration_sec || 0),
    audioUrl: r.audio_url,
    clipUrl: r.clip_url || '',
    uses: Number(r.uses || 0),
  };
  if (admin) {
    Object.assign(t, {
      source: r.source || '',
      enabled: Number(r.enabled) === 1,
      sort: Number(r.sort || 0),
      createdBy: r.created_by || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  }
  return t;
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

export async function handle(request, env, url, H) {
  const path = url.pathname;

  if (path === '/api/music') {
    if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    let rows = [];
    try {
      const where = ['enabled = 1'];
      const args = [];
      const g = url.searchParams.get('genre');
      if (g && GENRES.includes(g)) { where.push('genre = ?'); args.push(g); }
      const q = str(url.searchParams.get('q'), 60).toLowerCase().replace(/[%_]/g, '');
      if (q) { where.push('(LOWER(title) LIKE ? OR LOWER(artist) LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
      const r = await env.DB.prepare(
        `SELECT * FROM music_tracks WHERE ${where.join(' AND ')} ORDER BY sort DESC, uses DESC, id DESC LIMIT 200`
      ).bind(...args).all();
      rows = r.results || [];
    } catch (error) {
      // Kutubxona hali yaratilmagan — ilova bo'sh ro'yxat ko'radi, 503 emas.
      if (!/no such table/i.test(String(error?.message || error))) throw error;
    }
    return H.json({ tracks: rows.map((r) => toJson(r)), genres: GENRES });
  }

  if (path === '/api/admin/music') {
    const admin = await H.requireAdmin(request, env);
    if (!admin) return H.json({ error: 'unauthorized' }, 401);
    await ensureMusic(env);
    if (request.method === 'GET') {
      const r = await env.DB.prepare(`SELECT * FROM music_tracks ORDER BY id DESC LIMIT 500`).all();
      return H.json({ tracks: (r.results || []).map((x) => toJson(x, true)), genres: GENRES });
    }
    if (request.method !== 'POST') return H.json({ error: 'method_not_allowed' }, 405);
    if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
    const b = await readJson(request);
    const title = str(b.title, 120);
    const audio = audioUrl(b.audioUrl);
    if (!title) return H.json({ error: 'title_required' }, 422);
    if (!audio) return H.json({ error: 'bad_audio' }, 422);
    const clip = b.clipUrl ? audioUrl(b.clipUrl) : '';
    if (b.clipUrl && !clip) return H.json({ error: 'bad_clip' }, 422);
    const now = new Date().toISOString();
    const res = await env.DB.prepare(
      `INSERT INTO music_tracks (title, artist, genre, duration_sec, audio_url, clip_url, source, enabled, sort, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`
    ).bind(title, str(b.artist, 120), genreOf(b.genre), Math.max(0, Math.min(3600, Math.round(Number(b.durationSec) || 0))),
      audio, clip, str(b.source, 300), `admin#${Number(admin.adminId) || 0}:${String(admin.role || '')}`.slice(0, 60), now, now).run();
    const row = await env.DB.prepare(`SELECT * FROM music_tracks WHERE id = ?`).bind(res.meta?.last_row_id).first();
    return H.json({ ok: true, track: toJson(row, true) }, 201);
  }

  const one = path.match(/^\/api\/admin\/music\/(\d+)$/);
  if (one) {
    const admin = await H.requireAdmin(request, env);
    if (!admin) return H.json({ error: 'unauthorized' }, 401);
    if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
    await ensureMusic(env);
    const id = Number(one[1]);
    const row = await env.DB.prepare(`SELECT * FROM music_tracks WHERE id = ?`).bind(id).first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    if (request.method === 'DELETE') {
      // Postlarda ishlatilgan trek o'chirilmaydi — aks holda o'sha postlar
      // ovozsiz qoladi. Uni yashirish (enabled=0) kifoya.
      if (Number(row.uses) > 0) return H.json({ error: 'in_use', uses: Number(row.uses) }, 409);
      await env.DB.prepare(`DELETE FROM music_tracks WHERE id = ?`).bind(id).run();
      for (const u of [row.audio_url, row.clip_url]) {
        if (u && env.UPLOADS) await env.UPLOADS.delete(String(u).replace(/^\//, '')).catch(() => {});
      }
      return H.json({ ok: true });
    }
    if (request.method !== 'PATCH') return H.json({ error: 'method_not_allowed' }, 405);
    const b = await readJson(request);
    const set = [];
    const args = [];
    if ('title' in b) {
      const t = str(b.title, 120);
      if (!t) return H.json({ error: 'title_required' }, 422);
      set.push('title = ?'); args.push(t);
    }
    if ('artist' in b) { set.push('artist = ?'); args.push(str(b.artist, 120)); }
    if ('genre' in b) { set.push('genre = ?'); args.push(genreOf(b.genre)); }
    if ('source' in b) { set.push('source = ?'); args.push(str(b.source, 300)); }
    if ('enabled' in b) { set.push('enabled = ?'); args.push(b.enabled ? 1 : 0); }
    if ('sort' in b) { set.push('sort = ?'); args.push(Math.max(-1000, Math.min(1000, Math.round(Number(b.sort) || 0)))); }
    if (!set.length) return H.json({ error: 'nothing_to_update' }, 422);
    set.push('updated_at = ?'); args.push(new Date().toISOString());
    await env.DB.prepare(`UPDATE music_tracks SET ${set.join(', ')} WHERE id = ?`).bind(...args, id).run();
    const fresh = await env.DB.prepare(`SELECT * FROM music_tracks WHERE id = ?`).bind(id).first();
    return H.json({ ok: true, track: toJson(fresh, true) });
  }

  return null;
}
