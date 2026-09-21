// SAHIFA FONI — "TEKIS DEVOR" EMAS, "CHUQUR MAKON".
//
// Egasining bahosi: "orqa fon juda qora va o'lik ko'rinadi, chuqurlik
// yo'q". Yechim — to'rt qatlam: asosiy gradient, yumshoq yorug'lik
// dog'lari, don (grain) va bo'limlar orasidagi 2-3% farq.
//
// BU TEST NIMANI QO'RIQLAYDI VA NIMA UCHUN.
//
// 1. IZOHDA YULDUZCHA VA QIYSHIQ CHIZIQ YONMA-YON KELIB QOLISHI.
//    Bu ish davomida topilgan HAQIQIY xato: `theme.css` dagi bitta
//    izohda sinf nomlari yulduzcha bilan qisqartirib yozilgan edi va
//    o'sha ikki belgi IZOHNI ERTA TUGATGAN. Qolgan izoh matni CSS
//    deb o'qilib, undan keyingi `body{...}` va `#root{...}` qoidalari
//    JIMGINA yo'qolgan — ya'ni ular faylda bor edi, lekin brauzerga
//    hech qachon yetib bormagan. Hech qanday xato ham chiqmagan.
//
// 2. FONNI YOPIB QO'YADIGAN QATLAMLAR. Sahifani to'liq qoplaydigan
//    `main`/`footer` tekis rang bilan bo'yalsa, tanadagi gradient
//    ham, dog'lar ham, don ham ko'rinmay qoladi.
//
// 3. KONTRAST. Fon iliqlashgani matnni o'qishni qiyinlashtirmasligi
//    kerak.
//
//   node scripts/test-page-background.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');

// ── 1) IZOHLAR ERTA TUGAMAYDI ────────────────────────────────────────
// Har bir izoh ichida yana `/*` uchrasa — demak oldingi izoh
// vaqtidan oldin yopilgan va o'rtadagi matn CSS ga aylangan.
{
  let i = 0;
  const broken = [];
  for (;;) {
    const a = css.indexOf('/*', i);
    if (a < 0) break;
    const b = css.indexOf('*/', a + 2);
    if (b < 0) { broken.push('yopilmagan izoh'); break; }
    if (css.slice(a + 2, b).includes('/*')) broken.push(css.slice(a, a + 60).replace(/\n/g, ' '));
    i = b + 2;
  }
  check('1) erta tugagan izoh yo‘q', broken, []);
}

// Qoidaning O'ZI ham yetib boradimi: izohdan keyin darhol `body{`
// kelishi kerak, oraliqda "qoidasiz matn" qolmasligi shart.
checkTrue('1) tana qoidasi butun', /\*\/\s*body\s*\{[^}]*background-image:\s*radial-gradient/.test(css));

// ── 2) TO'RT QATLAM JOYIDA ───────────────────────────────────────────
function rule(sel) {
  let out = '';
  let i = css.indexOf(sel + '{');
  if (i < 0) i = css.indexOf(sel + ' {');
  while (i >= 0) {
    out += css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i)) + ';';
    const a = css.indexOf(sel + '{', i + 1);
    const b = css.indexOf(sel + ' {', i + 1);
    i = a < 0 ? b : (b < 0 ? a : Math.min(a, b));
  }
  return out.replace(/\/\*[\s\S]*?\*\//g, '');
}

const body = rule('body');
checkTrue('2) asosiy gradient', body.includes('radial-gradient(120% 70% at 50% 0%'));
// `fixed` bo'lmasa gradient sahifa bilan surilib, uzun sahifada
// takrorlanardi va "chiziq" bo'lib ko'rinardi.
checkTrue('2) fon qimirlamaydi (fixed)', body.includes('background-attachment:fixed'));

const glow = rule('body::before');
checkTrue('3) yorug‘lik dog‘lari bor', (glow.match(/radial-gradient/g) || []).length >= 3);
checkTrue('3) dog‘lar kontent ostida', glow.includes('z-index:-1'));
checkTrue('3) bosishga xalaqit bermaydi', glow.includes('pointer-events:none'));
// Ular KO'RINMASLIGI kerak: 3-6% dan yorqinroq bo'lsa fonda dog'
// bo'lib bilinadi.
{
  // 2026-09: `rgba(...,.05)` endi `color-mix(... 5%, transparent)`.
  const alphas = [
    ...[...glow.matchAll(/rgba\([^)]*,\s*\.(\d+)\)/g)].map((m) => Number('0.' + m[1])),
    ...[...glow.matchAll(/color-mix\(in srgb,\s*var\(--[a-z0-9-]+\)\s+(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]) / 100),
  ];
  checkTrue('3) dog‘lar juda nozik (<=6%)', alphas.length > 0 && Math.max(...alphas) <= 0.06);
}

const grain = rule('body::after');
checkTrue('4) don qatlami bor', grain.includes('feTurbulence'));
checkTrue('4) don deyarli ko‘rinmaydi', /opacity:\.0[12]\d?/.test(grain));

// ── 5) FONNI YOPIB QO'YADIGAN QATLAM YO'Q ────────────────────────────
checkTrue('5) #root shaffof', rule('#root').includes('transparent'));
checkTrue('5) sahifa o‘rami shaffof',
  /main\.bg-page-bg,\s*footer\.bg-page-bg\{\s*background-color:transparent/.test(css.replace(/\s*\n\s*/g, '')));
checkTrue('5) narxlar sahifasi ham', rule('body.pricing-bg').includes('transparent'));
// Token mutlaq qora EMAS — u hali ham yopishgan sarlavha kabi
// haqiqatan to'q fon kerak bo'lgan joylarda ishlatiladi.
checkTrue('5) sahifa rangi mutlaq qora emas', /--color-page-bg:\s*#050403/.test(css));

// ── 6) BO'LIMLAR AJRALIB TURADI, LEKIN CHOK YO'Q ─────────────────────
{
  const band = rule('main.bg-page-bg > section:nth-of-type(even)');
  checkTrue('6) bo‘limlar almashinadi', band.includes('linear-gradient'));
  // Chekkalarda nolga tushadi — aks holda bo'lim boshida ko'rinadigan
  // gorizontal chiziq qolardi.
  // 2026-09: ranglar mavzu tokenlariga o'tkazildi (src/themes.css).
  // `rgba(255,255,255,0)` endi `transparent`, `rgba(255,255,255,.01)`
  // esa `color-mix(... var(--tint-base) 1%, transparent)` ko'rinishida.
  // Tekshiruv MA'NOSI o'zgarmadi.
  checkTrue('6) chekkalarda so‘nadi',
    /(rgba\(255,255,255,0\)|transparent)\s+0%/.test(band)
    && /(rgba\(255,255,255,0\)|transparent)\s+100%/.test(band));
  const pcts = [
    ...[...band.matchAll(/rgba\(255,255,255,\.(\d+)\)/g)].map((m) => Number('0.' + m[1])),
    ...[...band.matchAll(/var\(--tint-base\)\s+(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]) / 100),
  ];
  checkTrue('6) farq 2% dan oshmaydi', pcts.length > 0 && Math.max(...pcts) <= 0.02);
}

// ── 7) KARTALAR FONDAN KO'TARILADI ───────────────────────────────────
checkTrue('7) kartalarda gradient', css.includes('.bg-base-100,.bg-base-200'));
checkTrue('7) katta radiusli bloklarda rim-glow', /rounded-2xl[\s\S]{0,200}0 0 20px -8px/.test(css));

// ── 8) KONTRAST BUZILMAGAN — HAR BIR MAVZUDA ────────────────────────
// Fon endi bitta qattiq rang emas: u `src/themes.css` dagi mavzu
// tokenlaridan keladi. Shuning uchun tekshiruv KUCHAYTIRILDI — eng och
// nuqta (`body` gradientining birinchi to'xtashi) va matn ranglari HAR
// BIR mavzu uchun alohida olinadi va kontrast o'sha yerda hisoblanadi.
{
  const lin = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  const lum = (hex) => 0.2126 * lin(parseInt(hex.slice(1, 3), 16))
    + 0.7152 * lin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * lin(parseInt(hex.slice(5, 7), 16));
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  // `body` gradientining ENG OCH to'xtashi qaysi tokendan olingan.
  const stop = (/radial-gradient\(120% 70% at 50% 0%,\s*var\(--([a-z0-9-]+)\)/.exec(css) || [])[1];
  checkTrue('8) eng och nuqta tokeni topildi', !!stop);

  // Mavzular jadvali — har bir `[data-theme="..."]` blokidagi hex qiymatlar.
  const themesCss = readFileSync(new URL('../src/themes.css', import.meta.url), 'utf8');
  const themes = {};
  for (const m of themesCss.matchAll(/(?:^|\n)(?::root,\n)?\[data-theme="([a-z]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
    const vars = {};
    for (const v of m[2].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[v[1]] = v[2].toLowerCase();
    themes[m[1]] = vars;
  }
  checkTrue('8) mavzular topildi (>=5)', Object.keys(themes).length >= 5);

  for (const [name, v] of Object.entries(themes)) {
    const bg = v[stop];
    if (!bg) { checkTrue(`8) ${name}: eng och nuqta bor`, false); continue; }
    // Asosiy matn — WCAG AAA (7:1) dan yuqori.
    checkTrue(`8) ${name}: asosiy matn AAA dan yuqori`, ratio(v['text-primary'], bg) > 7);
    // Eng xira matn ham AA (4.5:1) dan past tushmasin.
    checkTrue(`8) ${name}: xira matn AA dan yuqori`, ratio(v['text-muted'], bg) > 4.5);
    // Oltin/accent ustidagi yozuv (tugmalar) — AA dan yuqori.
    checkTrue(`8) ${name}: accent ustidagi matn AA dan yuqori`,
      ratio(v['accent-ink'], v['accent-primary']) > 4.5);
  }
}

done();
