import { useCallback, useEffect, useMemo, useState } from 'react';
import { companyCta, getCompany } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import { IconPhone, IconTelegram, IconGlobe } from '../components/Icons.jsx';
import '../company-system.css';

const fallbackCover = '/business-assets/construction-hero.jpg';

function contactUrl(kind, value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (kind === 'phone') return `tel:${clean.replace(/[^+\d]/g, '')}`;
  if (kind === 'telegram') return clean.startsWith('http') ? clean : `https://t.me/${clean.replace(/^@/, '')}`;
  if (kind === 'whatsapp') return clean.startsWith('http') ? clean : `https://wa.me/${clean.replace(/\D/g, '')}`;
  return clean.startsWith('http') ? clean : `https://${clean}`;
}

// Tarmoq xatosi (fetch yiqildi) — "topilmadi"dan farqli: qayta urinish taklif qilinadi.
function isNetworkError(err) {
  return err instanceof TypeError || /failed to fetch|network/i.test(String(err && err.message));
}

export default function CompanyQuickProfilePage({ companyId }) {
  const { t } = useLanguage();
  const [company, setCompany] = useState(undefined);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let live = true;
    setCompany(undefined);
    setError(null);
    getCompany(companyId)
      .then((data) => live && setCompany(data.company))
      .catch((err) => {
        if (!live) return;
        if (isNetworkError(err)) setError(err);
        setCompany(null);
      });
    return () => { live = false; };
  }, [companyId]);

  useEffect(() => load(), [load]);

  const cta = companyCta(company?.category);
  const items = useMemo(() => (company?.catalog || []).filter((item) => item.available !== false).slice(0, 4), [company]);

  if (company === undefined) {
    return (
      <main className="cq-page" aria-busy="true">
        <div className="cq-shell" style={{ '--cq-cover': 'none' }}>
          <div className="cq-identity" style={{ paddingTop: 48 }}>
            <div className="vz-skel mx-auto" style={{ width: 82, height: 82, borderRadius: 25 }} />
            <div className="vz-skel mx-auto mt-4" style={{ width: '60%', height: 22 }} />
            <div className="vz-skel mx-auto mt-3" style={{ width: '40%' }} />
            <div className="vz-skel mx-auto mt-3" style={{ width: '80%' }} />
          </div>
          <div className="cq-actions"><div className="vz-skel" style={{ height: 44 }} /><div className="vz-skel" style={{ height: 44 }} /></div>
          <span className="sr-only">{t('Yuklanmoqda…')}</span>
        </div>
      </main>
    );
  }

  if (!company) {
    return (
      <main className="cq-state">
        <div className="cq-mark">N</div>
        <h1 className="vz-h1" style={{ fontSize: 'clamp(26px,5vw,36px)' }}>{error ? t("Server bilan aloqa yo'q") : t('Kompaniya topilmadi')}</h1>
        <p className="vz-lead mx-auto">{error
          ? t("Ma'lumotni yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.")
          : t('Company ID faol emas yoki admin tomonidan hali tasdiqlanmagan.')}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {error && <button type="button" className="btn btn-gold" onClick={load}>{t('Qayta urinish')}</button>}
          <button type="button" className={error ? 'btn btn-ghost-vz' : 'btn btn-gold'} onClick={() => navigate('/kompaniyalar')}>{t('Kompaniyalarni ko‘rish')}</button>
        </div>
      </main>
    );
  }

  const mapUrl = company.latitude && company.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${company.latitude},${company.longitude}`
    : company.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}` : '';

  return (
    <main className="cq-page" style={{ '--cq-cover': `url("${company.coverUrl || fallbackCover}")` }}>
      <div className="cq-shell">
        <header className="cq-top"><span className="cq-brand"><i>N</i> NFCSTORE</span><span className="cq-id">COMPANY ID · {company.companyId}</span></header>
        <section className="cq-identity">
          <div className="cq-logo">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : (company.displayName || 'N').slice(0, 2).toUpperCase()}</div>
          <span className="cq-live">● {t('TASDIQLANGAN KOMPANIYA')}</span>
          <h1 className="break-words">{company.displayName}</h1>
          <p className="cq-category break-words">{company.subcategory || company.categoryLabel || t('Kompaniya')} · {company.city || t('O‘zbekiston')}</p>
          <p className="cq-description break-words">{company.description || t('Kompaniya haqida qisqa ma’lumot.')}</p>
        </section>

        <section className="cq-actions">
          {company.phone && <a className="primary vz-tap" href={contactUrl('phone', company.phone)}><IconPhone width={14} height={14} aria-hidden="true" />&nbsp;{t('Qo‘ng‘iroq')}</a>}
          {company.telegram && <a className="vz-tap" href={contactUrl('telegram', company.telegram)} target="_blank" rel="noreferrer"><IconTelegram width={14} height={14} aria-hidden="true" />&nbsp;Telegram</a>}
          {company.whatsapp && <a className="vz-tap" href={contactUrl('whatsapp', company.whatsapp)} target="_blank" rel="noreferrer">WhatsApp</a>}
          {mapUrl && <a className="vz-tap" href={mapUrl} target="_blank" rel="noreferrer"><IconGlobe width={14} height={14} aria-hidden="true" />&nbsp;{t('Manzil')}</a>}
        </section>

        {items.length > 0 && (
          <section className="cq-offers" id="catalog">
            <div className="cq-section-head"><div><span>01</span><h2>{t(cta.noun)}</h2></div><button type="button" className="vz-tap" onClick={() => navigate(`/company/${company.companyId.toLowerCase()}#catalog`)}>{t(cta.label)} →</button></div>
            <div className="cq-item-grid">
              {items.map((item) => <article key={item.id} className="min-w-0"><img src={item.imageUrl || company.coverUrl || fallbackCover} alt="" /><div><b className="break-words">{item.name}</b><p>{item.description || item.category}</p><strong>{fmt(item.price)} {t('so‘m')}</strong></div></article>)}
            </div>
          </section>
        )}

        <button type="button" className="cq-public vz-tap" onClick={() => navigate(`/company/${company.companyId.toLowerCase()}`)}>{t('Kompaniya saytini to‘liq ochish')} <span>↗</span></button>
        <footer><span>{t('NFC orqali ochildi')}</span><b>NFCSTORE BUSINESS</b></footer>
      </div>
    </main>
  );
}
