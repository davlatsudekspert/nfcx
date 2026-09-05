/**
 * Flags for backend capabilities this app cannot verify at runtime via a
 * dedicated endpoint (unlike payments, which has a real
 * `/api/settings/payments-enabled` — see paymentsEnabledStore.ts).
 *
 * REGISTRATION_LIVE: android/docs/01-AUDIT.md §1.3/§1.6 item 1 — as of the
 * audited revision of `hosting/worker.js`, `POST /api/auth/register` and
 * `POST /api/auth/request-register-code` fall through to a dead legacy
 * proxy and 503. Set to `false` so the Register screen's CTA stays honestly
 * disabled (full form still renders — "architecture ready") instead of
 * guaranteeing every real user a failed signup attempt. Flip to `true` the
 * moment the backend owner confirms registration is actually live — this
 * is the ONLY code change that should be needed to turn it back on, by
 * design (no fake backend was built to work around it).
 */
export const REGISTRATION_LIVE = false;
