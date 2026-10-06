// hosting/api/apple-jws.js — APPLE STOREKIT 2 JWS IMZOSINI TEKSHIRISH.
//
// ═══ NIMA UCHUN BOR ═══
//
// App Store (StoreKit 2) xaridni JWS ko'rinishida beradi: ilova
// `Transaction.jwsRepresentation` ni serverga yuboradi, Apple esa
// App Store Server Notifications V2 da `signedPayload` jo'natadi. Ichidagi
// ma'lumotga (mahsulot, muddat, qaytarilgan pul) faqat imzo HAQIQATAN
// Apple'niki bo'lsagina ishonish mumkin — aks holda har kim o'ziga
// "Premium 2099-yilgacha" yozib yuborardi.
//
// Sir (kalit) kerak EMAS: JWS sarlavhasidagi `x5c` — sertifikat zanjiri
// [leaf, intermediate, root]. Biz ildizni Apple'ning ochiq "Apple Root
// CA - G3" sertifikatiga qattiq bog'laymiz (pin) va zanjirni o'zimiz
// tekshiramiz.
//
// ═══ TEKSHIRUV TARTIBI ═══
//
//   1. JWS shakli: 3 qism, sarlavha `alg: ES256`, `x5c` da AYNAN 3 sertifikat.
//   2. `x5c[2]` bayt-baybayt pin qilingan ildizga teng.
//   3. intermediate ← root imzolagan, leaf ← intermediate imzolagan
//      (TBSCertificate ustidan ECDSA; SHA-256/384, P-256/P-384). Issuer/
//      subject nomlari mos; intermediate CA (basicConstraints cA=true).
//   4. Apple belgilari: leaf'da OID 1.2.840.113635.100.6.11.1,
//      intermediate'da OID 1.2.840.113635.100.6.2.1.
//   5. Sertifikatlar amal qilish muddati `signedDate` (bo'lmasa — hozir)
//      ni qamraydi.
//   6. JWS imzosi (ES256, xom r||s 64 bayt) leaf kaliti bilan to'g'ri.
//
// Faqat WebCrypto (`crypto.subtle` — Workers va Node 20+) va pastdagi
// kichik DER/ASN.1 o'quvchi. Yangi npm bog'liqlik YO'Q.
//
// ═══ TESTLAR UCHUN ═══
//
// `verifyAppleJws(jws, { rootCertB64 })` — boshqa ildizni FAQAT funksiya
// parametri orqali berish mumkin (scripts/test-apple-jws.mjs soxta
// zanjir yasaydi). env orqali EMAS: production'da hech qanday sozlama
// ildizni almashtira olmaydi.

// Apple Root CA - G3 (ochiq sertifikat, https://www.apple.com/certificateauthority/AppleRootCA-G3.cer).
// SHA-256: 63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179
// (2026-10-06 da yuklab olinib barmoq izi tekshirilgan; amal qilish muddati 2039-04-30 gacha).
export const APPLE_ROOT_CA_G3_B64 =
  'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==';
export const APPLE_ROOT_CA_G3_SHA256 = '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179';

// Apple belgilari (Apple'ning o'z kutubxonasi ham shularni talab qiladi).
export const OID_APPLE_LEAF = '1.2.840.113635.100.6.11.1';
export const OID_APPLE_INTERMEDIATE = '1.2.840.113635.100.6.2.1';

const OID_EC_PUBLIC_KEY = '1.2.840.10045.2.1';
const OID_BASIC_CONSTRAINTS = '2.5.29.19';
const CURVES = {
  '1.2.840.10045.3.1.7': { name: 'P-256', size: 32 },
  '1.3.132.0.34': { name: 'P-384', size: 48 },
};
const SIG_HASH = {
  '1.2.840.10045.4.3.2': 'SHA-256', // ecdsa-with-SHA256
  '1.2.840.10045.4.3.3': 'SHA-384', // ecdsa-with-SHA384
};

// Xato — `code` qisqa va barqaror (log va testlar uchun), matn yo'q.
export class AppleJwsError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (code) => { throw new AppleJwsError(code); };

// ═══ BASE64 ═══
export function b64ToBytes(b64) {
  const s = String(b64).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '').replace(/={1,2}$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(s) || s.length % 4 === 1) fail('bad_base64');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const utf8 = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const bytesEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
};

// ═══ DER / ASN.1 O'QUVCHI ═══
// Faqat bizga kerakli qism: teg (bitta bayt, yuqori raqamli teglar yo'q),
// qisqa va uzun uzunlik (4 baytgacha). Har element: { tag, start (sarlavha
// boshi), body (qiymat boshi), end }.
export function derRead(buf, pos = 0, limit = buf.length) {
  if (pos + 2 > limit) fail('der_truncated');
  const tag = buf[pos];
  if ((tag & 0x1f) === 0x1f) fail('der_tag');
  let len = buf[pos + 1];
  let body = pos + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || body + n > limit) fail('der_length');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[body + i];
    body += n;
  }
  const end = body + len;
  if (end > limit) fail('der_truncated');
  return { tag, start: pos, body, end };
}
// SEQUENCE/SET/konteyner ichidagi bolalar.
export function derChildren(buf, node) {
  const out = [];
  let p = node.body;
  while (p < node.end) { const c = derRead(buf, p, node.end); out.push(c); p = c.end; }
  return out;
}
const slice = (buf, node) => buf.subarray(node.start, node.end);
const bodyOf = (buf, node) => buf.subarray(node.body, node.end);

export function derOid(buf, node) {
  if (node.tag !== 0x06) fail('der_oid');
  const b = bodyOf(buf, node);
  if (!b.length) fail('der_oid');
  const parts = [];
  let v = 0;
  for (let i = 0; i < b.length; i++) {
    v = v * 128 + (b[i] & 0x7f);
    if (!(b[i] & 0x80)) {
      if (!parts.length) parts.push(v < 80 ? Math.floor(v / 40) : 2, v < 80 ? v % 40 : v - 80);
      else parts.push(v);
      v = 0;
    }
  }
  return parts.join('.');
}

// UTCTime (YYMMDDHHMMSSZ) yoki GeneralizedTime (YYYYMMDDHHMMSSZ) → ms.
function derTime(buf, node) {
  const s = utf8(bodyOf(buf, node));
  let m;
  if (node.tag === 0x17 && (m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s))) {
    const yy = Number(m[1]);
    return Date.UTC(yy < 50 ? 2000 + yy : 1900 + yy, m[2] - 1, m[3], m[4], m[5], m[6]);
  }
  if (node.tag === 0x18 && (m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s))) {
    return Date.UTC(Number(m[1]), m[2] - 1, m[3], m[4], m[5], m[6]);
  }
  return fail('der_time');
}

// INTEGER baytlari → aniq `size` uzunlikdagi musbat son (oldingi 0 lar olib tashlanadi/qo'shiladi).
function intToFixed(bytes, size) {
  let b = bytes;
  while (b.length > 1 && b[0] === 0) b = b.subarray(1);
  if (b.length > size) fail('sig_int_size');
  const out = new Uint8Array(size);
  out.set(b, size - b.length);
  return out;
}

// X.509 / DER imzo `SEQUENCE { INTEGER r, INTEGER s }` → WebCrypto kutadigan xom r||s.
export function derToRawEcdsa(der, size) {
  const seq = derRead(der, 0);
  if (seq.tag !== 0x30 || seq.end !== der.length) fail('sig_der');
  const kids = derChildren(der, seq);
  if (kids.length !== 2 || kids[0].tag !== 0x02 || kids[1].tag !== 0x02) fail('sig_der');
  const out = new Uint8Array(size * 2);
  out.set(intToFixed(bodyOf(der, kids[0]), size), 0);
  out.set(intToFixed(bodyOf(der, kids[1]), size), size);
  return out;
}

// ═══ SERTIFIKAT ═══
// Qaytaradi: { tbs (imzolangan baytlar), sigAlg, sigDer, issuer, subject
// (xom DER — solishtirish uchun), notBefore, notAfter (ms), spki (DER),
// curve, extensions: Map<oid, {critical, value}> }.
export function parseCertificate(der) {
  const cert = derRead(der, 0);
  if (cert.tag !== 0x30 || cert.end !== der.length) fail('cert_der');
  const [tbsN, algN, sigN, ...rest] = derChildren(der, cert);
  if (!tbsN || !algN || !sigN || rest.length || tbsN.tag !== 0x30 || algN.tag !== 0x30 || sigN.tag !== 0x03) fail('cert_der');
  const sigAlg = derOid(der, derChildren(der, algN)[0]);
  const sigBits = bodyOf(der, sigN);
  if (sigBits[0] !== 0) fail('cert_der');
  const t = derChildren(der, tbsN);
  let i = 0;
  if (t[i]?.tag === 0xa0) i++; // [0] version
  i++; // serialNumber
  const innerAlg = t[i++];
  if (!innerAlg || innerAlg.tag !== 0x30 || derOid(der, derChildren(der, innerAlg)[0]) !== sigAlg) fail('cert_alg_mismatch');
  const issuer = t[i++], validity = t[i++], subject = t[i++], spki = t[i++];
  if (!issuer || !validity || !subject || !spki || spki.tag !== 0x30) fail('cert_der');
  const [nb, na] = derChildren(der, validity);
  if (!nb || !na) fail('cert_der');
  const [spkiAlg] = derChildren(der, spki);
  const algKids = derChildren(der, spkiAlg);
  if (derOid(der, algKids[0]) !== OID_EC_PUBLIC_KEY || !algKids[1]) fail('cert_key_type');
  const curve = CURVES[derOid(der, algKids[1])] || fail('cert_curve');
  const extensions = new Map();
  for (; i < t.length; i++) {
    if (t[i].tag !== 0xa3) continue; // [1]/[2] unique ID lar — e'tiborsiz
    const seq = derChildren(der, t[i])[0];
    for (const ext of derChildren(der, seq)) {
      const parts = derChildren(der, ext);
      const oid = derOid(der, parts[0]);
      const critical = parts.length === 3 && parts[1].tag === 0x01 && der[parts[1].body] !== 0;
      const val = parts[parts.length - 1];
      if (val.tag !== 0x04) fail('cert_ext');
      if (extensions.has(oid)) fail('cert_ext_dup');
      extensions.set(oid, { critical, value: bodyOf(der, val) });
    }
  }
  return {
    tbs: slice(der, tbsN), sigAlg, sigDer: sigBits.subarray(1),
    issuer: slice(der, issuer), subject: slice(der, subject),
    notBefore: derTime(der, nb), notAfter: derTime(der, na),
    spki: slice(der, spki), curve, extensions,
  };
}

function isCa(cert) {
  const bc = cert.extensions.get(OID_BASIC_CONSTRAINTS);
  if (!bc) return false;
  const v = bc.value;
  const seq = derRead(v, 0);
  const kids = derChildren(v, seq);
  return !!kids[0] && kids[0].tag === 0x01 && v[kids[0].body] !== 0;
}

const importEcKey = (cert) => crypto.subtle.importKey('spki', cert.spki, { name: 'ECDSA', namedCurve: cert.curve.name }, false, ['verify']);

// `child` ni `issuer` imzolaganmi (TBSCertificate ustidan).
async function verifyCertSignature(child, issuer) {
  const hash = SIG_HASH[child.sigAlg] || fail('cert_sig_alg');
  if (!bytesEqual(child.issuer, issuer.subject)) fail('chain_name_mismatch');
  const key = await importEcKey(issuer);
  const raw = derToRawEcdsa(child.sigDer, issuer.curve.size);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash }, key, raw, child.tbs);
  if (!ok) fail('chain_signature');
}

function decodeJsonPart(part) {
  try { return JSON.parse(utf8(b64ToBytes(part))); }
  catch { return fail('jws_json'); }
}

// ═══ ASOSIY FUNKSIYA ═══
// Muvaffaqiyatda: { header, payload }. Aks holda `AppleJwsError` (code bilan).
//   opts.rootCertB64 — FAQAT testlar uchun (pastdagi izohga qarang).
//   opts.now — vaqt (ms), standart: Date.now().
export async function verifyAppleJws(jws, opts = {}) {
  try { return await verifyInner(jws, opts); }
  catch (e) {
    // DER buzuq bo'lsa TypeError/DOMException ham chiqishi mumkin — bari bir xil: imzo yaroqsiz.
    if (e instanceof AppleJwsError) throw e;
    throw new AppleJwsError('malformed');
  }
}

async function verifyInner(jws, opts) {
  if (typeof jws !== 'string' || jws.length > 64 * 1024) fail('jws_format');
  const parts = jws.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) fail('jws_format');
  const header = decodeJsonPart(parts[0]);
  if (!header || header.alg !== 'ES256') fail('jws_alg');
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length !== 3 || x5c.some((c) => typeof c !== 'string')) fail('jws_x5c');
  const payload = decodeJsonPart(parts[1]);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('jws_json');

  // 2) Ildiz — pin qilingan sertifikatning AYNAN o'zi.
  const pinned = b64ToBytes(opts.rootCertB64 || APPLE_ROOT_CA_G3_B64);
  const ders = x5c.map((c) => b64ToBytes(c));
  if (!bytesEqual(ders[2], pinned)) fail('root_mismatch');
  const [leaf, inter, root] = ders.map(parseCertificate);

  // 3-4) Zanjir va Apple belgilari.
  if (!inter.extensions.has(OID_APPLE_INTERMEDIATE)) fail('intermediate_oid');
  if (!leaf.extensions.has(OID_APPLE_LEAF)) fail('leaf_oid');
  if (!isCa(inter)) fail('intermediate_not_ca');
  await verifyCertSignature(inter, root);
  await verifyCertSignature(leaf, inter);

  // 5) Muddat: Apple kutubxonasi kabi — `signedDate` (imzolangan payt)
  // bo'lsa o'sha, bo'lmasa hozir. Eski tranzaksiyani keyin qayta
  // tekshirganda leaf almashgan bo'lishi mumkin — shu sabab imzo payti.
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const at = Number.isFinite(payload.signedDate) && payload.signedDate > 0 ? payload.signedDate : now;
  for (const c of [leaf, inter, root]) {
    if (!(c.notBefore <= at && at <= c.notAfter)) fail('cert_expired');
  }

  // 6) JWS imzosi — ES256 (leaf P-256 bo'lishi shart).
  if (leaf.curve.name !== 'P-256') fail('leaf_curve');
  const sig = b64ToBytes(parts[2]);
  if (sig.length !== 64) fail('jws_signature');
  const key = await importEcKey(leaf);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) fail('jws_signature');
  return { header, payload };
}
