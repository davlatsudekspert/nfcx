import { useState } from 'react';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { useAuth } from '../lib/auth.jsx';
import { tierForCode, TIER_LABEL, TIER_COLOR } from '../lib/pricing.js';
import { initials } from '../lib/format.js';

// 1/2/3-o'rin uchun maxsus medal ranglari.
const MEDAL = {
  1: { emoji: '\u{1F947}', ring: '#f5c518', label: '1-o\u2019rin' },
  2: { emoji: '\u{1F948}', ring: '#c7ccd6', label: '2-o\u2019rin' },
  3: { emoji: '\u{1F949}', ring: '#cd7f32', label: '3-o\u2019rin' },
};

function TopCard({ rank, item }) {
  const { t } = useLanguage();
  const m = MEDAL[rank];
  const tier = item.tierOverride || tierForCode(item.code);
  const big = rank === 1;
  return (
    <button
      onClick={() => navigate('/' + item.code)}
      className={`flex cursor-pointer flex-col items-center rounded-2xl border p-5 text-center transition hover:-translate-y-1 ${big ? 'sm:scale-110' : ''}`}
      style={{ borderColor: `${m.ring}55`, background: `linear-gradient(180deg, ${m.ring}14, transparent 60%)` }}
    >
      <div className="text-3xl">{m.emoji}</div>
      <div
        className="mt-2 flex h-16 w-16 items-center justify-center rounded-full text-xl font-extrabold"
        style={{ background: `${m.ring}22`, color: m.ring, border: `2px solid ${m.ring}` }}
      >
        {initials(item.name)}
      </div>
      <div className="mt-3 max-w-[140px] truncate font-semibold">{item.name}</div>
      <div className="mt-0.5 font-mono text-xs text-base-content/50">{item.code}</div>
      <div className="mt-2 text-lg font-extrabold" style={{ color: m.ring }}>{fmt(item.views || 0)}</div>
      <div className="text-[13px] uppercase tracking-widest text-base-content/40">{t("ko'rish")}</div>
      <span className="mt-2 text-[14px] font-semibold" style={{ color: TIER_COLOR[tier] }}>{t(TIER_LABEL[tier])}</span>
    </button>
  );
}

// 4-o'rindan boshlab — jadval EMAS, alohida kartochka qatori.
// Chapda o'rin raqami (doira), ism va ID (oltin, monospace); o'ngda
// ko'rishlar soni katta raqamda va uning ostida eng yuqori natijaga
// nisbatan to'ldirilgan yupqa progress-bar; eng chetda tarif chipi.
function RankRow({ rank, item, maxViews }) {
  const { t } = useLanguage();
  const tier = item.tierOverride || tierForCode(item.code);
  const tc = TIER_COLOR[tier] || '#8a8a8a';
  const views = Number(item.views) || 0;
  // Eng kam 2% — 0 ga yaqin natijalarda ham chiziq ko'rinib tursin.
  const pct = maxViews > 0 ? Math.max(2, Math.round((views / maxViews) * 100)) : 0;
  return (
    <button type="button" className="rank-row" onClick={() => navigate('/' + item.code)}>
      <span className="rank-no">{rank}</span>
      <span className="rank-who">
        <span className="rank-name block">{item.name}</span>
        <span className="rank-id block">{item.code}</span>
      </span>
      <span className="rank-views">
        <span className="rank-num block">{fmt(views)}</span>
        <span className="rank-cap block">{t("ko'rish")}</span>
        <span className="rank-bar block" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
      </span>
      <span className="rank-chip" style={{ color: tc, background: tc + '1f', border: `1px solid ${tc}44` }}>
        {t(TIER_LABEL[tier] || tier)}
      </span>
    </button>
  );
}

export default function RankingPage({ catalog }) {
  const { t } = useLanguage();
  const { user, myCards } = useAuth();
  // 11-o'rindan keyingilar yashirin turadi (akkordeon).
  const [expanded, setExpanded] = useState(false);
  const top = [...catalog].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 30);
  const [first, second, third, ...rest] = top;
  const maxViews = Number(first?.views) || 0;
  // 4-10 o'rinlar ochiq, qolganlari akkordeon ichida.
  const visible = rest.slice(0, 7);
  const hidden = rest.slice(7);
  // "O'z reytingimni tekshirish" — kirgan foydalanuvchini o'z profiliga
  // (u yerda ko'rishlar soni turadi), mehmonni ro'yxatdan o'tishga olib
  // boradi.
  const myCode = Array.isArray(myCards) && myCards.length ? myCards[0].code : null;
  const checkMine = () => navigate(user && myCode ? '/' + myCode : '/register');

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 pb-16 pt-14 sm:px-10 lg:px-14">
      <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
        {t('Reyting')}
      </span>
      <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight">
        {t("Eng ko'p ko'rilgan")} <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">{t('profillar')}</span>
      </h1>
      <p className="mt-3 max-w-xl text-[15px] text-base-content/60">{t("Ko'rishlar soniga qarab tuzilgan jonli reyting.")}</p>

      {top.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/15 p-10 text-center text-base-content/45">{t("Hozircha ma'lumot yo'q.")}</div>
      ) : (
        <>
          {/* Top-3 — maxsus medal dizayni bilan */}
          <div className="mt-12 grid items-end gap-4 sm:grid-cols-3">
            {second && <TopCard rank={2} item={second} />}
            {first && <TopCard rank={1} item={first} />}
            {third && <TopCard rank={3} item={third} />}
          </div>

          {/* 4-10 o'rinlar — kartochka qatorlari (jadval o'rniga). */}
          {visible.length > 0 && (
            <div className="mt-12 flex flex-col gap-2.5">
              {visible.map((it, i) => (
                <RankRow key={it.code} rank={i + 4} item={it} maxViews={maxViews} />
              ))}
            </div>
          )}

          {/* 11-o'rindan keyingilar — akkordeon. */}
          {hidden.length > 0 && (
            <>
              <div className="rank-more mt-2.5" data-open={expanded ? '1' : '0'}>
                <div>
                  <div className="flex flex-col gap-2.5 pt-0.5">
                    {hidden.map((it, i) => (
                      <RankRow key={it.code} rank={i + 11} item={it} maxViews={maxViews} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--vz-gold,#d4af5a)]/45 bg-transparent px-5 py-2 text-[15px] font-semibold text-[color:var(--vz-gold-2,#f0cf7a)] transition hover:border-[color:var(--vz-gold,#d4af5a)] hover:bg-[color:var(--vz-gold,#d4af5a)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vz-gold,#d4af5a)]"
                >
                  {expanded ? t('Yashirish') : t("Yana {n} ta ishtirokchini ko'rish", { n: fmt(hidden.length) })}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .25s ease' }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>
            </>
          )}

          {/* Motivatsion CTA — reyting ro'yxatidan keyin alohida blok. */}
          <div className="rank-cta mt-14">
            <h2 className="vz-h2 mx-auto max-w-xl !text-[clamp(22px,3vw,32px)]">{t("Sizning ID'ingiz hali reytingda yo'qmi?")}</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] text-base-content/60">{t("Profilingizni ulashing va TOP-10'ga kiring.")}</p>
            <button type="button" className="btn btn-gold mt-6 px-7" onClick={checkMine}>
              {t("O'z reytingimni tekshirish")}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
