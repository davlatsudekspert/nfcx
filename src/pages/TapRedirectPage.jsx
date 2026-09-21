import { useEffect, useState } from 'react';
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
  // BOG'LANGANINI AYTIB QO'YISH SHART.
  //
  // Ilgari stiker jim bog'lanib, odam to'g'ridan-to'g'ri profilga
  // tushardi — va u "stikerim ishladimi yoki shunchaki sayt
  // ochildimi?" deb bilmasdi. Endi qisqa tasdiq ko'rsatiladi,
  // keyin profil ochiladi.
  const [bound, setBound] = useState(null);

  useEffect(() => {
    let live = true;
    const go = (to) => { if (live) navigate(to, { replace: true }); };

    // BOG'LANMAGAN STIKER — IKKI HOLAT.
    //
    // 1) Odam QR bilan allaqachon faollashtirgan (konvertdagi kodni
    //    kiritgan), lekin stikeri bog'lanmagan. Unda tegizishning
    //    O'ZI bog'lash uchun yetarli: kod — sotib olganlik isboti,
    //    tegizish — stiker qo'lda ekanining isboti. Odam hech narsa
    //    qilmaydi, shunchaki tegizadi va profili ochiladi.
    //
    // 2) Hali faollashtirmagan — faollashtirish sahifasiga tokeni
    //    bilan boradi va kodni kiritganda bog'lanadi.
    //
    // Serverning o'zi ajratadi: "kutayotgan aktivatsiya" bo'lmasa
    // 409 qaytaradi va biz 2-yo'lga o'tamiz.
    const attach = () => fetch('/api/activate/attach-sticker', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ deviceToken: token }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.redirect) return go(`/activate?d=${encodeURIComponent(token)}`);
        if (!live) return undefined;
        setBound(d);
        // Tasdiq ko'rinib ulgursin, lekin yo'lni to'smasin.
        setTimeout(() => go(d.redirect), 1900);
        return undefined;
      })
      .catch(() => go(`/activate?d=${encodeURIComponent(token)}`));

    fetch(`/api/tap/${encodeURIComponent(token)}`, { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.found === false) return go('/');
        if (d.linkedCode) return go(`/${String(d.linkedCode).toLowerCase()}?t=${encodeURIComponent(token)}`);
        if (d.linkedCompanyId) return go(`/c/${String(d.linkedCompanyId).toLowerCase()}`);
        return attach();
      })
      .catch(() => go('/'));
    return () => { live = false; };
  }, [token]);

  if (bound) {
    return (
      <main className="tap-wait">
        <div className="tap-ok" role="status">
          <div className="tap-ok-check" aria-hidden="true">✓</div>
          <h1>{t('NFC stiker ulandi')}</h1>
          <p className="tap-ok-code">{bound.profileCode}</p>
          <p className="tap-ok-sub">
            {t('Bundan keyin stikerni telefonga tekkizsangiz shu profil ochiladi.')}
          </p>
          <button type="button" className="btn btn-gold" onClick={() => navigate(bound.redirect, { replace: true })}>
            {t('Profilni ochish')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="tap-wait">
      <span className="loading loading-spinner loading-lg" aria-hidden="true" />
      <p>{t('Ochilmoqda…')}</p>
    </main>
  );
}
