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
// VAQT UCH XIL FORMATDA YOZILGAN:
//   "2026-09-07 00:21:21"           SQLite DEFAULT CURRENT_TIMESTAMP
//   "2026-09-07T00:21:21.055Z"      ISO
//   "2026-09-07 00:21:21.065+00"    worker.js nowTs() va eski Postgres
//
// Uchinchisini SQLite PARSE QILA OLMAYDI (soat mintaqasida daqiqa yo'q:
// "+00", "+00:00" emas) va `strftime` NULL qaytarardi. Ilgari shu holat
// "taymer ko'rsatilmaydi" deb qabul qilingan edi — noto'g'ri vaqtdan
// ko'ra yo'g'i afzal. LEKIN bu premium va jismoniy karta
// buyurtmalarining HAMMASIGA tegishli edi (ular aynan nowTs() bilan
// yoziladi), ya'ni mijoz eng muhim joyda — to'lovni davom ettirish
// oynasida — qancha vaqti qolganini KO'RMASDI.
//
// Endi vaqt oldindan normallashtiriladi: birinchi 19 belgi olinadi
// (kasr va mintaqa tashlanadi) va probel "T" ga almashtiriladi. Uchala
// format ham to'g'ri o'qiladi; NULL tekshiruvi joyida qoladi, chunki
// butunlay buzuq qiymat baribir bo'lishi mumkin.
const CREATED_AT_EPOCH_SQL = `strftime('%s', replace(substr(created_at, 1, 19), ' ', 'T'))`;

export const PENDING_EXPIRES_MS_SQL =
  `CASE WHEN ${CREATED_AT_EPOCH_SQL} IS NULL THEN NULL
        ELSE (CAST(${CREATED_AT_EPOCH_SQL} AS INTEGER) + ${PENDING_ORDER_TTL_HOURS * 3600}) * 1000 END`;
