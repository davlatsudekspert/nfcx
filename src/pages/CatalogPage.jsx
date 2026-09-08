import { useEffect, useState } from 'react';
import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { dbSearchRecords } from '../lib/db.js';
import { useCategories, catName, findCat, catPath } from '../lib/categories.js';
import NfcCard from '../components/NfcCard.jsx';
import PhysicalCardPromoCard from '../components/PhysicalCardPromoCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';
import { IconEye } from '../components/Icons.jsx';
import { tierForCode, TIER_COLOR, TIER_LABEL, TIER_EMOJI } from '../lib/pricing.js';

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
  // Saralash. Sahifa ochilganda BIRINCHI bo'lib eng ko'p ko'rilganlar
  // turadi; foydalanuvchi bir bosishda "Yangilar" yoki "Qimmatlar" ga
  // o'tishi mumkin (aks holda yangi qo'shilgan profillar 0 ko'rish bilan
  // doim pastda qolib ketardi).
  const [sort, setSort] = useState('views');
  const [serverHits, setServerHits] = useState([]);

  // Serverда qidiruv (email/telefon bo'yicha ham) — 2+ belgi, debounce.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setServerHits([]); return; }
    const id = setTimeout(() => { dbSearchRecords(term).then(setServerHits).catch(() => setServerHits([])); }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const query = q.trim().toUpperCase();
  const activeCat = subCat || mainCat;
  const subs = cats.filter((c) => c.parentSlug === mainCat);
  const anyFilter = type !== 'all' || !!activeCat;

  // Katalog + serverда topilganlar (kod bo'yicha dedupe).
  const serverCodes = new Set(serverHits.map((r) => r.code));
  const source = [...catalog];
  for (const r of serverHits) if (!source.some((m) => m.code === r.code)) source.push(r);

  const SORTERS = {
    views: (a, b) => (b.views || 0) - (a.views || 0) || b.ts - a.ts,
    new: (a, b) => b.ts - a.ts,
    price: (a, b) => (b.price || 0) - (a.price || 0) || b.ts - a.ts,
  };
  const filtered = source
    .sort(SORTERS[sort] || SORTERS.views)
    .filter((it) => {
      if (query) {
        const clientMatch = it.code.includes(query)
          || (it.name || '').toUpperCase().includes(query)
          || (it.role || '').toUpperCase().includes(query)
          || (it.city || '').toUpperCase().includes(query)
          || (it.hashtags || []).some((h) => String(h).toUpperCase().includes(query));
        // Serverда topilган (masalan email bo'yicha) — mijoz matni mos
        // kelmasa ham ko'rsatamiz.
        if (!clientMatch && !serverCodes.has(it.code)) return false;
      }
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

  // NFC ID darajasiga qarab katalog kartasining rangi (chegara + burchak nuri).
  // tierOverride serverdan keladi (admin qo'lda belgilagan tarif), bo'lmasa
  // kod naqshi bo'yicha hisoblanadi. VIP001 → exclusive → tilla ohang, va h.k.
  const tierOf = (it) => it.tierOverride || tierForCode(it.code);

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="grid items-center gap-10 pt-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="vz-kicker">{t('Katalog')}</span>
          <h1 className="vz-h1 mt-4 max-w-3xl">{t('Barcha band qilingan')} <span className="text-[var(--vz-gold-2)]">{t("raqamli tashrif qog'ozlar")}</span></h1>
          <p className="vz-lead mt-3">{t("Jami {n} ta raqamli tashrif qog'ozi band qilingan. Kod yoki ism bo'yicha qidiring.", { n: fmt(catalog.length) })}</p>
          <div className="mt-6 flex max-w-md items-center rounded-lg border border-white/15 bg-black/40 focus-within:border-[var(--vz-gold)]">
            <span className="shrink-0 pl-3 font-mono text-xs text-base-content/40">{t('qidirish')}</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ABZ007 yoki ism...')} autoComplete="off" aria-label={t('qidirish')} className="min-h-11 w-full min-w-0 bg-transparent px-2 py-3 text-sm outline-none" />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {TYPE_TABS.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setType(id)} aria-pressed={type === id}
                className={`min-h-11 rounded-full border px-3.5 py-1.5 text-[16px] font-semibold transition ${type === id ? 'border-accent bg-accent/10 text-accent' : 'border-white/12 text-base-content/60 hover:border-white/25'}`}>
                {t(label)}
              </button>
            ))}
            {cats.length > 0 && (
              <button type="button" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}
                className={`min-h-11 rounded-full border px-3.5 py-1.5 text-[16px] font-semibold transition ${activeCat || showFilters ? 'border-accent/60 text-accent' : 'border-white/12 text-base-content/60 hover:border-white/25'}`}>
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
                <button type="button" onClick={() => { setType('all'); setMainCat(''); setSubCat(''); }}
                  className="btn btn-ghost-vz btn-sm sm:col-span-2">{t('Filtrlarni tozalash')}</button>
              )}
            </div>
          )}
        </div>
        <div className="hidden justify-self-center lg:flex">
          {/* Avval bu yerda aylanadigan namoyish kartasi turardi —
              bosilganda faqat orqa tomonini ko'rsatar, hech qayerga olib
              bormasdi. Endi bu bosiladigan taklif: jismoniy karta
              buyurtmasiga olib boradi (PhysicalCardPromoCard izohiga
              qarang). */}
          <PhysicalCardPromoCard />
        </div>
      </section>
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="vz-kicker">{t('Jonli')}</div>
            <h2 className="vz-h2 mt-2">{t("Barcha raqamli tashrif qog'ozlar")} <span className="text-base font-normal text-base-content/40">({fmt(filtered.length)})</span></h2>
          </div>
          {/* Saralash — burchakda. Sukut bo'yicha "Ko'p ko'rilgan". */}
          <div className="flex flex-wrap gap-1.5">
            {[['views', "Ko'p ko'rilgan"], ['new', 'Yangilar'], ['price', 'Qimmatlar']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSort(id)}
                aria-pressed={sort === id}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[15px] font-semibold transition ${sort === id ? 'border-accent bg-accent/10 text-accent' : 'border-white/12 text-base-content/60 hover:border-white/25'}`}
              >
                {id === 'views' && <IconEye />}
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        <div className="cat-grid mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 && (
            <div className="vz-empty col-span-full">
              <b>{t('Hech narsa topilmadi.')}</b>
              {(query || anyFilter) && <button type="button" className="btn btn-outline-gold btn-sm mt-2" onClick={() => { setQ(''); setType('all'); setMainCat(''); setSubCat(''); }}>{t('Filtrlarni tozalash')}</button>}
            </div>
          )}
          {filtered.map((it, idx) => {
            const cp = catPath(cats, it.categorySlug, lang);
            const tier = tierOf(it);
            const tc = TIER_COLOR[tier] || '#8a8a8a';
            return (
              <button
                key={it.code}
                type="button"
                className="cat-card cat-card--v2 tier-shine min-w-0 cursor-pointer rounded-2xl p-5 text-left"
                style={{
                  '--tier': tc,
                  '--tier-line': tc + 'b3',
                  '--tier-glow': tc + '3d',
                  '--tier-fill': tc + '14',
                  '--shine-delay': `${(idx % 7) * 0.55}s`,
                }}
                onClick={() => navigate('/' + it.code)}
              >
                {/* ── Bosh qism: dumaloq profil rasmi + ID + ism ──
                    Rasm AVTOMATIK: profilga qo'yilgan bo'lsa shu yerda ham
                    chiqadi (`avatarUrl` katalog API'sida allaqachon bor),
                    qo'lda hech narsa belgilanmaydi. Rasm yo'q bo'lsa
                    ismning bosh harfi turadi. */}
                <div className="cat-head">
                  {it.avatarUrl
                    ? <img className="cat-av" src={it.avatarUrl} alt="" loading="lazy" decoding="async" />
                    : <span className="cat-av" aria-hidden="true">{(it.name || it.code).trim().charAt(0).toUpperCase()}</span>}
                  <span className="cat-idwrap">
                    {/* `nfcstore.uz/` prefiksi olib tashlandi — kartaning
                        istalgan joyi bosilsa profil ochilaveradi. */}
                    <span className="cat-id">{it.code.toUpperCase()}</span>
                    {/* 2026-09: FAQAT asosiy ko'rinadigan ism. Avval yonida
                        Telegram username ham chiqardi ("Ali · davlatsudekspert").
                        Bu FAQAT katalog kartasiga tegishli — public profil,
                        Admin Panel va kabinet ma'lumotlari o'z holicha. */}
                    <span className="cat-name">
                      <span>{it.name}</span>
                      {it.verified && <span title={t('Tasdiqlangan')} className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-[9px] font-black text-white">✓</span>}
                    </span>
                  </span>
                  {/* O'ngda: tarif belgisi, ostida ko'rishlar soni. */}
                  <span className="cat-meta">
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[13px] font-bold uppercase tracking-wide"
                      style={{ color: tc, background: tc + '1f', border: `1px solid ${tc}44` }}
                    >
                      {TIER_EMOJI[tier] ? TIER_EMOJI[tier] + ' ' : ''}{t(TIER_LABEL[tier] || tier)}
                    </span>
                    <span className="cat-views" title={t("Ko'rishlar")}>
                      <IconEye /> {fmt(it.views || 0)}
                    </span>
                  </span>
                </div>
                {it.role && <div className="cat-role">{it.role}</div>}
                {(cp || it.city) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[14px] text-base-content/45">
                    {cp && <span className="rounded-full border border-white/10 px-2 py-0.5">{cp}</span>}
                    {it.city && <span className="rounded-full border border-white/10 px-2 py-0.5">{it.city}</span>}
                  </div>
                )}
                <div className="cat-rule" />
                {/* Admin sovg'asi -> narx o'rniga "Sovg'a" (sotuvga
                    qo'yilgandek ko'rinmasin). `isGift` backend'dan keladi va
                    `nfc_gifts` jadvalidagi HAQIQIY sovg'a yozuvidan
                    hisoblanadi (status='activated') — narxi 0 bo'lgani uchun
                    EMAS. Oddiy xarid qilingan kartalar narxi o'zgarmaydi. */}
                <div className="cat-foot">
                  {it.isGift
                    ? <span className="rounded-full bg-[color:var(--vz-gold,#d4af5a)]/15 px-2.5 py-0.5 text-[13px] font-bold text-[color:var(--vz-gold-2,#f0cf7a)]">{t("Sovg'a")}</span>
                    : <span className="cat-price">{t("{n} so'm", { n: fmt(it.price) })}</span>}
                  <span className="cat-when">{timeAgo(it.ts)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
