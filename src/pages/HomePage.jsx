import { useEffect, useRef, useState } from 'react';
import { dbGet } from '../lib/db.js';
import { parseAnyCode, priceForCode } from '../lib/pricing.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import ReserveModal from '../components/ReserveModal.jsx';
import NeonOrbitCard from '../components/NeonOrbitCard.jsx';
import { IconSearch } from '../components/Icons.jsx';
import { useLanguage } from '../lib/i18n.jsx';

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
  { href: '/yangiliklar', title: 'Yangiliklar', desc: "Ishga tushirish sanasi, yangi ID'lar, aksiyalar va platforma yangiliklari.", go: "Yangiliklarni ko'rish →" },
  { href: '/katalog', title: 'Katalog', desc: "Barcha band qilingan raqamli tashrif qog'ozlar ro'yxati.", go: "Katalogni ochish →" },
  { href: '/savollar', title: 'Savollar', desc: "Profil, NFC karta, kontakt saqlash va xavfsizlik bo'yicha javoblar.", go: 'FAQ →' },
];

export default function HomePage({ catalog, refreshCatalog }) {
  const { t, lang } = useLanguage();
  const [checkVal, rawOnCheckChange] = useMaskedCode();
  const [checkResult, setCheckResult] = useState(null);
  const [modalCode, setModalCode] = useState(null);
  // Kiritma o'zgarganda eski natijani tozalaymiz — aks holda kod
  // belgilanib o'chirilganda eski natija qoladi va (checkInfo endi null
  // bo'lgani uchun) sahifa qulab tushardi.
  const onCheckChange = (e) => { rawOnCheckChange(e); setCheckResult(null); };

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
        <div className="pointer-events-none absolute -inset-x-[18%] -inset-y-[12%] bg-[radial-gradient(640px_460px_at_74%_38%,rgba(201,162,39,0.16),transparent_65%),radial-gradient(420px_320px_at_16%_86%,rgba(180,140,50,0.09),transparent_60%)]"></div>

        <div className="relative z-[1] mx-auto grid w-full max-w-[1800px] items-center gap-11 px-6 pb-8 pt-14 sm:px-10 lg:grid-cols-[minmax(0,1fr)_460px] xl:grid-cols-[minmax(0,1fr)_560px] lg:px-14">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
                {t("NFC karta + shaxsiy raqamli profil")}
              </span>
            </Reveal>

            <Reveal delay="[transition-delay:80ms]">
              <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
                {lang === 'uz' ? (
                  <>Sizning <span className="text-[#e8c165]">raqamli profilingiz</span>. Har doim yoningizda.</>
                ) : t('Sizning raqamli profilingiz. Har doim yoningizda.')}
              </h1>
            </Reveal>

            <Reveal delay="[transition-delay:160ms]">
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-base-content/60">
                {t("Telefon raqamingiz, ijtimoiy tarmoqlaringiz, saytingiz va boshqa muhim ma’lumotlaringizni bitta profilda jamlang. Uni NFC karta yoki havola orqali qulay ulashing.")}
              </p>
            </Reveal>

            <Reveal delay="[transition-delay:220ms]">
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button onClick={() => navigate('/register')} className="btn btn-primary min-h-12 px-6">{t('Bepul profil yaratish')}</button>
                <button onClick={() => navigate('/qanday-ishlaydi')} className="btn btn-ghost min-h-12 px-6">{t('Qanday ishlaydi')}</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-base-content/50">
                <span>✓ {t('Bepul boshlash')}</span>
                <span>✓ {t('Telefon ilovasi shart emas')}</span>
                <span>✓ {t('Kontaktni .VCF formatida saqlash')}</span>
              </div>
            </Reveal>

            {/* Ixtiyoriy maxsus NFC ID qidiruvi */}
            <Reveal delay="[transition-delay:240ms]">
              <div className="mt-7 max-w-xl rounded-[18px] border border-white/10 bg-white/[0.035] p-3 pl-[18px]">
                <div className="mb-2 text-xs font-semibold text-base-content/55">{t('Maxsus NFC ID tekshirish (ixtiyoriy)')}</div>
                <div className="flex items-center gap-2.5">
                  <div className="flex min-w-0 flex-1 items-center rounded-lg border border-[rgba(201,162,39,0.20)] bg-black/45 focus-within:border-[rgba(212,175,90,0.6)] focus-within:shadow-[0_0_0_3px_rgba(201,162,39,0.18)]">
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
                    aria-label={t('Tekshirish')}
                    className="btn btn-circle shrink-0 border-none bg-gradient-to-br from-[#e8c165] to-[#b3860f] text-[#17130a] shadow-[0_8px_24px_rgba(180,140,20,0.45)] hover:brightness-110"
                  >
                    <IconSearch />
                  </button>
                </div>
                {checkResult && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 px-1 pb-1 text-[16px]">
                    {checkResult.bad && <>
                      <span className="badge badge-error badge-outline">{t("Noto'g'ri format")}</span>
                      <span className="text-base-content/60">{t('3 harf + 3 raqam kiriting, masalan ABZ007')}</span>
                    </>}
                    {!checkResult.bad && checkResult.taken && <>
                      <span className="badge badge-error">{t('Band')}</span>
                      <span className="text-base-content/60">
                        {t('nfcstore.uz/{code} allaqachon olingan —', { code: checkResult.code.toLowerCase() })}{' '}
                        <button onClick={() => navigate('/' + checkResult.code)} className="cursor-pointer underline decoration-[#c9a227] underline-offset-2 hover:text-base-content">{t("sahifasini ko'rish")}</button>
                      </span>
                    </>}
                    {!checkResult.bad && !checkResult.taken && checkInfo && checkInfo.tier === 'exclusive' && <>
                      <span className="badge" style={{ background: '#ff5c8a22', color: '#ff5c8a', border: '1px solid #ff5c8a55' }}>{'\u{1F48E}'} {t('Ekslyuziv')}</span>
                      <span className="text-base-content/60">{t('nfcstore.uz/{code} — faqat auksion orqali sotiladi', { code: checkResult.code.toLowerCase() })}</span>
                      <button className="btn btn-accent btn-xs ml-1" onClick={() => navigate('/auksion')}>{t("Auksion bo'limi")}</button>
                    </>}
                    {!checkResult.bad && !checkResult.taken && checkInfo && checkInfo.tier !== 'exclusive' && <>
                      <span className="badge badge-success">{t("Bo'sh")}</span>
                      <span className="text-base-content/60">{t('nfcstore.uz/{code} hozircha bo‘sh — {price} so‘m', { code: checkResult.code.toLowerCase(), price: fmt(checkInfo.total) })}</span>
                      <button className="btn btn-primary btn-xs ml-1" onClick={() => setModalCode(checkResult.code)}>{t('Bandlash')}</button>
                    </>}
                  </div>
                )}
              </div>
            </Reveal>

            {/* Stats */}
            <Reveal delay="[transition-delay:320ms]">
              <div className="mt-7 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.09] bg-gradient-to-br from-white/[0.055] to-white/[0.015] px-4 py-3 backdrop-blur-md">
                  <div className="text-lg font-bold"><CountUp value={catalog.length} /></div>
                  <div className="text-xs text-base-content/50">{t('Band qilingan')}</div>
                </div>
                <div className="rounded-xl border border-white/[0.09] bg-gradient-to-br from-white/[0.055] to-white/[0.015] px-4 py-3 backdrop-blur-md">
                  <div className="text-lg font-bold">{t('Bitta havola')}</div>
                  <div className="text-xs text-base-content/50">{t('Barcha kontaktlaringiz')}</div>
                </div>
                <div className="rounded-xl border border-white/[0.09] bg-gradient-to-br from-white/[0.055] to-white/[0.015] px-4 py-3 backdrop-blur-md">
                  <div className="text-lg font-bold">{t('Tez ulashish')}</div>
                  <div className="text-xs text-base-content/50">{t('NFC yoki havola orqali')}</div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* ===== Neon orbit kompozitsiyasi ===== */}
          <Reveal delay="[transition-delay:160ms]" className="hidden justify-self-center overflow-visible lg:block">
            <NeonOrbitCard code="AAA000" name={t('SIZNING ISMINGIZ')} />
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
                    className="cursor-pointer whitespace-nowrap font-mono text-[15px] tracking-wide text-base-content/40 transition-colors hover:text-base-content"
                  >
                    nfcstore.uz/{it.code.toLowerCase()} · {it.name}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </section>

      <div className="mx-auto w-full max-w-[1800px] px-6 pb-16 sm:px-10 lg:px-14">
        <RevealSection id="qanday-ishlaydi-qisqa">
          <div className="max-w-2xl">
            <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">{t('3 oddiy qadam')}</div>
            <h2 className="mt-2 text-3xl font-bold">{t('Ulashish shunchalik oson.')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-base-content/55">{t('NFCSTORE — tanishuv va aloqa almashishning zamonaviy usuli.')}</p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              ['01', 'Kartani yaqinlashtiring', 'NFC kartani telefonning orqa qismiga tuting.'],
              ['02', 'Profil ochiladi', 'Hech qanday ilova kerak emas — raqamli profil brauzerda ochiladi.'],
              ['03', 'Kontaktni saqlang', 'Ism, telefon va boshqa ma’lumotlar bir tugma orqali kontaktlarga qo‘shiladi.'],
            ].map(([n, title, desc]) => (
              <article key={n} className="rounded-2xl border border-white/10 bg-base-200/60 p-5">
                <div className="font-mono text-xs text-accent">{n}</div>
                <h3 className="mt-3 text-lg font-bold">{t(title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-base-content/55">{t(desc)}</p>
              </article>
            ))}
          </div>
        </RevealSection>

        <RevealSection id="sahifalar">
          <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">{t('Batafsil')}</div>
          <h2 className="mt-2 text-2xl font-bold">{t("Sayt bo'ylab")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEASERS.map((item) => (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className="group cursor-pointer rounded-2xl border border-white/10 bg-base-200/70 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-base-200"
              >
                <h3 className="font-semibold">{t(item.title)}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-base-content/55">{t(item.desc)}</p>
                <span className="mt-4 inline-block text-sm text-base-content/80 transition-transform group-hover:translate-x-1">{t(item.go)}</span>
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
