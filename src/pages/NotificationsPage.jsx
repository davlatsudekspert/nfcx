import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { timeAgo } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import {
  dbListGiftOffers,
  dbListMySupportMessages,
  dbListWonPendingAuctions,
  dbListNotifications,
  dbMarkNotificationRead,
  dbMarkAllNotificationsRead,
} from '../lib/db.js';
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
  // IJTIMOIY BILDIRISHNOMALAR — ilova bilan BITTA manbadan.
  //
  // O'qildi holati backendda turadi, ya'ni telefonda o'qilgan xabar
  // bu yerda ham o'qilgan bo'lib ko'rinadi va aksincha. Mavjud uch
  // manba (sovg'a, admin javobi, auksion) O'ZGARMADI — bu ularning
  // YONIGA qo'shiladi.
  const [social, setSocial] = useState(null);
  const [unread, setUnread] = useState(0);
  const [err, setErr] = useState(false); // birorta so'rov muvaffaqiyatsiz → xato + qayta urinish

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  // Uchta manba: sovg'a takliflari, admin javoblari, yutgan auksionlar.
  // Har biri mustaqil; bittasi yiqilsa boshqalari ko'rsatiladi, ustida xato paneli.
  const load = () => {
    setErr(false);
    setGifts(null); setSupport(null); setAuctions(null); setSocial(null);
    dbListGiftOffers().then((d) => setGifts(Array.isArray(d?.incoming) ? d.incoming : [])).catch(() => { setGifts([]); setErr(true); });
    dbListMySupportMessages().then((rows) => setSupport(Array.isArray(rows) ? rows : [])).catch(() => { setSupport([]); setErr(true); });
    dbListWonPendingAuctions().then((rows) => setAuctions(Array.isArray(rows) ? rows : [])).catch(() => { setAuctions([]); setErr(true); });
    dbListNotifications().then((d) => {
      setSocial(Array.isArray(d?.items) ? d.items : []);
      setUnread(Number(d?.unreadCount) || 0);
    }).catch(() => { setSocial([]); setErr(true); });
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

  const loading = gifts === null || support === null || auctions === null || social === null;
  const repliedSupport = (support || []).filter((m) => m.status === 'replied');
  const totalCount = (gifts?.length || 0) + repliedSupport.length + (auctions?.length || 0) + (social?.length || 0);

  // Jumla SERVERDAN kelmaydi — `type` keladi va matn shu yerda,
  // foydalanuvchi tilida yig'iladi. Server tayyor matn yuborsa, u
  // yozilgan tilda muzlab qolardi.
  const socialText = (n) => {
    if (n.type === 'follow') return t('sizga obuna bo‘ldi');
    if (n.type === 'like') return t('postingizni yoqtirdi');
    if (n.type === 'comment') return t('postingizga izoh yozdi');
    return '';
  };

  // Nishon: obunada — obuna bo'lgan odamning profili; like va
  // izohda — post turgan profil. Saytda alohida post sahifasi yo'q,
  // postlar profil ichida. Kod bo'sh bo'lsa (yozuv o'chirilgan)
  // hech qayerga o'tilmaydi — sahifa yiqilmasligi kerak.
  const socialTarget = (n) => {
    const code = n.type === 'follow' ? n.actorCode : n.code;
    return code ? '/' + code : '';
  };

  const openSocial = async (n) => {
    if (!n.read) {
      setSocial((rows) => (rows || []).map((r) => (r.id === n.id ? { ...r, read: true } : r)));
      setUnread((u) => Math.max(0, u - 1));
      // Server javobi aniq sanoqni beradi — mahalliy taxmin emas.
      const res = await dbMarkNotificationRead(n.id).catch(() => null);
      if (res && typeof res.unreadCount === 'number') setUnread(res.unreadCount);
    }
    const to = socialTarget(n);
    if (to) navigate(to);
  };

  const markAll = async () => {
    setSocial((rows) => (rows || []).map((r) => ({ ...r, read: true })));
    setUnread(0);
    await dbMarkAllNotificationsRead().catch(() => {});
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] overflow-x-hidden px-5 sm:px-10 lg:px-14 pb-16">
      <BackToCabinet />
      <section className="pt-6">
        <span className="vz-kicker">{t('Kabinet')}</span>
        <h1 className="vz-h2 mt-3 flex items-center gap-2"><IconBell width={24} height={24} /> {t('Bildirishnomalar')} {totalCount > 0 && <span className="text-accent">({totalCount})</span>}</h1>
        {unread > 0 && (
          <button type="button" className="btn btn-ghost btn-sm mt-3 min-h-11" onClick={markAll}>
            {t('Hammasini o‘qildi')}
          </button>
        )}
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

        {social?.map((n) => (
          <button
            type="button"
            key={'soc' + n.id}
            onClick={() => openSocial(n)}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
              n.read
                ? 'border-base-content/10 bg-transparent'
                : 'border-accent/40 bg-accent/5'
            }`}
          >
            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
            <span className="min-w-0 flex-1 break-words">
              <b>{n.title || t('Foydalanuvchi')}</b> {socialText(n)}
            </span>
            <span className="shrink-0 text-xs text-base-content/45">
              {n.createdAt ? timeAgo(new Date(String(n.createdAt).replace(' ', 'T')).getTime()) : ''}
            </span>
          </button>
        ))}

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
