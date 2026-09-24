# ACCOUNT_DELETION_PLAN.md: hisobni o'chirishning Google Play talabiga mos xavfsiz rejasi

> **Holat: faqat reja.** Kod o'zgartirilmagan, hech narsa deploy qilinmagan, production D1/R2 ga tegilmagan.
> Sana: 2026-09-23. Qator raqamlari `HEAD a3c7df6` bo'yicha. `hosting/`, `db/` va `wrangler.jsonc` da `49a7d81` va `origin/main` bilan farq yo'q.
>
> **Dalillar:**
> - read-only kod auditi;
> - in-memory D1 harness probe'lari (`scripts/lib/d1-harness.mjs`, foreign key'lar D1 dagidek yoqilgan). Probe fayllari: `scratchpad/wf3/harddelete-probe.mjs`, `giftpath-probe.mjs`, `probe-delete.mjs`, `probe-fin.mjs`;
> - `node:sqlite` tekshiruvi: `datetime('2026-09-23 12:00:00.123+00')` → `NULL`; `json_each('<JSON emas>')` → `malformed JSON`.
>
> **Belgilar:**
> - `[F]`: moliyaviy yozuvlarni saqlash muddati;
> - `[E]`: dalil arxivini saqlash muddati;
> - `[B]`: zaxira nusxa muddati.
>
> Uchala qiymatni egasi va yurist tasdiqlaydi (9-bo'lim). Rejada ular ataylab to'ldirilmagan.

---

## 1. Muammo

### 1.1 Hozirgi "o'chirish" aslida deaktivatsiya

| Yo'l | Nima qiladi | Dalil |
|---|---|---|
| Ilova (Nova) | Sozlamalar → Xavfsizlik → "Hisobni o'chirish" → `DELETE /api/account` | `mobile_nova/lib/features/settings/settings_subscreens.dart:343-356, 371-432`; `mobile_nova/lib/features/profile/profile_repository.dart:314` |
| Server | Faqat `UPDATE users SET deleted_at = COALESCE(deleted_at, ?)` va `DELETE FROM sessions` | `hosting/api/account.js:619-630`. Izoh `:611-614`: qator to'lov tarixi uchun ataylab qoldiriladi |
| Sayt | Xuddi shu endpoint | `src/pages/DeleteAccountPage.jsx:114` (origin/main) |
| Admin | Xuddi shu soft delete, email `oldValue` ga yoziladi | `hosting/api/admin-extra.js:303-315` |
| Email orqali | Faqat matn ("30 kun ichida bajariladi"), orqasida hech qanday mexanizm yo'q | `DeleteAccountPage.jsx:90`, `PrivacyPage.jsx:117,120` |
| Keyingi tozalash | **Yo'q**: `scheduled` handler ham, cron ham yo'q | `hosting/worker.js:10485` faqat `fetch` ni eksport qiladi; `wrangler.jsonc` da `triggers` yo'q |

**O'chirish qaytariladigan qilib qurilgan:**
- `worker.js:3573-3597` dagi izohda: "`deleted_at` tozalansa, profil qaytadi".
- `scripts/test-deleted-user-content.mjs:136-141` shu tiklanishni tasdiqlaydi.
- `hosting/api/app-usage.js:124` buni amalda qiladi: Play review hisobi uchun `deleted_at = NULL` qo'yadi.

**Harness natijasi.** `DELETE /api/account` dan keyin quyidagilarning hammasi joyida qoladi:
- `users` qatori: email, telefon, `password_hash`;
- `cards`: to'liq profil va kontaktlar;
- `follows`, `companies`, `content_comments`, `user_saves`;
- postlar, istoriyalar, xabarlar;
- R2 dagi barcha media.

### 1.2 Nega Google Play buni rad etadi

User Data siyosati ikki narsani talab qiladi:
- hisob yaratish mumkin bo'lgan ilovada hisobni **va unga bog'langan ma'lumotlarni** o'chirish so'rovini ilovada ham, vebda ham berish imkoni;
- vaqtincha o'chirish, bloklash yoki "muzlatish" o'chirish hisoblanmaydi.

Bizning holat aynan shunday: faqat bayroq qo'yiladi va sessiyalar yopiladi. Bundan tashqari, foydalanuvchiga ko'rsatiladigan matnlar noto'g'ri narsani va'da qiladi:
- `mobile_nova/lib/l10n/arb/app_uz.arb:391` `settingsDeleteConfirm`: "Hisob butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi." Bu noto'g'ri: `deleted_at` ni tozalab hisobni qaytarish mumkin.
- `app_uz.arb:938` `deleteAccountWhat`: "…ommadan darhol olib tashlanadi… Buni qaytarib bo'lmaydi."
- `DeleteAccountPage.jsx:94`: "…buni qaytarib bo'lmaydi".
- `PrivacyPage.jsx:116` (uz: `:42`): "Ma'lumotlar hisobingiz faol ekan saqlanadi." Bu ham noto'g'ri: hisob o'chirilgandan keyin ham ma'lumotlar muddatsiz saqlanadi.

### 1.3 O'chirish bilan bog'liq tasdiqlangan buglar

| # | Bug | Dalil | Xavf |
|---|---|---|---|
| **B1 (P0)** | `hardDeleteUser` moliyaviy yozuvlarni o'chirib yuboradi | `auth.js:284` `DELETE FROM users` qator sxemadagi `ON DELETE CASCADE` bo'yicha zanjir bo'ylab o'chiradi: `transactions` (`0001-schema.sql:605`), `wallet_topups` (:650), `web_orders` (:664), `bids` (:112), `premium_requests` (:515), `support_messages` (:593). Probe: har biri 1 → 0. | Production'da hozir ham sodir bo'lishi mumkin: soft-delete qilingan email bilan qayta ro'yxatdan o'tish (`auth.js:680-682`) yoki sovg'a faollashtirish (`account.js:731-737`). B11 ga qarang: buni begona odam ham qo'zg'ata oladi |
| **B11 (P0)** | Soft-delete qilingan hisobni begona odam qaytarilmas o'chira oladi | Sovg'a faollashtirish (`account.js:703-737`) faqat aktivatsiya kodini talab qiladi. Chaqiruvchi kiritgan istalgan email qabul qilinadi va `:726-737` shu emaildagi soft-deleted foydalanuvchini o'chiradi. Ro'yxatdan o'tishda email xizmati o'chiq bo'lsa (`worker.js:5157-5159`): `email = rawEmail \|\| placeholderEmailForD1(phone)` (`auth.js:627,631`), OTP faqat `if (emailOn)` bo'lganda tekshiriladi (`auth.js:659`), telefon esa umuman tasdiqlanmaydi (`auth.js:126-142`). Keyin `finishRegistration` → `hardDeleteUser` (`auth.js:679-682`) | Sovg'a kodi bor odam, yoki email xizmati o'chiq paytda telefon yoki emailni biladigan odam, boshqaning hisobini (B1 bilan birga moliyaviy yozuvlarini ham) 30 kunlik bekor qilish oynasini chetlab o'chira oladi |
| B2 | Sovg'a faollashtirishda o'chirish umuman ishlamaydi | `account.js:731-737` `bot_orders.user_id` ni NULL qilmaydi. `bot_orders.user_id` da ON DELETE qoidasiz FK bor (`schema:137`). Probe: "FOREIGN KEY constraint failed" | Bot buyurtmasi bor, soft-delete qilingan email bilan sovg'ani faollashtirib bo'lmaydi |
| B3 | `users.id` qayta ishlatiladi | `schema:618-619`: `INTEGER PRIMARY KEY`, AUTOINCREMENT yo'q. Probe: yangi foydalanuvchi o'chirilgan hisobning id=2 sini oldi | Yangi odamga eski egasining `companies`, `notifications`, `user_saves`, `app_users`, `featured_slots`, `content_comments`, `company_follows`, `email_reset_tokens` qatorlari o'tib ketadi |
| B4 | Hard delete'dan keyin kompaniya yana ommaga chiqadi | `companyOwnerAliveSql` (`worker.js:3606-3608`) faqat `deleted_at` li `users` qatori mavjud bo'lganda yashiradi. Harness: ELITEBIZ 404 → 200 | Egasining telefoni va manzili yana ommaga ochiladi |
| B5 | O'chirilgan foydalanuvchining izohlari ommada qoladi | `comments.js:626-633` (ro'yxat) va `countFor` `:368-373` muallif tirikligini tekshirmaydi. Harness: anonim `GET /api/comments/post/81` izohni "Boshqa" nomi bilan qaytardi | `DeleteAccountPage.jsx:81` dagi va'daga zid |
| B6 | Dalil arxivida muallif ham, profil egasi ham noto'g'ri ko'rinadi | `content-archive.js:195-219` (`peopleFor`) email va telefonni o'qish paytida jonli `users` dan oladi. Profil egasini jonli `cards` va `companies` dan oladi (`:200, 203`), natijada `ownerRec` / `userCard(people, ownerRec?.userId)` (`:306, 326`). `q` qidiruvi ham faqat jonli `users` bo'yicha ishlaydi (`:274-275`) | Hard delete'dan keyin muallif bo'sh qoladi, id qayta ishlatilsa boshqa odam chiqadi. Kod yoki Business ID qayta sotilgach, eski o'chirilgan kontentning "profil egasi" sifatida **yangi egasi** (ismi, emaili, telefoni) ko'rinadi |
| B7 | Foydalanuvchiga qarzdorlik tekshirilmaydi | `users.balance`, `held_balance`, `pending_payout` (`schema:623-628`) | Foydalanuvchining puli "yo'qoladi" |
| B8 | R2 media hech qachon o'chirilmaydi | `/uploads/*` egasi tekshirilmasdan beriladi (`worker.js:10601-10609`, `serveUpload` `:7115`), `UPLOAD_CACHE_CONTROL = 'public, max-age=31536000, immutable'` (`:6371`) | "O'chirilgan" hisobning rasmlari havola bo'yicha ochilaveradi |
| B9 | Test bo'shlig'i | `scripts/test-card-cleanup.mjs` regex'i faqat ko'p qatorli CREATE TABLE ni tutadi | Bir qatorli jadvallar (`schema:760-786`) va runtime'da yaratiladigan jadvallar tekshirilmaydi |
| B10 | Email yo'li bajarilmaydi | Hech narsa kuzatilmaydi. Faqat telefon bilan ochilgan hisoblarda email ichki placeholder (`auth.js:631`, `worker.js:3829`) | "Hisob emailidan yozing" degan yo'l ular uchun ishlamaydi |
| B12 | Suspend qilingan foydalanuvchi ilovada ham, saytda ham hisobini o'chira olmaydi | `suspended_until` kelajakda bo'lsa `getCurrentUser` null qaytaradi (`worker.js:3183`), shuning uchun `DELETE /api/account` 401 beradi (`account.js:620-621`). Login 403 `account_suspended` qaytaradi (`worker.js:5618-5620`) | Ilova ichidagi o'chirish yo'li ular uchun yopiq |
| B13 | "5 yilgacha" saqlanadigan jurnallarda allaqachon PII bor | `admin-extra.js:313` (`oldValue: user.email`), `auth.js:684-685` (email), `account.js:787` (`nfc_gift_activated` `${code} — ${email}`), `content-archive.js:299` (`evidence_search q=<email\|telefon>`). `rate_limits` kaliti xom email yoki telefonni o'z ichiga oladi (`worker.js:5602`), tozalash esa 24 soatdan eski qatorlarni faqat 1% ehtimol bilan o'chiradi (`worker.js:7610`). Admin Telegram xabarida yetkazish uchun ism va telefon bor (`worker.js:4588-4593`) | Purge bularni o'chirmaydi. "Jurnallarda email yozilmaydi" degan va'da hozir noto'g'ri |
| B14 | U ga yuborilgan kutilayotgan sovg'a taklifi bekor qilinmaydi | Mavjud statement faqat `code IN CODES` bo'yicha ishlaydi (`card-cleanup.js:75`). Kutilayotgan taklif yuboruvchining kodini qulflab qo'yadi (`account.js:594-595` `ALREADY_PENDING`), yuboruvchi ro'yxatida esa U ning emaili ko'rinadi (`worker.js:9241`) | Boshqa foydalanuvchining kodi bloklanadi. O'chirilgan odamning emaili, purge'dan keyin esa tombstone manzili, boshqalarga ko'rinadi |

---

## 2. Maqsad va chegaralar

### 2.1 Maqsad

**So'rov → darhol yopish va yashirish → 30 kunlik grace → qaytarilmas purge.** Purge natijasi:

| Sinf | Nima | Amal |
|---|---|---|
| **A**: shaxsiy ma'lumot, profil, UGC | email, telefon, parol xeshi, profillar, biznes sahifalari, postlar, istoriyalar, izohlar, layklar, obunalar, saqlanganlar, U yozgan xabarlar, bildirishnomalar, R2 fayllar | **DELETE** yoki qaytarib bo'lmaydigan ANONYMIZE |
| **B**: moliyaviy yozuv | buyurtma, to'lov, tranzaksiya, taklif (bid), jismoniy karta yetkazish | **RETAIN `[F]`**. Qator, summa va mahsulot atributlari qoladi. Ism, telefon, manzil va maket havolalari tozalanadi |
| **C**: yuridik dalil arxivi (U1) | `content_archive`, `content_comment_archive`, `evidence_flags`, `*_orphans`, `content_scan_blocks`, `evidence_identity`, `evidence_owner_history` | **RETAIN `[E]`**, purge tegmaydi. Bu privacy policy'da oshkor qilinadi |
| **D**: xavfsizlik | sessiyalar, OTP, tokenlar, kvotalar, U ning login rate-limit kalitlari; admin jurnallari | Sessiya, OTP, token va U ning kalitlari **DELETE**. Jurnallar **RETAIN, 5 yilgacha**. Yangi yozuvlarda email yoki telefon bo'lmaydi, eskilari tozalanadi yoki oshkor qilinadi (9-bo'lim, 20-savol) |

### 2.2 Qat'iy chegaralar

1. **Egasining yozma tasdiqisiz production'ga hech narsa chiqmaydi.** Purge alohida kalit bilan boshqariladi: `ACCOUNT_PURGE_MODE = off | dry-run | on`, standart qiymati `off`.
2. **Destruktiv migratsiya yo'q.** `DROP TABLE` qilinmaydi, jadval qayta yaratilmaydi, FK o'zgartirilmaydi. SQLite'da `ON DELETE CASCADE` ni olib tashlash uchun jadvalni qayta qurish kerak bo'ladi, shuning uchun unga tegilmaydi.
   - Buning o'rniga `users` qatori **hech qachon DELETE qilinmaydi**. U tombstone sifatida qoladi, shu bois cascade umuman ishga tushmaydi. Bu B1, B3 va B4 ni ildizidan yopadi.
   - Faqat `ALTER TABLE … ADD COLUMN` va `CREATE TABLE IF NOT EXISTS` ishlatiladi. `ensureColumnD1` (`worker.js:2543`) modulning ichki funksiyasi va `H` obyektida (`worker.js:10429-10462`) yo'q, shuning uchun u `hasColumnD1` bilan birga `H` ga qo'shiladi.
3. **Moliyaviy qatorlar o'chirilmaydi:**
   - `transactions`, `wallet_topups`, `web_orders`, `bids`, `premium_requests`;
   - `auctions`, `bot_orders`, `physical_cards`, `featured_slots`;
   - `company_payments`, `marketplace_activations`, `nfc_gifts`.
4. **Purge dalil arxiviga tegmaydi, o'zgartirmaydi.** Arxivdagi media fayllar R2 dan o'chirilmaydi (`content-archive.js:19`, `urlArchived` `:133-144`). Mavjud admin izoh tiklash yo'li arxivda `restored_at` ni yangilaydi (`comments.js:962-983`). Bu arxivdagi yagona ruxsat etilgan UPDATE va u `deleted_reason='account_purge'` bo'lgan izohga ishlamasligi kerak (5.1).
5. **Xavfsizlik jurnallari** (`admin_activity_log`, `company_status_log`, `content_scan_blocks`) purge paytida o'chirilmaydi. "5 yildan eskisini tozalash" alohida kalit bilan qilinadi va egasi tasdiqlagandan keyingina yoqiladi.
6. **Worker infratuzilmasi o'zgarmaydi:**
   - Worker nomi `nfcstore-uz` qoladi.
   - `DB`, `UPLOADS`, `ASSETS` binding'lari o'zgarmaydi, buni `scripts/test-worker-bindings.mjs` tekshiradi.
   - `export default` dagi `fetch` o'rami o'zgarmaydi, faqat `scheduled` qo'shiladi. Ichki o'zgarishlar faqat 5.1 da sanalganlari: login 403 dagi `purgeAfter`, yangi admin marshrutlari, izoh filtri va ro'yxatdan o'tish yoki sovg'a yo'lidagi 409.
7. **Legal hold.** Quyidagi hollarda purge kutadi:
   - firibgarlik yoki tergov sababli super_admin "hold" qo'ygan bo'lsa;
   - hisobni admin o'chirgan bo'lsa (`deletion_source='admin'`);
   - so'rov manbasi noma'lum eski soft-delete bo'lsa (`deletion_source IS NULL`).

   Oxirgi ikki holatda purge super_admin ko'rib chiqquncha (`purge_reviewed_at`) kutadi. Bu Play ruxsat bergan "fraud prevention/security" asosi va u oshkor qilinadi.
8. **Purge loglarida PII bo'lmaydi: faqat sonlar yoziladi.** Bu faqat cron qatori uchun kafolat. Workers Logs (`observability`, `head_sampling_rate: 1`, `wrangler.jsonc:67-69`) admin URL'laridagi `:id` ni yozadi, `fetch` ning catch bloki esa `url.pathname` ni yozadi (`worker.js:10511`).
9. **Egasi javob bermagan savollarda standart qaror: saqlash.** Qaytarilmas purge ochiq savollar bo'yicha o'chirmaydi. Quyidagilar `off` holatdagi kalit ortida turadi:
   - `support_messages` (6-savol);
   - `company_orders` (7-savol);
   - suhbatdoshning xabarlari va suhbatlar (12-savol);
   - eski admin jurnallarini tozalash (20-savol).
10. **Grace'ni faqat tasdiqlangan ega yoki super_admin qisqartira oladi.** Darhol purge faqat ikki holatda bo'ladi: aynan shu emailga yuborilgan OTP ishlatilgan bo'lsa (4-bo'lim, [3]) yoki super_admin `PURGE #<id>` bilan tasdiqlasa.

---

## 3. Jadval bo'yicha reja

`U` = foydalanuvchi id. `CODES` = `SELECT code FROM cards WHERE user_id = U`. `COMPANIES` = `SELECT company_id FROM companies WHERE CAST(owner_user_id AS TEXT) = CAST(U AS TEXT)`.

**Qamrov qoidasi:** karta va kompaniya kontenti **faqat** `CODES` va `COMPANIES` bo'yicha tanlanadi, `posts.user_id` yoki `stories.user_id` bo'yicha emas. Sovg'a qabul qilinganda faqat `cards.user_id` ko'chadi (`worker.js:9434`). `user_id = U` bo'lgan postlar va istoriyalar endi B ning kartasida turgan bo'lishi mumkin, ya'ni ular B ning kontenti.

### 3.1 Hisob yadrosi

| Jadval (ta'rif) | Bog'lanish | Amal | Sabab |
|---|---|---|---|
| `users` (`schema:618`; `worker.js:2130`; `is_internal` :2498, `trial_expires_at`/`premium_expires_at` :2622-2623, `signup_source` :2635) | `id` | **ANONYMIZE (tombstone):**<br>• `email` → `'deleted-'‖id‖'@deleted.invalid'`<br>• `password_hash` → `'!'`<br>• `phone`, `promo_code`, `suspend_reason` → NULL<br>• `signup_source` → NULL (ustun mavjud bo'lsa)<br>• `purged_at` qo'yiladi<br>**RETAIN:** `id`, `created_at`, `deleted_at`, `deletion_source`, `balance`, `held_balance`, `pending_payout`, `is_test`, `is_internal`<br>Yangi ustunlar ro'yxati 5.2 da | Cascade ishga tushmaydi (B1), id qayta berilmaydi (B3), `deleted_at` qolgani uchun `ownerAliveSql` va `companyOwnerAliveSql` qolgan narsalarni yashirishda davom etadi (B4). Email bo'shaydi (`UNIQUE(email)` buzilmaydi). Balanslar B sinfi |
| `sessions` (:577) | `user_id` | DELETE (so'rov paytida allaqachon) | D |
| `password_reset_codes` (:434) | `user_id` | DELETE | D |
| `email_reset_tokens` (`worker.js:2350`, FK yo'q) | `user_id` | DELETE | D. B3 bo'yicha meros qolmasin |
| `email_otp_codes` (:444) | `email` (eski) | DELETE | D |
| `phone_otp_codes` (:454), `tg_link_tokens` (`worker.js:2341`), `bot_verifications` (:140) | `phone` (eski) | DELETE, faqat shu raqam boshqa **tirik** hisobda bo'lmasa | D. Boshqa odamning kirishini buzmaslik uchun |
| `bot_messages` (`telegram.js:46`) | `tg_user_id` (TEXT) ← `bot_verifications.tg_user_id` va `bot_orders.tg_user_id` | DELETE, faqat shu `tg_user_id` boshqa **tirik** hisobga (`bot_verifications.phone` yoki `bot_orders.user_id` orqali) bog'lanmagan bo'lsa. `bot_verifications` o'chirilishidan **oldin** bajariladi | A (erkin matn). Boshqa odamning qo'llab-quvvatlash yozishmasi o'chib ketmasin |
| `app_users` (`app-usage.js:34`) | `user_id` | DELETE | A |
| `upload_quota` (`worker.js:2311`) | `key = 'user:'‖U` | DELETE | D |
| `rate_limits` (`worker.js:2304`) | kalit satri | `login:acct:<email>` va `login:acct:<telefon>` kalitlari DELETE (kalit `worker.js:5602` da hosil bo'ladi). Qolganlari TTL bilan tozalanadi | D. Kalitda xom email yoki telefon turadi, tozalash esa ehtimollikka bog'liq (`worker.js:7610`) |
| `admin_activity_log` (:5) | matn | **RETAIN, 5 yilgacha.** Yangi yozuvlarda email emas, `#id` yoziladi (5.1). Eski yozuvlarda (`details`, `old_value`, `new_value`) U ning email va telefoni `#id` ga almashtiriladi. Bu `SCRUB_ADMIN_LOG` kaliti bilan qilinadi, standart `off` (20-savol). Kalit yoqilmasa, jurnallarda email, telefon va IP borligi 7-bo'limda oshkor qilinadi | D |

### 3.2 Profil va kontent

| Jadval | Bog'lanish | Amal | Sabab |
|---|---|---|---|
| `cards` (:222) | `user_id` | DELETE (kontent tozalangandan keyin). URL'lar avval R2 navbatiga yoziladi | A |
| `CARD_CONTENT_TABLES` (14 ta, `card-cleanup.js:28-32`) | `code IN CODES` | Mavjud `cardContentCleanupStmts` orqali DELETE: post, istoriya, video va fayl **avval arxivlanadi** (:44-47) | A va C |
| Karta istoriyalariga yozilgan izohlar | `target_kind='story'` | `retireTargetStmts(env,'story', …)`, istoriyalar o'chirilishidan **oldin** | C. `cardContentCleanupStmts` buni qilmaydi (bo'shliq) |
| `card_team`, **boshqalarning** kartasida | `member_code IN CODES` | `UPDATE … SET member_code = NULL`. Ism va rasmni o'sha karta egasi kiritgan, ular o'sha egasining kontenti | A. Kod qayta sotilsa havola begona odamga o'tmasin |
| `catalog_item_reactions` / `_views` / `catalog_promotions` (`schema:760/764/768`) | `code IN CODES` | DELETE | A. Hozir cleanup ro'yxatida yo'q |
| `content_comments` (`comments.js:99`), **foydalanuvchining o'zi yozgan** | `user_id` | `content_comment_archive` ga nusxa (`reason='account_purge'`), keyin `deleted_at` qo'yiladi, `body=''`, `author_code=''` | C: nusxa arxivda. A: jonli jadvalda matn qolmaydi. Javoblar (`parent_id`) buzilmaydi |
| `content_likes` (:121), `post_likes` (:487), `card_likes` (:191), `story_likes` (`worker.js:2769`) | `user_id` | DELETE | A. Tombstone bo'lgani uchun cascade endi yo'q, shuning uchun aniq DELETE yoziladi |
| `story_views` (`worker.js:2783`) | `viewer = 'u'‖U` (`worker.js:9855`) | DELETE | A |
| `follows` (:335) | `follower_id` / `followee_id` | DELETE, ikkala yo'nalishda | A |
| `company_follows` (`worker.js:2803`) | `user_id = U` **yoki** `company_id IN COMPANIES` | DELETE | A |
| `user_saves` (`saves.js:32`) | `user_id` | DELETE | A |
| `notifications` (`notifications.js:38`) | `recipient_user_id` / `actor_user_id` | DELETE, ikkala yo'nalishda | A |
| `user_blocks` (`moderation.js:89`) | `user_id = U`, shuningdek foydalanuvchiga, uning kodlariga yoki kompaniyalariga qaratilgan bloklar | DELETE. `target_kind` qiymatlari `moderation.js` dan olinadi | A. Kod yoki kompaniya qayta sotilsa blok yangi egaga o'tmasin |
| `blocked_users` (:115) | `blocker_id` / `blocked_id` | DELETE | A |
| `messages` (:384) | `sender_id` | **Standart:** faqat `DELETE FROM messages WHERE sender_id = U`. Tombstone FK ni saqlab turadi | A. Worker endi xabar yozmaydi. Yagona foydalanish `worker.js:9232` dagi o'qilmaganlar sonini o'qish, ya'ni bu legacy ma'lumot |
| `conversations` (:288) va suhbatdoshning xabarlari | `user_a_id` / `user_b_id` | **Standart: qoladi.** To'liq DELETE faqat `PURGE_CONVERSATIONS=on` bo'lsa, 12-savolga javob kelgandan keyin | Boshqa odam yozgan xabarlar |
| `gift_offers` (:347) | `from_user_id` / `to_user_id` | U yuborgan **va U ga yuborilgan** barcha kutilayotgan takliflar `cancelled` qilinadi, `decided_at` qo'yiladi. Bu so'rov paytida ham, purge'da ham bajariladi. Qatorlar **RETAIN**: faqat id va kod | B tarixi. `card-cleanup.js:72` niyati shu. Mavjud `:75` faqat `code IN CODES` ni qamraydi (B14) |
| `referral_uses` (:543) | `referrer_id` / `referred_id` | **RETAIN**: faqat id, tombstone'ga bog'lanadi | Bonus hisob-kitobi. Email allaqachon yashirilgan (`worker.js:9455`) |
| `auction_demand_votes` (:63), `auction_requests` (:72) | `user_id` | DELETE | A |
| `user_reports` (:608) | `reporter_id` / `reported_id` | **RETAIN, `[E]`**. Tombstone tufayli cascade yo'q. `reported_id = U` bo'lsa `evidence_identity` snapshot'i olinadi (3.5) | C/D. Foydalanuvchiga qarshi shikoyatlar dalil bo'lib qoladi |
| `content_reports` (`moderation.js:71`) | `reporter_id` | **RETAIN.** `reporter_ip` → `''` | C/D |
| `support_messages` (:585) | `user_id` | **Standart: RETAIN.** DELETE faqat `PURGE_SUPPORT_MESSAGES=on` bo'lsa, 6-savolga javob kelgandan keyin. Tombstone id qayta ishlatilmaydi | A/D. Saqlansa, 7-bo'limda oshkor qilinadi |

### 3.3 Kompaniyalar

| Jadval | Bog'lanish | Amal | Sabab |
|---|---|---|---|
| `company_posts` (`worker.js:2792`) | `company_id IN COMPANIES` | `archiveStmt('company_post')` + `retireTargetStmts('company_post')`, keyin DELETE | A va C |
| Kompaniya istoriyalari (`stories`, `owner_kind='company'`) + ularning layk, ko'rish va izohlari | `owner_id IN COMPANIES` | `archiveStmt('story', "owner_kind='company' AND …")` + `retireTargetStmts('company_story')`, keyin likes/views/stories DELETE | A va C |
| `company_catalog_items` (:778, FK CASCADE → companies) | `company_id` | Aniq DELETE yoziladi, cascade'ga tayanilmaydi. Arxivlanmaydi (`ARCHIVE_KINDS`, `content-archive.js:31`), 21-savolga qarang | A |
| `company_stats` (`worker.js:2723`) | `company_id` | DELETE | A |
| `company_orders` (`worker.js:2732`, FK yo'q) | `company_id` | **Standart: qoladi.** DELETE faqat `PURGE_COMPANY_ORDERS=on` bo'lsa, 7-savolga javob kelgandan keyin. Javob kelguncha shu Business ID qayta sotuvga chiqmaydi, aks holda yangi egasi eski mijozlarning ism va telefonlarini ko'radi | A. Ichida **mijozlarning** ismi va telefoni bor, to'lov bog'lanmagan |
| `physical_cards.linked_company_id`, boshqalarning `cards.company_id` | `IN COMPANIES` | `UPDATE … = NULL`. Faqat ustun mavjud bo'lsa bajariladi (5.2) | Bog'lanish uziladi |
| `companies` (:772). Ichida `owner_email`, `phone`, `telegram`, `whatsapp`, `address`, `lat/long`, `card_number` (`worker.js:3040-3046`), logo, cover, gallery, music | `owner_user_id` | DELETE. URL'lar avval R2 navbatiga, `company_id` esa `evidence_owner_history` ga yoziladi | A. **B4 yopiladi** |
| `company_status_log` (:784) | `company_id`, `actor` | **RETAIN, 5 yilgacha** | D/C |
| `company_payments` (:786) | `owner_user_id` | **RETAIN `[F]`**, o'zgarishsiz | B |
| `company_id_rules` (:782) | `company_id` | Tegilmaydi | Shaxsiy ma'lumot emas |

### 3.4 Moliyaviy yozuvlar (B): RETAIN `[F]`

| Jadval | Amal | Sabab |
|---|---|---|
| `transactions` (:596), `wallet_topups` (:642), `bids` (:102), `premium_requests` (:508) | RETAIN, o'zgarishsiz. `user_id` tombstone'ga ishora qiladi | Buxgalteriya va soliq |
| `web_orders` (:653) | RETAIN. `payload` `kind` bo'yicha oq ro'yxatga keltiriladi, `purged: 1` qo'shiladi:<br>• `physical_card_order`: `quantity`, `finish`, `printSpec`, `shippingCarrier` qoladi (`account.js:566-572`)<br>• `featured_slot`: `slotId`, `targetKind`, `targetId`, `days` qoladi (`featured.js:308`)<br>• `premium_upgrade`: `{}` o'zgarmaydi<br>• boshqalari, jumladan `card_purchase`: faqat `quantity` va `auctionId`. `createRecordD1` bu payload'dagi profil maydonlarini yoyadi (`worker.js:4628`), shuning uchun u maydonlar olib tashlanadi<br>`shipping{Name,Phone,Address}` va `design{Front,Back}Url` hech qachon qolmaydi (`worker.js:4250, 4539, 8430`). `code`, `price`, `status`, `kind`, `payme_transaction_id`, `created_at` qoladi | `payload` da to'liq kartochka va yetkazish ma'lumotlari bor. Mahsulot atributlari PII emas, ular buxgalteriya uchun kerak. Bosma maket fayllari (`cardprint_`) R2 navbatiga tushadi |
| `bot_orders` (:124) | RETAIN. `tg_username`, `tg_name`, `record_data` → NULL. `tg_user_id` (NOT NULL) va `screenshot_file_id` to'lov isboti sifatida qoladi (egasiga savol) | B |
| `physical_cards` (:464) | RETAIN (`chip_token`, `status`). `shipping_name`, `shipping_phone`, `shipping_address` → NULL.<br>`active = 0` faqat U ning o'z profili yoki kompaniyasiga ulangan yoki hech narsaga ulanmagan qurilmalarda qo'yiladi. 3-4-bosqichlardan keyin ularda `linked_code` va `linked_company_id` NULL bo'ladi (`card-cleanup.js:79`).<br>**Boshqa odamning jonli kartasiga** ulangan qurilma faol qoladi: sovg'a faqat `cards.user_id` ni ko'chiradi (`worker.js:9434`), `physical_cards.owner_user_id` esa U da qoladi (22-savol).<br>Blocker faqat `physical_card_order` dan kelgan, hali yetkazilmagan qatorlarga qo'llanadi (5.3) | B. Hozirgi `hardDeleteUser` bu qatorlarni butunlay o'chiradi (`auth.js:280`) |
| `auctions` (:82) | RETAIN. `seller_payout_status` yakuniy holatda bo'lsa `seller_payme_number` → NULL | B |
| `featured_slots` (`featured.js:65`) | RETAIN. `active`/`pending` holatlari `status='stopped'` yoki `'cancelled'` bo'ladi, `stopped_reason='account_deleted'` (`featured.js:345-347, 391` dagi naqsh bo'yicha) | B |
| `marketplace_activations` (`marketplace.js:184`) | RETAIN, o'zgarishsiz | B |
| `nfc_gifts` (:418) | RETAIN. `activated_by_user_id = U` bo'lgan qatorlarda `recipient_name` → NULL | B |

### 3.5 Dalil arxivi (C): RETAIN `[E]`

- Purge quyidagi jadvallarga **hech qanday UPDATE yoki DELETE qilmaydi**, faqat yangi qatorlar qo'shadi:
  - `content_archive` (`content-archive.js:65`);
  - `content_comment_archive` (`comments.js:138`);
  - `evidence_flags` (:93);
  - `post_likes_orphans` / `content_likes_orphans` (`comments.js:491/493`);
  - `content_scan_blocks` (`image-moderation.js:131`).
- **Yangi jadval `evidence_identity`** (`user_id`, `email`, `phone`, `captured_at`) U1 talabiga javob beradi.
  - Unga tombstone'dan **oldin**, faqat quyidagi hollardan biri bo'lsa yoziladi:
    - foydalanuvchining arxivda yozuvi bor va o'sha yozuvning `created_at` i `users.created_at` dan keyin (ikkalasi `sec()` bo'yicha solishtiriladi). Production'da hard delete bo'lgan, shuning uchun qayta berilgan id eski dalilni yangi odamning emailiga bog'lab qo'ymasin;
    - `user_reports.reported_id = U`;
    - U ning kodi yoki kompaniyasiga qaratilgan ochiq (`resolved_at IS NULL`) `content_reports` bor (`owner_code` yoki `target_id` bo'yicha; `owner_code` ni mijoz yuboradi, `moderation.js:154`).
  - Bu B6 ning muallif qismini yopadi.
  - Saqlash muddati `[E]`. Egasi tasdiqlashi kerak (9-bo'lim, 4-savol).
- **Yangi jadval `evidence_owner_history`** (`owner_kind`, `owner_id`, `user_id`, `released_at`). Purge batch'ida, kartalar va kompaniyalar o'chirilishidan **oldin**, `CODES` va `COMPANIES` → U shu jadvalga yoziladi.
- **Arxiv ko'rinishida egani aniqlash** (`content-archive.js:195-219, 306, 326`):
  - egasi avval `evidence_owner_history` dan olinadi: shu `owner_id` uchun `released_at` arxiv yozuvining `deleted_at` idan keyingi eng yaqin yozuv;
  - `content_archive` qatorlarida arxivlash paytida yozilgan `e.user_id` ham ko'rsatiladi;
  - jonli `cards` va `companies` faqat tarixda yozuv bo'lmasa ishlatiladi. Shunda qayta sotilgan kod yoki Business ID ning yangi egasi eski kontentning egasi sifatida chiqmaydi (B6);
  - `q` qidiruvi (`:274-275`) `evidence_identity.email` / `phone` ni ham qamraydi.
- **Admin izoh tiklash** (`comments.js:962-983`) `deleted_reason='account_purge'` bo'lsa 409 qaytaradi. Aks holda purge qilingan (bo'sh) izoh qayta tiriladi va arxiv o'zgaradi.

### 3.6 R2 (`nfcstore-uploads`, kalit formati `uploads/[<prefix>_]<hex>.<ext>`)

| Manba | Amal |
|---|---|
| `cards.avatar_url/bg_url`<br>`cards.music_url`: JSON massiv yoki eski bitta URL (`parseMusicUrls`, `worker.js:3368-3378`)<br>`card_gallery.image_url`, `card_team.photo_url`<br>`menu_items/products/services.image_url`<br>`card_videos.video_url/thumb_url`, `card_files.file_url`<br>`posts.image_url/video_url`, `stories.image_url/video_url`<br>`companies.logo_url/cover_url/gallery_json/music_json`<br>`company_posts.*_url`<br>`company_catalog_items.image_url/images_json`<br>`web_orders.payload.designFrontUrl/designBackUrl` | Purge batch **ichida** `purge_media_queue` ga yoziladi. JSON ustunlar (`music_url`, `gallery_json`, `music_json`, `images_json`) `json_each(CASE WHEN json_valid(x) THEN x ELSE json_array(x) END)` orqali o'qiladi, `''` va NULL tashlab yuboriladi. Noto'g'ri JSON butun batch'ni yiqitmaydi.<br>Commit bo'lgandan keyin fayl R2 dan **o'chiriladi**, lekin ikki holatda qoladi: `urlArchived()` rost qaytarsa (C sinfi) yoki fayl boshqa jonli qatorda ishlatilayotgan bo'lsa.<br>Katalog, menyu, galereya, avatar va logo/cover fayllari arxivlanmaydi va o'chiriladi (21-savol) |
| `customMetadata.actor = 'user:<id>'` bo'yicha qidirish | Ixtiyoriy, alohida admin sweep. Cron'da ishlatilmaydi: R2 da metadata bo'yicha qidirish yo'q, `list` esa qimmat |
| Railway'dan ko'chirilgan eski fayllar (nomi formatga mos kelmaydi) va admin fayllari (`news_`, `fin_`) | Avtomatik o'chirilmaydi. Eski fayllar soni hisobotda ko'rsatiladi va ular qo'lda ko'rib chiqiladi |

---

## 4. Oqim

```
[1] So'rov ─► [2] Darhol ─► [3] Grace, 30 kun ─► [4] Purge (cron) ─► [5] R2 ─► [6] Audit yozuvi
```

**[1] So'rov (3 ta kanal, bitta natija)**
- **Ilova yoki sayt:** `DELETE /api/account`. Server `deleted_at` ni (birinchi so'rov vaqti, `COALESCE`) va yangi `deletion_source='self'` ni yozadi. U yuborgan va U ga kelgan kutilayotgan `gift_offers` bekor qilinadi (B14).
  - Javob: `{ ok: true, purgeAfter: "<sana>" }`.
- **Admin:** `POST /api/admin/users/:id/delete` endi `deletion_source='admin'` yozadi. Jurnalga `oldValue: user.email` o'rniga `#id` yoziladi. Bunday hisob ko'rib chiqilguncha hold'da turadi (2.2, 7-band).
- **Email:** admin "O'chirish navbati" bo'limida so'rovni `deletion_source='email'` bilan qo'yadi.
  - Undan oldin shaxs tasdiqlanadi: hisob emailiga kod yuboriladi.
  - Faqat telefonli hisoblarda telefon OTP faqat Telegram bot orqali keladi (`auth.js:592-594`), SMS yo'q. Telegram'ga ulanmagan telefonli foydalanuvchi uchun boshqa yo'l kerak. Tavsiya: `/delete-account` sahifasida telefon va parol bilan tasdiqlash (16-savol).
  - So'rov 7 kun ichida qabul qilinadi.
- **Suspend qilingan foydalanuvchi** (B12): ilova va sayt ular uchun ishlamaydi (`worker.js:3183`, `account.js:620-621`, `worker.js:5618-5620`). Ular email yoki admin kanaliga aniq yo'naltiriladi: login 403 `account_suspended` ekranida va 7-bo'limdagi matnlarda.

**[2] Darhol ta'sir (hozir ham shunday, o'zgarmaydi)**
- Barcha sessiyalar yopiladi.
- Profil, kompaniya va kontent `ownerAliveSql` / `companyOwnerAliveSql` / `visibleUserSql` orqali yashiriladi.
- **Yangi (B5):** izohlar ro'yxati va sonlarida ham muallif tirikligi filtri qo'shiladi.

**[3] Grace: 30 kun. Qaror: bekor qilish faqat qo'llab-quvvatlash orqali, login orqali emas.**

Sabablar:
1. Login hozir o'chirilgan hisobni uch joyda bloklaydi: `worker.js:3182` (`getCurrentUser`), `:5617` (403 `account_deleted`) va `:5613-5614` (telefon bo'yicha `deleted_at IS NULL`). "Login qilsang tiklanadi" varianti uchala joyni o'zgartirishni va ilova hamda saytga yangi UI qo'shishni talab qiladi. Release oldidan bu ortiqcha xavf.
2. Parolni o'g'irlagan odam egasi so'ragan o'chirishni jimgina bekor qila olmasligi kerak.
3. Ilova va saytdagi matnlar allaqachon "kira olmaysiz" deydi. UX o'zgarmaydi, faqat muddat aytiladi.

Qanday ishlaydi:
- Login'da parol tekshirilgandan **keyin** (`:5616` dan keyin, shuning uchun hisob borligi oshkor bo'lmaydi) 403 javobiga `purgeAfter` qo'shiladi. Ilova "Hisob o'chirish navbatida, {sana}. Bekor qilish uchun {kontakt}" deb ko'rsatadi.
- Bekor qilish: super_admin `POST /api/admin/account-deletions/:id/restore` ni chaqiradi. U faqat `purged_at IS NULL` bo'lsa ishlaydi va `deleted_at = NULL` qiladi.
- Variant B (keyinroq, egasi xohlasa): `POST /api/account/restore` endpoint'i, parol va email OTP bilan.

Grace davridagi maxsus holatlar:
- **Shu email bilan qayta ro'yxatdan o'tish** (`auth.js:679-687`). Darhol xavfsiz purge (tombstone) **faqat** ikki shart bajarilsa ishlaydi: `emailOn` va aynan shu email uchun yuborilgan OTP ishlatilgan bo'lsa (`auth.js:659-664`; `finishRegistration` ga `emailVerified` uzatiladi). Boshqa har qanday holatda 409 `account_pending_deletion` qaytadi va "qo'llab-quvvatlashga yozing" deyiladi, eski hisob tegilmaydi. Bu holatlar: email xizmati o'chiq, placeholder email yoki blocker bor. Bu B11 ni yopadi. Bu qoida 7-bo'limda oshkor qilinadi.
- **Sovg'a faollashtirish** (`account.js:703-737`): soft-deleted email bo'lsa **har doim** 409 `account_pending_deletion` qaytadi, hech narsa o'chirilmaydi. Aktivatsiya kodi shaxsni tasdiqlamaydi (B11). Bu B1 va B2 ni ham shu yo'lda yopadi.
- **Play review hisobi** (`app-usage.js:118-125`) `deleted_at` ni tozalaydi, ya'ni so'rovni bekor qiladi. Bu bizning test hisobimiz, shuning uchun maqbul. Tombstone qilingan qator email bo'yicha topilmaydi, u holda yangi hisob yaratiladi.

**[4] Purge job**
- Cloudflare Cron Trigger va `export default { scheduled }` ishlatiladi.
- Kuniga bir marta, `"30 21 * * *"` UTC (Toshkent vaqti bilan 02:30).
- `sec(x)` = `substr(replace(x,'T',' '),1,19)`. Formatlar aralash (`nowTs()` `…+00`, `CURRENT_TIMESTAMP`), `datetime()` esa `+00` ni tanimaydi. Shuning uchun `comments.js` dagi `sec()` naqshi ishlatiladi.
- Tanlov:
  ```sql
  WHERE deleted_at IS NOT NULL AND purged_at IS NULL
    AND sec(deleted_at) <= <hozir − 30 kun>
    AND (purge_next_attempt_at IS NULL OR sec(purge_next_attempt_at) <= <hozir>)
    AND (deletion_source IN ('self','email') OR purge_reviewed_at IS NOT NULL)
    AND id NOT IN (SELECT user_id FROM account_legal_holds)
  ORDER BY sec(deleted_at) LIMIT PURGE_MAX_USERS   -- standart 3
  ```
  Bloklangan foydalanuvchilar tanlovdan chiqarilgani uchun ular navbatni to'xtatib qo'ya olmaydi.
- Har bir foydalanuvchi uchun:
  1. `purgeBlockers()` tekshiriladi. Blocker bo'lsa batch'dan tashqarida `purge_blocked_reason` va `purge_next_attempt_at = hozir + 1 kun` yoziladi.
     - Grace tugaganidan keyin 14 kundan ortiq bloklangan hisob admin navbatida "kechikkan" deb belgilanadi va admin Telegram'iga faqat soni yuboriladi (23-savol).
  2. `dry-run` rejimida faqat sonlar hisoblanadi.
  3. `on` rejimida **bitta atomik `env.DB.batch`** bajariladi.
- **Idempotentlik:**
  - Batch'ning **birinchi** statement'i `INSERT INTO account_deletion_log (user_ref, …)`. `user_ref` UNIQUE, shuning uchun ikkinchi urinish constraint xatosi beradi, butun batch rollback bo'ladi va bu "allaqachon bajarilgan" deb qayd etiladi.
  - Tombstone `UPDATE … WHERE purged_at IS NULL` bilan cheklangan.
  - Barcha DELETE'larni qayta ishlatish xavfsiz.
- **Loglar:** faqat sonlar. Masalan: `{"evt":"account_purge","mode":"on","candidates":3,"purged":2,"blocked":{"balance":1},"r2":{"deleted":14,"keptArchived":5,"keptReferenced":1,"errors":0},"ms":812}`. Email, telefon va id yozilmaydi. Bu faqat cron qatori uchun kafolat (2.2, 8-band).

**[5] R2**
- Batch commit bo'lgandan keyin `drainPurgeMediaQueue()` ishlaydi. Bitta ishga tushishda **50 tagacha URL** olinadi. "Arxivda bormi" va "jonli qatorda ishlatiladimi" tekshiruvlari har bir URL uchun alohida emas, bitta partiya uchun bitta `UNION`/`IN` so'rovi bilan qilinadi. D1 bitta chaqiruvga so'rov chegarasi qo'yadi (5.5).
- Har bir URL uchun:
  - URL `^/uploads/(?:[a-z]+_)?[0-9a-f]{20,}\.[a-z0-9]+$` ga mos kelmasa yoki `news_` / `fin_` prefiksli bo'lsa (admin fayllari: `worker.js:7056`, `admin-finance.js:382`), navbatdan olib tashlanadi, fayl saqlanadi va "legacy/admin" deb hisoblanadi.
    - Prefiks ixtiyoriy, chunki base64 yuklash yo'li (avatar, post, istoriya, katalog, audio) prefikssiz `uploads/<20hex>.<ext>` yozadi (`worker.js:7047-7048, 7056`). Prefiksli yo'l esa `<prefix>_<24hex>` yozadi (`:6662`).
  - `urlArchived(env,url)` rost bo'lsa, fayl **saqlanadi**;
  - URL istalgan jonli qatorda ishlatilsa (3.6 dagi ustunlar, JSON maydonlar `json_each` bilan), fayl **saqlanadi**;
  - aks holda `env.UPLOADS.delete(key)` chaqiriladi (1000 tagacha kalit massiv bilan).
- Xato bo'lsa `attempts+1` qilinadi va keyingi ishga tushishda qayta urinadi. Navbat D1 da turgani uchun Worker yiqilsa ham fayl "unutilmaydi".
- **Edge kesh:**
  - `serveUpload` R2 dan oldin `caches.default` ni tekshiradi (`worker.js:7119-7129`), kesh kaliti esa `url.origin + pathname` (`worker.js:7112`).
  - Cron'da so'rov origin'i yo'q va u tasodifiy colo'da ishlaydi. Shu sabab cron'dan `caches.default.delete` chaqirish amalda foyda bermaydi va ishlatilmaydi.
  - O'chirilgan fayllar edge keshlarda va brauzer keshida (`immutable`, 1 yil, `worker.js:6371`) evict bo'lguncha berilaveradi.
  - Shuning uchun `ACCOUNT_PURGE_R2="on"` dan oldin ikki yo'ldan biri tanlanadi: Cloudflare "purge by URL" tokeni qo'shiladi (14-savol) yoki bu cheklov 7-bo'limda oshkor qilinadi.

**[6] Audit yozuvi**
- `account_deletion_log` ga faqat quyidagilar yoziladi: `user_ref = sha256('acct-purge:'‖id)`, `requested_at`, `purged_at`, `source`, `counts_json` (faqat sonlar).
- Bu Google yoki regulyator so'rasa bajarilganini isbotlash uchun kerak.
- Id tombstone va moliyaviy qatorlarda qoladi, shuning uchun `user_ref` anonim emas, psevdonim. Bu hujjatda ochiq yozilgan.

---

## 5. Kod o'zgarishlari

### 5.1 Fayllar ro'yxati

| Fayl | O'zgarish |
|---|---|
| **YANGI** `hosting/api/account-purge.js` | Eksportlar:<br>• `PURGE_GRACE_DAYS`<br>• `ensurePurgeSchema(env, H)`<br>• `purgeBlockers(env, userId, now, cfg)`<br>• `purgePlan(env, user, now)`: deklarativ ro'yxat bo'lib, dry-run sonlari va statement'lar **bir xil** WHERE'dan quriladi<br>• `purgeDeletedUser(env, H, userId, { mode, reason })`<br>• `runAccountPurge(env, H, { limit })`<br>• `drainPurgeMediaQueue(env, { limit })`<br>• `handleAdmin(request, env, url, H)` |
| `hosting/api/card-cleanup.js` | `cardContentCleanupStmts(env, codeSelect, binds, nowTs, by = { reason: 'card_cleanup' })`: ixtiyoriy `by` qo'shiladi, mavjud chaqiruvlar o'zgarmaydi. Istoriyalar o'chirilishidan oldin `retireTargetStmts(env,'story', …)` qo'shiladi |
| `hosting/api/auth.js:276-286, 627-687` | `hardDeleteUser` → `purgeDeletedUser(env, H, id, { mode: 'on', reason: 'reregister' })`. `DELETE FROM users` **olib tashlanadi**. `finishRegistration` `emailVerified` (`emailOn && rawEmail`, OTP `:659-664` da ishlatilgan) oladi: u bo'lmasa yoki blocker bo'lsa 409 `account_pending_deletion` qaytaradi. `:684-685` dagi jurnal matnida email emas, `#id` yoziladi |
| `hosting/api/account.js:619-630` | `deletion_source='self'`, javobda `purgeAfter`. U yuborgan va U ga kelgan kutilayotgan `gift_offers` bekor qilinadi (B14) |
| `hosting/api/account.js:703-737, 787` | Soft-deleted email bo'lsa 409 `account_pending_deletion` qaytadi, nusxa batch (`:731-737`) olib tashlanadi (B1, B2, B11). `nfc_gift_activated` jurnalida email o'rniga `#<user.id>` yoziladi |
| `hosting/api/admin-extra.js:303-315` | `deletion_source='admin'`, `oldValue` = `#id` |
| `hosting/api/comments.js:368-373, 382+, 626-633` | Muallif tirikligi filtri: `AND NOT EXISTS (SELECT 1 FROM users du WHERE du.id = cc.user_id AND du.deleted_at IS NOT NULL)` (B5). Qaytariladigan, hech narsa o'chirmaydi |
| `hosting/api/comments.js:962-983` | Admin tiklash `deleted_reason='account_purge'` bo'lsa 409 qaytaradi |
| `hosting/api/content-archive.js:195-219, 274-275, 299, 306, 326` | `purged_at IS NOT NULL` bo'lsa email va telefon `evidence_identity` dan olinadi (faqat admin). Egasi `evidence_owner_history` / `e.user_id` dan aniqlanadi (3.5). `q` `evidence_identity` ni ham qamraydi. `evidence_search` jurnalida xom `q` emas, uning turi va hash'i yoziladi (B6, B13) |
| `hosting/api/featured.js:62`, `moderation.js:68`, `saves.js:29`, `app-usage.js:31` | Mavjud `ensureSchema` / `ensureTable` funksiyalari `export` qilinadi, ichi o'zgarmaydi |
| `hosting/worker.js` | • `export default` ga `scheduled` qo'shiladi (`fetch` o'rami o'zgarmaydi)<br>• `H` ga (`:10429-10462`) `ensureColumnD1` va `hasColumnD1` qo'shiladi<br>• login 403 javobiga `purgeAfter` qo'shiladi, `account_suspended` ekrani uchun email kanaliga yo'naltirish<br>• `account-purge.js` admin marshrutlari dispatch qilinadi<br>• `:5602` rate-limit kalitida xom login o'rniga `sha256Hex` ishlatiladi<br>• `:4588-4593` Telegram xabarida ism va telefon o'rniga buyurtma raqami yoziladi (B13) |
| `wrangler.jsonc` | `"triggers": { "crons": ["30 21 * * *"] }`<br>`vars.ACCOUNT_PURGE_MODE: "off"`, keyin `"dry-run"`, keyin `"on"`<br>`vars.ACCOUNT_PURGE_R2: "off"`<br>`vars.PURGE_SUPPORT_MESSAGES`, `PURGE_COMPANY_ORDERS`, `PURGE_CONVERSATIONS`, `SCRUB_ADMIN_LOG`: `"off"`<br>`name`, `d1_databases`, `r2_buckets`, `assets.binding` **o'zgarmaydi** |
| `src/pages/AdminPage.jsx` (origin/main) | "O'chirish navbati" bo'limi: id, so'rov sanasi, purge sanasi, manba, blocker'lar va ularning muddati, hold, "ko'rib chiqilmagan". Tugmalar: "Tiklash", "Hold", "Ko'rib chiqildi", "Dry-run", "Hozir tozalash" (faqat super_admin, `PURGE #<id>` deb yozib tasdiqlanadi) |
| `src/pages/DeleteAccountPage.jsx`, `src/pages/PrivacyPage.jsx` | 7-bo'limdagi matnlar (uz, ru, en) |
| `mobile_nova/lib/l10n/arb/app_{uz,ru,en}.arb` → `gen/` | 7-bo'limdagi matnlar. `authAccountPendingDeletion` kaliti qo'shiladi |
| `scripts/test-card-cleanup.mjs` | Regex bir qatorli va runtime `CREATE TABLE` ni ham tutadigan qilinadi (B9) |
| `scripts/lib/d1-harness.mjs:14, 72-76` | `makeEnv(extraEnv, opts)`: ikkinchi argument `{ atomicBatch }`. Birinchi argument `env` ga yoyiladi, shuning uchun opsiya u yerga qo'yilmaydi |

### 5.2 Sxema (faqat qo'shish)

```js
// ensurePurgeSchema: hech narsa o'chirmaydi va o'zgartirmaydi.
// H.ensureColumnD1 5.1 da H ga qo'shilgandan keyin mavjud bo'ladi.
for (const c of ['purged_at', 'deletion_source', 'purge_reviewed_at',
                 'purge_next_attempt_at', 'purge_blocked_reason']) {
  await H.ensureColumnD1(env, 'users', c, 'TEXT');
}
await env.DB.batch([
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS "account_deletion_log" (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_ref TEXT NOT NULL UNIQUE,
    requested_at TEXT, purged_at TEXT NOT NULL, source TEXT, counts_json TEXT)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS "purge_media_queue" (
    url TEXT PRIMARY KEY, queued_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS "account_legal_holds" (
    user_id INTEGER PRIMARY KEY, note TEXT NOT NULL, set_by TEXT NOT NULL, set_at TEXT NOT NULL)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS "evidence_identity" (
    user_id INTEGER PRIMARY KEY, email TEXT, phone TEXT, captured_at TEXT NOT NULL)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS "evidence_owner_history" (
    owner_kind TEXT NOT NULL, owner_id TEXT NOT NULL, user_id TEXT NOT NULL, released_at TEXT NOT NULL,
    PRIMARY KEY (owner_kind, owner_id, user_id, released_at))`),
]);
```

Batch'dagi `DELETE FROM <jadval>` jadval yo'q bo'lsa butun batch'ni yiqitadi. Buning oldini olish uchun purge'dan oldin mavjud `ensure*` funksiyalar chaqiriladi:
- `ensureCoreSchema`;
- `comments.ensureSchema`, `notifications.ensureSchema`;
- `ensureArchiveTable`;
- `ensureMarketplaceTables` (`marketplace.js:159`);
- kompaniya va istoriya sxemalari;
- 5.1 da export qilingan `featured`, `moderation`, `saves` va `app-usage` sxemalari.

**Jadval va ustun qo'riqchisi.** `sqlite_master` dan jadvallar ro'yxati o'qiladi va yo'q jadvallar uchun statement qo'shilmaydi. Keyin quyidagi kech (lazy) qo'shiladigan ustunlar `PRAGMA table_info` (yoki `hasColumnD1`) bilan tekshiriladi va natija `cfg.cols` ga yoziladi:

| Ustun | Qayerda qo'shiladi |
|---|---|
| `physical_cards.linked_company_id` | `marketplace.js:218`, `worker.js:9400` |
| `physical_cards.marketplace_batch_id` | `worker.js:9316` |
| `cards.company_id` | `worker.js:2602` |
| `content_comments.deleted_at` / `deleted_reason` | `comments.js:172-174`. Batch tashqarisida qo'shiladi, xato yutib yuboriladi |
| `users.signup_source` | `worker.js:2635` |

Ixtiyoriy ustun yo'q bo'lsa, unga tegishli statement batch'ga qo'shilmaydi. Majburiy ustun (`content_comments.deleted_at`) yo'q bo'lsa, foydalanuvchi `purge_blocked_reason='schema'` bilan o'tkazib yuboriladi.

### 5.3 Blocker'lar

```js
const SEC = (c) => `substr(replace(${c},'T',' '),1,19)`;
const DAY_AGO = `strftime('%Y-%m-%d %H:%M:%S','now','-1 day')`;
const FINAL_PHYSICAL_STATUSES = `'delivered'`;   // to'plam: pending/printing/shipped/delivered (worker.js:8533)

export async function purgeBlockers(env, userId, now, cfg) {
  const b = [];
  const u = await one(env, `SELECT balance, held_balance, pending_payout FROM users WHERE id = ?`, userId);
  if (u.balance || u.held_balance || u.pending_payout) b.push('balance');           // B7
  if (await one(env, `SELECT 1 FROM account_legal_holds WHERE user_id = ?`, userId)) b.push('legal_hold');
  // Payme/Click hali to'lashi mumkin bo'lgan yangi buyurtma (24 soatdan yangi).
  // datetime(created_at) ISHLATILMAYDI: nowTs() '…+00' yozadi, datetime() esa NULL qaytaradi.
  if (await one(env, `SELECT 1 FROM web_orders WHERE user_id = ? AND status = 'pending'
                       AND ${SEC('created_at')} > ${DAY_AGO}`, userId)) b.push('pending_order');
  if (await one(env, `SELECT 1 FROM bot_orders WHERE user_id = ? AND status = 'pending'`, userId)) b.push('bot_order');
  if (await one(env, `SELECT 1 FROM auctions WHERE (seller_id = ? OR highest_bidder_id = ?)
                       AND status IN ('active','awaiting_payment')`, userId, userId)) b.push('auction');
  // Faqat physical_card_order dan kelgan va hali yetkazilmagan qurilma.
  // Marketplace qurilmalari 'pending' holatida qo'shiladi va holati hech qachon o'zgarmaydi
  // (marketplace.js:709-710, 1190-1191; aktivatsiya faqat egani qo'yadi :560, 1373).
  const mkt = cfg.cols.has('physical_cards.marketplace_batch_id') ? ' AND marketplace_batch_id IS NULL' : '';
  if (await one(env, `SELECT 1 FROM physical_cards WHERE owner_user_id = ? AND shipping_name IS NOT NULL${mkt}
                       AND status NOT IN (${FINAL_PHYSICAL_STATUSES})`, userId)) b.push('physical_card');
  return b;
}
```

24 soatdan eski `pending` web buyurtmalar purge batch'ida `cancelled` qilinadi (`featured.js:347` naqshi). Blocker bo'lsa `purge_blocked_reason` va `purge_next_attempt_at` yoziladi (4-bo'lim, [4]).

### 5.4 Purge batch (tartib muhim)

```js
export function purgeStmts(env, u, now, ref, cfg) {
  const id = u.id, idT = String(u.id);
  const CODES = `SELECT code FROM cards WHERE user_id = ?`;
  const COS = `SELECT company_id FROM companies WHERE CAST(owner_user_id AS TEXT) = ?`;
  const s = (sql, ...b) => env.DB.prepare(sql).bind(...b);
  const col = (t, c) => cfg.cols.has(`${t}.${c}`);          // 5.2: PRAGMA natijasi
  const flag = (k) => String(cfg.flags[k] || 'off') === 'on'; // 9-bo'lim javobigacha 'off'
  const SEC = (c) => `substr(replace(${c},'T',' '),1,19)`;
  const by = { userId: 0, admin: 'system', reason: 'account_purge' };
  const phoneFree = `NOT EXISTS (SELECT 1 FROM users o WHERE o.phone = ? AND o.id <> ? AND o.deleted_at IS NULL)`;
  const tgFree = `NOT EXISTS (
      SELECT 1 FROM bot_verifications bv JOIN users o ON o.phone = bv.phone
       WHERE CAST(bv.tg_user_id AS TEXT) = bot_messages.tg_user_id AND o.id <> ? AND o.deleted_at IS NULL
      UNION ALL
      SELECT 1 FROM bot_orders bo JOIN users o ON o.id = bo.user_id
       WHERE CAST(bo.tg_user_id AS TEXT) = bot_messages.tg_user_id AND o.id <> ? AND o.deleted_at IS NULL)`;
  return [
    // 0) Idempotentlik qulfi. Ikkinchi urinishda UNIQUE xatosi, butun batch rollback bo'ladi
    s(`INSERT INTO account_deletion_log (user_ref, requested_at, purged_at, source) VALUES (?,?,?,?)`,
      ref, u.deleted_at, now, u.deletion_source || 'unknown'),

    // 1) R2 navbati: har manba uchun bitta INSERT OR IGNORE … SELECT (D1 da bitta so'rovga 100 tagacha bind).
    //    JSON ustunlar: json_each(CASE WHEN json_valid(x) THEN x ELSE json_array(x) END), '' va NULL tashlanadi
    ...mediaQueueStmts(env, id, now, cfg),  // cards (+music_url), card_gallery, card_team (o'z kartasi),
                                            // menu/products/services, card_videos, card_files, posts, stories,
                                            // companies (+gallery_json/music_json), company_posts,
                                            // company_catalog_items (+images_json), web_orders.payload

    // 2) DALIL: kod va kompaniya egaligi tarixi, keyin arxivlash (kontent o'chirilishidan OLDIN)
    s(`INSERT OR IGNORE INTO evidence_owner_history (owner_kind, owner_id, user_id, released_at)
         SELECT 'card', code, ?, ? FROM cards WHERE user_id = ?
         UNION ALL SELECT 'company', company_id, ?, ? FROM companies WHERE CAST(owner_user_id AS TEXT) = ?`,
      idT, now, id, idT, now, idT),
    ...retireTargetStmts(env, 'story', `SELECT id FROM stories WHERE owner_kind='card' AND owner_id IN (${CODES})`, [id], { reason: 'account_purge' }),
    ...retireTargetStmts(env, 'company_story', `SELECT id FROM stories WHERE owner_kind='company' AND owner_id IN (${COS})`, [idT], { reason: 'account_purge' }),
    archiveStmt(env, 'company_post', `company_id IN (${COS})`, [idT], by),
    ...retireTargetStmts(env, 'company_post', `SELECT id FROM company_posts WHERE company_id IN (${COS})`, [idT], { reason: 'account_purge' }),
    archiveStmt(env, 'story', `owner_kind='company' AND owner_id IN (${COS})`, [idT], by),
    // O'zi yozgan izohlar: arxivga nusxa, keyin jonli jadvalda matn bo'shatiladi
    s(`INSERT INTO content_comment_archive (comment_id, target_kind, target_id, user_id, author_code, body,
         created_at, deleted_at, deleted_by_user_id, deleted_by_admin, reason)
       SELECT id, target_kind, target_id, user_id, author_code, body, created_at, ?, 0, 'system', 'account_purge'
         FROM content_comments WHERE user_id = ? AND deleted_at IS NULL`, now, id),
    s(`UPDATE content_comments SET deleted_at = COALESCE(deleted_at, ?), deleted_reason = 'account_purge',
         body = '', author_code = '' WHERE user_id = ?`, now, id),

    // 3) Karta kontenti: faqat CODES bo'yicha (posts.user_id bo'yicha EMAS, 3-bo'lim)
    s(`UPDATE card_team SET member_code = NULL WHERE member_code IN (${CODES}) AND code NOT IN (${CODES})`, id, id),
    ...['catalog_item_reactions','catalog_item_views','catalog_promotions']
        .map((t) => s(`DELETE FROM ${t} WHERE code IN (${CODES})`, id)),
    ...cardContentCleanupStmts(env, CODES, [id], now, by),
    s(`UPDATE gift_offers SET status = 'cancelled', decided_at = ?
        WHERE (from_user_id = ? OR to_user_id = ?) AND status = 'pending'`, now, id, id),   // B14

    // 4) Kompaniya
    s(`DELETE FROM story_likes WHERE story_id IN (SELECT id FROM stories WHERE owner_kind='company' AND owner_id IN (${COS}))`, idT),
    s(`DELETE FROM story_views WHERE story_id IN (SELECT id FROM stories WHERE owner_kind='company' AND owner_id IN (${COS}))`, idT),
    s(`DELETE FROM stories WHERE owner_kind='company' AND owner_id IN (${COS})`, idT),
    ...['company_posts','company_stats','company_follows','company_catalog_items',
        ...(flag('PURGE_COMPANY_ORDERS') ? ['company_orders'] : [])]                        // 7-savol
        .map((t) => s(`DELETE FROM ${t} WHERE company_id IN (${COS})`, idT)),
    ...(col('physical_cards','linked_company_id')
        ? [s(`UPDATE physical_cards SET linked_company_id = NULL WHERE linked_company_id IN (${COS})`, idT)] : []),
    ...(col('cards','company_id')
        ? [s(`UPDATE cards SET company_id = NULL WHERE company_id IN (${COS})`, idT)] : []),
    s(`DELETE FROM companies WHERE CAST(owner_user_id AS TEXT) = ?`, idT),

    // 5) Foydalanuvchi id'si bo'yicha
    s(`DELETE FROM content_likes WHERE user_id = ?`, id),
    s(`DELETE FROM post_likes WHERE user_id = ?`, id),
    s(`DELETE FROM card_likes WHERE user_id = ?`, id),
    s(`DELETE FROM story_likes WHERE user_id = ?`, id),
    s(`DELETE FROM story_views WHERE viewer = ?`, 'u' + id),
    s(`DELETE FROM follows WHERE follower_id = ? OR followee_id = ?`, id, id),
    s(`DELETE FROM company_follows WHERE user_id = ?`, id),
    s(`DELETE FROM user_saves WHERE user_id = ?`, id),
    s(`DELETE FROM notifications WHERE recipient_user_id = ? OR actor_user_id = ?`, id, id),
    s(`DELETE FROM user_blocks WHERE user_id = ? OR (${userBlockTargetsSql})`, id /* +target binds */),
    s(`DELETE FROM blocked_users WHERE blocker_id = ? OR blocked_id = ?`, id, id),
    s(`DELETE FROM messages WHERE sender_id = ?`, id),                   // tombstone FK ni saqlaydi
    ...(flag('PURGE_CONVERSATIONS') ? [                                  // 12-savol
      s(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_a_id = ? OR user_b_id = ?)`, id, id),
      s(`DELETE FROM conversations WHERE user_a_id = ? OR user_b_id = ?`, id, id)] : []),
    s(`DELETE FROM auction_demand_votes WHERE user_id = ?`, id),
    s(`DELETE FROM auction_requests WHERE user_id = ?`, id),
    s(`DELETE FROM app_users WHERE user_id = ?`, id),
    ...(flag('PURGE_SUPPORT_MESSAGES') ? [s(`DELETE FROM support_messages WHERE user_id = ?`, id)] : []), // 6-savol
    s(`UPDATE content_reports SET reporter_ip = '' WHERE reporter_id = ?`, id),
    s(`DELETE FROM sessions WHERE user_id = ?`, id),
    s(`DELETE FROM password_reset_codes WHERE user_id = ?`, id),
    s(`DELETE FROM email_reset_tokens WHERE user_id = ?`, id),
    s(`DELETE FROM upload_quota WHERE key = ?`, 'user:' + id),
    s(`DELETE FROM rate_limits WHERE key IN (?, ?, ?, ?)`,               // eski (xom) va yangi (hash) kalitlar
      'login:acct:' + u.email, 'login:acct:' + (u.phone || ''), 'login:acct:' + u.emailHash, 'login:acct:' + u.phoneHash),
    s(`DELETE FROM email_otp_codes WHERE email = ?`, u.email),
    s(`DELETE FROM bot_messages WHERE tg_user_id IN (
         SELECT CAST(tg_user_id AS TEXT) FROM bot_verifications WHERE phone = ?
         UNION SELECT CAST(tg_user_id AS TEXT) FROM bot_orders WHERE user_id = ?) AND ${tgFree}`, u.phone, id, id, id),
    s(`DELETE FROM phone_otp_codes WHERE phone = ? AND ${phoneFree}`, u.phone, u.phone, id),
    s(`DELETE FROM tg_link_tokens WHERE phone = ? AND ${phoneFree}`, u.phone, u.phone, id),
    s(`DELETE FROM bot_verifications WHERE phone = ? AND ${phoneFree}`, u.phone, u.phone, id),
    ...(flag('SCRUB_ADMIN_LOG') ? scrubAdminLogStmts(env, u) : []),     // details/old_value/new_value: email, telefon → '#id' (20-savol)

    // 6) Moliyaviy: qator qoladi, PII olib tashlanadi
    s(`UPDATE web_orders SET status = 'cancelled' WHERE user_id = ? AND status = 'pending'
         AND ${SEC('created_at')} <= strftime('%Y-%m-%d %H:%M:%S','now','-1 day')`, id),
    s(`UPDATE web_orders SET payload = CASE
         WHEN NOT json_valid(payload) THEN '{"purged":1}'
         WHEN kind = 'physical_card_order' THEN json_object('purged', 1,
              'quantity', json_extract(payload,'$.quantity'), 'finish', json_extract(payload,'$.finish'),
              'printSpec', json_extract(payload,'$.printSpec'), 'shippingCarrier', json_extract(payload,'$.shippingCarrier'))
         WHEN kind = 'featured_slot' THEN json_object('purged', 1,
              'slotId', json_extract(payload,'$.slotId'), 'targetKind', json_extract(payload,'$.targetKind'),
              'targetId', json_extract(payload,'$.targetId'), 'days', json_extract(payload,'$.days'))
         WHEN kind = 'premium_upgrade' THEN payload
         ELSE json_object('purged', 1, 'quantity', json_extract(payload,'$.quantity'),
                          'auctionId', json_extract(payload,'$.auctionId'))
       END WHERE user_id = ?`, id),
    s(`UPDATE bot_orders SET tg_username = NULL, tg_name = NULL, record_data = NULL WHERE user_id = ?`, id),
    s(`UPDATE physical_cards SET shipping_name = NULL, shipping_phone = NULL, shipping_address = NULL
        WHERE owner_user_id = ?`, id),
    // 3-4-bosqichlardan keyin U ning o'z kodi va kompaniyasiga ulanganlarida ikkala bog'lanish NULL.
    // Boshqa odamning jonli kartasiga ulangan qurilma faol qoladi.
    s(`UPDATE physical_cards SET active = 0 WHERE owner_user_id = ? AND linked_code IS NULL`
      + (col('physical_cards','linked_company_id') ? ` AND linked_company_id IS NULL` : ''), id),
    s(`UPDATE auctions SET seller_payme_number = NULL WHERE seller_id = ? AND seller_payout_status IN (${FINAL_PAYOUT})`, id),
    s(`UPDATE featured_slots SET status = 'stopped', stopped_reason = 'account_deleted' WHERE user_id = ? AND status = 'active'`, id),
    s(`UPDATE featured_slots SET status = 'cancelled' WHERE user_id = ? AND status = 'pending'`, id),
    s(`UPDATE nfc_gifts SET recipient_name = NULL WHERE activated_by_user_id = ?`, id),

    // 7) Kartalar (kontent allaqachon tozalangan)
    s(`DELETE FROM cards WHERE user_id = ?`, id),

    // 8) Dalil identifikatori (U1), tombstone'dan OLDIN (3.5)
    s(`INSERT OR IGNORE INTO evidence_identity (user_id, email, phone, captured_at)
       SELECT u.id, u.email, u.phone, ? FROM users u WHERE u.id = ?
         AND (EXISTS (SELECT 1 FROM content_archive a WHERE a.user_id = ?
                        AND ${SEC('a.created_at')} >= ${SEC('u.created_at')})
           OR EXISTS (SELECT 1 FROM content_comment_archive c WHERE c.user_id = ?
                        AND ${SEC('c.created_at')} >= ${SEC('u.created_at')})
           OR EXISTS (SELECT 1 FROM user_reports r WHERE r.reported_id = ?)
           OR EXISTS (SELECT 1 FROM content_reports cr WHERE cr.resolved_at IS NULL
                        AND (UPPER(cr.owner_code) IN (SELECT UPPER(owner_id) FROM evidence_owner_history WHERE user_id = ?)
                          OR UPPER(cr.target_id) IN (SELECT UPPER(owner_id) FROM evidence_owner_history WHERE user_id = ?))))`,
      now, id, idT, id, id, idT, idT),

    // 9) Tombstone. DELETE FROM users HECH QACHON bajarilmaydi
    s(`UPDATE users SET email = 'deleted-' || id || '@deleted.invalid', password_hash = '!',
         phone = NULL, promo_code = NULL, suspend_reason = NULL,`
      + (col('users','signup_source') ? ` signup_source = NULL,` : '')
      + ` purged_at = ? WHERE id = ? AND purged_at IS NULL`, now, id),
  ];
}
```

### 5.5 `scheduled` handler (`hosting/worker.js:10485`)

```js
export default {
  async fetch(request, env) { /* O'RAM O'ZGARMAYDI */ },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      const mode = String(env.ACCOUNT_PURGE_MODE || 'off');
      if (mode === 'off') return;
      try {
        const res = await runAccountPurge(env, H, { mode, limit: Number(env.PURGE_MAX_USERS) || 3 });
        if (String(env.ACCOUNT_PURGE_R2 || 'off') === 'on') res.r2 = await drainPurgeMediaQueue(env, { limit: 50 });
        console.log(JSON.stringify({ evt: 'account_purge', mode, ...res.countsOnly }));  // PII yo'q
      } catch (e) {
        console.error('account_purge', e?.message);   // xabar matni, qiymatlar emas
      }
    })());
  },
};
```

**Limitlar:**
- Bitta foydalanuvchi uchun purge batch taxminan 80-90 statement.
- D1 bitta Worker chaqiruvida so'rovlar soniga chegara qo'yadi: Free tarifda 50, Paid tarifda 1000. Purge, blocker tekshiruvlari va R2 drain bitta chaqiruvda shu chegarani bo'lishadi. Batch ichidagi statement'lar qanday hisoblanishini deploydan oldin Cloudflare hujjatidan tasdiqlash kerak (9-bo'lim, 17-savol). Agar ular alohida hisoblansa, Free tarifda bitta foydalanuvchining batch'i ham sig'maydi.
- Shu sabab `PURGE_MAX_USERS` kichik (3) va sozlanadigan qilib qo'yilgan. Drain bitta ishga tushishda 50 URL bilan cheklangan va tekshiruvlarni partiyalab bajaradi.
- R2 da `delete([...keys])` bitta chaqiruvda 1000 tagacha kalitni qabul qiladi.

### 5.6 Admin (faqat super_admin, har bir amal `admin_activity_log` ga `#id` bilan yoziladi)

- `GET /api/admin/account-deletions?state=waiting|blocked|held|unreviewed|purged`
- `POST /api/admin/account-deletions/:id/restore`: faqat `purged_at IS NULL` bo'lsa.
- `POST /api/admin/account-deletions/:id/review`: `purge_reviewed_at` qo'yadi. Admin o'chirgan va manbasi noma'lum eski so'rovlar shundan keyingina navbatga tushadi.
- `POST /api/admin/account-deletions/:id/hold` `{ note }` / `DELETE …/hold`
- `POST /api/admin/account-deletions/:id/purge` `{ dryRun: true }`: faqat sonlarni qaytaradi.
  - `{ dryRun: false, confirm: "PURGE #<id>" }` bilan chaqirilsa, grace tugamagan bo'lsa ham bajariladi (email so'rovi uchun). Blocker'lar baribir tekshiriladi.

---

## 6. Testlar

**Yangi fayl:** `scripts/test-account-deletion.mjs`.
- Ishlatiladigan vositalar: `makeEnv`, `seedBasic`, `req`, `makeChecker` (`scripts/lib/d1-harness.mjs`) va real `hosting/worker.js`.
- `scheduled` testda `worker.default.scheduled({ cron, scheduledTime }, env, { waitUntil: (p) => jobs.push(p) })` bilan chaqiriladi.

**Harness tuzatishi:** `makeEnv` dagi `batch` hozir statement'larni ketma-ket, tranzaksiyasiz bajaradi (`d1-harness.mjs:72`). D1 esa batch'ni atomik bajaradi. `makeEnv(extraEnv)` o'z argumentini `env` ga yoyadi (`:14, 72-76`), shuning uchun opt-in ikkinchi argument bilan beriladi: `makeEnv(extraEnv, { atomicBatch: true })`. Bu `BEGIN` / `COMMIT` / `ROLLBACK` ni yoqadi. Mavjud testlar o'zgarmaydi.

| # | Holat | Tekshiriladi |
|---|---|---|
| T1 | So'rov | `DELETE /api/account` 200 qaytaradi va `purgeAfter` = +30 kun. `deleted_at` qo'yiladi, `deletion_source='self'`, sessiyalar 0, U ga kelgan va U yuborgan kutilayotgan `gift_offers` `cancelled`. Login 403 `account_deleted` va `purgeAfter` qaytaradi. Anonim `GET /api/comments/post/:id` o'chirilgan muallif izohini **qaytarmaydi**, son ham kamayadi (B5) |
| T2 | Grace | `now = +29 kun` bilan purge: DB dump hash'i o'zgarmaydi. `mode='off'`: hech narsa bajarilmaydi |
| T3 | Dry-run | Sonlar `purgePlan` bilan mos keladi. DB va R2 hash'i avvalgi va keyingi holatda bir xil |
| T4 | Purge | `+31 kun`. 3.1-3.3 dagi har bir A jadvalda U ga tegishli 0 qator qoladi. "U ga tegishli" purge paytidagi `CODES` / `COMPANIES` va U ning id'si bo'yicha aniqlanadi, `posts.user_id` / `stories.user_id` bo'yicha emas. `users` tombstone: email naqshi to'g'ri, `password_hash='!'`, `phone` NULL, `deleted_at` saqlangan, `purged_at` qo'yilgan. `account_deletion_log` da 1 qator, unda email yoki telefon yo'q. Kalitlar `off` bo'lganda `support_messages`, `company_orders` va suhbatdoshning xabarlari saqlangan |
| T5 | Moliyaviy qatorlar qoladi | `transactions`, `wallet_topups`, `web_orders`, `bids`, `premium_requests`, `bot_orders`, `physical_cards`, `company_payments`, `marketplace_activations` sonlari **o'zgarmaydi**. `web_orders.payload` da `shipping{Name,Phone,Address}`, `design*Url` va karta yozuvi maydonlari yo'q. `finish`, `printSpec`, `shippingCarrier`, `quantity` hamda `slotId`, `targetKind`, `targetId`, `days` saqlangan. `bot_orders.tg_name` NULL. `physical_cards.shipping_*` NULL |
| T6 | Arxivga tegilmaydi | Oldindan bor `content_archive` va `content_comment_archive` qatorlari baytma-bayt bir xil. Yangi qatorlar: post, kompaniya posti, istoriya, video, fayl va foydalanuvchining izohi. `evidence_identity` da snapshot bor. `evidence_owner_history` da U ning kodlari va kompaniyalari bor |
| T7 | R2 | R2 mock'da quyidagilar tekshiriladi:<br>• o'chiriladi: arxivda yo'q avatar (prefikssiz `uploads/<20hex>.jpg`), `music_url` dagi JSON massiv va eski bitta URL<br>• qoladi: arxivda bor post rasmi va boshqa kartaning `card_team.photo_url` ida ishlatilgan fayl<br>• tegilmaydi: `news_` / `fin_` fayllari va tashqi yoki legacy URL<br>• noto'g'ri `gallery_json` batch'ni yiqitmaydi<br>• bitta ishga tushishda 50 dan ortiq URL qayta ishlanmaydi |
| T8 | Idempotentlik va atomiklik | Purge ikki marta chaqirilsa, ikkinchisi no-op bo'ladi, xato bermaydi va sonlar o'zgarmaydi. Batch o'rtasida xato sun'iy chaqirilsa (`atomicBatch`), hech qanday qisman o'zgarish qolmaydi. Worker R2 bosqichidan oldin yiqilsa, navbat qoladi va keyingi ishga tushishda o'chiriladi |
| T9 | Boshqa foydalanuvchilarga ta'sir yo'q | user#2 ning `OTH222` kartasi, izohlari, kompaniyasi va to'lovlari o'zgarmaydi. Faqat user#1 ga bog'langan qatorlar ketadi: follow, notification, user#1 ning postidagi izohlar (ular arxivda). user#2 ning U ga yuborgan sovg'a taklifi bekor qilinadi va user#2 kodni qayta taklif qila oladi |
| T10 | Qayta ro'yxatdan o'tish (B1, B3, B4, B11) | `emailOn` va to'g'ri OTP bilan: eski hisob darhol tombstone bo'ladi, yangi id > eski id, eski moliyaviy qatorlar joyida, ELITEBIZ 404, eski izohlar va saqlanganlar yangi hisobga o'tmaydi. Email xizmati o'chiq (placeholder email yoki OTP'siz email) yoki blocker bor bo'lsa: 409 `account_pending_deletion`, eski hisob o'zgarmagan |
| T11 | Sovg'a faollashtirish (B2, B11) | `bot_orders` bor soft-deleted email bilan faollashtirish 409 `account_pending_deletion` qaytaradi. FK xatosi yo'q, hech narsa o'chirilmagan |
| T12 | Blocker'lar | Quyidagilar bo'lsa purge **qilinmaydi** va sabab qaytariladi: `balance > 0`, `nowTs()` formatida yozilgan `pending` buyurtma (24 soatdan yangi; `datetime()` NULL xatosining regressiyasi), faol auksion, `physical_card_order` dan kelgan yetkazilmagan karta va legal hold. `status='pending'` va `shipping_name` siz marketplace qurilmasi purge'ni **bloklamaydi** |
| T13 | Id qayta ishlatilmaydi | Purge'dan keyin yangi foydalanuvchi id'si tombstone id'sidan katta |
| T14 | Loglarda PII yo'q | Purge paytida `console.log` va `console.error` ushlanadi. Ularda email, telefon yoki tokenning biror qismi yo'qligi tekshiriladi. Yangi `admin_activity_log` yozuvlarida (`user_deleted`, `nfc_gift_activated`, `evidence_search`) email va telefon yo'q |
| T15 | Qamrov qo'riqchisi | Sxemadagi (bir qatorlilari bilan) va `hosting/**/*.js` dagi `CREATE TABLE IF NOT EXISTS` jadvallaridan `user_id`, `owner_user_id`, `code`, `company_id`, `phone`, `email` ustuni borlarining **har biri** `PURGE_POLICY` xaritasida sinf bilan (A/B/C/D/none) turishi kerak. Yangi jadval qo'shilsa test yiqiladi |
| T16 | Sovg'a qilingan karta | U ning kodi B ga o'tgan. Shu kartadagi `user_id = U` postlar va istoriyalar purge'dan keyin saqlanadi. U ga tegishli, B ning kartasiga ulangan jismoniy qurilma `active = 1` qoladi |
| T17 | Navbat to'xtab qolmaydi | Eng eski 3 nomzod bloklangan va 4-si toza bo'lsa, 4-si o'sha ishga tushishda purge qilinadi. Bloklanganlarda `purge_blocked_reason` va `purge_next_attempt_at` yozilgan |
| T18 | Hold | `deletion_source IS NULL` yoki `'admin'` bo'lgan hisob `purge_reviewed_at` qo'yilgunga qadar purge qilinmaydi |
| T19 | Dalil arxivi | Purge'dan keyin kod yangi foydalanuvchiga berilganda arxiv eski egani (`evidence_owner_history`) ko'rsatadi. `q` = eski email yozuvni `evidence_identity` orqali topadi. Admin tiklash `account_purge` izohini 409 bilan rad etadi. Arxiv yozuvi `users.created_at` dan oldin bo'lsa snapshot olinmaydi |
| T20 | Ixtiyoriy ustunlar yo'q | `physical_cards.linked_company_id`, `cards.company_id` yoki `users.signup_source` yo'q bo'lganda purge yiqilmaydi. `content_comments.deleted_at` yo'q bo'lsa foydalanuvchi `schema` sababi bilan o'tkazib yuboriladi |

`scripts/test-card-cleanup.mjs` regex'i tuzatiladi (B9). Ikkala test `.github/workflows/deploy.yml` dagi test qadamlariga qo'shiladi. `test-worker-bindings.mjs` yashil qolishi shart.

---

## 7. Play Console, Data Safety va privacy policy matnlari

### 7.1 Play Console → Data safety

Bu javoblar faqat purge `on` rejimida ishlay boshlagandan keyin to'g'ri bo'ladi. Ungacha `PLAY_CONSOLE_HANDOFF.md:220-230` dagi BLOKER ogohlantirishi o'z kuchida.

| Savol | Javob |
|---|---|
| Delete account URL | `https://nfcstore.uz/delete-account` |
| Users can request that data be deleted / Account deletion mechanism | **Yes**: ilovada Sozlamalar → Xavfsizlik → Hisobni o'chirish; saytda `/delete-account`; email orqali (suspend qilingan hisoblar uchun ham) |
| Do you provide a way to delete some data without deleting the account? | **No** (tavsiya). Alohida o'chirilgan post, izoh va boshqalar dalil arxiviga tushadi, shuning uchun "Yes" javobi chalg'itishi mumkin |
| Data retention disclosure | Deletion sahifasida quyidagilar aytiladi:<br>• 30 kunlik grace;<br>• balans, faol buyurtma, auksion yoki tekshiruv bo'lsa o'chirish kechikishi;<br>• moliyaviy yozuvlar `[F]` (ism, telefon va manzilsiz);<br>• dalil arxivi `[E]`;<br>• xavfsizlik jurnallari 5 yilgacha (20-savol hal bo'lmaguncha ularda email, telefon va IP bo'lishi mumkin);<br>• zaxira nusxalar `[B]`;<br>• edge va brauzer keshi (14-savol hal bo'lmaguncha);<br>• 6, 7 va 12-savollar bo'yicha saqlanayotgan ma'lumotlar |
| Ma'lumot turlari jadvali | O'zgarmaydi (`PLAY_CONSOLE_HANDOFF.md:196-213`) |

### 7.2 `src/pages/DeleteAccountPage.jsx`, `T.uz` (ru va en shu mazmunda)

- **whatH:** `Nima bo‘ladi`
- **what:**
  1. `So‘rovdan so‘ng darhol: barcha qurilmalardagi sessiyalar yopiladi va hisobga kira olmaysiz. NFC ID profillaringiz, biznes sahifalaringiz, postlar, istoriyalar, izohlar va obunalar saytdan ham, ilovadan ham yashiriladi.`
  2. `30 kundan keyin hisob butunlay o‘chiriladi: email, telefon, parol, profil va biznes ma’lumotlari, postlar, istoriyalar, izohlar, layklar, obunalar, saqlanganlar, siz yozgan xabarlar, bildirishnomalar va yuklangan fayllar (rasm, video, musiqa). Bu bosqichni qaytarib bo‘lmaydi.`
  3. `Hisobingizda pul qoldig‘i, to‘lov kutilayotgan yoki yetkazilmagan buyurtma, faol auksion bo‘lsa yoki firibgarlik bo‘yicha tekshiruv ketayotgan bo‘lsa, butunlay o‘chirish shular hal bo‘lguncha kechiktiriladi.`
  4. `30 kun ichida fikringizdan qaytsangiz, ${CONTACT} manziliga yozing — hisobingiz tiklanadi.`
  5. `Shu email bilan qayta ro‘yxatdan o‘tsangiz (email kodi bilan tasdiqlanadi), eski hisob 30 kun kutilmasdan darhol butunlay o‘chiriladi.`
  6. `Hisobingizdagi NFC ID va Business ID’lar bo‘shatiladi.` *(9-bo'lim, 8-savol: egasi tasdiqlasin)*
  7. `O‘chirilgan rasm va videolar tarmoq keshlarida va ularni avval ochgan qurilmalarda keshdan chiqib ketguncha ochilishi mumkin.` *(14-savol hal bo'lsa olib tashlanadi)*
- **keepH:** `Nima saqlanadi va qancha muddat`
- **keep:** `Qonun talablari va xavfsizlik uchun faqat quyidagilar saqlanadi. Ular ommaga ko‘rinmaydi va boshqa maqsadda ishlatilmaydi: buyurtma va to‘lov yozuvlari (Payme/Click: summa, sana, holat, mahsulot turi, tranzaksiya raqami) — buxgalteriya va soliq qonunchiligida belgilangan muddat [F] davomida, ism, telefon va manzilsiz; o‘chirilgan kontent nusxasi va muallifning email hamda telefoni — yopiq dalil arxivida [E] davomida, faqat shikoyatlarni tekshirish, firibgarlikka qarshi kurash va vakolatli davlat organlarining qonuniy so‘rovlari uchun; xavfsizlik jurnallari (ularda email, telefon va IP manzil bo‘lishi mumkin) — 5 yilgacha. Zaxira nusxalardan ma’lumotlar [B] ichida o‘chib ketadi.`
  - *(6, 7 va 12-savollarga javob kelguncha tegishli ma'lumot saqlanadi va shu yerda oshkor qilinadi: qo'llab-quvvatlashga yozgan xabarlaringiz, biznes sahifangiz mijozlarining buyurtmalari, suhbatdoshlaringiz sizga yozgan xabarlar. 20-savol "tozalash" deb hal bo'lsa, jurnallardagi qavs ichidagi izoh olib tashlanadi.)*
- **how[2]:** `Email orqali: ${CONTACT} manziliga hisobingiz emailidan “Hisobni o‘chirish” deb yozing (faqat telefon bilan ro‘yxatdan o‘tgan bo‘lsangiz — hisobdagi telefon raqamini ko‘rsating). Shaxsingizni tasdiqlaganimizdan keyin so‘rov 7 kun ichida qabul qilinadi va yuqoridagi tartib amal qiladi. Hisobingiz vaqtincha bloklangan bo‘lsa, ilova va sayt orqali so‘rov yuborib bo‘lmaydi — shu yo‘ldan foydalaning.`
- **understood:** `Tushundim: hisobim darhol yopiladi va 30 kundan keyin butunlay o‘chiriladi. Shundan keyin uni qaytarib bo‘lmaydi.`
- **done:** `So‘rov qabul qilindi, barcha qurilmalarda sessiyalar yopildi. Hisobingiz {sana} kuni butunlay o‘chiriladi. Ungacha bekor qilish uchun ${CONTACT} ga yozing.`

### 7.3 `src/pages/PrivacyPage.jsx` (uz)

- **`:42` "Saqlash muddati":** `Ma'lumotlar hisobingiz faol ekan saqlanadi. Hisobni o'chirishni so'raganingizda profil va kontent ommadan darhol olib tashlanadi, hisob esa 30 kundan keyin butunlay o'chiriladi: shaxsiy ma'lumotlar, profil, biznes sahifalari, kontent va yuklangan fayllar o'chiriladi. Hisobda pul qoldig'i, yakunlanmagan buyurtma yoki auksion bo'lsa, o'chirish ular hal bo'lguncha kechikadi. Faqat quyidagilar saqlanadi: (1) buyurtma va to'lov yozuvlari — buxgalteriya va soliq qonunchiligida belgilangan muddat [F] davomida, ism, telefon va manzilsiz; (2) o'chirilgan post, istoriya, izoh, rasm, video va fayllarning nusxasi hamda muallifning email va telefoni — yopiq arxivda [E] davomida, faqat shikoyatlarni ko'rib chiqish, qoidabuzarlik va firibgarlikni tekshirish hamda vakolatli davlat organlarining qonuniy so'rovlariga javob berish uchun; arxivga faqat vakolatli adminlar kiradi va har bir qidiruv jurnalga yoziladi; (3) xavfsizlik jurnallari (email, telefon va IP manzil bo'lishi mumkin) — 5 yilgacha. Firibgarlik yoki tergov holatida, shuningdek hisob administrator tomonidan qoidabuzarlik uchun yopilgan bo'lsa, o'chirish ko'rib chiqish tugaguncha to'xtatilishi mumkin. O'chirilgan fayllar tarmoq va qurilma keshlarida keshdan chiqquncha qolishi mumkin. Zaxira nusxalardan ma'lumot [B] ichida o'chadi.`
- **`:46` "Hisobni va ma'lumotni o'chirish":** `Hisobingizni istalgan vaqtda o'chirishingiz mumkin: ilovada Sozlamalar → Xavfsizlik → “Hisobni o'chirish”; saytda nfcstore.uz/delete-account sahifasida; yoki ${CONTACT} manziliga hisobingiz emailidan yozib (hisobingiz vaqtincha bloklangan bo'lsa ham). So'rovdan keyin hisob darhol yopiladi va 30 kundan keyin butunlay o'chiriladi (tafsilotlar “Saqlash muddati” bo'limida). Shu email bilan tasdiqlangan holda qayta ro'yxatdan o'tsangiz, eski hisob darhol o'chiriladi. 30 kun ichida bekor qilish uchun ${CONTACT} ga yozing.`
- **"Yosh cheklovi" (`:39`):** o'zgarmaydi. Endi u haqiqiy purge'ga olib keladi.
- **Sana (`:15, 52, 89`):** "24 September 2026" haqiqiy chiqish sanasiga almashtiriladi (hozir kelajakdagi sana turibdi).

### 7.4 Ilova (`mobile_nova/lib/l10n/arb/app_uz.arb`, ru va en shu mazmunda, keyin `gen/` qayta yaratiladi)

- `settingsDeleteConfirm` (:391): `Hisobingiz darhol yopiladi va 30 kundan keyin butunlay o‘chiriladi. Shundan keyin uni qaytarib bo‘lmaydi.`
- `deleteAccountWhat` (:938): `So‘rovdan keyin barcha qurilmalarda hisobdan chiqasiz; NFC ID profillaringiz, biznes sahifalaringiz, postlar, istoriyalar va izohlar darhol yashiriladi. 30 kundan keyin hisob va unga bog‘langan ma’lumotlar butunlay o‘chiriladi (balans, faol buyurtma yoki tekshiruv bo‘lsa — ular hal bo‘lgach). To‘lov yozuvlari va dalil arxivi qonun bo‘yicha saqlanadi — batafsil: nfcstore.uz/delete-account`
- `deleteAccountDone` (:940): `So‘rov qabul qilindi. Hisob 30 kundan keyin butunlay o‘chiriladi.`
- **Yangi kalit** `authAccountPendingDeletion`: `Bu hisob o‘chirish navbatida ({date}). Bekor qilish uchun {contact} ga yozing.`
- `account_suspended` ekrani: `Hisobni o‘chirish uchun {contact} ga yozing.` qatori qo'shiladi (B12).

---

## 8. Deploy tartibi va rollback

### 8.1 Tartib (har bir PR alohida ko'rib chiqiladi, production'ga faqat egasi tasdiqlagandan keyin chiqadi)

| Bosqich | Tarkib | Xavf |
|---|---|---|
| PR-1 | • izohlar filtri (B5)<br>• qayta ro'yxatdan o'tish va sovg'a faollashtirishda soft-deleted hisob uchun **har doim** 409 `account_pending_deletion`: `hardDeleteUser` va sovg'a batch'i chaqirilmaydi (B1, B2, B11 production yo'lida yopiladi)<br>• so'rovda `gift_offers` bekor qilinadi (B14)<br>• jurnal yozuvchilarida PII yo'q (B13)<br>• testlar | Hech narsa o'chirmaydi, faqat o'chirishni kamaytiradi |
| PR-2 | • `account-purge.js` va tombstone<br>• OTP bilan tasdiqlangan qayta ro'yxatda darhol tombstone<br>• B6 va arxiv ko'rinishi<br>• `card-cleanup` kengaytmasi, `H.ensureColumnD1` va `ensure*` eksportlari<br>• testlar T4-T20<br>• `ACCOUNT_PURGE_MODE="off"`, cron **yo'q** | Faqat foydalanuvchining o'zi OTP bilan qayta ro'yxatdan o'tganda ishlaydi. Cascade yo'q |
| PR-3 | `scheduled` + `triggers.crons` + admin "O'chirish navbati". `MODE="dry-run"`, `ACCOUNT_PURGE_R2="off"` | Faqat sonlarni o'qiydi |
| PR-4 | Sayt va ilova matnlari (7-bo'lim), yangi APK/AAB | Faqat matn |
| Yoqish | Egasi dry-run hisobotini ko'rib chiqadi (5.6) → `MODE="on"` → 1-2 hafta kuzatiladi → 14-savol hal bo'ladi yoki oshkor qilinadi → `ACCOUNT_PURGE_R2="on"` | Qaytarilmas |
| Play | Data safety javoblari (7.1) faqat `on` yoqilgandan keyin | — |

**Birinchi `on` dan oldin:**
1. D1 Time Travel bookmark qayd etiladi: `wrangler d1 time-travel info DB`.
2. Cloudflare Dashboard'da boshqa Cron Trigger yo'qligi tekshiriladi. `triggers` yozilgach, bu fayl cron uchun yagona manba bo'ladi.
3. Hozirgi soft-deleted hisoblar dry-run'da ko'rib chiqiladi. Ular `deletion_source IS NULL`, shuning uchun hold'da turadi. Admin o'chirganlari (`admin_activity_log.action='user_deleted'`) moderatsiya yoki firibgarlik nuqtai nazaridan tekshiriladi. Keyin har biri uchun "Ko'rib chiqildi" yoki hold qo'yiladi (9-bo'lim, 10-11-savollar).
4. 6, 7, 12 va 20-savollar bo'yicha kalitlar holati egasi bilan tasdiqlanadi.

**Monitoring:**
- Workers Logs'dagi `evt:account_purge` sonlari va admin navbatidagi `blocked` hamda "kechikkan" sonlari kuzatiladi.
- `purge_media_queue.attempts > 5` bo'lsa ogohlantirish chiqadi.
- Birinchi oyda har hafta qo'lda tekshiriladi.

### 8.2 Rollback

- **Kod:** oldingi Worker versiyasiga qaytiladi (`wrangler rollback` yoki oldingi commit qayta deploy qilinadi).
- **Tezkor to'xtatish:** `ACCOUNT_PURGE_MODE="off"` (deploy orqali, fayl va Dashboard mos bo'lishi kerak) yoki `triggers.crons: []`.
- **Purge qilingan ma'lumot QAYTARILMAYDI.** Shuning uchun:
  - avval dry-run qilinadi, keyin kichik `PURGE_MAX_USERS` bilan ishga tushiriladi;
  - R2 bosqichi D1 bosqichidan kamida 1-2 hafta keyin yoqiladi;
  - admin qo'lda purge qilishi uchun `PURGE #id` deb yozib tasdiqlashi kerak.
- **Favqulodda holat:** D1 Time Travel butun bazani bookmark'ga qaytaradi. Bunda undan keyingi **barcha** yozuvlar ham, jumladan to'lovlar, qaytib ketadi. Bu faqat egasining qarori bilan, oxirgi chora sifatida qilinadi.
- **R2 da versiyalash yo'q:** o'chirilgan fayl tiklanmaydi.

---

## 9. Egasi (va yurist) hal qilishi kerak bo'lgan savollar

1. **Grace muddati:** 30 kun ma'qulmi?
2. **Bekor qilish usuli:** faqat qo'llab-quvvatlash orqali (tavsiya) yoki login, parol va email OTP bilan o'zi tiklash (Variant B)?
3. **`[F]` moliyaviy yozuvlar muddati.** Buxgalteriya va soliq qonunchiligi bo'yicha necha yil saqlanadi? Yurist aniq modda bilan tasdiqlasin. Muddat tugagach nima qilinadi: qator o'chiriladimi yoki to'liq anonimlashtiriladimi?
4. **`[E]` dalil arxivi muddati (U1).** Arxiv, `evidence_identity` (email va telefon snapshot'i) va `evidence_owner_history` necha yil saqlanadi? Snapshot umuman yoqiladimi? Shikoyat (`user_reports`, ochiq `content_reports`) sababli ham snapshot olinsinmi?
5. **Xavfsizlik jurnallari:** "5 yilgacha" va'dasi avtomatik tozalash bilan bajarilsinmi? Bu alohida kalit bilan yoqiladi.
6. **`support_messages`:** purge'da o'chiriladimi yoki N oy saqlanadimi? Javob kelguncha saqlanadi (`PURGE_SUPPORT_MESSAGES=off`) va oshkor qilinadi.
7. **`company_orders`** (biznesning mijozlari ismi va telefoni): o'chirilsinmi? Javob kelguncha saqlanadi (`PURGE_COMPANY_ORDERS=off`) va shu Business ID qayta sotuvga chiqmaydi.
8. **Pullik NFC ID va Business ID:** hisob o'chsa ular qayta sotuvga chiqadimi? Qachondan (masalan 90 kundan keyin)? Pul qaytariladimi? Bu foydalanuvchiga oldindan aytilishi kerak.
9. **Musbat balans yoki `pending_payout`:** purge'dan oldin qanday hisob-kitob qilinadi (to'lab berish tartibi)?
10. **Admin o'chirgan hisoblar** (moderatsiya yoki firibgarlik): rejada ular ko'rib chiqilguncha hold'da turadi. Ko'rib chiqilgach odatdagi tartib ishlaydimi yoki doimiy legal hold qo'yiladimi?
11. **Hozirgi soft-deleted hisoblar** (`deletion_source IS NULL`): dry-run ko'rib chiqilgandan keyin purge qilinsinmi? Ularga xabar beriladimi?
12. **`conversations`/`messages`:** suhbatdoshning nusxasi ham o'chirilsinmi (hozirgi cascade shunday qiladi)? Javob kelguncha faqat U yozgan xabarlar o'chiriladi (`PURGE_CONVERSATIONS=off`).
13. **`bot_orders`:** `tg_user_id` va to'lov skrinshoti (`screenshot_file_id`) to'lov isboti sifatida saqlanadimi?
14. **Edge kesh:** Cloudflare "purge by URL" uchun alohida, cheklangan huquqli token (yangi secret) qo'shilsinmi? Cron'dagi `caches.default.delete` foyda bermaydi (4-bo'lim, [5]). Token bo'lmasa, o'chirilgan rasm edge va brauzer keshida evict bo'lguncha (1 yilgacha) ochilishi mumkin. `ACCOUNT_PURGE_R2="on"` dan oldin shu savol hal bo'lishi yoki cheklov oshkor qilinishi kerak.
15. **Arxivdagi media:** fayl havola bo'yicha hamon ochiladi (`/uploads/*` ommaviy). Arxiv fayllari faqat admin ko'radigan yopiq prefiksga (`evidence/…`) ko'chirilsinmi?
16. **Email kanali:** shaxs qanday tasdiqlanadi? Email kodi bilanmi? Telefon OTP faqat Telegram bot orqali keladi (`auth.js:592-594`), SMS yo'q. Telegram'ga ulanmagan telefonli hisoblar uchun `/delete-account` da telefon va parol bilan tasdiqlash qo'shilsinmi (login bilan bir xil rate limit, suspend qilingan hisoblar uchun ham ishlaydi)? Qabul qilish muddati 7 kunmi?
17. **Cloudflare tarifi:** Workers Paid bormi? Bitta chaqiruvdagi D1 so'rovlar chegarasi (Free 50 / Paid 1000) va cron CPU vaqti shunga bog'liq.
18. **`[B]` zaxira nusxalar:** D1 Time Travel muddati tarifga bog'liq. Bu muddat policy'da aytiladimi?
19. **Data safety:** "hisobni o'chirmasdan ma'lumotni o'chirish" savoliga "No" javobi ma'qulmi?
20. **Eski admin jurnallari va Telegram:** `admin_activity_log` dagi eski yozuvlarda U ning email va telefoni `#id` ga almashtirilsinmi (`SCRUB_ADMIN_LOG`) yoki jurnallarda email, telefon va IP borligi oshkor qilinsinmi? Admin Telegram chatidagi eski xabarlarda (`worker.js:4588-4593`) yetkazish uchun ism va telefon bor, purge ularni o'chira olmaydi. Qo'lda tozalanadimi yoki oshkor qilinadimi?
21. **U1 qamrovi:** katalog (`company_catalog_items`), menyu, mahsulot va xizmatlar, galereya, avatar hamda kompaniya logo/cover/galereyasi dalil arxiviga kirmaydi (`ARCHIVE_KINDS`, `content-archive.js:31`) va R2 dan ham o'chiriladi. Bu ma'qulmi yoki yangi arxiv turlari qo'shilsinmi (destruktiv emas)?
22. **Boshqa odamning kartasiga ulangan jismoniy qurilma:** U egasi sifatida faol qoladimi (rejadagi standart) yoki `owner_user_id` ulangan karta egasiga o'tkazilsinmi?
23. **Blocker eskalatsiyasi:** grace tugaganidan necha kun keyin (tavsiya: 14) bloklangan hisob "kechikkan" deb belgilanadi? Foydalanuvchi javob bermasa balans yoki buyurtma qanday yopiladi (9-savol bilan bog'liq)?
