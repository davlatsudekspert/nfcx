// AI YORDAMCHI — Google Gemini (Worker versiyasi).
//
// Avval bu faqat eski Express serverida bor edi (server/assistant.js) va
// Worker'ga ko'chirilmagandi: `/api/assistant/status` doim `{enabled:false}`
// qaytarardi, shuning uchun vidjet saytda umuman ko'rinmasdi. Endi mana shu
// modul ishlaydi.
//
// SOZLASH (kalit KODGA YOZILMAYDI — faqat Cloudflare secret):
//     npx wrangler secret put GEMINI_API_KEY
// Ixtiyoriy o'zgaruvchilar:
//     ASSISTANT_MODEL   — standart: gemini-3.6-flash
//     ASSISTANT_OFF=1   — kalit turgan holda ham vidjetni o'chirish
// Kalit bo'lmasa endpoint 503 beradi va vidjet o'zini ko'rsatmaydi —
// ya'ni sozlanmagan sayt "buzuq" ko'rinmaydi.

const DEFAULT_MODEL = 'gemini-3.6-flash';
// Model nomi o'chib qolsa (Google eskilarini olib tashlaydi) — assistent
// butunlay o'lib qolmasin: keyingi nom bilan bir marta qayta uriniladi.
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];

const SYSTEM_PROMPT = `Sen — NFCSTORE.uz saytining yordamchisisan. NFCSTORE — raqamli tashrif qog'ozi (profil), NFC karta va kompaniya sahifalari xizmati (O'zbekiston).

Vazifang: sayt bo'yicha yordam berish — profil yaratish, NFC karta buyurtma qilish, narxlar, NFC ID darajalari (bepul/silver/gold/premium/exclusive), Profil Premium, profilni sozlash (fon, havolalar, musiqa, karta dizayni), katalog va qidiruv, kompaniya (Company ID) bo'limi: katalog/menyu, aloqa, lokatsiya, Instagram/Facebook, qo'shimcha havolalar.

Qoidalar:
- Faqat NFCSTORE va raqamli tashrif qog'ozlari mavzusida javob ber. Boshqa mavzuda muloyimlik bilan rad et.
- Qisqa va aniq (2-5 jumla). Foydalanuvchi qaysi tilda yozsa (o'zbek/rus/ingliz) — o'sha tilda javob ber.
- To'lov mavjud to'lov usullari orqali amalga oshiriladi. Aniq summani sayt sahifasidan ko'rishni ayt.
- ANIQ NARX AYTMA. Narxlar o'zgaradi — "Narxlar" sahifasiga yoki kompaniya narx tekshirgichiga yo'naltir.
- Aniq bilmasang — taxmin qilma, @nfcstore_admin ga murojaat qilishni taklif qil.
- Hech qachon parol, karta raqami yoki boshqa shaxsiy ma'lumot so'rama. Foydalanuvchi o'zi yozsa ham takrorlama.
- Sen foydalanuvchi nomidan hech narsa sotib ololmaysan, bekor qila olmaysan va akkauntga kira olmaysan — bunday so'rovda saytdagi tegishli bo'limni ko'rsat.`;

const apiKey = (env) => String(env.GEMINI_API_KEY || env.AI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const enabled = (env) => !!apiKey(env) && String(env.ASSISTANT_OFF || '') !== '1';

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('').trim();
}

async function callGemini(env, model, contents) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey(env) },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          // maxOutputTokens SAXOVATLI: yangi modellar javobdan oldin
          // "o'ylaydi" va o'sha ham shu byudjetdan yeydi. Chegara tor
          // bo'lsa javob yarim so'zda uzilib qolardi.
          generationConfig: { maxOutputTokens: 1200, temperature: 0.4 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
        signal: ctrl.signal,
      },
    );
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, aborted: err?.name === 'AbortError' };
  } finally {
    clearTimeout(timer);
  }
}

export async function handle(request, env, url, H) {
  const { json } = H;

  // Vidjet har sahifada shuni so'raydi — arzon va D1 ga tegmaydi.
  if (url.pathname === '/api/assistant/status' && request.method === 'GET') {
    return json({ enabled: enabled(env) });
  }

  if (url.pathname !== '/api/assistant') return null;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!enabled(env)) return json({ error: 'not_configured' }, 503);

  // CHEGARA. Har so'rov Google'da pul turadi, shuning uchun IP bo'yicha
  // qat'iy: soatiga 40 ta. Kirgan foydalanuvchi ham shu chegarada —
  // akkaunt ochish cheklovni aylanib o'tish yo'li bo'lib qolmasin.
  const ip = H.reqIp(request);
  if (await H.rateLimitD1(env, `assistant:${ip}`, 40, 60 * 60_000)) {
    return json({ error: 'too_many_requests' }, 429);
  }

  const body = await request.json().catch(() => null);
  const history = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content).slice(0, 2000) }] }))
    .filter((m) => m.parts[0].text.trim());
  if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'bad_request' }, 400);

  const configured = String(env.ASSISTANT_MODEL || DEFAULT_MODEL).trim();
  const models = [configured, ...FALLBACK_MODELS.filter((m) => m !== configured)];

  let last = null;
  for (const model of models) {
    const res = await callGemini(env, model, history);
    last = res;
    // 404 = model nomi yo'q; 400 = so'rov shakli. Faqat BIRINCHISIDA
    // keyingi modelga o'tamiz — qolgan xatolarda takrorlash befoyda.
    if (!res.ok && (res.status === 404 || res.status === 400)) continue;
    if (!res.ok) break;

    if (res.data?.promptFeedback?.blockReason) {
      return json({ reply: 'Bu savolga javob bera olmayman. Iltimos, NFCSTORE bo‘yicha savol bering yoki @nfcstore_admin ga murojaat qiling.' });
    }
    const reply = extractText(res.data);
    if (reply) return json({ reply, model });
    break;
  }

  const detail = last?.data?.error?.message || (last?.aborted ? 'timeout' : `HTTP ${last?.status || 0}`);
  console.error('[assistant] gemini', String(detail).slice(0, 300));
  return json({ error: 'upstream' }, 502);
}
