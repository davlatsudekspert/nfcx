# Phase 7 — ID Purchase: Report

## Nima qilindi

- **IdSearchScreen**: real sales-funnel entry point. Typing a candidate
  6-char code gets an instant local tier/price preview (ported
  `pricing.ts`, no network) plus a **real** availability check
  (`GET /api/records/:code` — 404 = available, 200 = taken, showing the
  existing owner's name). A "Mashhur namunalar" (popular examples) chip row
  pre-fills the input — documented explicitly as illustrative, **not** a
  live "browse available IDs" fetch, because no such endpoint exists
  anywhere in the API (android/docs/02-API_MAP.md confirms this) — nothing
  was invented to fill that gap.
- **3-step purchase wizard**, matching brief §7 exactly:
  - Step 1 — ID recap + minimal profile form (name required, role/phone
    optional).
  - Step 2 — review/confirm. Reads `paymentsEnabledStore` and keeps the
    Confirm CTA **honestly disabled with a real "to'lovlar yopiq" banner**
    when payments are off (which is the actual, current production state
    per android/docs/01-AUDIT.md), rather than firing a network call
    guaranteed to 503. Calls the real `POST /api/records/:code` when
    enabled.
  - Step 3 — payment. **Only Payme is wired to a real link** (`payLink`,
    opened via `Linking.openURL`); Click/Karta/Bank from the mockup are
    shown as visually-present, explicitly-disabled "Tez orada" rows — they
    have no backing endpoint anywhere in `hosting/worker.js`, confirmed
    during the Phase 1 audit, so wiring them to anything would have been
    fabricating a feature. Polls `GET /api/orders/:id` every 3s while
    `status === 'pending'` and auto-advances to the result screen on
    `'paid'`.
  - Result — real order-status-driven UI: a genuine stroke-draw
    success-check animation (`SuccessCheck.tsx`, SVG
    `strokeDasharray`/`strokeDashoffset` via Reanimated, not a static icon
    swap) for `paid`, a distinct "to'lov kutilmoqda" state for `pending`,
    and a failure state otherwise — "Profilni sozlash" / "Bosh sahifaga
    qaytish" CTAs per mockup screen 10.
- Extended `IdStackParamList.PurchaseStep2` to carry a typed
  `DraftPurchaseProfile` between steps (no ephemeral global state needed
  for a 3-field form).
- New composite: `SuccessCheck.tsx` (stroke-draw circle + checkmark).

## Files changed

`src/screens/id/{IdSearch,PurchaseStep1,PurchaseStep2,PurchaseStep3,
PurchaseResult}Screen.tsx` (real implementations, replacing Phase 4
stubs), `src/composites/SuccessCheck.tsx` (new), `src/hooks/
useDebouncedValue.ts` (new), `src/navigation/types.ts` (typed draft-profile
param). Nothing under `src/`, `server/`, `hosting/`, `db/`, or
`migrations/` was touched.

## Verified

- `npx tsc --noEmit` → 0 errors.
- `npx eslint . --ext .ts,.tsx` → 0 problems.
- `npx jest --ci` → 30/30 tests still pass (no regressions; this phase's
  new code is UI-heavy rather than pure-logic, so it wasn't a place to add
  more unit tests beyond what `pricing.ts` already covers — a real
  React Native Testing Library pass on these flows is a Phase 12 QA item).
- Not verified: the actual purchase round-trip against a live
  `nfc_session` and a real Payme checkout page — both need a real device
  and, for the happy path, payments actually turned on, neither of which
  exist in this sandbox or in current production respectively.

## Next phase

Phase 8 — Auction: 4-tab list (Live/Yaqinda/Tugagan/Men qatnashgan), detail
screen with polling countdown, bid-confirm sheet honestly reflecting the
real `payments_disabled` 503 on every bid attempt today. Continuing now.
