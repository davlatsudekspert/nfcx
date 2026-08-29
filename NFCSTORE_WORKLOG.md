# NFCSTORE.UZ — Worklog

Date: 2026-08-29

## Safety and baseline

- Confirmed original project at `D:\nfcx.uz`.
- Confirmed empty target `D:\NFCSTORE_GPT_DEVELOPMENT`.
- Copied and verified the project: 12,840 files, 114,291,628 bytes.
- Original was not edited.
- Preserved five pre-existing working-tree changes in `server/db.js`, `server/index.js`, `AccountPage.jsx`, `HowItWorksPage.jsx` and `ProfilePage.jsx`.
- Found no lint, typecheck or automated test scripts.
- Found `xlsx@^0.18.5` declared but missing from the copied `node_modules`.
- Removed an accidental zero-byte root file named `npm` from staging; it shadowed the real Windows `npm.cmd` command.
- Direct writes/builds on D: were blocked by a Windows Codex sandbox ACL refresh error even after the user granted session permission. Work continued in the documented C: staging copy; an exact sync patch is produced separately.

## P0 audit findings

1. Paid NFC IDs were created immediately without payment when Payme credentials were absent.
2. Public catalog API returned full profile records, including phones and payment card fields.
3. Single public profile API did not select `hide_phone`, so a hidden phone could leak.
4. Public profile API returned payment card numbers.
5. Gift activation called `createSession` with reversed arguments and no TTL.
6. Public Profile rendered a verification check without a real verification model.
7. Admin login bypassed 2FA when both TOTP and `ADMIN_CHAT_ID` were unavailable.
8. Admin router was mounted before shared security headers.
9. Auction bidding/expiry could continue while settlement payments were unavailable.

## Implemented security and business fixes

- Added backend `paymentsEnabled()`: explicit env flag plus valid Payme configuration.
- Defaulted all new paid flows to `payments_disabled`.
- Kept free profile/free ID reservation working.
- Paused new auction bids and automatic auction settlement while payments are disabled.
- Removed the dangerous payment-free paid-ID development fallback.
- Added a frontend `PAYMENTS_ENABLED=false` feature flag.
- Replaced active Payme CTAs with disabled “Tez orada” states in reservation, premium, physical-card and auction UI.
- Kept payment history readable and labeled new payments as temporarily disabled.
- Reduced the public catalog SQL projection and HTTP response to safe display fields.
- Added `hide_phone` to single-record selection and enforced server-side hiding.
- Always stripped payment card numbers from the public single-record contract.
- Fixed gift activation session creation to `createSession(token, user.id, SESSION_TTL_MS)`.
- Changed admin 2FA from fail-open to fail-closed.
- Moved admin router mounting after common security headers.

## Product and UX changes

### Home

- Reframed NFCSTORE as a networking and digital identity platform.
- Added a primary “Bepul profil yaratish” CTA and secondary “Qanday ishlaydi”.
- Added a clear profile → NFC tap → contact-save three-step journey.
- Moved custom-ID lookup into an explicitly optional role.
- Removed outdated resale-first copy.
- Replaced pricing-heavy hero stats with product-benefit stats.
- Simplified desktop primary navigation and fixed the tablet breakpoint.

### Public Profile

- Removed the unearned verification checkmark.
- Moved avatar, name, role and bio above secondary product visuals.
- Promoted “Kontaktga saqlash” to the primary, full-width CTA.
- Added a native-share secondary CTA with clipboard fallback.
- Brought phone/email into the first-screen contact area.
- Added LinkedIn and website links.
- Removed public payment-card UI.
- Moved physical NFC card preview below the digital profile.
- Raised important touch targets to at least 44px.
- Corrected VCF escaping and standards fields.
- Delayed blob URL revocation for mobile browser compatibility.

### Account

- Added a horizontal responsive dashboard navigation: Hisob, Profil, Bildirishnomalar, Xabarlar, To'lovlar, Sozlamalar.
- Clearly marks disabled messaging/payment-dependent actions.

### Cross-cutting

- Corrected title/description metadata and the 3-letter + 3-digit description.
- Added canonical, robots, theme-color and social metadata.
- Added visible keyboard focus and `prefers-reduced-motion` support.
- Updated FAQ copy so payment card numbers are not advertised as public profile content.
- Added explicit payment feature-flag documentation to `.env.example`.
- Rewrote Uzbek marketing copy around the user value of one digital profile instead of NFC mechanics.
- Removed “tegish”, “tekkizish” and “bir tegishda” from Uzbek user-facing copy.
- Limited “yaqinlashtiring” to the dedicated NFC explanation flow.
- Updated Home, How It Works, Companies, FAQ, reservation copy and SEO/social metadata consistently.

## Railway readiness

- Confirmed the checkout is a Git repository on `main` with `origin` set to `davlatsudekspert/nfcx`.
- Updated `railway.json` from Nixpacks to Railpack and the current schema URL.
- Added an explicit `npm run build`, `npm start` and `/api/health` deployment contract.
- Added `RAILWAY_DEPLOY.md` with repository scope, PostgreSQL, variables and upload persistence instructions.
- Verified a production build with 732 modules after the copy changes.
- Started the server with a Railway-style injected `PORT`; `/api/health` returned `{ "ok": true, "db": false }` without a configured local database.
- GitHub push remains pending because the current browser/CLI session is not authenticated to GitHub.

## Performance work

- Converted secondary routes to `React.lazy` and `Suspense`.
- Lazy-loaded the Card Designer from Account and Reserve Modal.
- Production build before route splitting: main JS about 922.10 KB (274.68 KB gzip).
- Production build after route splitting: main JS about 317.10 KB (103.74 KB gzip).
- Admin is isolated in a separate ~455.42 KB chunk.

## Verification evidence

- `node --check`: `server/index.js`, `server/db.js`, `server/admin.js` passed.
- esbuild parser: all 44 frontend JS/JSX files passed.
- Vite production build: 732 modules transformed, success.
- Git whitespace check: passed.
- Browser console: no errors or warnings during tested routes.
- Core lazy routes: Home, FAQ and Public Profile rendered successfully.
- Responsive visual QA:
  - 320px Home: primary CTA and optional ID search readable.
  - 320px/375px Public Profile: identity, save-contact CTA, phone and email visible; no horizontal overflow.
  - 768px Home: an initial 221px header overflow was detected, fixed and retested with no overflow.
  - 1440px Home: desktop navigation and hero rendered with no overflow.

## Current delivery constraint

The code is complete and verified in the staging copy. The Windows sandbox still prevents any process from writing to `D:\NFCSTORE_GPT_DEVELOPMENT`. An exact patch between the D: development copy and staging is included in the user-facing outputs. GitHub/Railway publication also requires the user to authenticate GitHub in the available browser session and grant the Railway GitHub App access to `davlatsudekspert/nfcx`; original `D:\nfcx.uz` remains untouched.
