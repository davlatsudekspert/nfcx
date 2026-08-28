import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { timeAgo } from '../lib/format.js';
import { dbListGiftOffers, dbListMySupportMessages, dbListWonPendingAuctions } from '../lib/db.js';

// Foydalanuvchi uchun umumiy Bildirishnomalar — sovg'a takliflari, admin
// javoblari va yutgan (to'lanmagan) auksionlar bitta joyda jamlanadi.
export default function NotificationsPage() {
  const { user } = useAuth();
  const [gifts, setGifts] = useState(null);
  const [support, setSupport] = useState(null);
  const [auctions, setAuctions] = useState(null);

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    dbListGiftOffers().then((d) => setGifts(d.incoming || [])).catch(() => setGifts([]));
    dbListMySupportMessages().then(setSupport).catch(() => setSupport([]));
    dbListWonPendingAuctions().then(setAuctions).catch(() => setAuctions([]));
  }, [user]);

  if (user === undefined || user === null) {
    return <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pt-16 text-center text-base-content/45">Yuklanmoqda...</main>;
  }

  const loading = gifts === null || support === null || auctions === null;
  const repliedSupport = (support || []).filter((m) => m.status === 'replied');
  const totalCount = (gifts?.length || 0) + repliedSupport.length + (auctions?.length || 0);

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          Bildirishnomalar
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Bildirishnomalar {totalCount > 0 && <span className="text-accent">({totalCount})</span>}</h1>
      </section>

      <section className="mt-8 max-w-2xl space-y-3">
        {loading && <div className="text-base-content/45">Yuklanmoqda...</div>}

        {!loading && totalCount === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-base-content/45">Hozircha bildirishnomangiz yo'q.</div>
        )}

        {gifts?.map((g) => (
          <div key={'gift' + g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
            <span>{'\u{1F381}'} <b className="font-mono">{g.code}</b> — <span className="text-base-content/60">{g.fromEmail}</span> sizga sovg'a qilmoqchi</span>
            <button className="btn btn-accent btn-xs" onClick={() => navigate('/account')}>Ko'rish</button>
          </div>
        ))}

        {auctions?.map((a) => (
          <div key={'auc' + a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <span>{'\u{1F3C6}'} <b className="font-mono">{a.code}</b> auksionida g'olib bo'ldingiz — to'lov kutilmoqda</span>
            <button className="btn btn-warning btn-xs" onClick={() => navigate('/auksion/' + a.id)}>To'lash</button>
          </div>
        ))}

        {repliedSupport.map((m) => (
          <div key={'sup' + m.id} className="rounded-xl border border-white/10 bg-base-200/50 px-4 py-3 text-sm">
            <div className="text-xs text-base-content/45">{timeAgo(new Date(m.createdAt).getTime())} murojaatingizga javob keldi</div>
            <p className="mt-1 text-base-content/70">{m.message}</p>
            <p className="mt-2 rounded-lg bg-accent/10 p-2 text-accent"><b>Admin:</b> {m.reply}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
