import { useState } from 'react';
import { dbGet } from '../lib/db.js';
import { parseCode, priceFor, currentBase, nextBase, PRICE_GROWTH, TOTAL_COMBOS } from '../lib/pricing.js';
import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import ReserveModal from '../components/ReserveModal.jsx';

function useMaskedCode() {
  const [value, setValue] = useState('');
  const onChange = (e) => {
    const raw = e.target.value.toUpperCase();
    let letters = '', digits = '';
    for (const ch of raw) {
      if (letters.length < 3) { if (/[A-Z]/.test(ch)) letters += ch; }
      else if (digits.length < 2) { if (/[0-9]/.test(ch)) digits += ch; }
    }
    setValue(digits ? letters + ' ' + digits : letters);
  };
  const clean = value.replace(/\s/g, '');
  return [value, onChange, clean];
}

export default function HomePage({ catalog, refreshCatalog }) {
  const [checkVal, onCheckChange, checkClean] = useMaskedCode();
  const [checkResult, setCheckResult] = useState(null);
  const [calcVal, onCalcChange, calcClean] = useMaskedCode();
  const [modalCode, setModalCode] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  const takenMap = {};
  catalog.forEach((r) => { takenMap[r.code] = r; });

  const doCheck = async () => {
    const parsed = parseCode(checkClean);
    if (!parsed) { setCheckResult({ bad: true }); return; }
    const rec = takenMap[parsed.code] || await dbGet(parsed.code);
    setCheckResult({ code: parsed.code, taken: !!rec });
  };

  const parsedCalc = parseCode(calcClean);
  const calcInfo = parsedCalc ? priceFor(parsedCalc.letters, parsedCalc.digits) : null;
  const calcTaken = parsedCalc ? !!takenMap[parsedCalc.code] : false;

  return (
    <main className="wrap">
      <section className="hero">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 0 }}><span className="dot"></span> {fmt(TOTAL_COMBOS - catalog.length)} ta kombinatsiya hali bo'sh</div>
          <div className="eyebrow" style={{ background: 'rgba(201,162,39,0.1)', borderColor: 'rgba(201,162,39,0.3)', color: 'var(--brass-bright)', marginBottom: 0 }}>
            <span className="dot" style={{ background: 'var(--brass-bright)' }}></span> Narx har savdoda +{Math.round(PRICE_GROWTH * 100)}%
          </div>
        </div>
        <h1>O'zingizga <span className="accent">3 harf + 2 raqamdan</span> iborat shaxsiy vizitka oling.</h1>
        <p className="sub">Bitta qisqa manzil — profilingiz, kontaktlaringiz va ishingiz shu yerda. Format: <b className="mono">AAA00</b>. Sizniki bo'lgach, faqat sizga tegishli — va o'z alohida sahifangizga ega bo'lasiz.</p>
        <div className="plate-hero">
          <div className="plate">
            <span className="ch">A</span><span className="ch">B</span><span className="ch">Z</span><span className="gap"></span><span className="ch digit">0</span><span className="ch digit">7</span>
          </div>
          <div className="plate-caption">Har bir vizitka noyob va faqat bitta egaga tegishli bo'ladi, o'z sahifasi bilan.</div>
        </div>
        <div className="stats-row">
          <div className="stat"><b>{fmt(catalog.length)}</b><span>Band qilingan</span></div>
          <div className="stat"><b className="mono">1 757 600</b><span>Jami mumkin bo'lgan kombinatsiya</span></div>
          <div className="stat"><b>{fmt(currentBase(catalog.length))} so'm</b><span>Hozirgi minimal narx</span></div>
          <div className="stat"><b style={{ color: 'var(--brass-bright)' }}>{fmt(nextBase(catalog.length))} so'm</b><span>Keyingi savdodan boshlab</span></div>
        </div>
      </section>

      <section id="tekshir">
        <div className="section-label">Qadam 1</div>
        <h2>Vizitkangizni tekshiring</h2>
        <p className="section-desc">3 ta lotin harfi va 2 ta raqam kiriting — bo'sh yoki bandligini shu zahoti ko'rasiz.</p>
        <div className="panel">
          <div className="checker-row">
            <div className="code-input-group">
              <span className="pfx mono">nfcstore.uz/</span>
              <input value={checkVal} onChange={onCheckChange} maxLength={6} placeholder="ABZ 07" autoComplete="off" onKeyDown={(e) => { if (e.key === 'Enter') doCheck(); }} />
            </div>
            <button className="btn btn-teal" onClick={doCheck}>Tekshirish</button>
          </div>
          {checkResult && (
            <div className="check-result">
              {checkResult.bad && <>
                <span className="pill taken">Noto'g'ri format</span> 3 harf + 2 raqam kiriting, masalan ABZ 07
              </>}
              {!checkResult.bad && checkResult.taken && <>
                <span className="pill taken">Band</span> nfcstore.uz/{checkResult.code} allaqachon olingan — <a onClick={() => navigate(checkResult.code)} style={{ color: 'var(--teal-bright)', cursor: 'pointer', textDecoration: 'underline' }}>sahifasini ko'rish</a>
              </>}
              {!checkResult.bad && !checkResult.taken && <>
                <span className="pill ok">Bo'sh</span> nfcstore.uz/{checkResult.code} hozircha bo'sh
              </>}
            </div>
          )}
        </div>
      </section>

      <section id="narx">
        <div className="section-label">Qadam 2</div>
        <h2>Narxni hisoblang</h2>
        <p className="section-desc">Minimal narx {fmt(currentBase(catalog.length))} so'mdan boshlanadi va <b>har bir band qilingan vizitka barcha narxlarni +{Math.round(PRICE_GROWTH * 100)}%ga oshiradi</b> — tez harakat qiling, ertaga qimmatroq bo'ladi.</p>
        <div className="panel">
          <div className="calc-grid">
            <div>
              <div className="code-input-group" style={{ marginBottom: 16 }}>
                <span className="pfx mono">nfcstore.uz/</span>
                <input value={calcVal} onChange={onCalcChange} maxLength={6} placeholder="ABZ 07" autoComplete="off" />
              </div>
              <div className="breakdown-row"><span className="k">Joriy minimal narx</span><span className="v">{fmt(calcInfo ? calcInfo.base : currentBase(catalog.length))} so'm</span></div>
              <div className="breakdown-row"><span className="k">Harflar naqshi</span><span className="v">{calcInfo ? calcInfo.lp.label : '—'}</span></div>
              <div className="breakdown-row"><span className="k">Raqamlar naqshi</span><span className="v">{calcInfo ? calcInfo.dp.label : '—'}</span></div>
              <div className="breakdown-row"><span className="k">Holati</span><span className="v">{parsedCalc ? (calcTaken ? <span className="pill taken">Band</span> : <span className="pill ok">Bo'sh</span>) : '—'}</span></div>
            </div>
            <div className="price-box">
              <div className="amt">{fmt(calcInfo ? calcInfo.total : BASE_PRICE)} <span style={{ fontSize: 16 }}>so'm</span></div>
              <div className="lbl">Jami narx</div>
              <div className="tag-row">
                {calcInfo && calcInfo.lp.hot && <span className="tag hot">{calcInfo.lp.label}</span>}
                {calcInfo && calcInfo.dp.hot && <span className="tag hot">{calcInfo.dp.label}</span>}
                {calcInfo && !calcInfo.lp.hot && !calcInfo.dp.hot && <span className="tag">Standart kombinatsiya</span>}
                {calcInfo && <span className="tag" style={{ color: 'var(--brass-bright)' }}>Keyingi savdodan: {fmt(nextBase(catalog.length))}+</span>}
              </div>
              <button className="btn btn-brass" style={{ marginTop: 18, width: '100%' }} disabled={!parsedCalc || calcTaken} onClick={() => setModalCode(parsedCalc.code)}>
                {!parsedCalc ? 'Avval vizitka kiriting' : calcTaken ? 'Bu vizitka band' : ('Bandlash — ' + fmt(priceFor(parsedCalc.letters, parsedCalc.digits, catalog.length).total) + " so'm")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="katalog">
        <div className="section-label">Live</div>
        <h2>So'nggi band qilingan vizitkalar</h2>
        <p className="section-desc">Har biri o'zining alohida sahifasiga ega. Bosing va ko'ring.</p>
        <div className="grid">
          {catalog.length === 0 && <div className="empty-note">Hozircha hech kim vizitka band qilmagan. Birinchi bo'ling!</div>}
          {[...catalog].sort((a, b) => b.ts - a.ts).slice(0, 24).map((it) => (
            <a key={it.code} className="card" onClick={() => navigate(it.code)}>
              <div className="code">nfcstore.uz/{it.code}</div>
              <div className="owner">{it.name}{it.tg ? ' · ' + it.tg : ''}</div>
              <div className="meta">{fmt(it.price)} so'm · {timeAgo(it.ts)}</div>
            </a>
          ))}
        </div>
      </section>

      <section id="savollar">
        <div className="section-label">FAQ</div>
        <h2>Tez-tez so'raladigan savollar</h2>
        <div className="panel" style={{ padding: '8px 28px' }}>
          {[
            { q: "Vizitkani sotib olgach o'zgartirsa bo'ladimi?", a: "Vizitka sizga biriktirilib qoladi va o'z alohida sahifangiz doim shu manzilda turadi." },
            { q: 'Narx qanday hisoblanadi?', a: `Joriy minimal narx ${fmt(currentBase(catalog.length))} so'm va u har bir band qilingan vizitka bilan +${Math.round(PRICE_GROWTH * 100)}%ga oshadi. Qo'shimcha: harf va raqam kombinatsiyasining kamyobligi bo'yicha koeffitsient qo'shiladi.` },
            { q: 'Har bir vizitka qanday ko\'rinadi?', a: "Har bir band qilingan vizitka o'zining shaxsiy profil sahifasiga ega — rasm, kasb, kontaktlar va ijtimoiy tarmoqlar bilan." },
          ].map((f, i) => (
            <div className={'faq-item' + (openFaq === i ? ' open' : '')} key={i}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>{f.q} <span className="x">+</span></button>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      {modalCode && (
        <ReserveModal
          code={modalCode}
          price={priceFor(modalCode.slice(0, 3), modalCode.slice(3, 5), catalog.length).total}
          onClose={() => setModalCode(null)}
          onDone={refreshCatalog}
        />
      )}
    </main>
  );
}
