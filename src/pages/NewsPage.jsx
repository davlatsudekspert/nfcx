import { useEffect, useState } from 'react';
import { dbListNews, dbNewsView, dbNewsLike } from '../lib/db.js';
import { dateTime, fmt } from '../lib/format.js';
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
  const [liked, setLiked] = useState({}); // id -> bool

  useEffect(() => {
    dbListNews().then(({ news: list, liked: likedIds }) => {
      setNews(Array.isArray(list) ? list : []);
      setLiked(Object.fromEntries((likedIds || []).map((id) => [id, true])));
      // Ko'rilган har bir yangilikni bir marta hisoblaymiz (sessiya bo'yicha).
      try {
        for (const item of list || []) {
          const k = 'nfcx:news-seen:' + item.id;
          if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); dbNewsView(item.id); }
        }
      } catch { /* sessionStorage bloklangan */ }
    });
  }, []);

  const toggleLike = async (item) => {
    // optimistik
    const wasLiked = !!liked[item.id];
    setLiked((s) => ({ ...s, [item.id]: !wasLiked }));
    setNews((list) => (list || []).map((n) => (n.id === item.id
      ? { ...n, likeCount: Math.max(0, (n.likeCount || 0) + (wasLiked ? -1 : 1)) }
      : n)));
    try {
      const r = await dbNewsLike(item.id);
      setLiked((s) => ({ ...s, [item.id]: r.liked }));
      setNews((list) => (list || []).map((n) => (n.id === item.id ? { ...n, likeCount: r.count } : n)));
    } catch {
      // xato bo'lsa qaytaramiz
      setLiked((s) => ({ ...s, [item.id]: wasLiked }));
    }
  };

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
              <div className="mt-4 flex items-center gap-4 text-[13px] text-base-content/55">
                <button
                  onClick={() => toggleLike(item)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 transition ${
                    liked[item.id] ? 'border-red-400/50 text-red-400' : 'border-white/12 hover:border-white/25'
                  }`}
                >
                  <span>{liked[item.id] ? '❤️' : '🤍'}</span>
                  <b>{fmt(item.likeCount || 0)}</b>
                </button>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true">👁</span> {t("{n} ko'rishlar", { n: fmt(item.views || 0) })}
                </span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
