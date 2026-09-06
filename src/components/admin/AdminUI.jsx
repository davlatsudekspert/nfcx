import { useEffect, useRef } from 'react';
import { useLanguage } from '../../lib/i18n.jsx';
import LanguageSwitcher from '../LanguageSwitcher.jsx';
import logo from '../../assets/logo-128.png';

// ── Ikonlar (feather uslubi, stroke=currentColor) ──────────────────────────
const ICON_PATHS = {
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  chart: 'M3 20h18 M7 20v-6 M12 20V8 M17 20v-10',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  bag: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0',
  wallet: 'M2 5h20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M1 10h22 M16 15h3',
  hammer: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  clipboard: 'M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2 M9 3h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M9 12h6 M9 16h4',
  idcard: 'M2 5h20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M7 15a2.5 2.5 0 1 1 5 0 M9.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M15 9h4 M15 13h4',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  usercheck: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 11l2 2 4-4',
  gift: 'M20 12v10H4V12 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
  news: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  check: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
  flame: 'M12 2c1 3 3 4.5 4.5 6S19 11.5 19 14a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5A2.5 2.5 0 0 0 11 11c0-1.4-.5-2-1-3-1-2-.2-4 3-6z',
  menu: 'M3 12h18 M3 6h18 M3 18h18',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  bank: 'M3 21h18 M3 10h18 M5 6l7-3 7 3 M4 10v11 M20 10v11 M8 14v3 M12 14v3 M16 14v3',
  building: 'M6 22V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v18 M6 22h12 M2 22h20 M9 7h1 M14 7h1 M9 11h1 M14 11h1 M9 15h1 M14 15h1 M10 22v-4h4v4',
  alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4',
  plug: 'M12 22v-5 M9 8V2 M15 8V2 M18 8v5a6 6 0 0 1-12 0V8z',
  refresh: 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  heart: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
};

export function AdminIcon({ name, className = 'h-[18px] w-[18px]' }) {
  const d = ICON_PATHS[name] || ICON_PATHS.dashboard;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ROLE_LABEL = { super_admin: 'Super Admin', manager: 'Manager', content_manager: 'Content Manager' };

// ── Qobiq: lg da chap nav (240px), kichik ekranda tepada gorizontal aylanuvchi nav ──
export function AdminShell({ nav, activeIndex, onSelect, title, role, onLogout, banner, children }) {
  const { t } = useLanguage();
  const stripRef = useRef(null);

  // Mobil nav'da faol tugma ko'rinib turishi uchun.
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-active="1"]');
    if (el && typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch { /* eski brauzer */ }
    }
  }, [activeIndex]);

  const navBtn = (item, mobile) => {
    const on = activeIndex === item.index;
    return (
      <button
        key={item.index}
        type="button"
        data-active={on ? '1' : '0'}
        onClick={() => onSelect(item.index)}
        aria-current={on ? 'page' : undefined}
        className={mobile
          ? `flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold transition-colors ${on ? 'border-transparent text-[var(--vz-gold-ink)]' : 'border-[var(--vz-line)] text-[var(--vz-ink-2)] hover:text-[var(--vz-ink)]'}`
          : `flex min-h-11 w-full items-center gap-3 border-l-2 px-5 text-left text-[15px] transition-colors ${on ? 'border-[var(--vz-gold)] bg-[rgba(212,175,90,.10)] font-semibold text-[var(--vz-gold-2)]' : 'border-transparent text-[var(--vz-ink-2)] hover:bg-white/[0.03] hover:text-[var(--vz-ink)]'}`}
        style={mobile && on ? { background: 'linear-gradient(135deg,var(--vz-gold-2),var(--vz-gold-3))' } : undefined}
      >
        <AdminIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{t(item.label)}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-page-bg)', color: 'var(--vz-ink)' }}>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r lg:flex" style={{ background: 'var(--color-page-bg)', borderColor: 'var(--vz-line)' }}>
        <div className="flex h-16 items-center gap-2.5 border-b px-5" style={{ borderColor: 'var(--vz-line)' }}>
          <img src={logo} alt="" className="h-8 w-8 object-contain" />
          <span className="font-display text-[15px] font-semibold tracking-[0.14em]">NFCSTORE</span>
        </div>
        <nav className="admin-scroll flex-1 overflow-y-auto py-3" aria-label={t('Admin bo‘limlari')}>
          {nav.map((item) => navBtn(item, false))}
        </nav>
        <div className="border-t px-5 py-4 text-[13px]" style={{ borderColor: 'var(--vz-line)', color: 'var(--vz-ink-3)' }}>
          <span className="vz-badge vz-badge--muted">{ROLE_LABEL[role] || role || 'Admin'}</span>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-30 border-b backdrop-blur-md" style={{ background: 'rgba(0,0,0,.88)', borderColor: 'var(--vz-line)' }}>
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <img src={logo} alt="" className="h-7 w-7 shrink-0 object-contain lg:hidden" />
              <h1 className="truncate font-display text-[18px] font-semibold">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageSwitcher />
              <span className="vz-badge vz-badge--muted hidden sm:inline-flex">{ROLE_LABEL[role] || role || 'Admin'}</span>
              <button type="button" className="btn btn-ghost-vz btn-sm min-h-11 gap-1.5 px-3" onClick={onLogout}>
                <AdminIcon name="logout" className="h-4 w-4" />
                <span className="hidden sm:inline">{t('Chiqish')}</span>
              </button>
            </div>
          </div>
          <nav ref={stripRef} className="admin-scroll flex gap-2 overflow-x-auto px-4 pb-3 sm:px-6 lg:hidden" aria-label={t('Admin bo‘limlari')}>
            {nav.map((item) => navBtn(item, true))}
          </nav>
        </header>
        {banner}
        <main className="admin-panel min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

// ── Qayta ishlatiluvchi UI ────────────────────────────────────────────────
const TONE = {
  success: 'vz-badge--ok',
  pending: 'vz-badge--warn',
  danger: 'vz-badge--danger',
  info: 'vz-badge--info',
  accent: 'vz-badge--gold',
  muted: 'vz-badge--muted',
};
const ICON_TONE = {
  success: 'bg-[rgba(34,197,94,.14)] text-[#4ade80]',
  pending: 'bg-[rgba(245,158,11,.16)] text-[#fbbf24]',
  danger: 'bg-[rgba(229,72,77,.16)] text-[#ff7b81]',
  info: 'bg-[rgba(59,130,246,.16)] text-[#7fb1ff]',
  accent: 'bg-[rgba(212,175,90,.16)] text-[var(--vz-gold-2)]',
  muted: 'bg-[var(--vz-card-2)] text-[var(--vz-ink-2)]',
};

export function StatusBadge({ tone = 'muted', children }) {
  const cls = TONE[tone] || TONE.muted;
  const danger = tone === 'danger' ? { background: 'rgba(229,72,77,.16)', color: '#ff7b81' } : undefined;
  return <span className={`vz-badge ${cls}`} style={danger}>{children}</span>;
}

export function AdminCard({ title, right, children, className = '', pad = true }) {
  return (
    <div className={`vz-card min-w-0 ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5" style={{ borderColor: 'var(--vz-line)' }}>
          {title && <div className="min-w-0 break-words text-sm font-semibold" style={{ color: 'var(--vz-ink)' }}>{title}</div>}
          {right}
        </div>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </div>
  );
}

export function KpiCard({ icon = 'chart', label, value, sub, tone = 'accent' }) {
  return (
    <div className="vz-card min-w-0 p-5">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${ICON_TONE[tone] || ICON_TONE.accent}`}>
        <AdminIcon name={icon} className="h-[20px] w-[20px]" />
      </span>
      <div className="mt-3.5 text-[14px]" style={{ color: 'var(--vz-ink-2)' }}>{label}</div>
      <div className="mt-1 break-words font-display text-[26px] font-semibold leading-none tracking-tight" style={{ color: 'var(--vz-ink)' }}>{value}</div>
      {sub && <div className="mt-2 text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{sub}</div>}
    </div>
  );
}

// recharts uchun umumiy dark tema (oltin urg'u)
export const chartGrid = { strokeDasharray: '3 3', stroke: 'rgba(246,239,224,0.07)', vertical: false };
export const chartAxis = { tick: { fontSize: 10, fill: 'rgba(246,239,224,0.45)' }, axisLine: { stroke: 'rgba(246,239,224,0.12)' }, tickLine: false };
export const chartTooltip = {
  contentStyle: { background: '#1e1810', border: '1px solid #2d2518', borderRadius: 10, fontSize: 12, padding: '8px 12px', color: '#f6efe0' },
  labelStyle: { color: '#b5a78b', marginBottom: 4 },
  cursor: { fill: 'rgba(212,175,90,0.06)' },
};

// Yuklanmoqda — skeleton qatorlar (.vz-skel)
export function AdminLoading({ rows = 4, label }) {
  const { t } = useLanguage();
  return (
    <div className="vz-card p-5" role="status" aria-live="polite" aria-label={label || t('Yuklanmoqda...')}>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="vz-skel h-4 w-4 shrink-0 rounded-full" />
            <div className="vz-skel h-3.5" style={{ width: `${70 - (i % 3) * 14}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'clipboard', title, hint, action }) {
  return (
    <div className="vz-empty">
      <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--vz-card-2)', color: 'var(--vz-ink-3)' }}>
        <AdminIcon name={icon} className="h-6 w-6" />
      </span>
      <div className="text-sm font-semibold" style={{ color: 'var(--vz-ink)' }}>{title}</div>
      {hint && <div className="max-w-xs text-xs">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Xatolik — bo'sh holatdan farqli (qizil chegara + "Qayta urinish")
export function ErrorState({ title, hint, onRetry, retryLabel }) {
  const { t } = useLanguage();
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-[14px] border px-6 py-8 text-center" style={{ borderColor: 'rgba(229,72,77,.45)', background: 'rgba(229,72,77,.06)' }}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(229,72,77,.14)', color: '#ff7b81' }}>
        <AdminIcon name="alert" className="h-6 w-6" />
      </span>
      <div className="text-sm font-semibold break-words" style={{ color: '#ff7b81' }}>{title || t("Ma'lumotlarni yuklab bo'lmadi.")}</div>
      {hint && <div className="max-w-sm text-xs break-words" style={{ color: 'var(--vz-ink-2)' }}>{hint}</div>}
      {onRetry && (
        <button type="button" className="btn btn-outline-gold btn-sm mt-2 min-h-11 gap-1.5" onClick={onRetry}>
          <AdminIcon name="refresh" className="h-4 w-4" />
          {retryLabel || t('Qayta urinish')}
        </button>
      )}
    </div>
  );
}

// Bo'lim backend'da hali yo'q (404)
export function NotConnected({ hint }) {
  const { t } = useLanguage();
  return (
    <EmptyState icon="plug" title={t("Bu bo'lim hali ulanmagan")} hint={hint || t("Backend'da bu bo'lim uchun yo'l hali mavjud emas.")} />
  );
}

// 403 — rol yetarli emas
export function ForbiddenState({ hint }) {
  const { t } = useLanguage();
  return (
    <EmptyState icon="lock" title={t("Ruxsat yo'q")} hint={hint || t("Bu amal faqat Super Admin uchun. Kerak bo'lsa, Super Admin'ga murojaat qiling.")} />
  );
}

// Umumiy: xatolik turiga qarab to'g'ri holatni chiqaradi.
// err — adminApi tashlagan Error ({ status, code }) yoki true.
export function LoadError({ err, onRetry, title }) {
  const { t } = useLanguage();
  const status = err && typeof err === 'object' ? err.status : 0;
  if (status === 404) return <NotConnected />;
  if (status === 403) return <ForbiddenState />;
  const hint = status === 429
    ? t("Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.")
    : status === 0 || !status ? t("Server bilan aloqa yo'q.") : t('Server xatosi ({n}).', { n: status });
  return <ErrorState title={title} hint={hint} onRetry={onRetry} />;
}

// "Ko'proq yuklash" — client-side sahifalash
export function LoadMore({ shown, total, onMore, step = 50 }) {
  const { t } = useLanguage();
  if (shown >= total) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-3 text-xs" style={{ color: 'var(--vz-ink-3)' }}>
      <span>{t('{a} / {b} ko‘rsatildi', { a: shown, b: total })}</span>
      <button type="button" className="btn btn-outline-gold btn-sm min-h-11" onClick={() => onMore(Math.min(total, shown + step))}>{t("Ko'proq yuklash")}</button>
    </div>
  );
}

// Ogohlantirish banneri (masalan 2FA yoqilmagan)
export function WarnBanner({ children, action }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm sm:px-6 lg:px-8" style={{ background: 'rgba(245,158,11,.12)', borderColor: 'rgba(245,158,11,.35)', color: '#fbbf24' }}>
      <span className="flex min-w-0 items-center gap-2 break-words">
        <AdminIcon name="alert" className="h-4 w-4 shrink-0" />
        <span className="min-w-0">{children}</span>
      </span>
      {action}
    </div>
  );
}
