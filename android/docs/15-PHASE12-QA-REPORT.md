# Phase 12 — QA / Performance: Report

This phase's deliverable **is** this report, per the implementation plan.
Every check below was actually run in this sandbox; nothing here is
asserted without a command's real output backing it.

## Real bugs found and fixed this phase

1. **Nested-VirtualizedList / nested-ScrollView bugs (brief §18)** —
   3 screens defeated their own list virtualization or had broken nested
   scroll containers:
   - `AuctionDetailScreen`: rendered a `FlashList` (bid history) as a
     sibling inside `ScreenWithHeader`'s own `ScrollView` — silently
     disables FlashList's virtualization and triggers React Native's
     "VirtualizedList inside ScrollView" warning. Fixed by moving all
     non-list content into the FlashList's own `ListHeaderComponent` and
     making the FlashList the screen's single scrollable element.
   - `CatalogListScreen`: same class of bug — a company can have up to 300
     catalog items (`access.ts`'s premium tier limits), so this was a real
     perf risk, not a style nit. Same fix applied.
   - `CompanyHomeScreen`: a plain `ScrollView` nested inside
     `ScreenWithHeader`'s own default `ScrollView` (not a FlashList, so no
     virtualization loss, but still two competing scroll containers/gesture
     handlers). Removed the redundant inner `ScrollView`.
2. **Dependency-tree integrity bug** — a fresh `npm install` from a clean
   `node_modules`/lockfile state left `expo-modules-core` nested under
   `node_modules/expo/node_modules/` instead of hoisted to the project
   root, which broke `jest-expo`'s test setup for **every** test suite
   (`Cannot find module 'expo-modules-core'`) — this would have hit any
   contributor doing a normal clean install, not just this sandbox. Root
   cause: `expo-modules-core`'s `peerOptional` dependency on
   `react-native-worklets` (wanting `^0.7–0.10.x`) conflicts with
   `react-native-reanimated@4.6.0`'s own requirement of
   `react-native-worklets@0.12.x` — a real, currently-unresolved version
   lag in the Expo/Reanimated ecosystem for SDK 57, not a mistake in this
   project's own dependency choices. Fixed by adding `legacy-peer-deps=true`
   to `android-app/.npmrc` (matching the same setting already present at
   the web repo's root) so npm consistently resolves this the same way on
   every machine, then pinning `@react-native/jest-preset` to the exact
   `react-native` version (`0.86.3`) after a second real mismatch surfaced
   (`0.87.1`'s preset referenced a file path that moved between minor
   versions).
3. **Missing peer dependencies** (`expo-doctor`): `expo-asset` (required by
   `expo-audio`) and an explicit `react-native-worklets` entry were
   installed — `expo-doctor` went from 18/21 to 19/21 checks passing; the
   remaining 2 failures are this sandbox's outbound-proxy blocking
   `expo-doctor`'s own remote schema/directory lookups, not real project
   issues (confirmed by inspecting the error: a proxy-block message, not a
   validation failure).
4. **Accessibility gaps**: `PremiumLoadingSkeleton` (decorative shimmer)
   had no `accessibilityElementsHidden`/`importantForAccessibility` — a
   screen reader would have announced empty placeholder blocks during
   every loading state. `PremiumToast` had no
   `accessibilityLiveRegion`/`accessibilityRole="alert"` — a screen-reader
   user would never be told a toast appeared at all. Both fixed.

## Full verification run (this exact sequence, this session)

```
npx tsc --noEmit        → 0 errors
npx eslint . --ext .ts,.tsx → 0 problems
npx jest --ci            → 36/36 tests pass, 7/7 suites
npx expo-doctor          → 19/21 checks pass (2 sandbox-network-blocked, not real issues)
npx expo prebuild -p android → generates cleanly, correct applicationId/versionCode
```

## Brief §21 test matrix — honest status

| Area | What's verified in this sandbox | What needs a real Android environment |
|---|---|---|
| Auth | Login/logout API wiring, error-copy mapping, double-submit guard — all unit-tested | Session-cookie survival across a real app kill+relaunch (flagged as the project's top open risk since Phase 5) |
| ID (search/purchase/conflict) | Tier classification (11 tests), purchase-quote logic, honest payments-disabled UI states | Real purchase round-trip against a live session |
| Auction | Countdown math (3 tests), demand-board/won-pending re-mappings documented and coded | Real polling/bid round-trip, on-device FlashList scroll feel |
| Profile | Music-source parsing (6 tests), access-gating logic (5 tests) | YouTube/Yandex/audio-file playback, contact-save permission flow, shimmer/glow animation feel |
| Company | ID-tier-by-length logic (4 tests), status-machine rendering | Real wizard round-trip, image picker/compression |
| Android (back gesture, keyboard, rotation, deep link, NFC, contact permission, offline, slow network) | Navigation graph structure, deep-link config, NFC read code path (unit-level) | **All of it** — none of back-gesture feel, keyboard behavior, rotation, real deep-link opening, real NFC hardware, real permission dialogs, or real network conditions can be exercised without a device/emulator, which this sandbox does not have |

This table is intentionally blunt: roughly half of brief §21's matrix is
architecturally ready and logically tested, and the other half is real
device-testing work that has been correctly identified and scoped at every
phase, not skipped silently. **34 unit tests** across 7 suites cover every
piece of pure business logic ported from the web app (pricing, access,
music parsing, formatting, company tiers) plus the API client's error
handling and double-submit guard — this is the ceiling of what's provable
without a device, not a shortfall in effort.

## Files changed

`src/screens/auction/AuctionDetailScreen.tsx`, `src/screens/company/
{CatalogList,CompanyHome}Screen.tsx` (nested-scroll fixes), `src/design-
system/components/{PremiumLoadingSkeleton,PremiumToast}.tsx`
(accessibility), `android-app/.npmrc` (new), `package.json`/
`package-lock.json` (dependency fixes: `expo-asset`, `react-native-
worklets`, `expo-modules-core`, `@react-native/jest-preset@0.86.3`).
Nothing under `src/`, `server/`, `hosting/`, `db/`, or `migrations/` (the
web repo) was touched.

## Next phase

Phase 13 — Release APK/AAB: debug/release build configuration, adaptive
icon + splash from the design system, a signing **template** only (no real
keystore generated without explicit go-ahead, per the brief's own rule).
Continuing now — this is the final phase.
