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

- [x] E2E qurilma bosqichi #47-#51 da emulyator (qemu) Home->Tanlov / Profil
      o'tishida o'ldi. Sabab ILOVA KODI EMAS: alohida probe'larda (har
      variant yangi emulyatorda) #46 da o'tgan b34bbbd kodi ham qulagan;
      xotira yetarli (OOM yo'q); logda gfxstream `glWaitSync error 0x501`
      — emulyatorning `swiftshader_indirect` host GLES tarjimoni. Tuzatish
      (880d181): nova-e2e emulyatori `-gpu swangle_indirect` — probe'da
      release APK + 360/390/430 layout 27/27 PASS (Impeller). Story
      tuzatishi va ilova kodi o'zgarmadi.

- [x] Ivory/Noir dizayn auditi (theme_matrix_shot: 8 ekran x 2 mavzu x
      360/390/430, toshish yo'q): Tanlov yorlig'i 8.5->10.5, NFC markazi
      matni kesilmaydi. Pastki navigatsiya: belgi 24-25, yorliq 10.5-11,
      faol kapsula + to'la belgi, pill 66, markaz 56 (6632813).

## 4. Performance

Audit (2026-09-23, workflow: 4 auditor + har topilma mustaqil verifier;
faqat kod bilan isbotlangan, ko'rinishni o'zgartirmaydigan tuzatishlar):

- [x] SM-2 profil setkasidan ochilgan post ro'yxatni qayta yuklamaydi (a3c7df6)
- [x] SM-3 do'kon sahifasi: parallel ikki GET /api/companies/:id -> bitta (a3c7df6)
- [x] SM-4 izoh yozilganda har harfda ~20 izoh kartasi qayta qurilmaydi (a3c7df6)
- [x] TS-1 Home demo rasmlari quti o'lchamida (x2) — ~23 MB -> ~10 MB (a3c7df6, 777a909)
- [x] TS-2 Reels faqat o'z tabiga kirish/chiqishda qayta quriladi (a3c7df6)
- [x] SM-1 profil setkasi lazy (sliver) — 60 postli profilda ~18 tadan
      ko'p katakcha qurilmaydi (5166f49); review 2 regressiya topdi va
      tuzatildi: bo'sh/to'la tab orasida panel qayta yaratilmaydi, to'r
      tepasida ham kesh zonasi bor (test/profile_grid_lazy_test.dart)
- Har tuzatishga test: test/perf_audit_test.dart; tuzatishsiz yiqiladi

## 4b. UI sifat (hit-area, holatlar, klaviatura)

- [x] UIQ-3 izoh like ikki bosishda bekor bo'lmaydi (434608d)
- [x] UIQ-1 biznes profil postlari: Retry noto'g'ri provayderni yangilardi (1946783)
- [x] UIQ-2 do'kon: Retry'dan keyin katalog xato holatida qolardi (f11cbff)
- [x] UIQ-4 saqlash/kirish tugmasi ikkinchi so'rovni yuborishi mumkin edi (f11cbff, 494dff7)
- [x] UIQ-5 QR oynasi 360x640 + 1.3 shriftda toshardi (f11cbff)
- [x] UI-2/3/4/11 Tanlov chiplari kesilmaydi, tozalash va rasm o'chirish
      44x44 (4258a6e; review ACCEPT)
- [x] UI-1/5/6/7 lenta, izoh, post va Reels tugmalarining bosish maydoni
      (f1002b2); review 320 dp + shrift 1.3 da 2 ta yangi toshish topdi —
      tuzatildi, test qo'shildi (test/hit_area_social_test.dart, 16 test)
- Rad etildi (ko'rinishni o'zgartiradi, egasi qarori): UI-8 Noir error
  kontrasti 3.5-3.9:1, UI-9 8.5-9.5 px ma'lumot matni, UI-10 Noir ID
  kartadagi shaffof yorliqlar

## 4c. Release auditi (#207 dan keyingi hamma o'zgarishlar, 61f2805..92093ae)

4 yo'nalish (to'g'rilik, layout, performance, release konfiguratsiyasi) +
har tuzatishga mustaqil review. Tasdiqlangan va tuzatilgan:

- [x] SM-2 regressiyasi: profil ro'yxatidan ochilgan post eskirgan
      layk/izoh sonini ko'rsatardi — endi har doim serverdan, ro'yxat
      nusxasi faqat birinchi kadr (2d9c54b)
- [x] SM-1 regressiyasi: kesh zonasidagi video katakchalar muqovasiz
      qolardi — endi muqova katakcha chizilganda olinadi (2d9c54b)
- [x] App Lock zaxiradan tiklanganda ochib bo'lmaydigan qulf (f478798)
- [x] o'chirilgan hisob: kirish/qayta ro'yxatda aniq sabab (f478798)
- [x] docs/PLAY_CONSOLE.md: "to'lov Payme/Click" qarama-qarshiligi (f478798)
- [x] ID tanlovidagi poyga (E2E #59 topdi): lentadan ID bosilganda karta
      yo'q qilinib, `ref` StateError otardi va rejim almashmasdi (2c05162,
      92093ae; test/select_after_dispose_test.dart)
- [x] E2E CI: qurilma qadami timeout bo'lsa qolgan emulyator o'chiriladi
      (E2E #58 dagi zanjirli osilish, 5d58f1c)
- Regression testlari: release_audit_fixes_test, app_lock_test,
  account_deleted_error_test — eski kodda yiqiladi
- Egasiga (kod xatosi emas): CI da `NOVA_KEYSTORE_BASE64` bo'lmasa AAB
  debug-imzo bilan yashil chiqadi (log: SIGNING: DEBUG) — secret joyida

## 5–6. Release

- [x] versionName 1.1.0 (pubspec) + versionCode = CI run_number (#219)
- [~] permissions / App Links / Data Safety mosligi
      * permissions (merged manifest, #219): INTERNET, ACCESS_NETWORK_STATE,
        WAKE_LOCK, NFC (required=false); rasm — Photo Picker
        (READ_MEDIA_* yo'q), kamera — intent (CAMERA yo'q)
      * App Links: https://nfcstore.uz /u /c /post /story /nfc, autoVerify
      * [x] BLOCKER tuzatildi (89613bc): sessiya tokeni Auto Backup va
        telefondan-telefonga ko'chirishdan chiqarildi + resetOnError
- [x] signed AAB + APK (CI `nova-apk.yml` #219, 92093ae; RELEASE imzo, v2,
      zipalign OK) — SHA-256 va havolalar PLAY_CONSOLE_HANDOFF.md da
- [x] Play skrinshotlar 1.1.0 dan qayta olindi (24-bit PNG), release notes UZ/RU/EN,
      `PLAY_CONSOLE_HANDOFF.md` (final publish tugmasi BOSILMAYDI)

## 7. Hisobot

- [ ] Final hisobot egasiga
