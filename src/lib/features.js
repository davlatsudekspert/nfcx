// Markazlashgan "feature flag"lar — funksiyani KOD BAZASIDAN o'chirmasdan,
// faqat saytda ko'rinishini vaqtincha to'xtatish uchun.
export const MESSAGING_ENABLED = false;

// YANGILIKLAR — VAQTINCHA YOPIQ (egasining qarori, 2026-09-25):
// shaxsiy ma'lumotlar bazasini ro'yxatdan o'tkazish arizasi javobi
// kelguncha saytda "Yangiliklar" ko'rinmaydi — menyu, footer, bosh
// sahifa va /yangiliklar (u yerga kirgan bosh sahifaga o'tadi).
// Yangiliklar O'CHIRILMAYDI: admin paneldan yozish va /api/news
// (ilova) avvalgidek ishlaydi. Qayta ochish: `true` qiling va
// public/sitemap.xml ga /yangiliklar qatorini qaytaring.
export const NEWS_ENABLED = false;

// To'lov tizimi (Payme) yoqilgan/yoqilmaganligi — bu yerda EMAS.
// src/lib/paymentsEnabled.jsx'dagi usePaymentsEnabled() hookini ishlating:
// qiymat endi backend'dan (Cloudflare secrets orqali boshqariladigan
// paymentsEnabledD1()) real vaqtda olinadi, shuning uchun bu yerdagi
// qattiq-yozilgan bayroq bilan qo'lda sinxronlash shart emas.
