// hosting/api/engagement.js testi — haqiqiy worker.fetch + in-memory D1 (scripts/lib/d1-harness.mjs).
//   node scripts/test-engagement.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const setTier = (code, tier) => env.DB.prepare(`UPDATE cards SET tier_override = ? WHERE code = ?`).bind(tier, code).run();
const call = async (pathname, init) => {
  const res = await worker.fetch(req(pathname, init), env);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};
const event = (code, json, ip) => call(`/api/records/${code}/event`, { method: 'POST', json, ip });
const lead = (code, json, ip) => call(`/api/records/${code}/lead`, { method: 'POST', json, ip });

// =========================== events ===========================
{
  check('POST /event -> ok', await event('VIP001', { type: 'phone_click', ref: 'tel' }), { status: 200, body: { ok: true } });
  check('POST /event meta object -> ok (stored as ref)', (await event('VIP001', { type: 'link_click', meta: { url: 'https://x.uz' } })).status, 200);
  check('POST /event bad type -> 422', await event('VIP001', { type: 'hack' }), { status: 422, body: { error: 'bad_event' } });
  check('POST /event profile_view -> 422 (only via /view)', (await event('VIP001', { type: 'profile_view' })).status, 422);
  check('POST /event bad code -> 400', (await event('GOD123', { type: 'phone_click' })).status, 400);
  check('POST /event unknown record -> 404', (await event('ABC999', { type: 'phone_click' })).status, 404);
  const row = await env.DB.prepare(`SELECT event_type, ref, visitor_hash FROM card_events WHERE code = 'VIP001' ORDER BY id LIMIT 1`).first();
  checkTrue('event row stored with visitor hash', row.event_type === 'phone_click' && row.ref === 'tel' && /^[a-f0-9]{64}$/.test(row.visitor_hash));
  for (let i = 0; i < 27; i += 1) await event('VIP001', { type: 'telegram_click' }); // 2 + 27 = 29 ta
  check('event #30 within window -> 200', (await event('VIP001', { type: 'telegram_click' })).status, 200);
  check('event #31 same visitor/10min -> 429 rate_limited', await event('VIP001', { type: 'telegram_click' }), { status: 429, body: { error: 'rate_limited' } });
  check('event other visitor (ip) still -> 200', (await event('VIP001', { type: 'telegram_click' }, '198.51.100.9')).status, 200);
  check('event same visitor other code -> 200 (limit per code)', (await event('BIZ777', { type: 'telegram_click' })).status, 200);
  check('rate-limited event not stored', Number((await env.DB.prepare(`SELECT COUNT(*) AS n FROM card_events WHERE code = 'VIP001'`).first()).n), 31);
}

// =========================== analytics ===========================
{
  const ts = (d) => d.toISOString().replace('T', ' ').replace('Z', '+00');
  const now = new Date();
  const ago = (days) => ts(new Date(now.getTime() - days * 86400_000));
  const ins = (type, ref, vh, created) => env.DB.prepare(`INSERT INTO card_events (code, event_type, ref, visitor_hash, created_at) VALUES ('VIP001', ?, ?, ?, ?)`).bind(type, ref, vh, created).run();
  await ins('profile_view', 'nfc', 'v1', ago(0)); await ins('profile_view', 'qr', 'v1', ago(1)); await ins('profile_view', null, 'v2', ago(1));
  await ins('profile_view', 'nfc', 'v3', ago(40)); // 30 kundan tashqarida
  await env.DB.prepare(`UPDATE cards SET views = 77 WHERE code = 'VIP001'`).run();

  check('GET /analytics no session -> 401', (await call('/api/records/VIP001/analytics')).status, 401);
  check('GET /analytics not owner -> 403', (await call('/api/records/VIP001/analytics', { cookie: cookie.other })).status, 403);
  check('GET /analytics bad code -> 400', (await call('/api/records/GOD123/analytics', { cookie: cookie.user })).status, 400);
  await setTier('VIP001', 'gold');
  const a = await call('/api/records/VIP001/analytics', { cookie: cookie.user });
  check('GET /analytics (gold) advanced shape', [a.status, a.body.advanced, a.body.days, a.body.totalViews, a.body.uniqueVisitors, a.body.legacyViews], [200, true, 30, 3, 2, 77]);
  check('GET /analytics byType counts', [a.body.byType.profile_view, a.body.byType.phone_click, a.body.byType.telegram_click, a.body.byType.link_click], [3, 1, 29, 1]);
  checkTrue('GET /analytics byDay rows are {day:YYYY-MM-DD, n}', a.body.byDay.length >= 1 && a.body.byDay.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day) && typeof r.n === 'number') && a.body.byDay.reduce((s, r) => s + r.n, 0) === 3);
  check('GET /analytics byRef (non-view refs, n desc then ref)', a.body.byRef, [{ ref: 'tel', n: 1 }, { ref: '{"url":"https://x.uz"}', n: 1 }]);
  const a60 = await call('/api/records/VIP001/analytics?days=60', { cookie: cookie.user });
  check('GET /analytics?days=60 includes older view', [a60.body.days, a60.body.totalViews, a60.body.uniqueVisitors], [60, 4, 3]);
  await setTier('VIP001', 'silver');
  const b = await call('/api/records/VIP001/analytics?days=60', { cookie: cookie.user });
  check('GET /analytics (silver) basic shape, days forced 30', b.body, { advanced: false, days: 30, totalViews: 3, uniqueVisitors: 2, byType: a.body.byType, legacyViews: 77 });
}

// =========================== leads ===========================
{
  const good = { name: 'Vali', phone: '+998901234567', telegram: '@vali', note: 'Salom' };
  check('POST /lead bad code -> 400', (await lead('GOD123', good)).status, 400);
  check('POST /lead unknown record -> 404', (await lead('ABC999', good)).status, 404);
  check('POST /lead capture off -> 403 lead_disabled', await lead('VIP001', good), { status: 403, body: { error: 'lead_disabled' } });
  await env.DB.prepare(`UPDATE cards SET lead_capture = 1 WHERE code IN ('VIP001', 'OTH222')`).run();
  await setTier('VIP001', 'free');
  check('POST /lead free tier -> 403 lead_disabled', (await lead('VIP001', good)).body.error, 'lead_disabled');
  await setTier('VIP001', 'silver'); // kuniga 5
  check('POST /lead honeypot -> 200 ok, not stored', await lead('VIP001', { ...good, website_url: 'http://spam' }), { status: 200, body: { ok: true } });
  check('POST /lead name required -> 422', await lead('VIP001', { phone: '+998' }), { status: 422, body: { error: 'name_required' } });
  check('POST /lead contact required -> 422', await lead('VIP001', { name: 'X', company: 'Y' }), { status: 422, body: { error: 'contact_required' } });
  check('POST /lead -> 201 ok', await lead('VIP001', good), { status: 201, body: { ok: true } });
  const stored = await env.DB.prepare(`SELECT name, phone, telegram, note, visitor_hash FROM card_leads WHERE code = 'VIP001'`).first();
  checkTrue('lead stored (telegram @ stripped, visitor hash)', stored.name === 'Vali' && stored.telegram === 'vali' && stored.phone === '+998901234567' && /^[a-f0-9]{64}$/.test(stored.visitor_hash));
  check('lead event logged', Number((await env.DB.prepare(`SELECT COUNT(*) AS n FROM card_events WHERE code = 'VIP001' AND event_type = 'lead'`).first()).n), 1);
  await lead('VIP001', good); await lead('VIP001', good);
  check('POST /lead 4th same visitor/min -> 429 rate_limited', await lead('VIP001', good), { status: 429, body: { error: 'rate_limited' } });
  check('POST /lead other visitor -> 201', (await lead('VIP001', good, '198.51.100.9')).status, 201);
  await lead('VIP001', good, '198.51.100.9');
  check('POST /lead daily cap (silver 5) -> 429 lead_limit_reached', await lead('VIP001', good, '198.51.100.9'), { status: 429, body: { error: 'lead_limit_reached' } });
  check('POST /lead per-visitor limit spans codes (OTH222 gold, same visitor) -> 429', (await lead('OTH222', good)).status, 429);
  // Soatlik limit: 20 lead visitor_hash bo'yicha oxirgi soatda (daqiqa oynasidan tashqarida).
  await setTier('OTH222', 'gold');
  const vh = stored.visitor_hash;
  const old = new Date(Date.now() - 5 * 60_000).toISOString().replace('T', ' ').replace('Z', '+00');
  for (let i = 0; i < 17; i += 1) await env.DB.prepare(`INSERT INTO card_leads (code, name, phone, visitor_hash, created_at) VALUES ('OTH222', 'n', '1', ?, ?)`).bind(vh, old).run();
  check('POST /lead 21st same visitor/hour -> 429 rate_limited', await lead('OTH222', good), { status: 429, body: { error: 'rate_limited' } });

  check('GET /leads no session -> 401', (await call('/api/records/VIP001/leads')).status, 401);
  check('GET /leads not owner -> 403', (await call('/api/records/VIP001/leads', { cookie: cookie.other })).status, 403);
  const l = await call('/api/records/VIP001/leads', { cookie: cookie.user });
  check('GET /leads count', [l.status, l.body.leads.length], [200, 5]);
  check('GET /leads row shape', Object.keys(l.body.leads[0]), ['id', 'name', 'phone', 'telegram', 'whatsapp', 'email', 'company', 'note', 'createdAt']);
  check('GET /leads row values', [l.body.leads[0].name, l.body.leads[0].telegram, l.body.leads[0].whatsapp, l.body.leads[0].note], ['Vali', 'vali', null, 'Salom']);
  const id = l.body.leads[0].id;
  check('DELETE /leads/:id not owner -> 403', (await call(`/api/records/VIP001/leads/${id}`, { method: 'DELETE', cookie: cookie.other })).status, 403);
  check('DELETE /leads/:id -> ok', await call(`/api/records/VIP001/leads/${id}`, { method: 'DELETE', cookie: cookie.user }), { status: 200, body: { ok: true } });
  check('GET /leads after delete -> 4', (await call('/api/records/VIP001/leads', { cookie: cookie.user })).body.leads.length, 4);
  check('DELETE /leads/:id wrong code does not delete', (await call('/api/records/OTH222/leads/' + (await call('/api/records/VIP001/leads', { cookie: cookie.user })).body.leads[0].id, { method: 'DELETE', cookie: cookie.other })).status, 200);
  check('GET /leads still 4 (cross-code delete no-op)', (await call('/api/records/VIP001/leads', { cookie: cookie.user })).body.leads.length, 4);
}

// =========================== news view / like ===========================
{
  await env.DB.prepare(`INSERT INTO news (id, title, body) VALUES (1, 'Salom', 'Matn')`).run();
  check('POST /news/:id/view -> views 1', await call('/api/news/1/view', { method: 'POST' }), { status: 200, body: { ok: true, views: 1 } });
  check('POST /news/:id/view again -> views 2', (await call('/api/news/1/view', { method: 'POST' })).body.views, 2);
  check('POST /news/:id/view unknown -> 404', (await call('/api/news/999/view', { method: 'POST' })).status, 404);
  check('POST /news/:id/view bad id -> 400', await call('/api/news/abc/view', { method: 'POST' }), { status: 400, body: { error: 'bad_id' } });
  check('GET /news/:id/view -> not handled (404)', (await call('/api/news/1/view')).status, 404);
  check('POST /news/:id/like -> liked', await call('/api/news/1/like', { method: 'POST' }), { status: 200, body: { liked: true, count: 1, likes: 1 } });
  check('POST /news/:id/like again -> unliked', await call('/api/news/1/like', { method: 'POST' }), { status: 200, body: { liked: false, count: 0, likes: 0 } });
  check('POST /news/:id/like -> liked again', (await call('/api/news/1/like', { method: 'POST' })).body.liked, true);
  check('POST /news/:id/like other visitor -> count 2', await call('/api/news/1/like', { method: 'POST', ip: '198.51.100.9' }), { status: 200, body: { liked: true, count: 2, likes: 2 } });
  check('POST /news/:id/like unknown -> 404', (await call('/api/news/999/like', { method: 'POST' })).status, 404);
  const list = await call('/api/news');
  check('GET /api/news reflects likes + views for the visitor', [list.body.news[0]?.likeCount, list.body.news[0]?.views, list.body.liked], [2, 2, [1]]);
}

done();
