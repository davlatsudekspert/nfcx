import { useEffect, useRef, useState } from 'react';
import PhysicalCardCta from '../components/PhysicalCardCta.jsx';
import { dbGet } from '../lib/db.js';
import { parseAnyCode, priceForCode } from '../lib/pricing.js';
import { isBrandReserved } from '../lib/brandReserved.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import ReserveModal from '../components/ReserveModal.jsx';
import NeonOrbitCard from '../components/NeonOrbitCard.jsx';
import NfcCard from '../components/NfcCard.jsx';
import { IconSearch, IconCheck, IconUser, IconBag, IconShield, IconBolt, IconGlobe } from '../components/Icons.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { usePaymentsEnabled } from '../lib/paymentsEnabled.jsx';
import { TIER_PRICE, TIER_LABEL, PROFILE_PREMIUM_FEE } from '../lib/pricing.js';
import { FAQ } from '../lib/faq.js';

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
    <section id={id} ref={ref} className={`mt-16 md:mt-20 transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
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
  const paymentsEnabled = usePaymentsEnabled();
  const faqItems = (FAQ[lang] || FAQ.uz).slice(0, 4);
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
    // Brend uchun himoyalangan nom — bazaga umuman bormaymiz: javob
    // "band" emas, "himoyalangan". Server ham xuddi shu qoidani
    // qo'llaydi (hosting/worker.js isBrandReservedD1), bu yerdagisi
    // faqat darhol javob berish uchun.
    if (isBrandReserved(parsed.code)) { setCheckResult({ code: parsed.code, brandReserved: true }); return; }
    const rec = takenMap[parsed.code] || await dbGet(parsed.code);
    setCheckResult({ code: parsed.code, taken: !!rec });
  };

  const checkParsed = parseAnyCode(checkVal);
  const checkInfo = checkParsed ? priceForCode(checkParsed.code, catalog.length) : null;

  const recent = [...catalog].sort((a, b) => b.ts - a.ts).slice(0, 10);
  const marqueeItems = recent.length ? [...recent, ...recent] : [];

  return (
    <main className="bg-page-bg">
      {/* ================= HERO (V1: markazlashgan, karta pastda) ================= */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(720px_420px_at_50%_0%,rgba(212,175,90,0.14),transparent_70%),radial-gradient(420px_320px_at_10%_90%,rgba(180,140,50,0.08),transparent_60%)]"></div>

        <div className="relative z-[1] mx-auto w-full max-w-[1800px] px-6 pb-10 pt-14 sm:px-10 lg:px-14 md:pt-20 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center lg:gap-10 lg:pb-8 lg:pt-8 xl:grid-cols-[minmax(0,1fr)_560px] xl:gap-16 xl:pt-12">
          {/* ===== CHAP USTUN: sarlavha, CTA, afzalliklar, NFC ID qidiruvi ===== */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <Reveal>
            <span className="vz-kicker">{t('NFC karta + raqamli profil')}</span>
          </Reveal>

          <Reveal delay="[transition-delay:80ms]">
            <h1 className="vz-h1 mt-5 max-w-[16ch] text-[color:var(--vz-ink)]">
              {lang === 'uz' ? (
                <>Bitta teginish — <span className="text-[color:var(--vz-gold-2)]">barcha kontaktlaringiz.</span></>
              ) : t('Bitta teginish — barcha kontaktlaringiz.')}
            </h1>
          </Reveal>

          <Reveal delay="[transition-delay:160ms]">
            <p className="vz-lead mx-auto mt-5 lg:mx-0">
              {t("Telefon raqamingiz, ijtimoiy tarmoqlaringiz, saytingiz va o‘ziga xos NFCSTORE ID’ingizni bitta profilda jamlang. NFC karta yoki havola orqali qulay ulashing.")}
            </p>
          </Reveal>

          <Reveal delay="[transition-delay:220ms]" className="w-full">
            <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row lg:justify-start">
              <button onClick={() => navigate('/register')} className="btn btn-gold min-h-12 px-7 text-[15px]">{t('Bepul profil yaratish')}</button>
              <button onClick={() => navigate('/qanday-ishlaydi')} className="btn btn-ghost-vz min-h-12 px-7 text-[15px]">{t('Qanday ishlaydi')}</button>
            </div>
            <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm text-[color:var(--vz-ink-2)] lg:justify-start">
              {['Bepul boshlash', 'Telefon ilovasi shart emas', 'Kontaktni .VCF formatida saqlash'].map((b) => (
                <li key={b} className="inline-flex items-center gap-1.5"><IconCheck width="14" height="14" className="text-[color:var(--vz-gold)]" /> {t(b)}</li>
              ))}
            </ul>
          </Reveal>

          {/* Ixtiyoriy maxsus NFC ID qidiruvi */}
          <Reveal delay="[transition-delay:240ms]" className="w-full">
            <div className="vz-panel mx-auto mt-8 w-full max-w-xl p-3 text-left sm:p-4 lg:mx-0">
              <div className="vz-label mb-2">{t('Maxsus NFC ID tekshirish (ixtiyoriy)')}</div>
              <div className="flex items-center gap-2.5">
                <div className="flex min-w-0 flex-1 items-center rounded-[10px] border border-[rgba(212,175,90,0.25)] bg-black/45 focus-within:border-[rgba(212,175,90,0.7)] focus-within:shadow-[0_0_0_3px_rgba(212,175,90,0.18)]">
                  <span className="shrink-0 pl-3 font-mono text-xs text-[color:var(--vz-ink-3)]">nfcstore.uz/</span>
                  <input
                    value={checkVal}
                    onChange={onCheckChange}
                    maxLength={7}
                    placeholder="ABZ 007"
                    autoComplete="off"
                    aria-label={t('Maxsus NFC ID tekshirish (ixtiyoriy)')}
                    onKeyDown={(e) => { if (e.key === 'Enter') doCheck(); }}
                    className="w-full min-w-0 bg-transparent px-2 py-3 font-mono text-sm uppercase tracking-wider text-[color:var(--vz-ink)] outline-none placeholder:normal-case placeholder:tracking-normal"
                  />
                </div>
                <button
                  onClick={doCheck}
                  aria-label={t('Tekshirish')}
                  className="btn btn-gold btn-circle h-11 w-11 shrink-0 p-0"
                >
                  <IconSearch />
                </button>
              </div>
              {checkResult && (
                <div className="mt-3 flex flex-wrap items-center gap-2 px-1 pb-1 text-[15px]">
                  {checkResult.bad && <>
                    <span className="vz-badge vz-badge--warn">{t("Noto'g'ri format")}</span>
                    <span className="text-[color:var(--vz-ink-2)]">{t('3 harf + 3 raqam kiriting, masalan ABZ007')}</span>
                  </>}
                  {/* BREND UCHUN HIMOYALANGAN. "Band" deb yozish
                      noto'g'ri bo'lardi — bu tugab qolgan narsa emas,
                      qoida. Rasmiy vakil uchun murojaat yo'li ochiq
                      qoladi: bu bizga kompaniya mijozi ham keltiradi. */}
                  {!checkResult.bad && checkResult.brandReserved && <>
                    <span className="vz-badge vz-badge--gold">{t('Brend uchun himoyalangan')}</span>
                    <span className="text-[color:var(--vz-ink-2)]">
                      {t('Bu nom kompaniya yoki brend nomiga mos kelgani uchun ochiq sotuvga qo‘yilmagan. Brendning rasmiy egasi yoki vakili bo‘lsangiz, admin bilan bog‘laning.')}
                    </span>
                    <button className="btn btn-outline-gold btn-sm min-h-9" onClick={() => navigate('/aloqa')}>{t('Admin bilan bog‘lanish')}</button>
                  </>}
                  {!checkResult.bad && checkResult.taken && <>
                    <span className="vz-badge vz-badge--muted">{t('Band')}</span>
                    <span className="text-[color:var(--vz-ink-2)]">
                      {t('nfcstore.uz/{code} allaqachon olingan —', { code: checkResult.code.toLowerCase() })}{' '}
                      <button onClick={() => navigate('/' + checkResult.code)} className="cursor-pointer underline decoration-[#c9a227] underline-offset-2 hover:text-[color:var(--vz-ink)]">{t("sahifasini ko'rish")}</button>
                    </span>
                  </>}
                  {!checkResult.bad && !checkResult.brandReserved && !checkResult.taken && checkInfo && checkInfo.tier === 'exclusive' && <>
                    <span className="vz-badge vz-badge--gold">{t('Ekslyuziv')}</span>
                    <span className="text-[color:var(--vz-ink-2)]">{t('nfcstore.uz/{code} — faqat auksion orqali sotiladi', { code: checkResult.code.toLowerCase() })}</span>
                    <button className="btn btn-outline-gold btn-sm min-h-9" onClick={() => navigate('/auksion')}>{t("Auksion bo'limi")}</button>
                  </>}
                  {!checkResult.bad && !checkResult.brandReserved && !checkResult.taken && checkInfo && checkInfo.tier !== 'exclusive' && <>
                    <span className="vz-badge vz-badge--ok">{t("Bo'sh")}</span>
                    <span className="text-[color:var(--vz-ink-2)]">{t('nfcstore.uz/{code} hozircha bo‘sh — {price} so‘m', { code: checkResult.code.toLowerCase(), price: fmt(checkInfo.total) })}</span>
                    <button className="btn btn-gold btn-sm min-h-9" onClick={() => setModalCode(checkResult.code)}>{t('Bandlash')}</button>
                  </>}
                </div>
              )}
            </div>
          </Reveal>
          </div>

          {/* ===== O'NG USTUN: karta vizuali + statistika (faqat lg+ da haqiqiy 2-ustun; mobil/planshetda chapdan keyin oqim bo'ylab) ===== */}
          <div className="mt-10 flex flex-col items-center lg:mt-0 lg:items-stretch">
          {/* ===== Karta — qahramon (V1) ===== */}
          <Reveal delay="[transition-delay:160ms]" className="relative flex w-full justify-center overflow-visible lg:justify-self-center">
            <div className="hidden lg:block">
              <NeonOrbitCard code="AAA000" name={t('SIZNING ISMINGIZ')} />
            </div>
            <div className="relative lg:hidden">
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(212,175,90,0.22),transparent_68%)] blur-md"></div>
              <div className="relative rotate-[-3deg]">
                <NfcCard code="AAA000" name={t('SIZNING ISMINGIZ')} finish="showcase" size="md" />
              </div>
            </div>
          </Reveal>

          {/* Stats — faqat haqiqiy ko'rsatkichlar */}
          <Reveal delay="[transition-delay:320ms]" className="w-full">
            <div className="mx-auto mt-10 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-none lg:mt-8">
              <div className="vz-card--flat vz-card min-w-0 px-4 py-3">
                <div className="font-display text-2xl font-semibold text-[color:var(--vz-gold-2)]"><CountUp value={catalog.length} /></div>
                <div className="text-xs text-[color:var(--vz-ink-2)]">{t('Band qilingan')}</div>
              </div>
              <div className="vz-card--flat vz-card min-w-0 px-4 py-3">
                <div className="text-lg font-bold text-[color:var(--vz-ink)]">{t('Bitta havola')}</div>
                <div className="text-xs text-[color:var(--vz-ink-2)]">{t('Barcha kontaktlaringiz')}</div>
              </div>
              <div className="vz-card--flat vz-card min-w-0 px-4 py-3">
                <div className="text-lg font-bold text-[color:var(--vz-ink)]">{t('Tez ulashish')}</div>
                <div className="text-xs text-[color:var(--vz-ink-2)]">{t('NFC yoki havola orqali')}</div>
              </div>
            </div>
          </Reveal>
          </div>
        </div>

        {/* Marquee — so'nggi band qilingan ID'lar */}
        {recent.length > 0 && (
          <Reveal>
            <div className="overflow-hidden border-y border-[color:var(--vz-line)] bg-white/[0.02] py-3.5 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
              <div className="flex w-max animate-[marqueeScroll_26s_linear_infinite] gap-[34px]">
                {marqueeItems.map((it, i) => (
                  <span
                    key={it.code + i}
                    onClick={() => navigate('/' + it.code)}
                    className="cursor-pointer whitespace-nowrap font-mono text-[14px] tracking-wide text-[color:var(--vz-ink-3)] transition-colors hover:text-[color:var(--vz-gold-2)]"
                  >
                    nfcstore.uz/{it.code.toLowerCase()} · {it.name}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </section>

      {/* SAHIFA KENGLIGI — butun sayt bilan BIR XIL (2026-09).
          Ilgari asosiy sahifa yolg'iz o'zi tor edi: hero 1400px, tanasi
          1200px, ustidagi menyu va pastdagi footer esa 1800px. Katta
          ekranda kontent o'rtada qisilib, ikki yoni bo'sh qolardi va
          menyu bilan chetlari to'g'ri kelmasdi. Qolgan 20 ta sahifa
          allaqachon 1800px ishlatadi — endi bu ham shunday. */}
      <div className="mx-auto w-full max-w-[1800px] px-6 pb-20 sm:px-10 lg:px-14">
        {/* ================= KIMLAR UCHUN ================= */}
        <RevealSection id="kimlar-uchun">
          <h2 className="vz-h2 text-[color:var(--vz-ink)]">{t('Kimlar uchun')}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="vz-card flex min-w-0 flex-col p-6 sm:p-7">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(212,175,90,0.14)] text-[color:var(--vz-gold-2)]"><IconUser width="22" height="22" /></span>
              <h3 className="mt-4 text-xl font-bold text-[color:var(--vz-ink)]">{t('Jismoniy shaxs')}</h3>
              <p className="mt-2 max-w-[52ch] flex-1 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{t('Mutaxassis, tadbirkor, ijodkor — o‘z brendingiz uchun bitta havola.')}</p>
              <button onClick={() => navigate('/register')} className="btn btn-gold mt-5 self-start">{t('Shaxsiy profil ochish')}</button>
            </article>
            <article className="vz-card flex min-w-0 flex-col p-6 sm:p-7">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(212,175,90,0.14)] text-[color:var(--vz-gold-2)]"><IconBag width="22" height="22" /></span>
              <h3 className="mt-4 text-xl font-bold text-[color:var(--vz-ink)]">{t('Kompaniya')}</h3>
              <p className="mt-2 max-w-[52ch] flex-1 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{t('Menyu, katalog, xizmatlar, filiallar va jamoa — premium biznes profil.')}</p>
              <button onClick={() => navigate('/kompaniyalar')} className="btn btn-outline-gold mt-5 self-start">{t('Kompaniya profili ochish')}</button>
            </article>
          </div>
        </RevealSection>

        {/* ================= QANDAY ISHLAYDI ================= */}
        <RevealSection id="qanday-ishlaydi-qisqa">
          <h2 className="vz-h2 text-[color:var(--vz-ink)]">{t('Ulashish shunchalik oson.')}</h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{t('NFCSTORE — tanishuv va aloqa almashishning zamonaviy usuli.')}</p>
          <ol className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              ['01', 'Kartani yaqinlashtiring', 'NFC kartani telefonning orqa qismiga tuting.'],
              ['02', 'Profil ochiladi', 'Hech qanday ilova kerak emas — raqamli profil brauzerda ochiladi.'],
              ['03', 'Kontaktni saqlang', 'Ism, telefon va boshqa ma’lumotlar bir tugma orqali kontaktlarga qo‘shiladi.'],
            ].map(([n, title, desc]) => (
              <li key={n} className="vz-card min-w-0 p-5 sm:p-6">
                <div className="font-mono text-xs text-[color:var(--vz-gold-2)]">{n}</div>
                <h3 className="mt-3 text-lg font-bold text-[color:var(--vz-ink)]">{t(title)}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{t(desc)}</p>
              </li>
            ))}
          </ol>
        </RevealSection>

        {/* ============ JISMONIY NFC KARTA — dizayn va buyurtma ============ */}
        <RevealSection id="nfc-karta">
          <PhysicalCardCta />
        </RevealSection>

        {/* ================= TARIFLAR (haqiqiy narxlar: src/lib/pricing.js) ================= */}
        <RevealSection id="tariflar">
          <h2 className="vz-h2 text-[color:var(--vz-ink)]">{t('Tariflar')}</h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{t("NFC ID narxi faqat undagi harf/raqam naqshiga bog'liq — qat'iy va o'zgarmas.")}</p>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <article className="vz-card flex min-w-0 flex-col p-6">
              <h3 className="text-lg font-bold text-[color:var(--vz-ink)]">{t('Bepul profil')}</h3>
              <div className="mt-3 font-display text-3xl font-semibold text-[color:var(--vz-ink)]">0 <small className="font-sans text-sm font-normal text-[color:var(--vz-ink-2)]">{t("so'm")}</small></div>
              <ul className="mt-4 flex-1 space-y-2 text-[15px] text-[color:var(--vz-ink-2)]">
                {['Raqamli profil (8 xonali avtomatik ID)', 'Aloqa tugmalari', 'vCard (.VCF) saqlash'].map((x) => (
                  <li key={x} className="flex items-start gap-2"><IconCheck width="16" height="16" className="mt-0.5 shrink-0 text-[color:var(--vz-gold)]" />{t(x)}</li>
                ))}
              </ul>
              <button onClick={() => navigate('/register')} className="btn btn-outline-gold mt-5">{t('Boshlash')}</button>
            </article>
            <article className="vz-card relative flex min-w-0 flex-col border-[rgba(212,175,90,0.45)] p-6">
              <span className="vz-badge vz-badge--gold absolute -top-3 left-6">{t('Mashhur')}</span>
              <h3 className="text-lg font-bold text-[color:var(--vz-ink)]">{t('Maxsus NFC ID')}</h3>
              <div className="mt-3 font-display text-3xl font-semibold text-[color:var(--vz-gold-2)]">{fmt(TIER_PRICE.free)} <small className="font-sans text-sm font-normal text-[color:var(--vz-ink-2)]">{t("so'mdan")}</small></div>
              <ul className="mt-4 flex-1 space-y-2 text-[15px] text-[color:var(--vz-ink-2)]">
                {['free', 'silver', 'gold', 'premium'].map((k) => (
                  <li key={k} className="flex items-start justify-between gap-2"><span>{t(TIER_LABEL[k])}</span><span className="font-mono text-[color:var(--vz-ink)]">{fmt(TIER_PRICE[k])}</span></li>
                ))}
                <li className="flex items-start justify-between gap-2"><span>{t('Ekslyuziv')}</span><span className="text-[color:var(--vz-gold-2)]">{t('Auksion')}</span></li>
              </ul>
              <button onClick={() => navigate('/narxlar')} className="btn btn-gold mt-5">{t("Narxlarni ko'rish")}</button>
            </article>
            <article className="vz-card flex min-w-0 flex-col p-6">
              <h3 className="text-lg font-bold text-[color:var(--vz-ink)]">{t('Premium profil')}</h3>
              <div className="mt-3 font-display text-3xl font-semibold text-[color:var(--vz-ink)]">{fmt(PROFILE_PREMIUM_FEE)} <small className="font-sans text-sm font-normal text-[color:var(--vz-ink-2)]">{t("so'm")}</small></div>
              <ul className="mt-4 flex-1 space-y-2 text-[15px] text-[color:var(--vz-ink-2)]">
                {['Oltin belgi', 'Fon rasm va musiqa', 'Kengaytirilgan statistika'].map((x) => (
                  <li key={x} className="flex items-start gap-2"><IconCheck width="16" height="16" className="mt-0.5 shrink-0 text-[color:var(--vz-gold)]" />{t(x)}</li>
                ))}
              </ul>
              <button onClick={() => navigate('/narxlar')} className="btn btn-outline-gold mt-5">{t('Batafsil')}</button>
            </article>
          </div>
        </RevealSection>

        {/* ================= ISHONCH (faqat faktlar) ================= */}
        <RevealSection id="ishonch">
          <h2 className="vz-h2 text-[color:var(--vz-ink)]">{t('Ishonch')}</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {[
              [IconGlobe, 'Cloudflare', 'Global tarmoq — sahifa dunyoning istalgan nuqtasidan tez ochiladi.'],
              [IconBolt, 'Payme', paymentsEnabled ? 'Rasmiy to‘lov integratsiyasi.' : 'To‘lov integratsiyasi tayyorlanmoqda.'],
              [IconShield, "O'zbekiston", 'Mahalliy qo‘llab-quvvatlash — savollaringizga o‘zbek tilida javob beramiz.'],
            ].map(([Ic, h, p]) => (
              <div key={h} className="vz-panel flex min-w-0 items-start gap-3 p-5">
                <span className="mt-0.5 shrink-0 text-[color:var(--vz-gold-2)]"><Ic width="22" height="22" /></span>
                <div className="min-w-0">
                  <b className="block text-[color:var(--vz-ink)]">{h}</b>
                  <span className="text-sm text-[color:var(--vz-ink-2)]">{t(p)}</span>
                </div>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* ================= FAQ ================= */}
        <RevealSection id="faq">
          <h2 className="vz-h2 text-[color:var(--vz-ink)]">{t('Ko‘p so‘raladigan savollar')}</h2>
          <div className="mt-7 flex flex-col gap-3">
            {faqItems.map((item, i) => (
              <details key={i} className="vz-card group p-0" open={i === 0}>
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3.5 text-[15px] font-bold text-[color:var(--vz-ink)] [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 break-words">{item.q}</span>
                  <span className="shrink-0 text-[color:var(--vz-gold-2)] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{item.a}</p>
              </details>
            ))}
          </div>
          <button onClick={() => navigate('/savollar')} className="btn btn-ghost-vz mt-5">{t('Barcha savollar')}</button>
        </RevealSection>

        {/* ================= SAYT BO'YLAB ================= */}
        <RevealSection id="sahifalar">
          <h2 className="vz-h2 text-[color:var(--vz-ink)]">{t("Sayt bo'ylab")}</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEASERS.map((item) => (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className="vz-card group min-w-0 cursor-pointer p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[rgba(212,175,90,0.5)]"
              >
                <h3 className="font-semibold text-[color:var(--vz-ink)]">{t(item.title)}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{t(item.desc)}</p>
                <span className="mt-4 inline-block text-sm text-[color:var(--vz-gold-2)] transition-transform group-hover:translate-x-1">{t(item.go)}</span>
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
