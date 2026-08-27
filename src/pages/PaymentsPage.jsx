import { useEffect, useState } from 'react';
import { dbListPayments } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { fmt, dateTime } from '../lib/format.js';

const KIND_LABEL = {
  card_purchase: "Raqamli tashrif qog'ozi xaridi",
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
  const [data, setData] = useState(null);

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    dbListPayments().then(setData).catch(() => setData({ payments: [], pendingPayout: 0 }));
  }, [user]);

  if (user === undefined || user === null) {
    return <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pt-16 text-center text-base-content/45">Yuklanmoqda...</main>;
  }

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <h1 className="pt-10 text-2xl font-bold">To'lovlar tarixi</h1>
      <p className="mt-2 text-sm text-base-content/55">Barcha real to'lovlaringiz — raqamli tashrif qog'ozi, auksion, premium va obunalar.</p>

      {data && data.pendingPayout > 0 && (
        <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <div className="text-sm font-bold text-accent">Sizga to'lanishi kerak: {fmt(data.pendingPayout)} so'm</div>
          <p className="mt-1 text-xs text-base-content/50">Bu — premium obunachilaringizdan yig'ilgan mablag'. Admin tez orada Payme/karta raqamingizga qo'lda o'tkazadi.</p>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="table table-sm">
          <thead><tr><th>Turi</th><th>Kod</th><th>Summa</th><th>Holat</th><th>Vaqt</th></tr></thead>
          <tbody>
            {!data && (
              <tr><td colSpan={5} className="py-8 text-center text-base-content/45">Yuklanmoqda...</td></tr>
            )}
            {data && data.payments.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-base-content/45">Hozircha to'lovlar yo'q.</td></tr>
            )}
            {data && data.payments.map((p) => {
              const st = STATUS_LABEL[p.status] || { text: p.status, cls: 'badge-ghost' };
              return (
                <tr key={p.id}>
                  <td>{KIND_LABEL[p.kind] || p.kind}</td>
                  <td className="font-mono text-xs">{p.code && p.code !== 'PREMIUM' && p.code !== 'FOLLOW' ? p.code : '—'}</td>
                  <td className="font-semibold">{fmt(p.price)} so'm</td>
                  <td><span className={`badge badge-sm ${st.cls}`}>{st.text}</span></td>
                  <td className="text-xs text-base-content/50">{dateTime(new Date(p.createdAt).getTime())}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
