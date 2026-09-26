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

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv({});
await seedBasic(env);

const r = await worker.fetch(req('/qr-1'), env);
check('/qr-1: 302', r.status, 302);
check('/qr-1: NFC qo\'llanmasi, avto bo\'limi va partiya UTM', r.headers.get('location'), '/nfc-stiker?utm_source=stiker&utm_medium=qr&utm_campaign=qr-1#avto');
check('/qr-1: keshlanmaydi', r.headers.get('cache-control'), 'no-store');
const rT = await worker.fetch(req('/qr-2'), env);
check('/qr-2: tashqi stiker — qo\'llanma, bo\'limsiz', rT.headers.get('location'), '/nfc-stiker?utm_source=stiker&utm_medium=qr&utm_campaign=qr-2');
const r2 = await worker.fetch(req('/qr-12/'), env);
check('/qr-12/: partiya raqami', r2.headers.get('location')?.endsWith('utm_campaign=qr-12'), true);
for (const p of ['/qr-', '/qr-abc', '/qr-12345', '/vip001']) {
  const x = await worker.fetch(req(p), env);
  checkTrue(`${p}: ushlanmaydi`, !(x.status === 302 && (x.headers.get('location') || '').includes('utm_source=stiker')));
}
done();
