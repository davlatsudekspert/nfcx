import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { listMyCompanies, COMPANY_STATUS } from '../lib/company.js';
import logo from '../assets/logo-128.png';

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
        <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10 sm:px-6">
          <span className="vz-kicker">{t('NFCSTORE BUSINESS')}</span>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
            {t('Kompaniyangiz uchun')}<br />
            <span style={{ color: 'var(--vz-gold)' }}>{t('alohida kabinet')}</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed" style={{ color: 'var(--vz-ink-2)' }}>
            {t('Company ID, kompaniya NFC profili, katalog va jamoa — hammasi bitta joyda. Shaxsiy NFC kartalaringiz bunga aralashmaydi.')}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {/* `next` — kirgandan keyin BIZNES kabinetga qaytadi, shaxsiy
                kabinetga emas. AuthPage shu parametrni o'qiydi. */}
            <button type="button" className="btn btn-gold min-h-12 px-6" onClick={() => navigate('/register?next=/business')}>
              {t('Kompaniya ochish')}
            </button>
            <button type="button" className="btn btn-ghost-vz min-h-12 px-6" onClick={() => navigate('/login?next=/business')}>
              {t('Kirish')}
            </button>
          </div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['01', t('ID tanlash')], ['02', t('Admin tekshiruvi')],
              ['03', t("To'lov")], ['04', t('Faollashadi')],
            ].map(([n, label]) => (
              <li key={n} className="vz-card p-4">
                <div className="font-mono text-xs" style={{ color: 'var(--vz-gold-2)' }}>{n}</div>
                <div className="mt-1 text-sm font-semibold">{label}</div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    );
  }

  // ── KIRGAN: biznes kabinet (shaxsiy profil bo'limlari YO'Q) ──────────
  return (
    <main className="cw-page">
      {head}
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <span className="vz-kicker">{t('BIZNES KABINET')}</span>
        <h1 className="font-display mt-2 text-3xl font-semibold">{t('Kompaniyalaringiz')}</h1>

        {companies === null && <div className="mt-6 vz-skel h-20 w-full" />}
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
          <div className="mt-6 space-y-2.5">
            {companies.map((c) => (
              <button
                key={c.companyId}
                type="button"
                onClick={() => navigate(`/workspace/${String(c.companyId).toLowerCase()}`)}
                className="vz-card vz-tap flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <span className="min-w-0">
                  <b className="block truncate">{c.displayName || c.companyId}</b>
                  <span className="block font-mono text-xs" style={{ color: 'var(--vz-ink-2)' }}>{c.companyId}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold" style={{ color: 'var(--vz-gold)' }}>
                  {t(COMPANY_STATUS[c.status]) || c.status} →
                </span>
              </button>
            ))}
          </div>
        )}

        <button type="button" className="btn btn-gold mt-6 min-h-12 px-6" onClick={() => navigate('/company/create')}>
          {t('Yangi Company ID')}
        </button>
      </section>
    </main>
  );
}
