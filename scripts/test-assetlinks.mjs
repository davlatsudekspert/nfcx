// ANDROID APP LINKS FAYLI.
//
// Jismoniy NFC kartani tegizganda Android brauzer o'rniga ilovani
// ochishi uchun `https://nfcstore.uz/.well-known/assetlinks.json`
// SHU DOMENDAN berilishi kerak.
//
// Bu fayl noto'g'ri bo'lsa, hech qanday xato ko'rinmaydi — havolalar
// shunchaki brauzerda ochilaveradi va sababi bilinmaydi. Shuning
// uchun uning shakli test bilan qulflanadi.
//
//   node scripts/test-assetlinks.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

const PRINT_A = 'A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90';
const PRINT_B = '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00';

const get = async (env) =>
  worker.fetch(req('/.well-known/assetlinks.json'), env);

// 1) SOZLANMAGAN — 404.
//
// Bo'sh ro'yxatli fayl berish XAVFLI: Android uni keshlaydi va
// keyinroq barmoq izi qo'shilganda ham uzoq vaqt "tasdiqlanmagan"
// bo'lib qoladi. Yo'q bo'lgani yaxshi.
{
  const { env } = makeEnv({});
  await ensureCoreSchema(env);
  const res = await get(env);
  check('sozlanmagan bo‘lsa 404', res.status, 404);
}

// 2) SOZLANGAN — to'g'ri shakl.
{
  const { env } = makeEnv({ ANDROID_APP_FINGERPRINTS: PRINT_A });
  await ensureCoreSchema(env);
  const res = await get(env);
  check('holat 200', res.status, 200);
  checkTrue('JSON turi', (res.headers.get('content-type') || '').includes('application/json'));

  const body = await res.json();
  checkTrue('ro‘yxat qaytadi', Array.isArray(body) && body.length === 1);
  check('relation to‘g‘ri', body[0].relation[0], 'delegate_permission/common.handle_all_urls');
  check('namespace', body[0].target.namespace, 'android_app');
  check('paket nomi', body[0].target.package_name, 'uz.nfcstore.app');
  check('barmoq izi', body[0].target.sha256_cert_fingerprints[0], PRINT_A);
}

// 3) BIR NECHTA BARMOQ IZI — Play App Signing da yuklash va do'kon
//    kaliti boshqa-boshqa bo'ladi, ikkalasi ham kerak.
{
  const { env } = makeEnv({ ANDROID_APP_FINGERPRINTS: `${PRINT_A}, ${PRINT_B}` });
  await ensureCoreSchema(env);
  const body = await (await get(env)).json();
  check('ikkita barmoq izi', body[0].target.sha256_cert_fingerprints.length, 2);
  check('ikkinchisi joyida', body[0].target.sha256_cert_fingerprints[1], PRINT_B);
}

// 4) NOTO'G'RI QIYMAT — jimgina tashlab yuboriladi.
//
// Kimdir env ga tasodifan bo'sh satr yoki izoh yozsa, fayl BUZUQ
// emas, YO'Q bo'lishi kerak.
{
  const { env } = makeEnv({ ANDROID_APP_FINGERPRINTS: 'salom, 12:34, ' });
  await ensureCoreSchema(env);
  check('noto‘g‘ri barmoq izlari 404', (await get(env)).status, 404);
}

// 5) ARALASH — faqat haqiqiysi qoladi.
{
  const { env } = makeEnv({ ANDROID_APP_FINGERPRINTS: `salom ${PRINT_A} 12:34` });
  await ensureCoreSchema(env);
  const body = await (await get(env)).json();
  check('faqat to‘g‘risi qoladi', body[0].target.sha256_cert_fingerprints.length, 1);
}

// 6) KICHIK HARFLI BARMOQ IZI — Android katta harf kutadi.
{
  const { env } = makeEnv({ ANDROID_APP_FINGERPRINTS: PRINT_A.toLowerCase() });
  await ensureCoreSchema(env);
  const body = await (await get(env)).json();
  check('katta harfga o‘tkaziladi', body[0].target.sha256_cert_fingerprints[0], PRINT_A);
}

// 7) PAKET NOMINI ALMASHTIRISH mumkin.
{
  const { env } = makeEnv({
    ANDROID_APP_FINGERPRINTS: PRINT_A,
    ANDROID_APP_PACKAGE: 'uz.nfcstore.beta',
  });
  await ensureCoreSchema(env);
  const body = await (await get(env)).json();
  check('paket nomi env dan', body[0].target.package_name, 'uz.nfcstore.beta');
}

done();
