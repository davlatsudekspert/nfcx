import { useState } from 'react';
import { toggleCompanyFollow } from '../lib/company.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';

// Kompaniya profilidagi raqamlar qatori: nechta ko'rilgan, nechta
// obunachi, va ulashish tugmasi.
//
// Raqamlar HAQIQIY: ko'rishlar statistika jamlanmasidan (Statistika
// bo'limidagi son bilan BIR MANBA), obunachilar esa haqiqiy obuna
// yozuvlaridan. Bu yerda hech narsa "chiroyli ko'rinsin" deb
// to'qilmaydi.
export default function CompanyStatsBar({ company, onChange }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);

  const isOwner = user && String(user.id) === String(company.ownerUserId);
  const url = `${window.location.origin}/c/${company.companyId.toLowerCase()}`;

  const follow = async () => {
    if (busy) return;
    // Kirmagan odam obuna bo'la olmaydi — uni kirish sahifasiga
    // yuboramiz va qaytib shu sahifaga tushsin.
    if (!user) { navigate(`/login?next=${encodeURIComponent(`/c/${company.companyId.toLowerCase()}`)}`); return; }
    setBusy(true);
    try {
      const res = await toggleCompanyFollow(company.companyId);
      onChange?.({ followers: res.followers, following: res.following });
    } catch { /* jim tur */ } finally { setBusy(false); }
  };

  const share = async () => {
    const data = { title: company.displayName, text: company.description || company.displayName, url };
    // Telefonda tizimning o'z "ulashish" oynasi ochiladi (Telegram,
    // WhatsApp, Instagram...). Kompyuterda u yo'q — havola nusxalanadi.
    try {
      if (navigator.share) { await navigator.share(data); return; }
    } catch { return; /* foydalanuvchi bekor qildi — xato emas */ }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* ruxsat yo'q */ }
  };

  return (
    <div className="cq-metrics">
      <div className="cq-metric"><b>{fmt(company.views || 0)}</b><small>{t('ko‘rildi')}</small></div>
      <div className="cq-metric"><b>{fmt(company.followers || 0)}</b><small>{t('obunachi')}</small></div>
      <div className="cq-metric-actions">
        {!isOwner && (
          <button type="button" className={`cq-follow ${company.following ? 'is-on' : ''}`} onClick={follow} disabled={busy}>
            {company.following ? t('Obuna bo‘lingan') : t('Obuna bo‘lish')}
          </button>
        )}
        <button type="button" className="cq-share" onClick={share} aria-label={t('Ulashish')}>
          {shared ? t('Havola nusxalandi') : `↗ ${t('Ulashish')}`}
        </button>
      </div>
    </div>
  );
}
