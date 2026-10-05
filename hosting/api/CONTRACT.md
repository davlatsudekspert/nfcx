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
`app-usage`, `app-admin`, `account-purge`, `admin-control`, `music`,
`demo-businesses`, `highlights`, `story-replies`, `my-analytics`, `marketplace`
(shu tartibda chaqiriladi — `worker.js: API_MODULES`).
`nearby` — `companyApi` dan OLDIN alohida ulangan (`/api/companies/nearby`).
Yordamchi (marshrutsiz) modullar: `carousel`, `product-tags`, `post-contact`,
`scheduled-posts` — lenta va post yo'llari ularni chaqiradi.

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

`saves` — saqlanganlar, hisobga bog'langan: `GET /api/saves?kind=reel|listing|post|company_post[&collectionId=N|none][&page=&limit=]`
→ `{items:[{kind, ref, createdAt, collectionId, post?}], hasMore?}` (post turlarida
`post` — lenta shaklidagi karta yoki ko'rinmasa `null`, sahifada 30 tagacha),
`POST /api/saves {kind, ref, saved, collectionId?}` → `{kind, ref, saved, collectionId}`
(`user_saves`, 1000 tagacha; post turlarida `ref` — post raqami).
To'plamlar (`save_collections`, 100 tagacha, nom ≤ 40): `GET|POST /api/saves/collections`,
`PATCH|DELETE /api/saves/collections/:id` (o'chirish saqlanganlarni O'CHIRMAYDI —
`collection_id = NULL`), `POST /api/saves/move {kind, ref, collectionId|null}`.

IJTIMOIY IMKONIYATLAR (2026-10) — to'liq kontrakt har modul boshida:
- KARUSEL (`carousel.js`): `POST /api/records/:code/posts` va
  `POST /api/companies/:id/posts` ixtiyoriy `media:[{url, type:'image'|'video'}]`
  (1–10; 2+ bo'lsa faqat rasm; manzil — faqat `/uploads/<fayl>.<kengaytma>`).
  Ustun `posts.media_json` / `company_posts.media_json`; `imageUrl` = birinchi
  rasm. Postni qaytaradigan HAR javobda `media` (har doim massiv).
- MAHSULOT BELGISI (`product-tags.js`): biznes posti `productIds` (≤ 5, faqat
  o'sha kompaniya katalogidan) → `post_products`; javobda `products[]`
  (shaxsiy postda doim `[]`).
- BIZNES KONTAKTI (`post-contact.js`): lenta va kompaniya postlari ro'yxatidagi
  biznes postida `contact:{phone, telegram, mapUrl}` (faqat ochiq maydonlar).
- AKTUAL (`highlights.js`): `/api/highlights` — `story_highlights`,
  `story_highlight_items` (istoriyaning NUSXASI; fayl tozalovchilari bu
  fayllarni o'chirmaydi).
- ISTORIYA JAVOBI (`story-replies.js`): `POST /api/stories/:kind/:id/reply`,
  `GET /api/stories/:kind/:id/viewers` (faqat egasi, manba `story_views`),
  `GET /api/my/story-replies`; egasiga istoriya ro'yxatida `replyCount`.
- YAQINDAGI BIZNESLAR (`nearby.js`): `GET /api/companies/nearby?lat=&lng=&radiusKm=&limit=`.
- REJALASHTIRILGAN POST (`scheduled-posts.js`): `publishAt` (ISO yoki ms;
  kelajakda, ≤ 30 kun) → `publish_at`. Vaqti kelguncha egasidan boshqaga
  HECH QAYERDA ko'rinmaydi (`postLiveSql`/`companyPostLiveSql`, `targetOwner().scheduled`);
  egasiga `scheduledFor` (ms). Lenta tartibi — `COALESCE(publish_at, created_at)`.
Hammasi faqat qo'shimcha (CREATE IF NOT EXISTS / himoyalangan ADD COLUMN);
lenta va ro'yxatlarga yangi ketma-ket to'lqin qo'shilmagan
(`scripts/test-scheduled-posts.mjs` 6-bo'lim o'lchaydi).

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
qurilma ID yig'ilmaydi; `x-app-build` sarlavhasi bo'lsa — `app_build`). Admin: `GET /api/admin/app-users?q=&sort=recent|new|opens`
-> `{stats:{total,today,week,month}, items[{..., platform, appBuild, registeredAt, profiles[], companies[]}]}`.

`app-admin` — admin "NFCSTORE ILOVASI" uchun FAQAT O'QIYDIGAN ko'rinishlar
(jadval yo'q bo'lsa bo'sh ro'yxat): `GET /api/admin/content-blocks?category=&q=`
(avto-filtr jurnali `content_scan_blocks`, muallif `user:<id>` foydalanuvchiga
ulanadi; `stats.byCategory`), `GET /api/admin/app-content?kind=post|reel|story|company_post&q=`
(ko'rinib turgan post/Reels/istoriya/biznes posti; o'chirish — mavjud
`DELETE /api/admin/content/:deleteKind/:id`), `GET /api/admin/company-orders?status=&q=`
(barcha biznes katalogi buyurtmalari). Hammasida `page`, `limit`, `hasMore`.

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

Ko'rishlar (shu modulda): `POST /api/content-views/:kind/:id`
(`post | company_post`) → `{counted, count}`. QOIDA (egasi, 2026-10-04):
odam postga/Reels'ga har KIRIB 2 soniya ko'rganida +1 — qaysi seansda
bo'lishidan qat'i nazar; o'sha videoda turib qolsa va u aylanib o'ynasa —
qayta sanalmaydi (ilova bitta kirishda bitta so'rov yuboradi). Tomoshabin —
`u:<id>` yoki mehmon `a:<IP+UA hash>`. Egasi hech qachon sanalmaydi; o'sha
tomoshabinning oldingi sanalgan ko'rishidan 2 soniya o'tmagan so'rov
sanalmaydi (`counted:false`). Mehmon IP bo'yicha 10 daqiqada 120 tagacha
(oshsa 429); kirgan foydalanuvchi 10 daqiqada 300 tagacha (oshsa XATO EMAS —
200 `counted:false`). Jadvallar: `content_view_hits` — jami ko'rishlar
(tomoshabin × kontent × UTC kun, `hits` sanog'i), `content_views` — qamrov
(bir tomoshabin — bir qator). `count` va hamma `viewCount` (lenta, profil va
kompaniya postlari, `/post/:id` sahifasi) — JAMI ko'rishlar `SUM(hits)`
(`viewsFor()`). Eski `content_views` qatorlari bir marta (`maintenance_runs`:
`content_view_hits_backfill_2026_10`) birinchi kunining bitta ko'rishi
bo'lib ko'chirilgan. Kontent o'chirilganda ikkala jadval ham
`retireTargetStmts`/`deleteLikesFor` bilan, hisob o'chirilganda tomoshabin
qatorlari `account-purge.js` bilan ketadi.

`my-analytics` — ilovadagi Sozlamalar → Analitika: `GET /api/my/analytics?days=30`
(auth, 1–90) → `{days, profile:{views, uniqueVisitors, clicks, totalViews},
followers, content:{posts, views, reach, likes, comments}, byDay[{day, views}],
top[{kind, id, code, imageUrl, videoUrl, caption, createdAt, views, reach, likes, comments}]}`
— faqat o'z kartalari va kompaniyalari bo'yicha. Kontent `views` — tanlangan
davrdagi (UTC kun aniqligida) JAMI ko'rishlar `SUM(hits)`: `content.views` =
`byDay` yig'indisi = `top`/postlar `views` yig'indisi; `reach` — o'sha davrda
takrorsiz tomoshabinlar soni.

## Lokal ishga tushirish

`node scripts/dev-api-server.mjs` — shu worker'ni Node HTTP serveri
ostida, xotiradagi D1 va demo ma'lumot bilan ko'taradi (production'ga
tegmaydi). Mobil ilovaning uchma-uch testi shunga ulanadi:
`node scripts/test-live-app.mjs`.
