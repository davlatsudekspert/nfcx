/**
 * Flags for backend capabilities this app cannot verify at runtime via a
 * dedicated endpoint (unlike payments, which has a real
 * `/api/settings/payments-enabled` — see paymentsEnabledStore.ts).
 *
 * REGISTRATION_LIVE — re-verified directly against production
 * `hosting/worker.js` (`authApi`, the handler every `/api/auth/*` request
 * falls into). It implements exactly three routes:
 *
 *     POST /api/auth/login
 *     POST /api/auth/logout
 *     GET  /api/auth/me
 *
 * There is **no registration endpoint at all** — no `/api/auth/register`,
 * no `/api/auth/request-register-code`, no code-verification route — and
 * not just for this app: the website has none either. The worker's own
 * comment says registration still depends on the Telegram bot's phone
 * verification, which was never ported, so anything posted to a signup path
 * falls through to the generic proxy and comes back as unavailable.
 *
 * So this stays `false`, and the Register screen keeps its full form,
 * validation and real `authApi.requestRegisterCode` call wired while
 * disabling only the CTA — "architecture ready", no fake backend, and no
 * real user handed a request that is guaranteed to fail. The honest,
 * working path to an account today is the team's published Telegram/phone
 * (src/screens/auth/supportContacts.ts, sourced from the website's own
 * contact page), which both auth screens offer as the primary action.
 *
 * Flipping this to `true` the day the endpoint ships is by design the only
 * code change required to turn signup back on.
 */
export const REGISTRATION_LIVE = false;
