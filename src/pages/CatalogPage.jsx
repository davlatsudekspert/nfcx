import { useState } from 'react';
import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { useCategories, catName, findCat, catPath } from '../lib/categories.js';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';

const TYPE_TABS = [
  ['all', 'Hammasi'],
  ['personal', 'Shaxsiy'],
  ['expert', 'Ekspert'],
  ['business', 'Biznes'],
];

export default function CatalogPage({ catalog }) {
  const { t, lang } = useLanguage();
  const cats = useCategories();
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const [type, setType] = useState('all');
  const [mainCat, setMainCat] = useState('');
  const [subCat, setSubCat] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const query = q.trim().toUpperCase();
  const activeCat = subCat || mainCat;
  const subs = cats.filter((c) => c.parentSlug === mainCat);
  const anyFilter = type !== 'all' || !!activeCat;

  const filtered = [...catalog]
    .sort((a, b) => b.ts - a.ts)
    .filter((it) => {
      if (query && !(
        it.code.includes(query)
        || (it.name || '').toUpperCase().includes(query)
        || (it.role || '').toUpperCase().includes(query)
        || (it.city || '').toUpperCase().includes(query)
        || (it.hashtags || []).some((h) => String(h).toUpperCase().includes(query))
      )) return false;
      if (type !== 'all' && (it.profileType || 'personal') !== type) return false;
      if (subCat) {
        if (it.categorySlug !== subCat) return false;
      } else if (mainCat) {
        const c = findCat(cats, it.categorySlug);
        const itMain = c ? (c.parentSlug || c.slug) : it.categorySlug;
        if (itMain !== mainCat) return false;
      }
      return true;
    });

  const cardCls = 'cursor-pointer rounded-2xl border border-white/10 bg-base-200/60 p-5 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-base-200';

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="grid items-center gap-10 pt-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70"><span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>{t('Katalog')}</span>
          <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">{t('Barcha band qilingan')} <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">{t("raqamli tashrif qog'ozlar")}</span></h1>
          <p className="mt-3 text-[15px] text-base-content/60">{t("Jami {n} ta raqamli tashrif qog'ozi band qilingan. Kod yoki ism bo'yicha qidiring.", { n: fmt(catalog.length) })}</p>
          <div className="mt-6 flex max-w-md items-center rounded-lg border border-white/15 bg-black/40 focus-within:border-base-content/40">
            <span className="shrink-0 pl-3 font-mono text-xs text-base-content/40">{t('qidirish')}</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ABZ007 yoki ism...')} autoComplete="off" className="w-full bg-transparent px-2 py-3 text-sm outline-none" />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {TYPE_TABS.map(([id, label]) => (
              <button key={id} onClick={() => setType(id)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${type === id ? 'border-accent bg-accent/10 text-accent' : 'border-white/12 text-base-content/60 hover:border-white/25'}`}>
                {t(label)}
              </button>
            ))}
            {cats.length > 0 && (
              <button onClick={() => setShowFilters((s) => !s)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${activeCat || showFilters ? 'border-accent/60 text-accent' : 'border-white/12 text-base-content/60 hover:border-white/25'}`}>
                {activeCat ? catName(findCat(cats, activeCat), lang) : t('Faoliyat sohasi')} ▾
              </button>
            )}
          </div>

          {showFilters && cats.length > 0 && (
            <div className="mt-3 grid max-w-md gap-2 rounded-xl border border-white/10 bg-base-200/50 p-3 sm:grid-cols-2">
              <select value={mainCat} onChange={(e) => { setMainCat(e.target.value); setSubCat(''); }}
                className="select select-bordered select-sm w-full bg-base-100">
                <option value="">{t('Barcha sohalar')}</option>
                {cats.filter((c) => !c.parentSlug).map((c) => (
                  <option key={c.slug} value={c.slug}>{catName(c, lang)}</option>
                ))}
              </select>
              {subs.length > 0 && (
                <select value={subCat} onChange={(e) => setSubCat(e.target.value)}
                  className="select select-bordered select-sm w-full bg-base-100">
                  <option value="">{t('Barcha kichik sohalar')}</option>
                  {subs.map((c) => (<option key={c.slug} value={c.slug}>{catName(c, lang)}</option>))}
                </select>
              )}
              {anyFilter && (
                <button onClick={() => { setType('all'); setMainCat(''); setSubCat(''); }}
                  className="btn btn-ghost btn-xs sm:col-span-2">{t('Filtrlarni tozalash')}</button>
              )}
            </div>
          )}
        </div>
        <div className="hidden justify-self-center lg:flex">
          <Interactive3DCard><NfcCard code={filtered[0]?.code || 'AAA000'} name={filtered[0]?.name?.toUpperCase() || t('SIZNING ISMINGIZ')} finish="showcase" size="lg" /></Interactive3DCard>
        </div>
      </section>
      <section className="mt-16">
        <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">Live</div>
        <h2 className="mt-2 text-2xl font-bold">{t("Barcha raqamli tashrif qog'ozlar")} <span className="text-base font-normal text-base-content/40">({fmt(filtered.length)})</span></h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 && <div className="col-span-full py-10 text-center text-base-content/45">{t('Hech narsa topilmadi.')}</div>}
          {filtered.map((it) => {
            const cp = catPath(cats, it.categorySlug, lang);
            return (
              <button key={it.code} className={`${cardCls} text-left`} onClick={() => navigate('/' + it.code)}>
                <div className="font-mono text-sm font-bold tracking-wide">nfcstore.uz/{it.code.toLowerCase()}</div>
                <div className="mt-1 flex items-center gap-1 truncate text-[13px] text-base-content/55">
                  <span className="truncate">{it.name}{it.tg ? ' · ' + it.tg : ''}</span>
                  {it.verified && <span title={t('Tasdiqlangan')} className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-[9px] font-black text-white">✓</span>}
                </div>
                {(cp || it.city) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-base-content/45">
                    {cp && <span className="rounded-full border border-white/10 px-2 py-0.5">{cp}</span>}
                    {it.city && <span className="rounded-full border border-white/10 px-2 py-0.5">{'\u{1F4CD}'} {it.city}</span>}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 text-sm text-base-content/75">{t("{n} so'm", { n: fmt(it.price) })} · {timeAgo(it.ts)}</div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
