import { useEffect, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { APP_PAGE_PATH } from '../lib/appDownload.js';
import { NEWS_ENABLED } from '../lib/features.js';
import { PhoneShot } from './PhoneShot.jsx';

// BOSH SAHIFA — "NFCSTORE'DA YANGI" (egasi, 2026-09-26).
//
// "Saytning asosiy qismida ko'rinsin: stiker va boshqa narsalar, o'sha
// bo'limga o'tish yozuvi bilan. Zo'r qil, bachkana bo'lib ketmasin."
//
// Uch plitka: ilova (haqiqiy ekranlar), NFC stikerlar (haqiqiy dizayn)
// va so'nggi yangiliklar (/api/news dan jonli). Ilova va stikerlar
// plitkasi har ikki mavzuda ham qora-oltin — brend vitrinasi; emoji va
// qichqiriq yo'q, faqat sarlavha, bir jumla va aniq havola.

const CONTENT = {
  uz: {
    kicker: 'NFCSTORE’da yangi',
    title: 'Ilova, stikerlar va yangiliklar',
    appTag: 'Ilova · Android',
    appT: 'NFCSTORE endi telefoningizda',
    appP: 'Istalgan NFC karta va stikerni bir tegishda bog‘lang, shaxsiy va biznes profilni boshqaring.',
    appGo: 'Ilovani ko‘rish',
    appSoon: 'App Store — tez kunda',
    stTag: 'Yangi · NFC stikerlar',
    stT: 'Do‘koningiz yopiq bo‘lsa ham ochiq',
    stP: 'Eshik, vitrina yoki mashina oynasiga bitta stiker — narxlar, katalog va Telegram bir tegishda.',
    stGo: 'Stikerlarni ko‘rish',
    newsTag: 'Yangiliklar',
    newsGo: 'Barcha yangiliklar',
  },
  ru: {
    kicker: 'Новое в NFCSTORE',
    title: 'Приложение, наклейки и новости',
    appTag: 'Приложение · Android',
    appT: 'NFCSTORE теперь в вашем телефоне',
    appP: 'Привязывайте любые NFC-карты и наклейки в одно касание, управляйте личным и бизнес-профилем.',
    appGo: 'О приложении',
    appSoon: 'App Store — скоро',
    stTag: 'Новинка · NFC-наклейки',
    stT: 'Ваш магазин открыт, даже когда закрыт',
    stP: 'Одна наклейка на дверь, витрину или стекло машины — цены, каталог и Telegram в одно касание.',
    stGo: 'Смотреть наклейки',
    newsTag: 'Новости',
    newsGo: 'Все новости',
  },
  en: {
    kicker: 'New at NFCSTORE',
    title: 'App, stickers and news',
    appTag: 'App · Android',
    appT: 'NFCSTORE is now on your phone',
    appP: 'Link any NFC card or sticker in one tap and manage your personal and business profiles.',
    appGo: 'See the app',
    appSoon: 'App Store — coming soon',
    stTag: 'New · NFC stickers',
    stT: 'Your shop is open, even when it’s closed',
    stP: 'One sticker on the door, window or car glass — prices, catalog and Telegram in one tap.',
    stGo: 'See stickers',
    newsTag: 'News',
    newsGo: 'All news',
  },
};

function pick(item, base, lang) {
  const suffix = lang === 'ru' ? 'Ru' : lang === 'en' ? 'En' : '';
  if (!suffix) return item[base] || '';
  return (item[base + suffix] || '').trim() || item[base] || '';
}

// Oy nomlari qo'lda: brauzerlarda `uz-UZ` oylari yo'q ("M09 9" chiqadi).
const MONTHS = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
function fmtDate(value, lang) {
  // Server: "2026-09-26 07:31:00.000+00" yoki ISO "…Z".
  const d = new Date(String(value || '').trim().replace(' ', 'T').replace(/\+00$/, 'Z'));
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const m = (MONTHS[lang] || MONTHS.uz)[d.getMonth()];
  return lang === 'uz' || !MONTHS[lang] ? `${day}-${m}` : `${day} ${m}`;
}

function useLatestNews(limit = 3) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (!NEWS_ENABLED) return undefined;
    let alive = true;
    fetch('/api/news')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setItems((d?.news || []).slice(0, limit)); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [limit]);
  return items;
}

const Arrow = () => <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>;

// Qora-oltin vitrina plitkasi (ikkala mavzuda bir xil).
const SHOWCASE = 'group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-[var(--vz-radius)] border border-[#d6b25e]/25 bg-[radial-gradient(120%_90%_at_85%_20%,rgba(214,178,94,.16),transparent_55%),linear-gradient(160deg,#171613,#0a0a09_65%)] text-left text-[#f4efe4] shadow-[0_30px_60px_-35px_rgba(0,0,0,.8)] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[#d6b25e]/55';
const TAG = 'font-mono text-[11px] font-bold uppercase tracking-[.22em] text-[#e4c97a]';
const GO = 'mt-auto inline-flex items-center gap-2 pt-6 text-[15px] font-semibold text-[#e4c97a]';

export default function HomeWhatsNew() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.uz;
  const news = useLatestNews(3);
  // Oddiy havola (qidiruv tizimi va "yangi oynada ochish" ishlaydi),
  // bosilganda esa sahifa qayta yuklanmaydi.
  const go = (path) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault(); navigate(path);
  };

  return (
    <section id="yangi" className="mt-16 md:mt-20">
      <span className="vz-kicker">{c.kicker}</span>
      <h2 className="vz-h2 mt-3 text-[color:var(--vz-ink)]">{c.title}</h2>

      <div className="mt-8 grid gap-4 lg:grid-cols-12">
        {/* ── ILOVA ── */}
        <a href={APP_PAGE_PATH} onClick={go(APP_PAGE_PATH)} className={`${SHOWCASE} no-underline lg:col-span-7 lg:row-span-2`} data-testid="home-new-app">
          <div className="relative z-[1] flex h-full flex-col p-6 sm:p-8 md:max-w-[52%] md:pb-8">
            <span className={TAG}>{c.appTag}</span>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.1] sm:text-[38px]">{c.appT}</h3>
            <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-[#f4efe4]/75">{c.appP}</p>
            <span className="mt-4 text-[13px] text-[#f4efe4]/55">{c.appSoon}</span>
            <span className={GO}>{c.appGo} <Arrow /></span>
          </div>
          {/* Telefonlar plitkaning pastki chetidan chiqib turadi (kesiladi) —
              kichik ekranda matn ostida, kattada o'ng tomonda. */}
          <div className="pointer-events-none relative mt-2 h-[300px] sm:h-[400px] md:absolute md:bottom-0 md:right-[3%] md:mb-0 md:mt-0 md:h-[92%] md:w-[50%]">
            <PhoneShot src="/ilova/nfc.jpg" className="absolute left-[4%] top-[12%] w-[50%] max-w-[250px] transition-transform duration-500 group-hover:-translate-y-2 md:bottom-[-22%] md:left-[-6%] md:top-auto md:w-[56%] md:max-w-[280px]" />
            <PhoneShot src="/ilova/start.jpg" className="absolute right-[4%] top-0 z-[1] w-[54%] max-w-[270px] transition-transform duration-500 group-hover:-translate-y-3 md:bottom-[-10%] md:right-0 md:top-auto md:w-[64%] md:max-w-[310px]" />
          </div>
        </a>

        {/* ── STIKERLAR ── */}
        <a href="/stikerlar" onClick={go('/stikerlar')} className={`${SHOWCASE} no-underline lg:col-span-5`} data-testid="home-new-stickers">
          <div className="grid h-full grid-cols-[1fr_auto] gap-5 p-6 sm:p-7">
            <div className="flex min-w-0 flex-col">
              <span className={TAG}>{c.stTag}</span>
              <h3 className="mt-4 font-[family-name:var(--font-display)] text-[24px] font-semibold leading-[1.15] sm:text-[27px]">{c.stT}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#f4efe4]/75">{c.stP}</p>
              <span className={GO}>{c.stGo} <Arrow /></span>
            </div>
            <div className="relative w-[112px] self-center sm:w-[150px]">
              <img src="/stikerlar/tashqi.png" alt="" loading="lazy" className="w-full drop-shadow-[0_18px_30px_rgba(0,0,0,.7)] transition-transform duration-500 group-hover:-rotate-2" />
              <img src="/stikerlar/oyna.png" alt="" loading="lazy" className="absolute -bottom-5 -left-6 w-[62%] drop-shadow-[0_14px_24px_rgba(0,0,0,.7)]" />
            </div>
          </div>
        </a>

        {/* ── YANGILIKLAR ── */}
        {NEWS_ENABLED && (
          <div className="vz-card flex min-w-0 flex-col p-6 sm:p-7 lg:col-span-5" data-testid="home-new-news">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-[color:var(--accent-text)]">{c.newsTag}</span>
            <ul className="mt-3 divide-y divide-[color:var(--vz-line)]">
              {(news || [null, null, null]).map((n, i) => (
                <li key={n ? n.id : `s${i}`}>
                  {n ? (
                    <a
                      href={`/yangiliklar/${n.id}`}
                      onClick={go(`/yangiliklar/${n.id}`)}
                      className="group flex items-center gap-4 py-3 no-underline"
                    >
                      {n.imageUrl && <img src={n.imageUrl} alt="" loading="lazy" className="h-12 w-[72px] shrink-0 rounded-lg object-cover" />}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-[color:var(--vz-ink)] group-hover:text-[color:var(--accent-text)]">{pick(n, 'title', lang)}</span>
                        <span className="mt-0.5 block text-[12px] text-[color:var(--vz-ink-2)]">{fmtDate(n.createdAt, lang)}</span>
                      </span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 py-3"><div className="vz-skel h-12 w-[72px] rounded-lg" /><div className="vz-skel h-4 flex-1 rounded" /></div>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => navigate('/yangiliklar')} className="group mt-auto inline-flex items-center gap-2 self-start pt-4 text-[15px] font-semibold text-[color:var(--accent-text)]">{c.newsGo} <Arrow /></button>
          </div>
        )}
      </div>
    </section>
  );
}
