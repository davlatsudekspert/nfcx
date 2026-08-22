import { useEffect, useRef, useState } from 'react';
import { dbGet, dbListSales } from '../lib/db.js';
import {
  BASE_PRICE, parseAnyCode, priceForCode,
  currentBase, nextBase, PRICE_GROWTH,
} from '../lib/pricing.js';
import { PREMIUM_GROUPS } from '../lib/premiumNames.js';
import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import ReserveModal from '../components/ReserveModal.jsx';
import NfcCard from '../components/NfcCard.jsx';
import { IconSearch } from '../components/Icons.jsx';

// Standart AAA00 maskasi (3 harf + 2 raqam) — faqat harfli premium format
// hozircha o'chirilgan.
function useMaskedCode() {
  const [value, setValue] = useState('');
  const onChange = (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let letters = '', digits = '';
    for (const ch of raw) {
      if (letters.length < 3 && /[A-Z]/.test(ch)) letters += ch;
      else if (/^[0-9]$/.test(ch) && digits.length < 2) digits += ch;
    }
    setValue(digits ? `${letters} ${digits}` : letters);
  };
  return [value, onChange];
}

// Raqam sonini animatsiyali (count-up) ko'rsatadigan kichik komponent.
function CountUp({ value, suffix = '' }) {
  const [n, setN] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = Number(value) || 0;
    const dur = 700;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(n)}{suffix}</>;
}

// Bo'sh joyga tushganda "reveal" klassini qo'shadigan scroll-observer hook.
function useReveal() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
}

function RevealSection({ id, children }) {
  const [ref, shown] = useReveal();
  return (
    <section id={id} ref={ref} className={shown ? 'reveal' : ''} style={{ opacity: shown ? undefined : 0 }}>
      {children}
    </section>
  );
}

export default function HomePage({ catalog, refreshCatalog }) {
  const [checkVal, onCheckChange] = useMaskedCode();
  const [checkResult, setCheckResult] = useState(null);
  const [calcVal, onCalcChange] = useMaskedCode();
  const [modalCode, setModalCode] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [sales, setSales] = useState([]);
  const [activeGroup, setActiveGroup] = useState(PREMIUM_GROUPS[0].id);

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
    setCheckResult({ code: parsed.code, taken: !!rec });
  };

  const calcParsed = parseAnyCode(calcVal);
  const calcInfo = calcParsed ? priceForCode(calcParsed.code) : null;
  const calcPrice = calcInfo ? calcInfo.total : null;
  const calcTaken = calcParsed ? !!takenMap[calcParsed.code] : false;

  const recent = [...catalog].sort((a, b) => b.ts - a.ts).slice(0, 10);
  const marqueeItems = recent.length ? [...recent, ...recent] : [];

  return (
    <main className="wrap">
      <section className="hero">
        <div className="hero-grid-bg"></div>
        <span className="orbit-dot" style={{ top: '8%', left: '6%', animationDelay: '.2s' }}></span>
        <span className="orbit-dot" style={{ top: '18%', left: '92%', animationDelay: '1.1s' }}></span>
        <span className="orbit-dot" style={{ top: '70%', left: '4%', animationDelay: '.6s' }}></span>
        <span className="orbit-dot" style={{ top: '85%', left: '88%', animationDelay: '1.6s' }}></span>
        <span className="orbit-dot orbit-dot-lg" style={{ top: '40%', left: '96%', animationDelay: '.9s' }}></span>
        <span className="orbit-ring"></span>

        <div className="hero-columns">
          <div className="hero-col-text">
            <div className="eyebrow reveal"><span className="dot"></span> O'z profilingiz — nfcstore.uz/ismingiz</div>

            <h1 className="reveal reveal-1">
              O'zingizga <span className="accent shine-text">shaxsiy vizitka</span> oling va profilingizga ega bo'ling.
            </h1>
            <p className="sub reveal reveal-2">
              Format: <b className="mono">AAA00</b> — 3 lotin harfi + 2 raqam. Sizniki bo'lgach —
              akkauntingizdan tahrirlaysiz: rasm, kontaktlar, ijtimoiy tarmoqlar, dizayn mavzusi.
              Xohlasangiz, keyinroq qayta ham sotishingiz mumkin.
            </p>

            <div className="hero-cta-row reveal reveal-3">
              <button className="btn btn-brass btn-lg" onClick={() => document.getElementById('hero-check-input')?.focus({ preventScroll: false })}>Kodni tekshirish</button>
              <button className="btn btn-ghost btn-lg" onClick={() => document.getElementById('katalog')?.scrollIntoView({ behavior: 'smooth' })}>Katalogni ko'rish</button>
            </div>

            <div className="hero-search reveal reveal-3">
              <span className="pfx mono">nfcstore.uz/</span>
              <input
                id="hero-check-input"
                value={checkVal}
                onChange={onCheckChange}
                maxLength={6}
                placeholder="AAA00"
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') doCheck(); }}
              />
              <button className="hero-search-btn" onClick={doCheck} aria-label="Tekshirish"><IconSearch /></button>
            </div>
            {checkResult && (
              <div className="check-result hero-check-result">
                {checkResult.bad && <>
                  <span className="pill taken">Noto'g'ri format</span> 3 harf + 2 raqam kiriting, masalan ABZ07
                </>}
                {!checkResult.bad && checkResult.taken && <>
                  <span className="pill taken">Band</span> nfcstore.uz/{checkResult.code.toLowerCase()} allaqachon olingan — <a onClick={() => navigate('/' + checkResult.code)} style={{ color: 'var(--teal-bright)', cursor: 'pointer', textDecoration: 'underline' }}>sahifasini ko'rish</a>
                </>}
                {!checkResult.bad && !checkResult.taken && <>
                  <span className="pill ok">Bo'sh</span> nfcstore.uz/{checkResult.code.toLowerCase()} hozircha bo'sh
                </>}
              </div>
            )}

            <div className="stats-row reveal reveal-4">
              <div className="stat"><b><CountUp value={catalog.length} /></b><span>Band qilingan</span></div>
              <div className="stat"><b><CountUp value={currentBase(catalog.length)} suffix=" so'm" /></b><span>Hozirgi minimal narx</span></div>
              <div className="stat"><b style={{ color: 'var(--brass-bright)' }}><CountUp value={nextBase(catalog.length)} suffix=" so'm" /></b><span>Keyingi savdodan boshlab</span></div>
            </div>
          </div>

          <div className="hero-col-visual">
            <div className="hero-card-stage reveal reveal-3">
              <div className="card-stack">
                <div className="card-ghost card-ghost-1"><NfcCard code="XYZ12" name=" " finish="graphite" size="lg" /></div>
                <div className="card-ghost card-ghost-2"><NfcCard code="QRP88" name=" " finish="silver" size="lg" /></div>
                <div className="floaty card-main">
                  <NfcCard code="ABZ07" name="SIZNING ISMINGIZ" finish="black" size="lg" />
                </div>
              </div>
            </div>
            <p className="plate-caption" style={{ textAlign: 'center', margin: '18px auto 0' }}>
              Har bir vizitka noyob va faqat bitta egaga tegishli, o'z sahifasi va jismoniy NFC kartasi bilan.
            </p>
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <div className="marquee-wrap reveal">
          <div className="marquee-track">
            {marqueeItems.map((it, i) => (
              <span className="marquee-item mono" key={it.code + i} onClick={() => navigate('/' + it.code)}>
                nfcstore.uz/{it.code.toLowerCase()} <i>·</i> {it.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <RevealSection id="tekshir">
        <div className="section-label">Qadam 1</div>
        <h2>Vizitkangizni tekshiring</h2>
        <p className="section-desc">
          3 harf + 2 raqam kiriting (masalan ABZ07) — bo'sh yoki bandligini shu zahoti ko'rasiz.
        </p>
        <div className="panel glow-panel">
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
                <span className="pill taken">Noto'g'ri format</span> 3 harf + 2 raqam kiriting, masalan ABZ07
              </>}
              {!checkResult.bad && checkResult.taken && <>
                <span className="pill taken">Band</span> nfcstore.uz/{checkResult.code.toLowerCase()} allaqachon olingan — <a onClick={() => navigate('/' + checkResult.code)} style={{ color: 'var(--teal-bright)', cursor: 'pointer', textDecoration: 'underline' }}>sahifasini ko'rish</a>
              </>}
              {!checkResult.bad && !checkResult.taken && <>
                <span className="pill ok">Bo'sh</span> nfcstore.uz/{checkResult.code.toLowerCase()} hozircha bo'sh
              </>}
            </div>
          )}
        </div>
      </RevealSection>

      <RevealSection id="narx">
        <div className="section-label">Qadam 2</div>
        <h2>Narxni hisoblang</h2>
        <p className="section-desc">Minimal narx {fmt(currentBase(catalog.length))} so'mdan boshlanadi va har savdoda +{Math.round(PRICE_GROWTH * 100)}%ga oshadi. Kamyob harf/raqam kombinatsiyalari qimmatroq.</p>
        <div className="panel glow-panel">
          <div className="calc-grid">
            <div>
              <div className="code-input-group" style={{ marginBottom: 16 }}>
                <span className="pfx mono">nfcstore.uz/</span>
                <input value={calcVal} onChange={onCalcChange} maxLength={6} placeholder="ABZ 07" autoComplete="off" />
              </div>
              <div className="breakdown-row"><span className="k">Joriy minimal narx</span><span className="v">{fmt(calcInfo ? calcInfo.base : currentBase(catalog.length))} so'm</span></div>
              <div className="breakdown-row"><span className="k">Harflar naqshi</span><span className="v">{calcInfo ? calcInfo.lp.label : '—'}</span></div>
              <div className="breakdown-row"><span className="k">Raqamlar naqshi</span><span className="v">{calcInfo ? calcInfo.dp.label : '—'}</span></div>
              <div className="breakdown-row"><span className="k">Holati</span><span className="v">{calcParsed ? (calcTaken ? <span className="pill taken">Band</span> : <span className="pill ok">Bo'sh</span>) : '—'}</span></div>
            </div>
            <div className="price-box">
              <div className="amt">{calcParsed ? fmt(calcPrice) : fmt(BASE_PRICE)} <span style={{ fontSize: 16 }}>so'm</span></div>
              <div className="lbl">Jami narx</div>
              <div className="tag-row">
                {calcInfo && calcInfo.fixed && <span className="tag hot">Eksklyuziv — maxsus narx</span>}
                {calcInfo && calcInfo.lp.hot && <span className="tag hot">{calcInfo.lp.label}</span>}
                {calcInfo && calcInfo.dp.hot && <span className="tag hot">{calcInfo.dp.label}</span>}
                {calcInfo && !calcInfo.lp.hot && !calcInfo.dp.hot && <span className="tag">Standart kombinatsiya</span>}
                {calcParsed && <span className="tag" style={{ color: 'var(--brass-bright)' }}>Keyingi savdodan: {fmt(nextBase(catalog.length))}+</span>}
              </div>
              <button className="btn btn-brass pulse" style={{ marginTop: 18, width: '100%' }} disabled={!calcParsed || calcTaken} onClick={() => setModalCode(calcParsed.code)}>
                {!calcParsed ? 'Avval vizitka kiriting' : calcTaken ? 'Bu vizitka band' : ('Bandlash — ' + fmt(calcPrice) + " so'm")}
              </button>
            </div>
          </div>
        </div>
      </RevealSection>

      <RevealSection id="nomlar">
        <div className="section-label">Eksklyuziv</div>
        <h2>Chiroyli nomlar ro'yxati</h2>
        <p className="section-desc">
          Qo'lda tanlangan premium kombinatsiyalar. Narxlar joriy savdolar soniga
          qarab tizim tomonidan avtomatik hisoblanadi — band qilingach oshib boradi.
        </p>
        <div className="panel glow-panel">
          <div className="premium-tabs">
            {PREMIUM_GROUPS.map((g) => (
              <button
                key={g.id}
                className={'btn ' + (activeGroup === g.id ? 'btn-teal' : 'btn-ghost')}
                onClick={() => setActiveGroup(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
          {PREMIUM_GROUPS.filter((g) => g.id === activeGroup).map((g) => (
            <div key={g.id}>
              <p className="premium-desc">{g.desc}</p>
              <div className="grid">
                {g.codes.map((code) => {
                  const info = priceForCode(code, catalog.length);
                  const taken = !!takenMap[code];
                  return (
                    <a key={code} className="card card-premium" onClick={() => (taken ? navigate('/' + code) : setModalCode(code))}>
                      <div className="code">nfcstore.uz/{code.toLowerCase()}</div>
                      <div className="owner">
                        <span className={'pill ' + (taken ? 'taken' : 'ok')}>{taken ? 'Band' : "Bo'sh"}</span>
                      </div>
                      <div className="tag-row">
                        <span className={'tag' + (info.lp.hot ? ' hot' : '')}>{info.lp.label}</span>
                        <span className={'tag' + (info.dp.hot ? ' hot' : '')}>{info.dp.label}</span>
                      </div>
                      <div className="meta">{fmt(info.total)} so'm</div>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </RevealSection>

      {sales.length > 0 && (
        <RevealSection id="sotuv">
          <div className="section-label">Bozor</div>
          <h2>Sotuvdagi vizitkalar</h2>
          <p className="section-desc">Boshqa foydalanuvchilar qayta sotayotgan vizitkalar. Sotib olingach profilingizga o'tadi.</p>
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
        </RevealSection>
      )}

      <RevealSection id="katalog">
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
      </RevealSection>

      <RevealSection id="savollar">
        <div className="section-label">FAQ</div>
        <h2>Tez-tez so'raladigan savollar</h2>
        <div className="panel glow-panel" style={{ padding: '8px 28px' }}>
          {[
            { q: "Vizitkani sotib olgach o'zgartirsa bo'ladimi?", a: "Ha! Akkaunt yaratsangiz, vizitkangiz profilingizga biriktiriladi va uni /account sahifasidan istalgan vaqt tahrirlaysiz: ism, kasb, rasm, ijtimoiy tarmoqlar, profil mavzusi va boshqalar." },
            { q: 'Narx qanday hisoblanadi?', a: `Joriy minimal narx ${fmt(currentBase(catalog.length))} so'm va har savdoda +${Math.round(PRICE_GROWTH * 100)}%ga oshadi. Kamyob harf/raqam kombinatsiyalari (masalan bir xil harflar yoki "00") qimmatroq bo'ladi.` },
            { q: "Vizitkamni qayta sotishim mumkinmi?", a: "Ha. Kabinetda «Sotuvga qo'yish» tugmasini bosasiz — narx avtomatik joriy narxdan qimmat qilib belgilanadi. Xohlagan foydalanuvchi uni sotib olgach, vizitka uning profiliga o'tadi." },
            { q: "Profilim qanday ko'rinadi?", a: "Har bir vizitkaning o'z shaxsiy sahifasi bor: rasmingiz, kasbingiz, bio, kontaktlar, ijtimoiy tarmoqlar (Telegram, Instagram, Facebook, X), to'lov karta raqamingiz va tanlagan dizayn mavzuingiz bilan." },
          ].map((f, i) => (
            <div className={'faq-item' + (openFaq === i ? ' open' : '')} key={i}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>{f.q} <span className="x">+</span></button>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {modalCode && (
        <ReserveModal
          code={modalCode}
          price={priceForCode(modalCode, catalog.length).total}
          onClose={() => setModalCode(null)}
          onDone={() => { refreshCatalog(); refreshSales(); }}
        />
      )}
    </main>
  );
}
