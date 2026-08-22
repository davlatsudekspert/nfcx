import { useEffect, useState } from 'react';
import { dbGet, dbAddView } from '../lib/db.js';
import { fmt, timeAgo, dateTime, initials } from '../lib/format.js';
import { parseCode } from '../lib/pricing.js';
import { navigate } from '../lib/router.js';
import {
  IconArrowLeft, IconSearch, IconShare, IconCheck,
  IconLinkedIn, IconInstagram, IconTelegram, IconPhone, IconMail, IconDownload,
} from '../components/Icons.jsx';

function buildVcf(record) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${record.name}`,
    record.role ? `TITLE:${record.role}` : '',
    record.phone ? `TEL;TYPE=CELL:${record.phone}` : '',
    record.email ? `EMAIL:${record.email}` : '',
    record.tg ? `URL:https://t.me/${record.tg.replace('@', '')}` : '',
    `NOTE:nfcstore.uz/${record.code}`,
    'END:VCARD',
  ].filter(Boolean);
  return lines.join('\n');
}

function downloadVcf(record) {
  const blob = new Blob([buildVcf(record)], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${record.code}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProfilePage({ code }) {
  const [record, setRecord] = useState(undefined);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('vizitka');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRecord(undefined);
      const found = await dbGet(code);
      if (cancelled) return;
      if (found) {
        setRecord(found);
        const seenKey = 'nfcx:viewed:' + code;
        try {
          if (!sessionStorage.getItem(seenKey)) {
            sessionStorage.setItem(seenKey, '1');
            const views = await dbAddView(code);
            if (!cancelled && views !== null) {
              setRecord((r) => (r && r.code === code ? { ...r, views } : r));
            }
          }
        } catch {
          // sessionStorage blocked — skip counting
        }
      } else {
        setRecord(null);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const flashToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 2200);
  };

  const shareLink = async () => {
    const link = window.location.href;
    try { await navigator.clipboard.writeText(link); flashToast('Havola nusxalandi!'); }
    catch (e) { flashToast(link); }
  };

  if (record === undefined) {
    return (
      <div className="vz">
        <div className="vz-empty">Yuklanmoqda...</div>
      </div>
    );
  }

  if (record === null) {
    const parsed = parseCode(code);
    return (
      <div className="vz">
        <div className="vz-empty">
          <h2>nfcstore.uz/{code} hali bo'sh</h2>
          <p>Bu vizitka hech kimga tegishli emas. Uni birinchi bo'lib siz oling.</p>
          {parsed
            ? <button className="vz-follow" onClick={() => navigate('')}>Bosh sahifada band qilish</button>
            : <p style={{ fontSize: 13 }}>Format noto'g'ri: 3 harf + 2 raqam bo'lishi kerak.</p>}
        </div>
      </div>
    );
  }

  const tgUrl = record.tg ? `https://t.me/${record.tg.replace('@', '')}` : '';
  const igUrl = record.instagram ? `https://instagram.com/${record.instagram.replace('@', '')}` : '';
  const liUrl = record.linkedin ? (record.linkedin.startsWith('http') ? record.linkedin : `https://${record.linkedin}`) : '';

  return (
    <div className="vz">
      <div className="vz-topbar">
        <button className="vz-back" onClick={() => navigate('')}><IconArrowLeft /> Bosh sahifaga</button>
        <div className="vz-search">
          <input readOnly value={`nfcstore.uz/ ${record.code}`} />
          <button onClick={() => navigate('')}><IconSearch /></button>
        </div>
      </div>

      <div className="vz-meta">
        <div className="vz-meta-left">
          <span className="vz-code-pill"># {record.code}</span>
          <span className="vz-price">{fmt(record.price)} so'm</span>
        </div>
        <button className="vz-share" onClick={shareLink}><IconShare /></button>
      </div>

      <div className="vz-card">
        <div className="vz-follow-row">
          <button className="vz-follow" onClick={() => flashToast('Obuna bo\'lindi!')}>Obuna bo'lish</button>
        </div>

        <div className="vz-avatar-row">
          <div className="vz-avatar">
            {record.avatarUrl ? <img src={record.avatarUrl} alt={record.name} /> : initials(record.name)}
          </div>
          <div className="vz-name">{record.name}</div>
          <div className="vz-username">{record.name} <IconCheck style={{ color: 'var(--vz-accent)' }} /></div>
          <div className="vz-lastseen">Faol bo'lgan: {timeAgo(record.ts)}</div>
          {record.role && <div className="vz-role">{record.role}</div>}
        </div>

        <div className="vz-stats">
          <div className="vz-stat"><b>{fmt(record.views || 0)}</b><span>Ko'rishlar</span></div>
          <div className="vz-stat"><b>{dateTime(record.ts)}</b><span>Band qilingan</span></div>
        </div>

        <div className="vz-tabs">
          <button className={'vz-tab' + (tab === 'vizitka' ? ' active' : '')} onClick={() => setTab('vizitka')}>Vizitka</button>
          <button className={'vz-tab' + (tab === 'postlar' ? ' active' : '')} onClick={() => setTab('postlar')}>Postlar</button>
        </div>

        {tab === 'postlar' ? (
          <p style={{ textAlign: 'center', color: 'var(--vz-ink-faint)', fontSize: 13.5, marginTop: 20 }}>
            Hozircha postlar yo'q.
          </p>
        ) : (
          <>
            {record.hashtags && record.hashtags.length > 0 && (
              <div className="vz-hashtags">
                {record.hashtags.map((h) => <span key={h}>#{h}</span>)}
              </div>
            )}

            <div className="vz-links">
              {liUrl && <a className="vz-link-btn" href={liUrl} target="_blank" rel="noreferrer"><IconLinkedIn /> LinkedIn</a>}
              {igUrl && <a className="vz-link-btn" href={igUrl} target="_blank" rel="noreferrer"><IconInstagram /> Instagram</a>}
              {tgUrl && <a className="vz-link-btn" href={tgUrl} target="_blank" rel="noreferrer"><IconTelegram /> Telegram</a>}
              {record.phone && <a className="vz-link-btn" href={`tel:${record.phone}`}><IconPhone /> Qo'ng'iroq qilish</a>}
            </div>

            {record.tg && <div className="vz-handle">#{record.tg.replace('@', '')}</div>}

            {(record.email || record.phone) && (
              <>
                <div className="vz-divider"></div>
                <div className="vz-section-label">ALOQA</div>
                <div className="vz-contacts">
                  {record.email && (
                    <div className="vz-contact-row"><IconMail /> <a href={`mailto:${record.email}`}>{record.email}</a></div>
                  )}
                  {record.phone && (
                    <div className="vz-contact-row"><IconPhone /> <a href={`tel:${record.phone}`}>{record.phone}</a></div>
                  )}
                </div>
              </>
            )}

            {(tgUrl || igUrl || liUrl) && (
              <>
                <div className="vz-divider"></div>
                <div className="vz-social-row">
                  {tgUrl && <a className="vz-social-icon" href={tgUrl} target="_blank" rel="noreferrer"><IconTelegram /></a>}
                  {igUrl && <a className="vz-social-icon" href={igUrl} target="_blank" rel="noreferrer"><IconInstagram /></a>}
                  {liUrl && <a className="vz-social-icon" href={liUrl} target="_blank" rel="noreferrer"><IconLinkedIn /></a>}
                </div>
              </>
            )}

            <div className="vz-divider"></div>
            <button className="vz-vcf" onClick={() => downloadVcf(record)}><IconDownload /> Kontaktni saqlash (.vcf)</button>
          </>
        )}
      </div>

      <div className="vz-footer">{fmt(record.views || 1)} ko'rishlar</div>
      {toast && <div className="vz-toast">{toast}</div>}
    </div>
  );
}
