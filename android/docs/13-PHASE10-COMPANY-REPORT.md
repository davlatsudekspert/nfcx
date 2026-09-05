# Phase 10 — Company: Report

## Nima qilindi

- **5-step Company create wizard**, matching brief §12: (1) Company ID with
  real live-availability polling (`GET /api/companies/check`) and a local
  ID-length tier/price preview (`companyTierForId`, ported from
  `src/lib/company.js` — a **separate** table from personal NFC ID pricing,
  covered by 4 new unit tests), (2) info form (name/category/city/phone/
  description ≥20 chars), (3) logo/cover upload (real image picker →
  client-side downscale+JPEG-compress → `POST /api/upload`, mirroring the
  same 700KB-limit awareness from Phase 9's contact-save work), (4) preview,
  (5) the actual `POST /api/companies` call — nothing is created
  server-side before this final step. The draft is threaded through all 5
  screens via typed navigation params (`DraftCompanyProfile`), not an
  ephemeral store.
  - ⚠️ **Open item, flagged in code, not silently guessed**: the exact
    `COMPANY_CATEGORIES` enum the Worker validates against was not
    extracted during the Phase 1 audit. Step 2 ships a reasonable
    placeholder category list — safe regardless, since only `food`/`retail`
    change the auto-selected catalog module and every other slug falls into
    "services" either way — but should be confirmed against the real
    server-side enum before release.
- **CompanyHomeScreen**: real list (`GET /api/companies/mine`) with a
  status badge per company, or an empty state with the create CTA.
- **CompanyDashboardScreen**: renders the **real status machine only**
  (`draft → pending_review → approved → payment_pending → active`, or
  `rejected`) — `src/screens/company/statusLabels.ts` is the single source
  of truth for status copy, no invented intermediate states. Each state
  shows exactly the actions the API actually supports for it: `draft`/
  `rejected` → "Qayta yuborish" (`POST .../submit`); `approved` → "To'lovni
  boshlash" (`POST .../payment`, which is a real, confirmed **always-503**
  endpoint today — shown with an honest error banner, not a dead end);
  `active` → a link to the public page. A description-edit field
  (`PATCH /api/companies/:id`) demonstrates the update path without
  building a full duplicate of the create wizard's form.
- **CatalogListScreen**: full CRUD (`POST`/`PATCH`/`DELETE
  .../catalog(/:itemId)`) against the **single** catalog module the company
  is auto-assigned (via the ported `businessModule()` — never a user-facing
  module picker, matching the real 1:1 category→module mapping).
- **PublicCompanyScreen**: real public fetch, with the Worker's actual
  "non-owner sees 404 unless `status === 'active'`" behavior mirrored as an
  honest "sahifa faol emas" empty state rather than showing stale data.

## Files changed

`src/screens/company/*.tsx` (all real implementations, replacing Phase 4
stubs), `src/screens/company/statusLabels.ts` (new), `src/native/
imageUpload.ts` (new, shared pick+compress+upload helper), `src/
__tests__/companies.test.ts` (new, 4 tests). New dependencies:
`expo-image-picker`, `expo-image-manipulator`. Nothing under `src/`,
`server/`, `hosting/`, `db/`, or `migrations/` was touched.

## Verified

- `npx tsc --noEmit` → 0 errors.
- `npx eslint . --ext .ts,.tsx` → 0 problems.
- `npx jest --ci` → **34/34 tests pass** (30 prior + 4 new
  `companyTierForId` tests).
- Not verified: the real wizard round-trip against a live session, image
  picker/compression on a real device, and the exact `COMPANY_CATEGORIES`
  enum match — same standing sandbox limitation, plus the one open
  confirmation item called out above.

## Next phase

Phase 11 — Native integrations: NFC foreground-dispatch read screen (wired
to the already-built `src/native/nfc.ts` and `GET /api/tap/:chipToken`),
Android App Links verification groundwork, a haptics audit pass across
every interactive component, and the FCM-wired-but-dormant notification
architecture (no fake backend). Continuing now.
