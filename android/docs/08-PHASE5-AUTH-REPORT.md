# Phase 5 — Auth: Report

## Nima qilindi

- **Session bootstrap**: `App.tsx` now calls `authStore.bootstrap()` (→
  `GET /api/auth/me`) once on startup and `authStore.refresh()` on every
  app-foreground (`AppState` listener), alongside the same pattern for
  `paymentsEnabledStore.refresh()` — both single sources of truth are wired
  exactly where android/docs/03-ARCHITECTURE.md §3.3 specified, not fetched
  ad hoc from individual screens.
- **Splash**: watches `authStore.status`; `RootNavigator` swaps the entire
  stack to `MainTabs` the instant `status === 'authenticated'`, and Splash
  itself hands off to Login once resolved to `'guest'`.
- **Login**: real form (email/password), client-side validation mirroring
  the server's own rules (email shape, 6-char minimum) for instant feedback,
  real `POST /api/auth/login` call through `authStore.login`, and the real
  server error message rendered on failure (via `ApiError` → the
  `ERROR_COPY` table) — no placeholder copy.
- **Register**: fully built (email/phone/password form, validation, a real
  wired call to `POST /api/auth/request-register-code`) but its CTA is
  gated behind `REGISTRATION_LIVE = false` (`src/config/remoteFlags.ts`),
  with an honest "vaqtincha mavjud emas" banner and a pointer back to
  Login — per android/docs/01-AUDIT.md §1.6 item 1 and this instruction's
  own "fake backend yaratma" requirement. Flipping that one flag is the only
  change needed once the backend is confirmed live; no mock/fake
  registration path was written to paper over it.
- **Settings**: real logout wiring (`POST /api/auth/logout` via
  `authStore.logout`, behind a PremiumModal confirmation), plus the row
  inventory from mockup screen 13 routed to their real destinations where
  built (Notifications, NFC o'qish, Profile Edit) and left honestly
  non-interactive where not yet built, rather than dead-ending.
- **Bug found and fixed during testing** (not shipped and forgotten): the
  double-submit de-dupe guard in `api/client.ts` chained a bare
  `.finally()` off the in-flight request promise, which re-throws on
  failure into an *unobserved* promise — a real unhandled-rejection crash
  risk on every failed purchase/bid/follow/etc. call. Caught by a new unit
  test (`client.test.ts`), fixed with an explicit swallowed `.catch()` on
  the cleanup-only promise while preserving the real rejection for the
  original caller.
- Added `src/__tests__/client.test.ts`: verifies the error-code → Uzbek-copy
  mapping against a mocked `fetch`, and **proves** (not just claims) the
  double-submit guard by asserting two concurrent calls with the same
  `dedupeKey` hit the network exactly once.
- Added a Jest manual mock for `@react-native-cookies/cookies`
  (`__mocks__/@react-native-cookies/cookies.js`) — the real native module
  throws at import time outside a linked native runtime, which is expected
  and not a bug; mocking it is the correct way to keep `api/client.ts` unit
  -testable under Jest.

## Files changed

`android-app/App.tsx` (bootstrap wiring), `src/screens/auth/{Splash,Login,
Register}Screen.tsx`, `src/screens/profile/SettingsScreen.tsx`,
`src/screens/shared/ScreenWithHeader.tsx` (new — avoids nesting two
`SafeAreaView`s on header+scroll screens), `src/config/remoteFlags.ts`
(new), `src/api/client.ts` (bug fix), `src/__tests__/client.test.ts` (new),
`__mocks__/@react-native-cookies/cookies.js` (new), `eslint.config.js`
(jest globals for test/mock files, and turned off two rules that are
real false positives in this codebase — `react-hooks/immutability` against
Reanimated's intentionally-mutable `SharedValue.value`, and
`react/no-unescaped-entities`, a web-HTML rule that doesn't apply to
React Native `<Text>` and would otherwise fire on nearly every Uzbek string
in the app). Nothing under `src/`, `server/`, `hosting/`, `db/`, or
`migrations/` was touched.

## Verified (honestly)

- `npx tsc --noEmit` → 0 errors.
- `npx eslint . --ext .ts,.tsx` → 0 problems.
- `npx jest --ci` → **27/27 tests pass** (23 from Phase 4 + 4 new, including
  the double-submit proof and the error-copy contract test).

## NOT verified — the plan's actual Phase 5 risk is still open

The implementation plan named this phase's real goal as: *"build & **device-
test** the cookie-jar networking layer... this is the phase where the
project's biggest risk gets resolved or a fallback native module gets
built."* That device test **cannot happen in this sandboxed session** — no
Android SDK, emulator, or physical device is available here (confirmed in
the Phase 4 report). What Phase 5 delivered here is the *code* for that
layer (`src/native/cookies.ts`, wired through `api/client.ts`'s
`credentials: 'include'` fetch calls) and everything that's unit-testable
about it — the error handling, the de-dupe guard, the store logic. The
actual question the plan cares about — does `nfc_session` survive a real
app kill+relaunch on a real Android build — is **unanswered** and stays
flagged as this project's top open risk until it's run on a real device.
This is stated plainly rather than glossed over.

## Next phase

Phase 6 — Home: wire the dashboard (My IDs, live Auctions, Company summary)
to `GET /api/auth/me` (cards already come back from the Phase 5 bootstrap
call — no extra request needed), `GET /api/auctions`, `GET /api/companies/
mine`, with real empty states for a brand-new account. Continuing now.
