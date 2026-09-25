import { useEffect, useRef, useState } from 'react';
import { AdminIcon, AdminLoading, EmptyState, LoadError, StatusBadge } from './AdminUI.jsx';
import { useLanguage } from '../../lib/i18n.jsx';
import { dbUploadFileBinary } from '../../lib/db.js';

// ═══════════════════════════════════════════════════════════════════════
// MUSIQA KUTUBXONASI (2026-09-25)
//
// Ilovada rasm/videoga qo'yiladigan musiqa shu yerdan keladi
// (`hosting/api/music.js`). Ilova faqat YOQILGAN treklarni ko'radi.
//
// Yuklash: bir nechta mp3 birdan tanlanadi. `nom.mp3` va `nom-30s.mp3`
// juftlanadi (to'liq trek + 30 soniyalik bo'lak). Nomi, ijrochisi,
// janri va manbasi fayl ichidagi ID3 teglaridan o'qiladi — yuklashdan
// oldin har birini tahrirlash mumkin. Davomiylik brauzerning o'zidan.
//
// Faqat huquqi bizda bo'lgan musiqa: o'z kanalimiz yoki CC0 / public
// domain. "Manba" maydoni shuning uchun majburiy ko'rinadi.
//
// `adminApi` PROP orqali keladi (NovaTab bilan bir xil sabab).
// ═══════════════════════════════════════════════════════════════════════

const CLIP_RE = /-30s\.(mp3|m4a|aac|ogg|wav)$/i;
const baseName = (n) => n.replace(CLIP_RE, '').replace(/\.(mp3|m4a|aac|ogg|wav)$/i, '');

function mmss(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ID3v2 matn teglari: TIT2 (nomi), TPE1 (ijrochi), TCON (janr), COMM (manba).
function decodeText(bytes, enc) {
  try {
    if (enc === 1 || enc === 2) return new TextDecoder(enc === 2 ? 'utf-16be' : 'utf-16').decode(bytes);
    return new TextDecoder(enc === 3 ? 'utf-8' : 'latin1').decode(bytes);
  } catch { return ''; }
}
const clean = (s) => String(s || '').replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();

export async function readId3(file) {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
  const ver = head[3];
  const syncsafe = (b, o) => (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];
  const size = syncsafe(head, 6);
  const b = new Uint8Array(await file.slice(10, 10 + Math.min(size, 512 * 1024)).arrayBuffer());
  const out = {};
  let p = 0;
  while (p + 10 <= b.length) {
    const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const len = ver >= 4 ? syncsafe(b, p + 4) : ((b[p + 4] << 24) | (b[p + 5] << 16) | (b[p + 6] << 8) | b[p + 7]) >>> 0;
    const body = b.subarray(p + 10, p + 10 + len);
    p += 10 + len;
    if (!body.length) continue;
    const enc = body[0];
    if (id === 'TIT2') out.title = clean(decodeText(body.subarray(1), enc));
    else if (id === 'TPE1') out.artist = clean(decodeText(body.subarray(1), enc));
    else if (id === 'TCON') out.genre = clean(decodeText(body.subarray(1), enc));
    else if (id === 'COMM' || id === 'TXXX') {
      // COMM: enc(1) + til(3) + tavsif\0 + matn. TXXX: enc(1) + tavsif\0 + matn
      // (ffmpeg `-metadata comment=` ni ba'zan TXXX:comment qilib yozadi).
      const rest = body.subarray(id === 'COMM' ? 4 : 1);
      const wide = enc === 1 || enc === 2;
      let z = 0;
      if (wide) { while (z + 1 < rest.length && (rest[z] || rest[z + 1])) z += 2; }
      else { while (z < rest.length && rest[z]) z += 1; }
      const desc = clean(decodeText(rest.subarray(0, z), enc));
      const txt = clean(decodeText(rest.subarray(z + (wide ? 2 : 1)), enc));
      const wanted = id === 'COMM' || /^(comment|source|manba)$/i.test(desc);
      if (wanted && txt && !/musiqa kutubxonasi/i.test(txt)) out.source = txt;
    }
  }
  return out;
}

// Davomiylik. Ba'zi brauzerlar (masalan Yandex) `loadedmetadata` ni umuman
// yubormaydi — shunda ro'yxat hech qachon chiqmasdi. 4 s dan keyin fayl
// hajmidan taxmin qilinadi (192 kbps).
function audioDuration(file) {
  const guess = Math.round((file.size * 8) / 192000);
  return new Promise((resolve) => {
    let url = '';
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      if (url) URL.revokeObjectURL(url);
      resolve(v > 0 ? v : guess);
    };
    setTimeout(() => done(0), 4000);
    try {
      url = URL.createObjectURL(file);
      const a = new Audio();
      a.preload = 'metadata';
      a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? Math.round(a.duration) : 0);
      a.onerror = () => done(0);
      a.src = url;
    } catch { done(0); }
  });
}

export default function MusicTab({ adminApi, apiErrText, isManager }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState(null);
  const [genres, setGenres] = useState([]);
  const [loadErr, setLoadErr] = useState(null);
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState('');
  const [playing, setPlaying] = useState(null);
  const player = useRef(null);

  const load = () => {
    setLoadErr(null);
    return adminApi('/music').then((d) => { setRows(d.tracks || []); setGenres(d.genres || []); }).catch((e) => setLoadErr(e));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => () => player.current?.pause(), []);

  const play = (url) => {
    if (!player.current) player.current = new Audio();
    const a = player.current;
    if (playing === url) { a.pause(); setPlaying(null); return; }
    a.src = url;
    a.onended = () => setPlaying(null);
    a.play().then(() => setPlaying(url)).catch(() => setPlaying(null));
  };

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setErr(null);
    const isClip = (f) => CLIP_RE.test(f.name);
    const fullNames = new Set(files.filter((f) => !isClip(f)).map((f) => baseName(f.name)));
    const clips = new Map(files.filter(isClip).map((f) => [baseName(f.name), f]));
    // To'liq trek + juft 30 s bo'lak. Juftsiz 30 s bo'lak ham o'zi alohida
    // trek bo'ladi (egasi faqat `-30s.mp3` larni tanlaganda ro'yxat bo'sh
    // chiqib qolgan edi).
    const fulls = files.filter((f) => !isClip(f) || !fullNames.has(baseName(f.name)));
    const items = fulls.map((f) => ({
      key: f.name + f.size, file: f, clip: isClip(f) ? null : clips.get(baseName(f.name)) || null,
      title: baseName(f.name).replace(/[-_]+/g, ' '), artist: '', genre: 'Boshqa', source: '',
      durationSec: 0, state: 'reading', error: '',
    }));
    if (!items.length) { setErr(t('Audio fayl topilmadi.')); return; }
    // Ro'yxat DARHOL chiqadi; teglar va davomiylik keyin (parallel) to'ldiriladi.
    setQueue((q) => [...q, ...items]);
    await Promise.all(items.map(async (it) => {
      const tag = await readId3(it.file).catch(() => ({}));
      const durationSec = await audioDuration(it.file);
      setQueue((q) => q.map((x) => (x.key !== it.key ? x : {
        ...x,
        title: tag.title || x.title,
        artist: tag.artist || x.artist,
        genre: genres.includes(tag.genre) ? tag.genre : x.genre,
        source: tag.source || x.source,
        durationSec,
        state: x.state === 'reading' ? 'ready' : x.state,
      })));
    }));
  };

  const patchItem = (key, patch) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const uploadAll = async () => {
    setBusy(true); setErr(null);
    for (const it of queue) {
      if (it.state === 'done') continue;
      if (it.state === 'reading') { patchItem(it.key, { state: 'error', error: t('Fayl hali o‘qilmoqda — bir soniyadan keyin qayta bosing.') }); continue; }
      if (!it.title.trim() || !it.source.trim()) { patchItem(it.key, { state: 'error', error: t('Nomi va manbasini kiriting.') }); continue; }
      patchItem(it.key, { state: 'uploading', error: '' });
      try {
        const full = await dbUploadFileBinary(it.file, { audio: true });
        const clip = it.clip ? await dbUploadFileBinary(it.clip, { audio: true }) : null;
        await adminApi('/music', {
          method: 'POST',
          body: JSON.stringify({ title: it.title, artist: it.artist, genre: it.genre, source: it.source, durationSec: it.durationSec, audioUrl: full.url, clipUrl: clip?.url || '' }),
        });
        patchItem(it.key, { state: 'done' });
      } catch (e2) {
        patchItem(it.key, { state: 'error', error: e2?.status ? apiErrText(e2, t) : (e2?.message || t('Faylni yuklab bo‘lmadi.')) });
      }
    }
    setBusy(false);
    setQueue((q) => q.filter((x) => x.state !== 'done'));
    load();
  };

  const update = async (tr, patch) => {
    setErr(null);
    try { await adminApi(`/music/${tr.id}`, { method: 'PATCH', body: JSON.stringify(patch) }); await load(); }
    catch (e2) { setErr(apiErrText(e2, t)); }
  };
  const remove = async (tr) => {
    if (!window.confirm(t('Trekni o‘chirasizmi?') + ` «${tr.title}»`)) return;
    setErr(null);
    try { await adminApi(`/music/${tr.id}`, { method: 'DELETE' }); await load(); }
    catch (e2) { setErr(e2?.code === 'in_use' ? t('Bu trek postlarda ishlatilgan — o‘chirib bo‘lmaydi, yashiring.') : apiErrText(e2, t)); }
  };

  const shown = (rows || []).filter((r) => !filter || r.genre === filter);
  const enabledCount = (rows || []).filter((r) => r.enabled).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="vz-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="vz-kicker">{t('Musiqa kutubxonasi')}</span>
            <p className="mt-1 max-w-2xl text-[13.5px]" style={{ color: 'var(--vz-ink-2)' }}>
              {t('Ilovada rasm va videoga qo‘yiladigan musiqa. Faqat huquqi bizda bo‘lgan treklar: o‘z kanalimiz yoki CC0 / public domain.')}
            </p>
          </div>
          {isManager && (
            <label className={`btn btn-gold btn-sm min-h-11 ${busy ? 'btn-disabled' : ''}`}>
              <AdminIcon name="music" className="h-4 w-4" /> {t('Treklarni tanlash')}
              <input type="file" accept="audio/*,.mp3,.m4a" multiple className="hidden" onChange={onFiles} disabled={busy} />
            </label>
          )}
        </div>
        <p className="mt-2 text-[12.5px]" style={{ color: 'var(--vz-ink-3)' }}>
          {t('Bir nechta faylni birdan tanlang. «nom.mp3» va «nom-30s.mp3» juftlanadi: to‘liq trek va 30 soniyalik bo‘lak.')}
        </p>

        {queue.length > 0 && (
          <div className="mt-4 space-y-2">
            {queue.map((it) => (
              <div key={it.key} className="rounded-xl border p-3" style={{ borderColor: 'var(--vz-line)', background: 'var(--vz-card-2)' }}>
                <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_0.9fr_1.6fr_auto] sm:items-center">
                  <input className="vz-input" value={it.title} onChange={(e) => patchItem(it.key, { title: e.target.value })} aria-label={t('Nomi')} placeholder={t('Nomi')} disabled={it.state === 'uploading'} />
                  <input className="vz-input" value={it.artist} onChange={(e) => patchItem(it.key, { artist: e.target.value })} aria-label={t('Ijrochi')} placeholder={t('Ijrochi')} disabled={it.state === 'uploading'} />
                  <select className="vz-input" value={it.genre} onChange={(e) => patchItem(it.key, { genre: e.target.value })} aria-label={t('Janr')} disabled={it.state === 'uploading'}>
                    {genres.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input className="vz-input" value={it.source} onChange={(e) => patchItem(it.key, { source: e.target.value })} aria-label={t('Manba / litsenziya')} placeholder={t('Manba / litsenziya')} disabled={it.state === 'uploading'} />
                  <button type="button" className="btn btn-ghost btn-xs min-h-9" onClick={() => setQueue((q) => q.filter((x) => x.key !== it.key))} disabled={it.state === 'uploading'} aria-label={t('Olib tashlash')}>
                    <AdminIcon name="x" className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]" style={{ color: 'var(--vz-ink-3)' }}>
                  <span className="font-mono">{it.file.name}</span>
                  <span>{mmss(it.durationSec)}</span>
                  <span>{it.clip ? t('30 s bo‘lak bor') : t('30 s bo‘lak yo‘q')}</span>
                  {it.state === 'uploading' && <span className="loading loading-spinner loading-xs" />}
                  {it.state === 'error' && <span className="vz-err">{it.error}</span>}
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn btn-gold btn-sm min-h-11" onClick={uploadAll} disabled={busy || queue.some((x) => x.state === 'reading')}>
                {busy ? <span className="loading loading-spinner loading-xs" /> : t('Kutubxonaga qo‘shish') + ` (${queue.length})`}
              </button>
              <button type="button" className="btn btn-ghost-vz btn-sm min-h-11" onClick={() => setQueue([])} disabled={busy}>{t('Bekor')}</button>
            </div>
          </div>
        )}
      </div>

      {err && <div role="alert" className="vz-err">{err}</div>}
      {loadErr && <LoadError err={loadErr} onRetry={load} title={t('Kutubxonani yuklab bo‘lmadi.')} />}
      {!loadErr && !rows && <AdminLoading />}
      {rows && rows.length === 0 && queue.length === 0 && <EmptyState icon="music" title={t('Kutubxona hozircha bo‘sh.')} hint={t('Yuqoridagi tugma bilan treklarni qo‘shing.')} />}

      {rows && rows.length > 0 && (
        <div className="vz-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13.5px]" style={{ color: 'var(--vz-ink-2)' }}>
              {t('Jami')}: <b>{rows.length}</b> · {t('Ilovada ko‘rinadi')}: <b>{enabledCount}</b>
            </div>
            <div className="flex flex-wrap gap-1">
              {['', ...genres.filter((g) => rows.some((r) => r.genre === g))].map((g) => (
                <button key={g || 'all'} type="button" onClick={() => setFilter(g)} className={`btn btn-xs min-h-9 ${filter === g ? 'btn-gold' : 'btn-ghost-vz'}`}>
                  {g || t('Hammasi')}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 divide-y" style={{ borderColor: 'var(--vz-line)' }}>
            {shown.map((tr) => (
              <div key={tr.id} className="flex flex-wrap items-center gap-3 py-3" style={{ borderColor: 'var(--vz-line)' }}>
                <button type="button" onClick={() => play(tr.clipUrl || tr.audioUrl)} aria-label={t('Tinglash')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ background: playing === (tr.clipUrl || tr.audioUrl) ? 'var(--vz-gold)' : 'var(--vz-card-2)', color: playing === (tr.clipUrl || tr.audioUrl) ? '#111' : 'var(--vz-ink)' }}>
                  {playing === (tr.clipUrl || tr.audioUrl)
                    ? <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                    : <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-semibold">{tr.title}</span>
                    <span className="vz-badge vz-badge--muted">{tr.genre}</span>
                    {!tr.enabled && <StatusBadge tone="muted">{t('Yashirin')}</StatusBadge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px]" style={{ color: 'var(--vz-ink-3)' }}>
                    <span>{tr.artist || '—'}</span>
                    <span>{mmss(tr.durationSec)}</span>
                    <span>{tr.clipUrl ? t('30 s bo‘lak bor') : t('30 s bo‘lak yo‘q')}</span>
                    <span>{t('Ishlatilgan')}: {tr.uses}</span>
                  </div>
                  {tr.source && <div className="mt-0.5 break-words text-[12px]" style={{ color: 'var(--vz-ink-3)' }}>{t('Manba')}: {tr.source}</div>}
                </div>
                {isManager && (
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <select className="vz-input h-9 min-h-9 py-0 text-[13px]" value={tr.genre} onChange={(e) => update(tr, { genre: e.target.value })} aria-label={t('Janr')}>
                      {genres.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <button type="button" className="btn btn-ghost btn-xs min-h-9" onClick={() => update(tr, { enabled: !tr.enabled })}>
                      {tr.enabled ? t('Yashirish') : t('Chiqarish')}
                    </button>
                    <button type="button" className="btn btn-error btn-xs min-h-9" onClick={() => remove(tr)}>{t("O'chirish")}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
