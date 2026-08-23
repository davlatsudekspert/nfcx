import { useEffect, useRef, useState } from 'react';
import { dbGet } from '../lib/db.js';
import { parseAnyCode, priceFor, currentBase, nextBase } from '../lib/pricing.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import ReserveModal from '../components/ReserveModal.jsx';
import NfcCard from '../components/NfcCard.jsx';

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

const TEASERS = [
  { href: '/narxlar', title: 'Narxlar', desc: "Kalkulyator bilan aniq narxni hisoblang va naqshlar qanday ta'sir qilishini ko'ring.", go: 'Narxlarni ko\'rish →' },
  { href: '/qanday-ishlaydi', title: 'Qanday ishlaydi', desc: "Bandlashdan profilni sozlash va qayta sotishgacha — besh qadam.", go: "Qadamlarni ko'rish →" },
  { href: '/katalog', title: 'Katalog', desc: "Barcha band qilingan vizitkalar va sotuvdagi profillar ro'yxati.", go: "Katalogni ochish →" },
  { href: '/savollar', title: 'Savollar', desc: "Narx, egalik, qayta sotish va profil haqida ko'p so'raladigan savollar.", go: 'FAQ →' },
];

export default function HomePage({ catalog, refreshCatalog }) {
  const [checkVal, onCheckChange] = useMaskedCode();
  const [checkResult, setCheckResult] = useState(null);
  const [modalCode, setModalCode] = useState(null);

  const takenMap = {};
  catalog.forEach((r) => { takenMap[r.code] = r; });

  const doCheck = async () => {
    const parsed = parseAnyCode(checkVal);
    if (!parsed) { setCheckResult({ bad: true }); return; }
    const rec = takenMap[parsed.code] || await dbGet(parsed.code);
    setCheckResult({ code: parsed.code, taken: !!rec });
  };

  const checkParsed = parseAnyCode(checkVal);
  const checkInfo = checkParsed ? priceFor(checkParsed.code.slice(0, 3), checkParsed.code.slice(3, 5), catalog.length) : null;

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

        <div className="eyebrow reveal"><span className="dot"></span> O'z profilingiz — nfcstore.uz/ismingiz</div>

        <h1 className="reveal reveal-1">
          O'zingizga <span className="accent shine-text">shaxsiy vizitka</span> oling va profilingizga ega bo'ling.
        </h1>
        <p className="sub reveal reveal-2">
          Format: <b className="mono">AAA00</b> — 3 lotin harfi + 2 raqam. Sizniki bo'lgach —
          akkauntingizdan tahrirlaysiz: rasm, kontaktlar, ijtimoiy tarmoqlar, dizayn mavzusi.
          Xohlasangiz, keyinroq qayta ham sotishingiz mumkin.
        </p>

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

        <div className="stats-row reveal reveal-4">
          <div className="stat"><b><CountUp value={catalog.length} /></b><span>Band qilingan</span></div>
          <div className="stat"><b><CountUp value={currentBase(catalog.length)} suffix=" so'm" /></b><span>Hozirgi minimal narx</span></div>
          <div className="stat"><b style={{ color: 'var(--brass-bright)' }}><CountUp value={nextBase(catalog.length)} suffix=" so'm" /></b><span>Keyingi savdodan boshlab</span></div>
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
        <div className="section-label">Tez tekshirish</div>
        <h2>Vizitkangiz bo'shmi?</h2>
        <p className="section-desc">3 harf + 2 raqam kiriting (masalan ABZ07) — bo'sh yoki bandligini shu zahoti ko'rasiz.</p>
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
                <span className="pill ok">Bo'sh</span> nfcstore.uz/{checkResult.code.toLowerCase()} hozircha bo'sh — {fmt(checkInfo.total)} so'm
                <button className="btn btn-brass pulse" style={{ marginLeft: 10 }} onClick={() => setModalCode(checkResult.code)}>Bandlash</button>
              </>}
            </div>
          )}
        </div>
      </RevealSection>

      <RevealSection id="sahifalar">
        <div className="section-label">Batafsil</div>
        <h2>Sayt bo'ylab</h2>
        <div className="teaser-grid">
          {TEASERS.map((t) => (
            <a key={t.href} className="teaser-card" onClick={() => navigate(t.href)}>
              <h3>{t.title}</h3>
              <p>{t.desc}</p>
              <span className="go">{t.go}</span>
            </a>
          ))}
        </div>
      </RevealSection>

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
