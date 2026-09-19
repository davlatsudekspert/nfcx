// NO-OP AUDITI — BOSILADI, LEKIN HECH NARSA QILMAYDI
//
// Bu turdagi xato saytda bir necha marta uchradi va HAR SAFAR
// interfeysga qarab sezilmasdi — tugma bor, bosiladi, hatto chiroyli
// ekran ochiladi, lekin backendda hech narsa o'zgarmaydi:
//
//   • `/api/feed` marshruti `coreApi()` ichida bor edi, lekin uni
//     chaqiradigan tashqi shartga qo'shilmagan — ilovadagi Reels
//     tabi birinchi kundan beri "Topilmadi" ko'rsatgan;
//   • `/api/my/nfc-devices` bilan AYNAN o'sha hol takrorlandi;
//   • biznes profilidagi "Workspace" tugmasi egasini NAMUNA sahifaga
//     olib borardi — u sahifa qattiq yozilgan ma'lumot ustida
//     ishlaydi va birorta so'rov yubormaydi, ya'ni egasi tahrirlab,
//     saqlanmaganini bilmasdi.
//
// Shuning uchun tekshiruv mashinaga topshirildi.
//
//   node scripts/test-noop-audit.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';

const { check, checkTrue, done } = makeChecker();
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.jsx?$/.test(name)) files.push(full);
  }
})(join(ROOT, 'src'));

// ── 1) EGA TUGMALARI HAQIQIY OYNANI OCHSIN ───────────────────────────
// `/business/:code` — NAMUNA sahifa (`DEMO_PRESETS`, nol so'rov).
// Unga EGA sifatida yo'naltirish "tahrirladim" degan yolg'on tuyg'u
// beradi.
{
  const demo = stripComments(read('src/pages/BusinessWorkspacePage.jsx'));
  checkTrue('1) /business sahifasi hamon namuna (so‘rov yubormaydi)',
    !/\bfetch\(|\bdb[A-Z]\w*\(/.test(demo));

  const biz = stripComments(read('src/components/BusinessPublicProfile.jsx'));
  checkTrue('1) biznes profilida egani namuna sahifaga yubormaydi',
    !/navigate\(`\/business\//.test(biz));
  checkTrue('1) egа tugmasi haqiqiy tahrirlash oynasini ochadi',
    /ownerActionUrl\(record\.code, 'edit'\)/.test(biz));
}

// ── 2) EGA AMALLARI BITTA MANBADAN ───────────────────────────────────
// Manzilni har joyda qo'lda yozish ikki xil xulqqa olib kelardi
// (birida `code` yo'qolib, amal BOSHQA NFC ID ga tushardi).
{
  const users = files.filter((f) => /ownerActionUrl/.test(readFileSync(f, 'utf8'))
    && !f.endsWith('OwnerDock.jsx'));
  checkTrue(`2) ownerActionUrl markazlashgan (${users.length} joy)`, users.length >= 2);
  const dock = stripComments(read('src/components/OwnerDock.jsx'));
  // Har amal O'Z NFC ID si bilan ketishi shart.
  checkTrue('2) manzilda code bor', /code=/.test(dock));
  checkTrue('2) manzilda action bor', /action=/.test(dock));
}

// ── 3) BO'SH ISHLOV BERUVCHI ─────────────────────────────────────────
// `onChange={() => {}}` — maydon tahrirlanadigandek ko'rinadi, lekin
// yozilgan narsa hech qayerga bormaydi.
{
  const offenders = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const n = (src.match(/on[A-Z]\w+=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/g) || []).length;
    // Namuna sahifasi ataylab statik — u ro'yxatdan tashqarida.
    if (n && !f.endsWith('BusinessWorkspacePage.jsx')) {
      offenders.push(`${f.replace(ROOT + '/', '')} (${n})`);
    }
  }
  check('3) haqiqiy sahifalarda bo‘sh handler yo‘q', offenders, []);
}

// ── 4) MARSHRUT YETIB BORADIMI ───────────────────────────────────────
// Tashqi shart va ichki ro'yxat MOS bo'lishi kerak; aks holda kod
// yozilgan-u, so'rov u yerga umuman kelmaydi.
{
  const worker = read('hosting/worker.js');
  for (const p of ['/api/feed', '/api/my/nfc-devices']) {
    const inCore = new RegExp(`coreApi[\\s\\S]*?'${p}'`).test(worker);
    checkTrue(`4) "${p}" tashqi shartda bor`, worker.includes(`=== '${p}'`));
    checkTrue(`4) "${p}" ikki joyda ham bor`, inCore);
  }
  // Batafsil tekshiruv alohida testda — u shartni AYNAN bajarib ko'radi.
  checkTrue('4) to‘liq qo‘riqchi mavjud',
    readdirSync(join(ROOT, 'scripts')).includes('api-route-reachability-test.mjs'));
}

// ── 5) MEDIA KO'RSATADIGAN JOY JIM YIQILMASIN ────────────────────────
// Bu ham no-op turi: ekranda joy band, lekin unda hech narsa yo'q.
{
  checkTrue('5) media qatlami qo‘riqchisi bor',
    readdirSync(join(ROOT, 'scripts')).includes('test-media-guard.mjs'));
  const profile = stripComments(read('src/pages/ProfilePage.jsx'));
  checkTrue('5) post ro‘yxati umumiy qatlamdan o‘tadi', /<MediaThumb item=\{p\}/.test(profile));
}

done('No-op auditi');
