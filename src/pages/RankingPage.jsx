import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
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

export default function RankingPage({ catalog }) {
  const { t } = useLanguage();
  const top = [...catalog].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 30);
  const [first, second, third, ...rest] = top;

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

          {/* Qolganlari — oddiy jadval */}
          {rest.length > 0 && (
            <div className="mt-12 overflow-x-auto rounded-2xl border border-white/10">
              <table className="table table-sm">
                <thead>
                  <tr><th>{t("O'rni")}</th><th>{t('Ismi')}</th><th>ID</th><th>{t("Ko'rishlar")}</th><th>{t('Tarifi')}</th></tr>
                </thead>
                <tbody>
                  {rest.map((it, i) => {
                    const tier = it.tierOverride || tierForCode(it.code);
                    return (
                      <tr key={it.code} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => navigate('/' + it.code)}>
                        <td className="font-mono text-base-content/50">{i + 4}</td>
                        <td className="max-w-[160px] truncate">{it.name}</td>
                        <td className="font-mono">{it.code}</td>
                        <td className="font-semibold">{fmt(it.views || 0)}</td>
                        <td><span className="font-semibold" style={{ color: TIER_COLOR[tier] }}>{t(TIER_LABEL[tier])}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
