# PHASE 5 — Premium Design System

## 5.1 Design tokens (`src/design-system/tokens.ts`)

```ts
export const color = {
  bg: '#0A0A0A',            // screen background
  bgDeep: '#050505',        // splash / modal scrim base
  surface: '#171717',       // card surface
  surfaceRaised: '#1E1E1E', // sheet / elevated card
  border: 'rgba(255,255,255,0.08)',
  borderGold: 'rgba(215,182,93,0.35)',

  gold: '#D7B65D',          // primary gold — CTAs, active states, ID text
  goldHighlight: '#F5D77A', // shimmer peak, pressed-state glow
  goldDark: '#8E6F2E',      // gradient shadow edge, disabled-gold

  textPrimary: '#FFFFFF',
  textSecondary: '#A5A5A5',
  textTertiary: '#6B6B6B',

  success: '#3FBF7F',
  warning: '#E0B34A',       // reuses the gold family, not a garish amber
  danger: '#E5484D',

  // NFC ID tier accents — ported 1:1 from src/lib/pricing.js TIER_COLOR so the
  // Android tier badge always matches the web app's badge for the same code.
  tierExclusive: '#d4af37',
  tierPremium: '#d8a34a',
  tierGold: '#f0c419',
  tierSilver: '#9aa3ad',
  tierFree: '#C58A55',
};

export const gradient = {
  goldButton: ['#8E6F2E', '#D7B65D', '#F5D77A'],       // 135deg
  goldShimmerSweep: ['transparent', 'rgba(245,215,122,0.35)', 'transparent'],
  cardGlass: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'],
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };

export const type = {
  display: { size: 32, weight: '800', lineHeight: 38 },   // screen hero numbers/IDs
  h1:      { size: 24, weight: '700', lineHeight: 30 },
  h2:      { size: 18, weight: '700', lineHeight: 24 },
  body:    { size: 15, weight: '400', lineHeight: 22 },
  caption: { size: 12, weight: '500', lineHeight: 16 },
  mono:    { size: 15, weight: '600', fontFamily: 'RobotoMono-Medium' }, // ID codes always monospace, matching the web app's font-mono treatment
};

export const touchTarget = 48; // Android minimum, brief §4 "Android touch target"
```

**Explicit brief compliance note:** gold is used as an *accent on near-black*, never
as a filled bright-yellow surface — the `goldButton` gradient's midtone is `#D7B65D`
(soft, desaturated) rather than a saturated `#FFD700`-style "casino" yellow. This is
the direct antidote to the brief's "juda yorqin casino-style bo'lmasin" warning.

## 5.2 Reusable component contracts

Every component below ships four things: a visual spec, a Reanimated press
micro-interaction, a haptic trigger point, and explicit `loading`/`disabled`/`a11y`
states — the brief's "har bir component" checklist (§4), applied uniformly instead of
re-litigated per component.

| Component | Visual | Press animation | States |
|---|---|---|---|
| **PremiumButton** | Filled: gold gradient, `radius.md`, `type.h2` label, 48dp min height. Ghost: 1px `borderGold`, transparent fill, gold text. Danger: `color.danger` outline. | `scale 1 → 0.97` over 90ms (Reanimated `withTiming`), `Haptics.impact(Light)` on press-in | `loading` (inline `ActivityIndicator` replaces label, button width locked to prevent layout jump), `disabled` (40% opacity, no press animation, no haptic) |
| **PremiumCard** | `surface` bg, `radius.lg`, subtle 1px `border`, optional `borderGold` when "featured" (e.g. exclusive-tier ID) | Entrance: fade+translateY(12→0) staggered by index in lists (Reanimated `FadeInUp.delay(i*40)`) | `skeleton` variant renders PremiumLoadingSkeleton internally |
| **PremiumInput** | `surfaceRaised` bg, `radius.md`, floating label anim on focus (label slides up + shrinks), gold underline on focus | Focus ring fades in over 120ms | `error` (red underline + caption below), `disabled` |
| **PremiumSheet** | Bottom sheet, `radius.xl` top corners, drag handle, backdrop blur/scrim | Spring-based drag-to-dismiss (`react-native-gesture-handler` + Reanimated), snap points | Honors Android predictive-back to dismiss before popping the screen underneath |
| **PremiumModal** | Centered, `radius.lg`, scale+fade entrance | `scale 0.92→1` + fade, 180ms | Used sparingly — confirmation dialogs only (bid confirm, delete catalog item) |
| **PremiumBadge** | Pill, tier-colored border+text on transparent/`surface` fill (e.g. "PREMIUM", "LIVE") | none (static), but LIVE badge pulses opacity 1↔0.6 loop | — |
| **PremiumHeader** | Logo/back + title + right-icon slot(s); transparent-over-content on scroll-collapse for Home/Profile | Icon buttons share PremiumButton's press scale | Shows unread-dot on the notification icon from `/api/conversations/unread-count` + gift/auction-won counts |
| **PremiumTab** | Segmented control or bottom-tab item; gold underline/indicator slides via `Layout` animation between tabs | Underline `withSpring` position | Disabled tab (e.g. "Men qatnashgan" with 0 items) shows muted, still tappable to an empty state, never hidden (avoids layout shift) |
| **PremiumListRow** | Full-width row, left icon/avatar, center text block, optional right chevron/value; used for Settings, Company catalog rows | Row background flashes `surfaceRaised` briefly on press | `destructive` variant (red text) for delete-type rows |
| **PremiumStatCard** | Compact card: big number (`type.display`), caption below, optional trend arrow (+12%) | Count-up animation on first mount (Reanimated, ~600ms) | `skeleton` while loading |
| **PremiumEmptyState** | Centered icon + headline + optional CTA button — used for "no auctions yet", "no notifications", contact-permission-denied | Icon gentle float loop (very subtle, 2px, 3s) | — |
| **PremiumLoadingSkeleton** | Shimmer bar/block, gold-tinted shimmer sweep (`gradient.goldShimmerSweep`) moving left→right on loop | Continuous shimmer translateX loop | — |
| **PremiumToast** | Bottom-anchored, `surfaceRaised`, colored left bar (success/warning/danger/info) | Slide-up + fade in, auto-dismiss slide-down | Queues multiple toasts rather than overlapping |

## 5.3 Motion system (brief §5)

- **Library:** `react-native-reanimated` v3 (worklet-based, runs on UI thread — this is
  the actual mechanism for hitting 60fps, not just an aspiration) + `react-native-
  gesture-handler` for sheet drags.
- **Named, budgeted motions** (so "not too much animation" is enforced by a checklist,
  not vibes):
  1. Page transition — native-stack's default slide, kept (no custom overkill).
  2. Card entrance — staggered fade+translateY, capped at 6 visible staggered items
     per screen (beyond that, entrance is instant — avoids a slow-feeling long list).
  3. Button press — scale 0.97, 90ms.
  4. Bottom sheet — spring drag, single spring config reused everywhere (`damping:
     18, stiffness: 200`) for consistency.
  5. Modal — scale+fade, 180ms.
  6. Tab indicator — spring slide.
  7. Gold shimmer — used **only** on: loading skeletons, the exclusive/premium tier
     badge, and the "KONTAKTNI SAQLASH" CTA's idle-state sheen (brief §10) — not
     splashed across every gold element, which is exactly the "cheap neon" trap.
  8. Avatar ring glow — soft pulsing opacity on the NFC Profile View's gold ring
     (brief §10), 3s loop, ±8% opacity — subtle, not neon.
  9. NFC animation — concentric ripple from the phone icon on the "NFC o'qish"
     settings screen while scanning.
  10. Auction live pulse — the LIVE badge's opacity pulse (§5.2 PremiumBadge).
  11. Payment pending — indeterminate gold ring spinner (not a generic OS spinner).
  12. Success check — checkmark path-draw animation (`react-native-svg` + Reanimated
      path interpolation), matching mockup screen 10.
- **Perf budget:** no more than 2 concurrently-looping animations per screen at rest
  (e.g. Home = header shimmer idle + nothing else looping); list entrance animations
  are one-shot, not loops. Verified with the RN Perf Monitor / Flipper during Phase 12
  QA, not assumed.

## 5.4 Iconography & imagery

- Icon set: `react-native-vector-icons` (Feather/Phosphor line icons — thin-line
  matches the mockup's minimal-luxury feel better than filled Material icons) plus a
  handful of custom SVGs for brand-specific marks (NFC wave mark, the "N" logomark).
- Avatars/covers: rendered via `/uploads/*` (R2, cached — Phase 3 §3.9), circular
  crop with a 2-3px gold-gradient ring border (`NfcCardVisual` composite), never a
  flat single-color ring — matches the mockup's "gold ring" halo look.

## 5.5 Accessibility (brief §4 "accessibility" line item, applied concretely)

- All icon-only buttons get `accessibilityLabel` (Uzbek copy) — no bare icon buttons.
- Minimum touch target 48×48dp even where the visual glyph is smaller (padding, not
  scaling the icon).
- Color is never the *only* signal: tier badges carry text ("PREMIUM"/"GOLD"/...) next
  to their color, error states carry text next to red, disabled states drop opacity
  **and** block touch (not just visually dimmed).
- Respects system font-scale up to at least 130% without clipping (tested per-screen
  in Phase 12), and Android's reduced-motion accessibility setting disables the
  decorative loops in §5.3 (shimmer/glow/pulse) while keeping functional feedback
  (press scale, loading spinners).
