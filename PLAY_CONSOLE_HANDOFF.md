# PLAY CONSOLE HANDOFF — NFCSTORE 1.1.0 (uz.nfcstore.nova)

Yordamchi Claude uchun. Maqsad: Play Console'da **production relizini
TAYYORLASH**. Hammasi to'ldiriladi, tekshiriladi va "Review release"
ekranigacha olib boriladi.

> ## ⛔ FINAL TUGMANI BOSMA
>
> **"Start rollout to Production" / "Send changes for review" /
> "Начать развертывание" / "Отправить на проверку" tugmasini BOSMA.**
> Egasi o'zi bosadi. Sen faqat qoralama (draft) holatigacha olib
> borasan va egasiga "tayyor, bosishingiz mumkin" deysan.
>
> Parol, keystore, service-account JSON, demo hisob parolini hech
> qayerga (chat, fayl, commit, log) YOZMA.

---

## 0. QISQA HOLAT

| Nima | Qiymat |
|---|---|
| Ilova | NFCSTORE (`android:label`) |
| Paket | `uz.nfcstore.nova` — **o'zgarmaydi** |
| versionName | `1.1.0` (`mobile_nova/pubspec.yaml`) |
| versionCode | `219` (= CI `github.run_number`; Play'dagi oxirgi — 174) |
| Commit | `92093ae` (branch `claude/vibrant-einstein-p5lo1i`) — ilova kodi shu commitdan keyin o'zgarmagan (keyingi commitlar faqat hujjat) |
| Imzo (upload) | Yuklash (upload) kaliti, alias `nova`, SHA-256 `6F:79:CC:DA:FD:E4:04:CF:BA:29:96:4D:8C:CB:11:0C:0A:49:E0:D4:B9:8E:95:64:0A:68:50:02:68:B0:A9:3C` — AAB shu bilan imzolanadi |
| Play App Signing | **YOQILGAN**: Play'dan o'rnatilgan nusxalar Google kaliti bilan imzolanadi — SHA-256 `A3:15:12:FC:23:24:9B:EA:78:67:AB:A7:53:C1:19:7A:C4:87:95:63:74:8E:EC:03:22:1C:EA:87:19:61:95:BD` (oldingi: `69:1D:3F:A3:81:40:1B:BB:E6:F5:93:C7:F9:92:22:AC:0F:80:A2:94:63:77:9C:9D:76:A2:7D:9B:DC:B7:B3:6C`) |
| minSdk / targetSdk | 24 / 36 (Flutter 3.35.5) |
| Testlar | `flutter analyze — 0 muammo; unit/widget — 854 PASS, 1 SKIP (CI #219 da ham qayta o'tdi); server skriptlari (CI) — 253/0` |
| E2E (real hisob) | **#60 (92093ae) — PASS**: 97 PASS, 0 FAIL; qurilma 360/390/430 release ishga tushish + 30 layout ekran PASS; qolganlari — PARTIAL 3, BACKEND/CONFIG/DEVICE/MANUAL PAYMENT REQUIRED, SKIPPED 1 (kod xatosi emas: 2-sinov hisobi yo'q, to'lov qo'lda, emulyatorda video/ulashish yo'q). https://github.com/davlatsudekspert/nfcx/actions/runs/35960251762 |

---

## 1. AAB VA APK — QAYERDA

GitHub Actions → **NFCSTORE Mobile APK** workflow, run **#219**:

    https://github.com/davlatsudekspert/nfcx/actions/runs/35960215425

Artefaktlar (run sahifasining pastida, "Artifacts"):

| Artefakt nomi | Ichida | Nima uchun |
|---|---|---|
| `NFCSTORE-Mobile-PlayStore-aab` | `NFCSTORE-Mobile.aab` (51.8 MB) | **Play Console'ga shu yuklanadi** — to'g'ridan havola: https://github.com/davlatsudekspert/nfcx/actions/runs/35960215425/artifacts/10792700641 |
| `NFCSTORE-Mobile-universal-apk` | universal APK (64.0 MB) | har qanday telefonda sinash — https://github.com/davlatsudekspert/nfcx/actions/runs/35960215425/artifacts/10792501050 |
| `NFCSTORE-Mobile-telefon` | `arm64-v8a` APK (24.8 MB) | zamonaviy telefon uchun sinov — https://github.com/davlatsudekspert/nfcx/actions/runs/35960215425/artifacts/10792028476 |
| `NFCSTORE-Mobile-eski-telefon-armeabi-v7a` | 32-bit APK | eski telefon |
| `NFCSTORE-Mobile-emulyator-x86_64` | x86_64 APK | emulyator |
| `NFCSTORE-Mobile` | hammasi + `SHA256SUMS.txt` | yakuniy to'plam |

CI tasdiqlagan (`aapt2 dump badging`, `apksigner verify`):

    package uz.nfcstore.nova  versionCode=219  versionName=1.1.0  targetSdk=36
    SIGNING: RELEASE  (barmoq izi yuqoridagi SHA-256 bilan bir xil)
    zipalign: OK   apksigner: Verifies (v2)

> **Qaysi qurilish?** Aynan **#219** (commit `92093ae`). #207 dan keyin
> ilova kodi o'zgardi (performance, UI sifati, release auditi tuzatishlari,
> ID tanlovidagi poyga), shuning uchun **#207 ham, #215/#217 ham YUKLANMAYDI**
> — Play'ga #219 yuklanadi. #219 dan keyingi push'lar faqat hujjat: yangi
> APK yasamaydi. Real hisobli E2E — §0 dagi "E2E" qatoriga qarang.

SHA-256 (CI logidagi `SHA256SUMS.txt`, `release-final/`):

    6174488754d9b20758e54406115598a4c58a110f92a6d2b3a2c8fffc6e3602f6  NFCSTORE-Mobile.aab   (51 805 280 bayt)
    19f334c83efca95b7346b8c0a636c7ebc1598cdf3b5923b85d99ba2cec8aa2ad  NFCSTORE-Mobile.apk   (64 035 315 bayt)
    2e48565ac0000576759b358d4f0817427e12ddf5a778e3fa9229b8136649c127  NFCSTORE-Mobile-arm64-v8a.apk
    75d4c72364f99b811b9b6746fa2db60e512202c48541b18dbde151bf12646af7  NFCSTORE-Mobile-armeabi-v7a.apk
    44dbd19edb7d26e0a119126352eb0e9df661e34a2a98290b519d5dd7ad140645  NFCSTORE-Mobile-x86_64.apk

Yuklab olgandan keyin tekshirish: `sha256sum NFCSTORE-Mobile.aab` — yuqoridagi
bilan bir xil bo'lishi kerak.

### AAB ni Play'ga yuborishning ikki yo'li

**A. Qo'lda (tavsiya — egasi nazorat qiladi).** Artefaktni yuklab olib,
arxivdan `NFCSTORE-Mobile.aab` ni chiqarib, Play Console'dagi relizga
"Upload" qilasan.

**B. `Google Play'ga yuklash` workflow** (`.github/workflows/play-upload.yml`).
Faqat **sinov treklariga** yuklaydi (production'ga EMAS). Ishlatish:
Actions → "Google Play'ga yuklash" → Run workflow →
`mode=upload`, `run_id=35960215425`, `track=` (bo'sh — yopiq sinov),
`status=draft`. Keyin Console'da shu relizni production'ga "Promote"
qilish mumkin. `PLAY_SERVICE_ACCOUNT_JSON` secreti bo'lmasa bu yo'l
ishlamaydi — A yo'lidan bor.

---

## 2. BOSHLASHDAN OLDIN TEKSHIR (production kirish huquqi)

Shaxsiy (Individual, "Для себя") akkaunt 2023-11 dan keyin ochilgan
bo'lsa, **production'ga chiqish uchun yopiq sinov: 12 tester × 14 kun**
talab qilinadi (`docs/PLAY_TESTERLAR.md`).

Console → **Dashboard (Панель управления)**. Agar "Apply for
production access" / "Подать заявку на доступ к рабочей версии"
bloki ko'rinsa va hali tasdiqlanmagan bo'lsa — production treki YOPIQ.
Bu holda relizni **Closed testing** trekiga tayyorlaysan va egasiga
shuni aytasan. Bu KOD muammosi emas — Google akkaunt qoidasi.

---

## 3. CONSOLE — BOSQICHMA-BOSQICH

Asosiy havola: **https://play.google.com/console** → NFCSTORE.
Ichki sahifalar manzili shu shaklda (ID'larni brauzer manzilidan olasan):

    https://play.google.com/console/u/0/developers/<DEV_ID>/app/<APP_ID>/app-dashboard

Menyu nomlari inglizcha / ruscha berilgan.

### 3.1 Store listing (Основная страница в Google Play)

`Grow users → Store presence → Main store listing`
(`Привлечение пользователей → Страница в Google Play → Основная страница`)

Matnlar — `docs/PLAY_CONSOLE.md` §2 da **tayyor** (UZ asosiy, RU, EN):

| Maydon | Qiymat |
|---|---|
| App name (UZ) | `NFCSTORE: Raqamli vizitka` |
| App name (RU) | `NFCSTORE: Электронная визитка` |
| App name (EN) | `NFCSTORE: NFC Business Card` |
| Short description | §2.1 / §2.2 / §2.3 dagi qisqa tavsiflar |
| Full description | §2.1 / §2.2 / §2.3 dagi to'liq tavsiflar |

RU va EN tarjimalar: `Manage translations` → `Add your own
translations` → ru-RU, en-US.

**Grafika** (`Graphics`):

| Maydon | Fayl | O'lcham |
|---|---|---|
| App icon | `docs/play-assets/play-icon-512.png` | 512×512 |
| Feature graphic | `docs/play-assets/play-feature-1024x500.png` | 1024×500 |
| Phone screenshots | `docs/play-assets/telefon/*.png` (6 ta, tartib bo'yicha 1,2,3,5,7,8) | 1080×1920, 24-bit PNG |
| 7-inch tablet | `docs/play-assets/planshet-7/*.png` (4 ta) | 1200×1920 |
| 10-inch tablet | `docs/play-assets/planshet-10/*.png` (4 ta) | 1600×2560 |

Skrinshotlar 1.1.0 kodidan qayta olingan (yangi dizayn, 8-surat Noir
mavzu). Alfa kanal yo'q — Play qabul qiladi.

**Store settings** (`Store settings / Настройки страницы`):
Category — **Social (Социальные)**. Contact email — **egasi kiritadi**.
Website — `https://nfcstore.uz`.

### 3.2 App content (Контент приложения)

`Policy and programs → App content` (`Правила и программы → Контент приложения`)

| Bo'lim | Javob |
|---|---|
| **Privacy policy** | `https://nfcstore.uz/privacy` (saytda ishlaydi; `/maxfiylik` ham shu sahifa) |
| **Ads** (Реклама) | **Yes (tavsiya, egasi tasdiqlaydi)** — reklama SDK yo'q, LEKIN lentada bizneslar pullik ko'targan postlar "Homiylik / Sponsored" belgisi bilan chiqadi (FEATURED, `feedSponsored`, `hosting/api/featured.js`). Play buni to'g'ridan-to'g'ri sotilgan reklama deb hisoblaydi; "No" tanlansa tekshiruvchi Sponsored postni ko'rib rad etishi mumkin. "Yes" da do'konda "Contains ads" yorlig'i chiqadi |
| **Advertising ID** (Рекламный идентификатор) | **No** — ilova reklama ID ishlatmaydi: `com.google.android.gms.permission.AD_ID` yo'q, reklama/analitika SDK yo'q. targetSdk 36 — bu deklaratsiya MAJBURIY (oldin to'ldirilgan bo'lsa, faqat tekshir) |
| **App access** | "All or some functionality is restricted" → demo hisob (§3.3) |
| **Content rating** | §3.4 |
| **Target audience** | **18 and over** (maxfiylik siyosati: "faqat 18 yoshdan katta") |
| **News app** | No |
| **Data safety** | §3.5 |
| **Government app** | No |
| **Financial features** | "My app doesn't provide any financial features" |
| **Health** | No |
| **Account deletion** | In-app: Sozlamalar → Xavfsizlik → Hisobni o'chirish. Web: `https://nfcstore.uz/delete-account`. ⚠️ §3.5 dagi "HISOBNI O'CHIRISH — BLOKER" |

### 3.3 App access — demo hisob

`docs/PLAY_CONSOLE.md` §9 va §10. Demo hisobni **egasi** yaratadi
(NFC ID biriktirilgan, profili to'ldirilgan, **Premium faol** — izoh
yozish faqat Premium/sinovdagilarga ochiq). Email/parolni faqat
Console formasiga egasi yozadi. Izoh matni (§10) tayyor, nusxala.

### 3.4 Content rating (Возрастные ограничения)

Kategoriya: **Social networking / UGC**.

| Savol | Javob |
|---|---|
| Users can interact / share content | **Yes** (post, istorya, Reels, izoh, obuna) |
| Users can share location with each other | **No** (joylashuv ruxsati yo'q) |
| Digital purchases | **No** (ilovada to'lov yo'q — `store_policy.dart`; saytga yo'naltiruvchi matn bor — §7) |
| Violence / sexual / drugs / gambling / profanity | **No** |
| Moderation & reporting | Shikoyat, bloklash, admin moderatsiyasi bor |

### 3.5 Data safety (Безопасность данных) — koddan tekshirilgan

Tekshirilgan: `pubspec.yaml` da analitika/reklama/crash SDK **yo'q**
(Firebase, AdMob, Crashlytics yo'q). Tarmoq faqat HTTPS
(`usesCleartextTraffic="false"`). Sessiya tokeni zaxira nusxaga
tushmaydi (`backup_rules.xml`, `data_extraction_rules.xml`).

| Savol | Javob |
|---|---|
| Collects or shares user data? | **Yes, collects** |
| Account creation methods | **Username, password and other authentication** (email + parol + emailga yuborilgan tasdiqlash kodi) |
| Delete some data without deleting account? | **No** (post/izohni o'chirish mumkin, lekin o'chirilgan kontent dalil arxiviga ko'chadi — "HISOBNI O'CHIRISH — BLOKER" ga qarang) |
| Shared with third parties? | **No** |
| Encrypted in transit? | **Yes** |
| Users can request deletion? | **Yes** (ilovada: Sozlamalar → Xavfsizlik → Hisobni o'chirish; saytda `https://nfcstore.uz/delete-account`) — ⚠️ pastdagi "HISOBNI O'CHIRISH — BLOKER" ni o'qi |

Yig'iladigan turlar (hammasi: *Collected*, *not shared*, *not
processed ephemerally*):

| Play kategoriyasi | Tur | Majburiy? | Maqsad |
|---|---|---|---|
| Personal info | Name | Required | Account management, App functionality |
| Personal info | Email address | Required | Account management |
| Personal info | Phone number | Required | Account management |
| Personal info | User IDs | Required | Account management, App functionality |
| Personal info | Address | Optional | App functionality (profil/biznes kontakt manzili, ommaviy profilda ko'rinadi) |
| Photos and videos | Photos | Optional | App functionality, Fraud prevention, security, and compliance |
| Photos and videos | Videos | Optional | App functionality, Fraud prevention, security, and compliance |
| Audio | Music files | Optional | App functionality (profil musiqasi) |
| App activity | App interactions (layk, obuna, ilova ochilishlari soni va vaqti) | Required | App functionality, Analytics |
| App activity | Other user-generated content (post, izoh, bio, ijtimoiy tarmoq havolalari, veb-sayt, qo'llab-quvvatlash xabari, shikoyat izohi) | Optional | App functionality, Fraud prevention, security, and compliance |
| App activity | In-app search history (Tanlov/katalog qidiruvi) | Optional | App functionality ("processed ephemerally" — belgilamang: Worker loglari yoqilgan) |

**YIG'ILMAYDI** (No): Location, Contacts, Calendar, Messages (SMS/DM),
Health, Financial info (to'lov ilovada yo'q), Web browsing, Device or
other IDs, Crash logs, Diagnostics.

O'chirishdan keyin: profil va kontent darhol ommadan olinadi; qonun
talabi bo'yicha yopiq arxiv saqlanadi (maxfiylik siyosatida yozilgan) —
Play formasida "some data may be retained for legal reasons" deb belgila.

> ⚠️ **HISOBNI O'CHIRISH — BLOKER (server, egasining qarori kerak).**
> Hozir `DELETE /api/account` (`hosting/api/account.js:619-631`) faqat
> YUMSHOQ o'chirish qiladi: `users.deleted_at` qo'yiladi va sessiyalar
> o'chadi. Email, telefon, parol xeshi, profil, postlar va R2 media bazada
> qoladi va qaytariladigan holatda turadi; avtomatik tozalash (cron) yo'q.
> Google Play buni "deactivation" deb hisoblaydi, o'chirish emas. Xavfsiz
> yechim rejasi: `ACCOUNT_DELETION_PLAN.md` (grace muddat → shaxsiy
> ma'lumot va kontentni o'chirish/anonimlash; moliyaviy yozuvlar va dalil
> arxivi qonun bo'yicha saqlanadi). Server o'zgarishi productionga faqat
> egasi tasdiqlagandan keyin chiqadi. Shu tuzatilmaguncha Data safety'dagi
> "Users can request deletion: Yes" javobi kodga to'liq mos emas.

### 3.6 Ruxsatlar (permissions) — CI tasdiqlagan

CI "Ruxsatlar auditi" qadami release APK'dan (`aapt2 dump permissions`):

    android.permission.ACCESS_NETWORK_STATE   (normal — video pleyer, tarmoq holati)
    android.permission.INTERNET               (normal)
    android.permission.NFC                    (normal)
    android.permission.WAKE_LOCK              (normal — video o'ynaganda ekran o'chmasin)

Hammasi "normal" (o'rnatishda beriladi, odamdan so'ralmaydi). Xavfli
(runtime) ruxsat **yo'q** — CI buni har qurilishda tekshiradi va
joylashuv/kontakt/mikrofon/SMS ruxsati paydo bo'lsa qurilishni yiqitadi. NFC `required="false"` — NFC'siz telefon ham
o'rnatadi. Rasm/video tizim tanlagichi orqali (READ_MEDIA_* yo'q),
kamera intent orqali (CAMERA yo'q).

### 3.7 App Links

`AndroidManifest.xml`: `https://nfcstore.uz` — `/u`, `/c`, `/post`,
`/story`, `/nfc` (autoVerify). `assetlinks.json` (`wrangler.jsonc` →
`ANDROID_NOVA_FINGERPRINTS`) uchala barmoq izini beradi: Play App Signing
`A3:15…95:BD`, oldingi `69:1D…B3:6C`, upload `6F:79…A9:3C` (§0).
Console → App integrity dagi "App signing key" SHA-256 shu ro'yxatda
borligini tekshir. Console → `Grow users → Deep links` bo'limida holatini ko'rish
mumkin — o'zgartirish shart emas.

### 3.8 Reliz yaratish (FINAL TUGMASIZ)

`Test and release → Production` (`Тестирование и выпуск → Рабочая версия`)
→ **Create new release** (`Создать выпуск`):

0. `Production → Countries / regions` (`Страны и регионы`) — agar bu
   trekda hali mamlakat tanlanmagan bo'lsa, kamida **O'zbekiston** qo'sh
   (qolganini egasi hal qiladi). Tanlanmasa "Send for review" bloklanadi.

1. App bundles → **Upload** → `NFCSTORE-Mobile.aab` (§1). Play versionCode
   `219` va versionName `1.1.0` ni ko'rsatishi kerak.
   Play App Signing yoqilgan — AAB upload kaliti (`6F:79…A9:3C`) bilan
   imzolangan bo'lishi kerak; boshqa kalit bo'lsa Console rad etadi.
2. Release name: `1.1.0 (219)`.
3. Release notes — §4 dagi matnlar (`<uz>`, `<ru-RU>`, `<en-US>`).
4. **Next** / **Далее** → "Review release" sahifasi. Xato (qizil)
   bo'lsa — tuzat; ogohlantirish (sariq) bo'lsa — egasiga yoz.
5. **SHU YERDA TO'XTA.** "Start rollout to Production" / "Send for
   review" ni BOSMA. Egasiga: "Reliz tayyor, Review sahifasida,
   bosishingiz mumkin" deb xabar ber.

Rollout foizi tavsiyasi (egasi tanlaydi): birinchi kun **20%**, xato
bo'lmasa 100%.

---

## 4. RELEASE NOTES (500 belgigacha)

```
<uz>
• Pastki menyu yangilandi: ikonlar va yozuvlar kattaroq, faol bo'lim aniq
• Reels tezroq ochiladi; boshqa ekranga o'tsangiz video to'xtaydi
• Internet uzilsa hisobdan chiqib ketmaysiz — ilova o'zi qayta ulanadi
• Kompaniya postlari va istoryalari to'g'ri ochiladi va ulashiladi
• Katta videolar telefon xotirasini to'ldirmasdan yuklanadi (100 MB gacha)
• Gold, Premium va Exclusive NFC ID'lar yangi premium ko'rinishda
• Ko'plab kichik tuzatishlar
</uz>
<ru-RU>
• Обновлено нижнее меню: крупнее значки и подписи, понятный активный раздел
• Reels открываются быстрее; при переходе на другой экран видео останавливается
• При потере интернета вы не выходите из аккаунта — приложение переподключится само
• Посты и истории компаний открываются и отправляются правильно
• Большие видео загружаются без перегрузки памяти телефона (до 100 МБ)
• Новый премиальный вид NFC ID Gold, Premium и Exclusive
• Множество мелких исправлений
</ru-RU>
<en-US>
• Refreshed bottom menu: larger icons and labels, clear active tab
• Reels open faster; video stops when you switch to another screen
• Losing your connection no longer signs you out — the app reconnects on its own
• Company posts and stories now open and share correctly
• Large videos upload without filling the phone's memory (up to 100 MB)
• New premium look for Gold, Premium and Exclusive NFC IDs
• Many smaller fixes
</en-US>
```

---

## 5. ASSETLAR — TAYYOR / YO'Q

| Asset | Holat | Yo'l |
|---|---|---|
| App icon 512×512 | ✅ tayyor | `docs/play-assets/play-icon-512.png` |
| Feature graphic 1024×500 | ✅ tayyor | `docs/play-assets/play-feature-1024x500.png` |
| Telefon skrinshotlari (min 2) | ✅ 6 ta | `docs/play-assets/telefon/` |
| 7" planshet skrinshotlari | ✅ 4 ta | `docs/play-assets/planshet-7/` |
| 10" planshet skrinshotlari | ✅ 4 ta | `docs/play-assets/planshet-10/` |
| Launcher adaptive icon | ✅ ilovada | `res/mipmap-anydpi-v26/ic_launcher.xml` |
| Themed (monochrome) icon | ➖ yo'q (ixtiyoriy, Android 13+) | — |
| Promo video (YouTube) | ➖ yo'q (ixtiyoriy) | — |
| Chromebook / Wear / TV | ➖ kerak emas | — |

---

## 6. EGASI QILADIGAN QO'LDA ISHLAR (kod bilan bog'liq emas)

1. Demo hisob (App access) — yaratish va parolni Console'ga kiritish.
2. Contact email — Store settings'ga.
3. Production kirish huquqi (§2) — agar hali yo'q bo'lsa, yopiq sinov.
4. **Final "Start rollout / Send for review"** — faqat egasi.
5. `nova.jks` zaxira nusxasi egasida bo'lishi (yo'qolsa ilovani
   yangilab bo'lmaydi).

## 7. MA'LUM CHEKLOVLAR (release'ni to'xtatmaydi)

* **Anti-steering xavfi (egasining qarori):** NFC ID bozori, post
  ko'tarish (Featured) va biznes tarif limiti ekranlarida narx va
  "...saytda rasmiylashtiriladi: nfcstore.uz" matni bor
  (`kShowSiteNotice = true`, `store_policy.dart:61`). Ilovada xarid
  tugmasi yo'q, lekin Play Payments qoidasi raqamli tovar uchun tashqi
  to'lovga yo'naltiruvchi xabarni ham taqiqlaydi — rad etilishi mumkin.
  Tez chora: `kShowSiteNotice = false` → yangi qurilish (versionCode >
  219). Egasi buni yuklashdan OLDIN ham tanlashi mumkin.

* Katta video birinchi ochilishda sekinroq bo'lishi mumkin: o'lchovda
  asosiy ulush server tomonda (Worker → R2, videolar edge keshda emas).
  Tavsiya: video Range so'rovida bitta R2 `get`, yuklashda faststart.
  Ilova tomoni tuzatildi (preload navbati, parallel so'rovlar).
* Jismoniy NFC yozish va NFC skaner — haqiqiy karta bilan qurilmada
  sinaladi (emulyatorda NFC yo'q).
