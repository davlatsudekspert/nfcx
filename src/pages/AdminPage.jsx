import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fmt, timeAgo, dateTime } from '../lib/format.js';

async function adminApi(path, options) {
  const res = await fetch('/api/admin' + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'api_error_' + res.status);
  return data;
}

// ---------- Login ----------

function AdminLogin({ onLoggedIn }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminApi('/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
      onLoggedIn();
    } catch (e2) {
      setErr(e2.message === 'admin_not_configured'
        ? "Admin panel hali sozlanmagan (ADMIN_PANEL_PHONE / ADMIN_PANEL_PASSWORD env o'zgaruvchilarini qo'shing)."
        : 'Login yoki parol xato.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-5">
      <div className="w-full rounded-2xl border border-white/10 bg-base-200/70 p-7">
        <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">NFCSTORE</div>
        <h1 className="mt-2 text-2xl font-bold">Admin panel</h1>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="form-control">
            <span className="text-xs font-semibold text-base-content/70">Telefon</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567"
              className="input input-bordered mt-1 w-full bg-base-100" />
          </label>
          <label className="form-control">
            <span className="text-xs font-semibold text-base-content/70">Parol</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="input input-bordered mt-1 w-full bg-base-100" />
          </label>
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-sm"></span> : 'Kirish'}
          </button>
        </form>
        {err && <div className="alert alert-error mt-4 py-2 text-sm"><span>{err}</span></div>}
      </div>
    </main>
  );
}

// ---------- Dashboard ----------

const TABS = ['Umumiy', 'Statistika', 'Foydalanuvchilar', "Buyurtmalar", "To'lanishi kerak pullar", 'Auksionlar', "Auksion so'rovlari", 'Jismoniy kartalar', 'Bildirishnomalar'];

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-base-200/60 p-4">
      <div className="text-xs text-base-content/50">{label}</div>
      <div className="mt-1 text-xl font-extrabold">{value}</div>
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState(null);
  const [wallet, setWallet] = useState(null);
  useEffect(() => {
    adminApi('/stats').then(setStats).catch(() => {});
    adminApi('/platform-wallet').then((d) => setWallet(d.balance)).catch(() => {});
  }, []);
  if (!stats) return <div className="text-base-content/45">Yuklanmoqda...</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="col-span-full rounded-xl border border-accent/40 bg-accent/10 p-4">
        <div className="text-xs text-base-content/50">{'\u{1F4B0}'} Platforma daromadi (komissiyalar)</div>
        <div className="mt-1 text-2xl font-extrabold text-accent">{wallet === null ? '\u2014' : fmt(wallet)} so'm</div>
        <p className="mt-1 text-xs text-base-content/45">Auksion va premium obuna komissiyalaridan yig'ilgan real pul.</p>
      </div>
      <StatCard label="Foydalanuvchilar" value={fmt(stats.userCount)} />
      <StatCard label="Band qilingan raqamli tashrif qog'ozlar" value={fmt(stats.cardCount)} />
      <StatCard label="Jami raqamli tashrif qog'ozi savdosi" value={fmt(stats.totalCardSalesValue) + " so'm"} />
      <StatCard label="Faol auksionlar" value={fmt(stats.activeAuctions)} />
      <StatCard label="Kutilayotgan buyurtmalar" value={fmt(stats.pendingWebOrders)} />
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
  const [data, setData] = useState(null);
  useEffect(() => { adminApi('/analytics').then(setData).catch(() => {}); }, []);
  if (!data) return <div className="text-base-content/45">Yuklanmoqda...</div>;

  const breakdown = data.breakdown.map((b) => ({ ...b, label: KIND_LABEL[b.kind] || b.kind }));

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm font-bold">Platforma komissiyasi {'\u2014'} kunlar bo'yicha (30 kun)</div>
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
          <div className="text-sm font-bold">Yangi ro'yxatdan o'tishlar (30 kun)</div>
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
          <div className="text-sm font-bold">Band qilingan raqamli tashrif qog'ozlar (30 kun)</div>
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
        <div className="text-sm font-bold">Daromad turlari bo'yicha taqsimot</div>
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
              <thead><tr><th>Tur</th><th>Soni</th><th>Jami</th></tr></thead>
              <tbody>
                {breakdown.map((b) => (
                  <tr key={b.kind}>
                    <td>{b.label}</td>
                    <td>{fmt(b.count)}</td>
                    <td className="font-semibold">{fmt(b.total)} so'm</td>
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
  const [list, setList] = useState(null);
  useEffect(() => { adminApi('/manual-adjustments').then((d) => setList(d.adjustments)).catch(() => {}); }, []);
  if (!list || list.length === 0) return null;
  const total = list.reduce((s, a) => s + a.amount, 0);
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold">
        {'\u26A0\uFE0F'} Qo'lda kiritilgan balans tuzatishlari
        <span className="badge badge-ghost badge-sm">Daromadga kirmaydi</span>
      </div>
      <p className="mt-1 text-xs text-base-content/45">
        Bu yozuvlar xodim tomonidan qo'lda kiritilgan (masalan sinov maqsadida) — real savdo/komissiya emas, shuning uchun yuqoridagi daromad grafigiga qo'shilmaydi. Jami: <b className={total >= 0 ? 'text-success' : 'text-error'}>{fmt(total)} so'm</b>.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>Foydalanuvchi</th><th>Summa</th><th>Izoh</th><th>Vaqt</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="text-xs">{a.email || `#${a.userId}`}</td>
                <td className={`font-semibold ${a.amount >= 0 ? 'text-success' : 'text-error'}`}>{a.amount >= 0 ? '+' : ''}{fmt(a.amount)} so'm</td>
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
  const [users, setUsers] = useState(null);
  const [adjustFor, setAdjustFor] = useState(null);
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

  if (!users) return <div className="text-base-content/45">Yuklanmoqda...</div>;
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr><th>Email</th><th>Telefon</th><th>Bot</th><th>Balans</th><th>Bandlangan</th><th>Kartalar</th><th>Ro'yxatdan o'tgan</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.isTest ? 'opacity-50' : ''}>
              <td>{u.email} {u.isTest && <span className="badge badge-ghost badge-xs ml-1">SINOV</span>}</td>
              <td className="font-mono text-xs">{u.phone || '—'}</td>
              <td>{u.botAck ? '\u2705' : '\u274C'}</td>
              <td className="font-semibold">{fmt(u.balance)}</td>
              <td className="text-base-content/50">{fmt(u.heldBalance)}</td>
              <td>{u.cardCount}</td>
              <td className="text-xs text-base-content/50">{timeAgo(new Date(u.createdAt).getTime())}</td>
              <td className="flex gap-1">
                <button className="btn btn-ghost btn-xs" onClick={() => setAdjustFor(u.id)}>Balansni tuzatish</button>
                <button className="btn btn-ghost btn-xs" disabled={toggleBusy === u.id} onClick={() => toggleTest(u)}>
                  {u.isTest ? 'Sinovdan chiqarish' : "Sinov deb belgilash"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adjustFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAdjustFor(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-base-200 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold">Balansni qo'lda tuzatish</div>
            <p className="mt-1 text-xs text-base-content/50">Musbat son — qo'shadi, manfiy son — ayiradi. Har doim audit jurnaliga yoziladi.</p>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="masalan 50000 yoki -20000"
              className="input input-bordered input-sm mt-3 w-full bg-base-100" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sabab (masalan: qo'lda Payme tasdiqlandi)"
              className="input input-bordered input-sm mt-2 w-full bg-base-100" />
            <div className="mt-3 flex gap-2">
              <button className="btn btn-primary btn-sm flex-1" onClick={submitAdjust} disabled={busy}>
                {busy ? <span className="loading loading-spinner loading-xs"></span> : 'Tasdiqlash'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAdjustFor(null)}>Bekor</button>
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

function OrdersTab() {
  const [orders, setOrders] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = () => adminApi('/orders').then((d) => setOrders(d.orders));
  useEffect(() => { load(); }, []);

  const confirmPayment = async (o) => {
    if (!confirm("To'lovni qo'lda tasdiqlaysizmi? Bu haqiqiy to'lov kelganini o'zingiz tekshirganingizni bildiradi.")) return;
    setBusy(o.id);
    try {
      const path = o.source === 'bot' ? `/bot-orders/${o.id}/confirm-payment` : `/orders/${o.id}/confirm-payment`;
      await adminApi(path, { method: 'POST' });
      await load();
    }
    catch { alert("Tasdiqlab bo'lmadi — buyurtma allaqachon ishlangan yoki topilmadi."); }
    finally { setBusy(null); }
  };

  if (!orders) return <div className="text-base-content/45">Yuklanmoqda...</div>;
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>Manba</th><th>Kod</th><th>Foydalanuvchi</th><th>Narx</th><th>Holat</th><th>Vaqt</th><th></th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.source + o.id}>
              <td><span className="badge badge-ghost badge-sm">{o.source === 'web' ? 'Sayt' : 'Bot'}</span></td>
              <td className="font-mono">{o.code}</td>
              <td className="text-xs">{o.source === 'bot' ? (o.tgUsername ? '@' + o.tgUsername : o.tgName) : ('#' + o.userId)}</td>
              <td>{fmt(o.amount)}</td>
              <td>{(() => { const st = ORDER_STATUS_LABEL[o.status] || { text: `Noma'lum holat (${o.status})`, cls: 'badge-ghost' }; return <span className={`badge badge-sm ${st.cls}`}>{st.text}</span>; })()}</td>
              <td className="text-xs text-base-content/50">{timeAgo(new Date(o.createdAt).getTime())}</td>
              <td>
                {o.status === 'pending' && (
                  <button className="btn btn-ghost btn-xs" disabled={busy === o.id} onClick={() => confirmPayment(o)}>
                    {busy === o.id ? <span className="loading loading-spinner loading-xs"></span> : "Qo'lda tasdiqlash"}
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
  const [requests, setRequests] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ startPrice: '', buyNowPrice: '', hours: '24' });
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => adminApi('/auction-requests').then((d) => setRequests(d.requests));
  useEffect(() => { load(); }, []);

  const reject = async (id) => {
    if (!confirm("Bu so'rovni rad etasizmi?")) return;
    setBusy(id);
    try { await adminApi(`/auction-requests/${id}/reject`, { method: 'POST' }); await load(); } finally { setBusy(null); }
  };

  const approve = async (id) => {
    const startPrice = Math.round(Number(form.startPrice));
    if (!startPrice || startPrice < 10_000) { setMsg({ type: 'err', text: "Boshlang'ich narx kamida 10 000 so'm bo'lishi kerak." }); return; }
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
      setMsg({ type: 'err', text: err.message === 'code_taken' ? 'Bu kod allaqachon band bo\u2019lib qolgan.' : 'Xatolik yuz berdi.' });
    } finally {
      setBusy(null);
    }
  };

  if (!requests) return <div className="text-base-content/45">Yuklanmoqda...</div>;
  if (requests.length === 0) return <div className="text-base-content/45">Hozircha so'rov yo'q.</div>;
  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div key={r.id} className="rounded-2xl border border-white/10 bg-base-200/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono text-sm font-bold">{r.code}</div>
              <div className="text-xs text-base-content/50">{r.userEmail} {'\u2014'} {timeAgo(new Date(r.createdAt).getTime())}</div>
              {r.note && <p className="mt-1 text-xs text-base-content/60">{'\u201C'}{r.note}{'\u201D'}</p>}
            </div>
            <div className="flex gap-1">
              <button className="btn btn-success btn-xs" onClick={() => setOpenId(openId === r.id ? null : r.id)}>Tasdiqlash</button>
              <button className="btn btn-ghost btn-xs text-error" disabled={busy === r.id} onClick={() => reject(r.id)}>Rad etish</button>
            </div>
          </div>
          {openId === r.id && (
            <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-3">
              <input type="number" value={form.startPrice} onChange={(e) => setForm((f) => ({ ...f, startPrice: e.target.value }))} placeholder="Boshlang'ich narx" className="input input-bordered input-sm bg-base-100" />
              <input type="number" value={form.buyNowPrice} onChange={(e) => setForm((f) => ({ ...f, buyNowPrice: e.target.value }))} placeholder="Darhol sotib olish (ixt.)" className="input input-bordered input-sm bg-base-100" />
              <input type="number" max={72} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="Soat" className="input input-bordered input-sm bg-base-100" />
              <button className="btn btn-primary btn-sm sm:col-span-3" disabled={busy === r.id} onClick={() => approve(r.id)}>
                {busy === r.id ? <span className="loading loading-spinner loading-xs"></span> : 'Auksionni ochish'}
              </button>
              {msg && <div className={`alert py-2 text-sm sm:col-span-3 ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}
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
  const [payouts, setPayouts] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = () => adminApi('/pending-payouts').then((d) => setPayouts(d.payouts));
  useEffect(() => { load(); }, []);

  const clear = async (userId, amount) => {
    if (!confirm(`${fmt(amount)} so'mni qo'lda to'laganingizni tasdiqlaysizmi?`)) return;
    setBusy(userId);
    try { await adminApi(`/pending-payouts/${userId}/clear`, { method: 'POST', body: JSON.stringify({ amount }) }); await load(); } finally { setBusy(null); }
  };

  if (!payouts) return <div className="text-base-content/45">Yuklanmoqda...</div>;
  if (payouts.length === 0) return <div className="text-base-content/45">Hozircha hech kimga to'lanishi kerak bo'lgan pul yo'q.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>Email</th><th>Telefon</th><th>To'lanishi kerak</th><th></th></tr></thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td>{p.email}</td>
              <td className="font-mono text-xs">{p.phone || '—'}</td>
              <td className="font-semibold">{fmt(p.pendingPayout)} so'm</td>
              <td>
                <button className="btn btn-success btn-xs" disabled={busy === p.id} onClick={() => clear(p.id, p.pendingPayout)}>
                  To'landi deb belgilash
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
  const [form, setForm] = useState({ code: '', startPrice: '', buyNowPrice: '', hours: '24' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async () => {
    const code = form.code.trim().toUpperCase();
    const startPrice = Math.round(Number(form.startPrice));
    const buyNowPrice = form.buyNowPrice ? Math.round(Number(form.buyNowPrice)) : null;
    const hours = Math.min(72, Math.max(1, Math.round(Number(form.hours) || 24)));
    if (!code) { setMsg({ type: 'err', text: 'Kodni kiriting (masalan VIP001).' }); return; }
    if (!startPrice || startPrice < 10_000) { setMsg({ type: 'err', text: "Boshlang'ich narx kamida 10 000 so'm bo'lishi kerak." }); return; }
    setBusy(true);
    setMsg(null);
    try {
      await adminApi('/auctions', { method: 'POST', body: JSON.stringify({ code, startPrice, buyNowPrice, hours }) });
      setMsg({ type: 'ok', text: `${code} uchun auksion ochildi!` });
      setForm({ code: '', startPrice: '', buyNowPrice: '', hours: '24' });
      onCreated?.();
    } catch (err) {
      setMsg({ type: 'err', text: err.message === 'code_taken' ? 'Bu kod allaqachon band.' : err.message === 'already_in_auction' ? 'Bu kod allaqachon auksionda.' : 'Xatolik yuz berdi.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-base-content/55">Yangi auksion ochish</div>
      <p className="mt-1 text-xs text-base-content/45">Faqat hali hech kimga tegishli bo'lmagan (bo'sh) kodlar uchun.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="Kod (VIP001)" className="input input-bordered input-sm bg-base-100 font-mono" />
        <input type="number" value={form.startPrice} onChange={(e) => setForm((f) => ({ ...f, startPrice: e.target.value }))} placeholder="Boshlang'ich narx" className="input input-bordered input-sm bg-base-100" />
        <input type="number" value={form.buyNowPrice} onChange={(e) => setForm((f) => ({ ...f, buyNowPrice: e.target.value }))} placeholder="Darhol sotib olish (ixt.)" className="input input-bordered input-sm bg-base-100" />
        <input type="number" max={72} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="Soat (maks. 72)" className="input input-bordered input-sm bg-base-100" />
      </div>
      <button className="btn btn-primary btn-sm mt-3" onClick={submit} disabled={busy}>
        {busy ? <span className="loading loading-spinner loading-xs"></span> : 'Auksion ochish'}
      </button>
      {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}
    </div>
  );
}

function AuctionsTab() {
  const [auctions, setAuctions] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => adminApi('/auctions').then((d) => setAuctions(d.auctions));
  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!confirm("Bu auksionni bekor qilishni tasdiqlaysizmi? Barcha bandlangan mablag'lar bo'shatiladi.")) return;
    setBusy(id);
    try { await adminApi(`/auctions/${id}/cancel`, { method: 'POST' }); await load(); } finally { setBusy(null); }
  };
  const forceSettle = async (id) => {
    if (!confirm("Bu auksionni muddatidan oldin yakunlashni tasdiqlaysizmi?")) return;
    setBusy(id);
    try { await adminApi(`/auctions/${id}/force-settle`, { method: 'POST' }); await load(); } finally { setBusy(null); }
  };

  if (!auctions) return <div className="text-base-content/45">Yuklanmoqda...</div>;
  return (
    <div>
      <CreateAuctionForm onCreated={load} />
      <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>Kod</th><th>Joriy narx</th><th>Yetakchi</th><th>Holat</th><th>Tugash</th><th></th></tr></thead>
        <tbody>
          {auctions.map((a) => (
            <tr key={a.id}>
              <td className="font-mono">{a.code}</td>
              <td>{fmt(a.currentPrice)}</td>
              <td className="text-xs">{a.highestBidderEmail || '—'}</td>
              <td><span className={`badge badge-sm ${a.status === 'active' ? 'badge-success' : a.status === 'sold' ? 'badge-accent' : 'badge-ghost'}`}>{a.status}</span></td>
              <td className="text-xs text-base-content/50">{dateTime(new Date(a.endsAt).getTime())}</td>
              <td>
                {a.status === 'active' && (
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-xs" disabled={busy === a.id} onClick={() => forceSettle(a.id)}>Yakunlash</button>
                    <button className="btn btn-ghost btn-xs text-error" disabled={busy === a.id} onClick={() => cancel(a.id)}>Bekor qilish</button>
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
function NotificationsTab() {
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

  if (!messages) return <div className="text-base-content/45">Yuklanmoqda...</div>;
  if (messages.length === 0) return <div className="text-base-content/45">Hozircha murojaat yo'q.</div>;
  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <div key={m.id} className={`rounded-2xl border p-4 ${m.status === 'pending' ? 'border-warning/40 bg-warning/5' : 'border-white/10 bg-base-200/50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-base-content/50">{m.userEmail} — {timeAgo(new Date(m.createdAt).getTime())}</div>
            {m.status === 'pending' && <span className="badge badge-warning badge-sm">Kutilmoqda</span>}
          </div>
          <p className="mt-2 text-sm">{m.message}</p>
          {m.reply && <p className="mt-2 rounded-lg bg-accent/10 p-2 text-sm text-accent"><b>Javobingiz:</b> {m.reply}</p>}
          {m.status === 'pending' && (
            replyFor === m.id ? (
              <div className="mt-3 flex gap-2">
                <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Javob yozing..." className="input input-bordered input-sm flex-1 bg-base-100" />
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => sendReply(m.id)}>Yuborish</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setReplyFor(null)}>Bekor</button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-xs mt-2" onClick={() => { setReplyFor(m.id); setReplyText(''); }}>Javob berish</button>
            )
          )}
        </div>
      ))}
    </div>
  );
}

function PhysicalCardsTab() {
  const [cards, setCards] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = () => adminApi('/physical-cards').then((d) => setCards(d.cards));
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    await adminApi(`/physical-cards/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    await load();
  };

  const toggleActive = async (c) => {
    if (c.active && !confirm(`${c.linkedCode} kartasini bloklaysizmi? Ko'rinmas havola (chip_token) endi profilni ochmaydi.`)) return;
    setBusy(c.id);
    try {
      await adminApi(`/physical-cards/${c.id}/active`, { method: 'POST', body: JSON.stringify({ active: !c.active }) });
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!cards) return <div className="text-base-content/45">Yuklanmoqda...</div>;
  if (cards.length === 0) return <div className="text-base-content/45">Hozircha jismoniy karta buyurtmasi yo'q.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>Profil</th><th>Egasi</th><th>Manzil</th><th>Faolmi</th><th>Holat</th><th></th></tr></thead>
        <tbody>
          {cards.map((c) => (
            <tr key={c.id}>
              <td className="font-mono">{c.linkedCode || '—'}</td>
              <td className="text-xs">{c.ownerEmail}<br />{c.shippingPhone}</td>
              <td className="max-w-xs truncate text-xs">{c.shippingAddress}</td>
              <td>{c.active ? '\u2705' : '\u274C bloklangan'}</td>
              <td>
                <select className="select select-bordered select-xs" value={c.status} onChange={(e) => setStatus(c.id, e.target.value)}>
                  {CARD_STATUS.map((s) => <option key={s} value={s}>{CARD_STATUS_LABEL[s]}</option>)}
                </select>
              </td>
              <td>
                <button
                  className={`btn btn-xs ${c.active ? 'btn-error' : 'btn-success'}`}
                  disabled={busy === c.id || !c.linkedCode}
                  onClick={() => toggleActive(c)}
                >
                  {busy === c.id ? <span className="loading loading-spinner loading-xs"></span> : (c.active ? 'Bloklash' : 'Blokdan chiqarish')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const [tab, setTab] = useState(0);
  const logout = async () => { await adminApi('/logout', { method: 'POST' }); onLogout(); };

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <div className="flex items-center justify-between pt-10">
        <h1 className="text-2xl font-bold">Admin panel</h1>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Chiqish</button>
      </div>
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-white/10">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === i ? 'border-accent text-base-content' : 'border-transparent text-base-content/50 hover:text-base-content'}`}>
            {t}
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
      </div>
    </main>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(undefined);

  useEffect(() => {
    adminApi('/me').then((d) => setAuthed(d.authenticated)).catch(() => setAuthed(false));
  }, []);

  if (authed === undefined) return <main className="px-5 pt-16 text-center text-base-content/45">Yuklanmoqda...</main>;
  if (!authed) return <AdminLogin onLoggedIn={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => setAuthed(false)} />;
}
