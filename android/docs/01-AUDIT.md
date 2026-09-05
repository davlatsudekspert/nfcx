# PHASE 1 — Repo Audit (NFCSTORE.UZ → Android)

Status: **read-only audit. No production file (`src/`, `server/`, `hosting/`, `db/`, `migrations/`) was modified to produce this document.**

## 1.1 Critical finding — the docs in this repo describe the WRONG backend

`NFCSTORE_ARCHITECTURE.md` and `README.md` (repo root) describe a **Node.js/Express +
PostgreSQL backend on Railway** (`server/index.js`, `server/db.js`, `pg`). That stack is
real code and still present, but it is **not what nfcstore.uz serves today**.

Ground truth, read directly from `hosting/worker.js` (4081 lines) and confirmed by
`scripts/production-worker-parity-test.mjs`:

- Production is a **single Cloudflare Worker** (`hosting/worker.js`) bound to:
  - `env.DB` — **Cloudflare D1** (SQLite), schema in `db/d1-migration/0001-schema.sql`
    (54 tables) plus a small extra schema created lazily at runtime for the catalog
    engagement feature (likes/views/promotions) and the Company System v2 tables
    (`companies`, `company_catalog_items`, `company_status_log`, `company_payments`,
    `company_id_rules`).
  - `env.UPLOADS` — **Cloudflare R2**, serving `/uploads/*` (avatars, card audio/video,
    news images) with ETag/Range/304 support ported byte-for-byte from the live
    Cloudflare dashboard source (see comment at `hosting/worker.js:2503`).
  - `env.ASSETS` — the Vite `dist/` build (SPA), per `wrangler.jsonc`.
- The comment at `hosting/worker.js:4046-4059` states explicitly: *"the Railway
  PostgreSQL backend this used to proxy everything to has been shut down."* Any route
  not yet ported in `hosting/worker.js` now hits a **dead upstream** (`fetch` to
  `https://nfcstore.uz` from inside the Worker that **is** nfcstore.uz) and returns
  `503 { error: 'api_upstream_unavailable' }`.
- `server/` (Express) and `db/schema.ts` (Postgres) are effectively **legacy/local-dev
  only** — useful for reading original business logic and comments, but **not the
  contract the Android app should be built against**.

**Action taken in this audit:** the API map (Phase 2 doc) was built by reading
`hosting/worker.js` route-by-route, not from `server/index.js` or the markdown docs.
This is the single most important correction from doing a real audit instead of
trusting existing documentation, and it must be re-verified with whoever owns the
Cloudflare account before writing any networking code (see Open Questions, §1.6).

## 1.2 What is fully ported and working in production (`hosting/worker.js`)

Confirmed live routes (dispatch table at `hosting/worker.js:3881-4036`):

- Auth: login, logout, `me` (cookie-session based — see §1.4).
- Records (NFC ID / profile): public list, search, get/update/create(reserve),
  view/like counters live in `cards` table reads.
- Orders: list + get-by-id (Payme order polling).
- Payme callback route (`/api/pay/payme`).
- Auctions: list, demand board + voting, auction detail + bid history read.
- Admin: the full admin console (login/2FA/stats/users/companies/auctions/news/
  ip-whitelist/finance) is ported.
- Companies: check availability, mine, create, get, patch, submit, catalog CRUD
  (products/services/menu items with price + promo price + image + availability).
- Follow/unfollow/follow-stats/follow-list.
- Gift offers (list/accept/reject/cancel), referrals, "won auctions pending payment".
- Public content: categories, news (+ like), company search, physical-card NFC tap
  check, physical-card pricing tiers, `/api/settings/payments-enabled` (single source
  of truth flag the app must read at runtime — never hard-code it).
- File uploads: `/api/upload`, `/api/upload-audio`, `/api/upload-card-video`,
  `/api/admin/upload` → R2, plus `/uploads/*` GET/HEAD serving from R2.

## 1.3 What is explicitly NOT ported yet (will 503 in production today)

Per the comment block at `hosting/worker.js:4046-4053`, calling any of these currently
falls through to the dead legacy proxy:

- **Registration** (`POST /api/auth/register`, `POST /api/auth/request-register-code`)
  — requires the Telegram bot phone-verification webhook, which is not ported. This
  means **new-user sign-up is currently broken in production.** This is the single
  biggest open risk for the Android app's Auth phase — see Open Questions §1.6.
- Telegram bot integration in general (`server/bot.js`).
- Premium-profile upgrade purchase flow (`PROFILE_PREMIUM_FEE`, `is_premium`).
- In-app messaging/conversations (send message; only the unread-count endpoint is
  ported).
- Physical NFC card ordering (`POST /api/records/:code` with `physicalCard: true`
  is *explicitly rejected with `501`* by the Worker itself, on purpose, so money is
  never taken for something that can't yet be fulfilled).
- News admin write endpoints beyond what's listed, and most `company` extras beyond
  the catalog CRUD above.
- Every `web_orders` kind other than `card_purchase` (i.e. only NFC-ID purchase orders
  work end-to-end today; premium/physical-card orders do not).

**Rule for the Android build:** do not build a screen against an endpoint from
`server/index.js` without confirming the same path exists in `hosting/worker.js`'s
ported set above. The Phase 2 API map marks every endpoint with its live/not-live
status for exactly this reason.

## 1.4 Auth model (important architecture constraint)

- Login (`POST /api/auth/login`) sets an **HttpOnly, SameSite=Lax, Secure** cookie
  named `nfc_session` (30 days TTL) — see `hosting/worker.js:1248-1259`. There is
  **no bearer token** returned in the JSON body.
- Every authenticated request must present that cookie; the API has no
  `Authorization: Bearer` path anywhere.
- **Consequence for Android:** the networking layer cannot be a naive `fetch()` /
  bearer-token client. It needs a real, persistent cookie jar shared across app
  restarts (native `CookieManager`-backed), exactly as a browser would behave. This
  is called out as a first-class architecture decision in the Phase 3 doc — it is the
  most Android-specific risk in this whole project and must be prototyped and tested
  before any other networking code is written.
- Registration is currently unavailable (see §1.3) — until it's fixed server-side,
  the Android app can only support **login for existing accounts**, not sign-up. This
  needs an explicit product decision (§1.6).

## 1.5 Feature/pricing logic that must be mirrored in the UI but NEVER computed
client-side as the source of truth

- `src/lib/pricing.js` — deterministic, pure-function NFC ID tier classifier
  (`tierFromCode`) mapping any `AAA000`-style code to `exclusive / premium / gold /
  silver / free("Bronza")`, plus a fixed price table
  (`TIER_PRICE = { exclusive: null, premium: 199000, gold: 149000, silver: 99000,
  free: 49000 }`) and a safe purchase-quote entrypoint (`getPersonalPurchaseQuote`).
  This logic is small, pure, and safe to **port 1:1 into TypeScript** for instant
  client-side preview/search UX (exactly what the web app does) — but the **actual
  purchase price is always whatever the Worker returns** from
  `personalPurchaseQuote()` server-side at `POST /api/records/:code`
  (`hosting/worker.js:2438`). Never trust a locally computed price for a real order.
- `src/lib/codeTiers.js` — a hand-maintained override list of ~85 codes with fixed
  tiers (34 auction-only "exclusive", 51 fixed-price "premium"). Also portable 1:1.
- `src/lib/access.js` — profile feature-gating by "effective access" level
  (NFC ID tier, floored up by `user.isPremium`). Governs which profile features
  (music, video, animated background, catalogs, team size, gallery, files) are
  visible/editable. This must be ported for the Profile Edit screen to correctly
  gray out gated fields instead of silently failing when the API 422s.
- `src/lib/music.js` — profile "music" is not an uploaded-audio-only feature: it
  accepts a YouTube link, a Yandex Music link, or a direct audio file URL, each
  rendered differently (YouTube IFrame embed / Yandex iframe widget / native
  `<audio>`). **Android equivalent:** YouTube via `react-native-youtube-iframe` (or a
  WebView fallback), Yandex via a sandboxed WebView (no official Yandex SDK), direct
  files via `react-native-track-player` or `expo-av`. This is a real "no shortcuts"
  requirement — the mockup's music player must handle all three source kinds like the
  web app does.

## 1.6 Open questions — need a product/owner decision before Phase 5 (Auth) starts

These are not implementation details; they change what the Android app can honestly
promise a user, so they should be confirmed with whoever runs the Cloudflare Worker,
not assumed:

1. **Registration**: is `hosting/worker.js` actually the live Worker at nfcstore.uz
   today, or has registration since been ported in a newer, un-committed revision?
   (The comment says "not yet ported" as of the last commit touching this file — repo
   state may already be stale here too.) If registration truly is down, should the
   Android app (a) hide Register and support Login-only for v1, or (b) still build the
   Register screen fully so it "just works" the moment the backend catches up?
2. **Payments**: `/api/settings/payments-enabled` is the runtime source of truth and
   currently reads `false` in every code path inspected (`paymentsEnabledD1()`).
   Confirm this is still accurate for production right now, since it changes what the
   Purchase/Auction-bid/Company-payment screens can actually do on launch day (full
   premium UI either way, but CTAs must show a real "to'lovlar hozircha yopiq" state
   rather than a stub).
3. **Physical NFC card**: intentionally unsupported end-to-end (`501`). Confirm the
   Android app should omit this entirely from Phase 7 (Purchase) rather than build a
   dead-end flow.
4. **Push notifications**: there is no push infrastructure anywhere in this repo
   (§ confirmed by grep — no APNs/FCM/webpush code, no `notifications` table). The
   in-app "Bildirishnomalar" screen is a client-side aggregation of 3 read endpoints
   (gift offers, support replies, pending-auction wins) — not a real notification
   feed. Per the brief's own instruction ("agar backend push tayyor bo'lmasa fake
   notification backend yaratma"), Android Phase 9 will mirror this same
   client-side-aggregation pattern and ship the FCM/notification architecture
   *dormant* (ready wiring, no fake server). Confirm this matches expectations.
5. **D1/R2 direct access**: none needed or wanted — Android talks to the Worker's
   REST surface only, exactly like the web app. No native D1/R2 SDK, no service
   credentials in the APK. Flagging this explicitly since the original brief mentions
   D1/R2 — the app must never touch them directly.

## 1.7 Non-negotiables re-confirmed after reading the code (not just the brief)

- No web/backend file will be modified by the Android work. Verified nothing in
  `src/`, `server/`, `hosting/`, `db/`, `migrations/` was touched to produce this
  audit.
- No production data was read or written; all information above came from static
  source review.
- Pricing, tier and payment logic are read-only inputs to the Android UI — the
  Worker remains the sole authority for money-moving decisions.
