# NFCSTORE — mobil ilova (Flutter)

Handoff dizayni bo'yicha 0 dan qurilgan Android/iOS ilovasi. Barcha
ma'lumot **mavjud nfcstore.uz backend'idan** keladi — ilova uchun
alohida baza yo'q. Saytda ism, rasm, narx yoki buyurtma holati
o'zgarsa, ilova keyingi so'rovda yangisini ko'radi.

## Ishga tushirish

```bash
flutter pub get
flutter run            # qurilma yoki emulyatorda
flutter analyze        # kod tekshiruvi
flutter test           # testlar
flutter build apk --release
```

APK yo'li: `build/app/outputs/flutter-apk/app-release.apk`

**Talab:** Flutter 3.47+ va Android SDK (platform 36, build-tools 36).
Android SDK `dl.google.com` dan keladi — u yopiq tarmoqda bloklangan
bo'lsa, APK qurib bo'lmaydi (kod va testlar baribir ishlaydi).

## Lokal server bilan sinash

Ilovani jonli `nfcstore.uz` ga ulamasdan, production'dagi AYNAN
o'sha worker kodiga qarshi ishlatish mumkin:

```bash
node ../scripts/dev-api-server.mjs        # http://127.0.0.1:8787
flutter run --dart-define=API_BASE=http://10.0.2.2:8787   # emulyator
```

Server `hosting/worker.js` ni Node ostida ko'taradi (D1 o'rniga
xotiradagi SQLite, haqiqiy sxema bilan) va demo ma'lumot bilan
to'ldiradi: `dilshod@nfcstore.uz` / `demo1234`, profillar VIP001,
ABC123, DDD333 va `LATTE` kompaniyasi.

**Uchma-uch test** — ilovaning `Api` + `Repo` qatlami haqiqiy HTTP
orqali o'sha server bilan gaplashadi:

```bash
node ../scripts/test-live-app.mjs
```

Bu testlar soxta javoblarga TAYANMAYDI, ya'ni server javobining
shakli o'zgarsa darhol qizaradi. `API_BASE` berilmasa
`test/live_api_test.dart` o'tkazib yuboriladi.

## Tuzilishi

```
lib/
  design/            dizayn tizimi — ekran kodi bu yerdan tashqarida
    tokens.dart      rang, masofa, radius, soya, harakat
    type.dart        shriftlar va matn uslublari, som()/compact()
    theme.dart       Material mavzusi (faqat tizim komponentlari uchun)
    nav.dart         ekran o'tishi (24px siljish + xiralik, 280ms)
    components/      tugma, input, chip, karta, sheet, skeleton,
                     holatlar, ikonkalar, nav panel, metall ID karta,
                     story halqasi
  data/
    api_client.dart  HTTP, Bearer sessiya, xato tarjimasi
    models.dart      backend JSON -> obyekt (null'ga chidamli)
    repo.dart        endpoint'lar — YAGONA joy
  state/
    app_state.dart   FAOL SHAXS — ilovaning ildiz holati
  screens/           ekranlar, oqim bo'yicha papkalarda
```

### Ikkita asosiy qaror

**1. Sessiya — `Authorization: Bearer`, cookie emas.** Backend buni
allaqachon qo'llab-quvvatlaydi. Mobil cookie jar platformalar orasida
turlicha ishlaydi va ilova fondan qaytganda yo'qolishi mumkin; token
esa Keystore/Keychain da ishonchli turadi.

**2. Faol shaxs — ildiz holat.** Bitta hisobda bir nechta shaxs
bo'ladi (shaxsiy NFC ID'lar va biznes profillar). Shaxs almashtirilsa
Home, NFC va Profile qayta chiziladi; chiqib qayta kirish talab
qilinmaydi.

## Handoff qoidalari

Quyidagilar **`test/rules_test.dart`** da manba kodi bo'yicha
tekshiriladi — kelajakda tasodifan buzib qo'yilmasin:

- auksion yo'q;
- ichki messenjer yo'q (bog'lanish tashqi ilovalar orqali);
- SMS tasdiqlash yo'q (hisob — email, profil — Telegram bot);
- tasdiqlangan nishon kodda qattiq yozilmagan — holat serverdan;
- dizayn maketidagi soxta ma'lumot production kodida yo'q;
- narx jadvali mijozda yozilmagan — narx serverdan;
- backend manzili bitta joyda.

## Navigatsiya — 4 tab

`HOME · DISCOVER · NFC · PROFILE`

Handoff 5 tabni (Activity bilan) ko'rsatadi, lekin shart qo'yadi:
Activity faqat **real backend ma'lumoti bo'lsa** ishlatiladi.
Repository auditida birlashgan activity oqimi (obuna + like + ko'rish
+ buyurtma + to'lov, vaqt bo'yicha) uchun endpoint topilmadi —
bo'laklar bor, feed yo'q.

> **MISSING BACKEND CAPABILITY:** `GET /api/activity`
>
> Eng kichik mos qo'shimcha: faol shaxs uchun vaqt bo'yicha
> tartiblangan hodisalar ro'yxati — `{type, actorName, actorAvatar,
> targetCode, amount, createdAt}`. Manba jadvallar allaqachon bor:
> `follows`, `card_likes`, `card_events`, `web_orders`,
> `company_orders`, `transactions`.
>
> U qo'shilgach: `NavBar.tabs` ga bitta qator va `Shell` ga bitta
> ekran qo'shiladi — boshqa hech narsa o'zgarmaydi.

## Qo'shilmagan narsalar — va nima uchun

Har biri backend imkoniyati yetmagani uchun. Soxta ekran yasashdan
ko'ra ochiq aytilgani ma'qul:

| Ekran | Nima yetishmaydi |
|---|---|
| Activity tab | Birlashgan activity feed endpointi yo'q (`GET /api/activity`) |
| Push bildirishnoma | Serverda FCM qatlami yo'q |
| Ikki tillilik | Ilovada `intl` qatlami yo'q — hozircha faqat o'zbekcha |
| Karta bosma maketi | Sayt kartani 600 DPI PNG qilib chizadi; ilovada chizma dvigateli kerak |
| Ish vaqti, katalog, galereya, o'z domeni | Biznes tahririda yo'q — saytdan sozlanadi |

Bu tugmalar ilovada **ko'rsatilmaydi** yoki o'chirilgan holatda
ko'rinadi. `onTap: null` bo'lgan har bir joyda sabab izohda yozilgan.

### Prioritet bo'yicha qolganlar

| Daraja | Narsa | Endpoint |
|---|---|---|
| P1 | To'lovlar tarixi | `GET /api/payments` |
| P1 | Qo'llab-quvvatlash | `/api/support` |
| P1 | Premium so'rovi | `/api/premium/request` |
| P2 | Telefon raqamini o'zgartirish | `/api/settings/request-phone-change-code` |
| P2 | Referal | `/api/referrals` |
| P2 | Yangiliklar | `/api/news` |

## Dizayn qarorlari

### Tariflar — MATERIAL farqi, rang mavzusi emas

Har tarifning o'z yuzasi, qirrasi, urg'usi va yaltirash kuchi bor
(`TierStyle`). Ekranning qolgan rangi **tegilmaydi**:

| Tarif | Material |
|---|---|
| Bronze | issiq, mat, cho'tkalangan metall — yaltirash eng zaif |
| Silver | sovuq platina, eng toza aks ettirish |
| Gold | issiq champagne, nozik metall yorqinligi |
| Premium | platina + tiyilgan urg'u, **ikki qavatli qirra** |
| Exclusive | deyarli qora yuza, oltin qirra — eng kam effekt |

Premium Silver'dan **rangi bilan emas, ishlovi bilan** ajraladi.
Birinchi urinishda u lavanda tusga ketgan va "o'yinchoq" ko'rinardi.

### Ekran imzosi — nurning qayerdan tushishi

Sarlavhani yopib qo'yganda ham bo'limni ajratish uchun
(`ScreenAura`, kuchi 5–8%):

| Ekran | Nur | Ierarxiya |
|---|---|---|
| Home | chap yuqoridan, issiq | salomlashuv + karta + tezkor amallar |
| Discover | tepadan, sovuq, eng zaif | **qidiruv maydoni bosh element** |
| NFC | o'ng yuqoridan, platina | serif sarlavha + so'nuvchi qirra chizig'i |
| Settings | nur yo'q | bitta yuzada ro'yxat, eng sokin bo'lim |

### Bo'sh holatlar

Chizilgan belgi + sarlavha + foydali izoh + (**faqat egada**) bitta
amal. Mehmonga CTA berilmaydi: begona profildagi "Post qo'shing" —
bajarib bo'lmaydigan taklif. Rasm ishlatilmaydi.

## NFC va App Links

Ilova NFC moduli bilan ishlaydi (`lib/data/nfc.dart`):

| Amal | Qayerda | Nima qiladi |
|---|---|---|
| Kartani o'qish | NFC → «Kartani o'qish» | Tegdan `https://nfcstore.uz/<kod>` o'qiladi, profil ochiladi va `/api/tap/:code` serverga yoziladi |
| Kartaga yozish | NFC → «Kartaga yozish» | FAQAT o'z ID havolasini yozadi — ixtiyoriy matn yozish imkoni yo'q |
| Kartani tegizish (ilova yopiq) | Tizim | Android App Links ilovani ochadi va o'sha profilga o'tadi |

**Xavfsizlik qoidalari:**

- Faqat `nfcstore.uz` (va `*.nfcstore.uz`) havolalari qabul qilinadi.
  Qoida BITTA joyda — `NfcLink.parse()`; NFC ham, App Links ham
  o'shandan o'tadi (`test/nfc_link_test.dart`).
- Saytning o'z bo'limlari (`/api`, `/admin`, `/login`, `/pay` …) ID
  kodi deb o'qilmaydi.
- Havola **qulf ustidan o'tib ketmaydi**: PIN yopiq bo'lsa, havola
  saqlanadi va qulf ochilgandan keyin ochiladi
  (`test/deep_link_test.dart`).

**App Links ishlashi uchun SERVERDA sozlash kerak:**

Worker `https://nfcstore.uz/.well-known/assetlinks.json` ni
`ANDROID_APP_FINGERPRINTS` env'idan beradi — bu APK'ni imzolagan
sertifikatning SHA-256 barmoq izi (vergul bilan bir nechta bo'lishi
mumkin: yuklash kaliti + Play App Signing kaliti).

Barmoq izini qo'lda qidirish shart emas: uni har qurilish o'zi
chiqaradi (Actions → qurilish xulosasi, va `apk-latest` reliz
izohi). Keyin:

```bash
npx wrangler secret put ANDROID_APP_FINGERPRINTS --name nfcstore-api
```

Sozlanmaguncha fayl 404 qaytaradi va havolalar avvalgidek brauzerda
ochiladi — hech narsa buzilmaydi (`scripts/test-assetlinks.mjs`).

Mosligini **Actions → «App Links tekshiruvi»** tekshiradi: oxirgi
APK ning sertifikatini serverdagi fayl bilan solishtiradi (haftada
bir marta o'zi ham ishlaydi).

To'liq reliz tartibi — [RELEASE.md](RELEASE.md).

## To'lov

Payme/Click oqimiga **tegilmagan**. Ilova:

1. band qilish so'rovini yuboradi — server `pending` buyurtma va
   `payLink` qaytaradi;
2. to'lov sahifasini tashqi ilovada ochadi;
3. buyurtma holatini **serverdan** so'rab turadi.

Ilova to'lov muvaffaqiyatli bo'lganini **hech qachon o'zi
belgilamaydi** — yagona haqiqat manbai provayder tasdig'i va backend.

## Sifat darvozasi

`test/audit/` — 61 ta golden kadr. Ular ikki savolga javob beradi:

1. **Chiroylimi?** — 01–37, 44–56: har ekran to'ldirilgan holatda,
   to'rt mavzu, uch til, biznes tahririning yangi bo'limlari.
2. **Buzilmaydimi?** — 38–43 va 53: yangi foydalanuvchi (hisob bor,
   hech narsa yo'q), tarmoq yo'q, server xatosi, bo'sh galereya.

Ikkinchi guruh bo'lmasa auditning ma'nosi yarim: odam bu holatlarni
ilovaning birinchi kunidayoq ko'radi. U darhol haqiqiy xato topdi —
shaxsi yo'q foydalanuvchida bosh ekran umuman yuklanmasdi.

```bash
flutter test                       # hammasi
flutter test --update-goldens test/audit   # kadrlarni yangilash
```

Kadr o'zgarsa test yiqiladi va farq `test/audit/failures/` ga
yoziladi. **Kadrni ko'rmasdan yangilamang** — golden testning butun
ma'nosi o'zgarishni KO'RISHDA.
