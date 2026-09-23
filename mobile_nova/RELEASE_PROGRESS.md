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
- [ ] Reels: NFCSTORE identiteti (muallif satrida NFC ID plastinka / biznes)
- [ ] Ekranlar bo'yicha UX audit (loading/empty/error, sheet, keyboard)

## 2–3. Funksional test va bug-fix

- [ ] login/register, email/Telegram verification
- [ ] Personal/Business switch, Profile/Edit, Business/Edit
- [ ] Catalog, product/service, Search/Discover
- [ ] Stories, Posts, Reels, comments/replies/likes/save/share/report/follow
- [ ] NFC Center, scan/write, QR, NFC ID qidirish, pullik ID, sovg'a
- [ ] settings/themes, deep links/App Links, permissions
- [ ] sekin internet / server xatosi / timeout holatlari

## 4. Performance

- [ ] startup, tab navigation, scroll, Reels video, rasm kesh
- [ ] takroriy API so'rovlari, keraksiz rebuild, memory leak (controller dispose)

## 5–6. Release

- [ ] versionName (pubspec) + versionCode (CI run_number)
- [ ] permissions / App Links / Data Safety mosligi
- [ ] signed AAB + APK (CI `nova-apk.yml`)

## 7. Hisobot

- [ ] Final hisobot egasiga
