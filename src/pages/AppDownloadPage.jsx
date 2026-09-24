import { useLanguage } from '../lib/i18n.jsx';
import { APP_APK_URL, isIos } from '../lib/appDownload.js';

// NFCSTORE ILOVASI — YUKLAB OLISH SAHIFASI (nfcstore.uz/ilova-yuklash).
//
// Ilova hali Google Play'da hammaga ochiq emas; shu vaqtgacha Android
// foydalanuvchilar uni shu yerdan o'rnatadi. Fayl Play imzolagan APK —
// keyin Play Market'dan yangilanadi (src/lib/appDownload.js).
const FEATURES = [
  ['🪪', "Raqamli vizitkangiz doim telefoningizda"],
  ['📶', "NFC karta va stikerlarga profil yozish"],
  ['🎬', "Lenta, Reels va istoriyalar"],
  ['💼', "Biznes sahifasi va katalog"],
];

const STEPS = [
  "«Yuklab olish» tugmasini bosing — fayl telefoningizga tushadi.",
  "Faylni oching. Telefon so'rasa, brauzerga «noma'lum manbalardan o'rnatish»ga ruxsat bering.",
  "«O'rnatish» tugmasini bosing. Play Protect ogohlantirsa — «Baribir o'rnatish»ni tanlang.",
  "Ilovani oching va NFCSTORE hisobingiz bilan kiring.",
];

export default function AppDownloadPage() {
  const { t } = useLanguage();
  const ios = isIos();
  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          {t('Android ilovasi')}
        </span>
        <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight">
          {t('NFCSTORE ilovasini')}{' '}
          <span className="bg-gradient-to-br from-base-content to-base-content/55 bg-clip-text text-transparent">{t('yuklab oling')}</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-base-content/60">
          {t("Ilova tez orada Google Play'da chiqadi. Hozircha uni shu yerdan o'rnating — keyin Play Market orqali yangilanadi.")}
        </p>

        {ios ? (
          <div className="mt-8 max-w-xl rounded-2xl border border-white/10 bg-base-200/60 p-5 text-sm text-base-content/70">
            {t("Hozircha ilova faqat Android uchun. iPhone versiyasi tez orada — shu vaqtgacha profilingiz saytda to'liq ishlaydi.")}
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={APP_APK_URL}
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-base-content px-7 py-3.5 text-[15px] font-semibold text-base-100 no-underline transition hover:opacity-90"
            >
              ⬇️ {t('Yuklab olish (Android)')}
            </a>
            <span className="text-xs text-base-content/50">{t('Beta versiya · ~65 MB')}</span>
          </div>
        )}
      </section>

      <section className="mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
        {FEATURES.map(([icon, text]) => (
          <div key={text} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-base-200/60 p-5">
            <span className="text-2xl" aria-hidden="true">{icon}</span>
            <span className="text-sm text-base-content/80">{t(text)}</span>
          </div>
        ))}
      </section>

      {!ios && (
        <section className="mt-12 max-w-2xl">
          <h2 className="text-xl font-bold">{t("Qanday o'rnatiladi")}</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm text-base-content/70">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-xs">{i + 1}</span>
                <span>{t(s)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-base-content/50">
            {t("Fayl Google Play imzosi bilan — ilova Play Market'ga chiqqach, uni o'chirmasdan Play orqali yangilaysiz. Muammo bo'lsa: @nfcstore_admin")}
          </p>
        </section>
      )}
    </main>
  );
}
