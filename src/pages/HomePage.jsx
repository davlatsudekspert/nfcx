import { useEffect, useState } from 'react';
import { dbGet, dbListSales } from '../lib/db.js';
import {
  BASE_PRICE, parseAnyCode, parseLetterCode, priceFor, letterPrice,
  currentBase, nextBase, PRICE_GROWTH, LETTER_MULT,
} from '../lib/pricing.js';
import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import ReserveModal from '../components/ReserveModal.jsx';

// Aqlli input: faqat harflar kiritsa — premium harfli vizitka (ALI,
// UZBEKISTAN), raqam qo'shilsa — standart AAA00 formatiga o'tadi.
function useMaskedCode() {
  const [value, setValue] = useState('');
  const onChange = (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/[0-9]/.test(raw)) {
      setValue(raw.slice(0, 12));
      return;
    }
    let letters = '', digits = '';
    for (const ch of raw) {
      if (letters.length < 3 && /[A-Z]/.test(ch)) letters += ch;
      else if (/^[0-9]$/.test(ch) && digits.length < 2) digits += ch;
    }
    setValue(digits ? `${letters} ${digits}` : letters);
  };
  return [value, onChange];
}

export default function HomePage({ catalog, refreshCatalog }) {
  const [checkVal, onCheckChange] = useMaskedCode();
  const [checkResult, setCheckResult] = useState(null);
  const [calcVal, onCalcChange] = useMaskedCode();
  const [modalCode, setModalCode] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [sales, setSales] = useState([]);

  const refreshSales = () => dbListSales().then(setSales);
  useEffect(() => { refreshSales(); }, []);

  const takenMap = {};
  catalog.forEach((r) => { takenMap[r.code] = r; });
  const saleMap = {};
  sales.forEach((r) => { saleMap[r.code] = r; });

  const doCheck = async () => {
    const parsed = parseAnyCode(checkVal);
    if (!parsed) { setCheckResult({ bad: true }); return; }
    const rec = takenMap[parsed.code] || await dbGet(parsed.code);
    setCheckResult({ code: parsed.code, taken: !!rec, letter: parseLetterCode(parsed.code) !== null });
  };

  const calcParsed = parseAnyCode(calcVal);
  const calcIsLetter = calcParsed ? parseLetterCode(calcParsed.code) !== null : false;
  const calcInfo = !calcIsLetter && calcParsed ? priceFor(calcParsed.code.slice(0, 3), calcParsed.code.slice(3, 5)) : null;
  const calcPrice = calcParsed ? (calcIsLetter ? letterPrice() : calcInfo.total) : null;
  const calcTaken = calcParsed ? !!takenMap[calcParsed.code] : false;

  return (
    <main className="wrap">
      <section className="hero">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 0 }}><span className="dot"></span> O'z profilingiz — nfcstore.uz/ismingiz</div>
          <div className="eyebrow" style={{ background: 'rgba(201,162,39,0.1)', borderColor: 'rgba(201,162,39,0.3)', color: 'var(--brass-bright)', marginBottom: 0 }}>
            <span className="dot" style={{ background: 'var(--brass-bright)' }}></span> Harfli vizitkalar ×{LETTER_MULT} premium
          </div>
        </div>
        <h1>O'zingizga <span className="accent">shaxsiy vizitka</span> oling va profilingizga ega bo'ling.</h1>
        <p className="sub">
          Standart format: <b className="mono">AAA00</b>. Faqat harflardan iborat premium manzil ham mumkin:
          <b className="mono"> nfcstore.uz/ali</b> yoki <b className="mono">nfcstore.uz/uzbekistan</b>.
          Sizniki bo'lgach — akkauntingizdan tahrirlaysiz, xohlasangiz qayta sotishingiz mumkin.
        </p>
        <div className="plate-hero">
          <div className="plate">
            <span className="ch">A</span><span className="ch">B</span><span className="ch">Z</span><span className="gap"></span><span className="ch digit">0</span><span className="ch digit">7</span>
          </div>
          <div className="plate plate-letter">
            <span className="ch">A</span><span className="ch">L</span><span className="ch">I</span>
          </div>
          <div className="plate-caption">Har bir vizitka noyob va faqat bitta egaga tegishli, o'z sahifasi bilan.</div>
        </div>
        <div className="stats-row">
          <div className="stat"><b>{fmt(catalog.length)}</b><span>Band qilingan</span></div>
          <div className="stat"><b>{fmt(currentBase(catalog.length))} so'm</b><span>Hozirgi minimal narx</span></div>
          <div className="stat"><b>{fmt(letterPrice(catalog.length))} so'm</b><span>Harfli vizitka narxi</span></div>
          <div className="stat"><b style={{ color: 'var(--brass-bright)' }}>{fmt(nextBase(catalog.length))} so'm</b><span>Keyingi savdodan boshlab</span></div>
        </div>
      </section>

      <section id="tekshir">
        <div className="section-label">Qadam 1</div>
        <h2>Vizitkangizni tekshiring</h2>
        <p className="section-desc">
          Standart uchun 3 harf + 2 raqam (ABZ07) yoki faqat harflardan iborat premium manzil kiriting
          (ALI, UZBEKISTAN). Bo'sh yoki bandligini shu zahoti ko'rasiz.
        </p>
        <div className="panel">
          <div className="checker-row">
            <div className="code-input-group">
              <span className="pfx mono">nfcstore.uz/</span>
              <input value={checkVal} onChange={onCheckChange} maxLength={13} placeholder="ABZ07 yoki ALI" autoComplete="off" onKeyDown={(e) => { if (e.key === 'Enter') doCheck(); }} />
            </div>
            <button className="btn btn-teal" onClick={doCheck}>Tekshirish</button>
          </div>
          {checkResult && (
            <div className="check-result">
              {checkResult.bad && <>
                <span className="pill taken">Noto'g'ri format</span> ABZ07 ko'rinishida yoki 3-12 harfdan iborat so'z kiriting
              </>}
              {!checkResult.bad && checkResult.taken && <>
                <span className="pill taken">Band</span> nfcstore.uz/{checkResult.code.toLowerCase()} allaqachon olingan — <a onClick={() => navigate('/' + checkResult.code)} style={{ color: 'var(--teal-bright)', cursor: 'pointer', textDecoration: 'underline' }}>sahifasini ko'rish</a>
              </>}
              {!checkResult.bad && !checkResult.taken && <>
                <span className="pill ok">Bo'sh</span> nfcstore.uz/{checkResult.code.toLowerCase()} hozircha bo'sh
                {checkResult.letter && <span className="pill hot">Premium harfli</span>}
              </>}
            </div>
          )}
        </div>
      </section>

      <section id="narx">
        <div className="section-label">Qadam 2</div>
        <h2>Narxni hisoblang</h2>
        <p className="section-desc">Minimal narx {fmt(currentBase(catalog.length))} so'mdan boshlanadi va har savdoda +{Math.round(PRICE_GROWTH * 100)}%ga oshadi. Faqat harfli vizitkalar esa oddiydan <b>×{LETTER_MULT} qimmat</b>.</p>
        <div className="panel">
          <div className="calc-grid">
            <div>
              <div className="code-input-group" style={{ marginBottom: 16 }}>
                <span className="pfx mono">nfcstore.uz/</span>
                <input value={calcVal} onChange={onCalcChange} maxLength={13} placeholder="ABZ07 yoki ALI" autoComplete="off" />
              </div>
              <div className="breakdown-row"><span className="k">Turi</span><span className="v">{calcParsed ? (calcIsLetter ? 'Premium harfli' : 'Standart AAA00') : '—'}</span></div>
              {!calcIsLetter && (
                <>
                  <div className="breakdown-row"><span className="k">Joriy minimal narx</span><span className="v">{fmt(calcInfo ? calcInfo.base : currentBase(catalog.length))} so'm</span></div>
                  <div className="breakdown-row"><span className="k">Harflar naqshi</span><span className="v">{calcInfo ? calcInfo.lp.label : '—'}</span></div>
                  <div className="breakdown-row"><span className="k">Raqamlar naqshi</span><span className="v">{calcInfo ? calcInfo.dp.label : '—'}</span></div>
                </>
              )}
              <div className="breakdown-row"><span className="k">Holati</span><span className="v">{calcParsed ? (calcTaken ? <span className="pill taken">Band</span> : <span className="pill ok">Bo'sh</span>) : '—'}</span></div>
            </div>
            <div className="price-box">
              <div className="amt">{calcParsed ? fmt(calcPrice) : fmt(BASE_PRICE)} <span style={{ fontSize: 16 }}>so'm</span></div>
              <div className="lbl">Jami narx</div>
              <div className="tag-row">
                {calcIsLetter && <span className="tag hot">Premium ×{LETTER_MULT}</span>}
                {calcInfo && calcInfo.lp.hot && <span className="tag hot">{calcInfo.lp.label}</span>}
                {calcInfo && calcInfo.dp.hot && <span className="tag hot">{calcInfo.dp.label}</span>}
                {calcInfo && !calcInfo.lp.hot && !calcInfo.dp.hot && <span className="tag">Standart kombinatsiya</span>}
                {calcParsed && <span className="tag" style={{ color: 'var(--brass-bright)' }}>Keyingi savdodan: {fmt(nextBase(catalog.length))}+</span>}
              </div>
              <button className="btn btn-brass" style={{ marginTop: 18, width: '100%' }} disabled={!calcParsed || calcTaken} onClick={() => setModalCode(calcParsed.code)}>
                {!calcParsed ? 'Avval vizitka kiriting' : calcTaken ? 'Bu vizitka band' : ('Bandlash — ' + fmt(calcPrice) + " so'm")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {sales.length > 0 && (
        <section id="sotuv">
          <div className="section-label">Bozor</div>
          <h2>Sotuvdagi vizitkalar</h2>
          <p className="section-desc">Boshqa foydalanuvchilar qayta sotayotgan premium vizitkalar. Sotib olingach profilingizga o'tadi.</p>
          <div className="grid">
            {sales.map((s) => (
              <a key={s.code} className="card card-sale" onClick={() => navigate('/' + s.code)}>
                <div className="code">nfcstore.uz/{s.code.toLowerCase()}</div>
                <div className="owner">{s.name}{s.role ? ' · ' + s.role : ''}</div>
                <div className="meta">
                  <span className="sale-pill">SOTUVDA</span> {fmt(s.salePrice || s.price)} so'm
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <section id="katalog">
        <div className="section-label">Live</div>
        <h2>So'nggi band qilingan vizitkalar</h2>
        <p className="section-desc">Har biri o'zining alohida sahifasiga ega. Bosing va ko'ring.</p>
        <div className="grid">
          {catalog.length === 0 && <div className="empty-note">Hozircha hech kim vizitka band qilmagan. Birinchi bo'ling!</div>}
          {[...catalog].sort((a, b) => b.ts - a.ts).slice(0, 24).map((it) => (
            <a key={it.code} className="card" onClick={() => navigate('/' + it.code)}>
              <div className="code">nfcstore.uz/{it.code.toLowerCase()}</div>
              <div className="owner">{it.name}{it.tg ? ' · ' + it.tg : ''}</div>
              <div className="meta">
                {saleMap[it.code] && <span className="sale-pill">SOTUVDA</span>}
                {fmt(it.price)} so'm · {timeAgo(it.ts)}
              </div>
            </a>
          ))}
        </div>
      </section>

      <section id="savollar">
        <div className="section-label">FAQ</div>
        <h2>Tez-tez so'raladigan savollar</h2>
        <div className="panel" style={{ padding: '8px 28px' }}>
          {[
            { q: "Vizitkani sotib olgach o'zgartirsa bo'ladimi?", a: "Ha! Akkaunt yaratsangiz, vizitkangiz profilingizga biriktiriladi va uni /account sahifasidan istalgan vaqt tahrirlaysiz: ism, kasb, rasm, ijtimoiy tarmoqlar, profil mavzusi va boshqalar." },
            { q: 'Narx qanday hisoblanadi?', a: `Joriy minimal narx ${fmt(currentBase(catalog.length))} so'm va har savdoda +${Math.round(PRICE_GROWTH * 100)}%ga oshadi. Faqat harflardan iborat premium vizitkalar (masalan nfcstore.uz/ali) oddiy vizitkadan ×${LETTER_MULT} qimmat.` },
            { q: "Vizitkamni qayta sotishim mumkinmi?", a: "Ha. Kabinetda «Sotuvga qo'yish» tugmasini bosasiz — narx avtomatik oddiy vizitkaning joriy narxidan ×3 qimmat qilib belgilanadi. Xohlagan foydalanuvchi uni sotib olgach, vizitka uning profilingizga o'tadi." },
            { q: "Profilim qanday ko'rinadi?", a: "Har bir vizitkaning o'z shaxsiy sahifasi bor: rasmingiz, kasbingiz, bio, kontaktlar, ijtimoiy tarmoqlar (Telegram, Instagram, Facebook, X), to'lov karta raqamingiz va tanlagan dizayn mavzuingiz bilan." },
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
          price={parseLetterCode(modalCode) ? letterPrice(catalog.length) : priceFor(modalCode.slice(0, 3), modalCode.slice(3, 5), catalog.length).total}
          onClose={() => setModalCode(null)}
          onDone={() => { refreshCatalog(); refreshSales(); }}
        />
      )}
    </main>
  );
}
