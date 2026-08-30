// AI yordamchi — NFCSTORE bo'yicha savol-javob. Anthropic Messages API'ga
// server orqali murojaat qiladi (kalit brauzerga chiqmaydi).
//
// SOZLASH: Railway Variables'ga ANTHROPIC_API_KEY qo'ying. Ixtiyoriy:
//   ASSISTANT_MODEL (default: claude-opus-5)
// Kalit yo'q bo'lsa endpoint 503 qaytaradi va vidjet o'zini yashiradi.

// Railway/CI'да qiymatga tasodifan tirnoq yoki bo'sh joy qo'shilishi mumkin.
const API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const MODEL = (process.env.ASSISTANT_MODEL || 'claude-opus-5').trim();
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export const assistantEnabled = () => !!API_KEY;

const SYSTEM_PROMPT = `Sen — NFCSTORE.uz saytining yordamchisisan. NFCSTORE — raqamli tashrif qog'ozi (profil) va NFC karta xizmati.

Vazifang: foydalanuvchilarga sayt bo'yicha yordam berish — qanday profil yaratish, NFC karta buyurtma qilish, narxlar, NFC ID darajalari (tekin/silver/gold/premium/exclusive), Profil Premium, profilni sozlash (fon, havolalar, karta dizayni), katalog va qidiruv, biznes imkoniyatlari (restoran menyusi, jamoa, lidlar, fayllar, video), auksion.

Qoidalar:
- Faqat NFCSTORE va raqamli tashrif qog'ozlari mavzusida javob ber. Boshqa mavzularда — muloyimlik bilan "men faqat NFCSTORE bo'yicha yordam bera olaman" de.
- Qisqa va aniq javob ber (2-5 jumla). Foydalanuvchi qaysi tilда yozsa (o'zbek/rus/ingliz) — o'sha tilда javob ber.
- To'lov holati: Payme integratsiyasi hozircha tayyorlanmoqda. Buyurtma uchun Telegram: @nfcstore_admin.
- Aniq bilmasang — taxmin qilma, adminga (@nfcstore_admin) murojaat qilishni taklif qil.
- Hech qachon parol, karta raqami yoki shaxsiy ma'lumot so'rama.`;

const clean = (s, max) => String(s == null ? '' : s).slice(0, max);

// Bir necha turdagi javob bloklaridan matnni yig'adi.
function extractText(data) {
  if (!data || !Array.isArray(data.content)) return '';
  return data.content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

// messages: [{ role: 'user'|'assistant', content: string }, ...]
export async function askAssistant(rawMessages) {
  if (!API_KEY) return { error: 'not_configured' };

  const messages = (Array.isArray(rawMessages) ? rawMessages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: clean(m.content, 2000) }));

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return { error: 'bad_request' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages,
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = (data && data.error && (data.error.message || data.error.type)) || `HTTP ${res.status}`;
      console.error('[assistant] Anthropic API:', res.status, detail);
      // Anthropic xato TURI/matni maxfiy emas (kalit yo'q) — diagnostika uchun qaytaramiz.
      return { error: 'upstream', status: res.status, detail: String(detail).slice(0, 300) };
    }
    if (data && data.stop_reason === 'refusal') {
      return { reply: 'Bu savolga javob bera olmayman. Iltimos, NFCSTORE bo‘yicha savol bering yoki @nfcstore_admin ga murojaat qiling.' };
    }
    const reply = extractText(data);
    return reply ? { reply } : { error: 'empty' };
  } catch (err) {
    console.error('[assistant]', err.name === 'AbortError' ? 'timeout' : err.message);
    return { error: 'upstream' };
  } finally {
    clearTimeout(timer);
  }
}
