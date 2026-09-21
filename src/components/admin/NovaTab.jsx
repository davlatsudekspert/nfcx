import { useCallback, useEffect, useState } from 'react';
import { AdminCard, AdminLoading, EmptyState, LoadError, StatusBadge } from './AdminUI.jsx';
import { useLanguage } from '../../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// NFCSTORE ILOVASI
//
// Ilovaga tegishli moderatsiya va sotuv bu yerda yig'iladi. Uchta
// bo'lim, uchalasi ham HAQIQIY endpointlar ustida:
//
//   • Izohlar     — `/api/admin/comments`
//   • Dalil arxivi — `/api/admin/comments/archive`
//   • FEATURED    — `/api/admin/featured`
//
// BO'SH BO'LIM QO'SHILMAYDI. Backendda tayanchi yo'q bo'lim —
// bosiladigan, lekin hech narsa qilmaydigan tugma degani; bu
// xato saytda bir necha marta uchragan va `scripts/test-noop-audit.mjs`
// aynan shuning uchun yozilgan.
//
// `adminApi` PROP orqali keladi, import qilinmaydi: u `AdminPage.jsx`
// ichida va bu fayl uni import qilsa aylanma bog'liqlik bo'lardi
// (`MarketplaceTab.jsx` dagi bilan bir xil sabab).
// ═══════════════════════════════════════════════════════════════════════

const SUBTABS = [
  ['comments', 'Izohlar'],
  ['archive', 'Dalil arxivi'],
  ['featured', 'Ko‘tarilgan postlar'],
];

const SLOT_TONE = {
  active: 'success', pending: 'warning', expired: 'muted',
  cancelled: 'muted', stopped: 'danger',
};

/** Sanani odam o'qiydigan ko'rinishda. `null` — chiziqcha. */
function when(ms) {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('uz-UZ');
}

export default function NovaTab({ adminApi, apiErrText }) {
  const { t } = useLanguage();
  const [sub, setSub] = useState('comments');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {SUBTABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSub(key)}
            className={`rounded-lg px-3 py-1.5 text-[14px] transition ${
              sub === key
                ? 'bg-[color:var(--vz-accent)] text-black'
                : 'border border-[color:var(--vz-line)] text-[color:var(--vz-ink-dim)]'
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {sub === 'comments' && <CommentsSection adminApi={adminApi} apiErrText={apiErrText} />}
      {sub === 'archive' && <ArchiveSection adminApi={adminApi} apiErrText={apiErrText} />}
      {sub === 'featured' && <FeaturedSection adminApi={adminApi} apiErrText={apiErrText} />}
    </div>
  );
}

// ── IZOHLAR ─────────────────────────────────────────────────────────
function CommentsSection({ adminApi, apiErrText }) {
  const { t } = useLanguage();
  const [state, setState] = useState('live');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    try {
      const params = new URLSearchParams({ state });
      if (q.trim()) params.set('q', q.trim());
      setData(await adminApi(`/comments?${params}`));
    } catch (e) {
      setErr(e);
    }
  }, [adminApi, state, q]);

  // Qidiruv har harfda so'rov yubormaydi — faqat tugma bosilganda
  // yoki filtr almashganda.
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [state]);

  const act = async (id, kind) => {
    try {
      if (kind === 'delete') {
        // SABAB MAJBURIY — server ham shuni talab qiladi (422).
        // Uni bu yerda so'rash: so'rov yuborib, rad javobini olib,
        // keyin qayta so'rashdan yaxshiroq.
        const reason = window.prompt(t('O‘chirish sababi (majburiy):'));
        if (!reason || !reason.trim()) return;
        await adminApi(`/comments/${id}`, {
          method: 'DELETE',
          body: JSON.stringify({ reason: reason.trim() }),
        });
      } else {
        await adminApi(`/comments/${id}/restore`, { method: 'POST' });
      }
      load();
    } catch (e) {
      window.alert(apiErrText ? apiErrText(e) : t('Amal bajarilmadi.'));
    }
  };

  return (
    <AdminCard
      title={t('Izohlar')}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
          >
            <option value="live">{t('Ko‘rinadigan')}</option>
            <option value="deleted">{t('O‘chirilgan')}</option>
            <option value="all">{t('Barchasi')}</option>
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            placeholder={t('Matn yoki kod')}
            className="w-40 rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
          />
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-[color:var(--vz-line)] px-3 py-1 text-[13px]"
          >
            {t('Qidirish')}
          </button>
        </div>
      }
    >
      {err && <LoadError err={err} onRetry={load} />}
      {!err && data === null && <AdminLoading rows={4} />}
      {!err && data && data.comments.length === 0 && (
        <EmptyState title={t('Izoh topilmadi')} />
      )}
      {!err && data && data.comments.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-[color:var(--vz-ink-faint)]">
            {t('Jami')}: {data.total}
          </p>
          {data.comments.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-[color:var(--vz-line)] p-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <b className="text-[14px]">{c.name || c.code || '—'}</b>
                <span className="text-[12px] text-[color:var(--vz-ink-faint)]">
                  {c.code} · {c.targetKind}#{c.targetId} · {when(c.createdAt)}
                </span>
                {c.deletedAt && <StatusBadge tone="danger">{t('O‘chirilgan')}</StatusBadge>}
                <span className="ml-auto flex gap-2">
                  {c.deletedAt ? (
                    <button
                      type="button"
                      onClick={() => act(c.id, 'restore')}
                      className="text-[13px] text-[color:var(--vz-accent)]"
                    >
                      {t('Tiklash')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => act(c.id, 'delete')}
                      className="text-[13px] text-red-400"
                    >
                      {t('O‘chirish')}
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-[color:var(--vz-ink-dim)]">
                {c.body}
              </p>
              {c.deletedReason && (
                <p className="mt-1 text-[12px] text-[color:var(--vz-ink-faint)]">
                  {t('Sabab')}: {c.deletedReason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
}

// ── DALIL ARXIVI ────────────────────────────────────────────────────
function ArchiveSection({ adminApi }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    try { setData(await adminApi('/comments/archive')); }
    catch (e) { setErr(e); }
  }, [adminApi]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminCard title={t('Dalil arxivi')}>
      {/* NIMA UCHUN ARXIV BOR — moderator buni bilishi kerak.
          Haqorat yozgan odam uni O'ZI o'chirib yuborishi mumkin va
          keyin "men bunday yozmadim" deyishi mumkin. Arxiv aynan
          shu holat uchun. */}
      <p className="mb-3 text-[13px] text-[color:var(--vz-ink-faint)]">
        {t('Har bir o‘chirilgan izohning to‘liq nusxasi. Izohni muallifning o‘zi o‘chirgan bo‘lsa ham bu yerda qoladi.')}
      </p>
      {err && <LoadError err={err} onRetry={load} />}
      {!err && data === null && <AdminLoading rows={4} />}
      {!err && data && data.items.length === 0 && (
        <EmptyState title={t('Arxiv bo‘sh')} />
      )}
      {!err && data && data.items.map((a) => (
        <div key={a.id} className="mb-3 rounded-xl border border-[color:var(--vz-line)] p-3">
          <div className="flex flex-wrap items-baseline gap-2 text-[12px] text-[color:var(--vz-ink-faint)]">
            <span>{a.authorCode || `user#${a.userId}`}</span>
            <span>· {a.targetKind}#{a.targetId}</span>
            <span>· {t('yozilgan')}: {when(a.createdAt)}</span>
            <span>· {t('o‘chirilgan')}: {when(a.deletedAt)}</span>
            {a.restoredAt && <StatusBadge tone="info">{t('Tiklangan')}</StatusBadge>}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-[color:var(--vz-ink-dim)]">
            {a.body}
          </p>
          <p className="mt-1 text-[12px] text-[color:var(--vz-ink-faint)]">
            {t('Kim')}: {a.deletedByAdmin || (a.deletedByUserId ? `user#${a.deletedByUserId}` : '—')}
            {a.reason ? ` · ${t('sabab')}: ${a.reason}` : ''}
          </p>
        </div>
      ))}
    </AdminCard>
  );
}

// ── KO'TARILGAN POSTLAR (FEATURED) ──────────────────────────────────
function FeaturedSection({ adminApi, apiErrText }) {
  const { t } = useLanguage();
  const [state, setState] = useState('all');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    try { setData(await adminApi(`/featured?state=${encodeURIComponent(state)}`)); }
    catch (e) { setErr(e); }
  }, [adminApi, state]);

  useEffect(() => { load(); }, [load]);

  const stop = async (id) => {
    // SABAB MAJBURIY: odamning puliga olingan e'lon to'xtatilyapti.
    const reason = window.prompt(t('To‘xtatish sababi (majburiy):'));
    if (!reason || !reason.trim()) return;
    try {
      await adminApi(`/featured/${id}/stop`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      load();
    } catch (e) {
      window.alert(apiErrText ? apiErrText(e) : t('Amal bajarilmadi.'));
    }
  };

  return (
    <AdminCard
      title={t('Ko‘tarilgan postlar')}
      right={
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
        >
          <option value="all">{t('Barchasi')}</option>
          <option value="active">{t('Faol')}</option>
          <option value="pending">{t('To‘lov kutilmoqda')}</option>
          <option value="expired">{t('Muddati tugagan')}</option>
          <option value="stopped">{t('To‘xtatilgan')}</option>
        </select>
      }
    >
      {/* SLOT FAQAT HAQIQIY TO'LOVDAN KEYIN YONADI. Bu yerda
          "faollashtirish" tugmasi ATAYLAB YO'Q: uni qo'shish
          to'lovni chetlab o'tish yo'lini ochardi. */}
      <p className="mb-3 text-[13px] text-[color:var(--vz-ink-faint)]">
        {t('Slot faqat Payme yoki Click to‘lovi tasdiqlangandan keyin yonadi. Bu yerdan qo‘lda yoqib bo‘lmaydi.')}
      </p>
      {err && <LoadError err={err} onRetry={load} />}
      {!err && data === null && <AdminLoading rows={4} />}
      {!err && data && data.slots.length === 0 && (
        <EmptyState title={t('Slot topilmadi')} />
      )}
      {!err && data && data.slots.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[color:var(--vz-ink-faint)]">
              <tr>
                <th className="py-1 pr-3">#</th>
                <th className="py-1 pr-3">{t('Kontent')}</th>
                <th className="py-1 pr-3">{t('Profil')}</th>
                <th className="py-1 pr-3">{t('Muddat')}</th>
                <th className="py-1 pr-3">{t('Narx')}</th>
                <th className="py-1 pr-3">{t('Holat')}</th>
                <th className="py-1 pr-3">{t('Tugaydi')}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {data.slots.map((s) => (
                <tr key={s.id} className="border-t border-[color:var(--vz-line)]">
                  <td className="py-1.5 pr-3">{s.id}</td>
                  <td className="py-1.5 pr-3">{s.targetKind}#{s.targetId}</td>
                  <td className="py-1.5 pr-3">{s.code || `user#${s.userId}`}</td>
                  <td className="py-1.5 pr-3">{s.days} {t('kun')}</td>
                  <td className="py-1.5 pr-3">{Number(s.price).toLocaleString('uz-UZ')}</td>
                  <td className="py-1.5 pr-3">
                    <StatusBadge tone={SLOT_TONE[s.status] || 'muted'}>{t(s.status)}</StatusBadge>
                  </td>
                  <td className="py-1.5 pr-3">{when(s.endsAt)}</td>
                  <td className="py-1.5">
                    {(s.status === 'active' || s.status === 'pending') && (
                      <button
                        type="button"
                        onClick={() => stop(s.id)}
                        className="text-[13px] text-red-400"
                      >
                        {t('To‘xtatish')}
                      </button>
                    )}
                    {s.stoppedReason && (
                      <span className="text-[12px] text-[color:var(--vz-ink-faint)]">
                        {s.stoppedReason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}
