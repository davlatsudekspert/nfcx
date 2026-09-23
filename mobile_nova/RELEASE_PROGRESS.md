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
- [x] Real hisob E2E #46: uchala to'plam ishladi, 69 PASS / 0 FAIL, qurilma
      (release APK launch/resume, 360/390/430 layout) PASS. Osilish sababi:
      emulyator aloqasi uzilishi (`adb: device offline`) — flutter test
      qurilmani cheksiz kutgan. Tuzatildi: to'plam chegaralari (b34bbbd) +
      testlardan keyingi uzilish natijani buzmaydi (648fb15).
- [x] Qurilma bosqichi (release APK launch/resume, 360/390/430 layout) — PASS (#45)

- [x] Egasi xabari: istorya ochilganda qora ekran — tuzatildi (4d0365d):
      tayyor ro'yxat, surat+halqa, media tayyor bo'lgach taymer, prefetch
- [~] Kod auditlari (2 agent): funksional 7H/12M/15L, performance 4H/5M/9L.
      25 ta H/M topilma skeptik workflow bilan tekshirilmoqda (wf nova-release-
      audit-verify) — tasdiqlanganlari tuzatiladi.
- [~] Egasi xabari: Reels'da katta video sekin ochiladi — ildiz sababi
      tekshirilmoqda (serveUpload Range 206 qo'llaydi).

- [ ] KEYIN (egasi): Ivory/Noir chuqur dizayn auditi — typography, surface,
      elevation, gold me'yori, icon tizimi, WCAG; pastki navigatsiya
      proporsiyalari (icon/label/active/NFC balans). Funksiyaga tegilmaydi.

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
