// Umumiy yordamchilar: sana, masofa, lokal saqlash.
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** "2027-10-11T09:00" → "11-oktabr, 09:00" */
export function formatDateTime(iso) {
  const [date, time] = iso.split('T');
  const [, m, d] = date.split('-').map(Number);
  return `${d}-${MONTHS[m - 1]}, ${time}`;
}

/** Ikki nuqta orasidagi masofa (km), haversine formulasi. */
export function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export const formatKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

/** localStorage xavfsiz o'rami (private rejimda xato bermasligi uchun). */
export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* e'tiborsiz */
    }
  },
};

export const TASHKENT = { lat: 41.3111, lng: 69.2797 };
