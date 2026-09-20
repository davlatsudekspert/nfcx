import { useEffect } from 'react';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';

// ── NFC TEGISH: /t/<chip_token> ──────────────────────────────────────
//
// NIMA UCHUN BU SAHIFA BOR, GARCHI WORKER'DA HAM SHU MARSHRUT BO'LSA.
//
// `hosting/worker.js` `/t/<token>` ni 302 bilan to'g'ri yo'naltiradi va
// mahalliy sinovda BENUQSON ishlaydi. Lekin productionda Cloudflare
// statik fayllar qatlami oldinroq turadi: `not_found_handling` —
// "single-page-application". Odam stikerga TEGIZGANDA brauzer oddiy
// navigatsiya so'rovi yuboradi (`Accept: text/html`), u hech qanday
// faylga to'g'ri kelmaydi va SPA qoidasi bo'yicha `index.html`
// qaytariladi — WORKER UMUMAN ISHGA TUSHMAYDI. Natijada React noma'lum
// yo'lni ko'rib BOSH SAHIFANI chizardi.
//
// `/api/*` esa ishlayverardi, chunki u `fetch()` orqali va JSON
// kutiladi — navigatsiya so'rovi emas. Shuning uchun xato faqat
// STIKERGA TEGIZGANDA chiqardi va admin panel butunlay soz ko'rinardi.
//
// `wrangler.jsonc` dagi `run_worker_first` ga ro'yxat qo'shish BU
// MUAMMONI YECHMAYDI, balki yangisini yaratadi: o'sha faylda yozilgan
// tajriba aynan shuni aytadi — ro'yxat berilganda qolgan hamma narsa,
// jumladan `/api/*`, statikaga tushib sayt ishdan chiqqan.
//
// Shuning uchun yo'naltirish MIJOZ TOMONIDA ham bor. Worker marshruti
// olib tashlanmaydi: QR skanerlar va Telegram kabi `Accept: */*`
// yuboradigan mijozlarda u ishlaydi va bir qadam tezroq.
export default function TapRedirectPage({ token }) {
  const { t } = useLanguage();

  useEffect(() => {
    let live = true;
    const go = (to) => { if (live) navigate(to, { replace: true }); };
    fetch(`/api/tap/${encodeURIComponent(token)}`, { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.found === false) return go('/');
        if (d.linkedCode) return go(`/${String(d.linkedCode).toLowerCase()}?t=${encodeURIComponent(token)}`);
        if (d.linkedCompanyId) return go(`/c/${String(d.linkedCompanyId).toLowerCase()}`);
        // Qurilma bor, lekin hali bog'lanmagan — mahsulot sotilgan,
        // ammo faollashtirilmagan. Token o'zi bilan ketadi, shunda
        // odam qaysi stikerni tekkizgan bo'lsa AYNAN o'sha bog'lanadi.
        return go(`/activate?d=${encodeURIComponent(token)}`);
      })
      .catch(() => go('/'));
    return () => { live = false; };
  }, [token]);

  return (
    <main className="tap-wait">
      <span className="loading loading-spinner loading-lg" aria-hidden="true" />
      <p>{t('Ochilmoqda…')}</p>
    </main>
  );
}
