# NFCSTORE.UZ — TODO

Updated: 2026-08-29

## P0 — release blockers

- [x] Preserve original project and work from a verified copy.
- [x] Stop paid IDs from being created without payment.
- [x] Add explicit default-off payment gates on server and client.
- [x] Disable new auction bids/settlement while payment is unavailable.
- [x] Remove phone/payment-card leaks from public APIs.
- [x] Fix gift activation session argument order and TTL.
- [x] Remove fake verification UI.
- [x] Make admin 2FA fail closed.
- [x] Ensure admin API receives common security headers.
- [x] Make Public Profile mobile-first with Save Contact as primary CTA.
- [ ] Mechanically sync verified staging changes into `D:\NFCSTORE_GPT_DEVELOPMENT` after the Windows sandbox D: write issue is resolved.
- [ ] Authenticate GitHub, push the prepared commit, and grant the Railway GitHub App access to `davlatsudekspert/nfcx`.
- [ ] Create the Railway service, attach PostgreSQL through `DATABASE_URL`, generate a domain and verify the live healthcheck.

## P1 — next production hardening sprint

- [ ] Add automated API tests for auth, privacy projection, hidden phone, payment gates, gift activation and admin 2FA.
- [ ] Add React component/e2e tests for Home, Public Profile, Register, Account and disabled payment states.
- [ ] Add lint and test scripts to `package.json` and CI.
- [ ] Replace startup schema mutation with versioned PostgreSQL migrations.
- [ ] Validate uploaded files by magic bytes; add upload-specific rate and size limits.
- [ ] Add CSP and a reviewed production security-header policy.
- [ ] Require and validate a canonical production host/origin for HTTPS redirects.
- [ ] Verify Telegram bot username/configuration instead of relying on frontend constants.
- [ ] Resolve the missing `xlsx` dependency or replace the Admin export implementation.
- [ ] Add per-route catalog fetching so Admin/Auth/Profile do not all request the catalog at startup.
- [ ] Split or defer the Admin export/vendor payload further.
- [ ] Add dynamic per-profile title, canonical and Open Graph metadata via SSR/edge rendering.
- [ ] Complete Uzbek/Russian/English translations for newly added product copy.
- [ ] Run real-device VCF download tests on iOS Safari and Android Chrome; the in-app QA browser did not expose a blob download event even though no console error occurred.
- [ ] Review auction state already in `awaiting_payment` before production payment activation.
- [ ] Perform a database-backed integration test with a disposable PostgreSQL instance.

## P2 — quality and growth

- [ ] Add a global light/dark theme switch with persisted preference.
- [ ] Consolidate repeated button/card classes into design-system components and tokens.
- [ ] Reduce non-essential glow/orbit animations and optimize hero compositing cost.
- [ ] Optimize PNG assets and define responsive image sizes.
- [ ] Add skeleton states for lazy routes and profile data.
- [ ] Improve Account information architecture into a persistent desktop sidebar plus mobile tabs.
- [ ] Add privacy controls per social/contact field, not phone only.
- [ ] Add accessible labels/titles to every icon-only action.
- [ ] Add real verification only after a documented verification workflow and database field exist.
- [ ] Add analytics events for profile open, NFC tap, Save Contact and Share while respecting consent/privacy.
- [ ] Add sitemap/robots generation and structured data.
- [ ] Remove dead CSS/components and audit unused dependencies.

## Payment activation checklist

Payments must stay disabled until every item is complete:

- [ ] Payme merchant contract and production credentials verified.
- [ ] Webhook authentication and idempotency tested against provider sandbox.
- [ ] Refund/cancellation and failed-code-taken behavior tested.
- [ ] Auction settlement and winner deadline policy approved.
- [ ] Legal copy, price display and support escalation approved.
- [ ] Monitoring, reconciliation and admin audit trail verified.
- [ ] Set backend `PAYMENTS_ENABLED=true` only after approval.
- [ ] Change frontend `PAYMENTS_ENABLED` only in the same reviewed release.
