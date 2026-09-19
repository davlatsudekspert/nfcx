# NFCSTORE Nova

Yangi avlod NFCSTORE mobil ilovasi. **Alohida Flutter loyihasi** —
mavjud `mobile/` ilovasiga tegilmagan.

| | |
|---|---|
| **Paket nomi** | `uz.nfcstore.nova` |
| **Ekranda ko‘rinadi** | NFCSTORE Nova |
| **Versiya** | 1.0.0+1 |
| **Flutter** | 3.35.5 (stable) |
| **Backend** | `https://nfcstore.uz` |
| **Eski ilova** | `uz.nfcstore.app` — **o‘zgartirilmagan** |

Paket nomlari boshqa-boshqa, shuning uchun **ikkala ilova bitta
telefonda yonma-yon turadi** va Nova eski ilovaning yangilanishi
sifatida qabul qilinmaydi.

---

## Ishga tushirish

```bash
cd mobile_nova
flutter pub get
flutter run
```

Boshqa serverga ulanish:

```bash
flutter run --dart-define=NOVA_API_BASE=https://staging.nfcstore.uz
```

## Qurish

```bash
# Universal APK — har qanday qurilmaga
flutter build apk --release

# ABI bo‘yicha (arm64 uchun hajm ~2 barobar kichik)
flutter build apk --release --split-per-abi

# Play Store uchun
flutter build appbundle --release
```

Tayyor fayllar:

```
build/app/outputs/flutter-apk/app-release.apk
build/app/outputs/flutter-apk/app-arm64-v8a-release.apk
build/app/outputs/bundle/release/app-release.aab
```

### APK’ni CI’dan olish

Android SDK `dl.google.com` dan keladi va ba’zi tarmoqlarda yopiq
bo‘ladi. Shuning uchun qurish GitHub Actions’da ham sozlangan:

**Actions → «NFCSTORE Nova APK» → Run workflow → Artifacts →
`nfcstore-nova-apk`**

Workflow qurishdan oldin `flutter analyze` va `flutter test` ni
ishlatadi, qurgandan keyin esa paket nomi `uz.nfcstore.nova` ekanini
va kutilmagan ruxsat qo‘shilmaganini tekshiradi.

### Imzolash

`android/key.properties` bo‘lsa release kalit bilan, bo‘lmasa debug
kalit bilan imzolanadi. Fayl repozitoriyaga qo‘yilmaydi.

```properties
storeFile=nova.jks
storePassword=...
keyAlias=nova
keyPassword=...
```

CI uchun uchta secret: `NOVA_KEYSTORE_BASE64`,
`NOVA_KEYSTORE_PASSWORD`, `NOVA_KEY_ALIAS`.

**Eski ilovaning kalitidan foydalanmang** — Nova boshqa paket.

---

## Arxitektura

```
lib/
  app/            ilova ildizi, global providerlar
  core/
    network/      Dio klienti, Bearer sessiya, Result qaytaradi
    storage/      Keystore (token) + SharedPreferences (sozlama)
    errors/       AppError — kalit, matn emas
    utils/        validatsiya, Result, ulashish
  design/
    tokens/       5 mavzu, radius, bo‘shliq
    theme/        ThemeData, tipografiya
    widgets/      BrandLogo, NfcOrb, kapsula, tugma, holatlar
    motion/       tezlik va egri chiziqlar
  l10n/           uz / ru / en
  routing/        marshrutlar va tab karkasi
  data/
    models/       himoyalangan `fromJson`
    repositories/ backend bilan yagona aloqa
  features/       auth, home, discover, social, nfc, profile,
                  business, shop, activity, settings
```

**Holat:** Riverpod · **Marshrut:** go_router · **Tarmoq:** Dio ·
**Token:** flutter_secure_storage

Repository metodlari **istisno otmaydi** — ular `Result<T>` qaytaradi,
shuning uchun har chaqiruvda xato holatini hisobga olish majburiy.

---

## Mavzular

Beshta mavzu, har biri to‘liq: fon, sirt, matn, tugma, input, kapsula,
NFC orb, halqalar, nur, soya, modal, skeleton.

Pearl · Graphite · Ocean · Aurora · **Midnight Navy + Soft Gold**

Ranglar `nfcstore_concept_b_final.html` dagi `data-theme` bloklaridan
**bir-bir ko‘chirilgan**. Mavzu `ThemeExtension` sifatida beriladi,
shuning uchun almashuv animatsiyalanadi (`NfcTokens.lerp`).

Tanlov saqlanadi va ilova qayta ochilganda tiklanadi.

Har mavzuda matn kontrasti **test bilan** tekshiriladi
(`test/theme_test.dart`, WCAG ≥ 4.5).

## Tillar

O‘zbekcha (standart) · Русский · English

Uchala ARB fayli **bitta jadvaldan** yaratiladi, shuning uchun kalit
bir tilda tushib qolishi imkonsiz. To‘liqlik `test/l10n_test.dart` da
tekshiriladi.

Til real vaqtda almashadi va saqlanadi.

## Logotip

`assets/brand/nfcstore_logo.jpg` — **yakuniy brend aktivi, o‘zgarmagan**
(MD5 `3fafd47dcb5021faf7013b9c3d232f45`).

Belgi keng, gorizontal lokap (2000px kanvasda 1311×668), shuning uchun
u **hech qachon doira qilib kesilmaydi**. `BrandLogo` har doim
`BoxFit.contain` ishlatadi — nisbat buzilmaydi.

Mavzu logotipning O‘ZINI emas, **atrofini** o‘zgartiradi: plastina,
chegara, nur, soya. Oltin sirt ustida (identity karta, NFC orb)
logotip o‘zining qorong‘i plastinasi bilan qo‘yiladi — aks holda oltin
oltinda yo‘qolardi.

Ilova ikonkasi **alohida, xavfsiz variant**: belgi adaptiv ikonka
maskasining ichiga to‘liq sig‘adigan darajada kichraytirilgan
(`tool/` dagi skript, natija `assets/brand/nfcstore_icon.png` va
`android/app/src/main/res/`). Original fayl bunda o‘zgarmaydi.

## Shriftlar

Instrument Serif (sarlavha) · Manrope (matn) · IBM Plex Mono (NFC ID,
narx) · **Playfair Display (sarlavhalar uchun kirill zaxirasi)**

Instrument Serif’da kirill alifbosi yo‘q — usiz rus tilidagi sarlavha
`▯▯▯▯` bo‘lib chiqardi. Tafsilot: `assets/fonts/README.md`.

---

## NFC

Manifestda `android.permission.NFC`, `uses-feature` esa
`required="false"` — NFC’siz qurilmada ham ilova o‘rnatiladi.

`NfcService` qurilma holatini **haqiqatan** tekshiradi:

* apparati yo‘q → «Bu qurilmada NFC yo‘q» + QR orqali ulashish taklifi;
* o‘chirilgan → sozlamani ochish ko‘rsatmasi;
* bor → skanerlash.

**Soxta «skanerlandi» YO‘Q.** Natija faqat tegdan haqiqiy NDEF
ma’lumot o‘qilganda ko‘rsatiladi. Karta `chipToken` bilan kelsa, uni
NFC ID kodiga faqat **server** aylantiradi (`/api/tap/:chipToken`).

Deep link: `https://nfcstore.uz/...` va `NDEF_DISCOVERED`.

## To‘lov

Payme · Click · Paynet — qaysi biri **yoqilgani serverdan** so‘raladi
(`/api/settings/payments-enabled`).

Birortasi yoqilmagan bo‘lsa yoki to‘lov havolasi bo‘sh qaytsa, ekranda
`CONFIG REQUIRED` holati chiqadi. **Soxta «to‘lov muvaffaqiyatli»
hech qachon ko‘rsatilmaydi.**

## Xavfsizlik

* Sessiya tokeni Keystore/Keychain ichida (`flutter_secure_storage`).
* Parol va maxfiy javoblar **log qilinmaydi**.
* Kodda hech qanday API siri yo‘q; manzil `--dart-define` orqali.
* `usesCleartextTraffic="false"` — faqat HTTPS.
* 401 kelganda sessiya tozalanadi va kirish ekraniga qaytariladi.
* Chiqishda token o‘chiriladi — tarmoq yo‘q bo‘lsa ham.

---

## Testlar

```bash
flutter analyze   # 0 ta muammo
flutter test      # 71 ta test
```

| Fayl | Nimani tekshiradi |
|---|---|
| `models_test.dart` | `fromJson` buzuq/bo‘sh javobda qulamasligi |
| `validators_test.dart` | email, `+998` telefon, parol, kod |
| `theme_test.dart` | 5 mavzu, WCAG kontrast, `lerp` |
| `l10n_test.dart` | uchala tilning to‘liqligi, rus matni uzunligi |
| `routes_test.dart` | **55 marshrut** — o‘lik marshrut yo‘qligi |
| `widgets_test.dart` | BrandLogo, tugma, kod maydoni, auth ekranlari |
| `flows_test.dart` | sessiya, mavzu/til/rejim saqlanishi, NFC yo‘q holati |

## Ekran suratlari

`docs/screenshots/` — 390px Midnight/Pearl, 5 mavzu, 3 til,
360/390/430 kengliklar.

Suratlar `tool/gallery.dart` orqali olinadi. Bu **faqat vizual QA
uchun** kirish nuqtasi: u ekranlarni belgilangan mavzu, til va
kenglikda ko‘rsatadi va `flutter build apk` ga **tushmaydi** (qurish
faqat `lib/main.dart` dan boshlanadi).

```bash
flutter build web --target=tool/gallery.dart --release --no-web-resources-cdn
# ?screen=home&theme=midnight&lang=ru
```

---

## Backend holati

Ayrim imkoniyatlar backend tayyor bo‘lmagani uchun tugallanmagan.
Ular **yashirilmagan** — to‘liq ro‘yxat va kerakli shartnomalar:

**[`API_GAPS.md`](API_GAPS.md)** · **[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)**

Eng muhimi: texnik topshiriq **email orqali** 6 xonali kod bilan
tasdiqlashni talab qiladi, backend’da esa email yuborish
infratuzilmasi umuman yo‘q — kod Telegram boti orqali telefonga
boradi. Ilova ikkala yo‘lni ham qo‘llab-quvvatlaydi va qaysi biri
ishlayotganini ochiq ko‘rsatadi.
