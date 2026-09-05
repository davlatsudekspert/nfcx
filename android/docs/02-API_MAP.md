# PHASE 2 — API Map (production contract: `hosting/worker.js`)

Base URL: `https://nfcstore.uz` (no separate API host/port — same origin as the web
app; Worker also serves the SPA and `/uploads/*`).

Legend: 🟢 live in `hosting/worker.js` today · 🔴 falls through to dead legacy proxy
(returns `503 api_upstream_unavailable`) as of the audited revision — **re-verify
before relying on it (see Phase 1 §1.6, item 1)**.

All request/response field names below are copied from the actual code, not
paraphrased, so the TypeScript API client in Phase 3 can be generated directly from
this document.

## 2.1 Auth — cookie session, not bearer token

| | Method | Path | Auth | Notes |
|-|--------|------|------|-------|
|🟢| POST | `/api/auth/login` | — | body `{ email, password }`. `email` regex-validated, `password.length>=6`. 401 `bad_credentials`, 403 `account_deleted`/`account_suspended` (+`suspendedUntil`,`reason`). 200 `{ user:{id,email} }` **+ Set-Cookie `nfc_session`** (HttpOnly, SameSite=Lax, Secure, 30d). |
|🟢| POST | `/api/auth/logout` | cookie | 200 `{ ok:true }` + cleared cookie. |
|🟢| GET | `/api/auth/me` | cookie (optional) | 200 always: `{ user: {...} \| null, cards: Record[] }`. No cookie/expired → `{user:null, cards:[]}`. This is the **app's "am I logged in" bootstrap call** on every cold start. |
|🔴| POST | `/api/auth/register` | — | body `{ email, password, ...extra }`. **Not ported** — needs Telegram OTP flow below. |
|🔴| POST | `/api/auth/request-register-code` | — | body `{ phone }` — sends Telegram OTP. **Not ported.** |

`user` object shape (from `getCurrentUser`, `hosting/worker.js:1275`):
`{ id, email, phone, isPremium, bannedUntil, strikeCount, promoCode,
pendingDiscountPct, suspendedUntil, deletedAt }`.

## 2.2 Records — NFC ID / digital profile card

| | Method | Path | Auth | Notes |
|-|--------|------|------|-------|
|🟢| GET | `/api/records` | — | Public catalog, `hidden_from_directory=0`, limit 500, newest first. Returns catalog-safe fields only (no phone/card numbers). |
|🟢| GET | `/api/records/search?q=` | — | `q.length>=2` else `{records:[]}`. Searches code/name/role/city/email/phone/tg/hashtags, limit 60. |
|🟢| GET | `/api/records/:code` | optional | Full profile if public; `hidePhone` strips `phone` for non-owners; `cardNumber(s)` always stripped. 404 if not found. |
|🟢| PUT | `/api/records/:code` | owner only | Update profile fields. 401/403/404 as appropriate. ⚠️ tier/feature gating from `access.js` is **not yet enforced server-side** (code comment, `hosting/worker.js:2405`) — the Android client MUST enforce `access.js` rules in the UI anyway (gray out gated fields) as defensive, honest UX, since the server currently trusts the owner. |
|🟢| POST | `/api/records/:code` | required | **Purchase/reserve flow.** `RESERVED_CODES` block list. `physicalCard:true` → `501 physical_card_not_supported_yet`. Price computed server-side via `personalPurchaseQuote(code)` — 409 if not purchasable/exclusive. 409 `already_taken`. 503 `payments_disabled` if payments are off. 409 `reserved_pending_payment` if a pending order already exists for that code (race-safe, atomic). Success → `202 { pending:true, orderId, code, price, payLink }` (`payLink` = Payme checkout URL). |

`Record` shape (`RECORD_COLUMNS` / `rowToRecord`): code, name, role, avatarUrl, bgUrl,
phone, email, tg, whatsapp, website, hashtags[], theme, price, ts, views,
profileType, city, categorySlug, verified, tierOverride, extraLinks, cardDesign,
hidePhone, isPrimary, plus (owner-only) cardNumbers (always stripped in transit).

## 2.3 Orders — Payme order status polling

| | Method | Path | Auth | Notes |
|-|--------|------|------|-------|
|🟢| GET | `/api/orders` | required | Last 20 orders for the user: `{ orders:[{id,code,kind,price,status,createdAt}] }`. Not logged in → `{orders:[]}` (not 401). |
|🟢| GET | `/api/orders/:id` | required | `{ id, code, status, price }`. 404 if not found or not owned (never reveals existence to non-owner). |
|🟢| POST | `/api/pay/payme` | Payme webhook | Server-to-server callback, not called by the app directly. |

Order `status` values to design UI states around: pending → paid/cancelled/expired
(confirm exact enum with backend owner; not fully enumerated in the audited slice).

## 2.4 Auctions

| | Method | Path | Auth | Notes |
|-|--------|------|------|-------|
|🟢| GET | `/api/auctions?withSold=1` | — | Active auctions (`status='active'`, ends_at asc, limit 200); `withSold=1` adds last 40 sold. |
|🟢| GET | `/api/auction-demand` | optional | "Vote for an ID to go to auction" board — `{ demand:[...], threshold }`. Each item: id, code, status(`collecting/ready/auction_live/hidden`), interestCount, auctionId, createdAt, voted (if authed), auctionCurrentPrice, auctionEndsAt, auctionStatus. |
|🟢| POST | `/api/auction-demand/:id/vote` | required | One vote per user (`INSERT OR IGNORE`); returns whether it just crossed `AUCTION_DEMAND_THRESHOLD` → `becameReady`. |
|🟢| POST | `/api/auction-requests` | required | User requests a specific code go to auction. 422 bad code / blocked, 409 `code_taken` / `ALREADY_PENDING`. |
|🟢| GET | `/api/auctions/:id` | optional | `{ auction, bids:[{id,auctionId,userId,amount,released,createdAt,bidderCode}] }`, bids sorted by amount desc. **This is the endpoint to poll for the live auction detail screen** — there is no WebSocket/SSE anywhere in this codebase (confirmed by search); real-time = polling this endpoint (see Phase 3 for interval + backoff design). |
|🟢| POST | `/api/auctions/:id/bid` | required | **Always returns `503 payments_disabled` today** (bidding requires the payment system). Build the full bid UI/confirmation sheet, but the empty-state/disabled-state copy must be real, not a guess. |
|🟢| POST | `/api/auctions/:id/pay` | required | Same — `503 payments_disabled`. |
|🟢| GET | `/api/auctions/won/pending` | required | `{ auctions:[{id,code,currentPrice,paymentDeadline}] }` — auctions the user won and still owes for. Feeds the Notifications screen. |

`Auction` row shape: id, code, status, currentPrice, suggestedStartPrice/MinStep (via
demand), endsAt, highestBidderId, paymentDeadline (see schema §2.9). **Timer must be
computed from `endsAt` (server timestamp), never a client-started countdown** — this
satisfies the brief's "server time sync, not a fake client timer" requirement.

⚠️ **Honest caveat, confirmed by direct code read of the web client**: the web app
itself computes remaining time as `endsAt - Date.now()` — i.e. against the *device's*
clock, with no server-time-offset exchange anywhere in this codebase. There is no
`/api/time` or `Date`-header-offset endpoint to sync against. Android should do the
same (`endsAt` minus device time) for parity, but this is a known limitation, not a
robust NTP-style sync — flag it rather than silently reproducing it as if it were a
deliberate design. Anti-snipe: a bid arriving in the auction's final minute extends
`endsAt` by 5 minutes server-side (inferred from web UI copy; confirm exact rule with
backend owner before hard-coding it into the countdown UI).

## 2.5 Companies (Company ID / business profile)

| | Method | Path | Auth | Notes |
|-|--------|------|------|-------|
|🟢| GET | `/api/companies/check?id=` | — | Availability + reserved/blocked/tier/price info for a candidate Company ID. |
|🟢| GET | `/api/companies/mine` | required | All companies owned by the user. |
|🟢| POST | `/api/companies` | required | Create. Body: `companyId, displayName, city, phone, description(>=20 chars), category, subcategory?, sourceCardCode?(prefill from an existing personal card), address?, telegram?, whatsapp?, website?, logoUrl?, coverUrl?`. 422 on validation, 409 `company_id_reserved`/`company_id_taken`. Starts life as `status:'pending_review'`. |
|🟢| GET | `/api/companies/:id` | optional | Full profile + catalog items if `status==='active'`; otherwise owner-only. |
|🟢| PATCH | `/api/companies/:id` | owner | Partial update of the same fields (+ `gallery[]`, up to 12 URLs). |
|🟢| POST | `/api/companies/:id/submit` | owner | Re-submit a `draft`/`rejected` company for review. |
|🟢| POST | `/api/companies/:id/payment` | owner | Requires `approved`/`payment_pending` status → **always `503 { error:'payments_backend_pending' }`** today (company Payme module not deployed yet). |
|🟢| POST | `/api/companies/:id/catalog` | owner | Create a catalog item (product/service/menu item — same table for all three, distinguished by the company's single fixed module, see `businessModule()` in `access.js`). Body: `name, price, promotionPrice?, category?, description?, imageUrl?, available?`. |
|🟢| PATCH | `/api/companies/:id/catalog/:itemId` | owner | Partial update. |
|🟢| DELETE | `/api/companies/:id/catalog/:itemId` | owner | Delete. |
|🟢| GET | `/api/companies/search?q=` | — | Public directory search (business profiles only). |
|🟢| GET | `/api/categories` | — | `{ categories:[{id,slug,parentSlug,nameUz,nameRu,nameEn,sort,enabled}] }`. |

Company status machine (from `COMPANY_STATUSES`/`setCompanyStatus`, cross-referenced
w/ `docs/COMPANY_SYSTEM_V2.md`): `draft → pending_review → approved → payment_pending
→ active`, or `rejected` at review. Company dashboard UI (Phase 10) must render exactly
this state machine — no invented intermediate states.

**Company ID tier/price is by ID *length*, not pattern** (`src/lib/company.js`, mirrored
server-side by `companyAvailability()`): 3 letters → Exclusive (990 000 so'm), 4-5 →
Premium (749 000), 6-7 → Gold (549 000), 8-15 → Silver (349 000). IDs are letters-only
(`normalizeCompanyId`). This is a **separate tier/price system from the personal NFC ID
tiers in §2.1's pricing note** — do not reuse `TIER_PRICE`/`tierFromCode` for the
company wizard's price step; port `company.js`'s own table.

There is also an **older, parallel, legacy catalog system** (`products`/`services`/
`menu_items` tables, CRUD under `/api/records/:code/(menu|products|services)*` in
`server/index.js`) tied directly to a personal/business *card* rather than to a
Company v2 `companies` row. Its port status in `hosting/worker.js` is **unconfirmed**
(only its like/view/promo reactions sub-feature — `catalog_item_reactions/views/
promotions` — is confirmed live, at `/api/catalog-meta/:code/items/:id/(view|reaction)`,
`hosting/worker.js:111-200`). **Android's Phase 10 (Company) targets the Company v2
system only** (`/api/companies/*`, §2.5 above) — the brief's "faqat mavjud backend
qo'llasa" rule means the legacy per-card catalog is out of scope unless its full CRUD
is separately confirmed live.

Company module assignment is **automatic, not user-chosen**: `food*` category → Menu
module, `retail*` → Products module, everything else → Services module (one company =
one catalog module — mirror `businessModule()` from `access.js` verbatim, do not let
the Android wizard offer a module picker the backend doesn't support).

## 2.6 Social — follow / gifts / referrals

| | Method | Path | Auth | Notes |
|-|--------|------|------|-------|
|🟢| POST | `/api/follow/:code` | required | 409 `CANNOT_FOLLOW_SELF` / `ALREADY_FOLLOWING`. Always free (no paid follow tier live). |
|🟢| POST | `/api/unfollow/:code` | required | Idempotent. |
|🟢| GET | `/api/follow-stats/:code` | optional | `{ followers, following, isFollowing }`. |
|🟢| GET | `/api/follow-list/:code?dir=followers\|following` | — | Public fields only: `code,name,avatarUrl,verified`. |
|🟢| GET | `/api/gift-offers` | required | `{ incoming:[...], outgoing:[...] }` — NFC ID gifting between users. |
|🟢| POST | `/api/gift-offers/:id/(accept\|reject\|cancel)` | required | Accept transfers card ownership atomically; 409 `OWNERSHIP_CHANGED` on race. |
|🟢| GET | `/api/referrals` | required | `{ referrals:[{id,createdAt,referredEmail}] }`. |
|🟢| GET | `/api/conversations/unread-count` | optional | `{ count }` — only the counter is ported, not the messaging thread UI. |

## 2.7 Public content / settings

| | Method | Path | Auth | Notes |
|-|--------|------|------|-------|
|🟢| GET | `/api/news` | — | `{ news:[...], liked:[newsId,...] }` (liked = per-visitor-hash, cookieless). |
|🟢| GET | `/api/tap/:chipToken` | — | Physical-card NFC tap validity check → `{ active, linkedCode }`. |
|🟢| GET | `/api/settings/physical-nfc-pricing` | — | Quantity tiers + delivery estimate (display-only; ordering itself is 🔴 not supported). |
|🟢| GET | `/api/settings/payments-enabled` | — | `{ enabled: boolean }` — **poll this at app start and cache briefly; drive every payment CTA's enabled/disabled state from it, never hard-code.** |

## 2.8 Uploads (R2)

| | Method | Path | Auth | Notes |
|-|--------|------|------|-------|
|🟢| POST | `/api/upload` | user | Body `{ dataUrl: "data:image/...;base64,..." }`. Images only, ≤700KB (≤3MB for gif). Returns `{ url:"/uploads/<file>" }`. |
|🟢| POST | `/api/upload-audio` | user | Same shape, audio mime allow-list, ≤10MB. |
|🟢| POST | `/api/upload-card-video` | user | Raw bytes (not base64/JSON) — `Content-Type` = video; ≤10MB; magic-byte sniffed (mp4/webm only). |
|🟢| GET/HEAD | `/uploads/*` | — | Full ETag/If-None-Match/304, Range/206, 416, 404 support — safe to point a React Native `<Image>`/video player straight at these URLs with normal HTTP caching. |

**Android upload strategy:** for photos, downscale + JPEG-encode client-side to fit
the 700KB cap *before* base64-encoding (avoids silent 413s on modern phone-camera
photos), show real upload progress, and use the video endpoint's raw-bytes contract
(not JSON) for card video.

## 2.9 Reference — D1 tables Android's data model must mirror

(from `db/d1-migration/0001-schema.sql`; only the ones the ported API surface above
actually touches): `users`, `sessions`, `cards`, `web_orders`, `auctions`, `bids`,
`auction_demand`, `auction_demand_votes`, `auction_requests`, `follows`,
`gift_offers`, `referral_uses`, `physical_cards`, `news`, `news_likes`, `categories`,
`companies`, `company_catalog_items`, `company_status_log`, `company_id_rules`,
`company_payments`, `admin_settings`. Everything else in the 54-table schema
(messages/conversations, posts, card_team, finance_*, admin_* audit tables, etc.)
belongs to features that are either admin-only or not yet exposed through the ported
Worker API — **do not design an Android screen around a table that has no live
endpoint.**

## 2.10 Error-code → user-facing copy contract (feeds Phase 5-10 error UX)

| HTTP | `error` body | Uzbek copy to show |
|------|--------------|---------------------|
| 401 | `unauthorized` / `bad_credentials` | "Email yoki parol noto'g'ri." |
| 403 | `account_suspended` | "Hisobingiz vaqtincha to'xtatilgan." (+ reason/date if present) |
| 403 | `account_deleted` | "Bu hisob o'chirilgan." |
| 409 | `already_taken` / `reserved_pending_payment` / `code_taken` | "Bu ID hozir band." |
| 409 | `ALREADY_FOLLOWING` / `ALREADY_PENDING` | inline no-op, no error toast |
| 422 | any `bad_*`/`*_required` | "Ma'lumotlarni tekshiring." + inline field error |
| 429 | `too_many_requests` | "Juda ko'p urinish. Biroz kuting." |
| 501 | `physical_card_not_supported_yet` | hide the option entirely — don't let the user reach this |
| 503 | `payments_disabled` / `payments_backend_pending` | "To'lovlar hozircha yopiq." (disabled CTA state, not an error toast) |
| 503 | `api_upstream_unavailable` / `d1_unavailable` / `core_api_unavailable` | "Xizmat vaqtincha mavjud emas." — generic retry banner |

Raw technical error strings are never shown to the user (brief §16); they go to a
debug-only log channel stripped from release builds (brief §17).
