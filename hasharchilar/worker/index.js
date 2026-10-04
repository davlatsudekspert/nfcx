// hasharchilar.uz — Hono API (Cloudflare Workers + D1 + R2).
// Statik React build (dist/) Workers Static Assets orqali beriladi; bu yerga faqat /api/* keladi.
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authRoutes, optionalAuth } from './auth.js';
import { getStats, hasharRoutes } from './hashars.js';
import { mediaRoutes } from './media.js';
import { HttpError } from './validate.js';

const app = new Hono();

// ---------- CORS (sayt, Capacitor APK, lokal dev) ----------

const ALLOWED_ORIGINS = new Set([
  'https://localhost', // Capacitor Android (androidScheme: https)
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:5173', // Vite dev
]);

/** Ruxsat etilgan origin yoki null. So'rov kelgan host'ning o'zi ham ruxsat etiladi. */
function allowedOrigin(origin, requestUrl) {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  try {
    const o = new URL(origin);
    if ((o.protocol === 'https:' || o.protocol === 'http:') && o.host === new URL(requestUrl).host) return origin;
  } catch {
    // "null" yoki buzilgan origin
  }
  return null;
}

app.use('/api/*', async (c, next) => {
  const allow = allowedOrigin(c.req.header('origin'), c.req.url);

  // Preflight
  if (c.req.method === 'OPTIONS') {
    const headers = { vary: 'Origin' };
    if (allow) {
      Object.assign(headers, {
        'access-control-allow-origin': allow,
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-allow-headers': 'Authorization, Content-Type',
        'access-control-max-age': '86400',
      });
    }
    return new Response(null, { status: 204, headers });
  }

  await next();

  const h = c.res.headers;
  h.append('vary', 'Origin');
  if (allow) h.set('access-control-allow-origin', allow);
  h.set('x-content-type-options', 'nosniff');
  // JSON javoblar keshlanmaydi (rasm/APK o'z cache-control'ini qo'yadi)
  if (!h.has('cache-control')) h.set('cache-control', 'no-store');
});

// ---------- Autentifikatsiya (mehmon ham o'tadi; majburiylari requireAuth bilan) ----------

app.use('/api/*', optionalAuth);

// ---------- Marshrutlar ----------

app.get('/api/health', (c) => c.json({ ok: true }));
app.get('/api/stats', getStats);
app.route('/api', authRoutes); // /api/auth/*, /api/me
app.route('/api/hashars', hasharRoutes);
app.route('/api', mediaRoutes); // /api/media/*, /api/app, /api/app/download

// ---------- Xatolar ----------

app.notFound((c) => c.json({ error: 'Topilmadi' }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    if (err.headers) for (const [k, v] of Object.entries(err.headers)) c.header(k, v);
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof HTTPException && err.status < 500) {
    return c.json({ error: "So'rov noto'g'ri" }, err.status);
  }
  console.error(err);
  return c.json({ error: 'Server xatosi' }, 500);
});

export default app;
