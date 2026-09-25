// STIKERDAGI UMUMIY QR — /qr-<partiya> yo'naltirishi.
//
// Oynaga yopishtirilgan stikerni qayta bosib bo'lmaydi: QR manzili
// ishlamay qolsa, butun partiya "o'lik" bo'ladi. Bu test qo'riqlaydi:
//   * /qr-1 -> ilova sahifasi, partiya UTM'da, 302 va no-store;
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
check('/qr-1: ilova sahifasi va partiya UTM', r.headers.get('location'), '/ilova-yuklash?utm_source=stiker&utm_medium=qr&utm_campaign=qr-1');
check('/qr-1: keshlanmaydi', r.headers.get('cache-control'), 'no-store');
const r2 = await worker.fetch(req('/qr-12/'), env);
check('/qr-12/: partiya raqami', r2.headers.get('location')?.endsWith('utm_campaign=qr-12'), true);
for (const p of ['/qr-', '/qr-abc', '/qr-12345', '/vip001']) {
  const x = await worker.fetch(req(p), env);
  checkTrue(`${p}: ushlanmaydi`, !(x.status === 302 && (x.headers.get('location') || '').includes('utm_source=stiker')));
}
done();
