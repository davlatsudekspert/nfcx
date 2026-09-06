# NFCSTORE.UZ — TO'LIQ AUDIT

Sana: 2026-09-05 · Branch: `claude/phone-settings-image-changes-rbaxdi` · Holat: **1–3 bosqich (audit + dizayn takliflari)**. Production kodga tegilmagan.

> Usul: 4 ta parallel kod-audit (frontend, Worker/API, D1+i18n, Admin/News/Auth/SEO) + lokal muhitda (Vite + test DB) 15 sahifaning 390px/1440px real screenshotlari (Playwright, Chromium). Barcha topilmalar `fayl:qator` bilan.

---

## 0. Arxitektura (haqiqiy koddan aniqlangan)

| Qatlam | Nima | Manba |
|---|---|---|
| Frontend | React 18 + Vite 6 + Tailwind 4 + daisyUI, custom router (`pushState`) | `src/App.jsx`, `src/lib/router.js` |
| **Production backend** | **Cloudflare Worker** `hosting/worker.js` (4289 qator) — Workers-with-assets, `dist/client` statik + `dist/server/index.js` Worker | `wrangler.jsonc` (`main`, `assets`) |
| Database | **Cloudflare D1** — binding `DB` (`01eed0bb-…`) | `wrangler.jsonc` |
| Fayllar | **R2** — binding `UPLOADS` (`nfcstore-uploads`), `/uploads/*` Worker orqali | `hosting/worker.js:2664-2771` |
| Legacy backend | Express + PostgreSQL (`server/`) — **production emas**, Railway o'chirilgan (`worker.js:4253`) | `server/index.js` |
| Auth (user) | email+parol → `sessions` jadvali, cookie `nfc_session` (HttpOnly, Lax, 30 kun) | `worker.js:1272-1283, 2348-2366` |
| Auth (admin) | telefon+parol + TOTP/Telegram 2FA, cookie `nfc_admin_session` (Strict, 24h/12min idle), IP whitelist | `worker.js:2950-3092` |
| Query usuli | ORM yo'q — D1 `prepare().bind()`; schema `CREATE TABLE IF NOT EXISTS` **har so'rovda** | `worker.js:980-1138` |
| Migration | Runner yo'q: `db/d1-migration/0001-schema.sql` bir marta qo'lda; `migrations/` papkasi **hech qachon ishlamaydi** | `MIGRATION-README-UZ.md:24` |
| i18n | `t(uzbekMatn)` → `DICT[uz][ru/en]`, 2 083 kalit, topilmasa jimgina UZ | `src/lib/i18n.jsx`, `translations.js` |
| Payme | JSON-RPC `POST /api/pay/payme`, Basic auth `Paycom:PAYME_KEY`, holat `web_orders` | `worker.js:4106-4131, 2035-2250` |
| Deploy | GitHub Actions → `wrangler deploy` (main) | `.github/workflows/deploy.yml` |
| Testlar | **Yo'q** (unit/integration/E2E — nol) | — |

**Eng muhim arxitektura xatosi:** Worker'da topilmagan `/api/*` so'rovlar `https://nfcstore.uz` ga (ya'ni **o'ziga**) proxy qilinadi (`worker.js:4268-4276`) → 405/HTML/503. Shu sabab ko'p funksiyalar production'da "jimgina" ishlamaydi.

---

## 1. Funksiyalar inventarizatsiyasi

Darajalar: **P0** xavfsizlik/ma'lumot/ishlamaslik · **P1** asosiy funksiya noto'g'ri · **P2** dizayn/tezlik/SEO/UX · **P3** kod sifati.
Holat: ✅ ishlaydi · ⚠️ qisman · ❌ ishlamaydi (prod) · 🎭 soxta/demo.

### 1.1 Mehmon (ro'yxatdan o'tmagan)

| Funksiya | Route | API | D1 | Holat | Muammo | Daraja |
|---|---|---|---|---|---|---|
| Bosh sahifa, ID tekshirish | `/` | GET `/records/:code` | cards | ✅ | Hero mobil'da karta vizuali yo'q; "kimlar uchun", kompaniya bo'limi, ishonch elementlari yo'q; nav 9 ta link | P2 |
| Narxlar + kalkulyator | `/narxlar` | GET `/records/:code` | cards | ✅ | **390px'da gorizontal scroll** (Playwright) | P2 |
| Katalog + qidiruv | `/katalog` | GET `/records/search` | cards | ✅ | — | — |
| Reyting | `/reyting` | — (catalog prop) | — | ✅ | ko'rishlar soni himoyasiz oshiriladi (P0 ga q.) | — |
| Kompaniyalar | `/kompaniyalar` | GET `/companies/search` | cards | ⚠️ | "Qidirish" tugmasida `onClick` yo'q (`CompaniesPage.jsx:207`); **390px hscroll**; 14 ta tarjimasiz matn | P1/P2 |
| Yangiliklar ro'yxati | `/yangiliklar` | GET `/news` | news, news_likes | ⚠️ | Tafsilot sahifasi **yo'q**; like/view **ishlamaydi** (Worker `/api/news` ni faqat aynan moslaydi, `worker.js:4204`) | P1 |
| Auksion | `/auksion`, `/auksion/:id` | GET `/auctions*`, POST vote/request | auctions, bids, auction_demand | ⚠️ | bid/pay `503 payments_disabled` (dizayn bo'yicha) | — |
| Sovg'alar devori | `/gifts` | GET `/gifts/public` | nfc_gifts | ❌ | **Worker route yo'q** → self-proxy | P1 |
| Savollar / Qo'llanma / Aloqa / Shartlar / Maxfiylik / Qanday ishlaydi | statik | — | — | ✅ | 5 sahifa o'z `CONTENT[lang]` mexanizmida (DICT'dan tashqari) | P3 |
| Karta dizayneri | `/karta-dizayni` | — | — | ✅ | — | — |
| Biznes namuna | `/biznes-namuna` | — | — | 🎭 | 13 ta tarjimasiz demo matn | P3 |
| Ommaviy shaxsiy profil | `/:code` | 25+ endpoint (q. 1.3) | cards, posts, follows… | ⚠️ | q. 1.3 | — |
| Kompaniya (yangi) ommaviy | `/company/:id`, `/c/:id` | GET `/companies/:id` | companies | ⚠️ | `/c/:id` sahifasida **bitta ham `t()` yo'q** (`CompanyQuickProfilePage.jsx`), narx `so'm` hardcode | P1 (i18n) |
| Ro'yxatdan o'tish | `/register` | POST `/auth/register`, `/request-register-code` | users | ❌ | **Worker'da yo'q** (`worker.js:2382`) → **yangi foydalanuvchi umuman ro'yxatdan o'ta olmaydi** | **P0** |
| Kirish | `/login` | POST `/auth/login` | users, sessions | ✅ | **rate limit yo'q**, scrypt CPU-DoS | **P0** |
| Parolni tiklash | — | — | — | ❌ | **Umuman mavjud emas** (route ham, UI ham) | **P0** |

### 1.2 Jismoniy shaxs (kirgan, NFC profil egasi)

| Funksiya | Route/tab | API | Holat | Muammo | Daraja |
|---|---|---|---|---|---|
| Kabinet hero, statistika | `/account` | GET `/auth/me`, `/orders` (har 5s poll) | ✅ | 3 qavat nav (header 9 link + 7 tab + sidebar 6) — "Boshqaruv/Profil/Sozlamalar" ikki martadan; "Profilni ko'rish" 3 joyda; "Kompaniya" tabi shaxsiy foydalanuvchida; **1440px hscroll** (header overflow) | P2 |
| Profil tahrirlash (turi, ma'lumot, avatar, tema, fon, musiqa, ijtimoiy, lokatsiya, kartalar, havolalar) | `/account` → `profil` | PUT `/records/:code`, POST `/upload`, `/upload-audio` | ✅ | `expert` turi hech narsani o'zgartirmaydi (inert, `access.js:108`); saqlanmagan o'zgarish ogohlantirishi yo'q; autosave yo'q; 5 ta xato matni `new Error('…')` tarjimasiz (`AccountPage.jsx:1356-1375`) | P1/P2 |
| Jonli preview | `/account` | — | ✅ | **5 ta mustaqil telefon-preview implementatsiyasi** (`AccountPage:1265`, `CompanyPhonePreview`, `BusinessWorkspacePage:71`, `CompanyWorkspacePage:57`, `CompaniesPage:33`) | P3 |
| Asosiy ID qilish | `nfckarta` | POST `/records/:code/set-primary` | ❌ | Worker'da yo'q | P1 |
| Kartani o'chirish | `nfckarta` | DELETE `/records/:code` | ❌ | Worker'da yo'q | P1 |
| Sovg'a qilish | `nfckarta` | POST `/records/:code/gift` | ❌ | Worker'da yo'q | P1 |
| Jismoniy NFC buyurtma | `nfckarta` | POST `/records/:code/order-physical-card` | ❌ | Worker'da yo'q (import bor, chaqirilmaydi ham — `AccountPage.jsx:3`) | P1 |
| Postlar/Media | `postlar` | GET/POST `/records/:code/posts`, DELETE `/posts/:id`, upload | ✅ | (2d8ca62 da tuzatilgan) | — |
| Premium so'rov | `/account` | POST `/premium/request` | ❌ | Worker'da yo'q | P1 |
| Sovg'a takliflari, referral, yutgan auksionlar | `/account`, `/bildirishnomalar` | ✅ mavjud | ✅ | `/bildirishnomalar` 1440px hscroll | P2 |
| Sozlamalar: parol/telefon o'zgartirish | `/sozlamalar` | POST `/settings/request-password-code`, `/change-password`, `/request-phone-change-code`, `/confirm-phone-change` | ❌ | **4 ta ham Worker'da yo'q** | P1 |
| Sozlamalar: statistika, lidlar, fayllar (CardTools) | `/sozlamalar` | GET `/records/:code/analytics`, `/leads`, `/files*` | ❌ | Worker'da yo'q; sarlavha "video" va'da qiladi, video bo'limi yo'q (`SettingsPage.jsx:143`) | P1 |
| Yordam xabari | `/account` | POST/GET `/support` | ❌ | Worker'da yo'q | P1 |
| To'lovlar tarixi | `/tolovlar` | GET `/payments`, `/payments/:id` | ❌ | Worker'da yo'q; 1440px hscroll | P1 |
| Xabarlar (chat) | `/xabarlar` | `/conversations*` | ❌ | `MESSAGING_ENABLED=false` bilan o'chirilgan, Worker'da ham yo'q; lekin Header har 8s `unread-count` so'raydi (`Header.jsx:139`) | P3 |
| NFC ID bron/xarid (Payme) | ReserveModal | POST `/records/:code` → checkout link, poll GET `/orders/:id` | ⚠️ | `PAYMENTS_ENABLED` env bo'lmasa 503 (hozir dormant); UI'da "tez kunlarda" matni | — |

### 1.3 Ommaviy shaxsiy profil (`/:code`)

| Funksiya | API | Holat | Muammo | Daraja |
|---|---|---|---|---|
| Ko'rish hisoblagichi | POST `/records/:code/view` | ✅ | **autentifikatsiyasiz, cheklovsiz `views+1`** → reyting soxtalashtiriladi (`worker.js:2433`) | **P0** |
| Event log (qo'ng'iroq/tg bosildi) | POST `/records/:code/event` | ❌ | Worker'da yo'q — statistika yig'ilmaydi | P1 |
| Follow/like/postlar | ✅ | ✅ | — | — |
| Lid forma | POST `/records/:code/lead` | ❌ | Worker'da yo'q | P1 |
| Menyu/mahsulot/xizmat/fayl/jamoa/galereya (public) | GET `/records/:code/{menu,products,services,files,team,gallery}` | ❌ | **Barchasi Worker'da yo'q** — biznes profil bo'sh ko'rinadi | **P1** |
| Sovg'a aktivatsiyasi | GET `/nfc-gifts/:code`, POST verify/activate | ❌ | Worker'da yo'q | P1 |
| vCard, ulashish, musiqa, til | — | ✅ | Musiqa pleer joylashuvi (tuzatilgan 5c7d81c) | — |
| SEO/OG | — | ❌ | **Hech qanday sahifaga xos title/OG yo'q**, canonical hamma joyda `/` (`index.html:10`), `robots.txt`/`sitemap.xml` yo'q | P2 |

### 1.4 Kompaniya / Business Account

| Funksiya | Route | API | Holat | Muammo | Daraja |
|---|---|---|---|---|---|
| Company ID yaratish | `/company/create` | GET `/companies/check`, POST `/companies` | ✅ | `upstreamUser` `profile_type`/`address` ustunlarini SELECT qilmaydi → jimgina tushib qoladi (`worker.js:319-322, 559`) | P1 |
| Workspace (5 tab) | `/workspace/:id` | PATCH `/companies/:id`, submit, catalog CRUD | ✅ | "To'lov" `503 stub` (`worker.js:615`); preview tugmalari focusable lekin ishlamaydi | P2 |
| Eski biznes profil (cards.profile_type=business) katalog/galereya/jamoa boshqaruvi | `/account` (biznes tab to'plami) | `/records/:code/{menu,products,services,gallery,team}/manage*` (32 endpoint) | ❌ | **Hech biri Worker'da yo'q** — eski biznes profillar boshqarilmaydi | **P1** |
| Aksiyalar (promotion) | `aksiyalar` | PUT/DELETE `/catalog-meta/.../promotion` | ⚠️ | Egalik tekshiruvi Worker ichidan **o'ziga `fetch`** qiladi (`worker.js:74-89`) → ehtimol doim `false` | P1 |
| `/business/demo` workspace | `/business/:code` | — | 🎭 | **To'liq soxta**: 9 ta tugma handler'siz, lat/lng o'zgarmaydi, `save()` faqat toast (`BusinessWorkspacePage.jsx:155-216`) | P2 |
| Jismoniy vs kompaniya ajratish | — | — | ⚠️ | Bitta `/account` sahifasida `profileType` bo'yicha tab to'plami almashadi; onboarding/dashboard/menyu **aralash**; Header'da shaxsiy user uchun ham "Kompaniya" | P1 (UX) |

### 1.5 Admin Panel (20 tab)

| Tab | Holat | Muammo | Daraja |
|---|---|---|---|
| Umumiy, Statistika, Buyurtmalar, Payout, Auksionlar, So'rovlar, Talab, Jismoniy kartalar, Bildirishnomalar, Promokod, Yangiliklar, Security, Adminlar | ✅ | Export Excel `/export-stats` **501**; buyurtma to'lovini tasdiqlash `/orders/:id/confirm-payment` **501** | P1 |
| Foydalanuvchilar | ⚠️ | `/users/:id/delete` **501**; suspend/adjust-balance/set-test uchun **rol tekshiruvi yo'q** (content_manager pul qo'sha oladi, `worker.js:3486-3527`) | **P0** |
| Kategoriyalar | ❌ | Barcha CRUD **501** (faqat public GET bor) | P1 |
| Tasdiqlash (verify/views) | ❌ | POST verify/views **501** | P1 |
| Gift NFC ID yaratish | ❌ | POST `/nfc-gifts` **501** | P1 |
| Moliya (6 sub-tab) | ❌ | 5/6 sub-tab **501** | P1 |
| Kompaniyalar (status/tier/limits/pricing/delivery yozish) | ❌ | 5 endpoint **501** | P1 |
| Umumiy UX | ⚠️ | Xatolar `.catch(()=>{})` → **bo'sh holat bilan farqlanmaydi**; pagination yo'q (LIMIT 100/200/2000); qidiruv client-side; destruktiv amallarda tasdiq yo'q (IP o'chirish, status select); `window.prompt`; soxta "85% server yuklamasi" (`AdminUI.jsx:76-81`); 26 ta tarjimasiz matn | P2 |

---

## 2. Xavfsizlik (P0 / P1)

| # | Topilma | Fayl | Daraja |
|---|---|---|---|
| S1 | Ro'yxatdan o'tish production'da ishlamaydi | `worker.js:2382-2386` | P0 |
| S2 | `POST /api/auth/login` — rate limit yo'q; har urinish scrypt (N=16384) JS'da → brute-force + CPU DoS | `worker.js:2348, 879` | P0 |
| S3 | User session token **xom** saqlanadi (admin — SHA-256) | `worker.js:2363` vs `1326` | P0 |
| S4 | Parolni tiklash mexanizmi yo'q | — | P0 |
| S5 | Admin: TOTP yoqilmagan bo'lsa **faqat parol** bilan kiradi | `worker.js:2979-2990` | P0 |
| S6 | Admin: `adjust-balance`, `suspend`, `pending-payouts/clear`, `auctions/*`, `news/*` — `super_admin` tekshiruvi yo'q | `worker.js:3486-3527, 3218` | P0 |
| S7 | `companyAdminApi` **IP whitelist'ni chetlab o'tadi** (`coreApi`dan oldin dispatch) | `worker.js:4225` | P1 |
| S8 | Hech qanday security header yo'q (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) | `worker.js:1-4, 4278` | P1 |
| S9 | `/uploads/*` `nosniff`siz + rasm/audio faqat data-URL prefiks bilan tekshiriladi (magic byte yo'q) → MIME-sniff XSS | `worker.js:2632, 2707` | P1 |
| S10 | `views+1` autentifikatsiyasiz/cheklovsiz; reaction/vote `oai-authenticated-user-id` **client header**iga ishonadi | `worker.js:2433, 65, 191` | P1 |
| S11 | Admin rate limit in-memory per-isolate (chetlab o'tiladi); IP whitelist DB xatosida **fail-open** | `worker.js:2916, 1365` | P1 |
| S12 | 2FA'ni o'chirish parol/TOTP qayta tasdiqsiz | `worker.js:3577` | P1 |
| S13 | Finance overview'da SQL `${start}/${end}` interpolatsiya (regex bilan himoyalangan, lekin xavfli namuna) | `worker.js:3240-3246` | P2 |
| S14 | Upload'da per-user kvota/limit yo'q (R2 xarajat) | `worker.js:2674` | P2 |
| ✅ | SQL injection: barcha query `.bind()`; IDOR: PUT/POST/DELETE egalik tekshiruvi to'g'ri; open redirect yo'q; sirlar logga chiqmaydi; Payme idempotent va to'g'ri | — | — |

## 3. D1 (ma'lumotlar bazasi)

| # | Topilma | Ta'sir | Daraja |
|---|---|---|---|
| D1 | Migration runner yo'q; `migrations/` papkasi hech qachon qo'llanmaydi; 22 ta jadval faqat qo'lda ishga tushirilgan SQL'ga bog'liq (`news`, `nfc_gifts`, `categories`, `gift_offers`, `physical_cards`, `support_messages`…) | Yangi/bo'sh D1'da 500 | P1 |
| D2 | Schema har so'rovda 28-statementli `batch` + 11 `ALTER` (har biri "duplicate column" bilan tugaydi) | Har so'rovga latency + bitta xato → butun API 503 | P1 |
| D3 | Worker `CREATE TABLE`lari `0001-schema.sql`dan **FK va indekslarsiz** (`sessions`, `cards`, `bids`, `auctions`…) | Qaysi biri birinchi ishlasa — abadiy | P1 |
| D4 | Indeks yo'q: **`cards(user_id)`** (12 ta query!), `sessions(expires_at)` (har so'rovda DELETE), `sessions(user_id)`, `web_orders(code,status)`, `web_orders(status,created_at)`, `news(published,created_at)`, `news_likes(visitor_hash)`, `referral_uses(referrer_id)` | Full scan | P2 |
| D5 | UNIQUE yo'q: `web_orders(code) WHERE status='pending'` (atayin o'chirilgan, `worker.js:1072-1097`), `company_payments.upstream_order_id`, `auction_requests(user_id,code)`, `referral_uses(referred_id)` | Dublikat bron/to'lov xavfi | P1 |
| D6 | `sessions` tozalash (`DELETE … WHERE expires_at<?`) **har autentifikatsiyalangan so'rovda** | Yozish + full scan | P2 |
| ✅ | `web_orders.payme_transaction_id` UNIQUE; bron atomik `INSERT…WHERE NOT EXISTS`; `finalizePaidWebOrderD1` 4 holatni to'g'ri boshqaradi | — | — |

## 4. Payme (sandbox)

Oqim to'g'ri va idempotent (`CheckPerform→Create→Perform`, `Cancel`, `Check`, `GetStatement`), summa tekshiruvi, `-31050/-31001/-31008/-31003` kodlari, `COALESCE` bilan vaqtlar bir marta yoziladi. **Muammolar:** (a) `PAYMENTS_ENABLED` env bo'lmasa butun oqim 503 — hozir dormant; (b) `/api/pay/payme` rate limit yo'q; (c) faqat `kind=card_purchase` finalizatsiya qilinadi (kompaniya to'lovi stub); (d) UI'da Payme brendi yo'q — oddiy matn, pending/success/failed holatlari zaif; (e) Timing-safe taqqoslash uzunlikni oshkor qiladi (kichik). **Regression test yo'q** — 8-bosqichda yoziladi.

## 5. i18n (UZ/RU/EN)

- Mexanizm to'g'ri (state saqlanadi, reload yo'q). **123 ta tarjimasiz matn 17 faylda** (`BusinessWorkspacePage` 38, `AdminPage` 26, `CompaniesPage` 14, `BusinessPublicDemoPage` 13, `CompanyQuickProfilePage` 6 — NFC tap tushadigan sahifa!).
- `fmt()` doim `ru-RU`, `dateTime()` qo'lda `DD.MM.YYYY`, 8 joyda `'uz-UZ'` hardcode (`format.js:12-30`, `AccountPage.jsx:3341`).
- `<html lang>`, `<title>`, meta, canonical, hreflang — **hech qachon o'zgarmaydi** (`index.html`).
- 5 sahifa (`Terms/Privacy/FAQ/HowItWorks/Pricing`) o'z `CONTENT[lang]` mexanizmida.
- Yangiliklar va kategoriyalar **to'liq 3 tilli** (schema, Worker, admin editor, public) ✅.

## 6. SEO / tezlik

- `robots.txt`, `sitemap.xml` yo'q (eski Express'da bor edi, Worker'ga ko'chmagan) — `/admin`, `/account` disallow ham yo'qolgan.
- Per-route title/description/OG yo'q; profil ulashilganda Telegram'da umumiy karta.
- Bundle: `index-*.js` 565 kB, `AdminPage-*.js` 561 kB (>500 kB ogohlantirish), `AccountPage` 144 kB.
- Header har 8s `unread-count` (o'chirilgan funksiya uchun), Account har 5s `/orders` poll.
- `public/_music_preview.html` — dev artefakti production'da.

## 7. Vizual/responsive (screenshotlar: `scratchpad/current/*-390.png`, `*-1440.png`)

| Sahifa | 390px | 1440px | Izoh |
|---|---|---|---|
| `/` | hero'da karta vizuali **yo'q** (faqat matn), "kimlar uchun"/kompaniya/ishonch/FAQ bo'limlari yo'q | ✅ | Header nav 9 link — qidiruv placeholder kesilgan |
| `/narxlar` | **hscroll** | ✅ | |
| `/kompaniyalar` | **hscroll** | ✅ | |
| `/account` | 4024px uzun | **hscroll** (header overflow: 9 link + To'lovlar + profil) | 3 qavat navigatsiya, dublikat tugmalar |
| `/sozlamalar`, `/tolovlar`, `/bildirishnomalar` | ✅ | **hscroll** | Header sababli |
| `/:code` | ✅ (5c7d81c dan keyin) | ✅ | |
| `/yangiliklar` | ✅ | ✅ | Tafsilot yo'q |

## 8. Kod sifati (P3)

- 5 ta ishlatilmagan komponent (`Button`, `ComingSoon`, `PayButton`, `PedestalShowcase3D`, `SampleDemo`); 10 ta ishlatilmagan `db.js` eksporti; `STATIC_ROUTES` xaritasi render uchun ishlatilmaydi (`App.jsx:44-65`); `timeLeft`, `Section`, `ORDER_STATUS_LABEL` dublikat; 3 ta ~180 qatorli deyarli bir xil katalog-manager; `db.js`da 2 xil API client + 20 xom `fetch`.
- `SettingsPage.jsx:36` render ichida `navigate()`; `i18n.jsx:32` render ichida side-effect; global `Backspace` preventDefault (`App.jsx:97-107`).
- **"Boshqaruv" nav tugmasida `onClick` yo'q** (`AccountPage.jsx:3453`).

---

## 9. Xulosa (raqamlar)

| | Soni |
|---|---|
| Tekshirilgan route/sahifa | 31 route + 20 admin tab + 12 kabinet tabi |
| Client API chaqiruvlari | 99 (33 ✅ Worker'da bor · **66 ❌ yo'q**) |
| Admin endpoint'lar 501 | ~20 |
| **P0** | 8 (S1–S6, views forgery, admin rol) |
| **P1** | ~35 |
| **P2** | ~30 |
| **P3** | ~25 |
| Tarjimasiz matn | 123 |
| Mavjud testlar | 0 |

## 10. Bajarish rejasi (dizayn tanlangandan keyin)

1. **P0 (Worker):** register/OTP portlash; login rate-limit (D1-based) + session hash; parol tiklash (Telegram OTP orqali, mavjud `password_reset_codes` jadvali); admin rol tekshiruvlari; 2FA majburiy/oq ro'yxat fail-closed; `views` dedup (visitor hash + 24h); security header'lar; legacy self-proxy → aniq 404 JSON.
2. **P1 (Worker parity):** 66 ta yo'q route'ni D1 uchun portlash (settings, support, set-primary, delete, gift, physical-card, premium, payments, leads/analytics/events, menu/products/services/files/team/gallery public+manage, nfc-gifts, news like/view, admin: categories, verify, finance, orders confirm, users delete, gifts create, companies write). Har biri egalik tekshiruvi bilan.
3. **D1:** `migrations/0002_indexes.sql` (indekslar, UNIQUE'lar) + `wrangler d1 migrations` ga o'tish rejasi + rollback; **production'ga o'zim qo'llamayman**.
4. **Ajratish:** ro'yxatdan o'tishda "Jismoniy shaxs / Kompaniya" tanlovi → alohida onboarding, dashboard, menyu; `expert`ni saqlab qolgan holda; eski URL'lar o'zgarmaydi.
5. **Dizayn tizimi** (tanlangan variant) → Header/Footer/Home/Profile/Account/Company/Admin/News/Payme/formalar.
6. **i18n:** 123 kalit, `format.js` locale, `<html lang>`/title/OG per-route, `robots.txt`/`sitemap.xml`, hreflang.
7. **Testlar:** Vitest (Payme JSON-RPC regression, access, format), Playwright E2E (auth, profil, kompaniya, admin, 3 til, 5 breakpoint), build + console tekshiruvi.
8. **Yakuniy hisobot** + rollback tartibi.
