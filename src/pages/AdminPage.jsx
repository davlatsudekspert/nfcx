import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fmt, timeAgo, dateTime } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

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

const TABS = ['Umumiy', 'Statistika', 'Foydalanuvchilar', "Buyurtmalar", "To'lanishi kerak pullar", 'Auksionlar', "Auksion so'rovlari", 'Jismoniy kartalar', 'Bildirishnomalar', 'Tashqi analitika', 'Security', 'Adminlar', 'Gift NFC ID', 'Promokodlar', 'Yangiliklar', 'Kategoriyalar', 'Tasdiqlash'];

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-base-200/60 p-4">
      <div className="text-xs text-base-content/50">{label}</div>
      <div className="mt-1 text-xl font-extrabold">{value}</div>
    </div>
  );
}

function StatsTab() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [range, setRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    adminApi('/stats').then(setStats).catch(() => {});
    adminApi('/platform-wallet').then((d) => setWallet(d.balance)).catch(() => {});
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

  if (!stats) return <div className="text-base-content/45">{t("Yuklanmoqda...")}</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-base-200/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-base-content/50">{t("Davr:")}</span>
          {[['today', 'Bugun'], ['7d', '7 kun'], ['30d', '30 kun'], ['month', 'Shu oy'], ['custom', 'Custom']].map(([v, l]) => (
            <button key={v} className={`btn btn-xs ${range === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRange(v)}>{t(l)}</button>
          ))}
          {range === 'custom' && (
            <span className="flex items-center gap-1">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input input-bordered input-xs bg-base-100" />
              <span className="text-xs text-base-content/40">—</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input input-bordered input-xs bg-base-100" />
            </span>
          )}
        </div>
        <button className="btn btn-accent btn-sm" disabled={exporting} onClick={exportExcel}>
          {exporting ? <span className="loading loading-spinner loading-xs"></span> : t("\u{1F4E5} Excelga yuklab olish")}
        </button>
      </div>
      <div className="col-span-full rounded-xl border border-accent/40 bg-accent/10 p-4">
        <div className="text-xs text-base-content/50">{'\u{1F4B0}'} {t('Platforma daromadi (komissiyalar)')}</div>
        <div className="mt-1 text-2xl font-extrabold text-accent">{wallet === null ? '\u2014' : fmt(wallet)} {t("so'm")}</div>
        <p className="mt-1 text-xs text-base-content/45">{t("Auksion va premium obuna komissiyalaridan yig'ilgan real pul.")}</p>
      </div>
      <StatCard label={t("Foydalanuvchilar")} value={fmt(stats.userCount)} />
      <StatCard label={t("Band qilingan raqamli tashrif qog'ozlar")} value={fmt(stats.cardCount)} />
      <StatCard label={t("Jami raqamli tashrif qog'ozi savdosi")} value={fmt(stats.totalCardSalesValue) + " " + t("so'm")} />
      <StatCard label={t("Faol auksionlar")} value={fmt(stats.activeAuctions)} />
      <StatCard label={t("Kutilayotgan buyurtmalar")} value={fmt(stats.pendingWebOrders)} />
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
  if (!data) return <div className="text-base-content/45">{t("Yuklanmoqda...")}</div>;

  const breakdown = data.breakdown.map((b) => ({ ...b, label: t(KIND_LABEL[b.kind] || b.kind) }));

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm font-bold">{t("Platforma komissiyasi \u2014 kunlar bo'yicha (30 kun)")}</div>
        <div className="mt-3 h-64 rounded-xl border border-white/10 bg-base-200/40 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.commissionSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid #ffffff20', fontSize: 12 }} />
              <Line type="monotone" dataKey="total" name="Komissiya (so'm)" stroke="#f5a524" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="text-sm font-bold">{t("Yangi ro'yxatdan o'tishlar (30 kun)")}</div>
          <div className="mt-3 h-64 rounded-xl border border-white/10 bg-base-200/40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.signupsSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid #ffffff20', fontSize: 12 }} />
                <Bar dataKey="count" name="Ro'yxatdan o'tish" fill="#3abff8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold">{t("Band qilingan raqamli tashrif qog'ozlar (30 kun)")}</div>
          <div className="mt-3 h-64 rounded-xl border border-white/10 bg-base-200/40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cardsSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid #ffffff20', fontSize: 12 }} />
                <Bar dataKey="count" name="Band qilingan" fill="#36d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-bold">{t("Daromad turlari bo'yicha taqsimot")}</div>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="h-72 rounded-xl border border-white/10 bg-base-200/40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={breakdown} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={(e) => e.label}>
                  {breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid #ffffff20', fontSize: 12 }} formatter={(v) => fmt(v) + " so'm"} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead><tr><th>{t('Tur')}</th><th>{t('Soni')}</th><th>{t('Jami')}</th></tr></thead>
              <tbody>
                {breakdown.map((b) => (
                  <tr key={b.kind}>
                    <td>{b.label}</td>
                    <td>{fmt(b.count)}</td>
                    <td className="font-semibold">{fmt(b.total)} {t("so'm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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

  if (!users) return <div className="text-base-content/45">{t("Yuklanmoqda...")}</div>;
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

  if (!orders) return <div className="text-base-content/45">{t("Yuklanmoqda...")}</div>;
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
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ startPrice: '', buyNowPrice: '', hours: '24' });
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => adminApi('/auction-requests').then((d) => setRequests(d.requests));
  useEffect(() => { load(); }, []);

  const reject = async (id) => {
    if (!confirm(t("Bu so'rovni rad etasizmi?"))) return;
    setBusy(id);
    try { await adminApi(`/auction-requests/${id}/reject`, { method: 'POST' }); await load(); } finally { setBusy(null); }
  };

  const approve = async (id) => {
    const startPrice = Math.round(Number(form.startPrice));
    if (!startPrice || startPrice < 10_000) { setMsg({ type: 'err', text: t("Boshlang'ich narx kamida 10 000 so'm bo'lishi kerak.") }); return; }
    setBusy(id);
    setMsg(null);
    try {
      await adminApi(`/auction-requests/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          startPrice,
          buyNowPrice: form.buyNowPrice ? Math.round(Number(form.buyNowPrice)) : null,
          hours: Math.round(Number(form.hours) || 24),
        }),
      });
      setOpenId(null);
      setForm({ startPrice: '', buyNowPrice: '', hours: '24' });
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message === 'code_taken' ? t('Bu kod allaqachon band bo\u2019lib qolgan.') : t('Xatolik yuz berdi.') });
    } finally {
      setBusy(null);
    }
  };

  if (!requests) return <div className="text-base-content/45">{t("Yuklanmoqda...")}</div>;
  if (requests.length === 0) return <div className="text-base-content/45">{t("Hozircha so'rov yo'q.")}</div>;
  return (
    <div className="space-y-3">
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
              <button className="btn btn-success btn-xs" onClick={() => setOpenId(openId === r.id ? null : r.id)}>{t('Tasdiqlash')}</button>
              <button className="btn btn-ghost btn-xs text-error" disabled={busy === r.id} onClick={() => reject(r.id)}>{t('Rad etish')}</button>
            </div>
          </div>
          {openId === r.id && (
            <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-3">
              <input type="number" value={form.startPrice} onChange={(e) => setForm((f) => ({ ...f, startPrice: e.target.value }))} placeholder={t("Boshlang'ich narx")} className="input input-bordered input-sm bg-base-100" />
              <input type="number" value={form.buyNowPrice} onChange={(e) => setForm((f) => ({ ...f, buyNowPrice: e.target.value }))} placeholder={t("Darhol sotib olish (ixt.)")} className="input input-bordered input-sm bg-base-100" />
              <input type="number" max={72} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder={t("Soat")} className="input input-bordered input-sm bg-base-100" />
              <button className="btn btn-primary btn-sm sm:col-span-3" disabled={busy === r.id} onClick={() => approve(r.id)}>
                {busy === r.id ? <span className="loading loading-spinner loading-xs"></span> : t('Auksionni ochish')}
              </button>
              {msg && <div className={`alert py-2 text-sm sm:col-span-3 ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
            </div>
          )}
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

  if (!payouts) return <div className="text-base-content/45">{t("Yuklanmoqda...")}</div>;
  if (payouts.length === 0) return <div className="text-base-content/45">{t("Hozircha hech kimga to'lanishi kerak bo'lgan pul yo'q.")}</div>;
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
    <div className="mb-6 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-base-content/55">{t('Yangi auksion ochish')}</div>
      <p className="mt-1 text-xs text-base-content/45">{t("Faqat hali hech kimga tegishli bo'lmagan (bo'sh) kodlar uchun.")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
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

  if (!auctions) return <div className="text-base-content/45">{t("Yuklanmoqda...")}</div>;
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
        !ipData ? <div className="text-base-content/45">{t("Yuklanmoqda...")}</div> : (
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

  if (!admins) return <div className="text-base-content/45">{t("Yuklanmoqda...")}</div>;

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

  if (!messages) return <div className="text-base-content/45">{t("Yuklanmoqda...")}</div>;
  if (messages.length === 0) return <div className="text-base-content/45">{t("Hozircha murojaat yo'q.")}</div>;
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

  if (!cards) return <div className="text-base-content/45">{t("Yuklanmoqda...")}</div>;
  if (cards.length === 0) return <div className="text-base-content/45">{t("Hozircha jismoniy karta buyurtmasi yo'q.")}</div>;
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

  if (!rows) return <div className="text-base-content/45">{t('Yuklanmoqda...')}</div>;
  if (rows.length === 0) return <div className="text-base-content/45">{t('Hozircha promokod orqali hech kim qo‘shilmagan.')}</div>;

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

      {!rows && <div className="text-base-content/45">{t('Yuklanmoqda...')}</div>}
      {rows && rows.length === 0 && <div className="text-base-content/45">{t('Hozircha yangiliklar yo‘q.')}</div>}
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
                <div className="mt-0.5 text-[11px] text-base-content/40">{dateTime(new Date(n.createdAt).getTime())}</div>
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

      {!rows && <div className="text-base-content/45">{t('Yuklanmoqda...')}</div>}
      {rows && rows.length === 0 && <div className="text-base-content/45">{t('Hozircha kategoriya yo‘q.')}</div>}
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <div>
              <div className="font-semibold">{found.name} <span className="font-mono text-xs text-base-content/40">{found.code}</span></div>
              <div className="text-xs text-base-content/50">{found.role || '—'} · {found.verified ? t('Tasdiqlangan ✔') : t('Tasdiqlanmagan')}</div>
            </div>
            <button className={`btn btn-sm ${found.verified ? 'btn-ghost border border-white/15' : 'btn-primary'}`}
              disabled={busy} onClick={() => toggle(found.code, !found.verified)}>
              {found.verified ? t('Tasdiqni olib tashlash') : t('Tasdiqlash')}
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-bold">{t('Tasdiqlangan profillar')} {rows ? `(${rows.length})` : ''}</div>
        {!rows && <div className="mt-2 text-base-content/45">{t('Yuklanmoqda...')}</div>}
        {rows && rows.length === 0 && <div className="mt-2 text-base-content/45">{t('Hozircha tasdiqlangan profil yo‘q.')}</div>}
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

function Dashboard({ onLogout, role }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState(0);
  const logout = async () => { await adminApi('/logout', { method: 'POST' }); onLogout(); };
  const isSuperAdmin = role === 'super_admin';
  const visibleTabs = isSuperAdmin ? TABS : TABS.filter((tb) => tb !== 'Security' && tb !== 'Adminlar');
  // Ko'rsatiladigan indeks bilan haqiqiy TABS indeksi orasidagi moslik.
  const tabIndex = (label) => TABS.indexOf(label);

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <div className="flex items-center justify-between pt-10">
        <h1 className="text-2xl font-bold">{t("Admin panel")} {!isSuperAdmin && <span className="badge badge-ghost badge-sm align-middle">{role}</span>}</h1>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button className="btn btn-ghost btn-sm" onClick={logout}>{t("Chiqish")}</button>
        </div>
      </div>
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-white/10">
        {visibleTabs.map((label) => (
          <button key={label} onClick={() => setTab(tabIndex(label))}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === tabIndex(label) ? 'border-accent text-base-content' : 'border-transparent text-base-content/50 hover:text-base-content'}`}>
            {t(label)}
          </button>
        ))}
      </div>
      <div className="mt-6">
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
      </div>
    </main>
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
