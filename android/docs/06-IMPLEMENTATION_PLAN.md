# PHASE 6 — Implementation Plan

This is the roadmap for the 13 build phases the brief defines in its §23. Per the
brief's own rule ("BIR PHASE TUGAMASDAN KEYINGISIGA O'TMA" — don't start the next
phase before the current one is finished and reported), **this document is the plan
only** — Phases 1-13 below have not been started. Delivering docs 01-06 in this
folder *is* the brief's explicitly requested pre-flight step ("Avval FAQAT: repo
audit, API mapping, Android architecture, screen map, design system, implementation
plan ber"). Actual coding begins the turn after this plan is reviewed.

Every phase below ends with the exact report shape the brief demands (§23): nima
qilindi / files changed / screenshots / tests / next phase. None of these phases
touch `src/`, `server/`, `hosting/`, `db/`, or `migrations/` — everything lives under
the new `android-app/` folder (Phase 3 §3.2).

## Phase-by-phase

### Phase 1 — Audit ✅ (this delivery)
Deliverable: `android/docs/01-AUDIT.md` — the D1/R2-Worker-is-production finding, live
vs. not-ported endpoint inventory, auth model, pricing/access logic inventory, open
questions for the backend owner.

### Phase 2 — Architecture ✅ (this delivery)
Deliverable: `android/docs/03-ARCHITECTURE.md` — RN+TS+Expo-prebuild stack decision,
cookie-session networking design (the project's top technical risk), state layer,
navigation shape, native integrations, security/perf/testing approach.

### Phase 3 — Design System ✅ (this delivery)
Deliverable: `android/docs/05-DESIGN_SYSTEM.md` — tokens, 13 component contracts,
motion budget, accessibility rules.

### Phase 4 — Navigation
Scope: scaffold `android-app/` (Expo prebuild init, TS config, folder structure from
Architecture §3.2), install React Navigation, build the empty shell for all 29
screens from `04-SCREEN_MAP.md` as stub screens wired into the real navigation graph
(tabs + stacks + deep-link config), no real data yet. Ship the bottom-tab bar and
PremiumHeader for real. **First point where a runnable APK exists** — first
screenshots.
Tests: navigation renders, deep link opens the correct stub screen, back
gesture/predictive-back behaves correctly on a stub sheet.

### Phase 5 — Auth
Scope: build & **device-test** the cookie-jar networking layer (Architecture §3.3)
first, in isolation, against the real `/api/auth/login` + `/api/auth/me` — this is
the phase where the project's biggest risk gets resolved or a fallback native module
gets built. Then: Splash (session bootstrap), Login, Register (built fully, CTA-gated
per Phase 1 §1.6), Settings' logout action.
Tests: login success/failure, session persists across a full app kill+relaunch
(the actual point of the cookie work), logout clears it, register screen honestly
surfaces the "not available yet" state if the backend hasn't caught up.

### Phase 6 — Home
Scope: Home dashboard (My IDs carousel, "Yangi NFC ID" CTA, live Auction cards,
Company summary/CTA) wired to real `GET /api/auth/me`, `GET /api/auctions`,
`GET /api/companies/mine`. PremiumStatCard, PremiumCard, carousel entrance motion.
Tests: empty states (no cards yet, no auctions, no company) all render correctly, not
just the happy path.

### Phase 7 — ID Purchase
Scope: ID Search/Catalog (search-as-you-type against `/api/records/search`, tier
badge via ported `pricing.ts`), 3-step purchase flow, payment screen honestly reading
`/api/settings/payments-enabled`, order-status polling, success screen. Double-click/
duplicate-request guard (Architecture §3.3) proven with a real fast-double-tap test,
not just claimed.
Tests: search debounce, tier classification matches web app fixtures, purchase 409/
503/202 paths each render their correct real screen (not a generic error toast).

### Phase 8 — Auction
Scope: Auction list (4 tabs), detail with polling+countdown (honest client-clock
caveat from API map §2.4), bid confirm sheet with haptic + double-tap guard, "won,
pending payment" surfaced into both the Auction tab and Notifications.
Tests: countdown correctness against a mocked `endsAt`, bid button's disabled state
correctly reflects the real `payments_disabled` response rather than a hard-coded
disable.

### Phase 9 — Personal Profile
Scope: My Profile / NFC Profile View (own + public-others via deep link), Profile
Edit with Live Preview, music player (YouTube/Yandex/file — all three real, per
Architecture §3.6), contact-save flow with the full Android permission dance
(Architecture §3.7), follow/unfollow, share sheet, "KONTAKTNI SAQLASH" sticky CTA.
Tests: all 3 music source kinds actually play on-device, contact save produces a
correct Android contact with the right fields, permission-denied path shows the
settings-deeplink empty state instead of crashing, gated fields (per `access.ts`)
correctly disable when the signed-in user's effective access is below the feature's
minimum.

### Phase 10 — Company
Scope: Company Home, 5-step create wizard (ID availability polling, info form, logo/
cover upload, preview, submit), Company Dashboard reflecting the real status machine,
Catalog CRUD (single module per company, auto-selected by category), public company
profile screen.
Tests: ID-length tier pricing matches `company.js`'s table exactly, status machine
renders every real state (draft/pending_review/approved/payment_pending/active/
rejected) with correct copy and correct available actions per state — no invented
states, no dead-end buttons for the `payments_backend_pending` 503.

### Phase 11 — Native integrations
Scope: NFC foreground-dispatch read screen (tap validity via `/api/tap/:chipToken`),
Android App Links (`assetlinks.json` prepared, verified once a real release keystore
exists — see Phase 13), haptics audit pass across every interactive component,
secure-storage login-state flag, FCM SDK wired + notification-render code path built
and unit-tested with mock payloads (registration endpoint stubbed, per Phase 1 §1.6
item 4 — no fake backend), biometric-ready stub.
Tests: NFC read on a real Android device against a real or simulated NDEF tag,
deep link cold-start and warm-start both open the right screen, notification render
path unit-tested independent of any real push arriving.

### Phase 12 — QA / performance
Scope: full brief-§21 test matrix executed for real (Auth/ID/Auction/Profile/
Company/Android rows), Detox E2E suite, FlashList conversion pass on all list
screens, image-caching audit, skeleton-loader coverage audit, animation perf budget
check (§5.3) with the RN Perf Monitor, bundle-size and cold-start-time measurement,
accessibility pass (font-scale, screen reader labels, reduced-motion).
Tests: this phase's deliverable *is* its test report — pass/fail per brief §21 row,
with device/OS versions covered (Android 10/13/14/15).

### Phase 13 — Release APK/AAB
Scope: debug APK, release APK, AAB, adaptive icon + splash from the design system,
signing **template** only (`keystore.properties.example`, Gradle signing config
wired) — a real release keystore is generated **only on explicit user go-ahead**, per
the brief's own instruction and the non-negotiables. No Play Store upload, no deploy,
no push to `main` — all explicitly out of scope per the brief §22.
Deliverable: build artifacts + a short "how to sign and release" doc for whoever
holds the real keystore.

## Sequencing notes

- Phases 5 (Auth networking) and 7/8 (money-moving flows) are the highest-risk, most
  Uzbek-audit-worthy phases — they get the most device-testing time, not just the
  most screens.
- Phase 9's three-way music player and Phase 11's NFC read are the two "no shortcuts"
  litmus tests from the brief (§1, §10) — if either gets stubbed out under time
  pressure, that is a direct violation of "BU TEZKOR WEBVIEW/APK EMAS" and should be
  flagged back to the user rather than quietly shipped as a TODO.
- Every phase's report will explicitly re-state which of the Phase 1 §1.6 open
  questions is still unresolved and what, if anything, that is currently blocking —
  so the user always has an up-to-date picture without re-reading this whole plan.

## What happens next

This plan, along with docs 01-05, is the complete answer to the brief's explicit
"Avval FAQAT..." instruction. The next step is Phase 4 (Navigation) — the first phase
that touches code — starting only once this plan has been reviewed, exactly as the
brief's phase-gate rule requires.
