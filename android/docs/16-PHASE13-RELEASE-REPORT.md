# Phase 13 — Release APK/AAB: Report

This is the final phase of android/docs/06-IMPLEMENTATION_PLAN.md.

## Nima qilindi

- **Real branded icon/splash assets**, generated from the design system's
  actual tokens (not the Expo template defaults the project started
  with): a gold gradient "N"-mark ring on `color.bgDeep`
  (`assets/icon.png`, 1024×1024), a matching transparent-background
  foreground layer for Android's adaptive icon (`android-icon-
  foreground.png`) with a single-color themed variant for Android 13+
  (`android-icon-monochrome.png`), and a splash mark
  (`splash-icon.png`) wired through the `expo-splash-screen` config
  plugin with the app's dark background. `scripts/generate-brand-
  assets.mjs` is the (re-runnable, one-off) generator — kept in the repo
  so the exact mark can be regenerated or adjusted later without needing
  a design tool, not a one-time hand-off artifact.
  - The native splash is deliberately minimal (mark + dark background
    only); the full branded "NFCSTORE" wordmark + tagline + loading bar
    from mockup screen 1 is the JS `SplashScreen` component built in
    Phase 5, which takes over the instant JS loads — this is the standard,
    correct division between a native splash and an in-app one.
- **Signing: a real, working template — not just a text file.**
  `plugins/withReleaseSigning.js` is a local Expo config plugin that wires
  a release `signingConfig` into the generated `android/app/build.gradle`
  automatically, reading credentials from a `keystore.properties` file at
  the **project root** (not inside the disposable, regenerated `android/`
  folder, so it survives `expo prebuild --clean`). **Both states were
  actually tested in this sandbox**, not just written and assumed:
  - No `keystore.properties` present (this repo's real, current state) →
    the plugin no-ops, `build.gradle` is generated completely untouched,
    both build types fall back to Android's default debug signing.
    Verified: `grep -c "nfcstore-release-signing-config"` → `0` after a
    fresh prebuild.
  - A (placeholder-credential) `keystore.properties` present → the plugin
    correctly injects the real `signingConfigs { release { ... } }` block
    reading from it. Verified by inspecting the generated `build.gradle`
    directly, then the test file was deleted (it held only placeholder
    values, never used to sign anything).
  - `keystore.properties.example` documents exactly how to generate a real
    keystore and where to put it — **no real keystore was generated**, per
    the brief's own explicit rule (§20) and this project's non-negotiables.
- **Build commands** added to `package.json`
  (`build:debug-apk`/`build:release-apk`/`build:release-aab`, each a thin
  wrapper over the standard `./gradlew assemble*`/`bundleRelease`
  commands the generated project already supports out of the box — no
  custom Gradle wiring was needed beyond the signing plugin above).

## What this phase could NOT do, and why

Every phase since Phase 4 has flagged the same standing limitation, and
this is the phase where it matters most: **this sandbox has no Android
SDK, no JDK 17 (only JDK 21 — confirmed back in Phase 4's `./gradlew
tasks` run, which failed specifically on a JDK-17-only toolchain
requirement), no emulator, and no physical device.** Concretely, this
means:
- No debug APK, release APK, or AAB was actually assembled — `./gradlew
  assembleDebug`/`assembleRelease`/`bundleRelease` were not run to
  completion (Phase 4 already reproduced and documented exactly why:
  Gradle resolves fine, but the React Native Gradle plugin's own Kotlin
  compilation needs a JDK 17 toolchain, and this session's outbound proxy
  blocks Gradle's `foojay` auto-provisioning fallback for one).
- No real device install/launch, so the app's actual startup, the native
  splash → JS splash handoff, the adaptive icon's real on-device
  appearance, and cold-start time are all unverified here.
- Google Play publishing was never attempted — out of scope per the
  brief's own §22 ("Play Storega joylama") independent of the sandbox
  limitation.

What **was** verified, honestly, in this exact sandbox:
```
npx expo prebuild -p android   → generates cleanly, every time this was run across 13 phases
grep applicationId/versionCode  → uz.nfcstore.app / 1 / "1.0.0", correct every time
find ic_launcher*.webp          → generated at every density (hdpi through xxxhdpi), incl. monochrome
npx tsc --noEmit                → 0 errors
npx eslint . --ext .ts,.tsx     → 0 problems
npx jest --ci                   → 36/36 tests pass across 7 suites
```

## Files changed

`assets/{icon,android-icon-foreground,android-icon-monochrome,splash-
icon,favicon}.png` (regenerated, replacing the Expo template defaults),
`scripts/generate-brand-assets.mjs` (new), `plugins/withReleaseSigning.js`
(new), `keystore.properties.example` (new), `app.json` (splash-screen
plugin + signing plugin registered), `package.json` (build scripts),
`.gitignore` (added `*.keystore`, `keystore.properties`). Nothing under
`src/`, `server/`, `hosting/`, `db/`, or `migrations/` (the web repo) was
touched, and — per every non-negotiable stated across all 13 phases — no
push to `main`, no deploy, and no Play Store submission was performed or
attempted.

## Where this leaves the project

All 13 phases from android/docs/06-IMPLEMENTATION_PLAN.md are complete.
The app is a real, coherent React Native + TypeScript codebase — 29 real
screens (no stubs remain), a 13-component premium design system, a typed
API client covering every confirmed-live endpoint in
android/docs/02-API_MAP.md, native NFC/contacts/haptics/push/biometric
integration code, and 36 passing unit tests — continuously verified with
`tsc`/`eslint`/`jest` at every single phase, with every found bug (7 real
ones, across Phases 5, 6, 9, 11, and 12) fixed and documented rather than
glossed over. The one thing no phase could do, and every phase said so
plainly, is produce a device-verified build: that step needs a real
Android SDK + JDK 17 + a device or emulator, none of which exist in this
sandboxed session. Handing this repository to a developer with a normal
Android development machine, running `npm install && npx expo prebuild -p
android && npm run build:debug-apk`, is the very next, and last, step.
