// Telefon raqamini yagona xalqaro ko'rinishga keltirish — FRONTEND nusxasi.
//
// NEGA NUSXA. Worker modullari `src/` dan import qila olmaydi (build
// qo'riqchisi), shuning uchun bu mantiq ikki joyda yozilgan:
//   hosting/worker.js -> normalizePhoneD1()   (yakuniy, ishonchli manba)
//   src/lib/phone.js  -> normalizePhone()     (faqat KO'RSATISH uchun)
//
// Ikkalasi bir xil ishlashi `scripts/test-phone-parity.mjs` bilan
// tekshiriladi — biri o'zgarib, ikkinchisi eskirib qolmasin.
//
// MUHIM: bu yerdagi natija hech narsani hal qilmaydi. Server raqamni
// baribir o'zi qaytadan keltiradi va o'zi rad etadi. Bu funksiya faqat
// odamga "raqamingiz shunday saqlanadi" deb ko'rsatish uchun — shunda u
// xatoni yuborishdan OLDIN ko'radi.
export function normalizePhone(v) {
  let digits = String(v || '').trim().slice(0, 28).replace(/[\s\-().]/g, '');
  if (!digits) return '';
  const hadPlus = digits.startsWith('+');
  if (hadPlus) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return '';

  if (!hadPlus) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.length === 9) digits = '998' + digits;
    else if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
  }

  if (digits.startsWith('998') && digits.length !== 12) return '';
  return /^[1-9]\d{8,14}$/.test(digits) ? '+' + digits : '';
}

// O'ZBEKISTON RAQAMI UZUNLIGI — PROFIL/KOMPANIYA TELEFONI UCHUN (2026-10).
//
// Profil va kompaniya sahifasidagi "Qo'ng'iroq" tugmasi `tel:` havolasi
// bo'ladi. Ilgari maydon hech tekshirilmasdi va bitta raqam ortiq
// terilgan "+9985009088277" (998 + 10 xona) saqlanib, qo'ng'iroq hech
// qayerga ulanmasdi (sayt auditi, 2026-10 — rasmiy kompaniya yozuvida
// aynan shunday). Qoida: raqam 998 bilan boshlansa — 998 + 9 xona
// (jami 12). Bo'sh maydon va boshqa davlat raqami tekshirilmaydi.
// Serverdagi nusxa: hosting/worker.js uzPhoneLengthBadD1().
export function uzPhoneLengthBad(v) {
  const raw = String(v || '').trim();
  if (!raw) return false;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return false;
  const plus = raw.startsWith('+') || raw.startsWith('00');
  // 9 xonali mahalliy raqam ("99 812 34 56") — to'g'ri, 998 bilan
  // boshlansa ham (operator 99).
  if (!plus && digits.length === 9) return false;
  const d = raw.startsWith('00') ? digits.slice(2) : digits;
  if (!d.startsWith('998')) return false;
  return d.length !== 12;
}

// Ko'rsatish uchun bo'laklab yozish: +998 90 111 22 33.
// Faqat O'zbekiston raqamiga qo'llanadi — boshqa davlatlarning
// bo'lish qoidalari har xil, taxmin qilib bo'lmaydi.
export function prettyPhone(e164) {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(String(e164 || ''));
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : String(e164 || '');
}
