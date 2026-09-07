// ─────────────────────────────────────────────────────────────────────────────
// KUTILAYOTGAN BUYURTMANING AMAL QILISH MUDDATI — YAGONA MANBA
// ─────────────────────────────────────────────────────────────────────────────
// Bitta kod uchun bir vaqtda faqat BITTA kutilayotgan buyurtma bo'la oladi.
// Muddati o'tgan buyurtma `activeWebOrderByCodeD1()` da avtomatik bekor
// qilinadi va kod qayta sotuvga chiqadi — bu mexanizm avvaldan bor.
//
// 24 SOAT — mavjud ishlab chiqarish xulqi (avval bu qiymat worker.js ichida
// yolg'iz turardi). Bu yerga ko'chirildi, chunki endi UCH joy bir xil
// qiymatga tayanadi: avtomatik bekor qilish (worker.js), adminning qo'lda
// bekor qilishi (admin-extra.js) va kabinetdagi teskari hisob
// (/api/orders -> AccountPage). Ular ajralib ketmasligi uchun bitta manba.
//
// NIMA UCHUN QISQARTIRILMAYDI: muddatni erta tugatish XAVFLI — mijoz hali
// to'layotgan bo'lishi mumkin. To'lov o'tadi, lekin buyurtma allaqachon
// bekor qilingani uchun `finalizePaidWebOrderD1()` `alreadyProcessed`
// qaytaradi va karta berilmaydi. Payme tranzaksiyasining o'z muddati
// 12 soat, ya'ni 24 soat undan ham xavfsiz tomonda.
export const PENDING_ORDER_TTL_HOURS = 24;
export const PENDING_ORDER_TTL_MS = PENDING_ORDER_TTL_HOURS * 60 * 60 * 1000;

// Buyurtma muddati tugaydigan payt (epoch ms) — kabinetdagi taymer uchun.
//
// DIQQAT: bazada vaqt ikki xil formatda uchraydi. SQLite'ning
// DEFAULT CURRENT_TIMESTAMP ("2026-09-07 00:21:21") va ISO
// ("...T00:21:21.055Z") — ikkalasini ham SQLite tushunadi. Lekin worker.js
// `nowTs()` formati ("2026-09-07 00:21:21.065+00") sana funksiyalarini
// BUZADI va `strftime` NULL qaytaradi. Shunday holatda taymer
// ko'rsatilmaydi (NULL) — noto'g'ri vaqt ko'rsatgandan ko'ra, umuman
// ko'rsatmagan afzal.
export const PENDING_EXPIRES_MS_SQL =
  `CASE WHEN strftime('%s', created_at) IS NULL THEN NULL
        ELSE (CAST(strftime('%s', created_at) AS INTEGER) + ${PENDING_ORDER_TTL_HOURS * 3600}) * 1000 END`;
