import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';

// SAHIFA TOPILMADI (404) — 2026-10.
//
// Ilgari noma'lum manzil (/biror-narsa/xyz) jimgina bosh sahifani 200 bilan
// ko'rsatardi ("soft 404"): qidiruv tizimi har bir xato havolani bosh
// sahifaning nusxasi deb indekslardi, odam esa havola buzuqligini
// bilmasdi. Worker bunday manzilga 404 + `noindex` qaytaradi
// (hosting/api/seo-routes.js classifySpaPath), bu sahifa esa odamga aytadi.
// SEO (sarlavha, `noindex`) — App.jsx dagi SeoSync ('notfound' kaliti).
// Matn tilga qarab tanlanadi (SupportPage kabi) — lug'atga kalit shart emas.

const CONTENT = {
  uz: {
    code: '404',
    title: 'Sahifa topilmadi',
    text: 'Bu manzilda sahifa yo‘q. Havola eskirgan yoki xato yozilgan bo‘lishi mumkin.',
    home: 'Bosh sahifa',
    catalog: 'Katalog',
    support: 'Yordam',
  },
  ru: {
    code: '404',
    title: 'Страница не найдена',
    text: 'По этому адресу страницы нет. Возможно, ссылка устарела или набрана с ошибкой.',
    home: 'На главную',
    catalog: 'Каталог',
    support: 'Поддержка',
  },
  en: {
    code: '404',
    title: 'Page not found',
    text: 'There is no page at this address. The link may be outdated or mistyped.',
    home: 'Home page',
    catalog: 'Catalog',
    support: 'Support',
  },
};

function go(e, href) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  navigate(href);
}

export default function NotFoundPage() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.uz;
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[1800px] flex-col items-center justify-center px-4 py-16 text-center sm:px-10">
      <span className="vz-kicker">{c.code}</span>
      <h1 className="vz-h1 mt-3">{c.title}</h1>
      <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-base-content/70">{c.text}</p>
      <nav className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a href="/" onClick={(e) => go(e, '/')} className="btn btn-primary min-h-11 rounded-full px-6 no-underline">{c.home}</a>
        <a href="/katalog" onClick={(e) => go(e, '/katalog')} className="btn btn-outline min-h-11 rounded-full px-6 no-underline">{c.catalog}</a>
        <a href="/support" onClick={(e) => go(e, '/support')} className="btn btn-ghost min-h-11 rounded-full px-6 no-underline">{c.support}</a>
      </nav>
    </main>
  );
}
