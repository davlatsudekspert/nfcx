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
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 20 }}>
        <div className="eyebrow reveal"><span className="dot"></span> Narxlar</div>
        <h1 className="reveal reveal-1">Narx qanday <span className="accent shine-text">hisoblanadi</span>?</h1>
        <p className="sub reveal reveal-2">
          Minimal narx {fmt(BASE_PRICE)} so'mdan boshlanadi va har bandlangan vizitka bilan +{Math.round(PRICE_GROWTH * 100)}%ga
          oshib boradi (maksimal {MAX_PRICE_MULT}× gacha). Kamyob harf/raqam naqshlari — bir xil harflar,
          ketma-ketlik, "000" — narxni yanada oshiradi.
        </p>
        <div className="stats-row reveal reveal-3">
          <div className="stat"><b>{fmt(currentBase(catalog.length))} so'm</b><span>Hozirgi minimal narx</span></div>
          <div className="stat"><b>{fmt(nextBase(catalog.length))} so'm</b><span>Keyingi savdodan boshlab</span></div>
          <div className="stat"><b>{fmt(catalog.length)}</b><span>Hozirgacha band qilingan</span></div>
        </div>
      </section>

      <section id="kalkulyator">
        <div className="section-label">Kalkulyator</div>
        <h2>O'z vizitkangiz narxini hisoblang</h2>
        <p className="section-desc">Kod kiriting va uning holati (bo'sh/band) hamda aniq narxini ko'ring.</p>
        <div className="panel glow-panel">
          <div className="calc-grid">
            <div>
              <div className="code-input-group" style={{ marginBottom: 16 }}>
                <span className="pfx mono">nfcstore.uz/</span>
                <input value={calcVal} onChange={onCalcChange} maxLength={7} placeholder="ABZ 007" autoComplete="off" />
              </div>
              <div className="breakdown-row"><span className="k">Joriy minimal narx</span><span className="v">{fmt(calcInfo ? calcInfo.base : currentBase(catalog.length))} so'm</span></div>
              <div className="breakdown-row"><span className="k">Harflar naqshi</span><span className="v">{calcInfo ? calcInfo.lp.label : '—'}</span></div>
              <div className="breakdown-row"><span className="k">Raqamlar naqshi</span><span className="v">{calcInfo ? calcInfo.dp.label : '—'}</span></div>
              <div className="breakdown-row"><span className="k">Holati</span><span className="v">{calcParsed ? (calcTaken ? <span className="pill taken">Band</span> : <span className="pill ok">Bo'sh</span>) : '—'}</span></div>
            </div>
            <div className="price-box">
              <div className="amt">{calcInfo ? fmt(calcInfo.total) : fmt(BASE_PRICE)} <span style={{ fontSize: 16 }}>so'm</span></div>
              <div className="lbl">Jami narx</div>
              <div className="tag-row">
                {calcInfo && calcInfo.lp.hot && <span className="tag hot">{calcInfo.lp.label}</span>}
                {calcInfo && calcInfo.dp.hot && <span className="tag hot">{calcInfo.dp.label}</span>}
                {calcInfo && !calcInfo.lp.hot && !calcInfo.dp.hot && <span className="tag">Standart kombinatsiya</span>}
              </div>
              <button className="btn btn-brass pulse" style={{ marginTop: 18, width: '100%' }} disabled={!calcParsed || calcTaken} onClick={() => setModalCode(calcParsed.code)}>
                {!calcParsed ? 'Avval vizitka kiriting' : calcTaken ? 'Bu vizitka band' : ('Bandlash — ' + fmt(calcInfo.total) + " so'm")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="misollar">
        <div className="section-label">Misollar</div>
        <h2>Naqshlar narxga qanday ta'sir qiladi</h2>
        <p className="section-desc">Bir xil bazaviy narxdan boshlanib, quyidagi naqshlar narxni bir necha barobar oshiradi.</p>
        <div className="grid">
          {examples.map((ex) => {
            const info = priceForCode(ex.code, catalog.length);
            return (
              <div className="card" key={ex.code} style={{ cursor: 'default' }}>
                <div className="code">{ex.code}</div>
                <div className="owner">{ex.note}</div>
                <div className="meta">{fmt(info.total)} so'm</div>
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
