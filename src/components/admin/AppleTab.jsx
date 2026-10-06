import { useCallback, useEffect, useState } from 'react';
import { AdminCard, AdminLoading, EmptyState, KpiCard, LoadError, StatusBadge } from './AdminUI.jsx';
import { useLanguage } from '../../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// ADMIN "APPLE / iOS" (2026-10, egasining so'rovi)
//
// iOS'dagi Apple In-App Purchase: Premium obunasi va "Ko'tarish"
// consumable'lari. Bu bo'lim FAQAT O'QIYDI (server: hosting/api/admin-apple.js,
// manager+). Foydalanuvchi — faqat ID va asosiy NFC kodi; tranzaksiya
// raqamlari manager uchun maskalangan. Holatlar serverda hisoblanadi.
//
// `adminApi` PROP orqali keladi (AdminPage.jsx bilan aylanma bog'liqlik bo'lmasin).
// ═══════════════════════════════════════════════════════════════════════

const SUBTABS = [
  ['status', 'Holat'],
  ['subs', 'Obunalar'],
  ['tx', 'Tranzaksiyalar'],
  ['boost', 'Ko‘tarish va kreditlar'],
  ['notif', 'Bildirishnomalar'],
];

const STATE_TONE = {
  active: 'success', granted: 'success', slot: 'success', unused: 'accent', credit: 'accent',
  autorenew_off: 'pending', claimed: 'pending', expiring: 'pending',
  expired: 'muted', not_granted: 'muted', used: 'muted', done: 'muted',
  revoked: 'danger', revoked_rolled_back: 'danger',
};
const STATE_TEXT = {
  active: 'Faol', autorenew_off: 'Avto-yangilanish o‘chiq', expired: 'Tugagan', revoked: 'Qaytarilgan',
  revoked_rolled_back: 'Qaytarilgan (muddat olindi)', granted: 'Berildi', claimed: 'Jarayonda', not_granted: 'Berilmadi',
  slot: 'Slot yondi', credit: 'Kredit', unused: 'Ishlatilmagan', used: 'Ishlatilgan', done: 'Bajarildi',
};

function dbMs(v) {
  if (!v) return null;
  let s = String(v).trim();
  if (!s.includes('T')) s = s.replace(' ', 'T');
  s = s.replace(/\+00$/, 'Z');
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z';
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
}
const when = (v) => { const ms = dbMs(v); return ms ? new Date(ms).toLocaleString('uz-UZ') : '—'; };

function Pills({ value, onChange, options }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([k, label]) => (
        <button key={k || 'all'} type="button" onClick={() => onChange(k)}
          className={`rounded-lg px-2.5 py-1 text-[13px] transition ${value === k
            ? 'bg-[color:var(--vz-accent)] text-[color:var(--accent-ink)]'
            : 'border border-[color:var(--vz-line)] text-[color:var(--vz-ink-2)]'}`}>
          {t(label)}
        </button>
      ))}
    </div>
  );
}

function UserCell({ userId, code, goToUser }) {
  if (!userId) return <span style={{ color: 'var(--vz-ink-3)' }}>—</span>;
  return (
    <button type="button" className="text-left hover:underline" onClick={() => goToUser?.(userId)}>
      <span className="font-mono">#{userId}</span>{code ? <span className="ml-1 font-mono" style={{ color: 'var(--vz-gold-2)' }}>{code}</span> : null}
    </button>
  );
}

// Kursorli ro'yxat: `path` + filtrlar; "Ko'proq" — keyingi sahifa.
function usePaged(adminApi, path) {
  const [rows, setRows] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (more = false) => {
    setErr(null);
    setBusy(true);
    try {
      const sep = path.includes('?') ? '&' : '?';
      const d = await adminApi(`${path}${more && cursor ? `${sep}cursor=${encodeURIComponent(cursor)}` : ''}`);
      setRows((prev) => (more && prev ? [...prev, ...(d.items || [])] : d.items || []));
      setCursor(d.hasMore ? d.nextCursor : null);
    } catch (e) { setErr(e); }
    finally { setBusy(false); }
  }, [adminApi, path, cursor]);
  useEffect(() => { setRows(null); setCursor(null); }, [path]);
  useEffect(() => { if (rows === null) load(false); }, [rows, load]);
  return { rows, err, busy, hasMore: !!cursor, more: () => load(true), reload: () => setRows(null) };
}

function MoreButton({ paged }) {
  const { t } = useLanguage();
  if (!paged.hasMore) return null;
  return (
    <div className="flex justify-center pt-3">
      <button type="button" className="btn btn-outline-gold btn-sm min-h-11" disabled={paged.busy} onClick={paged.more}>{t("Ko'proq yuklash")}</button>
    </div>
  );
}

function Table({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead style={{ color: 'var(--vz-ink-3)' }}>
          <tr>{head.map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
const Tr = ({ children }) => <tr className="border-t" style={{ borderColor: 'var(--vz-line)' }}>{children}</tr>;
const Td = ({ children, mono }) => <td className={`py-1.5 pr-3 align-top ${mono ? 'font-mono text-[12px]' : ''}`}>{children}</td>;

const EnvBadge = ({ env }) => (env === 'Sandbox' ? <StatusBadge tone="info">Sandbox</StatusBadge> : env === 'Production' ? null : env ? <StatusBadge>{env}</StatusBadge> : null);
function StateBadge({ state }) {
  const { t } = useLanguage();
  return <StatusBadge tone={STATE_TONE[state] || 'muted'}>{t(STATE_TEXT[state] || state)}</StatusBadge>;
}

// ── HOLAT ────────────────────────────────────────────────────────────
function StatusSection({ adminApi, isSuper }) {
  const { t } = useLanguage();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => { setErr(null); adminApi('/apple/summary').then(setD).catch(setErr); }, [adminApi]);
  useEffect(() => { load(); }, [load]);
  if (err) return <LoadError err={err} onRetry={load} />;
  if (!d) return <AdminLoading rows={4} />;
  const f = d.flags;
  const p = d.problems;
  const sub = (k) => d.counts.subscriptions[k] || {};
  const yes = (v) => (v ? <StatusBadge tone="success">{t('Yoqiq')}</StatusBadge> : <StatusBadge>{t('O‘chiq')}</StatusBadge>);
  return (
    <div className="flex flex-col gap-4" data-testid="apple-status">
      <AdminCard title={t('Sozlamalar')}>
        <dl className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2"><dt>{t('Apple xaridlari (IAP_APPLE_ENABLED)')}</dt><dd>{yes(f.iapEnabled)}</dd></div>
          <div className="flex items-center justify-between gap-2"><dt>{t('Ko‘tarish (boost)')}</dt><dd>{yes(f.boostEnabled)}</dd></div>
          <div className="flex items-center justify-between gap-2"><dt>{t('Sandbox hammaga')}</dt><dd>{yes(f.allowSandboxAll)}</dd></div>
          <div className="flex items-center justify-between gap-2"><dt>{t('Sandbox ro‘yxati')}</dt><dd>{f.sandboxUserCount}</dd></div>
          {f.featuredSales && (
            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <dt>{t('Ko‘tarish sotuvi')}</dt>
              <dd>{f.featuredSales.open ? <StatusBadge tone="success">{t('Ochiq')}</StatusBadge> : <StatusBadge>{t('Yopiq')}</StatusBadge>} {f.featuredSales.usersCount} / {f.featuredSales.openAt} · {f.featuredSales.mode}</dd>
            </div>
          )}
        </dl>
        {isSuper && Array.isArray(f.sandboxUserIds) && f.sandboxUserIds.length > 0 && (
          <p className="mt-3 text-[13px]" style={{ color: 'var(--vz-ink-2)' }}>
            {t('Sandbox foydalanuvchilari')}: {f.sandboxUserIds.map((x) => `#${x.userId}${x.code ? ` ${x.code}` : ''}`).join(', ')}
          </p>
        )}
        <p className="mt-3 text-[12px]" style={{ color: 'var(--vz-ink-3)' }}>
          {t('Bundle')}: <span className="font-mono">{d.bundleId}</span> · {t('Mahsulotlar')}: <span className="font-mono">{[...d.products.premium, ...d.products.boost.map((b) => b.productId)].join(', ')}</span>. {t('Narxlar App Store Connect’da belgilanadi.')}
        </p>
      </AdminCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon="crown" label={t('Faol obunalar')} value={sub('production').active || 0} sub={`Sandbox: ${sub('sandbox').active || 0}`} />
        <KpiCard icon="clock" label={t('7 kunda tugaydi')} value={sub('production').expiring7d || 0} sub={`${t('Avto-yangilanish o‘chiq')}: ${sub('production').autorenewOff || 0}`} tone="info" />
        <KpiCard icon="flag" label={t('Qaytarilgan (30 kun)')} value={(sub('production').revoked30d || 0) + (sub('sandbox').revoked30d || 0)} tone="info" />
        <KpiCard icon="bell" label={t('Muammolar')} value={d.attention} sub={t('osilgan + noma’lum')} tone={d.attention ? 'pending' : 'accent'} />
      </div>

      <AdminCard title={t('Muammolar')}>
        <ul className="space-y-1 text-[13px]" style={{ color: 'var(--vz-ink-2)' }}>
          <li>{t('Noma’lum foydalanuvchi (7 kun)')}: <b>{p.unknownUser7d}</b></li>
          <li>{t('Osilib qolgan bildirishnoma (processing)')}: <b>{p.staleProcessing}</b></li>
          <li>{t('Osilib qolgan ko‘tarish da’vosi (60 s+)')}: <b>{p.staleBoostClaims}</b></li>
          <li>{t('Imzo xatolari')}: <b>{p.signatureFailures}</b>{p.lastSignatureFailureAt ? ` · ${t('oxirgisi')}: ${when(p.lastSignatureFailureAt)}` : ''}</li>
          <li>{t('Oxirgi Apple bildirishnomasi')}: <b>{when(d.notifications.lastNotificationAt)}</b></li>
        </ul>
      </AdminCard>

      <AdminCard title={t('Bildirishnomalar natijasi')}>
        <div className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
          {[['last24h', '24 soat'], ['last7d', '7 kun']].map(([k, label]) => (
            <div key={k}>
              <div className="mb-1 font-semibold">{t(label)}</div>
              {Object.keys(d.notifications[k]).length === 0
                ? <div style={{ color: 'var(--vz-ink-3)' }}>—</div>
                : Object.entries(d.notifications[k]).map(([r, n]) => <div key={r} className="flex justify-between gap-2"><span className="font-mono">{r}</span><b>{n}</b></div>)}
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard title={t('Kreditlar va ko‘tarish (30 kun)')}>
        <div className="space-y-1 text-[13px]" style={{ color: 'var(--vz-ink-2)' }}>
          {['production', 'sandbox'].map((k) => {
            const c = d.counts.credits[k] || {};
            const b = d.counts.boostTx30d[k] || {};
            return (
              <div key={k}>
                <b>{k === 'production' ? 'Production' : 'Sandbox'}</b>: {t('Kreditlar')} — {t('ishlatilmagan')} {c.unused || 0}, {t('ishlatilgan')} {c.used || 0}, {t('qaytarilgan')} {c.revoked || 0}
                {Object.entries(b).map(([prod, st]) => <div key={prod} className="font-mono text-[12px]">{prod}: {Object.entries(st).map(([s, n]) => `${s} ${n}`).join(' · ')}</div>)}
              </div>
            );
          })}
        </div>
      </AdminCard>

      <AdminCard title={t('Ilova')}>
        <div className="text-[13px]" style={{ color: 'var(--vz-ink-2)' }}>
          {['ios', 'android'].map((k) => (
            <div key={k}>{k === 'ios' ? 'iOS' : 'Android'}: {d.app.totals[k]?.total || 0} · {t('7 kunda faol')}: {d.app.totals[k]?.active7d || 0}</div>
          ))}
          {d.app.builds.length > 0 && (
            <Table head={[t('Platforma'), t('Build'), t('Foydalanuvchilar'), t('7 kunda faol')]}>
              {d.app.builds.map((b, i) => (
                <Tr key={i}><Td>{b.platform}</Td><Td mono>{b.build ?? '—'}</Td><Td>{b.users}</Td><Td>{b.active7d}</Td></Tr>
              ))}
            </Table>
          )}
        </div>
      </AdminCard>
    </div>
  );
}

// ── OBUNALAR ─────────────────────────────────────────────────────────
function SubsSection({ adminApi, goToUser }) {
  const { t } = useLanguage();
  const [state, setState] = useState('');
  const [env, setEnv] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const qs = new URLSearchParams({ ...(state ? { state } : {}), ...(env ? { env } : {}), ...(query ? { q: query } : {}) }).toString();
  const paged = usePaged(adminApi, `/apple/subscriptions${qs ? `?${qs}` : ''}`);
  return (
    <AdminCard title={t('Obunalar')}>
      <div className="mb-3 flex flex-col gap-2">
        <Pills value={state} onChange={setState} options={[['', 'Barchasi'], ['active', 'Faol'], ['autorenew_off', 'Avto-yangilanish o‘chiq'], ['expiring', '7 kunda tugaydi'], ['expired', 'Tugagan'], ['revoked', 'Qaytarilgan']]} />
        <Pills value={env} onChange={setEnv} options={[['', 'Hamma muhit'], ['Production', 'Production'], ['Sandbox', 'Sandbox']]} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Foydalanuvchi ID, NFC kod yoki tranzaksiya')} className="vz-input min-w-0 flex-1" />
          <button type="submit" className="btn btn-outline-gold btn-sm min-h-11">{t('Qidirish')}</button>
        </form>
      </div>
      {paged.err && <LoadError err={paged.err} onRetry={paged.reload} />}
      {!paged.err && paged.rows === null && <AdminLoading rows={4} />}
      {paged.rows && paged.rows.length === 0 && <EmptyState title={t('Obuna topilmadi')} />}
      {paged.rows && paged.rows.length > 0 && (
        <Table head={[t('Foydalanuvchi'), t('Mahsulot'), t('Holat'), t('Tugaydi'), t('Avto'), t('Oxirgi hodisa'), t('Tranzaksiya')]}>
          {paged.rows.map((r) => (
            <Tr key={`${r.originalTransactionId}-${r.updatedAt}`}>
              <Td><UserCell userId={r.userId} code={r.code} goToUser={goToUser} /></Td>
              <Td mono>{r.productId}</Td>
              <Td><span className="flex flex-wrap gap-1"><StateBadge state={r.state} /><EnvBadge env={r.environment} /></span></Td>
              <Td>{when(r.expiresAt)}</Td>
              <Td>{r.autoRenew === null ? '—' : r.autoRenew ? t('ha') : t('yo‘q')}</Td>
              <Td mono>{r.lastEvent || '—'}</Td>
              <Td mono>{r.originalTransactionId}</Td>
            </Tr>
          ))}
        </Table>
      )}
      {paged.rows && <MoreButton paged={paged} />}
    </AdminCard>
  );
}

// ── TRANZAKSIYALAR ───────────────────────────────────────────────────
function TxSection({ adminApi, goToUser, kind: fixedKind }) {
  const { t } = useLanguage();
  const [kind, setKind] = useState(fixedKind || 'premium');
  const [state, setState] = useState('');
  const [env, setEnv] = useState('');
  const qs = new URLSearchParams({ kind, ...(state ? { state } : {}), ...(env ? { env } : {}) }).toString();
  const paged = usePaged(adminApi, `/apple/transactions?${qs}`);
  const stateOpts = kind === 'premium'
    ? [['', 'Barchasi'], ['granted', 'Berildi'], ['not_granted', 'Berilmadi'], ['claimed', 'Jarayonda'], ['revoked', 'Qaytarilgan']]
    : [['', 'Barchasi'], ['slot', 'Slot yondi'], ['credit', 'Kredit'], ['claimed', 'Jarayonda'], ['revoked', 'Qaytarilgan']];
  return (
    <AdminCard title={kind === 'premium' ? t('Premium tranzaksiyalari') : t('Ko‘tarish tranzaksiyalari')}>
      <div className="mb-3 flex flex-col gap-2">
        {!fixedKind && <Pills value={kind} onChange={(k) => { setKind(k); setState(''); }} options={[['premium', 'Premium'], ['boost', 'Ko‘tarish']]} />}
        <Pills value={state} onChange={setState} options={stateOpts} />
        <Pills value={env} onChange={setEnv} options={[['', 'Hamma muhit'], ['Production', 'Production'], ['Sandbox', 'Sandbox']]} />
      </div>
      {paged.err && <LoadError err={paged.err} onRetry={paged.reload} />}
      {!paged.err && paged.rows === null && <AdminLoading rows={4} />}
      {paged.rows && paged.rows.length === 0 && <EmptyState title={t('Tranzaksiya topilmadi')} />}
      {paged.rows && paged.rows.length > 0 && (kind === 'premium' ? (
        <Table head={[t('Sana'), t('Foydalanuvchi'), t('Mahsulot'), t('Holat'), t('Tugaydi'), t('Tranzaksiya')]}>
          {paged.rows.map((r) => (
            <Tr key={`${r.transactionId}-${r.createdAt}`}>
              <Td>{when(r.createdAt)}</Td>
              <Td><UserCell userId={r.userId} code={r.code} goToUser={goToUser} /></Td>
              <Td mono>{r.productId}</Td>
              <Td><span className="flex flex-wrap gap-1"><StateBadge state={r.state} /><EnvBadge env={r.environment} /></span></Td>
              <Td>{when(r.expiresAt)}</Td>
              <Td mono>{r.transactionId}</Td>
            </Tr>
          ))}
        </Table>
      ) : (
        <Table head={[t('Sana'), t('Foydalanuvchi'), t('Mahsulot'), t('Kun'), t('Holat'), t('Slot / kredit'), t('Tranzaksiya')]}>
          {paged.rows.map((r) => (
            <Tr key={`${r.transactionId}-${r.createdAt}`}>
              <Td>{when(r.createdAt)}</Td>
              <Td><UserCell userId={r.userId} code={r.code} goToUser={goToUser} /></Td>
              <Td mono>{r.productId}</Td>
              <Td>{r.days}</Td>
              <Td><span className="flex flex-wrap gap-1"><StateBadge state={r.state} /><EnvBadge env={r.environment} /></span></Td>
              <Td mono>{r.slotId ? `slot#${r.slotId}` : r.creditId ? `kredit#${r.creditId}` : '—'}</Td>
              <Td mono>{r.transactionId}</Td>
            </Tr>
          ))}
        </Table>
      ))}
      {paged.rows && <MoreButton paged={paged} />}
    </AdminCard>
  );
}

function CreditsSection({ adminApi, goToUser }) {
  const { t } = useLanguage();
  const [state, setState] = useState('');
  const paged = usePaged(adminApi, `/apple/credits${state ? `?state=${state}` : ''}`);
  return (
    <AdminCard title={t('Ko‘tarish kreditlari')}>
      <div className="mb-3"><Pills value={state} onChange={setState} options={[['', 'Barchasi'], ['unused', 'Ishlatilmagan'], ['used', 'Ishlatilgan'], ['revoked', 'Qaytarilgan']]} /></div>
      {paged.err && <LoadError err={paged.err} onRetry={paged.reload} />}
      {!paged.err && paged.rows === null && <AdminLoading rows={3} />}
      {paged.rows && paged.rows.length === 0 && <EmptyState title={t('Kredit yo‘q')} />}
      {paged.rows && paged.rows.length > 0 && (
        <Table head={['#', t('Foydalanuvchi'), t('Kun'), t('Holat'), t('Slot'), t('Sana'), t('Tranzaksiya')]}>
          {paged.rows.map((r) => (
            <Tr key={r.creditId}>
              <Td>{r.creditId}</Td>
              <Td><UserCell userId={r.userId} code={r.code} goToUser={goToUser} /></Td>
              <Td>{r.days}</Td>
              <Td><span className="flex flex-wrap gap-1"><StateBadge state={r.state} /><EnvBadge env={r.environment} /></span></Td>
              <Td mono>{r.usedSlotId ? `slot#${r.usedSlotId}` : '—'}</Td>
              <Td>{when(r.createdAt)}</Td>
              <Td mono>{r.transactionId}</Td>
            </Tr>
          ))}
        </Table>
      )}
      {paged.rows && <MoreButton paged={paged} />}
    </AdminCard>
  );
}

// ── BILDIRISHNOMALAR ─────────────────────────────────────────────────
function NotifSection({ adminApi, goToUser }) {
  const { t } = useLanguage();
  const [result, setResult] = useState('');
  const [env, setEnv] = useState('');
  const qs = new URLSearchParams({ ...(result ? { result } : {}), ...(env ? { env } : {}) }).toString();
  const paged = usePaged(adminApi, `/apple/notifications${qs ? `?${qs}` : ''}`);
  return (
    <AdminCard title={t('Apple bildirishnomalari')}>
      <div className="mb-3 flex flex-col gap-2">
        <Pills value={result} onChange={setResult} options={[['', 'Barchasi'], ['granted', 'granted'], ['rolled_back', 'rolled_back'], ['unknown_user', 'unknown_user'], ['sandbox_ignored', 'sandbox_ignored'], ['processing', 'processing']]} />
        <Pills value={env} onChange={setEnv} options={[['', 'Hamma muhit'], ['Production', 'Production'], ['Sandbox', 'Sandbox']]} />
      </div>
      {paged.err && <LoadError err={paged.err} onRetry={paged.reload} />}
      {!paged.err && paged.rows === null && <AdminLoading rows={4} />}
      {paged.rows && paged.rows.length === 0 && <EmptyState title={t('Bildirishnoma yo‘q')} />}
      {paged.rows && paged.rows.length > 0 && (
        <Table head={[t('Sana'), t('Tur'), t('Natija'), t('Foydalanuvchi'), t('Tranzaksiya')]}>
          {paged.rows.map((r) => (
            <Tr key={`${r.uuid}-${r.receivedAt}`}>
              <Td>{when(r.receivedAt)}</Td>
              <Td mono>{r.type}{r.subtype ? ` / ${r.subtype}` : ''} <EnvBadge env={r.environment} /></Td>
              <Td mono>{r.result}</Td>
              <Td><UserCell userId={r.userId} code={r.code} goToUser={goToUser} /></Td>
              <Td mono>{r.transactionId || '—'}</Td>
            </Tr>
          ))}
        </Table>
      )}
      {paged.rows && <MoreButton paged={paged} />}
    </AdminCard>
  );
}

export default function AppleTab({ adminApi, isSuper = false, goToUser }) {
  const { t } = useLanguage();
  const [sub, setSub] = useState('status');
  return (
    <div className="flex flex-col gap-4" data-testid="apple-tab">
      <div className="flex flex-wrap gap-2">
        {SUBTABS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setSub(key)}
            className={`rounded-lg px-3 py-1.5 text-[14px] transition ${sub === key
              ? 'bg-[color:var(--vz-accent)] text-[color:var(--accent-ink)]'
              : 'border border-[color:var(--vz-line)] text-[color:var(--vz-ink-dim)]'}`}>
            {t(label)}
          </button>
        ))}
      </div>
      {sub === 'status' && <StatusSection adminApi={adminApi} isSuper={isSuper} />}
      {sub === 'subs' && <SubsSection adminApi={adminApi} goToUser={goToUser} />}
      {sub === 'tx' && <TxSection adminApi={adminApi} goToUser={goToUser} kind="premium" />}
      {sub === 'boost' && (
        <>
          <TxSection adminApi={adminApi} goToUser={goToUser} kind="boost" />
          <CreditsSection adminApi={adminApi} goToUser={goToUser} />
        </>
      )}
      {sub === 'notif' && <NotifSection adminApi={adminApi} goToUser={goToUser} />}
    </div>
  );
}
