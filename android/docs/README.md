# NFCSTORE Android App — Pre-flight Package

Delivered per the brief's explicit "Avval FAQAT: repo audit, API mapping, Android
architecture, screen map, design system, implementation plan ber. Audit tugamaguncha
production kodga tegma." No file under `src/`, `server/`, `hosting/`, `db/`, or
`migrations/` was modified to produce this package — it is pure documentation, added
in `android/docs/`.

Read in this order:

1. [`01-AUDIT.md`](./01-AUDIT.md) — what's actually running in production (spoiler:
   it's not what the repo's existing docs describe), what's live vs. not-yet-ported,
   and the open questions that need a human answer before Auth/Payments code is
   written.
2. [`02-API_MAP.md`](./02-API_MAP.md) — the full REST contract Android will consume,
   read directly from `hosting/worker.js`, with live/dead status per endpoint.
3. [`03-ARCHITECTURE.md`](./03-ARCHITECTURE.md) — React Native + TypeScript stack,
   the cookie-session networking design (the project's top technical risk), state
   management, navigation, native modules, security, performance, testing.
4. [`04-SCREEN_MAP.md`](./04-SCREEN_MAP.md) — all 29 screens across the 9 required
   sections, with the navigation graph and API calls per screen.
5. [`05-DESIGN_SYSTEM.md`](./05-DESIGN_SYSTEM.md) — color/type/spacing tokens, the 13
   reusable premium components, and the motion budget.
6. [`06-IMPLEMENTATION_PLAN.md`](./06-IMPLEMENTATION_PLAN.md) — the 13-phase build
   roadmap, phase-gated per the brief's own rule, with per-phase scope and tests.

## Headline findings (read the full audit for detail)

- **Production is a Cloudflare Worker + D1 + R2** (`hosting/worker.js`), not the
  Express/PostgreSQL/Railway stack this repo's other markdown docs describe — that
  stack has been shut down. The API map was built from the Worker's real routes.
- **Auth is an HttpOnly session cookie**, not a bearer token — this drives the single
  most important native-networking decision in the whole app.
- **Registration currently 503s in production** (needs an unported Telegram-bot
  phone-verification step) and **payments are globally disabled**
  (`/api/settings/payments-enabled` → `false`) — both are real, current backend
  states the Android UI must honestly reflect, not implementation shortcuts to fix.
- No feature was invented beyond what the live backend supports (brief §12/§22) —
  every screen in the plan is traceable to a real, checked endpoint.
