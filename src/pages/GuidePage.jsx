import { useMemo, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import { GUIDES, GUIDE_TABS, GUIDE_CATEGORIES, PRICING_OVERVIEW } from '../lib/guides.js';
import GuideCard from '../components/guides/GuideCard.jsx';
import GuideViewer from '../components/guides/GuideViewer.jsx';

// /qollanma — NFCSTORE o'quv markazi. TO'LIQ frontend-only: hech qanday
// D1/Worker/R2 chaqiruvi yo'q, kontent src/lib/guides.js'dagi structured
// datadan olinadi. Mavjud auth/profil/auksion/pricing logikasiga hech
// qanday yozuv/ta'sir yo'q — faqat tayyor TIER_PRICE/TIER_LABEL'ni
// (pricing.js) o'qib ko'rsatadi.
export default function GuidePage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('shaxsiy');
  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null); // ochiq GuideViewer uchun tanlangan dars

  const visibleByTab = useMemo(
    () => GUIDES.filter((g) => g.tab === tab || g.tab === 'both'),
    [tab],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return visibleByTab
      .filter((g) => category === 'all' || g.category === category)
      .filter((g) => !query || g.title.toLowerCase().includes(query) || g.description.toLowerCase().includes(query))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [visibleByTab, category, q]);

  return (
    <main className="qollanma-page mx-auto w-full max-w-[1800px] px-6 pb-20 sm:px-10 lg:px-14">
      <section className="pt-14 text-center">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          {t('Qo‘llanma')}
        </span>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight">
          {t("NFCSTORE'dan foydalanishni")} <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">{t('o‘rganing')}</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-base-content/60">
          {t("Profil yaratishdan NFC kartadan foydalanishgacha — barcha imkoniyatlarni bosqichma-bosqich o'rganing.")}
        </p>

        <div className="mx-auto mt-6 flex max-w-md items-center rounded-lg border border-white/15 bg-black/40 focus-within:border-base-content/40">
          <span className="shrink-0 pl-3 text-base-content/40">{'🔎'}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Qaysi mavzu bo‘yicha yordam kerak?')}
            autoComplete="off"
            className="w-full bg-transparent px-2 py-3 text-sm outline-none"
          />
        </div>

        <div className="mx-auto mt-6 flex w-fit gap-1 rounded-full border border-white/10 bg-base-200/60 p-1">
          {GUIDE_TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === tb.id ? 'bg-accent text-accent-content' : 'text-base-content/60 hover:text-base-content'}`}
            >
              {t(tb.label)}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8 flex flex-wrap justify-center gap-1.5">
        {GUIDE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${category === c.id ? 'border-accent bg-accent/10 text-accent' : 'border-white/12 text-base-content/60 hover:border-white/25'}`}
          >
            {t(c.label)}
          </button>
        ))}
      </section>

      {category === 'tariflar' && (
        <section className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/10 bg-base-200/50 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-base-content/50">{t('Joriy tariflar')}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PRICING_OVERVIEW.map((p) => (
              <div key={p.key} className="rounded-xl border border-white/10 bg-base-100/40 p-3 text-center">
                <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: p.color }}>{t(p.label)}</div>
                <div className="mt-1 text-sm font-extrabold">
                  {p.price == null ? t('Auksion') : `${fmt(p.price)} ${t("so'm")}`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="qollanma-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 && (
            <div className="col-span-full py-10 text-center text-base-content/45">{t('Hech narsa topilmadi.')}</div>
          )}
          {filtered.map((g) => (
            <GuideCard key={g.id} guide={g} onOpen={setActive} />
          ))}
        </div>
      </section>

      {active && <GuideViewer guide={active} onClose={() => setActive(null)} />}
    </main>
  );
}
