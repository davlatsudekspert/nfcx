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

// Ko'rsatish uchun bo'laklab yozish: +998 90 111 22 33.
// Faqat O'zbekiston raqamiga qo'llanadi — boshqa davlatlarning
// bo'lish qoidalari har xil, taxmin qilib bo'lmaydi.
export function prettyPhone(e164) {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(String(e164 || ''));
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : String(e164 || '');
}
