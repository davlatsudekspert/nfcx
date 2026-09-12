import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { trialDaysLeft } from '../lib/access.js';
import { PROFILE_PREMIUM_FEE } from '../lib/pricing.js';
import { fmt } from '../lib/format.js';

// PREMIUM PROFIL KO'RINISHI — jilvalanuvchi kartochka.
//
// Maqsad: odam Premium "nima beradi" ni O'QIB emas, KO'RIB tushunsin.
// Shuning uchun bu kartochka premium profilning kichraytirilgan
// namunasi: oltin gardish, jilva va ochiladigan imkoniyatlar ro'yxati.
//
// Bosilganda to'lov bo'limiga olib boradi — to'lov oqimining O'ZIGA
// TEGILMAYDI (mavjud Payme oqimi, PremiumPanel ichida).
const PERKS = ['Profil musiqasi', 'Animatsion fon', 'Istorya va post', 'Maxsus ranglar', 'Video'];

export default function PremiumPreviewCard({ user }) {
  const { t } = useLanguage();
  const premiumUntil = user?.premiumExpiresAt ? new Date(user.premiumExpiresAt) : null;
  const lifetime = !!user?.isPremium && !premiumUntil;
  const trialLeft = trialDaysLeft(user);

  const status = lifetime
    ? t('Muddatsiz faol')
    : premiumUntil
      ? t('{d} gacha faol', { d: premiumUntil.toLocaleDateString('uz-UZ') })
      : trialLeft != null
        ? t('Sinov: {n} kun qoldi', { n: trialLeft })
        : t('Oyiga {n} so‘m', { n: fmt(PROFILE_PREMIUM_FEE) });

  return (
    <button type="button" className="pp-card" onClick={() => navigate('/account#premium-panel')}>
      <span className="pp-shine" aria-hidden="true" />
      <span className="pp-head">
        <b>PREMIUM</b>
        <em>{status}</em>
      </span>
      <span className="pp-perks">
        {PERKS.map((perk) => <i key={perk}>{t(perk)}</i>)}
      </span>
      <span className="pp-cta">
        {user?.isPremium ? t('Boshqarish') : t('Premium olish')} <span aria-hidden="true">→</span>
      </span>
    </button>
  );
}
