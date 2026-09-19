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
