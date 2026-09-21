# NFCSTORE — yakuniy holat hisoboti

Bu hujjat **nima qilinganini** va **nima hali tekshirilmaganini**
bir joyda ko'rsatadi. "Tayyor" so'zi faqat **o'zim ko'rgan**
natijalar uchun ishlatilgan.

---

## 1. Qisqa javob

Tekshirilgan commit: **`abc2da5`** (`claude/vibrant-einstein-p5lo1i`).

| Nima | Holat |
|---|---|
| Sayt (`nfcstore.uz`) | **Ishlaydi**, deploy #322 gacha yashil |
| Backend (Worker + D1) | **Ishlaydi**, CI dagi 38 ta qo'riqchi yashil |
| Android ilova — qurilish | **YASHIL** — APK #97 (`abc2da5`): universal + ikki ABI + AAB |
| Android ilova — E2E | **YASHIL** — E2E #36 (`abc2da5`): 91 PASS, **0 FAIL** |
| Android ilova — qurilmada | **TO'LIQ SINALMAGAN** — NFC yozish va video apparat qismi qo'lda |
| iOS ilova | **SINALMAGAN** — Mac yo'q, `mobile_nova/IOS_RELEASE_CHECKLIST.md` ga qarang |

### Yakuniy CI holati

| Ish | Raqam | Commit | Natija |
|---|---|---|---|
| `nova-apk.yml` | #97 | `abc2da5` | ✅ success |
| `nova-e2e.yml` | #36 | `abc2da5` | ✅ success |

E2E matritsasi (`abc2da5`):

| Natija | Soni |
|---|---|
| ✅ PASS | 91 |
| ❌ FAIL | **0** |
| ⚠️ PARTIAL | 2 |
| 🚧 KNOWN MISSING | 1 |
| 🛠 BACKEND REQUIRED | 6 |
| 🔑 CONFIG REQUIRED | 5 |
| 📱 DEVICE REQUIRED | 2 |
| 💳 MANUAL PAYMENT TEST REQUIRED | 4 |
| ⏭ SKIPPED | 1 |

Uchala to'plam ham o'tdi: backend 10, UI 3, oqimlar 15 ta test.
Sinov obyektlari tozalandi — haqiqiy hisobda axlat qolmadi.

**E2E push bilan ishga tushMAYDI.** `nova-e2e.yml` ning yo'l filtri
ataylab tor (`mobile_nova/integration_test/**`), chunki ish HAQIQIY
hisob bilan kiradi: server bitta hisobga 15 daqiqada 5 ta kirish
beradi (`login:acct:`), har bir ish esa 4 tasini sarflaydi. `lib/`
o'zgarganda E2E ni QO'LDA ishga tushirish kerak
(`workflow_dispatch`), va ketma-ket ikki marta ishga tushirmaslik
kerak — ikkinchisi 429 oladi va hisob EGASI ham 15 daqiqa kira
olmaydi.

---

## 2. Shu bosqichda qilingan ishlar

### Umumiy backend

* **Izoh o'chirilganda dalil qoladi.** Ilgari qator butunlay
  yo'q qilinardi: haqorat yozgan odam uni o'zi o'chirib, keyin
  "men bunday yozmadim" deyishi mumkin edi. Endi `deleted_at`
  qo'yiladi va to'liq nusxa `content_comment_archive` ga
  yoziladi. Arxiv `content_comments` ga bog'lanmagan — post
  o'chirilsa ham dalil qoladi.
* **Admin moderatsiyasi**: ro'yxat (ko'rinadigan / o'chirilgan /
  barchasi + qidiruv), sabab bilan o'chirish, tiklash. Sabab
  majburiy.
* **NFCSTORE FEATURED** — pullik ko'tarilgan slotlar (1 / 3 / 6
  kun). Parallel to'lov tizimi yaratilmadi: mavjud `web_orders`
  + Payme/Click ishlatiladi va slotni **faqat** tasdiqlangan
  to'lov yoqadi.
* **Ko'tarilgan kontent lentaning o'zida** (`featured: true`),
  alohida endpointsiz — va u lentaning **o'z UNIONIDAN** o'tadi,
  ya'ni pul to'langani yashiringan profilni ochib bermaydi.

### Sayt

* **Izohlar UI** — ilgari saytda izoh umuman yo'q edi. Telefonda
  yozilgan izoh saytda ko'rinmasdi; biznes egasi mijoz savolini
  umuman ko'rmasdi.
* **Admin → "NFCSTORE ILOVASI"** — izohlar, dalil arxivi,
  ko'tarilgan postlar.

### Ilova

* **Kirish ekrani** — yangi vizual: tepada surat (`BoxFit.contain`,
  hech narsa kesilmaydi), pastda matn va tugmalar. Surat FONSIZ
  (alfa kanali), shuning uchun qora-champagne va ochiq mavzuda
  bir xil yaxshi turadi.
* **Tanlov** — "Postlar" yorlig'i olib tashlandi: bosh sahifaning
  o'zi lenta edi, ya'ni yorliq o'sha ro'yxatni ikkinchi marta
  ko'rsatardi.
* **NFC kartaga yozish** — begona, qayta yoziladigan NFC teg
  endi NFCSTORE profil tegiga aylanadi. Ikki bosqichli:
  tekshirish → ogohlantirish → yozish → **qayta o'qib
  tasdiqlash**.
* **Bosh sahifada haqiqiy lenta** — provayder bor edi, lekin
  hech qayerda chizilmasdi.
* **Video umri** — lentada video o'zi boshlanmaydi, kontroller
  bosilmaguncha qurilmaydi, ilova fonga ketganda to'xtaydi.
* **Postni lentada ko'tarish** — muddat tanlash va to'lov.
* Ilova nomi: **NFCSTORE** (eski ilova — **NFCSTORE Classic**).
  Paket ID'lariga tegilmadi.

---

## 3. Yo'l-yo'lakay topilgan xatolar

Bularning hech biri topshiriqda yo'q edi — ish davomida chiqdi.

| # | Xato | Oqibati |
|---|---|---|
| 1 | `dispose()` da `ref.read` (3 joyda) | **Reels yopilganda audio egaligi bo'shatilmasdi** — keyingi video ovozsiz boshlanardi; NFC sessiyasi yopilmasdi |
| 2 | `comments.js` sanani `Date.parse` bilan o'qirdi | **Har bir izohning vaqti "hozir"** deb qaytardi (D1 sanasi `+00` bilan tugaydi) |
| 3 | O'sha sabab — ban tekshiruvida | **Bloklangan odam izoh yozaverardi** (auksionlarda ban ishlardi) |
| 4 | `kUriPrefixes` da 36 tadan 7 tasi bor edi | Begona NFC tegining manzili buzib ko'rsatilardi |
| 5 | `_payloadOf` `String.fromCharCodes` ishlatardi | Lotin bo'lmagan harflar buzilardi |
| 6 | `SectionHeader` tor ekranda toshib ketardi | 320dp telefonda sariq-qora chiziqlar |
| 7 | Tor ekran qo'riqchisi 320x**640** ishlatardi | Ekrandan pastdagi bo'limlar **umuman qurilmasdi** — 6-xato shuning uchun topilmagan |
| 8 | `_dt` faqat ISO satrni o'qirdi | Lentadagi har bir postning `createdAt` i `null` |
| 9 | `recordCategories()` mavjud bo'lmagan GET ga qarardi | O'lik kod (hech kim chaqirmasdi) |
| 10 | Ilova branchidagi sayt nusxasi 17 000 satr orqada | **`wrangler.jsonc` da `ASSETS` binding yo'q edi** — o'sha branchdan deploy qilinsa sayt butunlay 500 berardi |
| 11 | `AndroidManifest.xml` da izoh TEG ICHIDA turardi | **APK umuman qurilmasdi** va E2E ning uchala to'plami YUKLANMASDI. `flutter analyze` ham, `flutter test` ham manifestni o'qimaydi — xato faqat qurishda chiqardi |
| 12 | `AudioOwner` `StateNotifier` edi va egalik `state` da turardi | **Reels `initState` dan provayderni o'zgartirardi.** E2E test tugagandan KEYIN yiqilardi ("failed after test completion"), ya'ni matritsada 0 FAIL bo'lsa ham ish qizil qolardi va sabab hisobotda UMUMAN ko'rinmasdi |
| 13 | `recordCatalog()` bo'limlarni element deb o'qirdi | Katalog "9 ta element" deb ko'rsatardi — aslida 9 ta BO'LIM; element bo'yicha qidirilganda hech qachon topilmasdi |
| 14 | Mijozda katalog BO'LIMI yaratadigan metod yo'q edi | Server elementni bo'limsiz qabul qilmaydi (422 `bad_category`) — ya'ni yozuv katalogiga element qo'shib **umuman bo'lmasdi** |
| 15 | Lentaning IKKITA mijozi bor edi (`trending()` va `feed()`) | Ikkalasi `/api/feed` ga, lekin `limit` i har xil (30 va 15) — bir joyda ko'ringan post boshqasida yo'qolishi mumkin edi |

---

## 4. Qo'riqchilar

Har bir tuzatish uchun test yozildi — aks holda xato qaytib keladi.

| Joy | Soni |
|---|---|
| `deploy.yml` (sayt, har deployda) | **35** |
| `nova-apk.yml` (ilova CI) | +3 |
| Flutter (`flutter test`) | **523** passed, 1 skipped |
| E2E (emulyator, haqiqiy hisob) | **91** PASS, 0 FAIL |

Yangi qo'riqchilar:

* `test-comment-moderation.mjs` — 63 tekshiruv;
* `test-featured.mjs` — 83 tekshiruv, to'lov **haqiqiy** Payme
  JSON-RPC orqali;
* `test-nova-api-parity.mjs` — ilovaning 86 ta chaqiruvi haqiqiy
  worker ustida;
* `test-admin-nova-tab.mjs` — admin bo'limidagi har bir tugma;
* `test-app-identity.mjs` — ikki ilovaning nomi va paket ID'si;
* `test-catalog-kind-parity.mjs` — server va ilovadagi qoida
  ajralib ketmasligi;
* `xml-wellformed.mjs` — HAR BIR `AndroidManifest.xml` yaroqli
  XML ekani. Qo'riqchi ISHLASHI o'lchandi: manifest ataylab
  buzilganda u yiqildi;
* `music_test.dart` dagi `_LifecycleAudioProbe` — ovoz reyestrini
  `initState`/`dispose` dan chaqirish xavfsizligi. Bu ham
  o'lchandi: eski `StateNotifier` tuzilishi qaytarilganda yiqildi;
* `ui_regressions_test.dart` — `lib/data/repositories/` ichida
  `/api/feed` mijozi BITTA bo'lishi.

---

## 5. Tekshirilmagan narsalar — halol ro'yxat

Bu qatorlar **PASS emas** va ularni PASS deb yozish yolg'on
bo'lardi.

| Nima | Nega tekshirilmagan |
|---|---|
| **iOS — hammasi** | Mac va Xcode yo'q. NFC uchun sozlama qo'yildi, lekin Xcode imkoniyati va provisioning profil kerak |
| **NFC kartaga yozish — qurilmada** | Emulyatorda NFC apparati yo'q. Mantiq 26 ta test bilan qoplangan, apparat qismi esa `MANUAL_TEST.md` §1B da |
| **Haqiqiy to'lov (FEATURED)** | Sandbox yo'q — pul haqiqiy. To'lov yo'li haqiqiy Payme JSON-RPC bilan sinovdan o'tgan, lekin **haqiqiy karta bilan emas** |
| **Video fonga ketganda to'xtashi — qurilmada** | Kod tekshirilgan, apparat xulqi emas |
| **Play Store relizi** | Imzo kaliti va do'kon hisobi egasida |
| `nfcstore.uz` ga to'g'ridan-to'g'ri so'rov | Bu muhitdan yopiq (proxy 403). Production tekshiruvi GitHub runner'idagi `nova-smoke.yml` orqali — **11/11** |

---

## 6. Keyingi qadamlar

1. **Telefonda sinash** — `mobile_nova/MANUAL_TEST.md`, ayniqsa
   §1B (NFC yozish) va §1C (video).
2. **Mac kelganda** — `mobile_nova/IOS_RELEASE_CHECKLIST.md`.
3. **FEATURED narxlari** — hozir 29 000 / 69 000 / 119 000 so'm.
   Admin `admin_settings` dagi `featured_pricing` kaliti bilan
   o'zgartira oladi; kodga tegish shart emas.
