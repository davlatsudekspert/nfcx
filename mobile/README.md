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

Handoff'da bor, lekin ILOVADA YO'Q. Har biri backend imkoniyati
yetmagani uchun, soxta ekran yasashdan ko'ra ochiq aytilgani ma'qul:

| Ekran | Nima yetishmaydi |
|---|---|
| Activity tab | Birlashgan activity feed endpointi (yuqoriga qarang) |
| Post/Story yaratish | Rasm yuklash oqimi (`/api/upload`) ilovada yo'q |
| Post yoqtirish | `/api/records/:code/like` — bu PROFIL layki, post emas |
| Karta bosma maketi | Sayt kartani 600 DPI PNG qilib chizadi; ilovada chizma dvigateli kerak |
| Biznes profilini tahrirlash | Katalog, ish vaqti va manzil uchun alohida oqim |

Bu tugmalar ilovada **o'chirilgan holatda** ko'rinadi — bosilganda jim
turmaydi. `onTap: null` bo'lgan har bir joyda sabab izohda yozilgan.

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

```bash
keytool -list -v -keystore upload-keystore.jks -alias upload | grep SHA256
npx wrangler secret put ANDROID_APP_FINGERPRINTS
```

Sozlanmaguncha fayl 404 qaytaradi va havolalar avvalgidek brauzerda
ochiladi — hech narsa buzilmaydi (`scripts/test-assetlinks.mjs`).

## To'lov

Payme/Click oqimiga **tegilmagan**. Ilova:

1. band qilish so'rovini yuboradi — server `pending` buyurtma va
   `payLink` qaytaradi;
2. to'lov sahifasini tashqi ilovada ochadi;
3. buyurtma holatini **serverdan** so'rab turadi.

Ilova to'lov muvaffaqiyatli bo'lganini **hech qachon o'zi
belgilamaydi** — yagona haqiqat manbai provayder tasdig'i va backend.
