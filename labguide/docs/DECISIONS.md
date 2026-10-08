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

## D-16. Bundle ID / applicationId: `uz.labguide.app` (2026-10-08)
`flutter create` bergan `uz.labguide.labguide` hech qayerda ro‘yxatdan o‘tmasdan oldin toza
`uz.labguide.app` ga almashtirildi (Android namespace/applicationId, Kotlin paketi, iOS
PRODUCT_BUNDLE_IDENTIFIER). App Store / Play’da ro‘yxatdan o‘tgach o‘zgartirib bo‘lmaydi.

## D-17. Muhitga oid (repoga kirmaydi)
Bulut konteynerida Maven Central 429 qaytardi; `~/.gradle/init.d/maven-mirror.gradle`
mavenCentral manzilini Google’ning rasmiy ko‘zgusiga yo‘naltiradi. Loyiha fayllari o‘zgarmagan.

## D-18. Klinik kalkulyatorlar — faqat birlamchi manbadan tekshirilgan formulalar (2026-10-08)
eGFR CKD-EPI 2021 (Inker 2021, 2-jadval; NKF sahifasi), ACR va KDIGO 2012 A toifasi
(6-jadval), anion farq (Kraut va Madias; albumin tuzatishi Figge 1998), tuzatilgan kalsiy,
LDL (Friedewald 1972; Sampson 2020), non-HDL, hisoblangan osmolyallik (Rasouli 2016; SI
shakli Lynd 2008), HbA1c NGSP↔IFCC (NGSP master tenglamasi) va eAG (ADAG, Nathan 2008).
- Har koeffitsiyent birlamchi matndan o‘qib tekshirildi; test qiymatlari mustaqil Python
  hisobidan (eAG — ADAG 2-jadvali bilan bir xil).
- Kalsiy: Payne 1973 maqolasidagi asl formula `Ca − albumin + 4.0` (mg/dL, g/dL). Keng
  tarqalgan 0.8 koeffitsiyentli variant manbada yo‘q — ishlatilmadi, ekranda izohlangan.
- Figge “normal albumin” qiymatini bermaydi → foydalanuvchi o‘z laboratoriyasi qiymatini
  kiritadi; ilova son to‘qimaydi.
- Formula doirasidan tashqarida natija berilmaydi: yosh < 18 (eGFR), TG > 400 mg/dL
  (Friedewald), TG > 800 mg/dL (Sampson), A1C 4–12 % dan tashqari (eAG).
- Kirish oralig‘i (masalan kreatinin 0.1–30 mg/dL) klinik chegara emas — birlik adashishini
  ushlash uchun; xabar oraliqni kiritilgan birlikda ko‘rsatadi.
- KDIGO toifalari rangsiz, “tasnif, tashxis emas” izohi bilan; toifa ekrandagi (yaxlitlangan)
  qiymat bo‘yicha — son va toifa doim mos.
- SI birliklar birinchi tanlangan (O‘zbekiston/MDH laboratoriyalari shuni beradi).
- Formula, cheklov va manba matnlari kod bilan birga `lib/features/tools/calc_info.dart` da:
  formula o‘zgarsa, izoh ham shu commit’da o‘zgaradi. Bibliografiyada faqat tekshirilgan
  maydonlar (muallif, sarlavha, jurnal, yil, DOI) — jild/sahifa yozilmagan.

## D-19. 35 ta analit kartasi — AQSh davlat sahifalaridan, draft holatida (2026-10-08)
- Manbalar: MedlinePlus lab-test sahifalari (asosiy), NIDDK, NHLBI — jami 52 ta; har birida
  URL, kirish sanasi va sahifaning yangilangan/ko‘rib chiqilgan sanasi (`source_date`).
- Matn uch tilda, manbadan o‘z so‘zlarimiz bilan; har bir da’vo manba va bo‘lim nomi
  (`locator`) bilan. Har da’vo uchun so‘zma-so‘z inglizcha iqtibos yig‘ilib tekshirildi
  (ilovaga kirmaydi): sahifalar qayta yuklanib, 708 iqtibosdan 704 tasi avtomatik, 2 tasi
  qo‘lda (havola/bo‘shliq farqi) tasdiqlandi; rasmdan o‘qilgan 2 tasi olib tashlanib,
  eGFR chegarasi matnli manbalarga (NIDDK CKD tests + eGFR tenglamalari sahifasi) bog‘landi.
- Referens interval yo‘q. Diagnostik chegara faqat manba aniq bergan joyda: HbA1c, OGTT
  (NIDDK jadvali), eGFR < 60 va ≤ 15, ACR > 30 mg/g; mikro/makroalbuminuriya — “manba
  atamasi” sifatida. Qat’iy chegaralar uchun `low_exclusive` / `high_exclusive` qo‘shildi
  (“< 60”, “> 30” manbadagidek, “≤/≥” emas).
- Populyatsiya manbadagidek: NIDDK “if you are not pregnant” deydi — yosh aytilmagan, shuning
  uchun “kattalar” so‘zi olib tashlandi (glyukoza kartasidagi oldingi xatoim ham tuzatildi).
- Lipid “sog‘lom daraja” jadvallari, xavfga bog‘liq maqsadlar va CRP “sog‘lom miqdor” ataylab
  kiritilmadi — ular populyatsiya/xavfga bog‘liq va referens intervalga o‘xshaydi.
- Birlik faqat manba ko‘rsatgan bo‘lsa (fermentlar sahifalarida yo‘q → karta birliksiz).
- Hammasi `status: draft`, `content_state: sourced_sample`, review `pending` — mustaqil
  ekspert ko‘rmagan. Manba qayta foydalanish huquqi konservativ (`verify_before_distribution`).
- Tahririy izohlar `review_note` da (ilovada ko‘rsatilmaydi); ekspert uchun ochiq savollar:
  [CONTENT_REVIEW_NOTES.md](CONTENT_REVIEW_NOTES.md).
- Testlar: 68 ta yangi savol (har analitga 2 ta), hammasi draft, manba va mavzu (`topic_ids`)
  bilan. Mashq endi mavzu bo‘yicha: guruh, bitta analit (kartadan) yoki aralash 10 ta.

## D-20. Ichki sifat nazorati: Levey–Jennings + Westgard qoidalari (2026-10-08)
- Manba: Westgard JO, Barry PL, Hunt MR, Groth T. *A multi-rule Shewhart chart for quality
  control in clinical chemistry.* Clin Chem 1981;27(3):493–501 (doi:10.1093/clinchem/27.3.493) —
  to‘liq matn (arxivlangan PDF) o‘qib tekshirildi; Westgard sayti darslari qo‘shimcha.
- Qoidalar maqoladagidek: 1-2s ogohlantirish; 1-3s; 2-2s (seriya ichida ikki material bo‘ylab
  va bir material ketma-ket ikki seriyada); R-4s faqat seriya ichida; 4-1s va 10x bir material
  ichida (4/10 seriya) yoki materiallar bo‘ylab (joriy + oldingi seriya / 5 seriya).
  Chegara qat’iy: aynan ±2 SD buzilish emas (“exceeds”).
- 1981 tartibida 1-2s “eshik” edi; Westgard sayti kompyuter tizimlari uchun bu shart emasligini
  aytadi. Ilova har seriyada hamma rad qoidalarini tekshiradi, 1-2s ni ogohlantirish deb
  ko‘rsatadi — shuning uchun 2s siz 4-1s ham rad deb belgilanadi (klassik qo‘lda tartibdan
  qattiqroq; ekranda izohlangan).
- Maqsadli o‘rtacha va SD ni ilova bermaydi: foydalanuvchi kiritadi va manbasini belgilaydi.
  Maqola: laboratoriyaning o‘z ma’lumotidan (~20 o‘lchov, keyin qayta hisoblash); ishlab
  chiqaruvchi qiymati tanlansa ogohlantirish ko‘rsatiladi (varaqadagi oraliqlar ko‘pincha keng).
- Grafik: ±1s/±2s/±3s chiziqlari (W81 2-rasm), nuqta holati shakl bilan ham (doira/uchburchak/
  kvadrat) — faqat rangga tayanmaydi; ±4 SD dan tashqarisi strelka bilan.
- Ma’lumot faqat qurilmada (`qc.data`), buzilgan yozuv ustidan yozilmaydi; “lokal ma’lumotlarni
  o‘chirish” QC ni ham o‘chiradi. Kuzatilgan n, x̄, SD (n−1), CV % ko‘rsatiladi.

## D-21. LabGuide alohida public repoga ko‘chadi (2026-10-08)
nfcx hisobida GitHub Actions to‘lovi o‘tmagani sabab barcha ishlar `startup_failure` bilan
to‘xtadi. Egasi “public qilib ishlataver” dedi: public repoda standart runnerlar (macOS ham)
bepul. Reja: `git subtree split -P labguide` bilan tarix saqlangan holda yangi
`labguide` repoga; CI `labguide/.github/workflows/build.yml` da (split’dan keyin repo ildizida
`.github/` bo‘ladi; nfcx ichida esa ishlamaydi — NFCSTORE CI’ga tegmaydi). nfcx ildizidagi
oldingi `labguide-ios.yml` olib tashlandi. Litsenziya fayli qo‘shilmaydi (kod ko‘rinadi,
huquqlar egada). Secretlar repo sozlamalarida — kodda yo‘q ([IOS_TESTFLIGHT.md](IOS_TESTFLIGHT.md)).
Repo yaratish Claude integratsiyasiga ruxsat etilmagan (403) — egasi yaratadi.

## D-22. Birlik konvertori 13 analitga kengaytirildi (2026-10-08)
Molyar massa faqat formula + IUPAC qisqartirilgan standart atom massalaridan (C 12.011,
H 1.008, N 14.007, O 15.999; Ca 40.078, Mg 24.305, P 30.974): kreatinin 113.120, siydik
kislotasi 168.112, bilirubin 584.673 (µmol/L), xolesterin 386.664 (umumiy, HDL, LDL, non-HDL),
triglitseridlar — triolein 885.453 (an’anaviy model), kalsiy, magniy, fosfor (mmol/L).
SI birlik paketda (`si_unit`: mmol/L yoki µmol/L). Mochevina/BUN ataylab qo‘shilmadi: bir
analitda ikki asos (butun molekula vs azot) — chalkashlik xavfi; osmolyallik kalkulyatori
BUN’ni alohida qabul qiladi.

## D-23. Preanalitika — WHO 2010 qon olish qo‘llanmasidan (2026-10-08)
Manba: *WHO guidelines on drawing blood: best practices in phlebotomy*, WHO 2010 (ISBN 978 92
4 159922 1; IRIS 10665/44294) — to‘liq PDF o‘qib tekshirildi. Kiritilganlar: probirkalar tartibi
(2.2.3, 2.3-jadval; NCCLS 2003 konsensusi asosida), jadval izohlari (rang kodlari farq qiladi —
laboratoriya bilan tekshirish; aralashtirish; faqat koagulogramma), kapillyar tartib (7.1.3),
gemoliz sabablari (1.1.1), jgut (2 daqiqa — “ba’zi qo‘llanmalar” iborasi bilan, manbadagidek),
bemorni aniqlash va yorliq. Manbada yo‘q narsalar yozilmadi: aylantirishlar soni (laboratoriya
belgilaydi), och qoringa talab, “to‘shak yonida yorliqlash”. Nashr “© WHO 2010, all rights
reserved” — jadval ko‘chirilmadi, faktlar o‘z so‘zlarimiz bilan, joyi ko‘rsatilgan. Qopqoq
rangi doira bilan ham, matn bilan ham (faqat rangga tayanmaydi). Rus tilidagi nashri IRIS’da
topilmadi.

## D-24. Kutubxona katalogi: 25 ta tekshirilgan yozuv, faqat havola (2026-10-08)
Har yozuvning rasmiy sahifasi yuklab ko‘rildi, litsenziya iborasi so‘zma-so‘z saqlandi
(`licence_quote`, ilovada ko‘rsatilmaydi). Kirish turi: ochiq litsenziya (OpenStax,
LibreTexts — CC BY-NC-SA 4.0; WHO biologik xavfsizlik 4-nashr en/ru — CC BY-NC-SA 3.0 IGO;
MedlinePlus — AQSh davlat ishi), bepul o‘qish (WHO sifat menejmenti en/ru, flebotomiya,
WHO/IDF diabet hisoboti en/ru, ZiyoNET darsliklari, lex.uz hujjatlari) va faqat katalog
(SamMU e-kutubxonasi — HEMIS login; Tietz, Henry — pullik).
- Hech bir fayl yuklanmadi/tarqatilmadi — faqat bibliografik yozuv va rasmiy havola.
- **NC litsenziyalar** notijorat tarqatishga ruxsat beradi; ilovada pullik obuna rejasi bor,
  shuning uchun ularning matni paketga kiritilmaydi (faqat havola).
- **OpenStax** sahifasi kitobni LLM o‘qitish yoki generativ AI mahsulotlariga kiritishni
  yozma ruxsatsiz taqiqlaydi — matni ilovaning hech bir AI funksiyasiga berilmaydi
  (`review_note`).
- WHO “Manual of basic techniques” (2003): who.int’da CC BY-NC-SA 3.0 IGO, IRIS’da huquq
  maydoni yo‘q — tasdiqlanguncha “bepul o‘qish” deb belgilandi.
- ZiyoNET: foydalanuvchilar yuklagan fayllar, sayt “Barcha huquqlar himoyalangan” — faqat havola.
- Izohlar (nega foydali) uch tilda qayta yozildi; agent izohidagi tekshirilmagan iboralar
  (masalan, “ISO 15189 asosida”) olib tashlandi. Interfeys tilidagi materiallar birinchi.
- Topilmadi/kiritilmadi: NCBI “Clinical Methods” (sahifa reCAPTCHA bilan yopiq), TMA
  kutubxonasi (sahifalar ishlamaydi), GEOTAR-Media katalogi.

## D-25. CI yana nfcx’da; public repo va Codemagic bekor (2026-10-08)
Egasi GitHub to‘lovini tiklashini aytdi; Codemagic varianti ham bekor qilindi
(`codemagic.yaml` yozilib, commit qilinmasdan o‘chirildi). Shuning uchun D-21 (alohida public
repo) amalga oshirilmaydi: workflow nfcx ildizidagi `.github/workflows/labguide-ios.yml` ga
qaytarildi (Android sinov APK job’i qo‘shildi, secretlar `LABGUIDE_* || NOVA_*`),
`labguide/.github` olib tashlandi. To‘lov tiklanguncha CI ishga tushmaydi; kod va testlar
konteynerda tekshiriladi.

## D-26. QC maqsad tarixi, CSV eksport, ishga tushish ekrani (2026-10-08)
- **Maqsad tarixi:** yangi nazorat loti yoki qayta hisoblangan x̄/SD uchun “Maqsad yoki lotni
  almashtirish”. Eski maqsad `previous` ga o‘tadi; har seriya o‘z vaqtida amal qilgan maqsad
  bilan baholanadi (o‘tmish qayta yozilmaydi). Grafik va kuzatilgan statistika — joriy davr.
  Eski saqlangan ma’lumot (tarixsiz) o‘zgarishsiz o‘qiladi.
- **CSV:** barcha seriyalar (sana, daraja, o‘sha paytdagi lot/x̄/SD, qiymat, z, xulosa, qoidalar,
  izoh) clipboard’ga — Excel/Sheets uchun; qiymatlar nuqta bilan, CSV qo‘shtirnoq qoidasi bilan.
- **Manbalar ekrani** endi kalkulyator, QC (Westgard 1981) va preanalitika (WHO 2010) manbalarini
  ham ko‘rsatadi.
- **Ishga tushish:** Android/iOS da oq fon o‘rniga mavzuga mos fon (yorug‘ #F3F3EC, qorong‘i
  #0D1919) — qorong‘i rejimda oq “chaqnash” yo‘q; Android 12+ splash foni ham shu rang. Android
  belgisi alohida PNG (adaptive ikonka XML `<bitmap>` ichida ishlamaydi).
