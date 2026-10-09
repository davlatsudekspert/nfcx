// SOXTA APPLE SERTIFIKAT ZANJIRI (faqat testlar uchun).
//
// hosting/api/apple-jws.js ni tekshirish uchun 3 bosqichli EC zanjir
// (root P-384 → intermediate P-384 → leaf P-256) va ES256 JWS yasaydi.
// X.509 DER shu yerda qo'lda yig'iladi (npm bog'liqlik yo'q), imzolar
// node:crypto bilan. Haqiqiy Apple kalitlariga hech qanday aloqasi yo'q —
// verifier bu ildizni FAQAT `rootCertB64` parametri bilan qabul qiladi.
import { generateKeyPairSync, sign, randomBytes } from 'node:crypto';

export const OID = {
  appleLeaf: '1.2.840.113635.100.6.11.1',
  appleIntermediate: '1.2.840.113635.100.6.2.1',
  basicConstraints: '2.5.29.19',
  cn: '2.5.4.3',
  ecdsaSha256: '1.2.840.10045.4.3.2',
  ecdsaSha384: '1.2.840.10045.4.3.3',
};

// ═══ DER yozuvchi ═══
const cat = (...parts) => Buffer.concat(parts.map((p) => Buffer.from(p)));
function len(n) {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  while (n > 0) { bytes.unshift(n & 0xff); n = Math.floor(n / 256); }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
export const tlv = (tag, body) => { const b = Buffer.from(body); return cat([tag], len(b.length), b); };
export const seq = (...kids) => tlv(0x30, cat(...kids));
const set = (...kids) => tlv(0x31, cat(...kids));
const explicit = (n, inner) => tlv(0xa0 + n, inner);
const bool = (v) => tlv(0x01, [v ? 0xff : 0]);
const octet = (b) => tlv(0x04, b);
const nul = () => Buffer.from([0x05, 0x00]);
export const int = (b) => { let x = Buffer.from(b); if (x[0] & 0x80) x = cat([0], x); return tlv(0x02, x); };
export function oid(str) {
  const p = str.split('.').map(Number);
  const out = [40 * p[0] + p[1]];
  for (const v of p.slice(2)) {
    const stack = [v & 0x7f];
    let n = Math.floor(v / 128);
    while (n > 0) { stack.unshift((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
    out.push(...stack);
  }
  return tlv(0x06, out);
}
function time(ms) {
  const d = new Date(ms);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const tail = `${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  const y = d.getUTCFullYear();
  return y >= 1950 && y < 2050 ? tlv(0x17, `${p(y % 100)}${tail}`) : tlv(0x18, `${p(y, 4)}${tail}`);
}
const name = (cn) => seq(set(seq(oid(OID.cn), tlv(0x0c, cn))));

export function ecKey(curve) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: curve });
  return { publicKey, privateKey, spki: publicKey.export({ type: 'spki', format: 'der' }) };
}

// Bitta X.509 sertifikat (DER). `issuer` — { cn, key } (o'zi imzolasa — o'zi).
export function makeCert({ cn, key, issuer, notBefore, notAfter, extensions = [], sigHash = 'sha384' }) {
  const algOid = sigHash === 'sha256' ? OID.ecdsaSha256 : OID.ecdsaSha384;
  const iss = issuer || { cn, key };
  const exts = extensions.map((e) => seq(oid(e.oid), ...(e.critical ? [bool(true)] : []), octet(e.value)));
  const tbs = seq(
    explicit(0, int([2])),
    int(randomBytes(8)),
    seq(oid(algOid)),
    name(iss.cn),
    seq(time(notBefore), time(notAfter)),
    name(cn),
    key.spki,
    ...(exts.length ? [explicit(3, seq(...exts))] : []),
  );
  const sig = sign(sigHash, tbs, iss.key.privateKey); // DER SEQUENCE{r,s}
  return seq(tbs, seq(oid(algOid)), tlv(0x03, cat([0], sig)));
}

export const extApple = (o) => ({ oid: o, value: nul() });
export const extCa = () => ({ oid: OID.basicConstraints, critical: true, value: seq(bool(true)) });

// To'liq zanjir. `opts` bilan buzilgan variantlar: leafOid/interOid = false,
// expired = 'leaf' | 'intermediate', leafCurve.
export function makeChain(opts = {}) {
  const DAY = 86_400_000;
  const now = opts.now ?? Date.now();
  const valid = [now - 365 * DAY, now + 365 * DAY];
  const expired = [now - 400 * DAY, now - 30 * DAY];
  const rootKey = ecKey('P-384');
  const interKey = ecKey('P-384');
  const leafKey = ecKey(opts.leafCurve || 'P-256');
  const root = makeCert({ cn: 'Fake Root CA', key: rootKey, notBefore: valid[0], notAfter: valid[1] + 3650 * DAY, extensions: [extCa()] });
  const [ib, ia] = opts.expired === 'intermediate' ? expired : valid;
  const inter = makeCert({
    cn: 'Fake WWDR', key: interKey, issuer: { cn: 'Fake Root CA', key: rootKey }, notBefore: ib, notAfter: ia,
    extensions: [extCa(), ...(opts.interOid === false ? [] : [extApple(OID.appleIntermediate)])],
  });
  const [lb, la] = opts.expired === 'leaf' ? expired : valid;
  const leaf = makeCert({
    cn: 'Fake Prod ECC Mac App Store and iTunes Store Receipt Signing', key: leafKey,
    issuer: { cn: 'Fake WWDR', key: interKey }, notBefore: lb, notAfter: la, sigHash: opts.leafSigHash || 'sha384',
    extensions: opts.leafOid === false ? [] : [extApple(OID.appleLeaf)],
  });
  return {
    rootB64: root.toString('base64'),
    x5c: [leaf, inter, root].map((c) => c.toString('base64')),
    leafKey, interKey, rootKey,
  };
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// ES256 JWS (StoreKit 2 shakli: sarlavhada x5c).
export function signJws(payload, chain, { x5c } = {}) {
  const header = b64url(JSON.stringify({ alg: 'ES256', x5c: x5c || chain.x5c }));
  const body = b64url(JSON.stringify(payload));
  const sig = sign('sha256', Buffer.from(`${header}.${body}`), { key: chain.leafKey.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${body}.${b64url(sig)}`;
}
