# NFCSTORE Mobile — qurilmada qo'lda sinov protokoli

Bu hujjat **emulyator isbotlay olmaydigan** qatorlar uchun. Qolgan
hammasi avtomatlashtirilgan: `.github/workflows/nova-e2e.yml` haqiqiy
hisob bilan haqiqiy backendga ulanadi va PASS/FAIL matritsasini o'zi
chiqaradi.

Bu yerdagi qatorlar **DEVICE REQUIRED** deb belgilangan, chunki ular
haqiqiy apparatga bog'liq: NFC antennasi, kamera, video dekoder,
barmoq izi sensori, tizim oynalari va haqiqiy to'lov.

---

## Nega emulyator yetarli emas

| Nima | Emulyatorda | Sabab |
|---|---|---|
| NFC o'qish/yozish | umuman yo'q | AVD da NFC apparati yo'q |
| Kamera | soxta yashil kadr | haqiqiy rasm sifati sinalmaydi |
| Video ijro | dekoder boshqa | kodek, buferlash va ovoz farq qiladi |
| Biometrika | yo'q | `local_auth` olib tashlangan (§7) |
| Ulashish oynasi | OS oynasi | natijani dastur tasdiqlay olmaydi |
| To'lov | pul haqiqiy | sandbox yo'q |

---

## Tayyorgarlik

1. **APK:** Actions → *NFCSTORE Mobile APK* → oxirgi ishga tushish →
   `nfcstore-mobile-apk` → `app-arm64-v8a-release.apk` (zamonaviy
   telefonlar uchun) yoki `app-release.apk` (universal).
2. **Eski ilovani o'chirmang.** Nova paketi `uz.nfcstore.nova`,
   eskisi `uz.nfcstore.app` — ular yonma-yon turadi. Ikkalasi ham
   ochilishi SHART.
3. **DIQQAT — imzo kaliti har buildda o'zgaradi.** Reliz keystore
   sozlanmaguncha har CI ishi yangi debug kalit yaratadi, ya'ni yangi
   APK eskisining ustiga o'rnatilmaydi
   (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Avval eski Nova'ni
   o'chirasiz va **ilova ichidagi ma'lumot (token, PIN, sozlamalar)
   yo'qoladi**.
4. Telefon: Android 7.0 (API 24) yoki undan yangi, NFC bor.

### Natijani qanday yozish

Har bir qadam uchun: **PASS**, **FAIL** yoki **PARTIAL**. FAIL bo'lsa
albatta yozing:

* ekran nomi,
* nimani bosdingiz,
* nima kutgandingiz,
* nima bo'ldi,
* ekran surati yoki xato matni.

> Ekran suratini yuborishdan oldin **parolni va NFC ID larni**
> tekshiring — ularni kesib tashlang.

---

## 1. NFC — apparat *(DEVICE REQUIRED)*

> **TEGMANG:** haqiqiy NFC ID ni o'chirmang, asosiy ID ni
> almashtirmang, sovg'a qilmang, jismoniy kartani uzmang.
> Bu qadamlar faqat **o'qish** va **skanerlash**.

| # | Qadam | Kutilgan natija |
|---|---|---|
| 1.1 | NFC markazini oching | ID ro'yxati chiqadi, asosiysi belgilangan |
| 1.2 | Telefonda NFC ni **o'chiring**, keyin skanerni oching | Ilova "NFC o'chiq" deb aniq aytadi, soxta kutish oynasi ko'rsatmaydi |
| 1.3 | NFC ni yoqing, skanerni oching | Skanerlash holati boshlanadi |
| 1.4 | Haqiqiy NFCSTORE kartasini tegizing | Karta o'qiladi va tegishli profil ochiladi |
| 1.5 | Begona (bo'sh) NFC kartani tegizing | Xato aniq tushuntiriladi, ilova yiqilmaydi |
| 1.6 | Skaner ochiq turganda ilovani fonga chiqarib qaytaring | Skaner holati to'g'ri tiklanadi |
| 1.7 | QR ni oching va boshqa telefon bilan skanerlang | QR to'g'ri profilga olib boradi |
| 1.8 | "Ulashish" ni bosing | Tizim ulashish oynasi ochiladi, manzil to'g'ri |

---

## 1B. BEGONA NFC KARTAGA YOZISH *(DEVICE REQUIRED)*

> **EHTIYOT BO'LING:** bu bo'lim kartaga YOZADI. Sinov uchun
> **o'zingizning bo'sh yoki keraksiz** NFC stikeringizni oling.
> NFCSTORE jismoniy kartangizga yozmang — undagi chip tokeni
> o'chib ketadi va karta ishlamay qoladi.
>
> Kerak: qayta yoziladigan NFC teg (NTAG213/215/216 stiker yoki
> oq karta). Ular bozorda arzon.

| # | Qadam | Kutilgan natija |
|---|---|---|
| 1B.1 | NFC markazi → "NFC kartaga yozish" | Ekran ochiladi, yoziladigan manzil ko'rinadi (`nfcstore.uz/KOD`) |
| 1B.2 | Manzilni o'qing | U **ochiq profil manzili**; `/tap/` yoki uzun tasodifiy token **BO'LMASLIGI** kerak |
| 1B.3 | "Kartani tekshirish" → **bo'sh** stikerni tegizing | "Karta bo'sh" deb yozadi, sig'imini ko'rsatadi |
| 1B.4 | "Kartaga yozish" → o'sha stikerni tegizing | Tasdiq **so'ralmaydi** (karta bo'sh), "Yozildi va tekshirildi" chiqadi |
| 1B.5 | Stikerni telefonga tegizing (ilovadan tashqarida) | Brauzer yoki ilova sizning profilingizni ochadi |
| 1B.6 | O'sha stikerni **qayta** tekshiring | Endi "Bu kartada allaqachon ma'lumot bor" va ichidagi manzil ko'rinadi |
| 1B.7 | "Kartaga yozish" → **"Bekor qilish"** | Hech narsa yozilmaydi, eski manzil joyida qoladi (1B.5 ni takrorlab tekshiring) |
| 1B.8 | Qayta yozing → "Ha, ustiga yozilsin" | Yoziladi va tasdiqlanadi |
| 1B.9 | Bir necha profilingiz bo'lsa: boshqa profilni tanlang | 2-qadam **yopiladi**, qaytadan tekshirish so'raladi |
| 1B.10 | Tekshirgandan keyin **boshqa** stikerni tegizing | "Bu boshqa karta" deb rad etadi — tekshirilmagan kartaga yozmaydi |
| 1B.11 | Qulflangan (read-only) teg bo'lsa tegizing | "Bu karta qulflangan, qayta yozib bo'lmaydi", yozish tugmasi **o'chiq** |
| 1B.12 | Juda kichik sig'imli teg (NTAG203) bo'lsa | Sabab aniq: necha bayt kerak, necha bayt bor |
| 1B.13 | Yozish paytida kartani **olib qo'ying** | Xato chiqadi; "yozildi" **DEYILMAYDI** |
| 1B.14 | NFC ni o'chirib ekranni oching | "NFC o'chirilgan" holati, soxta kutish yo'q |

**Eng muhimi — 1B.2, 1B.7 va 1B.13.** Birinchisi maxfiy token
kartaga chiqib ketmasligini, ikkinchisi odamning ma'lumoti
so'roqsiz o'chmasligini, uchinchisi esa ilova yolg'on
"muvaffaqiyat" ko'rsatmasligini tekshiradi.

---

## 1C. LENTA VA VIDEO *(DEVICE REQUIRED)*

| # | Qadam | Kutilgan natija |
|---|---|---|
| 1C.1 | Bosh sahifani pastga aylantiring | Tanishtiruv bo'limidan **keyin** "LENTA" bo'limi va postlar |
| 1C.2 | Lentada video posti bo'lsa | Video **o'zi boshlanmaydi**, o'rtada ijro tugmasi turadi |
| 1C.3 | Ijro tugmasini bosing | Video ochiladi va o'ynaydi |
| 1C.4 | O'ynab turganda **boshqa ilovaga** o'ting va qayting | Ovoz fonga o'tganda **to'xtaydi** |
| 1C.5 | O'ynab turganda boshqa tabga o'ting (Reels/Profil) | Ovoz to'xtaydi, ikkita manba bir vaqtda ovoz chiqarmaydi |
| 1C.6 | Lentada beshta video post bo'lsa, tez aylantiring | Telefon qizimaydi, sekinlashmaydi (kontrollerlar ochilmaydi) |
| 1C.7 | Pullik ko'tarilgan post bo'lsa | Ism ostida kichik **"Homiylik"** belgisi turadi |
| 1C.8 | Mobil internetda lentani oching | Video trafigi ketmaydi (bosilmaguncha) |

---

## 1D. POSTNI LENTADA KO'TARISH *(DEVICE REQUIRED — HAQIQIY PUL)*

> **DIQQAT: bu HAQIQIY to'lov.** Eng arzon paketni tanlang va
> to'laganingizdan keyin admin panelidan to'xtatishingiz mumkin.
> To'lashni xohlamasangiz — 1D.1–1D.4 gacha bajaring va
> to'lov sahifasini yoping; slot "kutilmoqda" holatida qoladi
> va uni bekor qilsangiz bo'ladi.

| # | Qadam | Kutilgan natija |
|---|---|---|
| 1D.1 | **O'z** postingizni oching | Yuqorida "ko'tarish" belgisi (↗) ko'rinadi |
| 1D.2 | Begona postni oching | O'sha belgi **YO'Q** |
| 1D.3 | Ko'tarishni bosing | 1 / 3 / 6 kunlik paketlar va narxlari chiqadi |
| 1D.4 | Muddat tanlamasdan "To'lovga o'tish" | Tugma **o'chiq** turadi |
| 1D.5 | Muddat tanlang → "To'lovga o'tish" | Payme sahifasi ochiladi; ilovada **"To'lov kutilmoqda"** yoziladi |
| 1D.6 | To'lamasdan orqaga qayting | Hamon "kutilmoqda" — **"yonди" deb ko'rsatilmaydi** |
| 1D.7 | (Ixtiyoriy) To'lovni yakunlang | Bir necha soniyadan keyin post lentaning boshida, "Homiylik" belgisi bilan |
| 1D.8 | O'sha postni **yana** ko'tarmoqchi bo'ling | "Bu post allaqachon ko'tarilgan" |

**1D.6 eng muhimi:** ilova slotni o'zi yoqa olmasligi kerak.

---

## 2. Kamera va galereya *(DEVICE REQUIRED)*

> Yaratilgan hamma narsani **sinovdan keyin o'chiring**. Sarlavhaga
> `TEST — DELETE` deb yozing, shunda adashmaysiz.

| # | Qadam | Kutilgan natija |
|---|---|---|
| 2.1 | Post yaratish → galereyadan rasm | Rasm tanlanadi va ko'rinadi |
| 2.2 | Post yaratish → kameradan rasm | Kamera ochiladi, olingan rasm qo'shiladi |
| 2.3 | Ruxsatni **rad eting** | Ilova buni aniq aytadi, yiqilmaydi, soxta muvaffaqiyat yo'q |
| 2.4 | Juda katta rasm (10 MB+) tanlang | Progress ko'rinadi; yuklanadi yoki xato aniq chiqadi |
| 2.5 | Yuklash o'rtasida internetni uzing | Xato chiqadi, qayta urinish tugmasi bor |
| 2.6 | Avatarni almashtiring | Yangi avatar Home va Profilda darhol ko'rinadi |
| 2.7 | **Avatarni eski holiga qaytaring** | Eski avatar tiklandi |

---

## 3. Video va Reels *(DEVICE REQUIRED)*

| # | Qadam | Kutilgan natija |
|---|---|---|
| 3.1 | Reels tabini oching | Birinchi video o'ynaydi |
| 3.2 | Pastga suring | Eski video **to'xtaydi**, yangisi boshlanadi |
| 3.3 | Tez-tez 5-6 marta suring | Ovoz ustma-ust tushmaydi, ilova sekinlashmaydi |
| 3.4 | Videoni bosing | Pauza/davom ishlaydi |
| 3.5 | Reels ochiq turganda musiqa boshlang | Ikkalasi birdan chalinmaydi — bittasi to'xtaydi |
| 3.6 | Telefon ovozini o'chiring/yoqing | Video ovozi tizimga bo'ysunadi |
| 3.7 | Reels'da turib qo'ng'iroq qabul qiling | Video pauza bo'ladi, qaytgach o'zi baqirib ketmaydi |
| 3.8 | Ilovani fonga chiqarib qaytaring | Video **o'zi** qayta boshlanmaydi |
| 3.9 | TEST reel yuklang (qisqa video) | Progress, keyin ro'yxatda ko'rinadi |
| 3.10 | Ilovani yopib qayta oching | TEST reel hali joyida — server saqlagan |
| 3.11 | **TEST reelni o'chiring** | Ro'yxatdan yo'qoladi |

---

## 4. Musiqa *(qisman DEVICE REQUIRED)*

Manba — `cards.music_url`. Ilova **hech qanday musiqa to'qimaydi**:
yozuvda trek bo'lmasa, boshqaruv umuman chizilmaydi.

| # | Qadam | Kutilgan natija |
|---|---|---|
| 4.1 | Musiqasi bor profilni oching | Avatar yonida boshqaruv ko'rinadi |
| 4.2 | Musiqasi **yo'q** profilni oching | Boshqaruv umuman yo'q (bo'sh tugma emas) |
| 4.3 | Ijro eting | Ovoz chiqadi, progress yuradi |
| 4.4 | Progressni suring | Seek ishlaydi |
| 4.5 | Bir nechta trek bo'lsa, keyingisiga o'ting | To'g'ri trek boshlanadi |
| 4.6 | Boshqa tabga o'ting | Ijro to'xtamaydi yoki ataylab to'xtaydi — lekin ilova yiqilmaydi |
| 4.7 | Ilovani fonga chiqaring | Musiqa to'xtaydi |
| 4.8 | Qaytib keling | **O'zi qayta boshlanmaydi** |
| 4.9 | Quloqchinni uzing | Ovoz karnaydan baqirmaydi (tizim xulqi) |

> **Saytda musiqa bor, ilovada yo'q bo'lsa:** qaysi NFC ID ekanini
> yozing. E2E `musicUrls` ni o'sha yozuvdan o'qiydi va qaysi maydon
> bo'sh kelayotganini ko'rsatadi.

---

## 5. Biometrika — hozircha YO'Q

**Status: FAILED (qaytarildi).** `local_auth` paketi Android buildini
R8 bosqichida qotirib qo'yardi: uch urinishda ham build 40–60 daqiqa
osilib, xatolik ham bermadi; paketsiz esa 4 daqiqada o'tadi.

Shuning uchun:

* qulf **faqat PIN** bilan ishlaydi va bu to'liq himoya;
* sozlamalarda biometrika tugmasi **umuman yo'q** — bosilib hech narsa
  qilmaydigan tugma qoldirilmadi.

Sinash kerak bo'lgani — **bunday tugma yo'qligini** tasdiqlash.
Agar topsangiz, bu FAIL.

---

## 6. To'lov — *MANUAL PAYMENT TEST REQUIRED*

> **HAQIQIY PUL.** Sandbox yo'q. Avtomatik sinov to'lovni
> **boshlamaydi** — faqat provayderlar ro'yxatini o'qiydi.

Ruxsat bermaguningizcha 6.4-qadamni bajarmang.

| # | Qadam | Kutilgan natija |
|---|---|---|
| 6.1 | Do'kon → mahsulot → to'lovga o'tish | Summa va mahsulot TO'G'RI ko'rinadi |
| 6.2 | Har bir provayderni tanlang (Payme / Click / Paynet) | Faqat server yoqganlari ko'rinadi |
| 6.3 | To'lovni **bekor qiling** | Ilova "bekor qilindi" deydi, soxta muvaffaqiyat yo'q |
| 6.4 | *(faqat ruxsat bilan)* Eng arzon mahsulotni haqiqatan to'lang | Buyurtma holati **serverda** yangilanadi |
| 6.5 | Ilovani yopib oching → to'lovlar tarixi | To'lov tarixda ko'rinadi |
| 6.6 | Internetsiz to'lovga urinib ko'ring | Aniq xato, osilib qolish yo'q |

---

## 7. Umumiy barqarorlik

| # | Qadam | Kutilgan natija |
|---|---|---|
| 7.1 | Aviarejimda ilovani oching | Offline holat aniq, soxta bo'sh ro'yxat emas |
| 7.2 | Internetni qaytaring | Ma'lumot o'zi yoki "qayta urinish" bilan keladi |
| 7.3 | Tizim shriftini eng kattaga qo'ying | Matn kesilmaydi, tugmalar bosiladi |
| 7.4 | Qorong'i/yorug' rejimni almashtiring | Mavzu buzilmaydi |
| 7.5 | Besh mavzuni aylanib chiqing | Hech qayerda o'qib bo'lmaydigan kontrast yo'q |
| 7.6 | Ekranni aylantiring | Portret qulflangan — o'zgarmaydi |
| 7.7 | PIN qulfini yoqing, fonga chiqib 30 s kuting | Qaytganda qulf so'raydi |
| 7.8 | Noto'g'ri PIN kiriting | Ochilmaydi |
| 7.9 | To'g'ri PIN kiriting | Qayerda edingiz — o'sha yerga qaytasiz |
| 7.10 | Telefonni qayta yuklang, ilovani oching | Sessiya saqlangan, qaytadan kirish talab qilinmaydi |

---

## 8. STAGE 1 — lenta kartasi va asosiy oqimlar

**Qaysi qurilish:** APK #46, commit `ece12ed` (yoki undan keyingi).
Actions → *NFCSTORE Mobile APK* → `NFCSTORE-Mobile` artefakti.

Bu bo'lim avtomatlashtirilganidan FARQ qiladi. Vidjet testlari soxta
backend bilan, E2E esa emulyatorda ishlaydi. Quyidagilarni faqat
haqiqiy telefon isbotlaydi: tizim ulashish oynasi, haqiqiy tarmoq
kechikishi ostida ikki marta bosish, ilovani o'ldirib qayta ochish,
va NFC apparati.

Har qatorga **PASS** yoki **FAIL** yozing. FAIL bo'lsa: nima
kutilgan, nima chiqqan, va ekran surati.

### 8.1 Ochilish va rejimlar

| # | Qadam | Kutilgan natija | Natija |
|---|---|---|---|
| 1 | Ilovani ochish | Home ochiladi, pastki navigatsiya ko'rinadi | |
| 2 | Shaxsiy rejim | O'z ismingiz va NFC kodingiz tepada | |
| 3 | Biznes rejimga o'tish | Kompaniya nomi va logosi almashadi | |
| 4 | Biznes → Shaxsiy qaytish | Avvalgi shaxsiy profil qaytadi | |

### 8.2 Lenta kartasi — to'rt amal

| # | Qadam | Kutilgan natija | Natija |
|---|---|---|---|
| 5 | Lentani ochish | Kartalar yuklanadi, rasm/video ko'rinadi | |
| 6 | Yurakni bosish | DARHOL to'ladi, sanoq +1 | |
| 7 | Qayta bosish | Bo'shaydi, sanoq boshlang'ichga qaytadi | |
| 8 | Yurakni TEZ ikki marta bosish | Bir marta bosgandek: holat aniq, sanoq sakramaydi | |
| 9 | Internetni o'chirib yurakni bosish | Holat ESKISIGA qaytadi **va** sabab yozuvi chiqadi | |
| 10 | Izohni bosish | Post ekrani ochiladi, izoh maydoni fokusda | |
| 11 | Ulashishni bosish | Tizim ulashish oynasi ochiladi | |

> **8.2/11 haqida:** ulashish oynasi ochilishi — shu qatorning
> mezoni. Havolani OCHIB ko'rish alohida masala: `nfcstore.uz/<kod>`
> hozir HTTP 500 qaytaryapti va bu **EXTERNAL WEB BLOCKER** —
> saytning production marshruti, ilova kamchiligi emas. Ilovada
> yashirilmadi va havola formati o'zgartirilmadi.

### 8.3 Obuna

| # | Qadam | Kutilgan natija | Natija |
|---|---|---|---|
| 12 | Begona muallif postini topish | "Obuna bo'lish" tugmasi bor | |
| 13 | Uni bosish | Darhol "Obuna bo'lingan" ga o'tadi | |
| 14 | Uning profiliga kirish | U yerda ham obuna holati mos | |
| 15 | Qaytib yechish | "Obuna bo'lish" ga qaytadi | |
| 16 | **O'Z** postingizni topish | Obuna tugmasi UMUMAN yo'q | |
| 17 | Biznes rejimda o'z kompaniya postini topish | Obuna tugmasi UMUMAN yo'q | |

### 8.4 Holat mosligi

| # | Qadam | Kutilgan natija | Natija |
|---|---|---|---|
| 18 | Lentada yurak bosib, postni ochish | Post ekranida ham to'lgan yurak, sanoq bir xil | |
| 19 | Post ekranida yechib, orqaga qaytish | Lentadagi karta ham bo'shagan | |
| 20 | Biznes rejimda lentani ko'rish | Kompaniya postlari shaxsiy bilan aralashmagan | |

### 8.5 Qolgan oqimlar buzilmaganini tekshirish

| # | Qadam | Kutilgan natija | Natija |
|---|---|---|---|
| 21 | Istorya doirachasini bosish | Ko'ruvchi ochiladi, oxirigacha o'tib yopiladi | |
| 22 | NFC markazini ochish | Ekran ochiladi, orb ko'rinadi | |
| 23 | "NFC ID larim" | Hamma ID lar joyida | |
| 24 | Kartalar / Sovg'a / Xavfsizlik | Uchalasi ham ochiladi, ma'lumot joyida | |
| 25 | Katalog va Statistika (biznes) | Ikkalasi ham ochiladi, ma'lumot joyida | |

### 8.6 Sessiya

| # | Qadam | Kutilgan natija | Natija |
|---|---|---|---|
| 26 | Chiqish (logout) | Kirish ekraniga qaytadi | |
| 27 | Qayta kirish | Home ochiladi, profil joyida | |
| 28 | Ilovani BUTUNLAY yopib qayta ochish | Qayta kirish so'ralmaydi, sessiya tirik | |
| 29 | Qayta ochgandan keyin lenta | Layk va obuna holatlari serverdagidek | |

> **29 haqida:** layk/obuna holati ataylab xotirada saqlanmaydi —
> ilova qayta ochilganda u SERVERDAN o'qiladi. Ya'ni to'g'ri natija
> "bosganim esda qolgan" emas, "serverdagi haqiqat ko'rsatilgan".

---

## 9. QURILMADA TOPILGAN UCHTA XATO — QAYTA TEKSHIRUV

Bu bo'lim 2026-09-21 da haqiqiy Android telefonda topilgan
xatolar uchun. Har bir qator TELEFONDA bajarilishi kerak:
emulyatorda video ijrosi ham, ovoz ham ishonchli emas.

Ikkita hisob kerak: **A** (siz) va **B** (boshqa profil).

### 9.1 Kuzatish — holat saqlanadimi

| # | Qadam | Kutilgan |
|---|-------|----------|
| 1 | A bilan kiring, B ning profilini oching | tugma holati SERVERDAN keladi: agar allaqachon obuna bo'lsangiz — «Kuzatilmoqda» |
| 2 | «Kuzatish» ni bosing | ✓ chiqadi va **QAYTIB KETMAYDI** |
| 3 | Orqaga chiqib, B profilini QAYTA oching | hali ham «Kuzatilmoqda» |
| 4 | Ilovani butunlay yopib, qayta oching, B ga kiring | hali ham «Kuzatilmoqda» |
| 5 | «Kuzatilmoqda» ni bosing (obunani yechish) | «Kuzatish» ga qaytadi va qayta ochilganda ham shunday qoladi |
| 6 | Internetni o'chirib, 2-qadamni takrorlang | ✓ **KO'RSATILMAYDI**; aniq xato xabari chiqadi |

> 6-qator muhim: ilova server tasdiqlamagan narsani tasdiqlangandek
> ko'rsatmasligi kerak.

### 9.2 Obunachilar / Obunalar — raqam va ro'yxat

| # | Qadam | Kutilgan |
|---|-------|----------|
| 1 | O'z profilingizni oching | uchta raqam HAQIQIY (0 emas, agar postingiz/obunachingiz bo'lsa). Javob kelmaguncha «—» turadi |
| 2 | B ga obuna bo'ling, B profilini oching | B ning «Obunachilar» soni +1 |
| 3 | O'z profilingizga qayting | «Obunalar» soni +1 |
| 4 | «Obunachilar» raqamini bosing | HAQIQIY ro'yxat ochiladi |
| 5 | Ro'yxatdan birortasini bosing | o'sha profil ochiladi |
| 6 | «Obunalar» ni bosing | obuna bo'lganlaringiz chiqadi (obunachilar EMAS) |
| 7 | Obunani yeching, profilni qayta oching | raqam −1 |

> 6-qator aynan shu xatoni ushlaydi: ilova noto'g'ri parametr
> yuborganda server ikkala tugmaga ham obunachilarni qaytarardi.

### 9.3 B ning bildirishnomasi

| # | Qadam | Kutilgan |
|---|-------|----------|
| 1 | A bilan B ga obuna bo'ling | — |
| 2 | B hisobiga kiring, Faoliyat bo'limini oching | A ning obunasi haqida yozuv BOR, o'qilmagan |
| 3 | Yozuvni bosing | o'qilgan bo'ladi va A profiliga olib boradi |
| 4 | A bilan yana obuna bo'ling (yechib, qayta) | takroriy YOZUV yaratilmaydi (yangi obuna — yangi yozuv, lekin duplikat emas) |
| 5 | A o'ziga obuna bo'lishga urinsin | mumkin emas; o'ziga bildirishnoma kelmaydi |

### 9.4 Lentadagi video — Instagram xulqi *(DEVICE REQUIRED)*

Bosh sahifada kamida ikkita VIDEO post bo'lishi kerak.

| # | Qadam | Kutilgan |
|---|-------|----------|
| 1 | Bosh sahifani oching, birinchi videogacha suring | video ekranning ~2/3 qismini egallaganda O'ZI boshlanadi |
| 2 | Ikkinchi videogacha suring | birinchisi DARHOL to'xtaydi, ikkinchisi boshlanadi |
| 3 | Ikkalasi ham yarimta ko'rinadigan joyda to'xtang | HECH BIRI o'ynamaydi |
| 4 | Diqqat bilan tinglang | bir vaqtda BITTA ovoz; ikkita ovoz ustma-ust kelmaydi |
| 5 | Videoni ekrandan butunlay chiqaring | to'xtaydi |
| 6 | Boshqa tabga o'ting | ovoz DARHOL to'xtaydi |
| 7 | Bosh sahifaga qayting | faqat HOZIR ko'rinayotgan video boshlanadi; yashirin eski video o'zi o'ynamaydi |
| 8 | Telefonning Home tugmasini bosing (ilova fonga) | ovoz to'xtaydi |
| 9 | Ilovaga qayting | faqat ko'rinayotgani davom etadi |
| 10 | Profil musiqasi o'ynayotganda videoga suring | musiqa to'xtaydi, video boshlanadi |

### 9.5 "Asosiy" tugmasi

| # | Qadam | Kutilgan |
|---|-------|----------|
| 1 | Boshqa tabda turib «Asosiy» ni bosing | bosh sahifaga o'tadi |
| 2 | Bosh sahifani pastga suring | — |
| 3 | «Asosiy» ni QAYTA bosing | ro'yxat animatsiya bilan eng tepaga qaytadi |
| 4 | Tepada turib yana bosing | hech narsa buzilmaydi |

---

## Natijani qaytarish

Qisqa jadval yetarli:

```
1.4  PASS
1.5  FAIL — begona karta tegizilganda ilova yopilib qoldi
           (NFC markazi → skaner, Android 14, Pixel 7)
3.5  PASS
6.4  bajarilmadi — ruxsat berilmagan
```

FAIL bo'lgan qatorlar `FINAL_GAPS.md` ga ko'chiriladi va tuzatiladi.
