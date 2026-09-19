# NFCSTORE Nova — yakuniy funksional audit

Statuslar: **DONE** · **PARTIAL** · **BACKEND REQUIRED** ·
**CONFIG REQUIRED** · **DEVICE REQUIRED** · **FAILED**

"UI yozilgan" = DONE emas. DONE deb faqat Flutter tomoni ham,
backend kontrakti ham tekshirilgan narsa belgilangan.

Tekshiruv usuli: `mobile_nova/lib` dagi har bir `_api` chaqiruvi
`server/index.js` (146 route) va `hosting/worker.js` + `hosting/api/*`
dagi haqiqiy marshrutlar bilan skript orqali solishtirildi; har bir
`onTap`/`onPressed` (219 ta) statik auditdan o'tkazildi.

---

## 1. Shu bosqichda TUZATILGAN buzuqliklar

Bular ilovada UI sifatida bor edi, lekin **umuman ishlamasdi**.

| Nima | Sabab | Holat |
|---|---|---|
| Post va istorya joylash | `hosting/worker.js` tanada `agreed: true` talab qiladi (`rulesAcceptedD1`), ilova yubormasdi → har safar `422 rules_not_accepted` | **DONE** |
| Kompaniyani tahrirlash | ilova `PUT`, server `PATCH` kutadi → saqlash hech qachon saqlamagan | **DONE** |
| Kompaniya katalogini o'qish | `GET /api/companies/:id/catalog` mavjud emas; katalog `GET /api/companies/:id` javobidagi `company.catalog` ichida | **DONE** |
| Katalog elementini tahrirlash | ilova `PUT`, server `PATCH` | **DONE** |
| Jismoniy kartani uzish | ilova `DELETE /api/my/nfc-devices/:id`, bunday endpoint yo'q; serverda `PUT` bilan `linkedCode: ''` | **DONE** |
| Post tafsiloti | `GET /api/posts/:id` mavjud emas → ekran **har doim** xato panelini ko'rsatardi; endi yozuv ro'yxatidan olinadi | **DONE** |
| Profil to'ldirishda avatar | `onTap: () {}` — o'lik tugma | **DONE** |
| Izohlar | backend tayyor edi (`/api/comments/:kind/:id`), ilovada o'zgarmas "izohlar yo'q" yozuvi turardi | **DONE** |
| Shikoyat va bloklash | backend tayyor edi (`hosting/api/moderation.js`), ilovada kirish nuqtasi yo'q edi | **DONE** |

---

## 2. Feature bo'yicha status

### Auth va sessiya
| Feature | Status | Izoh |
|---|---|---|
| Email + parol bilan kirish | DONE | `POST /api/auth/login` |
| Ro'yxatdan o'tish | DONE | tasdiqlash kodi Telegram bot orqali telefonga |
| Sessiyani tiklash | DONE | token Keystore/Keychain ichida |
| Chiqish | DONE | |
| **Email orqali kirish kodi** | **BACKEND REQUIRED** | `POST /api/auth/request-email-code` serverda YO'Q. Backend'da umuman email infratuzilmasi yo'q (SMTP/nodemailer topilmadi). Ilova soxta muvaffaqiyat ko'rsatmaydi — `endpointMissing` holatini ochiq aytadi |
| Parolni tiklash | DONE | `POST /api/settings/request-password-code` |

### Kontent joylash
| Feature | Status | Izoh |
|---|---|---|
| Kontent qoidalari darvozasi | DONE | matn saytdagi `ContentRulesGate.jsx` dan aynan; UZ/RU/EN; birinchi publishda to'liq, keyin qisqa eslatma; Sozlamalardan qayta ochiladi |
| Post yaratish (matn + rasm) | DONE | |
| Istorya yaratish | DONE | |
| Reel yaratish (video) | DONE | |
| Media yuklash (progress) | DONE | `POST /api/upload`, progress + xato + qayta urinish |
| Post o'chirish | DONE | `DELETE /api/posts/:id` |
| **Post tahrirlash** | **BACKEND REQUIRED** | serverda post yangilash endpointi yo'q (faqat POST va DELETE) |
| **Istorya tahrirlash** | **BACKEND REQUIRED** | `gallery` da ham faqat qo'shish va o'chirish bor |
| Istoryani o'chirish | DONE | `DELETE /api/records/:code/gallery/:id` |
| Yuklashni bekor qilish | PARTIAL | progress va xato bor; oqimni o'rtasida to'xtatish yo'q |

### Ijtimoiy
| Feature | Status | Izoh |
|---|---|---|
| Lenta | DONE | `GET /api/news` |
| Yoqtirish / bekor qilish | DONE | optimistik, server xato bersa orqaga qaytadi |
| **Saqlash (save/unsave)** | **BACKEND REQUIRED** | serverda bunday endpoint yo'q |
| Kuzatish / bekor qilish | DONE | optimistik + rollback |
| Ulashish | DONE | tizim ulashish oynasi |
| Izohlar (ro'yxat, yozish, o'chirish) | DONE | `/api/comments/:kind/:id` |
| Shikoyat qilish | DONE | `POST /api/reports`, sabablar serverdagi yopiq ro'yxat bilan bir xil |
| Profilni bloklash / blokdan chiqarish | DONE | `/api/blocks` |
| Story ko'ruvchi | DONE | |
| **Story "ko'rilgan" holati** | **BACKEND REQUIRED** | `seen` maydoni javobda bor, lekin uni BELGILAYDIGAN endpoint yo'q. Home orbidagi halqa mavjud `seen` qiymatini o'qiydi — o'zi to'qimaydi |

### Reels
| Feature | Status | Izoh |
|---|---|---|
| Vertikal scroll, video ijro | DONE | faqat ko'rinayotgan video yaratiladi, qolgani butunlay yo'q qilinadi |
| Audio konflikti | DONE | `AudioOwner` — bir vaqtda bitta manba; reels ochilsa musiqa to'xtaydi |
| Yoqtirish | DONE | |
| Reel yaratish | DONE | |
| Reels izohlari | PARTIAL | backend `kind` ni qo'llaydi; UI hozircha post ekranida |

### Musiqa
| Feature | Status | Izoh |
|---|---|---|
| Manba | DONE | `cards.music_url` → `musicUrls` (maks 5). **Shaxsiy va biznes yozuvlarda bir xil** — bu karta maydoni |
| Boshqaruv ko'rinishi | DONE | avatar/orbning pastki chapida; musiqa yo'q bo'lsa umuman chizilmaydi |
| Mini-pleyer | DONE | play/pause, progress, seek, yopish |
| Autoplay yo'qligi | DONE | faqat foydalanuvchi bosgandan keyin |
| Fon/qaytish | DONE | fonga ketsa to'xtaydi, o'zi qayta boshlamaydi |
| **Qo'shiq nomi va ijrochi** | **BACKEND REQUIRED** | serverda bunday maydon YO'Q — ilova manzildan olingan fayl nomini ko'rsatadi, ijrochini to'qimaydi |
| Musiqani ilovadan yuklash | PARTIAL | server `/uploads/...` ni qabul qiladi; ilovada audio tanlash oynasi yo'q |

### Biznes va katalog
| Feature | Status | Izoh |
|---|---|---|
| Kompaniya yaratish | DONE | |
| Kompaniyani tahrirlash | DONE | PATCH ga tuzatildi |
| Katalog: qo'shish / tahrirlash / o'chirish | DONE | PATCH ga tuzatildi |
| Yozuv katalogi (menu/services/products) | DONE | uchala turi ham |
| Biznes analitikasi | DONE | `GET /api/records/:code/analytics` |
| Lidlar | DONE | `GET /api/records/:code/leads` |

### NFC
| Feature | Status | Izoh |
|---|---|---|
| NFC ID ro'yxati, tafsiloti | DONE | |
| Asosiy ID tanlash | DONE | |
| Sovg'a yuborish | DONE | `POST /api/records/:code/gift` |
| Kelgan sovg'alarni ko'rish/qabul qilish | DONE | `/nfc/gifts` ekrani. Repozitoriydagi javob o'quvchisi ham tuzatildi: server `{incoming, outgoing}` qaytaradi, kod esa `offers`/`items` izlardi — ro'yxat har doim bo'sh chiqardi |
| QR ko'rsatish / ulashish | DONE | |
| Jismoniy kartani bog'lash / uzish | DONE | uzish PUT ga tuzatildi |
| **Qurilmada NFC o'qish** | **DEVICE REQUIRED** | kod `nfc_manager` bilan tayyor va apparat yo'qligini yashirmaydi; emulyatorda tekshirib bo'lmaydi |

### Xavfsizlik va sozlamalar
| Feature | Status | Izoh |
|---|---|---|
| Lokal ilova qulfi (PIN) | DONE | PIN Keystore ichida, `SharedPreferences` da emas — test qo'riqlaydi |
| **Biometrika** | **FAILED (qaytarildi)** | `local_auth` qo'shilganda Android buildi R8 bosqichida QOTIB QOLDI. Uch urinishda ham (ikkitasi qayta ishga tushirish, bittasi Gradle xotirasi tuzatilgandan keyin) build aynan "Universal APK" bosqichida 40–60 daqiqa osilib turdi va xatolik ham bermadi; paketsiz esa ~7 daqiqada o'tadi. Paket olib tashlandi, qulf FAQAT PIN bilan ishlaydi — bu to'liq ishlaydigan himoya. Qaytarish uchun R8/`androidx.biometric` o'zaro ta'sirini aniqlash kerak |
| Parolni almashtirish | DONE | |
| Mavzu, til | DONE | 5 mavzu, 3 til |
| Bildirishnoma sozlamalari | PARTIAL | tanlov lokal saqlanadi; serverga yuborilmaydi (endpoint yo'q) |
| Maxfiylik + bloklanganlar | DONE | |
| **Akkauntni o'chirish** | **BACKEND REQUIRED** | hozir `ACCOUNT_DELETE_REQUEST` matni bilan qo'llab-quvvatlash xizmatiga so'rov yuboradi. Bu HALOL, lekin Google Play ilova ichida haqiqiy o'chirishni talab qiladi |
| Buyurtmalar, to'lov tarixi | DONE | |
| Referal, Premium | DONE | |
| Qo'llab-quvvatlash | DONE | `POST /api/support` |

### Bildirishnomalar
| Feature | Status | Izoh |
|---|---|---|
| Faoliyat lentasi | DONE | `GET /api/activity` |
| O'qilgan/o'qilmagan | PARTIAL | ko'rsatiladi; serverda belgilash endpointi yo'q |
| **Push / FCM** | **BACKEND REQUIRED** | na serverda, na `hosting/` da FCM yoki push token infratuzilmasi yo'q. Ilovada push YO'Q va u bordek ko'rsatilmaydi |

### Moderatsiya
| Feature | Status | Izoh |
|---|---|---|
| Shikoyat, bloklash | DONE | |
| Admin navbati | DONE (server) | `/api/admin/reports` — admin paneli veb tomonda |
| **Avtomatik (AI) moderatsiya** | **BACKEND REQUIRED** | server tomonda bunday tekshiruv yo'q. Ilova uni ishlayotgandek KO'RSATMAYDI — mijoz tomondagi ogohlantirish moderatsiyaning o'rnini bosmaydi |

---

## 3. CONFIG REQUIRED

| Nima | Izoh |
|---|---|
| **Reliz imzo kaliti** | Barcha buildlar hozir DEBUG kalit bilan imzolanadi. Play Store uchun haqiqiy keystore va `android/key.properties` kerak. CI buni aniqlaydi va hisobotda "DEBUG kaliti" deb yozadi |
| To'lov hisob ma'lumotlari | Payme/Click/Paynet kalitlari server muhitida; ilova faqat server bergan holatni ko'rsatadi |
| `NOVA_API_BASE` | Standart `https://nfcstore.uz`; staging uchun `--dart-define` |

---

## 4. DEVICE REQUIRED — emulyator/E2E

Android SDK bu muhitda **mavjud emas**: `dl.google.com` va
`maven.google.com` tarmoq siyosati bilan yopilgan (403), Debian
paketidagi `android-sdk` esa API 23 — ilovaning minSdk 24 sidan past.
Shuning uchun:

* **emulyatorda real E2E test bajarilmadi** — bu haqiqat, "o'tdi" deb
  yozilmaydi;
* APK/AAB CI (GitHub Actions) orqali quriladi va u yerda barcha
  bosqichlar bajariladi;
* vizual tekshiruv haqiqiy `NovaApp` + `routerProvider` ustida
  Flutter web orqali qilindi (gallereya harnessi ekranlarni chetlab
  o'tmaydi);
* qurilmada tekshirilishi kerak: NFC o'qish/yozish, biometrika,
  kamera/galereya, push (kelgusida), haqiqiy video ijro.

---

## 5. Sinov qamrovi

```
flutter analyze   0 muammo
flutter test      107 test
```

Yangi doimiy qo'riqchilar: kontent qoidalari matnining sayt bilan
belgima-belgi mosligi; `agreed` maydonining tushib qolmasligi;
PIN ning `SharedPreferences` ga yozilmasligi; musiqa yo'q bo'lsa
boshqaruvning umuman chizilmasligi; bir vaqtda bitta audio; orb
markazlarida plastina ishlatilmasligi; `lib/` da demo ma'lumot
bo'lmasligi.

---

## 6. Reliz oldidan MAJBURIY qoladigan ishlar

1. **Reliz imzo kaliti** (CONFIG REQUIRED) — busiz Play Store'ga
   yuklab bo'lmaydi.
2. **Akkauntni ilova ichida o'chirish** (BACKEND REQUIRED) — Google
   Play talabi.
3. Qurilmada NFC va media oqimlarini tekshirish (DEVICE REQUIRED).
4. Email kodi bilan kirishni yopish yoki backend'da email
   infratuzilmasini qo'shish.
5. **Biometrik qulfni qaytarish** — `local_auth` bilan R8 nima uchun
   qotib qolishini aniqlash (`-keep`/`-dontwarn androidx.biometric.**`
   yoki `android.enableR8.fullMode=false` bilan sinab ko'rish).
   Hozir qulf PIN bilan to'liq ishlaydi, biometrika esa YO'Q va
   bordek ko'rsatilmaydi.

---

## 7. Yakuniy build — CI #16 (`c5869f0`)

Auditdan o'tgan commit AYNAN shu: `c5869f0e103a15597691bb9185cb158ca50eaf70`.

Ishga tushish: <https://github.com/davlatsudekspert/nfcx/actions/runs/35440618646>
Artefakt (30 kun): `nfcstore-nova-apk`, ID `10583458483`,
zip SHA-256 `7b11c85f05d51fbdcdc342f07b394dddedc117e66d3cdbe53c6b88921fe82fa3`

| Fayl | Hajm | SHA-256 |
|---|---|---|
| `app-release.apk` (Universal) | 56.3 MB | `ef41905d164c8de3d305685cf17989b3eda6c78677e33982df284b686b9b87db` |
| `app-arm64-v8a-release.apk` | 21.8 MB | `3a3c510814b8e6225c7bcd87ec6bfba0182deb8bc10e3b0fcebcd61eb3d0fc46` |
| `app-armeabi-v7a-release.apk` | 19.7 MB | `34037ca758fa8ceda7faac6c28378541d0b04f4e9c74dabd46a4188389ae1dc5` |
| `app-x86_64-release.apk` | 23.0 MB | `6bf3c92c67a5ee410be41d5a28b1ea9b9ae33c92360638186756df24aa8fbcd4` |
| `app-release.aab` (Play Store) | 47.1 MB | `46b5da4ec0732a2a96643aec9a82e08719099494938f76a44df7dc6a4fd49cae` |

Versiya: `1.0.0` (`versionCode` = 16, CI `run_number` dan).
Paket: `uz.nfcstore.nova` — `aapt2 dump packagename` bilan tekshirildi.

Tayyor APK ichidagi ruxsatlar (manifestda 3 ta, plaginlar 2 ta
qo'shadi):

* `android.permission.INTERNET` — manifestdan;
* `android.permission.NFC` — manifestdan;
* `android.permission.ACCESS_NETWORK_STATE` — `connectivity_plus`;
* `android.permission.WAKE_LOCK` — `video_player`.

Joylashuv, mikrofon, kontaktlar, SMS, telefon holati — **yo'q**.
CI bu ro'yxatni har buildda tekshiradi va kutilmagani chiqsa
qurilishni to'xtatadi.

### `local_auth` tashxisi TASDIQLANDI

Paket olib tashlangandan keyin "Universal APK" bosqichi **4 daq 12 s**
da tugadi (butun ish — 5 daq 39 s). Xuddi shu bosqich `local_auth`
bilan uch marta 40–60 daqiqa osilib turgan edi. Ya'ni sabab taxmin
emas, o'lchangan.

### YANGI TOPILGAN MUAMMO — imzo kaliti har buildda O'ZGARADI

`NOVA_KEYSTORE_BASE64` sozlanmagani uchun Gradle `~/.android/debug.keystore`
ga tushadi, GitHub runner esa har safar TOZA mashina — ya'ni kalit
har ishga tushishda QAYTADAN yaratiladi:

| Build | Barmoq izi (SHA-256) |
|---|---|
| #12 (`8f523d8`) | `2E:E4:7C:75:FD:AD:54:E8:…` |
| #16 (`c5869f0`) | `EB:B8:78:17:CF:C1:16:E7:…` |

Amaliy oqibati: **bir buildning APK'si ikkinchisining ustiga
o'rnatilmaydi** — Android `INSTALL_FAILED_UPDATE_INCOMPATIBLE`
beradi. Sinovchi yangi APK olganda avval eskisini o'chirishi kerak,
va bu holda ilova ichidagi ma'lumot (token, PIN, sozlamalar) ham
yo'qoladi.

Bu CONFIG REQUIRED bandining bir qismi: haqiqiy keystore
sozlangach muammo o'z-o'zidan yo'qoladi.

---

## 8. HAQIQIY HISOB E2E — statik audit KO'RMAGAN buzuqliklar

CI ishi: <https://github.com/davlatsudekspert/nfcx/actions/runs/35442474771>

Bu bo'lim alohida turadi, chunki quyidagilarning HECH BIRINI kod
o'qib topib bo'lmagan edi. Ularning hammasi "endpoint bor, metod
bor, UI bor" edi — va hammasi ishlamasdi. Faqat haqiqiy hisob bilan
haqiqiy serverga borgandan keyin ko'rindi.

| Nima | Server nima kutadi | Ilova nima yuborardi | Natija |
|---|---|---|---|
| **Rasm yuklash** | `POST /api/upload` tanasida JSON: `{"dataUrl":"data:image/png;base64,..."}` | `multipart/form-data` | **422 `bad_image` — HAR SAFAR** |
| **Post yaratish** | `{imageUrl \| videoUrl, caption, agreed}`; media MAJBURIY | `{text, media:[], agreed}` | **422 `bad_image` — HAR SAFAR** |
| **Istorya** | `/api/records/:code/stories` | `/api/records/:code/gallery` | boshqa feature'ga borardi |

### Nima uchun bu jiddiy

Uchala buzuqlik BIR-BIRIGA bog'langan: rasm yuklanmagani uchun post
ham, istorya ham, avatar ham, muqova ham, katalog rasmi ham
yaratilmasdi. Ya'ni **ilovadan kontent joylashning birorta yo'li
ishlamasdi**.

Xato foydalanuvchiga "rasm yaroqsiz" bo'lib ko'rinardi — aslida rasm
serverga umuman yetib bormagan edi.

### Tafsilotlar

**1. `/api/upload` — multipart emas, `data:` URL.**

Serverda:

```js
const body = await request.json().catch(() => ({}));
const match = UPLOAD_IMAGE_RE.exec(String(body.dataUrl || ''));
if (!match) return json({ error: 'bad_image' }, 422);
```

`request.json()` multipart tanani o'qiy olmaydi; `catch` uni bo'sh
obyektga aylantiradi va `dataUrl` `undefined` bo'ladi. Shakl qat'iy:
`data:image/(png|jpeg|jpg|webp|gif);base64,...`.

Hajm base64 OCHILGANDAN keyin o'lchanadi: oddiy rasm 700 KB, gif
3 MB, `kind: 'cover'` 20 MB.

Tuzatildi: `ApiClient.uploadDataUrl`. MIME kengaytmadan emas, SEHRLI
BAYTLARDAN aniqlanadi — galereyadagi `.jpg` nomli fayl ichi HEIC
bo'lishi mumkin.

Video boshqa yo'ldan boradi: `/api/upload-card-video` tanani xom
binar sifatida oqim bilan o'qiydi (`streamUploadToR2`), base64
ishlatilmaydi — u videoda hajmni 33% oshirardi.

**2. Post — `caption`/`imageUrl`, `text`/`media` emas.**

```js
const imageUrl = String(body?.imageUrl || '');
const videoUrl = String(body?.videoUrl || '');
const caption  = String(body?.caption  || '').slice(0, 600);
if (!okImg && !okVid) return json({ error: 'bad_image' }, 422);
```

Haqiqiy javob:

```
POST /api/records/VIP001/posts
{"text":"...","media":[],"agreed":true}   ->   422 bad_image
```

**MEDIA MAJBURIY**: faqat matnli post server tomonidan umuman
qo'llab-quvvatlanmaydi. Endi UI buni oldindan aytadi va bo'sh
so'rov yuborilmaydi.

O'qish tomoni ishlayotgan edi, chunki `Post.fromJson` allaqachon
`j['text'] ?? j['caption']` ni o'qiydi — shuning uchun ro'yxat
to'g'ri ko'rinib, YARATISH jimgina ishlamasdi.

**3. Istorya — `/stories`, `/gallery` emas.**

`/api/records/:code/gallery` MAVJUD, lekin u butunlay boshqa narsa:
`hosting/api/media.js` dagi KARTA GALEREYASI (`card_gallery`
jadvali, biznes yozuvlari uchun statik rasmlar). Istorya esa
`stories` jadvalida:

```
GET    /api/records/:code/stories   -> { stories: [...] }
POST   /api/records/:code/stories
DELETE /api/stories/:id
POST   /api/stories/:id/view
```

`StoryItem.fromJson` ham tuzatildi: server media'ni `imageUrl` va
`videoUrl` deb IKKI maydonda beradi, `type` degan maydon yo'q —
ilgari video istoryalar bo'sh chiqardi.

### Shu bilan birga TUZATILGAN tavsif xatosi

`POST /api/stories/:id/view` **BOR**. Yuqorida (2-bo'lim) "Story
ko'rilgan holati — BACKEND REQUIRED" deb yozilgan edi, bu NOTO'G'RI.
`markStorySeen` qo'shildi.

### Yangi BACKEND REQUIRED — haqiqiy 404 bilan tasdiqlangan

| Endpoint | Holat |
|---|---|
| `GET /api/my/nfc-devices` | **404 `not_found`** — bu yo'l faqat `server/index.js` (Express) da bor, `nfcstore.uz` ni esa Cloudflare Worker xizmat qiladi. Ya'ni jismoniy karta ro'yxati produksiyada UMUMAN ishlamaydi |

### `x-client` — kirish tokeni

Backend mobil mijozni `new Set(['mobile','android','ios'])` bilan
TO'LIQ moslikda tekshiradi. Nova `android-nova` yuborardi va bu
to'plamga tushmasdi, shuning uchun `/api/auth/login` javob TANASIDA
token qaytarmasdi. Kirish faqat `Set-Cookie` ni qo'lda o'qish
hisobiga tirik edi. Endi `x-client: android` + `x-app: nova`.

### Sessiya tugashi — kichik, lekin haqiqiy

Buzuq token bilan `/api/auth/me` **200** va `{user: null}` qaytaradi,
401 emas. Shuning uchun `ApiClient.sessionExpired` signali ishga
tushmaydi. Repozitoriy baribir `unauthorized` qaytaradi va ekran
to'g'ri ishlaydi, lekin GLOBAL "sessiya tugadi" yo'li bu holatda
ishlamaydi. PARTIAL deb belgilangan.

---

## 9. Jismoniy karta (`/api/my/nfc-devices`) — parityi yozildi, DEPLOY QILINMADI

### Audit natijasi

| Manba | Holat |
|---|---|
| `server/index.js` (Express + Postgres) | `GET` va `PUT /api/my/nfc-devices/:id` BOR |
| `hosting/worker.js` (produksiya, D1) | yo'q edi → **404** |
| D1 `physical_cards` jadvali | **BOR** va shu Worker uni o'zi to'ldiradi, o'qiydi va o'chiradi |
| Sayt (`src/`) | `dbListNfcDevices` / `dbUpdateNfcDevice` eksport qilingan, lekin **hech kim chaqirmaydi** |

Ya'ni bu feature Express'da qolib ketgan va produksiyada hech qachon
ishlamagan — na ilovada, na saytda.

### Yozilgan parity

`hosting/worker.js` ga `userAccountApi` ichiga (izohi bo'yicha aynan
"signed-in user endpoints ported from server/index.js") ikki yo'l
qo'shildi:

* `GET /api/my/nfc-devices` → `{ devices: [...] }`
* `PUT /api/my/nfc-devices/:id` → `{ linkedCode }` yoki `{ blocked }`

Semantika Express bilan BIR XIL, jumladan `validCode` sharti va
`not_your_code` (403) tekshiruvi. `chip_token` to'liq qaytarilmaydi —
faqat oxirgi 4 belgi.

Yangi jadval ham, migratsiya ham KERAK EMAS: ustunlar
(`chip_token, linked_code, owner_user_id, active, blocked_by_owner,
status, created_at`) allaqachon bor.

### DEPLOY — BLOCKER

`deploy.yml` faqat `main` ga push bo'lganda ishlaydi. Bu o'zgarish
sinov branchida, ya'ni **`nfcstore.uz` da hali YO'Q**. Shuning uchun
E2E hali ham 404 ko'radi va qator PARTIAL bo'lib qoladi.

Yopish uchun: `main` ga merge → `deploy.yml` → E2E qayta.
Bu produksiyaga chiqarish qarori, shuning uchun men bajarmadim.

### Ilovadagi tuzatish — "uzish" hech qachon ishlamagan

`unlinkDevice` `PUT {linkedCode: ''}` yuborardi. Bo'sh kod serverda
ham tekshiruvdan o'tmaydi:

    const code = String(b.linkedCode || '').toUpperCase();
    if (!validCode(code)) return 422 { error: 'bad_code' };

`validCode('')` — `false`. Undan oldin esa `DELETE` chaqirilardi va u
404 berardi. Ya'ni bu tugma ikki marta "tuzatilgan" bo'lsa-da, hech
qachon ishlamagan.

Serverda qo'llab-quvvatlanadigan amal — `blocked`. Endi ilovada
"Kartani bloklash / blokdan chiqarish" bor va u yo'qolgan kartani
zararsizlantirish uchun yetarli. Bog'lanishni butunlay olib tashlash
yo'li serverda YO'Q va ilova uni bordek ko'rsatmaydi.


---

## 10. Amali yo'q ikki boshqaruv (topildi va tuzatildi)

Bu ikkitasi barcha oldingi tekshiruvlardan O'TIB KETGAN: CI yashil
edi, `flutter analyze` toza edi, `no_op_audit_test` ham indamagan.
Sababi tekshiruvlarning o'zida edi.

### 10.1 Post ekranidagi "izoh" tugmasi

    _Action(
      icon: Icons.mode_comment_outlined,
      label: formatCount(p.comments),
      tint: t.text2,
    )                                   // <- `onTap` YO'Q

`_Action` ichida `PressableScale(onTap: onTap)` turadi. `onTap`
`null` bo'lganda ham vidjet o'sha joyda, o'sha ko'rinishda qoladi:
bosiladi, lekin hech narsa bo'lmaydi.

NIMA UCHUN QO'RIQCHI TUTMADI: `no_op_audit_test` `onTap: () {}` va
`onTap: null` ni qidirardi. Bu yerda esa `onTap` **umuman
yozilmagan** — ikkala naqshga ham tushmaydi.

Tuzatish: `CommentsSection` ga ixtiyoriy `focusNode` qo'shildi,
tugma esa shu maydonga fokus beradi — bosilganda klaviatura
ochiladi va kursor izoh yozish joyiga tushadi.

### 10.2 Reels'dagi "Ulashish" tugmasi

    onTap: () => context.push(Routes.post(p.id, code: p.code)),

Yorlig'i `actionShare` ("Ulashish"), amali esa post ekranini ochish.
Tizimning ulashish oynasi hech qachon chiqmasdi. Bu 10.1 dan ham
yashirinroq: `onTap` BOR, demak har qanday "bo'sh handler"
tekshiruvi buni toza deb ko'radi.

Tuzatish: `shareLink('$kApiBase/<code>')` — ilovaning qolgan yetti
joyida ishlatiladigan o'sha yo'l. Kod bo'sh bo'lsa `shareText`.

### Qo'riqchilar kuchaytirildi

`test/no_op_audit_test.dart` ga ikkita sinov qo'shildi:

* bosiladigan `_Action` ning hammasida `onTap` borligi. QAVSLAR
  SANALADI, regexp emas — birinchi urinishimda
  `_Action\(([^;]*?)\)` yozgandim va u `formatCount(p.comments)`
  ning yopuvchi qavsida to'xtab, argumentlar ro'yxatini yarmida
  kesardi; natijada butunlay to'g'ri kod ham xato deb belgilanardi;
* `l.actionShare` yorlig'i bor faylda `shareLink`/`shareText`
  chaqiruvi ham borligi.

Ikkalasi ham emulyatorsiz, `flutter test` da bir soniyada ishlaydi.

---

## 11. NISBIY MANZIL — E2E #6 dagi yagona FAIL ning ildizi

E2E #6 da bitta FAIL bor edi: `Music player` — "trek ochilmadi".
Sabab musiqada emas. Sabab BUTUN MEDIADA.

### Nima bo'lgan

Backend yuklangan fayllarni NISBIY yo'l bilan qaytaradi.
`hosting/worker.js` → `safeUrl` buni ochiq yozadi:

    if (url.startsWith('/uploads/') ||
        url.startsWith('/business-assets/')) return url;

`recSafeUrl`/`uploadOrSafeUrl` ham xuddi shunday. Ya'ni avatar,
muqova, post rasmi, istorya, video va musiqa — hammasi
`/uploads/xxxx` bo'lib, DOMENSIZ keladi.

SAYT uchun bu to'g'ri: brauzer sahifani o'sha domendan ochgan,
nisbiy yo'l o'zi to'liq manzilga aylanadi. ILOVA esa hech qanday
domenda turmaydi. `Uri.parse('/uploads/x')` — sxemasiz, xostsiz
manzil; uni na ExoPlayer, na rasm keshi ocha oladi.

Ilovada bu manzilni to'ldiradigan joy YO'Q edi — `lib/` bo'ylab
birorta `startsWith('http')` tekshiruvi ham topilmadi.

Hisobdagi trek aynan shunday edi: `/uploads/6b8fd42d944f7543da7c`
(kengaytmasiz, eski fayl).

### Nega hech qaysi tekshiruv tutmadi

`flutter analyze` uchun bu to'g'ri kod. Birlik testlari modelning
XOM qiymat qaytarishini KUTARDI (`models_test.dart` → `['a.jpg']`),
ya'ni xatoni mustahkamlab qo'ygan edi.

Eng yomoni — MENING E2E SINOVIM buni YASHIRGAN:

    api.get(url.startsWith('http') ? url : '/$url')

Sinov manzilni O'ZI to'ldirib yuborardi. Shuning uchun "Music —
trek manzili" qatori PASS bo'lardi, ilovada esa o'sha fayl hech
qachon ochilmasdi. Sinov ilova qiladigan ishni qilishi kerak edi,
o'zinikini emas.

### Tuzatish

`lib/core/utils/media_url.dart` — bitta yordamchi:

* bo'sh — bo'sh qoladi;
* `http://`, `https://`, `data:` — TEGILMAYDI (server tashqi
  havolaga ham ruxsat beradi);
* qolgani `kApiBase` ga ulanadi.

U MODEL CHEGARASIDA qo'llanadi (`models.dart` → `_u`), ya'ni
avatar, muqova, logo, post mediasi, istorya, video va musiqa —
hammasi ekranga TO'LIQ manzil bo'lib yetadi. Vidjetlarning birortasi
buni eslab qolishi shart emas.

### Qo'riqchilar

* `test/media_url_test.dart` — 12 ta sinov: nisbiy → to'liq, tashqi
  havola tegilmaydi, `data:` tegilmaydi, bo'sh bo'sh qoladi, va har
  bir model (NfcId avatar/muqova/musiqa, eski bitta `musicUrl`,
  Post media ro'yxati, StoryItem, Business) uchun alohida qator;
* o'sha faylda STATIK qo'riqcha: `models.dart` da yangi manzil
  maydoni `_u` o'rniga `_s` da qolib ketsa, sinov uni ko'rsatadi;
* `models_test.dart` tuzatildi — endi TO'LIQ manzil kutadi.

### Ikkita sinov ham halollashtirildi

* backend to'plami endi manzilni ILOVA BERGANICHA oladi va nisbiy
  bo'lsa PARTIAL yozadi;
* `MusicState` ga `error` qo'shildi: `errorDescription` hisobotga
  tushadi. "Ochilmadi" bilan xatoni topib bo'lmaydi, dekoderning
  o'z matni bilan bo'ladi.

### 11.1 Yozish yo'li ham simmetrik bo'lishi kerak edi

Manzilni O'QISHDA to'ldirish yetarli emas. Tahrirlash ekrani
maydonni modeldan oladi:

    _avatarUrl = id.avatarUrl;   // endi TO'LIQ manzil

Foydalanuvchi faqat ismini o'zgartirib saqlasa, o'sha to'liq manzil
serverga qaytib ketardi. Server uni RAD ETMAYDI — `safeUrl` ichidagi
`new URL(...)` shoxi to'g'ri http(s) manzilni qabul qiladi — va
bazaga absolyut manzil yozilardi.

Ishlashda darhol ko'rinmaydi. Lekin yozuv DOMENGA bog'lanib qoladi:
domen o'zgarsa yoki yozuv boshqa muhitga ko'chirilsa, rasm
yo'qoladi. Saqlanadigan shakl o'zgarmasligi kerak.

`storageUrl` — `mediaUrl` ning teskarisi — `profileRepository`
ning YOZISH chegarasida qo'llanadi, ya'ni `updateProfile` ning
uchala chaqiruvchisi ham (profil sozlash, profil tahriri, NFC ID
tahriri) avtomat qamraladi.

Biznes tahriri media maydonlarini umuman yubormaydi — tekshirildi,
tegilmadi.

Sinovda aylanma xossa ham bor: `storageUrl(mediaUrl(x)) == x`.
Buzilsa, saqlangan qiymat har tahrirda o'zgarib ketardi.

### 11.2 Yuklash natijasi model chegarasidan O'TMAYDI

Uchinchi joy. `uploadImage` javobi to'g'ridan-to'g'ri ekranga
chiziladi:

    ok: (url) => _avatarUrl = url,     // xom `/uploads/...`
    ...
    Avatar(url: _avatarUrl, ...)

Bu qiymat MODELDAN kelmaydi, shuning uchun §11 dagi tuzatish bu
yerga yetib kelmaydi. Natija: foydalanuvchi yangi avatar tanlaydi,
yuklash muvaffaqiyatli tugaydi — va o'rnida BO'SHLIQ qoladi.
Ilovani qayta ochgandan keyingina rasm paydo bo'lardi (chunki u
paytda qiymat modeldan keladi).

`profile_edit_screen.dart` va `profile_setup_screen.dart` da
`mediaUrl(url)` qo'yildi. Serverga qaytishda `storageUrl` uni yana
nisbiy shaklga keltiradi, ya'ni bazada hech narsa o'zgarmaydi.

Qo'riqcha: `media_url_test.dart` ikkala faylni o'qib, xom
`_avatarUrl = url` qolmaganini tekshiradi.

### 11.3 YOZISH yo'li ataylab NISBIY qoladi

Muhim assimetriya, chalkashmaslik uchun:

* O'QISH — TO'LIQ manzil (ilova uni ocha olishi uchun);
* YOZISH — NISBIY manzil (server aynan shuni kutadi).

Server post mediasini shunday tekshiradi:

    const okImg = imageUrl.startsWith('/uploads/') && ...

Ya'ni absolyut manzil yuborilsa, post yaratish 422 bilan
yiqilardi. Kompozitor qiymatni `uploadImage` dan XOM holda oladi va
`createPost`/`createStory` ga o'shani uzatadi — tekshirildi,
tegilmadi. Post yaratish E2E #6 da PASS edi va shundayligicha
qoladi.

---

## 12. O'LIK AMALLAR — repozitoriyda bor, ekranda yo'q

Uchta amal `social_repository.dart` da to'liq yozilgan, backend
endpointlari ishlaydi va E2E ularni PASS deb belgilagan — lekin
ILOVADA ULARNI CHAQIRADIGAN EKRAN YO'Q edi.

Bu "no-op tugma" dan ham yomonroq: tugma umuman yo'q, shuning uchun
ko'z bilan ham, "bo'sh handler" qidiruvi bilan ham topilmaydi. E2E
esa REPOZITORIYANI sinaydi, EKRANNI emas — shuning uchun qator
yashil bo'lib turaverardi.

### 12.1 `deleteStory` — o'z story'ingni o'chirish

Metod bor. `storyDeleteConfirm` tarjimasi UCHALA tilda tayyor.
Chaqiruvchi yo'q. Ya'ni foydalanuvchi o'z story'sini ilova ichida
o'chira olmasdi.

Story Viewer sarlavhasiga o'chirish tugmasi qo'shildi va u FAQAT
o'z story'ingda ko'rinadi (kod `myIdsProvider` dagi yozuvlardan
birida bo'lsa). Begonanikida tugma umuman chizilmaydi — bosilib
"ruxsat yo'q" deydigan tugma qoldirilmadi. Egalikni baribir server
hal qiladi.

O'chgandan keyin ro'yxat SERVERDAN qayta o'qiladi: mahalliy
ro'yxatdan olib qo'yish "o'chdi" deb ko'rsatib, aslida qolib
ketishi mumkin edi.

### 12.2 `markStorySeen` — eng jimi

`POST /api/stories/:id/view` ishlaydi va E2E #6 da "Story seen"
qatori PASS edi. Lekin u REPOZITORIYANI sinaydi. Ilovada bu
metodni chaqiradigan joy yo'q edi.

Natija: story ochilardi, ko'rilardi — va Home ekranidagi halqa
baribir "ko'rilmagan" bo'lib turaverardi. Hech qanday xato
chiqmasdi.

Endi Story Viewer har ko'rsatilgan story uchun bir marta yuboradi
(`_seen` to'plami takroriy so'rovni to'sadi, chunki progress
animatsiyasi `build` ni har kadrda chaqiradi). Natija kutilmaydi
va xatosi yutiladi — bu yordamchi signal.

### 12.3 Reels — ovoz boshqaruvi UMUMAN yo'q edi

Video to'liq ovoz bilan boshlanardi va uni faqat ekrandan chiqib
to'xtatish mumkin edi. `setVolume` hech qayerda chaqirilmagan.

`reelsMutedProvider` — holat BUTUN lenta uchun bitta, aks holda
har silashda ovoz qaytadan yonib ketardi. `autoDispose` ataylab
yo'q: ekrandan chiqib qaytganda ham tanlov saqlanadi.

`actionMute`/`actionUnmute` uchala tilga qo'shildi.

### Qo'riqcha

`no_op_audit_test.dart` endi TESKARI tomondan tekshiradi:
repozitoriyadagi `deleteStory`, `deletePost`, `deleteComment`,
`setDeviceBlocked`, `markStorySeen` — har birining `features/`
ichida chaqiruvi borligi. Kelajakda ekran olib tashlansa yoki
amal ulanmay qolsa, sinov buni ko'rsatadi.

Ayrim sinov: Reels ovoz tugmasi `setVolume` ni CHAQIRISHI kerak —
tugma qo'shilgani yetarli emas.

---

## 13. VIDEO umuman chizilmasdi

`Post.isVideo` ham, `StoryItem.isVideo` ham model tomonidan TO'G'RI
o'qilardi. Ekranlarning BIRORTASI ularni ishlatmasdi.

Story Viewer ham, post tafsiloti ham hamma narsani
`CachedNetworkImage` bilan chizardi. Ya'ni:

* video istorya qo'yish MUMKIN edi (kompozitor `videoUrl` ni qabul
  qiladi, server saqlaydi) — ko'rgan odam bo'sh quti ko'rardi;
* video post ochilganda siniq rasm belgisi chiqardi.

Hech qanday xato chiqmasdi: `errorWidget` jimgina o'rnini egallardi.
Shuning uchun bu "ishlamayapti" emas, "shunaqa ekan" bo'lib
ko'rinardi.

`lib/features/social/inline_video.dart` — bitta chizuvchi, ikkala
ekran uchun:

* kontroller SHU vidjetga bog'langan (`ValueKey` bilan eski holat
  tashlanadi) — aks holda story almashganda eski dekoder xotirani
  ushlab qolardi;
* ovoz egaligi Reels bilan bir xil: video ovoz chiqarsa, profil
  musiqasi to'xtaydi;
* istoryada progress video UZUNLIGIGA moslanadi (60 s bilan
  cheklab) — aks holda 5 soniyada keyingisiga o'tib ketardi;
* postda bosish ijro/pauza, avtomatik ijro YO'Q.

## 14. Kashfiyotda rasm umuman yo'q edi

Post kartasi faqat muallif, matn va video belgisidan iborat edi —
rasm chizadigan vidjet UMUMAN yo'q edi.

Ya'ni §"postlarda rasm yo'q" muammosi `/api/news` → `/api/feed`
almashtirilgandan keyin ham QOLGAN edi: manba to'g'rilandi, lekin
karta o'sha manbadagi rasmni baribir ko'rsatmasdi.

Endi media bor bo'lsa muqova chiziladi. VIDEODA ro'yxat ichida
pleyer OCHILMAYDI — o'nlab video bir vaqtda dekoder ushlab, ilovani
yiqitardi; o'rniga belgi turadi va bosilganda to'liq ekran
ochiladi.

## Qo'riqcha

`no_op_audit_test.dart`: Story Viewer va post tafsiloti IKKALASI
ham `isVideo` ni tekshirishi va `InlineVideo` ni chaqirishi shart;
`inline_video.dart` esa haqiqiy `VideoPlayer` chizishi shart.
