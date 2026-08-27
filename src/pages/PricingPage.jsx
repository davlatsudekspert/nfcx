import { useState } from 'react';
import { dbGet } from '../lib/db.js';
import { parseAnyCode, priceForCode, TIER_LABEL, TIER_COLOR } from '../lib/pricing.js';
import { fmt } from '../lib/format.js';
import ReserveModal from '../components/ReserveModal.jsx';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';

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
  exclusive: 'Faqat auksion orqali sotiladi',
  premium: 'Maxsus so\u2019z yoki "000" bilan tugaydi',
  gold: 'Uchala harf yoki uchala raqam bir xil',
  silver: 'Ham harfda, ham raqamda yonma-yon juftlik bor',
  free: 'Naqshsiz — bepul',
};
const TIER_PRICE_TEXT = { exclusive: 'Auksionda', premium: '199 000', gold: '149 000', silver: '99 000', free: '0' };
const TIERS = ['exclusive', 'premium', 'gold', 'silver', 'free'];

export default function PricingPage({ catalog, refreshCatalog }) {
  const [calcVal, onCalcChange] = useMaskedCode();
  const [modalCode, setModalCode] = useState(null);

  const takenMap = {};
  catalog.forEach((r) => { takenMap[r.code] = r; });

  const calcParsed = parseAnyCode(calcVal);
  const calcInfo = calcParsed ? priceForCode(calcParsed.code) : null;
  const calcTaken = calcParsed ? !!takenMap[calcParsed.code] : false;

  const examples = [
    { code: 'MXK413', note: "Naqshsiz — TEKIN" },
    { code: 'AAB197', note: "Faqat harfda juftlik — TEKIN" },
    { code: 'ABB770', note: 'Ham harfda, ham raqamda juftlik — Silver' },
    { code: 'MXK888', note: 'Uchala raqam bir xil — Gold' },
    { code: 'KLM000', note: '"000" bilan tugaydi — Premium' },
    { code: 'VIP001', note: 'Maxsus so\u2019z + nodir raqam — Ekslyuziv' },
  ];

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-24 bg-black">
      <section className="grid items-center gap-10 pt-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-white/60">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
            Narxlar
          </span>
          <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
            Narx qanday <span className="bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">hisoblanadi</span>?
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/50">
            Narx kod bandlangan soniga emas — faqat kodning o'zidagi naqshga bog'liq. Har daraja uchun narx qat'iy (o'zgarmas):
          </p>

          {/* ===== 5 daraja — qutichalarda, gem-ikonka va rangli chegara bilan ===== */}
          <div className="mt-6 grid max-w-xl gap-3.5 sm:grid-cols-2">
            {TIERS.map((t) => (
              <div
                key={t}
                className="flex items-center gap-3.5 rounded-xl border-l-4 bg-white/[0.03] p-4"
                style={{ borderLeftColor: TIER_COLOR[t], borderTop: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${TIER_COLOR[t]}22`, color: TIER_COLOR[t] }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20" /><path d="M12 3l-3 6 3 12 3-12z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="text-lg font-bold" style={{ color: TIER_COLOR[t] }}>{TIER_LABEL[t]}</div>
                  <div className="mt-0.5 text-sm font-semibold text-base-content/80">
                    {TIER_PRICE_TEXT[t]}{t !== 'exclusive' ? " so'm" : ''}
                  </div>
                  <div className="mt-1 text-xs leading-snug text-base-content/45">{TIER_HINT[t]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Suzuvchi 3D karta — pastida sahna/pьedestal bilan ===== */}
        <div className="relative hidden flex-col items-center lg:flex">
          <div className="relative z-[2] animate-[floatY_6s_ease-in-out_infinite]">
            <Interactive3DCard>
              <NfcCard code={calcParsed ? calcParsed.code : 'ABZ007'} name="SIZNING ISMINGIZ" finish="gold" size="lg" rim />
            </Interactive3DCard>
          </div>
          {/* Pьedestal — dumaloq, tilla chetli, nurlanuvchi sahna */}
          <div className="relative z-[1] -mt-3 h-[52px] w-[340px] sm:w-[420px]">
            <div
              className="absolute inset-0 rounded-[50%]"
              style={{
                background: 'radial-gradient(ellipse at center, #2a220f 0%, #171208 55%, transparent 75%)',
                boxShadow: '0 0 60px 10px rgba(212,175,90,0.25), 0 0 120px 30px rgba(212,175,90,0.08)',
              }}
            />
            <div
              className="absolute inset-x-0 top-0 h-[10px] rounded-[50%]"
              style={{ background: 'linear-gradient(90deg, #7a5c1c, #f0cf7a, #d4af5a, #7a5c1c)' }}
            />
          </div>
        </div>
      </section>

      {/* ===== Kalkulyator — qutili, ikki ustunli ===== */}
      <section id="kalkulyator" className="mx-auto mt-24 max-w-4xl">
        <span className="font-mono text-xs tracking-[0.25em] text-accent/70">KALKULYATOR</span>
        <h2 className="mt-3 text-2xl font-bold">O'z NFC ID narxingizni hisoblang</h2>
        <p className="mt-2 text-sm text-white/45">NFC ID kiriting va uning holati (bo'sh/band) hamda aniq narxini ko'ring.</p>

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
                  <span className="text-white/55">Daraja</span>
                  <span className="font-semibold" style={{ color: calcInfo ? TIER_COLOR[calcInfo.tier] : undefined }}>
                    {calcInfo ? TIER_LABEL[calcInfo.tier] : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/55">Sabab</span>
                  <span className="font-medium">{calcInfo ? TIER_HINT[calcInfo.tier] : '—'}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-white/55">Holati</span>
                  <span>{calcParsed ? (calcTaken ? <span className="badge badge-error badge-sm">Band</span> : <span className="badge badge-success badge-sm">Bo'sh</span>) : '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
              <Interactive3DCard className="mb-5">
                <NfcCard
                  code={calcParsed ? calcParsed.code : 'ABZ007'}
                  name="SIZNING ISMINGIZ"
                  finish={calcTaken ? 'graphite' : (calcInfo?.tier === 'exclusive' ? 'gold' : 'black')}
                  size="sm"
                />
              </Interactive3DCard>
              <div className="text-3xl font-extrabold tracking-tight">
                {calcInfo?.tier === 'exclusive' ? "Auksionda" : (calcInfo ? fmt(calcInfo.total) : '—')}
                {calcInfo && calcInfo.tier !== 'exclusive' && <span className="text-base font-medium text-white/60"> so'm</span>}
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-white/45">Jami narx</div>

              {calcInfo?.tier === 'exclusive' ? (
                <button className="btn btn-accent mt-5 w-full" onClick={() => { window.location.href = '/auksion'; }}>
                  {'\u{1F48E}'} Auksion bo'limiga o'tish
                </button>
              ) : (
                <button
                  className="btn btn-primary mt-5 w-full"
                  disabled={!calcParsed || calcTaken}
                  onClick={() => setModalCode(calcParsed.code)}
                >
                  {!calcParsed ? "Avval NFC ID kiriting" : calcTaken ? "Bu NFC ID band" : ("Bandlash — " + fmt(calcInfo.total) + " so'm")}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Misollar — qutili kartochkalar ===== */}
      <section className="mx-auto mt-16 max-w-4xl">
        <span className="font-mono text-xs tracking-[0.25em] text-accent/70">MISOLLAR</span>
        <h2 className="mt-3 text-2xl font-bold">Naqshlar narxga qanday ta'sir qiladi</h2>
        <p className="mt-2 text-sm text-white/45">Har bir NFC ID naqshiga qarab aniq bitta darajaga tushadi — bandlangan soniga bog'liq emas.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((ex) => {
            const info = priceForCode(ex.code);
            return (
              <div key={ex.code} className="rounded-2xl border border-white/10 bg-base-200/60 p-5 transition-colors hover:border-white/20">
                <div className="font-mono text-lg font-bold tracking-widest">{ex.code}</div>
                <div className="mt-1 text-[13px] text-white/55">{ex.note}</div>
                <div className="mt-3 text-sm font-semibold" style={{ color: TIER_COLOR[info.tier] }}>
                  {info.tier === 'exclusive' ? "Faqat auksion" : `${fmt(info.total)} so'm`}
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
