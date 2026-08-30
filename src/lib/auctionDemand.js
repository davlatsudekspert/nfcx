// Auksion "Talab" board — umumiy konstantalar (frontend + backend).

// Nechta unique hisob "Auksionda qatnashaman" bosganda kod "auksionga
// tayyor" bo'ladi va admin + Telegram xabar oladi.
export const AUCTION_DEMAND_THRESHOLD = 20;

// Board status'lari — frontend filtr tab'lari shu tartibda.
export const DEMAND_STATUS = {
  collecting: 'collecting',   // Talab yig'ilmoqda
  ready: 'ready',             // Auksionga tayyor (threshold yetdi)
  auction_live: 'auction_live', // Faol auksion ochilgan
  done: 'done',               // Sotilgan / yakunlangan
  hidden: 'hidden',           // Admin yashirgan
};
