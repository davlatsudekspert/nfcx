import { useCallback, useEffect, useState } from 'react';
import { AdminCard, AdminLoading, EmptyState, KpiCard, LoadError, StatusBadge } from './AdminUI.jsx';
import { useLanguage } from '../../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// NFCSTORE ILOVASI
//
// Ilovaga tegishli moderatsiya va sotuv bu yerda yig'iladi. Har bir
// bo'lim HAQIQIY endpoint ustida:
//
//   • Foydalanuvchilar — `/api/admin/app-users` (ilovani kim ishlatyapti,
//                        platforma va ilova build raqami)
//   • Kontent          — `/api/admin/app-content` (post, Reels, istoriya,
//                        biznes posti); o'chirish — `/api/admin/content/:tur/:id`
//   • Izohlar          — `/api/admin/comments`
//   • Avto-filtr       — `/api/admin/content-blocks` (yuklashda bloklangan
//                        rasmlar jurnali, image-moderation.js)
//   • Dalil arxivi     — `/api/admin/evidence` (o'chirilgan post,
//                        istoriya, video, fayl VA izohlar; shubhali belgisi)
//   • FEATURED         — `/api/admin/featured`
//   • Buyurtmalar      — `/api/admin/company-orders` (biznes katalogidan)
//
// Yangi uchtasi — hosting/api/app-admin.js.
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
  ['users', 'Ilova foydalanuvchilari'],
  ['content', 'Kontent'],
  ['comments', 'Izohlar'],
  ['blocks', 'Avto-filtr'],
  ['archive', 'Dalil arxivi'],
  ['featured', 'Ko‘tarilgan postlar'],
  ['orders', 'Buyurtmalar'],
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

/** Bazadagi matn sana ("2026-09-01 10:00:00", "...+00" yoki ISO) — ms.
 *  Zonasiz qiymat UTC (SQLite `CURRENT_TIMESTAMP`). */
function dbMs(v) {
  if (!v) return null;
  let s = String(v).trim();
  if (!s.includes('T')) s = s.replace(' ', 'T');
  s = s.replace(/(:\d{2}(?:\.\d+)?)([+-]\d{2})$/, '$1$2:00');
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(s)) s += 'Z';
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
}

export default function NovaTab({ adminApi, apiErrText }) {
  const { t } = useLanguage();
  const [sub, setSub] = useState('users');

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

      {sub === 'users' && <ReviewAccountCard adminApi={adminApi} />}
      {sub === 'users' && <UsersSection adminApi={adminApi} />}
      {sub === 'content' && <ContentSection adminApi={adminApi} apiErrText={apiErrText} />}
      {sub === 'comments' && <CommentsSection adminApi={adminApi} apiErrText={apiErrText} />}
      {sub === 'blocks' && <BlocksSection adminApi={adminApi} />}
      {sub === 'archive' && <ArchiveSection adminApi={adminApi} apiErrText={apiErrText} />}
      {sub === 'featured' && <FeaturedSection adminApi={adminApi} apiErrText={apiErrText} />}
      {sub === 'orders' && <OrdersSection adminApi={adminApi} />}
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
  // SAHIFALASH — server `page` va `hasMore` beradi; ilgari faqat
  // birinchi 30 ta izoh ko'rinardi.
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);

  const params = (p) => {
    const ps = new URLSearchParams({ state, page: String(p) });
    if (q.trim()) ps.set('q', q.trim());
    return ps;
  };
  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    setPage(1);
    try {
      setData(await adminApi(`/comments?${params(1)}`));
    } catch (e) {
      setErr(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminApi, state, q]);

  const loadMore = async () => {
    setMore(true);
    try {
      const next = await adminApi(`/comments?${params(page + 1)}`);
      setData((d) => ({ ...next, comments: [...(d?.comments || []), ...(next.comments || [])] }));
      setPage(page + 1);
    } catch (e) { setErr(e); }
    setMore(false);
  };

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
          {data.hasMore && (
            <button type="button" onClick={loadMore} disabled={more}
              className="mt-1 self-center rounded-lg border border-[color:var(--vz-line)] px-4 py-1.5 text-[13px]">
              {more ? t('Yuklanmoqda…') : t('Yana yuklash')}
            </button>
          )}
        </div>
      )}
    </AdminCard>
  );
}

// ── ILOVA FOYDALANUVCHILARI ─────────────────────────────────────────
// Ilova har ochilganda `/api/auth/me` ni `x-app: nova` bilan chaqiradi —
// server shuni sanaydi (hosting/api/app-usage.js). Kirmagan mehmon va
// saytdan kirish sanalmaydi.
// ── GOOGLE PLAY TEKSHIRUVCHISI HISOBI ─────────────────────────────
// Play Console → "Доступ к приложению" uchun login va parol. Hisob
// serverda oldindan tasdiqlangan (email kodi so'ralmaydi). Parol faqat
// shu yerda bir marta ko'rinadi; qayta bosilsa yangisi beriladi va
// eskisi ishlamay qoladi (hosting/api/app-usage.js `reviewAccount`).
function ReviewAccountCard({ adminApi }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const create = async () => {
    if (res && !confirm(t('Yangi parol beriladi, eskisi ishlamay qoladi. Davom etasizmi?'))) return;
    setBusy(true); setErr(null);
    try {
      setRes(await adminApi('/review-account', { method: 'POST' }));
    } catch (e) { setErr(e); }
    setBusy(false);
  };
  const copy = (v) => { try { navigator.clipboard.writeText(v); } catch { /* jim */ } };
  return (
    <AdminCard title={t('Google Play tekshiruvchisi hisobi')}>
      <p className="mb-3 text-[13px] text-[color:var(--vz-ink-faint)]">
        {t('Play Console → Политика → Доступ к приложению uchun login va parol. Hisob alohida, email kodi so‘ralmaydi, Premium bilan. Parol faqat hozir bir marta ko‘rinadi.')}
      </p>
      {err && <LoadError err={err} onRetry={create} />}
      {res ? (
        <div className="flex flex-col gap-2 text-[14px]">
          {[['Login', res.email], [t('Parol'), res.password], ['NFC ID', res.code]].map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-[color:var(--vz-ink-faint)]">{k}</span>
              <code className="rounded-md border border-[color:var(--vz-line)] px-2 py-1 font-mono">{v}</code>
              <button type="button" onClick={() => copy(v)}
                className="rounded-lg border border-[color:var(--vz-line)] px-2 py-1 text-[12px]">{t('Nusxa')}</button>
            </div>
          ))}
          <button type="button" onClick={create} disabled={busy}
            className="mt-1 self-start rounded-lg border border-[color:var(--vz-line)] px-3 py-1.5 text-[13px]">
            {t('Yangi parol berish')}
          </button>
        </div>
      ) : (
        <button type="button" onClick={create} disabled={busy}
          className="rounded-lg border border-[color:var(--vz-accent)] px-4 py-2 text-[13px]">
          {busy ? t('Yuklanmoqda…') : t('Hisob yaratish va parol olish')}
        </button>
      )}
    </AdminCard>
  );
}

function UsersSection({ adminApi }) {
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  // FILTR va SAHIFALASH (egasi, 2026-09-23: "foydalanuvchi ko'paysa uzun
  // bo'lib ketmasin, filtr va so'z bo'yicha qidiruv bo'lsin").
  const [filter, setFilter] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);

  const params = (p) => {
    const ps = new URLSearchParams({ sort, limit: '50', page: String(p) });
    if (q.trim()) ps.set('q', q.trim());
    if (filter) ps.set('filter', filter);
    return ps;
  };
  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    setPage(1);
    try {
      setData(await adminApi(`/app-users?${params(1)}`));
    } catch (e) { setErr(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminApi, sort, filter]);

  const loadMore = async () => {
    setMore(true);
    try {
      const next = await adminApi(`/app-users?${params(page + 1)}`);
      setData((d) => ({ ...next, items: [...(d?.items || []), ...(next.items || [])] }));
      setPage(page + 1);
    } catch (e) { setErr(e); }
    setMore(false);
  };

  useEffect(() => { load(); }, [load]);

  const stats = data?.stats;
  return (
    <div className="flex flex-col gap-4" data-testid="app-users">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon="users" label={t('Jami ilova foydalanuvchisi')} value={stats ? stats.total : '—'} />
        <KpiCard icon="chart" label={t('Bugun ochgan')} value={stats ? stats.today : '—'} />
        <KpiCard icon="chart" label={t('7 kunda ochgan')} value={stats ? stats.week : '—'} />
        <KpiCard icon="chart" label={t('30 kunda ochgan')} value={stats ? stats.month : '—'} />
      </div>
      <AdminCard
        title={t('Ilova foydalanuvchilari')}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
            >
              <option value="recent">{t('Oxirgi ochganlar')}</option>
              <option value="new">{t('Yangi kelganlar')}</option>
              <option value="opens">{t('Eng ko‘p ochganlar')}</option>
            </select>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
            >
              <option value="">{t('Hammasi')}</option>
              <option value="premium">Premium</option>
              <option value="today">{t('Bugun')}</option>
              <option value="week">{t('7 kun')}</option>
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              placeholder={t('Ism, NFC ID, kompaniya, email yoki telefon')}
              className="w-64 rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
            />
            <button type="button" onClick={load} className="rounded-lg border border-[color:var(--vz-line)] px-3 py-1 text-[13px]">
              {t('Qidirish')}
            </button>
          </div>
        }
      >
        <p className="mb-3 text-[13px] text-[color:var(--vz-ink-faint)]">
          {t('Ilovaga hisob bilan kirgan odamlar. Sanash shu yangilanishdan boshlandi: ilovani ochgan har bir odam birinchi ochishida ro‘yxatga tushadi.')}
        </p>
        {err && <LoadError err={err} onRetry={load} />}
        {!err && data === null && <AdminLoading rows={5} />}
        {!err && data && data.items.length === 0 && <EmptyState title={t('Hali hech kim yo‘q')} />}
        {!err && data && data.items.length > 0 && (
          <div className="flex flex-col gap-2">
            {data.items.map((u) => (
              <div key={u.userId} className="rounded-xl border border-[color:var(--vz-line)] p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <b className="text-[14px]">{u.email || `user#${u.userId}`}</b>
                  {u.phone && <span className="text-[13px] text-[color:var(--vz-ink-dim)]">{u.phone}</span>}
                  <span className="text-[12px] text-[color:var(--vz-ink-faint)]">#{u.userId}</span>
                  {u.premium && <StatusBadge tone="success">Premium</StatusBadge>}
                  {u.deleted && <StatusBadge tone="danger">{t('Hisob o‘chirilgan')}</StatusBadge>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {u.profiles.map((p) => (
                    <a key={p.code} href={`/${p.code}`} target="_blank" rel="noreferrer"
                      className="rounded-md border border-[color:var(--vz-line)] px-2 py-0.5 font-mono text-[12px]">
                      {p.code}{p.name ? ` · ${p.name}` : ''}
                    </a>
                  ))}
                  {u.companies.map((c) => (
                    <span key={c.id} className="rounded-md border border-[color:var(--vz-accent)] px-2 py-0.5 text-[12px]">
                      {t('Biznes')}: {c.name || c.id}
                    </span>
                  ))}
                  {u.profiles.length === 0 && u.companies.length === 0 && (
                    <span className="text-[12px] text-[color:var(--vz-ink-faint)]">{t('Profil yo‘q')}</span>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-[color:var(--vz-ink-faint)]">
                  {t('Birinchi ochgan')}: {when(Date.parse(u.firstSeen))} · {t('Oxirgi ochgan')}: {when(Date.parse(u.lastSeen))} · {t('Ochilishlar')}: {u.opens}
                </p>
                <p className="mt-0.5 text-[12px] text-[color:var(--vz-ink-faint)]">
                  {t('Platforma')}: {u.platform || '—'} · {t('Ilova build')}: {u.appBuild ?? '—'} · {t('Ro‘yxatdan o‘tgan')}: {when(dbMs(u.registeredAt))}
                </p>
              </div>
            ))}
            {data.hasMore && (
              <button type="button" onClick={loadMore} disabled={more}
                className="mt-1 self-center rounded-lg border border-[color:var(--vz-line)] px-4 py-1.5 text-[13px]">
                {more ? t('Yuklanmoqda…') : t('Ko‘proq ko‘rsatish')}
              </button>
            )}
          </div>
        )}
      </AdminCard>
    </div>
  );
}

// ── DALIL ARXIVI ────────────────────────────────────────────────────
// O'chirilgan post, istoriya, video, fayl va izohlar — kim yozgan,
// qachon, kim o'chirgan, profil egasi (hosting/api/content-archive.js).
// Huquqni muhofaza qiluvchi organ so'rasa: qidiring, shubhalilarni
// belgilang va "Yuklab olish" bilan JSON faylga saqlang.
const EVIDENCE_KINDS = [
  ['', 'Hammasi'],
  ['post', 'Post'],
  ['company_post', 'Biznes posti'],
  ['story', 'Istoriya'],
  ['card_video', 'Video'],
  ['card_file', 'Fayl'],
  ['comment', 'Izoh'],
];

const REASON_LABEL = {
  owner: 'Egasi o‘chirdi',
  admin: 'Admin o‘chirdi',
  expired: 'Muddati tugadi (24 soat)',
  card_cleanup: 'Profil o‘chirildi',
};

function Person({ label, p }) {
  const { t } = useLanguage();
  if (!p) return null;
  return (
    <span>
      {t(label)}: <b>{p.email || (p.userId ? `user#${p.userId}` : '—')}</b>
      {p.phone ? ` · ${p.phone}` : ''}
      {p.deleted ? ` · ${t('Hisob o‘chirilgan')}` : ''}
    </span>
  );
}

function ArchiveSection({ adminApi, apiErrText }) {
  const { t } = useLanguage();
  const [kind, setKind] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (kind) params.set('kind', kind);
      if (flagged) params.set('flagged', '1');
      if (q.trim()) params.set('q', q.trim());
      setData(await adminApi(`/evidence?${params}`));
    } catch (e) { setErr(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminApi, kind, flagged]);

  useEffect(() => { load(); }, [load]);

  const flag = async (item, on) => {
    try {
      let note = '';
      if (on) {
        const v = window.prompt(t('Izoh (masalan: so‘rov raqami):'), '');
        if (v === null) return;
        note = v.trim();
      }
      await adminApi('/evidence/flag', {
        method: 'POST',
        body: JSON.stringify({ source: item.source, id: item.id, flagged: on, note }),
      });
      load();
    } catch (e) {
      window.alert(apiErrText ? apiErrText(e) : t('Amal bajarilmadi.'));
    }
  };

  // Ekrandagi ro'yxatni fayl sifatida saqlash — so'rovga ilova qilish uchun.
  const download = () => {
    if (!data?.items?.length) return;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), query: { kind, flagged, q }, items: data.items }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nfcstore-dalil-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <AdminCard
      title={t('Dalil arxivi')}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
          >
            {EVIDENCE_KINDS.map(([k, label]) => <option key={k} value={k}>{t(label)}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[13px]">
            <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />
            {t('Faqat shubhalilar')}
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            placeholder={t('NFC ID, email yoki telefon')}
            className="w-48 rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
          />
          <button type="button" onClick={load} className="rounded-lg border border-[color:var(--vz-line)] px-3 py-1 text-[13px]">
            {t('Qidirish')}
          </button>
          <button type="button" onClick={download} disabled={!data?.items?.length}
            className="rounded-lg border border-[color:var(--vz-line)] px-3 py-1 text-[13px] disabled:opacity-40">
            {t('Yuklab olish')}
          </button>
        </div>
      }
    >
      {/* NIMA UCHUN ARXIV BOR — moderator buni bilishi kerak. */}
      <p className="mb-3 text-[13px] text-[color:var(--vz-ink-faint)]">
        {t('O‘chirilgan har bir post, istoriya, video, fayl va izohning nusxasi. Muallif o‘zi o‘chirgan bo‘lsa ham shu yerda qoladi. Faqat adminlar ko‘radi; har bir qidiruv jurnalga yoziladi.')}
      </p>
      {err && <LoadError err={err} onRetry={load} />}
      {!err && data === null && <AdminLoading rows={4} />}
      {!err && data && data.items.length === 0 && <EmptyState title={t('Arxiv bo‘sh')} />}
      {!err && data && data.items.map((a) => (
        <div key={`${a.source}-${a.id}`} data-testid="evidence-item"
          className={`mb-3 rounded-xl border p-3 ${a.flag ? 'border-red-400' : 'border-[color:var(--vz-line)]'}`}>
          <div className="flex flex-wrap items-baseline gap-2 text-[12px] text-[color:var(--vz-ink-faint)]">
            <StatusBadge tone="info">{t((EVIDENCE_KINDS.find(([k]) => k === a.kind) || ['', a.kind])[1])}</StatusBadge>
            {a.owner?.id && (
              <a className="font-mono" href={a.owner.kind === 'company' ? `/company/${a.owner.id}` : `/${a.owner.id}`} target="_blank" rel="noreferrer">
                {a.owner.id}{a.owner.name ? ` · ${a.owner.name}` : ''}
              </a>
            )}
            {a.target && <span>· {a.target.kind}#{a.target.id}</span>}
            <span>· {t('yozilgan')}: {when(a.createdAt)}</span>
            <span>· {t('o‘chirilgan')}: {when(a.deletedAt)}</span>
            {a.flag && <StatusBadge tone="danger">{t('Shubhali')}</StatusBadge>}
            <span className="ml-auto">
              {a.flag ? (
                <button type="button" onClick={() => flag(a, false)} className="text-[13px] text-[color:var(--vz-accent)]">
                  {t('Belgini olib tashlash')}
                </button>
              ) : (
                <button type="button" onClick={() => flag(a, true)} className="text-[13px] text-red-400">
                  {t('Shubhali deb belgilash')}
                </button>
              )}
            </span>
          </div>
          {a.body && (
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-[color:var(--vz-ink-dim)]">{a.body}</p>
          )}
          {(a.imageUrl || a.videoUrl || a.fileUrl) && (
            <div className="mt-2 flex flex-wrap items-start gap-2">
              {a.imageUrl && (
                <a href={a.imageUrl} target="_blank" rel="noreferrer">
                  <img src={a.imageUrl} alt="" loading="lazy" className="h-28 w-28 rounded-lg object-cover" />
                </a>
              )}
              {a.videoUrl && <video src={a.videoUrl} controls preload="none" className="h-40 max-w-[240px] rounded-lg bg-black" />}
              {a.fileUrl && <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-[13px] underline">{t('Faylni ochish')}</a>}
            </div>
          )}
          <div className="mt-2 flex flex-col gap-0.5 text-[12px] text-[color:var(--vz-ink-faint)]">
            <Person label="Muallif" p={a.author} />
            {a.owner?.user && <Person label="Profil egasi" p={a.owner.user} />}
            <span>
              {t('Kim o‘chirdi')}: {a.deletedBy?.admin || (a.deletedBy?.user ? (a.deletedBy.user.email || `user#${a.deletedBy.user.userId}`) : t('Tizim'))}
              {a.reason ? ` · ${t(REASON_LABEL[a.reason] || a.reason)}` : ''}
            </span>
            {a.flag && (
              <span className="text-red-400">
                {t('Shubhali')}: {a.flag.note || '—'} · {a.flag.by} · {when(a.flag.at)}
              </span>
            )}
          </div>
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

// ── KONTENT (post, Reels, istoriya, biznes posti) ───────────────────
// Ilovada hozir ko'rinib turgan kontent — eng yangisi tepada
// (hosting/api/app-admin.js). Admin katalogdan yashiringan profilning
// kontentini ham ko'radi. O'chirish mavjud yo'l orqali:
// `DELETE /api/admin/content/:tur/:id` — nusxa avval dalil arxiviga
// tushadi, shikoyatlar yopiladi (hosting/api/moderation.js).
const CONTENT_KINDS = [
  ['', 'Hammasi'],
  ['post', 'Post'],
  ['reel', 'Reels'],
  ['story', 'Istoriya'],
  ['company_post', 'Biznes posti'],
];

function ContentSection({ adminApi, apiErrText }) {
  const { t } = useLanguage();
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);

  const params = (p) => {
    const ps = new URLSearchParams({ limit: '30', page: String(p) });
    if (kind) ps.set('kind', kind);
    if (q.trim()) ps.set('q', q.trim());
    return ps;
  };
  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    setPage(1);
    try {
      setData(await adminApi(`/app-content?${params(1)}`));
    } catch (e) { setErr(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminApi, kind]);

  const loadMore = async () => {
    setMore(true);
    try {
      const next = await adminApi(`/app-content?${params(page + 1)}`);
      setData((d) => ({ ...next, items: [...(d?.items || []), ...(next.items || [])] }));
      setPage(page + 1);
    } catch (e) { setErr(e); }
    setMore(false);
  };

  useEffect(() => { load(); }, [load]);

  const remove = async (item) => {
    if (!window.confirm(t('Bu kontent o‘chirilsinmi? Nusxasi dalil arxivida qoladi.'))) return;
    // SABAB MAJBURIY — izohlardagi kabi; dalil arxiviga yoziladi.
    const reason = window.prompt(t('O‘chirish sababi (majburiy):'));
    if (!reason || !reason.trim()) return;
    try {
      await adminApi(`/content/${item.deleteKind}/${item.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      // Ro'yxat qayta yuklanmaydi — "Yana yuklash" bilan ochilgan
      // sahifalar joyida qolsin.
      setData((d) => d && ({
        ...d,
        items: d.items.filter((x) => !(x.deleteKind === item.deleteKind && x.id === item.id)),
      }));
    } catch (e) {
      window.alert(apiErrText ? apiErrText(e) : t('Amal bajarilmadi.'));
    }
  };

  const stats = data?.stats;
  return (
    <div className="flex flex-col gap-4" data-testid="app-content">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon="folder" label={t('Postlar')} value={stats ? stats.posts : '—'} />
        <KpiCard icon="activity" label="Reels" value={stats ? stats.reels : '—'} />
        <KpiCard icon="eye" label={t('Faol istoriyalar (24 soat)')} value={stats ? stats.stories : '—'} />
        <KpiCard icon="building" label={t('Biznes postlari')} value={stats ? stats.companyPosts : '—'} />
      </div>
      <AdminCard
        title={t('Ilova kontenti')}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
            >
              {CONTENT_KINDS.map(([k, label]) => <option key={k} value={k}>{t(label)}</option>)}
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              placeholder={t('Matn, NFC ID, biznes yoki email')}
              className="w-56 rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
            />
            <button type="button" onClick={load} className="rounded-lg border border-[color:var(--vz-line)] px-3 py-1 text-[13px]">
              {t('Qidirish')}
            </button>
          </div>
        }
      >
        <p className="mb-3 text-[13px] text-[color:var(--vz-ink-faint)]">
          {t('Ilovada hozir ko‘rinib turgan post, Reels, istoriya va biznes postlari — eng yangisi tepada. O‘chirilgan kontentning nusxasi «Dalil arxivi»da qoladi.')}
        </p>
        {err && <LoadError err={err} onRetry={load} />}
        {!err && data === null && <AdminLoading rows={4} />}
        {!err && data && data.items.length === 0 && <EmptyState title={t('Kontent topilmadi')} />}
        {!err && data && data.items.length > 0 && (
          <div className="flex flex-col gap-3">
            {data.items.map((c) => (
              <div key={`${c.deleteKind}-${c.id}`} data-testid="app-content-item"
                className="rounded-xl border border-[color:var(--vz-line)] p-3">
                <div className="flex flex-wrap items-baseline gap-2 text-[12px] text-[color:var(--vz-ink-faint)]">
                  <StatusBadge tone="info">{t((CONTENT_KINDS.find(([k]) => k === c.kind) || ['', c.kind])[1])}</StatusBadge>
                  {c.isVideo && <StatusBadge tone="accent">{t('Video')}</StatusBadge>}
                  {c.author.kind === 'company' && <StatusBadge tone="muted">{t('Biznes')}</StatusBadge>}
                  {c.author.id && (
                    <a className="font-mono" href={c.author.kind === 'company' ? `/company/${c.author.id}` : `/${c.author.id}`} target="_blank" rel="noreferrer">
                      {c.author.id}{c.author.name ? ` · ${c.author.name}` : ''}
                    </a>
                  )}
                  <span>· #{c.id}</span>
                  <span>· {when(c.createdAt)}</span>
                  <span className="ml-auto">
                    <button type="button" onClick={() => remove(c)} className="text-[13px] text-red-400">
                      {t('O‘chirish')}
                    </button>
                  </span>
                </div>
                {c.text && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-[color:var(--vz-ink-dim)]">{c.text}</p>
                )}
                {(c.imageUrl || c.videoUrl) && (
                  <div className="mt-2 flex flex-wrap items-start gap-2">
                    {c.imageUrl && (
                      <a href={c.imageUrl} target="_blank" rel="noreferrer">
                        <img src={c.imageUrl} alt="" loading="lazy" className="h-28 w-28 rounded-lg object-cover" />
                      </a>
                    )}
                    {c.videoUrl && <video src={c.videoUrl} controls preload="none" className="h-40 max-w-[240px] rounded-lg bg-black" />}
                  </div>
                )}
                <div className="mt-2 flex flex-col gap-0.5 text-[12px] text-[color:var(--vz-ink-faint)]">
                  <span>
                    {t('Yoqtirishlar')}: {c.likes} · {t('Izohlar')}: {c.comments}
                    {c.views !== null && c.views !== undefined ? ` · ${t('Ko‘rishlar')}: ${c.views}` : ''}
                    {c.expiresAt ? ` · ${t('Tugaydi')}: ${when(c.expiresAt)}` : ''}
                  </span>
                  <Person label="Muallif" p={c.author.user} />
                </div>
              </div>
            ))}
            {data.hasMore && (
              <button type="button" onClick={loadMore} disabled={more}
                className="mt-1 self-center rounded-lg border border-[color:var(--vz-line)] px-4 py-1.5 text-[13px]">
                {more ? t('Yuklanmoqda…') : t('Yana yuklash')}
              </button>
            )}
          </div>
        )}
      </AdminCard>
    </div>
  );
}

// ── AVTO-FILTR ──────────────────────────────────────────────────────
// Yuklash paytida avtomatik to'xtatilgan rasmlar jurnali
// (hosting/api/image-moderation.js → `content_scan_blocks`). Rasmning
// o'zi saqlanmaydi — faqat kim, qachon, qaysi kategoriya va qayerdan.
const BLOCK_CATEGORIES = [
  ['sexual', '18+ / porno'],
  ['violence', 'Zo‘ravonlik'],
  ['extremism', 'Ekstremizm (diniy/siyosiy)'],
  ['political', 'Siyosiy'],
  ['drugs', 'Giyohvandlik'],
  ['hate', 'Nafrat'],
];

// Qaysi yuklash yo'lida to'xtatilgan (worker.js `uploadApi`).
const BLOCK_SOURCES = {
  upload: 'Rasm (avatar, post, katalog)',
  media: 'Post / istoriya mediasi',
  'profile-bg': 'Profil foni',
  file: 'Fayl',
  'card-print': 'Karta bosma dizayni',
};

function BlocksSection({ adminApi }) {
  const { t } = useLanguage();
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);

  const params = (p) => {
    const ps = new URLSearchParams({ limit: '50', page: String(p) });
    if (category) ps.set('category', category);
    if (q.trim()) ps.set('q', q.trim());
    return ps;
  };
  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    setPage(1);
    try {
      setData(await adminApi(`/content-blocks?${params(1)}`));
    } catch (e) { setErr(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminApi, category]);

  const loadMore = async () => {
    setMore(true);
    try {
      const next = await adminApi(`/content-blocks?${params(page + 1)}`);
      setData((d) => ({ ...next, items: [...(d?.items || []), ...(next.items || [])] }));
      setPage(page + 1);
    } catch (e) { setErr(e); }
    setMore(false);
  };

  useEffect(() => { load(); }, [load]);

  const stats = data?.stats;
  const catLabel = (k) => t((BLOCK_CATEGORIES.find(([c]) => c === k) || ['', k || '—'])[1]);
  return (
    <div className="flex flex-col gap-4" data-testid="content-blocks">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon="shield" label={t('Jami bloklangan')} value={stats ? stats.total : '—'} />
        <KpiCard icon="chart" label={t('7 kunda')} value={stats ? stats.last7d : '—'} />
        {BLOCK_CATEGORIES.map(([k, label]) => (
          <KpiCard key={k} icon="alert" tone="danger" label={t(label)} value={stats ? (stats.byCategory?.[k] || 0) : '—'} />
        ))}
      </div>
      <AdminCard
        title={t('Avto-filtr jurnali')}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
            >
              <option value="">{t('Hammasi')}</option>
              {BLOCK_CATEGORIES.map(([k, label]) => <option key={k} value={k}>{t(label)}</option>)}
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              placeholder={t('Email yoki telefon')}
              className="w-48 rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
            />
            <button type="button" onClick={load} className="rounded-lg border border-[color:var(--vz-line)] px-3 py-1 text-[13px]">
              {t('Qidirish')}
            </button>
          </div>
        }
      >
        <p className="mb-3 text-[13px] text-[color:var(--vz-ink-faint)]">
          {t('Yuklash paytida avtomatik to‘xtatilgan rasmlar. Rasmning o‘zi saqlanmaydi — faqat kim, qachon va qaysi sabab bilan.')}
        </p>
        {err && <LoadError err={err} onRetry={load} />}
        {!err && data === null && <AdminLoading rows={4} />}
        {!err && data && data.items.length === 0 && <EmptyState icon="shield" title={t('Bloklangan yuklash yo‘q')} />}
        {!err && data && data.items.length > 0 && (
          <div className="flex flex-col gap-2">
            {data.items.map((b) => (
              <div key={b.id} data-testid="content-block-item" className="rounded-xl border border-[color:var(--vz-line)] p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <StatusBadge tone="danger">{catLabel(b.category)}</StatusBadge>
                  {b.user ? (
                    <>
                      <b className="text-[14px]">{b.user.email || `user#${b.user.userId}`}</b>
                      {b.user.phone && <span className="text-[13px] text-[color:var(--vz-ink-dim)]">{b.user.phone}</span>}
                      <span className="text-[12px] text-[color:var(--vz-ink-faint)]">#{b.user.userId}</span>
                      {b.user.code && (
                        <a href={`/${b.user.code}`} target="_blank" rel="noreferrer"
                          className="rounded-md border border-[color:var(--vz-line)] px-2 py-0.5 font-mono text-[12px]">
                          {b.user.code}{b.user.name ? ` · ${b.user.name}` : ''}
                        </a>
                      )}
                      {b.user.deleted && <StatusBadge tone="danger">{t('Hisob o‘chirilgan')}</StatusBadge>}
                    </>
                  ) : (
                    <b className="text-[14px]">{b.actorKind === 'admin' ? 'Admin' : (b.actor || '—')}</b>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-[color:var(--vz-ink-faint)]">
                  {t('Qayerdan')}: {t(BLOCK_SOURCES[b.source] || b.source || '—')} · {when(b.createdAt)}
                </p>
              </div>
            ))}
            {data.hasMore && (
              <button type="button" onClick={loadMore} disabled={more}
                className="mt-1 self-center rounded-lg border border-[color:var(--vz-line)] px-4 py-1.5 text-[13px]">
                {more ? t('Yuklanmoqda…') : t('Yana yuklash')}
              </button>
            )}
          </div>
        )}
      </AdminCard>
    </div>
  );
}

// ── BIZNES KATALOGI BUYURTMALARI ────────────────────────────────────
// Ilovadagi biznes katalogidan kelgan buyurtmalar — hamma bizneslar
// bo'yicha (hosting/api/app-admin.js). Holatni biznes egasi o'z
// kabinetida o'zgartiradi; bu yerda faqat ko'rish.
const ORDER_STATUS = {
  new: ['Yangi', 'pending'],
  done: ['Bajarildi', 'success'],
  cancelled: ['Bekor qilingan', 'muted'],
};

function OrdersSection({ adminApi }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);

  const params = (p) => {
    const ps = new URLSearchParams({ limit: '50', page: String(p) });
    if (status) ps.set('status', status);
    if (q.trim()) ps.set('q', q.trim());
    return ps;
  };
  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    setPage(1);
    try {
      setData(await adminApi(`/company-orders?${params(1)}`));
    } catch (e) { setErr(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminApi, status]);

  const loadMore = async () => {
    setMore(true);
    try {
      const next = await adminApi(`/company-orders?${params(page + 1)}`);
      setData((d) => ({ ...next, items: [...(d?.items || []), ...(next.items || [])] }));
      setPage(page + 1);
    } catch (e) { setErr(e); }
    setMore(false);
  };

  useEffect(() => { load(); }, [load]);

  const stats = data?.stats;
  return (
    <div className="flex flex-col gap-4" data-testid="company-orders">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard icon="bag" label={t('Jami buyurtmalar')} value={stats ? stats.total : '—'} />
        <KpiCard icon="bell" tone="pending" label={t('Yangi (ko‘rilmagan)')} value={stats ? stats.new : '—'} />
        <KpiCard icon="chart" label={t('7 kunda')} value={stats ? stats.last7d : '—'} />
      </div>
      <AdminCard
        title={t('Biznes katalogi buyurtmalari')}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
            >
              <option value="">{t('Hammasi')}</option>
              {Object.entries(ORDER_STATUS).map(([k, [label]]) => <option key={k} value={k}>{t(label)}</option>)}
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              placeholder={t('Biznes, mahsulot, mijoz yoki telefon')}
              className="w-56 rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]"
            />
            <button type="button" onClick={load} className="rounded-lg border border-[color:var(--vz-line)] px-3 py-1 text-[13px]">
              {t('Qidirish')}
            </button>
          </div>
        }
      >
        <p className="mb-3 text-[13px] text-[color:var(--vz-ink-faint)]">
          {t('Mijozlar biznes katalogidan qoldirgan buyurtmalar. Holatni biznes egasi o‘z kabinetida o‘zgartiradi.')}
        </p>
        {err && <LoadError err={err} onRetry={load} />}
        {!err && data === null && <AdminLoading rows={4} />}
        {!err && data && data.items.length === 0 && <EmptyState icon="bag" title={t('Buyurtma yo‘q')} />}
        {!err && data && data.items.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="text-[color:var(--vz-ink-faint)]">
                  <tr>
                    <th className="py-1 pr-3">#</th>
                    <th className="py-1 pr-3">{t('Biznes')}</th>
                    <th className="py-1 pr-3">{t('Mahsulot')}</th>
                    <th className="py-1 pr-3">{t('Soni')}</th>
                    <th className="py-1 pr-3">{t('Summa')}</th>
                    <th className="py-1 pr-3">{t('Mijoz')}</th>
                    <th className="py-1 pr-3">{t('Holat')}</th>
                    <th className="py-1">{t('Sana')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id} data-testid="company-order-item" className="border-t border-[color:var(--vz-line)] align-top">
                      <td className="py-1.5 pr-3">{o.id}</td>
                      <td className="py-1.5 pr-3">
                        <a className="font-mono" href={`/company/${o.company.id}`} target="_blank" rel="noreferrer">{o.company.id}</a>
                        {o.company.name && <div>{o.company.name}</div>}
                        {o.company.owner?.email && (
                          <div className="text-[12px] text-[color:var(--vz-ink-faint)]">{o.company.owner.email}</div>
                        )}
                      </td>
                      <td className="py-1.5 pr-3">
                        {o.itemName || '—'}
                        {o.note && <div className="text-[12px] text-[color:var(--vz-ink-faint)]">{t('Izoh')}: {o.note}</div>}
                      </td>
                      <td className="py-1.5 pr-3">{o.qty}</td>
                      <td className="py-1.5 pr-3">{o.price ? Number(o.price).toLocaleString('uz-UZ') : '—'}</td>
                      <td className="py-1.5 pr-3">
                        {o.customerName || '—'}
                        {o.customerPhone && <div className="text-[12px] text-[color:var(--vz-ink-dim)]">{o.customerPhone}</div>}
                      </td>
                      <td className="py-1.5 pr-3">
                        <StatusBadge tone={(ORDER_STATUS[o.status] || [])[1] || 'muted'}>
                          {t((ORDER_STATUS[o.status] || [o.status])[0])}
                        </StatusBadge>
                      </td>
                      <td className="py-1.5">{when(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.hasMore && (
              <button type="button" onClick={loadMore} disabled={more}
                className="mt-1 self-center rounded-lg border border-[color:var(--vz-line)] px-4 py-1.5 text-[13px]">
                {more ? t('Yuklanmoqda…') : t('Yana yuklash')}
              </button>
            )}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
