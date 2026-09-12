import { useState } from 'react';
import { toggleCompanyFollow, companyCta } from '../lib/company.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import ShareButton from './ShareButton.jsx';

// Kompaniya profilidagi raqamlar qatori: nechta ko'rilgan, nechta
// obunachi, va ulashish tugmasi.
//
// Raqamlar HAQIQIY: ko'rishlar statistika jamlanmasidan (Statistika
// bo'limidagi son bilan BIR MANBA), obunachilar esa haqiqiy obuna
// yozuvlaridan. Bu yerda hech narsa "chiroyli ko'rinsin" deb
// to'qilmaydi.
// `showShare` — "Ulashish" tugmasi shu qatorda chiqsinmi. NFC profilida
// u endi aloqa ikonkalari QATORIDA turadi (egasining talabi: "ulashishni
// ham linklar orasiga qo'shib qo'yish kerak"), shuning uchun bu yerda
// takrorlanmaydi.
export default function CompanyStatsBar({ company, onChange, showShare = true }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

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

  // Katalogdagi mavjud yozuvlar soni va uning nomi.
  const catalogCount = (company.catalog || []).filter((i) => i && i.available !== false).length;
  const catalogNoun = companyCta(company.category).noun;

  return (
    <div className="cq-metrics">
      <div className="cq-metric"><b>{fmt(company.views || 0)}</b><small>{t('ko‘rildi')}</small></div>
      <div className="cq-metric"><b>{fmt(company.followers || 0)}</b><small>{t('obunachi')}</small></div>
      {/* KATALOG SONI — spec bo'yicha uchinchi raqam. Katalog bo'sh
          bo'lsa umuman chizilmaydi: "0 mahsulot" deb turish
          kompaniyani tashlandiq ko'rsatardi. Nomi turiga qarab
          o'zgaradi (taom / mahsulot / xizmat). */}
      {catalogCount > 0 && (
        <div className="cq-metric"><b>{fmt(catalogCount)}</b><small>{t(catalogNoun)}</small></div>
      )}
      <div className="cq-metric-actions">
        {!isOwner && (
          <button type="button" className={`cq-follow ${company.following ? 'is-on' : ''}`} onClick={follow} disabled={busy}>
            {company.following ? t('Obuna bo‘lingan') : t('Obuna bo‘lish')}
          </button>
        )}
        {/* Saytdagi barcha "Ulashish" tugmalari bir xil: telefonda
            tizim oynasi, ish stolida esa Telegram/WhatsApp/Facebook/X
            menyusi (izohi src/components/ShareButton.jsx da). */}
        {showShare && <ShareButton
          url={url}
          title={company.displayName}
          text={company.description || company.displayName}
          label={t('Ulashish')}
          className="cq-share"
        />}
      </div>
    </div>
  );
}
