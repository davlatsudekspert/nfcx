import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { listMyCompanies, COMPANY_STATUS } from '../lib/company.js';
import logo from '../assets/logo-128.png';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';
// `.cw-page` / `.cw-header` uslublari SHU FAYLDA. Import qilinmasa
// sarlavha uslubsiz — logotip ulkan, yozuvlar bir-birining ostiga
// tushib qolgan holda chiqadi (egasi 2026-09 da aynan shuni ko'rsatdi):
// avval bu CSS faqat boshqa kompaniya sahifalari bilan yuklanardi.
import '../company-system.css';
import './business-entry.css';

// NFCSTORE BUSINESS — kompaniyalar uchun ALOHIDA KIRISH ESHIGI (/business).
//
// NIMA UCHUN: ilgari kompaniya bo'limiga faqat shaxsiy kabinet ichidagi
// yon menyudan kirilardi — egasi buni "shaxsiy profil ichiga kirib
// ketyapti" deb ta'rifladi va alohida qilishni so'radi.
//
// AKKAUNT ESA BITTA (egasining qarori): telefon raqami login bo'lgani
// uchun alohida akkaunt qilinsa, odamda ikkinchi raqam bo'lishi shart
// bo'lardi va to'lov tarixi ikkiga bo'linib ketardi. Shuning uchun
// ajratish KO'RINISH va OQIM darajasida: alohida manzil, alohida kirish
// oynasi, alohida kabinet — lekin o'sha telefon/parol bilan.
//
// Bu sahifa `bare` rejimida ochiladi: saytning umumiy sarlavhasi va
// menyusi KO'RINMAYDI, shaxsiy profil bo'limlari ham yo'q.
export default function BusinessEntryPage() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [companies, setCompanies] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!user) { setCompanies(null); return; }
    listMyCompanies()
      .then((list) => setCompanies(Array.isArray(list) ? list : (list?.companies || [])))
      .catch((e) => { setErr(e); setCompanies([]); });
  }, [user]);

  const head = (
    <header className="cw-header">
      <button className="cw-brand" type="button" onClick={() => navigate('/')}>
        <i><img src={logo} alt="NFCSTORE" /></i><b>NFCSTORE</b><span>{t('BUSINESS')}</span>
      </button>
      <div className="cw-head-actions">
        {user
          ? <button type="button" onClick={() => navigate('/account')}>{t('Shaxsiy profil')} ↗</button>
          : <button type="button" onClick={() => navigate('/')}>{t('Asosiy sayt')} ↗</button>}
      </div>
    </header>
  );

  if (loading) return <main className="cw-page">{head}<div className="cw-state">{t('Yuklanmoqda…')}</div></main>;

  // ── KIRMAGAN: biznes uslubidagi alohida kirish eshigi ────────────────
  if (!user) {
    return (
      <main className="cw-page">
        {head}
        <section className="be-hero">
          <div className="min-w-0">
            <span className="be-kicker">{t('NFCSTORE BUSINESS')}</span>
            <h1 className="be-title">
              {t('Kompaniyangiz uchun')}
              <span>{t('alohida kabinet')}</span>
            </h1>
            <p className="be-lead">
              {t('Company ID, kompaniya NFC profili, katalog va jamoa — hammasi bitta joyda. Shaxsiy NFC kartalaringiz bunga aralashmaydi.')}
            </p>

            <div className="be-actions">
              {/* `next` — kirgandan keyin BIZNES kabinetga qaytadi, shaxsiy
                  kabinetga emas. AuthPage shu parametrni o'qiydi. */}
              <button type="button" className="btn btn-gold min-h-12 px-7" onClick={() => navigate('/register?next=/business')}>
                {t('Kompaniya ochish')}
              </button>
              <button type="button" className="btn btn-ghost-vz min-h-12 px-7" onClick={() => navigate('/login?next=/business')}>
                {t('Kirish')}
              </button>
            </div>

            <ol className="be-steps">
              {[
                ['01', t('ID tanlash')], ['02', t('Admin tekshiruvi')],
                ['03', t("To'lov")], ['04', t('Faollashadi')],
              ].map(([n, label]) => (
                <li key={n}><b>{n}</b><span>{label}</span></li>
              ))}
            </ol>
          </div>

          {/* O'NG USTUN — kompaniya NFC kartasi va NFC signali.
              Avval bu yerda hech narsa yo'q edi va sahifa katta ekranda
              o'rtada kichkina bo'lib qolardi. */}
          <div className="be-visual" aria-hidden="true">
            <div className="be-waves">
              {/* 10 ta to'lqin: bir xil halqa, faqat kechikishi boshqa —
                  shundan uzluksiz signal tuyg'usi hosil bo'ladi. */}
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className="be-wave" style={{ animationDelay: `${(i * 0.5).toFixed(2)}s` }} />
              ))}
            </div>
            <div className="be-card">
              <Interactive3DCard>
                {/* Namunaviy kompaniya kartasi. Kod haqiqiy Company ID
                    shakliga o'xshasin — "NFCSTORE" uzun bo'lib, karta
                    ustidagi brend yozuvi bilan takrorlanib ketardi. */}
                <NfcCard code="BIZ001" name={t('KOMPANIYANGIZ')} finish="black" size="lg" rim />
              </Interactive3DCard>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ── KIRGAN: biznes kabinet (shaxsiy profil bo'limlari YO'Q) ──────────
  //
  // Kirmagan holat bilan BIR XIL joylashuv: matn chapda, karta o'ngda.
  // Avval ro'yxat sahifaning o'rtasida tor ustun bo'lib turardi va
  // katta ekranda ikki yoni bo'sh qolardi.
  return (
    <main className="cw-page">
      {head}
      <section className="be-hero">
        <div className="min-w-0">
          <span className="be-kicker">{t('BIZNES KABINET')}</span>
          <h1 className="be-title" style={{ fontSize: 'clamp(32px, 3.6vw, 50px)' }}>{t('Kompaniyalaringiz')}</h1>

          {companies === null && <div className="be-list"><div className="vz-skel h-16 w-full" /><div className="vz-skel h-16 w-full" /></div>}
          {err && <div role="alert" className="alert alert-error mt-6 py-2 text-sm"><span>{t("Ro'yxatni yuklab bo'lmadi. Qayta urinib ko'ring.")}</span></div>}

          {companies !== null && companies.length === 0 && !err && (
            <div className="vz-empty mt-6">
              <b>{t('Hali kompaniya yo‘q')}</b>
              <p className="mt-1 text-sm" style={{ color: 'var(--vz-ink-2)' }}>
                {t('Company ID oching — kompaniyangizning NFC profili, public sahifasi va boshqaruv markazi shu ID bilan bog‘lanadi.')}
              </p>
            </div>
          )}

          {companies !== null && companies.length > 0 && (
            <div className="be-list">
              {companies.map((c) => (
                <button
                  key={c.companyId}
                  type="button"
                  onClick={() => navigate(`/workspace/${String(c.companyId).toLowerCase()}`)}
                  className="be-item vz-tap"
                >
                  <span className="min-w-0">
                    <b className="truncate">{c.displayName || c.companyId}</b>
                    <small>{c.companyId}</small>
                  </span>
                  <i>{t(COMPANY_STATUS[c.status]) || c.status} →</i>
                </button>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-gold mt-7 min-h-12 px-7" onClick={() => navigate('/company/create')}>
            {t('Yangi Company ID')}
          </button>
        </div>

        {/* O'ng ustun — kirmagan holatdagi bilan bir xil karta va NFC
            signali. Sahifaning ikki yoni bo'sh qolmaydi. */}
        <div className="be-visual" aria-hidden="true">
          <div className="be-waves">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="be-wave" style={{ animationDelay: `${(i * 0.5).toFixed(2)}s` }} />
            ))}
          </div>
          <div className="be-card">
            <Interactive3DCard>
              <NfcCard
                code={companies?.[0]?.companyId || 'BIZ001'}
                name={companies?.[0]?.displayName?.toUpperCase() || t('KOMPANIYANGIZ')}
                finish="black"
                size="lg"
                rim
              />
            </Interactive3DCard>
          </div>
        </div>
      </section>
    </main>
  );
}
