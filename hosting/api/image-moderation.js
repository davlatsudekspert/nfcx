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
//   * VIDEO tekshirilmaydi — Worker ichida videoni kadrlarga bo'lish
//     imkoni yo'q. Video uchun moderatsiya: shikoyat + admin (avvalgidek).
//   * GIF tekshirilmaydi — Gemini GIF formatini qabul qilmaydi.
//   * Xizmat ishlamasa (kalit yo'q, tarmoq xatosi, 8 soniyadan oshsa)
//     yuklash TO'XTATILMAYDI: odam bizning nosozligimiz uchun jazolanmasin.
//     Natija `checked: false` bo'ladi.
//   * Rasmning o'zi saqlanmaydi — logga faqat kim, qachon va qaysi
//     kategoriya yoziladi (`content_scan_blocks`).
//
// O'chirish: `MODERATION_OFF=1` (Worker o'zgaruvchisi).
// Model: `MODERATION_MODEL`, bo'lmasa `ASSISTANT_MODEL`, bo'lmasa standart.

export const BLOCK_CATEGORIES = ['sexual', 'violence', 'extremism', 'drugs', 'hate'];

const DEFAULT_MODEL = 'gemini-3.6-flash';
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 7 * 1024 * 1024;
const SUPPORTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const PROMPT = `You are a strict content-safety classifier for a public social network in Uzbekistan.
Look at the image and decide if it may be published.
Block ONLY clear violations:
- "sexual": nudity, sexual acts, pornographic or sexually explicit content;
- "violence": graphic violence, gore, severe injury, cruelty to people or animals;
- "extremism": terrorist or extremist symbols, flags, propaganda, recruitment;
- "drugs": illegal drugs being sold, used or advertised;
- "hate": hateful symbols or imagery targeting a group.
Normal photos (people, food, products, shops, cars, text, memes, swimwear at a beach, medical/educational images without gore, legal products) are ALLOWED.
Reply with JSON only: {"allowed": true|false, "category": "none|sexual|violence|extremism|drugs|hate"}`;

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
