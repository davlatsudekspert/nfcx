import { useEffect } from 'react';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import { PROFILE_PREMIUM_FEE } from '../lib/pricing.js';

// Yopiq (premium) funksiya bosilganda ko'rsatiladigan oyna. Spec 18:
// funksiyani YASHIRMAYMIZ — bosilganda ikki yo'lni tushuntiramiz:
//   1) Profile Premium (NFC ID o'zgarmaydi)
//   2) Yangi, yuqoriroq NFC ID
// Agressiv reklama emas — sokin va aniq.
export default function LockedFeatureModal({ featureLabel, onClose, onGoPremium }) {
  const { t } = useLanguage();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goPremium = () => {
    onClose();
    if (onGoPremium) onGoPremium();
    else navigate('/account');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-base-200 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="text-base font-bold">
            {'\u{1F512}'} {featureLabel
              ? t('«{f}» — hozirgi profilingizda yopiq', { f: featureLabel })
              : t('Bu funksiya hozirgi profilingizda yopiq.')}
          </div>
          <button className="btn btn-ghost btn-xs shrink-0" onClick={onClose}>&times;</button>
        </div>

        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="text-sm font-bold text-accent">
            {t('Premium profil — {n} so‘m', { n: fmt(PROFILE_PREMIUM_FEE) })}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-base-content/60">
            {t("Hozirgi NFC ID'ingiz o'zgarmaydi, lekin Premium imkoniyatlar ochiladi.")}
          </p>
          <button className="btn btn-accent btn-sm mt-3 w-full" onClick={goPremium}>
            {t("Premium'ga o'tish")}
          </button>
        </div>

        <div className="my-3 flex items-center gap-3 text-[11px] uppercase tracking-widest text-base-content/35">
          <span className="h-px flex-1 bg-white/10" /> {t('YOKI')} <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="rounded-xl border border-white/10 bg-base-100/40 p-4">
          <p className="text-xs leading-relaxed text-base-content/60">
            {t('Yuqoriroq NFC ID — Silver, Gold, Premium yoki Exclusive — tanlang. Har biri o‘z darajasidagi imkoniyatlarni ochadi.')}
          </p>
          <button
            className="btn btn-outline btn-sm mt-3 w-full"
            onClick={() => { onClose(); navigate('/narxlar'); }}
          >
            {t('NFC ID tanlash')}
          </button>
        </div>
      </div>
    </div>
  );
}
