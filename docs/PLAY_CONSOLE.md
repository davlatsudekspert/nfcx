# PLAY CONSOLE — NFCSTORE (uz.nfcstore.nova)

Bu faylda Play Console'ga KO'CHIRIB QO'YISH uchun tayyor
matnlar va javoblar bor. Hammasi ilovaning HAQIQIY kodidan
tekshirilgan — taxmin yo'q. Qayerdan tekshirilgani har
bo'limda yozilgan.

---

## 1. ASOSIY MA'LUMOT

| Maydon | Qiymat |
|---|---|
| Ilova nomi (`android:label`) | `NFCSTORE` |
| Paket (`applicationId`) | `uz.nfcstore.nova` |
| Kategoriya | Ijtimoiy (Social) |
| Maxfiylik siyosati | `https://nfcstore.uz/maxfiylik` — **ilovada ham havola bor**: Sozlamalar → Ilova haqida |
| Foydalanish shartlari | `https://nfcstore.uz/shartlar` — ilovada ham havola bor |
| Sayt | `https://nfcstore.uz` |
| Aloqa email | Play Console'ga O'ZINGIZ kiritasiz |

`android:label` — `android/app/src/main/AndroidManifest.xml:19`.

---

## 2. DO'KON SAHIFASI MATNLARI

### 2.1 O'ZBEKCHA (asosiy til)

**Ilova nomi** (30 belgigacha) — 25 belgi:

```
NFCSTORE: Raqamli vizitka
```

> Nom **NFCSTORE** bilan boshlanadi — brend birinchi so'z.
> Qolgani qidiruv uchun: Play'da alohida kalit so'z maydoni
> yo'q, qidiruv aynan sarlavha va tavsifdagi so'zlarga qaraydi.
> Ilovaning telefondagi nomi esa sof `NFCSTORE`
> (`AndroidManifest.xml` dagi `android:label`).
>
> NEGA SARLAVHADA "LENTA" YOKI "REELS" YO'Q. Ular sarlavhaga
> sig'adi (`NFCSTORE: Vizitka va lenta` — 26 belgi), lekin
> qidiruvda foyda bermaydi: "reels" yoki "lenta" deb qidirgan
> odam Instagram'ni izlayapti va o'sha yerga boradi. Sarlavha
> bizni boshqalardan AJRATADIGAN so'zni ko'tarishi kerak, umumiy
> so'zni emas. Ijtimoiy tomon qisqa tavsifga qo'yildi.
>
> Sarlavhani keyin O'ZGARTIRISH MUMKIN (standart tildan farqli
> o'laroq), shuning uchun bu qaytarib bo'lmaydigan qaror emas.

**Qisqa tavsif** (80 belgigacha) — 61 belgi:

```
Bitta tegishda ulashing: NFC vizitka, profil, lenta va Reels.
```

> Oldingi variant (`Bitta tegish bilan o'zingizni, ishingizni va
> do'koningizni ulashing`) ALMASHTIRILDI. Egasi uch marta bir
> narsani aytdi: do'kon sahifasida ilovaning ijtimoiy tomoni
> ko'rinmaydi.
>
> Haq edi. Sarlavhada "vizitka", qisqa tavsifda ham faqat
> ulashish turardi — odam ilovani tor yordamchi dastur deb
> tushunardi, holbuki ichida lenta, istorya, Reels va Tanlov bor.
>
> Qisqa tavsif sarlavhadan keyingi ENG OG'IR qator: u
> sarlavhadan keyin darhol o'qiladi VA Play qidiruvida
> indekslanadi. Shuning uchun ijtimoiy so'zlar aynan shu yerga
> qo'yildi.
>
> `NFC` ham alohida so'z sifatida shu yerda turadi: qidiruv
> `NFCSTORE` ichidagi `NFC` ni alohida so'z deb tanimaydi.

**To'liq tavsif** (4000 belgigacha):

```
NFCSTORE — qog'oz vizitkaning o'rnini bosadigan raqamli shaxs.

Telefoningizni NFC kartaga tegizasiz — qarshingizdagi odamda
sizning to'liq profilingiz ochiladi: ismingiz, kasbingiz, aloqa
raqamlaringiz, ijtimoiy tarmoqlaringiz, portfolioingiz va
do'koningiz. Ilova ham, karta ham kerak emas — u odam shunchaki
havolani ochadi.

NIMA QILA OLASIZ

• NFC ID — sizga tegishli qisqa kod (masalan VIP001). U sizning
  doimiy manzilingiz: nfcstore.uz/VIP001
• NFC kartaga yozish — boshqa joydan olingan qayta yoziladigan
  kartani o'z profilingizga aylantirasiz
• QR kod — NFC bo'lmagan telefonda ham profilingiz ochiladi
• Profil — avatar, muqova, bio, aloqa tugmalari, havolalar
• Postlar va istoryalar — rasm va video bilan
• Obuna bo'lish, layk, izoh va izohga javob
• Biznes profili — katalog, narxlar, buyurtma qabul qilish
• Tanlov — odamlar va bizneslarni topish
• Mavzular — oltin premium, oq-qora va boshqalar
• Ilova qulfi — PIN yoki barmoq izi

OFFLINE ISHLAYDI
Profilingizni ko'rsatish uchun internet shart emas: karta
tegizilganda havola ochiladi.

MAXFIYLIK
Profilingizni Tanlov ro'yxatidan yashirishingiz mumkin.
Kerak bo'lsa hisobingizni ilovaning o'zidan butunlay
o'chirasiz: Sozlamalar → Hisobni o'chirish.

Savol va takliflar: nfcstore.uz
```

### 2.2 RUSCHA

**Ilova nomi** — 29 belgi:

```
NFCSTORE: Электронная визитка
```

**Qisqa tavsif** — 59 belgi:

```
Одно касание: NFC-визитка, профиль, лента, истории и Reels.
```

**To'liq tavsif**:

```
NFCSTORE — цифровая личность вместо бумажной визитки.

Вы подносите телефон к NFC-карте — у собеседника открывается
ваш полный профиль: имя, профессия, контакты, соцсети,
портфолио и магазин. Ему не нужны ни приложение, ни карта —
просто открывается ссылка.

ЧТО МОЖНО ДЕЛАТЬ

• NFC ID — ваш короткий код (например VIP001). Это ваш
  постоянный адрес: nfcstore.uz/VIP001
• Запись на NFC-карту — превратите перезаписываемую карту,
  купленную где угодно, в свой профиль
• QR-код — профиль откроется и на телефоне без NFC
• Профиль — аватар, обложка, био, кнопки связи, ссылки
• Посты и истории — с фото и видео
• Подписки, лайки, комментарии и ответы на них
• Бизнес-профиль — каталог, цены, приём заказов
• Обзор — поиск людей и компаний
• Темы оформления — золотая премиум, чёрно-белая и другие
• Блокировка приложения — PIN или отпечаток пальца

РАБОТАЕТ БЕЗ ИНТЕРНЕТА
Чтобы показать профиль, интернет не нужен: при касании
карты открывается ссылка.

КОНФИДЕНЦИАЛЬНОСТЬ
Профиль можно скрыть из списка «Обзор». При необходимости
аккаунт удаляется прямо в приложении: Настройки → Удалить
аккаунт.

Вопросы и предложения: nfcstore.uz
```

### 2.3 INGLIZCHA

**Ilova nomi** — 27 belgi:

```
NFCSTORE: NFC Business Card
```

**Qisqa tavsif** — 61 belgi:

```
One tap to share: NFC card, profile, feed, stories and Reels.
```

**To'liq tavsif**:

```
NFCSTORE is a digital identity that replaces the paper
business card.

Tap your phone on an NFC card and the person in front of you
opens your full profile: your name, your role, your contact
details, your social links, your portfolio and your store.
They need neither the app nor a card — a link simply opens.

WHAT YOU CAN DO

• NFC ID — your own short code (for example VIP001). It is
  your permanent address: nfcstore.uz/VIP001
• Write to an NFC card — turn a rewritable card bought
  anywhere into your own profile
• QR code — your profile opens on phones without NFC too
• Profile — avatar, cover, bio, contact buttons, links
• Posts and stories — with photos and video
• Follow, like, comment and reply to comments
• Business profile — catalogue, prices, order requests
• Discover — find people and businesses
• Themes — gold premium, black and white, and more
• App lock — PIN or fingerprint

WORKS OFFLINE
You do not need a connection to show your profile: tapping
the card opens the link.

PRIVACY
You can hide your profile from the Discover list. If you
want, you can delete your account from inside the app:
Settings → Delete account.

Questions and feedback: nfcstore.uz
```

---

## 3. DATA SAFETY (Ma'lumotlar xavfsizligi)

Bu bo'lim ilova kodidan tekshirildi. `pubspec.yaml` da
analitika, reklama va crash-reporting kutubxonasi UMUMAN
YO'Q (Firebase yo'q, AdMob yo'q, Crashlytics yo'q) —
shuning uchun ko'p savolga "yo'q" javob beriladi.

### 3.1 Umumiy savollar

| Savol | Javob |
|---|---|
| Ma'lumot yig'asizmi yoki ulashasizmi? | **Ha, yig'amiz** |
| Uchinchi tomon bilan ULASHASIZMI? | **Yo'q** |
| Uzatishda shifrlanadimi? | **Ha** (hammasi HTTPS) |
| Foydalanuvchi o'chirishni so'ray oladimi? | **Ha** (Sozlamalar → Hisobni o'chirish) |
| Play Families dasturidami? | **Yo'q** |

### 3.2 Qaysi ma'lumot yig'iladi

| Turi | Yig'iladimi | Maqsad | Majburiymi |
|---|---|---|---|
| Email manzil | Ha | Hisob boshqaruvi | Majburiy |
| Telefon raqam | Ha | Hisob boshqaruvi, aloqa | Majburiy |
| Ism | Ha | Hisob va profil | Majburiy |
| Foto va video | Ha | Foydalanuvchi kontenti (avatar, muqova, postlar) | Ixtiyoriy |
| Boshqa fayllar (audio) | Ha | Profilga musiqa qo'shish | Ixtiyoriy |
| Boshqa kontent (post, izoh) | Ha | Ilova funksiyasi | Ixtiyoriy |

### 3.3 Qaysi ma'lumot YIG'ILMAYDI

Bularning hammasiga **YO'Q** deb javob bering:

* Joylashuv (aniq ham, taxminiy ham) — `AndroidManifest.xml` da
  joylashuv ruxsati UMUMAN yo'q
* Kontaktlar ro'yxati
* Kalendar
* SMS, qo'ng'iroqlar tarixi
* Sog'liq va fitnes
* Moliyaviy ma'lumot — **to'lov kartasi ilovaga kiritilmaydi**,
  to'lov Payme/Click sahifasida bo'ladi
* Qidiruv tarixi
* Reklama identifikatori
* Ilovadagi xatoliklar / diagnostika (crash-reporting yo'q)

### 3.4 Foydalanuvchi nazorati — Play shuni so'raydi

| Imkoniyat | Ilovada qayerda | Kodda |
|---|---|---|
| Hisobni o'chirish | Sozlamalar → Hisobni o'chirish | `settings_subscreens.dart` |
| Profilni ro'yxatdan yashirish | Sozlamalar → Maxfiylik → "Profil ommaviy" | `settings_subscreens.dart` |
| Shikoyat qilish | Post/profil menyusi | `social/moderation.dart` |
| Foydalanuvchini bloklash | Profil menyusi | `social/moderation.dart` |
| Maxfiylik siyosati | Sozlamalar → Ilova haqida | `legal_links_test.dart` qo'riqlaydi |
| Ilova qulfi (PIN / barmoq izi) | Sozlamalar → Xavfsizlik | App Lock |

Bularning barchasi Play'ning foydalanuvchi kontenti bor
ilovalarga qo'yadigan talablari. Hammasi mavjud.

### 3.5 Ruxsatlar

`AndroidManifest.xml` da atigi ikkita:

```
android.permission.INTERNET
android.permission.NFC
```

NFC `required="false"` — ya'ni NFC'siz telefonlar ham
ilovani o'rnata oladi (ular QR kod bilan ishlaydi).

---

## 4. CONTENT RATING (Yosh reytingi)

Ilovada FOYDALANUVCHI KONTENTI bor (post, istorya, izoh),
shuning uchun Play qo'shimcha savollar beradi.

| Savol | Javob | Dalil |
|---|---|---|
| Foydalanuvchilar kontent yaratadimi? | **Ha** | postlar, istoryalar, izohlar |
| Kontent boshqalarga ko'rinadimi? | **Ha** | Tanlov va profil sahifalari |
| Shikoyat qilish imkoni bormi? | **Ha** | `lib/features/social/moderation.dart` |
| Bloklash imkoni bormi? | **Ha** | o'sha faylda, profil bo'yicha |
| Moderatsiya bormi? | **Ha** | admin panelida izoh moderatsiyasi |
| Zo'ravonlik, jinsiy kontent, giyohvandlik | **Yo'q** | |
| Qimor | **Yo'q** | |
| Joylashuv ulashiladimi? | **Yo'q** | joylashuv ruxsati yo'q |

Kutilayotgan natija: **3+ yoki Teen** (Play o'zi hisoblaydi;
ijtimoiy tarmoqlarda odatda Teen chiqadi).

---

## 5. TO'LOVLAR

### Hozirgi holat — ILOVADA TO'LOV YO'Q

| Nima | Ilovada | Sabab |
|---|---|---|
| NFC ID (raqamli) | To'lov yo'q, "saytda" yozuvi | Raqamli mahsulot — Play Billing talab qilinadi |
| Premium obuna | To'lov yo'q, "saytda" yozuvi | Raqamli mahsulot |
| Postni ko'tarish | To'lov yo'q, narx ko'rinadi | Raqamli mahsulot |
| **Jismoniy NFC karta** | **To'lov yo'q, "saytda" yozuvi** | **Qoidadan ozod, lekin KOD tayyor emas edi** |

Kodda: `lib/features/shop/store_policy.dart` — `canPayInApp()`
hozircha hamma tur uchun `false`.

### Nega jismoniy karta ham olib tashlandi

Jismoniy tovar Play Billing qoidasidan **ozod** — bu o'zgargani
yo'q. Lekin ilovadagi xarid **uch joyda uzilgan** edi:

1. Ilova buyurtma **yaratmasdi** — mavjud ro'yxatdan birinchisini
   olardi. Yangi mijozda xato, eskisida esa boshqa buyurtma uchun
   to'lov.
2. Serverda `/api/records/:code/order-physical-card` **yo'q**.
3. Server `physical_card_order` ni **yakunlay olmaydi** —
   buyurtma `pending` da qoladi.

Ya'ni tugma bosilsa xato chiqardi. Play uchun bu anti-steering'dan
og'irroq sabab: *"ilova tavsifda aytilganidek ishlamaydi"*.

Uchala uzilish tuzatilgandan keyin `canPayInApp()` ga jismoniy
karta qaytariladi.

### Play Console'da

"Bu ilova raqamli xarid taklif qiladimi?" → **Yo'q**

Ilovada umuman to'lov yo'q, shuning uchun bu savol endi bahssiz.

### Qolgan xavf — kichik, lekin bor

"Xarid saytda rasmiylashtiriladi: nfcstore.uz" degan **bosilmaydigan**
yozuv qoladi. Anti-steering bo'yicha xavfi nolga teng emas.

Rad etish kelsa: `store_policy.dart` dagi `kShowSiteNotice` ni
`false` qiling va qayta yig'ing — bir daqiqalik ish, besh ekranni
kovlash shart emas.

### Do'kon tavsifida Payme/Click YOZILMASIN

Ularni sanash hech narsa bermaydi, lekin tekshiruvchining
diqqatini to'lov masalasiga qaratadi.

## 6. GRAFIKA

| Nima | Talab | Holat |
|---|---|---|
| Ekran suratlari (telefon) | kamida 2 ta, nisbat 2:1 dan oshmasin | **5 ta tayyor**, 1080×1920 (1.78) |
| Ilova belgisi | 512×512 PNG | **tayyor**: `docs/play-assets/play-icon-512.png` |
| Feature graphic | 1024×500 PNG/JPG | **tayyor**: `docs/play-assets/play-feature-1024x500.png` |

Belgi va feature graphic `docs/play-assets/build.py` bilan
qayta yasaladi; nega alohida belgi kerak bo'lgani va matn nega
aynan shunday — `docs/play-assets/README.md` da.

Ekran suratlari `mobile_nova/test/shots/png/play-*.png` da.
Qayta qurish:

```
cd mobile_nova
flutter test test/shots/play_store_shot.dart \
  --run-skipped -t shots --update-goldens
```

**NISBAT HAQIDA.** Play skrinshot uchun maksimum 2:1 ga ruxsat
beradi. Telefondan olingan 1080×2340 surat 2.17 bo'ladi va
YUKLANMAYDI. Shuning uchun 16:9 (1080×1920) tanlangan.

---

## 6.1 IMZO KALITI

`uz.nfcstore.nova` uchun alohida release kaliti yasaldi va CI ga
uchta secret orqali ulandi: `NOVA_KEYSTORE_BASE64`,
`NOVA_KEYSTORE_PASSWORD`, `NOVA_KEY_ALIAS`.

    SHA-256: 6F:79:CC:DA:FD:E4:04:CF:BA:29:96:4D:8C:CB:11:0C:
             0A:49:E0:D4:B9:8E:95:64:0A:68:50:02:68:B0:A9:3C
    Alias:   nova
    Amal qiladi: 2054 yilgacha

Qurilish #129 da tasdiqlandi: `SIGNING: RELEASE`. Undan oldingi
AAB'lar DEBUG kaliti bilan imzolangan va Play ularni qabul
qilmagan bo'lardi.

**`nova.jks` fayli repozitoriyada YO'Q va bo'lmasligi kerak.**
U yo'qolsa Play Store'dagi ilovani boshqa yangilab bo'lmaydi —
faqat yangi paket nomi bilan noldan boshlash qoladi. Egasida
zaxira nusxasi bo'lishi shart.

Yuqoridagi SHA-256 maxfiy emas: u App Links (`assetlinks.json`)
uchun ham kerak bo'ladi.

---

## 7. 12 TESTER — ALOHIDA HUJJAT

Yopiq sinov, testerlarni yig'ish, ularga yuboriladigan matn va
Google so'raydigan savollar: **`docs/PLAY_TESTERLAR.md`**.

**AKKAUNT TURI HAL QILINDI: `Для себя` (Individual).**

Ya'ni **12 tester × 14 kun KERAK**. Organization yo'li ko'rib
chiqildi va rad etildi: u D-U-N-S raqamini talab qiladi, D&B esa
YaTT ga uni odatda bermaydi. Kutish vaqti bir xil chiqadi, lekin
rad javobi xavfi qo'shiladi.

* **Internal testing 14 kunlik hisobga KIRMAYDI.** Soat faqat
  **Closed testing** da yuradi.
* Soat email yig'ilganda emas, tester Play Store'dan
  **o'rnatganda** boshlanadi.

## 8. QAYSI YO'LDAN BOSHLASH

**Internal testing** dan boshlashni tavsiya qilaman,
to'g'ridan-to'g'ri Production'dan emas.

Sabab: Production'ga chiqarilgan ilova hammaga ko'rinadi va
yomon sharh yozilsa u O'CHMAYDI. Internal testing esa
bir necha daqiqada tasdiqlanadi, 100 tagacha odamni
qo'shasiz va xatolar mijozgacha yetib bormaydi.

---

## 9. APP ACCESS — TEKSHIRUVCHI ILOVAGA QANDAY KIRADI

**Bu bo'lim to'ldirilmasa ilova RAD ETILADI.** Eng ko'p
uchraydigan rad sabablaridan biri aynan shu.

NFCSTORE ochilganda kirish so'raydi. Kira olmagan tekshiruvchi
ilovani "ishlamaydi" deb belgilaydi.

Yechim: Play Console'da **tayyor hisob** beriladi.

> **TUZATISH (2026-09-22).** Bu yerda avval "ro'yxatdan o'tish
> Telegram bot tasdiqlagan telefonni talab qiladi" deb yozilgan
> edi. NOTO'G'RI. `hosting/api/auth.js` dagi `register()` da
> shart `emailEnabledD1(env)` ga qarab bo'linadi:
>
> * email yoqilgan bo'lsa (production'da AYNAN shunday —
>   `RESEND_API_KEY` va `RESEND_FROM` jonli Workerda bor)
>   ro'yxatdan o'tish **email kodi** bilan ketadi, Telegram
>   umuman ishlatilmaydi;
> * Telegram faqat email O'CHIQ bo'lganda zaxira yo'l bo'ladi.
>
> Ya'ni tekshiruvchi texnik jihatdan o'zi ham ro'yxatdan o'ta
> oladi. Tayyor hisob berish BARIBIR to'g'ri qaror — tekshiruvchi
> ro'yxatdan o'tish bilan ovora bo'lmasligi, birinchi ekrandanoq
> to'ldirilgan profilni ko'rishi kerak — lekin sabab boshqa va
> hujjat rost gapirishi shart.

### Qayerda

Play Console → **Policy and programs → App content →
App access** → `All or some functionality is restricted`
→ `Add new instructions`.

Uchta maydon to'ldiriladi:

| Maydon | Nima yoziladi |
|---|---|
| Name | `Email va parol bilan kirish` |
| Username | demo hisobning **email**i |
| Password | o'sha hisobning **paroli** |

Qo'shimcha izohga (`Any other instructions`) shuni yozing:

```
Sign in with the email and password above.
Please use these credentials rather than creating a new account,
so you see a profile with real content (NFC ID, posts, stories)
instead of an empty one.
```

### Demo hisobni KIM yaratadi

**Egasi yaratadi** — hisob NFC ID biriktirilgan va kontenti
to'ldirilgan bo'lishi kerak, buni faqat egasi qila oladi.

Hisob quyidagicha bo'lsin:

* **Alohida** hisob bo'lsin — o'zingizning asosiy hisobingiz
  emas. Tekshiruvchi uning ichida harakat qiladi.
* **NFC ID biriktirilgan** bo'lsin — aks holda tekshiruvchi
  ilovaning asosiy funksiyasini ko'rmaydi va "kontent yo'q"
  deb belgilashi mumkin.
* Profilda **ism, rasm, bir nechta post** bo'lsin. Bo'sh hisob
  yomon taassurot qoldiradi.
* Paroli **boshqa hech qayerda ishlatilmasin**.
* **O'CHIRILMASIN.** Har yangilanishda tekshiruvchi shu hisob
  bilan kiradi.

### Parol qayerga yoziladi

**FAQAT Play Console'ning shu formasiga.**

Parolni bu hujjatga, repozitoriyaga, commit xabariga, test
faylga yoki suhbatga YOZMANG. Repozitoriya ochiq va u yerga
tushgan parol keyin butunlay o'chmaydi.

### Bog'liq havolalar — ikkalasi ham ishlaydi

    Maxfiylik siyosati:  https://nfcstore.uz/maxfiylik
    Foydalanish shartlari: https://nfcstore.uz/shartlar

Maxfiylik siyosati havolasi Play Console'da **majburiy**
maydon (`Store listing → Privacy policy`).
