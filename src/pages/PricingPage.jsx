import { useState } from 'react';
import { dbGet } from '../lib/db.js';
import { parseAnyCode, priceForCode, TIER_LABEL, TIER_COLOR } from '../lib/pricing.js';
import { fmt } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import ReserveModal from '../components/ReserveModal.jsx';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';
import NeonOrbitCard from '../components/NeonOrbitCard.jsx';

function useMaskedCode() {
  const [value, setValue] = useState('');
  const onChange = (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let letters = '', digits = '';
    for (const ch of raw) {
      if (letters.length < 3 && /[A-Z]/.test(ch)) {
        if (letters === 'GO' && ch === 'D') continue; // GOD prefiksi ishlatilmaydi
        letters += ch;
      } else if (/^[0-9]$/.test(ch) && digits.length < 3) digits += ch;
    }
    setValue(digits ? `${letters} ${digits}` : letters);
  };
  return [value, onChange];
}

const TIER_HINT = {
  uz: {
    exclusive: 'Noyob ID’lar uchun auksion',
    premium: 'Eng noyob va maxsus kombinatsiyalar',
    gold: 'Chiroyli va tanilgan kombinatsiyalar',
    silver: 'Esda qoladigan raqamlar',
    free: 'Boshlash uchun yetarli',
  },
  ru: {
    exclusive: 'Аукцион для редких ID',
    premium: 'Самые редкие и особые комбинации',
    gold: 'Красивые и узнаваемые комбинации',
    silver: 'Запоминающиеся номера',
    free: 'Достаточно, чтобы начать',
  },
  en: {
    exclusive: 'Auction for rare IDs',
    premium: 'The rarest, most special combinations',
    gold: 'Beautiful, recognizable combinations',
    silver: 'Memorable numbers',
    free: 'Enough to get started',
  },
};
const TIER_PRICE_TEXT = {
  uz: { exclusive: 'Auksionda', premium: '199 000', gold: '149 000', silver: '99 000', free: '49 000' },
  ru: { exclusive: 'На аукционе', premium: '199 000', gold: '149 000', silver: '99 000', free: '49 000' },
  en: { exclusive: 'At auction', premium: '199,000', gold: '149,000', silver: '99,000', free: '49,000' },
};
const EXAMPLES = {
  uz: [
    { code: 'MXK413', note: 'Naqshsiz — TEKIN' },
    { code: 'LOL101', note: 'Zerkalniy (ko’zgu) raqam — Silver' },
    { code: 'ABB770', note: 'Ham harfda, ham raqamda juftlik — Silver' },
    { code: 'XYZ007', note: 'Kuchli nol raqam (007) — Gold' },
    { code: 'IIB412', note: 'Davlat xizmati so’zi — Gold' },
    { code: 'DAV010', note: 'Davlat so’zi + maxsus raqam — Premium' },
    { code: 'BMW007', note: 'Taniqli so’z + nodir raqam — Premium' },
    { code: 'VIP001', note: 'Ekslyuziv so’z — Ekslyuziv' },
  ],
  ru: [
    { code: 'MXK413', note: 'Без узора — БЕСПЛАТНО' },
    { code: 'LOL101', note: 'Зеркальная цифра — Silver' },
    { code: 'ABB770', note: 'Пара и в буквах, и в цифрах — Silver' },
    { code: 'XYZ007', note: 'Сильный ноль (007) — Gold' },
    { code: 'IIB412', note: 'Госслово — Gold' },
    { code: 'DAV010', note: 'Госслово + особая цифра — Premium' },
    { code: 'BMW007', note: 'Известное слово + редкая цифра — Premium' },
    { code: 'VIP001', note: 'Эксклюзивное слово — Эксклюзив' },
  ],
  en: [
    { code: 'MXK413', note: 'No pattern — FREE' },
    { code: 'LOL101', note: 'Mirror number — Silver' },
    { code: 'ABB770', note: 'Pair in both letters and digits — Silver' },
    { code: 'XYZ007', note: 'Strong zero (007) — Gold' },
    { code: 'IIB412', note: 'Government word — Gold' },
    { code: 'DAV010', note: 'Gov word + special number — Premium' },
    { code: 'BMW007', note: 'Known word + rare number — Premium' },
    { code: 'VIP001', note: 'Exclusive word — Exclusive' },
  ],
};
const TIERS = ['exclusive', 'premium', 'gold', 'silver', 'free'];

// Har bir daraja — qoradan o'z rangiga aralashuvchi diagonal gradient fon.
const TIER_CARD_MIX = {
  exclusive: {
    background: 'linear-gradient(120deg, #000 0%, #12100a 38%, #3a3122 68%, #cbba8d 100%)',
    border: '1px solid rgba(230,210,170,0.52)',
    iconBg: 'rgba(230,210,170,0.20)',
    iconColor: '#efe0b8',
    nameColor: '#f1e6c6',
  },
  premium: {
    background: 'linear-gradient(120deg, #000 0%, #150d04 36%, #4a2f0c 66%, #c78e34 100%)',
    border: '1px solid rgba(216,163,74,0.6)',
    iconBg: 'rgba(216,163,74,0.22)',
    iconColor: '#f0c98a',
    nameColor: '#f4d29a',
  },
  gold: {
    background: 'linear-gradient(120deg, #000 0%, #171006 38%, #4a3908 68%, #e0b40e 100%)',
    border: '1px solid rgba(240,196,25,0.55)',
    iconBg: 'rgba(240,196,25,0.22)',
    iconColor: '#f5c815',
    nameColor: '#f8dc4d',
  },
  silver: {
    background: 'linear-gradient(120deg, #000 0%, #0d0f11 40%, #2b3036 70%, #626b76 100%)',
    border: '1px solid rgba(154,163,173,0.4)',
    iconBg: 'rgba(154,163,173,0.18)',
    iconColor: '#b6bdc7',
    nameColor: '#c6cdd6',
  },
  // Bronza + to'q yashil aralash (avvalgi sof zumrad yashildan farqli).
  free: {
    background: 'linear-gradient(120deg, #000 0%, #241708 35%, #704225 60%, #1F513A 100%)',
    border: '1px solid rgba(197,138,85,0.45)',
    iconBg: 'rgba(197,138,85,0.20)',
    iconColor: '#C58A55',
    nameColor: '#dba876',
  },
};

export default function PricingPage({ catalog, refreshCatalog }) {
  const { t, lang } = useLanguage();
  const [calcVal, onCalcChange] = useMaskedCode();
  const [modalCode, setModalCode] = useState(null);
  const [pickedTier, setPickedTier] = useState(null); // tarif kartasi bosilganda vizual karta rangi
  const hint = TIER_HINT[lang] || TIER_HINT.uz;
  const priceText = TIER_PRICE_TEXT[lang] || TIER_PRICE_TEXT.uz;
  const examples = EXAMPLES[lang] || EXAMPLES.uz;

  const takenMap = {};
  catalog.forEach((r) => { takenMap[r.code] = r; });

  const calcParsed = parseAnyCode(calcVal);
  const calcInfo = calcParsed ? priceForCode(calcParsed.code) : null;
  const calcTaken = calcParsed ? !!takenMap[calcParsed.code] : false;

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-24 bg-black">
      <section className="grid items-center gap-10 pt-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-white/60">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
            {t('Narxlar')}
          </span>
          <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
            {t('Narx qanday')} <span className="bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">{t('hisoblanadi')}</span>?
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/50">
            {t("Narx kod bandlangan soniga emas — faqat kodning o'zidagi naqshga bog'liq. Har daraja uchun narx qat'iy (o'zgarmas):")}
          </p>

          {/* ===== 5 daraja — kaltalanuvchi vertikal narvon (Adidas usuli) ===== */}
          <div className="mt-6 flex max-w-xl flex-col items-start gap-3">
            {TIERS.map((tier, i) => {
              const mix = TIER_CARD_MIX[tier];
              const width = ['100%', '88%', '76%', '64%', '52%'][i];
              return (
              <button
                key={tier}
                type="button"
                onClick={() => setPickedTier(tier === pickedTier ? null : tier)}
                className={`tier-shine flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-left transition-transform hover:-translate-y-0.5 ${pickedTier === tier ? 'ring-2 ring-white/30' : ''}`}
                style={{ '--shine-delay': `${i * 0.5}s`, width, minWidth: '15rem', background: mix.background, border: mix.border }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ background: mix.iconBg, color: mix.iconColor }}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20" /><path d="M12 3l-3 6 3 12 3-12z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-bold" style={{ color: mix.nameColor }}>{t(TIER_LABEL[tier])}</span>
                    <span
                      className="shrink-0 text-sm font-semibold"
                      style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
                    >
                      {priceText[tier]}{tier !== 'exclusive' ? ' ' + t("so'm") : ''}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{hint[tier]}</div>
                </div>
              </button>
              );
            })}
          </div>
        </div>

        {/* ===== Neon orbit kompozitsiyasi (bosh sahifadagi vizual karta) ===== */}
        <div className="hidden justify-self-center overflow-visible lg:block">
          <NeonOrbitCard
            code={calcParsed ? calcParsed.code : 'ABZ007'}
            name={t('SIZNING ISMINGIZ')}
            finish={pickedTier ? 'tier-' + pickedTier : (calcInfo ? 'tier-' + calcInfo.tier : 'showcase')}
          />
        </div>
      </section>

      {/* ===== Kalkulyator — qutili, ikki ustunli ===== */}
      <section id="kalkulyator" className="mx-auto mt-24 max-w-4xl">
        <span className="font-mono text-xs tracking-[0.25em] text-accent/70">{t('KALKULYATOR')}</span>
        <h2 className="mt-3 text-2xl font-bold">{t("O'z NFC ID narxingizni hisoblang")}</h2>
        <p className="mt-2 text-sm text-white/45">{t("NFC ID kiriting va uning holati (bo'sh/band) hamda aniq narxini ko'ring.")}</p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-base-200/60 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex items-center rounded-lg border border-white/15 bg-black/40 focus-within:border-base-content/40">
                <span className="shrink-0 pl-3 font-mono text-xs text-white/40">NFC ID:</span>
                <input
                  value={calcVal}
                  onChange={onCalcChange}
                  maxLength={7}
                  placeholder="ABZ 007"
                  autoComplete="off"
                  className="w-full bg-transparent px-2 py-3 font-mono text-sm uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal"
                />
              </div>
              <div className="mt-5 space-y-2.5 text-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/55">{t('Daraja')}</span>
                  <span className="font-semibold" style={{ color: calcInfo ? TIER_COLOR[calcInfo.tier] : undefined }}>
                    {calcInfo ? t(TIER_LABEL[calcInfo.tier]) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/55">{t('Sabab')}</span>
                  <span className="font-medium">{calcInfo ? hint[calcInfo.tier] : '—'}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-white/55">{t('Holati')}</span>
                  <span>{calcParsed ? (calcTaken ? <span className="badge badge-error badge-sm">{t('Band')}</span> : <span className="badge badge-success badge-sm">{t("Bo'sh")}</span>) : '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
              <Interactive3DCard className="mb-5">
                <NfcCard
                  code={calcParsed ? calcParsed.code : 'ABZ007'}
                  name={t('SIZNING ISMINGIZ')}
                  finish={calcTaken ? 'graphite' : 'showcase'}
                  size="sm"
                />
              </Interactive3DCard>
              <div className="text-3xl font-extrabold tracking-tight">
                {calcInfo?.tier === 'exclusive' ? t('Auksionda') : (calcInfo ? fmt(calcInfo.total) : '—')}
                {calcInfo && calcInfo.tier !== 'exclusive' && <span className="text-base font-medium text-white/60"> {t("so'm")}</span>}
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-white/45">{t('Jami narx')}</div>

              {calcInfo?.tier === 'exclusive' ? (
                <button className="btn btn-accent mt-5 w-full" onClick={() => { window.location.href = '/auksion'; }}>
                  {'\u{1F48E}'} {t("Auksion bo'limiga o'tish")}
                </button>
              ) : (
                <button
                  className="btn btn-primary mt-5 w-full"
                  disabled={!calcParsed || calcTaken}
                  onClick={() => setModalCode(calcParsed.code)}
                >
                  {!calcParsed ? t('Avval NFC ID kiriting') : calcTaken ? t('Bu NFC ID band') : t("Bandlash — {n} so'm", { n: fmt(calcInfo.total) })}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Misollar — qutili kartochkalar ===== */}
      <section className="mx-auto mt-16 max-w-4xl">
        <span className="font-mono text-xs tracking-[0.25em] text-accent/70">{t('MISOLLAR')}</span>
        <h2 className="mt-3 text-2xl font-bold">{t("Naqshlar narxga qanday ta'sir qiladi")}</h2>
        <p className="mt-2 text-sm text-white/45">{t("Har bir NFC ID naqshiga qarab aniq bitta darajaga tushadi — bandlangan soniga bog'liq emas.")}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((ex) => {
            const info = priceForCode(ex.code);
            return (
              <div key={ex.code} className="rounded-2xl border border-white/10 bg-base-200/60 p-5 transition-colors hover:border-white/20">
                <div className="font-mono text-lg font-bold tracking-widest">{ex.code}</div>
                <div className="mt-1 text-[13px] text-white/55">{ex.note}</div>
                <div className="mt-3 text-sm font-semibold" style={{ color: TIER_COLOR[info.tier] }}>
                  {info.tier === 'exclusive' ? t('Faqat auksion') : t("{n} so'm", { n: fmt(info.total) })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {modalCode && (
        <ReserveModal
          code={modalCode}
          price={priceForCode(modalCode).total}
          onClose={() => setModalCode(null)}
          onDone={refreshCatalog}
        />
      )}
    </main>
  );
}
