import { useEffect, useState } from 'react';
import { dbGet, dbAddView, dbBuy } from '../lib/db.js';
import { fmt, timeAgo, dateTime, initials } from '../lib/format.js';
import { parseAnyCode } from '../lib/pricing.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import {
  IconArrowLeft, IconShare, IconCheck, IconSearch,
  IconLinkedIn, IconInstagram, IconTelegram, IconFacebook, IconX,
  IconPhone, IconMail, IconDownload, IconGlobe, IconCopy, IconTag,
} from '../components/Icons.jsx';

function buildVcf(record) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${record.name}`,
    record.role ? `TITLE:${record.role}` : '',
    record.about ? `NOTE:${record.about.replace(/\n/g, ' ')}` : '',
    record.phone ? `TEL;TYPE=CELL:${record.phone}` : '',
    record.email ? `EMAIL:${record.email}` : '',
    record.tg ? `URL:https://t.me/${record.tg.replace('@', '')}` : '',
    record.website ? `URL:${record.website}` : '',
    `NOTE2:nfcstore.uz/${record.code.toLowerCase()}`,
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

function socialUrl(kind, handle) {
  const h = String(handle || '').replace('@', '');
  if (!h) return '';
  switch (kind) {
    case 'tg': return `https://t.me/${h}`;
    case 'ig': return `https://instagram.com/${h}`;
    case 'fb': return /^https?:/.test(h) ? h : `https://facebook.com/${h}`;
    case 'x': return `https://x.com/${h}`;
    case 'li': return /^https?:/.test(h) ? h : `https://${h}`;
    default: return '';
  }
}

export default function ProfilePage({ code }) {
  const [record, setRecord] = useState(undefined);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('vizitka');
  const [buying, setBuying] = useState(false);
  const { user, myCards } = useAuth();

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

  const copyText = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); flashToast(msg); }
    catch (e) { flashToast(text); }
  };

  const buyCard = async () => {
    if (!user) { flashToast('Avval tizimga kiring...'); setTimeout(() => navigate('/login'), 800); return; }
    setBuying(true);
    try {
      const bought = await dbBuy(code);
      setRecord(bought);
      flashToast("Tabriklaymiz — vizitka endi sizniki!");
    } catch (err) {
      flashToast(err.message || 'Xatolik yuz berdi.');
    } finally {
      setBuying(false);
    }
  };

  if (record === undefined) {
    return (
      <div className="vz">
        <div className="vz-empty">Yuklanmoqda...</div>
      </div>
    );
  }

  if (record === null) {
    const parsed = parseAnyCode(code);
    return (
      <div className="vz">
        <div className="vz-empty">
          <h2>nfcstore.uz/{code.toLowerCase()} hali bo'sh</h2>
          <p>Bu vizitka hech kimga tegishli emas. Uni birinchi bo'lib siz oling.</p>
          {parsed
            ? <button className="vz-follow" onClick={() => navigate('/')}>Bosh sahifada band qilish</button>
            : <p style={{ fontSize: 13 }}>Format noto'g'ri: ABZ07 yoki faqat harflardan iborat so'z bo'lishi kerak.</p>}
        </div>
      </div>
    );
  }

  const isOwner = !!(user && myCards.some((c) => c.code === record.code));
  const tgUrl = socialUrl('tg', record.tg);
  const igUrl = socialUrl('ig', record.instagram);
  const fbUrl = socialUrl('fb', record.facebook);
  const xUrl = socialUrl('x', record.twitter);
  const liUrl = record.linkedin ? socialUrl('li', record.linkedin) : '';
  const wsUrl = record.website || '';
  const hasSocials = tgUrl || igUrl || fbUrl || xUrl || liUrl;

  return (
    <div className={`vz theme-${record.theme || 'classic'}`}>
      <div className="vz-topbar">
        <button className="vz-back" onClick={() => navigate('/')}><IconArrowLeft /> Bosh sahifaga</button>
        <div className="vz-search">
          <input readOnly value={`nfcstore.uz/ ${record.code.toLowerCase()}`} />
          <button onClick={() => copyText(`${window.location.origin}/${record.code.toLowerCase()}`, 'Havola nusxalandi!')}><IconSearch /></button>
        </div>
      </div>

      <div className="vz-meta">
        <div className="vz-meta-left">
          <span className="vz-code-pill"># {record.code}</span>
          {record.forSale && <span className="vz-sale-badge"><IconTag /> SOTUVDA</span>}
          {!record.forSale && <span className="vz-price">{fmt(record.price)} so'm</span>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="vz-share" onClick={() => copyText(`${window.location.origin}/${record.code.toLowerCase()}`, 'Havola nusxalandi!')}><IconCopy /></button>
          <button className="vz-share" onClick={() => copyText(`${window.location.origin}/${record.code.toLowerCase()}`, 'Havola nusxalandi!')}><IconShare /></button>
        </div>
      </div>

      {record.forSale && (
        <div className="vz-salebox">
          <div>
            <b>Bu vizitka sotuvda</b>
            <span>Narx: {fmt(record.salePrice || record.price)} so'm</span>
          </div>
          <button className="vz-buy" onClick={buyCard} disabled={buying}>
            {buying ? 'Yuklanmoqda...' : 'Sotib olish'}
          </button>
        </div>
      )}

      <div className="vz-card">
        <div className="vz-follow-row">
          {isOwner && (
            <button className="vz-follow" onClick={() => navigate('/account')}>Tahrirlash</button>
          )}
          <button className="vz-follow" onClick={() => flashToast('Obuna bo\'lindi!')}>Obuna bo'lish</button>
        </div>

        <div className="vz-avatar-row">
          <div className="vz-avatar">
            {record.avatarUrl ? <img src={record.avatarUrl} alt={record.name} /> : initials(record.name)}
          </div>
          <div className="vz-name">{record.name}</div>
          <div className="vz-username">nfcstore.uz/{record.code.toLowerCase()} <IconCheck style={{ color: 'var(--vz-accent)' }} /></div>
          <div className="vz-lastseen">Faol bo'lgan: {timeAgo(record.ts)}</div>
          {record.role && <div className="vz-role">{record.role}</div>}
          {record.about && <p className="vz-about">{record.about}</p>}
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
              {tgUrl && <a className="vz-link-btn" href={tgUrl} target="_blank" rel="noreferrer"><IconTelegram /> Telegram</a>}
              {igUrl && <a className="vz-link-btn vz-btn-ig" href={igUrl} target="_blank" rel="noreferrer"><IconInstagram /> Instagram</a>}
              {fbUrl && <a className="vz-link-btn vz-btn-fb" href={fbUrl} target="_blank" rel="noreferrer"><IconFacebook /> Facebook</a>}
              {xUrl && <a className="vz-link-btn" href={xUrl} target="_blank" rel="noreferrer"><IconX /> X (Twitter)</a>}
              {wsUrl && <a className="vz-link-btn" href={wsUrl} target="_blank" rel="noreferrer"><IconGlobe /> Veb-sayt</a>}
              {liUrl && <a className="vz-link-btn" href={liUrl} target="_blank" rel="noreferrer"><IconLinkedIn /> LinkedIn</a>}
              {record.phone && <a className="vz-link-btn" href={`tel:${record.phone}`}><IconPhone /> Qo'ng'iroq qilish</a>}
            </div>

            {(tgUrl || igUrl) && <div className="vz-handle">#{(record.tg || record.instagram).replace('@', '')}</div>}

            {record.cardNumber && (
              <>
                <div className="vz-divider"></div>
                <div className="vz-section-label">TO'LOV UCHUN KARTA</div>
                <div className="vz-cardnum">
                  <span className="mono">{record.cardNumber}</span>
                  <button onClick={() => copyText(record.cardNumber.replace(/\s/g, ''), 'Karta raqami nusxalandi!')}><IconCopy /></button>
                </div>
              </>
            )}

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

            {hasSocials && (
              <>
                <div className="vz-divider"></div>
                <div className="vz-social-row">
                  {tgUrl && <a className="vz-social-icon" href={tgUrl} target="_blank" rel="noreferrer"><IconTelegram /></a>}
                  {igUrl && <a className="vz-social-icon" href={igUrl} target="_blank" rel="noreferrer"><IconInstagram /></a>}
                  {fbUrl && <a className="vz-social-icon" href={fbUrl} target="_blank" rel="noreferrer"><IconFacebook /></a>}
                  {xUrl && <a className="vz-social-icon" href={xUrl} target="_blank" rel="noreferrer"><IconX /></a>}
                  {liUrl && <a className="vz-social-icon" href={liUrl} target="_blank" rel="noreferrer"><IconLinkedIn /></a>}
                  {wsUrl && <a className="vz-social-icon" href={wsUrl} target="_blank" rel="noreferrer"><IconGlobe /></a>}
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
