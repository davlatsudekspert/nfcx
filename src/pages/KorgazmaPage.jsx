import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../lib/i18n.jsx';
import { linkClick } from '../lib/router.js';
import {
  APP_APK_URL, APP_PAGE_PATH, APP_STORE_URL, APP_STORE_LIVE, PLAY_STORE_LIVE, PLAY_STORE_URL, appStoreBadge, isIos,
} from '../lib/appDownload.js';
import { formatUzs } from '../components/ShowcaseInfo.jsx';
import Linkify from '../components/Linkify.jsx';

// ═══════════════════════════════════════════════════════════════════════
// KO'RGAZMA — nfcstore.uz/korgazma (egasi, 2026-10: "Ko'rgazma sahifasini
// ham qil, sifatli, tartibli qil").
//
// Ilovadagi "Ko'rgazma" tabining sayt ko'rinishi: do'konlar va odamlarning
// ishlari — rasm, sarlavha, narx va havola bilan. TikTok nusxasi EMAS:
// sokin, tartibli to'r (kompyuterda 3, planshetda 2, telefonda 1 ustun),
// hamma kartochka bir xil 4:5 nisbatda.
//
// MA'LUMOT — ilova bilan BITTA manba:
//   GET /api/showcase?limit=12&video=1&cursor=…  → { items, hasMore, nextCursor }
//     (hosting/api/reels.js; maxfiylik, tekshiruvdagi media, bloklar o'sha
//     yerda). `video=1` — admin qo'ygan video reklama ham keladi.
//   GET /api/app/config → { flags: { showcase } } — kalit o'chiq bo'lsa
//     lenta o'rniga "tez kunda".
//
// QOIDALAR:
//   • "Ko'proq ko'rsatish" — TUGMA (cheksiz avtomatik aylantirish emas):
//     sahifa pastidagi ilova chaqiruvi va havolalarga yetib borsa bo'ladi.
//   • Reklama (ad: true) — xuddi shu kartochka, kichik "Reklama" belgisi.
//     Video faqat OVOZSIZ, kartochka kamida 60% ko'ringanda aylanadi, chiqib
//     ketganda to'xtaydi; ko'rinmaguncha umuman yuklanmaydi (preload=none).
//     "Harakatni kamaytirish" yoqilgan bo'lsa o'zi aylanmaydi.
//   • Musiqa saytda o'zi CHALINMAYDI — faqat "♪ nom · ijrochi" qatori.
//   • Tashqi havola yangi tabda, rel="noopener noreferrer nofollow".
//   • Kartochka bosilganda — shu sahifaning o'zida batafsil oyna (karusel,
//     to'liq matn), u yerdan post sahifasi (/post/:id) va muallif profili.
// ═══════════════════════════════════════════════════════════════════════

const PAGE_LIMIT = 12;

const CONTENT = {
  uz: {
    kicker: 'NFCSTORE ilovasidan',
    title: 'Ko‘rgazma',
    lead: 'Do‘konlar va odamlarning eng chiroyli ishlari — rasm, narx va havola bilan.',
    cta: 'Ilovani yuklab olish',
    more: 'Ko‘proq ko‘rsatish',
    loading: 'Yuklanmoqda…',
    ad: 'Reklama',
    photos: (n) => `${n} ta rasm`,
    video: 'Video',
    youtube: 'YouTube’da ko‘rish',
    instagram: 'Instagram’da ko‘rish',
    product: 'Mahsulotni ko‘rish',
    details: 'Batafsil ko‘rish',
    openPost: 'Post sahifasi',
    profile: 'Profilni ochish',
    close: 'Yopish',
    prev: 'Oldingi rasm',
    next: 'Keyingi rasm',
    slide: (i, n) => `${i}-rasm, jami ${n}`,
    likes: 'yoqtirish',
    comments: 'izoh',
    views: 'ko‘rish',
    music: 'Musiqa',
    sum: 'so‘m',
    errorT: 'Ko‘rgazmani yuklab bo‘lmadi',
    errorP: 'Internetni tekshirib, qayta urinib ko‘ring.',
    retry: 'Qayta urinish',
    moreError: 'Davomini yuklab bo‘lmadi.',
    emptyT: 'Ko‘rgazma hozircha bo‘sh',
    emptyP: 'Birinchi bo‘lib o‘z ishingizni qo‘ying — NFCSTORE ilovasida bir necha daqiqada.',
    soonT: 'Ko‘rgazma tez kunda',
    soonP: 'Bo‘lim tayyorlanmoqda. Hozircha NFCSTORE ilovasini yuklab oling — ochilganda birinchilardan bo‘lib ko‘rasiz.',
    end: 'Hammasi ko‘rsatildi',
    added: (n) => `Yana ${n} ta ish qo‘shildi`,
    footK: 'O‘z ishingizni ko‘rsating',
    footT: 'Ko‘rgazmaga o‘z ishingizni qo‘yish — NFCSTORE ilovasida',
    footP: '5 tagacha rasm, sarlavha, narx va YouTube yoki Instagram havolasi. Joylangan ishlar shu sahifada ham ko‘rinadi.',
    android: 'Android uchun yuklab olish',
    androidPlay: 'Google Play’dan yuklab olish',
    appStore: 'App Store',
    soon: appStoreBadge('uz'),
  },
  ru: {
    kicker: 'Из приложения NFCSTORE',
    title: 'Витрина',
    lead: 'Лучшие работы магазинов и людей — с фото, ценой и ссылкой.',
    cta: 'Скачать приложение',
    more: 'Показать ещё',
    loading: 'Загрузка…',
    ad: 'Реклама',
    photos: (n) => `Фото: ${n}`,
    video: 'Видео',
    youtube: 'Смотреть на YouTube',
    instagram: 'Смотреть в Instagram',
    product: 'Смотреть товар',
    details: 'Подробнее',
    openPost: 'Страница поста',
    profile: 'Открыть профиль',
    close: 'Закрыть',
    prev: 'Предыдущее фото',
    next: 'Следующее фото',
    slide: (i, n) => `Фото ${i} из ${n}`,
    likes: 'нравится',
    comments: 'комментарии',
    views: 'просмотры',
    music: 'Музыка',
    sum: 'сум',
    errorT: 'Не удалось загрузить Витрину',
    errorP: 'Проверьте интернет и попробуйте снова.',
    retry: 'Повторить',
    moreError: 'Не удалось загрузить продолжение.',
    emptyT: 'Витрина пока пуста',
    emptyP: 'Станьте первым — опубликуйте свою работу в приложении NFCSTORE за пару минут.',
    soonT: 'Витрина скоро откроется',
    soonP: 'Раздел готовится. А пока скачайте приложение NFCSTORE — увидите его одними из первых.',
    end: 'Показано всё',
    added: (n) => `Добавлено ещё работ: ${n}`,
    footK: 'Покажите свою работу',
    footT: 'Разместите свою работу в Витрине — в приложении NFCSTORE',
    footP: 'До 5 фото, название, цена и ссылка на YouTube или Instagram. Опубликованные работы появляются и на этой странице.',
    android: 'Скачать для Android',
    androidPlay: 'Скачать в Google Play',
    appStore: 'App Store',
    soon: appStoreBadge('ru'),
  },
  en: {
    kicker: 'From the NFCSTORE app',
    title: 'Showcase',
    lead: 'The best work from shops and people — with photos, prices and links.',
    cta: 'Download the app',
    more: 'Show more',
    loading: 'Loading…',
    ad: 'Ad',
    photos: (n) => `${n} photos`,
    video: 'Video',
    youtube: 'Watch on YouTube',
    instagram: 'View on Instagram',
    product: 'View product',
    details: 'View details',
    openPost: 'Post page',
    profile: 'Open profile',
    close: 'Close',
    prev: 'Previous photo',
    next: 'Next photo',
    slide: (i, n) => `Photo ${i} of ${n}`,
    likes: 'likes',
    comments: 'comments',
    views: 'views',
    music: 'Music',
    sum: 'UZS',
    errorT: 'Couldn’t load the Showcase',
    errorP: 'Check your connection and try again.',
    retry: 'Retry',
    moreError: 'Couldn’t load more.',
    emptyT: 'The Showcase is empty for now',
    emptyP: 'Be the first — post your work in the NFCSTORE app in a couple of minutes.',
    soonT: 'The Showcase is coming soon',
    soonP: 'We’re getting this section ready. Meanwhile, download the NFCSTORE app — you’ll be among the first to see it.',
    end: 'You’ve seen everything',
    added: (n) => `${n} more added`,
    footK: 'Show your work',
    footT: 'Put your work in the Showcase — in the NFCSTORE app',
    footP: 'Up to 5 photos, a title, a price and a YouTube or Instagram link. Published work also appears on this page.',
    android: 'Download for Android',
    androidPlay: 'Get it on Google Play',
    appStore: 'App Store',
    soon: appStoreBadge('en'),
  },
};

// ── Ma'lumotni kartochka shakliga keltirish ──────────────────────────────

// Kompaniya posti va shaxsiy post raqamlari alohida jadvalda — bir xil `id`
// ikkalasida ham bo'lishi mumkin. Kalit shuning uchun turi bilan.
const isCompanyPost = (p) => p?.authorKind === 'company' || p?.commentKind === 'company_post';
const itemKey = (p) => `${isCompanyPost(p) ? 'c' : 'p'}:${p?.id}`;

// Karusel rasmlari: mediaItems (yangi shakl) → mediaUrls → imageUrl.
function imagesOf(p) {
  const fromItems = Array.isArray(p?.mediaItems)
    ? p.mediaItems.filter((m) => m && m.url && m.type !== 'video').map((m) => String(m.url))
    : [];
  if (fromItems.length) return fromItems;
  const fromUrls = Array.isArray(p?.mediaUrls)
    ? p.mediaUrls.map(String).filter((u) => u && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u))
    : [];
  if (fromUrls.length) return fromUrls;
  return p?.imageUrl ? [String(p.imageUrl)] : [];
}

// Narx: postning o'zi, bo'lmasa katalog mahsulotiniki (ShowcaseInfo bilan bir xil).
function priceOf(p) {
  if (p?.priceUzs != null) return p.priceUzs;
  return p?.catalogItem?.priceUzs ?? null;
}

// Muallif sahifasi: kompaniya — /c/<ID>, shaxsiy NFC ID — /<KOD>.
function profileHref(p) {
  const code = String(p?.code || '').trim();
  if (!code) return '';
  return isCompanyPost(p) ? `/c/${encodeURIComponent(code)}` : `/${encodeURIComponent(code)}`;
}

// Ulashiladigan post sahifasi — ilova va Worker bilan bir xil manzil
// (hosting/worker.js postPageResponse): /post/<id>?code=<KOD>[&company=1].
function postHref(p) {
  const code = String(p?.code || '').toUpperCase();
  return `/post/${Number(p?.id)}?code=${encodeURIComponent(code)}${isCompanyPost(p) ? '&company=1' : ''}`;
}

// Havola tugmalari. Server havolani allaqachon tekshirgan (faqat https +
// YouTube/Instagram), lekin bu yerda ham faqat https qabul qilinadi.
//   katalog mahsuloti / nfcstore.uz → "Mahsulotni ko'rish" (ichki havola);
//   YouTube → "YouTube'da ko'rish"; Instagram → "Instagram'da ko'rish";
//   boshqa sayt → domen nomi.
function linkChips(p, c) {
  const chips = [];
  const item = p?.catalogItem;
  if (item && item.companyId) {
    chips.push({ kind: 'product', href: `/company/${encodeURIComponent(String(item.companyId).toLowerCase())}`, label: c.product, internal: true });
  }
  const raw = String(p?.linkUrl || '').trim();
  if (/^https:\/\//i.test(raw)) {
    let u = null;
    try { u = new URL(raw); } catch { /* buzuq havola — ko'rsatilmaydi */ }
    if (u) {
      const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
      if (host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) {
        chips.push({ kind: 'youtube', href: raw, label: c.youtube });
      } else if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
        chips.push({ kind: 'instagram', href: raw, label: c.instagram });
      } else if (host === 'nfcstore.uz' || host.endsWith('.nfcstore.uz')) {
        if (!chips.length) chips.push({ kind: 'product', href: (u.pathname || '/') + u.search, label: c.product, internal: true });
      } else {
        chips.push({ kind: 'web', href: raw, label: host });
      }
    }
  }
  return chips;
}

function musicLine(p) {
  const m = p?.music;
  if (!m || !m.title) return '';
  return [String(m.title).trim(), String(m.artist || '').trim()].filter(Boolean).join(' · ');
}

// Rasmga alt: sarlavha, bo'lmasa izohning boshi, bo'lmasa muallif.
function altOf(p, c) {
  const title = String(p?.title || '').trim();
  if (title) return title;
  const cap = String(p?.caption || '').replace(/\s+/g, ' ').trim();
  if (cap) return cap.length > 120 ? `${cap.slice(0, 117)}…` : cap;
  return `${String(p?.name || '').trim() || 'NFCSTORE'} — ${c.title}`;
}

const compact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(v);
};

async function getJson(url, signal) {
  const r = await fetch(url, { credentials: 'same-origin', signal, headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// ── Belgilar (SVG) ───────────────────────────────────────────────────────

const svg = (d, cls = 'h-4 w-4', extra = {}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden="true" {...extra}>
    <path d={d} />
  </svg>
);
const ICON = {
  youtube: 'M3 8.2c0-1.6 1.2-2.9 2.8-3C7.7 5 9.8 5 12 5s4.3 0 6.2.2c1.6.1 2.8 1.4 2.8 3v7.6c0 1.6-1.2 2.9-2.8 3-1.9.2-4 .2-6.2.2s-4.3 0-6.2-.2C4.2 18.7 3 17.4 3 15.8zM10 9.2v5.6l4.8-2.8z',
  instagram: 'M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.2 6.8h.01',
  product: 'M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8',
  web: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  comment: 'M4 5h16v11H9l-5 4z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  play: 'M8 5.5v13l10.5-6.5z',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  arrow: 'M7 17L17 7M9 7h8v8',
  stack: 'M8 8h11v12H8zM5 16V4h11',
};

const PlayMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="currentColor" d="M4.5 2.8 13.9 12l-9.4 9.2c-.3-.2-.5-.6-.5-1V3.8c0-.4.2-.8.5-1zm10.6 10.4 2.3 2.2-10.6 6 8.3-8.2zm4.3-3.4c.9.5.9 1.8 0 2.3l-2.5 1.4L14.5 12l2.4-2.3 2.5 1.4zM6.8 2.6l10.6 6-2.3 2.2-8.3-8.2z" /></svg>
);
const AppleMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-1-2.4-3.9zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z" /></svg>
);

// Fokus halqasi — saytdagi menyu bilan bir xil oltin chiziq.
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vz-gold)]';

// ── Kichik bo'laklar ─────────────────────────────────────────────────────

function Avatar({ src, name, size = 'h-8 w-8' }) {
  const [broken, setBroken] = useState(false);
  const letter = (String(name || '').trim().charAt(0) || '•').toUpperCase();
  if (src && !broken) {
    return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className={`${size} shrink-0 rounded-full object-cover ring-1 ring-[color:var(--vz-line)]`} />;
  }
  return (
    <span aria-hidden="true" className={`${size} flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-a14)] text-[13px] font-bold text-[color:var(--accent-text)] ring-1 ring-[color:var(--vz-line)]`}>
      {letter}
    </span>
  );
}

function AuthorRow({ p, c, className = '' }) {
  const href = profileHref(p);
  const name = String(p?.name || '').trim() || String(p?.code || '').toUpperCase();
  const inner = (
    <>
      <Avatar src={p?.avatarUrl} name={name} />
      <span className="min-w-0 truncate text-[14px] font-semibold text-[color:var(--vz-ink)]">{name}</span>
    </>
  );
  if (!href) return <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>{inner}</div>;
  return (
    <a
      href={href}
      onClick={linkClick(href)}
      title={c.profile}
      className={`flex min-h-9 min-w-0 items-center gap-2.5 rounded-full no-underline transition-opacity hover:opacity-80 ${FOCUS} ${className}`}
    >
      {inner}
    </a>
  );
}

function Chips({ chips, size = 'sm' }) {
  if (!chips.length) return null;
  const h = size === 'lg' ? 'min-h-11 gap-1.5 px-4 text-[14px]' : 'min-h-9 gap-1 px-2.5 text-[12.5px]';
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((ch) => (
        <a
          key={`${ch.kind}:${ch.href}`}
          href={ch.href}
          {...(ch.internal
            ? { onClick: linkClick(ch.href) }
            : { target: '_blank', rel: 'noopener noreferrer nofollow' })}
          className={`inline-flex max-w-full items-center rounded-full border border-[color:var(--vz-line)] font-semibold text-[color:var(--vz-ink)] no-underline transition-colors hover:border-[color:var(--vz-gold-2)] hover:text-[color:var(--vz-gold-2)] ${h} ${FOCUS}`}
        >
          {svg(ICON[ch.kind] || ICON.web, 'h-4 w-4 shrink-0')}
          <span className="truncate">{ch.label}</span>
          {!ch.internal && svg(ICON.arrow, 'h-3 w-3 shrink-0 opacity-60')}
        </a>
      ))}
    </div>
  );
}

function PriceText({ p, c, className = '' }) {
  const price = priceOf(p);
  const text = price != null ? formatUzs(price) : '';
  if (!text) return null;
  return <div className={`font-bold tabular-nums text-[color:var(--vz-gold-2)] ${className}`}>{text} {c.sum}</div>;
}

function MusicText({ p, c, className = '' }) {
  const line = musicLine(p);
  if (!line) return null;
  return (
    <div className={`flex min-w-0 items-center gap-1.5 text-[13px] text-[color:var(--vz-ink-3)] ${className}`}>
      <span aria-hidden="true">♪</span>
      <span className="sr-only">{c.music}: </span>
      <span className="truncate">{line}</span>
    </div>
  );
}

// REKLAMA VIDEOSI — ovozsiz, takrorlanadi, faqat kamida 60% ko'ringanda.
// Ko'rinmaguncha `preload="none"`: sahifa ochilganda mp4 yuklanmaydi.
function AdVideo({ src, poster, label, className = '' }) {
  const ref = useRef(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    v.muted = true;
    v.defaultMuted = true;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return undefined;
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      if (e.isIntersecting && e.intersectionRatio >= 0.6) {
        setArmed(true);
        v.muted = true;
        const pr = v.play();
        if (pr && typeof pr.catch === 'function') pr.catch(() => { /* brauzer ruxsat bermadi — poster qoladi */ });
      } else if (!v.paused) {
        v.pause();
      }
    }, { threshold: [0, 0.6, 1] });
    io.observe(v);
    return () => { io.disconnect(); try { v.pause(); } catch { /* jim */ } };
  }, [src]);
  return (
    <video
      ref={ref}
      src={src}
      poster={poster || undefined}
      muted
      loop
      playsInline
      disablePictureInPicture
      preload={armed ? 'auto' : 'none'}
      aria-label={label}
      className={className}
    />
  );
}

// ── Kartochka ────────────────────────────────────────────────────────────

function ShowcaseCard({ p, c, onOpen }) {
  const images = imagesOf(p);
  const video = String(p?.videoUrl || '').trim();
  const cover = images[0] || p?.imageUrl || '';
  const alt = altOf(p, c);
  const chips = linkChips(p, c);
  const title = String(p?.title || '').trim();
  const caption = String(p?.caption || '').trim();
  const reduced = video && prefersReducedMotion();
  const [imgBroken, setImgBroken] = useState(false);

  return (
    <article className="vz-card group flex min-w-0 flex-col overflow-hidden" data-testid="korgazma-card">
      <div className="relative">
        <button
          type="button"
          onClick={(e) => onOpen(p, e.currentTarget)}
          aria-label={`${c.details}: ${alt}`}
          className={`relative block aspect-[4/5] w-full cursor-pointer overflow-hidden bg-[color:var(--vz-card-2)] ${FOCUS} focus-visible:outline-offset-[-3px]`}
        >
          {video ? (
            <AdVideo src={video} poster={p?.imageUrl} label={alt} className="h-full w-full object-cover" />
          ) : cover && !imgBroken ? (
            <img
              src={cover}
              alt={alt}
              loading="lazy"
              decoding="async"
              onError={() => setImgBroken(true)}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center p-6 text-center font-display text-[20px] text-[color:var(--vz-ink-3)]">{title || c.title}</span>
          )}
          {reduced && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">{svg(ICON.play, 'h-6 w-6', { fill: 'currentColor', stroke: 'none' })}</span>
            </span>
          )}
        </button>
        <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
          {p?.ad ? (
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm" data-testid="korgazma-ad">{c.ad}</span>
          ) : <span />}
          {images.length > 1 && !video && (
            <span className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-white backdrop-blur-sm">
              {svg(ICON.stack, 'h-3.5 w-3.5')}
              <span aria-hidden="true">1/{images.length}</span>
              <span className="sr-only">{c.photos(images.length)}</span>
            </span>
          )}
          {video && (
            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[12px] font-semibold text-white backdrop-blur-sm">{c.video}</span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <AuthorRow p={p} c={c} className="self-start" />
        {title && (
          <h2 className="text-[17px] font-semibold leading-snug text-[color:var(--vz-ink)]">
            <button type="button" onClick={(e) => onOpen(p, e.currentTarget)} className={`line-clamp-2 cursor-pointer rounded text-left hover:text-[color:var(--vz-gold-2)] ${FOCUS}`}>
              {title}
            </button>
          </h2>
        )}
        <PriceText p={p} c={c} className="text-[16px]" />
        {caption && <p className="line-clamp-2 text-[14.5px] leading-relaxed text-[color:var(--vz-ink-2)]">{caption}</p>}
        <MusicText p={p} c={c} />
        {chips.length > 0 && <div className="pt-1"><Chips chips={chips} /></div>}
        {/* Pastki qator — har kartochkada bir xil joyda (matnsiz ishda ham
            kartochka bo'sh qolib ketmaydi, qatorlar tekis turadi). */}
        <div className="mt-auto flex items-center gap-4 border-t border-[color:var(--vz-line)] pt-3 text-[13px] tabular-nums text-[color:var(--vz-ink-3)]">
          <span className="flex items-center gap-1.5">{svg(ICON.heart, 'h-4 w-4')}{compact(p?.likeCount)}<span className="sr-only"> {c.likes}</span></span>
          <span className="flex items-center gap-1.5">{svg(ICON.comment, 'h-4 w-4')}{compact(p?.commentCount)}<span className="sr-only"> {c.comments}</span></span>
          <span className="flex items-center gap-1.5">{svg(ICON.eye, 'h-4 w-4')}{compact(p?.viewCount)}<span className="sr-only"> {c.views}</span></span>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  const bar = 'bg-[color:color-mix(in_srgb,var(--vz-ink)_9%,transparent)]';
  return (
    <div className="vz-card flex flex-col overflow-hidden motion-safe:animate-pulse" aria-hidden="true">
      <div className="aspect-[4/5] w-full bg-[color:color-mix(in_srgb,var(--vz-ink)_7%,transparent)]" />
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-2.5"><span className={`h-8 w-8 rounded-full ${bar}`} /><span className={`h-3.5 w-28 rounded-md ${bar}`} /></div>
        <span className={`h-4 w-4/5 rounded-md ${bar}`} />
        <span className={`h-3.5 w-2/5 rounded-md ${bar}`} />
        <span className={`h-3 w-full rounded-md ${bar}`} />
      </div>
    </div>
  );
}

// ── Batafsil oyna (karusel + to'liq matn) ────────────────────────────────

function ShowcaseViewer({ p, c, onClose }) {
  const images = imagesOf(p);
  const video = String(p?.videoUrl || '').trim();
  const [idx, setIdx] = useState(0);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const touch = useRef(null);
  const count = video ? 1 : images.length;
  const title = String(p?.title || '').trim();
  const caption = String(p?.caption || '').trim();
  const chips = linkChips(p, c);
  const alt = altOf(p, c);
  const go = useCallback((d) => setIdx((i) => (count ? (i + d + count) % count : 0)), [count]);

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowLeft' && count > 1) { e.preventDefault(); go(-1); return; }
      if (e.key === 'ArrowRight' && count > 1) { e.preventDefault(); go(1); return; }
      // Fokus oyna ichida aylanadi (Tab / Shift+Tab).
      if (e.key === 'Tab' && panelRef.current) {
        const f = [...panelRef.current.querySelectorAll('a[href],button:not([disabled]),video[controls],[tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, go, count]);

  const onTouchStart = (e) => { const t0 = e.touches[0]; touch.current = { x: t0.clientX, y: t0.clientY }; };
  const onTouchEnd = (e) => {
    const s = touch.current; touch.current = null;
    if (!s || count < 2) return;
    const t1 = e.changedTouches[0];
    const dx = t1.clientX - s.x; const dy = t1.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  const navBtn = `absolute top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 ${FOCUS}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/80 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="korgazma-viewer"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="korgazma-viewer-title"
        className="relative flex max-h-[100dvh] w-full max-w-[1040px] flex-col overflow-y-auto bg-[color:var(--vz-bg)] sm:max-h-[92vh] sm:overflow-hidden sm:rounded-[var(--vz-radius)] sm:border sm:border-[color:var(--vz-line)] md:grid md:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={c.close}
          className={`absolute right-3 top-3 z-[3] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 ${FOCUS}`}
        >
          {svg(ICON.close, 'h-5 w-5')}
        </button>

        {/* MEDIA — rasm to'liq ko'rinadi (kesilmaydi), fon qora. */}
        <div className="relative flex aspect-[4/5] max-h-[70vh] w-full shrink-0 items-center justify-center bg-black md:aspect-auto md:h-full md:max-h-[92vh] md:min-h-[520px]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {video ? (
            // Foydalanuvchi o'zi ochdi — ovozsiz boshlanadi, ovozni o'zi yoqadi.
            <video src={video} poster={p?.imageUrl || undefined} controls muted autoPlay={!prefersReducedMotion()} loop playsInline className="h-full max-h-full w-full object-contain" aria-label={alt} />
          ) : images.length ? (
            <img key={images[idx]} src={images[idx]} alt={count > 1 ? `${alt} — ${c.slide(idx + 1, count)}` : alt} decoding="async" className="h-full max-h-full w-full object-contain" />
          ) : null}
          {count > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={c.prev} className={`${navBtn} left-3`}>{svg(ICON.chevL, 'h-5 w-5')}</button>
              <button type="button" onClick={() => go(1)} aria-label={c.next} className={`${navBtn} right-3`}>{svg(ICON.chevR, 'h-5 w-5')}</button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/35 px-1.5 py-1 backdrop-blur-sm">
                {images.map((u, i) => (
                  <button
                    key={u + i}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={c.slide(i + 1, count)}
                    aria-current={i === idx ? 'true' : undefined}
                    className={`flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-full ${FOCUS}`}
                  >
                    <span className={`block h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/55'}`} />
                  </button>
                ))}
              </div>
            </>
          )}
          {p?.ad && (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm">{c.ad}</span>
          )}
        </div>

        {/* MATN */}
        <div className="flex min-h-0 flex-col gap-3 p-5 sm:p-7 md:overflow-y-auto">
          <AuthorRow p={p} c={c} className="self-start pr-12 md:pr-14" />
          <h2 id="korgazma-viewer-title" className="font-display text-[24px] font-semibold leading-tight text-[color:var(--vz-ink)]">
            {title || String(p?.name || '').trim() || c.title}
          </h2>
          <PriceText p={p} c={c} className="text-[19px]" />
          {caption && (
            <p className="whitespace-pre-wrap break-words text-[15.5px] leading-relaxed text-[color:var(--vz-ink-2)]"><Linkify text={caption} /></p>
          )}
          <MusicText p={p} c={c} className="text-[14px]" />
          {chips.length > 0 && <div className="pt-1"><Chips chips={chips} size="lg" /></div>}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--vz-line)] pt-4">
            <ul className="flex items-center gap-4 text-[13.5px] tabular-nums text-[color:var(--vz-ink-3)]">
              <li className="flex items-center gap-1.5">{svg(ICON.heart, 'h-4 w-4')}<span>{compact(p?.likeCount)}</span><span className="sr-only"> {c.likes}</span></li>
              <li className="flex items-center gap-1.5">{svg(ICON.comment, 'h-4 w-4')}<span>{compact(p?.commentCount)}</span><span className="sr-only"> {c.comments}</span></li>
              <li className="flex items-center gap-1.5">{svg(ICON.eye, 'h-4 w-4')}<span>{compact(p?.viewCount)}</span><span className="sr-only"> {c.views}</span></li>
            </ul>
            <a href={postHref(p)} className={`btn btn-ghost-vz min-h-11 px-5 text-[14px] no-underline ${FOCUS}`} data-testid="korgazma-post-link">
              {c.openPost} →
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Ilova tugmalari (pastki chaqiruv) ────────────────────────────────────

function StoreButtons({ c }) {
  const ios = isIos();
  const androidHref = PLAY_STORE_LIVE ? PLAY_STORE_URL : APP_APK_URL;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!ios && (
        <a href={androidHref} rel="noopener noreferrer" target={PLAY_STORE_LIVE ? '_blank' : undefined} className={`btn btn-gold min-h-[52px] gap-2.5 px-7 text-[15px] no-underline ${FOCUS}`} data-testid="korgazma-android">
          <PlayMark />{PLAY_STORE_LIVE ? c.androidPlay : c.android}
        </a>
      )}
      {APP_STORE_LIVE ? (
        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={`btn btn-outline min-h-[52px] gap-2.5 rounded-full px-6 text-[15px] no-underline ${FOCUS}`}><AppleMark />{c.appStore}</a>
      ) : (
        <span className="inline-flex min-h-[52px] cursor-default items-center gap-2.5 rounded-full border border-[color:var(--vz-line)] px-6 text-[15px] font-semibold text-[color:var(--vz-ink-2)]" aria-disabled="true">
          <AppleMark />{c.appStore}
          <span className="rounded-full bg-[var(--accent-a14)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--accent-text)]">{c.soon}</span>
        </span>
      )}
    </div>
  );
}

// Bo'sh / xato / "tez kunda" holatlari uchun bitta sokin blok.
function StateBlock({ title, text, children, testid }) {
  return (
    <div className="vz-card mx-auto flex max-w-[640px] flex-col items-center gap-4 px-6 py-12 text-center sm:px-10" data-testid={testid} role="status">
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--vz-line)] text-[color:var(--accent-text)]">
        {svg('M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z', 'h-6 w-6')}
      </span>
      <h2 className="font-display text-[24px] font-semibold text-[color:var(--vz-ink)]">{title}</h2>
      <p className="max-w-[46ch] text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{text}</p>
      {children}
    </div>
  );
}

// ── Sahifa ───────────────────────────────────────────────────────────────

export default function KorgazmaPage() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.uz;
  const [status, setStatus] = useState('loading'); // loading | ready | error | soon
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [more, setMore] = useState('idle'); // idle | loading | error
  const [announce, setAnnounce] = useState('');
  const [open, setOpen] = useState(null);
  const openerRef = useRef(null);
  const seen = useRef(new Set());
  const abortRef = useRef(null);

  const appendPage = useCallback((data, reset) => {
    const list = Array.isArray(data?.items) ? data.items : [];
    if (reset) seen.current = new Set();
    const fresh = [];
    for (const it of list) {
      if (!it || it.id == null) continue;
      const k = itemKey(it);
      if (seen.current.has(k)) continue;
      seen.current.add(k);
      fresh.push(it);
    }
    setItems((prev) => (reset ? fresh : [...prev, ...fresh]));
    const next = data?.nextCursor || data?.cursor || null;
    setCursor(next);
    setHasMore(Boolean(data?.hasMore && next));
    return fresh.length;
  }, []);

  const loadFirst = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus('loading');
    setMore('idle');
    try {
      // Kalit so'rovi yiqilsa lenta baribir ko'rsatiladi (kalit standart — yoqiq).
      const [config, feed] = await Promise.all([
        getJson('/api/app/config', ac.signal).catch((e) => { if (e?.name === 'AbortError') throw e; return null; }),
        getJson(`/api/showcase?limit=${PAGE_LIMIT}&video=1`, ac.signal),
      ]);
      if (ac.signal.aborted) return;
      if (config?.flags && config.flags.showcase === false) { setStatus('soon'); return; }
      appendPage(feed, true);
      setStatus('ready');
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setStatus('error');
    }
  }, [appendPage]);

  useEffect(() => {
    loadFirst();
    return () => abortRef.current?.abort();
  }, [loadFirst]);

  const loadMore = async () => {
    if (!cursor || more === 'loading') return;
    setMore('loading');
    try {
      const data = await getJson(`/api/showcase?limit=${PAGE_LIMIT}&video=1&cursor=${encodeURIComponent(cursor)}`);
      const n = appendPage(data, false);
      setAnnounce(c.added(n));
      setMore('idle');
    } catch {
      setMore('error');
    }
  };

  const openViewer = useCallback((p, el) => { openerRef.current = el || null; setOpen(p); }, []);
  const closeViewer = useCallback(() => {
    setOpen(null);
    const el = openerRef.current;
    openerRef.current = null;
    if (el && typeof el.focus === 'function') setTimeout(() => el.focus(), 0);
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 pb-20 sm:px-10 lg:px-14">
      <div className="mx-auto w-full max-w-[1240px]">
        {/* ── SARLAVHA ── */}
        <header className="flex flex-col gap-5 pt-10 md:flex-row md:items-end md:justify-between md:gap-10 md:pt-14">
          <div className="flex min-w-0 flex-col items-start gap-4">
            <span className="vz-kicker">{c.kicker}</span>
            <h1 className="vz-h1 text-[color:var(--vz-ink)]">{c.title}</h1>
            <p className="max-w-[52ch] text-[17px] leading-relaxed text-[color:var(--vz-ink-2)]">{c.lead}</p>
          </div>
          <a
            href={APP_PAGE_PATH}
            onClick={linkClick(APP_PAGE_PATH)}
            className={`btn btn-outline-gold min-h-11 shrink-0 gap-2 self-start px-5 text-[14px] no-underline md:self-auto ${FOCUS}`}
            data-testid="korgazma-app-cta"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2" /></svg>
            {c.cta}
          </a>
        </header>

        <div className="mt-8 h-px bg-[color:var(--vz-line)] md:mt-10" />

        {/* ── LENTA ── */}
        <section className="mt-8 md:mt-10" aria-label={c.title} aria-busy={status === 'loading' || more === 'loading'}>
          {status === 'loading' && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
              <span className="sr-only" role="status">{c.loading}</span>
            </div>
          )}

          {status === 'error' && (
            <StateBlock title={c.errorT} text={c.errorP} testid="korgazma-error">
              <button type="button" onClick={loadFirst} className={`btn btn-gold min-h-11 px-6 ${FOCUS}`}>{c.retry}</button>
            </StateBlock>
          )}

          {status === 'soon' && (
            <StateBlock title={c.soonT} text={c.soonP} testid="korgazma-soon">
              <StoreButtons c={c} />
            </StateBlock>
          )}

          {status === 'ready' && items.length === 0 && (
            <StateBlock title={c.emptyT} text={c.emptyP} testid="korgazma-empty">
              <StoreButtons c={c} />
            </StateBlock>
          )}

          {status === 'ready' && items.length > 0 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6" data-testid="korgazma-grid">
                {items.map((p) => <ShowcaseCard key={itemKey(p)} p={p} c={c} onOpen={openViewer} />)}
              </div>
              <div className="mt-10 flex flex-col items-center gap-3">
                {hasMore ? (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={more === 'loading'}
                    className={`btn btn-ghost-vz min-h-12 min-w-[220px] px-8 text-[15px] ${FOCUS}`}
                    data-testid="korgazma-more"
                  >
                    {more === 'loading' ? (<><span className="loading loading-spinner loading-sm" aria-hidden="true" />{c.loading}</>) : c.more}
                  </button>
                ) : (
                  <p className="text-[14px] text-[color:var(--vz-ink-3)]">{c.end}</p>
                )}
                {more === 'error' && <p className="text-[14px] text-[color:var(--vz-ink-2)]" role="alert">{c.moreError}</p>}
                <span className="sr-only" aria-live="polite">{announce}</span>
              </div>
            </>
          )}
        </section>

        {/* ── ILOVA CHAQIRUVI ── */}
        {status !== 'soon' && (
          <section className="vz-card relative mt-16 overflow-hidden p-6 sm:p-10 md:mt-20" data-testid="korgazma-footer-cta">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,var(--accent-a14),transparent)]" />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-10">
              <div className="flex max-w-[60ch] flex-col items-start gap-3">
                <span className="vz-kicker">{c.footK}</span>
                <h2 className="font-display text-[clamp(24px,2.6vw,32px)] font-semibold leading-tight text-[color:var(--vz-ink)]">{c.footT}</h2>
                <p className="text-[15.5px] leading-relaxed text-[color:var(--vz-ink-2)]">{c.footP}</p>
              </div>
              <div className="shrink-0"><StoreButtons c={c} /></div>
            </div>
          </section>
        )}
      </div>

      {open && <ShowcaseViewer key={itemKey(open)} p={open} c={c} onClose={closeViewer} />}
    </main>
  );
}
