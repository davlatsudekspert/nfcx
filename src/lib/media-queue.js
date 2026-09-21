// VIDEO OLDINDAN KO'RINISHI — NAVBAT BILAN
//
// MUAMMO (production, VIP001). Lentada to'qqizta video story bor edi.
// Ikkitasida birinchi kadr chizildi, qolgan yettitasida esa HECH
// NARSA bo'lmadi: na `loadeddata`, na `error`. Ya'ni brauzer o'sha
// yettita videoni umuman o'qishga kirishmadi.
//
// SABAB — BIR VAQTDA JUDA KO'P VIDEO. `<video preload="metadata">`
// har biri uchun alohida ulanish ochadi va faylning boshidan
// (ba'zan oxiridan — telefon yozgan MP4 da metama'lumot ko'pincha
// FAYL OXIRIDA turadi) bo'lak so'raydi. Telefon brauzeri bir vaqtda
// shuncha media elementini o'qiy olmaydi: ortig'ini JIM navbatda
// qoldiradi va ular haqida hech qanday hodisa bermaydi.
//
// Aynan shuning uchun ekranda "javob bermadi" chiqardi: kutish
// chegarasi ishlagan, lekin aybdor tarmoq emas — o'zimiz bir vaqtda
// to'qqizta videoni so'ragan edik.
//
// YECHIM. Videolar NAVBAT bilan o'qiladi: bir vaqtda ikkitasi.
// Biri tugagach (kadr keldi, xato chiqdi yoki vaqt tugadi) keyingisi
// boshlanadi. Shunda har bir video O'Z navbatida haqiqiy imkoniyat
// oladi va bir necha soniya ichida hammasi ko'rinadi.
//
// RASMGA TEGMAYDI. Rasm arzon va parallel yuklanishi normal —
// navbat faqat videoga tegishli.
//
// NIMA UCHUN 2. Bitta bo'lsa to'qqizta video juda sekin ochilardi;
// ko'p bo'lsa yana o'sha tiqilinch qaytadi. Ikkitasi — production
// kuzatuviga mos: aynan ikkita video kadr bergan edi.
export const MAX_CONCURRENT_VIDEO = 2;

let active = 0;
const waiting = [];

function pump() {
  while (active < MAX_CONCURRENT_VIDEO && waiting.length) {
    const start = waiting.shift();
    active += 1;
    try { start(); } catch { release(); }
  }
}

// Navbatga turadi. `start()` navbat kelganda chaqiriladi.
// Qaytgan funksiya — bekor qilish (komponent yo'q bo'lsa).
export function acquireVideoSlot(start) {
  let cancelled = false;
  const job = () => { if (!cancelled) start(); else release(); };
  waiting.push(job);
  pump();
  return () => { cancelled = true; };
}

export function release() {
  active = Math.max(0, active - 1);
  pump();
}

// Testlar uchun — holatni tozalaydi.
export function resetVideoQueue() {
  active = 0;
  waiting.length = 0;
}

export function queueState() {
  return { active, waiting: waiting.length };
}
