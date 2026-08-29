# NFCSTORE.UZ — Architecture

Updated: 2026-08-29

## Development safety

- Immutable imported source: `D:\nfcx.uz`.
- Required development target: `D:\NFCSTORE_GPT_DEVELOPMENT`.
- Full copy verification: 12,840 files and 114,291,628 bytes matched.
- Codex staging (temporary because the Windows sandbox could read but not write D:): `C:\Users\Ali\Documents\Codex\2026-08-29\sa\work\NFCSTORE_GPT_DEVELOPMENT_STAGING`.
- No production deployment was performed.

## Product model

NFCSTORE is a digital identity and networking platform. The core journey is:

1. Create a digital profile.
2. Add identity, contact and social links.
3. Link the profile to a physical NFC card.
4. Tap the card on a phone.
5. Open a mobile public profile.
6. Save the contact as a VCF or share the profile URL.

Custom NFC IDs, premium tiers and auctions are optional monetization layers. They are not the primary product story.

## Technology stack

- Frontend: React 18, Vite 5, Tailwind CSS 4, DaisyUI 5.
- Backend: Node.js, Express 4.
- Database: PostgreSQL through `pg`.
- Auth: HttpOnly session cookie, SameSite=Lax, server-side session table, scrypt password hashes.
- Admin auth: separate Strict cookie, TOTP with Telegram OTP fallback, 12-minute idle timeout.
- Integrations retained in code: Telegram bot, Payme, dormant Paynet.
- Routing: custom pathname router, no React Router dependency.

## Frontend map

- `src/App.jsx`: route selection, providers, global shell, lazy route chunks.
- `src/pages/HomePage.jsx`: product value proposition, free-profile CTA, optional custom-ID search.
- `src/pages/ProfilePage.jsx`: bare mobile-first public profile and VCF contact export.
- `src/pages/AccountPage.jsx`: profile editor, dashboard navigation, owned cards, gifts and support.
- `src/pages/AuthPage.jsx`: login/register and Telegram phone verification flow.
- `src/pages/PricingPage.jsx`: custom-ID tier calculator.
- `src/pages/AuctionsPage.jsx`, `AuctionPage.jsx`: exclusive-ID auction UI.
- `src/pages/PaymentsPage.jsx`: authenticated payment history; new payments currently disabled.
- `src/pages/AdminPage.jsx`: admin operations; loaded as a separate large chunk.
- `src/components/Header.jsx`: responsive global navigation.
- `src/components/ReserveModal.jsx`: custom-ID reservation; paid paths are gated.
- `src/lib/features.js`: frontend feature flags.
- `src/theme.css`: Tailwind/DaisyUI theme, animation definitions and reduced-motion behavior.

## Public routes

- `/`: Home.
- `/:code`: bare Public Profile.
- `/login`, `/register`: authentication.
- `/account`, `/sozlamalar`, `/bildirishnomalar`, `/tolovlar`: authenticated account surfaces.
- `/narxlar`, `/qanday-ishlaydi`, `/katalog`, `/reyting`, `/kompaniyalar`.
- `/auksion`, `/auksion/:id`.
- `/savollar`, `/aloqa`, `/shartlar`, `/maxfiylik`.
- `/admin`: bare admin application.
- Messaging routes remain in code but are gated by `MESSAGING_ENABLED=false`.

## Backend boundaries

- `server/index.js`: HTTP API, validation, authorization, feature gates and static frontend serving.
- `server/db.js`: schema bootstrap, SQL queries and data mapping.
- `server/auth.js`: password hashing, session tokens and cookies.
- `server/admin.js`: isolated admin router and 2FA.
- `server/payme.js`: Payme checkout/webhook implementation.
- `server/paynet.js`: retained dormant provider code.
- `server/bot.js`: Telegram bot and OTP notifications.
- `server/uploads/`: persisted base64-decoded media uploads.

## Key data domains

The schema is initialized and incrementally altered at server startup. Main domains include users, sessions, cards/profiles, web orders, physical cards, auctions/bids, gifts, referrals, follows/likes, support messages, conversations/messages and admin audit/security records.

A future production hardening phase should replace startup schema mutation with versioned migrations.

## Privacy contract

- `GET /api/records` returns only catalog fields: code, display identity, tags/tier metadata and view/time counters.
- Phone, email, payment card numbers and profile internals are excluded from the public list.
- `GET /api/records/:code` always strips payment card numbers.
- A hidden phone is stripped for non-owners.
- Full owned-card data is available only through authenticated `/api/auth/me`.
- The Public Profile does not display payment card numbers.

## Payment state

- Frontend: `PAYMENTS_ENABLED=false`.
- Backend: payments require both `PAYMENTS_ENABLED=true` and valid Payme credentials.
- Default behavior is fail-closed: paid ID reservation, physical-card order, premium upgrade, auction bid/settlement and auction payment cannot start.
- Free profile/free ID flows remain available.
- Payme webhook code is retained for compatibility with existing provider transactions.
- Enabling production payments requires business approval, provider verification, security tests and an explicit environment change.

## Performance architecture

Home and Public Profile remain in the initial application chunk. Account, Admin, Designer, Auction and secondary content routes use `React.lazy` + `Suspense`. The measured main JavaScript chunk dropped from about 922 KB to 317 KB before gzip; Admin is isolated at about 455 KB.

## Known architectural debt

- No automated test runner, linter or TypeScript check script.
- No versioned database migrations.
- Upload validation trusts declared MIME more than file magic bytes.
- Large Admin chunk and heavy UI animation inventory still need review.
- Global catalog request still happens at app startup, although its payload is now privacy-minimal.
- Dynamic per-profile title/OG metadata requires SSR or an edge metadata strategy.
- Light/dark global theme switch is not yet implemented.
