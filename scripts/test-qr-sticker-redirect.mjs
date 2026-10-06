// STIKERDAGI UMUMIY QR — /qr-<partiya> yo'naltirishi.
//
// Oynaga yopishtirilgan stikerni qayta bosib bo'lmaydi: QR manzili
// ishlamay qolsa, butun partiya "o'lik" bo'ladi. Bu test qo'riqlaydi:
//   * /qr-1 (avto stiker) -> /nfc-stiker#avto qo'llanmasi, partiya UTM'da, 302 va no-store;
//   * /qr-2 (tashqi stiker) -> /nfc-stiker (bo'limsiz);
//   * boshqa shakllar (qr-, qr-abc, profil kodlari) ushlanmaydi.
//
//   node scripts/test-qr-sticker-redirect.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';
import { readFileSync, existsSync } from 'node:fs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv({});
await seedBasic(env);

const r = await worker.fetch(req('/qr-1'), env);
check('/qr-1: 302', r.status, 302);
check('/qr-1: NFC qo\'llanmasi, avto bo\'limi va partiya UTM', r.headers.get('location'), '/nfc-stiker?utm_source=stiker&utm_medium=qr&utm_campaign=qr-1#avto');
check('/qr-1: keshlanmaydi', r.headers.get('cache-control'), 'no-store');
const rT = await worker.fetch(req('/qr-2'), env);
check('/qr-2: tashqi stiker — qo\'llanma, bo\'limsiz', rT.headers.get('location'), '/nfc-stiker?utm_source=stiker&utm_medium=qr&utm_campaign=qr-2');
const rC = await worker.fetch(req('/qr-3'), env);
check('/qr-3: NFC karta — kartani ulash bo\'limi', rC.headers.get('location'), '/nfc-stiker?utm_source=stiker&utm_medium=qr&utm_campaign=qr-3#ulash');
const r2 = await worker.fetch(req('/qr-12/'), env);
check('/qr-12/: partiya raqami', r2.headers.get('location')?.endsWith('utm_campaign=qr-12'), true);
for (const p of ['/qr-', '/qr-abc', '/qr-12345', '/vip001']) {
  const x = await worker.fetch(req(p), env);
  checkTrue(`${p}: ushlanmaydi`, !(x.status === 302 && (x.headers.get('location') || '').includes('utm_source=stiker')));
}
// BRAUZER NAVIGATSIYASI (2026-09-26): Cloudflare statik qatlami telefon
// brauzeridagi navigatsiyani index.html bilan javob beradi va Worker
// ishlamaydi — /qr-1 BOSH SAHIFANI ochgan edi. Shuning uchun SPA ham
// yo'naltiradi (src/lib/qrSticker.js) va u serverdagi bilan BIR XIL bo'lishi
// shart. src/ faqat asosiy (sayt) daraxtda bor — dev branch'da tekshiruv
// o'tkazib yuboriladi.
const lib = new URL('../src/lib/qrSticker.js', import.meta.url);
if (existsSync(lib)) {
  const { qrStickerTarget, QR_STICKER_RE } = await import(lib.href);
  for (const n of ['1', '2', '3', '12']) {
    const w = await worker.fetch(req(`/qr-${n}`), env);
    check(`SPA = server: /qr-${n}`, qrStickerTarget(n), w.headers.get('location'));
  }
  checkTrue('SPA naqshi qr-1 ni taniydi', QR_STICKER_RE.test('qr-1'));
  checkTrue('SPA naqshi profil kodini ushlamaydi', !QR_STICKER_RE.test('vip001') && !QR_STICKER_RE.test('qr-') && !QR_STICKER_RE.test('qr-12345'));
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  checkTrue('App.jsx /qr-N ni yo\'naltiradi', /QR_STICKER_RE/.test(app) && /<QrStickerRedirect\b/.test(app) && /location\.replace\(qrStickerTarget/.test(app));
}
done();
