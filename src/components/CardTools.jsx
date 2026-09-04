import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { fmt, timeAgo } from '../lib/format.js';
import { authUpdateCard } from '../lib/auth.jsx';
import {
  dbGetAnalytics, dbListLeads, dbDeleteLead,
  dbGetFiles, dbUploadFile, dbUpdateFile, dbDeleteFile,

  dbUploadImage,
} from '../lib/db.js';
import { effectiveAccess, featureAllowed, fileLimitFor } from '../lib/access.js';
import { IconChevronDown } from './Icons.jsx';

// Yig'iladigan bo'lim — AccountPage'dagi Section bilan bir xil ko'rinish.
function Section({ title, subtitle, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={`mt-4 overflow-hidden rounded-2xl border bg-base-200/30 backdrop-blur-sm transition-all duration-200 first:mt-0 ${open ? 'border-accent/25 shadow-[0_10px_35px_rgba(0,0,0,0.35)]' : 'border-white/10 hover:border-white/20'}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
        <div>
          <div className="text-sm font-bold">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-base-content/45">{subtitle}</div>}
        </div>
        <span className={`shrink-0 text-base-content/50 transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`}>
          <IconChevronDown />
        </span>
      </button>
      {open && <div className="border-t border-white/10 px-4 pb-5 pt-4">{children}</div>}
    </div>
  );
}

const EVENT_LABELS = {
  profile_view: 'Profil ko‘rildi',
  phone_click: 'Telefon bosildi',
  telegram_click: 'Telegram bosildi',
  whatsapp_click: 'WhatsApp bosildi',
  instagram_click: 'Instagram bosildi',
  website_click: 'Sayt bosildi',
  email_click: 'Email bosildi',
  link_click: 'Havola bosildi',
  contact_save: 'Kontakt saqlandi',
  lead: 'Yangi lead',
  menu_view: 'Menyu ko‘rildi',
};
const RANGE_OPTS = [7, 30, 90];

function AnalyticsSection({ code, advancedAllowed }) {
  const { t } = useLanguage();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let off = false;
    setLoading(true); setErr(false);
    dbGetAnalytics(code, days)
      .then((d) => { if (!off) setData(d); })
      .catch(() => { if (!off) setErr(true); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [code, days]);

  const maxDay = data?.byDay?.reduce((m, r) => Math.max(m, r.n), 0) || 1;

  return (
    <div>
      {loading && <div className="text-sm text-base-content/45">{t('Yuklanmoqda...')}</div>}
      {err && <div className="text-sm text-error">{t('Statistikani yuklab bo‘lmadi.')}</div>}
      {data && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-2xl font-extrabold">{fmt(data.totalViews)}</div>
              <div className="text-[14px] text-base-content/50">{t('Ko‘rishlar')} · {t('{n} kun', { n: data.days })}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-2xl font-extrabold">{fmt(data.uniqueVisitors)}</div>
              <div className="text-[14px] text-base-content/50">{t('Alohida tashrifchi')}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-2xl font-extrabold">{fmt(data.legacyViews || 0)}</div>
              <div className="text-[14px] text-base-content/50">{t('Jami (butun davr)')}</div>
            </div>
          </div>

          {Object.keys(data.byType || {}).filter((k) => k !== 'profile_view').length > 0 && (
            <div className="mt-4 space-y-1.5">
              {Object.entries(data.byType).filter(([k]) => k !== 'profile_view').sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-base-content/70">{t(EVENT_LABELS[k] || k)}</span>
                  <span className="font-semibold">{fmt(n)}</span>
                </div>
              ))}
            </div>
          )}

          {advancedAllowed ? (
            <>
              <div className="mt-5 flex gap-1.5">
                {RANGE_OPTS.map((d) => (
                  <button key={d} onClick={() => setDays(d)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${days === d ? 'bg-accent text-accent-content' : 'bg-white/5 text-base-content/60'}`}>
                    {t('{n} kun', { n: d })}
                  </button>
                ))}
              </div>

              {data.byDay && data.byDay.length > 0 ? (
                <div className="mt-3 flex h-28 items-end gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-2">
                  {data.byDay.map((r) => (
                    <div key={r.day} className="flex min-w-[6px] flex-1 flex-col items-center justify-end" title={`${r.day}: ${r.n}`}>
                      <div className="w-full rounded-t bg-accent/70" style={{ height: `${Math.max(3, (r.n / maxDay) * 100)}%` }}></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-base-content/45">{t('Bu davrda ko‘rish bo‘lmagan.')}</div>
              )}

              {data.byRef && data.byRef.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-base-content/55">{t('Eng ko‘p bosilgan havolalar')}</div>
                  <div className="mt-2 space-y-1">
                    {data.byRef.map((r) => (
                      <div key={r.ref} className="flex items-center justify-between text-sm">
                        <span className="truncate text-base-content/70">{r.ref}</span>
                        <span className="ml-3 shrink-0 font-semibold">{fmt(r.n)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 w-full rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-sm text-base-content/70">
              {'\u{1F512}'} {t('Kunlik grafik, havola taqsimoti va 90 kunlik tarix — Gold NFC ID yoki Profile Premiumda ochiladi.')}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Lead capture — yoqish/o'chirish toggle (darhol saqlanadi) + kelgan lidlar.
function LeadsSection({ code, name, allowed, initialEnabled }) {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(!!initialEnabled);
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState(null);
  const [err, setErr] = useState(false);

  const load = () => dbListLeads(code).then(setLeads).catch(() => setErr(true));
  useEffect(() => { if (enabled) load(); }, [code, enabled]);

  const toggle = async () => {
    if (!allowed) return;
    const next = !enabled;
    setSaving(true);
    try {
      // Server 'name' ni majburiy talab qiladi — mavjud nomni yuboramiz.
      await authUpdateCard(code, { name, leadCapture: next });
      setEnabled(next);
    } catch { /* jim */ } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm(t('Bu lidni o‘chirasizmi?'))) return;
    try { await dbDeleteLead(code, id); setLeads((ls) => (ls || []).filter((l) => l.id !== id)); }
    catch { /* jim */ }
  };

  return (
    <div>
      <label className={`flex items-start gap-2.5 text-sm ${allowed ? '' : 'opacity-50'}`}>
        <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={enabled} disabled={!allowed || saving} onChange={toggle} />
        <span>
          {t('Profilimda «Kontaktingizni qoldiring» formasini ko‘rsatish')}
          <span className="mt-0.5 block text-xs text-base-content/45">
            {allowed
              ? t('Tashrifchi ism va aloqa ma’lumotini qoldiradi — siz bu yerda ko‘rasiz.')
              : t('Lidlarni yig‘ish — Gold NFC ID yoki Profile Premiumda ochiladi.')}
          </span>
        </span>
      </label>

      <div className="mt-4">
        {!enabled && <div className="text-sm text-base-content/50">{t('«Lidlarni yig‘ish» yoqilmagan — yoqsangiz, profilingizda kontakt formasi paydo bo‘ladi.')}</div>}
        {enabled && err && <div className="text-sm text-error">{t('Lidlarni yuklab bo‘lmadi.')}</div>}
        {enabled && !err && !leads && <div className="text-sm text-base-content/45">{t('Yuklanmoqda...')}</div>}
        {enabled && leads && leads.length === 0 && <div className="text-sm text-base-content/45">{t('Hozircha lid yo‘q.')}</div>}
        {enabled && leads && leads.length > 0 && (
          <div className="space-y-2">
            {leads.map((l) => (
              <div key={l.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{l.name}{l.company ? ` · ${l.company}` : ''}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[15px] text-base-content/70">
                      {l.phone && <a className="link" href={`tel:${l.phone}`}>{l.phone}</a>}
                      {l.telegram && <a className="link" href={`https://t.me/${l.telegram}`} target="_blank" rel="noreferrer">@{l.telegram}</a>}
                      {l.whatsapp && <a className="link" href={`https://wa.me/${l.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                      {l.email && <a className="link" href={`mailto:${l.email}`}>{l.email}</a>}
                    </div>
                    {l.note && <div className="mt-1 whitespace-pre-wrap text-[15px] text-base-content/55">{l.note}</div>}
                    <div className="mt-1 text-[14px] text-base-content/35">{timeAgo(new Date(l.createdAt).getTime())}</div>
                  </div>
                  <button className="btn btn-ghost btn-xs shrink-0" onClick={() => remove(l.id)}>{t("O'chirish")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilesSection({ code, access, allowed }) {
  const { t } = useLanguage();
  const [files, setFiles] = useState(null);
  const [err, setErr] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const limit = fileLimitFor(access);

  const load = () => dbGetFiles(code).then(setFiles).catch(() => setErr(true));
  useEffect(() => { if (allowed) load(); }, [code, allowed]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') { flash(t('Faqat PDF fayl qabul qilinadi.')); return; }
    if (file.size > 8 * 1024 * 1024) { flash(t('Fayl hajmi 8 MB dan oshmasligi kerak.')); return; }
    setBusy(true);
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onerror = () => rej(new Error('read'));
        r.onload = () => res(r.result);
        r.readAsDataURL(file);
      });
      await dbUploadFile(code, title.trim() || file.name.replace(/\.pdf$/i, ''), dataUrl);
      setTitle('');
      await load();
    } catch (er) {
      const m = {
        limit_reached: t('Fayl limiti tugadi ({n} ta).', { n: limit }),
        too_large: t('Fayl hajmi 8 MB dan oshmasligi kerak.'),
        bad_file: t('Faqat PDF fayl qabul qilinadi.'),
        feature_locked: t('Fayllar — Gold NFC ID yoki Profile Premiumda ochiladi.'),
      };
      flash(m[er.message] || t('Yuklashda xatolik.'));
    } finally { setBusy(false); }
  };

  const rename = async (f) => {
    const v = prompt(t('Fayl nomi'), f.title);
    if (v == null || !v.trim() || v.trim() === f.title) return;
    await dbUpdateFile(code, f.id, { title: v.trim() });
    await load();
  };
  const del = async (f) => {
    if (!confirm(t('Bu faylni o‘chirasizmi?'))) return;
    await dbDeleteFile(code, f.id);
    setFiles((fs) => (fs || []).filter((x) => x.id !== f.id));
  };

  if (!allowed) {
    return (
      <div className="w-full rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-sm text-base-content/70">
        {'\u{1F512}'} {t('Fayllar — Gold NFC ID yoki Profile Premiumda ochiladi.')}
      </div>
    );
  }
  if (err) return <div className="text-sm text-error">{t('Fayllarni yuklab bo‘lmadi.')}</div>;
  if (!files) return <div className="text-sm text-base-content/45">{t('Yuklanmoqda...')}</div>;

  return (
    <div className="space-y-3">
      <div className="text-xs text-base-content/50">{t('Fayllar')}: {files.length}/{limit} · {t('PDF, maks. 8 MB')}</div>
      {msg && <div className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{msg}</div>}

      <div className="space-y-2">
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5">
            <span className="text-accent">📄</span>
            <a href={f.fileUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">{f.title}</a>
            {f.sizeBytes != null && <span className="shrink-0 text-[14px] text-base-content/40">{Math.round(f.sizeBytes / 1024)} KB</span>}
            <button className="btn btn-ghost btn-xs" onClick={() => rename(f)}>{t('Nomi')}</button>
            <button className="btn btn-ghost btn-xs text-error" onClick={() => del(f)}>{t("O'chirish")}</button>
          </div>
        ))}
      </div>

      {files.length < limit && (
        <div className="flex flex-wrap items-center gap-2">
          <input className="input input-bordered input-sm min-w-0 flex-1 bg-base-100" placeholder={t('Fayl nomi (masalan: Narxnoma 2026)')}
            value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="btn btn-primary btn-sm">
            {busy ? <span className="loading loading-spinner loading-xs"></span> : t('PDF yuklash')}
            <input type="file" accept="application/pdf" className="hidden" onChange={onFile} disabled={busy} />
          </label>
        </div>
      )}
    </div>
  );
}

// Bitta kartaning boshqaruv vositalari — Sozlamalar sahifasida ko'rsatiladi.
export default function CardTools({ card }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  if (!card) return null;
  const access = effectiveAccess(card, user);

  return (
    <div>
      <Section title={t('Statistika')} subtitle={t('Profil ko‘rishlari va havola bosishlari')} defaultOpen>
        <AnalyticsSection code={card.code} advancedAllowed={featureAllowed('advancedAnalytics', access)} />
      </Section>

      <Section title={t('Lidlar')} subtitle={t('Tashrifchilar qoldirgan kontaktlar')}>
        <LeadsSection code={card.code} name={card.name} allowed={featureAllowed('leadCapture', access)} initialEnabled={!!card.leadCapture} />
      </Section>

      <Section title={t('Fayllar va hujjatlar')} subtitle={t('PDF, narxnoma, katalog, CV')}>
        <FilesSection code={card.code} access={access} allowed={featureAllowed('fileCatalog', access)} />
      </Section>
    </div>
  );
}
