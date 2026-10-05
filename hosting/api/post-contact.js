// hosting/api/post-contact.js — biznes postidagi "Bog'lanish" tugmasi.
//
// ═══ BIZNES POSTIDA "BOG'LANISH" TUGMASI (2026-10) ═══════════════════
//
// Lentadagi biznes postining ostida "Qo'ng'iroq / Telegram / Xarita"
// tugmalari. Faqat kompaniya o'z OCHIQ sahifasida (`GET
// /api/companies/:id`) allaqachon hammaga ko'rsatadigan maydonlar:
// telefon, Telegram va manzil/koordinata. Egasining emaili, admin
// izohlari va boshqa ichki maydonlar BU YERGA HECH QACHON tushmaydi.
//
// Ma'lumot lentaning O'ZI so'rovidan keladi (UNION dagi kompaniya JOIN'i)
// — yangi so'rov ham, yangi to'lqin ham yo'q. Yashirin (faol bo'lmagan,
// egasi o'chirilgan, namuna) kompaniyaning posti lentaga umuman
// tushmaydi, demak kontakti ham chiqmaydi.
//
// Shakl: { phone, telegram, mapUrl } — yo'q qiymat `null`.
// `mapUrl` — sayt bilan bir xil Google Maps yo'nalish havolasi
// (`src/lib/mapLink.js` `googleDirectionsUrl`).
export function companyContact({ phone, telegram, latitude, longitude, address } = {}) {
  const s = (v) => {
    const t = String(v ?? '').trim();
    return t ? t.slice(0, 120) : null;
  };
  const lat = latitude === null || latitude === undefined || latitude === '' ? NaN : Number(latitude);
  const lng = longitude === null || longitude === undefined || longitude === '' ? NaN : Number(longitude);
  const coords = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : '';
  const q = coords || String(address ?? '').trim();
  return {
    phone: s(phone),
    telegram: s(telegram),
    mapUrl: q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q.slice(0, 300))}` : null,
  };
}
