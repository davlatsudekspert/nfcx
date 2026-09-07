// Brand asset generator — run manually: `node scripts/generate-brand-assets.mjs`
// Renders the NFCSTORE logo (gold "N" with circuit traces and NFC arcs in a
// gold-edged rounded square, from the owner's brand artwork) to every PNG the
// app needs. `sharp` is a dev-time-only tool (installed with --no-save).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const BG = '#050505';
const GOLD_HI = '#f0cf7a';
const GOLD = '#d4af5a';
const GOLD_DK = '#b3860f';

const defs = (id) => `
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GOLD_HI}"/>
      <stop offset="0.5" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="${GOLD_DK}"/>
    </linearGradient>
    <linearGradient id="${id}-edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD_HI}"/>
      <stop offset="0.45" stop-color="${GOLD_DK}"/>
      <stop offset="1" stop-color="${GOLD_HI}"/>
    </linearGradient>
  </defs>`;

const c45 = Math.SQRT1_2;
const arc = (cx, cy, r, up) => {
  const sx = cx - r * c45, ex = cx + r * c45;
  const y = up ? cy - r * c45 : cy + r * c45;
  return `<path d="M${sx} ${y} A${r} ${r} 0 0 ${up ? 1 : 0} ${ex} ${y}" fill="none" stroke="url(#G)" stroke-width="16" stroke-linecap="round"/>`;
};

// Circuit traces: from the N's outer bars outward, with a jog and a hollow node.
const trace = (dir, y, jog) => {
  const x0 = dir < 0 ? 372 : 652;
  const x1 = x0 + dir * 46;
  const x2 = x1 + dir * 44;
  const x3 = x2 + dir * 30;
  return `
  <polyline points="${x0},${y} ${x1},${y} ${x2},${y + jog} ${x3},${y + jog}" fill="none" stroke="url(#G)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x3 + dir * 16}" cy="${y + jog}" r="13" fill="${BG}" stroke="url(#G)" stroke-width="9"/>`;
};

// The mark itself (badge + N + arcs + traces), in a 1024 box.
const MARK = (withBadge = true, mono = null) => {
  const fill = mono ?? 'url(#G)';
  const edge = mono ?? 'url(#G-edge)';
  const badge = withBadge
    ? `<rect x="196" y="196" width="632" height="632" rx="150" fill="${mono ? 'none' : '#0b0a08'}" stroke="${edge}" stroke-width="22"/>`
    : '';
  return `
  ${badge}
  <!-- N: two slab bars joined by a heavy diagonal -->
  <path d="M382 356 H452 V668 H382 Z M572 356 H642 V668 H572 Z M382 356 H452 L642 668 H572 Z" fill="${fill}"/>
  <!-- NFC arcs -->
  ${arc(512, 352, 62, true)}${arc(512, 352, 100, true)}${arc(512, 352, 138, true)}
  ${arc(512, 672, 62, false)}${arc(512, 672, 100, false)}${arc(512, 672, 138, false)}
  <!-- circuit traces -->
  ${trace(-1, 436, -34)}${trace(-1, 486, -12)}${trace(-1, 536, 12)}${trace(-1, 586, 34)}
  ${trace(1, 436, -34)}${trace(1, 486, -12)}${trace(1, 536, 12)}${trace(1, 586, 34)}`
    .replace(/url\(#G\)/g, fill).replace(/fill="#050505"/g, mono ? 'fill="none"' : `fill="${BG}"`);
};

const svg = (inner, bg) => `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${defs('G')}${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}${inner}</svg>`;

async function main() {
  mkdirSync('assets', { recursive: true });
  // Launcher icon (legacy/full-bleed): black floor + badge.
  await sharp(Buffer.from(svg(MARK(true), BG))).png().toFile('assets/icon.png');
  // Adaptive foreground: transparent, badge inside the 66% safe zone.
  await sharp(Buffer.from(svg(MARK(true), null))).png().toFile('assets/android-icon-foreground.png');
  // Android 13+ themed icon: single-colour silhouette, OS tints it.
  await sharp(Buffer.from(svg(MARK(true, '#FFFFFF'), null))).png().toFile('assets/android-icon-monochrome.png');
  // Native splash mark: transparent background (splash bg colour comes from app.json).
  await sharp(Buffer.from(svg(MARK(true), null))).resize(512, 512).png().toFile('assets/splash-icon.png');
  await sharp(Buffer.from(svg(MARK(true), BG))).resize(64, 64).png().toFile('assets/favicon.png');
  console.log('brand assets written');
}
main().catch((e) => { console.error(e); process.exit(1); });
