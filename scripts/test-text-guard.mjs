// MATN FILTRI (2026-10, hosting/api/text-guard.js):
//   * SEVERE ro'yxat (uz lotin/kirill, ru, en; apostrof turlari) — kontent
//     yaratiladi, lekin `content_pending` (egasidan boshqaga ko'rinmaydi),
//     admin navbatiga `text_block`, Telegram (chastota cheklangan);
//     admin "Tasdiqlash" ochadi, "Rad etish" yashirin qoldiradi, o'chirish
//     o'chiradi; cron (moderation-retry) matn qatoriga tegmaydi;
//   * REVIEW (arab yozuvi, yolg'iz "jihod/xalifalik/kofir") — faqat navbat;
//   * oddiy diniy so'zlar, "Prezident", "saylov", mahsulot matnlari — hech narsa;
//   * izoh va istoriyaga javob ham; profil — faqat navbat;
//   * `textAiCheck` kaliti: o'chiq — Gemini'ga so'rov yo'q; yoqiq — blok
//     `text_ai` pending; xizmat xatosi — o'tkaziladi (fail-open).
//   node scripts/test-text-guard.mjs   (UZ_ADAPTER_TEST=1 ham)
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { textGuardMatch, guardText } from '../hosting/api/text-guard.js';
import { retryUncheckedMedia } from '../hosting/api/moderation-retry.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, resetLimits } = await setupSocial({ TELEGRAM_BOT_TOKEN: 'tg-test', ADMIN_CHAT_ID: '42' });

const realFetch = globalThis.fetch;
const tg = [];
let gemini = null; // null — xizmat ishlamaydi; 'throw' — tarmoq xatosi; aks holda hukm
let geminiCalls = 0;
globalThis.fetch = async (input, init = {}) => {
  const u = String(input?.url || input);
  if (u.startsWith('https://api.telegram.org/')) { tg.push(JSON.parse(init.body).text); return new Response('{"ok":true}'); }
  if (u.includes('generativelanguage.googleapis.com')) {
    geminiCalls++;
    if (gemini === 'throw') throw new Error('network down');
    if (!gemini) return new Response('down', { status: 500 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(gemini) }] } }] }));
  }
  return realFetch(input, init);
};

// ═══ 1. Ro'yxat — mosliklar ═══
const SEV = [
  ['ISIS safiga qo‘shiling', 'extremism'], ['IShID', 'extremism'], ['ИГИЛ', 'extremism'], ['ДАИШ', 'extremism'],
  ['Islomiy davlat', 'extremism'], ['Исламское государство', 'extremism'],
  ['Hizb ut-Tahrir', 'extremism'], ['hizbut-tahrir', 'extremism'], ['Ҳизб ут-Таҳрир', 'extremism'], ['Хизб ут-Тахрир', 'extremism'],
  ['Akromiylar', 'extremism'], ['Акромийлар', 'extremism'],
  ['al-Qaeda', 'extremism'], ['al-Qoida', 'extremism'], ['Аль-Каида', 'extremism'],
  ['Jabhat an-Nusra', 'extremism'], ['Джебхат ан-Нусра', 'extremism'],
  ['Hayʼat Tahrir ash-Sham', 'extremism'], ["Hay'at Tahrir al-Sham", 'extremism'],
  ['Tavhid va jihod katibasi', 'extremism'], ['Катибат таухид валь-джихад', 'extremism'],
  ['Imom Buxoriy jamoati', 'extremism'], ['Имам Бухари джамаат', 'extremism'],
  ['O‘zbekiston Islomiy Harakati', 'extremism'], ['Oʻzbekiston islomiy harakati', 'extremism'], ['Ўзбекистон Ислом Ҳаракати', 'extremism'],
  ['Исламское движение Узбекистана', 'extremism'], ['Islamic Movement of Uzbekistan', 'extremism'],
  ['jihodga chiqing!', 'extremism'], ['kofirlarni o‘ldiring', 'extremism'], ['kofirlarni oʻldiring', 'extremism'],
  ['kofirlarni o`ldiring', 'extremism'], ['kofirlarni o’ldiring', 'extremism'], ['shahid bo‘ling', 'extremism'],
  ['джихад против всех', 'extremism'], ['убивать неверных', 'extremism'], ['kill the infidels', 'extremism'],
  ['porno video', 'sexual'], ['p0rn0', 'sexual'], ['por​no', 'sexual'], ['ПОРНО', 'sexual'], ['xxx video', 'sexual'],
  ['intim xizmat', 'sexual'], ['интим услуги', 'sexual'], ['секс услуги', 'sexual'], ['проститутки', 'sexual'],
  ['fohisha', 'sexual'], ['onlyfans.com/abc', 'sexual'],
  ['закладчик', 'drugs'], ['мефедрон', 'drugs'], ['меф есть', 'drugs'], ['гашиш', 'drugs'], ['спайс', 'drugs'], ['spays bor', 'drugs'],
  ['nasha sotaman', 'drugs'], ['наркотики купить', 'drugs'], ['кокаин', 'drugs'], ['героин', 'drugs'], ['heroin', 'drugs'],
  ['portlatib yuboraman', 'violence'], ['взорву', 'violence'], ['bomba qilaman', 'violence'], ["I'll bomb it", 'violence'],
];
const sevFail = SEV.filter(([t, c]) => { const m = textGuardMatch(t); return m?.tier !== 'severe' || m.category !== c; });
check('1) severe: barcha mosliklar', sevFail.map(([t]) => t), []);
const REV = [
  ['jihod haqida', 'religious_political'], ['Джихад', 'religious_political'], ['jihad', 'religious_political'],
  ['xalifalik', 'religious_political'], ['Халифат', 'religious_political'], ['caliphate', 'religious_political'],
  ['shariat davlati', 'religious_political'], ['kofir', 'religious_political'], ['кафир', 'religious_political'],
  ['закладка для книг', 'drugs'], ['بسم الله الرحمن الرحيم', 'arabic_script'], ['بِسْمِ', 'arabic_script'],
];
const revFail = REV.filter(([t, c]) => { const m = textGuardMatch(t); return m?.tier !== 'review' || m.category !== c; });
check('1) review: barcha mosliklar', revFail.map(([t]) => t), []);
const NEG = [
  'Bismillah', 'Bismillahir rohmanir rohim', 'Assalomu alaykum', 'Ассалому алайкум', 'Ramazon muborak', 'Ramazon hayiti', 'Hayit muborak',
  'Alloh rozi bo‘lsin', 'Аллоҳ', 'masjid', 'Masjidga boramiz', 'namoz vaqtlari', 'Juma namozi', 'Qur’on tilovati',
  'Prezident nutqi', 'Президент', 'saylov', 'Saylov uchastkasi', 'Mustaqillik kuni muborak', 'Navro‘z',
  'Ishidan qaytdi', 'Islomiy davlatlar hamkorligi tashkiloti', 'Imom Buxoriy majmuasi', 'Mahalla qoidalari', 'Qoida bo‘yicha',
  'jihozlar arzon', 'shahid bo‘ldi', 'pornografik kontent taqiqlanadi', '90 xxx xx xx', 'XXXL ko‘ylak',
  'героиня фильма', 'heroine', 'наша сотрудница', 'Taliban', 'spice market', 'Iphone 15 Pro 256GB — 12 000 000 so‘m',
  'Yangi kolleksiya! 50% chegirma', 'Доставка по Ташкенту бесплатно', 'Best coffee in town', '2020-yil, 100 000 so‘m',
  'Sikl bo‘yicha', 'Toshkent shahar', 'Ishonch telefoni',
];
check('1) negatives: hech narsa', NEG.filter((t) => textGuardMatch(t) !== null), []);

// ═══ 2. Post — SEVERE: yaratiladi, lekin yashirin ═══
const post = (caption, ck = cookie.user) => call('/api/records/VIP001/posts', { method: 'POST', cookie: ck, json: { agreed: true, imageUrl: '/uploads/tg1.jpg', caption } });
const listPosts = async (ck) => ((await call('/api/records/VIP001/posts', { cookie: ck })).body?.posts || []);
const reports = (reason) => sqlite.prepare(`SELECT * FROM content_reports WHERE reason = ? ORDER BY id`).all(reason);
const pendingRows = (kind, id) => sqlite.prepare(`SELECT url FROM content_pending WHERE kind = ? AND id = ?`).all(kind, Number(id)).map((x) => x.url);

let r = await post('Hizb ut-Tahrir safiga qo‘shiling');
check('2) severe post: 201 + pending + pendingReason', [r.status, r.body?.pending, r.body?.pendingReason], [201, true, 'text']);
const p1 = r.body.id;
check('2) content_pending text row', pendingRows('post', p1), [`text:post:${p1}`]);
const tb = reports('text_block');
check('2) text_block report', tb.map((x) => [x.target_kind, x.target_id, x.owner_code, x.reporter_ip, x.status, x.note]),
  [['post', String(p1), 'VIP001', 'system', 'new', 'Avtomatik: extremism "hizb ut-tahrir"']]);
checkTrue('2) admin telegram alert', tg.some((t) => /Matn yashirildi: post #\d+ \(ekstremizm/.test(t)));
const tgN = tg.length;
checkTrue('2) other: hidden', !(await listPosts(cookie.other)).some((p) => p.id === p1));
check('2) owner: pending:true', (await listPosts(cookie.user)).find((p) => p.id === p1)?.pending, true);
r = await call('/api/feed', { cookie: cookie.other });
checkTrue('2) feed hides', !(r.body?.feed || []).some((p) => p.kind === 'post' && p.id === p1));
check('2) post page 404', (await call(`/post/${p1}`)).status, 404);
r = await post('Assalomu alaykum! Ramazon muborak, Bismillah');
check('2) religious greeting: not pending', [r.status, r.body?.pending, 'pendingReason' in (r.body || {})], [201, false, false]);
const cleanPost = r.body.id;
r = await post('гашиш есть');
check('2) second severe post pending', r.body?.pending, true);
const p2 = r.body.id;
check('2) second alert rate limited', tg.length, tgN);
check('2) two text_block reports', reports('text_block').length, 2);
check('2) no text_flag/review for clean', sqlite.prepare(`SELECT COUNT(*) AS n FROM content_reports WHERE target_id = ? AND target_kind = 'post'`).get(String(cleanPost)).n, 0);
resetLimits();

// ═══ 3. Admin: rad etish — yashirin; tasdiqlash — ochiladi; cron tegmaydi ═══
r = await call('/api/admin/reports?status=new', { cookie: cookie.admin });
const rep1 = (r.body?.reports || []).find((x) => x.reason === 'text_block' && x.targetId === String(p1));
check('3) admin sees text_block + preview', [rep1?.targetKind, /Hizb ut-Tahrir/.test(rep1?.preview?.text || '')], ['post', true]);
r = await call(`/api/admin/reports/${rep1.id}`, { method: 'PATCH', cookie: cookie.admin, json: { status: 'rejected' } });
check('3) reject ok', r.status, 200);
checkTrue('3) rejected -> still hidden', !(await listPosts(cookie.other)).some((p) => p.id === p1));
const H = { nowTs: () => new Date().toISOString().replace('T', ' ').replace('Z', '+00') };
gemini = { allowed: true, category: 'none' };
await retryUncheckedMedia({ ...env, GEMINI_API_KEY: 'test-key' }, H);
check('3) cron recheck does not clear text pending', pendingRows('post', p1), [`text:post:${p1}`]);
r = await call(`/api/admin/reports/${rep1.id}`, { method: 'PATCH', cookie: cookie.admin, json: { status: 'resolved' } });
check('3) approve ok', r.status, 200);
checkTrue('3) approved -> visible', (await listPosts(cookie.other)).some((p) => p.id === p1 && p.pending === false));
check('3) post page 200', (await call(`/post/${p1}`)).status, 200);
// O'chirish — admin "Kontentni o'chirish".
r = await call(`/api/admin/content/post/${p2}`, { method: 'DELETE', cookie: cookie.admin });
check('3) admin delete ok', r.status, 200);
check('3) deleted: row + pending gone', [sqlite.prepare(`SELECT COUNT(*) AS n FROM posts WHERE id = ?`).get(p2).n, pendingRows('post', p2)], [0, []]);
check('3) report auto-resolved', reports('text_block').find((x) => x.target_id === String(p2))?.status, 'resolved');

// ═══ 4. Tahrir (qayta tekshiruv) — tasdiqlangan kontent yana yashirinadi ═══
let g = await guardText(env, { kind: 'post', id: p1, texts: ['Yangi matn: мефедрон'], ownerCode: 'VIP001' });
check('4) re-check after edit -> pending again', [g.pending, g.category], [true, 'drugs']);
checkTrue('4) hidden again', !(await listPosts(cookie.other)).some((p) => p.id === p1));
check('4) new open report (old one resolved)', reports('text_block').filter((x) => x.target_id === String(p1)).map((x) => x.status), ['resolved', 'new']);
g = await guardText(env, { kind: 'post', id: p1, texts: ['yana гашиш'], ownerCode: 'VIP001' });
check('4) open report not duplicated', reports('text_block').filter((x) => x.target_id === String(p1)).length, 2);
// Kompaniya profili tahriri — yashirilmaydi, faqat navbat.
r = await call('/api/companies/ACMEUZ', { method: 'PATCH', cookie: cookie.user, json: { description: 'Akromiylar kitoblari' } });
check('4) company edit saved', r.status, 200);
check('4) company profile text_block (no hide)', [reports('text_block').filter((x) => x.target_kind === 'company').map((x) => x.target_id), pendingRows('company', 0)], [['ACMEUZ'], []]);

// ═══ 5. Izoh ═══
const cmt = (body, ck = cookie.other, id = cleanPost) => call(`/api/comments/post/${id}`, { method: 'POST', cookie: ck, json: { body } });
const listCmt = async (ck, id = cleanPost) => (await call(`/api/comments/post/${id}`, { cookie: ck })).body;
const notifs = () => sqlite.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE kind = 'comment'`).get().n;
r = await cmt('Zo‘r post!');
check('5) clean comment', [r.status, r.body?.comment?.pending, r.body?.total], [201, undefined, 1]);
const n0 = notifs();
r = await cmt('kofirlarni o‘ldiring');
check('5) severe comment: 201 + pending', [r.status, r.body?.comment?.pending, r.body?.comment?.pendingReason, r.body?.pending], [201, true, 'text', true]);
const c1 = r.body.comment.id;
check('5) no notification for hidden comment', notifs(), n0);
let lc = await listCmt(cookie.user);
check('5) post owner: hidden + total excludes', [lc.comments.some((c) => c.id === c1), lc.total], [false, 1]);
lc = await listCmt(cookie.other);
check('5) author sees own pending comment', lc.comments.find((c) => c.id === c1)?.pending, true);
lc = await listCmt(null);
checkTrue('5) anon: hidden', !lc.comments.some((c) => c.id === c1));
r = await call(`/api/feed`, { cookie: cookie.user });
check('5) feed comment count excludes pending', (r.body?.feed || []).find((p) => p.kind === 'post' && p.id === cleanPost)?.commentCount, 1);
r = await call('/api/admin/reports?status=new', { cookie: cookie.admin });
const repC = (r.body?.reports || []).find((x) => x.reason === 'text_block' && x.targetKind === 'comment');
check('5) admin: comment report + preview', [repC?.targetId, /kofirlarni/.test(repC?.preview?.text || '')], [String(c1), true]);
await call(`/api/admin/reports/${repC.id}`, { method: 'PATCH', cookie: cookie.admin, json: { status: 'resolved' } });
lc = await listCmt(cookie.user);
check('5) approved comment visible', [lc.comments.some((c) => c.id === c1 && !c.pending), lc.total], [true, 2]);
r = await cmt('ИГИЛ лучшие');
const c2 = r.body.comment.id;
check('5) second severe comment pending', pendingRows('comment', c2), [`text:comment:${c2}`]);
r = await call(`/api/admin/comments/${c2}`, { method: 'DELETE', cookie: cookie.admin, json: { reason: 'test' } });
check('5) admin delete (reject) ok', r.status, 200);
check('5) pending row cleaned on delete', pendingRows('comment', c2), []);
resetLimits();

// ═══ 6. Istoriya, kompaniya posti, ko'rgazma, istoriyaga javob ═══
r = await call('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/st1.jpg', caption: 'взорву всё' } });
check('6) story severe pending', [r.status, r.body?.pending, r.body?.pendingReason], [201, true, 'text']);
const s1 = r.body.id;
r = await call('/api/records/VIP001/stories', { cookie: cookie.other });
checkTrue('6) story hidden from other', !(r.body?.stories || []).some((s) => s.id === s1));
checkTrue('6) story report (kind story)', reports('text_block').some((x) => x.target_kind === 'story' && x.target_id === String(s1)));
r = await call('/api/companies/ACMEUZ/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, showcase: true, mediaUrls: ['/uploads/sc1.jpg'], title: 'Spays bor, arzon' } });
check('6) showcase title severe -> pending', [r.status, r.body?.post?.pending, r.body?.post?.pendingReason], [201, true, 'text']);
const cp1 = r.body.post.id;
r = await call('/api/companies/ACMEUZ/posts', { cookie: cookie.other });
checkTrue('6) company post hidden', !(r.body?.posts || []).some((p) => p.id === cp1));
r = await call('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/st2.jpg', caption: 'Hayit muborak' } });
const s2 = r.body.id;
check('6) clean story', r.body?.pending, undefined);
r = await call(`/api/stories/story/${s2}/reply`, { method: 'POST', cookie: cookie.other, json: { text: 'Narxi qancha?' } });
check('6) clean reply', [r.status, r.body?.reply?.pending], [201, undefined]);
r = await call(`/api/stories/story/${s2}/reply`, { method: 'POST', cookie: cookie.other, json: { text: 'интим услуги звоните' } });
check('6) severe reply: 201 + pending', [r.status, r.body?.reply?.pending], [201, true]);
const rp1 = r.body.reply.id;
r = await call('/api/my/story-replies', { cookie: cookie.user });
check('6) recipient inbox hides pending reply', (r.body?.items || []).map((x) => x.text), ['Narxi qancha?']);
r = await call(`/api/stories/story/${s2}/viewers`, { cookie: cookie.user });
check('6) replyCount excludes pending', r.body?.replyCount, 1);
r = await call('/api/admin/reports?status=new', { cookie: cookie.admin });
const repR = (r.body?.reports || []).find((x) => x.targetKind === 'story_reply');
check('6) admin story_reply preview', [repR?.targetId, repR?.preview?.text], [String(rp1), 'интим услуги звоните']);
r = await call(`/api/admin/content/story_reply/${rp1}`, { method: 'DELETE', cookie: cookie.admin, json: {} });
check('6) admin delete reply', [r.status, r.body?.ok], [200, true]);
check('6) reply gone + archived + pending cleaned', [
  sqlite.prepare(`SELECT COUNT(*) AS n FROM story_replies WHERE id = ?`).get(rp1).n,
  sqlite.prepare(`SELECT body FROM content_archive WHERE kind = 'story_reply'`).get()?.body,
  pendingRows('story_reply', rp1),
], [0, 'интим услуги звоните', []]);
resetLimits();

// ═══ 7. REVIEW — faqat navbat ═══
r = await post('Jihod so‘zining ma’nosi haqida maqola');
check('7) review word: not pending', r.body?.pending, false);
const rv1 = r.body.id;
r = await post('بسم الله الرحمن الرحيم — yangi do‘kon ochildi');
check('7) arabic script: not pending', r.body?.pending, false);
const rv2 = r.body.id;
check('7) text_review reports', reports('text_review').filter((x) => [String(rv1), String(rv2)].includes(x.target_id)).map((x) => x.note),
  ['Avtomatik: religious_political "jihod"', 'Avtomatik: arabic_script "بسم"']);
checkTrue('7) review content visible', (await listPosts(cookie.other)).filter((p) => p.id === rv1 || p.id === rv2).length === 2);
r = await cmt('xalifalik haqida', cookie.other, rv1);
check('7) review comment visible', [r.body?.comment?.pending, (await listCmt(cookie.user, rv1)).total], [undefined, 1]);
resetLimits();

// ═══ 8. AI tekshiruvi (`textAiCheck`) ═══
env.GEMINI_API_KEY = 'test-key';
gemini = { allowed: false, category: 'extremism' };
geminiCalls = 0;
r = await post('Bugun yangi mahsulotlar keldi, marhamat!');
check('8) flag off -> no Gemini call, allowed', [r.body?.pending, geminiCalls], [false, 0]);
r = await call('/api/app/config');
checkTrue('8) textAiCheck not in public config', !('textAiCheck' in (r.body?.flags || {})));
r = await call('/api/admin/flags', { method: 'PUT', cookie: cookie.admin, json: { textAiCheck: true } });
check('8) admin enables textAiCheck', [r.status, r.body?.flags?.textAiCheck], [200, true]);
r = await post('Bugun yangi mahsulotlar keldi, marhamat!');
check('8) AI block -> pending', [r.body?.pending, r.body?.pendingReason, geminiCalls], [true, 'text', 1]);
const ai1 = r.body.id;
check('8) text_ai report', reports('text_ai').map((x) => [x.target_kind, x.target_id, x.note]), [['post', String(ai1), 'Avtomatik (AI): extremism']]);
checkTrue('8) AI-blocked hidden', !(await listPosts(cookie.other)).some((p) => p.id === ai1));
const repAi = (await call('/api/admin/reports?status=new', { cookie: cookie.admin })).body.reports.find((x) => x.reason === 'text_ai');
await call(`/api/admin/reports/${repAi.id}`, { method: 'PATCH', cookie: cookie.admin, json: { status: 'resolved' } });
checkTrue('8) AI block approved -> visible', (await listPosts(cookie.other)).some((p) => p.id === ai1));
geminiCalls = 0;
r = await post('Salom!');
check('8) short text -> no Gemini call', [r.body?.pending, geminiCalls], [false, 0]);
r = await cmt('Bu juda uzun izoh matni, lekin AI tekshirmaydi');
check('8) comments -> no Gemini call', [r.body?.comment?.pending, geminiCalls], [undefined, 0]);
r = await post('Hizb ut-Tahrir bilan bog‘liq uzun matn');
check('8) severe hit -> list only, no Gemini call', [r.body?.pending, geminiCalls], [true, 0]);
gemini = null;
r = await post('Bugun yangi mahsulotlar keldi, marhamat!');
check('8) Gemini 500 -> allowed (fail-open)', [r.body?.pending, geminiCalls], [false, 1]);
gemini = 'throw';
r = await post('Bugun yangi mahsulotlar keldi, marhamat!');
check('8) Gemini network error -> allowed', [r.status, r.body?.pending, geminiCalls], [201, false, 2]);
gemini = { allowed: true, category: 'none' };
r = await call('/api/companies/ACMEUZ/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/cp9.jpg', caption: 'Yangi kolleksiya keldi, 30% chegirma' } });
check('8) AI allowed company post', [r.status, r.body?.post?.pending, geminiCalls], [201, false, 3]);
env.MODERATION_OFF = '1';
r = await post('Bugun yangi mahsulotlar keldi, marhamat!');
check('8) MODERATION_OFF -> no Gemini call', [r.body?.pending, geminiCalls], [false, 3]);
delete env.MODERATION_OFF;
delete env.GEMINI_API_KEY;

globalThis.fetch = realFetch;
done();
