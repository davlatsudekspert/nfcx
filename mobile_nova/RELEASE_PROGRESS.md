# NFCSTORE Nova — release progress (resume point)

Egasining ketma-ketligi (2026-09, FINAL MASTER TASK):

1. Dizaynni final qilish
2. Barcha funksiyalarni test qilish (real oqimlar)
3. Buglarni tuzatish
4. Performance audit
5. Release audit (package, signing, permissions, App Links, Data Safety)
6. Signed AAB + final APK
7. Egasiga final hisobot — Play Console'ga YUBORILMAYDI, ruxsatdan keyin

Qat'iy: `uz.nfcstore.nova` va signing key o'zgarmaydi; yangi ilova
yaratilmaydi; yangi funksiya ochilmaydi (faqat bug / UX / performance /
consistency / release blocker).

Sessiya uzilsa — shu fayldagi birinchi `[ ]` bandidan davom etiladi.

## 1. Dizayn

- [x] Kontrast va ikon og'irligi (ivory tokenlar, bir xil chiziqli ikonlar)
- [x] Pullik NFC ID tizimi `lib/design/widgets/id_lux.dart` — Oltin / Premium /
      Eksklyuziv har mavzuda bir xil; katalog, qidiruv, ID sahifasi, profil,
      profil lentasi, hero belgisi, Tanlov, sovg'a, NFC ID ro'yxati
- [x] Home/Profil polish (bo'sh joy, quick action, statistika, Stories)
- [x] Pastki navigatsiya doimiy (test: `bottom_nav_persist_test.dart`)
- [x] Mavzular: Ivory standart; Noir/Ocean/Graphite/Aurora/Onyx tanlanadi;
      text3 hamma qorong'i mavzuda >= 4.5:1; Graphite sovuq platina, Onyx iliq
- [x] Edit Profile / Edit Business bo'limlari + doimiy "Saqlash" paneli
- [x] Reels: NFCSTORE identiteti (NFC ID kapsulasi, champagne halqa, brend imzosi)
- [x] Ekranlar bo'yicha UX audit (Tanlov: bosh harflar va bo'sh kasb tuzatildi)

## 2–3. Funksional test va bug-fix

- [ ] login/register, email/Telegram verification
- [ ] Personal/Business switch, Profile/Edit, Business/Edit
- [ ] Catalog, product/service, Search/Discover
- [ ] Stories, Posts, Reels, comments/replies/likes/save/share/report/follow
- [ ] NFC Center, scan/write, QR, NFC ID qidirish, pullik ID, sovg'a
- [ ] settings/themes, deep links/App Links, permissions
- [ ] sekin internet / server xatosi / timeout holatlari
- [~] Real hisob E2E (CI `nova-e2e.yml`): #44/#45 backend to'plamida 60 daq
      osilib bekor bo'lgan. Diagnostika qo'shildi (b34bbbd): har so'rov
      `[E2E] ->/<-`, har test `[E2E] >>`, to'plam chegaralari 16/10/16m.
      #46 ishga tushdi — natijasiga qarab sabab tuzatiladi.
- [x] Qurilma bosqichi (release APK launch/resume, 360/390/430 layout) — PASS (#45)

## 4. Performance

- [ ] startup, tab navigation, scroll, Reels video, rasm kesh
- [ ] takroriy API so'rovlari, keraksiz rebuild, memory leak (controller dispose)

## 5–6. Release

- [ ] versionName (pubspec) + versionCode (CI run_number)
- [~] permissions / App Links / Data Safety mosligi
      * permissions: faqat INTERNET, NFC (required=false); rasm — Photo Picker
        (READ_MEDIA_* yo'q), kamera — intent (CAMERA yo'q)
      * App Links: https://nfcstore.uz /u /c /post /story /nfc, autoVerify
      * [x] BLOCKER tuzatildi (89613bc): sessiya tokeni Auto Backup va
        telefondan-telefonga ko'chirishdan chiqarildi + resetOnError
- [ ] signed AAB + APK (CI `nova-apk.yml`)

## 7. Hisobot

- [ ] Final hisobot egasiga
