// Markazlashgan "feature flag"lar — funksiyani KOD BAZASIDAN o'chirmasdan,
// faqat saytda ko'rinishini vaqtincha to'xtatish uchun.
export const MESSAGING_ENABLED = false;
// To'lov tizimi — Payme bilan real integratsiya (merchant credential'lar)
// tayyor bo'lmaguncha FALSE. Barcha pullik oqimlarning "To'lash" tugmalari
// disabled holatga o'tadi va "Payme orqali to'lov tez orada ishga tushadi"
// izohi ko'rsatiladi. (Bronza tarifi ham endi 49 000 so'm — 0 so'mlik
// tarif yo'q, shuning uchun endi HAMMA tarif shu bayroqqa bog'liq.)
export const PAYMENTS_ENABLED = false;
