# LabGuide — progress

Yangi sessiya shu fayldan boshlaydi. Oxirgi yangilanish: **2026-10-08, 2-sessiya (mustaqil sharh tuzatishlari)**.

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
  aralash 10 ta; natija va xatolar tahlili haqiqiy javoblardan. **Xatolar ustida ishlash:**
  oxirgi javobi noto‘g‘ri savollar alohida mavzu; mavzu bo‘yicha “oxirgi safar to‘g‘ri” soni
  (faqat qurilmada, `quiz.progress`).
- Analit kartasidan tegishli kalkulyatorga o‘tish (kreatinin → eGFR, lipidlar → LDL va h.k.).
- Tahlillar atlasi: sinonimli qidiruv, guruh filtri, bo‘sh holat; analit kartasi; xatcho‘p.
- Lab: kalibrlash (IFU aniq moslik — katalog bo‘sh, parametr berilmaydi), preanalitika,
  apparatlar, mikroskopiya (rasm huquqi kutilmoqda), suyultirish kalkulyatori va 13 analit
  uchun birlik konvertori (mg/dL ↔ mmol/L yoki µmol/L, D-22).
- **Preanalitika (D-23):** WHO 2010 bo‘yicha probirkalar tartibi (10 ta, qopqoq rangi va
  qo‘shimchasi bilan), kapillyar tartib, gemoliz sabablari, jgut, bemorni aniqlash va yorliq.
- **Ichki sifat nazorati (D-20):** test va 1–3 nazorat darajasi (lot, maqsadli x̄/SD, manbasi),
  seriyalar, Levey–Jennings grafigi, Westgard 1-2s/1-3s/2-2s/R-4s/4-1s/10x (W81 bo‘yicha),
  qabul/ogohlantirish/rad va sabab, kuzatilgan n/x̄/SD/CV, o‘chirish (tasdiq bilan); lot yoki
  x̄/SD almashganda tarix saqlanadi, CSV nusxa (D-26).
- Klinik kalkulyatorlar (D-18): eGFR CKD-EPI 2021 + KDIGO G, ACR + KDIGO A, anion farq
  (K va albumin tuzatishi bilan), tuzatilgan kalsiy (Payne), LDL (Friedewald, Sampson) va
  non-HDL, osmolyallik va osmolyal farq, HbA1c NGSP↔IFCC va eAG. Har birida formula,
  cheklovlar va DOI havolali manbalar; SI birliklar birinchi.
- Kutubxona katalogi (D-24): 25 ta tekshirilgan yozuv — OpenStax, LibreTexts, WHO (en/ru),
  MedlinePlus, ZiyoNET va SamMU o‘zbek/rus darsliklari, lex.uz hujjatlari, Tietz, Henry;
  litsenziya/kirish turi, til filtri, rasmiy sahifaga havola. Fayl tarqatilmaydi.
- Kutubxona: katalog, oflayn paketlar (o‘rnatilgan asosiy paket haqiqiy manifest bilan),
  saqlanganlar, manbalar, ilmiy ish qoralamasi, **Tekshiruv navbati**.
- O‘rganish: izohli test (har variant izohi, natija haqiqiy javobdan), imtihon/guruhlar —
  halol “hali ulanmagan / kirish kerak” holatlari.
- Profil: rol, til, mavzu, obuna (o‘chirilgan, narx qotirilmagan), maxfiylik, lokal
  ma’lumotlarni o‘chirish, chiqish.
- Domla materiallari: `LibraryItem`, `SourceRef` (sahifa), `Discrepancy`, `Lesson`, tarqatish
  huquqi qaydi, alohida kitob paketlari; [CONTENT_INTAKE.md](CONTENT_INTAKE.md).

### 2-sessiya: to‘rtta mustaqil sharh bo‘yicha tuzatishlar (D-27 … D-31)
- **Tarjima:** paket, ARB va kalkulyator izohlarida ma’no va atama xatolari (och qolish,
  2-tip, bevosita bilirubin, JSST, контроль качества, рСКФ, мг/дл…), uz/ru da o‘nlik vergul,
  en da amerikancha imlo.
- **QC (D-27, D-30):** chegaradagi qiymat (5.4 vs 5.0/0.2) endi buzilish emas; rad etilgan
  seriya keyingi qoidalar va statistikada ishlatilmaydi; saqlash xatosi ko‘rsatiladi; maqsad
  manbasi, amal qilish sanasi, kuzatilgan x̄/SD, bekor qilish; seriya vaqti; daraja nomi;
  zaxira nusxa/tiklash; o‘qilmagan ma’lumotni qutqarish; kiritilgandagi xulosa (audit);
  CSV da daraja xulosasi va formula injection himoyasi.
- **Kalkulyatorlar:** eskirgan natija o‘chadi; kiritilgan qiymatlar natija ostida; birlik
  chalkashligi eslatmasi; AG da qisman natija; manfiy natija eslatmasi; “1,500” ikki ma’noli.
- **Qobiq/accessibility (D-28):** TalkBack tap amali; profildan kirish oqimi; past ekran;
  tab xotirasi va qayta bosishda tepaga; WCAG 1.4.11 chegara kontrasti; OTP avtomatik
  tekshiruv; maxfiylik matnlari; qoralamalar avtosaqlash; Android release imzo (key.properties);
  holatni tiklash — tizim ilovani yopsa, tab va sahifa qaytadi (D-32).
- **Kontent (D-29, D-31):** qat’iyroq validator; qaror chegaralari alohida bloklarda va
  hisoblangan mmol/L; kirillcha qidiruv; savol manbasi; to‘g‘ri javob uzunligi bo‘yicha
  bilinmaydi (61/71 → 21/71).

## Haqiqiy tekshiruv natijalari (2026-10-09, shu konteynerda va GitHub Actions’da)

| Tekshiruv | Natija |
|---|---|
| `flutter analyze` | No issues found |
| `flutter test` | **270 / 270 o‘tdi** (unit 168: auth/settings 14, kontent 56, core logic 27, mashq progressi 2, preanalitika 2, klinik kalkulyatorlar 35, QC model 14, Westgard qoidalari 18; widget 102: oqimlar 35, kalkulyatorlar 13, QC 6, klaviatura 3, tab xotirasi 4, grafik 2, qoralamalar 2, TalkBack amallari, sarlavha, holatni tiklash, layout matritsa 34) |
| Layout matritsa | 30 konfiguratsiya × 48 yo‘l + past ekran (844×390 ×1.0/×2.0, 320×568 ×2.0) uchala tilda — layout xatosi yo‘q, ro‘yxat maydoni ekranning ≥ 30 % i |
| Yangi testlar | Har bir tuzatilgan xato uchun test tuzatishsiz **yiqilishi** tekshirildi (TalkBack, past ekran, sarlavha, tab xotirasi, klaviatura, vergulli son, QC zaxira, paket ro‘yxatlari, guruh savollari) |
| Kontrast | Matn ≥ 4.5:1, boshqaruv chegaralari ≥ 3:1 (light va dark) |
| GitHub Actions run #2, #5 (build) | ✓ testlar, Android release APK (sinov), **imzosiz iOS release build (macOS, Xcode)** |
| GitHub Actions run #3 (testflight) | Sertifikat va API kalit (NOVA_*) o‘qildi, bundle ID/profil bosqichi o‘tdi; **App Store Connect’da ilova yozuvi yo‘qligi sababli to‘xtadi** |
| GitHub Actions run #4 | 1 test yiqildi (kalkulyator yorlig‘i o‘zgargan, test keyingi commit’da yangilangan) — run #5 da tuzalgan |
| Vizual tekshiruv | `tool/screenshots` — 37 ta ekran rasmi, yangi ekranlar (SI chegaralar, birlik eslatmasi, AG, landshaft, kirillcha qidiruv, QC) ko‘rib chiqildi |

**Bajarilmagan tekshiruvlar** (o‘tdi deb hisoblanmaydi):
- TestFlight’ga yuklash — App Store Connect ilova yozuvi kutilmoqda (pastda).
- Android emulator yoki haqiqiy qurilmada ishga tushirish — konteynerda KVM yo‘q.
- Screen reader (TalkBack/VoiceOver) bilan qo‘lda tekshiruv (avtomatik semantik testlar bor).
- Mustaqil tibbiy ekspert review’i — hech bir karta va savol tasdiqlanmagan.

## Do‘kon uchun tayyor materiallar

- [store/APP_STORE.md](store/APP_STORE.md) — nom, subtitle, tavsif, kalit so‘zlar (uz/ru/en),
  toifa, App Privacy (“Data Not Collected”), yosh reytingi, eksport, TestFlight matnlari.
- [store/PRIVACY_POLICY.md](store/PRIVACY_POLICY.md) — maxfiylik siyosati (uch tilda); sana va
  aloqa manzilini egasi to‘ldiradi va ochiq sahifaga joylaydi.
- `tool/screenshots/store_screenshots_test.dart` — 6.9" iPhone skrinshotlari (1290×2796), uch
  tilda 6 tadan.

## Ulanmagan xizmatlar

- Email OTP server (release’da email kirish “hali ulanmagan”; mehmon rejimi to‘liq ishlaydi).
- Backend: sinxronlash, guruhlar/topshiriqlar, server ruxsatlari.
- StoreKit / Google Play Billing, server tekshiruvi.
- Oflayn paketlarni yuklash serveri (o‘rnatuvchi tayyor, yuklovchi yo‘q).
- Tasdiqlangan IFU katalogi, litsenziyali mikrofotolar.

## Blockerlar va foydalanuvchidan kerak bo‘ladigan narsalar

- **TestFlight:** App Store Connect → Apps → + → New App, Bundle ID `uz.labguide.app`,
  SKU `labguide-ios`. Secretlar tayyor (NOVA_*; ASC_* nomlari ham qabul qilinadi). Shundan
  keyin workflow `mode: testflight` bilan yuklaydi — [IOS_TESTFLIGHT.md](IOS_TESTFLIGHT.md).
- **Google Play:** upload kaliti (`LABGUIDE_ANDROID_KEYSTORE_*` secretlari) — bo‘lmasa APK
  faqat sinov uchun (debug kalit).
- **Domla materiallari** (kitob, qo‘llanma, metodika, testlar) — hali kelmagan; kelganda
  tarqatish huquqi haqida ma’lumot ham kerak.
- Mustaqil reviewer(lar): kim va qaysi analitlar/savollar.
- Aniq apparat modellari, reagent REF va IFU versiyalari (kalibrlash uchun).
- E bosqich uchun: email provayder, backend hosting. Sirlar repoga qo‘yilmaydi.

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
