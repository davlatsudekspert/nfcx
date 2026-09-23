# hosting/api/* modullari — kontrakt

Har modul: `export async function handle(request, env, url, H)` → `Response` yoki `null` (route topilmasa).
`worker.js` barcha modullarni tartib bilan chaqiradi (`/api/*` uchun, core dispatch'dan KEYIN); hech biri javob bermasa → `404 {error:'not_found'}` (eski o'ziga-proxy olib tashlangan).

`H` — worker.js'dan uzatiladigan yordamchilar (qayta yozma, import qilma):
- `json(body, status=200)`
- `getCurrentUser(request, env)` → `{id,email,phone,isPremium,bannedUntil,...}|null` (nfc_session cookie)
- `requireAdmin(request, env)` → admin `{id, role, ...}|null` (sessiya + IP whitelist); `getCurrentAdmin`
- `getRecord(env, CODE)` → record|null (`rowToRecord` shakli, camelCase); `getRecordOwner(env, CODE)` → user_id|null
- `rowToRecord(row)`, `RECORD_COLUMNS`, `updateRecord(env, code, fields)`
- `cleanStr(v,max)`, `recSafeUrl(v)`, `uploadOrSafeUrl(v)`, `shortText(v,max)`, `safeUrl(v)`, `validCode(code)`, `parseJsonArray(t)`
- `nowTs()` (ISO), `parseDbDate(v)`, `newToken(bytes)`, `sha256Hex(t)`, `hashPassword(p)`, `verifyPassword(p, stored)`
- `reqIp(request)`, `logAdminActivity(env,{action,details,oldValue,newValue,ip})`, `sendTelegramMessage(env, text)` (ADMIN_CHAT_ID ga), `sendTelegramTo(env, chatId, text)`
- `personalIdTierD1(rec)`, `effectiveAccessD1(rec)`, `featureAllowedD1(feature, access)`, `paymentsEnabledD1(env)`
- `ensureCoreSchema(env)`

Qoidalar: har query `.bind()`; egalik tekshiruvi SERVER tomonda (`getRecordOwner === user.id`); javob shakllari `server/index.js` (Express) bilan BIR XIL (frontend `src/lib/db.js` shunga bog'langan); D1 = SQLite (JSONB yo'q → TEXT + JSON.parse; `RETURNING` bor; `ON CONFLICT` bor; `NOW()` yo'q → `H.nowTs()`; `ILIKE` yo'q → `LOWER(x) LIKE LOWER(?)`).
Har modul uchun test: `scripts/test-<modul>.mjs` (`scripts/lib/d1-harness.mjs` orqali, haqiqiy `worker.fetch` bilan).

## Modullar

`auth`, `account`, `engagement`, `catalog`, `media`, `admin-extra`,
`admin-finance`, `telegram`, `assistant`, `moderation`, `comments`,
`notifications`, `featured`, `catalog-feed`, `saves`, `content-archive`,
`app-usage`, `marketplace`
(shu tartibda chaqiriladi — `worker.js: API_MODULES`).

`catalog-feed` — ilova "Tanlov" katalogi, BARCHA bizneslarning
mahsulot va xizmatlari: `GET /api/catalog/feed` (`page`, `limit`,
`q` = nom/tavsif/bo'lim/Business nomi/Business ID/NFC ID,
`kind` = product|service, `category` = food|fashion|electronics|beauty|
education|health|home|auto|other (eski card|sticker|... =
electronics + sub), `sub` = card|sticker|keychain|accessory,
`sort` = new|price_asc|price_desc). Faqat o'qiydi; manba
`company_catalog_items` + faol `companies`. Tur va kategoriya
`listingFields()` bilan aniqlanadi — kompaniya sahifasidagi
`company.catalog[]` ham AYNAN shu maydonlarni oladi (`kind`,
`marketCategory`, `sub`, `section`, `images`, `priceOnRequest`).
Yozish: `POST|PATCH /api/companies/:id/catalog[/:item]` qo'shimcha
`kind`, `marketCategory`, `images[]` (6 tagacha), `priceOnRequest`
(faqat xizmat) qabul qiladi; ustunlar `ensureCatalogListingColumns`
bilan ADD COLUMN orqali qo'shiladi, `company.catalogSchema` = 2.

`saves` — saqlanganlar, hisobga bog'langan: `GET /api/saves?kind=reel|listing`,
`POST /api/saves {kind, ref, saved}` (`user_saves`, 1000 tagacha).

`content-archive` — DALIL ARXIVI. Post, istoriya (egasi, admin, muddati
o'tgan), kompaniya posti, profil videosi va fayli, karta tozalanishi —
o'chirishdan OLDIN o'sha batch ichida `content_archive` ga nusxa
(`archiveStmt`); media fayl R2 dan o'chirilmaydi. Faqat admin:
`GET /api/admin/evidence?source=all|content|comment&kind=&q=&flagged=1`
(izohlar arxivi ham shu ro'yxatda; har yozuvda muallif va profil egasi —
email, telefon), `POST /api/admin/evidence/flag {source, id, flagged, note}`
(`evidence_flags`). Qidiruv va belgilash `admin_activity_log` ga yoziladi.

`app-usage` — ilova foydalanuvchilari. `/api/auth/me` `x-app: nova` bilan
kelsa `app_users` ga yoziladi (birinchi/oxirgi ochilish, soni, platforma;
qurilma ID yig'ilmaydi). Admin: `GET /api/admin/app-users?q=&sort=recent|new|opens`
-> `{stats:{total,today,week,month}, items[{..., profiles[], companies[]}]}`.

Rasm filtri (`image-moderation.js`, modul emas — `uploadApi` chaqiradi):
foydalanuvchi rasmi Gemini bilan tekshiriladi; 18+/zo'ravonlik/
ekstremizm/giyohvandlik/nafrat bo'lsa 422 `{error:'content_blocked',
category}`, fayl saqlanmaydi, urinish `content_scan_blocks` ga yoziladi.
Video/GIF va admin yuklashi tekshirilmaydi; xizmat xatosida yuklash
to'xtamaydi; `MODERATION_OFF=1` bilan o'chadi.

`comments` — izohlar (`content_comments`): `GET|POST
/api/comments/:kind/:id`, `DELETE /api/comments/:id`, bu yerda
`:kind` — `post | company_post | story | company_story`. Lenta
(`/api/feed`) har kadrga `commentKind` va `commentCount` qo'shadi va
sonlarni `countsFor()` orqali BITTA guruhlangan so'rov bilan oladi.

## Lokal ishga tushirish

`node scripts/dev-api-server.mjs` — shu worker'ni Node HTTP serveri
ostida, xotiradagi D1 va demo ma'lumot bilan ko'taradi (production'ga
tegmaydi). Mobil ilovaning uchma-uch testi shunga ulanadi:
`node scripts/test-live-app.mjs`.
