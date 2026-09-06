// ─────────────────────────────────────────────────────────────────────────────
// KARTAGA BOG'LIQ MA'LUMOTNI TOZALASH (orphan-larning oldini olish)
// ─────────────────────────────────────────────────────────────────────────────
// NIMA UCHUN KERAK (2026-09):
// `posts`, `menu_items`, `products`, `card_gallery` va shu kabi jadvallar
// kartaga FAQAT `code` ustuni orqali bog'langan — sxemada `cards` ga
// FOREIGN KEY UMUMAN YO'Q (db/d1-migration/0001-schema.sql tekshirilgan),
// demak CASCADE ham yo'q. `hosting/api/auth.js` dagi eski izohda
// "qolganlari CASCADE" deyilgan edi — bu NOTO'G'RI.
//
// Oqibati: foydalanuvchi o'chirilib, uning kartalari `cards` dan ketsa,
// postlar/menyu/mahsulotlar/galereya va MIJOZ LIDLARI bazada qolib
// ketardi. Keyin o'sha KOD boshqa odamga berilsa (yoki sotib olinsa),
// eski egasining kontenti YANGI egasining profilida ko'rinib qolardi.
// Bu maxfiylik muammosi.
//
// Shu sababli foydalanuvchi/karta o'chirilayotgan HAR BIR joyda shu
// yordamchi ishlatiladi. `scripts/test-card-cleanup.mjs` sxemadagi
// kod-bog'liq jadvallar ro'yxatini shu ro'yxat bilan solishtiradi —
// kelajakda yangi jadval qo'shilsa, test darhol ogohlantiradi.

// Kartaning O'ZI bilan birga ketishi kerak bo'lgan jadvallar.
// Tartib muhim: post_likes postlardan OLDIN (u post_id orqali bog'langan).
export const CARD_CONTENT_TABLES = [
  'posts', 'menu_items', 'menu_categories', 'products', 'product_categories',
  'services', 'service_categories', 'card_gallery', 'card_files', 'card_videos',
  'card_team', 'card_leads', 'card_events', 'card_likes',
];

// Berilgan SQL-shart (`codeWhere`) bo'yicha tanlanadigan kodlarga tegishli
// barcha kontentni o'chiradigan statement'lar. `codeWhere` — `cards`
// jadvalidan kod tanlaydigan to'liq SELECT (masalan
// `SELECT code FROM cards WHERE user_id = ?`). `binds` har bir statement
// uchun qayta ishlatiladi.
export function cardContentCleanupStmts(env, codeSelect, binds, nowTs) {
  const stmts = [
    // post_likes → posts orqali; postlar o'chirilishidan OLDIN.
    env.DB.prepare(`DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE code IN (${codeSelect}))`).bind(...binds),
  ];
  for (const t of CARD_CONTENT_TABLES) {
    stmts.push(env.DB.prepare(`DELETE FROM ${t} WHERE code IN (${codeSelect})`).bind(...binds));
  }
  // Sovg'a takliflari O'CHIRILMAYDI — tarix saqlanadi, faqat kutayotgani
  // bekor qilinadi (egasi o'z kartasini o'chirgandagi bilan bir xil xulq).
  stmts.push(
    env.DB.prepare(`UPDATE gift_offers SET status = 'cancelled', decided_at = ? WHERE code IN (${codeSelect}) AND status = 'pending'`).bind(nowTs, ...binds),
  );
  // Jismoniy karta boshqa odamniki bo'lishi mumkin — o'chirmaymiz, uzamiz.
  stmts.push(
    env.DB.prepare(`UPDATE physical_cards SET linked_code = NULL WHERE linked_code IN (${codeSelect})`).bind(...binds),
  );
  return stmts;
}
