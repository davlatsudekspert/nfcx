# hasharchilar.uz

Mahalladagi hasharlarni (tozalash, ko'kalamzorlashtirish, obodonlashtirish) **xaritada topish**,
**bir bosishda qo'shilish**, yangi hashar **e'lon qilish** va **Oldin / Keyin** natijalarni ko'rish platformasi.

Bitta React kod bazasidan ikkita mahsulot chiqadi:

1. **Sayt** — Cloudflare Worker (Static Assets + Hono API), D1 baza, R2 rasm ombori.
2. **Android ilova (APK)** — Capacitor 8, o'sha sayt kodi; API ga to'liq manzil (`VITE_API_BASE`) orqali murojaat qiladi.

Batafsil texnik shartnoma: [`SPEC.md`](./SPEC.md).

## Arxitektura

```
 Brauzer (sayt)                     Android APK (Capacitor, origin https://localhost)
      │  /api/... (shu domen)              │  https://<domen>/api/...  (CORS + Bearer token)
      ▼                                    ▼
 ┌──────────────────── Cloudflare Worker "hasharchilar" ────────────────────┐
 │  Static Assets: dist/ (React SPA)    run_worker_first: /api/*            │
 │  Hono API: worker/index.js → auth.js, hashars.js, media.js, ratelimit.js │
 └───────────────┬───────────────────────────────────┬──────────────────────┘
                 ▼                                   ▼
        D1 "hasharchilar" (binding DB)     R2 "hasharchilar-photos" (binding PHOTOS)
        users, sessions, hashars,          before/<uuid>.jpg, after/<uuid>.jpg,
        hashar_media, volunteers,          app/hasharchilar.apk, app/version.json
        rate_limits
```

- **Stek:** React 18 · Vite 6 · Tailwind CSS v4 · Leaflet 1.9 (CARTO Voyager plitkalari) · Hono 4 ·
  Cloudflare Workers + D1 + R2 · Capacitor 8 (Android).
- **Autentifikatsiya:** ism + telefon (+998…) + parol. Parol PBKDF2-SHA256 (100 000 iteratsiya) bilan saqlanadi.
  Sessiya tokeni `localStorage['hashar_token']` da turadi va `Authorization: Bearer <token>` sarlavhasida yuboriladi.
  Cookie ishlatilmaydi. Sessiya 90 kun amal qiladi.
- **Rasmlar:** brauzer rasmni yuborishdan oldin ≤ 1600px JPEG ga siqadi. Server faqat JPEG/PNG/WebP qabul qiladi
  (≤ 5 MB, fayl boshidagi baytlar ham tekshiriladi) va R2 ga `<folder>/<uuid>.<ext>` kaliti bilan saqlaydi.
  DTO dagi `before_url` / `after_url` nisbiy yo'l bo'ladi. Mijoz ularni `API_BASE + url` ko'rinishida ishlatadi.
- **Limitlar (D1 asosida):**
  - kirish: bitta telefon raqamiga 15 daqiqada 10 ta urinish (IP almashtirilsa ham);
  - kirish va ro'yxatdan o'tish: bitta IP dan 15 daqiqada 30 ta urinish. IPv6 manzillar /64 tarmoq bo'yicha
    hisoblanadi. SPEC'da IP limiti 10 edi: mobil operatorlarning CGNAT tarmog'ida ko'p foydalanuvchi bitta
    IP ni bo'lishadi, parol tanlashdan asosiy himoya esa endi telefon bo'yicha limit;
  - hashar e'lon qilish: bitta foydalanuvchi soatiga 10 ta;
  - qatnashish / chiqish: bitta foydalanuvchi soatiga 30 ta (tashkilotchi telefonlarini ommaviy yig'ishdan himoya).
- **Ro'yxat (`GET /api/hashars`, ko'pi bilan 300 ta):** holatlar alohida tanlanadi. Kelgusi hasharlar
  yakunlanmay qolgan eski hasharlardan oldin olinadi, bajarilganlarga kamida 60 ta joy qoladi. Javob tartibi
  SPEC bo'yicha (PENDING sana bo'yicha o'sish, keyin COMPLETED eng yangisi).
- **So'rov hajmi:** multipart tana 6 MB dan oshsa 413 (Content-Length bo'lmasa ham — tana oqim sifatida sanaladi).

## Papkalar

```
hasharchilar/
├── SPEC.md                  # yagona texnik shartnoma
├── package.json             # web + worker + capacitor (bitta paket)
├── wrangler.jsonc           # Worker, D1 (DB), R2 (PHOTOS), assets ./dist
├── capacitor.config.json    # uz.hasharchilar.app, webDir dist
├── migrations/0001_init.sql # D1 sxemasi (wrangler d1 migrations apply)
├── schema.sql               # migratsiyaning nusxasi (qulaylik uchun)
├── seed.sql                 # FAQAT lokal namuna ma'lumot (parol: demo1234)
├── worker/                  # Hono backend
├── tests/api.test.mjs       # API testi (node:test, wrangler dev ga qarshi)
├── src/                     # React (sayt va APK uchun bir xil)
│   ├── lib/                 #   config, api, auth, image, map, native, backButton, utils
│   └── components/          #   Header, Hero, Tabs, MapView, HasharCard, HasharDetail,
│                            #   CreateHasharModal (4 bosqich), AuthModal, ProfileModal, ...
├── public/                  # favicon, ikonlar, og-image, demo/ (seed rasmlari)
├── android/                 # Capacitor Android loyihasi (commit qilinadi)
├── resources/, scripts/     # ikonka/splash manbalari va generatori
└── docs/screenshots/        # ekran rasmlari (mobil va desktop)
```

## Lokal ishga tushirish

Talablar: Node.js 22.

```bash
npm ci
npm run db:local     # lokal D1: migratsiya + namuna ma'lumot (.wrangler/state ichida)
npm run dev          # sayt: http://localhost:5173  (Vite, /api → wrangler dev :8787 ga proxy)
```

Namuna foydalanuvchilar uchun parol `demo1234`:

| Ism | Telefon |
|---|---|
| Aziz Karimov | +998 90 111 22 33 |
| Malika Yusupova | +998 93 555 66 77 |
| Jasur Toshmatov | +998 97 777 88 99 |

Production rejimiga yaqinroq sinash uchun sayt va API ni bitta originda ham ishga tushirish mumkin:

```bash
npm run build && npx wrangler dev --port 8787   # http://localhost:8787
```

> `npm run build` `dist/` ni tozalab qayta yozadi. `wrangler dev` ishlab turgan paytda build qilinsa,
> u ba'zan `/` uchun 404 qaytara boshlaydi. Bunday holda `wrangler dev` ni qayta ishga tushiring.

Lokal bazani nolga qaytarish: `rm -rf .wrangler/state && npm run db:local`.

### Testlar

```bash
npx wrangler dev --port 8787 &     # boshqa terminalda
npm run test:api                   # node --test tests/  (BASE_URL bilan boshqa manzil berish mumkin)
```

Test bo'sh bo'lmagan bazada ham qayta ishlaydi, chunki har safar tasodifiy telefon raqamlari va IP manzillar ishlatiladi.

## Android ilova (APK) ni lokal qurish

Talablar: JDK 21, Android SDK (platform 36, build-tools 35+). SDK yo'li `ANDROID_HOME` orqali
yoki `android/local.properties` dagi `sdk.dir=...` qatori orqali beriladi (bu fayl commit qilinmaydi).

```bash
VITE_API_BASE=https://hasharchilar.davlatsudekspert.workers.dev npm run build
npx cap sync android
cd android && ./gradlew assembleRelease -PversionCode=3 -PversionName=1.0.3
# natija: android/app/build/outputs/apk/release/app-release.apk
```

- `VITE_API_BASE` — deploy qilingan saytning **https** manzili. Ilovada `usesCleartextTraffic=false`
  yoqilgan, shuning uchun `http://` manzilga ulanib bo'lmaydi.
- APK qurilgandan keyin saytni qo'lda deploy qilmoqchi bo'lsangiz, avval oddiy build qiling (`npm run build`,
  `VITE_API_BASE` siz). Sayt API ga nisbiy yo'l bilan murojaat qilishi kerak.
- **Imzo:** `android/key.properties` bo'lsa, APK shu kalit bilan imzolanadi. Bo'lmasa debug kaliti ishlatiladi:
  APK baribir o'rnatiladi, lekin Play Store'ga yaramaydi. Kalit va `key.properties` ni yaratish:

  ```bash
  keytool -genkeypair -v -keystore android/app/release.jks -alias hasharchilar \
          -keyalg RSA -keysize 2048 -validity 10000
  cat > android/key.properties <<EOF
  storeFile=release.jks
  storePassword=PAROL
  keyAlias=hasharchilar
  keyPassword=PAROL
  EOF
  ```

  `storeFile` yo'li `android/app/` papkasiga nisbatan yoziladi. `*.jks`, `*.keystore` va `key.properties`
  `.gitignore` da turibdi, ular **hech qachon commit qilinmaydi**.
- Native imkoniyatlar:
  - Android "orqaga" tugmasi ochiq oynani yopadi, oyna ochiq bo'lmasa ilovadan chiqadi;
  - status bar emerald rangda, safe-area hisobga olinadi;
  - splash ekran ma'lumot yuklangach yopiladi (eng ko'pi 4 soniya);
  - rasm uchun "Kamera" (kamerani ochadi, CAMERA ruxsati so'raladi) va "Galereya" tugmalari bor;
  - joylashuv ruxsati "Yaqindagi hasharlar" va "Mening joylashuvim" bosilganda so'raladi;
  - ilova ma'lumotlari (sessiya tokeni) Android zaxirasiga va qurilma ko'chirishga tushmaydi
    (`allowBackup="false"` + `data_extraction_rules.xml`).

## Deploy (GitHub Actions)

Workflow fayli: `.github/workflows/hasharchilar.yml`. U quyidagi hollarda ishga tushadi:

- `main` yoki `claude/peaceful-meitner-zlvydj` branchiga push qilinganda (faqat `hasharchilar/**` yoki workflow fayli o'zgarsa);
- qo'lda, `workflow_dispatch` orqali.

Ketma-ketlik:

1. **test** — `npm ci` → `npm run build` → `npm run db:local` → `wrangler dev` (to'liq lokal) → `npm run test:api`.
2. **deploy** (test o'tsa):
   - xavfsizlik tekshiruvi: `wrangler.jsonc` faqat `hasharchilar` resurslarini ko'rsatishi kerak,
     nfcstore resurslariga hech qachon tegilmaydi;
   - D1 `hasharchilar` topiladi yoki yaratiladi va uning id si CI nusxasidagi `wrangler.jsonc` ga yoziladi;
   - R2 `hasharchilar-photos` tekshiriladi yoki yaratiladi;
   - eski (migratsiyasiz) jadvallar tekshiriladi, keyin `wrangler d1 migrations apply --remote` bajariladi;
   - `wrangler deploy` ishga tushadi, so'ng `/api/health` tekshiriladi. Topilgan manzil `outputs.url` ga yoziladi.
3. **apk** (deploy o'tsa):
   - `VITE_API_BASE=<deploy URL>` bilan build va `cap sync`, keyin `assembleRelease`
     (`versionCode = run_number`, `versionName = 1.0.<run_number>`);
   - `apksigner` va `aapt2` bilan tekshiruv;
   - APK artefakt sifatida saqlanadi va R2 ga `app/hasharchilar.apk` hamda `app/version.json` bo'lib yuklanadi.
     Shundan keyin saytdagi "Android ilovasini yuklab olish" banneri paydo bo'ladi;
   - GitHub Release `hasharchilar-v1.0.N` yaratiladi.

### Kerakli secretlar

| Secret | Majburiy | Izoh |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | ha | Hisob `31c4b3d8ece4b65de515debc4552334a`. Ruxsatlar: **Account → Workers Scripts: Edit, D1: Edit, Workers R2 Storage: Edit, Account Settings: Read**. Custom domen uchun qo'shimcha: **Zone → Workers Routes: Edit, DNS: Read**. Token faqat wrangler / Cloudflare API qadamlariga beriladi: `npm ci`, build va Gradle uni ko'rmaydi |
| `HASHARCHILAR_KEYSTORE_BASE64` | yo'q (tavsiya etiladi) | `base64 -w0 release.jks` natijasi |
| `HASHARCHILAR_KEYSTORE_PASSWORD` | yo'q | keystore paroli (kalit paroli ham shu bo'lishi kerak) |
| `HASHARCHILAR_KEY_ALIAS` | yo'q | kalit aliasi |

> **Diqqat — SPEC 8 dan chetlanish:** SPEC'da `ANDROID_KEYSTORE_*` nomlari yozilgan, lekin bu repoda shu nomli
> secretlar **nfcstore** ilovasining haqiqiy imzo kaliti (`android-apk.yml`). hasharchilar boshqa paket,
> unga alohida kalit kerak, shuning uchun workflow faqat `HASHARCHILAR_*` nomlarini o'qiydi. Qo'shimcha himoya:
> APK nfcstore sertifikati (`60:24:1D:…:86:40`) bilan imzolangan bo'lsa, workflow to'xtaydi.
>
> Secretlarni joylashda parol va alias chetidagi bo'shliq / qator ko'chirish olib tashlanadi. Keystore
> paroli va aliasi Gradle'dan oldin `keytool` bilan tekshiriladi, xato bo'lsa build boshlanmaydi.

> **Muhim:** discovery workflow'idagi D1 so'rovi `Authentication error` bilan tugagan. Demak hozirgi tokenda
> **D1: Edit** ruxsati yo'q. Bu ruxsat qo'shilmaguncha deploy D1 qadamida tushunarli xato bilan to'xtaydi.
> Ruxsatni qo'shish: dash.cloudflare.com → My Profile → API Tokens → tokenni tahrirlash.

Keystore secretlari bo'lmasa, APK keshlangan debug kaliti bilan imzolanadi. Bu kesh ishonchli emas: u har bir
branch uchun alohida, 7 kun ishlatilmasa yoki repo kesh limiti to'lsa o'chadi, shunda yangi debug kaliti yaratiladi.
Ikkala branch ham bitta production manziliga (R2 `app/hasharchilar.apk`) chiqaradi. Shuning uchun **"Imzo mosligi"**
qadami yangi APK sertifikatini R2 dagi oldingi APK sertifikati bilan solishtiradi (`app/version.json` → `cert`).
Ular farq qilsa, APK R2 ga ham, GitHub Release'ga ham chiqarilmaydi, chunki o'rnatilgan ilovalar yangilanmay qoladi
("App not installed"). Debug kalit keshi faqat shu tekshiruvdan o'tgandan keyin saqlanadi.

Barqaror yechim — bir marta kalit yaratib, uni `HASHARCHILAR_KEYSTORE_*` secretlariga joylash (yuqoridagi
`keytool` buyrug'i). Kalitni ataylab almashtirish kerak bo'lsa, workflow'ni qo'lda (**Run workflow**)
`allow_key_change = true` bilan ishga tushiring. Bunda foydalanuvchilar ilovani o'chirib, qayta o'rnatishi kerak bo'ladi.

### Sayt manzili va `hasharchilar.uz` domenini ulash

Domen ulanmagan bo'lsa, sayt `https://hasharchilar.davlatsudekspert.workers.dev` manzilida ishlaydi.

`hasharchilar.uz` ni ulash:

1. Cloudflare Dashboard → **Add a site** → `hasharchilar.uz`. Domen registratorida nameserverlarni
   Cloudflare bergan qiymatlarga almashtiring va zona **Active** bo'lishini kuting.
2. Workflow'ni qayta ishga tushiring. Domen faqat quyidagi ikki holatda avtomatik ulanadi:
   - zona `active` va domen allaqachon shu Worker'ga ulangan;
   - zona `active` va `hasharchilar.uz` uchun hech qanday DNS yozuvi yo'q.

   Mavjud DNS yozuvlarini workflow hech qachon o'zgartirmaydi. Yozuvlar bor bo'lsa, domenni qo'lda ulang:
   Workers & Pages → `hasharchilar` → Settings → Domains & Routes → **Add → Custom domain**.
3. Domen ulangach, keyingi APK'lar shu domen bilan quriladi. `workers_dev: true` yoqilgani uchun
   eski APK'lar ham workers.dev manzilida ishlashda davom etadi.

### Qo'lda deploy (CI siz)

```bash
npx wrangler login
npx wrangler d1 create hasharchilar --location eeur   # id ni wrangler.jsonc ga yozing (commit qilmang)
npx wrangler r2 bucket create hasharchilar-photos     # agar yo'q bo'lsa
npm run db:remote                                     # migratsiyalar (remote)
npm run deploy                                        # vite build + wrangler deploy
```

## API (qisqacha)

Barcha javoblar JSON formatida. Xato javobi `{ "error": "<o'zbekcha matn>" }` ko'rinishida, mos HTTP status bilan qaytadi.
To'liq tavsif va `HasharDTO` maydonlari [`SPEC.md`](./SPEC.md) ning 5-bo'limida.

| Metod | Yo'l | Auth | Tavsif |
|---|---|---|---|
| POST | `/api/auth/register` | – | `{name, phone, password}` → 201 `{token, user}`. Telefon band bo'lsa 409 |
| POST | `/api/auth/login` | – | `{phone, password}` → `{token, user}`. Noto'g'ri bo'lsa 401 |
| POST | `/api/auth/logout` | ✓ | sessiyani o'chiradi |
| GET | `/api/me` | ✓ | `{user, stats: {created, joined, completed}}` |
| GET | `/api/stats` | – | `{hashars, completed, volunteers}` |
| GET | `/api/hashars` | ixtiyoriy | `HasharDTO[]`. Query: `status`, `mine=created\|joined`, `q` |
| GET | `/api/hashars/:id` | ixtiyoriy | DTO + `volunteers[]`. `creator.phone` faqat qatnashuvchi yoki egasiga ko'rinadi |
| POST | `/api/hashars` | ✓ | multipart: `title, description, address, lat, lng, date_time, items` (JSON) va ixtiyoriy `photo` → 201 |
| POST / DELETE | `/api/hashars/:id/join` | ✓ | qo'shilish (idempotent) / chiqish (egasi chiqa olmaydi) |
| POST | `/api/hashars/:id/complete` | ✓ egasi | multipart `photo` ("Keyin" rasmi) → COMPLETED |
| DELETE | `/api/hashars/:id` | ✓ egasi | faqat PENDING holatda; R2 dagi rasmlar ham o'chiriladi |
| GET | `/api/media/:folder/:file` | – | R2 dagi rasm (immutable kesh) |
| GET | `/api/app`, `/api/app/download` | – | APK mavjudligi va versiyasi; faylni yuklab olish |
| GET | `/api/health` | – | `{ok:true}` |

CORS quyidagi originlarga ruxsat beradi: `https://localhost` (APK), `capacitor://localhost`, `http://localhost`,
`http://localhost:5173` va so'rov kelgan hostning o'zi.

## Ma'lum cheklovlar

- **Telefon tasdiqlanmaydi.** SMS (OTP) yo'q, parolni tiklash funksiyasi ham yo'q.
- **Xarita plitkalari** CARTO ning bepul tarifidan keladi. Trafik katta bo'lsa, MapTiler yoki Stadia kabi kalitli xizmatga o'tish kerak.
- **Qidiruv** oddiy `LIKE` bilan ishlaydi. D1 da shablon uzunligi 50 bayt bilan cheklangani uchun
  juda uzun so'rov qisqartiriladi.
- **Eski WebView:** Tailwind v4 taxminan Chrome 111+ ni talab qiladi. Eski Android WebView'larida dizayn buzilishi mumkin.
- **Android 15+** da status bar rangini kod orqali o'zgartirib bo'lmaydi. Uning o'rniga safe-area ustiga emerald chiziq chiziladi.
- **APK haqiqiy qurilmada sinalmagan.** Brauzerda mock Capacitor muhiti bilan va boshqa origin'dan
  (CORS, Bearer token, multipart) to'liq sinalgan.
- **Mavjud D1:** Cloudflare hisobida eski, migratsiyasiz `hasharchilar` D1 bo'lsa, deploy ma'lumotni o'chirmaydi.
  U to'xtab, nima qilish kerakligini aytadi: bazani zaxiralash (`wrangler d1 export`), so'ng o'chirish yoki boshqa nomga o'tkazish.
- Push-bildirishnomalar, moderatsiya va admin panel hozircha yo'q.
