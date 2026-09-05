# Phase 8 — Auction: Report

## Nima qilindi

- **AuctionListScreen**: real 4-tab implementation (Jonli/Yaqinda/Tugagan/
  Meniki), each tab backed by real data with **two honest re-mappings**
  documented in code, not silently invented:
  - **"Yaqinda" (upcoming)** — there is no "scheduled/upcoming auction"
    concept anywhere in the live API. Mapped instead to the real demand
    board (`GET /api/auction-demand`, `POST /api/auction-demand/:id/vote`)
    — users voting an ID toward auction, with a live `interestCount/
    threshold` readout and a working vote button.
  - **"Meniki" (mine)** — there is no "my full bid history" endpoint
    anywhere in the API. Mapped to the real, meaningful subset that does
    exist: `GET /api/auctions/won/pending` (auctions won and still owed
    for), with a "To'lash" CTA into the payment screen.
  - "Jonli" and "Tugagan" map directly to `GET /api/auctions` (active) and
    `GET /api/auctions?withSold=1` (`.sold`).
  - `FlashList` (Shopify) used for all 4 tabs' rows, per brief §18's list-
    virtualization requirement.
- **AuctionDetailScreen**: polls `GET /api/auctions/:id` every 4s while
  `status === 'active'` (no WebSocket/SSE exists anywhere in this backend —
  confirmed during the audit), live countdown via `AuctionCountdown`, real
  bid history list. The "Taklif berish" CTA reads `paymentsEnabledStore`
  and is **honestly disabled with a real banner** while payments are off
  (today's actual state) instead of opening a bid sheet that's guaranteed
  to 503 — matching the same pattern used in Phase 7's purchase flow. When
  enabled, the bid-confirm `PremiumSheet` has a minimum-bid check, haptic
  feedback, and a real `POST /api/auctions/:id/bid` call with a
  timestamp-based idempotency key (mirrors the web app's own double-submit
  guard).
- **AuctionPaymentScreen**: real form (name/phone) wired to
  `POST /api/auctions/:id/pay`, same honest-disabled treatment while
  payments are off.
- New composite: `AuctionListCard.tsx` — deliberately **omits** a
  participant-count stat the mockup shows, because `GET /api/auctions`
  (the list endpoint) doesn't return one — only the detail endpoint's
  `bids` array does, which is shown as a real count on the detail screen
  instead of a fabricated number on every list row.

## Files changed

`src/screens/auction/{AuctionList,AuctionDetail,AuctionPayment}Screen.tsx`
(real implementations, replacing Phase 4 stubs), `src/composites/
AuctionListCard.tsx` (new), `src/hooks/useAuctionDemand.ts` (new). Added
`@shopify/flash-list` as a dependency. Nothing under `src/`, `server/`,
`hosting/`, `db/`, or `migrations/` was touched.

## Verified

- `npx tsc --noEmit` → 0 errors.
- `npx eslint . --ext .ts,.tsx` → 0 problems.
- `npx jest --ci` → 30/30 tests still pass (no regressions).
- Not verified: real-device polling/countdown feel, FlashList scroll
  performance, and the actual bid/pay round-trip against a live session —
  same standing sandbox limitation as every phase so far (no Android
  runtime available here).

## Next phase

Phase 9 — Personal Profile: My Profile / NFC Profile View (the brief's
"most premium" screen), Profile Edit with Live Preview, the three-way music
player (YouTube/Yandex/file — all real, no shortcuts), full Android contact
-save permission flow, follow/unfollow, and the sticky "KONTAKTNI SAQLASH"
CTA. Continuing now.
