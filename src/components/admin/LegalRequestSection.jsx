import { useCallback, useRef, useState } from 'react';
import { AdminCard, AdminLoading, EmptyState, LoadError, StatusBadge } from './AdminUI.jsx';
import { useLanguage } from '../../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// HUQUQIY SO'ROV — NFCSTORE ILOVASI ichidagi bo'lim.
//
// Sud yoki huquqni muhofaza qiluvchi organ so'rovi kelganda bitta odam
// haqidagi HAMMA narsa: profil, ID lar, hozir turgan va o'chirilgan
// (dalil arxivi) kontent — bitta vaqt chizig'ida. Backend:
// hosting/api/legal-requests.js (faqat super_admin va manager; har
// ko'rish admin jurnaliga yoziladi).
//
//   • qidiruv — telefon, email, NFC ID, Business ID yoki #raqam;
//   • "hold" — hisob o'chirilsa ham purge qilinmaydi (izoh majburiy);
//   • ZIP — dossier.json + chop etiladigan report.html + media/… fayllar.
//     Brauzerda yig'iladi (fflate): fayllar KETMA-KET yuklanadi, ochilmagan
//     fayllar hisobotda "yetishmaydi" deb yoziladi.
// ═══════════════════════════════════════════════════════════════════════

const KIND_CHIPS = [
  ['', 'Hammasi'], ['post', 'Post'], ['reel', 'Reels'], ['story', 'Istoriya'],
  ['comment', 'Izoh'], ['card_video', 'Profil videosi'], ['card_file', 'Fayl'],
];
const SOURCE_CHIPS = [['', 'Hammasi'], ['live', 'Hozir turgan'], ['archive', 'O‘chirilgan']];
const KIND_LABEL = {
  post: 'Post', reel: 'Reels', story: 'Istoriya', highlight: 'Aktual',
  comment: 'Izoh', card_video: 'Profil videosi', card_file: 'Fayl',
};
const MATCHED_BY = {
  email: 'Email', phone: 'Telefon', nfc_id: 'NFC ID', business_id: 'Business ID', user_id: 'Foydalanuvchi raqami',
  nfc_id_history: 'NFC ID (avvalgi egasi)', business_id_history: 'Business ID (avvalgi egasi)',
};

function when(ms) {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('uz-UZ');
}
function whenDb(v) {
  if (!v) return '—';
  let s = String(v).trim();
  if (!s.includes('T')) s = s.replace(' ', 'T');
  s = s.replace(/\+00$/, 'Z');
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(s)) s += 'Z';
  return when(Date.parse(s));
}
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Faqat http(s) yoki sayt ichidagi '/...' havola — `javascript:` va
// boshqa sxemalar admin brauzerida bajarilmasin.
const safeHref = (u) => typeof u === 'string' && (/^https?:\/\//i.test(u) || (u.startsWith('/') && !u.startsWith('//')));

// Elementning barcha media manzillari (rasm, video, fayl, karusel).
function mediaOf(it) {
  return [it.imageUrl, it.videoUrl, it.fileUrl, ...(it.mediaUrls || [])].filter(Boolean);
}

// Chop etiladigan hisobot (o'zbekcha). Media — ZIP ichidagi nisbiy yo'l.
function reportHtml(dossier, paths, missing) {
  const s = dossier.subject;
  const rows = dossier.items.map((it, i) => {
    const media = mediaOf(it).map((u) => (paths.has(u)
      ? `<a href="${esc(paths.get(u))}">${esc(paths.get(u))}</a>`
      : `<span class="miss">${esc(u)} (yetishmaydi)</span>`)).join('<br>');
    return `<tr><td>${i + 1}</td><td>${esc(it.source === 'archive' ? 'O‘chirilgan' : 'Hozir turgan')}</td>
      <td>${esc(KIND_LABEL[it.kind] || it.kind)}</td><td>${esc(it.ownerCode)}</td>
      <td>${esc(when(it.createdAt))}</td><td>${esc(it.deletedAt ? when(it.deletedAt) : '')}</td>
      <td class="txt">${esc(it.text)}</td><td>${media}</td></tr>`;
  }).join('\n');
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>NFCSTORE — huquqiy so‘rov #${esc(s.userId)}</title>
<style>body{font:13px/1.45 system-ui,sans-serif;margin:24px;color:#111}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #bbb;padding:4px 6px;vertical-align:top;text-align:left}th{background:#eee}
.txt{white-space:pre-wrap;max-width:360px}.miss{color:#b00}h1{font-size:18px}dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px}
dt{font-weight:600}@media print{a{color:#000}}</style></head><body>
<h1>NFCSTORE — huquqiy so‘rov bo‘yicha ma’lumot</h1>
<dl><dt>Tayyorlangan</dt><dd>${esc(dossier.generatedAt)} (admin #${esc(dossier.generatedBy?.adminId)}, ${esc(dossier.generatedBy?.role)})</dd>
<dt>Foydalanuvchi raqami</dt><dd>${esc(s.userId)}</dd><dt>Email</dt><dd>${esc(s.email || '—')}</dd>
<dt>Telefon</dt><dd>${esc(s.phone || '—')}</dd><dt>Ro‘yxatdan o‘tgan</dt><dd>${esc(whenDb(s.createdAt))} (${esc(s.signupSource)})</dd>
<dt>NFC ID</dt><dd>${esc(s.cards.map((c) => c.code).join(', ') || '—')}</dd>
<dt>Business ID</dt><dd>${esc(s.companies.map((c) => c.id).join(', ') || '—')}</dd>
<dt>Avvalgi ID lar</dt><dd>${esc(s.formerIds.map((f) => f.id).join(', ') || '—')}</dd>
<dt>Hisob holati</dt><dd>${esc(s.status.purged ? 'Butunlay o‘chirilgan' : s.status.deletedAt ? 'O‘chirilgan (navbatda)' : 'Faol')}</dd>
<dt>Hold</dt><dd>${esc(s.legalHold ? `${s.legalHold.note} — ${s.legalHold.by}` : '—')}</dd>
<dt>Yozuvlar soni</dt><dd>${esc(dossier.total)}${dossier.truncated ? ' (cheklovga yetdi)' : ''}</dd></dl>
${missing.length ? `<p class="miss">Yuklab bo‘lmagan fayllar: ${missing.length} ta (jadvalda belgilangan).</p>` : ''}
<table><thead><tr><th>#</th><th>Manba</th><th>Tur</th><th>Profil</th><th>Joylangan</th><th>O‘chirilgan</th><th>Matn</th><th>Media</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
}

export default function LegalRequestSection({ adminApi, apiErrText, isSuper }) {
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const qRef = useRef('');
  const [kind, setKind] = useState('');
  const [source, setSource] = useState('');
  const [data, setData] = useState(null); // { subject, items, nextCursor }
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [holdNote, setHoldNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [zipState, setZipState] = useState(''); // progress / natija matni

  const fail = (e) => window.alert(apiErrText ? apiErrText(e, t, t('Amal bajarilmadi.')) : t('Amal bajarilmadi.'));

  const fetchPage = useCallback(async (opts = {}) => {
    const query = qRef.current.trim();
    if (!query) return;
    const params = new URLSearchParams({ q: query, limit: '50' });
    const k = opts.kind ?? kind;
    const s = opts.source ?? source;
    if (k) params.set('kind', k);
    if (s) params.set('source', s);
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (!opts.cursor) { setLoading(true); setErr(null); setNotFound(false); }
    try {
      const r = await adminApi(`/legal/subject?${params}`);
      setData((prev) => (opts.cursor && prev ? { ...r, items: [...prev.items, ...r.items] } : r));
    } catch (e) {
      if (e?.status === 404) { setNotFound(true); setData(null); } else if (opts.cursor) fail(e); else setErr(e);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminApi, kind, source]);

  const search = () => { qRef.current = q; fetchPage({}); };
  const pickKind = (k) => { setKind(k); if (data) fetchPage({ kind: k }); };
  const pickSource = (s) => { setSource(s); if (data) fetchPage({ source: s }); };

  const setHold = async (on) => {
    const s = data?.subject;
    if (!s) return;
    if (on && !holdNote.trim()) return;
    setBusy(true);
    try {
      const r = await adminApi('/legal/hold', { method: 'POST', body: JSON.stringify({ userId: s.userId, hold: on, note: holdNote.trim() }) });
      setData((d) => (d ? { ...d, subject: { ...d.subject, legalHold: r.hold } } : d));
      setHoldNote('');
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  // ZIP: dosye → media (ketma-ket, oqim bilan) → report.html, dossier.json.
  const downloadZip = async () => {
    const s = data?.subject;
    if (!s || zipState.startsWith('…')) return;
    try {
      setZipState(`… ${t('Dosye tayyorlanmoqda')}`);
      const dossier = await adminApi(`/legal/export?userId=${s.userId}&format=json`);
      const { Zip, ZipPassThrough, strToU8 } = await import('fflate');
      const chunks = [];
      let resolveDone;
      let rejectDone;
      const finished = new Promise((res, rej) => { resolveDone = res; rejectDone = rej; });
      const zip = new Zip((error, chunk, final) => {
        if (error) { rejectDone(error); return; }
        chunks.push(chunk);
        if (final) resolveDone();
      });
      const addBytes = (name, bytes) => {
        const f = new ZipPassThrough(name);
        zip.add(f);
        f.push(bytes, true);
      };
      // Har manzil bir marta; nom: tartib raqami + asl fayl nomi.
      const urls = [...new Set(dossier.items.flatMap(mediaOf))];
      const paths = new Map();
      const missing = [];
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const base = (String(url).split('?')[0].split('/').pop() || 'fayl').replace(/[^\w.-]/g, '_').slice(-80);
        const name = `media/${String(i + 1).padStart(4, '0')}-${base}`;
        setZipState(`… ${t('Media: {i} / {n}', { i: i + 1, n: urls.length })} — ${base}`);
        try {
          const res = await fetch(url, { credentials: 'same-origin' });
          if (!res.ok || !res.body) throw new Error(String(res.status));
          const f = new ZipPassThrough(name);
          zip.add(f);
          const reader = res.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            f.push(value);
          }
          f.push(new Uint8Array(0), true);
          paths.set(url, name);
        } catch {
          missing.push(url);
        }
      }
      addBytes('dossier.json', strToU8(JSON.stringify({ ...dossier, zip: { media: Object.fromEntries(paths), missing } }, null, 2)));
      addBytes('report.html', strToU8(reportHtml(dossier, paths, missing)));
      zip.end();
      await finished;
      const blob = new Blob(chunks, { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nfcstore-huquqiy-${s.userId}-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setZipState(missing.length
        ? t('Tayyor. Yuklab bo‘lmagan fayllar: {n} (hisobotda ko‘rsatilgan).', { n: missing.length })
        : t('Tayyor: {n} ta yozuv, {m} ta fayl.', { n: dossier.total, m: paths.size }));
    } catch (e) {
      setZipState('');
      fail(e);
    }
  };

  const s = data?.subject;
  const chip = (active) => `rounded-lg px-3 py-1 text-[13px] ${active
    ? 'bg-[color:var(--vz-accent)] text-[color:var(--accent-ink)]'
    : 'border border-[color:var(--vz-line)] text-[color:var(--vz-ink-dim)]'}`;

  return (
    <AdminCard title={t('Huquqiy so‘rov')}>
      <p className="mb-3 text-[13px] text-[color:var(--vz-ink-faint)]">
        {t('Faqat sud yoki huquqni muhofaza qiluvchi organ so‘rovi bilan ishlating; har bir ko‘rish jurnalga yoziladi.')}
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
          placeholder={t('Telefon, email, NFC ID, Business ID yoki #raqam')}
          aria-label={t('Kimni qidiryapmiz')}
          className="min-w-0 flex-1 rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2 text-[14px] sm:max-w-md"
        />
        <button type="button" onClick={search} disabled={!q.trim() || loading}
          className="rounded-lg border border-[color:var(--vz-line)] px-4 py-2 text-[14px] disabled:opacity-40">
          {t('Qidirish')}
        </button>
      </div>

      {err && <LoadError err={err} onRetry={() => fetchPage({})} />}
      {loading && <AdminLoading rows={4} />}
      {!loading && notFound && <EmptyState icon="users" title={t('Hech narsa topilmadi.')} />}

      {!loading && s && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[color:var(--vz-line)] p-3 text-[13px]" data-testid="legal-subject">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-[15px] text-[color:var(--vz-ink)]">#{s.userId}</b>
              <span className="break-all">{s.email || '—'}</span>
              <span>{s.phone || '—'}</span>
              <StatusBadge tone="muted">{t('Topildi')}: {t(MATCHED_BY[s.matchedBy] || s.matchedBy || '')}</StatusBadge>
              {s.status.purged ? <StatusBadge tone="danger">{t('Butunlay o‘chirilgan')}</StatusBadge>
                : s.status.deletedAt ? <StatusBadge tone="pending">{t('O‘chirish navbatida')}</StatusBadge> : null}
              {s.status.suspendedUntil ? <StatusBadge tone="pending">{t('Bloklangan')}</StatusBadge> : null}
              {s.isTest ? <StatusBadge tone="muted">{t('TEST HISOB')}</StatusBadge> : null}
            </div>
            <div className="mt-1 text-[color:var(--vz-ink-dim)]">
              {t("Ro'yxatdan o'tgan")}: {whenDb(s.createdAt)} · {s.signupSource === 'web' ? t('Sayt') : t('Ilova')}
            </div>
            <div className="mt-1 text-[color:var(--vz-ink-dim)]">
              {t('NFC ID')}: <span className="font-mono">{s.cards.map((c) => c.code).join(', ') || '—'}</span>
              {' · '}{t('Business ID')}: <span className="font-mono">{s.companies.map((c) => c.id).join(', ') || '—'}</span>
              {s.formerIds.length ? <> {' · '}{t('Avvalgi ID lar')}: <span className="font-mono">{s.formerIds.map((f) => f.id).join(', ')}</span></> : null}
            </div>
            {s.candidates && (
              <div className="mt-1 text-[color:var(--warning)]">{t('Shu telefon bilan bir nechta hisob: {ids}', { ids: s.candidates.map((x) => `#${x}`).join(', ') })}</div>
            )}

            <div className="mt-3 rounded-lg border border-[color:var(--vz-line)] p-2">
              {s.legalHold ? (
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="danger">{t('Hold yoqilgan')}</StatusBadge>
                  <span className="break-words">{s.legalHold.note}</span>
                  <span className="text-[color:var(--vz-ink-faint)]">· {s.legalHold.by} · {whenDb(s.legalHold.at)}</span>
                  {isSuper && (
                    <button type="button" className="btn btn-xs ml-auto" disabled={busy} onClick={() => setHold(false)}>{t('Holdni olib tashlash')}</button>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input value={holdNote} onChange={(e) => setHoldNote(e.target.value)} maxLength={300}
                    placeholder={t('Masalan: Sud so‘rovi №…')} aria-label={t('Hold sababi')}
                    className="min-w-0 flex-1 rounded-lg border border-[color:var(--vz-line)] bg-transparent px-2 py-1 text-[13px]" />
                  <button type="button" className="btn btn-xs" disabled={busy || !holdNote.trim()} onClick={() => setHold(true)}>{t('Hold qo‘yish')}</button>
                </div>
              )}
              <div className="mt-1 text-[12px] text-[color:var(--vz-ink-faint)]">
                {t('Hold — hisob o‘chirilsa ham ma’lumot va fayllar butunlay o‘chirilmaydi.')}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {KIND_CHIPS.map(([k, label]) => (
              <button key={k || 'all'} type="button" aria-pressed={kind === k} onClick={() => pickKind(k)} className={chip(kind === k)}>{t(label)}</button>
            ))}
            <span className="mx-1 h-5 w-px bg-[color:var(--vz-line)]" aria-hidden="true" />
            {SOURCE_CHIPS.map(([k, label]) => (
              <button key={k || 'all'} type="button" aria-pressed={source === k} onClick={() => pickSource(k)} className={chip(source === k)}>{t(label)}</button>
            ))}
            <button type="button" onClick={downloadZip} disabled={zipState.startsWith('…')}
              className="ml-auto rounded-lg border border-[color:var(--vz-line)] px-3 py-1 text-[13px] disabled:opacity-40">
              {t('ZIP yuklab olish')}
            </button>
          </div>
          {zipState && <div className="text-[13px] text-[color:var(--vz-ink-dim)]" role="status">{zipState}</div>}

          {data.items.length === 0 ? <EmptyState title={t('Bu filtr bo‘yicha yozuv yo‘q.')} /> : (
            <div className="flex flex-col gap-2" data-testid="legal-timeline">
              {data.items.map((it) => (
                <div key={it.uid} className={`rounded-xl border p-3 ${it.source === 'archive' ? 'border-red-400/60' : 'border-[color:var(--vz-line)]'}`}>
                  <div className="flex flex-wrap items-baseline gap-2 text-[12px] text-[color:var(--vz-ink-faint)]">
                    <StatusBadge tone="info">{t(KIND_LABEL[it.kind] || it.kind)}</StatusBadge>
                    {it.source === 'archive'
                      ? <StatusBadge tone="danger">{t('O‘chirilgan')}</StatusBadge>
                      : <StatusBadge tone="success">{t('Hozir turgan')}</StatusBadge>}
                    {it.ownerCode && <span className="font-mono">{it.ownerCode}</span>}
                    <span>· {t('yozilgan')}: {when(it.createdAt)}</span>
                    {it.deletedAt && <span>· {t('o‘chirilgan')}: {when(it.deletedAt)}</span>}
                    {it.expiresAt && it.expiresAt < Date.now() && <span>· {t('muddati o‘tgan')}</span>}
                    {it.deletedBy && (
                      <span>· {t('Kim o‘chirdi')}: {it.deletedBy.admin || (it.deletedBy.userId ? `user#${it.deletedBy.userId}` : t('Tizim'))}</span>
                    )}
                  </div>
                  {it.text && <p className="mt-1 whitespace-pre-wrap break-words text-[14px] text-[color:var(--vz-ink-dim)]">{it.text}</p>}
                  {mediaOf(it).length > 0 && (
                    <div className="mt-2 flex flex-wrap items-start gap-2">
                      {[it.videoUrl ? '' : it.imageUrl, ...(it.mediaUrls || [])].filter(safeHref).map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer">
                          <img src={u} alt="" loading="lazy" className="h-24 w-24 rounded-lg object-cover" />
                        </a>
                      ))}
                      {safeHref(it.videoUrl) && (
                        <a href={it.videoUrl} target="_blank" rel="noreferrer" className="relative block">
                          <video src={it.videoUrl} poster={it.imageUrl || undefined} preload="metadata" muted
                            className="h-24 w-24 rounded-lg bg-black object-cover" />
                          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[11px] text-white">{t('Video')}</span>
                        </a>
                      )}
                      {safeHref(it.fileUrl) && <a href={it.fileUrl} target="_blank" rel="noreferrer" className="text-[13px] underline">{t('Faylni ochish')}</a>}
                    </div>
                  )}
                </div>
              ))}
              {data.nextCursor && (
                <button type="button" className="self-start rounded-lg border border-[color:var(--vz-line)] px-3 py-1 text-[13px]"
                  onClick={() => fetchPage({ cursor: data.nextCursor })}>
                  {t('Yana yuklash')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </AdminCard>
  );
}
