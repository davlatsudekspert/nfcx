# NFCSTORE — Codex uchun dizayn topshirig'i

> Bu faylni Codex/ChatGPT chatiga to'liq nusxalab tashlang.
> Oldingi chatda yasalgan 10 ta ekran rasmini ham birga yuklang.

---

## ⚠️ ENG MUHIM QOIDA — AVVAL SHUNI O'QI

**Ishni MUKAMMAL TUGAT. Chala ish YUBORMA.**

Bu dizaynlar to'g'ridan-to'g'ri dasturchiga ketadi va kodga aylanadi.
Chala rasm — bu chala ilova degani. Shuning uchun:

1. **Har bir ekran 100% tugallangan bo'lsin.** Bo'sh joy, chizilmagan
   element, kesilgan matn, "keyin qo'shaman" degan qism BO'LMASIN.
2. **Ekranni yarmini chizib yuborma.** Agar ekran murakkab bo'lsa,
   vaqt sarfla — lekin to'liq chiz.
3. **Matn o'qilmasa — bu chala ish.** Har bir yozuv aniq, to'liq va
   o'zbekcha bo'lsin. Kesilgan so'z, "..." bilan tugagan sarlavha,
   tanib bo'lmaydigan ikonka qabul qilinmaydi.
4. **Agar limit tugasa yoki charchasang — TO'XTA va AYT.**
   "6 tadan 4 tasi tayyor, 2 tasi qoldi" deb yozib qo'y.
   Chala 6 tadan, tugallangan 4 ta afzal.
5. **O'zing tekshirmagan rasmni yuborma.** Yuborishdan oldin har
   rasmni ko'r: ranglar to'g'rimi, chekka bo'shliq tengmi,
   navigatsiya oldingi ekranlardagidek bir xilmi.
6. **Bir to'plam tugamaguncha keyingisiga o'tma.** Tartib buzilsa,
   dasturchi qaysi ekran qayerga tegishli ekanini bilmaydi.

Men senga shoshilmayman. **Sifat muhim, tezlik emas.**

---

## KONTEKST

NFCSTORE — O'zbekistondagi NFC raqamli vizitka xizmati (nfcstore.uz).
Foydalanuvchi metall NFC karta oladi, uni telefonga tegizganda profili
ochiladi. Ilovada: profil, kontent (post/story/reels), biznes sahifalari,
ID katalogi, karta buyurtmasi, Payme/Click to'lovi.

Sen bilan biz ilovaning **10 ta ekranini** allaqachon yasadik:
bosh sahifa, NFC markazi, shaxsiy profil, ID katalogi, biznes profil,
kashfiyot, karta buyurtmasi, story ko'rish, sozlamalar.
Ular yoqdi. **Endi qolgan ekranlarni AYNAN shu uslubda davom ettiramiz.**

Bu rasmlar dasturchiga (Claude Code) beriladi va u ularni Flutter'da
1:1 yozadi. Shuning uchun aniqlik va izchillik chiroylilikdan muhimroq.

---

## 1. DIZAYN TIZIMI — O'ZGARTIRILMAYDI

Quyidagilar QULFLANGAN. Yangi rang, yangi shrift, yangi tugma shakli
O'YLAB TOPILMAYDI. Har bir yangi ekran shu qiymatlardan foydalanadi.

### Ranglar
```
Fon (asosiy)          #0A0908
Fon (karta/tile)      #131110
Fon (ustki element)   #1B1815
Fon (input, pastki)   #060505

Oltin — yorug' uchi   #F9EEC4
Oltin — yuqori        #EBD293
Oltin — asosiy        #DCBA72
Oltin — o'rta         #C9A455
Oltin — quyuq uchi    #A8823B

Kumush                #E8E8EA → #B9BAC0 → #7C7E86
Bronza                #E0A878 → #BC7F4E → #8A5730

Matn — asosiy         #F7F4EE
Matn — ikkilamchi     #A29A8E
Matn — eng past       #6B645B
Matn — oltin urg'u    #E2C480
Matn — oltin ustida   #2A1F0C

Qirra (hairline)      rgba(226,196,128,0.13)
Qirra — oltin         rgba(226,196,128,0.34)

Muvaffaqiyat          #5BD08A
Ogohlantirish         #E8B45C
Xato                  #EF6B6B
```

### Metall gradient (karta va tugma uchun bir xil retsept)
```
118°: #E7D093 0% → #D9BD76 11% → #C9A75C 24% → #EFDCA6 36%
    → #D3B368 47% → #BE9A4E 62% → #CDAA5C 76% → #A8823B 89% → #8C6B2E 100%
Ustiga: diagonal oq nur yo'li (104°, 45% da rgba(255,255,255,.30))
Ustiga: cho'tka izi (97° ingichka chiziqlar, overlay rejimi)
```

### Shriftlar
| Vazifa | Shrift | Misol |
|---|---|---|
| Katta sarlavha | **Instrument Serif** 400 | "Assalomu alaykum, Dilshod", "NFC markazi" |
| Barcha interfeys matni | **Manrope** 400/500/600/700/800 | tugma, ro'yxat, izoh |
| ID kod, raqam | **IBM Plex Mono** 500/600 | "GLD 777", "200 000 so'm" |

Boshqa shrift ISHLATILMAYDI.

### O'lchamlar
```
Ekran chekkasi (gutter)   20 px
Panjara                   4 px (8, 12, 16, 20, 24, 32)
Burchak radiusi           10 / 14 / 18 / 24 / to'liq
Bosish maydoni            ≥ 44 px
Asosiy tugma balandligi   52 px
Pastki navigatsiya        78 px
```

### Doimiy elementlar — HAR EKRANDA BIR XIL
1. **Status qatori**: chapda `9:41`, o'ngda signal + Wi-Fi + batareya (oq).
2. **Pastki navigatsiya** (tab ekranlarida): `Asosiy · Qidiruv · [NFC] · Reels · Profil`.
   Markazda suzuvchi oltin dumaloq tugma, ichida `((N))` logotipi, ostida "NFC".
   Faol tab — oltin rangda, qolgani kulrang.
3. **iPhone pastki chizig'i**: pastda markazda oq, 136×5 px.
4. **Ichki ekranlarda**: yuqorida chapda `‹` orqaga tugmasi, markazda sarlavha.
5. **Oltin NFC karta**: nisbati 2:1, o'ng pastdan NFC yoylari chiqadi,
   chapda tepada `((N)) NFCSTORE`, o'ngda tepada `)))`, pastda ID kodi.

---

## 2. TEXNIK TALABLAR — BUNI ALBATTA BAJAR

| # | Talab | Sabab |
|---|---|---|
| 1 | **Har rasmda FAQAT BITTA ekran.** 3 tasini yonma-yon qo'yma. | 3 ta bo'lsa aniqlik yo'qoladi, dasturchi detalni ko'rmaydi |
| 2 | O'lcham **1170 × 2532 px** (iPhone 14 Pro, @3x) | Flutter shu nisbatda yoziladi |
| 3 | Telefon ramkasi, qo'l, soya, "mockup" foni **KERAK EMAS** — faqat ekranning o'zi | Ramka piksel o'lchashga xalaqit beradi |
| 4 | Matnlar **haqiqiy o'zbekcha** bo'lsin. "Lorem ipsum" yoki inglizcha yozma | Matn kodda shu holda ishlatiladi |
| 5 | Har rasm nomi: `NN-ekran-nomi.png` (masalan `12-tolov-payme.png`) | Tartib saqlanadi |
| 6 | Bitta xabarda **6 tadan ortiq ekran yuborma** | Sifat pasayadi |
| 7 | Har to'plam oxirida qaysi rang/o'lcham ishlatganingni yozib ber | Dasturchi tekshiradi |

---

## 3. EKRANLAR RO'YXATI

Tartib bilan, to'plam-to'plam. Har to'plamni yuborganimda keyingisiga o'tamiz.

### 1-to'plam — Kirish oqimi
1. **Onboarding 1** — "Bir tegishda tanishing". Katta NFC karta tasviri, 3 nuqtali indikator, "Keyingi" tugmasi, tepada "O'tkazib yuborish".
2. **Onboarding 2** — "O'zingizga xos ID". Bronza/Kumush/Oltin kartalar yelpig'ich shaklida.
3. **Onboarding 3** — "Hammasi bir profilda". Telefon ekranida profil ko'rinishi, "Boshlash" tugmasi.
4. **Kirish** — logotip, email/telefon inputi, parol inputi (ko'z ikonkasi), "Kirish" oltin tugma, "Parolni unutdingizmi?", pastda "Hisobingiz yo'qmi? Ro'yxatdan o'ting".
5. **Ro'yxatdan o'tish** — ism, email, parol, parolni takrorlash, qoidalarga rozilik checkbox, "Davom etish".
6. **Email tasdiqlash** — 6 xonali kod inputi (6 ta alohida katak), "Qayta yuborish 00:42", "Tasdiqlash".

### 2-to'plam — To'lov va buyurtma
7. **To'lov usuli** — Payme va Click kartalari (brend ranglari bilan), tanlangan holat oltin qirra bilan, pastda summa va "To'lash".
8. **To'lov jarayoni** — markazda aylanuvchi indikator, "To'lov tekshirilmoqda", "Ilovadan chiqmang" ogohlantirishi.
9. **To'lov muvaffaqiyatli** — katta yashil/oltin ✓ belgisi, summa, ID kodi, chek raqami, "Buyurtmani ko'rish" + "Bosh sahifaga".
10. **Buyurtmalarim** — buyurtmalar ro'yxati, har birida kichik karta tasviri, holat chipi (Tayyorlanmoqda / Yo'lda / Yetkazildi), sana, summa.
11. **Buyurtma tafsiloti** — katta karta tasviri, 4 bosqichli yetkazib berish kuzatuvi (vertikal timeline), manzil, summa, "Yordam".
12. **To'lovlar tarixi** — sana bo'yicha guruhlangan ro'yxat, har qatorda Payme/Click belgisi, summa, holat.

### 3-to'plam — NFC amallari
13. **NFC yozish** — "Kartaga yozish", yoziladigan ma'lumot ko'rinishi, to'lqin animatsiyasi, "Kartani yaqinlashtiring".
14. **NFC muvaffaqiyat** — katta ✓, "Karta o'qildi", profil ko'rinishi, "Kontaktni saqlash" oltin tugma.
15. **NFC xato** — qizil ogohlantirish belgisi, "Karta o'qilmadi", sabablar ro'yxati, "Qayta urinish".
16. **QR ulashish** — markazda katta QR kod (oq fonda, oltin ramkada), ostida ID kodi, "Rasmga saqlash" + "Ulashish".
17. **Sovg'a ID** — "ID sovg'a qilish", qabul qiluvchi inputi, tanlangan karta, sovg'a o'ramidagi karta tasviri, xabar matni inputi.
18. **Sovg'a takliflari** — kelgan sovg'alar ro'yxati, har birida yuboruvchi, karta turi, "Qabul qilish" / "Rad etish".

### 4-to'plam — Kontent
19. **Reels** — to'liq ekran video, o'ngda vertikal amallar (yurak, izoh, ulashish, ⋯), pastda muallif va matn, tepada progress chiziqlari.
20. **Post yaratish** — rasm tanlash grid, matn maydoni, "Kimga ko'rinadi" tanlovi, "Joylash" oltin tugma.
21. **Post tafsiloti** — katta rasm, muallif qatori, matn, izohlar ro'yxati, pastda izoh yozish maydoni.
22. **Qidiruv natijalari** — qidiruv inputi to'ldirilgan, filtr chiplari, natijalar ro'yxati (avatar + ism + ID kodi + "Kuzatish" tugmasi).
23. **Mening kontentim** — 3 ustunli rasm gridi, tepada Postlar / Reels / Saqlangan tablari.
24. **Shikoyat oynasi** — pastdan chiqadigan sheet, sabablar ro'yxati (radio), "Yuborish".

### 5-to'plam — Profil va biznes
25. **Profilni tahrirlash** — avatar o'zgartirish (kamera belgisi bilan), ism, bio, ijtimoiy tarmoq havolalari, "Saqlash".
26. **Obunachilar** — ro'yxat, har qatorda avatar + ism + ID + "Kuzatish"/"Kuzatilmoqda" tugmasi, tepada Obunachilar/Obunalar tablari.
27. **Shaxsiy statistika** — oltin chiziqli grafik, ko'rishlar/saqlashlar/ulashishlar raqamlari, davr tanlovi (7 kun / 30 kun / Yil).
28. **Biznes yaratish** — nom, kategoriya tanlovi, logo yuklash, manzil, telefon, "Yaratish".
29. **Katalog tahrirlash** — mahsulotlar ro'yxati, har birida rasm + nom + narx + ⋮, pastda "+ Mahsulot qo'shish".
30. **Mahsulot tafsiloti** — katta rasm, nom, narx, tavsif, "Buyurtma berish" oltin tugma.
31. **Ish vaqti** — hafta kunlari ro'yxati, har birida vaqt oralig'i va yoqish/o'chirish tugmasi.
32. **Biznes statistikasi** — ustunli grafik, eng ko'p ko'rilgan mahsulotlar, NFC tegishlar soni.

### 6-to'plam — Tizim
33. **Premium** — tariflar solishtiruvi (Bepul / Premium), imkoniyatlar ro'yxati ✓ belgilar bilan, oltin toj ikonkasi, narx, "Premium olish".
34. **Ko'rinish** — mavzu tanlovi (Oltin / Kumush / Bronza / Tungi), har biri kichik karta namunasi bilan, tanlangan oltin qirrada.
35. **PIN o'rnatish** — 4 ta doira indikator, raqamli klaviatura (oltin raqamlar), "PIN kodni kiriting".
36. **Blokirovka ekrani** — logotip, PIN doiralari, klaviatura, pastda "Face ID bilan kirish".
37. **Yordam** — savollar ro'yxati (akkordeon), pastda "Telegram orqali bog'lanish" + "Email yozish".
38. **Xavfsizlik va maxfiylik** — parolni o'zgartirish, ikki bosqichli himoya (toggle), faol seanslar, "Hisobni o'chirish" (qizil).

### 7-to'plam — Holatlar (BULARNI UNUTMA — ilova sifatini shular belgilaydi)
39. **Bo'sh lenta** — markazda ingichka oltin illyustratsiya, "Hali hech narsa yo'q", "Odamlarni kuzating" tugmasi.
40. **Bo'sh buyurtmalar** — "Buyurtmangiz yo'q", "Karta buyurtma qilish" tugmasi.
41. **Internet yo'q** — uzilgan ulanish illyustratsiyasi, "Internet yo'q", "Qayta urinish".
42. **Yuklanmoqda** — skeleton holat: kartalar va matn o'rnida kulrang to'rtburchaklar (shimmer).
43. **Server xatosi** — "Nimadir noto'g'ri ketdi", xato kodi, "Qayta urinish".
44. **Topilmadi** — "Bunday ID topilmadi", qidiruv maydoni, "Katalogga o'tish".

---

## 4. SIFAT MEZONLARI

Har ekranni yuborishdan oldin o'zingni tekshir:

- [ ] Fon **#0A0908** — boshqa qora emas
- [ ] Sarlavha **Instrument Serif**, interfeys matni **Manrope**
- [ ] Chekka bo'shliq **20 px**, ikkala tomonda teng
- [ ] Ekranda **bitta** oltin asosiy tugma (qolgani qirrali yoki shaffof)
- [ ] Pastki navigatsiya oldingi ekranlardagidek **aynan bir xil**
- [ ] Holat faqat rang bilan emas, **belgi + matn** bilan ham ko'rsatilgan
- [ ] Matnlar o'zbekcha va haqiqiy
- [ ] Rasm **1170×2532**, bitta ekran
- [ ] **Ekran to'liq tugallangan** — bo'sh joy, chizilmagan element,
      kesilgan matn yo'q
- [ ] Har bir yozuv **o'qiladi**, har bir ikonka **tanib olinadi**

---

## 5. BIRINCHI QADAM

**1-to'plamni** (6 ta ekran: onboarding ×3, kirish, ro'yxat, email tasdiqlash)
yuqoridagi qoidalar bo'yicha yasab ber. Har birini alohida rasm qilib.

**Tugallanmagan ishni yuborma.** Agar 6 tasini bir yo'la ulgurmasang,
nechta tayyor bo'lsa shuncha yubor va "qolgan N tasi keyingi xabarda"
deb yozib qo'y. Yarim chizilgan ekran — ishlamaydi.

Tayyor bo'lgach, ishlatgan ranglaringni ro'yxat qilib yoz — men ularni
kodga solishtiraman.
