# LabGuide — qarorlar jurnali

Har bir qaror: nima, nega, qachon qayta ko‘rib chiqiladi. Yangi qaror pastga qo‘shiladi.

## D-01. Loyiha `nfcx` repozitoriysidagi `labguide/` papkasida (2026-10-08)
Sessiya faqat `davlatsudekspert/nfcx` (NFCSTORE) repozitoriysiga ulangan edi; alohida LabGuide
repozitoriysi yo‘q. START_HERE “NFCSTORE/Forensic loyihalariga tegmang” deydi — shuning uchun
ilova o‘z-o‘zidan yetarli `labguide/` papkasida, NFCSTORE’ning birorta fayli (ildiz
`.gitignore`, CI workflow’lar ham) o‘zgartirilmagan. Branch: `claude/new-session-xqozot`;
NFCSTORE CI faqat `main` push’da ishlaydi, bu branch uni ishga tushirmaydi.
**Qayta ko‘rish:** alohida repo ochilsa — `git subtree split -P labguide` bilan tarix saqlangan
holda ko‘chirish.

## D-02. Flutter 3.47.6 + `material_ui` paketi (2026-10-08)
Yangi loyiha → START_HERE tavsiyasi bo‘yicha Flutter. Versiya taxmin qilinmadi: rasmiy
`releases_linux.json` dagi joriy stable (3.47.6, Dart 3.13.5). Flutter 3.47 da Material
kutubxonasi `package:material_ui` ga ko‘chirilmoqda (`flutter/material.dart` uchun rasmiy
data-driven fix bor), `go_router 18` ham shu paketni ishlatadi — shuning uchun ilova bitta
MaterialApp/Theme turi bilan `material_ui` dan foydalanadi.

## D-03. Navigatsiya: go_router `StatefulShellRoute.indexedStack`
Har tab o‘z navigation stacki va scroll holatini saqlaydi (IndexedStack). Analit kartasi
har tab ichida ochiladi (`/home/analyte/:id`, `/tests/analyte/:id`, `/library/saved/analyte/:id`),
shunda “orqaga” foydalanuvchini kelgan joyiga qaytaradi. Faol tab qayta bosilsa — ildiziga.
Android “orqaga” tab ildizida bo‘lsa avval Bosh tabga qaytaradi.

## D-04. Holat boshqaruvi: ChangeNotifier + InheritedWidget (`AppScope`)
Qo‘shimcha state kutubxonasi kiritilmadi: controllerlar kichik, testda oson almashtiriladi
(`MemoryKeyValueStore`, demo/unconfigured adapterlar). Murakkablik oshsa (server sinxronlash,
guruhlar) Riverpod ko‘rib chiqiladi.

## D-05. Router faqat onboarding holati o‘zgarganda yangilanadi
Dastlab `refreshListenable: settings` edi — rol saqlanganda kechikkan router yangilanishi
endigina yopilgan rol sahifasini qaytarib qo‘ydi (widget test topdi). Endi `OnboardingChanges`
faqat `onboarded` o‘zgarishini uzatadi.

## D-06. i18n: gen-l10n ARB (`lib/l10n/app_{uz,ru,en}.arb`)
UI satrlari ARB da, klinik kontent esa kontent paketida (UI satrlariga qotirilmaydi).
Boshlang‘ich til: tizim tili uz/ru/en bo‘lsa shu, aks holda o‘zbekcha. O‘zbek matnida
prototipdagi ‘ (U+2018) va ’ (U+2019) belgilari; qidiruv barcha apostrof variantlarini bir xil
deb hisoblaydi.

## D-07. Shrift: Inter (OFL), ilovaga qo‘shilgan
Prototip Inter’dan foydalanadi. Oflayn ishlashi uchun 400/500/600/700 statik TTF lar
`assets/fonts/` da (Google Fonts, Inter 4.001; litsenziya `Inter-OFL.txt`). Kirill, o‘zbek
apostroflari, ₁₂, ≥, → glyphlari tekshirilgan.

## D-08. Scroll-collapse sarlavha ro‘yxatdan tashqarida
Katta sarlavha (eyebrow + sarlavha + izoh) yuqori panel ostida turadi; kontent pastga
surilganda 14 px hysteresis bilan ixchamlashadi, yuqoriga 14 px qaytganda kengayadi, ro‘yxat
tepasida doim kengaygan. Faqat foydalanuvchi scroll’i hisobga olinadi (layout o‘zgarishi
tebranish keltirmaydi); kontent qisqa bo‘lsa ixchamlashmaydi. 200 ms, reduced motion’da 0.
Welcome sahifasida (rasm bilan) sarlavha kontent bilan birga suriladi. Uzun so‘zli sarlavha
(“Аланинаминотрансфераза”) so‘z o‘rtasidan bo‘linmasligi uchun 24 px gacha kichrayadi.

## D-09. Sahifa o‘tishlari: Android 200 ms, iOS — tizim (Cupertino)
DESIGN_REQUIREMENTS 200 ms o‘tishni so‘raydi; iOS’da esa chetdan surib qaytish imo-ishorasi
muhimroq, shuning uchun iOS’da `CupertinoPageTransitionsBuilder` qoldirildi.

## D-10. Kontent: tekshiriladigan JSON paket (hozircha), lokal DB keyinroq
START_HERE “core matnlar lokal DB” deydi. Hozirgi hajm (35 karta tuzilmasi, 1 manbali karta,
3 savol) uchun xotirada yuklanadigan, sha256 bilan tekshiriladigan paket yetarli va ishonchli.
Sxema DB jadvallariga to‘g‘ridan-to‘g‘ri mos (analytes/claims/sources/library/lessons/…).
**Qayta ko‘rish:** yuzlab karta yoki to‘liq matnli qidiruv kerak bo‘lganda drift/SQLite + FTS.
Atomar o‘rnatish (`PackInstaller`) va manifest formati yuklanadigan paketlar uchun tayyor.

## D-11. Klinik kontent qoidalari
- Har da’vo manbaga (`refs`, sahifa bilan) bog‘langan; manbasiz da’vo, review’siz
  `published`/`reviewed`, struktura-kartada da’vo — paket rad etiladi.
- Referens interval va diagnostik chegara alohida; glyukozada referens interval berilmagan
  (laboratoriya blankidan), NIDDK chegaralari faqat mg/dL da, manbadagidek.
- Glyukoza matni 2026-10-08 da MedlinePlus va NIDDK sahifalari bilan qayta solishtirildi;
  MedlinePlus’dagi sabablar ro‘yxati to‘liqroq bo‘lgani uchun matn kengaytirildi.
  Mustaqil mutaxassis review’i **yo‘q** — karta “manbali o‘quv namuna, review kutilmoqda”.
- Boshqa 34 analit “faqat tuzilma”: umumiy matn tayyor deb ko‘rsatilmaydi.
- Birlik konvertori faqat tasdiqlangan molyar massasi bor analit uchun (glyukoza 180,156
  g/mol, IUPAC atom massalaridan); umumiy koeffitsiyent yo‘q.
- Natijani avtomatik talqin qilish, tashxis yoki doza chiqarish yo‘q.

## D-12. Domla materiallari uchun kengaytiriladigan sxema (2026-10-08)
`LibraryItem` (nomi, mualliflar, yil, nashr, til, kategoriyalar, mavzular, kim bergan,
import holati, tarqatish huquqi, eski nashr, alohida paket), `SourceRef` (manba + sahifa),
`Discrepancy` (≥2 pozitsiya, hal qilish faqat tekshiruvchi va izoh bilan), `Lesson`, draft
testlar. Validator: kelmagan/kataloglanmagan materialdan iqtibos keltirib bo‘lmaydi; tarqatish
ruxsati (sana + dalil) qayd etilmaguncha to‘liq kitob paketi rad etiladi. Tartib:
[CONTENT_INTAKE.md](CONTENT_INTAKE.md).

## D-13. OTP adapterlari
`createOtpAdapter`: debug → `DemoOtpAdapter` (kod 123456, 5 daq, 5 urinish, 60 s); release
va profile → `UnconfiguredOtpAdapter` (hech narsa qabul qilmaydi). `DemoOtpAdapter` release
bayrog‘i bilan yaratilsa xato beradi. Demo email sessiyasi qayta ochilganda tiklanmaydi.
Production adapter E bosqichda: kod va limitlar serverda, token secure storage’da.
Hozirgi `auth.session = email:<manzil>` belgisi vaqtinchalik: E bosqichda sessiya faqat
secure storage’dagi server tokeni server tomonidan tasdiqlangandan keyin tiklanadi.

## D-14. Tab nomlari va kenglik siyosati
Tab nomi 11 px, katta shrift sozlamasida 1.15 gacha kattalashadi. Teng ulushga sig‘masa
(320 px da “Библиотека”), kengliklar nom uzunligiga mutanosib taqsimlanadi (har tab ≥ 48 px);
shunda ham sig‘masa masshtab 1.0. Matn hech qachon 11 px dan kichraymaydi va qirqilmaydi.

## D-15. Biznes sozlamalari konfiguratsiyada
Narxlar qotirilmagan (store’dan olinadi), qurilma soni taklifi `AppConfig.maxActiveDevicesProposal = 2`.
Xarid/tiklash tugmalari store ulanmaguncha o‘chirilgan va “hali mavjud emas” deb yozilgan.

## D-16. Bundle ID: `uz.labguide.labguide`
`flutter create --org uz.labguide` natijasi. Do‘konga birinchi yuklashdan oldin egasi bilan
kelishib o‘zgartirish mumkin (keyin o‘zgartirib bo‘lmaydi).

## D-17. Muhitga oid (repoga kirmaydi)
Bulut konteynerida Maven Central 429 qaytardi; `~/.gradle/init.d/maven-mirror.gradle`
mavenCentral manzilini Google’ning rasmiy ko‘zgusiga yo‘naltiradi. Loyiha fayllari o‘zgarmagan.
