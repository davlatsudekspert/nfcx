import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
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

export default function CompaniesPage() {
  const { t } = useLanguage();
  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="grid items-center gap-12 pt-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
            {'\u{1F3E2}'} {t('Kompaniyalar uchun')}
          </span>
          <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {t('Biznesingiz uchun')} <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">{t('NFC kartalarni')}</span> {t('tayyorlaymiz')}
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-base-content/60">
            {t('Tashkilotingiz xodimlari, menejerlari, savdo vakillari va hamkorlari uchun brendlangan NFC kartalar tayyorlab beramiz.')}
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[15px] text-base-content/75">
                <span className="mt-0.5 text-accent">{'\u2713'}</span>
                {t(f)}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <a href="https://t.me/nfcstore_admin" target="_blank" rel="noopener noreferrer" className="btn btn-accent">
              {'\u{1F449}'} {t('Korporativ buyurtma berish')}
            </a>
            <button onClick={() => navigate('/narxlar')} className="btn btn-outline">{t('Narxlar bilan tanishish')}</button>
          </div>
        </div>

        <div className="hidden justify-self-center lg:flex">
          <Interactive3DCard>
            <NfcCard code="B2B001" name={t('KOMPANIYA NOMI')} finish="showcase" size="lg" rim />
          </Interactive3DCard>
        </div>
      </section>

      <section className="mt-20 rounded-3xl border border-accent/25 bg-accent/5 p-8 sm:p-10">
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
