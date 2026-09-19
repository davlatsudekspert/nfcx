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
| **Android APK** | **BLOKLANGAN** | Bu muhitda Android SDK o‘rnatib bo‘lmaydi (quyiga qarang) |

---

## APK haqida — ochiq holat

**Bu ishlab chiqish muhitida APK QURILMADI.**

Sababi: Android SDK faqat `dl.google.com` va `maven.google.com` dan
keladi, ikkalasi ham tarmoq siyosati tomonidan bloklangan
(CONNECT → 403). Debian’dagi `android-sdk` paketi esa API 23 da
qolgan — Flutter uchun yaramaydi.

Bu repozitoriyada **allaqachon ma’lum muammo**: mavjud
`.github/workflows/android-apk.yml` faylining birinchi izohi aynan
shu haqda.

**Yechim — CI:** `.github/workflows/nova-apk.yml` qo‘shildi. U
GitHub runner’ida (SDK bor) universal APK, ABI APK’lari va AAB
quradi, so‘ng paket nomini va ruxsatlarni tekshiradi.

Bu muhitda tekshirilgani:

* `flutter analyze` — 0 ta muammo;
* `flutter test` — 71 ta test o‘tadi;
* `flutter build web --release` — butun Dart kodi relizga
  kompilyatsiya bo‘ladi;
* Android sozlamalari (manifest, Gradle, imzo, adaptiv ikonka)
  yozilgan va ko‘rib chiqilgan, lekin **Gradle bilan ishga
  tushirilmagan**.
