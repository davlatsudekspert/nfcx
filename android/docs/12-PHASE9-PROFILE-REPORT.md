# Phase 9 — Personal Profile: Report

## Nima qilindi

- **`ProfileView` composite** — the shared rendering for the NFC Profile
  View (brief §10, this app's most premium screen): large circular avatar
  with an animated gold ring + glow (`NfcCardVisual`, no card-preview
  chrome, per the brief), #ID + tier badge, name/role/website/hashtags,
  a real stats row (followers/following from `GET /api/follow-stats/:code`,
  views from the record, member-since from `ts`), the music player, and
  vertical full-width contact buttons. **Reused as-is** by
  `PublicProfileScreen` (real data), `MyProfileScreen` (own data), and
  `ProfileEditScreen`'s Live Preview (draft data) — an owner editing their
  profile sees the exact same component a visitor will.
- **`MusicPlayer` composite — all three source kinds actually play**, no
  shortcuts (brief §1/§9's explicit "no shortcuts" test):
  - YouTube: `react-native-youtube-iframe`, real play/pause, a polled
    progress bar, and title/author fetched via the library's oEmbed helper.
  - Yandex Music: its official iframe widget rendered in a `WebView` — no
    public JS bridge exists to drive external controls, so its own UI is
    used as-is, matching what the web app itself does.
  - Direct audio file: `expo-audio`'s `useAudioPlayer`/
    `useAudioPlayerStatus` hooks, real play/pause/seek with a slider
    (`@react-native-community/slider`).
- **`ContactButtons` composite** — vertical, full-width, icon-left/text-
  centered, no arrow, gold/black border, with a slow per-button shimmer
  sweep (staggered phase per row) — built only from whichever contact
  fields the record actually has (never a dead button for a missing
  field).
- **PublicProfileScreen**: real `GET /api/records/:code` fetch, a
  fire-and-forget view increment, real follow/unfollow (the mockup's
  "like" heart icon — there is no separate `like` endpoint confirmed
  anywhere in the live API, so this is wired to the real, confirmed social
  action instead of a fake counter), native share, and the full Android
  contact-save permission flow (rationale sheet → OS prompt → saved/denied
  states, denied state deep-links to the app's OS settings) behind a
  **sticky, safe-area-aware "KONTAKTNI SAQLASH" bar** that's always
  visible at the bottom, per brief §10.
- **MyProfileScreen**: same `ProfileView`, fed from the session's own
  `cards`, with a selector strip when the user owns more than one ID.
- **ProfileEditScreen**: real form (name/role/phone/email/telegram/
  whatsapp/website/hashtags/music) wired to `PUT /api/records/:code`, a
  "Tahrirlash"/"Ko'rish" tab toggle standing in for the brief's literal
  side-by-side preview panel (doesn't fit a phone screen) — "Ko'rish"
  renders the live draft through the same `ProfileView` a visitor would
  see. The music field is **feature-gated** via the ported `access.ts`
  (`effectiveAccess`/`featureAllowed('music', ...)`) — disabled with an
  honest "Premium talab qilinadi" label when the user's effective access
  is below premium, since the Worker doesn't yet enforce this gate
  server-side either (per the Phase 1 audit note) and a silently-accepted-
  but-ignored field would be worse UX than an honest disabled state.
- **NotificationsScreen**: real client-side aggregation of
  `GET /api/gift-offers` (accept/reject wired to
  `POST /api/gift-offers/:id/:action`) and `GET /api/auctions/won/pending`
  — mirroring the web app's own no-push-backend pattern
  (android/docs/01-AUDIT.md §1.6 item 4). Support-message replies (present
  on the web) are **omitted** — no confirmed live user-facing endpoint for
  them exists in `hosting/worker.js`.

## Files changed

New composites: `src/composites/{ProfileView,MusicPlayer,ContactButtons,
NfcCardVisual}.tsx`. Real screen implementations replacing Phase 4 stubs:
`src/screens/home/PublicProfileScreen.tsx`, `src/screens/profile/
{MyProfile,ProfileEdit,Notifications}Screen.tsx`. New dependencies:
`react-native-youtube-iframe`, `@react-native-community/slider`,
`expo-audio` (replacing the initially-installed, now-removed `expo-av`,
since `expo-audio`'s hook API is the current, non-deprecated one for this
Expo SDK). Nothing under `src/`, `server/`, `hosting/`, `db/`, or
`migrations/` was touched.

## Verified

- `npx tsc --noEmit` → 0 errors.
- `npx eslint . --ext .ts,.tsx` → 0 problems.
- `npx jest --ci` → 30/30 tests still pass (no regressions; this phase is
  almost entirely UI/composite work with no new pure-logic surface beyond
  what `access.ts`'s existing tests already cover).
- Not verified: **this is the phase with the most on-device risk of any so
  far** — YouTube/Yandex WebView playback, real audio file playback, the
  contact-permission dance, and the shimmer/glow animation performance all
  need a real Android device to confirm, and none of that is possible in
  this sandbox (no SDK/emulator/device, stated plainly rather than
  glossed over, same as every phase's standing limitation).

## Next phase

Phase 10 — Company: Company Home, the 5-step create wizard (ID-length tier
pricing from `src/lib/company.js`, live availability polling), Company
Dashboard rendering the real status machine, and single-module catalog CRUD
(auto-selected by category, never user-chosen). Continuing now.
