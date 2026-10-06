// PROMOKOD MUKOFOTI: HAR DO'ST UCHUN +30 KUN PREMIUM — hosting/api/referrals.js.
//   node scripts/test-referral-rewards.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-referral-rewards.mjs   (sqld adapteri)
//
// Tekshiriladi: 10% chegirma avvalgidek + Premium +30 kun; sinov paytida
// mukofot sinovdan keyin boshlanadi; mavjud Premium ustiga qo'shiladi;
// muddatsiz Premium va o'chirilgan taklif qiluvchi — yo'q; tasdiqlanmagan
// ro'yxat — yo'q (chegirma bor); bir do'st — bir marta; o'sha telefon — yo'q;
// yillik chegara (24); bildirishnoma (faqat ism); /i/:code (cookie + 302,
// noma'lum → '/'); cookie'dagi kod ro'yxatda ishlaydi; forma kodi ustun;
// /api/referrals/summary; admin reytingi; AASA'da /i/*.
// Production'ga HECH QACHON tegmaydi.
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker, sha256Hex } from './lib/d1-harness.mjs';
import { grantReferralReward, REFERRAL_REWARD_MAX_PER_YEAR } from '../hosting/api/referrals.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({}); // email xizmati o'chiq — tasdiq Telegram token orqali
await seedBasic(env);
const DAY = 86_400_000;
sqlite.prepare(`UPDATE users SET promo_code = 'ABC234' WHERE id = 1`).run();
sqlite.prepare(`UPDATE users SET promo_code = 'XYZ789' WHERE id = 2`).run();

let ipN = 1;
const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, { ip: `198.51.100.${ipN++ % 250}`, ...init }), env);
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body, headers: res.headers };
};
// Tasdiqlangan ro'yxat: Telegram orqali bog'langan telefon tokeni.
let phoneN = 4440000;
async function register({ promoCode, verified = true, phone, cookieHeader } = {}) {
  const ph = phone || `+99890${++phoneN}`;
  const body = { password: 'parol123', phone: ph, tosAccepted: true, ...(promoCode !== undefined ? { promoCode } : {}) };
  if (verified) {
    const token = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    sqlite.prepare(`INSERT INTO tg_link_tokens (token, status, phone, tg_user_id, expires_at, created_at) VALUES (?, 'linked', ?, 77, ?, ?)`)
      .run(sha256Hex(token), ph, Date.now() + 600_000, Date.now());
    body.linkToken = token;
  }
  const r = await call('/api/auth/register', { method: 'POST', json: body, ...(cookieHeader ? { cookie: cookieHeader } : {}) });
  return { ...r, id: r.body?.user?.id };
}
const user = (id) => sqlite.prepare(`SELECT premium_expires_at AS p, pending_discount_pct AS d, trial_expires_at AS t FROM users WHERE id = ?`).get(id);
const rewards = (id) => sqlite.prepare(`SELECT COUNT(*) AS n FROM referral_rewards WHERE referrer_id = ?`).get(id)?.n ?? 0;
const near = (iso, ms, tol = 10_000) => Number.isFinite(Date.parse(iso)) && Math.abs(Date.parse(iso) - ms) <= tol;

// ═══ 1. Asosiy: chegirma + 30 kun ═══
{
  sqlite.prepare(`UPDATE users SET trial_expires_at = NULL, premium_expires_at = NULL WHERE id = 1`).run();
  const r = await register({ promoCode: 'abc234' });
  check('1) ro‘yxat 201', r.status, 201);
  const u = user(1);
  check('1) 10% chegirma avvalgidek', u.d, 10);
  checkTrue(`1) Premium = hozir + 30 kun (${u.p})`, near(u.p, Date.now() + 30 * DAY));
  const row = sqlite.prepare(`SELECT referrer_id, referred_id, days, granted_until FROM referral_rewards WHERE referred_id = ?`).get(r.id);
  check('1) daftar', [row.referrer_id, row.referred_id, row.days, row.granted_until], [1, r.id, 30, u.p]);
  const n = (await call('/api/notifications', { cookie: cookie.user })).body.items.find((x) => x.type === 'referral_reward');
  check('1) bildirishnoma: referral_reward, nishon 30', n && [n.type, n.targetType, n.targetId], ['referral_reward', 'referral', '30']);
  checkTrue('1) bildirishnomada email/telefon yo‘q', n && !JSON.stringify(n).includes('@') && !JSON.stringify(n).includes('+998'));
  // Ikkinchi do'st — mavjud muddat ustiga.
  const before = Date.parse(user(1).p);
  await register({ promoCode: 'ABC234' });
  checkTrue('1) ikkinchi do‘st — ustiga +30 kun', near(user(1).p, before + 30 * DAY, 1000));
  check('1) chegirma 20%', user(1).d, 20);
}

// ═══ 2. Sinov paytida — mukofot sinovdan KEYIN ═══
{
  const trialEnd = Date.now() + 60 * DAY;
  sqlite.prepare(`UPDATE users SET premium_expires_at = NULL, trial_expires_at = ? WHERE id = 2`).run(new Date(trialEnd).toISOString());
  await register({ promoCode: 'XYZ789' });
  checkTrue('2) sinov tugashi + 30 kun', near(user(2).p, trialEnd + 30 * DAY, 1000));
  // Tugagan sinov hisobga olinmaydi.
  sqlite.prepare(`UPDATE users SET premium_expires_at = NULL, trial_expires_at = ? WHERE id = 2`).run(new Date(Date.now() - DAY).toISOString());
  await register({ promoCode: 'XYZ789' });
  checkTrue('2) tugagan sinov — hozir + 30 kun', near(user(2).p, Date.now() + 30 * DAY));
}

// ═══ 3. Mukofot berilmaydigan holatlar ═══
{
  // Tasdiqlanmagan ro'yxat (email xizmati o'chiq, Telegram tokeni yo'q).
  const p0 = user(1).p;
  const r = await register({ promoCode: 'ABC234', verified: false });
  check('3) tasdiqlanmagan — ro‘yxat 201, chegirma bor, Premium yo‘q', [r.status, user(1).d, user(1).p], [201, 30, p0]);
  checkTrue('3) tasdiqlanmagan — daftarda yo‘q', !sqlite.prepare(`SELECT 1 FROM referral_rewards WHERE referred_id = ?`).get(r.id));
  // Muddatsiz Premium.
  sqlite.prepare(`UPDATE users SET is_premium = 1 WHERE id = 2`).run();
  const p2 = user(2).p;
  await register({ promoCode: 'XYZ789' });
  check('3) muddatsiz Premium — o‘zgarmaydi', user(2).p, p2);
  sqlite.prepare(`UPDATE users SET is_premium = 0 WHERE id = 2`).run();
  // Bir do'st — bir marta (to'g'ridan-to'g'ri qayta chaqiruv).
  const again = await grantReferralReward(env, { nowTs: () => new Date().toISOString() }, 1, r.id - 1, { verified: true });
  check('3) o‘sha do‘st uchun qayta — already', again.reason, 'already');
  // O'zi.
  check('3) o‘zi — self', (await grantReferralReward(env, { nowTs: () => '' }, 1, 1, { verified: true })).reason, 'self');
  // O'sha telefon (o'chirilgan eski hisob raqami bilan qayta ochilgan).
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (50, 'same@t.local', 'x', '+998901111111')`).run();
  check('3) o‘sha telefon — self', (await grantReferralReward(env, { nowTs: () => '' }, 1, 50, { verified: true })).reason, 'self');
  // O'chirilgan taklif qiluvchi.
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, promo_code, deleted_at) VALUES (60, 'del@t.local', 'x', '+998906000000', 'DELREF', ?)`).run(new Date().toISOString());
  const rd = await register({ promoCode: 'DELREF' });
  check('3) o‘chirilgan taklif qiluvchi — mukofot yo‘q', [rd.status, rewards(60), user(60).p], [201, 0, null]);
}

// ═══ 4. Yillik chegara ═══
{
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, promo_code) VALUES (70, 'cap@t.local', 'x', '+998907000000', 'CAPREF')`).run();
  const nowIso = new Date().toISOString();
  for (let i = 0; i < REFERRAL_REWARD_MAX_PER_YEAR; i++) {
    sqlite.prepare(`INSERT INTO referral_rewards (referrer_id, referred_id, days, created_at, granted_until) VALUES (70, ?, 30, ?, ?)`).run(90000 + i, nowIso, nowIso);
  }
  const r = await register({ promoCode: 'CAPREF' });
  check('4) 24 ta — 25-chisi berilmaydi', [r.status, rewards(70), user(70).p], [201, REFERRAL_REWARD_MAX_PER_YEAR, null]);
  // Bir yildan eskilari hisobga olinmaydi.
  sqlite.prepare(`UPDATE referral_rewards SET created_at = ? WHERE referrer_id = 70`).run(new Date(Date.now() - 400 * DAY).toISOString());
  await register({ promoCode: 'CAPREF' });
  checkTrue('4) eskilari — chegara ochildi', near(user(70).p, Date.now() + 30 * DAY));
}

// ═══ 5. /i/:code va cookie ═══
{
  const r = await call('/i/abc234');
  check('5) to‘g‘ri kod — 302 /register?ref=', [r.status, r.headers.get('location')], [302, '/register?ref=ABC234']);
  const sc = r.headers.get('set-cookie') || '';
  checkTrue(`5) cookie nfc_ref, 30 kun, Lax (${sc})`, /^nfc_ref=ABC234; Path=\/; Max-Age=2592000; SameSite=Lax/.test(sc) && /Secure/.test(sc));
  const bad = await call('/i/NOPE99');
  check('5) noma’lum kod — 302 /, cookie yo‘q', [bad.status, bad.headers.get('location'), bad.headers.get('set-cookie')], [302, '/', null]);
  check('5) buzuq kod — /', (await call('/i/%3Cx%3E')).headers.get('location'), '/');
  // Cookie'dagi kod — forma bo'sh bo'lsa ishlaydi.
  const d0 = user(2).d;
  const rc = await register({ cookieHeader: 'nfc_ref=XYZ789' });
  check('5) cookie bilan ro‘yxat — taklif yozildi', [rc.status, user(2).d, !!sqlite.prepare(`SELECT 1 FROM referral_uses WHERE referrer_id = 2 AND referred_id = ?`).get(rc.id)], [201, d0 + 10, true]);
  // Formadagi kod ustun.
  const rf = await register({ promoCode: 'ABC234', cookieHeader: 'nfc_ref=XYZ789' });
  check('5) forma kodi ustun', sqlite.prepare(`SELECT referrer_id FROM referral_uses WHERE referred_id = ?`).get(rf.id).referrer_id, 1);
  // AASA: /i/* ilovaga.
  const aasa = await worker.fetch(req('/.well-known/apple-app-site-association'), env);
  checkTrue('5) AASA da /i/*', (await aasa.json()).applinks.details[0].components.some((c) => c['/'] === '/i/*'));
}

// ═══ 6. Xulosa ═══
{
  check('6) mehmon — 401', (await call('/api/referrals/summary')).status, 401);
  const s = (await call('/api/referrals/summary', { cookie: cookie.user })).body;
  const invited = sqlite.prepare(`SELECT COUNT(*) AS n FROM referral_uses WHERE referrer_id = 1`).get().n;
  const days = sqlite.prepare(`SELECT SUM(days) AS d FROM referral_rewards WHERE referrer_id = 1 AND granted_until IS NOT NULL`).get().d;
  check('6) shakli', s, { code: 'ABC234', link: 'https://nfcstore.uz/i/ABC234', invited, rewardedDays: days, nextRewardDays: 30 });
  checkTrue('6) taklif ≥ mukofot (tasdiqlanmagan sanaladi, mukofotsiz)', invited > days / 30);
  check('6) eski /api/referrals o‘zgarmagan', Object.keys((await call('/api/referrals', { cookie: cookie.user })).body), ['referrals']);
}

// ═══ 7. Admin reytingi ═══
{
  check('7) oddiy foydalanuvchi — 401', (await call('/api/admin/referrals/leaderboard', { cookie: cookie.user })).status, 401);
  // Eski taklif (40 kun oldin) — faqat "hammasi"da.
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (9999, 'old@t.local', 'x', '+998909999990')`).run();
  sqlite.prepare(`INSERT INTO referral_uses (referrer_id, referred_id, created_at) VALUES (2, 9999, ?)`).run(new Date(Date.now() - 40 * DAY).toISOString().replace('T', ' ').slice(0, 19));
  const lb = (await call('/api/admin/referrals/leaderboard', { cookie: cookie.admin })).body;
  const all1 = lb.allTime.find((x) => x.userId === 1);
  check('7) hammasi: user#1', all1 && [all1.code, all1.name, all1.count, all1.rewardedDays], ['ABC234', 'Muhammad', sqlite.prepare(`SELECT COUNT(*) AS n FROM referral_uses WHERE referrer_id = 1`).get().n,
    sqlite.prepare(`SELECT SUM(days) AS d FROM referral_rewards WHERE referrer_id = 1 AND granted_until IS NOT NULL`).get().d]);
  checkTrue('7) tartib: count kamayishi, rank 1..', lb.allTime.every((x, i) => x.rank === i + 1 && (i === 0 || lb.allTime[i - 1].count >= x.count)));
  const a2 = lb.allTime.find((x) => x.userId === 2), l2 = lb.last30.find((x) => x.userId === 2);
  check('7) 30 kun: eski taklif kirmaydi', l2.count, a2.count - 1);
  checkTrue('7) email/telefon yo‘q', !JSON.stringify(lb).includes('@') && !JSON.stringify(lb).includes('+998'));
}

done('Promokod mukofoti');
