// APPLE STOREKIT 2 JWS TEKSHIRUVI — hosting/api/apple-jws.js.
//   node scripts/test-apple-jws.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-apple-jws.mjs   (bazaga tegmaydi — natija bir xil)
//
// Soxta 3 bosqichli EC zanjir (scripts/lib/apple-fake-chain.mjs) bilan:
//   * to'g'ri zanjir + imzo — o'tadi, payload qaytadi;
//   * payload o'zgartirilgan, imzo boshqa kalitniki — rad;
//   * ildiz pin'ga teng emas (standart = haqiqiy Apple Root CA - G3) — rad;
//   * leaf/intermediate'da Apple OID yo'q — rad; intermediate CA emas — rad;
//   * muddati o'tgan sertifikat — rad; `signedDate` muddat ichida bo'lsa o'tadi;
//   * alg ES256 emas, x5c 3 ta emas, buzuq DER — rad (yiqilmaydi);
//   * DER → xom r||s o'girish (oldingi 0, qisqa son);
//   * haqiqiy Apple Root CA - G3: barmoq izi va o'z-o'zini imzolashi
//     shu parser + WebCrypto bilan tekshiriladi (P-384/SHA-384 yo'li).
import { createHash, sign as nodeSign } from 'node:crypto';
import { makeChecker } from './lib/d1-harness.mjs';
import { makeChain, signJws, makeCert, ecKey, extApple, OID, seq, int } from './lib/apple-fake-chain.mjs';
import {
  verifyAppleJws, derToRawEcdsa, parseCertificate, b64ToBytes,
  APPLE_ROOT_CA_G3_B64, APPLE_ROOT_CA_G3_SHA256, AppleJwsError,
} from '../hosting/api/apple-jws.js';

const { check, checkTrue, done } = makeChecker();

const codeOf = async (p) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof AppleJwsError ? e.code : `THROW:${e?.message}`; }
};

const chain = makeChain();
const payload = { bundleId: 'uz.nfcstore.nova', productId: 'uz.nfcstore.nova.premium.monthly', transactionId: '2000000001', signedDate: Date.now() };
const jws = signJws(payload, chain);

// ═══ 1. To'g'ri ═══
{
  const r = await verifyAppleJws(jws, { rootCertB64: chain.rootB64 });
  check('1) to‘g‘ri zanjir va imzo — payload', r.payload, payload);
  check('1) sarlavha alg', r.header.alg, 'ES256');
  // Leaf sertifikati SHA-256 bilan imzolangan zanjir ham (Apple ba'zan shunday).
  const c2 = makeChain({ leafSigHash: 'sha256' });
  check('1) leaf ecdsa-with-SHA256 ham o‘tadi', await codeOf(verifyAppleJws(signJws(payload, c2), { rootCertB64: c2.rootB64 })), 'ok');
}

// ═══ 2. Buzilgan imzo / payload ═══
{
  const [h, , s] = jws.split('.');
  const forged = Buffer.from(JSON.stringify({ ...payload, productId: 'uz.nfcstore.nova.premium.yearly' })).toString('base64url');
  check('2) payload o‘zgartirilgan — rad', await codeOf(verifyAppleJws(`${h}.${forged}.${s}`, { rootCertB64: chain.rootB64 })), 'jws_signature');
  const other = makeChain();
  // Boshqa leaf kaliti bilan imzolangan, lekin x5c bizning zanjir.
  const wrongKey = signJws(payload, { ...other, x5c: chain.x5c });
  check('2) boshqa kalit imzosi — rad', await codeOf(verifyAppleJws(wrongKey, { rootCertB64: chain.rootB64 })), 'jws_signature');
  const sigBytes = Buffer.from(s, 'base64url');
  sigBytes[10] ^= 1;
  check('2) imzo bayti o‘zgargan — rad', await codeOf(verifyAppleJws(`${h}.${jws.split('.')[1]}.${sigBytes.toString('base64url')}`, { rootCertB64: chain.rootB64 })), 'jws_signature');
}

// ═══ 3. Ildiz ═══
{
  check('3) standart (haqiqiy Apple) ildiz bilan soxta zanjir — rad', await codeOf(verifyAppleJws(jws)), 'root_mismatch');
  const other = makeChain();
  check('3) boshqa pin — rad', await codeOf(verifyAppleJws(jws, { rootCertB64: other.rootB64 })), 'root_mismatch');
  // x5c ildizi to'g'ri, lekin intermediate boshqa ildizdan — zanjir imzosi rad.
  const mixed = signJws(payload, chain, { x5c: [chain.x5c[0], other.x5c[1], chain.x5c[2]] });
  const c = await codeOf(verifyAppleJws(mixed, { rootCertB64: chain.rootB64 }));
  checkTrue(`3) begona intermediate — rad (${c})`, c === 'chain_signature' || c === 'chain_name_mismatch');
}

// ═══ 4. Apple OID va CA ═══
{
  const noLeaf = makeChain({ leafOid: false });
  check('4) leaf’da Apple OID yo‘q — rad', await codeOf(verifyAppleJws(signJws(payload, noLeaf), { rootCertB64: noLeaf.rootB64 })), 'leaf_oid');
  const noInter = makeChain({ interOid: false });
  check('4) intermediate’da Apple OID yo‘q — rad', await codeOf(verifyAppleJws(signJws(payload, noInter), { rootCertB64: noInter.rootB64 })), 'intermediate_oid');
  // Intermediate CA emas (basicConstraints yo'q).
  const DAY = 86_400_000;
  const now = Date.now();
  const rootKey = ecKey('P-384'); const interKey = ecKey('P-384'); const leafKey = ecKey('P-256');
  const root = makeCert({ cn: 'R', key: rootKey, notBefore: now - DAY, notAfter: now + DAY });
  const inter = makeCert({ cn: 'I', key: interKey, issuer: { cn: 'R', key: rootKey }, notBefore: now - DAY, notAfter: now + DAY, extensions: [extApple(OID.appleIntermediate)] });
  const leaf = makeCert({ cn: 'L', key: leafKey, issuer: { cn: 'I', key: interKey }, notBefore: now - DAY, notAfter: now + DAY, extensions: [extApple(OID.appleLeaf)] });
  const nc = { leafKey, x5c: [leaf, inter, root].map((b) => b.toString('base64')), rootB64: root.toString('base64') };
  check('4) intermediate CA emas — rad', await codeOf(verifyAppleJws(signJws(payload, nc), { rootCertB64: nc.rootB64 })), 'intermediate_not_ca');
}

// ═══ 5. Muddat ═══
{
  const exLeaf = makeChain({ expired: 'leaf' });
  const p = { ...payload, signedDate: Date.now() };
  check('5) leaf muddati o‘tgan — rad', await codeOf(verifyAppleJws(signJws(p, exLeaf), { rootCertB64: exLeaf.rootB64 })), 'cert_expired');
  const exInter = makeChain({ expired: 'intermediate' });
  check('5) intermediate muddati o‘tgan — rad', await codeOf(verifyAppleJws(signJws(p, exInter), { rootCertB64: exInter.rootB64 })), 'cert_expired');
  // Imzo sertifikat amal qilgan paytda qo'yilgan (signedDate) — o'tadi.
  const old = { ...payload, signedDate: Date.now() - 100 * 86_400_000 };
  check('5) signedDate muddat ichida — o‘tadi', await codeOf(verifyAppleJws(signJws(old, exLeaf), { rootCertB64: exLeaf.rootB64 })), 'ok');
  const noDate = { ...payload }; delete noDate.signedDate;
  check('5) signedDate yo‘q — hozirgi vaqt bilan (rad)', await codeOf(verifyAppleJws(signJws(noDate, exLeaf), { rootCertB64: exLeaf.rootB64 })), 'cert_expired');
  check('5) opts.now — kelajakda hamma muddat o‘tgan', await codeOf(verifyAppleJws(signJws(noDate, chain), { rootCertB64: chain.rootB64, now: Date.now() + 20 * 365 * 86_400_000 })), 'cert_expired');
}

// ═══ 6. Shakl ═══
{
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const [, body, sig] = jws.split('.');
  check('6) alg HS256 — rad', await codeOf(verifyAppleJws(`${b({ alg: 'HS256', x5c: chain.x5c })}.${body}.${sig}`, { rootCertB64: chain.rootB64 })), 'jws_alg');
  check('6) alg none — rad', await codeOf(verifyAppleJws(`${b({ alg: 'none', x5c: chain.x5c })}.${body}.${sig}`, { rootCertB64: chain.rootB64 })), 'jws_alg');
  check('6) x5c 2 ta — rad', await codeOf(verifyAppleJws(`${b({ alg: 'ES256', x5c: chain.x5c.slice(0, 2) })}.${body}.${sig}`, { rootCertB64: chain.rootB64 })), 'jws_x5c');
  check('6) x5c yo‘q — rad', await codeOf(verifyAppleJws(`${b({ alg: 'ES256' })}.${body}.${sig}`, { rootCertB64: chain.rootB64 })), 'jws_x5c');
  check('6) 2 qism — rad', await codeOf(verifyAppleJws(`${b({ alg: 'ES256' })}.${body}`)), 'jws_format');
  check('6) satr emas — rad', await codeOf(verifyAppleJws(null)), 'jws_format');
  check('6) payload JSON emas — rad', await codeOf(verifyAppleJws(`${b({ alg: 'ES256', x5c: chain.x5c })}.${Buffer.from('xx{').toString('base64url')}.${sig}`, { rootCertB64: chain.rootB64 })), 'jws_json');
  // Buzuq DER leaf (ildiz to'g'ri) — yiqilmaydi, kod qaytadi.
  const junk = Buffer.from([0x30, 0x82, 0x01, 0x00, 0x02]).toString('base64');
  const c = await codeOf(verifyAppleJws(signJws(payload, chain, { x5c: [junk, chain.x5c[1], chain.x5c[2]] }), { rootCertB64: chain.rootB64 }));
  checkTrue(`6) buzuq leaf DER — AppleJwsError (${c})`, c !== 'ok' && !c.startsWith('THROW:'));
  check('6) 64 baytdan boshqa imzo — rad', await codeOf(verifyAppleJws(`${jws.split('.')[0]}.${body}.${Buffer.alloc(70, 1).toString('base64url')}`, { rootCertB64: chain.rootB64 })), 'jws_signature');
}

// ═══ 7. DER → xom imzo ═══
{
  const hex = (u) => Buffer.from(u).toString('hex');
  // r = 0x80.. (oldida 0x00), s = 0x01 (qisqa) → 32+32 bayt.
  const r = Buffer.alloc(32, 0x80); const s = Buffer.from([0x01]);
  const der = seq(int(r), int(s));
  const raw = derToRawEcdsa(new Uint8Array(der), 32);
  check('7) uzunlik 64', raw.length, 64);
  check('7) r oldingi 0 olib tashlandi', hex(raw.subarray(0, 32)), hex(r));
  check('7) s chapdan 0 bilan to‘ldirildi', hex(raw.subarray(32)), '00'.repeat(31) + '01');
  // Node DER imzosi ↔ ieee-p1363 bilan solishtirish (P-384, 48 bayt).
  const k = ecKey('P-384');
  const msg = Buffer.from('salom');
  const derSig = nodeSign('sha384', msg, k.privateKey);
  const rawSig = derToRawEcdsa(new Uint8Array(derSig), 48);
  const key = await crypto.subtle.importKey('spki', k.spki, { name: 'ECDSA', namedCurve: 'P-384' }, false, ['verify']);
  checkTrue('7) o‘girilgan imzo WebCrypto bilan tekshiriladi', await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-384' }, key, rawSig, msg));
  check('7) r juda uzun — rad', await codeOf((async () => derToRawEcdsa(new Uint8Array(seq(int(Buffer.alloc(33, 0x7f)), int(s))), 32))()), 'sig_int_size');
  check('7) SEQUENCE emas — rad', await codeOf((async () => derToRawEcdsa(new Uint8Array([0x02, 0x01, 0x01]), 32))()), 'sig_der');
}

// ═══ 8. Haqiqiy Apple Root CA - G3 ═══
{
  const der = b64ToBytes(APPLE_ROOT_CA_G3_B64);
  check('8) SHA-256 barmoq izi', createHash('sha256').update(der).digest('hex').toUpperCase(), APPLE_ROOT_CA_G3_SHA256);
  check('8) barmoq izi topshiriqdagi bilan bir xil', APPLE_ROOT_CA_G3_SHA256, '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179');
  const c = parseCertificate(der);
  check('8) P-384, ecdsa-with-SHA384', [c.curve.name, c.sigAlg], ['P-384', '1.2.840.10045.4.3.3']);
  check('8) muddat', [new Date(c.notBefore).toISOString(), new Date(c.notAfter).toISOString()], ['2014-04-30T18:19:06.000Z', '2039-04-30T18:19:06.000Z']);
  const key = await crypto.subtle.importKey('spki', c.spki, { name: 'ECDSA', namedCurve: 'P-384' }, false, ['verify']);
  checkTrue('8) o‘z-o‘zini imzolashi parser + WebCrypto bilan to‘g‘ri',
    await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-384' }, key, derToRawEcdsa(c.sigDer, 48), c.tbs));
}

done('Apple JWS');
