import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { PhoneShot } from './PhoneShot.jsx';

// ILOVA SKRINSHOTLARI — SAHIFA AYLANTIRILGANDA ALMASHADI (egasi, 2026-11).
//
// Telefon ekranda "yopishib" turadi (sticky); aylantirgan sari ichidagi
// skrinshot uchib chiqib almashadi, yonida mos matn paydo bo'ladi.
// Faqat HAQIQIY ilova skrinshotlari (public/ilova) — soxta raqam yo'q.
// Kutubxonasiz: scroll + CSS transform. Animatsiyani kamaytirish yoqilgan
// qurilmada almashish oniy (transition yo'q).
const SHOTS = [
  '/ilova/start.jpg',
  '/ilova/nfc.jpg',
  '/ilova/tanlov.jpg',
  '/ilova/profil.jpg',
];

const CONTENT = {
  uz: {
    kicker: 'Ilovada',
    title: 'Aylantiring — ilova ko‘z oldingizda',
    steps: [
      ['Bir tegishda tanishuv', 'Telefonni NFC kartaga tekkizing — qarshingizdagi odamda profilingiz ochiladi.'],
      ['NFC markazi', 'Istalgan NFC karta yoki stikerga profilingizni ilovaning o‘zi yozadi.'],
      ['Tanlov: odamlar va bizneslar', 'Mutaxassislar, bizneslar va mahsulotlarni bir joyda qidiring.'],
      ['Sizning profilingiz', 'Aloqa tugmalari, havolalar va portfolio — bitta sahifada.'],
    ],
  },
  ru: {
    kicker: 'В приложении',
    title: 'Листайте — приложение перед глазами',
    steps: [
      ['Знакомство в одно касание', 'Поднесите телефон к NFC-карте — у собеседника откроется ваш профиль.'],
      ['NFC-центр', 'Профиль на любую NFC-карту или стикер записывает само приложение.'],
      ['Выбор: люди и компании', 'Ищите специалистов, компании и товары в одном месте.'],
      ['Ваш профиль', 'Кнопки связи, ссылки и портфолио — на одной странице.'],
    ],
  },
  en: {
    kicker: 'In the app',
    title: 'Scroll — see the app in action',
    steps: [
      ['Meet in one tap', 'Tap your phone on an NFC card — your profile opens for the person in front of you.'],
      ['NFC Center', 'The app itself writes your profile to any NFC card or sticker.'],
      ['Discover: people and businesses', 'Find specialists, businesses and products in one place.'],
      ['Your profile', 'Contact buttons, links and portfolio — on a single page.'],
    ],
  },
};

export default function ScrollShowcase() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.uz;
  const ref = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      if (total <= 0) return;
      const p = Math.min(0.999, Math.max(0, -r.top / total));
      setActive(Math.floor(p * SHOTS.length));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      ref={ref}
      data-testid="scroll-showcase"
      aria-label={c.title}
      className="relative mt-16 md:mt-24"
      style={{ height: `${SHOTS.length * 85}vh` }}
    >
      <div className="sticky top-0 flex h-screen items-center pt-16 md:pt-20">
        <div className="mx-auto grid w-full max-w-[1100px] items-center gap-6 px-1 md:grid-cols-2 md:gap-14">
          <div className="order-2 md:order-1">
            <span className="vz-kicker">{c.kicker}</span>
            <h2 className="vz-h2 mt-3 text-[color:var(--vz-ink)]">{c.title}</h2>
            <ol className="mt-6 space-y-3 md:mt-8 md:space-y-4">
              {c.steps.map(([head, body], i) => (
                <li
                  key={head}
                  className={`border-l-2 pl-4 transition-all duration-500 motion-reduce:transition-none ${
                    i === active
                      ? 'border-[color:var(--vz-gold)] opacity-100'
                      : 'border-[color:var(--vz-line)] opacity-40'
                  }`}
                >
                  <h3 className="text-base font-bold text-[color:var(--vz-ink)] md:text-lg">{head}</h3>
                  <p className={`mt-1 max-w-[46ch] text-[14px] leading-relaxed text-[color:var(--vz-ink-2)] transition-all duration-500 motion-reduce:transition-none md:text-[15px] ${i === active ? 'max-h-24 opacity-100' : 'max-h-0 overflow-hidden opacity-0 md:max-h-24 md:opacity-100'}`}>
                    {body}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="relative order-1 mx-auto h-[38vh] w-full max-w-[320px] [--ph:38vh] md:order-2 md:h-[66vh] md:[--ph:66vh]">
            {SHOTS.map((src, i) => {
              const state = i === active ? 'in' : i < active ? 'out' : 'next';
              const transform = state === 'in'
                ? 'translate3d(0,0,0) rotate(0deg) scale(1)'
                : state === 'out'
                  ? 'translate3d(-38%,-8%,0) rotate(-9deg) scale(.82)'
                  : 'translate3d(38%,10%,0) rotate(9deg) scale(.82)';
              return (
                <div
                  key={src}
                  aria-hidden={state !== 'in'}
                  className="absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none"
                  style={{ transform, opacity: state === 'in' ? 1 : 0, willChange: 'transform, opacity' }}
                >
                  <PhoneShot src={src} alt={c.steps[i][0]} eager={i === 0} className="w-[min(100%,calc(var(--ph)*0.54))]" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
