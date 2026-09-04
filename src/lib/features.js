// Markazlashgan "feature flag"lar — funksiyani KOD BAZASIDAN o'chirmasdan,
// faqat saytda ko'rinishini vaqtincha to'xtatish uchun.
export const MESSAGING_ENABLED = false;

// To'lov tizimi (Payme) yoqilgan/yoqilmaganligi — bu yerda EMAS.
// src/lib/paymentsEnabled.jsx'dagi usePaymentsEnabled() hookini ishlating:
// qiymat endi backend'dan (Cloudflare secrets orqali boshqariladigan
// paymentsEnabledD1()) real vaqtda olinadi, shuning uchun bu yerdagi
// qattiq-yozilgan bayroq bilan qo'lda sinxronlash shart emas.
