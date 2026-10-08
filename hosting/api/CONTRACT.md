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
- `feedUnionSql`, `shapeFeedRows(env, rows, viewerId)`, `feedViewerLikedKeys(env, rows, viewerId)`, `feedLikedKey(row)`, `commentTargetKind(row)` — lentaning o'zi (`reels`)

Qoidalar: har query `.bind()`; egalik tekshiruvi SERVER tomonda (`getRecordOwner === user.id`); javob shakllari `server/index.js` (Express) bilan BIR XIL (frontend `src/lib/db.js` shunga bog'langan); D1 = SQLite (JSONB yo'q → TEXT + JSON.parse; `RETURNING` bor; `ON CONFLICT` bor; `NOW()` yo'q → `H.nowTs()`; `ILIKE` yo'q → `LOWER(x) LIKE LOWER(?)`).
Har modul uchun test: `scripts/test-<modul>.mjs` (`scripts/lib/d1-harness.mjs` orqali, haqiqiy `worker.fetch` bilan).

## Modullar

`auth`, `account`, `engagement`, `catalog`, `media`, `admin-extra`,
`admin-finance`, `telegram`, `assistant`, `moderation`, `comments`,
`notifications`, `featured`, `catalog-feed`, `saves`, `content-archive`,
`legal-requests`, `app-usage`, `app-admin`, `account-purge`, `admin-control`, `music`,
`demo-businesses`, `highlights`, `story-replies`, `my-analytics`, `reels`, `iap-apple`, `referrals`, `admin-apple`, `marketplace`
(shu tartibda chaqiriladi — `worker.js: API_MODULES`).
`nearby` — `companyApi` dan OLDIN alohida ulangan (`/api/companies/nearby`).
Yordamchi (marshrutsiz) modullar: `carousel`, `product-tags`, `post-contact`,
`scheduled-posts`, `apple-jws` (Apple JWS imzosi — `iap-apple` chaqiradi) — lenta va post yo'llari ularni chaqiradi.

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
(`user_saves.collection_id` qo'shilmagan bo'lsa saqlash eski shaklda ishlaydi,
to'plam amallari 503 `collections_unavailable`)
(`user_saves`, 1000 tagacha; post turlarida `ref` — post raqami).
To'plamlar (`save_collections`, 100 tagacha, nom ≤ 40): `GET|POST /api/saves/collections`,
`PATCH|DELETE /api/saves/collections/:id` (o'chirish saqlanganlarni O'CHIRMAYDI —
`collection_id = NULL`), `POST /api/saves/move {kind, ref, collectionId|null}`.

IJTIMOIY IMKONIYATLAR (2026-10) — to'liq kontrakt har modul boshida:
- KARUSEL (`carousel.js`): `POST /api/records/:code/posts` va
  `POST /api/companies/:id/posts` ixtiyoriy `media:[{url, type:'image'|'video'}]`
  (1–10; 2+ bo'lsa faqat rasm; manzil — faqat `/uploads/<fayl>.<kengaytma>`).
  Ustun `posts.media_json` / `company_posts.media_json`; `imageUrl` = birinchi
  rasm. Postni qaytaradigan HAR javobda `mediaItems` (har doim massiv).
  JAVOBDA `media` KALITI YO'Q (ataylab): eski ilova `Post.fromJson` `media`
  dagi har `url` ni rasm deb oladi — video postda MP4 rasm bo'lib yuklanardi.
  So'rov maydoni (`media`) o'zgarmagan.
- MAHSULOT BELGISI (`product-tags.js`): biznes posti `productIds` (≤ 5, faqat
  o'sha kompaniya katalogidan) → `post_products`; javobda `products[]`
  (shaxsiy postda doim `[]`).
- BIZNES KONTAKTI (`post-contact.js`): lenta va kompaniya postlari ro'yxatidagi
  biznes postida `contact:{phone, telegram, mapUrl}` (faqat ochiq maydonlar).
- AKTUAL (`highlights.js`): `/api/highlights` — `story_highlights`,
  `story_highlight_items` (istoriyaning NUSXASI; fayl tozalovchilari bu
  fayllarni o'chirmaydi). Muqova faqat shu Aktualdagi element rasmi.
  Moderatsiya: `DELETE /api/admin/highlights/:id[/items/:itemId] {reason}`
  (manager+, dalil arxiviga `highlight`/`highlight_item`); admin istoriyani
  o'chirsa (`DELETE /api/admin/content/story|company_story/:id`) undan
  olingan Aktual nusxalari ham o'chadi; shikoyat turi `highlight`.
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
Admin yuklashi tekshirilmaydi; xizmat xatosida (yoki `MODERATION_OFF=1` /
kalit yo'q) yuklash to'xtamaydi, lekin fayl admin navbatiga tushadi va u
bilan chop etilgan kontent tasdiqlanguncha yashirin (pending).

KALITLAR (`flags.js`, 2026-10): `GET /api/app/config` (ochiq, no-store) →
`{flags:{reelsHidden, videoUploadsBlocked, videosHidden, showcase:true}}`;
`GET|PUT /api/admin/flags` (admin; PUT — manager+, admin jurnali). Manba:
env `FLAG_*` → `admin_settings.flag_*`, 60 s isolate keshi, hammasi standart
o'chiq. Issiq yo'llar `peekFlags(env) || await getFlags(env)` (to'lqin qo'shmaydi).
`videoUploadsBlocked` — yuklash/ulash 403 `video_uploads_disabled` (admin
mustasno); `videosHidden` — UNION (`feedUnionSqlFor`), profil/kompaniya/
istoriya ro'yxatlari, Aktual (`highlights.js`) video elementlari, post sahifasi,
`/uploads/*.mp4|webm|mov` 404;
`reelsHidden` — `/api/reels` → `{items:[],hasMore:false,hidden:true}`.

KO'RGAZMA (`showcase.js` + `post_extras`): `showcase:true` bilan post —
1..5 rasm (`mediaUrls`), `title` ≤ 80, `priceUzs` 0..1e10, `linkUrl` (https
YouTube/Instagram), `catalogItemId` (matn, faqat o'sha kompaniya), `imageSeconds`
3..60. Har post JSON'ida `showcase, title, priceUzs, linkUrl, catalogItem,
mediaUrls, pending`. `GET /api/showcase` (`reels.js`) — Reels tartibi, faqat
videosiz `showcase=1` yoki rasmli reel; javobda `cursor` va `nextCursor`.

MODERATSIYA QO'RIQCHISI (`content-guard.js`, modul emas): tekshirilmagan
(`content_reports` reason=`unchecked`, status=`new`) fayl bilan chop etilgan
kontent `content_pending` da — faqat egasiga (`pending:true`), UNION va
ro'yxatlarda yo'q; admin PATCH `resolved|rejected` (media shikoyati) ochadi.
Navbatga yozib bo'lmasa yuklash 503 `moderation_unavailable` (fayl
o'chiriladi); filtr o'chiq bo'lsa ham navbatga yoziladi. `consent_log`
(agreed:true), `deleted_uploads` (o'chirilgan fayl `/uploads` da 404, chegara
keshidan oldin), matnda so'kinish → `text_flag` (bloklamaydi). Kunlik cron
`moderation-retry.js` navbatni Gemini bilan qayta tekshiradi.

`comments` — izohlar (`content_comments`): `GET|POST
/api/comments/:kind/:id`, `DELETE /api/comments/:id`, bu yerda
`:kind` — `post | company_post | story | company_story`. Lenta
(`/api/feed`) har kadrga `commentKind` va `commentCount` qo'shadi va
sonlarni `countsFor()` orqali BITTA guruhlangan so'rov bilan oladi.

Obunalar lentasi (Reels "Obunalar" tabi, 2026-10): `GET
/api/feed?scope=following` — kirgan tomoshabin obuna bo'lgan odamlar
(`follows`, odamning HAMMA kartalari) va kompaniyalar (`company_follows`)
kontenti, xuddi shu shaklda `{feed, hasMore}`. Anonim — 401. Reklama
qo'shilmaydi; bloklash, maxfiylik va rejadagi post shartlari oddiy lenta
bilan bir xil. Noma'lum `scope` — oddiy lenta.

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

`reels` — Reels "Siz uchun" (2026-10, saralangan va sahifalanadigan):
`GET /api/reels?limit=10&cursor=<shaffof>` (kirish ixtiyoriy; `limit` 1..20)
→ `{items, nextCursor: string|null, hasMore}`. `items` — `/api/feed` kadrlari
bilan AYNAN bir shakl (`shapeFeedRows` + `liked`, `kind: 'post'`), pullik
reklama qo'shimcha `featured: true`. Faqat reels: shaxsiy/kompaniya posti,
videosi yoki rasmli reel belgisi (`post_extras.reel`) bor; istoriya yo'q;
ko'rinish qoidalari `FEED_UNION_SQL` dan; bloklangan muallif va "qiziq emas"
yo'q. Nomzodlar — eng yangi 300 reels. Ball: `freshness = 0.5^(soat/36)`,
`engagement = ln(1 + likes + 2·comments + 3·saves + 0.05·views)`,
`score = freshness·(1 + 0.6·engagement)`; obuna ×1.8, ko'rilgan
(`content_views`, tomoshabin `u:<id>`/`a:<hash>`) ×0.12, o'ziniki ×0.35,
`hash(tomoshabin+kun+nishon)` jitter `[0, 0.05)`. Xilma-xillik: bir muallif
qo'shni emas, sahifada ≤ 2. Reklama (faol `featured_slots`, reels bo'lsa)
sahifaning 4 va 9-o'rnida, sahifada ≤ 2, zanjirda bir marta, oddiy kadr
bo'lib takrorlanmaydi. Kursor — base64url JSON (surat vaqti, o'rin, langar,
berilgan reklamalar): keyingi sahifalar surat vaqtigacha bo'lgan ma'lumot
bilan qayta hisoblanadi; buzuq kursor — 1-sahifa (500 emas). Oxirida
`hasMore:false, nextCursor:null`.
`POST /api/reels/hide {kind:'post'|'company_post', id}` (kirish shart, 401)
→ `{ok:true}`, idempotent, yomon nishon 422 `bad_target`, 10 daqiqada 120
tagacha (429). Jadval `reel_hidden(user_id, target_kind, target_id,
created_at)`; hisob o'chirilganda tozalanadi.

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

`legal-requests` — admin "Huquqiy so'rov" (faqat super_admin va manager):
`GET /api/admin/legal/subject?q=<telefon|email|NFC ID|Business ID|#id>&kind=post|reel|story|comment|card_video|card_file&source=live|archive&cursor=&limit=`
→ `{subject, items:[{source:'live'|'archive', kind, id, uid, ownerKind, ownerCode, text, imageUrl, videoUrl, fileUrl, mediaUrls, createdAt, expiresAt, deletedAt, deletedBy, reason, target}], nextCursor}`;
`POST /api/admin/legal/hold {userId, hold, note}` (hold=true — `note` majburiy; olib tashlash faqat super_admin; `account_legal_holds`);
`GET /api/admin/legal/export?userId=&format=json` → `{format, generatedAt, generatedBy, subject, items (≤5000), total, truncated}`.
Har chaqiruv admin jurnalida (`legal_subject_view`, `legal_hold`, `legal_unhold`, `legal_export`).

`iap-apple` — iOS Premium obunasi, Apple In-App Purchase (StoreKit 2). Bayroq
`IAP_APPLE_ENABLED=1` (boshqa qiymat — o'chiq; standart o'chiq). Bundle
`uz.nfcstore.nova`, mahsulotlar `uz.nfcstore.nova.premium.monthly|yearly`.
`GET /api/iap/apple/config` → `{enabled, products}`;
`GET /api/iap/apple/account-token` (auth, 401) → `{token}` (barqaror UUID v4 → `appAccountToken`);
`POST /api/iap/apple/verify {signedTransaction}` (auth) → `{premium:true, premiumExpiresAt, productId, environment}`
yoki `{premium:false, reason:'expired'|'revoked', premiumExpiresAt}`; xatolar: 401 `unauthorized`,
503 `iap_disabled`, 429 `too_many_requests`, 413 `payload_too_large` (>128 KB),
400 `bad_request`|`invalid_signature`, 422 `wrong_bundle`|`unknown_product`|`wrong_type`|`bad_transaction`
|`family_shared_not_supported`|`sandbox_not_allowed`, 403 `account_mismatch`, 409 `already_linked`;
`POST /api/iap/apple/notifications {signedPayload}` (kirishsiz, App Store Server Notifications V2,
bayroq o'chiq bo'lsa ham) → 200 `{ok, result, duplicate?}` | 400 | 413. `result`: `test`, `granted`,
`expired`, `revoked`, `rolled_back`, `rollback_skipped`, `not_granted`, `unknown_user`,
`sandbox_ignored`, `ignored` (Family Sharing ham), `other_bundle`, `unknown_product`, `no_transaction`.
JWS — `apple-jws.js` (Apple Root CA - G3 pin, zanjir, OID, muddat, ES256).

Qoidalar (xavfsizlik ko'rigi, 2026-10-06):
- Berish: `users.premium_expires_at = max(joriy, expiresDate)`; har `transactionId` daftar qatori
  (`iap_apple_transactions`) — DA'VO: uni qo'shgan so'rovgina `users` ni yozadi (bir vaqtdagi
  verify poygasi qaytarishni buzmaydi); da'vogar `users` dan oldin yiqilsa — da'vo o'chiriladi.
- Qaytarish (REFUND/REVOKE): faqat Apple QO'SHGAN vaqt: joriy = berilgan (±2 s) bo'lsa — oldingi
  qiymat; aks holda `yangi = min(joriy, max(prev, joriy − max(0, granted − max(prev, berilgan payt, hozir))))`.
  Payme/Click vaqti olinmaydi; Apple vaqtining ishlatib bo'lingan qismi keyingi to'lovdan
  ayrilmaydi. Foydalanuvchi noma'lum bo'lsa ham daftarga `revoked_at` (user_id 0) — eski JWS qayta berilmaydi.
- Sandbox (Production'dan boshqa har muhit) faqat `IAP_APPLE_ALLOW_SANDBOX=1` yoki user ID
  `IAP_APPLE_SANDBOX_USER_IDS` (vergul bilan) da bo'lsa — bayroqdan qat'i nazar. App Review demo
  hisobining ID'si shu ro'yxatga qo'yiladi (wrangler'ga emas, panelda).
- Obuna egasi (yoki token egasi) o'chirilgan hisob bo'lsa — yangi hisobga ko'chiriladi.
- `notificationUUID` avval `processing` bo'lib da'vo qilinadi; xatoda da'vo o'chiriladi.
- Family Sharing (`inAppOwnershipType = FAMILY_SHARED`) — berilmaydi.
- MA'LUM CHEKLOVLAR (ataylab qoldirilgan): (#6) sayt orqali olingan Premium bor odam Apple
  obunasini olsa, muddatlar QO'SHILMAYDI — `max()` (uzunrog'i qoladi); ilova buni xaridan oldin
  ko'rsatishi kerak. (#10) Billing Grace Period hisobga olinmaydi: DID_FAIL_TO_RENEW/GRACE_PERIOD
  faqat tranzaksiyaning `expiresDate` gacha beradi (App Store Connect'da grace period yoqilsa — qayta ko'rish).
Jadvallar: `iap_apple_account_tokens`, `iap_apple_subscriptions`, `iap_apple_transactions`,
`iap_apple_notifications`. Test: `scripts/test-iap-apple.mjs`, `scripts/test-apple-jws.mjs`.

`iap-apple-boost` — "Ko'tarish" (FEATURED slotlari) iOS'da, Apple IAP consumable'lari
`uz.nfcstore.nova.boost.1d|3d|6d` (1/3/6 kun). Tekshiruvlar `featured.js` dan
(`checkPromoTarget`, `capacityOf`, `stopSlot`); Payme/Click yo'li o'zgarmagan.
`GET /api/iap/apple/config` qo'shimcha `boostEnabled` (bayroq VA to'lovlar yoqiq), `boostProducts:[{productId, days}]`.
`POST /api/iap/apple/boost-intent {targetKind, targetId, days}` (auth; bayroq o'chiq 503 `iap_disabled`)
→ 201 `{intentId, productId, days, holdUntil}` (ms); xatolar POST /api/featured bilan bir xil
(`banned`, `payments_disabled`, `bad_kind`, `bad_target`, `bad_package`, `not_found`, `forbidden`,
`post_scheduled`, `already_featured`+`slotId`, `too_many_active`+`max`, `sold_out`+sig'im), 429, 413.
Ushlab turish: slot `pending`, `source='apple'`, `ends_at` = created_at + 20 daqiqa (uzaytirilmaydi). Bir odamda
bitta amal qilayotgan ushlab turish: o'sha post + o'sha kun — o'sha intent; boshqasi — eskisi bekor, yangi intent
(`days` o'zgartirilmaydi). Yangi ushlab turish soatiga ≤ 6 (429). Ushlab turish faqat boshqa APPLE intentlari
uchun joy egallaydi — sayt (Payme/Click) sig'imi, chegarasi va takror tekshiruvi avvalgidek.
`POST /api/iap/apple/verify {signedTransaction, intentId?}` (consumable) → `{boost:'active', slot:{id, startsAt, endsAt, status}}`
(`status` — slotning HOZIRGI holati: active|expired|stopped) | `{boost:'credited', creditId, days}` | `{boost:'revoked'}`.
To'langan consumable DOIM slot yoki kredit bo'ladi: begona/yaroqsiz intent e'tiborsiz (o'rniga odamning o'z amal
qilayotgan ushlab turishi yoki kredit); kunlar mos kelmasa — to'langan kunlar bilan; joy yo'q — kredit.
Xatolar: 409 `already_linked` | `in_progress`, qolganlari premium verify bilan bir xil. `featured_slots.apple_transaction_id`
— UNIQUE (NULL bo'lmasa). REFUND_REVERSED: to'xtatilgan slot qolgan muddati bilan qayta yonadi (`slot_restored`),
bekor qilingan kredit qaytadi (`credit_restored`). Config'da `boostSalesOpen`, `usersCount`, `openAt`.
`POST /api/iap/apple/boost-redeem {creditId, targetKind, targetId}` → `{boost:'active', slot}`;
404 `credit_not_found`, 409 `credit_used` | `credit_revoked` + intent xatolari.
`GET /api/iap/apple/boost-credits` → `{credits:[{creditId, days, productId, createdAt}]}`.
Bildirishnomalar: REFUND/REVOKE → slot `stopped` (`apple_refund`) yoki kredit bekor (`slot_stopped`|`credit_revoked`|`not_granted`);
CONSUMPTION_REQUEST → `consumption_ack`. Admin `GET /api/admin/featured` qatorlarida `source` ('apple'|'web'|'admin')
va `appleTransactionId`. Jadvallar: `iap_apple_boost_transactions`, `iap_apple_boost_credits`;
`featured_slots` + `source`, `apple_transaction_id` (ADD COLUMN). Test: `scripts/test-iap-apple-boost.mjs`.

KO'TARISH SOTUVI 1000 FOYDALANUVCHIDA (`featured.js`, 2026-10-06): rejim `admin_settings.featured_sales_open`
= `auto` (standart; o'chirilmagan foydalanuvchilar ≥ `FEATURED_OPEN_AT_USERS` = 1000, son 5 daqiqa keshlanadi)
| `open` | `closed`. Birinchi ochilish `featured_sales_opened_at` ga yoziladi — `auto` da qayta yopilmaydi.
Ochilgandan 48 soat — faqat ochilishgacha navbatga yozilganlar (`packages.priority`). `GET /api/featured/packages` qo'shimcha
`{salesOpen, usersCount, openAt, priorityUntil, waitlisted}`. Yopiq paytda `POST /api/featured` va
`POST /api/iap/apple/boost-intent` → 409 `{error:'sales_not_open', usersCount, openAt}`; ustuvor oynada
navbatda bo'lmagan → 409 `{error:'priority_window', endsAt}` (tekshiruv xatolari — avvalgidek, shartdan oldin;
Apple verify/redeem — to'langan, shartga bog'liq emas; admin qo'lda ko'tarish — doim).
`POST /api/featured/waitlist {targetKind?, targetId?}` (auth) → `{waitlisted:true, salesOpen}`, `DELETE` → `{waitlisted:false}`
(`featured_waitlist`, hisob o'chirilganda o'chadi). Ochilganda navbatdagilarga bitta `featured_open` bildirishnomasi
(aktyorsiz; kunlik cron ham — `featuredSalesTick`); ilova so'rovlarida (`x-app: nova` / `X-Client`) bu tur ko'rsatilmaydi.
Admin: `GET /api/admin/featured/waitlist` (manager+) → `{sales, counts:{total, notified}, items}`;
`POST /api/admin/featured/sales {mode}` (super_admin, `featured_sales_mode` jurnalda). Test: `scripts/test-featured-sales.mjs`.

`referrals` — PROMOKOD MUKOFOTI (2026-10-06, ko'rik F1/F2 bilan KECHIKTIRILGAN): mavjud 10% chegirmadan
(auth.js `applyReferral`, ro'yxatda darhol) TASHQARI taklif qiluvchiga har FAOL do'st uchun +30 kun Premium.
Ro'yxatda (faqat tasdiqlangan — email kodi yoki Telegram telefon) faqat `referral_rewards` qatori
`status='pending'` (+ `friend_email_norm`, `friend_phone_verified`). Kunlik cron va do'stning `/api/auth/me`
(isolate'da bir odamga soatiga bir marta) beradi, agar HAMMASI: do'st ≥7 kunlik, o'chirilmagan, ban/muzlatilmagan;
faollik — `app_users` da 2 xil kun YOKI post/istorya YOKI avatar; normallangan email (kichik harf; gmail/googlemail —
nuqtasiz va +tegsiz; boshqalar — +tegsiz) taklif qiluvchinikidan va uning ERTAROQ (pending/granting/granted)
do'stlarinikidan farq qiladi; telefon taklif qiluvchiniki emas. Holatlar: `pending → granting → granted`;
`pending → expired` (60 kun) | `rejected` (`reason`: self, same_phone, duplicate_email, referrer_deleted,
referred_deleted, lifetime). Da'vo — bitta shartli UPDATE (365 kunda `granting`+`granted` < 24); muddat va
`granted` bitta batch'da CAS bilan; yozilmasa `granting` qoladi, cron qayta uradi (da'vo o'chirilmaydi).
O'chirgich `REFERRAL_REWARD_ENABLED='1'` — aks holda hech narsa berilmaydi/eskirmaydi, faqat `pending` to'planadi.
`premium_expires_at = max(hozir, joriy, faol sinov tugashi) + 30 kun`. Bildirishnoma `referral_reward`
(aktyor — do'st; ILOVADA yashirin, `featured_open` kabi; saytda sarlavha — do'stning ochiq ismi, standart
(email "@" oldi / 'Yangi foydalanuvchi') nom bo'lsa bo'sh → sayt "Do'stingiz"). `GET /api/referrals/summary`
(auth) → `{code, link:'https://nfcstore.uz/i/<code>', invited, rewardedDays, pendingRewards, nextRewardDays:30}`
(faqat `granted` kunlar); `GET /api/admin/referrals/leaderboard` → `{last30, allTime}`
(`[{rank, userId, name, code, count, rewardedDays}]`). `GET /i/:code` (worker.js) → kod bor: `Set-Cookie
nfc_ref=<code>` (30 kun, Lax, HttpOnly, Secure) + 302 `/register?ref=<code>`; yo'q → 302 `/`. Ro'yxat formada
promokod bo'lmasa `nfc_ref` cookie'dan oladi, LEKIN `promoCleared:true` (odam to'ldirilgan kodni o'chirgan)
bo'lsa — yo'q; 201 javobida `nfc_ref` o'chiriladi (`Max-Age=0`). AASA'da `/i/*` YO'Q (ko'rik F3) — ilova
/i/:code ni o'qiy oladigan versiya chiqqach qayta qo'shiladi. Test: `scripts/test-referral-rewards.mjs`.

`admin-apple` — admin "Apple / iOS" (2026-10, faqat o'qish, manager+; foydalanuvchi — `userId` + asosiy NFC kodi,
email/telefon/JWS/appAccountToken yo'q; tranzaksiya raqami manager uchun `…oxirgi6`, super_admin uchun to'liq):
`GET /api/admin/apple/summary` → `{flags:{iapEnabled, boostEnabled, allowSandboxAll, sandboxUserCount, sandboxUserIds?(super),
featuredSales}, bundleId, products, counts:{subscriptions, boostTx30d, credits} (production|sandbox|other),
notifications:{last24h, last7d, lastNotificationAt}, problems:{unknownUser7d, staleProcessing, staleBoostClaims,
signatureFailures, lastSignatureFailureAt}, attention, app:{totals, builds}}`;
`GET /api/admin/apple/subscriptions|transactions?kind=premium|boost|notifications|credits` — filtrlar, 50 tadan,
`{items, hasMore, nextCursor}`. Kartochka `GET /api/admin/users/:id/detail` → `apple:{hasToken, subscriptions,
premiumTx, boostTx, credits}`; overview `badges.appleAttention`. Notification imzo xatolari soni
`admin_settings.iap_apple_sig_fail_count/last` (tana saqlanmaydi; isolate'da yig'iladi, bazaga minutiga ≤1
yozuv; bitta IP'dan 10 daqiqada >10 buzuq imzo — 429); daftarlarda `price`, `currency` (JWS'dan).
Premium olib qo'yish (`POST /api/admin/users/:id/premium {action:'revoke'}`) faol Apple obunasida 409
`apple_subscription_active` (+`apple`), faqat `force:true` bilan. `POST /api/admin/featured/:id/stop {reason,
reissueCredit:true}` — faol Apple slotida xaridorga kredit (`admin:<slot>:<tx>`), faqat slotni shu so'rov
haqiqatan to'xtatgan bo'lsa (aks holda 409 `not_stoppable`) va asl tranzaksiya qaytarilmagan bo'lsa (aks holda
`{ok, creditId:null, reason:'refunded'}`). Asl REFUND kreditni ham, undan yoqilgan slotni ham bekor qiladi.
Test: `scripts/test-admin-apple.mjs`.

ADMIN AUDIT (2026-10): ro'yxatlar serverda sahifalanadi — `limit` + `hasMore`: `/api/admin/users`
(+ `status=premium|flagged|blocked|deleted` serverda), `/premium-users` (+ `apple` belgisi va sanog'i),
`/support-messages` (+ `replies[]` tarixi — `support_replies`, javob ≤ 4000 belgi, `platform`, `appBuild`),
`/physical-cards` (`chipToken` o'rniga faqat `tokenTail`), `/featured`, `/activity-log` (+ `q`).
SHAXSIY MA'LUMOT (ko'rik F4): manager'dan past rol (content_manager) uchun bitta qoida `H.piiMaskedD1` —
email `x***@domen`, telefon `***1234`, ism/manzil `X***`: `/users`, `/users/:id/detail` (+ `apple: null`),
`/premium-users`, overview `recent.payments/signups`, `/referrals`, `/app-users`, `/physical-cards`
(ism/telefon/manzil), `/orders` (yetkazish maydonlari), `/support-messages`. `q` qidiruvi content_manager uchun
email/telefon bo'yicha ishlamaydi (faqat NFC ID / nom / raqam). `/api/admin/app-users` sanog'ida test/ichki/o'chirilgan yo'q,
Premium belgisi filtr bilan bir xil ifoda. `/api/admin/review-account` → `userId` ham.
Test: `scripts/test-admin-audit.mjs`.
