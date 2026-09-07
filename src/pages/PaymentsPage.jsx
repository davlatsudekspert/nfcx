import { useEffect, useState } from 'react';
import { dbListPayments, dbListWonPendingAuctions, dbListMyOrders } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { fmt, dateTime } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import { usePaymentsInfo } from '../lib/paymentsEnabled.jsx';
import PaymentUnavailableNotice from '../components/PaymentUnavailableNotice.jsx';
import PayQr from '../components/PayQr.jsx';
import BackToCabinet from '../components/BackToCabinet.jsx';
import { IconBag } from '../components/Icons.jsx';

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
  const { enabled: PAYMENTS_ENABLED, sandbox: paymentsSandbox } = usePaymentsInfo();
  const [data, setData] = useState(null);       // null = yuklanmoqda
  const [dataErr, setDataErr] = useState(false);
  const [orders, setOrders] = useState([]);
  const [wonAuctions, setWonAuctions] = useState([]);
  const [pendingErr, setPendingErr] = useState(false);

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  const loadHistory = () => {
    setDataErr(false); setData(null);
    dbListPayments()
      .then((d) => setData({ payments: Array.isArray(d?.payments) ? d.payments : [], pendingPayout: Number(d?.pendingPayout || 0) }))
      .catch(() => { setData({ payments: [], pendingPayout: 0 }); setDataErr(true); });
  };
  const loadPending = () => {
    setPendingErr(false);
    dbListMyOrders().then(setOrders).catch(() => { setOrders([]); setPendingErr(true); });
    dbListWonPendingAuctions().then((rows) => setWonAuctions(Array.isArray(rows) ? rows : [])).catch(() => { setWonAuctions([]); setPendingErr(true); });
  };
  useEffect(() => {
    if (!user) return;
    loadHistory();
    loadPending();
  }, [user]);

  if (user === undefined || user === null) {
    return (
      <main className="mx-auto w-full max-w-[900px] px-5 sm:px-10 lg:px-14 pt-16" aria-busy="true">
        <div className="vz-skel h-6 w-40"></div>
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="vz-skel h-20 w-full"></div><div className="vz-skel h-20 w-full"></div></div>
        <div className="mt-6 vz-skel h-40 w-full"></div>
      </main>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const hasPending = pendingOrders.length > 0 || wonAuctions.length > 0;
  const paidTotal = (data?.payments || []).filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.price || 0), 0);

  const card = 'vz-card min-w-0 p-5';

  return (
    <main className="mx-auto w-full max-w-[900px] overflow-x-hidden px-5 sm:px-10 lg:px-14 pb-16">
      <BackToCabinet />
      <span className="mt-4 block"><span className="vz-kicker">{t('Kabinet')}</span></span>
      <h1 className="vz-h2 mt-3 flex items-center gap-2"><IconBag width={24} height={24} /> {t("To'lov")}</h1>
      <p className="mt-3 text-sm text-base-content/55">{t("To'lov usuli, kutilayotgan to'lovlar va barcha tranzaksiyalar tarixi.")}</p>

      {/* ── To'lov usuli ── */}
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-base-content/45">{t("To'lov usuli")}</h2>
        {PAYMENTS_ENABLED ? (
          <div className={card}>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-[#33c8b6] px-2.5 py-1 text-sm font-extrabold text-white">Payme</span>
              <span className="vz-badge vz-badge--ok">{t('Faol')}</span>
              {/* 2026-09: "Sinov (sandbox)" avval QATTIQ YOZILGAN edi va
                  Payme real rejimga o'tgach ham qolib ketardi. Endi u ham
                  backend'dagi yagona manbadan (/api/settings/payments-enabled
                  -> sandbox) keladi. */}
              {paymentsSandbox && <span className="vz-badge vz-badge--muted">{t('Sinov (sandbox)')}</span>}
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
      {pendingErr && (
        <section className="mt-6">
          <div className="vz-empty !border-error/40">
            <div className="text-sm text-base-content/70">{t("Kutilayotgan to'lovlarni yuklab bo'lmadi.")}</div>
            <button type="button" className="btn btn-outline-gold btn-sm min-h-11" onClick={loadPending}>{t('Qayta urinish')}</button>
          </div>
        </section>
      )}
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
                  ? <button className="btn btn-gold btn-xs min-h-11" onClick={() => navigate('/auksion/' + a.id)}>{t("To'lash")}</button>
                  : <button className="btn btn-xs min-h-11 btn-disabled !cursor-not-allowed opacity-60" disabled>{t("To'lash")}</button>}
              </div>
            ))}
            {pendingOrders.map((o) => (
              <div key={'o' + o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{t(KIND_LABEL[o.kind] || o.kind)}{o.code ? <> · <span className="font-mono">{o.code}</span></> : null}</div>
                  <div className="text-xs text-base-content/55">{t("{n} so'm", { n: fmt(o.price) })}</div>
                </div>
                {/* To'lovni DAVOM ETTIRISH. Avval bu yerda faqat
                    "Kutilmoqda" yozuvi turardi va mijoz to'lovni
                    tugatishning hech qanday yo'lini topolmasdi — kod esa
                    uning o'z buyurtmasi tufayli 24 soat band qolardi. */}
                {PAYMENTS_ENABLED && o.payLink ? (
                  <a href={o.payLink} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-xs min-h-11">
                    {t("To'lash")}
                  </a>
                ) : (
                  <span className="badge badge-warning badge-sm">{t('Kutilmoqda')}</span>
                )}
                {/* `basis-full` — QR yon tomonda emas, qatorning ostida
                    to'liq kenglikda ochiladi (ota element `flex-wrap`). */}
                {PAYMENTS_ENABLED && o.payLink && <PayQr payLink={o.payLink} className="basis-full" />}
              </div>
            ))}
          </div>
          {!PAYMENTS_ENABLED && <div className="mt-2"><PaymentUnavailableNotice compact /></div>}
        </section>
      )}

      {/* ── Tranzaksiya tarixi ── */}
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-base-content/45">{t('Tranzaksiya tarixi')}</h2>
        {!data && (
          <div className="space-y-2" aria-busy="true"><div className="vz-skel h-10 w-full"></div><div className="vz-skel h-10 w-full"></div><div className="vz-skel h-10 w-full"></div></div>
        )}
        {data && dataErr && (
          <div className="vz-empty !border-error/40">
            <div className="text-sm text-base-content/70">{t("Tranzaksiya tarixini yuklab bo'lmadi.")}</div>
            <button type="button" className="btn btn-outline-gold btn-sm min-h-11" onClick={loadHistory}>{t('Qayta urinish')}</button>
          </div>
        )}
        {data && !dataErr && data.payments.length === 0 && (
          <div className="vz-empty"><span className="text-sm">{t("Hozircha to'lovlar yo'q.")}</span></div>
        )}
        {data && !dataErr && data.payments.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--vz-line)]">
          <table className="table table-sm">
            <thead><tr><th>{t('Turi')}</th><th>{t('Kod')}</th><th>{t('Summa')}</th><th>{t('Holat')}</th><th>{t('Sana')}</th></tr></thead>
            <tbody>
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
        )}
      </section>
    </main>
  );
}
