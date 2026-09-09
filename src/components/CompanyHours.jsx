import { useState } from 'react';
import { DAY_SHORT, WEEK_ORDER, dayLabel, hoursEmpty, normalizeHours } from '../lib/hours.js';
import { useLanguage } from '../lib/i18n.jsx';

// "Hozir ochiq / yopiq" belgisi va to'liq jadval.
//
// DIQQAT: ochiq/yopiq holatini BU YERDA hisoblamaymiz — u serverdan
// `company.openNow` bo'lib keladi. Sabab: brauzerdagi vaqt tashrifchining
// mintaqasi (yoki noto'g'ri qo'yilgan soati) bo'yicha bo'lardi, ish vaqti
// esa har doim TOSHKENT vaqti bo'yicha. Chet eldan qaragan odam yopiq
// restoranni "ochiq" deb ko'rmasligi kerak.
export default function CompanyHours({ hours, openNow, compact = false }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const week = normalizeHours(hours);
  if (hoursEmpty(week)) return null;

  const isOpen = !!(openNow && openNow.open);
  const today = openNow && openNow.today;

  return (
    <div className={`ch-box ${compact ? 'is-compact' : ''}`}>
      <button type="button" className="ch-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`ch-dot ${isOpen ? 'is-open' : ''}`} aria-hidden="true" />
        <b>{isOpen ? t('Hozir ochiq') : t('Hozir yopiq')}</b>
        {today && <small>{today.open}–{today.close}</small>}
        <i aria-hidden="true">{open ? '▴' : '▾'}</i>
      </button>
      {open && (
        <ul className="ch-list">
          {WEEK_ORDER.map((i) => (
            <li key={i}><span>{t(DAY_SHORT[i])}</span><b>{week[i].closed ? t('Yopiq') : dayLabel(week[i])}</b></li>
          ))}
          <li className="ch-tz"><span>{t('Vaqt Toshkent bo‘yicha')}</span></li>
        </ul>
      )}
    </div>
  );
}
