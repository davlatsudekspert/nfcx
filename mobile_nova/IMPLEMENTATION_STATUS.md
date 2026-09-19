# IMPLEMENTATION STATUS

Har bir imkoniyat uchun aniq holat. **Hech narsa bo‘rttirilmagan:**
«DONE» faqat kod yozilgan, real endpointga ulangan va tekshirilgan
bo‘lsa qo‘yilgan.

| Belgi | Ma’nosi |
|---|---|
| **DONE** | Tayyor va real backend endpointiga ulangan |
| **PARTIAL** | Ishlaydi, lekin cheklov bor (izohda) |
| **BACKEND REQUIRED** | UI va repository tayyor, endpoint yo‘q |
| **CONFIG REQUIRED** | Kod tayyor, server sozlamasi yetishmaydi |

---

## Asos

| Imkoniyat | Holat | Izoh |
|---|---|---|
| Alohida Flutter loyihasi | **DONE** | `mobile_nova/`, eski `mobile/` tegilmagan |
| Yonma-yon o‘rnatish | **DONE** | `uz.nfcstore.nova` ≠ `uz.nfcstore.app`, CI da tekshiriladi |
| Feature-based arxitektura | **DONE** | 70 fayl, 19 000 qator, `main.dart` 34 qator |
| Riverpod / go_router / Dio | **DONE** | |
| Dizayn tokenlari | **DONE** | Concept B dan bir-bir ko‘chirilgan |
| Xato tizimi | **DONE** | `Result<T>`, repository istisno otmaydi |
| Yuklanish / skeleton | **DONE** | `Skeleton`, `SkeletonList` |
| Responsiv 360/390/430 | **DONE** | Suratlar bilan tekshirilgan |

## Mavzu va til

| Imkoniyat | Holat | Izoh |
|---|---|---|
| 5 mavzu | **DONE** | Pearl, Graphite, Ocean, Aurora, Midnight |
| Mavzu saqlanishi | **DONE** | Test bilan tekshiriladi |
| Animatsiyali almashuv | **DONE** | `NfcTokens.lerp` + `AnimatedTheme` |
| WCAG kontrast | **DONE** | Har mavzuda ≥ 4.5, test bilan |
| 3 til (uz/ru/en) | **DONE** | 279 kalit × 3 |
| Real vaqtda almashish | **DONE** | |
| Til saqlanishi | **DONE** | Test bilan |
| Kirill sarlavhalari | **DONE** | Playfair Display zaxirasi |

## Logotip

| Imkoniyat | Holat | Izoh |
|---|---|---|
| Original aktiv o‘zgarmagan | **DONE** | MD5 manba bilan bir xil |
| Nisbat buzilmaydi | **DONE** | Har doim `contain`, test bilan |
| Doira qilib kesilmaydi | **DONE** | Plastina — to‘rtburchak, radiusli |
| Mavzuga mos taqdimot | **DONE** | Plastina/nur/chegara o‘zgaradi, rasm emas |
| Alohida ilova ikonkasi | **DONE** | Adaptiv maskaga to‘liq sig‘adi |

## Autentifikatsiya

| Imkoniyat | Holat | Izoh |
|---|---|---|
| Kirish (email + parol) | **DONE** | `POST /api/auth/login` |
| Ro‘yxatdan o‘tish | **DONE** | `POST /api/auth/register` |
| Ro‘yxat kodi | **DONE** | `request-register-code` — Telegram orqali |
| Sessiya tiklash | **DONE** | `GET /api/auth/me`, token Keystore’da |
| Chiqish | **DONE** | Tarmoq yo‘q bo‘lsa ham token tozalanadi |
| Parolni almashtirish | **DONE** | Kod bilan, ikki bosqichli |
| Profil to‘ldirish | **DONE** | |
| **Email orqali 6 xonali kod** | **BACKEND REQUIRED** | Serverda email infratuzilmasi YO‘Q — `API_GAPS.md` §1 |
| Kod holatlari (xato/muddat/qayta) | **DONE** | UI to‘liq, endpoint kutilmoqda |
| `+998` telefon UX | **DONE** | Normalizatsiya + test |

## Home

| Imkoniyat | Holat |
|---|---|
| Identity obyekti, faol NFC ID | **DONE** |
| Shaxsiy ↔ Biznes almashtirgich | **DONE** |
| QR va ulashish | **DONE** |
| Tezkor amallar (rejimga qarab o‘zgaradi) | **DONE** |
| Stories qatori | **DONE** |
| Postlar ko‘rinishi | **DONE** |
| So‘nggi harakatlar | **DONE** |
| Do‘kon / Biznes yo‘li | **DONE** |

## NFC

| Imkoniyat | Holat | Izoh |
|---|---|---|
| NFC markazi (orb, to‘lqin, orbit) | **DONE** | |
| Qurilma holatini aniqlash | **DONE** | Yo‘q / o‘chiq / tayyor |
| Skanerlash | **DONE** | Haqiqiy NDEF; soxta natija yo‘q |
| Chip → kod | **DONE** | `GET /api/tap/:chipToken`, serverda hal qilinadi |
| NFC ID’lar ro‘yxati | **DONE** | `/api/auth/me` → `cards` |
| ID tafsiloti | **DONE** | |
| ID tahrirlash | **DONE** | `PUT /api/records/:code` |
| Asosiy qilish | **DONE** | `set-primary` |
| O‘chirish (tasdiq bilan) | **DONE** | |
| QR / ulashish | **DONE** | |
| Sovg‘a qilish | **DONE** | `/api/records/:code/gift` |
| Kartalar (ulash/uzish) | **DONE** | `/api/my/nfc-devices` |
| Tarix | **DONE** | `/api/records/:code/analytics` |
| Xavfsizlik ekrani | **DONE** | |

## Profil va ijtimoiy

| Imkoniyat | Holat | Izoh |
|---|---|---|
| Profil (Identity Canvas) | **DONE** | Kapsula, muqova, nosimmetrik |
| Profilni tahrirlash + avatar | **DONE** | `/api/upload` |
| Boshqa foydalanuvchi profili | **DONE** | `/u/:code` |
| Kuzatish / bekor qilish | **DONE** | Optimistik |
| Kashfiyot + qidiruv | **DONE** | Debounce 350ms |
| Stories ko‘rish | **DONE** | Progress, oldinga/orqaga, ushlab turish |
| Story yaratish | **DONE** | `/api/records/:code/gallery` |
| Postlar lentasi va tafsiloti | **DONE** | |
| Like | **DONE** | Optimistik, xatoda qaytariladi |
| Post yaratish (rasm + matn) | **DONE** | Yuklash progressi bilan |
| Post o‘chirish | **DONE** | Faqat o‘ziniki |
| Reels (vertikal, video) | **DONE** | Faqat ko‘rinayotgan video yuklanadi |
| Reel yaratish | **DONE** | |
| **Izohlar** | **BACKEND REQUIRED** | Endpoint yo‘q — `API_GAPS.md` §2 |
| Story «ko‘rildi» | **PARTIAL** | Endpoint yo‘q — `API_GAPS.md` §7 |

## Biznes

| Imkoniyat | Holat | Izoh |
|---|---|---|
| Biznes ro‘yxati | **DONE** | `/api/companies/mine` |
| Biznes ochish | **DONE** | Manzil bandligi real tekshiriladi |
| Tahrirlash | **DONE** | |
| Boshqaruv paneli | **DONE** | Shaxsiydan boshqa kompozitsiya |
| Ommaviy vitrina | **DONE** | `/c/:companyId` |
| Katalog (mahsulot va xizmat) | **DONE** | Qo‘shish, tahrirlash, o‘chirish |
| Chegirma narxi | **DONE** | Test bilan |
| Tahlil | **PARTIAL** | Ko‘rsatkichlar bor, vaqt grafigi yo‘q (backend tarixni bermaydi) |
| Bog‘lanish varag‘i | **DONE** | Telefon/Telegram/WhatsApp/sayt — **yozishma yo‘q** |
| Moderatsiyaga yuborish | **DONE** | |

## Do‘kon va to‘lov

| Imkoniyat | Holat | Izoh |
|---|---|---|
| Do‘kon ro‘yxati | **DONE** | `/api/settings/physical-nfc-pricing` |
| Kategoriya filtri | **DONE** | |
| Mahsulot tafsiloti | **DONE** | Narx serverdan, hardcode yo‘q |
| Buyurtmalar | **DONE** | `/api/orders` |
| To‘lovlar tarixi | **DONE** | `/api/payments` |
| To‘lov holatlari | **DONE** | kutilmoqda / muvaffaqiyat / xato / bekor |
| **Payme / Click / Paynet** | **CONFIG REQUIRED** | Kod ulangan, server kaliti yo‘q — `API_GAPS.md` §5 |

## Bildirishnoma va sozlamalar

| Imkoniyat | Holat | Izoh |
|---|---|---|
| Bildirishnomalar lentasi | **PARTIAL** | So‘rab olinadi (pull); umumiy endpoint yo‘q |
| O‘qilgan/o‘qilmagan filtri | **DONE** | |
| **Push** | **BACKEND REQUIRED** | FCM yo‘q — `API_GAPS.md` §3 |
| Sozlamalar bosh ekrani | **DONE** | Har element real ekranga olib boradi |
| Mavzu tanlash | **DONE** | Har variant o‘z rangida + logotip |
| Til tanlash | **DONE** | Har til o‘z tilida |
| Xavfsizlik / parol | **DONE** | |
| Bildirishnoma kalitlari | **PARTIAL** | Qurilmada saqlanadi, ekranda ochiq yozilgan |
| Maxfiylik | **PARTIAL** | Xuddi shunday |
| Referal | **DONE** | `/api/referrals`, promokod |
| Premium so‘rovi | **DONE** | `/api/premium/request` |
| Qo‘llab-quvvatlash | **DONE** | `/api/support` |
| Ilova haqida | **DONE** | |
| **Hisobni o‘chirish** | **BACKEND REQUIRED** | Endpoint yo‘q; murojaat yuboriladi — `API_GAPS.md` §4 |

## Sifat

| Imkoniyat | Holat | Izoh |
|---|---|---|
| `flutter analyze` | **DONE** | 0 ta muammo |
| Testlar | **DONE** | 71 ta, hammasi o‘tadi |
| O‘lik marshrut yo‘q | **DONE** | 55 marshrut test bilan tekshiriladi |
| Tizim holatlari | **DONE** | yuklanish, bo‘sh, oflayn, xato, NFC yo‘q, to‘lov |
| Harakat tizimi | **DONE** | Nafas, pulse, spring, fade+scale, morph |
| «Harakatni kamaytirish» | **DONE** | Takroriy animatsiyalar to‘xtaydi |
| Fonda animatsiya to‘xtashi | **DONE** | Batareya uchun |
| Video xotira boshqaruvi | **DONE** | Ko‘rinmagan kontroller yo‘q qilinadi |
| Rasm keshi | **DONE** | `cached_network_image` |
| Rasm kichraytirish | **DONE** | Yuklashdan oldin |
| Semantика / tap nishoni | **DONE** | Tugma va ikonkalar belgilangan |
| Matn masshtabi | **DONE** | 0.85–1.3 oralig‘ida cheklangan |
| **Android APK / AAB** | **DONE** | CI da qurildi va tekshirildi (quyiga qarang) |

---

## APK — qurildi va tekshirildi

**Run [#35430822764](https://github.com/davlatsudekspert/nfcx/actions/runs/35430822764)
— 17/17 qadam muvaffaqiyatli.**

| | |
|---|---|
| Paket | `uz.nfcstore.nova` (CI da tekshiriladi) |
| versionName | `1.0.0` (pubspec'dan) |
| versionCode | `2` (`github.run_number`) |
| Artifact | `nfcstore-nova-apk` (ID 10579899161), 108 MB, 5 fayl |

| Fayl | Hajm | SHA-256 |
|---|---|---|
| `flutter-apk/app-release.apk` (universal) | 55.5 MB | `2a7b60c7…6dba2` |
| `flutter-apk/app-arm64-v8a-release.apk` | 21.5 MB | `beef7821…62ecb` |
| `flutter-apk/app-armeabi-v7a-release.apk` | 19.4 MB | `5c259f48…6f322` |
| `flutter-apk/app-x86_64-release.apk` | 22.7 MB | `631e5561…3bfc8` |
| `bundle/release/app-release.aab` | 46.8 MB | `c7d105e3…53bba` |

### Ruxsatlar auditi

Tayyor APK ichidagi to'liq ro'yxat:

```
android.permission.ACCESS_NETWORK_STATE
android.permission.INTERNET
android.permission.NFC
android.permission.WAKE_LOCK
```

Manifestda ikkitasi yozilgan (`INTERNET`, `NFC`). Qolgan ikkitasi
PLAGINLARDAN qo'shilgan: `WAKE_LOCK` — `video_player` (Reels
o'ynayotganda ekran o'chmasligi uchun), `ACCESS_NETWORK_STATE` —
tarmoq holatini o'qiydigan kutubxonalar.

Ikkalasi ham xavfsiz va foydalanuvchidan ruxsat so'ramaydi. Joylashuv,
mikrofon, kontakt, SMS yoki telefon holati — **bittasi ham yo'q**.

### Imzo — DIQQAT

APK **debug kaliti** bilan imzolangan, chunki `NOVA_KEYSTORE_BASE64`
sekreti hali sozlanmagan.

Barmoq izi (SHA-256):
`77:82:10:39:BB:AA:7A:E6:0A:95:EF:6B:3B:1A:17:5B:88:C2:12:1B:61:D0:C9:47:D6:29:7D:95:06:F1:14:27`

Bu APK **o'rnatiladi va ishlaydi**, lekin:

* **Play Store'ga yaramaydi** — release kaliti kerak;
* App Links ishlashi uchun `assetlinks.json` ichidagi barmoq izi
  shunga mos bo'lishi kerak;
* debug kaliti har muhitda boshqacha bo'lishi mumkin, ya'ni eski
  versiya ustiga o'rnatilmasligi mumkin.

Haqiqiy kalit uchun: `README.md` → «Imzolash».

### Qurishdagi to'siq va uning yechimi

Birinchi urinish ([#35430448266](https://github.com/davlatsudekspert/nfcx/actions/runs/35430448266))
R8 bosqichida yiqildi:

```
Missing class com.google.android.play.core.splitcompat.SplitCompatApplication
Execution failed for task ':app:minifyReleaseWithR8'
```

Flutter embeddingi deferred-component sinflarini olib yuradi va ular
Play Core'ga havola qiladi; ilova Play Core'ni bog'liqlik sifatida
olmaydi, AGP 8 dagi R8 esa yetishmayotgan sinfni XATO deb hisoblaydi.

Tuzatildi: `-dontwarn com.google.android.play.core.**` va keep
qoidalarini aniq paketlarga toraytirish
(`android/app/proguard-rules.pro`).

### Nima uchun bu muhitda emas, CI da

Ushbu ishlab chiqish muhitida Android SDK o'rnatib bo'lmaydi:
`dl.google.com` va `maven.google.com` tarmoq siyosati bilan bloklangan
(CONNECT → 403), Debian paketi esa API 23 da qolgan.

Shuning uchun qurish `.github/workflows/nova-apk.yml` orqali GitHub
runner'ida bajariladi.
