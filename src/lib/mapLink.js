// Lokatsiyaga YO'NALISH havolasi — qurilmadagi xarita ilovasiga mos.
//
// Avval hamma joyda Google Maps'ning QIDIRUV havolasi qattiq yozilgan
// edi: u nuqtani ko'rsatardi, lekin yo'nalish bermasdi va iPhone'da
// brauzerda ochilib qolardi. Endi:
//   iPhone/iPad -> Apple Maps (tizim xaritasi, ilovada ochiladi)
//   qolganlari  -> Google Maps yo'nalish havolasi (Android'da ilovaning
//                  o'zida ochiladi)
// Yandex alohida tugma sifatida beriladi — O'zbekistonda ko'p
// ishlatiladi va Google Maps'da ba'zi ko'chalar aniq emas.

function isApple() {
  if (typeof navigator === 'undefined') return false;
  const ua = String(navigator.userAgent || '');
  // iPadOS 13+ o'zini Mac deb ko'rsatadi — sensorli ekran bilan ajratamiz.
  return /iPhone|iPad|iPod/i.test(ua)
    || (/Macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
}

// Koordinata bormi? `0` ham HAQIQIY qiymat bo'lishi mumkin, shuning
// uchun `!lat` emas, aniq tekshiruv (null/undefined/NaN rad etiladi).
export function hasCoords(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    && lat != null && lng != null;
}

// Asosiy tugma — qurilmaning o'z xaritasida yo'nalish.
export function directionsUrl({ latitude, longitude, address } = {}) {
  const coords = hasCoords(latitude, longitude) ? `${latitude},${longitude}` : '';
  const q = coords || String(address || '').trim();
  if (!q) return '';
  if (isApple()) {
    // daddr — "manzilga yo'nalish"; dirflg=d — avtomobilda.
    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

// Yandex Karta — yo'nalish rejimida. rtext=~manzil: boshlanish nuqtasi
// bo'sh qoldiriladi, Yandex uni foydalanuvchining joyidan oladi.
export function yandexDirectionsUrl({ latitude, longitude, address } = {}) {
  if (hasCoords(latitude, longitude)) {
    return `https://yandex.uz/maps/?rtext=~${latitude}%2C${longitude}&rtt=auto`;
  }
  const a = String(address || '').trim();
  return a ? `https://yandex.uz/maps/?text=${encodeURIComponent(a)}` : '';
}

// Google Maps — Apple qurilmasida ham alohida tanlov sifatida kerak.
export function googleDirectionsUrl({ latitude, longitude, address } = {}) {
  const coords = hasCoords(latitude, longitude) ? `${latitude},${longitude}` : '';
  const q = coords || String(address || '').trim();
  return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : '';
}

// Yandex Navigator — ILOVA sxemasi. O'zbekistonda yo'nalish uchun eng
// ko'p ishlatiladigan ilova, lekin uning veb-versiyasi yo'q: sxema
// ochilmasa odam bo'sh ekranda qoladi. Shuning uchun `openMapApp()`
// zaxira havola bilan birga ishlatiladi.
export function yandexNaviUrl({ latitude, longitude } = {}) {
  if (!hasCoords(latitude, longitude)) return '';
  return `yandexnavi://build_route_on_map?lat_to=${latitude}&lon_to=${longitude}`;
}

// Qurilmada MAVJUD bo'lishi mumkin bo'lgan xarita ilovalari ro'yxati.
//
// Nima uchun O'ZIMIZNING ro'yxat, `geo:` havolasi emas: `geo:` da
// Android tizimning o'z tanlovini ko'rsatadi (bu yaxshi), lekin
// iPhone'da u UMUMAN ishlamaydi — odam bosadi va hech narsa bo'lmaydi.
// O'z ro'yxatimiz har ikkala tizimda ham bir xil ishlaydi.
export function mapApps(company) {
  const apple = isApple();
  const navi = yandexNaviUrl(company);
  return [
    navi && {
      id: 'navi', label: 'Yandex Navigator', url: navi,
      // Ilova o'rnatilmagan bo'lsa — Yandex Kartaning veb-versiyasi.
      fallback: yandexDirectionsUrl(company),
    },
    { id: 'ymaps', label: 'Yandex Xarita', url: yandexDirectionsUrl(company) },
    { id: 'gmaps', label: 'Google Maps', url: googleDirectionsUrl(company) },
    apple && { id: 'amaps', label: 'Apple Xarita', url: directionsUrl(company) },
  ].filter((x) => x && x.url);
}

// Ilovani ochadi. Sxemali havola (yandexnavi://) ochilmasa — brauzer
// hech narsa qilmaydi va odam bo'sh ekranda qoladi. Shuning uchun
// qisqa kutishdan keyin, sahifa HALI HAM ko'rinib tursa (ya'ni ilova
// ochilmagan bo'lsa), zaxira havolaga o'tamiz.
export function openMapApp(app) {
  if (!app?.url) return;
  if (!app.fallback) { window.open(app.url, '_blank', 'noreferrer'); return; }
  window.location.href = app.url;
  setTimeout(() => {
    if (!document.hidden) window.location.href = app.fallback;
  }, 1500);
}
