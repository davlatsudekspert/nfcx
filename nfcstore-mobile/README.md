# NFCSTORE Mobile

NFCSTORE Android ilovasi (iOS'ga tayyor arxitektura). Expo SDK 57 + React
Native 0.86 + TypeScript.

Dizayn manbasi: Claude Design maketi `NFCSTORE App.dc.html` (shu
repozitoriyaning `project/` papkasida). Maketdagi ranglar, o'lchamlar,
SVG yo'llari va animatsiya vaqtlari **aynan** ko'chirilgan.

## Bu bosqichda nima bor

Kelishilgan qamrov — **profil ekrani va uning varaqlari**:

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
- **Home / Katalog / Kompaniyalar** — vaqtinchalik ekranlar, lekin
  almashtirgich tugmasi ularda ham ishlaydi

Auction tab **yo'q** — u saytdan olib tashlangan.

## Ishga tushirish

```bash
npm install
npm start          # keyin Expo Go yoki dev build
npm run typecheck  # tsc --noEmit
```

`npx expo export --platform android` bilan bundle tekshiriladi.

## Tuzilma

```
app/                    expo-router marshrutlari
  (tabs)/               4 tab + maxsus tabBar
  post/[id].tsx         to'liq ekran post
src/
  api/                  klient (Bearer), endpointlar, backend tiplari
  theme/                4 preset, CSS->RN o'girgichlar, tipografiya
  store/                auth, faol ID, dev rol override
  components/           TapScale, GoldSweep, Card, Sheet, StripeFill, nav
  features/profile/     sarlavha, tablar, varaqlar, ma'lumot qatlami
  lib/                  format (narx, ish vaqti, nisbiy vaqt)
docs/
  BEARER-AUTH-DIFF.md   backend uchun aniq diff (sayt sessiyasida qo'llanadi)
```

## Backend

Ilova mavjud jonli API ga ulanadi: `https://nfcstore.uz/api`.

`hosting/` **o'zgartirilmaydi**. Mobil uchun kerak bo'lgan bitta o'zgarish
(Bearer token) `docs/BEARER-AUTH-DIFF.md` da aniq diff sifatida yozilgan.

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
