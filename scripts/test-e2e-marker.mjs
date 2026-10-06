// E2E MARKERI — YOLG'ON IJOBIY JAVOB BO'LMASIN
//
// Bu qoida PRODUKSIYA postlarini o'chirish uchun ishlatiladi, ya'ni
// xatosi qaytarib bo'lmaydigan. Shuning uchun u alohida, sof
// funksiya sifatida yozilgan va shu yerda har tomondan siqiladi.
//
//   node scripts/test-e2e-marker.mjs
import { makeChecker } from './lib/d1-harness.mjs';
import { isE2eTestCaption, isDeletableE2ePost, isDeletableE2eStory, isExpired } from './lib/e2e-marker.js';

const { check, checkTrue, done } = makeChecker();

// ── 1) HAQIQIY E2E IZOHLARI ──────────────────────────────────────────
{
  const YES = [
    'NOVA E2E TEST — DELETE · post · 2026-09-19T17:05:13.816754Z',
    'NOVA E2E TEST — DELETE · post · 2026-09-19T16:42:54.442871Z',
    'NOVA E2E TEST — DELETE · story · 2026-09-19T10:00:00Z',
    'NOVA E2E TEST - DELETE · post · 2026-09-19T17:05:13.816754Z',   // oddiy tire
    '  NOVA E2E TEST — DELETE · post · 2026-09-19T17:05:13.816754Z  ', // chetdagi bo'shliq
  ];
  for (const c of YES) checkTrue(`1) tanidi: ${c.trim().slice(0, 46)}…`, isE2eTestCaption(c));
}

// ── 2) TEGMASLIK KERAK BO'LGANLAR ────────────────────────────────────
// Eng muhim bo'lim. Bularning BIRORTASI ham "ha" desa, odamning
// haqiqiy posti o'chib ketardi.
{
  const NO = [
    '',
    null,
    undefined,
    'Salom',
    'test',
    'TEST',
    'NOVA',
    'nova e2e test',                                    // faqat so'zlar
    'NOVA E2E TEST',                                    // vaqtsiz
    'NOVA E2E TEST — DELETE',                           // tur va vaqtsiz
    'NOVA E2E TEST — DELETE · post',                    // vaqtsiz
    'NOVA E2E TEST — DELETE · post · kecha',            // vaqt noto‘g‘ri
    'Mening NOVA E2E TEST — DELETE · post · 2026-09-19T17:05:13Z',  // oldida matn
    'NOVA E2E TEST — DELETE · post · 2026-09-19T17:05:13Z qo‘shimcha', // keyin matn
    'NOVA E2E TESTGA O‘XSHASH · post · 2026-09-19T17:05:13Z',
    'DELETE · post · 2026-09-19T17:05:13Z',             // sarlavhasiz
    'Bu post o‘chirilsin, test uchun edi',
    'E2E',
  ];
  for (const c of NO) {
    checkTrue(`2) TEGMAYDI: ${JSON.stringify(String(c).slice(0, 42))}`, !isE2eTestCaption(c));
  }
}

// ── 3) EGALIK SHARTI ─────────────────────────────────────────────────
// Naqshning o'zi YETARLI EMAS. Kimdir shunday izoh yozib, boshqa
// odamning postini "nomzod" qilib qo'yishi mumkin.
{
  const cap = 'NOVA E2E TEST — DELETE · post · 2026-09-19T17:05:13.816754Z';
  const mine = { id: 1, code: 'VIP001', caption: cap };
  const foreign = { id: 2, code: 'ZZZ999', caption: cap };
  const owned = ['VIP001', 'TTS075'];

  checkTrue('3) o‘z profilidagi E2E posti — nomzod', isDeletableE2ePost(mine, owned));
  checkTrue('3) BEGONA profildagisi — TEGILMAYDI', !isDeletableE2ePost(foreign, owned));
  checkTrue('3) kichik harfli kod ham taniladi',
    isDeletableE2ePost({ id: 3, code: 'vip001', caption: cap }, owned));
  checkTrue('3) kodsiz post — TEGILMAYDI', !isDeletableE2ePost({ id: 4, caption: cap }, owned));
  checkTrue('3) egalik ro‘yxati bo‘sh — TEGILMAYDI', !isDeletableE2ePost(mine, []));
  checkTrue('3) egalik ro‘yxati yo‘q — TEGILMAYDI', !isDeletableE2ePost(mine, null));
  // O'z profilidagi HAQIQIY post ham tegilmaydi.
  checkTrue('3) o‘z haqiqiy posti — TEGILMAYDI',
    !isDeletableE2ePost({ id: 5, code: 'VIP001', caption: 'Bugungi ish kuni' }, owned));
  checkTrue('3) izohsiz post — TEGILMAYDI',
    !isDeletableE2ePost({ id: 6, code: 'VIP001', caption: '' }, owned));
  checkTrue('3) obyekt yo‘q — TEGILMAYDI', !isDeletableE2ePost(null, owned));
}

// ── 4) SON BO'YICHA XULOSA ───────────────────────────────────────────
// Aralash ro'yxatdan AYNAN nechtasi tanlanishi kerakligini sanaymiz.
{
  const cap = (n) => `NOVA E2E TEST — DELETE · post · 2026-09-19T17:0${n}:13.816754Z`;
  const posts = [
    { id: 1, code: 'VIP001', caption: cap(1) },
    { id: 2, code: 'VIP001', caption: 'Haqiqiy post' },
    { id: 3, code: 'VIP001', caption: cap(2) },
    { id: 4, code: 'ZZZ999', caption: cap(3) },        // begona
    { id: 5, code: 'TTS075', caption: cap(4) },
    { id: 6, code: 'VIP001', caption: 'test post' },   // "test" so'zi — yetarli emas
    { id: 7, code: 'VIP001', caption: '' },
  ];
  const owned = ['VIP001', 'TTS075'];
  const picked = posts.filter((p) => isDeletableE2ePost(p, owned)).map((p) => p.id);
  check('4) aynan uchtasi tanlandi', picked, [1, 3, 5]);
}

// ── 5) STORY UCHUN HAM AYNAN SHU QOIDA ───────────────────────────────
{
  const cap = 'NOVA E2E TEST — DELETE · story · 2026-09-19T10:00:00Z';
  checkTrue('5) story markeri taniladi', isE2eTestCaption(cap));
  checkTrue('5) o‘z storysi — nomzod',
    isDeletableE2eStory({ id: 1, code: 'VIP001', caption: cap }, ['VIP001']));
  checkTrue('5) begona storyga TEGILMAYDI',
    !isDeletableE2eStory({ id: 2, code: 'ZZZ999', caption: cap }, ['VIP001']));
  checkTrue('5) haqiqiy storyga TEGILMAYDI',
    !isDeletableE2eStory({ id: 3, code: 'VIP001', caption: 'Bugungi kun' }, ['VIP001']));
  checkTrue('5) izohsiz storyga TEGILMAYDI',
    !isDeletableE2eStory({ id: 4, code: 'VIP001', caption: '' }, ['VIP001']));
}

// ── 6) MUDDAT — ALOHIDA VA EHTIYOTKOR SHART ──────────────────────────
// Sana o'qib bo'lmasa "o'tmagan" deb hisoblanadi: noaniq qiymat
// tufayli haqiqiy story o'chib ketmasin.
{
  const now = Date.parse('2026-09-20T12:00:00Z');
  checkTrue('6) kecha tugagan — o‘tgan', isExpired({ expiresAt: '2026-09-19T12:00:00Z' }, now));
  checkTrue('6) bir soniya oldin — o‘tgan', isExpired({ expiresAt: '2026-09-20T11:59:59Z' }, now));
  checkTrue('6) aynan hozir — o‘tgan', isExpired({ expiresAt: '2026-09-20T12:00:00Z' }, now));
  checkTrue('6) bir soatdan keyin — O‘TMAGAN', !isExpired({ expiresAt: '2026-09-20T13:00:00Z' }, now));
  // Noaniq qiymatlar — hech biri "o'tgan" deb hisoblanmaydi.
  for (const v of [undefined, null, '', 'salom', '2026-13-45', 0, {}]) {
    checkTrue(`6) noaniq (${JSON.stringify(v)}) — O‘TMAGAN deb hisoblanadi`,
      !isExpired({ expiresAt: v }, now));
  }
  checkTrue('6) obyekt yo‘q — O‘TMAGAN', !isExpired(null, now));
}

done('E2E markeri');
