# LabGuide — amalga oshirish rejasi

Manba topshiriq: [handoff_v5/START_HERE.md](handoff_v5/START_HERE.md) (ustuvor),
[PRODUCT_PLAN.md](handoff_v5/PRODUCT_PLAN.md), [DESIGN_REQUIREMENTS.md](handoff_v5/DESIGN_REQUIREMENTS.md).
Joriy holat: [PROGRESS.md](PROGRESS.md). Qarorlar: [DECISIONS.md](DECISIONS.md).

Belgilar: ✅ bajarildi va testlangan · 🟡 qisman / skelet · ⏳ rejada · ⛔ tashqi qadam kerak

## A. UI, onboarding, rollar, navigatsiya, i18n, mavzu — ✅ (1-sessiya)

- ✅ Dizayn tizimi: prototype v5 ranglari, Inter, 39/30/25/16/14/11, 27/23/18 radius,
  160 ms press, 200 ms o‘tish, reduced motion.
- ✅ Welcome → mehmon yoki email → OTP → rol → bosh sahifa. Kontent uchun login majburiy emas.
- ✅ OTP: debug demo adapter (muddat 5 daq, 5 urinish, 60 s qayta yuborish); release va profile
  buildda demo adapter yaratilmaydi, demo kod qabul qilinmaydi.
- ✅ 4 rol → turlicha bosh sahifa (rol faqat UI afzalligi).
- ✅ 5 tab, har biri o‘z stacki va scroll holati; profil yuqorida; Android “orqaga”.
- ✅ Katta sarlavha: 14 px hysteresis, 200 ms, reduced motion’da darhol; pastki menyu doim ochiq.
- ✅ UZ/RU/EN, system/light/dark; 320/390/430/820 px, ×1.35/×2.0 shrift, safe area, klaviatura.
- ✅ Loading / empty / offline(unavailable) / error / retry / success holatlari.

## B. Kontent modeli, qidiruv, kartalar, xatcho‘p, manba/review — 🟡 (asosiy qismi bor)

- ✅ Sxema v1 (CONTENT_MODEL.json asosida) + yaxlitlik qoidalari (manbasiz da’vo, review’siz
  nashr, struktura-kartada da’vo — rad etiladi).
- ✅ Paket manifesti: version, size, sha256, til, litsenziya, min_schema; buzilgan paket rad.
- ✅ 8 guruh, 35 analit tuzilmasi; manbali glyukoza namunasi (review kutilmoqda).
- ✅ Sinonim qidiruv (UZ/RU/EN, apostrof/ё/defis), guruh filtri, bo‘sh natija, xatcho‘p (qayta
  ochilganda saqlanadi).
- ✅ Kutubxona katalogi, sahifali manba havolalari, manbalar farqi navbati (pastda).
- ⏳ Lokal DB (SQLite/drift) — kontent hajmi oshganda; hozir tekshirilgan JSON paket (D-10).
- ⏳ Tahrirchi/CMS va review ish oqimi (reviewer tasdig‘i serverda imzolanadi).

## C. Lab workflow, IFU, kalkulyatorlar, QC, oflayn paketlar — 🟡

- ✅ IFU aniq moslik mantig‘i (katalog bo‘sh → parametr ko‘rsatilmaydi).
- ✅ Suyultirish va moddaga xos birlik kalkulyatori (nol/manfiy/NaN/overflow testlangan).
- ✅ Atomar paket o‘rnatuvchi (staging → tekshiruv → rename → active.json; oxirgi 2 versiya).
- ⏳ Paketlarni yuklash (HTTP, hajmni oldindan ko‘rsatish, davom ettirish), path_provider.
- ⏳ QC jurnali va qoidalar (manbali), preanalitika kartalari, mikroskopiya (huquqi bor rasmlar).
- ⛔ Tasdiqlangan IFU’lar: aniq apparat modeli, reagent REF, IFU versiyasi kerak.

## D. O‘rganish, test, progress, guruhlar, ilmiy ish — 🟡

- ✅ Izohli test (har variant izohi, asos, natija faqat haqiqiy javobdan), draft belgisi.
- ✅ Ilmiy ish / dars rejasi qoralamasi (faqat qurilmada; natija/iqtibos to‘qilmaydi).
- ⏳ Dars mavzulari (`lessons`), takrorlash, shaxsiy progress, vaqtli imtihon.
- ⏳ Mini guruh tizimi: guruh/taklif/topshiriq/muddat/submission/natija — serverda ruxsat
  tekshiruvi (talaba faqat o‘zini, ustoz faqat o‘z guruhini ko‘radi).

## E. Haqiqiy auth, server ruxsatlari, IAP, release — ⏳

- ⏳ Email OTP server (muddat, urinish/rate limit serverda), sessiya tokeni secure storage’da.
- ⏳ StoreKit / Google Play Billing: purchase/pending/cancelled/expired/refunded/restore,
  server tekshiruvi va notifications; narx store’dan.
- ⏳ Qurilma siyosati (taklif: 2 faol qurilma — `AppConfig.maxActiveDevicesProposal`).
- ⛔ Email provayder, backend hosting, App Store / Play Console hisoblari, imzolash kalitlari.

## Domla materiallarini qabul qilish (2026-10-08 da qo‘shilgan topshiriq)

Biokimyo domlasi kitoblar, qo‘llanmalar, metodikalar va ehtimol test savollarini beradi.
**Holat: fayllar hali kelmagan.** Hech bir material o‘qilgan yoki import qilingan deb
belgilanmagan (`pack.json`: `library`, `lessons`, `discrepancies` bo‘sh; testlar buni
tekshiradi). Batafsil tartib: [CONTENT_INTAKE.md](CONTENT_INTAKE.md).

Tayyorlangan tuzilma (ilovani qayta yozmasdan yangi adabiyot qo‘shish uchun):
`LibraryItem` katalogi, `SourceRef` (manba + sahifa), `Discrepancy` (farqlar navbati),
`Lesson` (dars mavzulari), draft testlar, tarqatish ruxsati qaydi, alohida yuklanadigan
kitob paketlari (`file_pack`). Namuna: [content_templates/teacher_material_example.json](content_templates/teacher_material_example.json).

Fayllar kelgach bajariladigan ishlar:

1. **Katalog:** har material uchun nomi, muallif(lar)i, nashr yili, nashri, tili, nashriyoti,
   mavzulari → `library[]` yozuvi (`import_state: received → cataloged`).
2. **Saralash:** biokimyo · klinik laboratoriya · apparatlar · metodikalar · testlar
   (`categories`, bir nechta bo‘lishi mumkin).
3. **Bog‘lash:** tegishli ma’lumotni analit kartalari va dars mavzulariga manba **va sahifa
   raqami** bilan bog‘lash (`refs: [{source_id, pages}]`). Faqat kataloglangan materialdan
   iqtibos keltirish mumkin — validator buni majburlaydi.
4. **Farqlar:** eski va yangi (yoki turli) manbalarda farq bo‘lsa — `discrepancies[]` ga ikkala
   pozitsiya sahifasi bilan; ilovadagi “Tekshiruv navbati” ekranida domla ko‘rib chiqadi.
   Hal qilinmaguncha hech biri fakt sifatida nashr etilmaydi.
5. **Testlar:** javob, har variant izohi va manba (sahifa) bilan; tasdiqlanmaganlari
   `review_state: pending` (ilovada “Qoralama · tekshirilmagan” belgisi).
6. **Huquqlar:** to‘liq kitobni umumiy kutubxonaga qo‘yishdan oldin tarqatish ruxsati
   (`rights.distribution: permitted`, sana, kim, dalil) qayd etiladi — aks holda paket
   validatordan o‘tmaydi. Kitoblar alohida yuklanadigan oflayn paket sifatida qo‘shiladi.

Domladan so‘raladigan narsalar: har material uchun asl fayl yoki aniq bibliografik ma’lumot;
tarqatish ruxsati (yoki “faqat shaxsiy foydalanish”); test savollari uchun to‘g‘ri javob va
manba sahifasi; farqlar bo‘yicha qaror va tekshiruvchi sifatida ism/rol.

## Qabul mezonlari (START_HERE) — holat

| Mezon | Holat | Dalil |
|---|---|---|
| Rol almashtirish bosh sahifani o‘zgartiradi | ✅ | `switching role changes home content` |
| 3 til × 2 mavzuda overflow yo‘q; klaviatura/safe area/back | ✅ | `layout_matrix_test` (30 konfiguratsiya), `keyboard…`, `Android back…` |
| Sinonim qidiruv, filtr, bo‘sh natija, xatcho‘p saqlanishi | ✅ | `AnalyteSearch`, `search: …`, `bookmark survives an app restart` |
| Kalkulyator: birlik, chegaralar, 0/manfiy/NaN/overflow | ✅ | `core_logic_test` |
| Buzilgan oflayn paket rad etiladi, oldingi kontent qoladi | ✅ | `PackInstaller`, `corrupted content pack → error state` |
| Talaba/ustoz ruxsatlari serverda | ⏳ | D bosqich (server kerak) |
| OTP expiry/rate limit | 🟡 | demo adapterda testlangan; server versiyasi E bosqich |
| Billing restore/pending/refund | ⏳ | E bosqich |
| Android build; iOS simulator build | 🟡 | PROGRESS.md ga qarang; iOS uchun macOS kerak |
