import { useState } from 'react';
import { dbGet } from '../lib/db.js';
import { BASE_PRICE, parseAnyCode, priceForCode, currentBase, nextBase, PRICE_GROWTH, MAX_PRICE_MULT } from '../lib/pricing.js';
import { fmt } from '../lib/format.js';
import ReserveModal from '../components/ReserveModal.jsx';

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

export default function PricingPage({ catalog, refreshCatalog }) {
  const [calcVal, onCalcChange] = useMaskedCode();
  const [modalCode, setModalCode] = useState(null);
  const [checkTaken, setCheckTaken] = useState(false);

  const takenMap = {};
  catalog.forEach((r) => { takenMap[r.code] = r; });

  const calcParsed = parseAnyCode(calcVal);
  const calcInfo = calcParsed ? priceForCode(calcParsed.code, catalog.length) : null;
  const calcTaken = calcParsed ? !!takenMap[calcParsed.code] : false;

  const examples = [
    { code: 'MXK413', note: 'Oddiy kombinatsiya' },
    { code: 'AAB197', note: 'Ikkitasi bir xil harf' },
    { code: 'QQQ077', note: 'Uchala harf bir xil' },
    { code: 'ABC555', note: 'Raqamlar bir xil' },
    { code: 'KLM000', note: '"000" — maxsus' },
    { code: 'VIP777', note: 'Eksklyuziv — maxsus narx' },
  ];

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          Narxlar
        </span>
        <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
          Narx qanday <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">hisoblanadi</span>?
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-base-content/60">
          Minimal narx {fmt(BASE_PRICE)} so'mdan boshlanadi va har bandlangan vizitka bilan +{Math.round(PRICE_GROWTH * 100)}%ga
          oshib boradi (maksimal {MAX_PRICE_MULT}× gacha). Kamyob harf/raqam naqshlari — bir xil harflar,
          ketma-ketlik, "000" — narxni yanada oshiradi.
        </p>
        <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-lg font-bold">{fmt(currentBase(catalog.length))} so'm</div>
            <div className="text-xs text-base-content/50">Hozirgi minimal narx</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-lg font-bold">{fmt(nextBase(catalog.length))} so'm</div>
            <div className="text-xs text-base-content/50">Keyingi savdodan boshlab</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-lg font-bold">{fmt(catalog.length)}</div>
            <div className="text-xs text-base-content/50">Hozirgacha band qilingan</div>
          </div>
        </div>
      </section>

      <section id="kalkulyator" className="mt-16">
        <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">Kalkulyator</div>
        <h2 className="mt-2 text-2xl font-bold">O'z vizitkangiz narxini hisoblang</h2>
        <p className="mt-2 text-sm text-base-content/55">Kod kiriting va uning holati (bo'sh/band) hamda aniq narxini ko'ring.</p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-base-200/60 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex items-center rounded-lg border border-white/15 bg-black/40 focus-within:border-base-content/40">
                <span className="shrink-0 pl-3 font-mono text-xs text-base-content/40">nfcstore.uz/</span>
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
                {[['Joriy minimal narx', `${fmt(calcInfo ? calcInfo.base : currentBase(catalog.length))} so'm`],
                  ['Harflar naqshi', calcInfo ? calcInfo.lp.label : '—'],
                  ['Raqamlar naqshi', calcInfo ? calcInfo.dp.label : '—']].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-base-content/55">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-base-content/55">Holati</span>
                  <span>{calcParsed ? (calcTaken ? <span className="badge badge-error badge-sm">Band</span> : <span className="badge badge-success badge-sm">Bo'sh</span>) : '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
              <div className="text-3xl font-extrabold tracking-tight">
                {calcInfo ? fmt(calcInfo.total) : fmt(BASE_PRICE)} <span className="text-base font-medium text-base-content/60">so'm</span>
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-base-content/45">Jami narx</div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {calcInfo && calcInfo.lp.hot && <span className="badge badge-accent badge-outline">{calcInfo.lp.label}</span>}
                {calcInfo && calcInfo.dp.hot && <span className="badge badge-accent badge-outline">{calcInfo.dp.label}</span>}
                {calcInfo && !calcInfo.lp.hot && !calcInfo.dp.hot && <span className="badge badge-ghost">Standart kombinatsiya</span>}
              </div>
              <button
                className="btn btn-primary mt-5 w-full"
                disabled={!calcParsed || calcTaken}
                onClick={() => setModalCode(calcParsed.code)}
              >
                {!calcParsed ? 'Avval vizitka kiriting' : calcTaken ? 'Bu vizitka band' : ('Bandlash — ' + fmt(calcInfo.total) + " so'm")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="misollar" className="mt-16">
        <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">Misollar</div>
        <h2 className="mt-2 text-2xl font-bold">Naqshlar narxga qanday ta'sir qiladi</h2>
        <p className="mt-2 text-sm text-base-content/55">Bir xil bazaviy narxdan boshlanib, quyidagi naqshlar narxni bir necha barobar oshiradi.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((ex) => {
            const info = priceForCode(ex.code, catalog.length);
            return (
              <div key={ex.code} className="rounded-2xl border border-white/10 bg-base-200/60 p-5 transition-colors hover:border-white/20">
                <div className="font-mono text-lg font-bold tracking-widest">{ex.code}</div>
                <div className="mt-1 text-[13px] text-base-content/55">{ex.note}</div>
                <div className="mt-3 text-sm font-semibold text-base-content/85">{fmt(info.total)} so'm</div>
              </div>
            );
          })}
        </div>
      </section>

      {modalCode && (
        <ReserveModal
          code={modalCode}
          price={priceForCode(modalCode, catalog.length).total}
          onClose={() => setModalCode(null)}
          onDone={refreshCatalog}
        />
      )}
    </main>
  );
}