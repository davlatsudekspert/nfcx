import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initDb, isDbReady,
  listRecords, getRecord, createRecord, incrementViews,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const CODE_RE = /^[A-Z]{3}[0-9]{2}$/;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

function cleanStr(v, max) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function safeUrl(v) {
  const s = cleanStr(v, 500);
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : '';
  } catch {
    return '';
  }
}

function validateBody(body) {
  const name = cleanStr(body.name, 80);
  if (!name) return { error: "Ism bo'sh bo'lishi mumkin emas." };
  let hashtags = [];
  if (Array.isArray(body.hashtags)) {
    hashtags = body.hashtags
      .map((h) => cleanStr(h, 30).replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 20);
  }
  const price = Math.round(Number(body.price));
  if (!Number.isFinite(price) || price < 0 || price > 1000000000) {
    return { error: "Narx noto'g'ri." };
  }
  return {
    record: {
      name,
      role: cleanStr(body.role, 100),
      avatarUrl: safeUrl(body.avatarUrl),
      tg: cleanStr(body.tg, 40).replace(/^@/, ''),
      phone: cleanStr(body.phone, 24),
      email: cleanStr(body.email, 120),
      linkedin: cleanStr(body.linkedin, 200),
      instagram: cleanStr(body.instagram, 40).replace(/^@/, ''),
      hashtags,
      price,
    },
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: isDbReady() });
});

app.get('/api/records', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  try {
    res.json(await listRecords());
  } catch (err) {
    console.error('[api] listRecords:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.get('/api/records/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'bad_code' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  try {
    const rec = await getRecord(code);
    if (!rec) return res.status(404).json({ error: 'not_found' });
    res.json(rec);
  } catch (err) {
    console.error('[api] getRecord:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.post('/api/records/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'bad_code' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });

  const { record, error } = validateBody(req.body || {});
  if (error) return res.status(422).json({ error });

  try {
    const created = await createRecord({ ...record, code });
    if (!created) return res.status(409).json({ error: 'already_taken' });
    console.log(`[api] Band qilindi: ${code} — ${created.name}`);
    res.status(201).json(created);
  } catch (err) {
    console.error('[api] createRecord:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.post('/api/records/:code/view', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'bad_code' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  try {
    const views = await incrementViews(code);
    if (views === null) return res.status(404).json({ error: 'not_found' });
    res.json({ views });
  } catch (err) {
    console.error('[api] incrementViews:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_json' });
  }
  next(err);
});

const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

initDb()
  .catch((err) => console.error('[db] Ulanish xatosi:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`[server] BELGI server ${PORT}-portda ishga tushdi. DB: ${isDbReady() ? 'ulangan' : 'ulanmagan (fallback rejim)'}`);
    });
  });
