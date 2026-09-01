import { useEffect, useMemo, useState } from 'react';
import { companyCta, getCompany } from '../lib/company.js';
import { navigate } from '../lib/router.js';
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

export default function CompanyQuickProfilePage({ companyId }) {
  const [company, setCompany] = useState(undefined);
  useEffect(() => {
    let live = true;
    getCompany(companyId).then((data) => live && setCompany(data.company)).catch(() => live && setCompany(null));
    return () => { live = false; };
  }, [companyId]);

  const cta = companyCta(company?.category);
  const items = useMemo(() => (company?.catalog || []).filter((item) => item.available !== false).slice(0, 4), [company]);
  if (company === undefined) return <main className="cq-state">Yuklanmoqda…</main>;
  if (!company) return <main className="cq-state"><div className="cq-mark">N</div><h1>Kompaniya topilmadi</h1><p>Company ID faol emas yoki admin tomonidan hali tasdiqlanmagan.</p><button onClick={() => navigate('/kompaniyalar')}>Kompaniyalarni ko‘rish</button></main>;

  const mapUrl = company.latitude && company.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${company.latitude},${company.longitude}`
    : company.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}` : '';

  return (
    <main className="cq-page" style={{ '--cq-cover': `url("${company.coverUrl || fallbackCover}")` }}>
      <div className="cq-shell">
        <header className="cq-top"><span className="cq-brand"><i>N</i> NFCSTORE</span><span className="cq-id">COMPANY ID · {company.companyId}</span></header>
        <section className="cq-identity">
          <div className="cq-logo">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : (company.displayName || 'N').slice(0, 2).toUpperCase()}</div>
          <span className="cq-live">● TASDIQLANGAN KOMPANIYA</span>
          <h1>{company.displayName}</h1>
          <p className="cq-category">{company.subcategory || company.categoryLabel || 'Kompaniya'} · {company.city || 'O‘zbekiston'}</p>
          <p className="cq-description">{company.description || 'Kompaniya haqida qisqa ma’lumot.'}</p>
        </section>

        <section className="cq-actions">
          {company.phone && <a className="primary" href={contactUrl('phone', company.phone)}>📞 Qo‘ng‘iroq</a>}
          {company.telegram && <a href={contactUrl('telegram', company.telegram)} target="_blank" rel="noreferrer">✈ Telegram</a>}
          {company.whatsapp && <a href={contactUrl('whatsapp', company.whatsapp)} target="_blank" rel="noreferrer">◉ WhatsApp</a>}
          {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer">⌖ Manzil</a>}
        </section>

        {items.length > 0 && (
          <section className="cq-offers" id="catalog">
            <div className="cq-section-head"><div><span>01</span><h2>{cta.noun}</h2></div><button onClick={() => navigate(`/company/${company.companyId.toLowerCase()}#catalog`)}>{cta.label} →</button></div>
            <div className="cq-item-grid">
              {items.map((item) => <article key={item.id}><img src={item.imageUrl || company.coverUrl || fallbackCover} alt="" /><div><b>{item.name}</b><p>{item.description || item.category}</p><strong>{Number(item.price || 0).toLocaleString('uz-UZ')} so‘m</strong></div></article>)}
            </div>
          </section>
        )}

        <button className="cq-public" onClick={() => navigate(`/company/${company.companyId.toLowerCase()}`)}>Kompaniya saytini to‘liq ochish <span>↗</span></button>
        <footer><span>NFC orqali ochildi</span><b>NFCSTORE BUSINESS</b></footer>
      </div>
    </main>
  );
}

