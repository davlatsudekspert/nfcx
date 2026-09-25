import { useEffect, useState } from 'react';
import { AdminLoading, LoadError, StatusBadge, WarnBanner } from './AdminUI.jsx';
import { useConfirm } from './ConfirmDialog.jsx';
import { useLanguage } from '../../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// NAMUNA BIZNESLAR (2026-09-25)
//
// Egasi: "demo profillar qilib qo'ysang — biznes profillar har sohadan,
// narxlar reallikka yaqin, profil to'liq". Server: `hosting/api/demo-businesses.js`.
//
// Bitta tugma — 12 ta to'qima biznes (logo, fon, ish vaqti, 8–12
// mahsulot, 3 post) yaratiladi; ikkinchi tugma — hammasi o'chadi.
// Profillarda «Namuna» belgisi turadi, buyurtma qabul qilinmaydi,
// postlari umumiy lentaga tushmaydi. Haqiqiy odam olgan ID ga tegilmaydi.
//
// `adminApi` PROP orqali keladi (MusicTab bilan bir xil sabab).
// ═══════════════════════════════════════════════════════════════════════

export default function DemoBusinessesTab({ adminApi, apiErrText, isManager }) {
  const { t } = useLanguage();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoadErr(null);
    return adminApi('/demo-businesses').then(setData).catch((e) => setLoadErr(e));
  };
  useEffect(() => { load(); }, []);

  const run = async (method) => {
    setErr(null); setMsg('');
    if (method === 'DELETE') {
      const ok = await confirm({
        title: t('Namuna bizneslarni o‘chirasizmi?'),
        message: t('Faqat namuna profillar, ularning mahsulotlari va postlari o‘chadi. Haqiqiy bizneslarga tegilmaydi.'),
        confirmLabel: t('O‘chirish'),
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(method);
    try {
      const r = await adminApi('/demo-businesses', { method });
      setData(r);
      setMsg(method === 'POST'
        ? t('{n} ta namuna biznes yaratildi.', { n: (r.created || []).length })
        : t('{n} ta namuna biznes o‘chirildi.', { n: (r.removed || []).length }));
    } catch (e) {
      setErr(apiErrText(e));
    } finally {
      setBusy('');
    }
  };

  if (loadErr) return <LoadError err={loadErr} onRetry={load} title={t('Ma’lumotni yuklab bo‘lmadi.')} />;
  if (!data) return <AdminLoading />;
  const list = data.businesses || [];

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="vz-card p-4">
        <h2 className="text-lg font-bold">{t('Namuna bizneslar')}</h2>
        <p className="mt-1 text-[13.5px]" style={{ color: 'var(--vz-ink-2)' }}>
          {t('Har sohadan to‘liq to‘ldirilgan namuna profillar: logo, fon, ish vaqti, mahsulot va narxlar, postlar. Profilda «Namuna» belgisi turadi, buyurtma qabul qilinmaydi, postlar umumiy lentaga tushmaydi.')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[13.5px]" style={{ color: 'var(--vz-ink-2)' }}>
            {t('Saytda')}: <b>{data.active}</b> / {data.total}
          </span>
          {isManager && (
            <>
              <button type="button" className="btn btn-gold btn-sm min-h-11" onClick={() => run('POST')} disabled={!!busy || data.active === data.total}>
                {busy === 'POST' ? <span className="loading loading-spinner loading-xs" /> : t('Namuna bizneslarni yaratish')}
              </button>
              <button type="button" className="btn btn-ghost-vz btn-sm min-h-11" onClick={() => run('DELETE')} disabled={!!busy || data.active === 0}>
                {busy === 'DELETE' ? <span className="loading loading-spinner loading-xs" /> : t('Hammasini o‘chirish')}
              </button>
            </>
          )}
        </div>
        {!isManager && <p className="mt-2 text-[12.5px]" style={{ color: 'var(--vz-ink-3)' }}>{t('Yaratish va o‘chirish — faqat manager va undan yuqori.')}</p>}
        {msg && <p role="status" className="mt-2 text-[13.5px] font-semibold" style={{ color: 'var(--vz-ok, #16a34a)' }}>{msg}</p>}
        {err && <div role="alert" className="vz-err mt-2">{err}</div>}
      </div>

      {list.some((b) => b.taken) && (
        <WarnBanner>{t('Ba’zi namuna ID larini haqiqiy foydalanuvchi olgan — ular o‘tkazib yuboriladi.')}</WarnBanner>
      )}

      <div className="vz-card p-2 sm:p-4">
        <div className="divide-y" style={{ borderColor: 'var(--vz-line)' }}>
          {list.map((b) => (
            <div key={b.companyId} className="flex flex-wrap items-center gap-3 px-2 py-3" style={{ borderColor: 'var(--vz-line)' }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-semibold">{b.displayName}</span>
                  <span className="vz-badge vz-badge--muted">{b.subcategory}</span>
                </div>
                <div className="mt-0.5 font-mono text-[12.5px]" style={{ color: 'var(--vz-ink-3)' }}>{b.companyId}</div>
              </div>
              {b.taken
                ? <StatusBadge tone="pending">{t('ID band')}</StatusBadge>
                : b.exists
                  ? <>
                      <span className="text-[12.5px]" style={{ color: 'var(--vz-ink-3)' }}>{t('{n} mahsulot', { n: b.items })} · {t('{n} post', { n: b.posts })}</span>
                      <StatusBadge tone="success">{t('Saytda')}</StatusBadge>
                      <a className="btn btn-ghost-vz btn-xs min-h-9" href={`/c/${b.companyId.toLowerCase()}`} target="_blank" rel="noreferrer">{t('Ochish')} ↗</a>
                    </>
                  : <StatusBadge tone="muted">{t('Yaratilmagan')}</StatusBadge>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
