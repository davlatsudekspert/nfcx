import { useEffect, useState } from 'react';
import { dbListNews } from '../lib/db.js';
import { dateTime } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';

// Tanlangan tildagi matnni oladi — tarjima bo'sh bo'lsa o'zbekchaga qaytadi.
function pick(item, base, lang) {
  const suffix = lang === 'ru' ? 'Ru' : lang === 'en' ? 'En' : '';
  if (!suffix) return item[base] || '';
  return (item[base + suffix] || '').trim() || item[base] || '';
}

// NFCSTORE yangiliklari — faqat admin joylaydi (Admin panel → Yangiliklar).
export default function NewsPage() {
  const { t, lang } = useLanguage();
  const [news, setNews] = useState(null);

  useEffect(() => {
    dbListNews().then((list) => setNews(Array.isArray(list) ? list : []));
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-20 sm:px-10">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          {t('Yangiliklar')}
        </span>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight">
          {t('NFCSTORE')} <span className="bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">{t('yangiliklari')}</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-base-content/55">
          {t("Ishga tushirish sanasi, yangi ID'lar, aksiyalar va platforma yangiliklari shu yerda e'lon qilinadi.")}
        </p>
      </section>

      <section className="mt-10 space-y-5">
        {news === null && (
          <div className="py-10 text-center text-sm text-base-content/45">{t('Yuklanmoqda...')}</div>
        )}
        {news !== null && news.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-base-content/50">
            {t('Hozircha yangiliklar yo‘q.')}
          </div>
        )}
        {(news || []).map((item) => (
          <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-base-200/60">
            {item.imageUrl && (
              <img src={item.imageUrl} alt="" className="max-h-[360px] w-full object-cover" loading="lazy" />
            )}
            <div className="p-5 sm:p-6">
              <div className="font-mono text-xs text-base-content/40">{dateTime(new Date(item.createdAt).getTime())}</div>
              <h2 className="mt-1.5 text-xl font-bold">{pick(item, 'title', lang)}</h2>
              {pick(item, 'body', lang) && (
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-base-content/70">{pick(item, 'body', lang)}</p>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
