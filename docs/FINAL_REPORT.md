# NFCSTORE.UZ — Yakuniy hisobot (V1 "Black & Gold Prestige" integratsiyasi)

Sana: 2026-09-06 · Branch: `claude/phone-settings-image-changes-rbaxdi` · Holat: **lokal commit, PUSH QILINMAGAN, production DEPLOY QILINMAGAN, production D1 migration QILINMAGAN** (barchasi sizning alohida ruxsatingizni kutadi).

Audit hujjati: `docs/NFCSTORE_FULL_AUDIT.md`. Dizayn tizimi: `docs/DESIGN_SYSTEM.md`. Prototiplar: `design-proposals/`.

---

## 1. Umumiy xulosa

Tanlangan V1 dizayni butun saytga (bosh sahifa, ommaviy profil, hisob/kabinet, admin, auth, narxlar, katalog, auksion, yangiliklar, sovg'alar, kompaniyalar) qo'llandi. Backend (Cloudflare Worker) auditda topilgan **66 ta yo'q route** va **P0 xavfsizlik muammolari** tuzatildi, 761 ta avtomatik tekshiruv va 225 ta E2E sahifa-yuklash testi yashil. Stack o'zgarmagan (React 18 + Vite 6 + Tailwind 4 + daisyUI 5 + Cloudflare Worker + D1 + R2). Hech qanday ma'lumot o'chirilmagan, hech qanday `drop/truncate` yo'q.

## 2. Bajarilgan ishlar (fazalar bo'yicha)

| Faza | Natija |
|---|---|
| 1. Audit | `docs/NFCSTORE_FULL_AUDIT.md` (arxitektura, funksiya matritsasi, 66 yo'q route, ~20 admin 501, P0–P3 ro'yxat) |
| 2. 4 ta dizayn prototipi | `design-proposals/` (v1–v4, 9 ekran × UZ/RU/EN, 104 skrinshot) |
| 3. V1 integratsiya | `src/theme.css` tokenlari (`--vz-*`, `.vz-*`, `.btn-gold`), Playfair Display + Manrope + Space Mono; Header/Footer/HomePage/ProfilePage/ReserveModal/Auth/Account/Admin/News/… V1 uslubida |
| 4. Shaxsiy vs kompaniya | AccountPage'da har bir bo'lim `isBusiness` bo'yicha auditdan o'tdi (shaxsiy tablar faqat shaxsiyga, biznes tablari faqat biznesga); bosh sahifada "Kimlar uchun" (Jismoniy shaxs / Kompaniya) bo'limi; AuthPage'da ro'yxatdan o'tishda aniq tanlov (shaxsiy → /account, kompaniya → /company/create) |
| 5. Profil boshqaruvi | Bitta navigatsiya (lg: 240px sidebar, mobil: gorizontal tab qatori), dublikat kirish nuqtalari olib tashlandi; forma 8 bo'limga guruhlandi; bitta oltin "Saqlash" (o'zgarish yo'q bo'lsa o'chiq), "Saqlanmagan o'zgarishlar bor" + `beforeunload` himoya; har ro'yxat 4 holat (skeleton/bo'sh/xato+qayta/urinish/muvaffaqiyat) |
| 6. Premium / Business Account | PremiumPanel: joriy daraja (`effectiveAccess`), nima ochiladi (`FEATURE_MIN`), `POST /api/premium/request` → Payme payLink; 503/409/429 holatlari; narx faqat `PROFILE_PREMIUM_FEE` (20 000) — narxlar o'zgartirilmagan |
| 7. Payme (sandbox) | Payme kodi o'zgartirilmagan; `finalizePaidWebOrderD1` endi `premium_upgrade` (users.is_premium) va `physical_card_order` (physical_cards qatori) ni legacy kabi yakunlaydi; ReserveModal'da `test.paycom.uz` bo'lsa "Test rejimi" belgisi; `payme-order-flow-test` 103/103 |
| 8. Yangiliklar | Ro'yxat + `yangiliklar/:id` detal (sarlavha, sana, ko'rishlar, like, matn), `POST /api/news/:id/view|like` Worker'da; admin CRUD mavjud |
| 9. Admin panel | Fake "85% yuklama" olib tashlandi; rolga qarab UI (content_manager < manager < super_admin); 2FA banner + TOTP o'chirishda parol; ConfirmDialog (window.confirm/alert/prompt o'rniga); har jadval loading/bo'sh/xato; CSV eksport; 20 ta 501/405 bo'lim endi ishlaydi (kategoriyalar, tasdiqlash, gift, buyurtma tasdiqlash, kompaniya sozlamalari, moliya: tranzaksiya/reconciliation/rates/xarajat/hujjat/XLSX hisobot) |
| 10. i18n | `document.lang`, dev-rejimda yo'q kalit ogohlantirishi, locale-aware `fmt/dateTime/timeAgo`; tarjimalar 4 faylga bo'lindi; **+340 ta yangi kalit** (site 68, account 87, admin 162, home/base 30) ru+en bilan; E2E'da 3 tilda 0 xato |
| 11. Xavfsizlik (OWASP) | quyida §4 |
| 12. Tezlik / SEO | `src/lib/seo.js` (title/description/canonical/OG/twitter/robots noindex), `public/robots.txt`, `public/sitemap.xml`, JSON-LD Organization (fake reyting yo'q), lazy-load sahifalar saqlangan; Worker bundle 353 KiB (gzip 79 KiB) |
| 13. Responsive | 375/390/768/1024/1440 × UZ/RU/EN × 15 sahifa = **225/225** gorizontal scrollsiz, konsol xatosiz (`scripts/e2e/smoke.mjs`) |
| 14. Xatolar (P0→P3) | quyida §3 |
| 15–17. Testlar | quyida §5 |

## 3. Tuzatilgan xatolar

**P0**
- `/api/*` noma'lum route Worker'ning o'ziga proxy bo'lib 405/loop berardi → modul dispetcher + JSON 404.
- Ro'yxatdan o'tish/parol tiklash/Telegram webhook Worker'da yo'q edi → `hosting/api/auth.js`, `telegram.js`.
- Sessiya tokenlari xom saqlanardi → SHA-256, eski tokenlar avtomatik yangilanadi (foydalanuvchi chiqib ketmaydi).
- Login/admin-login/upload/view uchun rate-limit yo'q edi → D1 asosidagi `rate_limits`.
- Admin rol tekshiruvi yo'q edi → `roleAtLeast`, super_admin-only amallar 403.
- Ko'rishlar (views) soxtalashtirish → 6 soatlik visitor dedup + `profile_view` hodisasi (analytics uchun).
- TOTP'ni parolsiz o'chirish mumkin edi → parol talab qilinadi.
- Premium/jismoniy karta buyurtmalari to'lovdan keyin `pending` qolardi → finalize portlandi.

**P1** — 66 ta yo'q route (settings/OTP, support, gifts, files/team/gallery/video, analytics/leads, admin kategoriyalar/gift/buyurtma/eksport/kompaniya sozlamalari/moliya) portlandi; `hosting/api/account.js` `../../src` import qilgani (deploy bundle yiqilardi) tuzatildi va `scripts/prepare-sites-build.mjs` ga himoya qo'shildi; `/api/assistant/status` 404 (har sahifada konsol xatosi) → `{enabled:false}`.

**P2** — xato ≠ bo'sh holatlar (admin, gifts, auksion, kompaniyalar, yangiliklar), emoji ikonlar → SVG, 44px tap maydonlari, header 1440px'da kirgan foydalanuvchi uchun overflow, admin 2FA tugmasi kontrasti, CSV fayl kengaytmasi, AuthPage'dagi qattiq-yozilgan bot username → `GET /api/telegram/bot`.

**P3** — tarjima fayllari bo'linishi, FAQ ma'lumoti umumiy modulga (`src/lib/faq.js`), Icons.jsx kengaytirildi.

## 4. Xavfsizlik (Worker/API/D1 qatlamida; Supabase/RLS qo'shilmagan)

- Sessiya: SHA-256 hash at-rest (user + admin), idle/absolute muddat, HttpOnly/Secure/SameSite cookie.
- Rate-limit: login 5/15min (email), admin-login, upload, view, OTP 3/10min, lead 3/min, support 5/min, event 30/10min.
- Header'lar: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `CSP frame-ancestors 'none'`, HSTS, Referrer-Policy.
- Rollar: content_manager/manager/super_admin; barcha admin mutatsiyalari `admin_activity_log` ga yoziladi.
- Input: barcha SQL `.bind()`; sana/ID regex validatsiya; fayl turlari magic-byte (`%PDF-`, `ftyp`) va hajm (8/15 MB) cheklovi; honeypot lead formasi.
- OTP kodlar hash'lanib saqlanadi; TOTP o'chirish parol bilan; IP whitelist kompaniya admin API'da ham.
- Sirlar: hech bir `.env`/token kodga yozilmagan; frontend'ga faqat `TELEGRAM_BOT_USERNAME` ochiq.

## 5. Testlar (haqiqatda ishga tushirilgan)

| Test | Natija |
|---|---|
| `scripts/test-core-security.mjs` | 23/23 |
| `scripts/test-auth.mjs` | 48/48 |
| `scripts/test-telegram.mjs` | 20/20 |
| `scripts/test-catalog.mjs` | 75/75 |
| `scripts/test-account.mjs` | 112/112 |
| `scripts/test-media.mjs` | 72/72 |
| `scripts/test-engagement.mjs` | 57/57 |
| `scripts/test-admin-extra.mjs` | 109/109 |
| `scripts/test-admin-finance.mjs` | 100/100 |
| `scripts/production-worker-parity-test.mjs` | 42/42 |
| `scripts/payme-order-flow-test.mjs` (sandbox) | 103/103 |
| `npm run build` | PASS |
| `wrangler deploy --dry-run` | PASS (353 KiB / gzip 79 KiB) |
| E2E `scripts/e2e/smoke.mjs` (lokal Worker + lokal D1, real Chromium) | 225/225 — 5 viewport × 3 til × 15 sahifa: 0 gorizontal scroll, 0 konsol xato, 0 bo'sh sahifa |
| Vizual tekshiruv | `docs/screenshots/*.png` (bosh, profil, hisob, admin, login, narxlar, yangiliklar, bandlash modali) |

Ishga tushirilmagan: lint/typecheck (repoda eslint/tsc konfiguratsiyasi yo'q), Vitest (repoda yo'q — worker testlari `node:sqlite` harness bilan yozilgan), production D1 migration tekshiruvi (`migrations/0002_check.sql` faqat lokal sinovdan o'tgan).

## 6. O'zgargan fayllar (asosiylari)

Backend: `hosting/worker.js`, `hosting/api/{auth,telegram,catalog,account,media,engagement,admin-extra,admin-finance}.js`, `hosting/api/CONTRACT.md`, `scripts/lib/d1-harness.mjs`, `scripts/test-*.mjs`, `scripts/prepare-sites-build.mjs`, `migrations/0002_*.sql`.
Frontend: `src/theme.css`, `index.html`, `src/App.jsx`, `src/lib/{seo,faq,format,i18n,db,translations*}.js(x)`, `src/components/{Header,Footer,Icons,ReserveModal,LockedFeatureModal,CompanyPhonePreview}.jsx`, `src/components/admin/{AdminUI,ConfirmDialog}.jsx`, `src/pages/{Home,Profile,Auth,Account,Settings,Notifications,Payments,BusinessWorkspace,Admin,News,Pricing,Catalog,Auctions,Auction,Gifts,Messages,Companies,CompanyQuickProfile,CompanyCreate,BusinessPublicDemo,Terms,Faq}Page.jsx`, `public/{robots.txt,sitemap.xml}`.

## 7. Production'ga chiqarish tartibi (sizning ruxsatingiz bilan)

1. `git push -u origin claude/phone-settings-image-changes-rbaxdi` → PR → merge (GitHub Actions avtomatik `wrangler deploy` qiladi).
2. Cloudflare Worker o'zgaruvchilari: `TELEGRAM_BOT_USERNAME` (ochiq), `TELEGRAM_WEBHOOK_SECRET` (secret) — keyin Telegram'da webhook'ni `https://nfcstore.uz/api/telegram/webhook` ga ro'yxatdan o'tkazing va eski `server/bot.js` botni to'xtating.
3. D1 migration 0002 (ixtiyoriy, faqat indekslar): avval `migrations/0002_check.sql` (dublikat bormi?), so'ng `wrangler d1 execute DB --remote --file=migrations/0002_indexes_constraints.sql`. Rollback: `migrations/0002_rollback.sql`.
4. Payme: `PAYME_CHECKOUT_DOMAIN` sandbox (`test.paycom.uz`) qolaveradi — real to'lovga o'tish alohida qaror.

## 8. Rollback rejasi

- Kod: `git revert` (merge commit) yoki Cloudflare Dashboard → Workers → Deployments → oldingi versiyaga "Rollback" (bir necha soniya).
- D1: 0002 migration faqat indekslar — `0002_rollback.sql`; Worker `ensureCoreSchema` faqat `CREATE TABLE/INDEX IF NOT EXISTS` va `ALTER TABLE ADD COLUMN` qiladi (ma'lumot yo'qotilmaydi). Sessiya tokenlari hash'ga o'tgan — eski Worker'ga qaytilsa foydalanuvchilar qayta kirishi kerak bo'ladi (yagona teskari-mos bo'lmagan nuqta).
- R2: o'zgarish yo'q.

## 9. Taklif sifatida qoldirilgan (amalga oshirilmagan)

- Ro'yxatdan o'tishda backend darajasida `profileType` maydoni (hozir tanlov faqat yo'naltiradi).
- `dbListAuctions/dbListAuctionDemand` xatoni yutadi (AuctionsPage'da catch yo'q) — xato ≠ bo'sh uchun kichik refaktor.
- Yangiliklar uchun `GET /api/news/:id` (hozir detal ro'yxatdan olinadi).
- `/finance/overview` (core) rates'ni hisobga olmaydi — Reports tab to'liq hisoblaydi.
- Vitest/ESLint konfiguratsiyasini qo'shish (dependency o'zgarishi — ruxsat kerak).
