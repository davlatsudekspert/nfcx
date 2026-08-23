import { useEffect, useState } from 'react';
import { dbGet, dbAddView, dbBuy } from '../lib/db.js';
import { fmt, timeAgo, dateTime, initials } from '../lib/format.js';
import { parseAnyCode, letterPattern, digitPattern } from '../lib/pricing.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import NfcCard from '../components/NfcCard.jsx';
import {
  IconArrowLeft, IconShare, IconCheck, IconSearch,
  IconLinkedIn, IconInstagram, IconTelegram, IconFacebook, IconX,
  IconPhone, IconMail, IconDownload, IconGlobe, IconCopy, IconTag, IconStar, IconLink,
} from '../components/Icons.jsx';

const THEME_FINISH = { classic: 'silver', midnight: 'black', emerald: 'graphite', royal: 'silver', sunset: 'black' };

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

// Kod naqshi nodirmi (bir xil harflar, ketma-ketlik, "000" va h.k.) — shunday
// bo'lsa profilga "Nodir vizitka" belgisi qo'yamiz.
function rarity(code) {
  if (!code || code.length !== 6) return null;
  const lp = letterPattern(code.slice(0, 3));
  const dp = digitPattern(code.slice(3, 6));
  if (!lp.hot && !dp.hot) return null;
  const label = [lp.hot ? lp.label : null, dp.hot ? dp.label : null].filter(Boolean).join(' · ');
  return label;
}

export default function ProfilePage({ code, catalog }) {
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
            : <p style={{ fontSize: 13 }}>Format noto'g'ri: ABZ007 yoki faqat harflardan iborat so'z bo'lishi kerak.</p>}
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
  const rarityLabel = rarity(record.code);

  // "TOP #N bu hafta" — ko'rishlar bo'yicha reyting (agar catalog uzatilgan bo'lsa).
  let topRank = null;
  if (Array.isArray(catalog) && catalog.length > 3) {
    const ranked = [...catalog].sort((a, b) => (b.views || 0) - (a.views || 0));
    const idx = ranked.findIndex((r) => r.code === record.code);
    if (idx >= 0 && idx < 10 && (record.views || 0) > 0) topRank = idx + 1;
  }

  const otherCodes = isOwner ? myCards.filter((c) => c.code !== record.code) : [];

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
          {otherCodes.length > 0 && otherCodes.slice(0, 3).map((c) => (
            <span key={c.code} className="vz-code-pill vz-code-pill-dim" onClick={() => navigate('/' + c.code)}># {c.code}</span>
          ))}
          <span className="vz-code-pill vz-code-pill-current"># {record.code}</span>
          {record.forSale && <span className="vz-sale-badge"><IconTag /> SOTUVDA</span>}
          {!record.forSale && <span className="vz-price">{fmt(record.price)} so'm</span>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="vz-share" onClick={() => copyText(`${window.location.origin}/${record.code.toLowerCase()}`, 'Havola nusxalandi!')}><IconCopy /></button>
          <button className="vz-share" onClick={() => copyText(`${window.location.origin}/${record.code.toLowerCase()}`, 'Havola nusxalandi!')}><IconShare /></button>
        </div>
      </div>

      <div className="hero-card-stage" style={{ padding: '18px 0 4px' }}>
        <div className="floaty">
          <NfcCard code={record.code} name={record.name} since={record.ts} finish={THEME_FINISH[record.theme] || 'black'} size="md" />
        </div>
      </div>

      {record.forSale && (
        <div className="vz-salebox vz-glow-bar">
          <div>
            <b>Egasi buni sotuvga qo'ydi</b>
            <span>Narx: {fmt(record.salePrice || record.price)} so'm</span>
          </div>
          <button className="vz-buy" onClick={buyCard} disabled={buying}>
            {buying ? 'Yuklanmoqda...' : 'Sotib olish'}
          </button>
        </div>
      )}

      <div className="vz-card reveal vz-card-glow">
        <div className="vz-follow-row">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {topRank && <span className="vz-top-badge"><IconStar /> TOP #{topRank} bu hafta</span>}
            {rarityLabel && <span className="vz-rare-badge">{rarityLabel}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isOwner && (
              <button className="vz-follow" onClick={() => navigate('/account')}>Tahrirlash</button>
            )}
            <button className="vz-follow" onClick={() => flashToast('Obuna bo\'lindi!')}>Obuna bo'lish</button>
          </div>
        </div>

        {rarityLabel && (
          <div className="vz-notice-box">
            <div className="vz-notice-title"><IconStar /> NODIR VIZITKA</div>
            <p>Bu kombinatsiya o'zining naqshi ({rarityLabel}) tufayli boshqalardan qimmatroq va kamyob hisoblanadi.</p>
          </div>
        )}

        <div className="vz-avatar-row">
          <div className="vz-avatar-deco">
            <span className="deco-ring deco-ring-1"></span>
            <span className="deco-ring deco-ring-2"></span>
            <span className="deco-dot" style={{ top: '4%', left: '82%' }}></span>
            <span className="deco-dot" style={{ top: '78%', left: '88%' }}></span>
            <span className="deco-dot" style={{ top: '86%', left: '10%' }}></span>
            <div className="vz-avatar">
              {record.avatarUrl ? <img src={record.avatarUrl} alt={record.name} /> : initials(record.name)}
            </div>
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
          <button className={'vz-tab' + (tab === 'postlar' ? ' active' : '')} onClick={() => setTab('postlar')}>Postlar <span className="tab-dot"></span></button>
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
              {igUrl && <a className="vz-link-btn" href={igUrl} target="_blank" rel="noreferrer"><IconInstagram /> Instagram</a>}
              {fbUrl && <a className="vz-link-btn" href={fbUrl} target="_blank" rel="noreferrer"><IconFacebook /> Facebook</a>}
              {xUrl && <a className="vz-link-btn" href={xUrl} target="_blank" rel="noreferrer"><IconX /> X (Twitter)</a>}
              {wsUrl && <a className="vz-link-btn" href={wsUrl} target="_blank" rel="noreferrer"><IconGlobe /> Veb-sayt</a>}
              {liUrl && <a className="vz-link-btn" href={liUrl} target="_blank" rel="noreferrer"><IconLinkedIn /> LinkedIn</a>}
              {record.cardNumber && <span className="vz-link-btn vz-link-static"><IconTag /> KARTA (to'lov)</span>}
              {record.phone && <a className="vz-link-btn" href={`tel:${record.phone}`}><IconPhone /> Qo'ng'iroq qilish</a>}
              {(record.extraLinks || []).map((l, i) => (
                <a className="vz-link-btn" key={i} href={l.url} target="_blank" rel="noreferrer"><IconLink /> {l.label || 'Havola'}</a>
              ))}
            </div>

            {(tgUrl || igUrl) && <div className="vz-handle">#{(record.tg || record.instagram).replace('@', '')}</div>}

            {(record.cardNumber || (record.cardNumbers && record.cardNumbers.length > 0)) && (
              <>
                <div className="vz-divider"></div>
                <div className="vz-section-label">TO'LOV UCHUN KARTALAR</div>
                <div className="vz-cardnum-list">
                  {record.cardNumber && (
                    <div className="vz-cardnum">
                      <span className="mono">{record.cardNumber}</span>
                      <button onClick={() => copyText(record.cardNumber.replace(/\s/g, ''), 'Karta raqami nusxalandi!')}><IconCopy /></button>
                    </div>
                  )}
                  {(record.cardNumbers || []).map((c, i) => (
                    <div className="vz-cardnum" key={i}>
                      <span>{c.label && <b className="vz-cardnum-label">{c.label}</b>}<span className="mono">{c.number}</span></span>
                      <button onClick={() => copyText(c.number.replace(/\s/g, ''), 'Karta raqami nusxalandi!')}><IconCopy /></button>
                    </div>
                  ))}
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

            {otherCodes.length > 0 && (
              <>
                <div className="vz-divider"></div>
                <div className="vz-section-label" style={{ textAlign: 'center' }}>SIZNING BOSHQA VIZITKALARINGIZ</div>
                <div className="vz-other-codes">
                  {otherCodes.map((c) => (
                    <span key={c.code} className="vz-other-chip" onClick={() => navigate('/' + c.code)}>nfcstore.uz/{c.code.toLowerCase()}</span>
                  ))}
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
