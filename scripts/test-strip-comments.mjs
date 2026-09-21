// IZOH TOZALAGICHNI QO'RIQLAYDIGAN TEST
//
// 2026-09 da deploy qo'riqchisi (`test-story-post-separate.mjs`) yolg'on
// yiqildi. Sababi tekshirilayotgan kodda emas, TEKSHIRUVNING O'ZIDA edi:
// izohlarni oddiy regex olib tashlardi va
//
//     <input type="file" accept="image/*" ... />
//
// dagi `/*` ni izoh boshi deb o'qirdi. Keyingi haqiqiy `*/` gacha
// hamma narsa — 117 KB tirik kod — o'chib ketardi.
//
// Eng xavflisi shundaki, u JIM ishlaydi: manbaga yangi izoh qo'shilsa
// juftlik suriladi va butunlay boshqa joy yo'qoladi. Ya'ni mina har
// safar boshqa joyda portlaydi.
//
// Endi `scripts/lib/strip-comments.mjs` da kichik skaner bor. Bu test
// uni ikki tomondan bog'laydi:
//
//   1) ANIQ HOLATLAR — `image/*`, satr ichidagi soxta izoh, shablon,
//      qochirilgan qo'shtirnoq, ichma-ich `${}`;
//   2) HAQIQIY PARSER BILAN SOLISHTIRISH — loyihaning o'z fayllarida
//      natija esbuild (Vite ishlatadigan parser) bilan bir xil
//      bo'lishi kerak. esbuild topilmasa bu qism sakrab o'tiladi,
//      chunki u qo'riqchining majburiy bog'liqligi emas.
//
//   node scripts/test-strip-comments.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';

const { checkTrue, done } = makeChecker();
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

// ── 1) ANIQ HOLATLAR ─────────────────────────────────────────────────

// ASOSIY XATO: atribut qiymatidagi `image/*` izoh EMAS.
{
  const src = 'const a = <input accept="image/*" />;\nconst keep = 1;\nconst b = 2; /* rost izoh */\nconst after = 3;';
  const out = stripComments(src);
  checkTrue('1) accept="image/*" saqlanadi', out.includes('accept="image/*"'));
  checkTrue('1) undan keyingi kod yo‘qolmaydi', out.includes('const keep = 1;') && out.includes('const after = 3;'));
  checkTrue('1) rost izoh olib tashlanadi', !out.includes('rost izoh'));
}

// Satr ichidagi izohga o'xshash matn — matn bo'lib qoladi.
{
  const out = stripComments(`const s = 'matn /* soxta */ tugadi';\nconst d = "yana // soxta";`);
  checkTrue('2) bir tirnoqli satr ichidagi /* */ saqlanadi', out.includes('/* soxta */'));
  checkTrue('2) qo‘shtirnoq ichidagi // saqlanadi', out.includes('// soxta'));
}

// Qochirilgan tirnoq satrni yopmaydi.
{
  const out = stripComments(`const s = 'a\\'b /* ichida */ c';\nconst t = 1; /* tashqarida */`);
  checkTrue('3) qochirilgan tirnoqli satr butun qoladi', out.includes('/* ichida */'));
  checkTrue('3) tashqaridagi izoh olib tashlanadi', !out.includes('tashqarida'));
}

// Shablon satri va uning ichidagi `${...}`.
{
  const out = stripComments('const a = `x /* matn */ ${ y /* izoh */ } z`;');
  checkTrue('4) shablon MATNIDAGI /* */ saqlanadi', out.includes('/* matn */'));
  checkTrue('4) ${} ICHIDAGI izoh olib tashlanadi', !out.includes('/* izoh */'));
}

// Ichma-ich shablon.
{
  const out = stripComments('const a = `p ${ `q ${r} /* ichki matn */` } s`; /* oxirgi */');
  checkTrue('5) ichma-ich shablon matni saqlanadi', out.includes('/* ichki matn */'));
  checkTrue('5) tashqi izoh olib tashlanadi', !out.includes('/* oxirgi */'));
}

// JSX izohlari ham ketadi (ular `{` `}` ichidagi oddiy blok izoh).
{
  const out = stripComments('<div>{/* jsx izoh */}<b>matn</b></div>');
  checkTrue('6) JSX izohi olib tashlanadi', !out.includes('jsx izoh'));
  checkTrue('6) JSX matni saqlanadi', out.includes('<b>matn</b>'));
}

// Qator izohi faqat O'Z qatorini yeydi.
{
  const out = stripComments('const a = 1; // izoh\nconst b = 2;');
  checkTrue('7) qator izohi keyingi qatorga o‘tmaydi', out.includes('const b = 2;') && !out.includes('izoh'));
}

// Qator raqamlari saqlanadi — "shu qatorda" tekshiruvlari buzilmasin.
{
  const src = 'a\n/* ikki\n   qatorli */\nb';
  checkTrue('8) qator soni o‘zgarmaydi',
    stripComments(src).split('\n').length === src.split('\n').length);
}

// Yopilmagan izoh fayl oxirigacha ketadi (JS qoidasi) va halokat bo'lmaydi.
{
  checkTrue('9) yopilmagan izoh xatoga olib kelmaydi', typeof stripComments('a /* yopilmagan') === 'string');
}

// -- 2) HAQIQIY PARSER BILAN TEKSHIRISH -------------------------------
//
// Tarixiy xato KOD o'chirilishi edi, izoh qolishi emas. Shuning uchun
// asosiy shart: TOZALANGANDAN KEYIN MANBA HAMON TO'G'RI JS/JSX BO'LSIN.
// Agar skaner tirik kodni yeb qo'ysa, natija deyarli har doim parse
// bo'lmaydi — ya'ni bu shart minani darhol ushlaydi.
//
// DIQQAT: esbuild izohlarni TO'LIQ olib tashlamaydi — obyekt maydonlari
// oldidagi izohlarni saqlab qoladi. Shuning uchun u "izoh qoldimi?"
// savoliga o'lchov bo'la olmaydi; solishtirishdan oldin uning natijasi
// ham shu skaner orqali o'tkaziladi, shunda ikkala tomon ham izohsiz
// bo'ladi va faqat KOD solishtiriladi.
let esbuild = null;
try { esbuild = await import('esbuild'); } catch { /* yo'q bo'lsa sakraymiz */ }

const FILES = [
  '../src/pages/AccountPage.jsx',
  '../src/pages/ProfilePage.jsx',
  '../src/pages/CompanyWorkspacePage.jsx',
  '../src/components/StoryUploader.jsx',
  '../src/pages/CatalogPage.jsx',
];

const words = (s) => (s.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || []).length;

if (!esbuild) {
  console.log('  (esbuild topilmadi - parser tekshiruvi sakrab o\'tildi)');
} else {
  for (const rel of FILES) {
    const name = rel.split('/').pop();
    const src = read(rel);
    const mine = stripComments(src);

    // (a) Tozalangan manba HAMON to'g'ri JS/JSX.
    let parsed = true;
    let err = '';
    try {
      esbuild.transformSync(mine, { loader: 'jsx', jsx: 'preserve' });
    } catch (e) {
      parsed = false;
      err = String((e.errors && e.errors[0] && e.errors[0].text) || e).slice(0, 90);
    }
    checkTrue(`P) ${name}: tozalangach hamon to'g'ri JSX (kod yo'qolmagan)`, parsed, err);

    // (b) Kod hajmi parser natijasi bilan mos (ikkala tomon ham izohsiz).
    const theirs = stripComments(esbuild.transformSync(src, { loader: 'jsx', jsx: 'preserve' }).code);
    const drift = Math.abs(words(mine) - words(theirs)) / Math.max(words(theirs), 1);
    checkTrue(`P) ${name}: kod hajmi parser bilan mos (< 2%)`, drift < 0.02,
      `skaner=${words(mine)} parser=${words(theirs)} farq=${(drift * 100).toFixed(2)}%`);

    // (c) Skaner esbuild'dan QAT'IYROQ: barcha blok izohlar ketgan.
    const comments = [...src.matchAll(/\/\*([\s\S]*?)\*\//g)]
      .map((m) => m[1].replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 25);
    const left = comments.filter((c) => mine.replace(/\s+/g, ' ').includes(c));
    checkTrue(`P) ${name}: barcha blok izohlar ketdi`, left.length === 0, left.slice(0, 1).join(''));
  }
}

// -- 2b) AYNAN O'SHA TARIXIY HOLAT ------------------------------------
// AccountPage da `accept="image/*"` bor va undan KEYIN `storyOpen`
// bloki keladi. Eski regex aynan shu ikkisining orasini o'chirardi.
{
  const account = read('../src/pages/AccountPage.jsx');
  checkTrue('H) manbada hamon accept="image/*" bor (holat dolzarb)', account.includes('accept="image/*"'));
  const out = stripComments(account);
  checkTrue('H) tozalangach storyOpen bloki JOYIDA', /storyOpen && \([\s\S]{0,400}<StoriesManager\b/.test(out));
  checkTrue('H) tozalangach accept="image/*" JOYIDA', out.includes('accept="image/*"'));
}

// -- 2c) MINANING O'ZI: eski usul shu naqshda ALBATTA yiqiladi ---------
// Haqiqiy fayldagi juftlik tasodifga bog'liq (yangi izoh qo'shilsa
// suriladi), shuning uchun bu yerda naqsh SUN'IY tarzda qayta
// yaratiladi. Shart har doim bir xil javob beradi va "hozir mina
// qurilganmi" degan tasodifga bog'liq emas.
{
  const fixture = [
    'const up = <input accept="image/*" />;',
    'const KEEP_ME = 1;',
    'function important() { return storyOpen && <StoriesManager />; }',
    '/* oddiy izoh */',
    'const tail = 2;',
  ].join('\n');

  const oldWay = fixture
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  checkTrue('M) eski regex bu naqshda KODNI yeb qo\'yadi',
    !oldWay.includes('KEEP_ME') || !oldWay.includes('storyOpen'));

  const nowWay = stripComments(fixture);
  checkTrue('M) yangi skaner kodni saqlaydi',
    nowWay.includes('KEEP_ME') && nowWay.includes('storyOpen') && nowWay.includes('accept="image/*"'));
  checkTrue('M) yangi skaner rost izohni olib tashlaydi', !nowWay.includes('oddiy izoh'));
}

// ── 3) QO'RIQCHI ENDI SHU MODULNI ISHLATSIN ──────────────────────────
// Eski regex qaytib kelsa, mina ham qaytadi.
{
  const guard = read('./test-story-post-separate.mjs');
  checkTrue('R) qo‘riqchi umumiy modulni ishlatadi', /from '\.\/lib\/strip-comments\.mjs'/.test(guard));
  checkTrue('R) qo‘riqchida eski regex qolmagan',
    !/replace\(\/\\\/\\\*\[\\s\\S\]\*\?\\\*\\\/\/g/.test(guard));
}

done('Izoh tozalagich');
