// One-off asset generator for the app icon / splash mark, run manually
// (`node scripts/generate-brand-assets.mjs`) — not part of the build.
// Renders the design system's actual tokens (color.bgDeep / color.gold /
// color.goldHighlight) rather than inventing separate brand colors, so the
// icon/splash mark stays in sync with the in-app design system by
// construction. `sharp` is a dev-time-only tool dependency (not added to
// package.json) used purely to rasterize these SVGs to PNG.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const GOLD = '#D7B65D';
const GOLD_HIGHLIGHT = '#F5D77A';
const BG_DEEP = '#050505';

const NMARK = (size, ringColor = GOLD) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="42" fill="none" stroke="${ringColor}" stroke-width="4"/>
  <path d="M35 65 L35 35 L65 65 L65 35" fill="none" stroke="${ringColor}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const iconSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="${GOLD_HIGHLIGHT}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="${BG_DEEP}"/>
  <circle cx="50" cy="50" r="38" fill="none" stroke="url(#g)" stroke-width="4"/>
  <path d="M37 63 L37 37 L63 63 L63 37" fill="none" stroke="url(#g)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function main() {
  mkdirSync('assets', { recursive: true });

  // Main app icon — dark bg + gold gradient N-mark, matches the in-app
  // design system exactly (color.bgDeep / gradient.goldButton stops).
  await sharp(Buffer.from(iconSvg(1024))).png().toFile('assets/icon.png');

  // Adaptive icon foreground — transparent bg, solid gold mark (background
  // color is set separately in app.json's android.adaptiveIcon.backgroundColor).
  await sharp(Buffer.from(NMARK(1024, GOLD)))
    .resize(1024, 1024)
    .png()
    .toFile('assets/android-icon-foreground.png');

  // Android 13+ themed (monochrome) icon — must be a single-color
  // silhouette; the OS applies its own tint, so white-on-transparent here.
  await sharp(Buffer.from(NMARK(1024, '#FFFFFF')))
    .png()
    .toFile('assets/android-icon-monochrome.png');

  // Splash mark — the native splash shown before JS loads is deliberately
  // minimal (dark bg + this mark only); the full branded "NFCSTORE" +
  // tagline + loading bar (mockup screen 1) is the JS SplashScreen
  // component built in Phase 5, which takes over immediately after.
  await sharp(Buffer.from(NMARK(512, GOLD)))
    .resize(512, 512)
    .png()
    .toFile('assets/splash-icon.png');

  // Favicon (web preview only — not part of the Android app itself).
  await sharp(Buffer.from(iconSvg(48))).png().toFile('assets/favicon.png');

  console.log('Brand assets generated in ./assets');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
