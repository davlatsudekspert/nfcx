// ─────────────────────────────────────────────────────────────────────────────
// PROFIL MUSIQASI LIMITI (frontend)
// ─────────────────────────────────────────────────────────────────────────────
// Oddiy foydalanuvchi 5 ta, Premium 10 ta qo'shiq qo'sha oladi.
// Oddiy foydalanuvchi 6-qo'shiqni qo'shmoqchi bo'lsa — Premium taklif
// oynasi ochiladi (kabinetdagi `setLocked`).
//
// MUHIM: bu qiymatlar hosting/worker.js ichidagi MUSIC_LIMIT_FREE_D1 /
// MUSIC_LIMIT_PREMIUM_D1 bilan AYNAN bir xil bo'lishi shart (Worker
// modullari `src/` dan import qila olmaydi — build guard taqiqlaydi).
// scripts/test-music-limits.mjs ikkalasini solishtirib turadi.
export const MUSIC_LIMIT_FREE = 5;
export const MUSIC_LIMIT_PREMIUM = 10;

export function musicLimit(isPremium) {
  return isPremium ? MUSIC_LIMIT_PREMIUM : MUSIC_LIMIT_FREE;
}
