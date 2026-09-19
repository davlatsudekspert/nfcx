# Ekran suratlari

Barchasi `tool/gallery.dart` orqali, Chromium’da, `devicePixelRatio: 2`
bilan olingan. Fayl nomidagi raqam texnik topshiriqdagi checkpoint’ga
mos keladi.

| Fayl | Nima |
|---|---|
| `cp1-welcome-pearl` / `cp1-welcome-midnight` | Welcome — ikki mavzuda |
| `cp1-splash-midnight` | Splash |
| `cp2-login-uz` | Kirish (parol va kod rejimi) |
| `cp2-register-uz` | Ro‘yxatdan o‘tish, 1-qadam |
| `cp2-verify-uz` | Kod kiritish, sanoq bilan |
| `cp3-home-pearl` / `cp3-home-midnight` | Home |
| `cp3-home-business` | Home — biznes rejimi |
| `cp4-nfc-midnight` | NFC markazi — orb, to‘lqin, orbit |
| `cp4-nfc-scan-midnight` | Skanerlash |
| `cp4-nfc-ids-midnight` | NFC ID’lar ro‘yxati |
| `cp5-profile-midnight` / `cp5-profile-pearl` | Profil |
| `cp6-discover` | Kashfiyot va qidiruv |
| `cp7-business` | Biznes ro‘yxati |
| `cp7-biz-onboard` | Biznes ochish |
| `cp7-biz-dashboard` | Boshqaruv paneli |
| `cp7-biz-catalog` | Katalog |
| `cp8-shop` | Do‘kon |
| `cp8-checkout` | Buyurtmani rasmiylashtirish |
| `cp8-orders` | Buyurtmalar |
| `cp8-payment-pending` / `-success` | To‘lov holatlari |
| `cp9-settings-uz` / `-ru` / `-en` | Sozlamalar — uch tilda |
| `cp9-home-ru` | Home — rus tilida |
| `cp9-theme-picker` | Mavzu tanlash |
| `cp10-theme-*` | NFC markazi — beshala mavzuda |
| `cp11-home-360` / `-390` / `-430` | Responsivlik (rus tilida) |
| `activity` | Bildirishnomalar |

## Nega ba’zi ekranlar «Oflayn» ko‘rsatadi

Gallereya brauzerda ishlaydi va `nfcstore.uz` ga so‘rov yubora
olmaydi. Uchta repository (auth, social, discover) va biznes/do‘kon
uchun gallereya ichida namunaviy ma’lumot beriladi — **faqat maket
ko‘rinishi uchun**.

Qolgan ekranlarda haqiqiy oflayn holati ko‘rinadi. Bu ham foydali:
xato ekranlari haqiqatan ishlashini isbotlaydi.

**Bu namunaviy ma’lumot ilovaga tushmaydi** — `flutter build apk`
faqat `lib/main.dart` dan boshlanadi, u esa hamma narsani backend’dan
oladi.
