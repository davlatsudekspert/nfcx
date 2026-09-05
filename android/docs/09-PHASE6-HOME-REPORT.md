# Phase 6 — Home: Report

## Nima qilindi

- **Real dashboard**, wired to live data, matching brief §6's 4-section
  cap exactly (no extra sections tucked in):
  - **A. Mening ID'larim** — horizontal carousel of the user's owned cards
    (from the Phase 5 session-bootstrap `cards`, no extra request) plus any
    `pending` `web_orders` (`GET /api/orders`, filtered client-side to
    `status === 'pending'`). Each card shows its real tier badge (ported
    `tierForCode`) and, for pending orders, a "Kutilmoqda" chip. See the
    honest note in `NfcIdCard.tsx`: the API has no confirmed third
    "reserved" state distinct from `pending` — the mockup's "reserved" chip
    is treated as a label variant, not an invented backend state.
  - **B. Yangi NFC ID** — full-width gold CTA to the ID tab.
  - **C. Auksion** — up to 3 live-auction preview cards
    (`GET /api/auctions`), each with a real `AuctionCountdown` computed from
    `endsAt` (device-time caveat carried over from the API map, not
    silently hidden).
  - **D. Kompaniya** — first owned company's name/id/status
    (`GET /api/companies/mine`) with a "Boshqarish" CTA, or an empty state
    with "Kompaniya ID yaratish" CTA.
  - A small stats row (ID count, pending count) — the only concession
    beyond the 4 sections, and it's a glance-only header, not new
    navigable content.
- Added 3 reusable composites (`src/composites/`): `NfcIdCard`,
  `AuctionPreviewCard`, `AuctionCountdown` — all reused as-is by later
  phases' full list screens (Phase 7/8), not Home-only throwaways.
- Added `useAuctionsPreview` / `useMyCompanies` React Query hooks
  (`src/hooks/`).
- **Cross-tab navigation is now fully typed**, no `as never` escape hatches:
  `MainTabParamList`'s tab entries changed from `undefined` to
  `NavigatorScreenParams<...Stack ParamList>`, so Home's notification bell
  jumping to `ProfileTab > Notifications`, or a pending-ID card jumping to
  `IdTab > PurchaseResult` with real params, are both type-checked end to
  end.

## Bug found and fixed during this phase

- `AuctionCountdown` originally called `Date.now()` directly inside the
  render body — caught by ESLint's React Compiler purity rule
  (`react-hooks/purity`), a real correctness smell (impure reads during
  render), not a style nit. Fixed by tracking `now` as state, updated only
  from the `setInterval` tick, so every value the render reads is a plain
  snapshot.
- `formatSom()` only stripped commas from `Number.toLocaleString('ru-RU')`,
  but that locale's real thousands separator is U+00A0 (non-breaking
  space) on Hermes/ICU — so every price on the whole app would have
  rendered with an invisible NBSP instead of a normal space. Caught by a
  new `format.test.ts`, fixed to strip NBSP/narrow-NBSP too.
- `PremiumCard`'s `children` prop was required, which made its own
  documented `loading` variant (used with no children, e.g.
  `<PremiumCard loading />`) a type error — loosened to optional.

## Files changed

New: `src/screens/home/HomeScreen.tsx` (real implementation, replacing the
Phase 4 stub), `src/composites/{NfcIdCard,AuctionPreviewCard,
AuctionCountdown}.tsx`, `src/hooks/{useAuctions,useMyCompanies}.ts`,
`src/__tests__/format.test.ts`. Modified: `src/navigation/types.ts`
(typed cross-tab params), `src/design-system/components/PremiumCard.tsx`
(optional children), `src/lib/format.ts` (NBSP fix). Nothing under `src/`,
`server/`, `hosting/`, `db/`, or `migrations/` was touched.

## Verified

- `npx tsc --noEmit` → 0 errors.
- `npx eslint . --ext .ts,.tsx` → 0 problems.
- `npx jest --ci` → **30/30 tests pass** (27 prior + 3 new `format.ts`
  tests covering the NBSP fix and countdown clamping).
- Not verified (same standing limitation as every phase so far): on-device
  rendering, scroll/carousel feel, and real API responses against a live
  `nfc_session` — no Android runtime available in this sandbox.

## Next phase

Phase 7 — ID Purchase: search-as-you-type against `/api/records/search`,
the 3-step purchase wizard, and the payment screen's honest
enabled/disabled state from `/api/settings/payments-enabled`. Continuing
now.
