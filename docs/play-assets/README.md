# PLAY CONSOLE GRAFIKASI

Play Console → **Store listing → Graphics** bo'limiga yuklanadi.

| Fayl | O'lcham | Qayerga |
|---|---|---|
| `play-icon-512.png` | 512×512 | **App icon** |
| `play-feature-1024x500.png` | 1024×500 | **Feature graphic** |
| `telefon/*.png` | 1080×1920, 24-bit PNG | **Phone screenshots** (6 ta; 8-chi — Noir mavzu) |
| `planshet-7/*.png` | 1200×1920 | **7-inch tablet screenshots** (4 ta) |
| `planshet-10/*.png` | 1600×2560 | **10-inch tablet screenshots** (4 ta) |

## Nega yangi belgi yasaldi

`src/assets/logo-512.png` — doira va BURCHAKLARI SHAFFOF. Play
belgini kvadrat maskaga soladi, shuning uchun doira atrofida bo'sh
joy ko'rinadi va belgi "kesilgan" bo'lib chiqadi.

`play-icon-512.png` da kvadrat TO'LA bo'yalgan: fon navy gradient,
nishon markazda va chetdan xavfsiz masofada. Maska qanday
qo'llansa ham natija butun ko'rinadi.

Nishonning O'ZI o'zgartirilmadi — u aynan o'sha brend aktivi.

## Ranglar qayerdan

Hammasi `mobile_nova/lib/design/tokens/nfc_tokens.dart` dagi
`noir` mavzusidan — ya'ni do'kon sahifasi ilovaning o'zi bilan
bir xil ko'rinadi:

    fon    #07111F -> #050B14   (navy, qoraga yaqin)
    oltin  #E4C97A / #D6B25E    (shampan)

Shriftlar ham ilovadan: `InstrumentSerif` (nom), `Manrope`
(shior), `IBMPlexMono` (manzil).

## Qayta yasash

    python3 docs/play-assets/build.py

## Feature graphic matni

    NFCSTORE
    Bitta tegishda ulashing
    Vizitka · Lenta · Story · Reels · Tanlov
    nfcstore.uz

Uchinchi qator ATAYIN qo'shilgan: ilova faqat vizitka emas,
ijtimoiy tomoni ham bor. Play qidiruvi feature graphic matnini
o'qimaydi, lekin odam birinchi shu rasmni ko'radi — "vizitka"
deb tushunib ketmasligi kerak.

## Feature graphic haqida ogohlantirish

Google uni turli o'lchamda QIRQADI. Shuning uchun matn markazga
yaqin turadi va chetlarda hech narsa yo'q. Agar keyinroq matn
qo'shsangiz, chetdan kamida 100 px joy qoldiring.

## Skrinshotlarni yangilash (2026-09, 1.1.0)

    cd mobile_nova
    flutter test test/shots/play_store_shot.dart --run-skipped -t shots --update-goldens
    # keyin test/shots/png/play-*.png -> docs/play-assets/{telefon,planshet-7,planshet-10}/
    # va RGB ga o'tkazish (Play skrinshotda alfa kanalni QABUL QILMAYDI)
