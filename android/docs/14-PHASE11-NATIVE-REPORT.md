# Phase 11 — Native Integrations: Report

## Nima qilindi

- **NFC read screen** (`NfcReadScreen`): real foreground-dispatch NDEF read
  via the already-scaffolded `src/native/nfc.ts`, validated against the
  real `GET /api/tap/:chipToken` endpoint (android/docs/02-API_MAP.md
  §2.7) — a successful, linked read navigates straight to that profile's
  NFC Profile View. Added a genuine concentric-ripple animation (two
  staggered expanding/fading rings via Reanimated) while scanning, per
  brief §5's "NFC animation" line item — not a static icon.
- **Android App Links groundwork**: `android/docs/assetlinks.json.template`
  — the file `nfcstore.uz/.well-known/assetlinks.json` needs to carry once
  a real release keystore exists (android/docs/03-ARCHITECTURE.md §3.5/
  §3.11). Deliberately placed under `android/docs/`, **not** in the web
  app's `public/` folder — deploying it is a web-hosting change, out of
  scope for this Android-only work and against the brief's own "web/
  backendga tegma" rule. Whoever holds the release keystore's SHA-256
  fingerprint fills in the placeholder and deploys it separately.
- **Haptics audit pass**: every `PremiumButton` in the app already gets
  haptic feedback for free (centralized in the design-system component
  since Phase 4) — this phase's audit found and closed the real gaps: the
  three card composites that use a bare `Pressable` instead of
  `PremiumButton` (`NfcIdCard`, `AuctionListCard`, `AuctionPreviewCard`)
  had **no** haptic on tap — fixed with `haptics.selection()`. Added
  `haptics.success()` to `PurchaseResultScreen`'s paid state, mirroring the
  pattern already used in the auction-bid success path.
- **Push-ready architecture** (`src/native/push.ts`) — brief §15's own
  instruction ("agar backend push tayyor bo'lmasa fake notification
  backend yaratma") followed literally: permission request and Expo push
  token retrieval are real and callable, but the token is **not sent
  anywhere** — there is no endpoint to receive it (android/docs/
  01-AUDIT.md §1.6 item 4). The one piece that's genuinely unit-testable
  without a real push — `mapPayloadToDisplay()`, the notification→display
  mapping — is real, pure, and covered by 2 new tests using the same 5
  categories (`auction/payment/company/profile/system`) the web app's own
  in-app notifications use.
- **Biometric-ready stub** (`src/native/biometrics.ts`): availability
  check + an authenticate function, wired but called by no screen in v1,
  per the brief's own "ready architecture, not a shipped gate" framing.
  Built with `expo-local-authentication` (a first-party Expo module)
  instead of the community `react-native-biometrics` originally named in
  the architecture doc — better fit for this project's prebuild workflow,
  noted as a deliberate substitution, not a silent deviation.

## Files changed

`src/screens/profile/NfcReadScreen.tsx` (real implementation, replacing
the Phase 4 stub), `src/native/{push,biometrics}.ts` (new),
`src/__tests__/push.test.ts` (new), `android/docs/
assetlinks.json.template` (new), haptic additions to `src/composites/
{NfcIdCard,AuctionListCard,AuctionPreviewCard}.tsx` and `src/screens/id/
PurchaseResultScreen.tsx`. New dependencies: `expo-local-authentication`.
Nothing under `src/`, `server/`, `hosting/`, `db/`, or `migrations/` (the
web repo) was touched — including no changes to its `public/` folder.

## Verified

- `npx tsc --noEmit` → 0 errors.
- `npx eslint . --ext .ts,.tsx` → 0 problems (one hooks-order bug was
  caught and fixed here: a `useEffect` had been placed after an early
  `return` in `PurchaseResultScreen`, a real rules-of-hooks violation that
  would have crashed on the loading→loaded transition — moved above the
  return).
- `npx jest --ci` → **36/36 tests pass** (34 prior + 2 new
  `mapPayloadToDisplay` tests).
- Not verified, and this phase carries the most of it: an actual NFC read
  against real hardware, the ripple animation's on-device feel, Android
  App Link verification against a real deployed `assetlinks.json` and a
  real release keystore, and real push-token retrieval against a real Expo
  project ID — none of which are possible in this sandbox (no SDK,
  emulator, device, or release keystore).

## Next phase

Phase 12 — QA / performance: the full brief-§21 test matrix executed for
real where this sandbox allows (unit/lint/typecheck — already continuously
verified every phase) plus an explicit, honest accounting of everything
that needs a real Android environment (Detox E2E, on-device animation
perf, cold-start time, accessibility font-scale/reduced-motion checks).
Continuing now.
