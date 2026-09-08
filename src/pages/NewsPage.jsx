import { useEffect, useState } from 'react';
import { dbNewsView, dbNewsLike } from '../lib/db.js';
import { dateTime, fmt } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { IconArrowLeft } from '../components/Icons.jsx';
import ShareButton from '../components/ShareButton.jsx';
import Linkify from '../components/Linkify.jsx';

// Tanlangan tildagi matnni oladi — tarjima bo'sh bo'lsa o'zbekchaga qaytadi.
function pick(item, base, lang) {
  const suffix = lang === 'ru' ? 'Ru' : lang === 'en' ? 'En' : '';
  if (!suffix) return item[base] || '';
  return (item[base + suffix] || '').trim() || item[base] || '';
}

// Ulashiladigan to'liq havola. `window.location.origin` — sayt qaysi
// domenda ochilgan bo'lsa o'sha (nfcstore.uz yoki www bilan), shuning
// uchun havola qattiq yozilmaydi.
function newsUrl(id) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nfcstore.uz';
  return `${origin}/yangiliklar/${id}`;
}

// Ulashish oynasida havola ostida ko'rinadigan qisqa parcha. Avval bu yerda
// har doim "NFCSTORE yangiligi" turardi — qaysi yangilik ekani bilinmasdi.
// So'zning o'rtasidan kesilmaydi.
function shareExcerpt(text, limit = 160) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const sp = cut.lastIndexOf(' ');
  return (sp > limit * 0.6 ? cut.slice(0, sp) : cut).trim() + '\u2026';
}

// Ro'yxatni to'g'ridan-to'g'ri olamiz — xatolik bilan bo'sh ro'yxatni ajratish
// uchun (db.js dagi dbListNews xatoni yutib, [] qaytaradi).
async function fetchNews() {
  const res = await fetch('/api/news', { credentials: 'same-origin' });
  if (!res.ok) { const e = new Error('api_error_' + res.status); e.status = res.status; throw e; }
  const data = await res.json().catch(() => ({}));
  return { news: Array.isArray(data?.news) ? data.news : [], liked: Array.isArray(data?.liked) ? data.liked : [] };
}

// Bir sessiyada har bir yangilik faqat bir marta "ko'rildi" deb hisoblanadi.
function markSeen(id) {
  try {
    const k = 'nfcx:news-seen:' + id;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, '1');
    return true;
  } catch { return true; }
}

function IconEye(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconHeart({ filled, ...props }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

// NFCSTORE yangiliklari — faqat admin joylaydi (Admin panel → Yangiliklar).
// `newsId` berilsa (marshrut: /yangiliklar/:id) bitta yangilik batafsil ochiladi;
// alohida GET /api/news/:id yo'q — ro'yxatdan topiladi.
export default function NewsPage({ newsId = null }) {
  const { t, lang } = useLanguage();
  const [news, setNews] = useState(null);
  const [err, setErr] = useState(null);
  const [liked, setLiked] = useState({}); // id -> bool
  const [likeErr, setLikeErr] = useState(null);

  const load = () => {
    setErr(null); setNews(null);
    fetchNews().then(({ news: list, liked: likedIds }) => {
      setNews(list);
      setLiked(Object.fromEntries((likedIds || []).map((id) => [id, true])));
    }).catch((e) => setErr(e));
  };
  useEffect(() => { load(); }, []);

  // Ro'yxat ko'rinishida: barcha yangiliklar bir marta hisoblanadi (eski xatti-harakat).
  // Batafsil ko'rinishda: faqat shu yangilik; server qaytargan `views` bilan yangilanadi.
  useEffect(() => {
    if (!news) return;
    if (newsId) {
      const id = Number(newsId);
      if (!news.some((n) => n.id === id) || !markSeen(id)) return;
      fetch(`/api/news/${id}/view`, { method: 'POST', credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && typeof d.views === 'number') setNews((list) => (list || []).map((n) => (n.id === id ? { ...n, views: d.views } : n))); })
        .catch(() => {});
    } else {
      for (const item of news) if (markSeen(item.id)) dbNewsView(item.id);
    }
  }, [news === null, newsId]); // eslint-disable-line react-hooks/exhaustive-deps

  const detail = newsId && news ? news.find((n) => String(n.id) === String(newsId)) : null;

  // Sahifa sarlavhasi — faqat DETAIL ko'rinishi uchun (aniq maqola nomi bilan),
  // chunki App.jsx'dagi markazlashtirilgan SeoSync (src/lib/seo.js) har bir
  // marshrut o'zgarishida umumiy "Yangiliklar — NFCSTORE.UZ"ni allaqachon
  // qo'yadi. 2026-09 hotfix: avval bu yerda "eski title'ni tiklash" cleanup
  // bo'lgan (`document.title = prev`) — u boshqa sahifaga o'tishda SeoSync
  // bilan poyga holatiga tushib, ba'zan "Yangiliklar — NFCSTORE.UZ" boshqa
  // sahifada (masalan Kompaniyalar) qolib ketishiga sabab bo'lardi. Endi
  // ketishda hech narsa qo'lda tiklanmaydi — keyingi sahifaning o'zi SeoSync
  // orqali to'g'ri sarlavha qo'yadi.
  useEffect(() => {
    if (newsId && detail) document.title = `${pick(detail, 'title', lang)} — NFCSTORE`;
  }, [newsId, detail, lang]);

  const toggleLike = async (item) => {
    // optimistik
    const wasLiked = !!liked[item.id];
    setLikeErr(null);
    setLiked((s) => ({ ...s, [item.id]: !wasLiked }));
    setNews((list) => (list || []).map((n) => (n.id === item.id
      ? { ...n, likeCount: Math.max(0, (n.likeCount || 0) + (wasLiked ? -1 : 1)) }
      : n)));
    try {
      const r = await dbNewsLike(item.id);
      if (r && typeof r.liked === 'boolean') {
        setLiked((s) => ({ ...s, [item.id]: r.liked }));
        setNews((list) => (list || []).map((n) => (n.id === item.id ? { ...n, likeCount: Number(r.count ?? r.likes ?? n.likeCount ?? 0) } : n)));
      } else throw new Error('bad_response');
    } catch {
      // xato bo'lsa qaytaramiz
      setLiked((s) => ({ ...s, [item.id]: wasLiked }));
      setNews((list) => (list || []).map((n) => (n.id === item.id
        ? { ...n, likeCount: Math.max(0, (n.likeCount || 0) + (wasLiked ? 1 : -1)) }
        : n)));
      setLikeErr(t("Server bilan aloqa yo'q. Qayta urinish"));
    }
  };

  const go = (e, path) => { e.preventDefault(); navigate(path); };

  const likeBtn = (item) => (
    <button
      type="button"
      onClick={() => toggleLike(item)}
      aria-pressed={!!liked[item.id]}
      aria-label={liked[item.id] ? t('Yoqtirishni bekor qilish') : t('Yoqtirish')}
      className="vz-tap inline-flex items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition"
      style={liked[item.id]
        ? { borderColor: 'rgba(229,72,77,.5)', color: '#ff7b81', background: 'rgba(229,72,77,.08)' }
        : { borderColor: 'var(--vz-line)', color: 'var(--vz-ink-2)' }}
    >
      <IconHeart filled={!!liked[item.id]} />
      <b>{fmt(item.likeCount || 0)}</b>
    </button>
  );

  const meta = (item) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]" style={{ color: 'var(--vz-ink-3)' }}>
      <span className="font-mono text-xs">{dateTime(new Date(item.createdAt).getTime())}</span>
      <span className="inline-flex items-center gap-1.5"><IconEye /> {t("{n} ko'rishlar", { n: fmt(item.views || 0) })}</span>
    </div>
  );

  // ---------- Batafsil ----------
  if (newsId) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6 lg:px-10" style={{ color: 'var(--vz-ink)' }}>
        <section className="pt-10 sm:pt-14">
          <a href="/yangiliklar" onClick={(e) => go(e, '/yangiliklar')} className="vz-tap inline-flex items-center gap-2 rounded-full text-sm font-semibold" style={{ color: 'var(--vz-gold)' }}>
            <IconArrowLeft /> {t('Barcha yangiliklar')}
          </a>
        </section>

        <section className="mt-6">
          {err && (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-[14px] border p-8 text-center" style={{ borderColor: 'rgba(229,72,77,.45)', background: 'rgba(229,72,77,.06)' }}>
              <div className="text-sm font-semibold" style={{ color: '#ff7b81' }}>{t("Yangilikni yuklab bo'lmadi.")}</div>
              <div className="text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t("Server bilan aloqa yo'q.")}</div>
              <button type="button" className="btn btn-outline-gold btn-sm" onClick={load}>{t('Qayta urinish')}</button>
            </div>
          )}
          {!err && news === null && (
            <div className="vz-card p-6" aria-busy="true">
              <div className="vz-skel h-3 w-24" />
              <div className="vz-skel mt-4 h-7 w-3/4" />
              <div className="vz-skel mt-6 h-3" />
              <div className="vz-skel mt-2 h-3 w-11/12" />
              <div className="vz-skel mt-2 h-3 w-4/5" />
              <span className="sr-only">{t('Yuklanmoqda...')}</span>
            </div>
          )}
          {!err && news !== null && !detail && (
            <div className="vz-empty">
              <div className="text-sm font-semibold" style={{ color: 'var(--vz-ink)' }}>{t('Yangilik topilmadi.')}</div>
              <div className="text-xs">{t("Bu yangilik o'chirilgan yoki hali chop etilmagan bo'lishi mumkin.")}</div>
              <a href="/yangiliklar" onClick={(e) => go(e, '/yangiliklar')} className="btn btn-outline-gold btn-sm mt-2">{t('Barcha yangiliklar')}</a>
            </div>
          )}
          {detail && (
            <article className="vz-card overflow-hidden">
              {detail.imageUrl && (
                <img src={detail.imageUrl} alt="" className="max-h-[420px] w-full object-cover" />
              )}
              <div className="p-5 sm:p-8">
                <span className="vz-kicker">{t('Yangiliklar')}</span>
                <h1 className="vz-h2 mt-2 break-words">{pick(detail, 'title', lang)}</h1>
                <div className="mt-4">{meta(detail)}</div>
                {pick(detail, 'body', lang) && (
                  // <Linkify> — matn admin panelidan ODDIY MATN sifatida
                  // keladi, shu sabab https://... havolalari bosilmas edi.
                  // HTML yaratilmaydi, faqat bo'laklarga ajratiladi.
                  <p className="mt-6 whitespace-pre-wrap break-words text-[16px] leading-relaxed" style={{ color: 'var(--vz-ink-2)' }}>
                    <Linkify text={pick(detail, 'body', lang)} />
                  </p>
                )}
                <div className="vz-divider mt-8" />
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {likeBtn(detail)}
                  <ShareButton
                    url={newsUrl(detail.id)}
                    title={pick(detail, 'title', lang)}
                    text={shareExcerpt(pick(detail, 'body', lang)) || t('NFCSTORE yangiligi')}
                    label={t('Ulashish')}
                    className="btn btn-outline-gold btn-sm"
                  />
                  {/* Ba'zi brauzerlarda (masalan Yandex ish stoli) tizimning
                      ulashish oynasi bo'sh ochiladi. Shu sabab havolani
                      to'g'ridan-to'g'ri nusxalaydigan zaxira tugma ham bor —
                      u har qanday brauzerda ishlaydi. */}
                  <ShareButton
                    url={newsUrl(detail.id)}
                    forceCopy
                    label={t('Havolani nusxalash')}
                    className="btn btn-ghost-vz btn-sm"
                  />
                  <a href="/yangiliklar" onClick={(e) => go(e, '/yangiliklar')} className="btn btn-ghost-vz btn-sm">{t('Orqaga')}</a>
                </div>
                {likeErr && <div role="alert" className="vz-err mt-3">{likeErr}</div>}
              </div>
            </article>
          )}
        </section>
      </main>
    );
  }

  // ---------- Ro'yxat ----------
  // Premium responsive grid: katta desktopda 3, oddiy desktop/planshetda 2,
  // telefonda 1 ustun. Kartalar `h-full flex-col` — matn uzunligidan qat'i
  // nazar bir xil balandlikda ko'rinadi, pastki qator esa `mt-auto` bilan
  // doim eng pastda turadi. Bitta yangilik bo'lsa karta butun ekran
  // kengligiga cho'zilmaydi (`max-w-md` bilan markazda qoladi).
  const items = news || [];
  const single = items.length === 1;

  // Kenglik butun sayt bilan bir xil (2026-09): menyu, footer va qolgan
  // sahifalar 1800px. Bu sahifa 1200px edi va katta ekranda menyudan tor
  // bo'lib, ikki yoni bo'sh qolardi. Kartalar allaqachon `xl:grid-cols-3`
  // — keng ekranda uchtadan joylashadi va bo'shliq to'ladi.
  return (
    <main className="mx-auto w-full max-w-[1800px] px-4 pb-20 sm:px-6 lg:px-14" style={{ color: 'var(--vz-ink)' }}>
      <section className="pt-10 sm:pt-14">
        <span className="vz-kicker">{t('Yangiliklar')}</span>
        <h1 className="vz-h2 mt-3">{t('NFCSTORE')} {t('yangiliklari')}</h1>
        <p className="vz-lead mt-4">
          {t("Ishga tushirish sanasi, yangi ID'lar, aksiyalar va platforma yangiliklari shu yerda e'lon qilinadi.")}
        </p>
      </section>

      <section className="mt-10">
        {err && (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-[14px] border p-8 text-center" style={{ borderColor: 'rgba(229,72,77,.45)', background: 'rgba(229,72,77,.06)' }}>
            <div className="text-sm font-semibold" style={{ color: '#ff7b81' }}>{t("Yangiliklarni yuklab bo'lmadi.")}</div>
            <div className="text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t("Server bilan aloqa yo'q.")}</div>
            <button type="button" className="btn btn-outline-gold btn-sm" onClick={load}>{t('Qayta urinish')}</button>
          </div>
        )}
        {!err && news === null && (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="vz-card min-w-0 overflow-hidden">
                <div className="vz-skel aspect-[16/9] w-full rounded-none" />
                <div className="p-5">
                  <div className="vz-skel h-3 w-24" />
                  <div className="vz-skel mt-4 h-5 w-2/3" />
                  <div className="vz-skel mt-4 h-3" />
                  <div className="vz-skel mt-2 h-3 w-5/6" />
                </div>
              </div>
            ))}
            <span className="sr-only">{t('Yuklanmoqda...')}</span>
          </div>
        )}
        {!err && news !== null && items.length === 0 && (
          <div className="vz-empty">
            <div className="text-sm font-semibold" style={{ color: 'var(--vz-ink)' }}>{t('Hozircha yangiliklar yo‘q.')}</div>
            <div className="text-xs">{t("Yangi e'lonlar shu yerda paydo bo'ladi.")}</div>
          </div>
        )}
        {likeErr && <div role="alert" className="vz-err mb-4">{likeErr}</div>}

        {items.length > 0 && (
          <div className={single ? 'mx-auto w-full max-w-md' : 'grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3'}>
            {items.map((item) => {
              const href = `/yangiliklar/${item.id}`;
              const body = pick(item, 'body', lang);
              return (
                <article
                  key={item.id}
                  className="vz-card flex h-full min-w-0 flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5"
                  style={{ borderColor: 'var(--vz-line)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,90,0.5)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--vz-line)'; }}
                >
                  <a href={href} onClick={(e) => go(e, href)} className="block aspect-[16/9] w-full overflow-hidden" aria-label={pick(item, 'title', lang)}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      // Rasm yo'q bo'lsa ham kartalar bir xil balandlikda qolsin
                      <span
                        className="flex h-full w-full items-center justify-center font-display text-sm tracking-[0.18em]"
                        style={{ background: 'linear-gradient(135deg,#1a1409,#0d0b07)', color: 'rgba(212,175,90,0.5)' }}
                        aria-hidden="true"
                      >
                        NFCSTORE
                      </span>
                    )}
                  </a>
                  <div className="flex min-w-0 flex-1 flex-col p-5">
                    <h2 className="line-clamp-3 break-words font-display text-lg font-semibold leading-snug">
                      <a href={href} onClick={(e) => go(e, href)} className="underline-offset-4 hover:underline">{pick(item, 'title', lang)}</a>
                    </h2>
                    {body && (
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed" style={{ color: 'var(--vz-ink-2)' }}>{body}</p>
                    )}
                    <div className="mt-auto pt-4">
                      {meta(item)}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <span className="flex items-center gap-1">
                          {likeBtn(item)}
                          {/* Har bir yangilikda avtomatik — alohida sozlash
                              talab qilmaydi. Ixcham holat: faqat belgi. */}
                          <ShareButton
                            url={newsUrl(item.id)}
                            title={pick(item, 'title', lang)}
                            text={shareExcerpt(body) || t('NFCSTORE yangiligi')}
                            className="btn btn-ghost-vz btn-sm px-2"
                          />
                        </span>
                        <a href={href} onClick={(e) => go(e, href)} className="vz-tap inline-flex items-center rounded-full text-sm font-semibold" style={{ color: 'var(--vz-gold)' }}>
                          {t("Batafsil o'qish")} →
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
