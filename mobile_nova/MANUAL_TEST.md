# NFCSTORE Nova — qurilmada qo'lda sinov protokoli

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

1. **APK:** Actions → *NFCSTORE Nova APK* → oxirgi ishga tushish →
   `nfcstore-nova-apk` → `app-arm64-v8a-release.apk` (zamonaviy
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
Actions → *NFCSTORE Nova APK* → `NFCSTORE-Nova-final` artefakti.

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
