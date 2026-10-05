// hosting/api/nearby.js — YAQIN ATROFDAGI BIZNESLAR (2026-10).
//
// ═══ NIMA UCHUN BOR ═══
//
// Ilovada "Yaqinimda" — odam turgan joyidan N km ichidagi bizneslar,
// eng yaqini birinchi. Biznes o'z sahifasida koordinatani allaqachon
// kiritadi (`companies.latitude/longitude`, xaritada "yo'nalish" uchun) —
// yangi ma'lumot yig'ilmaydi.
//
// ═══ MARSHRUT (ommaviy, kirish shart emas) ═══
//
//   GET /api/companies/nearby?lat=41.31&lng=69.24&radiusKm=5&limit=20
//     lat  -90..90, lng -180..180 (majburiy)
//     radiusKm  standart 5, 0.1..50
//     limit     standart 20, 1..50
//   → { items: [{ companyId, displayName, logoUrl, coverUrl, category,
//                 subcategory, city, address, latitude, longitude,
//                 distanceKm, openNow }], radiusKm, hasMore }
//   Xato: 422 { error: 'bad_location' | 'bad_radius' | 'bad_limit' }
//
// ═══ QOIDALAR ═══
//
//   * Faqat ommaga ochiq bizneslar — biznes sitemap'i bilan bir xil shart:
//     `status = 'active'`, egasi o'chirilmagan, NAMUNA (demo) va sinov
//     (`users.is_test`) akkauntlari emas. Namuna bizneslarning manzili
//     to'qima — "yaqinimda" ro'yxatida chalg'itardi.
//   * Javobda faqat ochiq sahifada ko'rinadigan maydonlar; egasi, emaili,
//     to'lov holati — YO'Q.
//   * Avval SQL'da "quti" (bounding box) bilan saralanadi — indekssiz ham
//     ko'p qatorni tashlab yuboradi; keyin aniq masofa (haversine) JS'da
//     hisoblanadi va radiusdan tashqaridagilar chiqarib tashlanadi.
//   * Tashrifchining koordinatasi HECH QAYERGA yozilmaydi va logga
//     tushmaydi (maxfiylik).

import { DEMO_OWNER } from './demo-businesses.js';

export const RADIUS_DEFAULT_KM = 5;
export const RADIUS_MAX_KM = 50;
export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 50;
const EARTH_KM = 6371.0088;
// Qutidan o'tganlardan nechtasi JS'da tekshiriladi. Shahar markazida
// 50 km qutiga minglab biznes tushishi mumkin — so'rov cheklanadi.
const CANDIDATE_MAX = 2000;

/// Ikki nuqta orasidagi masofa (km), haversine.
export function haversineKm(lat1, lng1, lat2, lng2) {
  const r = (d) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1);
  const dLng = r(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

const num = (v) => (v === null || v === undefined || String(v).trim() === '' ? NaN : Number(v));

export async function handle(request, env, url, H) {
  if (url.pathname !== '/api/companies/nearby') return null;
  if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
  const lat = num(url.searchParams.get('lat'));
  const lng = num(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return H.json({ error: 'bad_location' }, 422);
  }
  const rRaw = url.searchParams.get('radiusKm');
  const radiusKm = rRaw === null || rRaw === '' ? RADIUS_DEFAULT_KM : Number(rRaw);
  if (!Number.isFinite(radiusKm) || radiusKm < 0.1 || radiusKm > RADIUS_MAX_KM) {
    return H.json({ error: 'bad_radius', max: RADIUS_MAX_KM }, 422);
  }
  const lRaw = url.searchParams.get('limit');
  const limit = lRaw === null || lRaw === '' ? LIMIT_DEFAULT : Number(lRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX) {
    return H.json({ error: 'bad_limit', max: LIMIT_MAX }, 422);
  }

  // Quti: kenglik bo'yicha 1° ≈ 111.32 km; uzunlik bo'yicha kenglikka
  // qarab torayadi. Qutbga yaqin joyda (cos → 0) uzunlik cheklanmaydi.
  const dLat = radiusKm / 111.32;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = cos > 0.01 ? Math.min(180, radiusKm / (111.32 * cos)) : 180;
  const minLng = lng - dLng;
  const maxLng = lng + dLng;
  // Sana chizig'idan (±180°) o'tadigan quti — ikki bo'lak.
  const lngCond = dLng >= 180
    ? '1 = 1'
    : minLng < -180
      ? '(longitude >= ? OR longitude <= ?)'
      : maxLng > 180
        ? '(longitude >= ? OR longitude <= ?)'
        : 'longitude BETWEEN ? AND ?';
  const lngArgs = dLng >= 180 ? [] : minLng < -180 ? [minLng + 360, maxLng] : maxLng > 180 ? [minLng, maxLng - 360] : [minLng, maxLng];

  const rows = await env.DB.prepare(
    `SELECT company_id, display_name, logo_url, cover_url, category, subcategory, city, address,
            latitude, longitude, hours_json
       FROM companies
      WHERE status = 'active'
        AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND latitude BETWEEN ? AND ? AND ${lngCond}
        AND NOT EXISTS (SELECT 1 FROM users du WHERE CAST(du.id AS TEXT) = CAST(companies.owner_user_id AS TEXT)
                          AND (du.deleted_at IS NOT NULL OR du.is_test = 1))
        AND CAST(owner_user_id AS TEXT) <> ?
      LIMIT ${CANDIDATE_MAX}`
  ).bind(lat - dLat, lat + dLat, ...lngArgs, DEMO_OWNER).all();

  const found = [];
  for (const r of rows.results || []) {
    const la = Number(r.latitude);
    const lo = Number(r.longitude);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    const d = haversineKm(lat, lng, la, lo);
    if (d > radiusKm) continue;
    found.push({ r, d });
  }
  found.sort((a, b) => a.d - b.d || String(a.r.company_id).localeCompare(String(b.r.company_id)));
  const items = found.slice(0, limit).map(({ r, d }) => ({
    companyId: r.company_id,
    displayName: r.display_name || r.company_id,
    logoUrl: r.logo_url || '',
    coverUrl: r.cover_url || '',
    category: r.category || '',
    subcategory: r.subcategory || '',
    city: r.city || '',
    address: r.address || '',
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    distanceKm: Math.round(d * 100) / 100,
    openNow: H.companyOpenNow ? H.companyOpenNow(r.hours_json) : null,
  }));
  return H.json({ items, radiusKm, hasMore: found.length > limit });
}
