import { createPortal } from 'react-dom';
import { mapApps, openMapApp } from '../lib/mapLink.js';
import { useLanguage } from '../lib/i18n.jsx';
import { IconPin } from './Icons.jsx';

// XARITA ILOVASINI TANLASH.
//
// Egasining talabi: "xaritani tanlashda telefonda Yandex Navigator va
// boshqalarga yo'naltirishi kerak, faqat Google Maps'ni ochmoqchi
// emas".
//
// Ilgari "Yo'nalish olish" to'g'ridan-to'g'ri bitta xaritaga olib
// borardi (iPhone'da Apple, qolganlarida Google). O'zbekistonda esa
// yo'nalish uchun ko'pchilik Yandex Navigator ishlatadi — ya'ni odam
// noto'g'ri ilovaga tushardi.
//
// Nima uchun O'ZIMIZNING tanlov, `geo:` havolasi emas: `geo:` da
// Android tizimning o'z tanlovini ko'rsatadi (bu yaxshi), lekin
// iPhone'da u UMUMAN ishlamaydi — odam bosadi va hech narsa bo'lmaydi.
export default function MapAppSheet({ company, onClose }) {
  const { t } = useLanguage();
  const apps = mapApps(company);
  if (!apps.length) return null;

  return createPortal(
    <div className="ma-veil" onClick={onClose}>
      <div className="ma-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="ma-head">
          <i aria-hidden="true"><IconPin width={18} height={18} /></i>
          <b>{t('Qaysi xaritada ochilsin?')}</b>
        </div>
        {apps.map((app) => (
          <button
            key={app.id} type="button" className="ma-item vz-tap"
            onClick={() => { openMapApp(app); onClose(); }}
          >
            {app.label}
            <span aria-hidden="true">›</span>
          </button>
        ))}
        <button type="button" className="ma-close" onClick={onClose}>{t('Bekor qilish')}</button>
      </div>
    </div>,
    document.body,
  );
}
