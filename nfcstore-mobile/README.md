# NFCSTORE Mobile

NFCSTORE Android ilovasi (iOS'ga tayyor arxitektura). Expo SDK 57 + React
Native 0.86 + TypeScript.

Dizayn manbasi: Claude Design maketi `NFCSTORE App.dc.html` (shu
repozitoriyaning `project/` papkasida). Maketdagi ranglar, o'lchamlar,
SVG yo'llari va animatsiya vaqtlari **aynan** ko'chirilgan.

## Bu bosqichda nima bor

**NFC o'qish, Home, Katalog, Dashboard va to'liq profil tizimi:**

- **NFC o'qish** — ilovaning asosiy vazifasi. Kartani tekkizsangiz teg
  ichidagi URL o'qiladi, koddan profil ochiladi, chip esa orqada
  tekshiriladi. ⚠️ **Expo Go da ishlamaydi** — development build kerak
  (pastdagi "NFC va development build" bo'limiga qarang)
- **Home** — tezkor amal kartalari, hammasi haqiqiy endpointlarda:
  ID holati, jismoniy karta narxi, sovg'a (kutilayotganlar soni),
  to'lovlar (Payme holati, premium/sinov muddati), tarif chizig'i
- **Katalog** — band qilingan profillar direktoriyasi mini NFC karta
  ko'rinishida, Barchasi / Shaxsiy / Ekspert / Biznes filtrlari va
  qidiruv bilan
- **Dashboard** (biznes egasi) — 30 kunlik metrikalar va grafik,
  buyurtmalar ro'yxati (holatni o'zgartirish bilan), katalog boshqaruvi
  (tahrirlash, o'chirish, rasmsiz qo'shish)
- **Kompaniyalar** — barcha Company ID lar, har biri Dashboard'ga olib
  boradi
- **Tashqi profillar** — `/p/<KOD>` va `/c/<ID>`: NFC teginish va
  Katalog shu ekranlarga olib boradi, profil tabi bilan bir xil
  komponentdan

Profil qismi (kelishilgan asosiy qamrov):

- **Biznes profil** — bezak chiziqlari + kichik brend belgisi, aylanuvchi
  shimmer halqali avatar, musiqa nishoni, "Hozir ochiq" + ish vaqti,
  telefon/shahar, statistika, Dashboard + Profilni tahrirlash (egasi) yoki
  Obuna bo'lish (tashrifchi), Ulashish, brend rangli kontakt ikonkalari
- **Shaxsiy profil** — bir xil vizual til, ish vaqti o'rniga rol qatori,
  2-tab "Havolalar" (zanjir ikonkasi), tasdiqlash nishoni haqiqiy
  `verified` ustuniga bog'langan
- **4 tab** — Postlar (3 ustun), Katalog (2 ustun) / Havolalar, Reels
  (9:16), Ma'lumot
- **Varaqlar** — profil almashtirgich (barcha ID lar bitta ro'yxatda, tur
  yorliqlari bilan, bir bosishda to'liq almashadi), Sozlamalar (4 tema
  preseti, qurilmada saqlanadi), oxirgi post to'liq ekranda
- **Pastki navigatsiya** — gradient bilan to'ldirilgan faol ikonka,
  ortidagi yorug'lik, siljiydigan indikator, bosishda 1.12x sakrash
Almashtirgich tugmasi (handle + chevron) BARCHA tablarda bir xil joyda.

Auction tab **yo'q** — u saytdan olib tashlangan.

## Keyingi bosqichga qolgani

- Mahsulot rasmini ilovadan yuklash (`expo-image-picker` +
  `/api/upload-media`) — hozir rasmsiz qo'shiladi
- Yangi Company ID ochish formasi (hozir veb orqali)
- Profilni tahrirlash va post/reels qo'shish oqimlari
- Shaxsiy kartaning post/feed tarkibi — backendda hali yo'q

## Ishga tushirish

```bash
npm install
npm start          # keyin Expo Go yoki dev build
npm run typecheck  # tsc --noEmit
```

```bash
npm test           # NFC teg URL parseri (14 test)
npx expo export --platform android   # bundle tekshiruvi
```

## NFC va development build

NFC nativ modul talab qiladi, shuning uchun **Expo Go da ishlamaydi** —
u yerda ilova ochiladi, lekin "NFC qo'llab-quvvatlanmaydi" xabari chiqadi.

Haqiqiy qurilmada sinash uchun development build kerak:

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

`eas.json` da `development` profili tayyor (APK, `developmentClient: true`).
Build tugagach APK ni qurilmaga o'rnatib, `npx expo start --dev-client`
bilan ulanasiz. Mahalliy build ham bo'ladi: `npx expo run:android`
(Android SDK o'rnatilgan bo'lishi kerak).

iOS: NFC simulyatorda ishlamaydi, haqiqiy qurilma va Apple Developer
hisobidagi NFC entitlement kerak. Konfiguratsiya `app.json` da tayyor.

## Tuzilma

```
app/                    expo-router marshrutlari
  (tabs)/               4 tab + maxsus tabBar
  p/[code].tsx          tashqi shaxsiy profil (NFC, Katalog)
  c/[companyId].tsx     tashqi kompaniya profili
  dashboard/[companyId].tsx   biznes egasining Dashboard'i
  post/[id].tsx         to'liq ekran post
src/
  api/                  klient (Bearer), endpointlar, backend tiplari
  theme/                4 preset, CSS->RN o'girgichlar, tipografiya
  store/                auth, faol ID, dev rol override
  components/           TapScale, GoldSweep, Card, Sheet, StripeFill, nav
  features/profile/     sarlavha, tablar, varaqlar, ma'lumot qatlami
  features/nfc/         teginish oqimi va o'qish tugmasi
  features/home/        tezkor amal kartalari
  features/katalog/     mini NFC karta ro'yxati va filtrlar
  features/dashboard/   metrikalar, buyurtmalar, katalog boshqaruvi
  lib/                  format, NFC (nfc.ts, tagUrl.ts), svgId
docs/
  BEARER-AUTH-DIFF.md   Bearer auth o'zgarishi — qo'llangan, tarixiy yozuv
```

## Backend

Ilova mavjud jonli API ga ulanadi: `https://nfcstore.uz/api`.

Autentifikatsiya — **Bearer token**, cookie emas. Backend tomoni qo'llangan va
production'da tasdiqlangan: `getCurrentUser()` cookie bo'lmasa `Authorization:
Bearer` dan o'qiydi, login/register esa `X-Client: mobile` sarlavhasi bilan
javob tanasida `token` qaytaradi. Veb tomonidagi cookie oqimi o'zgarmagan.
Batafsili: `docs/BEARER-AUTH-DIFF.md`.

Token `expo-secure-store` da saqlanadi (Android Keystore / iOS Keychain).

Ro'yxatdan o'tish oqimi tekshirilgan (`hosting/api/auth.js`, 2026-09):
bir qadam, Telegram OTP **yo'q** — `phone` + `password` + `tosAccepted`,
`email` ixtiyoriy.

## CSS -> React Native o'girmalar

Maketda brauzerga xos bir nechta narsa bor, ularning RN dagi ekvivalenti:

| CSS | RN dagi yechim |
|---|---|
| `conic-gradient` (shimmer halqa) | 4 chorak SVG yoy, har biriga chiziqli gradient |
| `radial-gradient` + `blur()` (nav yorug'ligi) | SVG `RadialGradient`, blur o'rniga oraliq to'xtash nuqtasi |
| `repeating-linear-gradient` (placeholder) | SVG `Pattern`, `rotate(-45)` |
| `translateX(%)` (sweep) | `onLayout` bilan o'lchab pikselga o'girish |
| `box-shadow` pulsatsiyasi | kengayib o'chadigan chegara halqasi |
| `linear-gradient(Ndeg)` | `angle()` yordamchisi -> `start`/`end` |
| `grid-template-columns` | katak kengligini aniq hisoblash |
| `localStorage` | `AsyncStorage` |

`box-shadow` Android'da rangli/yumshoq bo'lmaydi (`elevation` bilan
taqqoslanadi) — bu RN cheklovi, qora fonda deyarli sezilmaydi.
