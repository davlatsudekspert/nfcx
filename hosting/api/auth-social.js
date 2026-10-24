// IJTIMOIY KIRISH — "Apple bilan" va "Google bilan".
//
//   POST /api/auth/social {provider, idToken, nonce?, name?}
//     → 200 {user:{id,email}, isNew:false, token?}   — tanish hisob
//     → 201 {user:{id,email}, isNew:true,  token?}   — yangi hisob
//     xatolar: 422 bad_request | 401 token_invalid | 403 account_deleted |
//              403 account_suspended | 429 too_many_requests |
//              503 social_login_disabled
//
// ────────────────────────────────────────────────────────────────────
// NIMA UCHUN BITTA ENDPOINT, IKKITA EMAS
//
// Apple va Google orasidagi YAGONA farq — imzoni qaysi kalitlar bilan
// tekshirish va `iss`/`aud` nima bo'lishi. Undan keyingi hamma narsa
// (hisobni topish, mavjudiga ulash, yangisini ochish, sessiya berish)
// AYNAN bir xil. Ikkita endpoint yozilsa, hisob ochish mantig'i ikki
// nusxa bo'lardi va vaqt o'tib ular bir-biridan uzoqlashardi — bittasida
// qo'riqchi qolib ketishi uchun shuning o'zi yetarli.
//
// Shuning uchun: pastdagi `PROVIDERS` — faqat SOZLAMA, kod bitta.
//
// ────────────────────────────────────────────────────────────────────
// MIJOZ HECH NARSANI HAL QILMAYDI
//
// Ilova serverga FAQAT `idToken` yuboradi. Email ham, foydalanuvchi ID
// ham yubormaydi — yuborsa ham ularga ishonilmaydi. Hisob kimniki
// ekani faqat IMZOSI TEKSHIRILGAN token ichidagi `sub` bilan
// aniqlanadi.
//
// ────────────────────────────────────────────────────────────────────
// HISOBNING KALITI — EMAIL EMAS, `sub`
//
// Apple foydalanuvchining haqiqiy manzilini YASHIRISHI mumkin
// (`...@privaterelay.appleid.com`) va ism/emailni FAQAT BIR MARTA,
// eng birinchi ruxsatda beradi. Demak emailni kalit qilib bo'lmaydi:
// ikkinchi kirishda u umuman kelmasligi mumkin. `sub` esa barqaror va
// har safar keladi — `user_identities` jadvali aynan shuni saqlaydi.

import { createAccountCore } from './auth.js';
import { b64ToBytes } from './apple-jws.js';

// ═══ PROVAYDERLAR ═══
//
// `clientIdsVar` — Cloudflare o'zgaruvchisining nomi. Qiymati vergul
// bilan ajratilgan ro'yxat, chunki bitta ilovaning bir nechta mijoz
// ID'si bo'ladi:
//   Apple  — iOS uchun bundle ID, sayt/Android uchun Services ID
//   Google — Web client ID, iOS client ID (Android AYNAN Web ID ni
//            ishlatadi, o'zining alohida `aud` i yo'q)
const PROVIDERS = {
  apple: {
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    issuers: ['https://appleid.apple.com'],
    clientIdsVar: 'APPLE_SIGNIN_CLIENT_IDS',
  },
  google: {
    // Google ikkala `iss` ni ham ishlatadi — ikkalasi ham haqiqiy.
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    clientIdsVar: 'GOOGLE_SIGNIN_CLIENT_IDS',
  },
};

// Soat farqiga yon berish. Telefon soati bir necha soniyaga qochishi
// odatiy hol; token muddati esa qisqa (Apple 10 daqiqa, Google 1 soat).
const CLOCK_SKEW_S = 120;

// Parol o'rniga yoziladigan belgi. `users.password_hash` ustuni
// `NOT NULL`, ijtimoiy hisobda esa parol YO'Q.
//
// Nima uchun ustunni "nullable" qilmadim: D1/SQLite'da ustun turini
// o'zgartirish jadvalni QAYTA QURISHNI talab qiladi, `users` ga esa
// o'nlab jadval tashqi kalit bilan bog'langan. Jonli bazada bu —
// keraksiz xavf.
//
// Nima uchun bu XAVFSIZ: `verifyPassword` saqlangan qiymatni `:` bo'yicha
// ikkiga bo'ladi va bo'lak topilmasa DARHOL `false` qaytaradi. Ya'ni
// bu belgi bilan parol orqali kirish MUMKIN EMAS — qanday parol
// terilmasin.
//
// Foydali yon ta'sir: odam keyinchalik "parolni unutdim" orqali o'ziga
// haqiqiy parol qo'ya oladi va hisobiga ikkala yo'l bilan ham kira
// boshlaydi.
const NO_PASSWORD = 'social-login-no-password';

// ═══ JADVAL ═══
//
// Nima uchun `users` ga `apple_sub`/`google_sub` ustunlari qo'shilmadi:
// har yangi provayderda yana bitta ustun va yana bitta migratsiya
// kerak bo'lardi. Alohida jadvalda esa bitta hisobga istalgancha
// provayder ulanadi va "qaysi hisobda qanday kirish bor" degan savolga
// bitta SELECT javob beradi.
// Isolate bo'yicha bir marta — lekin D1 va O'zbekiston bazasi uchun
// ALOHIDA. `api/iap-apple.js` dagi bilan bir xil naqsh: `env.DB` ikki
// xil bazaga ishora qilishi mumkin va jadval ikkalasida ham bo'lishi
// kerak. Bitta bayroq bilan keshlansa, ko'chirishdan keyin jadval
// yangi bazada yaratilmay qolardi.
const ready = {};
export function ensureSchema(env) {
  const key = env.UZ_STORE_ACTIVE ? 'uz' : 'd1';
  return (ready[key] ||= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_identities (
      provider   TEXT NOT NULL,
      subject    TEXT NOT NULL,
      user_id    INTEGER NOT NULL,
      email      TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (provider, subject)
    )`),
    // Hisob o'chirilganda uning kirishlarini topish uchun.
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_identities_user
      ON user_identities (user_id)`),
  ]).catch((e) => { delete ready[key]; throw e; }));
}

// ═══ JWKS ═══
//
// Kalitlar isolate xotirasida keshlanadi. Apple ham, Google ham
// kalitlarini ALMASHTIRIB turadi, shuning uchun:
//   • kesh muddati — 1 soat;
//   • kerakli `kid` keshda topilmasa, keshni chetlab bir marta QAYTA
//     olinadi. Aks holda kalit almashgan kuni butun kirish bir soatga
//     to'xtab qolardi.
const JWKS_TTL_MS = 60 * 60_000;
const jwksCache = new Map(); // url → { at, keys }

async function fetchJwks(url) {
  const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error('jwks_http_' + res.status);
  const body = await res.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  if (!keys.length) throw new Error('jwks_empty');
  jwksCache.set(url, { at: Date.now(), keys });
  return keys;
}

async function jwkFor(url, kid) {
  const hit = jwksCache.get(url);
  const fresh = hit && Date.now() - hit.at < JWKS_TTL_MS;
  if (fresh) {
    const found = hit.keys.find((k) => k.kid === kid);
    if (found) return found;
  }
  // Keshda yo'q yoki eskirgan — qayta olamiz.
  const keys = await fetchJwks(url);
  return keys.find((k) => k.kid === kid) || null;
}

// ═══ TOKENNI TEKSHIRISH ═══

const b64uJson = (part) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b64ToBytes(part)));

// Xato sababi `code` sifatida qaytadi — u LOGGA yoziladi, odamga esa
// har doim bitta umumiy xabar ko'rsatiladi. Sabab oddiy: "aud noto'g'ri"
// bilan "imzo noto'g'ri" ni ajratib ko'rsatish hujumchiga yordam beradi,
// haqiqiy foydalanuvchiga esa hech narsa bermaydi.
class TokenError extends Error {
  constructor(code) { super(code); this.code = code; }
}

async function verifyIdToken(provider, idToken, env) {
  const cfg = PROVIDERS[provider];
  const allowed = String(env[cfg.clientIdsVar] ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  // Sozlanmagan bo'lsa — "o'chiq", "hammaga ruxsat" EMAS. Bo'sh ro'yxatni
  // "tekshirmaslik" deb talqin qilish mumkin bo'lgan eng xavfli xato
  // bo'lardi: o'zgaruvchi tushib qolgan kuni istalgan ilovaning tokeni
  // qabul qilinardi.
  if (!allowed.length) throw new TokenError('not_configured');

  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw new TokenError('bad_format');

  let header; let claims;
  try {
    header = b64uJson(parts[0]);
    claims = b64uJson(parts[1]);
  } catch { throw new TokenError('bad_json'); }

  // Faqat RS256. Apple ham, Google ham shuni ishlatadi.
  //
  // `alg` ni tokenning O'ZIDAN olib ishonib bo'lmaydi: `alg: "none"`
  // yoki HMAC'ga almashtirish — JWT'ning klassik hujumi. Shuning uchun
  // u qiymat sifatida emas, SHART sifatida tekshiriladi.
  if (header?.alg !== 'RS256') throw new TokenError('bad_alg');
  if (!header?.kid) throw new TokenError('no_kid');

  if (!cfg.issuers.includes(String(claims?.iss))) throw new TokenError('bad_iss');

  // `aud` bitta satr yoki massiv bo'lishi mumkin (spetsifikatsiya).
  const auds = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
  if (!auds.some((a) => allowed.includes(String(a)))) throw new TokenError('bad_aud');

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(claims?.exp) || claims.exp + CLOCK_SKEW_S < now) throw new TokenError('expired');
  if (Number.isFinite(claims?.iat) && claims.iat - CLOCK_SKEW_S > now) throw new TokenError('future');

  const sub = String(claims?.sub || '');
  if (!sub) throw new TokenError('no_sub');

  const jwk = await jwkFor(cfg.jwksUrl, header.kid);
  if (!jwk) throw new TokenError('unknown_kid');

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key,
    b64ToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]),
  );
  if (!ok) throw new TokenError('bad_signature');

  return { sub, claims };
}

// NONCE — tokenni o'g'irlab qayta ishlatishga qarshi.
//
// Ilova tasodifiy satr ("xom nonce") yaratadi, Apple/Google'ga uning
// SHA-256 ini beradi, bizga esa XOMINI yuboradi. Biz xomining SHA-256
// ini hisoblab, token ichidagi `nonce` bilan solishtiramiz. Ya'ni
// tokenni ushlab qolgan odam xom nonce'ni bilmaydi va uni ishlata
// olmaydi.
//
// Google'ning ba'zi kutubxonalari esa nonce'ni XESHLAMASDAN uzatadi,
// shuning uchun ikkala shakl ham qabul qilinadi — xavfsizlik xususiyati
// o'zgarmaydi: har ikkalasida ham mijoz xom nonce'ni BILISHINI isbotlaydi.
//
// Token ichida `nonce` bo'lmasa (ba'zi native SDK'lar uni qo'ymaydi) —
// talab qilinmaydi. Token baribir imzolangan, qisqa muddatli va bizning
// `aud` ga bog'langan.
async function nonceOk(claims, rawNonce, H) {
  const want = claims?.nonce;
  if (!want) return true;
  const raw = String(rawNonce || '');
  if (!raw) return false;
  if (raw === want) return true;
  return (await H.sha256Hex(raw)) === String(want).toLowerCase();
}

// Apple `email_verified` ni ba'zan `true`, ba'zan `"true"` qilib
// yuboradi (hujjatlarida ham shunday). Ikkalasi ham qabul qilinadi.
const isVerified = (v) => v === true || v === 'true';

// Ichki (ko'rinmas) manzil. `users.email` ustuni `NOT NULL`, ijtimoiy
// kirishda esa email bo'lmasligi yoki tasdiqlanmagan bo'lishi mumkin.
//
// Nima uchun `H.placeholderEmailForD1` ISHLATILMADI: u telefon raqami
// uchun yozilgan va argumentdan RAQAM BO'LMAGAN hamma belgini olib
// tashlaydi. Apple'ning `sub` i esa `000123.abc.0001` ko'rinishida —
// undan faqat raqamlar qolsa, boshqa `sub` bilan to'qnashishi mumkin
// va ikki begona odam bitta hisobga tushib qolardi.
//
// SHA-256 esa barqaror (o'sha odam — har safar o'sha manzil) va
// to'qnashmaydi. Oxiri `H.PLACEHOLDER_EMAIL_HOST_D1` bilan tugaydi,
// ya'ni sayt uni odatdagidek "ko'rsatilmaydigan manzil" deb taniydi.
async function internalEmail(provider, sub, H) {
  const h = await H.sha256Hex(provider + ':' + sub);
  return 's' + h.slice(0, 32) + H.PLACEHOLDER_EMAIL_HOST_D1;
}

// ═══ ASOSIY OQIM ═══

async function socialLogin(request, env, H) {
  const body = await request.json().catch(() => ({}));
  const provider = String(body?.provider || '').toLowerCase();
  if (!PROVIDERS[provider]) return H.json({ error: 'bad_provider' }, 422);

  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';
  // 8 KB — eng uzun haqiqiy token ham bundan ancha kichik. Cheklov
  // bo'lmasa, kimdir megabaytlik "token" yuborib JSON parserni
  // ovora qilishi mumkin.
  if (!idToken || idToken.length > 8192) return H.json({ error: 'bad_request' }, 422);

  // IP bo'yicha chegara. Tekshiruvning o'zi arzon, lekin har chaqiruv
  // JWKS so'rovi va bazaga yozuvga olib kelishi mumkin.
  if (await H.rateLimitD1(env, 'social:ip:' + H.reqIp(request), 20, 15 * 60_000)) {
    return H.json({ error: 'too_many_requests' }, 429);
  }

  let verified;
  try {
    verified = await verifyIdToken(provider, idToken, env);
  } catch (err) {
    if (err instanceof TokenError) {
      // Sozlanmagan — bu foydalanuvchining xatosi emas, bizniki.
      if (err.code === 'not_configured') {
        console.error('auth-social: ' + provider + ' sozlanmagan');
        return H.json({ error: 'social_login_disabled' }, 503);
      }
      console.error('auth-social token rad etildi:', provider, err.code);
      return H.json({ error: 'token_invalid' }, 401);
    }
    // Tarmoq yoki JWKS xatosi — bu VAQTINCHALIK. 401 qaytarsak, ilova
    // "tokening yaroqsiz" deb odamni chiqarib yuborardi.
    console.error('auth-social tekshirib bo‘lmadi:', provider, err?.message || err);
    return H.json({ error: 'verification_unavailable' }, 503);
  }

  const { sub, claims } = verified;
  if (!(await nonceOk(claims, body?.nonce, H))) {
    console.error('auth-social nonce mos kelmadi:', provider);
    return H.json({ error: 'token_invalid' }, 401);
  }

  await ensureSchema(env);

  const email = H.cleanStr(claims?.email, 120).toLowerCase();
  const emailVerified = isVerified(claims?.email_verified) && !!email;

  // ── 1. Bu kirish allaqachon ulanganmi? ──
  const known = await env.DB.prepare(
    `SELECT user_id FROM user_identities WHERE provider = ? AND subject = ?`,
  ).bind(provider, sub).first();

  if (known) {
    const user = await loadUser(env, Number(known.user_id));
    // Hisob o'chirilgan bo'lsa, `user_identities` da yozuv qolib
    // ketishi mumkin (jadval tashqi kalitsiz — D1'da CASCADE ishonchli
    // emas). Shuning uchun hisob YO'Q bo'lsa, yozuvni tozalab,
    // "yangi odam" sifatida davom etamiz.
    if (!user) {
      await env.DB.prepare(`DELETE FROM user_identities WHERE provider = ? AND subject = ?`)
        .bind(provider, sub).run().catch(() => {});
    } else {
      const blocked = blockedResponse(user, H);
      if (blocked) return blocked;
      return respondWithSession(env, request, H, user, false);
    }
  }

  // ── 2. Tasdiqlangan email bo'yicha mavjud hisobga ulash ──
  //
  // Faqat provayder emailni TASDIQLAGAN bo'lsa. Aks holda begona odam
  // "men falonchiman" deb yozilgan token bilan o'zganing hisobiga
  // ulanib olardi.
  if (emailVerified) {
    const existing = await env.DB.prepare(
      `SELECT id, email, deleted_at, suspended_until, suspend_reason
         FROM users WHERE email = ?`,
    ).bind(email).first();
    if (existing) {
      const blocked = blockedResponse(existing, H);
      if (blocked) return blocked;
      await linkIdentity(env, H, provider, sub, Number(existing.id), email);
      return respondWithSession(env, request, H, existing, false);
    }
  }

  // ── 3. Yangi hisob ──
  //
  // DIQQAT, XAVFSIZLIK: hisobning manzili sifatida token emaili FAQAT
  // TASDIQLANGAN bo'lsa ishlatiladi.
  //
  // Ilgari bu yerda `email || placeholder` turardi va u teshik edi:
  // tasdiqlanmagan email bilan kelgan token 2-bosqichdan o'tmasdi,
  // lekin INSERT `ON CONFLICT (email) DO NOTHING` ga urilib, pastdagi
  // "poyga" shoxiga tushardi — va o'sha yerda begona odamning hisobiga
  // ULANIB olardi. Ya'ni "tasdiqlangan bo'lsagina ulaymiz" qoidasi
  // orqa eshikdan aylanib o'tilardi. Buni test topdi
  // (`scripts/test-auth-social.mjs`, 6-bo'lim).
  const accountEmail = emailVerified ? email : await internalEmail(provider, sub, H);

  const created = await createAccountCore(env, H, {
    email: accountEmail,
    passwordHash: NO_PASSWORD,
    phone: null,
    botAck: false,
    // Ilovada "Apple/Google bilan davom etish" tugmasining ostida
    // shartlar havolasi turadi — bosish roziliq bildirish demak.
    tosAccepted: true,
    source: H.signupSourceD1 ? H.signupSourceD1(request) : 'web',
  });

  if (!created) {
    // `ON CONFLICT (email) DO NOTHING` — demak shu email bilan hisob
    // ayni damda yaratildi (parallel so'rov). Uni topib, ulaymiz.
    const racer = await env.DB.prepare(
      `SELECT id, email, deleted_at, suspended_until, suspend_reason FROM users WHERE email = ?`,
    ).bind(accountEmail).first();
    if (!racer) return H.json({ error: 'account_create_failed' }, 500);
    const blocked = blockedResponse(racer, H);
    if (blocked) return blocked;
    await linkIdentity(env, H, provider, sub, Number(racer.id), email);
    return respondWithSession(env, request, H, racer, false);
  }

  await linkIdentity(env, H, provider, sub, Number(created.id), email);

  // Apple ismni FAQAT BIR MARTA, eng birinchi ruxsatda beradi. Shuning
  // uchun u aynan shu yerda — hisob ochilayotgan paytda — kartaga
  // yoziladi. Keyingi kirishlarda ism umuman kelmaydi.
  const name = H.cleanStr(body?.name, 60);
  if (name) {
    await env.DB.prepare(
      `UPDATE cards SET name = ? WHERE user_id = ? AND is_primary = 1`,
    ).bind(name, created.id).run().catch(() => {});
  }

  return respondWithSession(env, request, H, created, true);
}

function loadUser(env, id) {
  return env.DB.prepare(
    `SELECT id, email, deleted_at, suspended_until, suspend_reason FROM users WHERE id = ?`,
  ).bind(id).first();
}

// O'chirilgan / to'xtatilgan hisob — `/api/auth/login` bilan AYNAN bir
// xil javob. Ilova bu holatlarni allaqachon biladi, ikkinchi shakl
// o'ylab topilmaydi.
function blockedResponse(user, H) {
  if (user.deleted_at) return H.json({ error: 'account_deleted' }, 403);
  if (user.suspended_until && H.parseDbDate(user.suspended_until) > new Date()) {
    return H.json({
      error: 'account_suspended',
      suspendedUntil: user.suspended_until,
      reason: user.suspend_reason,
    }, 403);
  }
  return null;
}

function linkIdentity(env, H, provider, subject, userId, email) {
  return env.DB.prepare(
    `INSERT INTO user_identities (provider, subject, user_id, email, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (provider, subject) DO UPDATE SET email = excluded.email`,
  ).bind(provider, subject, userId, email || null, H.nowTs()).run();
}

// Sessiya YANGIDAN yozilmaydi: `/api/auth/login` nima qilsa, shu
// qilinadi — o'sha cookie, `X-Client` mobil bo'lsa o'sha token javob
// tanasida.
async function respondWithSession(env, request, H, user, isNew) {
  const s = await H.createUserSession(env, user.id, request);
  const wantsToken = H.isMobileClientD1(request);
  return H.jsonWithCookie({
    user: { id: user.id, email: H.publicEmailD1(user.email) },
    isNew,
    ...(wantsToken ? { token: s.token } : {}),
  }, isNew ? 201 : 200, s.cookie);
}

// ═══ ILOVA UCHUN SOZLAMA ═══
//
// Mijoz ID'lari ILOVAGA QOTIRILMAYDI. Ular sir emas, lekin ALMASHISHI
// mumkin (client qayta yaratiladi, iOS uchun yangisi qo'shiladi) —
// qotirilsa, har almashganda App Store va Play orqali yangi versiya
// chiqarishga to'g'ri kelardi va eski versiyalardagi odamlar kira
// olmay qolardi. `GET /api/iap/apple/config` ham aynan shu sababdan bor.
//
// `serverClientId` — Google'ning eng chalkash joyi: Android ilova
// AYNAN Web client ID bilan ishlaydi, o'zining Android client ID si
// bilan emas (Android client faqat ilova imzosini tanitadi).
// Standart qiymat — ro'yxatdagi BIRINCHI ID; aniqroq qilish kerak
// bo'lsa `GOOGLE_SIGNIN_SERVER_CLIENT_ID` alohida qo'yiladi.
function socialConfig(env, H) {
  const list = (v) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const google = list(env.GOOGLE_SIGNIN_CLIENT_IDS);
  const apple = list(env.APPLE_SIGNIN_CLIENT_IDS);

  return H.json({
    google: {
      enabled: google.length > 0,
      serverClientId: String(env.GOOGLE_SIGNIN_SERVER_CLIENT_ID || google[0] || ''),
      // iOS'da `google_sign_in` ilovaning O'Z client ID sini ham
      // so'raydi. U yaratilmaguncha bo'sh — ilova iOS'da Google
      // tugmasini ko'rsatmaydi.
      iosClientId: String(env.GOOGLE_SIGNIN_IOS_CLIENT_ID || ''),
    },
    apple: {
      enabled: apple.length > 0,
      // ANDROID va SAYT uchun: u yerda Apple bundle ID bilan emas,
      // Services ID bilan ishlaydi. Bo'sh bo'lsa ilova Android'da
      // Apple tugmasini ko'rsatmaydi (iOS'da u baribir kerak emas).
      serviceId: String(env.APPLE_SIGNIN_SERVICE_ID || ''),
      redirectUri: String(env.APPLE_SIGNIN_REDIRECT_URI || 'https://nfcstore.uz/api/auth/apple/callback'),
    },
  }, 200, { 'cache-control': 'public, max-age=300' });
}

export async function handle(request, env, url, H) {
  if (url.pathname === '/api/auth/social/config' && request.method === 'GET') {
    return socialConfig(env, H);
  }
  if (url.pathname === '/api/auth/social' && request.method === 'POST') {
    return socialLogin(request, env, H);
  }
  return null;
}
