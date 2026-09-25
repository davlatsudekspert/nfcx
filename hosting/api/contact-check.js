// hosting/api/contact-check.js — RO'YXATDA EMAIL VA TELEFONNI TEKSHIRISH (2026-09-25).
//
// Egasi: "ro'yxatdan o'tishda gmail xato yozilsa ham kod ketdi deyapti.
// Email xato bo'lsa aytish kerak. Telefon raqamlarni ham to'g'ri yozsa
// qabul qilishi kerak — hamma davlatni; raqam yetmasa qabul qilmaslik".
//
// 1) EMAIL: shakl to'g'ri bo'lsa ham domen xato bo'lishi mumkin
//    (`gmial.com`, `gmail.co`, `mail.r`). Mashhur domenlarga 1–2 harf
//    farq qilsa — to'g'ri variant TAKLIF qilinadi. Keyin domenning
//    pochta qabul qilishi (MX yozuvi) DNS orqali tekshiriladi: yo'q bo'lsa
//    kod yuborilmaydi. DNS javob bermasa (tarmoq) — to'sib qo'yilmaydi.
// 2) TELEFON: davlat kodi bo'yicha raqamning MILLIY qismi uzunligi.
//    Jadvalda yo'q davlat — umumiy 9–15 qoidasi (worker.js).
//
// Bu tekshiruvlar FAQAT RO'YXATDAN O'TISHDA ishlatiladi. Kirish
// (login) va mavjud akkauntlarga tegilmaydi — eski yozuvli odam
// hisobiga kira olmay qolmasin.

// ── TELEFON ─────────────────────────────────────────────────────────────
// Davlat kodi → milliy raqam uzunligi [min, max] (mobil raqamlar).
export const PHONE_PLANS = {
  998: [9, 9],   // O'zbekiston
  7: [10, 10],   // Rossiya, Qozog'iston
  996: [9, 9],   // Qirg'iziston
  992: [9, 9],   // Tojikiston
  993: [8, 8],   // Turkmaniston
  994: [9, 9],   // Ozarbayjon
  374: [8, 8],   // Armaniston
  995: [9, 9],   // Gruziya
  375: [9, 9],   // Belarus
  380: [9, 9],   // Ukraina
  90: [10, 10],  // Turkiya
  93: [9, 9],    // Afg'oniston
  98: [10, 10],  // Eron
  86: [11, 11],  // Xitoy
  91: [10, 10],  // Hindiston
  92: [10, 10],  // Pokiston
  880: [10, 10], // Bangladesh
  971: [9, 9],   // BAA
  966: [9, 9],   // Saudiya Arabistoni
  974: [8, 8],   // Qatar
  965: [8, 8],   // Quvayt
  972: [9, 9],   // Isroil
  20: [10, 10],  // Misr
  1: [10, 10],   // AQSh, Kanada
  44: [10, 10],  // Buyuk Britaniya
  49: [7, 11],   // Germaniya (shahar raqamlari uzunligi har xil)
  33: [9, 9],    // Fransiya
  34: [9, 9],    // Ispaniya
  39: [9, 10],   // Italiya
  48: [9, 9],    // Polsha
  31: [9, 9],    // Niderlandiya
  32: [9, 9],    // Belgiya
  41: [9, 9],    // Shveytsariya
  46: [9, 9],    // Shvetsiya
  420: [9, 9],   // Chexiya
  36: [9, 9],    // Vengriya
  40: [9, 9],    // Ruminiya
  371: [8, 8],   // Latviya
  370: [8, 8],   // Litva
  372: [7, 8],   // Estoniya
  82: [9, 10],   // Janubiy Koreya
  81: [10, 10],  // Yaponiya
  60: [9, 10],   // Malayziya
  66: [9, 9],    // Tailand
  84: [9, 10],   // Vyetnam
  61: [9, 9],    // Avstraliya
};

const PLAN_KEYS = Object.keys(PHONE_PLANS).sort((a, b) => b.length - a.length);

/// Xalqaro raqamning (`+998901234567`) davlati va milliy qismi.
export function splitPhone(e164) {
  const d = String(e164 || '').replace(/^\+/, '');
  if (!/^\d+$/.test(d)) return null;
  const cc = PLAN_KEYS.find((k) => d.startsWith(k));
  if (!cc) return { cc: '', national: d };
  return { cc, national: d.slice(cc.length) };
}

/// `null` — raqam to'g'ri (yoki davlat jadvalda yo'q);
/// `'phone_short'` — raqam yetmaydi; `'phone_long'` — ortiqcha raqam.
export function phoneProblem(e164) {
  const p = splitPhone(e164);
  if (!p) return 'phone_short';
  if (!p.cc) return null;
  const [min, max] = PHONE_PLANS[p.cc];
  if (p.national.length < min) return 'phone_short';
  if (p.national.length > max) return 'phone_long';
  return null;
}

// ── EMAIL ───────────────────────────────────────────────────────────────
export const POPULAR_EMAIL_DOMAINS = [
  'gmail.com', 'mail.ru', 'yandex.ru', 'yandex.com', 'ya.ru', 'icloud.com',
  'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'inbox.ru', 'list.ru',
  'bk.ru', 'rambler.ru', 'protonmail.com', 'proton.me', 'me.com', 'mail.com',
  'umail.uz', 'inbox.uz',
];

const SINGLE_TLD = new Set(['gmail', 'googlemail', 'icloud']);
const POPULAR_SLDS = new Set(POPULAR_EMAIL_DOMAINS.map((d) => d.split('.')[0]));
// `.com` ning tez-tez uchraydigan xatolari — 2 harfli bo'lsa ham xato.
const TLD_TYPOS = new Set(['co', 'cm', 'om', 'cn']);

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/// Domen mashhur domenga juda o'xshasa-yu, o'zi emas bo'lsa — to'g'ri
/// butun manzil (`ali@gmail.com`). Aks holda `null`.
export function emailTypoSuggestion(email) {
  const s = String(email || '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  if (at < 1) return null;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (!domain || POPULAR_EMAIL_DOMAINS.includes(domain)) return null;
  // `gmail` va `icloud` — FAQAT `.com`. `gmail.co`, `gmail.ru` — xato.
  const sld = domain.split('.')[0];
  if (SINGLE_TLD.has(sld)) return `${local}@${sld}.com`;
  // `mail.kz`, `yandex.uz`, `mail.uz` — haqiqiy mahalliy domenlar
  // (mashhur nom + 2 harfli davlat domeni). Xato EMAS.
  const tld = domain.slice(sld.length + 1);
  if (POPULAR_SLDS.has(sld) && /^[a-z]{2}$/.test(tld) && !TLD_TYPOS.has(tld)) return null;
  let best = null;
  let bestD = 99;
  for (const d of POPULAR_EMAIL_DOMAINS) {
    const dist = levenshtein(domain, d);
    // Qisqa domenlarda (ya.ru, bk.ru) faqat 1 harf farq — aks holda
    // haqiqiy boshqa domenlar ham "xato" deb qolardi.
    const limit = d.length <= 6 ? 1 : 2;
    if (dist <= limit && dist < bestD) { best = d; bestD = dist; }
  }
  // `gmail` (nuqtasiz), `gmail.` — oxiri tushib qolgan.
  if (!best) {
    const bare = domain.replace(/\.+$/, '');
    best = POPULAR_EMAIL_DOMAINS.find((d) => d.split('.')[0] === bare) || null;
  }
  return best ? `${local}@${best}` : null;
}

const mxCache = new Map();

/// Domen pochta qabul qiladimi (MX yoki A yozuvi). `true` / `false`;
/// DNS javob bermasa `null` — chaqiruvchi to'sib qo'ymaydi.
export async function emailDomainAccepts(env, email) {
  if (env?.EMAIL_MX_CHECK === 'off') return null;
  const domain = String(email || '').split('@').pop().toLowerCase();
  if (!domain || POPULAR_EMAIL_DOMAINS.includes(domain)) return true;
  const hit = mxCache.get(domain);
  if (hit && hit.until > Date.now()) return hit.ok;
  const ask = async (type) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    try {
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, {
        headers: { accept: 'application/dns-json' }, signal: ctrl.signal,
      });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  const mx = await ask('MX');
  if (!mx) return null;
  let ok;
  if (mx.Status === 3) ok = false; // NXDOMAIN — bunday domen yo'q
  else if ((mx.Answer || []).some((a) => a.type === 15)) ok = true;
  else {
    // MX yo'q — standart bo'yicha A yozuviga pochta yuborilishi mumkin.
    const a = await ask('A');
    if (!a) return null;
    ok = (a.Answer || []).some((x) => x.type === 1 || x.type === 5);
  }
  mxCache.set(domain, { ok, until: Date.now() + 10 * 60_000 });
  return ok;
}
