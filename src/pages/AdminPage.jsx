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

const TABS = ['Umumiy', 'Statistika', 'Foydalanuvchilar', "Buyurtmalar", "To'lanishi kerak pullar", 'Auksionlar', 'Jismoniy kartalar'];

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
        <div className="text-sm font-bold">Platforma komissiyasi \u2014 kunlar bo'yicha (30 kun)</div>
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
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState(null);
  const [adjustFor, setAdjustFor] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => adminApi('/users').then((d) => setUsers(d.users));
  useEffect(() => { load(); }, []);

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
            <tr key={u.id}>
              <td>{u.email}</td>
              <td className="font-mono text-xs">{u.phone || '—'}</td>
              <td>{u.botAck ? '\u2705' : '\u274C'}</td>
              <td className="font-semibold">{fmt(u.balance)}</td>
              <td className="text-base-content/50">{fmt(u.heldBalance)}</td>
              <td>{u.cardCount}</td>
              <td className="text-xs text-base-content/50">{timeAgo(new Date(u.createdAt).getTime())}</td>
              <td>
                <button className="btn btn-ghost btn-xs" onClick={() => setAdjustFor(u.id)}>Balansni tuzatish</button>
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

function OrdersTab() {
  const [orders, setOrders] = useState(null);
  useEffect(() => { adminApi('/orders').then((d) => setOrders(d.orders)); }, []);
  if (!orders) return <div className="text-base-content/45">Yuklanmoqda...</div>;
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>Manba</th><th>Kod</th><th>Foydalanuvchi</th><th>Narx</th><th>Holat</th><th>Vaqt</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.source + o.id}>
              <td><span className="badge badge-ghost badge-sm">{o.source === 'web' ? 'Sayt' : 'Bot'}</span></td>
              <td className="font-mono">{o.code}</td>
              <td className="text-xs">{o.source === 'bot' ? (o.tgUsername ? '@' + o.tgUsername : o.tgName) : ('#' + o.userId)}</td>
              <td>{fmt(o.amount)}</td>
              <td><span className={`badge badge-sm ${o.status === 'paid' ? 'badge-success' : o.status === 'pending' ? 'badge-warning' : 'badge-ghost'}`}>{o.status}</span></td>
              <td className="text-xs text-base-content/50">{timeAgo(new Date(o.createdAt).getTime())}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

function PhysicalCardsTab() {
  const [cards, setCards] = useState(null);
  const load = () => adminApi('/physical-cards').then((d) => setCards(d.cards));
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    await adminApi(`/physical-cards/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    await load();
  };

  if (!cards) return <div className="text-base-content/45">Yuklanmoqda...</div>;
  if (cards.length === 0) return <div className="text-base-content/45">Hozircha jismoniy karta buyurtmasi yo'q.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>Profil</th><th>Egasi</th><th>Manzil</th><th>Faolmi</th><th>Holat</th></tr></thead>
        <tbody>
          {cards.map((c) => (
            <tr key={c.id}>
              <td className="font-mono">{c.linkedCode || '—'}</td>
              <td className="text-xs">{c.ownerEmail}<br />{c.shippingPhone}</td>
              <td className="max-w-xs truncate text-xs">{c.shippingAddress}</td>
              <td>{c.active ? '\u2705' : '\u274C deaktiv'}</td>
              <td>
                <select className="select select-bordered select-xs" value={c.status} onChange={(e) => setStatus(c.id, e.target.value)}>
                  {CARD_STATUS.map((s) => <option key={s} value={s}>{CARD_STATUS_LABEL[s]}</option>)}
                </select>
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
        {tab === 6 && <PhysicalCardsTab />}
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
