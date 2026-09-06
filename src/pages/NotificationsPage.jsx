import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { timeAgo } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import { dbListGiftOffers, dbListMySupportMessages, dbListWonPendingAuctions } from '../lib/db.js';
import BackToCabinet from '../components/BackToCabinet.jsx';
import { IconBell, IconStar, IconSupport, IconTag } from '../components/Icons.jsx';

// Foydalanuvchi uchun umumiy Bildirishnomalar — sovg'a takliflari, admin
// javoblari va yutgan (to'lanmagan) auksionlar bitta joyda jamlanadi.
export default function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [gifts, setGifts] = useState(null);
  const [support, setSupport] = useState(null);
  const [auctions, setAuctions] = useState(null);
  const [err, setErr] = useState(false); // birorta so'rov muvaffaqiyatsiz → xato + qayta urinish

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  // Uchta manba: sovg'a takliflari, admin javoblari, yutgan auksionlar.
  // Har biri mustaqil; bittasi yiqilsa boshqalari ko'rsatiladi, ustida xato paneli.
  const load = () => {
    setErr(false);
    setGifts(null); setSupport(null); setAuctions(null);
    dbListGiftOffers().then((d) => setGifts(Array.isArray(d?.incoming) ? d.incoming : [])).catch(() => { setGifts([]); setErr(true); });
    dbListMySupportMessages().then((rows) => setSupport(Array.isArray(rows) ? rows : [])).catch(() => { setSupport([]); setErr(true); });
    dbListWonPendingAuctions().then((rows) => setAuctions(Array.isArray(rows) ? rows : [])).catch(() => { setAuctions([]); setErr(true); });
  };
  useEffect(() => { if (user) load(); }, [user]);

  if (user === undefined || user === null) {
    return (
      <main className="mx-auto w-full max-w-[1800px] px-5 sm:px-10 lg:px-14 pt-16" aria-busy="true">
        <div className="vz-skel h-6 w-40"></div>
        <div className="mt-6 max-w-2xl space-y-3"><div className="vz-skel h-14 w-full"></div><div className="vz-skel h-14 w-full"></div></div>
      </main>
    );
  }

  const loading = gifts === null || support === null || auctions === null;
  const repliedSupport = (support || []).filter((m) => m.status === 'replied');
  const totalCount = (gifts?.length || 0) + repliedSupport.length + (auctions?.length || 0);

  return (
    <main className="mx-auto w-full max-w-[1800px] overflow-x-hidden px-5 sm:px-10 lg:px-14 pb-16">
      <BackToCabinet />
      <section className="pt-6">
        <span className="vz-kicker">{t('Kabinet')}</span>
        <h1 className="vz-h2 mt-3 flex items-center gap-2"><IconBell width={24} height={24} /> {t('Bildirishnomalar')} {totalCount > 0 && <span className="text-accent">({totalCount})</span>}</h1>
      </section>

      <section className="mt-8 max-w-2xl space-y-3">
        {loading && (
          <div className="space-y-2" aria-busy="true">
            <div className="vz-skel h-14 w-full"></div><div className="vz-skel h-14 w-full"></div><div className="vz-skel h-14 w-full"></div>
          </div>
        )}

        {!loading && err && (
          <div className="vz-empty !border-error/40">
            <div className="text-sm text-base-content/70">{t("Server bilan aloqa yo'q. Qayta urinib ko'ring.")}</div>
            <button type="button" className="btn btn-outline-gold btn-sm min-h-11" onClick={load}>{t('Qayta urinish')}</button>
          </div>
        )}

        {!loading && !err && totalCount === 0 && (
          <div className="vz-empty"><span className="text-base-content/40"><IconBell width={28} height={28} /></span><span className="text-sm">{t("Hozircha bildirishnomangiz yo'q.")}</span></div>
        )}

        {gifts?.map((g) => (
          <div key={'gift' + g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5"><span className="vz-badge vz-badge--gold"><IconTag width={12} height={12} /> {t("Sovg'a")}</span> <b className="font-mono">{g.code}</b> — <span className="break-all text-base-content/60">{g.fromEmail}</span> {t('sizga sovg‘a qilmoqchi')}</span>
            <button className="btn btn-gold btn-xs min-h-11" onClick={() => navigate('/account')}>{t("Ko'rish")}</button>
          </div>
        ))}

        {auctions?.map((a) => (
          <div key={'auc' + a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5"><span className="vz-badge vz-badge--warn"><IconStar width={12} height={12} /> {t('Auksion')}</span> <b className="font-mono">{a.code}</b> {t("auksionida g'olib bo'ldingiz — to'lov kutilmoqda")}</span>
            <button className="btn btn-gold btn-xs min-h-11" onClick={() => navigate('/auksion/' + a.id)}>{t("To'lash")}</button>
          </div>
        ))}

        {repliedSupport.map((m) => (
          <div key={'sup' + m.id} className="vz-card px-4 py-3 text-sm">
            <div className="flex items-center gap-1.5 text-xs text-base-content/45"><IconSupport width={12} height={12} /> {t('{when} murojaatingizga javob keldi', { when: timeAgo(new Date(m.createdAt).getTime()) })}</div>
            <p className="mt-1 break-words text-base-content/70">{m.message}</p>
            <p className="mt-2 break-words rounded-lg bg-accent/10 p-2 text-accent"><b>{t('Admin')}:</b> {m.reply}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
