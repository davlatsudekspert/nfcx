import { useState } from 'react';
import { dbGet } from '../lib/db.js';
import { parseAnyCode, priceForCode, TIER_LABEL, TIER_COLOR, TIER_GRADIENT } from '../lib/pricing.js';
import { fmt } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import ReserveModal from '../components/ReserveModal.jsx';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';
import PedestalShowcase3D from '../components/PedestalShowcase3D.jsx';

function useMaskedCode() {
  const [value, setValue] = useState('');
  const onChange = (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let letters = '', digits = '';
    for (const ch of raw) {
      if (letters.length < 3 && /[A-Z]/.test(ch)) letters += ch;
      else if (/^[0-9]$/.test(ch) && digits.length < 3) digits += ch;
    }
    setValue(digits ? `${letters} ${digits}` : letters);
  };
  return [value, onChange];
}

const TIER_HINT = {
  uz: {
    exclusive: 'Ekslyuziv so’z (VIP, CEO, LUX…) yoki hammasi bir xil — faqat auksion',
    premium: '"000" bilan tugaydi, yoki taniqli so’z + o’ta nodir raqam',
    gold: 'Taniqli so’z (brend/ism/shahar), yoki uchala harf/raqam bir xil',
    silver: 'Ham harfda, ham raqamda yonma-yon juftlik bor',
    free: 'Naqshsiz — bepul',
  },
  ru: {
    exclusive: 'Эксклюзивное слово (VIP, CEO, LUX…) или всё одинаково — только аукцион',
    premium: 'Заканчивается на "000", или известное слово + особо редкая цифра',
    gold: 'Известное слово (бренд/имя/город), или все три буквы/цифры одинаковы',
    silver: 'Есть соседняя пара и в буквах, и в цифрах',
    free: 'Без узора — бесплатно',
  },
  en: {
    exclusive: 'An exclusive word (VIP, CEO, LUX…) or all identical — auction only',
    premium: 'Ends with "000", or a known word + an ultra-rare number',
    gold: 'A known word (brand/name/city), or all three letters/digits identical',
    silver: 'An adjacent pair in both letters and digits',
    free: 'No pattern — free',
  },
};
const TIER_PRICE_TEXT = {
  uz: { exclusive: 'Auksionda', premium: '199 000', gold: '149 000', silver: '99 000', free: '0' },
  ru: { exclusive: 'На аукционе', premium: '199 000', gold: '149 000', silver: '99 000', free: '0' },
  en: { exclusive: 'At auction', premium: '199,000', gold: '149,000', silver: '99,000', free: '0' },
};
const EXAMPLES = {
  uz: [
    { code: 'MXK413', note: 'Naqshsiz — TEKIN' },
    { code: 'AAB197', note: 'Faqat harfda juftlik — TEKIN' },
    { code: 'ABB770', note: 'Ham harfda, ham raqamda juftlik — Silver' },
    { code: 'BMW412', note: 'Taniqli so’z, oddiy raqam — Gold' },
    { code: 'KLM000', note: '"000" bilan tugaydi — Premium' },
    { code: 'BMW007', note: 'Taniqli so’z + nodir raqam — Premium' },
    { code: 'VIP001', note: 'Ekslyuziv so’z — Ekslyuziv' },
  ],
  ru: [
    { code: 'MXK413', note: 'Без узора — БЕСПЛАТНО' },
    { code: 'AAB197', note: 'Пара только в буквах — БЕСПЛАТНО' },
    { code: 'ABB770', note: 'Пара и в буквах, и в цифрах — Silver' },
    { code: 'BMW412', note: 'Известное слово, обычная цифра — Gold' },
    { code: 'KLM000', note: 'Заканчивается на "000" — Premium' },
    { code: 'BMW007', note: 'Известное слово + редкая цифра — Premium' },
    { code: 'VIP001', note: 'Эксклюзивное слово — Эксклюзив' },
  ],
  en: [
    { code: 'MXK413', note: 'No pattern — FREE' },
    { code: 'AAB197', note: 'Pair in letters only — FREE' },
    { code: 'ABB770', note: 'Pair in both letters and digits — Silver' },
    { code: 'BMW412', note: 'Known word, plain number — Gold' },
    { code: 'KLM000', note: 'Ends with "000" — Premium' },
    { code: 'BMW007', note: 'Known word + rare number — Premium' },
    { code: 'VIP001', note: 'Exclusive word — Exclusive' },
  ],
};
const TIERS = ['exclusive', 'premium', 'gold', 'silver', 'free'];

export default function PricingPage({ catalog, refreshCatalog }) {
  const { t, lang } = useLanguage();
  const [calcVal, onCalcChange] = useMaskedCode();
  const [modalCode, setModalCode] = useState(null);
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

          {/* ===== 5 daraja — qutichalarda, gem-ikonka va rangli chegara bilan ===== */}
          <div className="mt-6 grid max-w-xl gap-3.5 sm:grid-cols-2">
            {TIERS.map((tier) => (
              <div
                key={tier}
                className="flex items-center gap-3.5 rounded-xl border-l-4 bg-white/[0.03] p-4"
                style={{ borderLeftColor: TIER_COLOR[tier], borderTop: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${TIER_COLOR[tier]}22`, color: TIER_COLOR[tier] }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20" /><path d="M12 3l-3 6 3 12 3-12z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div
                    className="text-lg font-bold"
                    style={
                      TIER_GRADIENT[tier]
                        ? { backgroundImage: TIER_GRADIENT[tier], WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
                        : { color: TIER_COLOR[tier] }
                    }
                  >
                    {t(TIER_LABEL[tier])}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-base-content/80">
                    {priceText[tier]}{tier !== 'exclusive' ? ' ' + t("so'm") : ''}
                  </div>
                  <div className="mt-1 text-xs leading-snug text-base-content/45">{hint[tier]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Professional 3D karta+pьedestal showcase (faqat shu qism) ===== */}
        <div className="hidden lg:flex">
          <PedestalShowcase3D>
            <NfcCard code={calcParsed ? calcParsed.code : 'ABZ007'} name={t('SIZNING ISMINGIZ')} finish="showcase" size="lg" rim />
          </PedestalShowcase3D>
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
