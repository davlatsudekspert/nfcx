import crypto from 'crypto';

const SESSION_COOKIE = 'nfc_session';
const SESSION_TTL_DAYS = 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(':');
    if (!salt || !hash) return false;
    const test = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return expected.length === test.length && crypto.timingSafeEqual(expected, test);
  } catch {
    return false;
  }
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token, secure = false) {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${maxAge}`;
}

export function clearedSessionCookie(secure = false) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=0`;
}

export function sessionTokenFromReq(req) {
  return parseCookies(req)[SESSION_COOKIE] || null;
}
