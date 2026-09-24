// Karta o'chirilganda unga bog'liq ma'lumot ham ketishini tekshiradi.
//   node scripts/test-card-cleanup.mjs
//
// NIMA UCHUN: `posts`, `menu_items`, `products` va h.k. `cards` ga FK bilan
// bog'lanmagan — CASCADE yo'q. Tozalash QO'LDA qilinadi, shuning uchun
// yangi jadval qo'shilganda u ro'yxatdan tushib qolmasligi kerak.
import { CARD_CONTENT_TABLES } from '../hosting/api/card-cleanup.js';
import { makeChecker } from './lib/d1-harness.mjs';
import { readFileSync } from 'node:fs';
import { stripComments } from './lib/strip-comments.mjs';

const { check, checkTrue, done } = makeChecker();
const schema = readFileSync(new URL('../db/d1-migration/0001-schema.sql', import.meta.url), 'utf8');

// ═══ 1. Sxemada `cards` ga FK YO'Q — ya'ni CASCADE'ga tayanib bo'lmaydi ═══
{
  const blocks = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS "([a-z_]+)" \(([\s\S]*?)\n\);/g)];
  // Kontent jadvallarining BIRONTASIDA ham `cards` ga FK yo'q — shuning
  // uchun ular o'z-o'zidan o'chmaydi va qo'lda tozalash SHART.
  const contentWithFk = blocks
    .filter(([, t, body]) => CARD_CONTENT_TABLES.includes(t) && /REFERENCES "cards"/.test(body))
    .map(([, t]) => t);
  check('kontent jadvallarida `cards` ga FK yo\'q -> CASCADE\'ga tayanib bo\'lmaydi', contentWithFk, []);
  // Yagona istisno: physical_cards.linked_code -> ON DELETE SET NULL.
  const phys = blocks.find(([, t]) => t === 'physical_cards');
  checkTrue('physical_cards.linked_code ON DELETE SET NULL bilan bog\'langan',
    /REFERENCES "cards" \("code"\) ON DELETE SET NULL/.test(phys[2]));
}

// ═══ 2. `code` ustuni bor HAR BIR kontent jadvali tozalanadi ═══
// Yangi jadval qo'shilsa va tozalash ro'yxatiga kiritilmasa — shu test yiqiladi.
{
  const blocks = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS "([a-z_]+)" \(([\s\S]*?)\n\);/g)];
  const withCode = blocks.filter(([, , body]) => /"code" TEXT/.test(body)).map(([, t]) => t);

  // Kontent EMAS — ataylab saqlanadigan yoki karta bilan bog'liq bo'lmagan jadvallar.
  const INTENTIONALLY_KEPT = new Set([
    'cards',                                   // kartaning o'zi
    'auctions', 'auction_demand', 'auction_requests', // auksion tarixi saqlanadi
    'web_orders', 'bot_orders',                // moliyaviy tarix saqlanadi
    'nfc_gifts', 'gift_offers',                // sovg'a tarixi (pending bekor qilinadi)
    'physical_cards',                          // boshqa odamniki bo'lishi mumkin — uziladi
    'password_reset_codes', 'phone_otp_codes', 'email_otp_codes', // bu yerdagi `code` — tasdiqlash kodi, karta emas
  ]);

  const missing = withCode.filter((t) => !INTENTIONALLY_KEPT.has(t) && !CARD_CONTENT_TABLES.includes(t));
  check('kod bo\'yicha bog\'langan hamma kontent jadvali tozalash ro\'yxatida', missing, []);
  checkTrue('ro\'yxat bo\'sh emas', CARD_CONTENT_TABLES.length >= 14);

  // Ro'yxatdagi har bir jadval HAQIQATAN sxemada bor va `code` ustuniga ega.
  const bad = CARD_CONTENT_TABLES.filter((t) => !withCode.includes(t));
  check('ro\'yxatdagi jadvallar sxemada mavjud va `code` ustuni bor', bad, []);
}

// ═══ 3. O'chirish yo'llari ═══
//
// 2026-09 (ACCOUNT_DELETION_PLAN.md, PR-1): qayta ro'yxatdan o'tish
// (`auth.js hardDeleteUser`) va sovg'a faollashtirish yo'llari
// foydalanuvchini `DELETE FROM users` bilan butunlay o'chirardi va
// CASCADE uning to'lov yozuvlarini ham olib ketardi. Ikkalasi olib
// tashlandi. Endi bu yerda ular QAYTIB KELMASLIGI tekshiriladi.
{
  const auth = readFileSync(new URL('../hosting/api/auth.js', import.meta.url), 'utf8');
  const account = readFileSync(new URL('../hosting/api/account.js', import.meta.url), 'utf8');
  // Izohlar olib tashlanadi: tushuntirishda bu so'zlar bor.
  const delUsers = /DELETE\s+FROM\s+"?users"?\b/i;
  check('auth.js foydalanuvchi qatorini o\'chirmaydi (DELETE FROM users yo\'q)', delUsers.test(stripComments(auth)), false);
  check('account.js foydalanuvchi qatorini o\'chirmaydi (DELETE FROM users yo\'q)', delUsers.test(stripComments(account)), false);
  checkTrue('account.js karta o\'chirish yo\'li tozalashni chaqiradi', /cardContentCleanupStmts\(/.test(account));
  // Eski NOTO'G'RI da'vo ("... qo'lda tozalanadi; qolganlari CASCADE.")
  // qaytib kelmasin — u tozalashni keraksiz deb o'ylashga olib kelgan edi.
  check('eski xato da\'vo olib tashlangan', /qo'lda tozalanadi; qolganlari CASCADE/.test(auth), false);
}

// ═══ 4. Egasi o'z kartasini o'chirgan yo'l ham yordamchini chaqiradi ═══
//
// Ilgari bu yo'lda jadvallarning QO'LDA YOZILGAN nusxasi turardi va
// test o'sha nusxani tekshirardi. Ikki ro'yxat vaqt o'tib
// bir-biridan uzoqlashdi — istoryalar aynan shu yerda tushib qoldi.
// Endi manba bitta, test ham shuni talab qiladi.
{
  const account = readFileSync(new URL('../hosting/api/account.js', import.meta.url), 'utf8');
  const del = account.slice(account.indexOf('deleteOwnCard'), account.indexOf('GIFT NFC ID'));
  checkTrue('egasi o\'chirgan yo\'l tozalash yordamchisini chaqiradi',
    /cardContentCleanupStmts\(/.test(del));
  checkTrue('jadvallar ro\'yxati bu yerda TAKRORLANMAYDI',
    !/DELETE FROM posts WHERE code/.test(del));
}

// ═══ 5. `code` EMAS, `owner_id` orqali bog'langan jadvallar ═══
//
// NIMA UCHUN ALOHIDA BAND: yuqoridagi 2-band sxemadan "code ustuni
// bor" jadvallarni topadi. `stories` esa kartaga `owner_id` orqali
// bog'langan va shu sababli ro'yxatga HECH QACHON tushmagan —
// profil o'chirilgach istoryalar bazada qolib ketardi.
//
// 8 xonali kodlar qayta sotuvga chiqadi, ya'ni qolib ketgan istorya
// keyinchalik BEGONA odamning profilida paydo bo'ladi. Egasi buni
// o'z telefonida ko'rgan: profil o'chirilgan, istorya Reels'da
// turibdi.
{
  const cleanup = readFileSync(new URL('../hosting/api/card-cleanup.js', import.meta.url), 'utf8');
  const OWNER_ID_TABLES = [
    ['stories', 'istoryalar'],
    ['story_likes', 'istorya layklari'],
    ['story_views', 'istorya ko\u2018rishlari'],
  ];
  const missing = OWNER_ID_TABLES
    .filter(([t]) => !new RegExp(`DELETE FROM ${t} WHERE`).test(cleanup))
    .map(([t]) => t);
  check('`owner_id` orqali bog\'langan jadvallar ham tozalanadi', missing, []);

  // Tartib: layk va ko'rishlar istoryaning O'ZIDAN OLDIN o'chishi
  // kerak, aks holda ular qaysi istoryaga tegishli ekanini
  // aniqlab bo'lmay qoladi.
  const iStories = cleanup.indexOf("DELETE FROM stories WHERE owner_kind");
  const iLikes = cleanup.indexOf('DELETE FROM story_likes');
  const iViews = cleanup.indexOf('DELETE FROM story_views');
  checkTrue('story_likes istoryadan OLDIN o\'chadi', iLikes >= 0 && iLikes < iStories);
  checkTrue('story_views istoryadan OLDIN o\'chadi', iViews >= 0 && iViews < iStories);
}

done();
