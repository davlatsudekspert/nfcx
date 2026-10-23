// Aggregate-only owner report. No emails, names, tokens or message bodies.
const DAY = 86_400_000;
const SEC = (c) => `replace(substr(${c}, 1, 19), 'T', ' ')`;
const sec = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const REAL = `u.deleted_at IS NULL AND COALESCE(u.is_test,0) = 0 AND COALESCE(u.is_internal,0) = 0`;
const realIds = `SELECT u.id FROM users u WHERE ${REAL}`;
const n = (v) => v == null ? 'ma’lumot yo‘q' : String(Number(v));

export async function collectUsageDigest(env, now = Date.now()) {
  const from = sec(now - DAY), until = sec(now);
  const range = (c) => `${SEC(c)} >= ? AND ${SEC(c)} < ?`;
  const rows = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all();
  const tables = new Set((rows.results || []).map((r) => r.name));
  // A missing optional table is unavailable, never an invented zero.
  const count = async (table, sql, binds = [from, until]) => {
    if (!tables.has(table)) return null;
    try { return Number((await env.DB.prepare(sql).bind(...binds).first()).n); }
    catch { return null; }
  };
  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users u WHERE ${REAL}`).first();
  const [signups, active, firstApp, android, ios, profiles, contactSaves, phoneClicks, telegramClicks, websiteClicks, posts, comments] = await Promise.all([
    count('users', `SELECT COUNT(*) AS n FROM users u WHERE ${REAL} AND ${range('u.created_at')}`),
    count('app_users', `SELECT COUNT(*) AS n FROM app_users a JOIN users u ON u.id=a.user_id WHERE ${REAL} AND ${range('a.last_seen')}`),
    count('app_users', `SELECT COUNT(*) AS n FROM app_users a JOIN users u ON u.id=a.user_id WHERE ${REAL} AND ${range('a.first_seen')}`),
    count('app_users', `SELECT COUNT(*) AS n FROM app_users a JOIN users u ON u.id=a.user_id WHERE ${REAL} AND ${range('a.last_seen')} AND LOWER(a.platform) LIKE '%android%'`),
    count('app_users', `SELECT COUNT(*) AS n FROM app_users a JOIN users u ON u.id=a.user_id WHERE ${REAL} AND ${range('a.last_seen')} AND LOWER(a.platform) LIKE '%ios%'`),
    ...['profile_view','contact_save','phone_click','telegram_click','website_click'].map((kind) =>
      count('card_events', `SELECT COUNT(*) AS n FROM card_events e JOIN cards c ON c.code=e.code WHERE c.user_id IN (${realIds}) AND e.event_type=? AND ${range('e.created_at')}`, [kind,from,until])),
    count('posts', `SELECT COUNT(*) AS n FROM posts p WHERE p.user_id IN (${realIds}) AND ${range('p.created_at')}`),
    count('content_comments', `SELECT COUNT(*) AS n FROM content_comments c WHERE c.user_id IN (${realIds}) AND c.deleted_at IS NULL AND ${range('c.created_at')}`),
  ]);
  return { now: new Date(now).toISOString(), from: new Date(now-DAY).toISOString(), total: Number(total.n), signups, active, firstApp, android, ios, profiles, contactSaves, phoneClicks, telegramClicks, websiteClicks, posts, comments };
}

export function formatUsageDigest(d) {
  const local = (iso) => new Date(Date.parse(iso) + 5*3600_000).toISOString().slice(0,16).replace('T',' ');
  return [
    '📊 <b>NFCSTORE — foydalanuvchilar hisoboti</b>',
    `${local(d.from)} → ${local(d.now)} (Toshkent)`,
    '',
    `👥 Jami hisoblar: <b>${n(d.total)}</b>`,
    `🆕 Yangi ro‘yxatdan o‘tganlar (sayt + ilova): <b>${n(d.signups)}</b>`,
    `📱 Ilovaga kirgan hisoblar: <b>${n(d.active)}</b>`,
    `   Android: ${n(d.android)} · iOS: ${n(d.ios)}`,
    `🌱 Ilovaga ilk marta hisob bilan kirganlar: <b>${n(d.firstApp)}</b>`,
    '',
    '<b>Sayt va ilovadagi harakatlar — oxirgi 24 soat:</b>',
    `👁 Shaxsiy profil ko‘rishlari: ${n(d.profiles)}`,
    `📇 Kontaktni saqlash tugmasi: ${n(d.contactSaves)}`,
    `📞 Telefon tugmasi: ${n(d.phoneClicks)}`,
    `✈️ Telegram tugmasi: ${n(d.telegramClicks)}`,
    `🌐 Veb-sayt tugmasi: ${n(d.websiteClicks)}`,
    `📝 Yaratilgan shaxsiy postlar (hozir mavjud): ${n(d.posts)}`,
    `💬 Yangi izohlar (hozir mavjud): ${n(d.comments)}`,
    '',
    '⬇️ Play Market / App Store yuklab olishlari: ulanmagan.',
    'Ilovaga kirish yuklab olish soni emas. Mehmon kirishlari sanalmaydi. Sinov, ichki va o‘chirilgan hisoblar chiqarilgan. Profil tugmalari va postlar — shaxsiy profillar bo‘yicha. Izohlar — sayt va ilovada birga.',
  ].join('\n');
}

// One claim per Tashkent day; retry a failed delivery, recover abandoned
// claims after 10 minutes. Mark sent only after Telegram confirms delivery.
export async function runUsageDigest(env, H, now = Date.now()) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.ADMIN_CHAT_ID) return { skipped: 'not_configured' };
  const day = new Date(now + 5*3600_000).toISOString().slice(0,10);
  const key = `telegram_usage_digest:${day}`;
  const claim = String(now);
  const result = await env.DB.prepare(`INSERT INTO admin_settings (key,value) VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
    WHERE admin_settings.value <> 'sent' AND CAST(admin_settings.value AS INTEGER) < ?`)
    .bind(key,claim,now-600_000).run();
  if (!result?.meta?.changes) return { skipped: 'already_claimed' };
  try {
    const data = await collectUsageDigest(env, now);
    if (!await H.sendTelegramMessage(env, formatUsageDigest(data))) throw new Error('telegram_send_failed');
    await env.DB.prepare(`UPDATE admin_settings SET value='sent' WHERE key=? AND value=?`).bind(key,claim).run();
    return { sent: true };
  } catch (error) {
    await env.DB.prepare(`DELETE FROM admin_settings WHERE key=? AND value=?`).bind(key,claim).run();
    throw error;
  }
}

export async function handle(request, env, url, H) {
  if (url.pathname !== '/api/admin/usage-digest') return null;
  if (!['GET','POST'].includes(request.method)) return H.json({ error:'method_not_allowed' },405);
  const admin = await H.requireAdmin(request,env);
  if (!admin) return H.json({ error:'unauthorized' },401);
  if (admin.role !== 'super_admin') return H.json({ error:'forbidden' },403);
  if (request.method === 'POST' && await H.rateLimitD1(env,'usage-digest-manual',1,60_000)) return H.json({ error:'rate_limited' },429);
  const data = await collectUsageDigest(env);
  const text = formatUsageDigest(data);
  if (request.method === 'GET') return H.json({ data,text });
  const sent = await H.sendTelegramMessage(env,text);
  return H.json({ sent },sent ? 200 : 503);
}
