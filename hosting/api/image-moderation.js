// hosting/api/image-moderation.js — YUKLANGAN RASMNI AVTOMATIK TEKSHIRISH.
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasining talabi (2026-09): taqiqlangan kontent (18+, zo'ravonlik,
// ekstremizm...) faqat shikoyatdan keyin emas, YUKLASH PAYTIDA
// to'xtatilsin — va odamga "nega yuklanmadi" degan savol qolmasin:
// rad javobida SABAB (kategoriya) aytiladi.
//
// ═══ QANDAY ISHLAYDI ═══
//
// Rasm Gemini'ga (sayt yordamchisi allaqachon ishlatadigan
// `GEMINI_API_KEY`) yuboriladi va qat'iy JSON javob so'raladi:
//   { "allowed": true|false, "category": "none|sexual|violence|extremism|drugs|hate" }
// Gemini rasmni o'zi xavfli deb rad etsa (`blockReason` / `SAFETY`) —
// bu ham bloklash (18+).
//
// ═══ NIMA QILMAYDI ═══
//
//   * VIDEO endi TEKSHIRILADI (2026-09-24, egasi: "rasm va video —
//     porno, diniy ekstremizm, siyosiy va boshqalar"): R2 dagi fayl
//     Gemini Files API ga OQIM bilan yuboriladi (base64 emas — Worker
//     xotirasi 128 MB), qayta ishlanishi kutiladi va hukm so'raladi.
//     Qarang: `moderateVideo`.
//   * GIF tekshirilmaydi — Gemini GIF formatini qabul qilmaydi.
//   * Xizmat ishlamasa (kalit yo'q, tarmoq xatosi, 8 soniyadan oshsa)
//     yuklash TO'XTATILMAYDI: odam bizning nosozligimiz uchun jazolanmasin.
//     Natija `checked: false` bo'ladi.
//   * Rasmning o'zi saqlanmaydi — logga faqat kim, qachon va qaysi
//     kategoriya yoziladi (`content_scan_blocks`).
//
// O'chirish: `MODERATION_OFF=1` (Worker o'zgaruvchisi).
// Model: `MODERATION_MODEL`, bo'lmasa `ASSISTANT_MODEL`, bo'lmasa standart.

export const BLOCK_CATEGORIES = ['sexual', 'violence', 'extremism', 'political', 'drugs', 'hate'];

const DEFAULT_MODEL = 'gemini-3.6-flash';
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 7 * 1024 * 1024;
const SUPPORTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const PROMPT = `You are a strict content-safety classifier for a public social network in Uzbekistan.
Look at the image and decide if it may be published.
Block ONLY clear violations:
- "sexual": nudity, sexual acts, pornographic or sexually explicit content;
- "violence": graphic violence, gore, severe injury, cruelty to people or animals;
- "extremism": terrorist or extremist symbols, flags, propaganda, recruitment, including RELIGIOUS extremism (calls to violent jihad, banned religious-extremist groups and their symbols);
- "political": ONLY calls to riots, unrest, unsanctioned protests or overthrowing the government, and insulting or desecrating state symbols (flag, emblem, anthem) or state leaders;
- "drugs": illegal drugs being sold, used or advertised;
- "hate": hateful symbols or imagery targeting a group.
Normal photos (people, food, products, shops, cars, text, memes, swimwear at a beach, medical/educational images without gore, legal products) are ALLOWED.
Ordinary religious life (mosques, prayer, religious holidays, Quran recitation) and the national flag shown respectfully are ALLOWED.
News reports, official events and speeches, elections coverage, patriotic content, national holidays (e.g. Independence Day, Navruz), military parades and people simply discussing politics are ALLOWED — they are NOT "political" violations.
When unsure, ALLOW.
Reply with JSON only: {"allowed": true|false, "category": "none|sexual|violence|extremism|political|drugs|hate"}`;

// Video uchun — xuddi shu qoidalar, lekin BUTUN video (kadrlar va
// ovoz) ko'rib chiqiladi: 18+ sahna oxirida bo'lsa ham topilishi kerak.
const VIDEO_PROMPT = PROMPT
  .replace('Look at the image and decide if it may be published.',
    'Watch the WHOLE video (all frames and the audio/speech) and decide if it may be published. A violation anywhere in the video blocks it.')
  .replace('Normal photos', 'Normal videos and photos');

const apiKey = (env) => String(env.GEMINI_API_KEY || env.AI_API_KEY || '').trim().replace(/^["']|["']$/g, '');

export function moderationEnabled(env) {
  return !!apiKey(env) && String(env.MODERATION_OFF || '') !== '1';
}

function toBase64(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(s);
}

function parseVerdict(data) {
  // Gemini so'rovni o'zi xavfli deb to'xtatdi — bu rasmning o'zi
  // xavfli ekanining eng kuchli belgisi.
  if (data?.promptFeedback?.blockReason) return { allowed: false, category: 'sexual' };
  const cand = data?.candidates?.[0];
  if (cand && ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY'].includes(cand.finishReason)) {
    return { allowed: false, category: 'sexual' };
  }
  const text = (cand?.content?.parts || []).map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
  if (!text) return null;
  let j;
  try {
    j = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch { return null; }
  if (typeof j?.allowed !== 'boolean') return null;
  const cat = String(j.category || 'none').toLowerCase();
  if (j.allowed) return { allowed: true, category: 'none' };
  return { allowed: false, category: BLOCK_CATEGORIES.includes(cat) ? cat : 'sexual' };
}

/// Natija: { allowed, checked, category? }.
///   allowed:false  — bloklandi, `category` BLOCK_CATEGORIES dan biri;
///   checked:false  — tekshirilmadi (o'chiq, format, xato) va O'TKAZILDI.
export async function moderateImage(env, bytes, mime) {
  const type = String(mime || '').toLowerCase();
  if (!moderationEnabled(env)) return { allowed: true, checked: false };
  if (!SUPPORTED.includes(type)) return { allowed: true, checked: false };
  if (!bytes?.length || bytes.length > MAX_BYTES) return { allowed: true, checked: false };

  const model = String(env.MODERATION_MODEL || env.ASSISTANT_MODEL || DEFAULT_MODEL).trim();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey(env) },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType: type === 'image/jpg' ? 'image/jpeg' : type, data: toBase64(bytes) } },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 800, responseMimeType: 'application/json' },
        }),
        signal: ctrl.signal,
      },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok && !data?.promptFeedback?.blockReason) return { allowed: true, checked: false };
    const v = parseVerdict(data);
    if (!v) return { allowed: true, checked: false };
    return { ...v, checked: true };
  } catch {
    return { allowed: true, checked: false };
  } finally {
    clearTimeout(timer);
  }
}

// ═══ VIDEO ═══════════════════════════════════════════════════════════
const GEMINI = 'https://generativelanguage.googleapis.com';
const VIDEO_TIMEOUT_MS = 45_000;
const VIDEO_POLL_MS = 1_500;
// Gemini qabul qiladigan video turlari (bizning nomdan uning nomiga).
const VIDEO_TYPES = {
  'video/mp4': 'video/mp4',
  'video/webm': 'video/webm',
  'video/quicktime': 'video/mov',
  'video/mov': 'video/mov',
  'video/3gpp': 'video/3gpp',
  'video/mpeg': 'video/mpeg',
  'video/x-msvideo': 'video/avi',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/// R2 obyektining tanasi — iloji bo'lsa OQIM (xotiraga to'liq
/// yuklanmaydi), aks holda baytlar (mahalliy sinov muhiti).
async function bodyOf(obj, size) {
  if (obj?.body && typeof obj.body.pipeTo === 'function' && typeof FixedLengthStream === 'function') {
    // eslint-disable-next-line no-undef
    const { readable, writable } = new FixedLengthStream(size);
    obj.body.pipeTo(writable).catch(() => {});
    return readable;
  }
  if (typeof obj?.arrayBuffer === 'function') return new Uint8Array(await obj.arrayBuffer());
  return obj?.body;
}

/// VIDEONI TEKSHIRISH — Gemini Files API orqali.
///
///   1) yuklash sessiyasi ochiladi (resumable, bitta bo'lak);
///   2) fayl R2 dan to'g'ridan-to'g'ri oqim bilan yuboriladi;
///   3) Gemini videoni qayta ishlaguncha kutiladi (ACTIVE);
///   4) hukm so'raladi; 5) fayl Gemini'dan o'chiriladi.
///
/// Natija `moderateImage` bilan bir xil shaklda. Xizmat ishlamasa yoki
/// muddatda ulgurmasa — yuklash TO'XTATILMAYDI (`checked: false`).
///
/// `timeoutMs` — umumiy muddat. Nova ilovasida 45 s (yuklash kutishi
/// 180 s). Eski ilova va sayt uchun qisqaroq beriladi: eski ilovaning
/// butun yuklash so'rovi 90 s bilan cheklangan.
export async function moderateVideo(env, obj, mime, size, { timeoutMs = VIDEO_TIMEOUT_MS } = {}) {
  const type = VIDEO_TYPES[String(mime || '').toLowerCase()];
  if (!moderationEnabled(env)) return { allowed: true, checked: false };
  const len = Number(size ?? obj?.size ?? 0);
  if (!type || !obj || !len) return { allowed: true, checked: false };
  const key = apiKey(env);
  const model = String(env.MODERATION_MODEL || env.ASSISTANT_MODEL || DEFAULT_MODEL).trim();
  const ctrl = new AbortController();
  const budget = Math.max(5_000, Math.min(Number(timeoutMs) || VIDEO_TIMEOUT_MS, VIDEO_TIMEOUT_MS));
  const deadline = Date.now() + budget;
  const timer = setTimeout(() => ctrl.abort(), budget);
  let fileName = '';
  try {
    const start = await fetch(`${GEMINI}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(len),
        'X-Goog-Upload-Header-Content-Type': type,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: 'nfcstore-scan' } }),
      signal: ctrl.signal,
    });
    const uploadUrl = start.ok ? start.headers.get('x-goog-upload-url') : null;
    if (!uploadUrl) return { allowed: true, checked: false };

    const sent = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(len),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: await bodyOf(obj, len),
      signal: ctrl.signal,
    });
    let file = (await sent.json().catch(() => null))?.file;
    if (!sent.ok || !file?.name) return { allowed: true, checked: false };
    fileName = file.name;

    while (file?.state === 'PROCESSING') {
      if (Date.now() + VIDEO_POLL_MS > deadline) return { allowed: true, checked: false };
      await sleep(VIDEO_POLL_MS);
      const st = await fetch(`${GEMINI}/v1beta/${file.name}`, {
        headers: { 'x-goog-api-key': key },
        signal: ctrl.signal,
      });
      file = st.ok ? await st.json().catch(() => null) : null;
    }
    if (file?.state !== 'ACTIVE' || !file?.uri) return { allowed: true, checked: false };

    const res = await fetch(`${GEMINI}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: VIDEO_PROMPT },
            { fileData: { mimeType: file.mimeType || type, fileUri: file.uri } },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 800, responseMimeType: 'application/json' },
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok && !data?.promptFeedback?.blockReason) return { allowed: true, checked: false };
    const v = parseVerdict(data);
    if (!v) return { allowed: true, checked: false };
    return { ...v, checked: true };
  } catch {
    return { allowed: true, checked: false };
  } finally {
    clearTimeout(timer);
    // Gemini'dagi nusxa o'chiriladi — KUTIB (3 s gacha). Kutilmasa
    // Worker javob qaytgach so'rovni bekor qiladi va nusxa Google'da
    // 48 soat qolib, fayllar kvotasini to'ldiradi.
    if (fileName) {
      await fetch(`${GEMINI}/v1beta/${fileName}`, {
        method: 'DELETE',
        headers: { 'x-goog-api-key': key },
        signal: AbortSignal.timeout(3_000),
      }).catch(() => {});
    }
  }
}

/// Bloklangan urinish — dalil sifatida (rasmning o'zi EMAS).
export async function logBlockedUpload(env, actor, category, source) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS content_scan_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL, category TEXT NOT NULL, source TEXT,
      created_at TEXT NOT NULL
    )`).run();
    await env.DB.prepare(`INSERT INTO content_scan_blocks (actor, category, source, created_at) VALUES (?,?,?,?)`)
      .bind(String(actor || ''), String(category || ''), String(source || ''), new Date().toISOString()).run();
  } catch { /* log yozilmasa ham rad javobi baribir qaytadi */ }
}
