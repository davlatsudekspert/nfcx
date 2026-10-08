# LabGuide — progress

Yangi sessiya shu fayldan boshlaydi. Oxirgi yangilanish: **2026-10-08, 1-sessiya**.

## Qisqacha holat

**A bosqich (UI, onboarding, rollar, navigatsiya, i18n, mavzu) tugadi.** B bosqichning asosiy
qismi (kontent modeli, tekshiriladigan paket, qidiruv, kartalar, xatcho‘p, manba/review
metadata) va C/D dan bir qismi (kalkulyatorlar, IFU moslik mantig‘i, atomar paket o‘rnatuvchi,
izohli test) ham bor. Domla materiallari uchun sxema va tartib tayyor; **materiallar hali
kelmagan**.

## Bajarilganlar

- `labguide/` — alohida Flutter loyiha (iOS + Android), NFCSTORE fayllari o‘zgarmagan (D-01).
- Dizayn tizimi (prototype v5): ranglar, Inter, tipografika, radiuslar, komponentlar,
  light/dark/system, 160 ms press, 200 ms o‘tish, reduced motion.
- Onboarding: welcome → mehmon / email → OTP → rol. Demo OTP faqat debug’da.
- 4 rolga mos bosh sahifa; 5 tab (o‘z stacki va scroll holati bilan); profil.
- Scroll’da ixchamlashadigan katta sarlavha (14 px hysteresis, 200 ms).
- UZ/RU/EN interfeys (ARB), kontent esa paketda 3 tilda.
- Kontent (D-19): 8 guruh, **35 analitning hammasi manbali o‘quv kartasi** (MedlinePlus, NIDDK,
  NHLBI — 52 manba; har da’vo manba va bo‘lim bilan; iqtiboslar sahifalarga qayta solishtirildi).
  Mustaqil review **yo‘q** — hammasi draft. Ochiq savollar: [CONTENT_REVIEW_NOTES.md](CONTENT_REVIEW_NOTES.md).
- Mashq: 71 ta izohli savol (draft): mavzu bo‘yicha (guruh), har analit kartasidan (2 ta) yoki
  aralash 10 ta; natija va xatolar tahlili haqiqiy javoblardan.
- Analit kartasidan tegishli kalkulyatorga o‘tish (kreatinin → eGFR, lipidlar → LDL va h.k.).
- Tahlillar atlasi: sinonimli qidiruv, guruh filtri, bo‘sh holat; analit kartasi; xatcho‘p.
- Lab: kalibrlash (IFU aniq moslik — katalog bo‘sh, parametr berilmaydi), QC, preanalitika,
  apparatlar, mikroskopiya (rasm huquqi kutilmoqda), suyultirish va birlik kalkulyatorlari.
- Klinik kalkulyatorlar (D-18): eGFR CKD-EPI 2021 + KDIGO G, ACR + KDIGO A, anion farq
  (K va albumin tuzatishi bilan), tuzatilgan kalsiy (Payne), LDL (Friedewald, Sampson) va
  non-HDL, osmolyallik va osmolyal farq, HbA1c NGSP↔IFCC va eAG. Har birida formula,
  cheklovlar va DOI havolali manbalar; SI birliklar birinchi.
- Kutubxona: katalog, oflayn paketlar (o‘rnatilgan asosiy paket haqiqiy manifest bilan),
  saqlanganlar, manbalar, ilmiy ish qoralamasi, **Tekshiruv navbati**.
- O‘rganish: izohli test (har variant izohi, natija haqiqiy javobdan), imtihon/guruhlar —
  halol “hali ulanmagan / kirish kerak” holatlari.
- Profil: rol, til, mavzu, obuna (o‘chirilgan, narx qotirilmagan), maxfiylik, lokal
  ma’lumotlarni o‘chirish, chiqish.
- Domla materiallari: `LibraryItem`, `SourceRef` (sahifa), `Discrepancy`, `Lesson`, tarqatish
  huquqi qaydi, alohida kitob paketlari; [CONTENT_INTAKE.md](CONTENT_INTAKE.md).

## Haqiqiy tekshiruv natijalari (2026-10-08, shu konteynerda)

| Tekshiruv | Natija |
|---|---|
| `flutter analyze` | No issues found |
| `flutter test` | **175 / 175 o‘tdi** (unit 105: auth/settings 14, content 35, core logic 24, klinik kalkulyatorlar 32; widget oqimlari 39 (kalkulyatorlar 9); layout matritsa 31) |
| Layout matritsa | 30 konfiguratsiya: uz/ru/en × 320/390/430/820 px × shrift 1.0/1.35, + 320 px ×2.0, + dark; har birida 47 ta yo‘l (route, eng uzun kartalar va analit testi bilan) va 4 rolning bosh sahifasi — layout xatosi yo‘q; tab nomlari 320 px da sig‘adi. Kalkulyator natijalari 320 px ×2.0 da uchala tilda alohida tekshirildi |
| Tap target | iOS 44×44 va labeled tap target guideline’lari (Bosh, Tahlillar) — o‘tdi |
| Kontrast | Palitra juftliklari ≥ 4.5:1 (light va dark) — o‘tdi |
| `flutter build apk --debug` | ✓ `app-debug.apk` |
| `flutter build apk --release --split-per-abi` | ✓ arm64-v8a 19.3 MB, armeabi-v7a 16.8 MB, x86_64 20.7 MB (debug kalit bilan imzolangan — do‘kon uchun emas) |
| Release binarida demo OTP | `strings libapp.so`: `DemoOtpAdapter` 0, `_DemoChallenge` 0, `UnconfiguredOtpAdapter` 1 |
| Vizual tekshiruv | `tool/screenshots` — 22 ta ekran rasmi (light/dark, uz/ru/en, 320 px, planshet) ko‘rib chiqildi |

**Bajarilmagan tekshiruvlar** (o‘tdi deb hisoblanmaydi):
- iOS build / simulator — macOS va Xcode kerak (bu konteyner Linux).
- Android emulator yoki haqiqiy qurilmada ishga tushirish — konteynerda KVM yo‘q.
  Haqiqiy qurilma tekshiruvi alohida qayd etilishi kerak.
- Screen reader (TalkBack/VoiceOver) bilan qo‘lda tekshiruv.
- Mustaqil tibbiy ekspert review’i — hech bir karta tasdiqlanmagan.

## Ulanmagan xizmatlar

- Email OTP server (release’da email kirish “hali ulanmagan”; mehmon rejimi to‘liq ishlaydi).
- Backend: sinxronlash, guruhlar/topshiriqlar, server ruxsatlari.
- StoreKit / Google Play Billing, server tekshiruvi.
- Oflayn paketlarni yuklash serveri (o‘rnatuvchi tayyor, yuklovchi yo‘q).
- Tasdiqlangan IFU katalogi, litsenziyali mikrofotolar.

## Blockerlar va foydalanuvchidan kerak bo‘ladigan narsalar

- **Domla materiallari** (kitob, qo‘llanma, metodika, testlar) — hali kelmagan; kelganda
  tarqatish huquqi haqida ma’lumot ham kerak.
- Mustaqil reviewer(lar): kim va qaysi analitlar.
- Aniq apparat modellari, reagent REF va IFU versiyalari (kalibrlash uchun).
- E bosqich uchun: email provayder, backend hosting, App Store Connect va Play Console
  hisoblari, imzolash kalitlari. Bular sir — repoga qo‘yilmaydi.
- Bundle ID `uz.labguide.app` (D-16) — App Store Connect’da ilova yozuvi shu ID bilan ochiladi.

## Ishga tushirish

```bash
cd labguide
flutter pub get && flutter test && flutter analyze
flutter run                                   # debug, demo OTP kodi ekranda
flutter build apk --release --split-per-abi
flutter test tool/screenshots/screenshots_test.dart --update-goldens   # ekran rasmlari
dart run tool/build_content_manifest.dart     # pack.json o‘zgarganda
```

Konteyner eslatmasi: Maven Central 429 qaytarsa, `~/.gradle/init.d/maven-mirror.gradle`
(D-17) kerak bo‘ladi — u repoga kirmaydi.

## Keyingi bitta aniq qadam

**Domla materiallari kelganda:** CONTENT_INTAKE.md dagi ro‘yxatni to‘ldirib, har materialni
`library[]` ga kataloglash (`import_state: cataloged`) va tarqatish huquqini qayd etish.
Materiallar kelguncha: lokal DB (drift/SQLite) ga o‘tish va oflayn paket yuklovchisi
(C bosqich: HTTP yuklash + `PackInstaller` + hajmni oldindan ko‘rsatish).
