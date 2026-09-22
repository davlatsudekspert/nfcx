# PLAY CONSOLE GRAFIKASI

Play Console → **Store listing → Graphics** bo'limiga yuklanadi.

| Fayl | O'lcham | Qayerga |
|---|---|---|
| `play-icon-512.png` | 512×512 | **App icon** |
| `play-feature-1024x500.png` | 1024×500 | **Feature graphic** |
| `../../mobile_nova/test/shots/png/play-*.png` | 1080×1920 | **Phone screenshots** (5 ta) |

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

## Feature graphic haqida ogohlantirish

Google uni turli o'lchamda QIRQADI. Shuning uchun matn markazga
yaqin turadi va chetlarda hech narsa yo'q. Agar keyinroq matn
qo'shsangiz, chetdan kamida 100 px joy qoldiring.
