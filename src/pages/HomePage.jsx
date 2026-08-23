import { useEffect, useRef, useState } from 'react';
import { dbGet } from '../lib/db.js';
import { parseAnyCode, priceForCode, currentBase, nextBase } from '../lib/pricing.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import ReserveModal from '../components/ReserveModal.jsx';
import NfcCard from '../components/NfcCard.jsx';
import { IconWave, IconSearch } from '../components/Icons.jsx';

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

function Reveal({ children, delay = '', as: Tag = 'div', className = '' }) {
  const [ref, shown] = useReveal();
  return (
    <Tag ref={ref} className={`${className} transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${delay}`}>
      {children}
    </Tag>
  );
}

function RevealSection({ id, children }) {
  const [ref, shown] = useReveal();
  return (
    <section id={id} ref={ref} className={`mt-16 transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
      {children}
    </section>
  );
}

const TEASERS = [
  { href: '/narxlar', title: 'Narxlar', desc: "Kalkulyator bilan aniq narxni hisoblang va naqshlar qanday ta'sir qilishini ko'ring.", go: "Narxlarni ko'rish →" },
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
  const checkInfo = checkParsed ? priceForCode(checkParsed.code, catalog.length) : null;

  const recent = [...catalog].sort((a, b) => b.ts - a.ts).slice(0, 10);
  const marqueeItems = recent.length ? [...recent, ...recent] : [];

  return (
    <main>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-black">
        <div className="pointer-events-none absolute -inset-x-[18%] -inset-y-[12%] bg-[radial-gradient(640px_460px_at_74%_38%,rgba(96,124,156,0.15),transparent_65%),radial-gradient(420px_320px_at_16%_86%,rgba(120,148,176,0.08),transparent_60%)]"></div>

        <div className="relative z-[1] mx-auto grid max-w-6xl items-center gap-11 px-5 pb-8 pt-14 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
                O'z profilingiz — nfcstore.uz/ismingiz
              </span>
            </Reveal>

            <Reveal delay="[transition-delay:80ms]">
              <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
                O'zingizga <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">shaxsiy vizitka</span> oling va profilingizga ega bo'ling.
              </h1>
            </Reveal>

            <Reveal delay="[transition-delay:160ms]">
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-base-content/60">
                Format: <b className="font-mono">AAA000</b> — 3 lotin harfi + 3 raqam. Sizniki bo'lgach — akkauntingizdan
                tahrirlaysiz: rasm, kontaktlar, ijtimoiy tarmoqlar, dizayn mavzusi. Xohlasangiz, keyinroq qayta ham sotishingiz mumkin.
              </p>
            </Reveal>

            {/* Glassmorphism search */}
            <Reveal delay="[transition-delay:240ms]">
              <div className="mt-6 max-w-xl rounded-[20px] border border-[rgba(150,172,196,0.20)] bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-3 pl-[18px] shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                  <div className="flex min-w-0 flex-1 items-center rounded-lg border border-[rgba(150,172,196,0.16)] bg-black/45 focus-within:border-[rgba(158,182,206,0.5)] focus-within:shadow-[0_0_0_3px_rgba(110,138,168,0.15)]">
                    <span className="shrink-0 pl-3 font-mono text-xs text-base-content/40">nfcstore.uz/</span>
                    <input
                      value={checkVal}
                      onChange={onCheckChange}
                      maxLength={7}
                      placeholder="ABZ 007"
                      autoComplete="off"
                      onKeyDown={(e) => { if (e.key === 'Enter') doCheck(); }}
                      className="w-full bg-transparent px-2 py-3 font-mono text-sm uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal"
                    />
                  </div>
                  <button
                    onClick={doCheck}
                    aria-label="Tekshirish"
                    className="btn btn-circle shrink-0 border-none bg-gradient-to-br from-[#7e99af] to-[#4f6f88] text-white shadow-[0_8px_24px_rgba(79,111,136,0.45)] hover:brightness-110"
                  >
                    <IconSearch />
                  </button>
                </div>
                {checkResult && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 px-1 pb-1 text-[13.5px]">
                    {checkResult.bad && <>
                      <span className="badge badge-error badge-outline">Noto'g'ri format</span>
                      <span className="text-base-content/60">3 harf + 3 raqam kiriting, masalan ABZ007</span>
                    </>}
                    {!checkResult.bad && checkResult.taken && <>
                      <span className="badge badge-error">Band</span>
                      <span className="text-base-content/60">
                        nfcstore.uz/{checkResult.code.toLowerCase()} allaqachon olingan —{' '}
                        <button onClick={() => navigate('/' + checkResult.code)} className="cursor-pointer underline decoration-[#9fb2c4] underline-offset-2 hover:text-base-content">sahifasini ko'rish</button>
                      </span>
                    </>}
                    {!checkResult.bad && !checkResult.taken && <>
                      <span className="badge badge-success">Bo'sh</span>
                      <span className="text-base-content/60">nfcstore.uz/{checkResult.code.toLowerCase()} hozircha bo'sh — {fmt(checkInfo.total)} so'm</span>
                      <button className="btn btn-primary btn-xs ml-1" onClick={() => setModalCode(checkResult.code)}>Bandlash</button>
                    </>}
                  </div>
                )}
              </div>
            </Reveal>

            {/* Stats */}
            <Reveal delay="[transition-delay:320ms]">
              <div className="mt-7 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-lg font-bold"><CountUp value={catalog.length} /></div>
                  <div className="text-xs text-base-content/50">Band qilingan</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-lg font-bold"><CountUp value={currentBase(catalog.length)} suffix=" so'm" /></div>
                  <div className="text-xs text-base-content/50">Hozirgi minimal narx</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-lg font-bold"><CountUp value={nextBase(catalog.length)} suffix=" so'm" /></div>
                  <div className="text-xs text-base-content/50">Keyingi savdodan boshlab</div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* ===== Neon orbit kompozitsiyasi ===== */}
          <Reveal delay="[transition-delay:160ms]" className="hidden justify-self-center lg:block">
            <div className="relative h-[480px] w-[480px]" aria-hidden="true">
              <div className="absolute inset-[5%] rounded-full border border-[rgba(132,154,178,0.30)] shadow-[0_0_70px_rgba(92,116,144,0.24),inset_0_0_55px_rgba(104,128,156,0.12)]"></div>
              <div className="absolute -inset-[calc(5%-10px)] rounded-full border border-dashed border-[rgba(142,164,188,0.13)]"></div>
              <div className="absolute inset-[5%] animate-[spinSlow_16s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,transparent_0_76%,rgba(168,188,208,0.85)_94%,transparent_100%)] [-webkit-mask:radial-gradient(farthest-side,transparent_calc(100%_-_4px),#000_calc(100%_-_3px))] [mask:radial-gradient(farthest-side,transparent_calc(100%_-_4px),#000_calc(100%_-_3px))] [filter:drop-shadow(0_0_8px_rgba(134,158,184,0.5))]"></div>
              <div className="absolute inset-[5%] animate-[spinSlow_16s_linear_infinite] rounded-full">
                <span className="absolute -top-[5px] left-1/2 ml-[-5px] h-2.5 w-2.5 rounded-full bg-[#b3c1cf] shadow-[0_0_14px_3px_rgba(140,164,190,0.5)]"></span>
              </div>
              <div className="absolute inset-[5%] animate-[spinSlow_26s_linear_infinite_reverse] rounded-full">
                <span className="absolute -top-1 left-1/2 ml-[-4px] h-[7px] w-[7px] rounded-full bg-[#b3c1cf] opacity-75 shadow-[0_0_14px_3px_rgba(140,164,190,0.5)]"></span>
              </div>

              <div className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 translate-y-[-54%] animate-[floatY_5s_ease-in-out_infinite]">
                <NfcCard code="AAA000" name="SIZNING ISMINGIZ" finish="black" size="lg" className="rim-cyan" />
              </div>

              <div className="absolute right-[4%] top-[2%] z-[2] flex h-[88px] w-[88px] animate-[floatY_5s_ease-in-out_infinite] flex-col items-center justify-center gap-1.5 rounded-3xl border border-[rgba(152,174,198,0.18)] bg-gradient-to-br from-[#16181c] to-[#07080a] text-[#9fb2c4] shadow-[0_18px_40px_rgba(0,0,0,0.55),0_0_22px_rgba(112,138,166,0.12)] [animation-delay:0.6s]">
                <IconWave />
                <span className="font-mono text-[9px] tracking-[0.14em] text-[rgba(159,178,196,0.55)]">NFC TAP</span>
              </div>
              <div className="absolute bottom-[6%] left-0 z-[2] flex h-[88px] w-[88px] animate-[floatY_5s_ease-in-out_infinite] flex-col items-center justify-center gap-1.5 rounded-3xl border border-[rgba(152,174,198,0.18)] bg-gradient-to-br from-[#16181c] to-[#07080a] text-[#9fb2c4] shadow-[0_18px_40px_rgba(0,0,0,0.55),0_0_22px_rgba(112,138,166,0.12)] [animation-delay:1.4s]">
                <IconWave />
                <span className="font-mono text-[9px] tracking-[0.14em] text-[rgba(159,178,196,0.55)]">NFC TAG</span>
              </div>

              <div className="absolute left-[6%] top-[13%] z-[2] flex animate-[floatY_5s_ease-in-out_infinite] flex-col items-center [animation-delay:1s]">
                <span className="z-[1] -mb-1.5 h-[34px] w-[34px] rounded-full border-[5px] border-[#b9bcc2] border-t-[#e7e9ec] border-l-[#dfe1e6] shadow-md"></span>
                <div className="flex h-[118px] w-[78px] flex-col items-center justify-center gap-2 rounded-[20px] border border-[rgba(152,174,198,0.14)] bg-gradient-to-b from-[#232427] via-[#101113] to-[#1a1b1e] text-[#9fb2c4] shadow-[0_20px_44px_rgba(0,0,0,0.6),0_0_20px_rgba(112,138,166,0.10)]">
                  <IconWave />
                  <b className="font-mono text-[11px] tracking-[0.2em] text-[rgba(159,178,196,0.5)]">NFC</b>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Marquee */}
        {recent.length > 0 && (
          <Reveal>
            <div className="overflow-hidden border-y border-white/10 bg-white/[0.02] py-3.5 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
              <div className="flex w-max animate-[marqueeScroll_26s_linear_infinite] gap-[34px]">
                {marqueeItems.map((it, i) => (
                  <span
                    key={it.code + i}
                    onClick={() => navigate('/' + it.code)}
                    className="cursor-pointer whitespace-nowrap font-mono text-[12.5px] tracking-wide text-base-content/40 transition-colors hover:text-base-content"
                  >
                    nfcstore.uz/{it.code.toLowerCase()} · {it.name}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </section>

      <div className="mx-auto max-w-6xl px-5 pb-16">
        <RevealSection id="sahifalar">
          <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">Batafsil</div>
          <h2 className="mt-2 text-2xl font-bold">Sayt bo'ylab</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEASERS.map((t) => (
              <button
                key={t.href}
                onClick={() => navigate(t.href)}
                className="group cursor-pointer rounded-2xl border border-white/10 bg-base-200/70 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-base-200"
              >
                <h3 className="font-semibold">{t.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-base-content/55">{t.desc}</p>
                <span className="mt-4 inline-block text-sm text-base-content/80 transition-transform group-hover:translate-x-1">{t.go}</span>
              </button>
            ))}
          </div>
        </RevealSection>
      </div>

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
