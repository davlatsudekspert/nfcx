import { useState } from 'react';
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
};

export function AdminIcon({ name, className = 'h-[18px] w-[18px]' }) {
  const d = ICON_PATHS[name] || ICON_PATHS.dashboard;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// ── Sidebar + topbar qobiq ────────────────────────────────────────────────
export function AdminShell({ nav, activeIndex, onSelect, title, role, onLogout, children }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const roleLabel = role === 'super_admin' ? 'Super Admin' : (role || 'Admin');

  return (
    <div className="min-h-screen bg-[#09090b] text-base-content">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-white/[0.07] bg-[#0c0c0e] transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.07] px-5">
          <img src={logo} alt="" className="h-8 w-8 object-contain" />
          <span className="font-display text-[15px] font-extrabold tracking-[0.14em] text-base-content">NFCSTORE</span>
        </div>
        <nav className="admin-scroll flex-1 overflow-y-auto py-3">
          {nav.map((item) => {
            const on = activeIndex === item.index;
            return (
              <button
                key={item.index}
                onClick={() => { onSelect(item.index); setOpen(false); }}
                className={`flex w-full items-center gap-3 px-5 py-2.5 text-left text-[13.5px] transition-colors ${
                  on
                    ? 'border-r-2 border-accent bg-accent/[0.12] font-semibold text-accent'
                    : 'border-r-2 border-transparent text-base-content/55 hover:bg-white/[0.03] hover:text-base-content'
                }`}
              >
                <AdminIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{t(item.label)}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.07] p-4">
          <div className="flex items-center gap-2 text-[11.5px] text-base-content/60">
            <span className="h-2 w-2 rounded-full bg-success"></span>
            {t('Barchasi ishlamoqda')}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full w-[85%] rounded-full bg-accent/70"></div>
          </div>
          <div className="mt-1 text-[10px] text-base-content/40">85% {t('server yuklamasi')}</div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#09090b]/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button className="btn btn-ghost btn-sm btn-square lg:hidden" aria-label="Menyu" onClick={() => setOpen(true)}>
              <AdminIcon name="menu" className="h-5 w-5" />
            </button>
            <h1 className="truncate text-[17px] font-bold">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <div className="hidden items-center gap-2 rounded-lg border border-white/10 py-1.5 pl-1.5 pr-3 sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">A</span>
              <span className="text-xs text-base-content/70">{roleLabel}</span>
            </div>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={onLogout}>
              <AdminIcon name="logout" className="h-4 w-4" />
              <span className="hidden sm:inline">{t('Chiqish')}</span>
            </button>
          </div>
        </header>
        <main className="admin-panel p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

// ── Qayta ishlatiluvchi UI ────────────────────────────────────────────────
const TONE = {
  success: 'bg-success/15 text-success',
  pending: 'bg-warning/15 text-warning',
  danger: 'bg-error/15 text-error',
  info: 'bg-info/15 text-info',
  accent: 'bg-accent/15 text-accent',
  muted: 'bg-white/[0.06] text-base-content/55',
};

export function StatusBadge({ tone = 'muted', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${TONE[tone] || TONE.muted}`}>
      {children}
    </span>
  );
}

export function AdminCard({ title, right, children, className = '', pad = true }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-[#101013] ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
          {title && <div className="text-sm font-semibold text-base-content/85">{title}</div>}
          {right}
        </div>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </div>
  );
}

export function KpiCard({ icon = 'chart', label, value, sub, tone = 'accent' }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#101013] p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE[tone] || TONE.accent}`}>
          <AdminIcon name={icon} className="h-[20px] w-[20px]" />
        </span>
      </div>
      <div className="mt-3.5 text-[13px] text-base-content/50">{label}</div>
      <div className="mt-1 text-[26px] font-extrabold leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-2 text-[11.5px] text-base-content/40">{sub}</div>}
    </div>
  );
}

// recharts uchun umumiy dark tema
export const chartGrid = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.07)', vertical: false };
export const chartAxis = { tick: { fontSize: 10, fill: 'rgba(255,255,255,0.4)' }, axisLine: { stroke: 'rgba(255,255,255,0.1)' }, tickLine: false };
export const chartTooltip = {
  contentStyle: { background: '#16161a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12, padding: '8px 12px' },
  labelStyle: { color: 'rgba(255,255,255,0.55)', marginBottom: 4 },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

export function AdminLoading({ label }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/[0.06] bg-[#101013] px-6 py-14 text-sm text-base-content/45">
      <span className="loading loading-spinner loading-sm text-accent"></span>
      {label || t('Yuklanmoqda...')}
    </div>
  );
}

export function EmptyState({ icon = 'clipboard', title, hint, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/12 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] text-base-content/40">
        <AdminIcon name={icon} className="h-6 w-6" />
      </span>
      <div className="mt-3 text-sm font-semibold text-base-content/75">{title}</div>
      {hint && <div className="mt-1 max-w-xs text-xs text-base-content/45">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
