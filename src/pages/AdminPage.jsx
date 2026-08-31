import { useEffect, useState } from 'react';
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
import { AdminShell, AdminCard, KpiCard, StatusBadge, EmptyState, AdminLoading, chartGrid, chartAxis, chartTooltip } from '../components/admin/AdminUI.jsx';

async function adminApi(path, options) {
  const res = await fetch('/api/admin' + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) {
    // Sessiya tugagan (idle timeout yoki umuman tugagan) — global hodisa
    // orqali AdminPage'ni darhol login ekraniga qaytaramiz.
    window.dispatchEvent(new CustomEvent('admin-session-expired', { detail: data?.error }));
  }
  if (!res.ok) throw new Error((data && data.error) || 'api_error_' + res.status);
  return data;
}

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

  const submitCredentials = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const result = await adminApi('/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
      if (result.twoFactor) {
        setTempToken(result.tempToken);
        setStep('code');
      } else {
        onLoggedIn();
      }
    } catch (e2) {
      setErr(e2.message === 'admin_not_configured'
        ? t("Admin panel hali sozlanmagan (ADMIN_PANEL_PHONE / ADMIN_PANEL_PASSWORD env o'zgaruvchilarini qo'shing).")
        : e2.message === 'tg_send_failed'
          ? t("Telegram'ga kod yuborib bo'lmadi. ADMIN_CHAT_ID va bot sozlamalarini tekshiring.")
          : t('Login yoki parol xato.'));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminApi('/verify-2fa', { method: 'POST', body: JSON.stringify({ tempToken, code: code.trim() }) });
      onLoggedIn();
    } catch (e2) {
      setErr(e2.message === 'expired' ? t("Kod muddati o'tgan — qaytadan kiring.") : t("Kod noto'g'ri."));
      if (e2.message === 'expired') { setStep('credentials'); setCode(''); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-5">
      <div className="w-full rounded-2xl border border-white/10 bg-base-200/70 p-7">
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">NFCSTORE</div>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-2 text-2xl font-bold">{t("Admin panel")}</h1>
        {expiredMsg && <div className="alert alert-warning mt-3 py-2 text-xs"><span>{t(expiredMsg)}</span></div>}

        {step === 'credentials' ? (
          <form onSubmit={submitCredentials} className="mt-6 space-y-3">
            <label className="form-control">
              <span className="text-xs font-semibold text-base-content/70">{t("Telefon")}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567"
                className="input input-bordered mt-1 w-full bg-base-100" />
            </label>
            <label className="form-control">
              <span className="text-xs font-semibold text-base-content/70">{t("Parol")}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered mt-1 w-full bg-base-100" />
            </label>
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-sm"></span> : t('Kirish')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-6 space-y-3">
            <p className="text-sm text-base-content/60">
              {t("Telegram botga 6 xonali kod yuborildi. Kodni kiriting:")}
            </p>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" maxLength={6}
              className="input input-bordered w-full bg-base-100 text-center font-mono text-lg tracking-widest" autoFocus />
            <button className="btn btn-primary w-full" disabled={busy || code.length !== 6}>
              {busy ? <span className="loading loading-spinner loading-sm"></span> : t('Tasdiqlash')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => { setStep('credentials'); setCode(''); setErr(null); }}>{t('Orqaga')}</button>
          </form>
        )}
        {err && <div className="alert alert-error mt-4 py-2 text-sm"><span>{t(err)}</span></div>}
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
  useEffect(() => {
    adminApi('/stats').then(setStats).catch(() => {});
    adminApi('/platform-wallet').then((d) => setWallet(d.balance)).catch(() => {});
    adminApi('/analytics').then((d) => setSeries(d.commissionSeries || [])).catch(() => {});
  }, []);

  const exportExcel = async () => {
    if (range === 'custom' && (!customFrom || !customTo)) { alert(t('Boshlanish va tugash sanasini tanlang.')); return; }
    setExporting(true);
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
      a.download = `nfcstore_statistika_${range}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(t('Excel faylni yuklab bo\u2019lmadi.'));
    } finally {
      setExporting(false);
    }
  };

  if (!stats) return <AdminLoading />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-base-content/45">{t("Davr:")}</span>
          {[['today', 'Bugun'], ['7d', '7 kun'], ['30d', '30 kun'], ['month', 'Shu oy'], ['custom', 'Custom']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setRange(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${range === v ? 'bg-accent text-accent-content' : 'border border-white/10 text-base-content/60 hover:text-base-content'}`}
            >
              {t(l)}
            </button>
          ))}
          {range === 'custom' && (
            <span className="flex items-center gap-1">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input input-bordered input-xs bg-base-100" />
              <span className="text-xs text-base-content/40">{'\u2014'}</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input input-bordered input-xs bg-base-100" />
            </span>
          )}
        </div>
        <button className="btn btn-primary btn-sm gap-1.5" disabled={exporting} onClick={exportExcel}>
          {exporting ? <span className="loading loading-spinner loading-xs"></span> : <>{'\u{1F4E5}'} {t("Hisobot yuklab olish")}</>}
        </button>
      </div>

      <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-[#1b1509] via-[#121013] to-[#0d0d10] p-6">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-base-content/45">{t('Platforma daromadi (komissiyalar)')}</div>
            <div className="mt-2 text-[38px] font-extrabold leading-none tracking-tight text-accent">
              {wallet === null ? '\u2014' : fmt(wallet)} <span className="text-2xl">{t("so'm")}</span>
            </div>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-base-content/45">{t("Auksion va premium obuna komissiyalaridan yig'ilgan real pul.")}</p>
          </div>
          <div className="hidden h-24 lg:block">
            {series && series.length > 1 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                  <Line type="monotone" dataKey="total" stroke="#e8c165" strokeWidth={2} dot={false} />
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
                <Line type="monotone" dataKey="total" name={t('Komissiya')} stroke="#e8c165" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
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
  useEffect(() => { adminApi('/analytics').then(setData).catch(() => {}); }, []);
  if (!data) return <AdminLoading />;

  const breakdown = data.breakdown.map((b) => ({ ...b, label: t(KIND_LABEL[b.kind] || b.kind) }));

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
              <Line type="monotone" dataKey="total" name={t('Komissiya')} stroke="#e8c165" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
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
              <div key={b.kind} className="flex items-center justify-between gap-3 border-b border-white/[0.05] pb-2 text-sm last:border-0">
                <span className="flex items-center gap-2 text-base-content/70">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {b.label}
                </span>
                <span className="shrink-0 font-semibold">{fmt(b.total)} <span className="text-xs font-normal text-base-content/40">{t("so'm")}</span></span>
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
  useEffect(() => { adminApi('/manual-adjustments').then((d) => setList(d.adjustments)).catch(() => {}); }, []);
  if (!list || list.length === 0) return null;
  const total = list.reduce((s, a) => s + a.amount, 0);
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold">
        {'\u26A0\uFE0F'} {t("Qo'lda kiritilgan balans tuzatishlari")}
        <span className="badge badge-ghost badge-sm">{t('Daromadga kirmaydi')}</span>
      </div>
      <p className="mt-1 text-xs text-base-content/45">
        {t("Bu yozuvlar xodim tomonidan qo'lda kiritilgan (masalan sinov maqsadida) — real savdo/komissiya emas, shuning uchun yuqoridagi daromad grafigiga qo'shilmaydi. Jami:")} <b className={total >= 0 ? 'text-success' : 'text-error'}>{fmt(total)} so'm</b>.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>{t('Foydalanuvchi')}</th><th>{t('Summa')}</th><th>{t('Izoh')}</th><th>{t('Vaqt')}</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="text-xs">{a.email || `#${a.userId}`}</td>
                <td className={`font-semibold ${a.amount >= 0 ? 'text-success' : 'text-error'}`}>{a.amount >= 0 ? '+' : ''}{fmt(a.amount)} {t("so'm")}</td>
                <td className="max-w-xs truncate text-xs text-base-content/60">{a.note}</td>
                <td className="text-xs text-base-content/50">{timeAgo(new Date(a.createdAt).getTime())}</td>
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
  const [users, setUsers] = useState(null);
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

  const load = () => adminApi('/users').then((d) => setUsers(d.users));
  useEffect(() => { load(); }, []);

  const toggleTest = async (u) => {
    setToggleBusy(u.id);
    try { await adminApi(`/users/${u.id}/set-test`, { method: 'POST', body: JSON.stringify({ isTest: !u.isTest }) }); await load(); }
    finally { setToggleBusy(null); }
  };

  const submitSuspend = async (userId) => {
    setModBusy(userId);
    try {
      await adminApi(`/users/${userId}/suspend`, { method: 'POST', body: JSON.stringify({ days: Number(suspendDays), reason: suspendReason }) });
      setSuspendFor(null);
      await load();
    } finally {
      setModBusy(null);
    }
  };
  const unsuspend = async (u) => {
    setModBusy(u.id);
    try { await adminApi(`/users/${u.id}/unsuspend`, { method: 'POST' }); await load(); } finally { setModBusy(null); }
  };
  const deleteUser = async (u) => {
    if (!confirm(t('{email} akkauntini BUTUNLAY va qaytarib bo\'lmaydigan tarzda o\'chirasizmi? Barcha ma\'lumoti (NFC ID profillari, tranzaksiyalar, xabarlar) o\'chiriladi. Shu email keyin qayta ro\'yxatdan o\'tish uchun bo\'shaydi.', { email: u.email }))) return;
    setModBusy(u.id);
    try { await adminApi(`/users/${u.id}/delete`, { method: 'POST' }); await load(); } finally { setModBusy(null); }
  };

  const submitAdjust = async () => {
    const val = Math.round(Number(amount));
    if (!val) return;
    setBusy(true);
    try {
      await adminApi(`/users/${adjustFor}/adjust-balance`, { method: 'POST', body: JSON.stringify({ amount: val, note }) });
      setAdjustFor(null); setAmount(''); setNote('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!users) return <AdminLoading />;
  const query = q.trim().toLowerCase();
  const filtered = !query ? users : users.filter((u) =>
    (u.email || '').toLowerCase().includes(query) ||
    (u.codes || []).some((c) => c.toLowerCase().includes(query))
  );
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("Email yoki NFC ID bo'yicha qidirish...")}
        className="input input-bordered input-sm mb-3 w-full max-w-sm bg-base-100"
      />
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr><th className="w-8 text-base-content/40">#</th><th>Email</th><th>{t('Telefon')}</th><th>{t('Bot')}</th><th>{t('Balans')}</th><th>{t('Bandlangan')}</th><th>{t('Kartalar')}</th><th>{t("Ro'yxatdan o'tgan")}</th><th></th></tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={9} className="py-6 text-center text-base-content/45">{t("Hech narsa topilmadi.")}</td></tr>
          )}
          {filtered.map((u, i) => (
            <tr key={u.id} className={u.isTest ? 'opacity-50' : ''}>
              <td className="text-xs tabular-nums text-base-content/40">{i + 1}</td>
              <td>
                {u.email} {u.isTest && <span className="badge badge-ghost badge-xs ml-1">{t("SINOV")}</span>}
                {u.deletedAt && <span className="badge badge-error badge-xs ml-1">{t("O'CHIRILGAN")}</span>}
                {!u.deletedAt && u.suspendedUntil && new Date(u.suspendedUntil) > new Date() && (
                  <div className="mt-0.5 text-[10px] text-error">{t('Bloklangan:')} {t(u.suspendReason)} ({timeAgo(new Date(u.suspendedUntil).getTime())} {t('gacha')})</div>
                )}
              </td>
              <td className="font-mono text-xs">{u.phone || '—'}</td>
              <td>{u.botAck ? '\u2705' : '\u274C'}</td>
              <td className="font-semibold">{fmt(u.balance)}</td>
              <td className="text-base-content/50">{fmt(u.heldBalance)}</td>
              <td>{u.cardCount}</td>
              <td className="text-xs text-base-content/50">{timeAgo(new Date(u.createdAt).getTime())}</td>
              <td className="flex flex-wrap gap-1">
                <button className="btn btn-ghost btn-xs" onClick={() => setAdjustFor(u.id)}>{t('Balansni tuzatish')}</button>
                <button className="btn btn-ghost btn-xs" disabled={toggleBusy === u.id} onClick={() => toggleTest(u)}>
                  {u.isTest ? t('Sinovdan chiqarish') : t("Sinov deb belgilash")}
                </button>
                {!u.deletedAt && (
                  u.suspendedUntil && new Date(u.suspendedUntil) > new Date() ? (
                    <button className="btn btn-success btn-xs" disabled={modBusy === u.id} onClick={() => unsuspend(u)}>{t('Blokdan chiqarish')}</button>
                  ) : (
                    <button className="btn btn-warning btn-xs" onClick={() => setSuspendFor(suspendFor === u.id ? null : u.id)}>{t('Bloklash')}</button>
                  )
                )}
                {!u.deletedAt && (
                  <button className="btn btn-error btn-xs" disabled={modBusy === u.id} onClick={() => deleteUser(u)}>{t("O'chirish")}</button>
                )}
                {suspendFor === u.id && (
                  <div className="mt-2 flex w-full flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 p-2">
                    <select value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} className="select select-bordered select-xs bg-base-100">
                      <option>{t('Diniy-ekstremistik kontent')}</option>
                      <option>{t('Litsenziyasiz diniy material tarqatish')}</option>
                      <option>{t('Uyatsiz/odobsiz kontent')}</option>
                      <option>{t('Ruxsatsiz shaxsiy rasm tarqatish')}</option>
                      <option>{t('Spam')}</option>
                      <option>{t('Boshqa foydalanuvchiga tahdid')}</option>
                      <option>{t('Boshqa qoidabuzarlik')}</option>
                    </select>
                    <input type="number" value={suspendDays} onChange={(e) => setSuspendDays(e.target.value)} placeholder={t("Kun")} className="input input-bordered input-xs w-16 bg-base-100" />
                    <button className="btn btn-warning btn-xs" disabled={modBusy === u.id} onClick={() => submitSuspend(u.id)}>{t('Tasdiqlash')}</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adjustFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAdjustFor(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-base-200 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold">{t("Balansni qo'lda tuzatish")}</div>
            <p className="mt-1 text-xs text-base-content/50">{t("Musbat son — qo'shadi, manfiy son — ayiradi. Har doim audit jurnaliga yoziladi.")}</p>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("masalan 50000 yoki -20000")}
              className="input input-bordered input-sm mt-3 w-full bg-base-100" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Sabab (masalan: qo'lda Payme tasdiqlandi)")}
              className="input input-bordered input-sm mt-2 w-full bg-base-100" />
            <div className="mt-3 flex gap-2">
              <button className="btn btn-primary btn-sm flex-1" onClick={submitAdjust} disabled={busy}>
                {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Tasdiqlash')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAdjustFor(null)}>{t('Bekor')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
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

function OrdersTab() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = () => adminApi('/orders').then((d) => setOrders(d.orders));
  useEffect(() => { load(); }, []);

  const confirmPayment = async (o) => {
    if (!confirm(t("To'lovni qo'lda tasdiqlaysizmi? Bu haqiqiy to'lov kelganini o'zingiz tekshirganingizni bildiradi."))) return;
    setBusy(o.id);
    try {
      const path = o.source === 'bot' ? `/bot-orders/${o.id}/confirm-payment` : `/orders/${o.id}/confirm-payment`;
      await adminApi(path, { method: 'POST' });
      await load();
    }
    catch { alert(t("Tasdiqlab bo'lmadi — buyurtma allaqachon ishlangan yoki topilmadi.")); }
    finally { setBusy(null); }
  };

  if (!orders) return <AdminLoading />;
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>{t('Manba')}</th><th>{t('Kod')}</th><th>{t('Foydalanuvchi')}</th><th>{t('Narx')}</th><th>{t('Holat')}</th><th>{t('Vaqt')}</th><th></th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.source + o.id}>
              <td><span className="badge badge-ghost badge-sm">{o.source === 'web' ? t('Sayt') : t('Bot')}</span></td>
              <td className="font-mono">{o.code}</td>
              <td className="text-xs">{o.source === 'bot' ? (o.tgUsername ? '@' + o.tgUsername : o.tgName) : ('#' + o.userId)}</td>
              <td>{fmt(o.amount)}</td>
              <td>{(() => { const st = ORDER_STATUS_LABEL[o.status] || { text: `Noma'lum holat (${o.status})`, cls: 'badge-ghost' }; return <span className={`badge badge-sm ${st.cls}`}>{t(st.text)}</span>; })()}</td>
              <td className="text-xs text-base-content/50">{timeAgo(new Date(o.createdAt).getTime())}</td>
              <td>
                {o.status === 'pending' && (
                  <button className="btn btn-ghost btn-xs" disabled={busy === o.id} onClick={() => confirmPayment(o)}>
                    {busy === o.id ? <span className="loading loading-spinner loading-xs"></span> : t("Qo'lda tasdiqlash")}
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

// Foydalanuvchilardan "noyob nomni auksionga qo'ying" so'rovlari.
function AuctionRequestsTab() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => adminApi('/auction-requests').then((d) => setRequests(d.requests));
  useEffect(() => { load(); }, []);

  const reject = async (id) => {
    if (!confirm(t("Bu so'rovni rad etasizmi?"))) return;
    setBusy(id);
    try { await adminApi(`/auction-requests/${id}/reject`, { method: 'POST' }); await load(); } finally { setBusy(null); }
  };

  // Tasdiqlash \u2192 so'rov "Talab" board'iga qo'shiladi (auksion YARATILMAYDI).
  const approve = async (id) => {
    setBusy(id);
    setMsg(null);
    try {
      await adminApi(`/auction-requests/${id}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message === 'code_taken' ? t('Bu kod allaqachon band bo\u2019lib qolgan.') : t('Xatolik yuz berdi.') });
    } finally {
      setBusy(null);
    }
  };

  if (!requests) return <AdminLoading />;
  if (requests.length === 0) return <EmptyState icon="clipboard" title={t("Hozircha so'rov yo'q.")} hint={t("Foydalanuvchilar yuborgan auksion so'rovlari shu yerda ko'rinadi.")} />;
  return (
    <div className="space-y-3">
      {msg && <div className={`alert py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
      <p className="text-xs text-base-content/45">{t("Tasdiqlangan so'rov \u201CTalab\u201D bo'limiga tushadi. Auksion 20 kishi qiziqib, siz \u201CAuksionni boshlash\u201D bosganda ochiladi.")}</p>
      {requests.map((r) => (
        <div key={r.id} className="rounded-2xl border border-white/10 bg-base-200/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono text-sm font-bold">{r.code}</div>
              <div className="text-xs text-base-content/50">
                {r.userCode ? (
                  <a href={'/' + r.userCode} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{r.userEmail}</a>
                ) : r.userEmail}
                {' \u2014 '}{timeAgo(new Date(r.createdAt).getTime())}
              </div>
              {r.note && <p className="mt-1 text-xs text-base-content/60">{'\u201C'}{r.note}{'\u201D'}</p>}
            </div>
            <div className="flex gap-1">
              <button className="btn btn-success btn-xs" disabled={busy === r.id} onClick={() => approve(r.id)}>
                {busy === r.id ? <span className="loading loading-spinner loading-xs"></span> : t("Tasdiqlab, Talab'ga qo'shish")}
              </button>
              <button className="btn btn-ghost btn-xs text-error" disabled={busy === r.id} onClick={() => reject(r.id)}>{t('Rad etish')}</button>
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
  const [payouts, setPayouts] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = () => adminApi('/pending-payouts').then((d) => setPayouts(d.payouts));
  useEffect(() => { load(); }, []);

  const clear = async (userId, amount) => {
    if (!confirm(t("{n} so'mni qo'lda to'laganingizni tasdiqlaysizmi?", { n: fmt(amount) }))) return;
    setBusy(userId);
    try { await adminApi(`/pending-payouts/${userId}/clear`, { method: 'POST', body: JSON.stringify({ amount }) }); await load(); } finally { setBusy(null); }
  };

  if (!payouts) return <AdminLoading />;
  if (payouts.length === 0) return <EmptyState icon="wallet" title={t("Hozircha hech kimga to'lanishi kerak bo'lgan pul yo'q.")} />;
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>Email</th><th>{t('Telefon')}</th><th>{t("To'lanishi kerak")}</th><th></th></tr></thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td>{p.email}</td>
              <td className="font-mono text-xs">{p.phone || '—'}</td>
              <td className="font-semibold">{fmt(p.pendingPayout)} {t("so'm")}</td>
              <td>
                <button className="btn btn-success btn-xs" disabled={busy === p.id} onClick={() => clear(p.id, p.pendingPayout)}>
                  {t("To'landi deb belgilash")}
                </button>
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
      setMsg({ type: 'err', text: err.message === 'code_taken' ? t('Bu kod allaqachon band.') : err.message === 'already_in_auction' ? t('Bu kod allaqachon auksionda.') : t('Xatolik yuz berdi.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-accent/25 bg-gradient-to-br from-[#1a1509] via-[#121013] to-[#101013] p-5">
      <div className="text-sm font-bold text-accent">{'\u{1F528}'} {t('Yangi auksion ochish')}</div>
      <p className="mt-1 text-xs text-base-content/45">{t("Faqat hali hech kimga tegishli bo'lmagan (bo'sh) kodlar uchun.")}</p>
      <div className="mt-3.5 grid gap-3 sm:grid-cols-4">
        <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder={t("Kod (VIP001)")} className="input input-bordered input-sm bg-base-100 font-mono" />
        <input type="number" value={form.startPrice} onChange={(e) => setForm((f) => ({ ...f, startPrice: e.target.value }))} placeholder={t("Boshlang'ich narx")} className="input input-bordered input-sm bg-base-100" />
        <input type="number" value={form.buyNowPrice} onChange={(e) => setForm((f) => ({ ...f, buyNowPrice: e.target.value }))} placeholder={t("Darhol sotib olish (ixt.)")} className="input input-bordered input-sm bg-base-100" />
        <input type="number" max={72} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder={t("Soat (maks. 72)")} className="input input-bordered input-sm bg-base-100" />
      </div>
      <button className="btn btn-primary btn-sm mt-3" onClick={submit} disabled={busy}>
        {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Auksion ochish')}
      </button>
      {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
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
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ code: '', startPrice: '250000', minStep: '25000' });
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [startId, setStartId] = useState(null);
  const [startForm, setStartForm] = useState({ startPrice: '', buyNowPrice: '', minStep: '', hours: '24' });

  const load = () => adminApi('/auction-demand').then((d) => setRows(d.demand));
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
      setMsg({ type: 'err', text: err.message === 'code_taken' ? t('Bu kod allaqachon band.') : err.message === 'already_exists' ? t('Bu kod board‘da bor.') : t('Xatolik yuz berdi.') });
    } finally { setBusy(null); }
  };

  const patch = async (id, body) => {
    setBusy(id);
    try { await adminApi(`/auction-demand/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); await load(); }
    finally { setBusy(null); }
  };

  const del = async (id) => {
    if (!confirm(t('Bu kodni board‘dan o‘chirasizmi?'))) return;
    setBusy(id);
    try { await adminApi(`/auction-demand/${id}`, { method: 'DELETE' }); await load(); }
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
      setMsg({ type: 'err', text: err.message === 'code_taken' ? t('Bu kod allaqachon band.') : err.message === 'already_in_auction' ? t('Bu kod allaqachon auksionda.') : t('Xatolik yuz berdi.') });
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-[#1a1509] via-[#121013] to-[#101013] p-5">
        <div className="text-sm font-bold text-accent">{'\u{1F525}'} {t('Board‘ga kod qo‘shish')}</div>
        <p className="mt-1 text-xs text-base-content/45">
          {t("Tavsiya boshlang'ich narx: oddiy 250 000 · kuchli 500 000 · juda noyob 1 000 000+. Qadam: 25 000 / 50 000 / 100 000.")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder={t('Kod (VIP007)')} className="input input-bordered input-sm bg-base-100 font-mono" />
          <input type="number" value={form.startPrice} onChange={(e) => setForm((f) => ({ ...f, startPrice: e.target.value }))} placeholder={t("Boshlang'ich narx")} className="input input-bordered input-sm bg-base-100" />
          <input type="number" value={form.minStep} onChange={(e) => setForm((f) => ({ ...f, minStep: e.target.value }))} placeholder={t('Minimal qadam')} className="input input-bordered input-sm bg-base-100" />
          <button className="btn btn-primary btn-sm" onClick={add} disabled={busy === 'add'}>
            {busy === 'add' ? <span className="loading loading-spinner loading-xs"></span> : t('Qo‘shish')}
          </button>
        </div>
        {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
      </div>

      {!rows ? <AdminLoading />
        : rows.length === 0 ? <EmptyState icon="flame" title={t('Board bo‘sh.')} hint={t('Yuqoridan kod qo‘shing.')} />
        : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-base-200/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-sm font-bold">{r.code}</span>
                  <span className="ml-2 inline-flex align-middle">
                    <StatusBadge tone={r.status === 'ready' ? 'success' : r.status === 'auction_live' ? 'accent' : 'muted'}>
                      {t(DEMAND_STATUS_LABEL[r.status] || r.status)}
                    </StatusBadge>
                  </span>
                  <span className="ml-2 text-xs text-base-content/50">{'\u{1F525}'} {r.interestCount} / {r.threshold}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(r.status === 'ready' || r.status === 'collecting') && (
                    <button className="btn btn-primary btn-xs" onClick={() => { setStartId(startId === r.id ? null : r.id); setStartForm({ startPrice: String(r.suggestedStartPrice), buyNowPrice: '', minStep: String(r.suggestedMinStep), hours: '24' }); }}>
                      {t('Auksionni boshlash')}
                    </button>
                  )}
                  {r.status !== 'hidden'
                    ? <button className="btn btn-ghost btn-xs" disabled={busy === r.id} onClick={() => patch(r.id, { status: 'hidden' })}>{t('Yashirish')}</button>
                    : <button className="btn btn-ghost btn-xs" disabled={busy === r.id} onClick={() => patch(r.id, { status: 'collecting' })}>{t('Ko‘rsatish')}</button>}
                  <button className="btn btn-ghost btn-xs text-error" disabled={busy === r.id} onClick={() => del(r.id)}>{t('O‘chirish')}</button>
                </div>
              </div>
              {startId === r.id && (
                <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-4">
                  <input type="number" value={startForm.startPrice} onChange={(e) => setStartForm((f) => ({ ...f, startPrice: e.target.value }))} placeholder={t("Boshlang'ich narx")} className="input input-bordered input-sm bg-base-100" />
                  <input type="number" value={startForm.buyNowPrice} onChange={(e) => setStartForm((f) => ({ ...f, buyNowPrice: e.target.value }))} placeholder={t("Darhol sotib olish (ixt.)")} className="input input-bordered input-sm bg-base-100" />
                  <input type="number" value={startForm.minStep} onChange={(e) => setStartForm((f) => ({ ...f, minStep: e.target.value }))} placeholder={t('Minimal qadam')} className="input input-bordered input-sm bg-base-100" />
                  <input type="number" max={72} value={startForm.hours} onChange={(e) => setStartForm((f) => ({ ...f, hours: e.target.value }))} placeholder={t('Soat')} className="input input-bordered input-sm bg-base-100" />
                  <button className="btn btn-primary btn-sm sm:col-span-4" disabled={busy === r.id} onClick={() => startAuction(r)}>
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
  const [auctions, setAuctions] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => adminApi('/auctions').then((d) => setAuctions(d.auctions));
  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!confirm(t("Bu auksionni bekor qilishni tasdiqlaysizmi? Barcha bandlangan mablag'lar bo'shatiladi."))) return;
    setBusy(id);
    try { await adminApi(`/auctions/${id}/cancel`, { method: 'POST' }); await load(); } finally { setBusy(null); }
  };
  const forceSettle = async (id) => {
    if (!confirm(t("Bu auksionni muddatidan oldin yakunlashni tasdiqlaysizmi?"))) return;
    setBusy(id);
    try { await adminApi(`/auctions/${id}/force-settle`, { method: 'POST' }); await load(); } finally { setBusy(null); }
  };
  const confirmPayment = async (id) => {
    if (!confirm(t("G'olibning to'lovini QO'LDA tasdiqlaysizmi? Haqiqiy pul kelganini o'zingiz tekshirganingizni bildiradi — auksion yakunlanadi va NFC ID g'olibga o'tadi."))) return;
    setBusy(id);
    try { await adminApi(`/auctions/${id}/confirm-payment`, { method: 'POST' }); await load(); }
    catch (e) { alert(e.message === 'api_error_409' ? t("Bu auksion uchun kutilayotgan to'lov buyurtmasi yo'q (g'olib hali \"To'lash\" bosmagan yoki allaqachon ishlangan).") : t('Xatolik yuz berdi.')); }
    finally { setBusy(null); }
  };

  if (!auctions) return <AdminLoading />;
  return (
    <div>
      <CreateAuctionForm onCreated={load} />
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
              <td className="text-xs text-base-content/50">{dateTime(new Date(a.endsAt).getTime())}</td>
              <td>
                {a.status === 'active' && (
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-xs" disabled={busy === a.id} onClick={() => forceSettle(a.id)}>{t('Yakunlash')}</button>
                    <button className="btn btn-ghost btn-xs text-error" disabled={busy === a.id} onClick={() => cancel(a.id)}>{t('Bekor qilish')}</button>
                  </div>
                )}
                {a.status === 'awaiting_payment' && (
                  <div className="flex gap-1">
                    <button className="btn btn-success btn-xs" disabled={busy === a.id} onClick={() => confirmPayment(a.id)}>
                      {busy === a.id ? <span className="loading loading-spinner loading-xs"></span> : t("To'lovni tasdiqlash")}
                    </button>
                    <button className="btn btn-ghost btn-xs text-error" disabled={busy === a.id} onClick={() => cancel(a.id)}>{t('Bekor qilish')}</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
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
        className="flex items-center gap-4 rounded-2xl border border-white/10 bg-base-200/50 p-5 transition hover:border-white/25 hover:bg-base-200"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5">
          <svg width="28" height="28" viewBox="0 0 24 24"><path fill="#F9AB00" d="M22 21h-4V3h4v18zM14 21h-4v-9h4v9zM6 21H2v-5h4v5z"/></svg>
        </div>
        <div>
          <div className="font-bold">Google Analytics</div>
          <p className="mt-0.5 text-xs text-base-content/50">{t("Tashrif, manba (Telegram/Instagram/Google), sotuv voronkasi va tushum")}</p>
        </div>
      </a>
      <a
        href="https://metrika.yandex.ru/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 rounded-2xl border border-white/10 bg-base-200/50 p-5 transition hover:border-white/25 hover:bg-base-200"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5">
          <svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#FF3333"/><text x="12" y="17" fontSize="14" fontWeight="bold" fill="#fff" textAnchor="middle">Y</text></svg>
        </div>
        <div>
          <div className="font-bold">Yandex Metrika / Webvisor</div>
          <p className="mt-0.5 text-xs text-base-content/50">{t("Foydalanuvchi harakati, bosilgan tugmalar, UX tahlili")}</p>
        </div>
      </a>
      <div className="sm:col-span-2 rounded-xl border border-dashed border-white/15 p-4 text-xs text-base-content/50">
        <b className="text-base-content/70">{t('UTM manbalarni kuzatish:')}</b> reklama havolalariga <code className="rounded bg-black/30 px-1">?utm_source=telegram</code>, <code className="rounded bg-black/30 px-1">?utm_source=instagram</code> yoki <code className="rounded bg-black/30 px-1">?utm_source=google</code> {t("qo'shing — shunda GA/Yandex'da har bir manbadan kelgan tashrif → ro'yxatdan o'tish → buyurtma → to'lov zanjirini alohida solishtirasiz.")}
      </div>
    </div>
  );
}

// Security → Login History (2FA, IP whitelist, Activity Log kabi
// qolgan bo'limlar hozircha rejalashtirilgan — bu birinchi qismi).
function SecurityTab() {
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState('login'); // login | activity | ip
  const [history, setHistory] = useState(null);
  const [activity, setActivity] = useState(null);
  const [ipData, setIpData] = useState(null);
  const [newIp, setNewIp] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [ipBusy, setIpBusy] = useState(false);
  const [ipMsg, setIpMsg] = useState(null);

  const loadIp = () => adminApi('/ip-whitelist').then(setIpData);

  useEffect(() => {
    if (subTab === 'login' && !history) adminApi('/login-history').then((d) => setHistory(d.history));
    if (subTab === 'activity' && !activity) adminApi('/activity-log').then((d) => setActivity(d.log));
    if (subTab === 'ip' && !ipData) loadIp();
  }, [subTab]);

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
      setIpMsg(e.message === 'MAX_2' ? t("Faqat 2 ta IP qo'shish mumkin.") : e.message === 'ALREADY_EXISTS' ? t('Bu IP allaqachon ro\u2019yxatda.') : t('Xatolik yuz berdi.'));
    } finally {
      setIpBusy(false);
    }
  };
  const removeIp = async (id) => {
    setIpBusy(true);
    try { await adminApi(`/ip-whitelist/${id}/remove`, { method: 'POST' }); await loadIp(); } finally { setIpBusy(false); }
  };
  const toggleEnabled = async () => {
    setIpBusy(true);
    setIpMsg(null);
    try {
      await adminApi('/ip-whitelist/toggle', { method: 'POST', body: JSON.stringify({ enabled: !ipData.enabled }) });
      await loadIp();
    } catch (e) {
      setIpMsg(e.message === 'no_ips' ? t("Avval kamida 1 ta IP qo'shing.") : t('Xatolik yuz berdi.'));
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

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button className={`btn btn-sm ${subTab === 'login' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSubTab('login')}>Login History</button>
        <button className={`btn btn-sm ${subTab === 'activity' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSubTab('activity')}>Activity Log</button>
        <button className={`btn btn-sm ${subTab === 'ip' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSubTab('ip')}>IP Whitelist</button>
      </div>

      {subTab === 'login' ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="table table-sm">
            <thead><tr><th>{t('Hodisa')}</th><th>IP</th><th>{t('Qurilma')}</th><th>{t('Vaqt')}</th></tr></thead>
            <tbody>
              {!history && <tr><td colSpan={4} className="py-6 text-center text-base-content/45">{t("Yuklanmoqda...")}</td></tr>}
              {history?.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-base-content/45">{t("Hozircha yozuv yo'q.")}</td></tr>}
              {history?.map((h) => {
                const ev = EVENT_LABEL[h.event] || { text: h.event, cls: 'badge-ghost' };
                return (
                  <tr key={h.id}>
                    <td><span className={`badge badge-sm ${ev.cls}`}>{ev.text}</span></td>
                    <td className="font-mono text-xs">{h.ip || '—'}</td>
                    <td className="max-w-[220px] truncate text-xs text-base-content/50">{h.userAgent || '—'}</td>
                    <td className="text-xs text-base-content/50">{timeAgo(new Date(h.createdAt).getTime())}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="table table-sm">
            <thead><tr><th>{t('Amal')}</th><th>{t('Tafsilot')}</th><th>{t('Qiymat')}</th><th>{t('Vaqt')}</th></tr></thead>
            <tbody>
              {!activity && <tr><td colSpan={4} className="py-6 text-center text-base-content/45">{t("Yuklanmoqda...")}</td></tr>}
              {activity?.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-base-content/45">{t("Hozircha yozuv yo'q.")}</td></tr>}
              {activity?.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold">{t(ACTION_LABEL[a.action] || a.action)}</td>
                  <td className="text-xs text-base-content/60">{a.details || '—'}</td>
                  <td className="text-xs text-base-content/50">{a.newValue || '—'}</td>
                  <td className="text-xs text-base-content/50">{timeAgo(new Date(a.createdAt).getTime())}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-[11px] text-base-content/35">{t("Bu jurnal oddiy admin tomonidan o'chirilmaydi.")}</p>
        </div>
      )}

      {subTab === 'ip' && (
        !ipData ? <AdminLoading /> : (
          <div className="rounded-2xl border border-white/10 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">IP Whitelist: {ipData.enabled ? <span className="text-success">{t('YOQILGAN')}</span> : <span className="text-base-content/50">{t("O'CHIRILGAN")}</span>}</div>
                <p className="mt-1 text-xs text-base-content/50">{t('Sizning hozirgi IP:')} <code className="rounded bg-black/30 px-1">{ipData.yourIp}</code></p>
              </div>
              <button className={`btn btn-sm ${ipData.enabled ? 'btn-error' : 'btn-success'}`} disabled={ipBusy} onClick={toggleEnabled}>
                {ipData.enabled ? t("O'chirish") : t('Yoqish')}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {ipData.ips.length === 0 && <p className="text-xs text-base-content/40">{t("Hali IP qo'shilmagan.")}</p>}
              {ipData.ips.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
                  <span><code className="font-mono">{r.ip}</code> {r.label && <span className="text-xs text-base-content/45">— {r.label}</span>}</span>
                  <button className="btn btn-ghost btn-xs text-error" disabled={ipBusy} onClick={() => removeIp(r.id)}>{t("O'chirish")}</button>
                </div>
              ))}
            </div>

            {ipData.ips.length < 2 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder={t("IP manzil (masalan 91.212.4.10)")} className="input input-bordered input-sm flex-1 bg-base-100 font-mono" />
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t("Nom (ixtiyoriy, masalan: Ofis)")} className="input input-bordered input-sm flex-1 bg-base-100" />
                <button className="btn btn-primary btn-sm" disabled={ipBusy} onClick={addIp}>{t("Qo'shish")}</button>
              </div>
            )}
            {ipMsg && <div className="alert alert-error mt-3 py-2 text-xs"><span>{t(ipMsg)}</span></div>}

            <div className="mt-5 rounded-lg border border-dashed border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              {'\u26A0\uFE0F'} <b>{t('Xavfsiz tiklash:')}</b> {t("agar o'zingiz (dinamik IP tufayli) bloklanib qolsangiz, Railway loyihangizda ADMIN_IP_WHITELIST_BYPASS=true muhit o'zgaruvchisini qo'shing — bu whitelist'ni vaqtincha chetlab o'tadi. Kirib, IP'ni yangilagach, bu o'zgaruvchini albatta o'chirib qo'ying.")}
            </div>
          </div>
        )
      )}

      <div className="mt-6 rounded-xl border border-dashed border-white/15 p-4 text-xs text-base-content/45">
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

  const load = () => adminApi('/admins').then((d) => setAdmins(d.admins));
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
      setMsg(e.message === 'phone_taken' ? t('Bu telefon raqami allaqachon mavjud.') : t('Xatolik yuz berdi.'));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    if (!confirm(t("Bu adminni o'chirasizmi?"))) return;
    setBusy(true);
    try { await adminApi(`/admins/${id}/remove`, { method: 'POST' }); await load(); } finally { setBusy(false); }
  };

  if (!admins) return <AdminLoading />;

  return (
    <div>
      <button className="btn btn-primary btn-sm" onClick={() => setOpen((o) => !o)}>{'\u2795'} {t("Yangi admin qo'shish")}</button>
      {open && (
        <div className="mt-3 flex max-w-lg flex-wrap gap-2 rounded-xl border border-white/10 bg-base-200/50 p-3">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" className="input input-bordered input-sm flex-1 bg-base-100" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Ism")} className="input input-bordered input-sm flex-1 bg-base-100" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("Parol (kamida 6 belgi)")} className="input input-bordered input-sm flex-1 bg-base-100" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="select select-bordered select-sm bg-base-100">
            <option value="manager">Manager</option>
            <option value="content_manager">Content Manager</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <button className="btn btn-primary btn-sm w-full" disabled={busy} onClick={add}>{t("Qo'shish")}</button>
          {msg && <div className="alert alert-error w-full py-2 text-xs"><span>{t(msg)}</span></div>}
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="table table-sm">
          <thead><tr><th>{t('Telefon')}</th><th>{t('Ism')}</th><th>{t('Rol')}</th><th></th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.phone}</td>
                <td>{a.name || '—'}</td>
                <td><span className="badge badge-ghost badge-sm">{ROLE_LABEL[a.role] || a.role}</span></td>
                <td><button className="btn btn-ghost btn-xs text-error" onClick={() => remove(a.id)}>{t("O'chirish")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-base-content/45">
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

  const load = () => adminApi('/support-messages').then((d) => setMessages(d.messages));
  useEffect(() => { load(); }, []);

  const sendReply = async (id) => {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      await adminApi(`/support-messages/${id}/reply`, { method: 'POST', body: JSON.stringify({ reply: replyText.trim() }) });
      setReplyFor(null);
      setReplyText('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!messages) return <AdminLoading />;
  if (messages.length === 0) return <EmptyState icon="bell" title={t("Hozircha murojaat yo'q.")} />;
  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <div key={m.id} className={`rounded-2xl border p-4 ${m.status === 'pending' ? 'border-warning/40 bg-warning/5' : 'border-white/10 bg-base-200/50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-base-content/50">
              {m.userCode ? (
                <a href={'/' + m.userCode} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{m.userEmail}</a>
              ) : m.userEmail}
              {' \u2014 '}{timeAgo(new Date(m.createdAt).getTime())}
            </div>
            {m.status === 'pending' && <span className="badge badge-warning badge-sm">{t('Kutilmoqda')}</span>}
          </div>
          <p className="mt-2 text-sm">{m.message}</p>
          {m.reply && <p className="mt-2 rounded-lg bg-accent/10 p-2 text-sm text-accent"><b>{t('Javobingiz:')}</b> {m.reply}</p>}
          {m.status === 'pending' && (
            replyFor === m.id ? (
              <div className="mt-3 flex gap-2">
                <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={t("Javob yozing...")} className="input input-bordered input-sm flex-1 bg-base-100" />
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => sendReply(m.id)}>{t('Yuborish')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setReplyFor(null)}>{t('Bekor')}</button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-xs mt-2" onClick={() => { setReplyFor(m.id); setReplyText(''); }}>{t('Javob berish')}</button>
            )
          )}
        </div>
      ))}
    </div>
  );
}

function PhysicalCardsTab() {
  const { t } = useLanguage();
  const [cards, setCards] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = () => adminApi('/physical-cards').then((d) => setCards(d.cards));
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    await adminApi(`/physical-cards/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    await load();
  };

  const toggleActive = async (c) => {
    if (c.active && !confirm(t('{code} kartasini bloklaysizmi? Ko\'rinmas havola (chip_token) endi profilni ochmaydi.', { code: c.linkedCode }))) return;
    setBusy(c.id);
    try {
      await adminApi(`/physical-cards/${c.id}/active`, { method: 'POST', body: JSON.stringify({ active: !c.active }) });
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!cards) return <AdminLoading />;
  if (cards.length === 0) return <EmptyState icon="idcard" title={t("Hozircha jismoniy karta buyurtmasi yo'q.")} />;
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>{t('Profil')}</th><th>{t('Egasi')}</th><th>{t('Manzil')}</th><th>{t('Faolmi')}</th><th>{t('Holat')}</th><th></th></tr></thead>
        <tbody>
          {cards.map((c) => (
            <tr key={c.id}>
              <td className="font-mono">{c.linkedCode || '—'}</td>
              <td className="text-xs">{c.ownerEmail}<br />{c.shippingPhone}</td>
              <td className="max-w-xs truncate text-xs">{c.shippingAddress}</td>
              <td>{c.active ? '\u2705' : '\u274C ' + t('bloklangan')}</td>
              <td>
                <select className="select select-bordered select-xs" value={c.status} onChange={(e) => setStatus(c.id, e.target.value)}>
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
  const [gifts, setGifts] = useState(null);
  const [code, setCode] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [lastCreated, setLastCreated] = useState(null);

  const load = () => adminApi('/nfc-gifts').then((d) => setGifts(d.gifts));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!/^[A-Z0-9]{3,16}$/i.test(code.trim())) { setMsg({ type: 'err', text: t("NFC ID formati noto'g'ri.") }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const gift = await adminApi('/nfc-gifts', { method: 'POST', body: JSON.stringify({ code: code.trim(), recipientName: recipientName.trim(), note: note.trim() }) });
      setLastCreated(gift);
      setCode(''); setRecipientName(''); setNote('');
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: e.message === 'CODE_TAKEN' ? t('Bu NFC ID allaqachon band.') : e.message === 'ALREADY_RESERVED' ? t('Bu ID uchun sovg\u2019a allaqachon yaratilgan.') : t('Xatolik yuz berdi.') });
    } finally {
      setBusy(false);
    }
  };

  const STATUS_LABEL = { reserved: { text: 'GIFT / RESERVED', cls: 'badge-warning' }, activated: { text: 'ACTIVATED', cls: 'badge-success' } };

  return (
    <div>
      <div className="max-w-lg rounded-2xl border border-accent/25 bg-accent/5 p-5">
        <div className="text-sm font-bold">{'\u{1F381}'} {t('Yangi "Gift NFC ID" yaratish')}</div>
        <p className="mt-1 text-xs text-base-content/50">{t("Bo'sh (hech kimga tegishli bo'lmagan) NFC ID'ni tanlang — kod hech qanday profilga ulanmaydi, faqat konvert uchun aktivatsiya kodi generatsiya qilinadi.")}</p>
        <div className="mt-3 space-y-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("NFC ID (masalan DDD333)")} className="input input-bordered input-sm w-full bg-base-100 font-mono uppercase" />
          <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder={t("Recipient (ixtiyoriy — kimga mo'ljallangani)")} className="input input-bordered input-sm w-full bg-base-100" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Izoh (ixtiyoriy)")} className="input input-bordered input-sm w-full bg-base-100" />
          <button className="btn btn-accent btn-sm w-full" disabled={busy} onClick={create}>
            {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Sovg\u2019a yaratish')}
          </button>
        </div>
        {msg && <div className={`alert mt-3 py-2 text-xs ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}

        {lastCreated && (
          <div className="mt-4 rounded-xl border border-white/15 bg-black/30 p-4">
            <div className="text-xs font-bold text-base-content/60">{'\u{1F4E7}'} {t("Konvert uchun ma'lumot:")}</div>
            <div className="mt-2 font-mono text-lg font-bold">NFC ID: #{lastCreated.code}</div>
            <div className="mt-1 font-mono text-lg font-bold text-accent">Activation Code: {lastCreated.activationCode}</div>
          </div>
        )}
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="table table-sm">
          <thead><tr><th>NFC ID</th><th>Recipient</th><th>Activation Code</th><th>Status</th><th>{t('Yaratilgan')}</th><th>{t('Aktivlashtirilgan')}</th></tr></thead>
          <tbody>
            {!gifts && <tr><td colSpan={6} className="py-6 text-center text-base-content/45">{t("Yuklanmoqda...")}</td></tr>}
            {gifts?.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-base-content/45">{t("Hozircha sovg'a yaratilmagan.")}</td></tr>}
            {gifts?.map((g) => {
              const st = STATUS_LABEL[g.status] || { text: g.status, cls: 'badge-ghost' };
              return (
                <tr key={g.id}>
                  <td className="font-mono font-bold">{g.code}</td>
                  <td className="text-xs">{g.recipientName || '—'}</td>
                  <td className="font-mono text-xs">{g.activationCode}</td>
                  <td><span className={`badge badge-sm ${st.cls}`}>{st.text}</span></td>
                  <td className="text-xs text-base-content/50">{timeAgo(new Date(g.createdAt).getTime())}</td>
                  <td className="text-xs text-base-content/50">
                    {g.activatedAt ? `${timeAgo(new Date(g.activatedAt).getTime())} — ${g.activatedByEmail || ''}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Promokodlar — har bir promokod bilan qo'shilgan odamlar ro'yxati va hisobi.
function PromoCodesTab() {
  const { t } = useLanguage();
  const [rows, setRows] = useState(null);

  useEffect(() => { adminApi('/referrals').then((d) => setRows(d.referrals || [])).catch(() => setRows([])); }, []);

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
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="table table-sm">
            <thead><tr><th>{t('Kimning promosi')}</th><th>{t('Promokod')}</th><th>{t('Qo‘shilganlar soni')}</th></tr></thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.email}>
                  <td>{s.name || s.email}<div className="text-[11px] text-base-content/40">{s.email}</div></td>
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
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="table table-sm">
            <thead><tr><th>{t('Davr')}</th><th>{t('Kimning promosidan')}</th><th>{t('Promokod')}</th><th>{t('Kim kirgan')}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs text-base-content/60">{dateTime(new Date(r.createdAt).getTime())}</td>
                  <td>{r.referrerName || r.referrerEmail}<div className="text-[11px] text-base-content/40">{r.referrerEmail}</div></td>
                  <td className="font-mono text-xs">{r.referrerPromo || '—'}</td>
                  <td>{r.referredName || r.referredEmail}<div className="text-[11px] text-base-content/40">{r.referredEmail}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(NEWS_EMPTY);
  const [imageUrl, setImageUrl] = useState('');
  const [langTab, setLangTab] = useState('uz');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);
  const [editId, setEditId] = useState(null);

  const load = () => adminApi('/news').then((d) => setRows(d.news || [])).catch(() => setRows([]));
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
      setErr(e.message === 'title_required' ? t('Sarlavhani kiriting.') : t('Xatolik yuz berdi.'));
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
    setBusy(true);
    try { await adminApi(`/news/${n.id}`, { method: 'PUT', body: JSON.stringify({ published: !n.published }) }); await load(); }
    finally { setBusy(false); }
  };

  const remove = async (n) => {
    if (!confirm(t('Bu yangilikni o‘chirasizmi?'))) return;
    setBusy(true);
    try { await adminApi(`/news/${n.id}`, { method: 'DELETE' }); await load(); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-base-200/50 p-5">
        <div className="text-sm font-bold">{editId ? t('Yangilikni tahrirlash') : t('Yangi yangilik')}</div>

        <div className="mt-3 flex gap-1">
          {NEWS_LANGS.map(([code, label]) => (
            <button key={code} onClick={() => setLangTab(code)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${langTab === code ? 'bg-accent text-accent-content' : 'bg-white/5 text-base-content/60'}`}>
              {label}
            </button>
          ))}
        </div>

        <input value={form[key('title')]} onChange={set(key('title'))}
          placeholder={langTab === 'uz' ? t('Sarlavha') : t('Sarlavha (tarjima)')}
          className="input input-bordered input-sm mt-2 w-full bg-base-100" />
        <textarea value={form[key('body')]} onChange={set(key('body'))}
          placeholder={langTab === 'uz' ? t('Matn') : t('Matn (tarjima)')} rows={4}
          className="textarea textarea-bordered textarea-sm mt-2 w-full bg-base-100" />
        {langTab !== 'uz' && (
          <div className="mt-1 text-[11px] text-base-content/40">{t("Bo'sh qoldirsangiz, bu tilda o'zbekcha matn ko'rsatiladi.")}</div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={t('Rasm havolasi (ixtiyoriy) — https://...')}
            className="input input-bordered input-sm min-w-0 flex-1 bg-base-100 font-mono text-xs" />
          <label className="btn btn-ghost btn-sm">
            {uploading ? <span className="loading loading-spinner loading-xs"></span> : t('Fayldan yuklash')}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
          {imageUrl && <button className="btn btn-ghost btn-xs" onClick={() => setImageUrl('')}>{t("O'chirish")}</button>}
        </div>
        {imageUrl && <img src={imageUrl} alt="" className="mt-2 max-h-40 rounded-lg border border-white/10 object-cover" />}

        {err && <div className="mt-2 text-xs text-error">{err}</div>}
        <div className="mt-3 flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || uploading}>
            {busy ? <span className="loading loading-spinner loading-xs"></span> : (editId ? t('Saqlash') : t('Joylash'))}
          </button>
          {editId && <button className="btn btn-ghost btn-sm" onClick={reset}>{t('Bekor')}</button>}
        </div>
      </div>

      {!rows && <AdminLoading />}
      {rows && rows.length === 0 && <EmptyState icon="news" title={t('Hozircha yangiliklar yo‘q.')} />}
      <div className="space-y-3">
        {(rows || []).map((n) => (
          <div key={n.id} className="rounded-2xl border border-white/10 bg-base-200/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{n.title}</span>
                  {!n.published && <span className="badge badge-ghost badge-xs">{t('Yashirin')}</span>}
                  {n.titleRu && <span className="badge badge-outline badge-xs">RU</span>}
                  {n.titleEn && <span className="badge badge-outline badge-xs">EN</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-base-content/40">
                  {dateTime(new Date(n.createdAt).getTime())} · 👁 {n.views || 0} · ❤️ {n.likeCount || 0}
                </div>
                {n.body && <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm text-base-content/60">{n.body}</p>}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button className="btn btn-ghost btn-xs" onClick={() => startEdit(n)}>{t('Tahrirlash')}</button>
                <button className="btn btn-ghost btn-xs" onClick={() => togglePublish(n)} disabled={busy}>
                  {n.published ? t('Yashirish') : t('Chiqarish')}
                </button>
                <button className="btn btn-error btn-xs" onClick={() => remove(n)} disabled={busy}>{t("O'chirish")}</button>
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
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(CAT_EMPTY);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const load = () => adminApi('/categories').then((d) => setRows(d.categories || [])).catch(() => setRows([]));
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
      setErr(m[e.message] || t('Xatolik yuz berdi.'));
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
    setBusy(true);
    try { await adminApi(`/categories/${c.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !c.enabled }) }); await load(); }
    finally { setBusy(false); }
  };

  const bump = async (c, delta) => {
    setBusy(true);
    try { await adminApi(`/categories/${c.id}`, { method: 'PUT', body: JSON.stringify({ sort: Math.max(0, (c.sort || 0) + delta) }) }); await load(); }
    finally { setBusy(false); }
  };

  const remove = async (c) => {
    const kids = (rows || []).filter((x) => x.parentSlug === c.slug);
    const msg = kids.length
      ? t('Bu sohada {n} ta kichik soha bor. Ular ham o‘chadimi?', { n: kids.length })
      : t('Bu kategoriyani o‘chirasizmi?');
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      for (const k of kids) await adminApi(`/categories/${k.id}`, { method: 'DELETE' });
      await adminApi(`/categories/${c.id}`, { method: 'DELETE' });
      await load();
    } finally { setBusy(false); }
  };

  const Row = ({ c, child }) => (
    <div className={`flex items-center gap-2 rounded-xl border border-white/10 bg-base-200/40 px-3 py-2 ${child ? 'ml-6' : ''} ${c.enabled ? '' : 'opacity-50'}`}>
      <div className="flex flex-col">
        <button className="btn btn-ghost btn-xs px-1" onClick={() => bump(c, -1)} disabled={busy}>▲</button>
        <button className="btn btn-ghost btn-xs px-1" onClick={() => bump(c, 1)} disabled={busy}>▼</button>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{c.nameUz}</span>
          <span className="font-mono text-[11px] text-base-content/35">{c.slug}</span>
          {c.nameRu && <span className="badge badge-outline badge-xs">RU</span>}
          {c.nameEn && <span className="badge badge-outline badge-xs">EN</span>}
          {!c.enabled && <span className="badge badge-ghost badge-xs">{t('Yashirin')}</span>}
          <span className="text-[11px] text-base-content/35">#{c.sort}</span>
        </div>
      </div>
      <button className="btn btn-ghost btn-xs" onClick={() => startEdit(c)}>{t('Tahrirlash')}</button>
      <button className="btn btn-ghost btn-xs" onClick={() => toggle(c)} disabled={busy}>{c.enabled ? t('Yashirish') : t('Chiqarish')}</button>
      <button className="btn btn-error btn-xs" onClick={() => remove(c)} disabled={busy}>{t("O'chirish")}</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-base-200/50 p-5">
        <div className="text-sm font-bold">{editId ? t('Kategoriyani tahrirlash') : t('Yangi kategoriya')}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={form.slug} onChange={set('slug')} disabled={!!editId}
            placeholder={t('slug (lotincha): it-dasturlash')}
            className="input input-bordered input-sm w-full bg-base-100 font-mono text-xs disabled:opacity-60" />
          <select value={form.parentSlug} onChange={set('parentSlug')} className="select select-bordered select-sm w-full bg-base-100">
            <option value="">{t('— asosiy soha —')}</option>
            {mains.filter((m) => m.slug !== form.slug).map((m) => (
              <option key={m.slug} value={m.slug}>{m.nameUz}</option>
            ))}
          </select>
          <input value={form.nameUz} onChange={set('nameUz')} placeholder={t('Nomi (UZ)')} className="input input-bordered input-sm w-full bg-base-100" />
          <input value={form.sort} onChange={set('sort')} type="number" placeholder={t('Tartib')} className="input input-bordered input-sm w-full bg-base-100" />
          <input value={form.nameRu} onChange={set('nameRu')} placeholder={t('Nomi (RU)')} className="input input-bordered input-sm w-full bg-base-100" />
          <input value={form.nameEn} onChange={set('nameEn')} placeholder={t('Nomi (EN)')} className="input input-bordered input-sm w-full bg-base-100" />
        </div>
        {err && <div className="mt-2 text-xs text-error">{err}</div>}
        <div className="mt-3 flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs"></span> : (editId ? t('Saqlash') : t('Qo‘shish'))}
          </button>
          {editId && <button className="btn btn-ghost btn-sm" onClick={reset}>{t('Bekor')}</button>}
        </div>
      </div>

      {!rows && <AdminLoading />}
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => adminApi('/verified-cards').then((d) => setRows(d.cards || [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const lookup = async () => {
    setErr(''); setFound(null);
    const c = code.trim().toUpperCase();
    if (!c) return;
    try { setFound(await adminApi(`/records/${encodeURIComponent(c)}`)); }
    catch { setErr(t('Bunday profil topilmadi.')); }
  };
  const toggle = async (c, verified) => {
    setBusy(true);
    try {
      await adminApi(`/records/${encodeURIComponent(c)}/verify`, { method: 'POST', body: JSON.stringify({ verified }) });
      if (found && found.code === c) setFound({ ...found, verified });
      await load();
    } finally { setBusy(false); }
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
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-base-200/50 p-5">
        <div className="text-sm font-bold">{t('Profilni tasdiqlash')}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('Profil kodi (masalan BMW007)')}
            className="input input-bordered input-sm min-w-0 flex-1 bg-base-100 font-mono" />
          <button className="btn btn-sm" onClick={lookup}>{t('Qidirish')}</button>
        </div>
        {err && <div className="mt-2 text-xs text-error">{err}</div>}
        {found && (
          <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{found.name} <span className="font-mono text-xs text-base-content/40">{found.code}</span></div>
                <div className="text-xs text-base-content/50">
                  {found.role || '—'} · {found.verified ? t('Tasdiqlangan ✔') : t('Tasdiqlanmagan')} · 👁 {found.views ?? 0}
                </div>
              </div>
              <button className={`btn btn-sm ${found.verified ? 'btn-ghost border border-white/15' : 'btn-primary'}`}
                disabled={busy} onClick={() => toggle(found.code, !found.verified)}>
                {found.verified ? t('Tasdiqni olib tashlash') : t('Tasdiqlash')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
              <span className="text-xs text-base-content/55">{t('Ko‘rishlar sonini o‘zgartirish')}:</span>
              <input type="number" min="0" value={viewsInput} onChange={(e) => setViewsInput(e.target.value)}
                placeholder={String(found.views ?? 0)} className="input input-bordered input-xs w-28 bg-base-100" />
              <button className="btn btn-xs" disabled={busy || viewsInput === ''} onClick={saveViews}>{t('Saqlash')}</button>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-bold">{t('Tasdiqlangan profillar')} {rows ? `(${rows.length})` : ''}</div>
        {!rows && <div className="mt-2"><AdminLoading /></div>}
        {rows && rows.length === 0 && <div className="mt-2"><EmptyState icon="check" title={t('Hozircha tasdiqlangan profil yo‘q.')} /></div>}
        <div className="mt-2 space-y-2">
          {(rows || []).map((r) => (
            <div key={r.code} className="flex items-center justify-between rounded-xl border border-white/10 bg-base-200/40 px-3 py-2">
              <div className="text-sm">{r.name} <span className="font-mono text-xs text-base-content/40">{r.code}</span></div>
              <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => toggle(r.code, false)}>{t('Tasdiqni olib tashlash')}</button>
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
      <div className="flex flex-wrap gap-1.5">
        {FIN_SUBTABS.map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className={`btn btn-sm ${sub === k ? 'btn-primary' : 'btn-ghost'}`}>{t(l)}</button>
        ))}
      </div>

      {showDate && (
        <div className="flex flex-wrap items-center gap-1.5">
          {FIN_RANGES.map(([k, l]) => (
            <button key={k} onClick={() => setRange(k)} className={`btn btn-xs ${range === k ? 'btn-accent' : 'btn-ghost border border-white/10'}`}>{t(l)}</button>
          ))}
          {range === 'custom' && (
            <>
              <input type="date" value={cf} onChange={(e) => setCf(e.target.value)} className="input input-bordered input-xs bg-base-100" />
              <span className="text-base-content/40">—</span>
              <input type="date" value={ct} onChange={(e) => setCt(e.target.value)} className="input input-bordered input-xs bg-base-100" />
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
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setData(null); setErr(false);
    adminApi(`/finance/overview?${rangeQs}`).then(setData).catch(() => setErr(true));
  }, [rangeQs, ready]);

  if (!ready) return <EmptyState icon="bank" title={t('Sanani tanlang')} hint={t('Custom oraliq uchun boshlanish va tugash sanasini kiriting.')} />;
  if (err) return <EmptyState icon="bank" title={t('Xatolik yuz berdi.')} />;
  if (!data) return <AdminLoading />;
  const o = data.overview || {};
  const daily = (data.daily || []).map((d) => ({ ...d, kun: d.day.slice(5) }));

  return (
    <div className="space-y-4">
      {!o.ratesConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <span>{'⚠️'} {t('Payme / bank / soliq foizlari hali kiritilmagan — hisob-kitob to‘liq bo‘lmaydi.')}</span>
          <button className="btn btn-warning btn-xs" onClick={onGoRates}>{t('Tarif va soliqlarni to‘ldirish')}</button>
        </div>
      )}

      <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-[#1a1509] via-[#121013] to-[#101013] p-5">
        <div className="text-[13px] text-base-content/50">{t('Jami savdo (gross)')}</div>
        <div className="mt-1 text-[30px] font-extrabold tracking-tight">{money(o.grossSales)}</div>
        <div className="mt-1 text-[11.5px] text-base-content/40">{o.orderCount} {t('ta to‘langan buyurtma')} · {o.fromIso?.slice(0, 10)} … {o.toIso?.slice(0, 10)}</div>
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
              <div key={r.kind} className="flex items-center justify-between border-b border-white/5 pb-1.5 text-sm last:border-0">
                <span className="text-base-content/70">{t(FIN_TYPE_LABEL[r.kind] || r.kind)}</span>
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

  useEffect(() => { setPage(1); }, [rangeQs, type, status, q]);
  useEffect(() => {
    if (!ready) return;
    setData(null);
    const qs = `${rangeQs}&type=${type}&status=${status}&q=${encodeURIComponent(q)}&page=${page}`;
    adminApi(`/finance/transactions?${qs}`).then(setData).catch(() => setData({ items: [], total: 0 }));
  }, [rangeQs, ready, type, status, q, page]);

  if (!ready) return <EmptyState icon="bank" title={t('Sanani tanlang')} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="select select-bordered select-sm bg-base-100">
          <option value="">{t('Barcha turlar')}</option>
          {Object.entries(FIN_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="select select-bordered select-sm bg-base-100">
          <option value="">{t('Barcha holatlar')}</option>
          <option value="paid">{t('To‘langan')}</option>
          <option value="cancelled">{t('Bekor qilingan')}</option>
          <option value="failed_code_taken">{t('Kod band bo‘lib qolgan')}</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Kod / email / Payme txn')} className="input input-bordered input-sm flex-1 bg-base-100" />
      </div>

      {!data ? <AdminLoading />
        : data.items.length === 0 ? <EmptyState icon="bank" title={t('Bu shartlarga mos tranzaksiya yo‘q.')} />
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
                      <td className="max-w-[160px] truncate font-mono text-[11px] text-base-content/45">{r.paymeTxnId || '—'}</td>
                      <td className="max-w-[180px] truncate text-xs text-base-content/60">{r.userEmail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-base-content/50">
              <span>{t('Jami')}: {data.total}</span>
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
                <span className="px-2 py-1">{page}</span>
                <button className="btn btn-ghost btn-xs" disabled={data.items.length < data.limit} onClick={() => setPage((p) => p + 1)}>→</button>
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
  const [editId, setEditId] = useState(null);
  const [val, setVal] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => { setRows(null); adminApi(`/finance/reconciliation?year=${year}`).then((d) => setRows(d.months || [])).catch(() => setRows([])); };
  useEffect(load, [year]);

  const save = async (period) => {
    setBusy(true);
    try {
      await adminApi('/finance/bank-actual', { method: 'POST', body: JSON.stringify({ period, actualAmount: Number(val) || 0, note }) });
      setEditId(null); setVal(''); setNote('');
      load();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost btn-xs" onClick={() => setYear((y) => y - 1)}>←</button>
        <span className="text-sm font-bold">{year}</span>
        <button className="btn btn-ghost btn-xs" disabled={year >= nowY} onClick={() => setYear((y) => y + 1)}>→</button>
      </div>
      <p className="text-xs text-base-content/45">{t('“Expected” — sotuvdan Payme komissiyasi ayirilgan hisob. “Actual” — Trastbank hisob varag‘iga real tushgan pul (siz kiritasiz).')}</p>

      {!rows ? <AdminLoading /> : (
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
                        <input type="number" value={val} onChange={(e) => setVal(e.target.value)} placeholder={String(m.expected)} className="input input-bordered input-xs w-32 bg-base-100" />
                        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Izoh')} className="input input-bordered input-xs w-32 bg-base-100" />
                      </div>
                    ) : (m.actual == null ? <span className="text-base-content/30">—</span> : <span className="text-xs font-semibold">{money(m.actual)}</span>)}
                  </td>
                  <td className={`text-xs ${m.diff ? 'text-error' : 'text-base-content/40'}`}>{m.diff == null ? '—' : money(m.diff)}</td>
                  <td><StatusBadge tone={FIN_RECON_TONE[m.status]}>{t(FIN_RECON_LABEL[m.status] || m.status)}</StatusBadge></td>
                  <td>
                    {editId === m.period ? (
                      <div className="flex gap-1">
                        <button className="btn btn-primary btn-xs" disabled={busy} onClick={() => save(m.period)}>{t('Saqlash')}</button>
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditId(null)}>×</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-xs" onClick={() => { setEditId(m.period); setVal(m.actual == null ? '' : String(m.actual)); setNote(m.note || ''); }}>{t('Kiritish')}</button>
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
    } catch { setMsg({ ok: false }); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#101013] p-5">
      <div className="text-sm font-bold text-accent">{FIN_RATE_TITLE[scope]}</div>
      {current && <div className="mt-0.5 text-[11px] text-base-content/40">{t('Hozir amalda')}: {current.effectiveFrom}{current.note ? ` · ${current.note}` : ''}</div>}
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {FIN_RATE_FIELDS[scope].map(([k, label]) => (
          <label key={k} className="text-xs">
            <span className="text-base-content/55">{t(label)}</span>
            <input type="number" step="any" value={form[k] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="input input-bordered input-sm mt-1 w-full bg-base-100" />
          </label>
        ))}
        {scope === 'payme' && (
          <label className="text-xs">
            <span className="text-base-content/55">{t('Hisoblash usuli')}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="select select-bordered select-sm mt-1 w-full bg-base-100">
              <option value="settlement_deducted">{t('Settlementdan ushlab qolinadi')}</option>
              <option value="separate">{t('Alohida hisoblanadi')}</option>
            </select>
          </label>
        )}
        <label className="text-xs">
          <span className="text-base-content/55">{t('Amal qiladi (sana)')}</span>
          <input type="date" value={eff} onChange={(e) => setEff(e.target.value)} className="input input-bordered input-sm mt-1 w-full bg-base-100" />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? <span className="loading loading-spinner loading-xs"></span> : t('Saqlash')}</button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-success' : 'text-error'}`}>{msg.ok ? t('Saqlandi') : t('Xatolik yuz berdi.')}</span>}
      </div>
      {history && history.length > 1 && (
        <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-base-content/40">
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
  const load = () => adminApi('/finance/rates').then(setData).catch(() => setData({ current: {}, history: {} }));
  useEffect(() => { load(); }, []);

  if (!data) return <AdminLoading />;
  return (
    <div className="space-y-4">
      <p className="text-xs text-base-content/45">{t('Foizlar kodga yozilmagan — shu yerdan boshqariladi. Bank bilan kelishgach real qiymatlarni kiriting. Har o‘zgarish sanasi bilan saqlanadi (eski tranzaksiyalar qayta hisoblanmaydi).')}</p>
      {['payme', 'bank', 'tax'].map((s) => (
        <FinanceRateCard key={s} scope={s} current={data.current?.[s]} history={data.history?.[s]} onSaved={load} />
      ))}
    </div>
  );
}

function FinanceReports({ range, rangeQs, ready }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [dl, setDl] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setData(null);
    adminApi(`/finance/overview?${rangeQs}`).then(setData).catch(() => setData(null));
  }, [rangeQs, ready]);

  const download = async () => {
    setDl(true);
    try {
      const res = await fetch(`/api/admin/finance/report?${rangeQs}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `nfcstore_moliya_${range}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert(t('Excel faylni yuklab bo’lmadi.')); } finally { setDl(false); }
  };

  if (!ready) return <EmptyState icon="bank" title={t('Sanani tanlang')} />;
  const o = data?.overview;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-gradient-to-br from-[#1a1509] via-[#121013] to-[#101013] p-5">
        <div>
          <div className="text-sm font-bold text-accent">{'\u{1F4E6}'} {t('Buxgalter uchun paket')}</div>
          <p className="mt-1 text-xs text-base-content/45">{t('Bitta Excel: jamlama + tranzaksiyalar + kunlik + oylik solishtirish. Buxgalter/soliq uchun DASTLABKI hisobot.')}</p>
        </div>
        <button className="btn btn-accent btn-sm" disabled={dl} onClick={download}>{dl ? <span className="loading loading-spinner loading-xs"></span> : t('Excel yuklab olish')}</button>
      </div>

      {!data ? <AdminLoading /> : o && (
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
              <div key={l} className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-base-content/60">{t(l)}</span>
                <span className="font-medium">{v == null ? t('kiritilmagan') : money(v)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-1.5 text-base font-bold">
              <span>{t('Sof pul oqimi')}</span>
              <span className={o.netCashFlow >= 0 ? 'text-success' : 'text-error'}>{money(o.netCashFlow)}</span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-base-content/35">{t('Bu ichki/dastlabki hisobot. Rasmiy soliq hisoboti buxgalter tomonidan tasdiqlanadi — bu yerdan hech qanday davlat tizimiga avtomatik yuborilmaydi.')}</p>
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

  const load = () => adminApi('/finance/expenses').then(setData).catch(() => setData({ expenses: [], categories: [] }));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title.trim() || !Number(form.amount)) return;
    setBusy(true);
    try {
      await adminApi('/finance/expenses', { method: 'POST', body: JSON.stringify(form) });
      setForm({ title: '', category: 'other', amount: '', spentOn: new Date().toISOString().slice(0, 10), note: '' });
      load();
    } finally { setBusy(false); }
  };
  const del = async (id) => { if (!confirm(t('O‘chirasizmi?'))) return; await adminApi(`/finance/expenses/${id}`, { method: 'DELETE' }); load(); };

  return (
    <AdminCard title={t('Boshqa xarajatlar')}>
      <div className="grid gap-2 sm:grid-cols-6">
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t('Nomi')} className="input input-bordered input-sm bg-base-100 sm:col-span-2" />
        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="select select-bordered select-sm bg-base-100">
          {(data?.categories || ['other']).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder={t('Summa')} className="input input-bordered input-sm bg-base-100" />
        <input type="date" value={form.spentOn} onChange={(e) => setForm((f) => ({ ...f, spentOn: e.target.value }))} className="input input-bordered input-sm bg-base-100" />
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={add}>{t('Qo‘shish')}</button>
      </div>
      <div className="mt-3">
        {!data ? <AdminLoading /> : data.expenses.length === 0 ? <div className="text-xs text-base-content/40">{t('Hozircha xarajat yo‘q.')}</div> : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead><tr><th>{t('Sana')}</th><th>{t('Nomi')}</th><th>{t('Turkum')}</th><th>{t('Summa')}</th><th></th></tr></thead>
              <tbody>
                {data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs text-base-content/55">{e.spentOn}</td>
                    <td>{e.title}{e.note && <div className="text-[11px] text-base-content/35">{e.note}</div>}</td>
                    <td className="text-xs">{e.category}</td>
                    <td className="font-semibold">{money(e.amount)}</td>
                    <td><button className="btn btn-ghost btn-xs text-error" onClick={() => del(e.id)}>{t('O‘chirish')}</button></td>
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

  const load = () => adminApi('/finance/documents').then(setData).catch(() => setData({ documents: [], types: [] }));
  useEffect(() => { load(); }, []);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { alert(t('Fayl 15 MB dan katta.')); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        await adminApi('/finance/documents', { method: 'POST', body: JSON.stringify({ name: form.name || file.name, docType: form.docType, period: form.period, dataUrl: reader.result }) });
        setForm({ name: '', docType: 'other', period: '', url: '' });
        load();
      } catch { alert(t('Xatolik yuz berdi.')); } finally { setBusy(false); }
    };
    reader.readAsDataURL(file);
  };
  const addLink = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    setBusy(true);
    try { await adminApi('/finance/documents', { method: 'POST', body: JSON.stringify(form) }); setForm({ name: '', docType: 'other', period: '', url: '' }); load(); }
    finally { setBusy(false); }
  };
  const del = async (id) => { if (!confirm(t('O‘chirasizmi?'))) return; await adminApi(`/finance/documents/${id}`, { method: 'DELETE' }); load(); };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/[0.07] bg-[#101013] p-5">
        <div className="text-sm font-semibold">{t('Hujjat qo‘shish')}</div>
        <p className="mt-1 text-[11px] text-base-content/40">{t('Payme hisobot, bank ko‘chirmasi, soliq hujjati, chek… Fayl (PDF/Excel/CSV/rasm, ≤15 MB) yoki tashqi havola. Diqqat: yuklangan fayllar server yangilanganda o‘chishi mumkin — muhimlarini tashqi drayvda ham saqlang.')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('Nomi')} className="input input-bordered input-sm bg-base-100" />
          <select value={form.docType} onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))} className="select select-bordered select-sm bg-base-100">
            {Object.entries(FIN_DOC_LABEL).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
          </select>
          <input value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} placeholder={t('Davr (masalan 2026-08)')} className="input input-bordered input-sm bg-base-100" />
          <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder={t('Havola (ixtiyoriy)')} className="input input-bordered input-sm bg-base-100" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="btn btn-ghost btn-sm border border-white/10">
            {t('Fayl tanlash')}
            <input type="file" onChange={onFile} accept=".pdf,.csv,.xlsx,.xls,image/*" className="hidden" />
          </label>
          <button className="btn btn-primary btn-sm" disabled={busy || !form.url.trim()} onClick={addLink}>{t('Havola bilan qo‘shish')}</button>
          {busy && <span className="loading loading-spinner loading-xs"></span>}
        </div>
      </div>

      {!data ? <AdminLoading /> : data.documents.length === 0 ? <EmptyState icon="folder" title={t('Hozircha hujjat yo‘q.')} /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>{t('Nomi')}</th><th>{t('Tur')}</th><th>{t('Qaysi oy')}</th><th>{t('Sana')}</th><th></th></tr></thead>
            <tbody>
              {data.documents.map((d) => (
                <tr key={d.id}>
                  <td><a href={d.url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{d.name}</a></td>
                  <td className="text-xs">{t(FIN_DOC_LABEL[d.docType] || d.docType)}</td>
                  <td className="font-mono text-xs">{d.period || '—'}</td>
                  <td className="text-xs text-base-content/50">{d.createdAt ? dateTime(new Date(d.createdAt).getTime()) : '—'}</td>
                  <td><button className="btn btn-ghost btn-xs text-error" onClick={() => del(d.id)}>{t('O‘chirish')}</button></td>
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

const COMPANY_SUBTABS = [['overview', 'Umumiy'], ['list', 'Kompaniyalar'], ['pricing', 'Tariflar va narxlar'], ['log', 'Faoliyat jurnali']];

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
  useEffect(() => { adminApi('/companies/activity-log').then((d) => setLog(d.log)); }, []);
  return (
    <AdminCard title={t('Kompaniyalar bo‘yicha admin amallari')}>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>{t('Amal')}</th><th>{t('Tafsilot')}</th><th>{t('Eski qiymat')}</th><th>{t('Yangi qiymat')}</th><th>{t('IP')}</th><th>{t('Vaqt')}</th></tr></thead>
          <tbody>
            {!log && <tr><td colSpan={6} className="py-6 text-center text-base-content/45">{t('Yuklanmoqda...')}</td></tr>}
            {log?.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-base-content/45">{t("Hozircha yozuv yo'q.")}</td></tr>}
            {log?.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold">{t(COMPANY_ACTION_LABEL[a.action] || a.action)}</td>
                <td className="text-xs text-base-content/60">{a.details || '—'}</td>
                <td className="text-xs text-base-content/50">{a.oldValue || '—'}</td>
                <td className="text-xs text-base-content/50">{a.newValue || '—'}</td>
                <td className="font-mono text-xs text-base-content/40">{a.ip || '—'}</td>
                <td className="text-xs text-base-content/50">{timeAgo(new Date(a.createdAt).getTime())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  useEffect(() => { adminApi('/companies/stats').then(setStats).catch(() => {}); }, []);
  if (!stats) return <AdminLoading />;
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
  const cats = useCategories();
  const [row, setRow] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tierPick, setTierPick] = useState('');

  const load = () => adminApi(`/companies/${encodeURIComponent(code)}`).then((d) => { setRow(d); setTierPick(d.tierOverride || ''); });
  useEffect(() => { load(); }, [code]);

  const toggleStatus = async () => {
    setBusy(true);
    try {
      await adminApi(`/companies/${encodeURIComponent(code)}/status`, { method: 'POST', body: JSON.stringify({ hidden: !row.hiddenFromDirectory }) });
      await load(); onChanged();
    } finally { setBusy(false); }
  };
  const saveTier = async () => {
    setBusy(true);
    try {
      await adminApi(`/companies/${encodeURIComponent(code)}/tier`, { method: 'POST', body: JSON.stringify({ tier: tierPick || null }) });
      await load(); onChanged();
    } finally { setBusy(false); }
  };

  if (!row) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-base-200 p-6" onClick={(e) => e.stopPropagation()}><AdminLoading /></div>
      </div>
    );
  }

  const tier = idTier({ code: row.code, tierOverride: row.tierOverride, isGift: row.isGift });
  const access = effectiveAccess({ code: row.code, tierOverride: row.tierOverride, isGift: row.isGift }, { isPremium: row.ownerIsPremium });
  const menuStatus = companyModuleStatus(row.menuCatCount, row.menuItemCount);
  const productStatus = companyModuleStatus(row.productCatCount, row.productItemCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-base-200 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold">{row.name} {row.verified && <span title={t('Tasdiqlangan')}>✔️</span>}</div>
            <div className="font-mono text-xs text-base-content/45">nfcstore.uz/{row.code.toLowerCase()}</div>
          </div>
          <button className="btn btn-ghost btn-xs btn-square" onClick={onClose}>✕</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div><span className="text-base-content/45">{t('Egasi')}:</span> {row.ownerEmail || '—'}</div>
          <div><span className="text-base-content/45">{t('Telefon')}:</span> {row.phone || row.ownerPhone || '—'}</div>
          <div><span className="text-base-content/45">{t('Soha')}:</span> {catPath(cats, row.categorySlug, lang) || '—'}</div>
          <div><span className="text-base-content/45">{t('Shahar')}:</span> {row.city || '—'}</div>
          <div><span className="text-base-content/45">{t('Jamoa a’zolari')}:</span> {row.teamCount}</div>
          <div><span className="text-base-content/45">{t('Band qilingan')}:</span> {timeAgo(row.ts)}</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-base-content/45">{t('Restoran menyusi')}</div>
            <StatusBadge tone={menuStatus.tone}>{t(menuStatus.text)}</StatusBadge>
            <div className="mt-1 text-[11px] text-base-content/50">{row.menuCatCount} {t('kategoriya')} · {row.menuItemCount} {t('taom')}</div>
            <a className="mt-1.5 inline-block text-[11px] font-semibold text-accent underline underline-offset-2" href={`/${row.code.toLowerCase()}/menyu`} target="_blank" rel="noopener noreferrer">{t('Ochish')} ↗</a>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-base-content/45">{t('Mahsulotlar katalogi')}</div>
            <StatusBadge tone={productStatus.tone}>{t(productStatus.text)}</StatusBadge>
            <div className="mt-1 text-[11px] text-base-content/50">{row.productCatCount} {t('kategoriya')} · {row.productItemCount} {t('mahsulot')}</div>
            <a className="mt-1.5 inline-block text-[11px] font-semibold text-accent underline underline-offset-2" href={`/${row.code.toLowerCase()}/mahsulotlar`} target="_blank" rel="noopener noreferrer">{t('Ochish')} ↗</a>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-base-content/45">{t('Tarif')}</div>
          <div className="mt-1 text-sm">{t(TIER_LABEL[tier] || tier)} {row.ownerIsPremium && access !== tier ? `→ ${t('Profile Premium orqali')} ${t(TIER_LABEL[access])}` : ''}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <select value={tierPick} onChange={(e) => setTierPick(e.target.value)} className="select select-bordered select-xs bg-base-100">
              <option value="">{t('Avtomatik (kod naqshiga qarab)')}</option>
              {COMPANY_TIER_OPTIONS.map((v) => <option key={v} value={v}>{t(TIER_LABEL[v])}</option>)}
            </select>
            <button className="btn btn-primary btn-xs" disabled={busy} onClick={saveTier}>{t('Saqlash')}</button>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-base-content/40">{t('Bu — NFC ID darajasini qo‘lda belgilash (masalan sovg‘a/maxsus holat). Kod naqshidan kelib chiqadigan avtomatik darajani almashtiradi.')}</p>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs">
            <div className="font-semibold">{row.hiddenFromDirectory ? t('Bloklangan') : t('Faol')}</div>
            <div className="text-[10.5px] text-base-content/40">{t('Bloklash faqat ommaviy katalog/qidiruvdan yashiradi — havola orqali ochish davom etadi.')}</div>
          </div>
          <button className={`btn btn-xs ${row.hiddenFromDirectory ? 'btn-success' : 'btn-warning'}`} disabled={busy} onClick={toggleStatus}>
            {row.hiddenFromDirectory ? t('Faollashtirish') : t('Bloklash')}
          </button>
        </div>
      </div>
    </div>
  );
}

const PRICING_TIERS = ['free', 'silver', 'gold', 'premium', 'exclusive'];

function LimitsTable({ title, subtitle, kind, limits, onSaved }) {
  const { t } = useLanguage();
  const [edit, setEdit] = useState(null); // tier being edited
  const [form, setForm] = useState({ cat: '', item: '', images: true });
  const [busy, setBusy] = useState(false);

  if (!limits) return null;

  const startEdit = (tier) => { setEdit(tier); setForm({ ...limits[tier] }); };
  const save = async (tier) => {
    setBusy(true);
    try {
      await adminApi('/company-settings/limits', { method: 'POST', body: JSON.stringify({ kind, tier, cat: Number(form.cat), item: Number(form.item), images: form.images }) });
      setEdit(null); await onSaved();
    } finally { setBusy(false); }
  };
  const resetDefault = async (tier) => {
    setBusy(true);
    try { await adminApi(`/company-settings/limits/${kind}/${tier}`, { method: 'DELETE' }); await onSaved(); }
    finally { setBusy(false); }
  };

  return (
    <AdminCard title={title} right={<span className="text-[11px] text-base-content/40">{subtitle}</span>}>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>{t('Tarif')}</th><th>{t('Kategoriyalar')}</th><th>{t('Elementlar')}</th><th>{t('Rasm')}</th><th></th></tr></thead>
          <tbody>
            {PRICING_TIERS.map((tier) => {
              const l = limits[tier];
              const editing = edit === tier;
              return (
                <tr key={tier}>
                  <td className="font-semibold">{t(TIER_LABEL[tier])} {l.isCustom && <span className="badge badge-accent badge-xs ml-1">{t('o‘zgartirilgan')}</span>}</td>
                  {editing ? (
                    <>
                      <td><input type="number" min="0" value={form.cat} onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))} className="input input-bordered input-xs w-16 bg-base-100" /></td>
                      <td><input type="number" min="0" value={form.item} onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))} className="input input-bordered input-xs w-20 bg-base-100" /></td>
                      <td>
                        <input type="checkbox" checked={form.images} onChange={(e) => setForm((f) => ({ ...f, images: e.target.checked }))} className="checkbox checkbox-xs" />
                      </td>
                      <td className="flex gap-1">
                        <button className="btn btn-primary btn-xs" disabled={busy} onClick={() => save(tier)}>{t('Saqlash')}</button>
                        <button className="btn btn-ghost btn-xs" onClick={() => setEdit(null)}>{t('Bekor')}</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{l.cat}</td>
                      <td>{l.item}</td>
                      <td>{l.images ? '✅' : '—'}</td>
                      <td className="flex gap-1">
                        <button className="btn btn-ghost btn-xs" onClick={() => startEdit(tier)}>{t('Tahrirlash')}</button>
                        {l.isCustom && <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => resetDefault(tier)}>{t('Standartga qaytarish')}</button>}
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
  const [rows, setRows] = useState(tiers);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRows(tiers); }, [tiers]);

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { minQty: 1, maxQty: null, pricePerUnit: 0 }]);
  const delRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const save = async () => {
    setBusy(true);
    try { await adminApi('/company-settings/physical-pricing', { method: 'POST', body: JSON.stringify({ tiers: rows }) }); await onSaved(); }
    finally { setBusy(false); }
  };

  return (
    <AdminCard title={t('Jismoniy NFC — ko‘p dona narx pog‘onalari')}>
      <p className="mb-3 text-[11.5px] text-base-content/45">{t('Korporativ buyurtma kalkulyatori uchun (Kompaniyalar sahifasida ko‘rinadi).')} {t('Bu — informatsion kalkulyator. To‘lov/checkout hozircha o‘chiq — buyurtma Telegram orqali qo‘lda amalga oshiriladi.')}</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
            <span className="text-[11px] text-base-content/45">{t('dan')}</span>
            <input type="number" min="1" value={r.minQty} onChange={(e) => setRow(i, { minQty: Number(e.target.value) })} className="input input-bordered input-xs w-16 bg-base-100" />
            <span className="text-[11px] text-base-content/45">{t('gacha')}</span>
            <input type="number" min="1" value={r.maxQty ?? ''} placeholder={t('cheksiz')} onChange={(e) => setRow(i, { maxQty: e.target.value === '' ? null : Number(e.target.value) })} className="input input-bordered input-xs w-20 bg-base-100" />
            <span className="text-[11px] text-base-content/45">{t('dona —')}</span>
            <input type="number" min="0" value={r.pricePerUnit} onChange={(e) => setRow(i, { pricePerUnit: Number(e.target.value) })} className="input input-bordered input-xs w-28 bg-base-100" />
            <span className="text-[11px] text-base-content/45">{t("so'm/dona")}</span>
            <button className="btn btn-ghost btn-xs text-error ml-auto" onClick={() => delRow(i)}>{t("O'chirish")}</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn btn-ghost btn-xs border border-white/15" onClick={addRow}>{t('+ Pog‘ona qo‘shish')}</button>
        <button className="btn btn-primary btn-xs" disabled={busy || rows.length === 0} onClick={save}>{t('Saqlash')}</button>
      </div>
    </AdminCard>
  );
}

function DeliveryCard({ delivery, onSaved }) {
  const { t } = useLanguage();
  const [minDays, setMinDays] = useState(delivery.minDays);
  const [maxDays, setMaxDays] = useState(delivery.maxDays);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMinDays(delivery.minDays); setMaxDays(delivery.maxDays); }, [delivery]);

  const save = async () => {
    setBusy(true);
    try { await adminApi('/company-settings/delivery', { method: 'POST', body: JSON.stringify({ minDays: Number(minDays), maxDays: Number(maxDays) }) }); await onSaved(); }
    finally { setBusy(false); }
  };

  return (
    <AdminCard title={t('Yetkazib berish muddati')}>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min="0" value={minDays} onChange={(e) => setMinDays(e.target.value)} className="input input-bordered input-xs w-16 bg-base-100" />
        <span className="text-[11px] text-base-content/45">—</span>
        <input type="number" min="0" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} className="input input-bordered input-xs w-16 bg-base-100" />
        <span className="text-[11px] text-base-content/45">{t('ish kuni')}</span>
        <button className="btn btn-primary btn-xs" disabled={busy} onClick={save}>{t('Saqlash')}</button>
      </div>
    </AdminCard>
  );
}

function CompanyPricingSubtab() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const load = () => adminApi('/company-settings').then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return <AdminLoading />;
  return (
    <div className="space-y-5">
      <LimitsTable title={t('Restoran menyusi — FREE/PRO limitlar')} subtitle={t('Har bir NFC ID darajasi uchun')} kind="menu" limits={data.menuLimits} onSaved={load} />
      <LimitsTable title={t('Mahsulotlar katalogi — FREE/PRO limitlar')} subtitle={t('Har bir NFC ID darajasi uchun')} kind="product" limits={data.productLimits} onSaved={load} />
      <PhysicalPricingCard tiers={data.physicalNfcTiers} onSaved={load} />
      <DeliveryCard delivery={data.delivery} onSaved={load} />
    </div>
  );
}

function CompaniesTab() {
  const { t, lang } = useLanguage();
  const cats = useCategories();
  const [sub, setSub] = useState('overview');
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [planFilter, setPlanFilter] = useState('all'); // all | free | pro
  const [typeFilter, setTypeFilter] = useState('all'); // all | menu | products | both
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | suspended
  const [openCode, setOpenCode] = useState(null);

  const load = () => adminApi('/companies').then((d) => setRows(d.companies || [])).catch(() => setRows([]));
  useEffect(() => { if (sub === 'list') load(); }, [sub]);

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
      <div className="flex flex-wrap gap-1.5">
        {COMPANY_SUBTABS.map(([v, l]) => (
          <button key={v} onClick={() => setSub(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${sub === v ? 'bg-accent text-accent-content' : 'border border-white/10 text-base-content/60 hover:text-base-content'}`}>
            {t(l)}
          </button>
        ))}
      </div>

      {sub === 'overview' && <CompaniesOverview />}

      {sub === 'list' && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Nomi, NFC ID yoki egasi bo'yicha qidirish...")}
              className="input input-bordered input-sm min-w-0 flex-1 bg-base-100 sm:max-w-xs" />
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="select select-bordered select-sm bg-base-100">
              <option value="all">{t('Barcha tariflar')}</option>
              <option value="free">FREE</option>
              <option value="pro">PRO</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="select select-bordered select-sm bg-base-100">
              <option value="all">{t('Barcha turlar')}</option>
              <option value="menu">{t('Restoran menyusi')}</option>
              <option value="products">{t('Mahsulotlar katalogi')}</option>
              <option value="both">{t('Ikkalasi ham')}</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select select-bordered select-sm bg-base-100">
              <option value="all">{t('Barcha holatlar')}</option>
              <option value="active">{t('Faol')}</option>
              <option value="suspended">{t('Bloklangan')}</option>
            </select>
          </div>

          {!rows && <AdminLoading />}
          {rows && filtered.length === 0 && <EmptyState icon="building" title={t('Hech qanday kompaniya topilmadi.')} />}
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
                  {filtered.map((r) => {
                    const menuStatus = companyModuleStatus(r.menuCatCount, r.menuItemCount);
                    const productStatus = companyModuleStatus(r.productCatCount, r.productItemCount);
                    return (
                      <tr key={r.code}>
                        <td>
                          <div className="font-semibold">{r.name} {r.verified && '✔️'}</div>
                          <div className="font-mono text-[11px] text-base-content/40">{r.code}</div>
                        </td>
                        <td className="text-xs">{r.ownerEmail || '—'}</td>
                        <td className="text-xs text-base-content/60">{catPath(cats, r.categorySlug, lang) || '—'}</td>
                        <td><StatusBadge tone={menuStatus.tone}>{t(menuStatus.text)}</StatusBadge></td>
                        <td><StatusBadge tone={productStatus.tone}>{t(productStatus.text)}</StatusBadge></td>
                        <td className="text-xs font-semibold">{t(TIER_LABEL[r.tier] || r.tier)}</td>
                        <td><StatusBadge tone={r.hiddenFromDirectory ? 'danger' : 'success'}>{r.hiddenFromDirectory ? t('Bloklangan') : t('Faol')}</StatusBadge></td>
                        <td className="text-xs text-base-content/50">{timeAgo(r.ts)}</td>
                        <td><button className="btn btn-ghost btn-xs" onClick={() => setOpenCode(r.code)}>{t('Batafsil')}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
  { index: 10, label: 'Security', icon: 'shield', superOnly: true },
  { index: 11, label: 'Adminlar', icon: 'usercheck', superOnly: true },
];

function Dashboard({ onLogout, role }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState(0);
  const logout = async () => { await adminApi('/logout', { method: 'POST' }); onLogout(); };
  const isSuperAdmin = role === 'super_admin';
  const nav = ADMIN_NAV.filter((n) => !n.superOnly || isSuperAdmin);

  return (
    <AdminShell
      nav={nav}
      activeIndex={tab}
      onSelect={setTab}
      title={t(TABS[tab] || 'Umumiy')}
      role={role}
      onLogout={logout}
    >
      <div>
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
        {tab === 10 && isSuperAdmin && <SecurityTab />}
        {tab === 11 && isSuperAdmin && <AdminsTab />}
        {tab === 12 && <GiftNfcIdTab />}
        {tab === 13 && <PromoCodesTab />}
        {tab === 14 && <NewsTab />}
        {tab === 15 && <CategoriesTab />}
        {tab === 16 && <VerificationTab />}
        {tab === 17 && <AuctionDemandTab />}
        {tab === 18 && isSuperAdmin && <FinanceTab />}
        {tab === 19 && <CompaniesTab />}
      </div>
    </AdminShell>
  );
}

export default function AdminPage() {
  const { t } = useLanguage();
  const [authed, setAuthed] = useState(undefined);
  const [role, setRole] = useState(null);
  const [expiredMsg, setExpiredMsg] = useState(null);

  useEffect(() => {
    adminApi('/me').then((d) => { setAuthed(d.authenticated); setRole(d.role); }).catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    const onExpired = (e) => {
      setExpiredMsg(e.detail === 'idle_timeout' ? t("Faoliyatsizlik tufayli sessiya tugadi (12 daqiqa). Qayta kiring.") : t("Sessiya tugadi. Qayta kiring."));
      setAuthed(false);
    };
    window.addEventListener('admin-session-expired', onExpired);
    return () => window.removeEventListener('admin-session-expired', onExpired);
  }, []);

  if (authed === undefined) return <main className="px-5 pt-16 text-center text-base-content/45">{t("Yuklanmoqda...")}</main>;
  if (!authed) return <AdminLogin onLoggedIn={() => { adminApi('/me').then((d) => { setAuthed(d.authenticated); setRole(d.role); }); setExpiredMsg(null); }} expiredMsg={expiredMsg} />;
  return <Dashboard onLogout={() => setAuthed(false)} role={role} />;
}
