import { useEffect, useState } from 'react';
import { dbListPayments, dbListWonPendingAuctions } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { fmt, dateTime } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import { PAYMENTS_ENABLED } from '../lib/features.js';
import PaymentUnavailableNotice from '../components/PaymentUnavailableNotice.jsx';
import BackToCabinet from '../components/BackToCabinet.jsx';

const KIND_LABEL = {
  card_purchase: "Raqamli tashrif qog'ozi xaridi",
  physical_card_order: 'Jismoniy NFC karta',
  auction_payment: "Auksion to'lovi",
  premium_upgrade: "Premium profilga o'tish",
  premium_follow: 'Premium obuna',
};

const STATUS_LABEL = {
  paid: { text: "To'landi", cls: 'badge-success' },
  pending: { text: 'Kutilmoqda', cls: 'badge-warning' },
  cancelled: { text: 'Bekor qilindi', cls: 'badge-ghost' },
  failed_code_taken: { text: 'Xatolik', cls: 'badge-error' },
};

export default function PaymentsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [wonAuctions, setWonAuctions] = useState([]);

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    dbListPayments().then(setData).catch(() => setData({ payments: [], pendingPayout: 0 }));
    fetch('/api/orders', { credentials: 'same-origin' })
      .then((r) => r.json()).then((d) => setOrders(Array.isArray(d.orders) ? d.orders : []))
      .catch(() => setOrders([]));
    dbListWonPendingAuctions().then(setWonAuctions).catch(() => setWonAuctions([]));
  }, [user]);

  if (user === undefined || user === null) {
    return <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pt-16 text-center text-base-content/45">{t('Yuklanmoqda...')}</main>;
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const hasPending = pendingOrders.length > 0 || wonAuctions.length > 0;
  const paidTotal = (data?.payments || []).filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.price || 0), 0);

  const card = 'rounded-2xl border border-white/10 bg-base-200/40 p-5';

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 sm:px-10 lg:px-14 pb-16">
      <BackToCabinet />
      <h1 className="pt-4 text-2xl font-bold">{t("To'lov")}</h1>
      <p className="mt-2 text-sm text-base-content/55">{t("To'lov usuli, kutilayotgan to'lovlar va barcha tranzaksiyalar tarixi.")}</p>

      {/* ── To'lov usuli ── */}
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-base-content/45">{t("To'lov usuli")}</h2>
        {PAYMENTS_ENABLED ? (
          <div className={card}>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-[#33c8b6] px-2.5 py-1 text-sm font-extrabold text-white">Payme</span>
              <span className="badge badge-success badge-sm">{t('Faol')}</span>
            </div>
            <p className="mt-2 text-sm text-base-content/55">{t("To'lovlar Payme orqali xavfsiz amalga oshiriladi.")}</p>
          </div>
        ) : (
          <PaymentUnavailableNotice />
        )}
      </section>

      {/* ── Umumiy ko'rsatkichlar ── */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className={card}>
          <div className="text-xs text-base-content/45">{t("Jami to'langan")}</div>
          <div className="mt-1 text-lg font-extrabold">{t("{n} so'm", { n: fmt(paidTotal) })}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-base-content/45">{t('Kutilayotgan')}</div>
          <div className="mt-1 text-lg font-extrabold">{pendingOrders.length + wonAuctions.length}</div>
        </div>
        {data && data.pendingPayout > 0 && (
          <div className={`${card} !border-accent/30 !bg-accent/5`}>
            <div className="text-xs text-accent/80">{t("Sizga to'lanadi")}</div>
            <div className="mt-1 text-lg font-extrabold text-accent">{t("{n} so'm", { n: fmt(data.pendingPayout) })}</div>
          </div>
        )}
      </section>

      {data && data.pendingPayout > 0 && (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <div className="text-sm font-bold text-accent">{t('Sizga to‘lanishi kerak: {n} so‘m', { n: fmt(data.pendingPayout) })}</div>
          <p className="mt-1 text-xs text-base-content/50">{t("Bu — premium obunachilaringizdan yig'ilgan mablag'. Admin tez kunlarda Payme/karta raqamingizga qo'lda o'tkazadi.")}</p>
        </div>
      )}

      {/* ── Kutilayotgan to'lovlar ── */}
      {hasPending && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-base-content/45">{t("Kutilayotgan to'lovlar")}</h2>
          <div className="space-y-2">
            {wonAuctions.map((a) => (
              <div key={'a' + a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{t("Auksion to'lovi")} · <span className="font-mono">{a.code}</span></div>
                  <div className="text-xs text-base-content/55">{t("{n} so'm", { n: fmt(a.currentPrice) })}</div>
                </div>
                {PAYMENTS_ENABLED
                  ? <button className="btn btn-warning btn-xs" onClick={() => navigate('/auksion/' + a.id)}>{t("To'lash")}</button>
                  : <button className="btn btn-xs btn-disabled !cursor-not-allowed opacity-60" disabled>{t("To'lash")}</button>}
              </div>
            ))}
            {pendingOrders.map((o) => (
              <div key={'o' + o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{t(KIND_LABEL[o.kind] || o.kind)}{o.code ? <> · <span className="font-mono">{o.code}</span></> : null}</div>
                  <div className="text-xs text-base-content/55">{t("{n} so'm", { n: fmt(o.price) })}</div>
                </div>
                <span className="badge badge-warning badge-sm">{t('Kutilmoqda')}</span>
              </div>
            ))}
          </div>
          {!PAYMENTS_ENABLED && <div className="mt-2"><PaymentUnavailableNotice compact /></div>}
        </section>
      )}

      {/* ── Tranzaksiya tarixi ── */}
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-base-content/45">{t('Tranzaksiya tarixi')}</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="table table-sm">
            <thead><tr><th>{t('Turi')}</th><th>{t('Kod')}</th><th>{t('Summa')}</th><th>{t('Holat')}</th><th>{t('Sana')}</th></tr></thead>
            <tbody>
              {!data && (
                <tr><td colSpan={5} className="py-8 text-center text-base-content/45">{t('Yuklanmoqda...')}</td></tr>
              )}
              {data && data.payments.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-base-content/45">{t("Hozircha to'lovlar yo'q.")}</td></tr>
              )}
              {data && data.payments.map((p) => {
                const st = STATUS_LABEL[p.status] || { text: p.status, cls: 'badge-ghost' };
                return (
                  <tr key={p.id}>
                    <td>{t(KIND_LABEL[p.kind] || p.kind)}</td>
                    <td className="font-mono text-xs">{p.code && p.code !== 'PREMIUM' && p.code !== 'FOLLOW' ? p.code : '—'}</td>
                    <td className="font-semibold">{t("{n} so'm", { n: fmt(p.price) })}</td>
                    <td><span className={`badge badge-sm ${st.cls}`}>{t(st.text)}</span></td>
                    <td className="text-xs text-base-content/50">{dateTime(new Date(p.createdAt).getTime())}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
