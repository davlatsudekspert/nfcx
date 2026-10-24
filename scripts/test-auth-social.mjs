// IJTIMOIY KIRISH (hosting/api/auth-social.js).
//   node scripts/test-auth-social.mjs
//
// Haqiqiy worker.fetch + xotiradagi baza (scripts/lib/social-fixture.mjs).
// Tokenlar HAQIQIY RSA kaliti bilan imzolanadi, JWKS esa `fetch` ni
// vaqtincha almashtirib beriladi — ya'ni tekshiruv kodi to'liq, chinakam
// kriptografiya bilan bosib o'tiladi.
//
// Tekshiriladi: sozlanmagan provayder; buzilgan imzo; begona `aud`;
// begona `iss`; muddati o'tgan; `alg` almashtirish; noma'lum `kid`;
// yangi hisob (bepul ID bilan); o'sha `sub` qayta kirishi; tasdiqlangan
// email bo'yicha mavjud hisobga ulanish; TASDIQLANMAGAN email ulanmasligi;
// nonce (xom va SHA-256); o'chirilgan/to'xtatilgan hisob; ijtimoiy hisobga
// parol bilan kirib bo'lmasligi; mobil tokeni; tezlik chegarasi.
// Production'ga HECH QACHON tegmaydi.
import { setupSocial, makeChecker } from './lib/social-fixture.mjs';

const { check, checkTrue, done } = makeChecker();

const APPLE_AUD = 'uz.nfcstore.nova';
const GOOGLE_AUD = '726729921103-test.apps.googleusercontent.com';

const { env, sqlite, call, resetLimits } = await setupSocial({
  APPLE_SIGNIN_CLIENT_IDS: `${APPLE_AUD},uz.nfcstore.signin`,
  GOOGLE_SIGNIN_CLIENT_IDS: GOOGLE_AUD,
});

// ═══ KALITLAR VA SOXTA JWKS ═══
const kp = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
);
// Ikkinchi kalit — "boshqa kalit bilan imzolangan token" holati uchun.
const other = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
);

const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
const JWKS = { keys: [{ kty: jwk.kty, n: jwk.n, e: jwk.e, kid: 'k1', alg: 'RS256', use: 'sig' }] };

const APPLE_JWKS = 'https://appleid.apple.com/auth/keys';
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';

let jwksHits = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const u = String(input?.url || input);
  if (u === APPLE_JWKS || u === GOOGLE_JWKS) {
    jwksHits++;
    return new Response(JSON.stringify(JWKS), { headers: { 'content-type': 'application/json' } });
  }
  // Testda tashqi tarmoqqa chiqilmaydi (Telegram va h.k. jim qolsin).
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
};

const b64u = (b) => Buffer.from(b).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

async function sign(claims, { kid = 'k1', alg = 'RS256', key = kp.privateKey, breakSig = false } = {}) {
  const h = b64u(JSON.stringify({ alg, kid, typ: 'JWT' }));
  const p = b64u(JSON.stringify(claims));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${h}.${p}`));
  const bytes = new Uint8Array(sig);
  if (breakSig) bytes[0] ^= 0xff;
  return `${h}.${p}.${b64u(bytes)}`;
}

const appleClaims = (o = {}) => ({
  iss: 'https://appleid.apple.com', aud: APPLE_AUD,
  sub: '000123.abc.0001', iat: now(), exp: now() + 600,
  email: 'olma@example.com', email_verified: 'true', ...o,
});
const googleClaims = (o = {}) => ({
  iss: 'https://accounts.google.com', aud: GOOGLE_AUD,
  sub: 'g-10001', iat: now(), exp: now() + 3600,
  email: 'olma@example.com', email_verified: true, ...o,
});

const social = (json, init = {}) => { resetLimits(); return call('/api/auth/social', { method: 'POST', json, ...init }); };

const userIdOf = (email) => sqlite.prepare(`SELECT id FROM users WHERE email = ?`).get(email)?.id ?? null;
const identityRow = (provider, subject) => sqlite.prepare(
  `SELECT user_id, email FROM user_identities WHERE provider = ? AND subject = ?`).get(provider, subject) ?? null;

console.log('\n── 1. Sozlanmagan provayder ──');
{
  const saved = env.GOOGLE_SIGNIN_CLIENT_IDS;
  delete env.GOOGLE_SIGNIN_CLIENT_IDS;
  const r = await social({ provider: 'google', idToken: await sign(googleClaims()) });
  check('sozlanmagan → 503 social_login_disabled', [r.status, r.body?.error], [503, 'social_login_disabled']);
  env.GOOGLE_SIGNIN_CLIENT_IDS = saved;
}

console.log('\n── 2. Rad etiladigan tokenlar ──');
{
  const usersAtStart = sqlite.prepare(`SELECT COUNT(*) c FROM users`).get().c;
  const bad = [
    ['noma\'lum provayder', { provider: 'vk', idToken: 'a.b.c' }, 422, 'bad_provider'],
    ['token yo\'q', { provider: 'apple', idToken: '' }, 422, 'bad_request'],
    ['juda uzun token', { provider: 'apple', idToken: 'x'.repeat(8193) }, 422, 'bad_request'],
    ['shakli buzuq', { provider: 'apple', idToken: 'faqat.ikki' }, 401, 'token_invalid'],
  ];
  for (const [label, json, status, error] of bad) {
    const r = await social(json);
    check(label, [r.status, r.body?.error], [status, error]);
  }

  const cases = [
    ['buzilgan imzo', await sign(appleClaims(), { breakSig: true })],
    ['boshqa kalit bilan imzolangan', await sign(appleClaims(), { key: other.privateKey })],
    ['begona aud', await sign(appleClaims({ aud: 'uz.begona.ilova' }))],
    ['begona iss', await sign(appleClaims({ iss: 'https://evil.example' }))],
    ['muddati o\'tgan', await sign(appleClaims({ exp: now() - 3600, iat: now() - 7200 }))],
    ['kelajakdagi iat', await sign(appleClaims({ iat: now() + 3600 }))],
    ['sub yo\'q', await sign(appleClaims({ sub: '' }))],
    ['noma\'lum kid', await sign(appleClaims(), { kid: 'yo\'q-kalit' })],
    ['alg almashtirilgan (HS256)', await sign(appleClaims(), { alg: 'HS256' })],
    ['alg: none', `${b64u(JSON.stringify({ alg: 'none', kid: 'k1' }))}.${b64u(JSON.stringify(appleClaims()))}.`],
  ];
  for (const [label, idToken] of cases) {
    const r = await social({ provider: 'apple', idToken });
    check(label + ' → 401', [r.status, r.body?.error], [401, 'token_invalid']);
  }
  // Jadval hali YARATILMAGAN bo'lishi kerak: `ensureSchema` faqat token
  // tekshiruvdan o'tgandan KEYIN chaqiriladi, ya'ni yaroqsiz token
  // bazaga umuman tegmaydi.
  const tbl = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_identities'`).get();
  check('yaroqsiz token bazaga tegmadi', tbl, undefined);
  check('hisob ochilmadi', sqlite.prepare(`SELECT COUNT(*) c FROM users`).get().c, usersAtStart);
}

console.log('\n── 3. Yangi hisob ──');
let appleUserId = null;
{
  const r = await social({ provider: 'apple', idToken: await sign(appleClaims()), name: 'Olma Egasi' });
  check('yangi hisob → 201 isNew', [r.status, r.body?.isNew], [201, true]);
  appleUserId = r.body?.user?.id;
  checkTrue('user.id qaytdi', Number.isInteger(appleUserId));
  check('identity yozildi', identityRow('apple', '000123.abc.0001')?.user_id, appleUserId);
  check('email bo\'yicha hisob bor', userIdOf('olma@example.com'), appleUserId);

  const card = sqlite.prepare(`SELECT code, name, is_primary, profile_type FROM cards WHERE user_id = ?`).get(appleUserId);
  checkTrue('bepul ID berildi', !!card?.code);
  check('karta asosiy va shaxsiy', [card?.is_primary, card?.profile_type], [1, 'personal']);
  check('Apple bergan ism kartaga yozildi', card?.name, 'Olma Egasi');

  const promo = sqlite.prepare(`SELECT promo_code FROM users WHERE id = ?`).get(appleUserId)?.promo_code;
  checkTrue('promokod berildi', !!promo);

  check('veb javobida token YO\'Q (faqat cookie)', r.body?.token, undefined);
  checkTrue('Set-Cookie bor', String(r.headers.get('set-cookie') || '').includes('nfc_session'));
}

console.log('\n── 4. O\'sha odam qayta kirdi ──');
{
  const r = await social({ provider: 'apple', idToken: await sign(appleClaims()) });
  check('tanish sub → 200, isNew false', [r.status, r.body?.isNew], [200, false]);
  check('o\'sha hisob', r.body?.user?.id, appleUserId);
  check('ikkinchi hisob ochilmadi', sqlite.prepare(`SELECT COUNT(*) c FROM users WHERE email = 'olma@example.com'`).get().c, 1);
}

console.log('\n── 5. Google — o\'sha tasdiqlangan email, mavjud hisobga ulanadi ──');
{
  const r = await social({ provider: 'google', idToken: await sign(googleClaims()) });
  check('ulandi → 200, isNew false', [r.status, r.body?.isNew], [200, false]);
  check('AYNAN o\'sha hisob', r.body?.user?.id, appleUserId);
  check('ikkala kirish ham bitta hisobda',
    sqlite.prepare(`SELECT COUNT(*) c FROM user_identities WHERE user_id = ?`).get(appleUserId).c, 2);
}

console.log('\n── 6. TASDIQLANMAGAN email begona hisobga ULANMAYDI ──');
{
  const r = await social({ provider: 'google', idToken: await sign(googleClaims({ sub: 'g-evil', email_verified: false })) });
  check('yangi, alohida hisob ochildi → 201', [r.status, r.body?.isNew], [201, true]);
  checkTrue('eski hisobga ULANMADI', r.body?.user?.id !== appleUserId);
  check('eski hisobda hamon 2 ta kirish',
    sqlite.prepare(`SELECT COUNT(*) c FROM user_identities WHERE user_id = ?`).get(appleUserId).c, 2);
  // Email band bo'lgani uchun yangi hisobga ichki manzil berilgan.
  const row = sqlite.prepare(`SELECT email FROM users WHERE id = ?`).get(r.body.user.id);
  checkTrue('ichki (placeholder) manzil berildi', !String(row.email).startsWith('olma@'));
}

console.log('\n── 7. Nonce ──');
{
  const raw = 'xom-nonce-12345';
  const hashed = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  const t1 = await sign(appleClaims({ sub: 'n-1', nonce: hashed, email: 'n1@example.com' }));
  check('nonce yo\'q → 401', (await social({ provider: 'apple', idToken: t1 })).status, 401);
  check('nonce noto\'g\'ri → 401', (await social({ provider: 'apple', idToken: t1, nonce: 'boshqa' })).status, 401);
  check('SHA-256 mos → 201', (await social({ provider: 'apple', idToken: t1, nonce: raw })).status, 201);

  const t2 = await sign(googleClaims({ sub: 'n-2', nonce: raw, email: 'n2@example.com' }));
  check('xom nonce mos → 201', (await social({ provider: 'google', idToken: t2, nonce: raw })).status, 201);
}

console.log('\n── 8. O\'chirilgan va to\'xtatilgan hisob ──');
{
  sqlite.prepare(`UPDATE users SET deleted_at = ? WHERE id = ?`).run(new Date().toISOString(), appleUserId);
  const r = await social({ provider: 'apple', idToken: await sign(appleClaims()) });
  check('o\'chirilgan → 403 account_deleted', [r.status, r.body?.error], [403, 'account_deleted']);

  const soon = new Date(Date.now() + 86_400_000).toISOString().replace('T', ' ').replace('Z', '+00');
  sqlite.prepare(`UPDATE users SET deleted_at = NULL, suspended_until = ?, suspend_reason = 'qoida buzilishi' WHERE id = ?`)
    .run(soon, appleUserId);
  const r2 = await social({ provider: 'apple', idToken: await sign(appleClaims()) });
  check('to\'xtatilgan → 403 account_suspended', [r2.status, r2.body?.error], [403, 'account_suspended']);
  check('sabab ham qaytadi', r2.body?.reason, 'qoida buzilishi');
  sqlite.prepare(`UPDATE users SET suspended_until = NULL, suspend_reason = NULL WHERE id = ?`).run(appleUserId);
}

console.log('\n── 9. Ijtimoiy hisobga PAROL bilan kirib bo\'lmaydi ──');
{
  const stored = sqlite.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(appleUserId).password_hash;
  checkTrue('parol o\'rnida belgi turibdi', !String(stored).includes(':'));
  for (const password of ['social-login-no-password', 'parol123', '']) {
    resetLimits();
    const r = await call('/api/auth/login', { method: 'POST', json: { email: 'olma@example.com', password } });
    checkTrue(`parol "${password.slice(0, 12)}" bilan kirib bo'lmadi`, r.status !== 200);
  }
}

console.log('\n── 10. Mobil mijoz tokeni tanada qaytadi ──');
{
  const r = await social(
    { provider: 'apple', idToken: await sign(appleClaims({ sub: 'm-1', email: 'm1@example.com' })) },
    { headers: { 'x-client': 'android' } },
  );
  check('201', r.status, 201);
  checkTrue('token javob tanasida', typeof r.body?.token === 'string' && r.body.token.length > 10);
  const src = sqlite.prepare(`SELECT signup_source FROM users WHERE id = ?`).get(r.body.user.id)?.signup_source;
  check('manba android deb yozildi', src, 'android');
}

console.log('\n── 11. Tezlik chegarasi ──');
{
  resetLimits();
  let last = null;
  for (let i = 0; i < 22; i++) {
    last = await call('/api/auth/social', { method: 'POST', json: { provider: 'apple', idToken: 'a.b.c' } });
  }
  check('ko\'p urinish → 429', [last.status, last.body?.error], [429, 'too_many_requests']);
  resetLimits();
}

console.log('\n── 12. JWKS keshlanadi ──');
{
  const before = jwksHits;
  await social({ provider: 'apple', idToken: await sign(appleClaims({ sub: 'c-1', email: 'c1@example.com' })) });
  await social({ provider: 'apple', idToken: await sign(appleClaims({ sub: 'c-2', email: 'c2@example.com' })) });
  check('kalitlar qayta so\'ralmadi', jwksHits, before);
}

console.log('\n── 13. Apple domen tasdiqlash fayli ──');
{
  // Sozlanmagan bo'lsa 404 — bo'sh fayl Apple'ni chalg'itadi.
  const off = await call('/.well-known/apple-developer-domain-association.txt');
  check('sozlanmagan → 404', off.status, 404);

  env.APPLE_DOMAIN_ASSOCIATION = '  {"webcredentials":{"apps":["TEST.uz.nfcstore"]}}  ';
  const on = await call('/.well-known/apple-developer-domain-association.txt');
  check('200 va matn sifatida', [on.status, on.headers.get('content-type')],
    [200, 'text/plain; charset=utf-8']);
  // `call` JSON tanani o'zi ochib beradi — Apple faylining ichi ham
  // JSON. Shuning uchun mazmun obyekt sifatida solishtiriladi.
  check('mazmun o\'zgarmadi', on.body, { webcredentials: { apps: ['TEST.uz.nfcstore'] } });

  // Chetdagi bo'shliqlar olinadi, ichkarisiga TEGILMAYDI: Apple faylni
  // bayt-bayt solishtiradi. (JSON bo'lmagan qiymat — tana xom matn
  // sifatida qaytadi, ya'ni baytlarni to'g'ridan-to'g'ri ko'ramiz.)
  env.APPLE_DOMAIN_ASSOCIATION = '\n  abc  def\n ';
  const raw = await call('/.well-known/apple-developer-domain-association.txt');
  check('chet bo\'shliqlar olindi, ichki matn saqlandi', raw.body, 'abc  def');
  delete env.APPLE_DOMAIN_ASSOCIATION;
}

console.log('\n── 14. Ilova uchun sozlama ──');
{
  const r = await call('/api/auth/social/config');
  check('200', r.status, 200);
  // Google: standart `serverClientId` — ro'yxatdagi BIRINCHI ID
  // (Android AYNAN Web client ID bilan ishlaydi).
  check('google yoqiq, serverClientId birinchi ID',
    [r.body?.google?.enabled, r.body?.google?.serverClientId], [true, GOOGLE_AUD]);
  check('iosClientId hali bo\'sh', r.body?.google?.iosClientId, '');
  check('apple yoqiq', r.body?.apple?.enabled, true);
  // Services ID sozlanmagan — ilova Android'da Apple tugmasini
  // ko'rsatmaydi (iOS'da u baribir kerak emas).
  check('serviceId bo\'sh', r.body?.apple?.serviceId, '');
  check('redirectUri standart', r.body?.apple?.redirectUri,
    'https://nfcstore.uz/api/auth/apple/callback');

  env.GOOGLE_SIGNIN_SERVER_CLIENT_ID = 'aniq-web-id.apps.googleusercontent.com';
  env.GOOGLE_SIGNIN_IOS_CLIENT_ID = 'ios-id.apps.googleusercontent.com';
  env.APPLE_SIGNIN_SERVICE_ID = 'uz.nfcstore.signin';
  const r2 = await call('/api/auth/social/config');
  check('aniq qiymatlar ustun', [
    r2.body?.google?.serverClientId, r2.body?.google?.iosClientId, r2.body?.apple?.serviceId,
  ], ['aniq-web-id.apps.googleusercontent.com', 'ios-id.apps.googleusercontent.com', 'uz.nfcstore.signin']);
  delete env.GOOGLE_SIGNIN_SERVER_CLIENT_ID;
  delete env.GOOGLE_SIGNIN_IOS_CLIENT_ID;
  delete env.APPLE_SIGNIN_SERVICE_ID;

  // Sozlanmagan provayder — `enabled:false`. Ilova tugmani umuman
  // ko'rsatmaydi, ya'ni odam ishlamaydigan tugmani bosmaydi.
  const savedG = env.GOOGLE_SIGNIN_CLIENT_IDS;
  delete env.GOOGLE_SIGNIN_CLIENT_IDS;
  const r3 = await call('/api/auth/social/config');
  check('sozlanmagan → enabled:false', r3.body?.google?.enabled, false);
  env.GOOGLE_SIGNIN_CLIENT_IDS = savedG;
}

globalThis.fetch = realFetch;
done();
