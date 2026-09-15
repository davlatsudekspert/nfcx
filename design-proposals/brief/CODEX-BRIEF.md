# NFCSTORE — DIZAYNNI TUGATISH TOPSHIRIG'I

> **Qanday ishlatiladi:** shu faylni Codex chatiga bir marta to'liq tashlang
> + oldin o'zi yasagan 10 ta ekran rasmini biriktiring. Keyin har safar
> faqat **"keyingi to'plam"** deb yozasiz.

---

# 0. ENG MUHIM — AVVAL SHUNI O'QI

## Sen boshlagan dizaynni TUGAT. Uslubni O'ZGARTIRMA.

Sen NFCSTORE ilovasi uchun **10 ta ekran** yasading: bosh sahifa,
NFC markazi, shaxsiy profil, ID katalogi, biznes profil, kashfiyot,
karta buyurtmasi, story ko'rish, sozlamalar.

**Ular yoqdi. Ish shu darajada davom etadi.**

Bu topshiriq senga yangi dizayn bermaydi. U faqat **qolgan ekranlar
ro'yxatini** beradi. Uslub, rang, shrift, kompozitsiya — hammasi
**sening o'z ishingdan** olinadi.

### Qat'iy talablar

**1. Biriktirilgan 10 ta rasmga qarab tur.**
Har yangi ekranni chizishdan oldin ularni ko'zdan kechir. Yangi ekran
ular bilan **bitta ilovaning ekranlari** bo'lib ko'rinishi shart —
alohida rasm emas.

**2. Hech narsani "yaxshilashga" urinma.**
Yangi rang qo'shma. Yangi shrift olma. Tugma shaklini o'zgartirma.
Navigatsiyani qayta chizma. Kompozitsiyani qayta o'ylama.
**Sen topgan uslub to'g'ri — uni davom ettir, xolos.**

**3. Ishni MUKAMMAL TUGAT. Chala ish yuborma.**
Bu rasmlar to'g'ridan-to'g'ri dasturchiga ketadi va kodga aylanadi.
Chala rasm — chala ilova degani.
- Bo'sh joy, chizilmagan element, kesilgan matn bo'lmasin.
- Har yozuv aniq, to'liq va o'zbekcha bo'lsin.
- Tanib bo'lmaydigan ikonka — chala ish.

**4. Limit tugasa — TO'XTA va AYT.**
"6 tadan 4 tasi tayyor, 2 tasi qoldi" deb yozib qo'y.
Chala 6 tadan, tugallangan 4 ta afzal. **Shoshilma — men kutaman.**

**5. O'zing tekshirmagan rasmni yuborma.**
Yuborishdan oldin uni 10 ta eski rasm yoniga qo'yib ko'r: bir oilaga
o'xshaydimi? O'xshamasa — qayta chiz.

**6. Bir to'plam tugamaguncha keyingisiga o'tma.**

---

# 1. KONTEKST — ILOVA NIMA QILADI

**NFCSTORE** (nfcstore.uz) — O'zbekistondagi NFC raqamli vizitka xizmati.

Foydalanuvchi metall NFC karta oladi. Kartani birovning telefoniga
tegizadi — o'sha zahoti uning profili ochiladi: ismi, kasbi, aloqa
raqamlari, ijtimoiy tarmoqlari, ishlari. Qog'oz vizitka o'rniga.

Har kartaning **ID kodi** bor: `GLD 777`, `SLV 220` kabi.

**Ilovada bor:** shaxsiy profil · biznes sahifalari (menyu, katalog,
ish vaqti) · kontent (post, story, reels) · ID katalogi · karta
buyurtmasi · Payme/Click to'lovi · ID sovg'a qilish.

> **Ilovada YO'Q** (chizma): auksion · ichki xabarlashuv.

---

# 2. SENING DIZAYNING — SHU HOLDA QOLSIN

Quyidagilar **sening 10 ta rasmingdan o'lchab olingan**. Bular yangi
qoida emas — bular sen allaqachon qilgan ish. Yangi ekranlarda shu
qiymatlar takrorlanadi, shunda ilova yaxlit chiqadi.

## 2.1 Ranglar

```
── FON ────────────────────────────────
Asosiy fon              #0A0908
Karta / tile            #131110
Ustki element           #1B1815
Input ichi, pastki nav  #060505

── OLTIN ──────────────────────────────
Eng yorug' uchi         #F9EEC4
Yuqori                  #EBD293
Asosiy urg'u            #DCBA72
O'rta                   #C9A455
Quyuq uchi              #A8823B

── BOSHQA METALLAR ────────────────────
Kumush    #E8E8EA → #B9BAC0 → #7C7E86
Bronza    #E0A878 → #BC7F4E → #8A5730

── MATN ───────────────────────────────
Asosiy                  #F7F4EE
Ikkilamchi (izoh)       #A29A8E
Eng past (meta)         #6B645B
Oltin urg'u             #E2C480
Oltin ustidagi matn     #2A1F0C

── QIRRA ──────────────────────────────
Oddiy      rgba(226,196,128,0.13)
Oltin      rgba(226,196,128,0.34)

── HOLAT ──────────────────────────────
Muvaffaqiyat  #5BD08A
Ogohlantirish #E8B45C
Xato          #EF6B6B

── BREND ──────────────────────────────
Payme  #00CCCC      Click  #0099FF
```

## 2.2 Metall gradient — sening kartangdagi retsept

```
Burchak 118°:
  #E7D093 0%  →  #D9BD76 11%  →  #C9A75C 24%  →  #EFDCA6 36%
→ #D3B368 47% →  #BE9A4E 62%  →  #CDAA5C 76%  →  #A8823B 89%
→ #8C6B2E 100%

Ustiga: diagonal oq nur yo'li (104°, 45% joyda rgba(255,255,255,.30))
Ustiga: cho'tka izi — 97° li ingichka chiziqlar, overlay rejimida
```

## 2.3 Shriftlar

| Vazifa | Shrift |
|---|---|
| Katta sarlavha | **Instrument Serif** 400 |
| Interfeys matni | **Manrope** 400–800 |
| Raqam, ID kod, narx | **IBM Plex Mono** 500/600 |

## 2.4 O'lchamlar

```
Ekran chekkasi     20 px (ikkala tomonda teng)
Panjara            4 px  (8 · 12 · 16 · 20 · 24 · 32)
Burchak radiusi    10 · 14 · 18 · 24 · to'liq
Bosish maydoni     ≥ 44 px
Asosiy tugma       52 px balandlik
Pastki navigatsiya 78 px
Karta nisbati      2 : 1
```

## 2.5 Har ekranda AYNAN bir xil turadigan narsalar

**Status qatori** — chapda `9:41`, o'ngda signal + Wi-Fi + batareya, oq.

**Pastki navigatsiya** (tab ekranlarida):
`Asosiy · Qidiruv · [NFC] · Reels · Profil`
Markazda suzuvchi oltin dumaloq tugma, ichida `((N))`, ostida "NFC".
Faol tab oltin, qolgani kulrang.
**Bu element hamma ekranda piksel aniqligida bir xil bo'lishi shart.**

**iPhone pastki chizig'i** — pastda markazda oq, 136×5 px.

**Ichki ekranlarda** — chapda `‹` orqaga tugmasi (38 px dumaloq),
markazda sarlavha.

**Oltin NFC karta** — nisbat 2:1, o'ng pastdan NFC yoylari, chapda
tepada `((N)) NFCSTORE`, o'ngda tepada `)))`, pastda katta ID kodi
(mono shrift), ostida ism va tarif nomi.

---

# 3. TEXNIK TALABLAR

| # | Talab | Nima uchun |
|---|---|---|
| 1 | **Har rasmda FAQAT BITTA ekran** | 3 tasi yonma-yon bo'lsa aniqlik yo'qoladi, dasturchi detalni ko'rmaydi |
| 2 | Mobil ekran **1170 × 2532 px** (iPhone 14 Pro @3x) | Kod shu nisbatda yoziladi |
| 3 | Sayt: **2880 × 1800** (desktop) va **1170 × 2532** (mobil) | Sayt ikkala o'lchamda ishlaydi |
| 4 | Telefon ramkasi, qo'l, soya, mockup foni **KERAK EMAS** | Ramka piksel o'lchashga xalaqit beradi — faqat ekranning o'zi |
| 5 | Matnlar **haqiqiy o'zbekcha** | Matn kodga shu holda tushadi |
| 6 | Fayl nomi `NN-ekran-nomi.png` | Tartib saqlanadi |
| 7 | Bitta xabarda **6 tadan ortiq ekran yuborma** | Sifat pasayadi |
| 8 | **Odam fotolari va avatarlarni alohida fayl qilib ham ber** | Dasturchi ularni ilovaga qo'ya olishi uchun |

---

# 4. QISM A — MOBIL ILOVA (42 ta ekran)

> Bosh sahifa · NFC markazi · shaxsiy profil · ID katalogi · biznes
> profil · kashfiyot · karta buyurtmasi · story ko'rish · sozlamalar —
> **tayyor, qayta chizma.**

### A1 — Kirish oqimi
| # | Ekran | Ichida nima bo'lsin |
|---|---|---|
| 1 | Onboarding 1 | "Bir tegishda tanishing". Markazda katta oltin karta, pastda 3 nuqtali indikator (1-si faol), "Keyingi" tugma, tepa o'ngda "O'tkazib yuborish" |
| 2 | Onboarding 2 | "O'zingizga xos ID". Bronza · Kumush · Oltin kartalar yelpig'ich shaklida, 2-nuqta faol |
| 3 | Onboarding 3 | "Hammasi bir profilda". Profil ekranining kichik ko'rinishi, "Boshlash" tugma |
| 4 | Kirish | Logotip · email/telefon inputi · parol inputi (ko'z ikonkasi) · "Kirish" · "Parolni unutdingizmi?" · pastda "Hisobingiz yo'qmi? **Ro'yxatdan o'ting**" |
| 5 | Ro'yxatdan o'tish | Ism · email · parol · parolni takrorlash · qoidalarga rozilik · "Davom etish" |
| 6 | Email tasdiqlash | 6 ta alohida katak (1-si faol, oltin qirrada) · "Kodni qayta yuborish 00:42" · "Tasdiqlash" |

### A2 — To'lov va buyurtma
| # | Ekran | Ichida nima bo'lsin |
|---|---|---|
| 7 | To'lov usuli | Payme va Click kartalari brend ranglarida, tanlangani oltin qirrada + ✓, pastda summa va "To'lash" |
| 8 | To'lov jarayoni | Markazda aylanuvchi oltin indikator · "To'lov tekshirilmoqda" · "Ilovadan chiqmang" |
| 9 | To'lov muvaffaqiyatli | Katta ✓ oltin doirada · summa · ID kodi · chek raqami · "Buyurtmani ko'rish" + "Bosh sahifaga" |
| 10 | Buyurtmalarim | Ro'yxat: kichik karta + ID + holat chipi (Tayyorlanmoqda / Yo'lda / Yetkazildi) + sana + summa |
| 11 | Buyurtma tafsiloti | Katta karta · 4 bosqichli vertikal timeline (bajarilgani oltin, kelgusi kulrang) · manzil · summa · "Yordam" |
| 12 | To'lovlar tarixi | Sana bo'yicha guruhlangan, har qatorda Payme/Click belgisi + summa + holat |

### A3 — NFC amallari
| # | Ekran | Ichida nima bo'lsin |
|---|---|---|
| 13 | NFC yozish | "Kartaga yozish" · yoziladigan ma'lumot ko'rinishi · to'lqin halqalari · "Kartani yaqinlashtiring" |
| 14 | NFC muvaffaqiyat | Katta ✓ · "Karta o'qildi" · ochilgan profil ko'rinishi · "Kontaktni saqlash" |
| 15 | NFC xato | Qizil ogohlantirish · "Karta o'qilmadi" · 3 ta sabab · "Qayta urinish" |
| 16 | QR ulashish | Markazda katta QR kod (oq fonda, oltin ramkada) · ostida ID kodi · "Rasmga saqlash" + "Ulashish" |
| 17 | Sovg'a ID | "ID sovg'a qilish" · qabul qiluvchi inputi · tanlangan karta · sovg'a lentasidagi karta · xabar matni |
| 18 | Sovg'a takliflari | Kelgan sovg'alar: yuboruvchi + karta turi + "Qabul qilish" / "Rad etish" |

### A4 — Kontent
| # | Ekran | Ichida nima bo'lsin |
|---|---|---|
| 19 | Reels | To'liq ekran video · o'ngda vertikal amallar (yurak · izoh · ulashish · ⋯) · pastda muallif va matn · tepada progress chiziqlari |
| 20 | Post yaratish | Rasm tanlash gridi · matn maydoni · "Kimga ko'rinadi" tanlovi · "Joylash" |
| 21 | Post tafsiloti | Katta rasm · muallif qatori · matn · izohlar ro'yxati · pastda izoh yozish maydoni |
| 22 | Qidiruv natijalari | To'ldirilgan qidiruv inputi · filtr chiplari · natijalar (avatar + ism + ID + "Kuzatish") |
| 23 | Mening kontentim | 3 ustunli rasm gridi · tepada Postlar / Reels / Saqlangan tablari |
| 24 | Shikoyat oynasi | Pastdan chiqadigan sheet · sabablar ro'yxati (radio) · "Yuborish" |

### A5 — Profil va biznes
| # | Ekran | Ichida nima bo'lsin |
|---|---|---|
| 25 | Profilni tahrirlash | Avatar o'zgartirish (kamera belgisi) · ism · bio · ijtimoiy havolalar · "Saqlash" |
| 26 | Obunachilar | Tepada Obunachilar / Obunalar tablari · ro'yxatda avatar + ism + ID + "Kuzatish"/"Kuzatilmoqda" |
| 27 | Shaxsiy statistika | Oltin chiziqli grafik · ko'rishlar/saqlashlar/ulashishlar · davr tanlovi (7 kun · 30 kun · Yil) |
| 28 | Biznes yaratish | Nom · kategoriya · logo yuklash · manzil · telefon · "Yaratish" |
| 29 | Katalog tahrirlash | Mahsulotlar: rasm + nom + narx + ⋮ · pastda "+ Mahsulot qo'shish" |
| 30 | Mahsulot tafsiloti | Katta rasm · nom · narx · tavsif · "Buyurtma berish" |

### A6 — Tizim
| # | Ekran | Ichida nima bo'lsin |
|---|---|---|
| 31 | Ish vaqti | Hafta kunlari · har birida vaqt oralig'i va yoqish/o'chirish tugmasi |
| 32 | Premium | Bepul / Premium solishtiruvi · imkoniyatlar ✓ bilan · oltin toj · narx · "Premium olish" |
| 33 | Ko'rinish | Mavzu tanlovi (Oltin · Kumush · Bronza · Tungi) · har biri kichik karta namunasi bilan · tanlangani oltin qirrada |
| 34 | PIN o'rnatish | 4 ta doira indikator · raqamli klaviatura (oltin raqamlar) · "PIN kodni kiriting" |
| 35 | Blokirovka ekrani | Logotip · PIN doiralari · klaviatura · pastda "Face ID bilan kirish" |
| 36 | Xavfsizlik | Parolni o'zgartirish · ikki bosqichli himoya (toggle) · faol seanslar · "Hisobni o'chirish" (qizil) |

### A7 — Holatlar ⚠️ BULARNI UNUTMA
> Ilova "chala" ko'rinishi ko'pincha aynan shu ekranlar chizilmaganidan.
> Foydalanuvchi ularni har kuni ko'radi.

| # | Ekran | Ichida nima bo'lsin |
|---|---|---|
| 37 | Bo'sh lenta | Markazda ingichka oltin chiziqli illyustratsiya · "Hali hech narsa yo'q" · "Odamlarni kuzating" |
| 38 | Bo'sh buyurtmalar | "Buyurtmangiz yo'q" · "Karta buyurtma qilish" |
| 39 | Internet yo'q | Uzilgan ulanish illyustratsiyasi · "Internet yo'q" · "Qayta urinish" |
| 40 | Yuklanmoqda | Skeleton: kartalar va matn o'rnida kulrang to'rtburchaklar (shimmer) |
| 41 | Server xatosi | "Nimadir noto'g'ri ketdi" · xato kodi · "Qayta urinish" |
| 42 | Topilmadi | "Bunday ID topilmadi" · qidiruv maydoni · "Katalogga o'tish" |

---

# 5. QISM B — SAYT (nfcstore.uz)

Sayt ilovaning davomi. Shu rang, shu shrift, shu metall. Farqi: kengroq
ekran, ko'proq havo, matn ko'proq.

Har sahifa **ikki o'lchamda**: desktop `2880×1800` va mobil `1170×2532`.

| # | Sahifa | Ichida nima bo'lsin |
|---|---|---|
| 43 | Bosh sahifa | Qahramon bo'lim: metall karta + "Bir tegishda tanishing" + ID tekshirish maydoni. Pastda: qanday ishlaydi (3 qadam) · tariflar · jonli katalog · FAQ · footer |
| 44 | Qanday ishlaydi | 4 bosqich, har biri katta rasm va matn bilan |
| 45 | Tariflar | 3 ustun (Bronza · Kumush · Oltin), o'rtadagisi ko'tarilgan va "Ommabop" yorlig'i bilan |
| 46 | FAQ | Akkordeon ro'yxat, chapda mavzular navigatsiyasi |
| 47 | ID katalogi | Chapda filtr paneli, o'ngda kartalar gridi (ID + narx + holat) |
| 48 | Reyting | Eng ko'p ko'rilgan ID lar jadvali, 1-2-3 o'rin oltin/kumush/bronza bilan |
| 49 | Ommaviy profil | Karta tegizilganda ochiladi. Avatar · ism · kasb · "Kontaktni saqlash" katta tugma · aloqa tugmalari · ijtimoiy tarmoqlar · kontent |
| 50 | Shaxsiy kabinet | Chapda doimiy yon menyu, o'ngda: karta holati · statistika · tezkor amallar |
| 51 | Karta dizayneri | Chapda jonli karta ko'rinishi, o'ngda sozlamalar (fon · rang · matn joylashuvi) |
| 52 | Biznes sahifasi | Qopqoq rasmi · logo · ish vaqti · menyu/katalog · galereya · xarita |
| 53 | Yangiliklar | Maqolalar gridi, birinchisi katta |
| 54 | Aloqa | Forma + xarita + Telegram tugmasi |
| 55 | Qoidalar / Maxfiylik | Chapda bo'limlar navigatsiyasi, o'ngda matn |
| 56 | Admin paneli | Jadval ko'rinishi · filtr · qidiruv · amallar |

---

# 6. QISM C — BREND VA MAHSULOT

### C1 — Jismoniy kartalar
| # | Nima | Talab |
|---|---|---|
| 57 | Oltin karta | Haqiqiy metall karta · `((N)) NFCSTORE` gravyurasi · ID kodi lazerda · qora fonda studiya yorug'ligi |
| 58 | Kumush karta | Shu kompozitsiya, kumush metall |
| 59 | Bronza karta | Shu kompozitsiya, bronza metall |
| 60 | Black Edition | Qora anodlangan metall, oltin gravyura |
| 61 | Qadoq | Ochilayotgan quti, ichida karta, oltin bosma |
| 62 | Uch karta birga | Yelpig'ich shaklida, reklama uchun |

### C2 — Ilova va do'kon
| # | Nima | O'lcham |
|---|---|---|
| 63 | Ilova ikonkasi | 1024×1024 · `((N))` belgisi · qora-oltin |
| 64 | Play Store qopqog'i | 1024×500 |
| 65 | Do'kon skrinshotlari | 5 ta · 1170×2532 · har birida ekran + qisqa sarlavha |
| 66 | Ijtimoiy tarmoq qopqog'i | 1200×630 |

---

# 7. YUBORISHDAN OLDIN TEKSHIR

- [ ] Yangi ekranni 10 ta eski rasm yoniga qo'yib ko'rdimmi? Bir oilagami?
- [ ] Fon **#0A0908**, sarlavha **Instrument Serif**, interfeys **Manrope**
- [ ] Chekka bo'shliq **20 px**, ikkala tomonda teng
- [ ] Pastki navigatsiya oldingi ekranlardagidek **aynan bir xil**
- [ ] Matnlar o'zbekcha, to'liq, o'qiladi
- [ ] Rasm **1170×2532**, bitta ekran, ramkasiz
- [ ] **Ekran tugallangan** — bo'sh joy, chizilmagan element, kesilgan matn yo'q

## Qabul qilinmaydigan ishlar

| Xato | Nima uchun |
|---|---|
| Bitta rasmda 3 ta ekran | Aniqlik yo'qoladi |
| Telefon ramkasi yoki qo'l bilan | Piksel o'lchab bo'lmaydi |
| Inglizcha yoki "Lorem ipsum" matn | Kodga tushmaydi |
| Har ekranda boshqacha navigatsiya | Ilova yaxlit ko'rinmaydi |
| Uslub o'zgartirilgan, "yaxshilangan" | 10 ta eski ekran bilan mos kelmaydi |
| Yarim chizilgan, bo'sh joyli ekran | Dasturchi nima yozishni bilmaydi |

---

# 8. ISH TARTIBI

1. Biriktirilgan 10 ta rasmni ko'zdan kechir.
2. Tushunganingni **bir abzasda** tasdiqla.
3. **A1 to'plamidan** boshla — 6 ta ekran, har biri alohida rasm.
4. Men "keyingi to'plam" desam — navbatdagisiga o't.
5. Biror narsa noaniq bo'lsa — **o'ylab topma, so'ra**.

---

## Hozir boshla

**A1 to'plami** — onboarding ×3, kirish, ro'yxatdan o'tish, email
tasdiqlash. Har biri alohida rasm, 1170×2532.

Sen boshlagan uslubni davom ettir. Tugallanmagan ishni yuborma —
ulgurmasang, nechta tayyor bo'lsa shuncha yubor va "qolgan N tasi
keyingi xabarda" deb yozib qo'y.
