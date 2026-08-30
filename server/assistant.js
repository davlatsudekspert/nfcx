// AI yordamchi — NFCSTORE bo'yicha savol-javob. Google Gemini API'ga
// server orqali murojaat qiladi (kalit brauzerga chiqmaydi).
//
// SOZLASH: Railway Variables'ga GEMINI_API_KEY qo'ying (aka.dev / AI Studio:
//   https://aistudio.google.com/apikey). Ixtiyoriy:
//   ASSISTANT_MODEL (default: gemini-3.6-flash)
// Kalit yo'q bo'lsa endpoint 503 qaytaradi va vidjet o'zini yashiradi.
//
// Eslatma: eski nomlar ham o'qiladi (AI_API_KEY, ANTHROPIC_API_KEY) —
// agar Railway'да allaqachon shu nom bilan qo'yilган bo'lsa.

const API_KEY = (process.env.GEMINI_API_KEY || process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || '')
  .trim().replace(/^["']|["']$/g, '');
const MODEL = (process.env.ASSISTANT_MODEL || 'gemini-3.6-flash').trim();

export const assistantEnabled = () => !!API_KEY;

const SYSTEM_PROMPT = `Sen — NFCSTORE.uz saytining yordamchisisan. NFCSTORE — raqamli tashrif qog'ozi (profil) va NFC karta xizmati.

Vazifang: foydalanuvchilarga sayt bo'yicha yordam berish — qanday profil yaratish, NFC karta buyurtma qilish, narxlar, NFC ID darajalari (tekin/silver/gold/premium/exclusive), Profil Premium, profilni sozlash (fon, havolalar, karta dizayni), katalog va qidiruv, biznes imkoniyatlari (restoran menyusi, jamoa, lidlar, fayllar, video), auksion.

Qoidalar:
- Faqat NFCSTORE va raqamli tashrif qog'ozlari mavzusida javob ber. Boshqa mavzularda — muloyimlik bilan "men faqat NFCSTORE bo'yicha yordam bera olaman" de.
- Qisqa va aniq javob ber (2-5 jumla). Foydalanuvchi qaysi tilda yozsa (o'zbek/rus/ingliz) — o'sha tilda javob ber.
- To'lov holati: Payme integratsiyasi hozircha tayyorlanmoqda. Buyurtma uchun Telegram: @nfcstore_admin.
- Aniq bilmasang — taxmin qilma, adminga (@nfcstore_admin) murojaat qilishni taklif qil.
- Hech qachon parol, karta raqami yoki shaxsiy ma'lumot so'rama.`;

const clean = (s, max) => String(s == null ? '' : s).slice(0, max);

function extractText(data) {
  const parts = data && data.candidates && data.candidates[0]
    && data.candidates[0].content && data.candidates[0].content.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('').trim();
}

// messages: [{ role: 'user'|'assistant', content: string }, ...]
export async function askAssistant(rawMessages) {
  if (!API_KEY) return { error: 'not_configured' };

  const history = (Array.isArray(rawMessages) ? rawMessages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: clean(m.content, 2000) }],
    }));

  if (!history.length || history[history.length - 1].role !== 'user') {
    return { error: 'bad_request' };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: history,
        generationConfig: { maxOutputTokens: 700, temperature: 0.4 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = (data && data.error && (data.error.message || data.error.status)) || `HTTP ${res.status}`;
      console.error('[assistant] Gemini API:', res.status, detail);
      return { error: 'upstream', status: res.status, detail: String(detail).slice(0, 300) };
    }
    const blocked = data && data.promptFeedback && data.promptFeedback.blockReason;
    if (blocked) {
      return { reply: 'Bu savolga javob bera olmayman. Iltimos, NFCSTORE bo‘yicha savol bering yoki @nfcstore_admin ga murojaat qiling.' };
    }
    const reply = extractText(data);
    return reply ? { reply } : { error: 'empty' };
  } catch (err) {
    console.error('[assistant]', err.name === 'AbortError' ? 'timeout' : err.message);
    return { error: 'upstream', detail: err.name === 'AbortError' ? 'timeout' : String(err.message).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}
