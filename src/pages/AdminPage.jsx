import { Fragment, createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fmt, timeAgo, dateTime } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import { useCategories, catPath } from '../lib/categories.js';
import { idTier, effectiveAccess } from '../lib/access.js';
import { TIER_LABEL } from '../lib/pricing.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import {
  AdminShell, AdminCard, KpiCard, StatusBadge, EmptyState, AdminLoading, LoadError, ForbiddenState, LoadMore, WarnBanner, AdminIcon,
  chartGrid, chartAxis, chartTooltip,
} from '../components/admin/AdminUI.jsx';
import { useConfirm } from '../components/admin/ConfirmDialog.jsx';

// Xatolik obyekti: message = server `error` kodi (eski kod shunga tayanadi),
// qo'shimcha `status` (HTTP) va `code` maydonlari — holatlarni ajratish uchun.
async function adminApi(path, options) {
  let res;
  try {
    res = await fetch('/api/admin' + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    const err = new Error('network_error');
    err.status = 0; err.code = 'network_error';
    throw err;
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401) {
    // Sessiya tugagan (idle timeout yoki umuman tugagan) — global hodisa
    // orqali AdminPage'ni darhol login ekraniga qaytaramiz.
    window.dispatchEvent(new CustomEvent('admin-session-expired', { detail: data?.error }));
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'api_error_' + res.status);
    err.status = res.status;
    err.code = (data && data.error) || null;
    err.data = data;
    throw err;
  }
  return data;
}

// Umumiy xatolik matni (429 / tarmoq / 403 / boshqa).
function apiErrText(e, t, fallback) {
  const status = e && typeof e === 'object' ? e.status : undefined;
  if (status === 429 || e?.message === 'too_many_requests') return retryAfterText(e, t);
  if (status === 0 || e?.message === 'network_error') return t("Server bilan aloqa yo'q. Qayta urinish");
  if (status === 403) return t("Ruxsat yo'q");
  return fallback || t('Xatolik yuz berdi.');
}

// 429 javobidagi `retryAfterSec`ni (agar bo'lsa) o'qib, aniq kutish
// vaqti bilan xabar tuzadi: "Juda ko'p urinish. 12 daqiqadan keyin
// qayta urinib ko'ring." Server bu maydonni bermasa umumiy matnga tushadi.
function retryAfterText(e, t) {
  const sec = Number(e?.data?.retryAfterSec) || 0;
  if (!sec) return t("Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.");
  if (sec >= 60) return t('Juda ko‘p urinish. {n} daqiqadan keyin qayta urinib ko‘ring.', { n: Math.ceil(sec / 60) });
  return t('Juda ko‘p urinish. {n} soniyadan keyin qayta urinib ko‘ring.', { n: sec });
}

// mm:ss (yoki soniya, agar 1 daqiqadan kam qolgan bo'lsa) — tugma ustidagi
// jonli countdown uchun.
function formatCountdown(sec) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60); const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Rol / 2FA holati — barcha tab'lar uchun kontekst.
const AdminCtx = createContext({ role: null, isSuper: false, isManager: false, totpEnabled: null, refreshMe: () => {}, goTo: () => {} });
const useAdmin = () => useContext(AdminCtx);

// ---------- Login ----------

function AdminLogin({ onLoggedIn, expiredMsg }) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // 2FA: birinchi bosqichda telefon+parol tekshiriladi, Telegram'ga kod
  // yuboriladi; ikkinchi bosqichda shu kod so'raladi.
  const [step, setStep] = useState('credentials'); // credentials | code
  const [tempToken, setTempToken] = useState(null);
  const [code, setCode] = useState('');
  // 'totp' (default/primary — Google Authenticator) or 'telegram' (opt-in
  // alternative, only ever requested by the admin clicking the button
  // below — never automatic, never IP/location-based).
  const [twoFaMethod, setTwoFaMethod] = useState('totp');
  const [tgBusy, setTgBusy] = useState(false);
  // `busy` state alone doesn't rule out a genuine double-click firing two
  // submits before React re-renders the disabled button — this ref updates
  // synchronously, so a second submit inside that same window is dropped
  // immediately, guaranteeing at most one /api/admin/login request per
  // click/Enter.
  const submitLock = useRef(false);
  // 429 kelganda server bergan `retryAfterSec`dan jonli countdown —
  // tugma shu vaqt tugagunga qadar bloklangan (qayta-qayta urinib,
  // hisoblagichni yanada uzaytirib yubormaslik uchun).
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s > 1 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);
  const onRateLimited = (e2) => { const sec = Number(e2?.data?.retryAfterSec) || 60; setCooldown(sec); };
  // 2FA bosqichini to'liq tozalab, telefon+parol formasiga qaytaradi.
  const resetToCredentials = () => {
    setStep('credentials');
    setCode('');
    setTempToken(null);
    setTwoFaMethod('totp');
  };

  const submitCredentials = async (e) => {
    e.preventDefault();
    if (submitLock.current || cooldown > 0) return;
    submitLock.current = true;
    setBusy(true);
    setErr(null);
    try {
      const result = await adminApi('/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
      if (result.twoFactor) {
        setTempToken(result.tempToken);
        setTwoFaMethod(result.method === 'telegram' ? 'telegram' : 'totp');
        setStep('code');
      } else {
        onLoggedIn();
      }
    } catch (e2) {
      if (e2.status === 429 || e2.message === 'too_many_requests') onRateLimited(e2);
      setErr(e2.message === 'admin_not_configured'
        ? t("Admin panel hali sozlanmagan (ADMIN_PANEL_PHONE / ADMIN_PANEL_PASSWORD env o'zgaruvchilarini qo'shing).")
        : e2.message === 'tg_send_failed'
          ? t("Telegram'ga kod yuborib bo'lmadi. ADMIN_CHAT_ID va bot sozlamalarini tekshiring.")
          : e2.status === 429 || e2.message === 'too_many_requests'
            ? retryAfterText(e2, t)
            : e2.status === 0
              ? t("Server bilan aloqa yo'q. Qayta urinish")
              : t('Login yoki parol xato.'));
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };

  const sendTelegramCode = async () => {
    if (cooldown > 0) return;
    setTgBusy(true);
    setErr(null);
    try {
      await adminApi('/2fa/telegram/send', { method: 'POST', body: JSON.stringify({ tempToken }) });
      setTwoFaMethod('telegram');
      setCode('');
    } catch (e2) {
      if (e2.status === 429 || e2.message === 'too_many_requests') onRateLimited(e2);
      setErr(e2.message === 'telegram_not_configured'
        ? t("Telegram bot sozlanmagan. Administratorga murojaat qiling.")
        : e2.message === 'tg_send_failed'
          ? t("Telegram'ga kod yuborib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.")
          : e2.message === 'expired'
            ? t("Sessiya muddati o'tgan — qaytadan kiring.")
            : e2.status === 429 || e2.message === 'too_many_requests'
              ? retryAfterText(e2, t)
              : t('Xatolik yuz berdi.'));
      if (e2.status === 401 && (e2.code === 'expired' || e2.message === 'expired')) resetToCredentials();
    } finally {
      setTgBusy(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    if (submitLock.current || cooldown > 0) return;
    submitLock.current = true;
    setBusy(true);
    setErr(null);
    try {
      await adminApi('/verify-2fa', { method: 'POST', body: JSON.stringify({ tempToken, code: code.trim() }) });
      onLoggedIn();
    } catch (e2) {
      if (e2.status === 429 || e2.message === 'too_many_requests') onRateLimited(e2);
      // Xato turlari ANIQ farqlanadi: muddati tugagan sessiya (401 expired),
      // noto'g'ri kod (401 bad_code), rate-limit (429) va HAQIQIY server
      // xatosi (503) — har biri o'z matni bilan (UZ/RU/EN).
      const expired = e2.status === 401 && (e2.code === 'expired' || e2.message === 'expired');
      setErr(expired
        ? t("Sessiya muddati tugadi — telefon va parolni qaytadan kiriting.")
        : e2.status === 503 || e2.message === 'verify_2fa_unavailable'
          ? t("Server vaqtincha ishlamayapti. Birozdan so'ng qayta urinib ko'ring.")
          : e2.status === 429 || e2.message === 'too_many_requests'
            ? retryAfterText(e2, t)
            : e2.status === 0 || e2.message === 'network_error'
              ? t("Server bilan aloqa yo'q. Qayta urinish")
              : t("Kod noto'g'ri."));
      // Sessiya tugagan bo'lsa 2FA formasi to'liq tozalanadi va foydalanuvchi
      // login (telefon+parol) bosqichiga qaytariladi — eski tempToken bilan
      // qayta-qayta so'rov yuborilmasin.
      if (expired) resetToCredentials();
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm items-center px-4 py-8 sm:px-5" style={{ color: 'var(--vz-ink)' }}>
      <div className="vz-card w-full min-w-0 p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="vz-kicker">NFCSTORE</span>
          <LanguageSwitcher />
        </div>
        <h1 className="vz-h2 mt-2">{t("Admin panel")}</h1>
        {expiredMsg && <div role="alert" className="mt-4 rounded-[10px] border px-3 py-2 text-xs" style={{ borderColor: 'rgba(245,158,11,.35)', background: 'rgba(245,158,11,.10)', color: '#fbbf24' }}>{t(expiredMsg)}</div>}

        {step === 'credentials' ? (
          <form onSubmit={submitCredentials} className="mt-6 space-y-3">
            <label className="block">
              <span className="vz-label">{t("Telefon")}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" autoComplete="username" inputMode="tel"
                className="vz-input" />
            </label>
            <label className="block">
              <span className="vz-label">{t("Parol")}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                className="vz-input" />
            </label>
            <button className="btn btn-gold w-full" disabled={busy || cooldown > 0}>
              {busy ? <span className="loading loading-spinner loading-sm"></span>
                : cooldown > 0 ? t('Kutish: {n}', { n: formatCountdown(cooldown) })
                  : t('Kirish')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-6 space-y-3">
            <p className="text-sm" style={{ color: 'var(--vz-ink-2)' }}>
              {twoFaMethod === 'telegram'
                ? t('Telegram botga 6 xonali kod yuborildi. Kodni kiriting:')
                : t('Google Authenticator ilovasidagi 6 xonali kodni kiriting:')}
            </p>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" maxLength={6} inputMode="numeric" autoComplete="one-time-code"
              className="vz-input text-center font-mono text-lg tracking-widest" autoFocus />
            <button className="btn btn-gold w-full" disabled={busy || cooldown > 0 || code.length !== 6}>
              {busy ? <span className="loading loading-spinner loading-sm"></span>
                : cooldown > 0 ? t('Kutish: {n}', { n: formatCountdown(cooldown) })
                  : t('Tasdiqlash')}
            </button>
            <button type="button" className="btn btn-ghost-vz w-full" disabled={tgBusy || cooldown > 0} onClick={sendTelegramCode}>
              {tgBusy
                ? <span className="loading loading-spinner loading-xs"></span>
                : cooldown > 0 ? t('Kutish: {n}', { n: formatCountdown(cooldown) })
                  : twoFaMethod === 'telegram' ? t('Kodni qayta yuborish (Telegram)') : t('Telegram orqali kod olish')}
            </button>
            <button type="button" className="btn btn-ghost-vz w-full" onClick={() => { setStep('credentials'); setCode(''); setErr(null); setTwoFaMethod('totp'); }}>{t('Orqaga')}</button>
          </form>
        )}
        {err && <div role="alert" className="vz-err mt-4 break-words">{t(err)}</div>}
      </div>
    </main>
  );
}

// ---------- Dashboard ----------

const TABS = ['Umumiy', 'Statistika', 'Foydalanuvchilar', "Buyurtmalar", "To'lanishi kerak pullar", 'Auksionlar', "Auksion so'rovlari", 'Jismoniy kartalar', 'Bildirishnomalar', 'Tashqi analitika', 'Security', 'Adminlar', 'Gift NFC ID', 'Promokodlar', 'Yangiliklar', 'Kategoriyalar', 'Tasdiqlash', 'Talab', 'Moliya', 'Kompaniyalar'];

function StatsTab() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [series, setSeries] = useState(null);
  const [range, setRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const load = () => {
    setLoadErr(null); setStats(null);
    adminApi('/stats').then(setStats).catch((e) => setLoadErr(e));
    adminApi('/platform-wallet').then((d) => setWallet(d.balance)).catch(() => {});
    adminApi('/analytics').then((d) => setSeries(d.commissionSeries || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  // Backend endi CSV qaytaradi (text/csv).
  const exportCsv = async () => {
    if (range === 'custom' && (!customFrom || !customTo)) { setExportMsg(t('Boshlanish va tugash sanasini tanlang.')); return; }
    setExporting(true); setExportMsg(null);
    try {
      const qs = range === 'custom'
        ? `range=custom&from=${customFrom}&to=${customTo}`
        : `range=${range}`;
      const res = await fetch(`/api/admin/export-stats?${qs}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('export_failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nfcstore_statistika_${range}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportMsg(t('CSV faylni yuklab bo‘lmadi.'));
    } finally {
      setExporting(false);
    }
  };

  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t("Statistikani yuklab bo'lmadi.")} />;
  if (!stats) return <AdminLoading rows={6} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs" style={{ color: 'var(--vz-ink-3)' }}>{t("Davr:")}</span>
          {[['today', 'Bugun'], ['7d', '7 kun'], ['30d', '30 kun'], ['month', 'Shu oy'], ['custom', 'Custom']].map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setRange(v)}
              className={`btn btn-sm min-h-11 ${range === v ? 'btn-gold' : 'btn-ghost-vz'}`}
            >
              {t(l)}
            </button>
          ))}
          {range === 'custom' && (
            <span className="flex flex-wrap items-center gap-1">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="vz-input w-auto py-1" aria-label={t('Boshlanish sanasi')} />
              <span className="text-xs" style={{ color: 'var(--vz-ink-3)' }}>{'\u2014'}</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="vz-input w-auto py-1" aria-label={t('Tugash sanasi')} />
            </span>
          )}
        </div>
        <button type="button" className="btn btn-outline-gold btn-sm min-h-11 gap-1.5" disabled={exporting} onClick={exportCsv}>
          {exporting ? <span className="loading loading-spinner loading-xs"></span> : <><AdminIcon name="download" className="h-4 w-4" /> {t("CSV yuklab olish")}</>}
        </button>
      </div>
      {exportMsg && <div role="alert" className="vz-err">{exportMsg}</div>}

      <div className="vz-card p-6">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <span className="vz-kicker">{t('Platforma daromadi (komissiyalar)')}</span>
            <div className="mt-2 break-words font-display text-[38px] font-semibold leading-none tracking-tight" style={{ color: 'var(--vz-gold-2)' }}>
              {wallet === null ? '\u2014' : fmt(wallet)} <span className="text-2xl">{t("so'm")}</span>
            </div>
            <p className="mt-2 max-w-md text-xs leading-relaxed" style={{ color: 'var(--vz-ink-2)' }}>{t("Auksion va premium obuna komissiyalaridan yig'ilgan real pul.")}</p>
          </div>
          <div className="hidden h-24 lg:block">
            {series && series.length > 1 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                  <Line type="monotone" dataKey="total" stroke="#d4af5a" strokeWidth={2} dot={false} />
                  <Tooltip {...chartTooltip} formatter={(v) => [fmt(v) + " so'm", t('Komissiya')]} labelFormatter={() => ''} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard icon="users" tone="info" label={t("Foydalanuvchilar")} value={fmt(stats.userCount)} />
        <KpiCard icon="idcard" tone="success" label={t("Band qilingan NFC ID")} value={fmt(stats.cardCount)} />
        <KpiCard icon="bag" tone="accent" label={t("Jami savdo (NFC ID)")} value={`${fmt(stats.totalCardSalesValue)} ${t("so'm")}`} />
        <KpiCard icon="hammer" tone="pending" label={t("Faol auksionlar")} value={fmt(stats.activeAuctions)} />
        <KpiCard icon="clipboard" tone="muted" label={t("Kutilayotgan buyurtmalar")} value={fmt(stats.pendingWebOrders)} />
      </div>

      {series && series.length > 1 && (
        <AdminCard title={t("Platforma komissiyasi \u2014 kunlar bo'yicha (30 kun)")}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="day" {...chartAxis} />
                <YAxis {...chartAxis} width={44} />
                <Tooltip {...chartTooltip} formatter={(v) => [fmt(v) + " so'm", t('Komissiya')]} />
                <Line type="monotone" dataKey="total" name={t('Komissiya')} stroke="#d4af5a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>
      )}
    </div>
  );
}

const KIND_LABEL = {
  topup: "Hamyon to'ldirish",
  bid_hold: 'Auksion bandlash',
  bid_release: 'Auksion bo\u2019shatish',
  auction_win: 'Auksion yutish',
  auction_sale: 'Auksion savdosi (sotuvchi)',
  refund: 'Qaytarish',
  admin_adjust: 'Admin tuzatishi',
  card_purchase: 'Premium obuna',
  platform_commission: 'Platforma komissiyasi',
};
const PIE_COLORS = ['#f5a524', '#3abff8', '#36d399', '#f87272', '#a78bfa', '#fb7185', '#94a3b8'];

function AnalyticsTab() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const load = () => { setLoadErr(null); setData(null); adminApi('/analytics').then(setData).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);
  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t("Analitikani yuklab bo'lmadi.")} />;
  if (!data) return <AdminLoading rows={6} />;

  const breakdown = (data.breakdown || []).map((b) => ({ ...b, label: t(KIND_LABEL[b.kind] || b.kind) }));

  return (
    <div className="space-y-5">
      <AdminCard title={t("Platforma komissiyasi \u2014 kunlar bo'yicha (30 kun)")}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.commissionSeries}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="day" {...chartAxis} />
              <YAxis {...chartAxis} width={44} />
              <Tooltip {...chartTooltip} formatter={(v) => [fmt(v) + " so'm", t('Komissiya')]} />
              <Line type="monotone" dataKey="total" name={t('Komissiya')} stroke="#d4af5a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </AdminCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminCard title={t("Yangi ro'yxatdan o'tishlar (30 kun)")}>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.signupsSeries}>
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="day" {...chartAxis} />
                <YAxis {...chartAxis} width={32} allowDecimals={false} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="count" name={t("Ro'yxatdan o'tish")} fill="#5aa9e0" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title={t("Band qilingan raqamli tashrif qog'ozlar (30 kun)")}>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cardsSeries}>
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="day" {...chartAxis} />
                <YAxis {...chartAxis} width={32} allowDecimals={false} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="count" name={t("Band qilingan")} fill="#7fb28e" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>
      </div>

      <AdminCard title={t("Daromad turlari bo'yicha taqsimot")}>
        <div className="grid items-center gap-5 lg:grid-cols-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={breakdown} dataKey="total" nameKey="label" cx="50%" cy="50%" innerRadius={52} outerRadius={88} paddingAngle={2} stroke="none">
                  {breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...chartTooltip} formatter={(v) => fmt(v) + " so'm"} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {breakdown.map((b, i) => (
              <div key={b.kind} className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0" style={{ borderColor: 'var(--vz-line)' }}>
                <span className="flex min-w-0 items-center gap-2 break-words" style={{ color: 'var(--vz-ink-2)' }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {b.label}
                </span>
                <span className="shrink-0 font-semibold">{fmt(b.total)} <span className="text-xs font-normal" style={{ color: 'var(--vz-ink-3)' }}>{t("so'm")}</span></span>
              </div>
            ))}
          </div>
        </div>
      </AdminCard>

      <ManualAdjustmentsSection />
    </div>
  );
}

// Qo'lda kiritilgan balans tuzatishlari — DIQQAT: bular yuqoridagi
// "Daromad turlari bo'yicha taqsimot" grafigiga ATAYLAB kirmaydi, chunki
// bu real platforma daromadi emas. Faqat audit uchun, alohida ko'rsatiladi.
function ManualAdjustmentsSection() {
  const { t } = useLanguage();
  const [list, setList] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const load = () => { setLoadErr(null); adminApi('/manual-adjustments').then((d) => setList(d.adjustments || [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);
  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t("Qo'lda kiritilgan tuzatishlarni yuklab bo'lmadi.")} />;
  if (!list) return <AdminLoading rows={2} />;
  if (list.length === 0) return null;
  const total = list.reduce((s, a) => s + a.amount, 0);
  return (
    <div className="vz-card p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
        <AdminIcon name="alert" className="h-4 w-4 text-[#fbbf24]" /> {t("Qo'lda kiritilgan balans tuzatishlari")}
        <span className="vz-badge vz-badge--muted">{t('Daromadga kirmaydi')}</span>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--vz-ink-2)' }}>
        {t("Bu yozuvlar xodim tomonidan qo'lda kiritilgan (masalan sinov maqsadida) — real savdo/komissiya emas, shuning uchun yuqoridagi daromad grafigiga qo'shilmaydi. Jami:")} <b className={total >= 0 ? 'text-success' : 'text-error'}>{fmt(total)} {t("so'm")}</b>.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>{t('Foydalanuvchi')}</th><th>{t('Summa')}</th><th>{t('Izoh')}</th><th>{t('Vaqt')}</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="text-xs">{a.email || `#${a.userId}`}</td>
                <td className={`font-semibold ${a.amount >= 0 ? 'text-success' : 'text-error'}`}>{a.amount >= 0 ? '+' : ''}{fmt(a.amount)} {t("so'm")}</td>
                <td className="max-w-xs break-words text-xs text-base-content/60">{a.note}</td>
                <td className="whitespace-nowrap text-xs text-base-content/50">{timeAgo(new Date(a.createdAt).getTime())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab() {
  const { t } = useLanguage();
  const { isSuper, isManager } = useAdmin();
  const { confirm, dialog } = useConfirm();
  const [users, setUsers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [shown, setShown] = useState(50);
  const [actErr, setActErr] = useState(null);
  const [q, setQ] = useState('');
  const [adjustFor, setAdjustFor] = useState(null);
  const [suspendFor, setSuspendFor] = useState(null);
  const [suspendDays, setSuspendDays] = useState('7');
  const [suspendReason, setSuspendReason] = useState('Spam');
  const [modBusy, setModBusy] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(null);

  const load = () => { setLoadErr(null); return adminApi('/users').then((d) => setUsers(Array.isArray(d?.users) ? d.users : [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);
  useEffect(() => { setShown(50); }, [q]);

  const run = async (fn) => {
    setActErr(null);
    try { await fn(); } catch (e) { setActErr(apiErrText(e, t)); }
  };

  const toggleTest = async (u) => {
    setToggleBusy(u.id);
    try { await run(async () => { await adminApi(`/users/${u.id}/set-test`, { method: 'POST', body: JSON.stringify({ isTest: !u.isTest }) }); await load(); }); }
    finally { setToggleBusy(null); }
  };

  const submitSuspend = async (userId) => {
    setModBusy(userId);
    try {
      await run(async () => {
        await adminApi(`/users/${userId}/suspend`, { method: 'POST', body: JSON.stringify({ days: Number(suspendDays), reason: suspendReason }) });
        setSuspendFor(null);
        await load();
      });
    } finally {
      setModBusy(null);
    }
  };
  const unsuspend = async (u) => {
    setModBusy(u.id);
    try { await run(async () => { await adminApi(`/users/${u.id}/unsuspend`, { method: 'POST' }); await load(); }); } finally { setModBusy(null); }
  };
  // Backend soft-delete qiladi: yozuv `deleted_at` bilan saqlanadi, sessiyalar yopiladi.
  const deleteUser = async (u) => {
    const ok = await confirm({
      title: t("Foydalanuvchini o'chirish"),
      message: t("{email} akkaunti o'chirilgan deb belgilanadi: foydalanuvchi kira olmaydi, barcha sessiyalari yopiladi. Ma'lumotlar bazada saqlanib qoladi (soft-delete) va bu amalni panel orqali qaytarib bo'lmaydi.", { email: u.email }),
      confirmLabel: t("O'chirish"),
      danger: true,
    });
    if (!ok) return;
    setModBusy(u.id);
    try { await run(async () => { await adminApi(`/users/${u.id}/delete`, { method: 'POST' }); await load(); }); } finally { setModBusy(null); }
  };

  const submitAdjust = async () => {
    const val = Math.round(Number(amount));
    if (!val) return;
    setBusy(true);
    try {
      await run(async () => {
        await adminApi(`/users/${adjustFor}/adjust-balance`, { method: 'POST', body: JSON.stringify({ amount: val, note }) });
        setAdjustFor(null); setAmount(''); setNote('');
        await load();
      });
    } finally {
      setBusy(false);
    }
  };

  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t("Foydalanuvchilarni yuklab bo'lmadi.")} />;
  if (!users) return <AdminLoading rows={8} />;
  const query = q.trim().toLowerCase();
  const filtered = !query ? users : users.filter((u) =>
    (u.email || '').toLowerCase().includes(query) ||
    (u.codes || []).some((c) => c.toLowerCase().includes(query))
  );
  const visible = filtered.slice(0, shown);
  return (
    <div>
      {dialog}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Email yoki NFC ID bo'yicha qidirish...")}
          className="vz-input w-full sm:max-w-sm"
          aria-label={t("Email yoki NFC ID bo'yicha qidirish...")}
        />
        <span className="text-xs" style={{ color: 'var(--vz-ink-3)' }}>{t('Jami')}: {fmt(users.length)}</span>
      </div>
      {actErr && <div role="alert" className="vz-err mb-3">{actErr}</div>}
      {users.length === 0 ? <EmptyState icon="users" title={t("Hozircha foydalanuvchi yo'q.")} />
        : filtered.length === 0 ? <EmptyState icon="users" title={t("Hech narsa topilmadi.")} hint={t("Qidiruv so'zini o'zgartirib ko'ring.")} />
        : (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr><th className="w-8 text-base-content/40">#</th><th>Email</th><th>{t('Telefon')}</th><th>{t('Bot')}</th><th>{t('Balans')}</th><th>{t('Bandlangan')}</th><th>{t('Kartalar')}</th><th>{t("Ro'yxatdan o'tgan")}</th><th></th></tr>
        </thead>
        <tbody>
          {visible.map((u, i) => (
            <tr key={u.id} className={u.isTest ? 'opacity-50' : ''}>
              <td className="text-xs tabular-nums text-base-content/40">{i + 1}</td>
              <td>
                {u.email} {u.isTest && <span className="badge badge-ghost badge-xs ml-1">{t("SINOV")}</span>}
                {u.deletedAt && <span className="badge badge-error badge-xs ml-1">{t("O'CHIRILGAN")}</span>}
                {!u.deletedAt && u.suspendedUntil && new Date(u.suspendedUntil) > new Date() && (
                  <div className="mt-0.5 text-[13px] text-error">{t('Bloklangan:')} {t(u.suspendReason)} ({timeAgo(new Date(u.suspendedUntil).getTime())} {t('gacha')})</div>
                )}
              </td>
              <td className="font-mono text-xs">{u.phone || '—'}</td>
              <td>{u.botAck ? <span className="vz-badge vz-badge--ok">{t('Ha')}</span> : <span className="vz-badge vz-badge--muted">{t("Yo'q")}</span>}</td>
              <td className="font-semibold">{fmt(u.balance)}</td>
              <td className="text-base-content/50">{fmt(u.heldBalance)}</td>
              <td>{u.cardCount}</td>
              <td className="text-xs text-base-content/50">{timeAgo(new Date(u.createdAt).getTime())}</td>
              <td className="flex flex-wrap gap-1">
                {isSuper && <button className="btn btn-ghost btn-xs min-h-9" onClick={() => setAdjustFor(u.id)}>{t('Balansni tuzatish')}</button>}
                {isSuper && (
                  <button className="btn btn-ghost btn-xs min-h-9" disabled={toggleBusy === u.id} onClick={() => toggleTest(u)}>
                    {u.isTest ? t('Sinovdan chiqarish') : t("Sinov deb belgilash")}
                  </button>
                )}
                {isManager && !u.deletedAt && (
                  u.suspendedUntil && new Date(u.suspendedUntil) > new Date() ? (
                    <button className="btn btn-success btn-xs min-h-9" disabled={modBusy === u.id} onClick={() => unsuspend(u)}>{t('Blokdan chiqarish')}</button>
                  ) : (
                    <button className="btn btn-warning btn-xs min-h-9" onClick={() => setSuspendFor(suspendFor === u.id ? null : u.id)}>{t('Bloklash')}</button>
                  )
                )}
                {isSuper && !u.deletedAt && (
                  <button className="btn btn-error btn-xs min-h-9" disabled={modBusy === u.id} onClick={() => deleteUser(u)}>{t("O'chirish")}</button>
                )}
                {suspendFor === u.id && (
                  <div className="vz-panel mt-2 flex w-full flex-wrap items-center gap-1.5 p-2">
                    <select value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} className="vz-input w-auto min-w-0 py-1" aria-label={t('Sabab')}>
                      <option>{t('Diniy-ekstremistik kontent')}</option>
                      <option>{t('Litsenziyasiz diniy material tarqatish')}</option>
                      <option>{t('Uyatsiz/odobsiz kontent')}</option>
                      <option>{t('Ruxsatsiz shaxsiy rasm tarqatish')}</option>
                      <option>{t('Spam')}</option>
                      <option>{t('Boshqa foydalanuvchiga tahdid')}</option>
                      <option>{t('Boshqa qoidabuzarlik')}</option>
                    </select>
                    <input type="number" value={suspendDays} onChange={(e) => setSuspendDays(e.target.value)} placeholder={t("Kun")} className="vz-input w-20 py-1" aria-label={t('Kun')} />
                    <button className="btn btn-warning btn-xs min-h-9" disabled={modBusy === u.id} onClick={() => submitSuspend(u.id)}>{t('Tasdiqlash')}</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <LoadMore shown={visible.length} total={filtered.length} onMore={setShown} />
    </div>
        )}

      {adjustFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setAdjustFor(null)}>
          <div className="vz-card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="font-display text-lg font-semibold">{t("Balansni qo'lda tuzatish")}</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t("Musbat son — qo'shadi, manfiy son — ayiradi. Har doim audit jurnaliga yoziladi.")}</p>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("masalan 50000 yoki -20000")}
              className="vz-input mt-3" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Sabab (masalan: qo'lda Payme tasdiqlandi)")}
              className="vz-input mt-2" />
            <div className="mt-4 flex gap-2">
              <button className="btn btn-gold flex-1" onClick={submitAdjust} disabled={busy}>
                {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Tasdiqlash')}
              </button>
              <button className="btn btn-ghost-vz" onClick={() => setAdjustFor(null)}>{t('Bekor')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ORDER_STATUS_LABEL = {
  paid: { text: "To'landi", cls: 'badge-success' },
  pending: { text: 'Kutilmoqda', cls: 'badge-warning' },
  cancelled: { text: 'Bekor qilindi', cls: 'badge-ghost' },
  rejected: { text: 'Rad etildi', cls: 'badge-ghost' },
  failed_code_taken: { text: 'Xato: kod band qilingan', cls: 'badge-error' },
};

// ═══ PAYME SERTIFIKATSIYA SINOVI ═══
// To'lov tizimini ulashda Payme kichik summali HAQIQIY to'lov o'tkazib
// tekshirishni so'raydi. Saytdagi eng arzon mahsulot 49 000 so'm, ya'ni
// bunday buyurtmani boshqa yo'l bilan yaratib bo'lmaydi.
//
// Bu buyurtma HECH NARSA BERMAYDI — karta yaratmaydi, biriktirmaydi,
// premium yoqmaydi (hosting/worker.js `payme_test` izohiga qarang).
function PaymeTestOrder() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [som, setSom] = useState(1);

  const create = async () => {
    setBusy(true); setErr(''); setRes(null);
    try {
      const d = await adminApi('/payme-test-order', { method: 'POST', body: JSON.stringify({ amount: Number(som) || 1 }) });
      setRes(d);
    } catch (e) {
      setErr(e?.body?.error || e?.message || t('Xatolik'));
    } finally { setBusy(false); }
  };

  return (
    <div className="vz-card mb-4 p-4">
      <div className="vz-kicker">{t('PAYME SINOVI')}</div>
      <h3 className="mt-1 text-base font-bold">{t('Sertifikatsiya uchun kichik to‘lov')}</h3>
      <p className="mt-1 text-xs leading-relaxed text-base-content/55">
        {t('Payme ulanishni tekshirish uchun kichik summali haqiqiy to‘lov so‘raydi. Bu buyurtma HECH NARSA BERMAYDI — karta yaratmaydi va biriktirmaydi, faqat to‘lov yo‘lini tekshiradi.')}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number" min={1} max={10000} value={som}
          onChange={(e) => setSom(e.target.value)}
          className="input input-bordered input-sm w-28 bg-base-100"
          aria-label={t('Summa (so‘m)')}
        />
        <span className="text-xs text-base-content/50">{t('so‘m')}</span>
        <button className="btn btn-gold btn-sm min-h-11" onClick={create} disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Sinov to‘lovini yaratish')}
        </button>
      </div>
      {err && <div role="alert" className="vz-err mt-3">{String(err)}</div>}
      {res && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <div className="text-xs text-base-content/60">
            {t('Buyurtma')} #{res.orderId} · {res.amount} {t('so‘m')}
          </div>
          <a href={res.payLink} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-sm mt-2 min-h-11 w-full">
            {t('To‘lovga o‘tish')} &rarr;
          </a>
          <p className="mt-2 break-all font-mono text-[11px] text-base-content/40">{res.payLink}</p>
        </div>
      )}
    </div>
  );
}

// Jismoniy karta buyurtmasining bosma maketi — admin uchun.
//
// Maket mijoz "buyurtma berish" ni bosgan daqiqada saqlangan, ya'ni
// keyin u dizaynini o'zgartirsa ham bu yerda AYNAN to'langan variant
// turadi.
function PhysicalCardDesign({ order }) {
  const { t } = useLanguage();
  const sides = [
    ['Old tomon', order.designFrontUrl],
    ['Orqa tomon', order.designBackUrl],
  ].filter(([, url]) => !!url);

  return (
    <div className="flex flex-wrap items-start gap-5 py-3">
      <div className="min-w-[220px] text-xs leading-relaxed text-base-content/70">
        <div className="vz-kicker mb-1">{t('Yetkazib berish')}</div>
        <div className="font-semibold text-base-content/90">{order.shippingName || '—'}</div>
        <div>{order.shippingPhone || '—'}</div>
        <div className="max-w-[280px]">{order.shippingAddress || '—'}</div>
        {order.printSpec && (
          <div className="mt-2 font-mono text-[11px] text-base-content/45">{order.printSpec}</div>
        )}
      </div>

      {sides.length === 0 ? (
        // Eski (2026-09 dan oldingi) buyurtmalarda maket yo'q — o'shanda
        // dizayn umuman saqlanmasdi. Buni yashirmaymiz.
        <div className="vz-err self-center text-xs">
          {t('Bu buyurtmada bosma maket yo‘q — mijozdan dizaynni so‘rang.')}
        </div>
      ) : sides.map(([label, url]) => (
        <div key={label} className="flex flex-col items-start gap-2">
          <div className="vz-kicker">{t(label)}</div>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <img
              src={url} alt={t(label)} loading="lazy"
              className="h-[104px] w-[165px] rounded-lg border border-white/15 bg-black object-cover"
            />
          </a>
          {/* `download` — bir bosishda tipografiyaga beriladigan fayl.
              Nomi buyurtma raqami bilan: papkada aralashib ketmasin. */}
          <a
            href={url}
            download={`nfcstore_${order.code || 'karta'}_${order.id}_${label === 'Old tomon' ? 'old' : 'orqa'}.png`}
            className="btn btn-outline-gold btn-xs min-h-9"
          >
            {t('Yuklab olish')}
          </a>
        </div>
      ))}
    </div>
  );
}

function OrdersTab() {
  const { t } = useLanguage();
  const { isSuper } = useAdmin();
  const { confirm, dialog } = useConfirm();
  const [orders, setOrders] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [actErr, setActErr] = useState(null);
  const [shown, setShown] = useState(50);
  const load = () => { setLoadErr(null); setOrders(null); return adminApi('/orders').then((d) => setOrders(Array.isArray(d?.orders) ? d.orders : [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const confirmPayment = async (o) => {
    const ok = await confirm({
      title: t("To'lovni qo'lda tasdiqlash"),
      message: t("To'lovni qo'lda tasdiqlaysizmi? Bu haqiqiy to'lov kelganini o'zingiz tekshirganingizni bildiradi.") + ` (${o.code} — ${fmt(o.amount)} ${t("so'm")})`,
      confirmLabel: t("Tasdiqlash"),
    });
    if (!ok) return;
    setBusy(o.id); setActErr(null);
    try {
      const path = o.source === 'bot' ? `/bot-orders/${o.id}/confirm-payment` : `/orders/${o.id}/confirm-payment`;
      await adminApi(path, { method: 'POST' });
      await load();
    }
    catch (e) { setActErr(e.status === 403 ? t("Ruxsat yo'q") : e.status === 409 || e.status === 404 ? t("Tasdiqlab bo'lmadi — buyurtma allaqachon ishlangan yoki topilmadi.") : apiErrText(e, t)); }
    finally { setBusy(null); }
  };

  // Kutilayotgan buyurtmani bekor qilish — kodni qayta sotuvga chiqaradi.
  // Backend faol Payme tranzaksiyasi bor buyurtmani rad etadi (409
  // payme_active) — hosting/api/admin-extra.js izohiga qarang.
  const cancelOrder = async (o) => {
    const ok = await confirm({
      title: t('Buyurtmani bekor qilish'),
      text: t("«{code}» uchun kutilayotgan buyurtma bekor qilinadi va kod qayta sotuvga chiqadi. To'langan buyurtmalarga ta'sir qilmaydi.", { code: o.code }),
      confirmText: t('Bekor qilish'),
    });
    if (!ok) return;
    setBusy(o.id); setActErr(null);
    try {
      await adminApi(`/orders/${o.id}/cancel`, { method: 'POST' });
      await load();
    } catch (e) {
      setActErr(
        e.status === 403 ? t("Ruxsat yo'q")
          : e.status === 409 && e.body?.error === 'payme_active'
            ? t("Bu buyurtmada faol Payme tranzaksiyasi bor — 24 soat o'tgach bekor qilish mumkin.")
            : e.status === 409 ? t("Bekor qilib bo'lmadi — buyurtma allaqachon ishlangan.")
              : apiErrText(e, t),
      );
    } finally { setBusy(null); }
  };

  if (loadErr) return <><PaymeTestOrder /><LoadError err={loadErr} onRetry={load} title={t("Buyurtmalarni yuklab bo'lmadi.")} /></>;
  if (!orders) return <><PaymeTestOrder /><AdminLoading rows={8} /></>;
  if (orders.length === 0) return <><PaymeTestOrder /><EmptyState icon="bag" title={t("Hozircha buyurtma yo'q.")} /></>;
  const visible = orders.slice(0, shown);
  return (
    <div className="overflow-x-auto">
      <PaymeTestOrder />
      {dialog}
      {actErr && <div role="alert" className="vz-err mb-3">{actErr}</div>}
      <table className="table table-sm">
        <thead><tr><th>{t('Manba')}</th><th>{t('Kod')}</th><th>{t('Foydalanuvchi')}</th><th>{t('Narx')}</th><th>{t('Holat')}</th><th>{t('Vaqt')}</th><th></th></tr></thead>
        <tbody>
          {visible.map((o) => (
            <Fragment key={o.source + o.id}>
            <tr>
              <td><span className="badge badge-ghost badge-sm">{o.source === 'web' ? t('Sayt') : t('Bot')}</span></td>
              <td className="font-mono">{o.code}</td>
              <td className="text-xs">{o.source === 'bot' ? (o.tgUsername ? '@' + o.tgUsername : o.tgName) : ('#' + o.userId)}</td>
              <td>{fmt(o.amount)}</td>
              <td>{(() => { const st = ORDER_STATUS_LABEL[o.status] || { text: `Noma'lum holat (${o.status})`, cls: 'badge-ghost' }; return <span className={`badge badge-sm ${st.cls}`}>{t(st.text)}</span>; })()}</td>
              <td className="whitespace-nowrap text-xs text-base-content/50">{timeAgo(new Date(o.createdAt).getTime())}</td>
              <td>
                {o.status === 'pending' && isSuper && (
                  <div className="flex flex-wrap gap-1.5">
                    <button className="btn btn-outline-gold btn-xs min-h-9" disabled={busy === o.id} onClick={() => confirmPayment(o)}>
                      {busy === o.id ? <span className="loading loading-spinner loading-xs"></span> : t("Qo'lda tasdiqlash")}
                    </button>
                    {o.source === 'web' && (
                      <button className="btn btn-ghost btn-xs min-h-9 text-error" disabled={busy === o.id} onClick={() => cancelOrder(o)}>
                        {t('Bekor qilish')}
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
            {/* JISMONIY KARTA — bosma maket. Admin nima chop etishi
                kerakligini shu yerda ko'radi va tipografiyaga
                to'g'ridan-to'g'ri yuklab oladi. Maket buyurtma bosilgan
                DAQIQADA saqlangan: mijoz keyin dizaynini o'zgartirsa
                ham, bu yerda to'langan variant turadi. */}
            {o.kind === 'physical_card_order' && (
              <tr>
                <td colSpan={7} className="bg-black/20">
                  <PhysicalCardDesign order={o} />
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <LoadMore shown={visible.length} total={orders.length} onMore={setShown} />
    </div>
  );
}

// Foydalanuvchilardan "noyob nomni auksionga qo'ying" so'rovlari.
function AuctionRequestsTab() {
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirm();
  const [requests, setRequests] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => { setLoadErr(null); adminApi('/auction-requests').then((d) => setRequests(Array.isArray(d?.requests) ? d.requests : [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const reject = async (id) => {
    if (!(await confirm({ title: t("So'rovni rad etish"), message: t("Bu so'rovni rad etasizmi?"), confirmLabel: t('Rad etish'), danger: true }))) return;
    setBusy(id); setMsg(null);
    try { await adminApi(`/auction-requests/${id}/reject`, { method: 'POST' }); await load(); }
    catch (e) { setMsg({ type: 'err', text: apiErrText(e, t) }); }
    finally { setBusy(null); }
  };

  // Tasdiqlash \u2192 so'rov "Talab" board'iga qo'shiladi (auksion YARATILMAYDI).
  const approve = async (id) => {
    setBusy(id);
    setMsg(null);
    try {
      await adminApi(`/auction-requests/${id}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message === 'code_taken' ? t('Bu kod allaqachon band bo\u2019lib qolgan.') : apiErrText(err, t) });
    } finally {
      setBusy(null);
    }
  };

  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t("Auksion so'rovlarini yuklab bo'lmadi.")} />;
  if (!requests) return <AdminLoading />;
  if (requests.length === 0) return <EmptyState icon="clipboard" title={t("Hozircha so'rov yo'q.")} hint={t("Foydalanuvchilar yuborgan auksion so'rovlari shu yerda ko'rinadi.")} />;
  return (
    <div className="space-y-3">
      {dialog}
      {msg && <div role="alert" className={`alert py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
      <p className="text-xs text-base-content/45">{t("Tasdiqlangan so'rov \u201CTalab\u201D bo'limiga tushadi. Auksion 20 kishi qiziqib, siz \u201CAuksionni boshlash\u201D bosganda ochiladi.")}</p>
      {requests.map((r) => (
        <div key={r.id} className="vz-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 break-words">
              <div className="font-mono text-sm font-bold">{r.code}</div>
              <div className="text-xs text-base-content/50">
                {r.userCode ? (
                  <a href={'/' + r.userCode} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{r.userEmail}</a>
                ) : r.userEmail}
                {' \u2014 '}{timeAgo(new Date(r.createdAt).getTime())}
              </div>
              {r.note && <p className="mt-1 text-xs text-base-content/60">{'\u201C'}{r.note}{'\u201D'}</p>}
            </div>
            <div className="flex flex-wrap gap-1">
              <button className="btn btn-success btn-xs min-h-9" disabled={busy === r.id} onClick={() => approve(r.id)}>
                {busy === r.id ? <span className="loading loading-spinner loading-xs"></span> : t("Tasdiqlab, Talab'ga qo'shish")}
              </button>
              <button className="btn btn-ghost btn-xs min-h-9 text-error" disabled={busy === r.id} onClick={() => reject(r.id)}>{t('Rad etish')}</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Foydalanuvchilarga to'lanishi kerak bo'lgan real pullar — premium
// obunachi to'lovlaridan tegishli ulush. Admin qo'lda (Payme/karta orqali)
// to'laydi va shu yerda "tozalaydi" (e-wallet yo'q, avtomatik o'tkazib
// bo'lmaydi).
function PendingPayoutsTab() {
  const { t } = useLanguage();
  const { isSuper } = useAdmin();
  const { confirm, dialog } = useConfirm();
  const [payouts, setPayouts] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [actErr, setActErr] = useState(null);
  const load = () => { setLoadErr(null); setPayouts(null); return adminApi('/pending-payouts').then((d) => setPayouts(Array.isArray(d?.payouts) ? d.payouts : [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const clear = async (userId, amount) => {
    if (!(await confirm({ title: t("To'landi deb belgilash"), message: t("{n} so'mni qo'lda to'laganingizni tasdiqlaysizmi?", { n: fmt(amount) }), confirmLabel: t("To'landi deb belgilash") }))) return;
    setBusy(userId); setActErr(null);
    try { await adminApi(`/pending-payouts/${userId}/clear`, { method: 'POST', body: JSON.stringify({ amount }) }); await load(); }
    catch (e) { setActErr(e.status === 409 ? t("Summa kutilayotgan to'lovdan katta — ro'yxatni yangilang.") : apiErrText(e, t)); }
    finally { setBusy(null); }
  };

  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t("To'lovlar ro'yxatini yuklab bo'lmadi.")} />;
  if (!payouts) return <AdminLoading />;
  if (payouts.length === 0) return <EmptyState icon="wallet" title={t("Hozircha hech kimga to'lanishi kerak bo'lgan pul yo'q.")} />;
  return (
    <div className="overflow-x-auto">
      {dialog}
      {actErr && <div role="alert" className="vz-err mb-3">{actErr}</div>}
      <table className="table table-sm">
        <thead><tr><th>Email</th><th>{t('Telefon')}</th><th>{t("To'lanishi kerak")}</th><th></th></tr></thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td>{p.email}</td>
              <td className="font-mono text-xs">{p.phone || '—'}</td>
              <td className="font-semibold">{fmt(p.pendingPayout)} {t("so'm")}</td>
              <td>
                {isSuper && (
                  <button className="btn btn-success btn-xs min-h-9" disabled={busy === p.id} onClick={() => clear(p.id, p.pendingPayout)}>
                    {t("To'landi deb belgilash")}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Auksion yaratishning YAGONA yo'li — faqat admin, faqat hali hech
// kimga tegishli bo'lmagan (band qilinmagan) YANGI kodlar uchun.
function CreateAuctionForm({ onCreated }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ code: '', startPrice: '', buyNowPrice: '', hours: '24' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async () => {
    const code = form.code.trim().toUpperCase();
    const startPrice = Math.round(Number(form.startPrice));
    const buyNowPrice = form.buyNowPrice ? Math.round(Number(form.buyNowPrice)) : null;
    const hours = Math.min(72, Math.max(1, Math.round(Number(form.hours) || 24)));
    if (!code) { setMsg({ type: 'err', text: t('Kodni kiriting (masalan VIP001).') }); return; }
    if (!startPrice || startPrice < 10_000) { setMsg({ type: 'err', text: t("Boshlang'ich narx kamida 10 000 so'm bo'lishi kerak.") }); return; }
    setBusy(true);
    setMsg(null);
    try {
      await adminApi('/auctions', { method: 'POST', body: JSON.stringify({ code, startPrice, buyNowPrice, hours }) });
      setMsg({ type: 'ok', text: t('{code} uchun auksion ochildi!', { code }) });
      setForm({ code: '', startPrice: '', buyNowPrice: '', hours: '24' });
      onCreated?.();
    } catch (err) {
      setMsg({ type: 'err', text: err.message === 'code_taken' ? t('Bu kod allaqachon band.') : err.message === 'already_in_auction' ? t('Bu kod allaqachon auksionda.') : apiErrText(err, t) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vz-card mb-6 p-5">
      <span className="vz-kicker">{t('Yangi auksion ochish')}</span>
      <p className="mt-1 text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t("Faqat hali hech kimga tegishli bo'lmagan (bo'sh) kodlar uchun.")}</p>
      <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder={t("Kod (VIP001)")} className="vz-input min-w-0 font-mono" aria-label={t("Kod (VIP001)")} />
        <input type="number" value={form.startPrice} onChange={(e) => setForm((f) => ({ ...f, startPrice: e.target.value }))} placeholder={t("Boshlang'ich narx")} className="vz-input min-w-0" aria-label={t("Boshlang'ich narx")} />
        <input type="number" value={form.buyNowPrice} onChange={(e) => setForm((f) => ({ ...f, buyNowPrice: e.target.value }))} placeholder={t("Darhol sotib olish (ixt.)")} className="vz-input min-w-0" aria-label={t("Darhol sotib olish (ixt.)")} />
        <input type="number" max={72} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder={t("Soat (maks. 72)")} className="vz-input min-w-0" aria-label={t("Soat (maks. 72)")} />
      </div>
      <button className="btn btn-gold btn-sm mt-3 min-h-11" onClick={submit} disabled={busy}>
        {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Auksion ochish')}
      </button>
      {msg && <div role="alert" className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
    </div>
  );
}

// ---------- Auksion "Talab" board ----------

const DEMAND_STATUS_LABEL = {
  collecting: 'Talab yig‘ilmoqda',
  ready: 'Auksionga tayyor',
  auction_live: 'Faol auksion',
  done: 'Yakunlangan',
  hidden: 'Yashirilgan',
};

function AuctionDemandTab() {
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirm();
  const [rows, setRows] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [form, setForm] = useState({ code: '', startPrice: '250000', minStep: '25000' });
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [startId, setStartId] = useState(null);
  const [startForm, setStartForm] = useState({ startPrice: '', buyNowPrice: '', minStep: '', hours: '24' });

  const load = () => { setLoadErr(null); adminApi('/auction-demand').then((d) => setRows(Array.isArray(d?.demand) ? d.demand : [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,16}$/.test(code)) { setMsg({ type: 'err', text: t('Kod formati noto‘g‘ri.') }); return; }
    setBusy('add'); setMsg(null);
    try {
      await adminApi('/auction-demand', { method: 'POST', body: JSON.stringify({ code, startPrice: Number(form.startPrice), minStep: Number(form.minStep) }) });
      setForm({ code: '', startPrice: '250000', minStep: '25000' });
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message === 'code_taken' ? t('Bu kod allaqachon band.') : err.message === 'already_exists' ? t('Bu kod board‘da bor.') : apiErrText(err, t) });
    } finally { setBusy(null); }
  };

  const patch = async (id, body) => {
    setBusy(id); setMsg(null);
    try { await adminApi(`/auction-demand/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); await load(); }
    catch (e) { setMsg({ type: 'err', text: apiErrText(e, t) }); }
    finally { setBusy(null); }
  };

  const del = async (id) => {
    if (!(await confirm({ title: t("Board'dan o'chirish"), message: t('Bu kodni board‘dan o‘chirasizmi?'), confirmLabel: t('O‘chirish'), danger: true }))) return;
    setBusy(id); setMsg(null);
    try { await adminApi(`/auction-demand/${id}`, { method: 'DELETE' }); await load(); }
    catch (e) { setMsg({ type: 'err', text: apiErrText(e, t) }); }
    finally { setBusy(null); }
  };

  const startAuction = async (row) => {
    const startPrice = Math.round(Number(startForm.startPrice || row.suggestedStartPrice));
    const minStep = Math.round(Number(startForm.minStep || row.suggestedMinStep));
    const buyNowPrice = startForm.buyNowPrice ? Math.round(Number(startForm.buyNowPrice)) : null;
    const hours = Math.min(72, Math.max(1, Math.round(Number(startForm.hours) || 24)));
    if (!startPrice || startPrice < 10_000) { setMsg({ type: 'err', text: t("Boshlang'ich narx kamida 10 000 so'm bo'lishi kerak.") }); return; }
    setBusy(row.id); setMsg(null);
    try {
      await adminApi('/auctions', { method: 'POST', body: JSON.stringify({ code: row.code, startPrice, buyNowPrice, minStep, hours }) });
      setStartId(null);
      setStartForm({ startPrice: '', buyNowPrice: '', minStep: '', hours: '24' });
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message === 'code_taken' ? t('Bu kod allaqachon band.') : err.message === 'already_in_auction' ? t('Bu kod allaqachon auksionda.') : apiErrText(err, t) });
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      {dialog}
      <div className="vz-card p-5">
        <span className="vz-kicker">{t('Board‘ga kod qo‘shish')}</span>
        <p className="mt-1 text-xs" style={{ color: 'var(--vz-ink-2)' }}>
          {t("Tavsiya boshlang'ich narx: oddiy 250 000 · kuchli 500 000 · juda noyob 1 000 000+. Qadam: 25 000 / 50 000 / 100 000.")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder={t('Kod (VIP007)')} className="vz-input min-w-0 font-mono" aria-label={t('Kod (VIP007)')} />
          <input type="number" value={form.startPrice} onChange={(e) => setForm((f) => ({ ...f, startPrice: e.target.value }))} placeholder={t("Boshlang'ich narx")} className="vz-input min-w-0" aria-label={t("Boshlang'ich narx")} />
          <input type="number" value={form.minStep} onChange={(e) => setForm((f) => ({ ...f, minStep: e.target.value }))} placeholder={t('Minimal qadam')} className="vz-input min-w-0" aria-label={t('Minimal qadam')} />
          <button className="btn btn-gold min-h-11" onClick={add} disabled={busy === 'add'}>
            {busy === 'add' ? <span className="loading loading-spinner loading-xs"></span> : t('Qo‘shish')}
          </button>
        </div>
        {msg && <div role="alert" className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
      </div>

      {loadErr ? <LoadError err={loadErr} onRetry={load} title={t("Talab board'ini yuklab bo'lmadi.")} />
        : !rows ? <AdminLoading />
        : rows.length === 0 ? <EmptyState icon="flame" title={t('Board bo‘sh.')} hint={t('Yuqoridan kod qo‘shing.')} />
        : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="vz-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono text-sm font-bold">{r.code}</span>
                  <span className="ml-2 inline-flex align-middle">
                    <StatusBadge tone={r.status === 'ready' ? 'success' : r.status === 'auction_live' ? 'accent' : 'muted'}>
                      {t(DEMAND_STATUS_LABEL[r.status] || r.status)}
                    </StatusBadge>
                  </span>
                  <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs" style={{ color: 'var(--vz-ink-2)' }}><AdminIcon name="flame" className="h-3.5 w-3.5" /> {r.interestCount} / {r.threshold}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(r.status === 'ready' || r.status === 'collecting') && (
                    <button className="btn btn-outline-gold btn-xs min-h-9" onClick={() => { setStartId(startId === r.id ? null : r.id); setStartForm({ startPrice: String(r.suggestedStartPrice), buyNowPrice: '', minStep: String(r.suggestedMinStep), hours: '24' }); }}>
                      {t('Auksionni boshlash')}
                    </button>
                  )}
                  {r.status !== 'hidden'
                    ? <button className="btn btn-ghost btn-xs min-h-9" disabled={busy === r.id} onClick={() => patch(r.id, { status: 'hidden' })}>{t('Yashirish')}</button>
                    : <button className="btn btn-ghost btn-xs min-h-9" disabled={busy === r.id} onClick={() => patch(r.id, { status: 'collecting' })}>{t('Ko‘rsatish')}</button>}
                  <button className="btn btn-ghost btn-xs min-h-9 text-error" disabled={busy === r.id} onClick={() => del(r.id)}>{t('O‘chirish')}</button>
                </div>
              </div>
              {startId === r.id && (
                <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: 'var(--vz-line)' }}>
                  <input type="number" value={startForm.startPrice} onChange={(e) => setStartForm((f) => ({ ...f, startPrice: e.target.value }))} placeholder={t("Boshlang'ich narx")} className="vz-input min-w-0" aria-label={t("Boshlang'ich narx")} />
                  <input type="number" value={startForm.buyNowPrice} onChange={(e) => setStartForm((f) => ({ ...f, buyNowPrice: e.target.value }))} placeholder={t("Darhol sotib olish (ixt.)")} className="vz-input min-w-0" aria-label={t("Darhol sotib olish (ixt.)")} />
                  <input type="number" value={startForm.minStep} onChange={(e) => setStartForm((f) => ({ ...f, minStep: e.target.value }))} placeholder={t('Minimal qadam')} className="vz-input min-w-0" aria-label={t('Minimal qadam')} />
                  <input type="number" max={72} value={startForm.hours} onChange={(e) => setStartForm((f) => ({ ...f, hours: e.target.value }))} placeholder={t('Soat')} className="vz-input min-w-0" aria-label={t('Soat')} />
                  <button className="btn btn-gold min-h-11 sm:col-span-2 lg:col-span-4" disabled={busy === r.id} onClick={() => startAuction(r)}>
                    {busy === r.id ? <span className="loading loading-spinner loading-xs"></span> : t('Auksionni ochish')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const AUCTION_STATUS_LABEL = {
  active: 'Faol',
  awaiting_payment: "To'lov kutilmoqda",
  sold: 'Sotildi',
  expired: 'Taklifsiz tugadi',
  payment_expired: "To'lov muddati o'tdi",
  cancelled: 'Bekor qilindi',
};

function AuctionsTab() {
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirm();
  const [auctions, setAuctions] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [actErr, setActErr] = useState(null);

  const load = () => { setLoadErr(null); adminApi('/auctions').then((d) => setAuctions(Array.isArray(d?.auctions) ? d.auctions : [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const act = async (id, path, errMap) => {
    setBusy(id); setActErr(null);
    try { await adminApi(path, { method: 'POST' }); await load(); }
    catch (e) { setActErr((errMap && errMap(e)) || apiErrText(e, t)); }
    finally { setBusy(null); }
  };
  const cancel = async (id) => {
    if (!(await confirm({ title: t('Auksionni bekor qilish'), message: t("Bu auksionni bekor qilishni tasdiqlaysizmi? Barcha bandlangan mablag'lar bo'shatiladi."), confirmLabel: t('Bekor qilish'), danger: true }))) return;
    await act(id, `/auctions/${id}/cancel`);
  };
  const forceSettle = async (id) => {
    if (!(await confirm({ title: t('Auksionni yakunlash'), message: t("Bu auksionni muddatidan oldin yakunlashni tasdiqlaysizmi?"), confirmLabel: t('Yakunlash') }))) return;
    await act(id, `/auctions/${id}/force-settle`);
  };
  const confirmPayment = async (id) => {
    if (!(await confirm({ title: t("To'lovni tasdiqlash"), message: t("G'olibning to'lovini QO'LDA tasdiqlaysizmi? Haqiqiy pul kelganini o'zingiz tekshirganingizni bildiradi — auksion yakunlanadi va NFC ID g'olibga o'tadi."), confirmLabel: t("To'lovni tasdiqlash") }))) return;
    await act(id, `/auctions/${id}/confirm-payment`, (e) => (e.status === 409 ? t("Bu auksion uchun kutilayotgan to'lov buyurtmasi yo'q (g'olib hali \"To'lash\" bosmagan yoki allaqachon ishlangan).") : null));
  };

  if (loadErr) {
    return (
      <div>
        <CreateAuctionForm onCreated={load} />
        <LoadError err={loadErr} onRetry={load} title={t("Auksionlarni yuklab bo'lmadi.")} />
      </div>
    );
  }
  if (!auctions) return <div><CreateAuctionForm onCreated={load} /><AdminLoading /></div>;
  return (
    <div>
      {dialog}
      <CreateAuctionForm onCreated={load} />
      {actErr && <div role="alert" className="vz-err mb-3">{actErr}</div>}
      {auctions.length === 0 ? <EmptyState icon="hammer" title={t("Hozircha auksion yo'q.")} hint={t("Yuqoridagi forma orqali yangi auksion oching.")} /> : (
      <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>{t('Kod')}</th><th>{t('Joriy narx')}</th><th>{t('Yetakchi')}</th><th>{t('Holat')}</th><th>{t('Tugash')}</th><th></th></tr></thead>
        <tbody>
          {auctions.map((a) => (
            <tr key={a.id}>
              <td className="font-mono">{a.code}</td>
              <td>{fmt(a.currentPrice)}</td>
              <td className="text-xs">{a.highestBidderEmail || '—'}</td>
              <td><span className={`badge badge-sm ${a.status === 'active' ? 'badge-success' : a.status === 'sold' ? 'badge-accent' : a.status === 'awaiting_payment' ? 'badge-warning' : 'badge-ghost'}`}>{t(AUCTION_STATUS_LABEL[a.status] || a.status)}</span></td>
              <td className="whitespace-nowrap text-xs text-base-content/50">{dateTime(new Date(a.endsAt).getTime())}</td>
              <td>
                {a.status === 'active' && (
                  <div className="flex flex-wrap gap-1">
                    <button className="btn btn-ghost btn-xs min-h-9" disabled={busy === a.id} onClick={() => forceSettle(a.id)}>{t('Yakunlash')}</button>
                    <button className="btn btn-ghost btn-xs min-h-9 text-error" disabled={busy === a.id} onClick={() => cancel(a.id)}>{t('Bekor qilish')}</button>
                  </div>
                )}
                {a.status === 'awaiting_payment' && (
                  <div className="flex flex-wrap gap-1">
                    <button className="btn btn-success btn-xs min-h-9" disabled={busy === a.id} onClick={() => confirmPayment(a.id)}>
                      {busy === a.id ? <span className="loading loading-spinner loading-xs"></span> : t("To'lovni tasdiqlash")}
                    </button>
                    <button className="btn btn-ghost btn-xs min-h-9 text-error" disabled={busy === a.id} onClick={() => cancel(a.id)}>{t('Bekor qilish')}</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      )}
    </div>
  );
}

const CARD_STATUS = ['pending', 'printing', 'shipped', 'delivered'];
const CARD_STATUS_LABEL = { pending: 'Kutilmoqda', printing: 'Bosilmoqda', shipped: "Jo'natildi", delivered: 'Yetkazildi' };

// Foydalanuvchilardan kelgan "Adminga murojaat" xabarlari — javob
// yozish shu yerdan.
// Tashqi analitika xizmatlariga tezkor havolalar — GA/Yandex hisobingizni
// UTM (utm_source=telegram/instagram/google) bilan sozlab, shu yerdan
// ochib tekshirasiz.
function ExternalAnalyticsTab() {
  const { t } = useLanguage();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <a
        href="https://analytics.google.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="vz-card flex min-w-0 items-center gap-4 p-5 transition hover:border-[var(--vz-gold)]"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--vz-card-2)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24"><path fill="#F9AB00" d="M22 21h-4V3h4v18zM14 21h-4v-9h4v9zM6 21H2v-5h4v5z"/></svg>
        </div>
        <div className="min-w-0 break-words">
          <div className="font-bold">Google Analytics</div>
          <p className="mt-0.5 text-xs text-base-content/50">{t("Tashrif, manba (Telegram/Instagram/Google), sotuv voronkasi va tushum")}</p>
        </div>
      </a>
      <a
        href="https://metrika.yandex.ru/"
        target="_blank"
        rel="noopener noreferrer"
        className="vz-card flex min-w-0 items-center gap-4 p-5 transition hover:border-[var(--vz-gold)]"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--vz-card-2)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#FF3333"/><text x="12" y="17" fontSize="14" fontWeight="bold" fill="#fff" textAnchor="middle">Y</text></svg>
        </div>
        <div className="min-w-0 break-words">
          <div className="font-bold">Yandex Metrika / Webvisor</div>
          <p className="mt-0.5 text-xs text-base-content/50">{t("Foydalanuvchi harakati, bosilgan tugmalar, UX tahlili")}</p>
        </div>
      </a>
      <div className="vz-panel break-words p-4 text-xs sm:col-span-2" style={{ color: 'var(--vz-ink-2)' }}>
        <b className="text-base-content/70">{t('UTM manbalarni kuzatish:')}</b> reklama havolalariga <code className="rounded bg-black/30 px-1">?utm_source=telegram</code>, <code className="rounded bg-black/30 px-1">?utm_source=instagram</code> yoki <code className="rounded bg-black/30 px-1">?utm_source=google</code> {t("qo'shing — shunda GA/Yandex'da har bir manbadan kelgan tashrif → ro'yxatdan o'tish → buyurtma → to'lov zanjirini alohida solishtirasiz.")}
      </div>
    </div>
  );
}

// Security → Login History (2FA, IP whitelist, Activity Log kabi
// qolgan bo'limlar hozircha rejalashtirilgan — bu birinchi qismi).
function SecurityTab({ initialSub }) {
  const { t } = useLanguage();
  const { isSuper, refreshMe } = useAdmin();
  const { confirm, dialog } = useConfirm();
  const [subTab, setSubTab] = useState(initialSub || (isSuper ? 'login' : '2fa')); // login | activity | ip | 2fa
  const [history, setHistory] = useState(null);
  const [historyErr, setHistoryErr] = useState(null);
  const [activity, setActivity] = useState(null);
  const [activityErr, setActivityErr] = useState(null);
  const [ipData, setIpData] = useState(null);
  const [ipErr, setIpErr] = useState(null);
  const [newIp, setNewIp] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [ipBusy, setIpBusy] = useState(false);
  const [ipMsg, setIpMsg] = useState(null);

  const loadIp = () => { setIpErr(null); return adminApi('/ip-whitelist').then(setIpData).catch((e) => setIpErr(e)); };
  const loadHistory = () => { setHistoryErr(null); setHistory(null); adminApi('/login-history').then((d) => setHistory(d.history || [])).catch((e) => setHistoryErr(e)); };
  const loadActivity = () => { setActivityErr(null); setActivity(null); adminApi('/activity-log').then((d) => setActivity(d.log || [])).catch((e) => setActivityErr(e)); };

  // ---------- 2FA / Google Authenticator (TOTP) ----------
  const [totpStatus, setTotpStatus] = useState(null); // { enabled }
  // `totpSetup` holds the secret ONLY transiently, in memory, for the
  // duration of this one setup flow — never localStorage, never logged,
  // cleared the moment setup finishes (success or cancel) or this
  // component unmounts.
  const [totpSetup, setTotpSetup] = useState(null); // { secret, otpauth }
  const [totpCode, setTotpCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpMsg, setTotpMsg] = useState(null);
  const totpCanvasRef = useRef(null);

  const [totpErr, setTotpErr] = useState(null);
  const loadTotpStatus = () => { setTotpErr(null); return adminApi('/2fa/totp/status').then((d) => { setTotpStatus(d); refreshMe(); }).catch((e) => setTotpErr(e)); };

  useEffect(() => {
    if (subTab === 'login' && !history && !historyErr) loadHistory();
    if (subTab === 'activity' && !activity && !activityErr) loadActivity();
    if (subTab === 'ip' && !ipData && !ipErr) loadIp();
    if (subTab === '2fa' && !totpStatus && !totpErr) loadTotpStatus();
  }, [subTab]);

  useEffect(() => {
    if (!totpSetup?.otpauth || !totpCanvasRef.current) return;
    let cancelled = false;
    import('qrcode').then((QRCode) => {
      if (cancelled || !totpCanvasRef.current) return;
      QRCode.toCanvas(totpCanvasRef.current, totpSetup.otpauth, { margin: 1, width: 220 }, () => {});
    });
    return () => { cancelled = true; };
  }, [totpSetup]);

  // Setup faqat shu componentda, faqat xotirada — sahifadan chiqilsa
  // (tab almashsa) tugallanmagan setup holati (secret) darhol tozalanadi.
  useEffect(() => () => setTotpSetup(null), []);

  const startTotpSetup = async () => {
    setTotpBusy(true);
    setTotpMsg(null);
    try {
      const result = await adminApi('/2fa/totp/setup', { method: 'POST' });
      setTotpSetup(result);
      setTotpCode('');
    } catch (e) {
      setTotpMsg(apiErrText(e, t));
    } finally {
      setTotpBusy(false);
    }
  };
  const confirmTotpSetup = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(totpCode.trim())) { setTotpMsg(t("6 xonali kodni to'liq kiriting.")); return; }
    setTotpBusy(true);
    setTotpMsg(null);
    try {
      await adminApi('/2fa/totp/confirm', { method: 'POST', body: JSON.stringify({ code: totpCode.trim() }) });
      setTotpSetup(null);
      setTotpCode('');
      await loadTotpStatus();
    } catch (e2) {
      setTotpMsg(e2.message === 'not_set_up' ? t("Avval 'Google Authenticator ulash' tugmasini bosing.") : t("Kod noto'g'ri."));
    } finally {
      setTotpBusy(false);
    }
  };
  const cancelTotpSetup = () => { setTotpSetup(null); setTotpCode(''); setTotpMsg(null); };
  // Backend o'chirish uchun joriy parolni talab qiladi ({ password }).
  const disableTotp = async () => {
    const password = await confirm({
      title: t("Google Authenticator'ni o'chirish"),
      message: t("Google Authenticator'ni O'CHIRASIZMI? Bu keyingi kirishlarda 2FA kodi so'ralmasligini bildiradi.") + ' ' + t("Tasdiqlash uchun joriy parolingizni kiriting."),
      input: { label: t('Parol'), type: 'password', placeholder: '••••••••' },
      confirmLabel: t("O'chirish"),
      danger: true,
    });
    if (password == null) return;
    setTotpBusy(true); setTotpMsg(null);
    try {
      await adminApi('/2fa/totp/disable', { method: 'POST', body: JSON.stringify({ password }) });
      await loadTotpStatus();
    } catch (e) {
      setTotpMsg(e.message === 'confirmation_required' ? t("Parol noto'g'ri — 2FA o'chirilmadi.") : apiErrText(e, t));
    } finally {
      setTotpBusy(false);
    }
  };

  const addIp = async () => {
    if (!newIp.trim()) return;
    setIpBusy(true);
    setIpMsg(null);
    try {
      await adminApi('/ip-whitelist/add', { method: 'POST', body: JSON.stringify({ ip: newIp.trim(), label: newLabel.trim() }) });
      setNewIp('');
      setNewLabel('');
      await loadIp();
    } catch (e) {
      setIpMsg(e.message === 'MAX_2' ? t("Faqat 2 ta IP qo'shish mumkin.") : e.message === 'ALREADY_EXISTS' ? t('Bu IP allaqachon ro\u2019yxatda.') : apiErrText(e, t));
    } finally {
      setIpBusy(false);
    }
  };
  const removeIp = async (id) => {
    if (!(await confirm({ title: t("IP'ni o'chirish"), message: t("Bu IP manzilni whitelist'dan o'chirasizmi?"), confirmLabel: t("O'chirish"), danger: true }))) return;
    setIpBusy(true); setIpMsg(null);
    try { await adminApi(`/ip-whitelist/${id}/remove`, { method: 'POST' }); await loadIp(); }
    catch (e) { setIpMsg(apiErrText(e, t)); }
    finally { setIpBusy(false); }
  };
  const toggleEnabled = async () => {
    setIpBusy(true);
    setIpMsg(null);
    try {
      await adminApi('/ip-whitelist/toggle', { method: 'POST', body: JSON.stringify({ enabled: !ipData.enabled }) });
      await loadIp();
    } catch (e) {
      setIpMsg(e.message === 'no_ips' ? t("Avval kamida 1 ta IP qo'shing.") : apiErrText(e, t));
    } finally {
      setIpBusy(false);
    }
  };

  const EVENT_LABEL = {
    login_ok: { text: t('Muvaffaqiyatli kirish'), cls: 'badge-success' },
    bad_password: { text: t("Noto'g'ri parol"), cls: 'badge-error' },
    bad_2fa: { text: t('2FA xatosi'), cls: 'badge-error' },
    rate_limited: { text: t('Bloklangan urinish'), cls: 'badge-error' },
    logout: { text: t('Chiqish'), cls: 'badge-ghost' },
    idle_timeout: { text: t('Sessiya tugadi (faoliyatsizlik)'), cls: 'badge-warning' },
  };
  const ACTION_LABEL = {
    user_suspended: t('Foydalanuvchi bloklandi'),
    user_unsuspended: t('Blokdan chiqarildi'),
    user_deleted: t("Foydalanuvchi o'chirildi"),
    balance_adjusted: t('Balans tuzatildi'),
    auction_created: t('Auksion yaratildi'),
    nfc_card_blocked: t('NFC karta bloklandi'),
    nfc_card_unblocked: t('NFC karta blokdan chiqarildi'),
  };

  const SEC_SUBTABS = [
    ...(isSuper ? [['login', 'Kirish tarixi'], ['activity', 'Amallar jurnali'], ['ip', 'IP Whitelist']] : []),
    ['2fa', 'Google Authenticator'],
  ];

  return (
    <div>
      {dialog}
      <div className="admin-scroll mb-4 flex gap-2 overflow-x-auto pb-1">
        {SEC_SUBTABS.map(([k, l]) => (
          <button key={k} type="button" className={`btn btn-sm min-h-11 shrink-0 ${subTab === k ? 'btn-gold' : 'btn-ghost-vz'}`} onClick={() => setSubTab(k)}>{t(l)}</button>
        ))}
      </div>

      {subTab === 'login' && !isSuper && <ForbiddenState />}
      {subTab === 'login' && isSuper && (historyErr ? <LoadError err={historyErr} onRetry={loadHistory} title={t("Kirish tarixini yuklab bo'lmadi.")} />
        : !history ? <AdminLoading rows={6} />
        : history.length === 0 ? <EmptyState icon="shield" title={t("Hozircha yozuv yo'q.")} />
        : (
        <div className="vz-card overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>{t('Hodisa')}</th><th>IP</th><th>{t('Qurilma')}</th><th>{t('Vaqt')}</th></tr></thead>
            <tbody>
              {history.map((h) => {
                const ev = EVENT_LABEL[h.event] || { text: h.event, cls: 'badge-ghost' };
                return (
                  <tr key={h.id}>
                    <td><span className={`badge badge-sm ${ev.cls}`}>{ev.text}</span></td>
                    <td className="font-mono text-xs">{h.ip || '—'}</td>
                    <td className="max-w-[220px] truncate text-xs text-base-content/50" title={h.userAgent || ''}>{h.userAgent || '—'}</td>
                    <td className="whitespace-nowrap text-xs text-base-content/50">{timeAgo(new Date(h.createdAt).getTime())}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      {subTab === 'activity' && !isSuper && <ForbiddenState />}
      {subTab === 'activity' && isSuper && (activityErr ? <LoadError err={activityErr} onRetry={loadActivity} title={t("Amallar jurnalini yuklab bo'lmadi.")} />
        : !activity ? <AdminLoading rows={6} />
        : activity.length === 0 ? <EmptyState icon="activity" title={t("Hozircha yozuv yo'q.")} />
        : (
        <div className="vz-card overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>{t('Amal')}</th><th>{t('Tafsilot')}</th><th>{t('Qiymat')}</th><th>{t('Vaqt')}</th></tr></thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold">{t(ACTION_LABEL[a.action] || a.action)}</td>
                  <td className="max-w-xs break-words text-xs text-base-content/60">{a.details || '—'}</td>
                  <td className="max-w-xs break-words text-xs text-base-content/50">{a.newValue || '—'}</td>
                  <td className="whitespace-nowrap text-xs text-base-content/50">{timeAgo(new Date(a.createdAt).getTime())}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t("Bu jurnal oddiy admin tomonidan o'chirilmaydi.")}</p>
        </div>
      ))}

      {subTab === 'ip' && !isSuper && <ForbiddenState />}
      {subTab === 'ip' && isSuper && (
        ipErr ? <LoadError err={ipErr} onRetry={loadIp} title={t("IP whitelist'ni yuklab bo'lmadi.")} />
        : !ipData ? <AdminLoading /> : (
          <div className="vz-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold">IP Whitelist: {ipData.enabled ? <span className="text-success">{t('YOQILGAN')}</span> : <span className="text-base-content/50">{t("O'CHIRILGAN")}</span>}</div>
                <p className="mt-1 text-xs text-base-content/50">{t('Sizning hozirgi IP:')} <code className="rounded bg-black/30 px-1">{ipData.yourIp}</code></p>
              </div>
              <button className={`btn btn-sm min-h-11 ${ipData.enabled ? 'btn-error' : 'btn-success'}`} disabled={ipBusy} onClick={toggleEnabled}>
                {ipData.enabled ? t("O'chirish") : t('Yoqish')}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {ipData.ips.length === 0 && <p className="text-xs" style={{ color: 'var(--vz-ink-3)' }}>{t("Hali IP qo'shilmagan.")}</p>}
              {ipData.ips.map((r) => (
                <div key={r.id} className="vz-panel flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 break-words"><code className="font-mono">{r.ip}</code> {r.label && <span className="text-xs" style={{ color: 'var(--vz-ink-2)' }}>— {r.label}</span>}</span>
                  <button className="btn btn-ghost btn-xs min-h-9 text-error" disabled={ipBusy} onClick={() => removeIp(r.id)}>{t("O'chirish")}</button>
                </div>
              ))}
            </div>

            {ipData.ips.length < 2 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder={t("IP manzil (masalan 91.212.4.10)")} className="vz-input min-w-0 flex-1 font-mono" aria-label={t("IP manzil (masalan 91.212.4.10)")} />
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t("Nom (ixtiyoriy, masalan: Ofis)")} className="vz-input min-w-0 flex-1" aria-label={t("Nom (ixtiyoriy, masalan: Ofis)")} />
                <button className="btn btn-gold min-h-11" disabled={ipBusy} onClick={addIp}>{t("Qo'shish")}</button>
              </div>
            )}
            {ipMsg && <div role="alert" className="vz-err mt-3">{t(ipMsg)}</div>}

            <div className="mt-5 rounded-lg border border-dashed p-3 text-xs break-words" style={{ borderColor: 'rgba(245,158,11,.35)', background: 'rgba(245,158,11,.06)', color: '#fbbf24' }}>
              <b>{t('Xavfsiz tiklash:')}</b> {t("agar o'zingiz (dinamik IP tufayli) bloklanib qolsangiz, Cloudflare Dashboard → nfcstore-api Worker → Settings → Variables bo'limida ADMIN_IP_WHITELIST_BYPASS=true muhit o'zgaruvchisini qo'shing — bu whitelist'ni vaqtincha chetlab o'tadi. Kirib, IP'ni yangilagach, bu o'zgaruvchini albatta o'chirib qo'ying.")}
            </div>
          </div>
        )
      )}

      {subTab === '2fa' && (
        totpErr ? <LoadError err={totpErr} onRetry={loadTotpStatus} title={t("2FA holatini yuklab bo'lmadi.")} />
        : !totpStatus ? <AdminLoading /> : (
          <div id="admin-2fa" className="vz-card p-5">
            {totpStatus.enabled && !totpSetup ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-success"><AdminIcon name="check" className="h-4 w-4" /> {t('Google Authenticator ULANGAN')}</div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t('Har bir kirishda 6 xonali kod so‘raladi.')}</p>
                </div>
                <button className="btn btn-error btn-sm min-h-11" disabled={totpBusy} onClick={disableTotp}>{t("O'chirish")}</button>
              </div>
            ) : !totpSetup ? (
              <div>
                <div className="flex items-center gap-2 text-sm font-bold" style={{ color: '#fbbf24' }}><AdminIcon name="alert" className="h-4 w-4" /> {t('Google Authenticator ulanmagan')}</div>
                <p className="mt-1 text-xs" style={{ color: 'var(--vz-ink-2)' }}>
                  {t('Google Authenticator, Microsoft Authenticator yoki 1Password kabi ilova bilan ulash — kirishda parolga qo‘shimcha 6 xonali kod so‘raladi.')}
                </p>
                <button className="btn btn-gold btn-sm mt-3 min-h-11" disabled={totpBusy} onClick={startTotpSetup}>
                  {totpBusy ? <span className="loading loading-spinner loading-xs"></span> : t('Google Authenticator ulash')}
                </button>
              </div>
            ) : (
              <form onSubmit={confirmTotpSetup}>
                <div className="text-sm font-bold">{t('1-qadam: QR kodni skanerlang')}</div>
                <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:items-start">
                  <canvas ref={totpCanvasRef} className="rounded-lg bg-white p-2" />
                  <div className="min-w-0 text-xs text-base-content/60">
                    <p>{t("Ilova bilan skanerlab bo'lmasa, quyidagi kalitni qo'lda kiriting:")}</p>
                    <code className="mt-1 block break-all rounded bg-black/30 px-2 py-1 font-mono text-[14px] select-all">{totpSetup.secret}</code>
                    <p className="mt-2 text-warning">{t('Bu kalit faqat hozir ko‘rsatiladi — keyinroq qayta ochilmaydi.')}</p>
                  </div>
                </div>
                <div className="mt-4 text-sm font-bold">{t('2-qadam: 6 xonali kodni kiriting')}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
                    className="vz-input w-36 font-mono tracking-widest"
                    aria-label={t('2-qadam: 6 xonali kodni kiriting')}
                  />
                  <button type="submit" className="btn btn-gold btn-sm min-h-11" disabled={totpBusy || totpCode.length !== 6}>
                    {totpBusy ? <span className="loading loading-spinner loading-xs"></span> : t('Tasdiqlash')}
                  </button>
                  <button type="button" className="btn btn-ghost-vz btn-sm min-h-11" disabled={totpBusy} onClick={cancelTotpSetup}>{t('Bekor qilish')}</button>
                </div>
              </form>
            )}
            {totpMsg && <div role="alert" className="vz-err mt-3">{totpMsg}</div>}
          </div>
        )
      )}

      <div className="vz-empty mt-6 text-xs">
        {t("Rejalashtirilgan (hali qo'shilmagan): Avtomatik backup.")}
      </div>
    </div>
  );
}

// Adminlar boshqaruvi (faqat Super Admin) — yangi admin qo'shish, rol
// belgilash, o'chirish.
function AdminsTab() {
  const { t } = useLanguage();
  const [admins, setAdmins] = useState(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('manager');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const { confirm, dialog } = useConfirm();

  const load = () => { setLoadErr(null); return adminApi('/admins').then((d) => setAdmins(Array.isArray(d?.admins) ? d.admins : [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const ROLE_LABEL = { super_admin: 'Super Admin', manager: 'Manager', content_manager: 'Content Manager' };

  const add = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await adminApi('/admins', { method: 'POST', body: JSON.stringify({ phone, password, name, role }) });
      setOpen(false);
      setPhone(''); setPassword(''); setName(''); setRole('manager');
      await load();
    } catch (e) {
      setMsg(e.message === 'phone_taken' ? t('Bu telefon raqami allaqachon mavjud.') : e.message === 'bad_input' ? t("Telefon va kamida 6 belgili parol kiriting.") : apiErrText(e, t));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (a) => {
    if (!(await confirm({ title: t("Adminni o'chirish"), message: t("{name} adminini o'chirasizmi? U panelga kira olmaydi.", { name: a.name || a.phone }), confirmLabel: t("O'chirish"), danger: true }))) return;
    setBusy(true); setMsg(null);
    try { await adminApi(`/admins/${a.id}/remove`, { method: 'POST' }); await load(); }
    catch (e) { setMsg(e.message === 'cannot_remove_self' ? t("O'zingizni o'chira olmaysiz.") : apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t("Adminlarni yuklab bo'lmadi.")} />;
  if (!admins) return <AdminLoading />;

  return (
    <div>
      {dialog}
      <button className="btn btn-gold btn-sm min-h-11" onClick={() => setOpen((o) => !o)}>{t("Yangi admin qo'shish")}</button>
      {open && (
        <div className="vz-card mt-3 grid max-w-lg gap-2 p-3 sm:grid-cols-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" className="vz-input min-w-0" aria-label={t('Telefon')} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Ism")} className="vz-input min-w-0" aria-label={t('Ism')} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("Parol (kamida 6 belgi)")} className="vz-input min-w-0" autoComplete="new-password" aria-label={t("Parol (kamida 6 belgi)")} />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="vz-input min-w-0" aria-label={t('Rol')}>
            <option value="manager">Manager</option>
            <option value="content_manager">Content Manager</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <button className="btn btn-gold min-h-11 sm:col-span-2" disabled={busy} onClick={add}>{t("Qo'shish")}</button>
        </div>
      )}
      {msg && <div role="alert" className="vz-err mt-3">{t(msg)}</div>}

      {admins.length === 0 ? <div className="mt-5"><EmptyState icon="usercheck" title={t("Hozircha admin yo'q.")} /></div> : (
      <div className="vz-card mt-5 overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>{t('Telefon')}</th><th>{t('Ism')}</th><th>{t('Rol')}</th><th>2FA</th><th></th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.phone}</td>
                <td className="break-words">{a.name || '—'}</td>
                <td><span className="vz-badge vz-badge--muted">{ROLE_LABEL[a.role] || a.role}</span></td>
                <td>{a.totpEnabled ? <span className="vz-badge vz-badge--ok">{t('Yoqilgan')}</span> : <span className="vz-badge vz-badge--warn">{t('Yoqilmagan')}</span>}</td>
                <td><button className="btn btn-ghost btn-xs min-h-9 text-error" disabled={busy} onClick={() => remove(a)}>{t("O'chirish")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <div className="mt-4 text-xs break-words" style={{ color: 'var(--vz-ink-2)' }}>
        <b>Manager:</b> {t("Buyurtmalar, Foydalanuvchilar, NFC ID, Support — Security va Adminlar bo'limlariga kira olmaydi.")}<br />
        <b>Content Manager:</b> {t('Bannerlar, sayt matnlari, Support, Xabarlashuv.')}
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState(null);
  const [replyFor, setReplyFor] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const [actErr, setActErr] = useState(null);
  const [shown, setShown] = useState(30);

  const load = () => { setLoadErr(null); setMessages(null); return adminApi('/support-messages').then((d) => setMessages(Array.isArray(d?.messages) ? d.messages : [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const sendReply = async (id) => {
    if (!replyText.trim()) return;
    setBusy(true); setActErr(null);
    try {
      await adminApi(`/support-messages/${id}/reply`, { method: 'POST', body: JSON.stringify({ reply: replyText.trim() }) });
      setReplyFor(null);
      setReplyText('');
      await load();
    } catch (e) {
      setActErr(apiErrText(e, t));
    } finally {
      setBusy(false);
    }
  };

  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t("Murojaatlarni yuklab bo'lmadi.")} />;
  if (!messages) return <AdminLoading rows={5} />;
  if (messages.length === 0) return <EmptyState icon="bell" title={t("Hozircha murojaat yo'q.")} />;
  const visible = messages.slice(0, shown);
  return (
    <div className="space-y-3">
      {actErr && <div role="alert" className="vz-err">{actErr}</div>}
      {visible.map((m) => (
        <div key={m.id} className="vz-card p-4" style={m.status === 'pending' ? { borderColor: 'rgba(245,158,11,.45)' } : undefined}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 break-words text-xs" style={{ color: 'var(--vz-ink-2)' }}>
              {m.userCode ? (
                <a href={'/' + m.userCode} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{m.userEmail}</a>
              ) : m.userEmail}
              {' \u2014 '}{timeAgo(new Date(m.createdAt).getTime())}
            </div>
            {m.status === 'pending' && <span className="vz-badge vz-badge--warn">{t('Kutilmoqda')}</span>}
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.message}</p>
          {m.reply && <p className="vz-panel mt-2 break-words p-2 text-sm" style={{ color: 'var(--vz-gold-2)' }}><b>{t('Javobingiz:')}</b> {m.reply}</p>}
          {m.status === 'pending' && (
            replyFor === m.id ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={t("Javob yozing...")} className="vz-input min-w-0 flex-1" aria-label={t("Javob yozing...")} />
                <button className="btn btn-gold min-h-11" disabled={busy} onClick={() => sendReply(m.id)}>{t('Yuborish')}</button>
                <button className="btn btn-ghost-vz min-h-11" onClick={() => setReplyFor(null)}>{t('Bekor')}</button>
              </div>
            ) : (
              <button className="btn btn-outline-gold btn-xs mt-2 min-h-9" onClick={() => { setReplyFor(m.id); setReplyText(''); }}>{t('Javob berish')}</button>
            )
          )}
        </div>
      ))}
      <LoadMore shown={visible.length} total={messages.length} onMore={setShown} step={30} />
    </div>
  );
}

function PhysicalCardsTab() {
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirm();
  const [cards, setCards] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [actErr, setActErr] = useState(null);
  const load = () => { setLoadErr(null); setCards(null); return adminApi('/physical-cards').then((d) => setCards(Array.isArray(d?.cards) ? d.cards : [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    setActErr(null);
    try { await adminApi(`/physical-cards/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }); await load(); }
    catch (e) { setActErr(apiErrText(e, t)); }
  };

  const toggleActive = async (c) => {
    if (c.active && !(await confirm({ title: t('Kartani bloklash'), message: t('{code} kartasini bloklaysizmi? Ko\'rinmas havola (chip_token) endi profilni ochmaydi.', { code: c.linkedCode }), confirmLabel: t('Bloklash'), danger: true }))) return;
    setBusy(c.id); setActErr(null);
    try {
      await adminApi(`/physical-cards/${c.id}/active`, { method: 'POST', body: JSON.stringify({ active: !c.active }) });
      await load();
    } catch (e) {
      setActErr(apiErrText(e, t));
    } finally {
      setBusy(null);
    }
  };

  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t("Jismoniy kartalarni yuklab bo'lmadi.")} />;
  if (!cards) return <AdminLoading />;
  if (cards.length === 0) return <EmptyState icon="idcard" title={t("Hozircha jismoniy karta buyurtmasi yo'q.")} />;
  return (
    <div className="overflow-x-auto">
      {dialog}
      {actErr && <div role="alert" className="vz-err mb-3">{actErr}</div>}
      <table className="table table-sm">
        <thead><tr><th>{t('Profil')}</th><th>{t('Egasi')}</th><th>{t('Manzil')}</th><th>{t('Faolmi')}</th><th>{t('Holat')}</th><th></th></tr></thead>
        <tbody>
          {cards.map((c) => (
            <tr key={c.id}>
              <td className="font-mono">{c.linkedCode || '—'}</td>
              <td className="break-words text-xs">{c.ownerEmail}<br />{c.shippingPhone}</td>
              <td className="max-w-xs break-words text-xs">{c.shippingAddress}</td>
              <td>{c.active ? <span className="vz-badge vz-badge--ok">{t('Faol')}</span> : <span className="vz-badge vz-badge--muted">{t('bloklangan')}</span>}</td>
              <td>
                <select className="vz-input w-auto py-1" value={c.status} onChange={(e) => setStatus(c.id, e.target.value)} aria-label={t('Holat')}>
                  {CARD_STATUS.map((cs) => <option key={cs} value={cs}>{t(CARD_STATUS_LABEL[cs])}</option>)}
                </select>
              </td>
              <td>
                <button
                  className={`btn btn-xs ${c.active ? 'btn-error' : 'btn-success'}`}
                  disabled={busy === c.id || !c.linkedCode}
                  onClick={() => toggleActive(c)}
                >
                  {busy === c.id ? <span className="loading loading-spinner loading-xs"></span> : (c.active ? t('Bloklash') : t('Blokdan chiqarish'))}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// "GIFT NFC ID" — YANGI, IZOLYATSIYALANGAN admin bo'limi. Boshqa
// tab'larga (Foydalanuvchilar, Auksion, Premium/Oltin/Eksklyuziv va h.k.)
// hech qanday ta'sir qilmaydi.
// ═══════════════════════════════════════════════════════════════════
function GiftNfcIdTab() {
  const { t } = useLanguage();
  const { isManager } = useAdmin();
  const [gifts, setGifts] = useState(null);
  const [code, setCode] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [note, setNote] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [lastCreated, setLastCreated] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  const load = () => { setLoadErr(null); setGifts(null); return adminApi('/nfc-gifts').then((d) => setGifts(Array.isArray(d?.gifts) ? d.gifts : [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!/^[A-Z0-9]{3,16}$/i.test(code.trim())) { setMsg({ type: 'err', text: t("NFC ID formati noto'g'ri.") }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const gift = await adminApi('/nfc-gifts', { method: 'POST', body: JSON.stringify({ code: code.trim(), recipientName: recipientName.trim(), note: note.trim(), value: value === '' ? null : value }) });
      setLastCreated(gift);
      setCode(''); setRecipientName(''); setNote(''); setValue('');
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: e.message === 'CODE_TAKEN' ? t('Bu NFC ID allaqachon band.') : e.message === 'ALREADY_RESERVED' ? t('Bu ID uchun sovg\u2019a allaqachon yaratilgan.') : e.message === 'bad_code' ? t("NFC ID formati noto'g'ri.") : apiErrText(e, t) });
    } finally {
      setBusy(false);
    }
  };

  const STATUS_LABEL = { reserved: { text: 'GIFT / RESERVED', cls: 'badge-warning' }, activated: { text: 'ACTIVATED', cls: 'badge-success' } };

  return (
    <div>
      {isManager ? (
      <div className="vz-card max-w-lg p-5">
        <span className="vz-kicker">{t('Yangi "Gift NFC ID" yaratish')}</span>
        <p className="mt-1 text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t("Bo'sh (hech kimga tegishli bo'lmagan) NFC ID'ni tanlang — kod hech qanday profilga ulanmaydi, faqat konvert uchun aktivatsiya kodi generatsiya qilinadi.")}</p>
        <div className="mt-3 space-y-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("NFC ID (masalan DDD333)")} className="vz-input font-mono uppercase" aria-label={t("NFC ID (masalan DDD333)")} />
          <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder={t("Recipient (ixtiyoriy — kimga mo'ljallangani)")} className="vz-input" aria-label={t("Recipient (ixtiyoriy — kimga mo'ljallangani)")} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Izoh (ixtiyoriy)")} className="vz-input" aria-label={t("Izoh (ixtiyoriy)")} />
          <input value={value} onChange={(e) => setValue(e.target.value)} type="number" min="0" placeholder={t("Sovg'a qiymati, so'm (ixtiyoriy \u2014 'sovg'a' so'zi o'rniga)")} className="vz-input" aria-label={t("Sovg'a qiymati, so'm (ixtiyoriy \u2014 'sovg'a' so'zi o'rniga)")} />
          <button className="btn btn-gold w-full" disabled={busy} onClick={create}>
            {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Sovg\u2019a yaratish')}
          </button>
        </div>
        {msg && <div role="alert" className={`alert mt-3 py-2 text-xs ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}

        {lastCreated && (
          <div className="vz-panel mt-4 break-words p-4">
            <div className="text-xs font-bold" style={{ color: 'var(--vz-ink-2)' }}>{t("Konvert uchun ma'lumot:")}</div>
            <div className="mt-2 font-mono text-lg font-bold">NFC ID: #{lastCreated.code}</div>
            <div className="mt-1 font-mono text-lg font-bold" style={{ color: 'var(--vz-gold-2)' }}>Activation Code: {lastCreated.activationCode}</div>
          </div>
        )}
      </div>
      ) : (
        <ForbiddenState hint={t("Sovg'a yaratish faqat Manager va Super Admin uchun.")} />
      )}

      {loadErr ? <div className="mt-6"><LoadError err={loadErr} onRetry={load} title={t("Sovg'alarni yuklab bo'lmadi.")} /></div>
        : !gifts ? <div className="mt-6"><AdminLoading /></div>
        : gifts.length === 0 ? <div className="mt-6"><EmptyState icon="gift" title={t("Hozircha sovg'a yaratilmagan.")} /></div>
        : (
      <div className="vz-card mt-6 overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>NFC ID</th><th>Recipient</th><th>{t("Qiymati")}</th><th>Activation Code</th><th>Status</th><th>{t('Yaratilgan')}</th><th>{t('Aktivlashtirilgan')}</th></tr></thead>
          <tbody>
            {gifts.map((g) => {
              const st = STATUS_LABEL[g.status] || { text: g.status, cls: 'badge-ghost' };
              return (
                <tr key={g.id}>
                  <td className="font-mono font-bold">{g.code}</td>
                  <td className="text-xs">{g.recipientName || '—'}</td>
                  <td className="text-xs">{g.value != null ? `${fmt(g.value)} so'm` : '—'}</td>
                  <td className="font-mono text-xs">{g.activationCode}</td>
                  <td><span className={`badge badge-sm ${st.cls}`}>{st.text}</span></td>
                  <td className="whitespace-nowrap text-xs text-base-content/50">{timeAgo(new Date(g.createdAt).getTime())}</td>
                  <td className="text-xs text-base-content/50">
                    {g.activatedAt ? `${timeAgo(new Date(g.activatedAt).getTime())} — ${g.activatedByEmail || ''}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        )}
    </div>
  );
}

// Promokodlar — har bir promokod bilan qo'shilgan odamlar ro'yxati va hisobi.
function PromoCodesTab() {
  const { t } = useLanguage();
  const [rows, setRows] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [shown, setShown] = useState(50);

  const load = () => { setLoadErr(null); setRows(null); adminApi('/referrals').then((d) => setRows(d.referrals || [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t("Promokodlarni yuklab bo'lmadi.")} />;
  if (!rows) return <AdminLoading />;
  if (rows.length === 0) return <EmptyState icon="tag" title={t('Hozircha promokod orqali hech kim qo‘shilmagan.')} />;

  // Har bir promokod egasi bo'yicha nechta odam qo'shilganini hisoblaymiz.
  const byReferrer = {};
  for (const r of rows) {
    const key = r.referrerEmail;
    if (!byReferrer[key]) byReferrer[key] = { name: r.referrerName, email: r.referrerEmail, promo: r.referrerPromo, n: 0 };
    byReferrer[key].n += 1;
  }
  const summary = Object.values(byReferrer).sort((a, b) => b.n - a.n);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-sm font-bold">{t('Promokod egalari bo‘yicha')}</div>
        <div className="vz-card overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>{t('Kimning promosi')}</th><th>{t('Promokod')}</th><th>{t('Qo‘shilganlar soni')}</th></tr></thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.email}>
                  <td>{s.name || s.email}<div className="text-[14px] text-base-content/40">{s.email}</div></td>
                  <td className="font-mono text-xs">{s.promo || '—'}</td>
                  <td className="font-bold">{s.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-bold">{t('To‘liq tarix')} ({rows.length})</div>
        <div className="vz-card overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>{t('Davr')}</th><th>{t('Kimning promosidan')}</th><th>{t('Promokod')}</th><th>{t('Kim kirgan')}</th></tr></thead>
            <tbody>
              {rows.slice(0, shown).map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs text-base-content/60">{dateTime(new Date(r.createdAt).getTime())}</td>
                  <td>{r.referrerName || r.referrerEmail}<div className="text-[14px] text-base-content/40">{r.referrerEmail}</div></td>
                  <td className="font-mono text-xs">{r.referrerPromo || '—'}</td>
                  <td>{r.referredName || r.referredEmail}<div className="text-[14px] text-base-content/40">{r.referredEmail}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
          <LoadMore shown={Math.min(shown, rows.length)} total={rows.length} onMore={setShown} />
        </div>
      </div>
    </div>
  );
}

// Yangiliklar — faqat admin joylaydi/tahrirlaydi/o'chiradi. 3 tilda
// (o'zbekcha majburiy; ru/en bo'sh bo'lsa saytda o'zbekchaga qaytadi).
const NEWS_LANGS = [['uz', 'UZ'], ['ru', 'RU'], ['en', 'EN']];
const NEWS_EMPTY = { title: '', body: '', titleRu: '', bodyRu: '', titleEn: '', bodyEn: '' };

function NewsTab() {
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirm();
  const [rows, setRows] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [form, setForm] = useState(NEWS_EMPTY);
  const [imageUrl, setImageUrl] = useState('');
  const [langTab, setLangTab] = useState('uz');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);
  const [editId, setEditId] = useState(null);

  const load = () => { setLoadErr(null); return adminApi('/news').then((d) => setRows(d.news || [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const reset = () => { setEditId(null); setForm(NEWS_EMPTY); setImageUrl(''); setLangTab('uz'); setErr(null); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const key = (base) => (langTab === 'uz' ? base : base + (langTab === 'ru' ? 'Ru' : 'En'));

  const save = async () => {
    if (!form.title.trim()) { setErr(t('Sarlavhani kiriting.')); return; }
    setBusy(true); setErr(null);
    const payload = { ...form, imageUrl };
    try {
      if (editId) await adminApi(`/news/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await adminApi('/news', { method: 'POST', body: JSON.stringify(payload) });
      reset();
      await load();
    } catch (e) {
      setErr(e.message === 'title_required' ? t('Sarlavhani kiriting.') : apiErrText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (n) => {
    setEditId(n.id);
    setForm({ title: n.title || '', body: n.body || '', titleRu: n.titleRu || '', bodyRu: n.bodyRu || '', titleEn: n.titleEn || '', bodyEn: n.bodyEn || '' });
    setImageUrl(n.imageUrl || '');
    setLangTab('uz');
    setErr(null);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setErr(t('Rasm hajmi juda katta (maks. 10 MB).')); return; }
    setUploading(true); setErr(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const d = await adminApi('/upload', { method: 'POST', body: JSON.stringify({ dataUrl: reader.result }) });
        setImageUrl(d.url);
      } catch {
        setErr(t('Rasmni yuklab bo‘lmadi.'));
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => { setUploading(false); setErr(t('Rasmni yuklab bo‘lmadi.')); };
    reader.readAsDataURL(file);
  };

  const togglePublish = async (n) => {
    setBusy(true); setErr(null);
    try { await adminApi(`/news/${n.id}`, { method: 'PUT', body: JSON.stringify({ published: !n.published }) }); await load(); }
    catch (e) { setErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  const remove = async (n) => {
    if (!(await confirm({ title: t("Yangilikni o'chirish"), message: t('Bu yangilikni o‘chirasizmi?') + ` «${n.title}»`, confirmLabel: t("O'chirish"), danger: true }))) return;
    setBusy(true); setErr(null);
    try { await adminApi(`/news/${n.id}`, { method: 'DELETE' }); await load(); }
    catch (e) { setErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {dialog}
      <div className="vz-card p-5">
        <span className="vz-kicker">{editId ? t('Yangilikni tahrirlash') : t('Yangi yangilik')}</span>

        <div className="mt-3 flex gap-1">
          {NEWS_LANGS.map(([code, label]) => (
            <button key={code} type="button" onClick={() => setLangTab(code)}
              className={`btn btn-sm min-h-11 ${langTab === code ? 'btn-gold' : 'btn-ghost-vz'}`}>
              {label}
            </button>
          ))}
        </div>

        <input value={form[key('title')]} onChange={set(key('title'))}
          placeholder={langTab === 'uz' ? t('Sarlavha') : t('Sarlavha (tarjima)')}
          className="vz-input mt-2" aria-label={t('Sarlavha')} />
        <textarea value={form[key('body')]} onChange={set(key('body'))}
          placeholder={langTab === 'uz' ? t('Matn') : t('Matn (tarjima)')} rows={4}
          className="vz-input mt-2" aria-label={t('Matn')} />
        {langTab !== 'uz' && (
          <div className="mt-1 text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t("Bo'sh qoldirsangiz, bu tilda o'zbekcha matn ko'rsatiladi.")}</div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={t('Rasm havolasi (ixtiyoriy) — https://...')}
            className="vz-input min-w-0 flex-1 font-mono text-xs" aria-label={t('Rasm havolasi (ixtiyoriy) — https://...')} />
          <label className="btn btn-ghost-vz btn-sm min-h-11">
            {uploading ? <span className="loading loading-spinner loading-xs"></span> : t('Fayldan yuklash')}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
          {imageUrl && <button className="btn btn-ghost btn-xs min-h-9" onClick={() => setImageUrl('')}>{t("O'chirish")}</button>}
        </div>
        {imageUrl && <img src={imageUrl} alt="" className="mt-2 max-h-40 rounded-lg border object-cover" style={{ borderColor: 'var(--vz-line)' }} />}

        {err && <div role="alert" className="vz-err mt-2">{err}</div>}
        <div className="mt-3 flex gap-2">
          <button className="btn btn-gold btn-sm min-h-11" onClick={save} disabled={busy || uploading}>
            {busy ? <span className="loading loading-spinner loading-xs"></span> : (editId ? t('Saqlash') : t('Joylash'))}
          </button>
          {editId && <button className="btn btn-ghost-vz btn-sm min-h-11" onClick={reset}>{t('Bekor')}</button>}
        </div>
      </div>

      {loadErr && <LoadError err={loadErr} onRetry={load} title={t("Yangiliklarni yuklab bo'lmadi.")} />}
      {!loadErr && !rows && <AdminLoading />}
      {rows && rows.length === 0 && <EmptyState icon="news" title={t('Hozircha yangiliklar yo‘q.')} />}
      <div className="space-y-3">
        {(rows || []).map((n) => (
          <div key={n.id} className="vz-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-bold">{n.title}</span>
                  {!n.published && <span className="vz-badge vz-badge--muted">{t('Yashirin')}</span>}
                  {n.titleRu && <span className="vz-badge vz-badge--muted">RU</span>}
                  {n.titleEn && <span className="vz-badge vz-badge--muted">EN</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>
                  <span>{dateTime(new Date(n.createdAt).getTime())}</span>
                  <span className="inline-flex items-center gap-1"><AdminIcon name="eye" className="h-3.5 w-3.5" /> {fmt(n.views || 0)}</span>
                  <span className="inline-flex items-center gap-1"><AdminIcon name="heart" className="h-3.5 w-3.5" /> {fmt(n.likeCount || 0)}</span>
                  <a href={`/yangiliklar/${n.id}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: 'var(--vz-gold)' }}>{t('Saytda ochish')}</a>
                </div>
                {n.body && <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-sm" style={{ color: 'var(--vz-ink-2)' }}>{n.body}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-1 sm:flex-col">
                <button className="btn btn-ghost btn-xs min-h-9" onClick={() => startEdit(n)}>{t('Tahrirlash')}</button>
                <button className="btn btn-ghost btn-xs min-h-9" onClick={() => togglePublish(n)} disabled={busy}>
                  {n.published ? t('Yashirish') : t('Chiqarish')}
                </button>
                <button className="btn btn-error btn-xs min-h-9" onClick={() => remove(n)} disabled={busy}>{t("O'chirish")}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Kategoriyalar — profil "Faoliyat sohasi" taksonomiyasi. Admin 3 tilda
// qo'shadi/tahrirlaydi/o'chiradi, tartibini (sort) va ko'rinishini boshqaradi.
// slug — texnik kalit, yaratilgandan keyin o'zgarmaydi.
const CAT_EMPTY = { slug: '', nameUz: '', nameRu: '', nameEn: '', parentSlug: '', sort: 0 };

function CategoriesTab() {
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirm();
  const [rows, setRows] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [form, setForm] = useState(CAT_EMPTY);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const load = () => { setLoadErr(null); return adminApi('/categories').then((d) => setRows(d.categories || [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const reset = () => { setEditId(null); setForm(CAT_EMPTY); setErr(null); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mains = (rows || []).filter((c) => !c.parentSlug);

  const save = async () => {
    setErr(null);
    if (!editId && !form.slug.trim().replace(/[^a-z0-9-]/gi, '')) { setErr(t('Slug kiriting (lotincha, masalan: it-dasturlash).')); return; }
    if (!form.nameUz.trim()) { setErr(t('O‘zbekcha nomni kiriting.')); return; }
    setBusy(true);
    const payload = { nameUz: form.nameUz, nameRu: form.nameRu, nameEn: form.nameEn, parentSlug: form.parentSlug || '', sort: Number(form.sort) || 0 };
    try {
      if (editId) await adminApi(`/categories/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await adminApi('/categories', { method: 'POST', body: JSON.stringify({ ...payload, slug: form.slug }) });
      reset();
      await load();
    } catch (e) {
      const m = { slug_exists: t('Bu slug band.'), slug_required: t('Slug kiriting (lotincha, masalan: it-dasturlash).'), name_required: t('O‘zbekcha nomni kiriting.') };
      setErr(m[e.message] || apiErrText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (c) => {
    setEditId(c.id);
    setForm({ slug: c.slug, nameUz: c.nameUz || '', nameRu: c.nameRu || '', nameEn: c.nameEn || '', parentSlug: c.parentSlug || '', sort: c.sort || 0 });
    setErr(null);
  };

  const toggle = async (c) => {
    setBusy(true); setErr(null);
    try { await adminApi(`/categories/${c.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !c.enabled }) }); await load(); }
    catch (e) { setErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  const bump = async (c, delta) => {
    setBusy(true); setErr(null);
    try { await adminApi(`/categories/${c.id}`, { method: 'PUT', body: JSON.stringify({ sort: Math.max(0, (c.sort || 0) + delta) }) }); await load(); }
    catch (e) { setErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  // 409 category_in_use — kategoriya hali profillarga biriktirilgan.
  const catDelErr = (e) => (e.message === 'category_in_use'
    ? t("Bu kategoriya {n} ta profilda ishlatilmoqda — avval ularni boshqa kategoriyaga o'tkazing.", { n: e.data?.count ?? '?' })
    : apiErrText(e, t));

  const remove = async (c) => {
    const kids = (rows || []).filter((x) => x.parentSlug === c.slug);
    const msg = kids.length
      ? t('Bu sohada {n} ta kichik soha bor. Ular ham o‘chadimi?', { n: kids.length })
      : t('Bu kategoriyani o‘chirasizmi?');
    if (!(await confirm({ title: t("Kategoriyani o'chirish"), message: `${msg} (${c.nameUz})`, confirmLabel: t("O'chirish"), danger: true }))) return;
    setBusy(true); setErr(null);
    try {
      for (const k of kids) await adminApi(`/categories/${k.id}`, { method: 'DELETE' });
      await adminApi(`/categories/${c.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setErr(catDelErr(e));
      await load();
    } finally { setBusy(false); }
  };

  const Row = ({ c, child }) => (
    <div className={`vz-card flex flex-wrap items-center gap-2 px-3 py-2 ${child ? 'ml-4 sm:ml-6' : ''} ${c.enabled ? '' : 'opacity-50'}`}>
      <div className="flex flex-col">
        <button className="btn btn-ghost btn-xs min-h-6 px-1" onClick={() => bump(c, -1)} disabled={busy} aria-label={t('Yuqoriga')}>▲</button>
        <button className="btn btn-ghost btn-xs min-h-6 px-1" onClick={() => bump(c, 1)} disabled={busy} aria-label={t('Pastga')}>▼</button>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="break-words font-semibold">{c.nameUz}</span>
          <span className="font-mono text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{c.slug}</span>
          {c.nameRu && <span className="vz-badge vz-badge--muted">RU</span>}
          {c.nameEn && <span className="vz-badge vz-badge--muted">EN</span>}
          {!c.enabled && <span className="vz-badge vz-badge--muted">{t('Yashirin')}</span>}
          <span className="text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>#{c.sort}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <button className="btn btn-ghost btn-xs min-h-9" onClick={() => startEdit(c)}>{t('Tahrirlash')}</button>
        <button className="btn btn-ghost btn-xs min-h-9" onClick={() => toggle(c)} disabled={busy}>{c.enabled ? t('Yashirish') : t('Chiqarish')}</button>
        <button className="btn btn-error btn-xs min-h-9" onClick={() => remove(c)} disabled={busy}>{t("O'chirish")}</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {dialog}
      <div className="vz-card p-5">
        <span className="vz-kicker">{editId ? t('Kategoriyani tahrirlash') : t('Yangi kategoriya')}</span>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={form.slug} onChange={set('slug')} disabled={!!editId}
            placeholder={t('slug (lotincha): it-dasturlash')}
            className="vz-input min-w-0 font-mono text-xs disabled:opacity-60" aria-label={t('slug (lotincha): it-dasturlash')} />
          <select value={form.parentSlug} onChange={set('parentSlug')} className="vz-input min-w-0" aria-label={t('— asosiy soha —')}>
            <option value="">{t('— asosiy soha —')}</option>
            {mains.filter((m) => m.slug !== form.slug).map((m) => (
              <option key={m.slug} value={m.slug}>{m.nameUz}</option>
            ))}
          </select>
          <input value={form.nameUz} onChange={set('nameUz')} placeholder={t('Nomi (UZ)')} className="vz-input min-w-0" aria-label={t('Nomi (UZ)')} />
          <input value={form.sort} onChange={set('sort')} type="number" placeholder={t('Tartib')} className="vz-input min-w-0" aria-label={t('Tartib')} />
          <input value={form.nameRu} onChange={set('nameRu')} placeholder={t('Nomi (RU)')} className="vz-input min-w-0" aria-label={t('Nomi (RU)')} />
          <input value={form.nameEn} onChange={set('nameEn')} placeholder={t('Nomi (EN)')} className="vz-input min-w-0" aria-label={t('Nomi (EN)')} />
        </div>
        {err && <div role="alert" className="vz-err mt-2">{err}</div>}
        <div className="mt-3 flex gap-2">
          <button className="btn btn-gold btn-sm min-h-11" onClick={save} disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs"></span> : (editId ? t('Saqlash') : t('Qo‘shish'))}
          </button>
          {editId && <button className="btn btn-ghost-vz btn-sm min-h-11" onClick={reset}>{t('Bekor')}</button>}
        </div>
      </div>

      {loadErr && <LoadError err={loadErr} onRetry={load} title={t("Kategoriyalarni yuklab bo'lmadi.")} />}
      {!loadErr && !rows && <AdminLoading />}
      {rows && rows.length === 0 && <EmptyState icon="folder" title={t('Hozircha kategoriya yo‘q.')} />}
      <div className="space-y-2">
        {mains.map((m) => (
          <div key={m.slug} className="space-y-1.5">
            <Row c={m} />
            {(rows || []).filter((c) => c.parentSlug === m.slug).map((c) => (
              <Row key={c.slug} c={c} child />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Profil tasdiqlash (PHASE 5) — admin kod bo'yicha profilga "✔" belgisini
// beradi/oladi (haqiqiy shaxs / rasmiy biznes).
function VerificationTab() {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [found, setFound] = useState(null);
  const [rows, setRows] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => { setLoadErr(null); return adminApi('/verified-cards').then((d) => setRows(d.cards || [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { load(); }, []);

  const lookup = async () => {
    setErr(''); setFound(null);
    const c = code.trim().toUpperCase();
    if (!c) return;
    try { setFound(await adminApi(`/records/${encodeURIComponent(c)}`)); }
    catch (e) { setErr(e.status === 404 ? t('Bunday profil topilmadi.') : apiErrText(e, t)); }
  };
  const toggle = async (c, verified) => {
    setBusy(true); setErr('');
    try {
      await adminApi(`/records/${encodeURIComponent(c)}/verify`, { method: 'POST', body: JSON.stringify({ verified }) });
      if (found && found.code === c) setFound({ ...found, verified });
      await load();
    } catch (e) { setErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };
  const [viewsInput, setViewsInput] = useState('');
  const saveViews = async () => {
    if (!found) return;
    const v = Number(viewsInput);
    if (!Number.isFinite(v) || v < 0) return;
    setBusy(true);
    try {
      const row = await adminApi(`/records/${encodeURIComponent(found.code)}/views`, { method: 'POST', body: JSON.stringify({ views: v }) });
      setFound({ ...found, views: row.views });
      setViewsInput('');
    } catch (e) { setErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="vz-card p-5">
        <span className="vz-kicker">{t('Profilni tasdiqlash')}</span>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('Profil kodi (masalan BMW007)')}
            className="vz-input min-w-0 flex-1 font-mono" aria-label={t('Profil kodi (masalan BMW007)')} onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }} />
          <button className="btn btn-outline-gold min-h-11" onClick={lookup}>{t('Qidirish')}</button>
        </div>
        {err && <div role="alert" className="vz-err mt-2">{err}</div>}
        {found && (
          <div className="vz-panel mt-3 space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 break-words">
                <div className="font-semibold">{found.name} <span className="font-mono text-xs" style={{ color: 'var(--vz-ink-3)' }}>{found.code}</span></div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs" style={{ color: 'var(--vz-ink-2)' }}>
                  <span>{found.role || '—'}</span> · {found.verified ? <span className="vz-badge vz-badge--ok">{t('Tasdiqlangan')}</span> : <span className="vz-badge vz-badge--muted">{t('Tasdiqlanmagan')}</span>} · <span className="inline-flex items-center gap-1"><AdminIcon name="eye" className="h-3.5 w-3.5" /> {fmt(found.views ?? 0)}</span>
                </div>
              </div>
              <button className={`btn btn-sm min-h-11 ${found.verified ? 'btn-ghost-vz' : 'btn-gold'}`}
                disabled={busy} onClick={() => toggle(found.code, !found.verified)}>
                {found.verified ? t('Tasdiqni olib tashlash') : t('Tasdiqlash')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-2" style={{ borderColor: 'var(--vz-line)' }}>
              <span className="text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t('Ko‘rishlar sonini o‘zgartirish')}:</span>
              <input type="number" min="0" value={viewsInput} onChange={(e) => setViewsInput(e.target.value)}
                placeholder={String(found.views ?? 0)} className="vz-input w-28 py-1" aria-label={t('Ko‘rishlar sonini o‘zgartirish')} />
              <button className="btn btn-ghost-vz btn-sm min-h-11" disabled={busy || viewsInput === ''} onClick={saveViews}>{t('Saqlash')}</button>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-bold">{t('Tasdiqlangan profillar')} {rows ? `(${rows.length})` : ''}</div>
        {loadErr && <div className="mt-2"><LoadError err={loadErr} onRetry={load} title={t("Tasdiqlangan profillarni yuklab bo'lmadi.")} /></div>}
        {!loadErr && !rows && <div className="mt-2"><AdminLoading /></div>}
        {rows && rows.length === 0 && <div className="mt-2"><EmptyState icon="check" title={t('Hozircha tasdiqlangan profil yo‘q.')} /></div>}
        <div className="mt-2 space-y-2">
          {(rows || []).map((r) => (
            <div key={r.code} className="vz-card flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0 break-words text-sm">{r.name} <span className="font-mono text-xs" style={{ color: 'var(--vz-ink-3)' }}>{r.code}</span></div>
              <button className="btn btn-ghost btn-xs min-h-9" disabled={busy} onClick={() => toggle(r.code, false)}>{t('Tasdiqni olib tashlash')}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MOLIYA / BUXGALTERIYA — faqat Super Admin. Mavjud to'lov mantig'iga
// tegmaydi: web_orders/bot_orders'dan O'QIYDI, finance_* jadvallarni
// boshqaradi.
// ═══════════════════════════════════════════════════════════════════
const FIN_RANGES = [['today', 'Bugun'], ['7d', '7 kun'], ['30d', '30 kun'], ['month', 'Shu oy'], ['prev_month', "O'tgan oy"], ['custom', 'Custom']];
const FIN_SUBTABS = [['dashboard', 'Dashboard'], ['transactions', 'Tranzaksiyalar'], ['reconcile', 'Solishtirish'], ['rates', 'Tarif va soliqlar'], ['reports', 'Hisobotlar'], ['docs', 'Hujjatlar']];
const FIN_TYPE_LABEL = { card_purchase: 'NFC ID xaridi', auction_payment: 'Auksion', premium_upgrade: 'Premium', premium_follow: 'Obuna', physical_card_order: 'Jismoniy karta' };
const FIN_DOC_LABEL = { payme_report: 'Payme hisobot', bank_statement: 'Bank ko‘chirmasi', tax: 'Soliq hujjati', invoice: 'Hisob-faktura', receipt: 'Chek', other: 'Boshqa' };
const FIN_RECON_TONE = { matched: 'success', difference: 'danger', pending: 'muted' };
const FIN_RECON_LABEL = { matched: 'Mos', difference: 'Farq bor', pending: 'Kutilmoqda' };

const money = (n) => (n == null ? '—' : `${fmt(Math.round(Number(n)))} ${'so’m'}`);

function FinanceTab() {
  const { t } = useLanguage();
  const [sub, setSub] = useState('dashboard');
  const [range, setRange] = useState('month');
  const [cf, setCf] = useState('');
  const [ct, setCt] = useState('');
  const rangeQs = range === 'custom' ? `range=custom&from=${cf}&to=${ct}` : `range=${range}`;
  const rangeReady = range !== 'custom' || (!!cf && !!ct);
  const showDate = ['dashboard', 'transactions', 'reports'].includes(sub);

  return (
    <div className="space-y-5">
      <div className="admin-scroll flex gap-1.5 overflow-x-auto pb-1">
        {FIN_SUBTABS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSub(k)} className={`btn btn-sm min-h-11 shrink-0 ${sub === k ? 'btn-gold' : 'btn-ghost-vz'}`}>{t(l)}</button>
        ))}
      </div>

      {showDate && (
        <div className="flex flex-wrap items-center gap-1.5">
          {FIN_RANGES.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setRange(k)} className={`btn btn-xs min-h-9 ${range === k ? 'btn-gold' : 'btn-ghost-vz'}`}>{t(l)}</button>
          ))}
          {range === 'custom' && (
            <>
              <input type="date" value={cf} onChange={(e) => setCf(e.target.value)} className="vz-input w-auto py-1" aria-label={t('Boshlanish sanasi')} />
              <span style={{ color: 'var(--vz-ink-3)' }}>—</span>
              <input type="date" value={ct} onChange={(e) => setCt(e.target.value)} className="vz-input w-auto py-1" aria-label={t('Tugash sanasi')} />
            </>
          )}
        </div>
      )}

      {sub === 'dashboard' && <FinanceDashboard rangeQs={rangeQs} ready={rangeReady} onGoRates={() => setSub('rates')} />}
      {sub === 'transactions' && <FinanceTransactions rangeQs={rangeQs} ready={rangeReady} />}
      {sub === 'reconcile' && <FinanceReconcile />}
      {sub === 'rates' && <FinanceRates />}
      {sub === 'reports' && <FinanceReports range={range} rangeQs={rangeQs} ready={rangeReady} />}
      {sub === 'docs' && <FinanceDocs />}
    </div>
  );
}

function FinanceDashboard({ rangeQs, ready, onGoRates }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  const load = () => {
    if (!ready) return;
    setData(null); setErr(null);
    adminApi(`/finance/overview?${rangeQs}`).then(setData).catch((e) => setErr(e));
  };
  useEffect(() => { load(); }, [rangeQs, ready]);

  if (!ready) return <EmptyState icon="bank" title={t('Sanani tanlang')} hint={t('Custom oraliq uchun boshlanish va tugash sanasini kiriting.')} />;
  if (err) return <LoadError err={err} onRetry={load} title={t("Moliya ko'rsatkichlarini yuklab bo'lmadi.")} />;
  if (!data) return <AdminLoading rows={6} />;
  const o = data.overview || {};
  const daily = (data.daily || []).map((d) => ({ ...d, kun: d.day.slice(5) }));

  return (
    <div className="space-y-4">
      {!o.ratesConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border px-4 py-3 text-sm" style={{ borderColor: 'rgba(245,158,11,.35)', background: 'rgba(245,158,11,.10)', color: '#fbbf24' }}>
          <span className="flex min-w-0 items-center gap-2"><AdminIcon name="alert" className="h-4 w-4 shrink-0" /> {t('Payme / bank / soliq foizlari hali kiritilmagan — hisob-kitob to‘liq bo‘lmaydi.')}</span>
          <button className="btn btn-warning btn-xs min-h-9" onClick={onGoRates}>{t('Tarif va soliqlarni to‘ldirish')}</button>
        </div>
      )}

      <div className="vz-card p-5">
        <span className="vz-kicker">{t('Jami savdo (gross)')}</span>
        <div className="mt-1 break-words font-display text-[30px] font-semibold tracking-tight" style={{ color: 'var(--vz-gold-2)' }}>{money(o.grossSales)}</div>
        <div className="mt-1 text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{o.orderCount} {t('ta to‘langan buyurtma')} · {o.fromIso?.slice(0, 10)} … {o.toIso?.slice(0, 10)}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard icon="wallet" tone="pending" label={t('Payme komissiyasi')} value={money(o.paymeFee)} sub={o.paymeMode === 'separate' ? t('Alohida hisoblanadi') : t('Settlementdan ushlanadi')} />
        <KpiCard icon="bank" tone="info" label={t('Payme’dan kutilgan tushum')} value={money(o.expectedBankSettlement)} />
        <KpiCard icon="bank" tone={o.actualBankSettlement == null ? 'muted' : 'success'} label={t('Bankka real tushgan')} value={o.actualBankSettlement == null ? t('kiritilmagan') : money(o.actualBankSettlement)} sub={o.reconciliationDifference == null ? null : `${t('Farq')}: ${money(o.reconciliationDifference)}`} />
        <KpiCard icon="chart" tone="accent" label={t('Soliq bazasi')} value={money(o.taxBase)} />
        <KpiCard icon="chart" tone="pending" label={`${t('Aylanma solig‘i')} (${o.turnoverPct || 0}%)`} value={money(o.turnoverTax)} />
        <KpiCard icon="chart" tone="pending" label={t('Ijtimoiy soliq')} value={money(o.socialTax)} />
        <KpiCard icon="bank" tone="muted" label={t('Bank xizmat haqi')} value={money(o.bankFees)} />
        <KpiCard icon="tag" tone="muted" label={t('Boshqa xarajatlar')} value={money(o.manualExpenses)} />
        <KpiCard icon="activity" tone={o.netCashFlow >= 0 ? 'success' : 'danger'} label={t('Sof pul oqimi')} value={money(o.netCashFlow)} />
      </div>

      {daily.length > 0 && (
        <AdminCard title={t('Kunlik: gross va kutilgan tushum')}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="kun" {...chartAxis} />
                <YAxis {...chartAxis} width={70} tickFormatter={(v) => fmt(v)} />
                <Tooltip {...chartTooltip} formatter={(v) => fmt(v) + " so'm"} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="gross" name={t('Gross')} stroke="#d8a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expected" name={t('Kutilgan')} stroke="#5b9bd5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>
      )}

      {o.byType && o.byType.length > 0 && (
        <AdminCard title={t('To‘lov turi bo‘yicha')}>
          <div className="space-y-2">
            {o.byType.map((r) => (
              <div key={r.kind} className="flex items-center justify-between border-b pb-1.5 text-sm last:border-0" style={{ borderColor: 'var(--vz-line)' }}>
                <span style={{ color: 'var(--vz-ink-2)' }}>{t(FIN_TYPE_LABEL[r.kind] || r.kind)}</span>
                <span className="font-semibold">{money(r.total)}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}
    </div>
  );
}

function FinanceTransactions({ rangeQs, ready }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [err, setErr] = useState(null);

  useEffect(() => { setPage(1); }, [rangeQs, type, status, q]);
  const load = () => {
    if (!ready) return;
    setData(null); setErr(null);
    const qs = `${rangeQs}&type=${type}&status=${status}&q=${encodeURIComponent(q)}&page=${page}`;
    adminApi(`/finance/transactions?${qs}`).then(setData).catch((e) => setErr(e));
  };
  useEffect(() => { load(); }, [rangeQs, ready, type, status, q, page]);

  if (!ready) return <EmptyState icon="bank" title={t('Sanani tanlang')} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="vz-input w-auto min-w-0" aria-label={t('Barcha turlar')}>
          <option value="">{t('Barcha turlar')}</option>
          {Object.entries(FIN_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="vz-input w-auto min-w-0" aria-label={t('Barcha holatlar')}>
          <option value="">{t('Barcha holatlar')}</option>
          <option value="paid">{t('To‘langan')}</option>
          <option value="cancelled">{t('Bekor qilingan')}</option>
          <option value="failed_code_taken">{t('Kod band bo‘lib qolgan')}</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Kod / email / Payme txn')} className="vz-input min-w-0 flex-1" aria-label={t('Kod / email / Payme txn')} />
      </div>

      {err ? <LoadError err={err} onRetry={load} title={t("Tranzaksiyalarni yuklab bo'lmadi.")} />
        : !data ? <AdminLoading rows={8} />
        : (data.items || []).length === 0 ? <EmptyState icon="bank" title={t('Bu shartlarga mos tranzaksiya yo‘q.')} />
        : (
          <>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead><tr><th>{t('Sana')}</th><th>{t('Manba')}</th><th>{t('Tur')}</th><th>{t('Kod')}</th><th>{t('Summa')}</th><th>{t('Holat')}</th><th>Payme txn</th><th>{t('Foydalanuvchi')}</th></tr></thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={`${r.source}-${r.id}`}>
                      <td className="whitespace-nowrap text-xs text-base-content/60">{dateTime(new Date(r.createdAt).getTime())}</td>
                      <td className="text-xs uppercase text-base-content/45">{r.source}</td>
                      <td className="text-xs">{t(FIN_TYPE_LABEL[r.kind] || r.kind)}</td>
                      <td className="font-mono text-xs">{r.code}</td>
                      <td className="font-semibold">{money(r.amount)}</td>
                      <td><StatusBadge tone={r.status === 'paid' ? 'success' : r.status === 'cancelled' ? 'muted' : 'danger'}>{r.status}</StatusBadge></td>
                      <td className="max-w-[160px] truncate font-mono text-[14px] text-base-content/45">{r.paymeTxnId || '—'}</td>
                      <td className="max-w-[180px] truncate text-xs text-base-content/60">{r.userEmail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'var(--vz-ink-2)' }}>
              <span>{t('Jami')}: {data.total}</span>
              <div className="flex items-center gap-1">
                <button className="btn btn-ghost-vz btn-xs min-h-9 min-w-9" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t('Oldingi sahifa')}>←</button>
                <span className="px-2 py-1">{page}</span>
                <button className="btn btn-ghost-vz btn-xs min-h-9 min-w-9" disabled={data.items.length < (data.limit || 50)} onClick={() => setPage((p) => p + 1)} aria-label={t('Keyingi sahifa')}>→</button>
              </div>
            </div>
          </>
        )}
    </div>
  );
}

function FinanceReconcile() {
  const { t } = useLanguage();
  const nowY = new Date().getFullYear();
  const [year, setYear] = useState(nowY);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [actErr, setActErr] = useState(null);
  const [editId, setEditId] = useState(null);
  const [val, setVal] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => { setRows(null); setErr(null); adminApi(`/finance/reconciliation?year=${year}`).then((d) => setRows(d.months || [])).catch((e) => setErr(e)); };
  useEffect(load, [year]);

  const save = async (period) => {
    setBusy(true); setActErr(null);
    try {
      await adminApi('/finance/bank-actual', { method: 'POST', body: JSON.stringify({ period, actualAmount: Number(val) || 0, note }) });
      setEditId(null); setVal(''); setNote('');
      load();
    } catch (e) { setActErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost-vz btn-xs min-h-9 min-w-9" onClick={() => setYear((y) => y - 1)} aria-label={t('Oldingi yil')}>←</button>
        <span className="text-sm font-bold">{year}</span>
        <button className="btn btn-ghost-vz btn-xs min-h-9 min-w-9" disabled={year >= nowY} onClick={() => setYear((y) => y + 1)} aria-label={t('Keyingi yil')}>→</button>
      </div>
      <p className="text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t('“Expected” — sotuvdan Payme komissiyasi ayirilgan hisob. “Actual” — Trastbank hisob varag‘iga real tushgan pul (siz kiritasiz).')}</p>
      {actErr && <div role="alert" className="vz-err">{actErr}</div>}

      {err ? <LoadError err={err} onRetry={load} title={t("Solishtirish jadvalini yuklab bo'lmadi.")} />
        : !rows ? <AdminLoading />
        : rows.length === 0 ? <EmptyState icon="bank" title={t("Bu yil uchun ma'lumot yo'q.")} />
        : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>{t('Oy')}</th><th>{t('Gross')}</th><th>Payme fee</th><th>Expected</th><th>Actual</th><th>{t('Farq')}</th><th>{t('Holat')}</th><th></th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.period}>
                  <td className="font-mono text-xs">{m.period}</td>
                  <td className="text-xs">{money(m.gross)}</td>
                  <td className="text-xs text-base-content/50">{money(m.paymeFee)}</td>
                  <td className="text-xs font-semibold">{money(m.expected)}</td>
                  <td>
                    {editId === m.period ? (
                      <div className="flex flex-col gap-1">
                        <input type="number" value={val} onChange={(e) => setVal(e.target.value)} placeholder={String(m.expected)} className="vz-input w-32 py-1" aria-label="Actual" />
                        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Izoh')} className="vz-input w-32 py-1" aria-label={t('Izoh')} />
                      </div>
                    ) : (m.actual == null ? <span className="text-base-content/30">—</span> : <span className="text-xs font-semibold">{money(m.actual)}</span>)}
                  </td>
                  <td className={`text-xs ${m.diff ? 'text-error' : 'text-base-content/40'}`}>{m.diff == null ? '—' : money(m.diff)}</td>
                  <td><StatusBadge tone={FIN_RECON_TONE[m.status]}>{t(FIN_RECON_LABEL[m.status] || m.status)}</StatusBadge></td>
                  <td>
                    {editId === m.period ? (
                      <div className="flex gap-1">
                        <button className="btn btn-gold btn-xs min-h-9" disabled={busy} onClick={() => save(m.period)}>{t('Saqlash')}</button>
                        <button className="btn btn-ghost btn-xs min-h-9 min-w-9" onClick={() => setEditId(null)} aria-label={t('Bekor')}>×</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-xs min-h-9" onClick={() => { setEditId(m.period); setVal(m.actual == null ? '' : String(m.actual)); setNote(m.note || ''); }}>{t('Kiritish')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const FIN_RATE_FIELDS = {
  payme: [['pct', 'Komissiya %'], ['fixed', 'Fixed fee (so‘m)']],
  bank: [['cashPct', 'Naqd yechish %'], ['transferPct', 'Transfer %'], ['monthlyFee', 'Oylik xizmat (so‘m)'], ['extraFee', 'Qo‘shimcha fee (so‘m)']],
  tax: [['turnoverPct', 'Aylanma solig‘i %'], ['socialMonthly', 'Ijtimoiy soliq (so‘m/oy)']],
};
const FIN_RATE_TITLE = { payme: 'PAYME', bank: 'TRASTBANK', tax: 'SOLIQ' };

function FinanceRateCard({ scope, current, history, onSaved }) {
  const { t } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(() => ({ ...(current?.params || {}) }));
  const [eff, setEff] = useState(today);
  const [mode, setMode] = useState(current?.params?.mode || 'settlement_deducted');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { setForm({ ...(current?.params || {}) }); setMode(current?.params?.mode || 'settlement_deducted'); }, [current]);

  const save = async () => {
    setBusy(true); setMsg(null);
    const params = {};
    for (const [k] of FIN_RATE_FIELDS[scope]) params[k] = Number(form[k]) || 0;
    if (scope === 'payme') params.mode = mode;
    try {
      await adminApi('/finance/rates', { method: 'POST', body: JSON.stringify({ scope, params, effectiveFrom: eff }) });
      setMsg({ ok: true }); onSaved();
    } catch (e) { setMsg({ ok: false, text: apiErrText(e, t) }); } finally { setBusy(false); }
  };

  return (
    <div className="vz-card p-5">
      <span className="vz-kicker">{FIN_RATE_TITLE[scope]}</span>
      {current && <div className="mt-0.5 text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t('Hozir amalda')}: {current.effectiveFrom}{current.note ? ` · ${current.note}` : ''}</div>}
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {FIN_RATE_FIELDS[scope].map(([k, label]) => (
          <label key={k} className="text-xs">
            <span className="text-base-content/55">{t(label)}</span>
            <input type="number" step="any" value={form[k] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="vz-input mt-1" />
          </label>
        ))}
        {scope === 'payme' && (
          <label className="text-xs">
            <span className="text-base-content/55">{t('Hisoblash usuli')}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="vz-input mt-1">
              <option value="settlement_deducted">{t('Settlementdan ushlab qolinadi')}</option>
              <option value="separate">{t('Alohida hisoblanadi')}</option>
            </select>
          </label>
        )}
        <label className="text-xs">
          <span className="text-base-content/55">{t('Amal qiladi (sana)')}</span>
          <input type="date" value={eff} onChange={(e) => setEff(e.target.value)} className="vz-input mt-1" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn btn-gold btn-sm min-h-11" disabled={busy} onClick={save}>{busy ? <span className="loading loading-spinner loading-xs"></span> : t('Saqlash')}</button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-success' : 'text-error'}`}>{msg.ok ? t('Saqlandi') : (msg.text || t('Xatolik yuz berdi.'))}</span>}
      </div>
      {history && history.length > 1 && (
        <div className="mt-3 border-t border-white/5 pt-2 text-[14px] text-base-content/40">
          {history.slice(0, 5).map((h) => (
            <div key={h.id} className="flex justify-between py-0.5">
              <span>{h.effectiveFrom}</span>
              <span className="font-mono">{FIN_RATE_FIELDS[scope].map(([k]) => `${k}:${h.params?.[k] ?? 0}`).join('  ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinanceRates() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => { setErr(null); return adminApi('/finance/rates').then(setData).catch((e) => setErr(e)); };
  useEffect(() => { load(); }, []);

  if (err) return <LoadError err={err} onRetry={load} title={t("Tariflarni yuklab bo'lmadi.")} />;
  if (!data) return <AdminLoading />;
  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t('Foizlar kodga yozilmagan — shu yerdan boshqariladi. Bank bilan kelishgach real qiymatlarni kiriting. Har o‘zgarish sanasi bilan saqlanadi (eski tranzaksiyalar qayta hisoblanmaydi).')}</p>
      {['payme', 'bank', 'tax'].map((s) => (
        <FinanceRateCard key={s} scope={s} current={data.current?.[s]} history={data.history?.[s]} onSaved={load} />
      ))}
    </div>
  );
}

function FinanceReports({ range, rangeQs, ready }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [dl, setDl] = useState(false);
  const [dlMsg, setDlMsg] = useState(null);

  const load = () => {
    if (!ready) return;
    setData(null); setErr(null);
    adminApi(`/finance/overview?${rangeQs}`).then(setData).catch((e) => setErr(e));
  };
  useEffect(() => { load(); }, [rangeQs, ready]);

  // /finance/report — XLSX (admin-finance.js `report`).
  const download = async () => {
    setDl(true); setDlMsg(null);
    try {
      const res = await fetch(`/api/admin/finance/report?${rangeQs}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `nfcstore_moliya_${range}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { setDlMsg(t('Excel faylni yuklab bo’lmadi.')); } finally { setDl(false); }
  };

  if (!ready) return <EmptyState icon="bank" title={t('Sanani tanlang')} />;
  const o = data?.overview;

  return (
    <div className="space-y-4">
      <div className="vz-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <span className="vz-kicker">{t('Buxgalter uchun paket')}</span>
          <p className="mt-1 text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t('Bitta Excel: jamlama + tranzaksiyalar + kunlik + oylik solishtirish. Buxgalter/soliq uchun DASTLABKI hisobot.')}</p>
        </div>
        <button className="btn btn-gold btn-sm min-h-11 gap-1.5" disabled={dl} onClick={download}>{dl ? <span className="loading loading-spinner loading-xs"></span> : <><AdminIcon name="download" className="h-4 w-4" /> {t('Excel yuklab olish')}</>}</button>
      </div>
      {dlMsg && <div role="alert" className="vz-err">{dlMsg}</div>}

      {err ? <LoadError err={err} onRetry={load} title={t("Hisobotni yuklab bo'lmadi.")} /> : !data ? <AdminLoading /> : o && (
        <AdminCard title={t('Davr jamlamasi')}>
          <div className="space-y-1.5 text-sm">
            {[
              ['Jami savdo (gross)', o.grossSales],
              ['Refund', o.refunds],
              ['Payme komissiyasi', o.paymeFee],
              ['Payme’dan kutilgan tushum', o.expectedBankSettlement],
              ['Bankka real tushgan', o.actualBankSettlement],
              ['Solishtirish farqi', o.reconciliationDifference],
              ['Soliq bazasi', o.taxBase],
              [`Aylanma solig‘i (${o.turnoverPct || 0}%)`, o.turnoverTax],
              ['Ijtimoiy soliq', o.socialTax],
              ['Bank xizmat haqi', o.bankFees],
              ['Boshqa xarajatlar', o.manualExpenses],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between gap-3 border-b pb-1" style={{ borderColor: 'var(--vz-line)' }}>
                <span style={{ color: 'var(--vz-ink-2)' }}>{t(l)}</span>
                <span className="font-medium">{v == null ? t('kiritilmagan') : money(v)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-1.5 text-base font-bold">
              <span>{t('Sof pul oqimi')}</span>
              <span className={o.netCashFlow >= 0 ? 'text-success' : 'text-error'}>{money(o.netCashFlow)}</span>
            </div>
          </div>
          <p className="mt-3 text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t('Bu ichki/dastlabki hisobot. Rasmiy soliq hisoboti buxgalter tomonidan tasdiqlanadi — bu yerdan hech qanday davlat tizimiga avtomatik yuborilmaydi.')}</p>
        </AdminCard>
      )}

      <FinanceExpenses />
    </div>
  );
}

function FinanceExpenses() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ title: '', category: 'other', amount: '', spentOn: new Date().toISOString().slice(0, 10), note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [actErr, setActErr] = useState(null);
  const { confirm, dialog } = useConfirm();

  const load = () => { setErr(null); return adminApi('/finance/expenses').then(setData).catch((e) => setErr(e)); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title.trim() || !Number(form.amount)) return;
    setBusy(true); setActErr(null);
    try {
      await adminApi('/finance/expenses', { method: 'POST', body: JSON.stringify(form) });
      setForm({ title: '', category: 'other', amount: '', spentOn: new Date().toISOString().slice(0, 10), note: '' });
      load();
    } catch (e) { setActErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };
  const del = async (e) => {
    if (!(await confirm({ title: t("Xarajatni o'chirish"), message: `${t('O‘chirasizmi?')} ${e.title} — ${money(e.amount)}`, confirmLabel: t('O‘chirish'), danger: true }))) return;
    setActErr(null);
    try { await adminApi(`/finance/expenses/${e.id}`, { method: 'DELETE' }); load(); }
    catch (e2) { setActErr(apiErrText(e2, t)); }
  };

  return (
    <AdminCard title={t('Boshqa xarajatlar')}>
      {dialog}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t('Nomi')} className="vz-input min-w-0 lg:col-span-2" aria-label={t('Nomi')} />
        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="vz-input min-w-0" aria-label={t('Turkum')}>
          {(data?.categories || ['other']).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder={t('Summa')} className="vz-input min-w-0" aria-label={t('Summa')} />
        <input type="date" value={form.spentOn} onChange={(e) => setForm((f) => ({ ...f, spentOn: e.target.value }))} className="vz-input min-w-0" aria-label={t('Sana')} />
        <button className="btn btn-gold min-h-11" disabled={busy} onClick={add}>{t('Qo‘shish')}</button>
      </div>
      {actErr && <div role="alert" className="vz-err mt-2">{actErr}</div>}
      <div className="mt-3">
        {err ? <LoadError err={err} onRetry={load} title={t("Xarajatlarni yuklab bo'lmadi.")} /> : !data ? <AdminLoading rows={3} /> : (data.expenses || []).length === 0 ? <EmptyState icon="tag" title={t('Hozircha xarajat yo‘q.')} /> : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead><tr><th>{t('Sana')}</th><th>{t('Nomi')}</th><th>{t('Turkum')}</th><th>{t('Summa')}</th><th></th></tr></thead>
              <tbody>
                {data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-xs text-base-content/55">{e.spentOn}</td>
                    <td className="break-words">{e.title}{e.note && <div className="text-[13px] text-base-content/35">{e.note}</div>}</td>
                    <td className="text-xs">{e.category}</td>
                    <td className="whitespace-nowrap font-semibold">{money(e.amount)}</td>
                    <td><button className="btn btn-ghost btn-xs min-h-9 text-error" onClick={() => del(e)}>{t('O‘chirish')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminCard>
  );
}

function FinanceDocs() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: '', docType: 'other', period: '', url: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [actErr, setActErr] = useState(null);
  const { confirm, dialog } = useConfirm();

  const load = () => { setErr(null); return adminApi('/finance/documents').then(setData).catch((e) => setErr(e)); };
  useEffect(() => { load(); }, []);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setActErr(t('Fayl 15 MB dan katta.')); return; }
    setActErr(null);
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        await adminApi('/finance/documents', { method: 'POST', body: JSON.stringify({ name: form.name || file.name, docType: form.docType, period: form.period, dataUrl: reader.result }) });
        setForm({ name: '', docType: 'other', period: '', url: '' });
        load();
      } catch (e2) { setActErr(e2.message === 'too_large' ? t('Fayl 15 MB dan katta.') : e2.message === 'bad_file' ? t('Fayl formati qo‘llab-quvvatlanmaydi.') : apiErrText(e2, t)); } finally { setBusy(false); }
    };
    reader.onerror = () => setActErr(t('Faylni o‘qib bo‘lmadi.'));
    reader.readAsDataURL(file);
  };
  const addLink = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    setBusy(true); setActErr(null);
    try { await adminApi('/finance/documents', { method: 'POST', body: JSON.stringify(form) }); setForm({ name: '', docType: 'other', period: '', url: '' }); load(); }
    catch (e) { setActErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };
  const del = async (d) => {
    if (!(await confirm({ title: t("Hujjatni o'chirish"), message: `${t('O‘chirasizmi?')} ${d.name}`, confirmLabel: t('O‘chirish'), danger: true }))) return;
    setActErr(null);
    try { await adminApi(`/finance/documents/${d.id}`, { method: 'DELETE' }); load(); }
    catch (e) { setActErr(apiErrText(e, t)); }
  };

  return (
    <div className="space-y-3">
      {dialog}
      <div className="vz-card p-5">
        <span className="vz-kicker">{t('Hujjat qo‘shish')}</span>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--vz-ink-2)' }}>{t('Payme hisobot, bank ko‘chirmasi, soliq hujjati, chek… Fayl (PDF/Excel/CSV/rasm, ≤15 MB) yoki tashqi havola. Diqqat: yuklangan fayllar server yangilanganda o‘chishi mumkin — muhimlarini tashqi drayvda ham saqlang.')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('Nomi')} className="vz-input min-w-0" aria-label={t('Nomi')} />
          <select value={form.docType} onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))} className="vz-input min-w-0" aria-label={t('Tur')}>
            {Object.entries(FIN_DOC_LABEL).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
          </select>
          <input value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} placeholder={t('Davr (masalan 2026-08)')} className="vz-input min-w-0" aria-label={t('Davr (masalan 2026-08)')} />
          <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder={t('Havola (ixtiyoriy)')} className="vz-input min-w-0" aria-label={t('Havola (ixtiyoriy)')} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="btn btn-ghost-vz btn-sm min-h-11">
            {t('Fayl tanlash')}
            <input type="file" onChange={onFile} accept=".pdf,.csv,.xlsx,.xls,image/*" className="hidden" />
          </label>
          <button className="btn btn-gold btn-sm min-h-11" disabled={busy || !form.url.trim()} onClick={addLink}>{t('Havola bilan qo‘shish')}</button>
          {busy && <span className="loading loading-spinner loading-xs"></span>}
        </div>
        {actErr && <div role="alert" className="vz-err mt-2">{actErr}</div>}
      </div>

      {err ? <LoadError err={err} onRetry={load} title={t("Hujjatlarni yuklab bo'lmadi.")} /> : !data ? <AdminLoading /> : (data.documents || []).length === 0 ? <EmptyState icon="folder" title={t('Hozircha hujjat yo‘q.')} /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>{t('Nomi')}</th><th>{t('Tur')}</th><th>{t('Qaysi oy')}</th><th>{t('Sana')}</th><th></th></tr></thead>
            <tbody>
              {data.documents.map((d) => (
                <tr key={d.id}>
                  <td className="break-words"><a href={d.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: 'var(--vz-gold)' }}>{d.name}</a></td>
                  <td className="text-xs">{t(FIN_DOC_LABEL[d.docType] || d.docType)}</td>
                  <td className="font-mono text-xs">{d.period || '—'}</td>
                  <td className="whitespace-nowrap text-xs text-base-content/50">{d.createdAt ? dateTime(new Date(d.createdAt).getTime()) : '—'}</td>
                  <td><button className="btn btn-ghost btn-xs min-h-9 text-error" onClick={() => del(d)}>{t('O‘chirish')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// KOMPANIYALAR (Company System — Admin Panel Faz 20–23). "Company" =
// profile_type = 'business' bo'lgan cards yozuvi — alohida jadval yo'q
// (Faz 0 audit qarori). Tarif — mavjud NFC ID tier tizimi, alohida
// obuna emas: shuning uchun "FREE/PRO" filtri idTier'ga asoslanadi
// (free = FREE, boshqa har qanday daraja = PRO).
// ═══════════════════════════════════════════════════════════════════

const COMPANY_SUBTABS = [['requests', 'Company ID arizalari'], ['overview', 'Eski tizim — umumiy'], ['list', 'Eski biznes profillar'], ['pricing', 'Eski tariflar'], ['log', 'Eski jurnal']];

const COMPANY_ACTION_LABEL = {
  company_suspended: 'Kompaniya bloklandi',
  company_activated: 'Kompaniya faollashtirildi',
  company_tier_set: 'Tarif qo‘lda belgilandi',
  company_limits_changed: 'FREE/PRO limit o‘zgartirildi',
  company_limits_reset: 'Limit standartga qaytarildi',
  physical_nfc_pricing_changed: 'Jismoniy NFC narxi o‘zgartirildi',
  delivery_days_changed: 'Yetkazib berish muddati o‘zgartirildi',
};

function CompanyActivityLog() {
  const { t } = useLanguage();
  const [log, setLog] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => { setErr(null); setLog(null); adminApi('/companies/activity-log').then((d) => setLog(d.log || [])).catch((e) => setErr(e)); };
  useEffect(() => { load(); }, []);
  return (
    <AdminCard title={t('Kompaniyalar bo‘yicha admin amallari')}>
      {err ? <LoadError err={err} onRetry={load} title={t("Jurnalni yuklab bo'lmadi.")} />
        : !log ? <AdminLoading rows={5} />
        : log.length === 0 ? <EmptyState icon="activity" title={t("Hozircha yozuv yo'q.")} />
        : (
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>{t('Amal')}</th><th>{t('Tafsilot')}</th><th>{t('Eski qiymat')}</th><th>{t('Yangi qiymat')}</th><th>{t('IP')}</th><th>{t('Vaqt')}</th></tr></thead>
          <tbody>
            {log.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold">{t(COMPANY_ACTION_LABEL[a.action] || a.action)}</td>
                <td className="max-w-xs break-words text-xs text-base-content/60">{a.details || '—'}</td>
                <td className="max-w-[160px] break-words text-xs text-base-content/50">{a.oldValue || '—'}</td>
                <td className="max-w-[160px] break-words text-xs text-base-content/50">{a.newValue || '—'}</td>
                <td className="font-mono text-xs text-base-content/40">{a.ip || '—'}</td>
                <td className="whitespace-nowrap text-xs text-base-content/50">{timeAgo(new Date(a.createdAt).getTime())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        )}
    </AdminCard>
  );
}
const COMPANY_TIER_OPTIONS = ['silver', 'gold', 'premium', 'exclusive'];

function companyModuleStatus(catCount, itemCount) {
  if (catCount > 0 && itemCount > 0) return { text: 'Faol', tone: 'success' };
  if (catCount > 0) return { text: 'Yaratilgan (bo‘sh)', tone: 'muted' };
  return { text: 'Yaratilmagan', tone: 'muted' };
}

function CompaniesOverview() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => { setErr(null); setStats(null); adminApi('/companies/stats').then(setStats).catch((e) => setErr(e)); };
  useEffect(() => { load(); }, []);
  if (err) return <LoadError err={err} onRetry={load} title={t("Kompaniya statistikasini yuklab bo'lmadi.")} />;
  if (!stats) return <AdminLoading rows={6} />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard icon="building" tone="accent" label={t('Jami kompaniyalar')} value={fmt(stats.total)} />
      <KpiCard icon="check" tone="success" label={t('Faol (katalogda ko‘rinadi)')} value={fmt(stats.active)} />
      <KpiCard icon="shield" tone="danger" label={t('Bloklangan (katalogdan yashirilgan)')} value={fmt(stats.suspended)} />
      <KpiCard icon="clipboard" tone="pending" label={t('Restoran menyusi ishlatayotgan')} value={fmt(stats.withMenu)} />
      <KpiCard icon="bag" tone="info" label={t('Mahsulotlar katalogi ishlatayotgan')} value={fmt(stats.withProducts)} />
      <KpiCard icon="idcard" tone="muted" label={t('Ikkalasini ham ishlatayotgan')} value={fmt(stats.withBoth)} />
    </div>
  );
}

function CompanyDetailModal({ code, onClose, onChanged }) {
  const { t, lang } = useLanguage();
  const { isSuper } = useAdmin();
  const { confirm, dialog } = useConfirm();
  const cats = useCategories();
  const [row, setRow] = useState(null);
  const [err, setErr] = useState(null);
  const [actErr, setActErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tierPick, setTierPick] = useState('');

  const load = () => { setErr(null); return adminApi(`/companies/${encodeURIComponent(code)}`).then((d) => { setRow(d); setTierPick(d.tierOverride || ''); }).catch((e) => setErr(e)); };
  useEffect(() => { load(); }, [code]);

  const toggleStatus = async () => {
    const hiding = !row.hiddenFromDirectory;
    const ok = await confirm({
      title: hiding ? t('Kompaniyani bloklash') : t('Kompaniyani faollashtirish'),
      message: hiding
        ? t('{name} kompaniyasini bloklaysizmi? U ommaviy katalog va qidiruvdan yashiriladi (havola orqali ochilaveradi).', { name: row.name })
        : t('{name} kompaniyasini qayta faollashtirasizmi? U katalogda yana ko‘rinadi.', { name: row.name }),
      confirmLabel: hiding ? t('Bloklash') : t('Faollashtirish'),
      danger: hiding,
    });
    if (!ok) return;
    setBusy(true); setActErr(null);
    try {
      await adminApi(`/companies/${encodeURIComponent(code)}/status`, { method: 'POST', body: JSON.stringify({ hidden: hiding }) });
      await load(); onChanged();
    } catch (e) { setActErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };
  const saveTier = async () => {
    const label = tierPick ? t(TIER_LABEL[tierPick] || tierPick) : t('Avtomatik (kod naqshiga qarab)');
    if (!(await confirm({ title: t("Tarifni qo'lda belgilash"), message: t('{name} uchun tarif «{tier}» qilib belgilansinmi? Bu kod naqshidan kelib chiqadigan avtomatik darajani almashtiradi.', { name: row.name, tier: label }), confirmLabel: t('Saqlash') }))) return;
    setBusy(true); setActErr(null);
    try {
      await adminApi(`/companies/${encodeURIComponent(code)}/tier`, { method: 'POST', body: JSON.stringify({ tier: tierPick || null }) });
      await load(); onChanged();
    } catch (e) { setActErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  if (!row) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div className="vz-card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
          {err ? <LoadError err={err} onRetry={load} title={t("Kompaniyani yuklab bo'lmadi.")} /> : <AdminLoading />}
          <button className="btn btn-ghost-vz btn-sm mt-3 min-h-11 w-full" onClick={onClose}>{t('Yopish')}</button>
        </div>
      </div>
    );
  }

  const tier = idTier({ code: row.code, tierOverride: row.tierOverride, isGift: row.isGift });
  const access = effectiveAccess({ code: row.code, tierOverride: row.tierOverride, isGift: row.isGift }, { isPremium: row.ownerIsPremium });
  const menuStatus = companyModuleStatus(row.menuCatCount, row.menuItemCount);
  const productStatus = companyModuleStatus(row.productCatCount, row.productItemCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      {dialog}
      <div className="vz-card max-h-[88vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 break-words">
            <div className="font-display text-lg font-semibold">{row.name} {row.verified && <span className="vz-badge vz-badge--ok align-middle">{t('Tasdiqlangan')}</span>}</div>
            <div className="font-mono text-xs" style={{ color: 'var(--vz-ink-3)' }}>nfcstore.uz/{row.code.toLowerCase()}</div>
          </div>
          <button className="btn btn-ghost-vz btn-sm min-h-11 min-w-11" onClick={onClose} aria-label={t('Yopish')}>✕</button>
        </div>
        {actErr && <div role="alert" className="vz-err mt-3">{actErr}</div>}

        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 break-words text-xs sm:grid-cols-2">
          <div><span className="text-base-content/45">{t('Egasi')}:</span> {row.ownerEmail || '—'}</div>
          <div><span className="text-base-content/45">{t('Telefon')}:</span> {row.phone || row.ownerPhone || '—'}</div>
          <div><span className="text-base-content/45">{t('Soha')}:</span> {catPath(cats, row.categorySlug, lang) || '—'}</div>
          <div><span className="text-base-content/45">{t('Shahar')}:</span> {row.city || '—'}</div>
          <div><span className="text-base-content/45">{t('Jamoa a’zolari')}:</span> {row.teamCount}</div>
          <div><span className="text-base-content/45">{t('Band qilingan')}:</span> {timeAgo(row.ts)}</div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="vz-panel min-w-0 p-3">
            <div className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--vz-ink-3)' }}>{t('Restoran menyusi')}</div>
            <StatusBadge tone={menuStatus.tone}>{t(menuStatus.text)}</StatusBadge>
            <div className="mt-1 text-[14px] text-base-content/50">{row.menuCatCount} {t('kategoriya')} · {row.menuItemCount} {t('taom')}</div>
            <a className="mt-1.5 inline-block text-[14px] font-semibold text-accent underline underline-offset-2" href={`/${row.code.toLowerCase()}/menyu`} target="_blank" rel="noopener noreferrer">{t('Ochish')} ↗</a>
          </div>
          <div className="vz-panel min-w-0 p-3">
            <div className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--vz-ink-3)' }}>{t('Mahsulotlar katalogi')}</div>
            <StatusBadge tone={productStatus.tone}>{t(productStatus.text)}</StatusBadge>
            <div className="mt-1 text-[14px] text-base-content/50">{row.productCatCount} {t('kategoriya')} · {row.productItemCount} {t('mahsulot')}</div>
            <a className="mt-1.5 inline-block text-[14px] font-semibold text-accent underline underline-offset-2" href={`/${row.code.toLowerCase()}/mahsulotlar`} target="_blank" rel="noopener noreferrer">{t('Ochish')} ↗</a>
          </div>
        </div>

        <div className="vz-panel mt-4 p-3">
          <div className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--vz-ink-3)' }}>{t('Tarif')}</div>
          <div className="mt-1 text-sm">{t(TIER_LABEL[tier] || tier)} {row.ownerIsPremium && access !== tier ? `→ ${t('Profile Premium orqali')} ${t(TIER_LABEL[access])}` : ''}</div>
          {isSuper ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <select value={tierPick} onChange={(e) => setTierPick(e.target.value)} className="vz-input w-auto min-w-0 py-1" aria-label={t('Tarif')}>
                <option value="">{t('Avtomatik (kod naqshiga qarab)')}</option>
                {COMPANY_TIER_OPTIONS.map((v) => <option key={v} value={v}>{t(TIER_LABEL[v])}</option>)}
              </select>
              <button className="btn btn-gold btn-xs min-h-9" disabled={busy} onClick={saveTier}>{t('Saqlash')}</button>
            </div>
          ) : <div className="mt-2 text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t("Tarifni faqat Super Admin o'zgartira oladi.")}</div>}
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--vz-ink-3)' }}>{t('Bu — NFC ID darajasini qo‘lda belgilash (masalan sovg‘a/maxsus holat). Kod naqshidan kelib chiqadigan avtomatik darajani almashtiradi.')}</p>
        </div>

        <div className="vz-panel mt-4 flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0 text-xs">
            <div className="font-semibold">{row.hiddenFromDirectory ? t('Bloklangan') : t('Faol')}</div>
            <div className="text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t('Bloklash faqat ommaviy katalog/qidiruvdan yashiradi — havola orqali ochish davom etadi.')}</div>
          </div>
          {isSuper && (
            <button className={`btn btn-xs min-h-9 ${row.hiddenFromDirectory ? 'btn-success' : 'btn-warning'}`} disabled={busy} onClick={toggleStatus}>
              {row.hiddenFromDirectory ? t('Faollashtirish') : t('Bloklash')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const PRICING_TIERS = ['free', 'silver', 'gold', 'premium', 'exclusive'];

function LimitsTable({ title, subtitle, kind, limits, onSaved }) {
  const { t } = useLanguage();
  const { isSuper } = useAdmin();
  const [edit, setEdit] = useState(null); // tier being edited
  const [form, setForm] = useState({ cat: '', item: '', images: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (!limits) return null;

  const startEdit = (tier) => { setEdit(tier); setForm({ ...limits[tier] }); };
  const save = async (tier) => {
    setBusy(true); setErr(null);
    try {
      await adminApi('/company-settings/limits', { method: 'POST', body: JSON.stringify({ kind, tier, cat: Number(form.cat), item: Number(form.item), images: form.images }) });
      setEdit(null); await onSaved();
    } catch (e) { setErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };
  const resetDefault = async (tier) => {
    setBusy(true); setErr(null);
    try { await adminApi(`/company-settings/limits/${kind}/${tier}`, { method: 'DELETE' }); await onSaved(); }
    catch (e) { setErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  return (
    <AdminCard title={title} right={<span className="text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{subtitle}</span>}>
      {err && <div role="alert" className="vz-err mb-2">{err}</div>}
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>{t('Tarif')}</th><th>{t('Kategoriyalar')}</th><th>{t('Elementlar')}</th><th>{t('Rasm')}</th><th></th></tr></thead>
          <tbody>
            {PRICING_TIERS.map((tier) => {
              const l = limits[tier];
              const editing = edit === tier;
              return (
                <tr key={tier}>
                  <td className="font-semibold">{t(TIER_LABEL[tier])} {l.isCustom && <span className="vz-badge vz-badge--gold ml-1">{t('o‘zgartirilgan')}</span>}</td>
                  {editing ? (
                    <>
                      <td><input type="number" min="0" value={form.cat} onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))} className="vz-input w-20 py-1" aria-label={t('Kategoriyalar')} /></td>
                      <td><input type="number" min="0" value={form.item} onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))} className="vz-input w-24 py-1" aria-label={t('Elementlar')} /></td>
                      <td>
                        <input type="checkbox" checked={form.images} onChange={(e) => setForm((f) => ({ ...f, images: e.target.checked }))} className="checkbox checkbox-sm" aria-label={t('Rasm')} />
                      </td>
                      <td className="flex gap-1">
                        <button className="btn btn-gold btn-xs min-h-9" disabled={busy} onClick={() => save(tier)}>{t('Saqlash')}</button>
                        <button className="btn btn-ghost btn-xs min-h-9" onClick={() => setEdit(null)}>{t('Bekor')}</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{l.cat}</td>
                      <td>{l.item}</td>
                      <td>{l.images ? t('Ha') : '—'}</td>
                      <td className="flex gap-1">
                        {isSuper && <button className="btn btn-ghost btn-xs min-h-9" onClick={() => startEdit(tier)}>{t('Tahrirlash')}</button>}
                        {isSuper && l.isCustom && <button className="btn btn-ghost btn-xs min-h-9" disabled={busy} onClick={() => resetDefault(tier)}>{t('Standartga qaytarish')}</button>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

function PhysicalPricingCard({ tiers, onSaved }) {
  const { t } = useLanguage();
  const { isSuper } = useAdmin();
  const [rows, setRows] = useState(tiers);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { setRows(tiers); }, [tiers]);

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { minQty: 1, maxQty: null, pricePerUnit: 0 }]);
  const delRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const save = async () => {
    setBusy(true); setErr(null);
    try { await adminApi('/company-settings/physical-pricing', { method: 'POST', body: JSON.stringify({ tiers: rows }) }); await onSaved(); }
    catch (e) { setErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  return (
    <AdminCard title={t('Jismoniy NFC — ko‘p dona narx pog‘onalari')}>
      <p className="mb-3 text-[13px]" style={{ color: 'var(--vz-ink-2)' }}>{t('Korporativ buyurtma kalkulyatori uchun (Kompaniyalar sahifasida ko‘rinadi).')} {t('Bu — informatsion kalkulyator. To‘lov/checkout hozircha o‘chiq — buyurtma Telegram orqali qo‘lda amalga oshiriladi.')}</p>
      <div className="space-y-2">
        {rows.length === 0 && <EmptyState icon="tag" title={t("Hozircha pog'ona yo'q.")} />}
        {rows.map((r, i) => (
          <div key={i} className="vz-panel flex flex-wrap items-center gap-2 p-2">
            <span className="text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t('dan')}</span>
            <input type="number" min="1" value={r.minQty} disabled={!isSuper} onChange={(e) => setRow(i, { minQty: Number(e.target.value) })} className="vz-input w-20 py-1" aria-label={t('dan')} />
            <span className="text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t('gacha')}</span>
            <input type="number" min="1" value={r.maxQty ?? ''} disabled={!isSuper} placeholder={t('cheksiz')} onChange={(e) => setRow(i, { maxQty: e.target.value === '' ? null : Number(e.target.value) })} className="vz-input w-24 py-1" aria-label={t('gacha')} />
            <span className="text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t('dona —')}</span>
            <input type="number" min="0" value={r.pricePerUnit} disabled={!isSuper} onChange={(e) => setRow(i, { pricePerUnit: Number(e.target.value) })} className="vz-input w-32 py-1" aria-label={t("so'm/dona")} />
            <span className="text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t("so'm/dona")}</span>
            {isSuper && <button className="btn btn-ghost btn-xs ml-auto min-h-9 text-error" onClick={() => delRow(i)}>{t("O'chirish")}</button>}
          </div>
        ))}
      </div>
      {err && <div role="alert" className="vz-err mt-2">{err}</div>}
      {isSuper && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-ghost-vz btn-xs min-h-9" onClick={addRow}>{t('+ Pog‘ona qo‘shish')}</button>
          <button className="btn btn-gold btn-xs min-h-9" disabled={busy || rows.length === 0} onClick={save}>{t('Saqlash')}</button>
        </div>
      )}
    </AdminCard>
  );
}

function DeliveryCard({ delivery, onSaved }) {
  const { t } = useLanguage();
  const { isSuper } = useAdmin();
  const [minDays, setMinDays] = useState(delivery.minDays);
  const [maxDays, setMaxDays] = useState(delivery.maxDays);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { setMinDays(delivery.minDays); setMaxDays(delivery.maxDays); }, [delivery]);

  const save = async () => {
    setBusy(true); setErr(null);
    try { await adminApi('/company-settings/delivery', { method: 'POST', body: JSON.stringify({ minDays: Number(minDays), maxDays: Number(maxDays) }) }); await onSaved(); }
    catch (e) { setErr(apiErrText(e, t)); }
    finally { setBusy(false); }
  };

  return (
    <AdminCard title={t('Yetkazib berish muddati')}>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min="0" value={minDays} disabled={!isSuper} onChange={(e) => setMinDays(e.target.value)} className="vz-input w-20 py-1" aria-label={t('Yetkazib berish muddati')} />
        <span className="text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>—</span>
        <input type="number" min="0" value={maxDays} disabled={!isSuper} onChange={(e) => setMaxDays(e.target.value)} className="vz-input w-20 py-1" aria-label={t('Yetkazib berish muddati')} />
        <span className="text-[13px]" style={{ color: 'var(--vz-ink-3)' }}>{t('ish kuni')}</span>
        {isSuper && <button className="btn btn-gold btn-xs min-h-9" disabled={busy} onClick={save}>{t('Saqlash')}</button>}
      </div>
      {err && <div role="alert" className="vz-err mt-2">{err}</div>}
    </AdminCard>
  );
}

function CompanyPricingSubtab() {
  const { t } = useLanguage();
  const { isSuper } = useAdmin();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => { setErr(null); return adminApi('/company-settings').then(setData).catch((e) => setErr(e)); };
  useEffect(() => { load(); }, []);
  if (err) return <LoadError err={err} onRetry={load} title={t("Sozlamalarni yuklab bo'lmadi.")} />;
  if (!data) return <AdminLoading rows={6} />;
  return (
    <div className="space-y-5">
      {!isSuper && <div className="vz-panel p-3 text-xs" style={{ color: 'var(--vz-ink-2)' }}>{t("Bu sozlamalarni faqat Super Admin o'zgartira oladi — siz faqat ko'ra olasiz.")}</div>}
      <LimitsTable title={t('Restoran menyusi — FREE/PRO limitlar')} subtitle={t('Har bir NFC ID darajasi uchun')} kind="menu" limits={data.menuLimits} onSaved={load} />
      <LimitsTable title={t('Mahsulotlar katalogi — FREE/PRO limitlar')} subtitle={t('Har bir NFC ID darajasi uchun')} kind="product" limits={data.productLimits} onSaved={load} />
      <PhysicalPricingCard tiers={data.physicalNfcTiers} onSaved={load} />
      <DeliveryCard delivery={data.delivery} onSaved={load} />
    </div>
  );
}

function CompanyIdRequests() {
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirm();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [actErr, setActErr] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [rule, setRule] = useState({ companyId: '', rule: 'reserved', tierOverride: '', priceOverride: '', note: '' });
  const [rules, setRules] = useState([]);
  const load = () => {
    setErr(null);
    return Promise.all([
      adminApi(`/company-requests${filter === 'all' ? '' : `?status=${filter}`}`).then(setData),
      adminApi('/company-id-rules').then((d) => setRules(d.rules || [])).catch(() => setRules([])),
    ]).catch((e) => { setData(null); setErr(e); });
  };
  useEffect(() => { setData(null); load(); }, [filter]);

  const STATUS_TITLE = { approved: 'Arizani tasdiqlash', rejected: 'Arizani rad etish', active: 'Company ID’ni faollashtirish', suspended: 'Company ID’ni bloklash' };
  const setStatus = async (companyId, status) => {
    const needNote = ['rejected', 'suspended'].includes(status);
    const res = await confirm({
      title: t(STATUS_TITLE[status] || 'Tasdiqlaysizmi?'),
      message: `${companyId}`,
      input: needNote ? { label: t('Admin izohi'), placeholder: t('Sabab (foydalanuvchiga ko‘rinadi)'), optional: status !== 'rejected' } : null,
      confirmLabel: t(status === 'rejected' ? 'Rad etish' : status === 'suspended' ? 'Bloklash' : status === 'active' ? 'Faollashtirish' : 'Tasdiqlash'),
      danger: needNote,
    });
    if (res === false || res === null) return;
    const note = needNote ? String(res || '') : '';
    setBusy(companyId + status); setActErr(null);
    try {
      await adminApi(`/company-requests/${companyId}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) });
      await load();
    } catch (e) { setActErr(apiErrText(e, t)); }
    finally { setBusy(''); }
  };
  const saveRule = async (event) => {
    event.preventDefault(); setBusy('rule'); setActErr(null);
    try {
      await adminApi('/company-id-rules', { method: 'PUT', body: JSON.stringify(rule) });
      setRule({ companyId: '', rule: 'reserved', tierOverride: '', priceOverride: '', note: '' });
      await load();
    } catch (e) { setActErr(apiErrText(e, t)); }
    finally { setBusy(''); }
  };

  const tone = { pending_review: 'pending', approved: 'info', payment_pending: 'pending', paid: 'success', active: 'success', rejected: 'danger', suspended: 'danger', draft: 'muted' };
  const labels = { draft: 'Qoralama', pending_review: 'Tekshiruvda', approved: 'Tasdiqlangan', payment_pending: 'To‘lov kutilmoqda', paid: 'To‘langan', active: 'Faol', rejected: 'Rad etilgan', suspended: 'Bloklangan' };
  const rows = data?.companies || [];
  return <div className="space-y-5">
    {dialog}
    {actErr && <div role="alert" className="vz-err">{actErr}</div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard icon="clipboard" tone="pending" label={t('Tekshiruvdagi arizalar')} value={(data?.counts || []).find((r) => r.status === 'pending_review')?.count || 0} />
      <KpiCard icon="check" tone="info" label={t('Tasdiqlangan')} value={(data?.counts || []).find((r) => r.status === 'approved')?.count || 0} />
      <KpiCard icon="wallet" tone="pending" label={t('To‘lov kutilmoqda')} value={(data?.counts || []).find((r) => r.status === 'payment_pending')?.count || 0} />
      <KpiCard icon="building" tone="success" label={t('Faol Company ID')} value={(data?.counts || []).find((r) => r.status === 'active')?.count || 0} />
    </div>
    <AdminCard title={t('Mustaqil Company ID arizalari')} right={<select value={filter} onChange={(e) => setFilter(e.target.value)} className="vz-input w-auto py-1" aria-label={t('Status')}><option value="all">{t('Barchasi')}</option>{Object.entries(labels).map(([value,label]) => <option key={value} value={value}>{t(label)}</option>)}</select>}>
      <p className="mb-4 text-xs leading-relaxed" style={{ color: 'var(--vz-ink-2)' }}>{t('Bu ro‘yxat shaxsiy NFC IDlardan butunlay alohida. Tasdiqlash personal profil, personal narx yoki personal kartani o‘zgartirmaydi.')}</p>
      {err ? <LoadError err={err} onRetry={load} title={t("Arizalarni yuklab bo'lmadi.")} />
        : data === null ? <AdminLoading rows={5} />
        : rows.length === 0 ? <EmptyState icon="building" title={t('Ariza topilmadi.')} />
        : (
      <div className="overflow-x-auto"><table className="table table-sm"><thead><tr><th>Company ID</th><th>{t('Kompaniya')}</th><th>{t('Egasi')}</th><th>{t('Tarif / narx')}</th><th>{t('Status')}</th><th>{t('Amal')}</th></tr></thead><tbody>
        {rows.map((company) => <tr key={company.companyId}><td><b className="font-mono" style={{ color: 'var(--vz-gold-2)' }}>{company.companyId}</b><div className="text-[13px] text-base-content/35">/c/{company.companyId.toLowerCase()}</div></td><td className="break-words"><b>{company.displayName}</b><div className="text-[13px] text-base-content/45">{company.category} · {company.city}</div>{company.sourceCardCode && <div className="text-[13px] text-warning">{t('nusxa')}: {company.sourceCardCode}</div>}</td><td><div className="break-words text-xs">{company.ownerEmail || company.ownerUserId}</div></td><td><b>{company.tier?.toUpperCase()}</b><div className="whitespace-nowrap text-[13px] text-base-content/45">{fmt(company.price)} {t("so'm")}</div></td><td><StatusBadge tone={tone[company.status] || 'muted'}>{t(labels[company.status] || company.status)}</StatusBadge></td><td><div className="flex flex-wrap gap-1">{company.status === 'pending_review' && <><button className="btn btn-success btn-xs min-h-9" disabled={!!busy} onClick={() => setStatus(company.companyId, 'approved')}>{t('Tasdiqlash')}</button><button className="btn btn-error btn-xs min-h-9" disabled={!!busy} onClick={() => setStatus(company.companyId, 'rejected')}>{t('Rad etish')}</button></>}{['approved','payment_pending','paid'].includes(company.status) && <button className="btn btn-outline-gold btn-xs min-h-9" disabled={!!busy} onClick={() => setStatus(company.companyId, 'active')}>{t('Faollashtirish')}</button>}{company.status === 'active' && <button className="btn btn-warning btn-xs min-h-9" disabled={!!busy} onClick={() => setStatus(company.companyId, 'suspended')}>{t('Bloklash')}</button>}{company.status === 'suspended' && <button className="btn btn-success btn-xs min-h-9" disabled={!!busy} onClick={() => setStatus(company.companyId, 'active')}>{t('Qayta ochish')}</button>}<a className="btn btn-ghost btn-xs min-h-9 min-w-9" href={`/company/${company.companyId.toLowerCase()}`} target="_blank" rel="noreferrer" aria-label={t('Ochish')}>↗</a></div></td></tr>)}
      </tbody></table></div>
        )}
    </AdminCard>
    <AdminCard title={t('Company ID rezerv va narx override')}>
      <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6" onSubmit={saveRule}><input required pattern="[A-Za-z]{3,15}" value={rule.companyId} onChange={(e) => setRule((old) => ({ ...old, companyId:e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,15) }))} placeholder="COMPANYID" className="vz-input min-w-0 font-mono" aria-label="Company ID"/><select value={rule.rule} onChange={(e) => setRule((old) => ({ ...old, rule:e.target.value }))} className="vz-input min-w-0" aria-label={t('Qoida')}><option value="reserved">Reserved</option><option value="off_sale">Off sale</option><option value="blocked">Blocked</option><option value="exclusive">Exclusive</option><option value="allow">Allow</option></select><select value={rule.tierOverride} onChange={(e) => setRule((old) => ({ ...old, tierOverride:e.target.value }))} className="vz-input min-w-0" aria-label={t('Tarif')}><option value="">Auto tier</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="premium">Premium</option><option value="exclusive">Exclusive</option></select><input type="number" min="0" value={rule.priceOverride} onChange={(e) => setRule((old) => ({ ...old, priceOverride:e.target.value }))} placeholder={t('Maxsus narx')} className="vz-input min-w-0" aria-label={t('Maxsus narx')}/><input value={rule.note} onChange={(e) => setRule((old) => ({ ...old, note:e.target.value }))} placeholder={t('Admin izohi')} className="vz-input min-w-0" aria-label={t('Admin izohi')}/><button className="btn btn-gold min-h-11" disabled={busy === 'rule'}>{t('Saqlash')}</button></form>
      {rules.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{rules.slice(0,20).map((entry) => { const id = entry.company_id || entry.companyId; const price = entry.price_override ?? entry.priceOverride; return <span key={id} className="vz-badge vz-badge--muted font-mono">{id} · {entry.rule}{price != null ? ` · ${fmt(price)}` : ''}</span>; })}</div>}
    </AdminCard>
  </div>;
}

function CompaniesTab() {
  const { t, lang } = useLanguage();
  const cats = useCategories();
  const [sub, setSub] = useState('requests');
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [planFilter, setPlanFilter] = useState('all'); // all | free | pro
  const [typeFilter, setTypeFilter] = useState('all'); // all | menu | products | both
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | suspended
  const [openCode, setOpenCode] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [shown, setShown] = useState(50);

  const load = () => { setLoadErr(null); return adminApi('/companies').then((d) => setRows(d.companies || [])).catch((e) => setLoadErr(e)); };
  useEffect(() => { if (sub === 'list') load(); }, [sub]);
  useEffect(() => { setShown(50); }, [q, planFilter, typeFilter, statusFilter]);

  const enriched = (rows || []).map((r) => ({
    ...r,
    tier: idTier({ code: r.code, tierOverride: r.tierOverride, isGift: r.isGift }),
    hasMenu: r.menuCatCount > 0 && r.menuItemCount > 0,
    hasProducts: r.productCatCount > 0 && r.productItemCount > 0,
  }));

  const query = q.trim().toLowerCase();
  const filtered = enriched.filter((r) => {
    if (query && !(
      r.name.toLowerCase().includes(query) ||
      r.code.toLowerCase().includes(query) ||
      (r.ownerEmail || '').toLowerCase().includes(query)
    )) return false;
    if (planFilter === 'free' && r.tier !== 'free') return false;
    if (planFilter === 'pro' && r.tier === 'free') return false;
    if (typeFilter === 'menu' && !r.hasMenu) return false;
    if (typeFilter === 'products' && !r.hasProducts) return false;
    if (typeFilter === 'both' && !(r.hasMenu && r.hasProducts)) return false;
    if (statusFilter === 'active' && r.hiddenFromDirectory) return false;
    if (statusFilter === 'suspended' && !r.hiddenFromDirectory) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="admin-scroll flex gap-1.5 overflow-x-auto pb-1">
        {COMPANY_SUBTABS.map(([v, l]) => (
          <button key={v} type="button" onClick={() => setSub(v)}
            className={`btn btn-sm min-h-11 shrink-0 ${sub === v ? 'btn-gold' : 'btn-ghost-vz'}`}>
            {t(l)}
          </button>
        ))}
      </div>

      {sub === 'requests' && <CompanyIdRequests />}
      {sub === 'overview' && <CompaniesOverview />}

      {sub === 'list' && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Nomi, NFC ID yoki egasi bo'yicha qidirish...")}
              className="vz-input min-w-0 flex-1 sm:max-w-xs" aria-label={t("Nomi, NFC ID yoki egasi bo'yicha qidirish...")} />
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="vz-input w-auto min-w-0" aria-label={t('Barcha tariflar')}>
              <option value="all">{t('Barcha tariflar')}</option>
              <option value="free">FREE</option>
              <option value="pro">PRO</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="vz-input w-auto min-w-0" aria-label={t('Barcha turlar')}>
              <option value="all">{t('Barcha turlar')}</option>
              <option value="menu">{t('Restoran menyusi')}</option>
              <option value="products">{t('Mahsulotlar katalogi')}</option>
              <option value="both">{t('Ikkalasi ham')}</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="vz-input w-auto min-w-0" aria-label={t('Barcha holatlar')}>
              <option value="all">{t('Barcha holatlar')}</option>
              <option value="active">{t('Faol')}</option>
              <option value="suspended">{t('Bloklangan')}</option>
            </select>
          </div>

          {loadErr && <LoadError err={loadErr} onRetry={load} title={t("Kompaniyalarni yuklab bo'lmadi.")} />}
          {!loadErr && !rows && <AdminLoading rows={6} />}
          {rows && filtered.length === 0 && <EmptyState icon="building" title={t('Hech qanday kompaniya topilmadi.')} hint={rows.length ? t("Filtrlarni o'zgartirib ko'ring.") : undefined} />}
          {rows && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>{t('Kompaniya')}</th>
                    <th>{t('Egasi')}</th>
                    <th>{t('Soha')}</th>
                    <th>{t('Menyu')}</th>
                    <th>{t('Mahsulotlar')}</th>
                    <th>{t('Tarif')}</th>
                    <th>{t('Holati')}</th>
                    <th>{t('Yaratildi')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, shown).map((r) => {
                    const menuStatus = companyModuleStatus(r.menuCatCount, r.menuItemCount);
                    const productStatus = companyModuleStatus(r.productCatCount, r.productItemCount);
                    return (
                      <tr key={r.code}>
                        <td className="break-words">
                          <div className="font-semibold">{r.name} {r.verified && <AdminIcon name="check" className="inline h-3.5 w-3.5 text-success" />}</div>
                          <div className="font-mono text-[13px] text-base-content/40">{r.code}</div>
                        </td>
                        <td className="text-xs">{r.ownerEmail || '—'}</td>
                        <td className="text-xs text-base-content/60">{catPath(cats, r.categorySlug, lang) || '—'}</td>
                        <td><StatusBadge tone={menuStatus.tone}>{t(menuStatus.text)}</StatusBadge></td>
                        <td><StatusBadge tone={productStatus.tone}>{t(productStatus.text)}</StatusBadge></td>
                        <td className="text-xs font-semibold">{t(TIER_LABEL[r.tier] || r.tier)}</td>
                        <td><StatusBadge tone={r.hiddenFromDirectory ? 'danger' : 'success'}>{r.hiddenFromDirectory ? t('Bloklangan') : t('Faol')}</StatusBadge></td>
                        <td className="whitespace-nowrap text-xs text-base-content/50">{timeAgo(r.ts)}</td>
                        <td><button className="btn btn-outline-gold btn-xs min-h-9" onClick={() => setOpenCode(r.code)}>{t('Batafsil')}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <LoadMore shown={Math.min(shown, filtered.length)} total={filtered.length} onMore={setShown} />
            </div>
          )}
        </div>
      )}

      {sub === 'pricing' && <CompanyPricingSubtab />}
      {sub === 'log' && <CompanyActivityLog />}

      {openCode && <CompanyDetailModal code={openCode} onClose={() => setOpenCode(null)} onChanged={load} />}
    </div>
  );
}

// Sidebar navigatsiyasi — index = haqiqiy TABS indeksi (content switch o'zgarmaydi).
const ADMIN_NAV = [
  { index: 0, label: 'Umumiy', icon: 'dashboard' },
  { index: 1, label: 'Statistika', icon: 'chart' },
  { index: 2, label: 'Foydalanuvchilar', icon: 'users' },
  { index: 19, label: 'Kompaniyalar', icon: 'building' },
  { index: 3, label: 'Buyurtmalar', icon: 'bag' },
  { index: 4, label: "To'lanishi kerak pullar", icon: 'wallet' },
  { index: 18, label: 'Moliya', icon: 'bank', superOnly: true },
  { index: 5, label: 'Auksionlar', icon: 'hammer' },
  { index: 6, label: "Auksion so'rovlari", icon: 'clipboard' },
  { index: 17, label: 'Talab', icon: 'flame' },
  { index: 7, label: 'Jismoniy kartalar', icon: 'idcard' },
  { index: 8, label: 'Bildirishnomalar', icon: 'bell' },
  { index: 9, label: 'Tashqi analitika', icon: 'activity' },
  { index: 12, label: 'Gift NFC ID', icon: 'gift' },
  { index: 13, label: 'Promokodlar', icon: 'tag' },
  { index: 14, label: 'Yangiliklar', icon: 'news' },
  { index: 15, label: 'Kategoriyalar', icon: 'folder' },
  { index: 16, label: 'Tasdiqlash', icon: 'check' },
  { index: 10, label: 'Security', icon: 'shield' },
  { index: 11, label: 'Adminlar', icon: 'usercheck', superOnly: true },
];

function Dashboard({ onLogout, role, totpEnabled, refreshMe }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState(0);
  const [secSub, setSecSub] = useState(null);
  const logout = async () => { try { await adminApi('/logout', { method: 'POST' }); } catch { /* baribir chiqamiz */ } onLogout(); };
  const isSuperAdmin = role === 'super_admin';
  const isManager = isSuperAdmin || role === 'manager';
  const nav = ADMIN_NAV.filter((n) => !n.superOnly || isSuperAdmin);
  const goTo = (index, sub) => { setSecSub(sub || null); setTab(index); };
  const ctx = { role, isSuper: isSuperAdmin, isManager, totpEnabled, refreshMe, goTo };

  const banner = totpEnabled === false ? (
    <WarnBanner action={<button type="button" className="btn btn-gold btn-sm h-9 min-h-9 px-4" onClick={() => goTo(10, '2fa')}>{t('2FA bo‘limiga o‘tish')}</button>}>
      {t('2FA yoqilmagan — xavfsizlik uchun yoqing')}
    </WarnBanner>
  ) : null;

  return (
    <AdminCtx.Provider value={ctx}>
    <AdminShell
      nav={nav}
      activeIndex={tab}
      onSelect={(i) => goTo(i)}
      title={t(TABS[tab] || 'Umumiy')}
      role={role}
      onLogout={logout}
      banner={banner}
    >
      <div className="min-w-0">
        {tab === 0 && <StatsTab />}
        {tab === 1 && <AnalyticsTab />}
        {tab === 2 && <UsersTab />}
        {tab === 3 && <OrdersTab />}
        {tab === 4 && <PendingPayoutsTab />}
        {tab === 5 && <AuctionsTab />}
        {tab === 6 && <AuctionRequestsTab />}
        {tab === 7 && <PhysicalCardsTab />}
        {tab === 8 && <NotificationsTab />}
        {tab === 9 && <ExternalAnalyticsTab />}
        {tab === 10 && <SecurityTab key={secSub || 'default'} initialSub={secSub} />}
        {tab === 11 && (isSuperAdmin ? <AdminsTab /> : <ForbiddenState />)}
        {tab === 12 && <GiftNfcIdTab />}
        {tab === 13 && <PromoCodesTab />}
        {tab === 14 && <NewsTab />}
        {tab === 15 && <CategoriesTab />}
        {tab === 16 && <VerificationTab />}
        {tab === 17 && <AuctionDemandTab />}
        {tab === 18 && (isSuperAdmin ? <FinanceTab /> : <ForbiddenState />)}
        {tab === 19 && <CompaniesTab />}
      </div>
    </AdminShell>
    </AdminCtx.Provider>
  );
}

export default function AdminPage() {
  const { t } = useLanguage();
  const [authed, setAuthed] = useState(undefined);
  const [role, setRole] = useState(null);
  const [totpEnabled, setTotpEnabled] = useState(null);
  const [expiredMsg, setExpiredMsg] = useState(null);

  const refreshMe = () => adminApi('/me').then((d) => {
    setAuthed(d.authenticated);
    setRole(d.role);
    setTotpEnabled(typeof d.totpEnabled === 'boolean' ? d.totpEnabled : null);
  });
  useEffect(() => {
    refreshMe().catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    const onExpired = (e) => {
      setExpiredMsg(e.detail === 'idle_timeout' ? t("Faoliyatsizlik tufayli sessiya tugadi (12 daqiqa). Qayta kiring.") : t("Sessiya tugadi. Qayta kiring."));
      setAuthed(false);
    };
    window.addEventListener('admin-session-expired', onExpired);
    return () => window.removeEventListener('admin-session-expired', onExpired);
  }, []);

  if (authed === undefined) {
    return (
      <main className="mx-auto w-full max-w-sm px-5 pt-16" style={{ color: 'var(--vz-ink-2)' }} aria-busy="true">
        <div className="vz-skel h-5 w-32" />
        <div className="vz-skel mt-4 h-11" />
        <div className="vz-skel mt-3 h-11" />
        <span className="sr-only">{t("Yuklanmoqda...")}</span>
      </main>
    );
  }
  if (!authed) return <AdminLogin onLoggedIn={() => { refreshMe().catch(() => setAuthed(false)); setExpiredMsg(null); }} expiredMsg={expiredMsg} />;
  return <Dashboard onLogout={() => setAuthed(false)} role={role} totpEnabled={totpEnabled} refreshMe={() => refreshMe().catch(() => {})} />;
}
