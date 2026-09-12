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

## APK olish (NFC'ni telefonda sinash)

NFC nativ modul, shuning uchun **Expo Go'da ishlamaydi** — u yerda ilova
ochiladi, lekin "NFC qo'llab-quvvatlanmaydi" xabari chiqadi. Telefonda
sinash uchun APK kerak.

### Variant 1 — EAS bulut build (eng oson, Android SDK kerak emas)

```bash
npm install -g eas-cli
eas login                 # Expo hisobi bilan
eas build:configure       # birinchi marta: projectId yaratadi

# Telefonga o'rnatib SINASH uchun — mustaqil APK, noutbuk kerak emas:
eas build --profile preview --platform android

# Faol ISHLAB CHIQISH uchun — Metro serverga ulanadi:
eas build --profile development --platform android
```

Build tugagach Expo yuklab olish havolasini beradi (QR kod ham).
`preview` APK o'z-o'zidan ishlaydi — NFC'ni sinash uchun shu qulay.
`development` APK esa `npx expo start --dev-client` bilan ulanadi.

### Variant 2 — mahalliy build (Android Studio o'rnatilgan bo'lsa)

```bash
npx expo prebuild --platform android   # android/ papkasini yaratadi
npx expo run:android                   # qurilmaga o'rnatadi
# yoki qo'lda APK:
cd android && ./gradlew assembleRelease
# natija: android/app/build/outputs/apk/release/
```

`ANDROID_HOME` va `JAVA_HOME` sozlangan bo'lishi kerak.

### iOS

NFC simulyatorda ishlamaydi — haqiqiy qurilma va Apple Developer
hisobidagi NFC entitlement kerak. Konfiguratsiya `app.json` da tayyor:

```bash
eas build --profile development --platform ios
```

### Nima uchun bu APK sessiyada yasalmaydi

Claude Code ishlayotgan muhitda tarmoq siyosati `dl.google.com` va
`api.expo.dev` ni bloklaydi. Birinchisi Android SDK (`android.jar`,
`aapt2`, `d8`) yuklab olishni, ikkinchisi EAS bulut buildini imkonsiz
qiladi. Shuning uchun APK sizning mashinangizda yoki EAS'da yasaladi.
