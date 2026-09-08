# NFCSTORE.UZ — TODO

Updated: 2026-08-29

## P0 — release blockers

- [x] Preserve original project and work from a verified copy.
- [x] Stop paid IDs from being created without payment.
- [x] Add explicit default-off payment gates on server and client.
- [x] Disable new auction bids/settlement while payment is unavailable.
- [x] Remove phone/payment-card leaks from public APIs.
- [x] Fix gift activation session argument order and TTL.
- [x] Remove fake verification UI.
- [x] Make admin 2FA fail closed.
- [x] Ensure admin API receives common security headers.
- [x] Make Public Profile mobile-first with Save Contact as primary CTA.
- [ ] Mechanically sync verified staging changes into `D:\NFCSTORE_GPT_DEVELOPMENT` after the Windows sandbox D: write issue is resolved.
- [ ] Authenticate GitHub, push the prepared commit, and grant the Railway GitHub App access to `davlatsudekspert/nfcx`.
- [ ] Create the Railway service, attach PostgreSQL through `DATABASE_URL`, generate a domain and verify the live healthcheck.

## P1 — next production hardening sprint

- [ ] Add automated API tests for auth, privacy projection, hidden phone, payment gates, gift activation and admin 2FA.
- [ ] Add React component/e2e tests for Home, Public Profile, Register, Account and disabled payment states.
- [ ] Add lint and test scripts to `package.json` and CI.
- [ ] Replace startup schema mutation with versioned PostgreSQL migrations.
- [ ] Validate uploaded files by magic bytes; add upload-specific rate and size limits.
- [ ] Add CSP and a reviewed production security-header policy.
- [ ] Require and validate a canonical production host/origin for HTTPS redirects.
- [ ] Verify Telegram bot username/configuration instead of relying on frontend constants.
- [ ] Resolve the missing `xlsx` dependency or replace the Admin export implementation.
- [ ] Add per-route catalog fetching so Admin/Auth/Profile do not all request the catalog at startup.
- [ ] Split or defer the Admin export/vendor payload further.
- [ ] Add dynamic per-profile title, canonical and Open Graph metadata via SSR/edge rendering.
- [ ] Complete Uzbek/Russian/English translations for newly added product copy.
- [ ] Run real-device VCF download tests on iOS Safari and Android Chrome; the in-app QA browser did not expose a blob download event even though no console error occurred.
- [ ] Review auction state already in `awaiting_payment` before production payment activation.
- [ ] Perform a database-backed integration test with a disposable PostgreSQL instance.

## P2 — quality and growth

- [ ] Add a global light/dark theme switch with persisted preference.
- [ ] Consolidate repeated button/card classes into design-system components and tokens.
- [ ] Reduce non-essential glow/orbit animations and optimize hero compositing cost.
- [ ] Optimize PNG assets and define responsive image sizes.
- [ ] Add skeleton states for lazy routes and profile data.
- [ ] Improve Account information architecture into a persistent desktop sidebar plus mobile tabs.
- [ ] Add privacy controls per social/contact field, not phone only.
- [ ] Add accessible labels/titles to every icon-only action.
- [ ] Add real verification only after a documented verification workflow and database field exist.
- [ ] Add analytics events for profile open, NFC tap, Save Contact and Share while respecting consent/privacy.
- [ ] Add sitemap/robots generation and structured data.
- [ ] Remove dead CSS/components and audit unused dependencies.

## Payment activation checklist

Payments must stay disabled until every item is complete:

- [ ] Payme merchant contract and production credentials verified.
- [ ] Webhook authentication and idempotency tested against provider sandbox.
- [ ] Refund/cancellation and failed-code-taken behavior tested.
- [ ] Auction settlement and winner deadline policy approved.
- [ ] Legal copy, price display and support escalation approved.
- [ ] Monitoring, reconciliation and admin audit trail verified.
- [ ] Set backend `PAYMENTS_ENABLED=true` only after approval.
- [ ] Change frontend `PAYMENTS_ENABLED` only in the same reviewed release.

## Ismlar auksioni — KEYINGA QOLDIRILDI (qaror: 2026-09-08)

Qaror: hozir qurilmaydi. Sabab — hisob-kitob:

| | Nechta bo'lishi mumkin | Qanday sotiladi |
|---|---|---|
| `ABC123` kod | 26³ × 10³ = 17 576 000 | darhol, qat'iy narxda, o'z-o'zidan |
| 3 harfli ism | jami 17 576, ismga o'xshagani ~100-200 | auksion, har biri qo'lda ish |

Kod biznesi o'sadi, ism biznesi o'smaydi. Ismlar avtomatlashtirishga
arzimaydigan darajada kam, lekin PRESTIJ qatlami sifatida qoladi.

MUHIM: imkoniyat yo'qolmagan — admin bugun ham istalgan ismga qo'lda
auksion ocha oladi (`POST /api/admin/auctions`). Faqat avtomatlashtirish
qoldirildi.

Qachon qaytamiz: Instagram/Telegram orqali haqiqiy so'rovlar kelganda.
Signal allaqachon yig'ilyapti — "Talab" taxtasi ishlab turibdi
(so'rov -> admin tasdiqlaydi -> ovoz yig'iladi -> 20 tada `ready`).
Nol ovozli ism — qurishga arzimaydi degani.

O'shanda qilinadigan ish (kelishilgan dizayn):

- [ ] Alohida «Ismlar» sahifasi: ism yoziladi -> band emasligi va
      boshlang'ich auksion narxi darhol ko'rinadi.
- [ ] Boshlang'ich narx HARFLAR SONIDAN hisoblanadi. Naqsh saytda
      allaqachon bor — `companyPricing()` (3 -> 990 000, 4-5 -> 749 000,
      6-7 -> 549 000, 8+ -> 349 000). Ismlar uchun taklif:
      3 -> 2 000 000, 4 -> 1 500 000, 5 -> 1 000 000, 6-7 -> 700 000,
      8-9 -> 500 000, 10-12 -> 350 000. Raqamlar TASDIQLANMAGAN.
- [ ] Ikki kirish yo'li: (a) ochish to'lovi bilan darhol; (b) 20 ta
      ovozdan keyin avtomatik. Ikkalasida ham muddat 72 soat.
- [ ] Ochish to'lovi QAYTARILMAYDIGAN kichik summa bo'lsin (~50 000,
      g'olib bo'lsa hisobga o'tadi). Boshlang'ich narxni oldindan
      to'latish YO'Q — ustidan oshirilsa pul qaytarish kerak bo'ladi va
      bu har safar qo'lda ish va nizo demakdir.
- [ ] Band qilingan ro'yxat: mashhur brend va shaxs ismlari sotuvga
      chiqmasin (hozir faqat `GOD*` bloklangan). Shartlarga "asosli
      shikoyat kelsa olib tashlaymiz" bandi.
- [ ] Admin panelda shaxsiy ID'lar uchun narx jadvali — hozir per-code
      narx `CODE_PRICES_D1` da, kod ichida yozilgan (5 ta kod) va
      o'zgartirish uchun deploy kerak. Company ID'da bunday panel bor.

Ochiq nomuvofiqlik (hozir zarari yo'q, yakunlash qo'lda):
- [ ] Admin auksion ochishda kod uchun `[A-Z0-9]{3,16}` qabul qilinadi,
      lekin ishlaydigan profil kodi faqat `[A-Z]{3,12}` / `[A-Z]{3}[0-9]{3}` /
      `[0-9]{8}`. Ya'ni profilga aylanmaydigan kodga auksion ochib
      yuborish mumkin. Auksion ochishda ham `validCode` tekshirilsin.
- [ ] Auksion to'lovi (`auction_payment`) D1'ga ko'chirilmagan — g'olib
      aniqlangach kartani admin qo'lda biriktiradi.
