// STIKERDAGI UMUMIY QR — /qr-<partiya> qayerga olib borishi (2026-09-26).
//
// BITTA MANBA ikki joy uchun: hosting/worker.js (to'g'ridan-to'g'ri so'rov,
// masalan bot yoki curl) va src/App.jsx (brauzer navigatsiyasi). Ikkinchisi
// SHART: Cloudflare statik qatlami brauzer navigatsiyasini SPA qoidasi
// bo'yicha index.html bilan javob beradi va Worker umuman ishlamaydi —
// shuning uchun faqat serverdagi yo'naltirish telefonda BOSH SAHIFANI
// ochardi (egasi aynan shuni ko'rdi). scripts/test-qr-sticker-redirect.mjs
// ikkalasi bir xil manzil berishini tekshiradi.
//
//   qr-1 — avto stiker (80 mm, oyna ichidan) -> qo'llanmaning #avto bo'limi
//   qr-2 — do'kon stikeri (100 mm)            -> qo'llanma boshi
//   qr-3 — NFC karta (Uzum, orqa tomon)       -> #ulash (kartani ulash bo'limi)
export const QR_STICKER_RE = /^qr-(\d{1,4})$/;

export function qrStickerTarget(batch) {
  const n = String(batch);
  const section = n === '1' ? '#avto' : n === '3' ? '#ulash' : '';
  return `/nfc-stiker?utm_source=stiker&utm_medium=qr&utm_campaign=qr-${n}${section}`;
}
