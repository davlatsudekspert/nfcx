// ═══════════════════════════════════════════════════════════════════════
// IJTIMOIY TARMOQ HAVOLASINI YASASH
//
// MUAMMO (2026-09): maydonlar faqat USERNAME kutardi va havola shunchaki
// `https://instagram.com/${qiymat}` bo'lib yasalardi. Odam esa tabiiy
// ravishda Instagram'dagi "Havoladan nusxa olish" tugmasi bergan TO'LIQ
// manzilni qo'yadi. Natijada:
//
//   kiritilgan: https://www.instagram.com/neomsongs?stkn=...&utm_source=qr
//   yasalgan:   https://instagram.com/https://www.instagram.com/neomsongs?...
//
// Bunday havola profilga olib bormaydi — Instagram o'zining bosh
// sahifasini ochadi. Aynan shu holat ishlab chiqarishda uchradi.
//
// YECHIM: kiritilgan qiymat to'liq manzil bo'lsa ham, faqat username
// ajratib olinadi va TOZA kanonik havola yasaladi. Kuzatuv parametrlari
// (stkn, utm_*, igsh...) tashlab yuboriladi — ular QR/ulashish uchun
// mo'ljallangan va ba'zan profil o'rniga boshqa oqimni ochadi.
//
// Qabul qilinadigan ko'rinishlar (hammasi bir xil natija beradi):
//   neomsongs
//   @neomsongs
//   instagram.com/neomsongs
//   https://www.instagram.com/neomsongs/
//   https://www.instagram.com/neomsongs?stkn=...&utm_source=qr
// ═══════════════════════════════════════════════════════════════════════

// Har bir tarmoq uchun: kanonik domen va o'ziga xos qoidalar.
const NETS = {
  tg: { host: 'https://t.me/' },
  ig: { host: 'https://instagram.com/' },
  x: { host: 'https://x.com/' },
  fb: { host: 'https://facebook.com/' },
};

// Qiymat to'liq veb-manzilmi? (`https://...` yoki `instagram.com/...`)
function looksLikeUrl(v) {
  return /^https?:\/\//i.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(v);
}

// Manzildan yo'l qismini ajratib olish (so'rov va lange qismisiz).
function pathOf(v) {
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    // URL sifatida o'qib bo'lmasa — qo'lda kesamiz.
    return v.replace(/^https?:\/\//i, '').split('/').slice(1).join('/').split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  }
}

// Toza username: @ va ortiqcha belgilarsiz.
function bareHandle(v) {
  return v.replace(/^@+/, '').split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
}

// Kiritilgan qiymatdan TOZA username (yoki Telegram uchun yo'l) ajratadi.
// Saqlashdan oldin ham, havola yasashda ham shu ishlatiladi.
export function socialHandle(kind, raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (!looksLikeUrl(v)) return bareHandle(v);

  const path = pathOf(v);
  if (!path) return '';

  // TELEGRAM: yo'l bir nechta bo'lakli bo'lishi mumkin va u MA'NOLI —
  // `t.me/+AbC` (taklif havolasi) yoki `t.me/joinchat/XYZ`. Ularni
  // birinchi bo'lakka qisqartirsak havola buziladi.
  if (kind === 'tg') return path;

  // Qolganlarida profil manzili birinchi bo'lakda.
  return bareHandle(path.split('/')[0]);
}

// Bosiladigan to'liq havola. Bo'sh qiymatda bo'sh satr qaytadi.
export function socialUrl(kind, raw) {
  const v = String(raw || '').trim();
  if (!v) return '';

  // Facebook va LinkedIn'da profil manzili juda xilma-xil bo'ladi
  // (`profile.php?id=...`, `/in/...`, `/company/...`) — to'liq manzil
  // berilgan bo'lsa unga TEGILMAYDI.
  if ((kind === 'fb' || kind === 'li') && /^https?:\/\//i.test(v)) return v;
  if (kind === 'li') return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`;

  const handle = socialHandle(kind, v);
  if (!handle) return '';
  const net = NETS[kind];
  return net ? net.host + handle : '';
}
