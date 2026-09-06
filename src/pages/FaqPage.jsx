import { useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';

import { FAQ } from '../lib/faq.js';

export default function FaqPage({ catalog }) {
  const { t, lang } = useLanguage();
  const [openFaq, setOpenFaq] = useState(0);
  const items = FAQ[lang] || FAQ.uz;
  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 pb-16 sm:px-10 lg:px-14">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className="max-w-3xl">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          {t('Savollar')}
        </span>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight">
          {t("Tez-tez so'raladigan")} <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">{t('savollar')}</span>
        </h1>
      </section>

      <section className="mt-10 space-y-3">
        {items.map((f, i) => (
          <div key={i} className={`collapse collapse-arrow rounded-2xl border border-white/10 bg-base-200/60 ${openFaq === i ? 'collapse-open' : ''}`}>
            <button
              className="collapse-title cursor-pointer pr-12 text-left font-semibold"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              {f.q}
            </button>
            <div className="collapse-content">
              <p className="text-sm leading-relaxed text-base-content/60">{f.a}</p>
            </div>
          </div>
        ))}
      </section>
      </div>

      {/* O'ng tarafdagi bo'sh joyni to'ldiruvchi jonli NFC vizual */}
      <div className="relative hidden pt-14 lg:block">
        <div className="sticky top-40 -translate-x-8 flex flex-col items-center gap-8">
          <div className="animate-[floatY_5.5s_ease-in-out_infinite]">
            <Interactive3DCard>
              <NfcCard code="SAV777" name={t('SIZNING ISMINGIZ')} finish="showcase" size="lg" />
            </Interactive3DCard>
          </div>
          <div className="relative h-40 w-40">
            <span className="absolute inset-0 animate-[spinSlow_14s_linear_infinite] rounded-full border border-dashed border-white/15"></span>
            <span className="absolute inset-4 animate-[spinSlow_22s_linear_infinite_reverse] rounded-full border border-white/10"></span>
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-accent"></span>
          </div>
          <p className="max-w-[220px] text-center text-xs text-base-content/40">{t('Savolingiz qolmadimi? Kartani bosib aylantiring — u ham javob beradi 🙂')}</p>
        </div>
      </div>
      </div>
    </main>
  );
}
