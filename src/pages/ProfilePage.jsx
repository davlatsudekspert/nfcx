import { useEffect, useRef, useState } from 'react';
import { dbGet, dbAddView, dbFollow, dbUnfollow, dbFollowStats, dbStartConversation, dbGetLike, dbToggleLike } from '../lib/db.js';
import { MESSAGING_ENABLED } from '../lib/features.js';
import { fmt, timeAgo, dateTime, initials } from '../lib/format.js';
import { parseAnyCode, letterPattern, digitPattern, tierForCode, TIER_LABEL, TIER_COLOR, TIER_EMOJI } from '../lib/pricing.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import NfcCard from '../components/NfcCard.jsx';
import {
  IconArrowLeft, IconShare, IconCheck, IconSearch,
  IconLinkedIn, IconInstagram, IconTelegram, IconFacebook, IconX,
  IconPhone, IconMail, IconDownload, IconGlobe, IconCopy, IconTag, IconStar, IconLink, IconSupport,
} from '../components/Icons.jsx';

export const THEME_FINISH = { classic: 'silver', midnight: 'black', emerald: 'graphite', royal: 'silver', sunset: 'black', gold: 'gold' };
const DARK_THEMES = ['classic', 'midnight', 'sunset', 'emerald', 'gold'];
// Profil mavzulari — .vz dagi CSS o'zgaruvchilari endi JSX orqali
// beriladi (id'lar backend whitelist bilan mos: classic, midnight,
// emerald, royal, sunset — barchasi oq-qora / kumush palitrada).
// Profil mavzulari — har biri o'zига xos, bir-biridan aniq farq
// qiladigan palitrada (rang, yorug'lik va ohang bo'yicha).
export const VZ_THEMES = {
  // Classic — issiq (warm) grafit-qora, oltin urg'u bilan.
  classic: { '--vz-bg-a': '#15120f', '--vz-bg-b': '#241e17', '--vz-card': '#1c1712', '--vz-ink': '#f7f2e8', '--vz-ink-dim': '#c9bfa9', '--vz-ink-faint': '#8f8570', '--vz-line': '#3a3226', '--vz-accent': '#d4af5a', '--vz-pill': '#2e2619' },
  // Onyx — sof, sovuq qora-oq, yuqori kontrast.
  midnight: { '--vz-bg-a': '#000000', '--vz-bg-b': '#0e0e10', '--vz-card': '#000000', '--vz-ink': '#ffffff', '--vz-ink-dim': '#a8a8ac', '--vz-ink-faint': '#5c5c60', '--vz-line': '#232326', '--vz-accent': '#ffffff', '--vz-pill': '#1c1c1f' },
  // Graphite — o'rta tusli sovuq kulrang (na oq, na qora).
  emerald: { '--vz-bg-a': '#2b2e31', '--vz-bg-b': '#3c4044', '--vz-card': '#34383b', '--vz-ink': '#f1f3f4', '--vz-ink-dim': '#b7bcc0', '--vz-ink-faint': '#83898e', '--vz-line': '#4a4f54', '--vz-accent': '#9fb3bd', '--vz-pill': '#484d52' },
  // Platinum — yorug', kumushrang, sovuq havo rang tafti bilan (yagona OCH mavzu).
  royal: { '--vz-bg-a': '#f3f5f8', '--vz-bg-b': '#dfe3e9', '--vz-card': '#ffffff', '--vz-ink': '#12151c', '--vz-ink-dim': '#5a6270', '--vz-ink-faint': '#8b93a0', '--vz-line': '#e1e5ea', '--vz-accent': '#5b6b85', '--vz-pill': '#12151c' },
  // Ink — chuqur indigo-havo rang, boshqa qora mavzulardan aniq farqli.
  sunset: { '--vz-bg-a': '#0a0d1c', '--vz-bg-b': '#161c3a', '--vz-card': '#0d1226', '--vz-ink': '#eef0fb', '--vz-ink-dim': '#a6acd6', '--vz-ink-faint': '#6a70a0', '--vz-line': '#262d54', '--vz-accent': '#8ea2ff', '--vz-pill': '#232a52' },
  // Gold — boy, to'yingan tilla-bronza, Classic'dagi xira oltin urg'udan
  // farqli o'laroq fonning o'zi ham issiq oltin tusda porlaydi.
  gold: { '--vz-bg-a': '#1a1206', '--vz-bg-b': '#3a2a0c', '--vz-card': '#241a08', '--vz-ink': '#fdf6e3', '--vz-ink-dim': '#e0c98a', '--vz-ink-faint': '#a68a4a', '--vz-line': '#5c481c', '--vz-accent': '#f0c04a', '--vz-pill': '#5c4415' },
};

// Rangni ochroq/to'qroq qilish (gradient uchun ikkinchi ton hosil qilamiz).
function shadeColor(hex, percent) {
  try {
    const m = hex.match(/\w\w/g).map((x) => parseInt(x, 16));
    const [r, g, b] = m.map((v) => Math.min(255, Math.max(0, Math.round(v + (percent / 100) * 255))));
    return `rgb(${r},${g},${b})`;
  } catch {
    return hex;
  }
}

export function vzStyle(theme, record) {
  const base = VZ_THEMES[theme] || VZ_THEMES.classic;
  // Foydalanuvchi istalgan aksent rangni tanlagan bo'lsa — tugmalar,
  // belgi va urg'u ranglarini shu bilan almashtiramiz (tema rangidan ustun).
  const accented = record && record.accentColor
    ? { ...base, '--vz-accent': record.accentColor, '--vz-pill': record.accentColor }
    : base;
  if (record && record.bgUrl) {
    // Foydalanuvchi o'z fon rasmini qo'ygan bo'lsa — shuni ko'rsatamiz
    // (o'qilishi uchun ustiga yarim shaffof qora qatlam qo'shiladi).
    return {
      ...accented,
      backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url("${record.bgUrl}")`,
      backgroundSize: 'auto, cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  if (record && record.bgColor) {
    // Foydalanuvchi tanlagan fon rangi — sekin "qimirlab" turadigan
    // (animatsiyali) gradient sifatida ko'rsatiladi. MUHIM: `background`
    // qisqartmasi o'rniga alohida backgroundImage/backgroundSize
    // ishlatiladi — aks holda ba'zi brauzerlarda shorthand backgroundSize'ni
    // "auto"ga qaytarib, animatsiya/rang butunlay ko'rinmay qolishi mumkin.
    const c1 = record.bgColor;
    const c2 = shadeColor(record.bgColor, -22);
    const c3 = shadeColor(record.bgColor, 14);
    const animated = record.bgAnimated !== false;
    return {
      ...accented,
      backgroundImage: `linear-gradient(120deg, ${c1}, ${c2}, ${c3}, ${c1})`,
      backgroundSize: animated ? '300% 300%' : '100% 100%',
      backgroundRepeat: 'no-repeat',
      animation: animated ? 'bgShift 16s ease-in-out infinite' : undefined,
    };
  }
  return {
    ...accented,
    backgroundImage: 'linear-gradient(160deg, var(--vz-bg-a), var(--vz-bg-b))',
  };
}

function buildVcf(record) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${record.name}`,
    record.role ? `TITLE:${record.role}` : '',
    record.about ? `NOTE:${record.about.replace(/\n/g, ' ')}` : '',
    (record.phone && !record.hidePhone) ? `TEL;TYPE=CELL:${record.phone}` : '',
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

// Kod naqshi nodirmi (bir xil harflar, ketma-ketlik, "000" va h.k.)
function rarity(code) {
  if (!code || code.length !== 6) return null;
  const lp = letterPattern(code.slice(0, 3));
  const dp = digitPattern(code.slice(3, 6));
  if (!lp.hot && !dp.hot) return null;
  const label = [lp.hot ? lp.label : null, dp.hot ? dp.label : null].filter(Boolean).join(' · ');
  return label;
}

function tierOf(code) {
  return tierForCode(code);
}

// Profil musiqasi — brauzerlar ovozli avtomatik ijroni bloklaydi, shuning
// uchun kichik suzuvchi tugma sifatida ko'rsatamiz; birinchi bosishda
// ijro boshlanadi va aylanayotgan belgi bilan holat ko'rsatiladi.
function MusicPlayer({ url, accentColor }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  if (!url) return null;

  return (
    <div className="fixed bottom-5 right-5 z-30 flex items-center gap-2">
      <audio ref={audioRef} src={url} loop preload="none" onEnded={() => setPlaying(false)} />
      {!playing && (
        <span className="hidden rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white shadow-lg sm:inline-block">
          {'\u{1F3B5}'} Musiqa
        </span>
      )}
      <button
        onClick={toggle}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 ${playing ? 'animate-[spinSlow_6s_linear_infinite]' : 'animate-[pulseRing_2s_ease-out_infinite]'}`}
        style={{ background: accentColor || 'var(--vz-pill, #232326)' }}
        aria-label={playing ? 'Musiqani to\u2018xtatish' : 'Musiqani yoqish'}
      >
        {playing ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
    </div>
  );
}

export default function ProfilePage({ code, catalog }) {
  const [record, setRecord] = useState(undefined);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('vizitka');
  const [tapInactive, setTapInactive] = useState(false);
  const [followStats, setFollowStats] = useState(null);
  const [likeInfo, setLikeInfo] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followMsg, setFollowMsg] = useState(null);
  const { user, myCards } = useAuth();

  useEffect(() => {
    dbFollowStats(code).then(setFollowStats).catch(() => {});
    dbGetLike(code).then(setLikeInfo).catch(() => {});
  }, [code, user]);

  const toggleLike = async () => {
    if (!user) { flashToast('Avval tizimga kiring...'); setTimeout(() => navigate('/login'), 800); return; }
    try {
      const res = await dbToggleLike(code);
      setLikeInfo((prev) => ({ liked: res.liked, count: (prev?.count || 0) + (res.liked ? 1 : -1) }));
    } catch { /* jim tur */ }
  };

  // Obuna endi har doim bepul va darhol amalga oshadi.
  const toggleFollow = async () => {
    setFollowBusy(true);
    setFollowMsg(null);
    try {
      if (followStats?.isFollowing) {
        await dbUnfollow(code);
      } else {
        await dbFollow(code);
      }
      const stats = await dbFollowStats(code);
      setFollowStats(stats);
    } catch (err) {
      if (err.code === 'unauthorized') { navigate('/login'); return; }
      setFollowMsg(err.message);
    } finally {
      setFollowBusy(false);
    }
  };

  const startChat = async () => {
    if (!user) { navigate('/login'); return; }
    try {
      const { conversationId } = await dbStartConversation(code);
      navigate('/xabarlar/' + conversationId);
    } catch (err) {
      setFollowMsg(err.message);
    }
  };

  // Jismoniy karta tegilganda chip ?t=<token> parametri bilan keladi.
  // Buni serverda tekshiramiz: agar bu karta boshqa profilga o'tib
  // (auksionda sotilib) deaktivatsiya qilingan bo'lsa — "karta faol emas"
  // xabarini ko'rsatamiz. Aks holda parametrni URL'dan olib tashlaymiz,
  // chunki u faqat bir martalik tekshiruv uchun kerak edi.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('t');
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/tap/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data && data.active === false) setTapInactive(true);
      } catch {
        // tarmoq xatosi — profilni ko'rsatishda davom etamiz, bloklamaymiz
      } finally {
        params.delete('t');
        const clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState(null, '', clean);
      }
    })();
  }, []);

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
          // sessionStorage blocked
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

  if (record === undefined) {
    return (
      <div className="min-h-screen text-[color:var(--vz-ink-dim)]" style={vzStyle('classic')}>
        <div className="mx-auto max-w-[520px] px-5 py-[70px] text-center text-sm">Yuklanmoqda...</div>
      </div>
    );
  }

  if (tapInactive) {
    return (
      <div className="min-h-screen text-[color:var(--vz-ink-dim)]" style={vzStyle('midnight')}>
        <div className="mx-auto max-w-[520px] px-5 py-[70px] text-center">
          <h2 className="font-display mb-2 text-2xl font-bold text-[color:var(--vz-ink)]">Bu karta endi faol emas</h2>
          <p>Ushbu jismoniy karta boshqa profilga o'tkazilgan yoki bekor qilingan. Agar bu xato deb hisoblasangiz, biz bilan bog'laning.</p>
          <button onClick={() => navigate('/aloqa')} className="mt-5 cursor-pointer rounded-full bg-[color:var(--vz-pill)] px-[18px] py-2.5 text-[13px] font-bold text-white transition hover:brightness-125">Aloqa</button>
        </div>
      </div>
    );
  }

  if (record === null) {
    const parsed = parseAnyCode(code);
    return (
      <div className="min-h-screen text-[color:var(--vz-ink-dim)]" style={vzStyle('classic')}>
        <div className="mx-auto max-w-[520px] px-5 py-[70px] text-center">
          <h2 className="font-display mb-2 text-2xl font-bold text-[color:var(--vz-ink)]">nfcstore.uz/{code.toLowerCase()} hali bo'sh</h2>
          <p>Bu raqamli tashrif qog'ozi hech kimga tegishli emas. Uni birinchi bo'lib siz oling.</p>
          {parsed
            ? <button onClick={() => navigate('/')} className="mt-5 cursor-pointer rounded-full bg-[color:var(--vz-pill)] px-[18px] py-2.5 text-[13px] font-bold text-white transition hover:brightness-125">Bosh sahifada band qilish</button>
            : <p className="text-[13px]">Format noto'g'ri: ABZ007 yoki faqat harflardan iborat so'z bo'lishi kerak.</p>}
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
  // hasSocials endi ishlatilmaydi — shaxsiy ijtimoiy tarmoq havolalari
  // faqat yuqoridagi to'liq nomli tugmalarda ko'rsatiladi (takrorlanmaydi).
  const rarityLabel = rarity(record.code);
  const tier = tierOf(record.code);
  const tierColor = TIER_COLOR[tier];
  const tierEmoji = TIER_EMOJI[tier];
  const dark = DARK_THEMES.includes(record.theme || 'classic');

  let topRank = null;
  if (Array.isArray(catalog) && catalog.length > 3) {
    const ranked = [...catalog].sort((a, b) => (b.views || 0) - (a.views || 0));
    const idx = ranked.findIndex((r) => r.code === record.code);
    if (idx >= 0 && idx < 10 && (record.views || 0) > 0) topRank = idx + 1;
  }

  const otherCodes = isOwner ? myCards.filter((c) => c.code !== record.code) : [];

  const pillBtn = 'cursor-pointer rounded-full bg-[color:var(--vz-pill)] px-[18px] py-2 text-[13px] font-bold text-white transition hover:brightness-125';
  const linkBtn = 'flex items-center justify-center gap-2 rounded-xl border border-transparent bg-[color:var(--vz-pill)] px-4 py-3.5 text-[13.5px] font-bold uppercase tracking-wide text-white no-underline transition-all duration-150 hover:-translate-y-0.5 hover:border-white/25 hover:brightness-125';
  const badge = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide';

  return (
    <div className="min-h-screen pb-[60px] text-[color:var(--vz-ink)]" style={vzStyle(record.theme || 'classic', record)}>
      <MusicPlayer url={record.musicUrl} accentColor={record.accentColor} />
      <div className="mx-auto flex max-w-[640px] items-center gap-3 px-[18px] pt-5">
        <button onClick={() => navigate('/')} className={`${pillBtn} inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap !rounded-[10px] border border-[color:var(--vz-line)] !bg-[color:var(--vz-card)] !font-semibold !normal-case text-[color:var(--vz-ink)]`}>
          <IconArrowLeft /> Bosh sahifaga
        </button>
        <div className="flex min-w-0 flex-1 items-center rounded-[10px] border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] pl-3.5 pr-1.5">
          <input readOnly value={`nfcstore.uz/ ${record.code.toLowerCase()}`} className="min-w-0 flex-1 bg-transparent py-2.5 text-[13.5px] text-[color:var(--vz-ink)] outline-none" />
          <button onClick={() => copyText(`${window.location.origin}/${record.code.toLowerCase()}`, 'Havola nusxalandi!')} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/10 text-[color:var(--vz-ink-dim)] hover:text-[color:var(--vz-ink)]"><IconSearch /></button>
        </div>
      </div>

      <div className="mx-auto flex max-w-[640px] flex-wrap items-center justify-between gap-2.5 px-[18px] pt-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {otherCodes.length > 0 && otherCodes.slice(0, 3).map((c) => (
            <span key={c.code} onClick={() => navigate('/' + c.code)} className="cursor-pointer rounded-full border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] px-3 py-1 font-mono text-[12.5px] text-[color:var(--vz-ink-dim)] opacity-60 hover:opacity-100"># {c.code}</span>
          ))}
          <span className="rounded-full border border-[color:var(--vz-ink)] bg-[color:var(--vz-card)] px-6 py-1.5 font-mono text-[22px] font-bold text-[color:var(--vz-ink)] ring-1 ring-inset ring-[color:var(--vz-ink)]"># {record.code}</span>
          <span className="text-[13.5px] font-bold text-[color:var(--vz-accent)]">{fmt(record.price)} so'm</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => copyText(`${window.location.origin}/${record.code.toLowerCase()}`, 'Havola nusxalandi!')} className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center text-[color:var(--vz-ink-faint)] hover:text-[color:var(--vz-ink-dim)]"><IconCopy /></button>
          <button onClick={() => copyText(`${window.location.origin}/${record.code.toLowerCase()}`, 'Havola nusxalandi!')} className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center text-[color:var(--vz-ink-faint)] hover:text-[color:var(--vz-ink-dim)]"><IconShare /></button>
        </div>
      </div>

      <div className="pt-[18px]">
        <div className="flex animate-[floatY_5s_ease-in-out_infinite] justify-center">
          <NfcCard code={record.code} name={record.name} since={record.ts} finish={'tier-' + tier} size="md" />
        </div>
      </div>

      <div className={`relative mx-auto mt-[22px] max-w-[640px] rounded-[22px] px-7 pb-[30px] shadow-[0_20px_45px_rgba(20,25,30,0.08),0_2px_8px_rgba(20,25,30,0.04)] ${dark ? 'animate-[cardBreath_4s_ease-in-out_infinite]' : ''}`} style={{ background: 'var(--vz-card)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-5">
          <div className="flex flex-wrap gap-2">
            {topRank && <span className={`${badge} bg-[color:var(--vz-pill)] text-white [&_svg]:text-[#ffd76a]`}><IconStar /> TOP #{topRank} bu hafta</span>}
            {rarityLabel && <span className={`${badge} border border-[color:var(--vz-ink)] text-[color:var(--vz-ink)]`}>{rarityLabel}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && <button className={pillBtn} onClick={() => navigate('/account')}>Tahrirlash</button>}
            {!isOwner && (
              <>
                {MESSAGING_ENABLED && <button className={pillBtn} onClick={startChat}>{'\u{1F4AC}'} Xabar yozish</button>}
                <button
                  className={`${pillBtn} ${followStats?.isFollowing ? '!bg-transparent !text-[color:var(--vz-ink)] border border-[color:var(--vz-line)]' : ''}`}
                  onClick={toggleFollow}
                  disabled={followBusy}
                >
                  {followBusy ? '...' : followStats?.isFollowing ? 'Obunani bekor qilish' : "Obuna bo'lish"}
                </button>
              </>
            )}
          </div>
        </div>
        {followStats && (
          <div className="mt-2 flex items-center gap-4 text-[13px] text-[color:var(--vz-ink-dim)]">
            <span><b className="text-[color:var(--vz-ink)]">{followStats.followers}</b> obunachi</span>
            <span><b className="text-[color:var(--vz-ink)]">{followStats.following}</b> obuna</span>
            <button
              onClick={toggleLike}
              className={`ml-auto flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 transition ${likeInfo?.liked ? 'border-red-400/50 text-red-400' : 'border-[color:var(--vz-line)] text-[color:var(--vz-ink-dim)]'}`}
            >
              <span>{likeInfo?.liked ? '\u2764\uFE0F' : '\u{1F90D}'}</span>
              <b>{likeInfo?.count ?? 0}</b>
            </button>
          </div>
        )}
        {followMsg && <div className="mt-2 text-[12.5px] text-red-400">{followMsg}</div>}

        {(tierEmoji || tier !== 'free') && (
          <div className="mt-4 flex justify-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1 font-mono text-[12px] font-bold"
              style={{ borderColor: tierColor, color: tierColor, background: `${tierColor}14` }}
            >
              {tierEmoji && <span className="text-[12px]">{tierEmoji}</span>}
              # {record.code}
            </span>
          </div>
        )}

        <div className="mt-0.5 flex flex-col items-center">
          <div className="relative flex h-[120px] w-[120px] items-center justify-center">
            <span className="pointer-events-none absolute inset-[-4px] animate-[spinSlow_18s_linear_infinite] rounded-full border border-dashed border-[color:var(--vz-line)]"></span>
            <span className="pointer-events-none absolute inset-[-12px] animate-[spinSlow_30s_linear_infinite_reverse] rounded-full border opacity-50 border-[color:var(--vz-line)]"></span>
            <span className="pointer-events-none absolute left-[82%] top-[4%] h-[5px] w-[5px] animate-[floatY_3.6s_ease-in-out_infinite] rounded-full bg-[color:var(--vz-ink-faint)]" ></span>
            <span className="pointer-events-none absolute left-[88%] top-[78%] h-[5px] w-[5px] animate-[floatY_3.6s_ease-in-out_infinite] rounded-full bg-[color:var(--vz-ink-faint)]" ></span>
            <span className="pointer-events-none absolute left-[10%] top-[86%] h-[5px] w-[5px] animate-[floatY_3.6s_ease-in-out_infinite] rounded-full bg-[color:var(--vz-ink-faint)]" ></span>

            {/* Chap va o'ng tomondagi NFC signal to'lqinlari (tegish animatsiyasi) */}
            <div className="pointer-events-none absolute right-full top-1/2 mr-1 -translate-y-1/2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="absolute right-0 top-1/2 -translate-y-1/2 animate-[nfcPulse_2.2s_ease-out_infinite] rounded-full border-2"
                  style={{ width: 10 + i * 10, height: 10 + i * 10, marginRight: -(5 + i * 5), borderColor: tierColor, animationDelay: `${i * 0.35}s` }} />
              ))}
            </div>
            <div className="pointer-events-none absolute left-full top-1/2 ml-1 -translate-y-1/2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="absolute left-0 top-1/2 -translate-y-1/2 animate-[nfcPulse_2.2s_ease-out_infinite] rounded-full border-2"
                  style={{ width: 10 + i * 10, height: 10 + i * 10, marginLeft: -(5 + i * 5), borderColor: tierColor, animationDelay: `${i * 0.35}s` }} />
              ))}
            </div>

            <div className="font-display z-10 flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-full border-[3px] bg-gradient-to-br from-[#dfe3e6] to-[#cfd4d8] text-[32px] font-bold text-[#565c62] shadow-[0_0_0_1px_var(--vz-line),0_10px_24px_rgba(20,25,30,0.12)]"
              style={{ borderColor: tier === 'free' ? 'var(--vz-card)' : tierColor }}>
              {record.avatarUrl ? <img src={record.avatarUrl} alt={record.name} className="block h-full w-full object-cover" /> : initials(record.name)}
            </div>
          </div>
          <div className="font-display mt-4 flex items-center justify-center gap-1.5 text-[23px] font-bold">{record.name}</div>
          <div className="mb-1 mt-0.5 flex items-center gap-1.5 text-[13.5px] font-bold" style={{ color: tier === 'free' ? 'var(--vz-ink-dim)' : tierColor }}>
            {tierEmoji && <span>{tierEmoji}</span>}
            nfcstore.uz/{record.code.toLowerCase()}
            <span className="shrink-0"><IconCheck style={{ color: 'var(--vz-accent)' }} /></span>
          </div>
          {tier !== 'free' && (
            <div className="mb-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: tierColor, border: `1px solid ${tierColor}55`, background: `${tierColor}15` }}>
              {TIER_LABEL[tier]} tarif
            </div>
          )}
          <div className="mb-1.5 text-xs text-[color:var(--vz-ink-faint)]">Faol bo'lgan: {timeAgo(record.ts)}</div>
          {record.role && <div className="mx-auto mt-0.5 max-w-[420px] text-center text-sm text-[color:var(--vz-ink-dim)]">{record.role}</div>}
          {record.about && <p className="mx-auto mt-2 max-w-[460px] text-center text-sm leading-relaxed text-[color:var(--vz-ink-dim)]">{record.about}</p>}
        </div>

        <div className="mt-[22px] flex justify-center gap-11">
          <div className="text-center"><b className="font-display block text-[19px] font-bold">{fmt(record.views || 0)}</b><span className="text-xs text-[color:var(--vz-ink-faint)]">Ko'rishlar</span></div>
          <div className="text-center"><b className="font-display block text-[19px] font-bold">{dateTime(record.ts)}</b><span className="text-xs text-[color:var(--vz-ink-faint)]">Band qilingan</span></div>
        </div>

        <div className="mt-6 flex justify-center gap-[26px] border-b border-[color:var(--vz-line)]">
          <button className="-mb-px cursor-default border-b-2 border-current bg-transparent pb-3 pr-0.5 pl-0.5 text-[14.5px] font-semibold text-[color:var(--vz-ink)]">Raqamli tashrif qog'ozi</button>
        </div>

        {(
          <>
            {record.hashtags && record.hashtags.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-4 text-[13px] font-semibold text-[color:var(--vz-accent)]">
                {record.hashtags.map((h) => <span key={h}>#{h}</span>)}
              </div>
            )}

            <div className="mt-[22px] flex flex-col gap-2.5">
              {record.phone && (!record.hidePhone || isOwner) && <a className={linkBtn} href={`tel:${record.phone}`}><IconPhone /> Qo'ng'iroq qilish{record.hidePhone && isOwner ? ' (yashiringan)' : ''}</a>}
              {record.email && <a className={linkBtn} href={`mailto:${record.email}`}><IconMail /> {record.email}</a>}
              {tgUrl && <a className={linkBtn} href={tgUrl} target="_blank" rel="noreferrer"><IconTelegram /> Telegram</a>}
              {igUrl && <a className={linkBtn} href={igUrl} target="_blank" rel="noreferrer"><IconInstagram /> Instagram</a>}
              {fbUrl && <a className={linkBtn} href={fbUrl} target="_blank" rel="noreferrer"><IconFacebook /> Facebook</a>}
              {xUrl && <a className={linkBtn} href={xUrl} target="_blank" rel="noreferrer"><IconX /> X (Twitter)</a>}
              {record.cardNumber && <span className={`${linkBtn} cursor-default opacity-85`}><IconTag /> KARTA (to'lov)</span>}
              {(record.extraLinks || []).map((l, i) => (
                <a className={linkBtn} key={i} href={l.url} target="_blank" rel="noreferrer"><IconLink /> {l.label || 'Havola'}</a>
              ))}
            </div>

            {(tgUrl || igUrl) && <div className="mt-3.5 text-center text-[13px] text-[color:var(--vz-ink-faint)]">#{(record.tg || record.instagram).replace('@', '')}</div>}

            {(() => {
              // Eski (yagona) va yangi (massiv) karta raqami maydonlarini
              // BITTA ro'yxatga birlashtiramiz — bir xil raqam ikki marta
              // chiqib qolmasligi uchun (avval shu joyda bug bor edi).
              const seen = new Set();
              const cards = [
                ...(record.cardNumber ? [{ label: '', number: record.cardNumber }] : []),
                ...(record.cardNumbers || []),
              ].filter((c) => {
                const norm = String(c.number || '').replace(/\s/g, '');
                if (!norm || seen.has(norm)) return false;
                seen.add(norm);
                return true;
              });
              if (cards.length === 0) return null;
              return (
                <>
                  <div className="my-6 h-px bg-[color:var(--vz-line)]"></div>
                  <div className="mb-3 text-[11.5px] font-extrabold tracking-[0.08em] text-[color:var(--vz-ink-faint)]">TO'LOV UCHUN KARTALAR</div>
                  <div className="flex flex-col gap-2.5">
                    {cards.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2.5 rounded-xl px-4 py-3" style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#f7f8f9' }}>
                        <span>{c.label && <b className="mb-0.5 block text-[11px] font-bold text-[color:var(--vz-ink-faint)]">{c.label}</b>}<span className="font-mono text-[15px] tracking-[0.08em]">{c.number}</span></span>
                        <button onClick={() => copyText(c.number.replace(/\s/g, ''), 'Karta raqami nusxalandi!')} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-black/[0.06] text-[color:var(--vz-ink-dim)] hover:text-[color:var(--vz-ink)]"><IconCopy /></button>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Diqqat: shaxsiy ijtimoiy tarmoq havolalari (Telegram/Instagram/
                Facebook/X/LinkedIn) bu yerda alohida ikonka qatori sifatida
                TAKRORLANMAYDI — ular allaqachon yuqorida to'liq nomli
                tugmalar sifatida ko'rsatilgan. Pastda faqat NFCSTORE'ning
                rasmiy kanali qoladi. */}

            {/* NFCSTORE'ning o'z rasmiy kanallari — har doim, har bir profilda bir xil. */}
            <div className="my-6 h-px bg-[color:var(--vz-line)]"></div>
            <div className="flex justify-center gap-3.5">
              <a className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] text-[color:var(--vz-ink-dim)] no-underline transition hover:border-[color:var(--vz-ink-dim)] hover:text-[color:var(--vz-ink)]" href="https://t.me/nfcstoreuz" target="_blank" rel="noreferrer" title="NFCSTORE Telegram"><IconTelegram /></a>
              <a className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] text-[color:var(--vz-ink-dim)] no-underline transition hover:border-[color:var(--vz-ink-dim)] hover:text-[color:var(--vz-ink)]" href="https://www.instagram.com/nfcstore.uz" target="_blank" rel="noreferrer" title="NFCSTORE Instagram"><IconInstagram /></a>
              <a className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] text-[color:var(--vz-ink-dim)] no-underline transition hover:border-[color:var(--vz-ink-dim)] hover:text-[color:var(--vz-ink)]" href="https://t.me/nfcstore_admin" target="_blank" rel="noreferrer" title="Qo'llab-quvvatlash"><IconSupport /></a>
            </div>

            {otherCodes.length > 0 && (
              <>
                <div className="my-6 h-px bg-[color:var(--vz-line)]"></div>
                <div className="mb-3 text-center text-[11.5px] font-extrabold tracking-[0.08em] text-[color:var(--vz-ink-faint)]">SIZNING BOSHQA RAQAMLI TASHRIF QOG'OZILARINGIZ</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {otherCodes.map((c) => (
                    <span key={c.code} onClick={() => navigate('/' + c.code)} className="cursor-pointer rounded-full border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] px-3.5 py-1.5 font-mono text-xs hover:border-[color:var(--vz-ink)]">nfcstore.uz/{c.code.toLowerCase()}</span>
                  ))}
                </div>
              </>
            )}

            <div className="my-6 h-px bg-[color:var(--vz-line)]"></div>
            <div className="flex gap-2.5">
              <button onClick={() => downloadVcf(record)} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-[color:var(--vz-line)] bg-transparent px-4 py-2.5 text-[13.5px] font-semibold text-[color:var(--vz-ink-dim)] transition hover:border-[color:var(--vz-ink-dim)] hover:text-[color:var(--vz-ink)]"><IconDownload /> Saqlash</button>
              {!isOwner && MESSAGING_ENABLED && (
                <button onClick={startChat} className={`${pillBtn} flex flex-1 items-center justify-center gap-2`}>{'\u{1F4AC}'} Xabar yozish</button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-[18px] text-center text-xs text-[color:var(--vz-ink-faint)]">{fmt(record.views || 1)} ko'rishlar</div>
      {toast && <div className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-[10px] bg-[color:var(--vz-pill)] px-[18px] py-2.5 text-[13px] text-white shadow-xl">{toast}</div>}
    </div>
  );
}
