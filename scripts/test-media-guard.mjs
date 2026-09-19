// GLOBAL MEDIA QO'RIQCHISI — EKRANDA JIM QORA BLOK QOLMASIN
//
// SHIKOYAT (production, VIP001). Lentada to'qqizta storydan yettitasi,
// post ro'yxatida esa o'n sakkizta postning ko'pi qop-qora to'rtburchak
// edi. Ikkala joyda ham sabab bitta: media ko'rsatadigan har bir joy
// o'zicha `<img>`/`<video>` chizardi va "media kelmasa nima
// ko'rsatamiz?" degan savolga javob bermasdi.
//
// Shuning uchun javob BITTA joyga — `MediaThumb` ga — ko'chirildi va
// bu test o'sha yagona joyning qoidalarini qo'riqlaydi.
//
// UCH XIL YIQILISH BOR VA UCHALASI HAM EKRANDA BIR XIL KO'RINADI:
//   1) `error` chiqdi          — fayl yo'q / buzuq / kodek yo'q;
//   2) hech narsa chiqmadi     — so'rov osilib qoldi (sekin tarmoq,
//      katta fayl, "Trafikni tejash"). Brauzer bunday holatda HECH
//      QANDAY hodisa bermaydi;
//   3) media umuman yo'q       — mediasiz post/story qatori.
// Uchalasi uchun ham ALOHIDA, o'qiladigan holat bo'lishi shart.
//
//   node scripts/test-media-guard.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';
import { mediaKind, mediaUrl, videoPosterSrc } from '../src/lib/media.js';

const { check, checkTrue, done } = makeChecker();
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const thumb = stripComments(read('src/components/MediaThumb.jsx'));
const css = read('src/theme.css');

// ── 1) MEDIA TURI — SOF FUNKSIYA ─────────────────────────────────────
// Lenta, to'liq ekran va postlar BITTA qoidaga tayanishi kerak: biri
// "video", ikkinchisi "rasm" deb qarasa, bosilgan katak bilan ochilgan
// oyna mos kelmasdi.
{
  check('1) video qator -> video', mediaKind({ videoUrl: '/uploads/a.mp4' }), 'video');
  check('1) rasm qator -> image', mediaKind({ imageUrl: '/uploads/a.jpg' }), 'image');
  check('1) ikkalasi bo‘sh -> none', mediaKind({ imageUrl: '', videoUrl: '' }), 'none');
  check('1) qator yo‘q -> none', mediaKind(null), 'none');
  check('1) ikkalasi bor -> video', mediaKind({ imageUrl: '/a.jpg', videoUrl: '/a.mp4' }), 'video');
  check('1) havola turiga mos', mediaUrl({ imageUrl: '/a.jpg', videoUrl: '/a.mp4' }), '/a.mp4');
  check('1) media yo‘q -> bo‘sh havola', mediaUrl({}), '');
}

// ── 2) VIDEODAN BIRINCHI KADR ────────────────────────────────────────
{
  check('2) fragment qo‘shiladi', videoPosterSrc('/uploads/s.mp4'), '/uploads/s.mp4#t=0.1');
  check('2) mavjud fragmentga tegilmaydi', videoPosterSrc('/uploads/s.mp4#t=2'), '/uploads/s.mp4#t=2');
  check('2) bo‘sh havola bo‘sh qoladi', videoPosterSrc(''), '');
  check('2) null ham bo‘sh', videoPosterSrc(null), '');
  // Nisbiy havola NISBIY qolsin — R2 fayli o'z domenimizdan ochiladi.
  checkTrue('2) nisbiy havola o‘zgarmaydi', videoPosterSrc('/uploads/s.mp4').startsWith('/uploads/'));
}

// ── 3) RASM HECH QACHON YASHIRILMAYDI ────────────────────────────────
// Eng muhim qoida. Ilgari media `ready` bo'lgunicha `opacity:0` bilan
// yashirilardi, ya'ni ko'rinish BRAUZER HODISASIGA tayanardi. Hodisa
// kelmasa (osilgan so'rov) rasm abadiy ko'rinmas bo'lib qolardi.
{
  const img = /<img[\s\S]*?\/>/.exec(thumb);
  checkTrue('3) <img> topildi', !!img);
  checkTrue('3) <img> yashirilmaydi (opacity/visibility/display yo‘q)',
    !!img && !/opacity|visibility|display\s*:/.test(img[0]));
  checkTrue('3) <img> da loading="lazy" yo‘q', !/loading=\{?['"]?lazy/.test(thumb));
  // Video esa kadr kelgunicha yopiq: bo'sh `<video>` QORA chizib
  // ostidagi yozuvni bosib qo'yardi.
  checkTrue('3) video kadrga qarab ochiladi', /opacity:\s*state === 'ok'/.test(thumb));
}

// ── 4) HAR IKKALA MEDIADA HODISALAR ──────────────────────────────────
{
  checkTrue('4) rasm onLoad bor', /<img[\s\S]*?onLoad=\{ok\}/.test(thumb));
  checkTrue('4) rasm onError bor', /<img[\s\S]*?onError=\{bad\}/.test(thumb));
  checkTrue('4) video onLoadedData bor', /<video[\s\S]*?onLoadedData=\{ok\}/.test(thumb));
  checkTrue('4) video onError bor', /<video[\s\S]*?onError=\{bad\}/.test(thumb));
  // Kesh dan kelgan media hodisani o'tkazib yuborishi mumkin —
  // element holati O'ZIDAN ham o'qiladi.
  checkTrue('4) rasm holati elementdan ham o‘qiladi', /el\.complete && el\.naturalWidth > 0/.test(thumb));
  checkTrue('4) video holati elementdan ham o‘qiladi', /el\.readyState >= 2/.test(thumb));
  checkTrue('4) video xatosi elementdan ham o‘qiladi', /el\.error/.test(thumb));
}

// ── 5) JAVOBSIZ SO'ROV — VAQTNI O'ZIMIZ O'LCHAYMIZ ───────────────────
// Brauzer osilgan so'rov uchun hodisa BERMAYDI. Shuning uchun hodisani
// kutib o'tirish yetarli emas.
{
  checkTrue('5) kutish chegarasi bor', /MEDIA_TIMEOUT_MS\s*=\s*\d+/.test(thumb));
  checkTrue('5) chegara oqilona (3..20 s)', (() => {
    const m = /MEDIA_TIMEOUT_MS\s*=\s*(\d+)/.exec(thumb);
    return m && Number(m[1]) >= 3000 && Number(m[1]) <= 20000;
  })());
  checkTrue('5) setTimeout ishlatiladi', /setTimeout\(/.test(thumb));
  checkTrue('5) taymer tozalanadi (oqma yo‘q)', /clearTimeout\(/.test(thumb));
  checkTrue('5) bir marta qayta urinadi', /attempt === 0/.test(thumb) && /setAttempt\(1\)/.test(thumb));
  // Cheksiz qayta urinish bo'lmasin.
  checkTrue('5) qayta urinish CHEKLANGAN', !/setAttempt\(\(a\)/.test(thumb) && !/attempt \+ 1/.test(thumb));
  checkTrue('5) qayta urinishda manzil yangilanadi', /retryUrl/.test(thumb));
}

// ── 6) SABAB KONSOLGA ────────────────────────────────────────────────
{
  const warn = /console\.warn\('\[media\][^']*',\s*\{([^}]*)\}/.exec(thumb);
  checkTrue('6) console.warn bor', !!warn);
  for (const f of ['id', 'kind', 'url', 'reason', 'attempt']) {
    checkTrue(`6) konsolda "${f}" bor`, !!warn && new RegExp(`\\b${f}\\b`).test(warn[1]));
  }
  // Har yiqilish turi O'Z sababi bilan yoziladi.
  for (const r of ['load_failed', 'timeout', 'timeout_retry']) {
    checkTrue(`6) "${r}" sababi bor`, thumb.includes(`'${r}'`));
  }
}

// ── 7) QATLAM HAR DOIM VA MATN BILAN ─────────────────────────────────
// Telefonda konsol ochib bo'lmaydi — sabab EKRANNING O'ZIDA ko'rinsin.
{
  checkTrue('7) qatlam SHARTSIZ chiziladi',
    /<span className=\{`mt-ph/.test(thumb) && !/&&\s*\(?\s*<span className=\{`mt-ph/.test(thumb));
  checkTrue('7) qatlamda belgi bor', /<b>\{mark\}<\/b>/.test(thumb));
  checkTrue('7) qatlamda matn bor', /<i>\{label\}<\/i>/.test(thumb));
  // Uch holatning HAR BIRI uchun alohida matn.
  const texts = ['Media ochilmadi', 'Media javob bermadi', 'Video', 'Rasm'];
  for (const x of texts) checkTrue(`7) "${x}" matni bor`, thumb.includes(`t('${x}')`));
  check('7) matnlar takrorlanmaydi', new Set(texts).size, texts.length);
  checkTrue('7) xato holati alohida sinf', /is-err/.test(thumb));
  checkTrue('7) javobsiz holat alohida sinf', /is-slow/.test(thumb));
  // Tashqi kuzatuv uchun holat DOM da ham ko'rinadi.
  checkTrue('7) holat data-atributda', /data-media-state=/.test(thumb));
}

// ── 8) QATLAMLAR TARTIBI — CSS ───────────────────────────────────────
// Yozuv ENG OSTDA, media USTIDA. Teskari bo'lsa yozuv rasmni bosardi.
{
  checkTrue('8) .mt-ph uslubi bor', css.includes('.mt-ph{'));
  checkTrue('8) qatlam katakni to‘liq qoplaydi', /\.mt-ph\{[^}]*inset:0/.test(css));
  checkTrue('8) qatlam eng ostda (z-index:0)', /\.mt-ph\{[^}]*z-index:0/.test(css));
  checkTrue('8) qatlam foni SHAFFOF EMAS', /\.mt-ph\{[^}]*background:var\(/.test(css));
  checkTrue('8) media qatlam ustida (z-index:1)', /\.mt-media\{[^}]*z-index:1/.test(css));
  checkTrue('8) media foni shaffof', /\.mt-media\{[^}]*background:transparent/.test(css));
  checkTrue('8) xato holati uslubi bor', css.includes('.mt-ph.is-err{'));
  checkTrue('8) javobsiz holat uslubi bor', css.includes('.mt-ph.is-slow{'));
  // Post kartasining media joyi barqaror o'lchamda bo'lsin — media
  // yiqilsa karta yig'ilib qolmasin.
  checkTrue('8) post media joyi o‘lchamini saqlaydi', /\.mt-post\{[^}]*aspect-ratio/.test(css));
}

// ── 9) KONTENT RO'YXATLARI XOM <img>/<video> CHIZMASIN ───────────────
// Yangi ro'yxat qo'shilganda eski xato qaytmasin: media ko'rsatadigan
// joylar MediaThumb dan o'tishi shart.
{
  const GUARDED = [
    'src/components/StoryGrid.jsx',
    'src/pages/ProfilePage.jsx',
  ];
  for (const rel of GUARDED) {
    const src = stripComments(read(rel));
    // Faqat story/post ro'yxati qismidagi media muhim: ular
    // `MediaThumb` orqali ketishi kerak.
    checkTrue(`9) ${rel} MediaThumb ishlatadi`, /<MediaThumb/.test(src));
  }
  const grid = stripComments(read('src/components/StoryGrid.jsx'));
  checkTrue('9) StoryGrid da xom <img> yo‘q', !/<img\s/.test(grid));
  checkTrue('9) StoryGrid da xom <video> yo‘q', !/<video\s/.test(grid));
}

// ── 10) MediaThumb HAMMA JOYDAN TOPILADI ─────────────────────────────
// "Yozilgan, lekin hech kim chaqirmaydi" holati bo'lmasin.
{
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.jsx?$/.test(name)) files.push(full);
    }
  })(join(ROOT, 'src'));
  const users = files.filter((f) => !f.endsWith('MediaThumb.jsx')
    && /from '.*MediaThumb\.jsx'/.test(readFileSync(f, 'utf8')));
  checkTrue(`10) MediaThumb ishlatilyapti (${users.length} joy)`, users.length >= 2);
}

done('Global media qo‘riqchisi');
