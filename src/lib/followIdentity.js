// ── OBUNA YUZI: "KIM NOMIDAN OBUNA BO'LDIM" ──────────────────────────
// Odam boshqa profilga obuna bo'lganda shaxsiy profili nomidan emas,
// o'z KOMPANIYASI nomidan chiqishi mumkin. Tanlov shu brauzerda eslab
// qolinadi — bu ko'rsatma emas, shunchaki qulaylik: har bir obuna
// baribir SERVERDA qaytadan tekshiriladi (kompaniya rostdan shu
// odamnikimi va faolmi).
//
// Kalit ProfilePage va AccountPage o'rtasida BO'LINADI: hisobda
// "Profilda kompaniya" tanlanganda shu yerga yoziladi, profil sahifasi
// esa shu yerdan o'qiydi. Ilgari ikkalasi bir-birini bilmasdi va odam
// hisobda kompaniyani tanlab, boshqa profilga obuna bo'lsa hamon
// shaxsiy profil nomidan chiqardi.
export const FOLLOW_AS_KEY = 'nfc_follow_as';

// "Shaxsiy profilim" TANLANGANI bilan "hech qachon tanlanmagani" bir xil
// emas: birinchisida standart qiymat qo'yilmasligi kerak, ikkinchisida
// esa profilga biriktirilgan kompaniya standart bo'lib olinadi. Shu
// sababli ataylab tanlangan shaxsiy profil '-' bilan belgilanadi.
export const FOLLOW_AS_PERSONAL = '-';

// null — hech qachon tanlanmagan; '' — ataylab shaxsiy profil.
export function readFollowAs() {
  try {
    const v = localStorage.getItem(FOLLOW_AS_KEY);
    if (v === null) return null;
    return v === FOLLOW_AS_PERSONAL ? '' : v;
  } catch { return null; }
}

export function rememberFollowAs(value) {
  try { localStorage.setItem(FOLLOW_AS_KEY, value || FOLLOW_AS_PERSONAL); } catch { /* jim tur */ }
}
