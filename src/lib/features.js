// Markazlashgan "feature flag"lar — funksiyani KOD BAZASIDAN o'chirmasdan,
// faqat saytda ko'rinishini vaqtincha to'xtatish uchun.
export const MESSAGING_ENABLED = false;
// To'lov tizimi — Payme bilan real integratsiya (merchant credential'lar)
// tayyor bo'lmaguncha FALSE. Barcha pullik oqimlarning "To'lash" tugmalari
// disabled holatga o'tadi va "Payme orqali to'lov tez orada ishga tushadi"
// izohi ko'rsatiladi. Tekin (0 so'm) kodlarni band qilish bunga bog'liq emas.
export const PAYMENTS_ENABLED = false;
