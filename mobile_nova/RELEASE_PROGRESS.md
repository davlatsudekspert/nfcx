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
- [x] Kod auditlari: 25 ta tasdiqlangan topilmaning HAMMASI tuzatildi
      (F-H1..F-H7, F-M2..F-M12, F-L1, F-L10, P-H1..P-H4, P-M1..P-M5), har
      biriga test; asosiylari tuzatishsiz YIQILISHI tekshirildi. 799 PASS.
- [x] Reels katta video — qurilmada o'lchandi (integration_probe, CI
      `nova-video-probe.yml`):
      * birinchi kadr: oddiy video 1.6-2.2 s; 14 MB (moov oxirida) birinchi
        ochilishda 3.8 s — server o'sha fayl uchun sekin (HEAD 1.2 s,
        5.6 Mbit/s, qolganlari 0.2 s / 16-17 Mbit/s); ikkinchi ochilishda
        2.07 s. Ya'ni asosiy ulush — serverning katta faylni sovuq o'qishi
        (Worker -> R2, videolar edge keshda emas), moov-oxirida kichik ulush
      * pauzadagi preload 5 s da 35 s videoni TO'LIQ yukladi (ExoPlayer)
      * tuzatildi (22a3f32): keyingi reel ko'rinayotgani o'ynay boshlagach
        yuklanadi, faqat BITTA; reelsProvider so'rovlari parallel
      * tavsiya (server, deploy qilinmadi): video Range so'rovida R2 `head`
        + `get` o'rniga bitta `get(range: headers)`; yuklashda faststart
        (moov boshiga) — Android kamera videolari moov'ni oxiriga yozadi
- [x] Video boshqa ekranda to'xtaydi: lenta (P-H1) va Reels (P-H2) —
      TickerMode; tab almashganda stopAll (avvaldan)

- [x] Ivory/Noir dizayn auditi (theme_matrix_shot: 8 ekran x 2 mavzu x
      360/390/430, toshish yo'q): Tanlov yorlig'i 8.5->10.5, NFC markazi
      matni kesilmaydi. Pastki navigatsiya: belgi 24-25, yorliq 10.5-11,
      faol kapsula + to'la belgi, pill 66, markaz 56 (6632813).

## 4. Performance

- [ ] startup, tab navigation, scroll, Reels video, rasm kesh
- [ ] takroriy API so'rovlari, keraksiz rebuild, memory leak (controller dispose)

## 5–6. Release

- [x] versionName 1.1.0 (pubspec) + versionCode = CI run_number (#207)
- [~] permissions / App Links / Data Safety mosligi
      * permissions: faqat INTERNET, NFC (required=false); rasm — Photo Picker
        (READ_MEDIA_* yo'q), kamera — intent (CAMERA yo'q)
      * App Links: https://nfcstore.uz /u /c /post /story /nfc, autoVerify
      * [x] BLOCKER tuzatildi (89613bc): sessiya tokeni Auto Backup va
        telefondan-telefonga ko'chirishdan chiqarildi + resetOnError
- [~] signed AAB + APK (CI `nova-apk.yml` #207) — natija PLAY_CONSOLE_HANDOFF.md da
- [x] Play skrinshotlar 1.1.0 dan qayta olindi (24-bit PNG), release notes UZ/RU/EN,
      `PLAY_CONSOLE_HANDOFF.md` (final publish tugmasi BOSILMAYDI)

## 7. Hisobot

- [ ] Final hisobot egasiga
