# hasharchilar.uz — Texnik spetsifikatsiya (v2, to'liq qayta qurish)

Bu hujjat — barcha qismlar (backend, web, Android APK, CI) uchun YAGONA shartnoma.
Har bir qism shu yerdagi API va nomlarga aynan rioya qiladi.

## 0. Maqsad

Ultra-oddiy platforma: mahalladagi hasharlarni (tozalash/ko'kalamzorlashtirish) xaritada ko'rish,
bir bosishda qo'shilish, yangi hashar e'lon qilish, "Oldin/Keyin" natijalarni ko'rish.
Bitta React kod bazasi → (1) sayt (Cloudflare Worker + Static Assets), (2) Android APK (Capacitor).

## 1. Stek va papkalar (`hasharchilar/` ichida)

```
hasharchilar/
├── package.json            # bitta package: web + worker + capacitor
├── wrangler.jsonc          # Worker "hasharchilar", D1 binding DB, R2 binding PHOTOS, assets ./dist
├── capacitor.config.json   # appId uz.hasharchilar.app, appName "Hasharchilar", webDir dist
├── migrations/0001_init.sql# D1 sxemasi (wrangler d1 migrations apply)
├── schema.sql              # = migrations birlashtirilgani (lokal qulaylik uchun)
├── seed.sql                # FAQAT lokal dev namuna ma'lumot
├── worker/                 # Hono backend
│   ├── index.js            #   app, CORS, marshrutlar ulanishi, onError
│   ├── auth.js             #   parol xesh (PBKDF2), sessiya, requireAuth middleware
│   ├── hashars.js          #   hashar marshrutlari
│   ├── media.js            #   R2 yuklash/berish, APK yuklab olish
│   ├── ratelimit.js        #   D1 asosidagi oddiy limitlagich
│   └── validate.js         #   kirish tekshiruvi
├── tests/api.test.mjs      # wrangler dev'ga qarshi to'liq API testi (node:test)
├── src/                    # React web (sayt + APK uchun bir xil)
├── android/                # Capacitor Android loyihasi (commit qilinadi)
├── scripts/                # yordamchi skriptlar (ikonka generatsiyasi va h.k.)
└── README.md
```

Versiyalar: React 18, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), Leaflet 1.9, Hono 4, wrangler 4,
Capacitor 8 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app`,
`@capacitor/status-bar`, `@capacitor/splash-screen`). JDK 21 (Capacitor 8 talabi).

## 2. Brending

- Asosiy: emerald (`emerald-600`/`emerald-700`). CTA/marker/ogohlantirish: amber (`amber-400`/`amber-500`).
- Fon `slate-50`, matn `slate-900`, kartalar oq, `rounded-2xl`, yumshoq soya. Mobile-first.
- Logo: "hashar" (emerald) + "chilar" (amber) + ".uz" (slate-400), yonida barg ikonkasi (emerald kvadrat).
- Til: o'zbek (lotin). Barcha UI matnlari o'zbekcha.

## 3. D1 sxemasi (`migrations/0001_init.sql`)

```sql
users(id INTEGER PK AUTOINCREMENT, phone TEXT NOT NULL UNIQUE, email TEXT, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))
sessions(token_hash TEXT PK, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         created_at TEXT DEFAULT now, expires_at TEXT NOT NULL)  + INDEX(user_id)
hashars(id PK, title, description DEFAULT '', address DEFAULT '', lat REAL CHECK, lng REAL CHECK,
        date_time TEXT NOT NULL /* 'YYYY-MM-DDTHH:MM' Toshkent vaqti */, items TEXT DEFAULT '[]' /* JSON */,
        status TEXT DEFAULT 'PENDING' CHECK IN ('PENDING','COMPLETED'), creator_id REFERENCES users(id),
        completed_at TEXT, created_at)  + INDEX(status, date_time), INDEX(creator_id)
hashar_media(id PK, hashar_id REFERENCES hashars ON DELETE CASCADE, photo_type CHECK IN ('BEFORE','AFTER'),
             r2_key TEXT NOT NULL, r2_url TEXT NOT NULL /* /api/media/<r2_key> */, created_at) + INDEX(hashar_id)
volunteers(id PK, hashar_id REFERENCES hashars ON DELETE CASCADE, user_id REFERENCES users ON DELETE CASCADE,
           joined_at, UNIQUE(hashar_id, user_id))
rate_limits(key TEXT PK, window_start INTEGER NOT NULL, count INTEGER NOT NULL)
```

## 4. Autentifikatsiya

- Ro'yxat: ism + telefon (+998XXXXXXXXX ga normallashtiriladi) + parol (≥ 6 belgi).
- Parol: PBKDF2-SHA256, 100 000 iteratsiya (Workers limiti), 16 bayt tasodifiy salt.
  Saqlash formati: `pbkdf2$100000$<salt_b64>$<hash_b64>`. Solishtirish — doimiy vaqtli.
- Sessiya: 32 bayt tasodifiy token (base64url) → mijozga; DB'da faqat SHA-256 xeshi. Muddat 90 kun.
- Mijoz tokenni `localStorage['hashar_token']` da saqlaydi va har so'rovda `Authorization: Bearer <token>` yuboradi
  (sayt ham, APK ham — cookie ishlatilmaydi, shuning uchun CSRF muammosi yo'q).
- Login/ro'yxat rate-limit: IP bo'yicha 10 urinish / 15 daqiqa → 429.

## 5. API (barcha javoblar JSON; xato: `{ "error": "<o'zbekcha matn>" }` + mos status)

Umumiy Hashar obyekti (`HasharDTO`):
```json
{ "id": 1, "title": "...", "description": "...", "address": "...", "lat": 41.3, "lng": 69.2,
  "date_time": "2027-10-11T09:00", "items": ["Qo'lqop"], "status": "PENDING" | "COMPLETED",
  "creator": { "id": 3, "name": "Aziz" }, "volunteer_count": 12,
  "before_url": "/api/media/before/<uuid>.jpg" | null, "after_url": "..." | null,
  "joined": true|false /* joriy foydalanuvchi qo'shilganmi; mehmon uchun false */,
  "is_owner": true|false, "created_at": "...", "completed_at": "..." | null }
```
`before_url`/`after_url` — NISBIY yo'l. Mijoz uni `API_BASE + url` qilib ishlatadi (APK uchun muhim).

| Metod | Yo'l | Auth | Tavsif |
|---|---|---|---|
| POST | `/api/auth/register` | – | `{name, phone, password}` → 201 `{token, user}`; telefon band → 409 |
| POST | `/api/auth/login` | – | `{phone, password}` → `{token, user}`; noto'g'ri → 401 "Telefon yoki parol noto'g'ri" |
| POST | `/api/auth/logout` | ✓ | sessiyani o'chiradi → `{ok:true}` |
| GET | `/api/me` | ✓ | `{user:{id,name,phone,created_at}, stats:{created, joined, completed}}` |
| GET | `/api/stats` | – | `{hashars, completed, volunteers}` (hero uchun umumiy raqamlar) |
| GET | `/api/hashars` | ixtiyoriy | `HasharDTO[]`; query: `status=PENDING|COMPLETED`, `mine=created|joined` (auth kerak), `q=` qidiruv. Tartib: PENDING sana bo'yicha o'sish, keyin COMPLETED eng yangisi. Max 300 |
| GET | `/api/hashars/:id` | ixtiyoriy | `HasharDTO` + `volunteers: [{id, name}]` + `creator.phone` (faqat joined yoki owner bo'lsa, aks holda yo'q) |
| POST | `/api/hashars` | ✓ | multipart: `title, description, address, lat, lng, date_time, items(JSON massiv), photo?` → 201 `HasharDTO`. Yaratuvchi avtomatik qatnashuvchi. Rate limit: 10/soat/foydalanuvchi |
| POST | `/api/hashars/:id/join` | ✓ | idempotent → `{joined:true, volunteer_count}`; COMPLETED → 409 |
| DELETE | `/api/hashars/:id/join` | ✓ | chiqish → `{joined:false, volunteer_count}`; egasi chiqa olmaydi → 409 |
| POST | `/api/hashars/:id/complete` | ✓ egasi | multipart `photo` (AFTER, majburiy) → `HasharDTO` (status COMPLETED, completed_at) |
| DELETE | `/api/hashars/:id` | ✓ egasi | faqat PENDING; R2 rasmlarini ham o'chiradi → `{ok:true}` |
| GET | `/api/media/:folder/:file` | – | R2 dan rasm; `folder ∈ {before, after}`; immutable cache, nosniff |
| GET | `/api/app` | – | `{available: bool, version: string|null, size: number|null, url: "/api/app/download"}` (R2 `app/hasharchilar.apk` + custom metadata `version`) |
| GET | `/api/app/download` | – | APK fayl, `content-type: application/vnd.android.package-archive`, `content-disposition: attachment; filename="hasharchilar.apk"` |
| GET | `/api/health` | – | `{ok:true}` |

Rasm qoidalari: faqat `image/jpeg|png|webp`, ≤ 5 MB, kalit `<folder>/<uuid>.<ext>` (kengaytma MIME dan).
Mijoz yuklashdan oldin rasmni canvas orqali ≤ 1600px JPEG (sifat 0.82) ga siqadi.

Validatsiya: title 3–120, description ≤ 1000, address ≤ 200, lat/lng chegarada, date_time `YYYY-MM-DDTHH:MM`
va yangi yaratishda o'tmishda bo'lmasligi (Toshkent vaqti UTC+5, 1 soat bag'rikenglik), items ≤ 12 ta, har biri ≤ 40.

CORS: `/api/*` uchun ruxsat etilgan originlar: `https://localhost`, `capacitor://localhost`, `http://localhost`,
`http://localhost:5173`, va so'rov kelgan host'ning o'zi. Header'lar: `Authorization, Content-Type`.
Metodlar: GET, POST, DELETE, OPTIONS. Preflight 204.

Xavfsizlik: barcha SQL bind parametrlar bilan; foydalanuvchi matni hech qachon HTML sifatida chiqarilmaydi;
xatolar ichki tafsilotni oshkor qilmaydi (500 → "Server xatosi", log `console.error`).

## 6. Web (React) — ekranlar va xatti-harakat

- `src/lib/config.js`: `API_BASE = import.meta.env.VITE_API_BASE || ''`, `IS_NATIVE = Capacitor.isNativePlatform()`.
- `src/lib/api.js`: barcha so'rovlar `API_BASE + /api/...`, token qo'shadi, 401 da tokenni tozalaydi.
- Header: logo, qidiruv, "+ Hashar e'lon qilish" (amber), profil tugmasi (kirgan bo'lsa ism bosh harfi, aks holda "Kirish").
- Hero (ixcham): sarlavha "Birgalikda obod qilamiz", subtitr, 3 ta raqam (`/api/stats`): hasharlar, bajarildi, ko'ngillilar.
- Tablar: "Xaritada ko'rish" | "Yaqindagi hasharlar" (geolokatsiya, masofa bo'yicha) | "Bajarilganlar (Oldin/Keyin)".
- Xarita + kartalar (desktop: yonma-yon, chap ro'yxat scroll, o'ng xarita sticky 600px; mobil: xarita tepada 340px).
  Pinlar: PENDING amber, COMPLETED emerald; popup: nom, sana, ko'ngillilar soni, "Qatnashish".
  Xarita plitkalari: CARTO Voyager `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`,
  attribution "© OpenStreetMap © CARTO".
- Karta: status badge ("Kutilmoqda" amber / "Bajarildi" emerald), nom, manzil, sana, kerakli narsalar, ko'ngillilar soni,
  "Qatnashish" (amber) / "✓ Qatnashasiz" / "Yakunlangan". Bosilsa → Hashar tafsiloti oynasi.
- Hashar tafsiloti (modal/sheet): oldin rasmi (yoki Oldin/Keyin slayder), tavsif, manzil, sana, narsalar,
  ko'ngillilar ro'yxati (ismlar), tashkilotchi telefoni (qo'shilgandan keyin, `tel:` havola), xaritada ochish havolasi;
  egasi uchun: "Yakunlash (Keyin rasmi)" va "O'chirish"; qo'shilgan uchun: "Chiqish".
- "Qatnashish" mehmon bossa → Kirish/Ro'yxat oynasi, muvaffaqiyatdan keyin avtomatik qo'shiladi.
- E'lon yaratish: 4 bosqichli modal (1 nom+tavsif, 2 xaritada joy + manzil + "Mening joylashuvim",
  3 sana+vaqt+kerakli narsalar chiplari, 4 "Oldin" rasmi). Mehmon bossa avval Kirish.
- Profil oynasi: ism, telefon, statistika, "Mening hasharlarim" (yaratganlarim / qo'shilganlarim), "Chiqish".
- Bajarilganlar: Oldin/Keyin slayder galereyasi.
- Saytda (native emas) va Android brauzerda: "📱 Android ilovasini yuklab olish" banneri, agar `/api/app` `available`.
- Bo'sh holatlar, yuklanish skeletlari, xato + "Qayta urinish", toast xabarlar.
- Accessibility: tugmalarda aria-label, modal Esc bilan yopiladi, fokus ko'rinadi.
- Native'da: Android "orqaga" tugmasi ochiq modalni yopadi, modal bo'lmasa ilovadan chiqadi (`@capacitor/app`);
  status bar emerald; safe-area hisobga olinadi.

## 7. Android APK (Capacitor 8)

- `appId: uz.hasharchilar.app`, `appName: Hasharchilar`, `webDir: dist`, `android.adjustMarginsForEdgeToEdge: "auto"` (agar versiyada bor bo'lsa).
- Build: `VITE_API_BASE=https://<deploy qilingan domen> npm run build && npx cap sync android && cd android && ./gradlew assembleRelease`.
- Manifest ruxsatlari: INTERNET, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION, CAMERA (rasm olish uchun fayl tanlagich).
- Ikonka: emerald fonda oq barg (adaptive icon + barcha mipmap PNG'lar), splash: emerald fon.
- Imzo: `android/app/build.gradle` `signingConfigs.release` — `android/key.properties` mavjud bo'lsa undan
  (storeFile, storePassword, keyAlias, keyPassword), aks holda debug kaliti bilan imzolanadi (APK baribir o'rnatiladi).
- `versionCode` / `versionName` — Gradle property `-PversionCode=N -PversionName=1.0.N` orqali (CI beradi), standart 1 / "1.0.0".

## 8. CI/CD (`.github/workflows/hasharchilar.yml`)

Trigger: push (branch `claude/peaceful-meitner-zlvydj` va `main`, paths `hasharchilar/**` va workflow fayli), `workflow_dispatch`.
Secretlar: `CLOUDFLARE_API_TOKEN` (mavjud), hisob `31c4b3d8ece4b65de515debc4552334a`,
ixtiyoriy `ANDROID_KEYSTORE_BASE64`/`ANDROID_KEYSTORE_PASSWORD`/`ANDROID_KEY_ALIAS`.

1. `test`: npm ci → build → `wrangler dev` (lokal D1) → `node --test tests/` (API testi).
2. `deploy` (needs test): D1 `hasharchilar` mavjudmi tekshiradi, yo'q bo'lsa yaratadi; R2 `hasharchilar-photos` xuddi shunday;
   generatsiya qilingan wrangler config'ga database_id yoziladi; `wrangler d1 migrations apply hasharchilar --remote`;
   `wrangler deploy`; chiqqan URL `outputs.url` ga; `/api/health` tekshiriladi.
3. `apk` (needs deploy): JDK 21 + Android SDK; `VITE_API_BASE=${{ needs.deploy.outputs.url }}`; APK quradi;
   artefakt sifatida yuklaydi; R2 ga `app/hasharchilar.apk` (metadata version) qo'yadi; GitHub Release yaratadi.

nfcstore resurslariga (Worker `nfcstore-uz`, D1 `DB`, R2 `nfcstore-uploads`) HECH QACHON tegilmaydi.
