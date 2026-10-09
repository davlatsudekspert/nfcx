// hosting/api/text-guard.js — MATN FILTRI (2026-10).
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasining talabi: rasm/video kabi MATN ham avtomatik tekshirilsin —
// taqiqlangan tashkilotlar nomi, jihodga/qotillikka chaqiriq, 18+ xizmat,
// giyohvand savdosi va portlatish tahdidi ommaga chiqmasin.
//
// ═══ UCH DARAJA ═══
//
//   * SEVERE (`text_block`) — aniq ro'yxat (pastda). Kontent YARATILADI,
//     lekin `content_pending` ga yoziladi (url = `text:<kind>:<id>`) va
//     egasidan boshqaga ko'rinmaydi; admin navbatiga `text_block`,
//     Telegram ogohlantirishi (chastotasi cheklangan). Admin "Tasdiqlash"
//     (PATCH resolved) — ochiladi; "Rad etish" (rejected) — yashirin
//     qoladi; "Kontentni o'chirish" — o'chiriladi. Cron (moderation-retry.js)
//     faqat `/uploads/...` qatorlarini tozalaydi — matn qatoriga TEGMAYDI.
//   * REVIEW (`text_review`) — arab yozuvi (3+ harf ketma-ket) va yolg'iz
//     diniy-siyosiy so'zlar (jihod, xalifalik, kofir...). BLOKLAMAYDI —
//     faqat admin navbatiga (xuddi `text_flag` kabi).
//   * AI (`text_ai`, ixtiyoriy) — `textAiCheck` kaliti (flags.js, standart
//     O'CHIQ) yoqilgan va Gemini kaliti bor bo'lsa: post/Reels/ko'rgazma
//     matni (izoh EMAS — narx tejaladi) image-moderation.js `moderateText`
//     bilan tekshiriladi. Bloklasa — SEVERE bilan bir xil pending yo'li.
//     Xizmat ishlamasa — O'TKAZILADI (fail-open).
//
// ═══ RO'YXAT QOIDALARI ═══
//
// Har ildiz SO'Z BOSHIDAN (oldida harf/raqam bo'lmasligi shart — kirill
// uchun ham; `\b` faqat lotinga ishlaydi). Qisqa va ko'p ma'noli so'zlar
// oxiri ham chegaralangan (masalan "ishid" — "ishidan" EMAS). Oddiy diniy
// so'zlar (Bismillah, Assalomu alaykum, Ramazon, Hayit, Alloh, masjid,
// namoz), "Taliban" (yangiliklarda ishlatiladi), "Prezident", "saylov"
// hech qaysi darajaga tushmaydi (scripts/test-text-guard.mjs).
//
// Matn avval normallashtiriladi: kichik harf, ё→е, o'zbek kirill
// ҳ/қ/ғ/ў → х/к/г/у, apostrof turlari (ʻ ʼ ` ‘ ’ ′ ´) → ', ko'rinmas
// belgilar olib tashlanadi, lotin harfi yonidagi 0 → o ("p0rno").

import {
  ensureGuardSchema, ensureReportsTable, alertOnce,
} from './content-guard.js';
import { moderationEnabled, moderateText } from './image-moderation.js';
import { getFlags, peekFlags } from './flags.js';

export const TEXT_PENDING_REASONS = ['text_block', 'text_ai'];
export const TEXT_AI_MIN_LEN = 12;
export const TEXT_BLOCK_ALERT_MS = 30 * 60_000;
const TEXT_REVIEW_PER_OWNER_DAY = 20;

// ═══ NORMALLASHTIRISH ═══════════════════════════════════════════════

const APOS_RE = /[ʻʼ`‘’′´ʹʽ]/g;
const INVISIBLE_RE = /[­​-‏⁠﻿]/g;
const UZ_CYR = { 'ҳ': 'х', 'қ': 'к', 'ғ': 'г', 'ў': 'у' };

export function normalizeGuardText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(INVISIBLE_RE, '')
    .replace(/ё/g, 'е')
    .replace(/[ҳқғў]/g, (c) => UZ_CYR[c])
    .replace(APOS_RE, "'")
    // Faqat lotin harfi YONIDAGI 0 — "2020", "100 000" o'zgarmaydi.
    .replace(/(?<=[a-z])0|0(?=[a-z])/g, 'o');
}

// ═══ RO'YXAT ════════════════════════════════════════════════════════

const B = String.raw`(?<![\p{L}\p{N}_])`;   // so'z boshi
const E = String.raw`(?![\p{L}\p{N}])`;      // so'z oxiri (kerak joyda)
const S = String.raw`[\s\-_.]*`;             // ixtiyoriy ajratgich
const S1 = String.raw`[\s\-_.]+`;            // kamida bitta ajratgich

// [kategoriya, [ildizlar]] — kategoriyalar image-moderation.js
// BLOCK_CATEGORIES bilan bir xil nomlanadi (admin bir xil o'qisin).
const SEVERE = [
  ['extremism', [
    // Taqiqlangan tashkilotlar.
    String.raw`(?:isis|isil|igil|ishid|daish|daesh|игил|ишид|даиш)${E}`,
    String.raw`islomiy${S1}davlat(?:ga|ning|ni)?${E}`,
    String.raw`исломий${S1}давлат(?:га|нинг|ни)?${E}`,
    String.raw`исламско(?:е|го|му|м)${S1}государств(?:о|а|у|ом|е)${E}`,
    String.raw`islamic${S1}state${E}`,
    String.raw`[hx]izb${S}(?:ut|at|ul|u)?${S}ta[hx]rir`,
    String.raw`хизб${S}(?:ут|ат|ул|у)?${S}тахрир`,
    String.raw`akromiy(?:lar|chi)`, String.raw`akramiy(?:a|ya|lar)`,
    String.raw`акромий(?:лар|чи)`, String.raw`акрами(?:я|йцы)`,
    String.raw`al[\s\-]*(?:qaeda|qaida|qa'ida|qoida|kaida|qoeda)${E}`,
    String.raw`аль?[\s\-]*(?:каида|каеда|коида)${E}`,
    String.raw`jab[hx]at${S}(?:an|al|un)?${S}nusra`,
    String.raw`(?:джеб|джаб|жаб)х?ат${S}(?:ан|аль|ал|ун)?${S}нусра`,
    String.raw`фронт${S1}ан${S}нусра`, String.raw`nusra${S1}front`,
    String.raw`hay'?a?t${S}ta[hx]rir${S}(?:ash|as|al|ush)?${S}sh?am${E}`,
    String.raw`хайъ?'?[ая]т${S}тахрир${S}(?:аш|ас|аль)?${S}ш[ая]м${E}`,
    String.raw`ta[vw]hid${S1}(?:va|wa)l?${S}(?:jihod|jihad)`,
    String.raw`та[ву]х?ид${S1}в[аa]ль?${S}д?жи[хx][аo]д`,
    String.raw`im[oa]m${S1}(?:al${S})?bu(?:x|kh|h)[oa]r[iy]y?${S1}(?:jamoati|jamaati|jamaat|jamoat)${E}`,
    String.raw`(?:jamoati|jamaati|jamaat)${S1}im[oa]ma?${S1}(?:al${S})?bu(?:x|kh|h)[oa]r[iy]`,
    String.raw`им[оа]м${S1}(?:аль?${S})?бу[хx][оа]рий?${S1}(?:жамоати|джамаат|жамоат)${E}`,
    String.raw`джама[ау]?ата?${S1}имама?${S1}(?:аль${S})?бухари`,
    String.raw`o'?zbekiston${S1}islomiy${S1}harakati`,
    String.raw`узбекистон${S1}ислом(?:ий)?${S1}харакати`,
    String.raw`исламско\p{L}*${S1}движени\p{L}*${S1}узбекистана`,
    String.raw`islamic${S1}movement${S1}of${S1}uzbekistan`,
    // Zo'ravonlikka chaqiriq.
    String.raw`jihodga${S1}(?:chiq|qo'?shil)`,
    String.raw`жиходга${S1}(?:чик|кушил)`,
    String.raw`kofirlar(?:ni|ga)${S1}(?:o'?ldir|o'?lim)`,
    String.raw`кофирлар(?:ни|га)${S1}(?:улдир|улим)`,
    String.raw`shahid${S1}bo'?l(?:ing|inglar|aylik|amiz|gin)${E}`,
    String.raw`шахид${S1}бул(?:инг|инглар|айлик|амиз|гин)${E}`,
    String.raw`джихад${S1}против`,
    String.raw`(?:убива(?:ть|йте|й)|убейте|убей|режьте|резать)${S1}неверн`,
    String.raw`смерть${S1}неверн`,
    String.raw`(?:вступа(?:й|йте)|присоединя(?:йся|йтесь))${S1}(?:к${S1})?джихад`,
    String.raw`kill${S1}(?:the${S1})?(?:infidels|kafirs|kuffar|unbelievers)`,
    String.raw`(?:join|wage)${S1}(?:the${S1})?jihad`,
    String.raw`death${S1}to${S1}(?:the${S1})?(?:infidels|kafirs|kuffar)`,
  ]],
  ['sexual', [
    // "pornografik/порнография" (qoidalar matnidagi atama) — EMAS.
    String.raw`porn(?!ogra)`, String.raw`порн(?!огра)`,
    // "xxx" yolg'iz emas — telefon niqobi ("90 xxx xx xx") va XXXL o'lchami bor.
    String.raw`xxx(?=${S}(?:video|vidyo|видео|sex|секс|porn|порн|film|фильм|com${E}))`,
    String.raw`intim${S1}(?:xizmat|uslug)`, String.raw`интим${S1}(?:услуг|хизмат|досуг)`,
    String.raw`секс${S1}(?:услуг|хизмат)`, String.raw`sex${S1}(?:xizmat|service|uslug)`,
    String.raw`эскорт${S1}услуг`,
    String.raw`проститутк`, String.raw`prostitutk`,
    String.raw`fohisha`, String.raw`фохиша`,
    String.raw`onlyfans`,
  ]],
  ['drugs', [
    String.raw`закладчик`, String.raw`кладмен`,
    String.raw`мефедрон`, String.raw`mefedron`, String.raw`mephedrone`, String.raw`меф${E}`,
    String.raw`гашиш`, String.raw`gashish`, String.raw`hashish`,
    String.raw`спайс`, String.raw`spays${E}`,
    String.raw`nasha${S1}sot`, String.raw`наша${S1}сот(?:аман|амиз|илади|ади)${E}`,
    String.raw`наркотик\p{L}*${S1}(?:купить|продам|продаю|в${S1}наличии)`,
    String.raw`(?:купить|продам|продаю)${S1}наркотик`,
    String.raw`narkotik\p{L}*${S1}sot`,
    String.raw`кокаин`, String.raw`kokain`, String.raw`cocaine`,
    // "героиня"/"heroine" — EMAS.
    String.raw`героин(?:а|ом|у)?${E}`, String.raw`geroin${E}`, String.raw`heroin${E}`,
    String.raw`амфетамин`, String.raw`метамфетамин`, String.raw`amfetamin`, String.raw`amphetamine`, String.raw`methamphetamine`,
  ]],
  ['violence', [
    String.raw`portlatib${S1}yubora(?:man|miz)`, String.raw`portlata(?:man|miz)${E}`,
    String.raw`портлатиб${S1}юбора(?:ман|миз)`, String.raw`портлата(?:ман|миз)${E}`,
    String.raw`взорв(?:у|ем)${E}`,
    String.raw`bomba?${S1}(?:qilaman|qo'?yaman|qo'?yamiz|portlataman)`,
    String.raw`бомба?${S1}(?:киламан|куяман|куямиз)`,
    String.raw`(?:заложу|подложу)${S1}бомбу`,
    String.raw`i(?:'ll|${S1}will)${S1}(?:bomb|blow${S1}up)`,
  ]],
];

const REVIEW = [
  // Yolg'iz diniy-siyosiy so'zlar — faqat admin ko'radi (bloklanmaydi).
  ['religious_political', [
    String.raw`jihod`, String.raw`jihad`, String.raw`джихад`, String.raw`жиход`,
    String.raw`xalifa(?:lik|t)`, String.raw`халифа(?:лик|т)`, String.raw`caliphate`, String.raw`khilafa`,
    String.raw`xilofat`, String.raw`хилофат`,
    String.raw`shariat${S1}davlat`, String.raw`шариат${S1}давлат`, String.raw`шариатск\p{L}*${S1}государств`,
    String.raw`kofir`, String.raw`кофир`, String.raw`кафир`, String.raw`kafir`, String.raw`kuffar`,
    String.raw`takfir`, String.raw`такфир`,
  ]],
  // "закладка" — kitob xatcho'pi ham (do'konlarda sotiladi), shuning uchun
  // bloklanmaydi; "закладчик/кладмен" esa SEVERE.
  ['drugs', [String.raw`закладк`]],
];

// Arab yozuvi: 3+ HARF ketma-ket (harakatlar orasida bo'lishi mumkin).
const ARABIC_RE = /(?:(?=\p{L})\p{Script=Arabic}\p{M}*){3,}/u;

const compile = (list) => list.map(([category, stems]) => ({
  category,
  re: new RegExp(`${B}(?:${stems.join('|')})`, 'u'),
}));
const SEVERE_RE = compile(SEVERE);
const REVIEW_RE = compile(REVIEW);

/// Matnni ro'yxat bilan solishtiradi → { tier: 'severe'|'review', category, match } | null.
export function textGuardMatch(text) {
  const raw = String(text || '');
  if (!raw.trim()) return null;
  const s = normalizeGuardText(raw);
  for (const { category, re } of SEVERE_RE) {
    const m = re.exec(s);
    if (m) return { tier: 'severe', category, match: m[0].trim().slice(0, 60) };
  }
  for (const { category, re } of REVIEW_RE) {
    const m = re.exec(s);
    if (m) return { tier: 'review', category, match: m[0].trim().slice(0, 60) };
  }
  const a = ARABIC_RE.exec(raw);
  if (a) return { tier: 'review', category: 'arabic_script', match: a[0].slice(0, 60) };
  return null;
}

/// Bir nechta matndan eng og'iri (severe > review).
export function textGuardMatchAll(texts) {
  let review = null;
  for (const t of texts || []) {
    const hit = textGuardMatch(t);
    if (hit?.tier === 'severe') return hit;
    if (hit && !review) review = hit;
  }
  return review;
}

// ═══ PENDING (matn) ═════════════════════════════════════════════════

// `company_story` — `story` bilan bir jadval (pendingSql 'story').
const pendKind = (kind) => (kind === 'company_story' ? 'story' : String(kind));
export const textPendingUrl = (kind, id) => `text:${pendKind(kind)}:${Number(id)}`;

/// Kontentni matn sababli yashiradi. Hech qachon tashlamaydi → yozildimi.
export async function markTextPending(env, kind, id) {
  try {
    await ensureGuardSchema(env);
    await env.DB.prepare(`INSERT OR IGNORE INTO content_pending (kind, id, url, created_at) VALUES (?, ?, ?, ?)`)
      .bind(pendKind(kind), Number(id), textPendingUrl(kind, id), new Date().toISOString()).run();
    return true;
  } catch (e) {
    console.error('markTextPending', String(e?.message || e).slice(0, 120));
    return false;
  }
}

/// Admin "Tasdiqlash" — faqat MATN qatori o'chadi (tekshirilmagan media
/// qatori bo'lsa, u o'z yo'li bilan ochiladi).
export async function clearTextPending(env, kind, id) {
  try {
    await ensureGuardSchema(env);
    await env.DB.prepare(`DELETE FROM content_pending WHERE url = ?`).bind(textPendingUrl(kind, id)).run();
  } catch { /* jadval yo'q — kutish ham yo'q */ }
}

const nowTs = () => new Date().toISOString().replace('T', ' ').replace('Z', '+00');
const CAT_UZ = {
  extremism: 'ekstremizm', sexual: '18+', drugs: 'giyohvand', violence: 'tahdid',
  political: 'siyosiy', hate: 'nafrat', religious_political: 'diniy-siyosiy', arabic_script: 'arab yozuvi',
};

// Ochiq (status='new') shu sababli shikoyat bo'lmasa — yangisi. Tahrirda
// yoki yopilgandan keyin qayta topilsa ham yoziladi.
async function insertTextReport(env, { reportKind, id, ownerCode, reason, note, perOwnerDay = 0 }) {
  await ensureReportsTable(env);
  const owner = String(ownerCode || '').toUpperCase().slice(0, 40);
  const now = nowTs();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString().replace('T', ' ').replace('Z', '+00');
  const cap = perOwnerDay
    ? `AND (SELECT COUNT(*) FROM content_reports WHERE reason = ? AND owner_code = ? AND created_at > ?) < ?`
    : '';
  const dedupe = reason === 'text_review'
    ? `NOT EXISTS (SELECT 1 FROM content_reports WHERE target_kind = ? AND target_id = ? AND reason = ?)`
    : `NOT EXISTS (SELECT 1 FROM content_reports WHERE target_kind = ? AND target_id = ? AND reason = ? AND status = 'new')`;
  const res = await env.DB.prepare(
    `INSERT INTO content_reports
       (target_kind, target_id, owner_code, reporter_id, reporter_ip, reason, note, status, created_at)
     SELECT ?, ?, ?, NULL, 'system', ?, ?, 'new', ?
      WHERE ${dedupe} ${cap}`
  ).bind(reportKind, String(id), owner, reason, String(note).slice(0, 200), now,
    reportKind, String(id), reason, ...(perOwnerDay ? [reason, owner, dayAgo, perOwnerDay] : [])).run();
  return Number(res?.meta?.changes || 0) > 0;
}

function alertTextBlocked(env, { reportKind, id, category, match, reason }) {
  return alertOnce(env, 'alert_text_block_at', TEXT_BLOCK_ALERT_MS, async () =>
    `Matn ${reason === 'text_ai' ? 'AI tomonidan ' : ''}yashirildi: ${reportKind} #${id} (${CAT_UZ[category] || category}${match ? `: "${match}"` : ''}).\n`
    + 'Admin → Shikoyatlar ("Matn bloklandi") — tasdiqlang yoki o\'chiring.').catch(() => false);
}

/// Yashirish + admin navbati + ogohlantirish (SEVERE va AI uchun bitta yo'l).
/// `hide:false` — profil kabi yashirib bo'lmaydigan joylar (faqat navbat).
export async function blockText(env, { kind, reportKind = kind, id, ownerCode = '', reason = 'text_block', category, match = '', hide = true }) {
  let pending = false;
  if (hide) pending = await markTextPending(env, kind, id);
  try {
    const note = reason === 'text_ai' ? `Avtomatik (AI): ${category}` : `Avtomatik: ${category} "${match}"`;
    await insertTextReport(env, { reportKind, id, ownerCode, reason, note });
  } catch (e) {
    console.error('blockText report', String(e?.message || e).slice(0, 120));
  }
  await alertTextBlocked(env, { reportKind, id, category, match, reason });
  return pending;
}

/// Asosiy kirish: ro'yxat bo'yicha tekshiruv. → { pending, tier?, category?, match? }.
/// Hech qachon tashlamaydi.
export async function guardText(env, { kind, reportKind = kind, id, texts = [], ownerCode = '', hide = true }) {
  try {
    if (!kind || id == null || id === '') return { pending: false };
    const hit = textGuardMatchAll(texts);
    if (!hit) return { pending: false };
    if (hit.tier === 'severe') {
      const pending = await blockText(env, { kind, reportKind, id, ownerCode, reason: 'text_block', category: hit.category, match: hit.match, hide });
      return { pending, ...hit };
    }
    await insertTextReport(env, {
      reportKind, id, ownerCode, reason: 'text_review',
      note: `Avtomatik: ${hit.category} "${hit.match}"`, perOwnerDay: TEXT_REVIEW_PER_OWNER_DAY,
    }).catch(() => false);
    return { pending: false, ...hit };
  } catch {
    return { pending: false };
  }
}

/// IXTIYORIY AI TEKSHIRUVI (post/Reels/ko'rgazma matni). Kalit o'chiq,
/// Gemini yo'q, matn qisqa yoki xizmat ishlamasa — hech narsa qilmaydi.
/// → { pending, category? }.
export async function aiGuardText(env, { kind, reportKind = kind, id, texts = [], ownerCode = '' }) {
  try {
    const text = (texts || []).map((t) => String(t || '').trim()).filter(Boolean).join('\n');
    if (text.length < TEXT_AI_MIN_LEN) return { pending: false };
    if (!moderationEnabled(env)) return { pending: false };
    const flags = peekFlags(env) || await getFlags(env);
    if (!flags.textAiCheck) return { pending: false };
    const v = await moderateText(env, text);
    if (!v.checked || v.allowed) return { pending: false };
    const pending = await blockText(env, { kind, reportKind, id, ownerCode, reason: 'text_ai', category: v.category });
    return { pending, category: v.category };
  } catch {
    return { pending: false };
  }
}
