// ULASHISH TUGMASI — QAYSI YO'L TANLANADI.
//
// Egasining shikoyati: "ulashish ishlamayapti, oq oyna ochilib yo'qolib
// qolyapti". Sababi: ish stoli brauzerlarining bir qismida (Yandex
// shulardan biri) `navigator.share` MAVJUD, lekin ishlamaydi —
// bo'm-bo'sh oq oyna ochilib darhol yopiladi va va'da XATOSIZ bajarilib
// qaytadi. Ya'ni "ishlamadi" degan xatoni ushlab qolishning iloji yo'q:
// biz "ulashildi" deb hisoblab hech narsa ko'rsatmasdik.
//
// Yechim — mezonni o'zgartirish: tizim oynasi faqat SENSORLI
// qurilmalarda ochiladi, ish stolida esa o'z menyumiz (Telegram,
// WhatsApp, Facebook, X, nusxalash) ko'rsatiladi. Bu test aynan shu
// qarorni qo'riqlaydi.
//
//   node scripts/test-share-menu.mjs
import { canSystemShare, shareTargets, shareLink } from '../src/lib/share.js';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

// Node'da `globalThis.navigator` faqat o'qish uchun — testda uni
// almashtirish uchun ustunidan yozib bo'ladigan xossa qilamiz.
const setGlobal = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

// Brauzer muhitini soxtalashtiramiz: `canSystemShare` faqat shu ikki
// belgiga qaraydi — sensorli ko'rsatkich va tegish nuqtalari.
function browser({ share = true, coarse = false, touch = 0 } = {}) {
  setGlobal('navigator', { ...(share ? { share: async () => {} } : {}), maxTouchPoints: touch, clipboard: { writeText: async () => {} } });
  setGlobal('window', { matchMedia: (q) => ({ matches: q.includes('coarse') ? coarse : false }) });
}

// ── 1) Ish stoli — tizim oynasi ISHLATILMAYDI ────────────────────────
browser({ share: true, coarse: false, touch: 0 });
check('1) ish stolida tizim oynasi yopiq', canSystemShare(), false);
// Yandex kabi "sensorli ekranli noutbuk" holati: tegish bor, lekin
// ko'rsatkich aniq (sichqoncha) — bu ham ish stoli.
browser({ share: true, coarse: false, touch: 5 });
check('1) sensorli noutbuk ham ish stoli', canSystemShare(), false);

// ── 2) Telefon — tizim oynasi ISHLATILADI ────────────────────────────
browser({ share: true, coarse: true, touch: 5 });
check('2) telefonda tizim oynasi ochiladi', canSystemShare(), true);
// Web Share API umuman bo'lmasa — baribir yo'q.
browser({ share: false, coarse: true, touch: 5 });
check('2) API bo‘lmasa — yo‘q', canSystemShare(), false);

// ── 3) Ish stolida shareLink DARHOL nusxalashga o'tadi ───────────────
// Muhim: `navigator.share` chaqirilmasligi kerak — aynan u oq oyna
// ochib yopardi.
let shareCalls = 0;
let copied = '';
setGlobal('navigator', {
  share: async () => { shareCalls += 1; },
  maxTouchPoints: 0,
  clipboard: { writeText: async (v) => { copied = v; } },
});
setGlobal('window', { matchMedia: () => ({ matches: false }) });
check('3) natija — nusxalandi', await shareLink({ url: 'https://nfcstore.uz/yangiliklar/12' }), 'copied');
check('3) tizim oynasi UMUMAN chaqirilmadi', shareCalls, 0);
check('3) havola nusxalandi', copied, 'https://nfcstore.uz/yangiliklar/12');

// ── 4) Menyudagi havolalar ───────────────────────────────────────────
const targets = shareTargets({ url: 'https://nfcstore.uz/yangiliklar/12', title: 'Salom & xayr', text: 'qisqa matn' });
check('4) to‘rtta tarmoq', targets.map((s) => s.id), ['telegram', 'whatsapp', 'facebook', 'x']);
const tg = targets.find((s) => s.id === 'telegram');
checkTrue('4) Telegram havolasi to‘g‘ri', tg.href.startsWith('https://t.me/share/url?url=https%3A%2F%2Fnfcstore.uz%2Fyangiliklar%2F12'));
// Sarlavhadagi `&` havolani buzmasligi kerak (kodlanadi).
checkTrue('4) sarlavha kodlangan', tg.href.includes('Salom%20%26%20xayr'));
checkTrue('4) hammasi HTTPS', targets.every((s) => s.href.startsWith('https://')));

// ── 5) Bo‘sh havola — hech narsa qilinmaydi ──────────────────────────
check('5) havolasiz — xato', await shareLink({ url: '' }), 'failed');

// ── 6) Nusxalash ham ishlamasa — aniq xato ───────────────────────────
setGlobal('navigator', { maxTouchPoints: 0, clipboard: { writeText: async () => { throw new Error('denied'); } } });
check('6) nusxalab bo‘lmadi', await shareLink({ url: 'https://nfcstore.uz/vip001' }), 'failed');

done();
