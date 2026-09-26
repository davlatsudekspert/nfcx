// Markazlashgan "feature flag"lar — funksiyani KOD BAZASIDAN o'chirmasdan,
// faqat saytda ko'rinishini vaqtincha to'xtatish uchun.
export const MESSAGING_ENABLED = false;

// YANGILIKLAR — QAYTA OCHILDI (egasining qarori, 2026-09-26): ilova,
// mavzular va stikerlar savdosi haqidagi yangiliklar saytda ko'rinadi.
// (2026-09-25 da vaqtincha yopilgan edi.) Yopish kerak bo'lsa: `false`
// qiling va public/sitemap.xml dan /yangiliklar qatorini olib tashlang.
export const NEWS_ENABLED = true;

// To'lov tizimi (Payme) yoqilgan/yoqilmaganligi — bu yerda EMAS.
// src/lib/paymentsEnabled.jsx'dagi usePaymentsEnabled() hookini ishlating:
// qiymat endi backend'dan (Cloudflare secrets orqali boshqariladigan
// paymentsEnabledD1()) real vaqtda olinadi, shuning uchun bu yerdagi
// qattiq-yozilgan bayroq bilan qo'lda sinxronlash shart emas.
