import { useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { useCategories, catPath } from '../lib/categories.js';
import { fmt } from '../lib/format.js';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';

const FEATURES = [
  'Kompaniya logotipi va dizayni',
  "Har bir xodim uchun alohida NFC ID",
  'Kontaktlar va muhim ma’lumotlarni tez ulashish',
  'Xodimlar uchun yagona korporativ profil',
  "Katta miqdordagi buyurtmalar",
  'Individual dizayn va maxsus yechimlar',
];

export default function CompaniesPage({ catalog = [] }) {
  const { t, lang } = useLanguage();
  const cats = useCategories();
  const [q, setQ] = useState('');

  const query = q.trim().toUpperCase();
  const companies = [...catalog]
    .filter((it) => it.profileType === 'business')
    .sort((a, b) => b.ts - a.ts)
    .filter((it) => !query
      || it.code.includes(query)
      || (it.name || '').toUpperCase().includes(query)
      || (it.role || '').toUpperCase().includes(query)
      || (it.city || '').toUpperCase().includes(query));

  const cardCls = 'cursor-pointer rounded-2xl border border-white/10 bg-base-200/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-base-200';

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="grid items-center gap-12 pt-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
            {'\u{1F3E2}'} {t('Kompaniyalar uchun')}
          </span>
          <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {t('Kompaniyalar va mutaxassislarni toping')}
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-base-content/60">
            {t('Kerakli kompaniya, xizmat yoki mutaxassisni NFCStore orqali toping. Ularning faoliyat sohasi, xizmatlari va ochiq aloqa ma’lumotlarini bitta joyda ko‘ring.')}
          </p>

          <div className="mt-6 flex max-w-md items-center rounded-lg border border-white/15 bg-black/40 focus-within:border-base-content/40">
            <span className="shrink-0 pl-3 text-base-content/40">{'\u{1F50D}'}</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Kompaniya nomi, xizmat yoki shahar')} autoComplete="off" className="w-full bg-transparent px-2 py-3 text-sm outline-none" />
          </div>
        </div>

        <div className="hidden justify-self-center lg:flex">
          <Interactive3DCard>
            <NfcCard code="B2B001" name={t('KOMPANIYA NOMI')} finish="showcase" size="lg" rim />
          </Interactive3DCard>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-bold">{t('Katalogdagi kompaniyalar')} <span className="text-base font-normal text-base-content/40">({fmt(companies.length)})</span></h2>
        {companies.length === 0 ? (
          <p className="mt-4 text-[15px] text-base-content/45">{t('Hozircha katalogda kompaniya profillari yo‘q. Birinchi bo‘lib qo‘shiling.')}</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((it) => {
              const cp = catPath(cats, it.categorySlug, lang);
              return (
                <button key={it.code} className={cardCls} onClick={() => navigate('/' + it.code)}>
                  <div className="font-mono text-sm font-bold tracking-wide">nfcstore.uz/{it.code.toLowerCase()}</div>
                  <div className="mt-1 truncate text-[13px] text-base-content/55">{it.name}{it.role ? ' · ' + it.role : ''}</div>
                  {(cp || it.city) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-base-content/45">
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
      </section>
    </main>
  );
}
