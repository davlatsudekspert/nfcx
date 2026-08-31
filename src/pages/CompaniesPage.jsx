import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { useCategories, catPath } from '../lib/categories.js';
import { fmt } from '../lib/format.js';
import { dbGetPhysicalNfcPricing } from '../lib/db.js';

const FEATURES = [
  'Kompaniya logotipi va dizayni',
  "Har bir xodim uchun alohida NFC ID",
  'Kontaktlar va muhim ma’lumotlarni tez ulashish',
  'Xodimlar uchun yagona korporativ profil',
  "Katta miqdordagi buyurtmalar",
  'Individual dizayn va maxsus yechimlar',
];

// Qidiruv chiplari — bosilganda qidiruv maydonini to'ldiradi va pastdagi
// haqiqiy kompaniyalar ro'yxatini filtrlaydi.
const QUICK_EXAMPLES = ['Restoran', 'Do‘kon', 'Qurilish', 'IT xizmatlari'];

// Demo namuna ma'lumotlari — FAQAT vizual namoyish uchun, DBga yozilmaydi
// va haqiqiy qidiruv/reyting natijalariga aralashmaydi ("NAMUNA" belgisi
// bilan aniq ajratilgan — Faz 13/29).
const RESTAURANT_DEMO = {
  categories: [
    { name: 'Nonushta', items: [{ n: 'Osh', p: 28000 }, { n: 'Non', p: 6000 }] },
    { name: 'Issiq taomlar', items: [{ n: 'Steak', p: 89000 }, { n: 'Pizza Pepperoni', p: 70000 }] },
    { name: 'Salatlar', items: [{ n: 'Sezar salat', p: 28000 }] },
    { name: 'Ichimliklar', items: [{ n: 'Limonad', p: 15000 }] },
  ],
};
const MARKET_DEMO = {
  categories: [
    { name: 'Telefonlar', items: [{ n: 'iPhone 15 Pro', p: 12990000 }, { n: 'Samsung S24 Ultra', p: 14500000 }] },
    { name: 'Aksessuarlar', items: [{ n: 'AirPods Pro 2', p: 2990000 }, { n: 'Apple Watch 9', p: 4200000 }] },
  ],
};

function DemoPhone({ tint, categories, t }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? categories : categories.slice(0, 2);
  return (
    <div className="mx-auto w-[220px] shrink-0 rounded-[2rem] border-[3px] border-white/15 bg-black/60 p-2.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]">
      <div className="h-4 w-full" />
      <div className="max-h-[280px] space-y-3 overflow-hidden rounded-2xl bg-base-100 p-3">
        {shown.map((cat) => (
          <div key={cat.name}>
            <div className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: tint }}>{t(cat.name)}</div>
            <div className="mt-1 space-y-1">
              {cat.items.map((it) => (
                <div key={it.n} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px]">
                  <span className="min-w-0 truncate text-base-content/80">{t(it.n)}</span>
                  <span className="shrink-0 font-semibold text-base-content/50">{fmt(it.p)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {categories.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full rounded-lg py-1.5 text-center text-[10px] font-semibold text-base-content/50 hover:text-base-content/80"
        >
          {expanded ? t('Kamroq ko‘rsatish') : t('Yana ko‘rsatish')}
        </button>
      )}
    </div>
  );
}

function DemoCard({ tint, icon, title, question, desc, features, phone, onCreate, t }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border p-6 sm:p-7"
      style={{ borderColor: `${tint}40`, background: `linear-gradient(160deg, ${tint}14 0%, rgba(10,10,10,0.4) 60%)` }}
    >
      <div className="grid gap-6 sm:grid-cols-[1.15fr_0.85fr] sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: `${tint}22`, color: tint }}>{icon}</span>
            <span className="text-[15px] font-bold">{title}</span>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: `${tint}55`, color: tint }}>
              {t('NAMUNA')}
            </span>
          </div>
          <h3 className="mt-4 text-xl font-bold leading-snug sm:text-[22px]">{t(question)}</h3>
          <p className="mt-2.5 text-[14px] leading-relaxed text-base-content/60">{t(desc)}</p>
          <ul className="mt-4 space-y-2">
            {features.map(([label, pro]) => (
              <li key={label} className="flex items-center gap-2 text-[13.5px] text-base-content/75">
                <span style={{ color: tint }}>✓</span>
                {t(label)}
                {pro && <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[9px] font-bold text-base-content/45">🔒 PRO</span>}
              </li>
            ))}
          </ul>
          <button type="button" onClick={onCreate} className="btn btn-sm mt-5 border-0 font-semibold text-black" style={{ background: tint }}>
            {t("Kompaniyangizni shu ko‘rinishda yarating")}
          </button>
        </div>
        <DemoPhone tint={tint} categories={phone.categories} t={t} />
      </div>
    </div>
  );
}

// Jismoniy NFC (ko'p dona) narx kalkulyatori — admin panelda boshqariladigan
// pog'onalarni /api/settings/physical-nfc-pricing'dan o'qiydi (Faz 25/26).
// Faqat informatsion — checkout/to'lovga ulanmagan (to'lovlar hozircha o'chiq).
function pickTier(tiers, qty) {
  return tiers.find((t) => qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty)) || tiers[tiers.length - 1];
}

function PhysicalPricingCalculator() {
  const { t } = useLanguage();
  const [pricing, setPricing] = useState(null);
  const [qty, setQty] = useState(1);

  useEffect(() => { dbGetPhysicalNfcPricing().then(setPricing); }, []);

  if (!pricing || !pricing.tiers?.length) return null;
  const { tiers, delivery } = pricing;
  const n = Math.max(1, Math.min(100000, Math.round(Number(qty) || 1)));
  const tier = pickTier(tiers, n);
  const total = tier.pricePerUnit * n;

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-base-content/50">{t('Dona soni')}</span>
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
            className="input input-bordered input-sm mt-1 w-28 bg-base-100" />
        </label>
        <div>
          <div className="text-xs text-base-content/50">{t('Dona narxi')}</div>
          <div className="text-lg font-bold">{fmt(tier.pricePerUnit)} {t("so'm")}</div>
        </div>
        <div>
          <div className="text-xs text-base-content/50">{t('Jami')}</div>
          <div className="text-lg font-bold text-accent">{fmt(total)} {t("so'm")}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-base-content/45">
        {tiers.map((tr, i) => (
          <span key={i} className={`rounded-full border px-2.5 py-1 ${tr === tier ? 'border-accent/50 text-accent' : 'border-white/10'}`}>
            {tr.maxQty == null ? `${tr.minQty}+` : `${tr.minQty}–${tr.maxQty}`} {t('dona')} — {fmt(tr.pricePerUnit)} {t("so'm/dona")}
          </span>
        ))}
      </div>
      {delivery && (
        <p className="mt-3 text-[13px] text-base-content/55">
          {'\u{1F69A}'} {t('Taxminiy yetkazib berish')}: {delivery.minDays}–{delivery.maxDays} {t('ish kuni')}.
        </p>
      )}
    </div>
  );
}

export default function CompaniesPage({ catalog = [] }) {
  const { t, lang } = useLanguage();
  const cats = useCategories();
  const [q, setQ] = useState('');

  const query = q.trim().toUpperCase();
  const companies = useMemo(() => [...catalog]
    .filter((it) => it.profileType === 'business')
    .sort((a, b) => b.ts - a.ts)
    .filter((it) => !query
      || it.code.includes(query)
      || (it.name || '').toUpperCase().includes(query)
      || (it.role || '').toUpperCase().includes(query)
      || (it.city || '').toUpperCase().includes(query)
      || catPath(cats, it.categorySlug, lang).toUpperCase().includes(query)),
  [catalog, query, cats, lang]);

  const cardCls = 'cursor-pointer rounded-2xl border border-white/10 bg-base-200/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-base-200';

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pb-16 sm:px-10">
      <section className="pt-16 text-center">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          {'\u{1F3E2}'} {t('Kompaniyalar uchun')}
        </span>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          {t('Kompaniyalar va mutaxassislarni')} <span className="text-accent">{t('toping')}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-base-content/60">
          {t('Kerakli kompaniya, xizmat yoki mutaxassisni NFCStore orqali toping. Ularning faoliyat sohasi, xizmatlari va ochiq aloqa ma’lumotlarini bitta joyda ko‘ring.')}
        </p>

        <div className="mx-auto mt-7 flex max-w-lg items-center rounded-lg border border-white/15 bg-black/40 focus-within:border-base-content/40">
          <span className="shrink-0 pl-3.5 text-base-content/40">{'\u{1F50D}'}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Kompaniya nomi, xizmat yoki shahar')} autoComplete="off" className="w-full bg-transparent px-2.5 py-3.5 text-sm outline-none" />
          <button type="button" onClick={() => document.getElementById('kompaniyalar-royxati')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-accent btn-sm mr-1.5 shrink-0">
            {t('Qidirish')}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-base-content/40">{t('Tezkor misollar')}:</span>
          {QUICK_EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setQ(ex)} className="rounded-full border border-white/10 px-3 py-1 text-base-content/60 transition hover:border-white/25 hover:text-base-content">
              {t(ex)}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-5 lg:grid-cols-2">
        <DemoCard
          tint="#e0b23d"
          icon={'\u{1F37D}️'}
          title="NFC Restaurant"
          question="Restoran menyusi qanday ko‘rinadi?"
          desc="Mijozlar sizning menyuingizni NFC yoki QR orqali bir zumda telefonida ochadi — zamonaviy va qulay."
          features={[
            ['Taomlar rasm va narxlari bilan', false],
            ['Kategoriya va tartibli menyu', false],
            ['Telefon va lokatsiya', true],
            ['O‘z logotipingiz va uslubingiz', true],
          ]}
          phone={RESTAURANT_DEMO}
          onCreate={() => navigate('/account')}
          t={t}
        />
        <DemoCard
          tint="#8b5cf6"
          icon={'\u{1F6CD}️'}
          title="NFC Market"
          question="Mahsulotlaringiz qanday ko‘rinadi?"
          desc="Kompaniya mahsulot va xizmatlaringizni chiroyli katalog ko‘rinishida mijozlarga taqdim eting."
          features={[
            ['Mahsulotlar rasm va narxlari bilan', false],
            ['Kategoriyalarni o‘zingiz belgilang', false],
            ['Telefon va lokatsiya', true],
            ['Cheksiz mahsulotlar', true],
          ]}
          phone={MARKET_DEMO}
          onCreate={() => navigate('/account')}
          t={t}
        />
      </section>

      <section id="kompaniyalar-royxati" className="mt-16">
        <h2 className="text-xl font-bold">{t('Kompaniyalar va menyularni kashf eting')} <span className="text-base font-normal text-base-content/40">({fmt(companies.length)})</span></h2>
        <p className="mt-1.5 text-[14px] text-base-content/50">{t('Restoranlar va kompaniyalarni qidiring, ularning menyu va kataloglarini ko‘ring.')}</p>
        {companies.length === 0 ? (
          <p className="mt-4 text-[15px] text-base-content/45">{t('Hozircha katalogda kompaniya profillari yo‘q. Birinchi bo‘lib qo‘shiling.')}</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {companies.map((it) => {
              const cp = catPath(cats, it.categorySlug, lang);
              return (
                <button key={it.code} className={cardCls} onClick={() => navigate('/' + it.code)}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30 text-sm font-bold text-base-content/50">
                      {it.avatarUrl ? <img src={it.avatarUrl} alt="" className="h-full w-full object-cover" /> : (it.name || it.code).slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-sm font-bold">
                        {it.name}
                        {it.verified && <span title={t('Tasdiqlangan')} className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-[9px] font-black text-white">✓</span>}
                      </div>
                      <div className="truncate font-mono text-[11px] text-base-content/40">nfcstore.uz/{it.code.toLowerCase()}</div>
                    </div>
                  </div>
                  {(cp || it.city) && (
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-base-content/45">
                      {cp && <span className="rounded-full border border-white/10 px-2 py-0.5">{cp}</span>}
                      {it.city && <span className="rounded-full border border-white/10 px-2 py-0.5">{'\u{1F4CD}'} {it.city}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-16 rounded-3xl border border-accent/25 bg-accent/5 p-8 sm:p-10">
        <h2 className="text-2xl font-bold">{t('Sizning biznesingiz ham NFCStore’da bo‘lsin')}</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-base-content/65">
          {t('Kompaniyangiz uchun raqamli profil yarating. Mijozlar va kelajakdagi hamkorlar sizni NFCStore katalogi, qidiruvi va NFC ID orqali oson topsin.')}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => navigate('/account')} className="btn btn-accent">{t('Kompaniya profilini yaratish')}</button>
          <button onClick={() => navigate('/narxlar')} className="btn btn-ghost border border-white/15">{t('NFC ID tanlash')}</button>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold">{t('Korporativ NFC kartalar')}</h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-base-content/60">
          {t('Tashkilotingiz xodimlari, menejerlari, savdo vakillari va hamkorlari uchun brendlangan NFC kartalar tayyorlab beramiz.')}
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[15px] text-base-content/75">
              <span className="mt-0.5 text-accent">{'✓'}</span>
              {t(f)}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="https://t.me/nfcstore_admin" target="_blank" rel="noopener noreferrer" className="btn btn-accent">
            {'\u{1F449}'} {t('Korporativ buyurtma berish')}
          </a>
        </div>
      </section>

      <section className="mt-16 rounded-3xl border border-white/10 bg-base-200/40 p-8 sm:p-10">
        <h2 className="text-2xl font-bold">{t('Korporativ paket — masalan')}</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-base-content/65">
          {t('Kompaniya 100 ta karta buyurtma qilsa:')} <b className="text-base-content">{t("100 ta NFC karta + 100 ta individual profil + kompaniya brendingi + NFC ID'lar")}</b> {t('— bitta korporativ paket sifatida taklif qilinadi.')}
        </p>
        <p className="mt-3 max-w-2xl text-[15px] text-base-content/50">
          {t("Aniq narx buyurtma hajmiga qarab belgilanadi — hamkorlik uchun to'g'ridan-to'g'ri murojaat qiling.")}
        </p>
        <PhysicalPricingCalculator />
      </section>
    </main>
  );
}
