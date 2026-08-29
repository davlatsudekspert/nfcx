import { useEffect, useRef, useState } from 'react';
import { dbGet, dbAddView, dbFollow, dbUnfollow, dbFollowStats, dbStartConversation, dbGetLike, dbToggleLike, dbGetPendingGift, dbVerifyGiftCode, dbActivateGift, dbListPosts, dbTogglePostLike } from '../lib/db.js';
import { MESSAGING_ENABLED } from '../lib/features.js';
import { fmt, timeAgo, dateTime, initials } from '../lib/format.js';
import { parseAnyCode, letterPattern, digitPattern, tierForCode, TIER_LABEL, TIER_COLOR, TIER_EMOJI } from '../lib/pricing.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { parseMusicSource } from '../lib/music.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import NfcCard from '../components/NfcCard.jsx';
import {
  IconArrowLeft, IconShare, IconSearch,
  IconLinkedIn, IconInstagram, IconTelegram, IconFacebook, IconX,
  IconPhone, IconMail, IconDownload, IconGlobe, IconCopy, IconTag, IconStar, IconLink, IconSupport,
} from '../components/Icons.jsx';

export const THEME_FINISH = { classic: 'silver', midnight: 'black', emerald: 'graphite', royal: 'silver', sunset: 'black', gold: 'gold' };
const DARK_THEMES = ['classic', 'midnight', 'sunset', 'emerald', 'gold', 'glass'];
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
  // Shaffof — chuqur qora-kulrang fon, barcha panellar yarim shaffof
  // (glassmorphism) + oq chegara. Fon rasmi bilan ayniqsa chiroyli.
  glass: { '--vz-bg-a': '#0b0d10', '--vz-bg-b': '#181c22', '--vz-card': 'rgba(255,255,255,0.07)', '--vz-ink': '#ffffff', '--vz-ink-dim': 'rgba(255,255,255,0.78)', '--vz-ink-faint': 'rgba(255,255,255,0.52)', '--vz-line': 'rgba(255,255,255,0.16)', '--vz-accent': '#cbd5e1', '--vz-pill': 'rgba(255,255,255,0.12)' },
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
    // Foydalanuvchi o'z fon rasmini qo'ygan bo'lsa — shuni butun sahifa
    // bo'ylab ko'rsatamiz (asosiy kontent bloki shaffof bo'ladi). O'qilishi
    // uchun ustiga qora qatlam qo'shiladi va matn ranglari oqqa o'tkaziladi
    // (tanlangan temaning yorug'/qorong'iligidan qat'i nazar).
    return {
      ...accented,
      '--vz-ink': '#ffffff',
      '--vz-ink-dim': 'rgba(255,255,255,0.82)',
      '--vz-ink-faint': 'rgba(255,255,255,0.58)',
      '--vz-card': 'rgba(20,22,26,0.55)',
      backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url("${record.bgUrl}")`,
      backgroundSize: 'auto, cover',
      backgroundPosition: 'center top',
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

function vcfEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

function buildVcf(record) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${vcfEscape(record.name)}`,
    record.role ? `TITLE:${vcfEscape(record.role)}` : '',
    record.about ? `NOTE:${vcfEscape(record.about)}` : '',
    (record.phone && !record.hidePhone) ? `TEL;TYPE=CELL:${record.phone}` : '',
    record.email ? `EMAIL:${vcfEscape(record.email)}` : '',
    record.tg ? `URL;TYPE=TELEGRAM:https://t.me/${record.tg.replace('@', '')}` : '',
    record.website ? `URL;TYPE=WORK:${record.website}` : '',
    `URL;TYPE=PROFILE:https://nfcstore.uz/${record.code.toLowerCase()}`,
    'END:VCARD',
  ].filter(Boolean);
  return lines.join('\r\n');
}

function downloadVcf(record) {
  const blob = new Blob([buildVcf(record)], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${record.code}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Ayrim mobil brauzerlar yuklashni event loopning keyingi qadamida
  // boshlaydi; URL'ni darhol bekor qilish faylni yo'qotib qo'yishi mumkin.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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


// Profil musiqasi — brauzerlar ovozli avtomatik ijroni bloklaydi, shuning
// uchun kichik suzuvchi tugma sifatida ko'rsatamiz; birinchi bosishda
// ijro boshlanadi va aylanayotgan belgi bilan holat ko'rsatiladi.
// YouTube havolasi ham qo'llab-quvvatlanadi (yashirin iframe orqali —
// iOS'da fayl yuklamasdan ishlaydi).
function MusicPlayer({ url, accentColor }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const { t } = useLanguage();
  const source = parseMusicSource(url);

  const toggle = () => {
    if (source && source.kind === 'youtube') {
      // Foydalanuvchi bosishi (user gesture) — iframe shu payt mount qilinadi,
      // shu sabab iOS Safari ovoz bilan ijroga ruxsat beradi.
      setPlaying((p) => !p);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  if (!source) return null;

  return (
    <div className="fixed bottom-5 right-5 z-30 flex items-center gap-2">
      {source.kind === 'youtube'
        ? (playing && (
            <iframe
              title="profil-musiqasi"
              src={`https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&loop=1&playlist=${source.id}&controls=0&modestbranding=1&playsinline=1&rel=0`}
              allow="autoplay; encrypted-media"
              className="pointer-events-none h-px w-px overflow-hidden opacity-0"
            />
          ))
        : <audio ref={audioRef} src={source.url} loop preload="none" onEnded={() => setPlaying(false)} />}
      {!playing && (
        <span className="hidden rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white shadow-lg sm:inline-block">
          {'\u{1F3B5}'} {t('Musiqa')}
        </span>
      )}
      <button
        onClick={toggle}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 ${playing ? 'animate-[spinSlow_6s_linear_infinite]' : 'animate-[pulseRing_2s_ease-out_infinite]'}`}
        style={{ background: accentColor || 'var(--vz-pill, #232326)' }}
        aria-label={playing ? t('Musiqani to\u2018xtatish') : t('Musiqani yoqish')}
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

// Profil postlari lentasi — rasm + izoh + like. Tashrif buyuruvchi
// (tizimga kirgan) like bosa oladi; egasi postlarni /account'da boshqaradi.
function PostsFeed({ posts, onLike, t }) {
  if (!posts || posts.length === 0) {
    return <div className="mt-8 text-center text-sm text-[color:var(--vz-ink-faint)]">{t('Hali post yo‘q')}</div>;
  }
  return (
    <div className="mt-6 flex flex-col gap-5">
      {posts.map((p) => (
        <div key={p.id} className="overflow-hidden rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)]">
          <img src={p.imageUrl} alt="" loading="lazy" className="block max-h-[520px] w-full object-cover" />
          <div className="px-4 py-3">
            {p.caption && <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[color:var(--vz-ink-dim)]">{p.caption}</p>}
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => onLike(p.id)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] transition ${p.liked ? 'border-red-400/50 text-red-400' : 'border-[color:var(--vz-line)] text-[color:var(--vz-ink-dim)]'}`}
              >
                <span>{p.liked ? '❤️' : '\u{1F90D}'}</span><b>{p.likeCount}</b>
              </button>
              <span className="text-[11.5px] text-[color:var(--vz-ink-faint)]">{timeAgo(p.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage({ code, catalog }) {
  const [record, setRecord] = useState(undefined);
  const [pendingGift, setPendingGift] = useState(undefined); // "Gift NFC ID" — yangi, izolyatsiyalangan
  const [toast, setToast] = useState('');
  const [tapInactive, setTapInactive] = useState(false);
  const [followStats, setFollowStats] = useState(null);
  const [likeInfo, setLikeInfo] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followMsg, setFollowMsg] = useState(null);
  const [posts, setPosts] = useState([]);
  const { user, myCards } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    dbFollowStats(code).then(setFollowStats).catch(() => {});
    dbGetLike(code).then(setLikeInfo).catch(() => {});
    dbListPosts(code).then(setPosts).catch(() => setPosts([]));
  }, [code, user]);

  const togglePostLike = async (postId) => {
    if (!user) { flashToast(t('Avval tizimga kiring...')); setTimeout(() => navigate('/login'), 800); return; }
    setPosts((list) => list.map((p) => (p.id === postId
      ? { ...p, liked: !p.liked, likeCount: p.likeCount + (p.liked ? -1 : 1) }
      : p)));
    try {
      const res = await dbTogglePostLike(postId);
      setPosts((list) => list.map((p) => (p.id === postId ? { ...p, liked: res.liked, likeCount: res.count } : p)));
    } catch {
      dbListPosts(code).then(setPosts).catch(() => {});
    }
  };

  const toggleLike = async () => {
    if (!user) { flashToast(t('Avval tizimga kiring...')); setTimeout(() => navigate('/login'), 800); return; }
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
        // "Gift NFC ID" — kod bo'sh bo'lsa, kutilayotgan sovg'a bor-yo'qligini
        // tekshiramiz (yangi, izolyatsiyalangan tekshiruv).
        try {
          const gift = await dbGetPendingGift(code);
          if (!cancelled) setPendingGift(gift);
        } catch {
          if (!cancelled) setPendingGift(null);
        }
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

  const shareProfile = async () => {
    const url = `${window.location.origin}/${record.code.toLowerCase()}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: record.name, text: record.role || record.name, url });
      } else {
        await copyText(url, t('Havola nusxalandi!'));
      }
    } catch (error) {
      if (error?.name !== 'AbortError') await copyText(url, t('Havola nusxalandi!'));
    }
  };

  if (record === undefined) {
    return (
      <div className="min-h-screen text-[color:var(--vz-ink-dim)]" style={vzStyle('classic')}>
        <div className="mx-auto max-w-[520px] px-5 py-[70px] text-center text-sm">{t('Yuklanmoqda...')}</div>
      </div>
    );
  }

  if (tapInactive) {
    return (
      <div className="min-h-screen text-[color:var(--vz-ink-dim)]" style={vzStyle('midnight')}>
        <div className="mx-auto max-w-[520px] px-5 py-[70px] text-center">
          <h2 className="font-display mb-2 text-2xl font-bold text-[color:var(--vz-ink)]">{t('Bu karta endi faol emas')}</h2>
          <p>{t("Ushbu jismoniy karta boshqa profilga o'tkazilgan yoki bekor qilingan. Agar bu xato deb hisoblasangiz, biz bilan bog'laning.")}</p>
          <button onClick={() => navigate('/aloqa')} className="mt-5 cursor-pointer rounded-full bg-[color:var(--vz-pill)] px-[18px] py-2.5 text-[13px] font-bold text-white transition hover:brightness-125">{t('Aloqa')}</button>
        </div>
      </div>
    );
  }

  if (record === null) {
    // "Gift NFC ID" — agar shu kod uchun kutilayotgan sovg'a bo'lsa,
    // oddiy "bo'sh kod" ekrani o'rniga aktivatsiya ekrani ko'rsatiladi.
    // Tekshiruv tugamaguncha (pendingGift === undefined) kutamiz —
    // aks holda bir lahzalik noto'g'ri ekran ko'rinib ketishi mumkin.
    if (pendingGift === undefined) {
      return <div className="min-h-screen" style={vzStyle('classic')}></div>;
    }
    if (pendingGift) {
      return <GiftActivationScreen code={code} recipientName={pendingGift.recipientName} />;
    }
    const parsed = parseAnyCode(code);
    return (
      <div className="min-h-screen text-[color:var(--vz-ink-dim)]" style={vzStyle('classic')}>
        <div className="mx-auto max-w-[520px] px-5 py-[70px] text-center">
          <h2 className="font-display mb-2 text-2xl font-bold text-[color:var(--vz-ink)]">{t('nfcstore.uz/{code} hali bo‘sh', { code: code.toLowerCase() })}</h2>
          <p>{t("Bu raqamli tashrif qog'ozi hech kimga tegishli emas. Uni birinchi bo'lib siz oling.")}</p>
          {parsed
            ? <button onClick={() => navigate('/')} className="mt-5 cursor-pointer rounded-full bg-[color:var(--vz-pill)] px-[18px] py-2.5 text-[13px] font-bold text-white transition hover:brightness-125">{t('Bosh sahifada band qilish')}</button>
            : <p className="text-[13px]">{t("Format noto'g'ri: ABZ007 yoki faqat harflardan iborat so'z bo'lishi kerak.")}</p>}
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
  // Admin sovg'a qilgan NFC ID — kod tekin daraja bo'lsa ham karta rangi
  // (va tarif belgisi) EKSLYUZIV bo'ladi.
  const tier = record.isGift ? 'exclusive' : (record.tierOverride || tierForCode(record.code));
  const tierColor = TIER_COLOR[tier];
  const tierEmoji = TIER_EMOJI[tier];
  const dark = DARK_THEMES.includes(record.theme || 'classic');
  // "Shaffof" tema yoki foydalanuvchi o'z fon rasmini qo'ygan holat — asosiy
  // kontent bloki yarim shaffof (glassmorphism) + chegara bilan ko'rsatiladi,
  // shunda fon (rasm) butun sahifa bo'ylab ko'rinadi va panel toza ajralib turadi.
  const hasBg = !!record.bgUrl;
  const glass = hasBg || (record.theme === 'glass');
  const design = record.cardDesign || {};

  let topRank = null;
  if (Array.isArray(catalog) && catalog.length > 3) {
    const ranked = [...catalog].sort((a, b) => (b.views || 0) - (a.views || 0));
    const idx = ranked.findIndex((r) => r.code === record.code);
    if (idx >= 0 && idx < 10 && (record.views || 0) > 0) topRank = idx + 1;
  }

  const otherCodes = isOwner ? myCards.filter((c) => c.code !== record.code) : [];

  const pillBtn = 'cursor-pointer rounded-full bg-[color:var(--vz-pill)] px-[18px] py-2 text-[13px] font-bold text-white transition hover:brightness-125';
  const linkBtn = `vz-link${record.linksTransparent ? ' vz-link--glass' : ''} flex items-center justify-center gap-2 rounded-xl border border-transparent bg-[color:var(--vz-pill)] px-4 py-3.5 text-[13.5px] font-bold uppercase tracking-wide text-white no-underline transition-all duration-150 hover:-translate-y-0.5 hover:border-white/25 hover:brightness-125`;
  const badge = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide';

  return (
    <div className="min-h-screen pb-[60px] text-[color:var(--vz-ink)]" style={vzStyle(record.theme || 'classic', record)}>
      <MusicPlayer url={record.musicUrl} accentColor={record.accentColor} />
      <div className="mx-auto flex max-w-[640px] items-center gap-3 px-[18px] pt-5">
        <button aria-label={t('Bosh sahifaga')} onClick={() => navigate('/')} className={`${pillBtn} inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap !rounded-[10px] border border-[color:var(--vz-line)] !bg-[color:var(--vz-card)] !font-semibold !normal-case text-[color:var(--vz-ink)]`}>
          <IconArrowLeft /> <span className="hidden sm:inline">{t('Bosh sahifaga')}</span>
        </button>
        <div className="hidden min-w-0 flex-1 items-center rounded-[10px] border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] pl-3.5 pr-1.5 sm:flex">
          <input readOnly value={`nfcstore.uz/ ${record.code.toLowerCase()}`} className="min-w-0 flex-1 bg-transparent py-2.5 text-[13.5px] text-[color:var(--vz-ink)] outline-none" />
          <button aria-label={t('Havolani nusxalash')} onClick={() => copyText(`${window.location.origin}/${record.code.toLowerCase()}`, t('Havola nusxalandi!'))} className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/10 text-[color:var(--vz-ink-dim)] hover:text-[color:var(--vz-ink)]"><IconSearch /></button>
        </div>
        <div className="shrink-0 rounded-[10px] border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] text-[color:var(--vz-ink-dim)]">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="mx-auto flex max-w-[640px] items-center justify-between gap-3 px-[18px] pt-3.5">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm font-bold">nfcstore.uz/{record.code.toLowerCase()}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-[color:var(--vz-ink-faint)]">
            <span>{t(TIER_LABEL[tier])}</span>
            {record.price > 0 && <span>· {t("{n} so'm", { n: fmt(record.price) })}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button aria-label={t('Havolani nusxalash')} onClick={() => copyText(`${window.location.origin}/${record.code.toLowerCase()}`, t('Havola nusxalandi!'))} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[color:var(--vz-line)] text-[color:var(--vz-ink-dim)] hover:text-[color:var(--vz-ink)]"><IconCopy /></button>
          <button aria-label={t('Ulashish')} onClick={shareProfile} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[color:var(--vz-line)] text-[color:var(--vz-ink-dim)] hover:text-[color:var(--vz-ink)]"><IconShare /></button>
        </div>
      </div>

      {record.isPremium && (
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#f0cf7a] to-[#b3860f] px-4 py-1 font-mono text-[11px] font-extrabold tracking-[0.12em] text-[#1a1206] shadow-[0_2px_10px_rgba(212,175,90,0.4)]">
            {'\u{1F451}'} PREMIUM
          </span>
        </div>
      )}

      <div className="pt-[18px]">
        <div className="flex animate-[floatY_5s_ease-in-out_infinite] justify-center">
          <NfcCard
            code={record.code}
            name={design.name || record.name}
            since={record.ts}
            finish={design.finish && design.finish !== 'auto' ? design.finish : ('tier-' + tier)}
            bgImage={design.bgUrl || ''}
            size="md"
          />
        </div>
      </div>

      <div
        className={`relative mx-auto mt-[22px] max-w-[640px] rounded-[22px] px-7 pb-[30px] ${
          glass
            ? 'border border-white/15 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)]'
            : `shadow-[0_20px_45px_rgba(20,25,30,0.08),0_2px_8px_rgba(20,25,30,0.04)] ${dark ? 'animate-[cardBreath_4s_ease-in-out_infinite]' : ''}`
        }`}
        style={{ background: glass ? 'rgba(16,18,22,0.55)' : 'var(--vz-card)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-5">
          <div className="flex flex-wrap gap-2">
            {topRank && <span className={`${badge} bg-[color:var(--vz-pill)] text-white [&_svg]:text-[#ffd76a]`}><IconStar /> {t('TOP #{n} bu hafta', { n: topRank })}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && <button className={pillBtn} onClick={() => navigate('/account')}>{t('Tahrirlash')}</button>}
            {!isOwner && (
              <>
                {MESSAGING_ENABLED && <button className={pillBtn} onClick={startChat}>{'\u{1F4AC}'} {t('Xabar yozish')}</button>}
                <button
                  className={`${pillBtn} ${followStats?.isFollowing ? '!bg-transparent !text-[color:var(--vz-ink)] border border-[color:var(--vz-line)]' : ''}`}
                  onClick={toggleFollow}
                  disabled={followBusy}
                >
                  {followBusy ? '...' : followStats?.isFollowing ? t('Obunani bekor qilish') : t("Obuna bo'lish")}
                </button>
              </>
            )}
          </div>
        </div>
        {followStats && (
          <div className="mt-2 flex items-center gap-4 text-[13px] text-[color:var(--vz-ink-dim)]">
            <span><b className="text-[color:var(--vz-ink)]">{followStats.followers}</b> {t('obunachi')}</span>
            <span><b className="text-[color:var(--vz-ink)]">{followStats.following}</b> {t('obuna')}</span>
            <button
              onClick={toggleLike}
              className={`ml-auto flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 transition ${likeInfo?.liked ? 'border-red-400/50 text-red-400' : 'border-[color:var(--vz-line)] text-[color:var(--vz-ink-dim)]'}`}
            >
              <span>{likeInfo?.liked ? '\u2764\uFE0F' : '\u{1F90D}'}</span>
              <b>{likeInfo?.count ?? 0}</b>
            </button>
          </div>
        )}
        {followMsg && <div className="mt-2 text-[12.5px] text-red-400">{t(followMsg)}</div>}

        <div className="mt-0.5 flex flex-col items-center">
          <div className="relative flex h-[120px] w-[120px] items-center justify-center">
            <span className={`pointer-events-none absolute inset-[-4px] animate-[spinSlow_18s_linear_infinite] rounded-full border border-dashed border-[color:var(--vz-line)] ${glass ? 'opacity-40' : ''}`}></span>
            <span className={`pointer-events-none absolute inset-[-12px] animate-[spinSlow_30s_linear_infinite_reverse] rounded-full border border-[color:var(--vz-line)] ${glass ? 'opacity-20' : 'opacity-50'}`}></span>
            <span className="pointer-events-none absolute left-[82%] top-[4%] h-[5px] w-[5px] animate-[floatY_3.6s_ease-in-out_infinite] rounded-full bg-[color:var(--vz-ink-faint)]" ></span>
            <span className="pointer-events-none absolute left-[88%] top-[78%] h-[5px] w-[5px] animate-[floatY_3.6s_ease-in-out_infinite] rounded-full bg-[color:var(--vz-ink-faint)]" ></span>
            <span className="pointer-events-none absolute left-[10%] top-[86%] h-[5px] w-[5px] animate-[floatY_3.6s_ease-in-out_infinite] rounded-full bg-[color:var(--vz-ink-faint)]" ></span>

            {/* Chap va o'ng tomondagi NFC signal to'lqinlari */}
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
          <div className="font-display mt-4 flex flex-wrap items-center justify-center gap-2 text-[23px] font-bold">
            <span>{record.name}</span>
            {record.isPremium && <span className="rounded-full bg-[#d4af5a] px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-wider text-[#1a1206]">{'\u{1F451}'} PREMIUM</span>}
          </div>
          <div className="mb-1 mt-0.5 flex items-center gap-1.5 text-[13.5px] font-bold" style={{ color: tier === 'free' ? 'var(--vz-ink-dim)' : tierColor }}>
            {tierEmoji && <span>{tierEmoji}</span>}
            nfcstore.uz/{record.code.toLowerCase()}
          </div>
          {tier !== 'free' && (
            <div className="mb-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: tierColor, border: `1px solid ${tierColor}55`, background: `${tierColor}15` }}>
              {t('{tier} tarif', { tier: t(TIER_LABEL[tier]) })}
            </div>
          )}
          <div className="mb-1.5 text-xs text-[color:var(--vz-ink-faint)]">{t('Faol bo‘lgan: {when}', { when: timeAgo(record.ts) })}</div>
          {record.role && <div className="mx-auto mt-0.5 max-w-[420px] text-center text-sm text-[color:var(--vz-ink-dim)]">{record.role}</div>}
          {record.about && <p className="mx-auto mt-2 max-w-[460px] text-center text-sm leading-relaxed text-[color:var(--vz-ink-dim)]">{record.about}</p>}
          <div className="mt-5 grid w-full gap-2 sm:grid-cols-[1fr_auto]">
            <button onClick={() => downloadVcf(record)} className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[color:var(--vz-accent)] px-5 py-3 text-[14px] font-extrabold text-white shadow-lg transition hover:brightness-110"><IconDownload /> {t('Kontaktga saqlash')}</button>
            <button onClick={shareProfile} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[color:var(--vz-line)] bg-transparent px-5 py-3 text-[14px] font-semibold text-[color:var(--vz-ink-dim)] transition hover:text-[color:var(--vz-ink)]"><IconShare /> {t('Ulashish')}</button>
          </div>
          {(record.phone || record.email) && (
            <div className="mt-3 grid w-full gap-2 sm:grid-cols-2">
              {record.phone && (!record.hidePhone || isOwner) && <a href={`tel:${record.phone}`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--vz-line)] px-3 text-sm text-[color:var(--vz-ink)] no-underline"><IconPhone /> {record.phone}</a>}
              {record.email && <a href={`mailto:${record.email}`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--vz-line)] px-3 text-sm text-[color:var(--vz-ink)] no-underline"><IconMail /> {record.email}</a>}
            </div>
          )}
          <div className="mt-4 w-full">
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-5">
              <div className="flex flex-wrap gap-2">
                {topRank && <span className={`${badge} bg-[color:var(--vz-pill)] text-white [&_svg]:text-[#ffd76a]`}><IconStar /> {t('TOP #{n} bu hafta', { n: topRank })}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isOwner && <button className={pillBtn} onClick={() => navigate('/account')}>{t('Tahrirlash')}</button>}
                {!isOwner && (
                  <>
                    {MESSAGING_ENABLED && <button className={pillBtn} onClick={startChat}>{'\u{1F4AC}'} {t('Xabar yozish')}</button>}
                    <button
                      className={`${pillBtn} ${followStats?.isFollowing ? '!bg-transparent !text-[color:var(--vz-ink)] border border-[color:var(--vz-line)]' : ''}`}
                      onClick={toggleFollow}
                      disabled={followBusy}
                    >
                      {followBusy ? '...' : followStats?.isFollowing ? t('Obunani bekor qilish') : t("Obuna bo'lish")}
                    </button>
                  </>
                )}
              </div>
            </div>
            {followStats && (
              <div className="mt-2 flex items-center gap-4 text-[13px] text-[color:var(--vz-ink-dim)]">
                <span><b className="text-[color:var(--vz-ink)]">{followStats.followers}</b> {t('obunachi')}</span>
                <span><b className="text-[color:var(--vz-ink)]">{followStats.following}</b> {t('obuna')}</span>
                <button
                  onClick={toggleLike}
                  className={`ml-auto flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 transition ${likeInfo?.liked ? 'border-red-400/50 text-red-400' : 'border-[color:var(--vz-line)] text-[color:var(--vz-ink-dim)]'}`}
                >
                  <span>{likeInfo?.liked ? '\u2764\uFE0F' : '\u{1F90D}'}</span>
                  <b>{likeInfo?.count ?? 0}</b>
                </button>
              </div>
            )}
            {followMsg && <div className="mt-2 text-[12.5px] text-red-400">{t(followMsg)}</div>}
          </div>
        </div>

        <div className="mt-[22px] flex justify-center gap-11">
          <div className="text-center"><b className="font-display block text-[19px] font-bold">{fmt(record.views || 0)}</b><span className="text-xs text-[color:var(--vz-ink-faint)]">{t("Ko'rishlar")}</span></div>
          <div className="text-center"><b className="font-display block text-[19px] font-bold">{dateTime(record.ts)}</b><span className="text-xs text-[color:var(--vz-ink-faint)]">{t('Band qilingan')}</span></div>
        </div>

        <div className="mt-6 flex justify-center gap-[26px] border-b border-[color:var(--vz-line)]">
          <button
            onClick={() => setTab('vizitka')}
            className={`-mb-px cursor-pointer border-b-2 bg-transparent pb-3 pr-0.5 pl-0.5 text-[14.5px] font-semibold transition ${tab === 'vizitka' ? 'border-current text-[color:var(--vz-ink)]' : 'border-transparent text-[color:var(--vz-ink-faint)] hover:text-[color:var(--vz-ink-dim)]'}`}
          >
            {t("Raqamli tashrif qog'ozi")}
          </button>
          <button
            onClick={() => setTab('postlar')}
            className={`-mb-px cursor-pointer border-b-2 bg-transparent pb-3 pr-0.5 pl-0.5 text-[14.5px] font-semibold transition ${tab === 'postlar' ? 'border-current text-[color:var(--vz-ink)]' : 'border-transparent text-[color:var(--vz-ink-faint)] hover:text-[color:var(--vz-ink-dim)]'}`}
          >
            {t('Postlar')}{posts.length > 0 ? ` (${posts.length})` : ''}
          </button>
        </div>

        {tab === 'postlar' && <PostsFeed posts={posts} onLike={togglePostLike} t={t} />}

        {tab === 'vizitka' && (
          <>
            {record.hashtags && record.hashtags.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-4 text-[13px] font-semibold text-[color:var(--vz-accent)]">
                {record.hashtags.map((h) => <span key={h}>#{h}</span>)}
              </div>
            )}

            <div className="mt-[22px] flex flex-col gap-2.5">
              {tgUrl && <a className={linkBtn} href={tgUrl} target="_blank" rel="noreferrer"><IconTelegram /> Telegram</a>}
              {igUrl && <a className={linkBtn} href={igUrl} target="_blank" rel="noreferrer"><IconInstagram /> Instagram</a>}
              {fbUrl && <a className={linkBtn} href={fbUrl} target="_blank" rel="noreferrer"><IconFacebook /> Facebook</a>}
              {xUrl && <a className={linkBtn} href={xUrl} target="_blank" rel="noreferrer"><IconX /> X (Twitter)</a>}
              {liUrl && <a className={linkBtn} href={liUrl} target="_blank" rel="noreferrer"><IconLinkedIn /> LinkedIn</a>}
              {wsUrl && <a className={linkBtn} href={wsUrl} target="_blank" rel="noreferrer"><IconGlobe /> {t('Veb-sayt')}</a>}
              {(record.extraLinks || []).map((l, i) => (
                <a className={linkBtn} key={i} href={l.url} target="_blank" rel="noreferrer"><IconLink /> {l.label || t('Havola')}</a>
              ))}
            </div>

            {(tgUrl || igUrl) && <div className="mt-3.5 text-center text-[13px] text-[color:var(--vz-ink-faint)]">#{(record.tg || record.instagram).replace('@', '')}</div>}

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
              <a className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] text-[color:var(--vz-ink-dim)] no-underline transition hover:border-[color:var(--vz-ink-dim)] hover:text-[color:var(--vz-ink)]" href="https://t.me/nfcstore_admin" target="_blank" rel="noreferrer" title={t("Qo'llab-quvvatlash")}><IconSupport /></a>
            </div>

            {otherCodes.length > 0 && (
              <>
                <div className="my-6 h-px bg-[color:var(--vz-line)]"></div>
                <div className="mb-3 text-center text-[11.5px] font-extrabold tracking-[0.08em] text-[color:var(--vz-ink-faint)]">{t("SIZNING BOSHQA RAQAMLI TASHRIF QOG'OZILARINGIZ")}</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {otherCodes.map((c) => (
                    <span key={c.code} onClick={() => navigate('/' + c.code)} className="cursor-pointer rounded-full border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] px-3.5 py-1.5 font-mono text-xs hover:border-[color:var(--vz-ink)]">nfcstore.uz/{c.code.toLowerCase()}</span>
                  ))}
                </div>
              </>
            )}

            {!isOwner && MESSAGING_ENABLED && (
              <button onClick={startChat} className={`${pillBtn} mt-6 flex w-full min-h-11 items-center justify-center gap-2`}>{'\u{1F4AC}'} {t('Xabar yozish')}</button>
            )}
          </>
        )}
      </div>

      <div className="mt-[18px] text-center text-xs text-[color:var(--vz-ink-faint)]">{t("{n} ko'rishlar", { n: fmt(record.views || 1) })}</div>
      {toast && <div className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-[10px] bg-[color:var(--vz-pill)] px-[18px] py-2.5 text-[13px] text-white shadow-xl">{toast}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// "GIFT NFC ID" — YANGI, TO'LIQ IZOLYATSIYALANGAN komponent.
// Mavjud ProfilePage/AuthPage render mantig'iga tegmaydi — faqat
// yuqorida "record === null && pendingGift" holatida chaqiriladi.
// ═══════════════════════════════════════════════════════════════════
function GiftActivationScreen({ code, recipientName }) {
  const { t } = useLanguage();
  const [step, setStep] = useState('intro'); // intro | code | form | done
  const [activationCode, setActivationCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [form, setForm] = useState({
    email: '', password: '', name: recipientName || '', username: '', phone: '',
    avatarUrl: '', bio: '', instagram: '', telegram: '', youtube: '', tiktok: '',
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const verifyCode = async () => {
    if (!activationCode.trim()) { setErr(t('Aktivatsiya kodini kiriting.')); return; }
    setBusy(true);
    setErr(null);
    try {
      await dbVerifyGiftCode(code, activationCode.trim());
      setStep('form');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!form.email.trim() || !form.password || !form.name.trim()) {
      setErr(t('Email, parol va ismni to\u2019ldiring.'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await dbActivateGift(code, { ...form, activationCode: activationCode.trim() });
      setStep('done');
      setTimeout(() => { window.location.href = '/' + code.toLowerCase(); }, 1400);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen text-[color:var(--vz-ink-dim)]" style={vzStyle('classic')}>
      <div className="mx-auto max-w-[480px] px-5 py-16">
        {step === 'intro' && (
          <div className="text-center">
            <div className="text-5xl">{'\u{1F381}'}</div>
            <h2 className="font-display mt-3 mb-2 text-2xl font-bold text-[color:var(--vz-ink)]">{t("Sizga maxsus NFC ID sovg'a qilingan")}</h2>
            <div className="mb-4 font-mono text-3xl font-extrabold text-[color:var(--vz-ink)]">#{code}</div>
            <p className="text-[14px]">{t("Konvert ichidagi bir martalik aktivatsiya kodini kiritib, o'z profilingizni yarating.")}</p>
            <button onClick={() => setStep('code')} className="mt-6 cursor-pointer rounded-full bg-[color:var(--vz-pill)] px-7 py-3 text-[14px] font-bold text-white transition hover:brightness-125">
              {t("Sovg'ani faollashtirish")}
            </button>
          </div>
        )}

        {step === 'code' && (
          <div>
            <h2 className="font-display mb-2 text-xl font-bold text-[color:var(--vz-ink)]">{t('Aktivatsiya kodi')}</h2>
            <p className="mb-4 text-[13.5px]">{t('Konvertdagi kartochkada yozilgan kodni kiriting (masalan: NFC-X7K9-P2LM).')}</p>
            <input
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
              placeholder="NFC-XXXX-XXXX"
              className="w-full rounded-xl border border-[color:var(--vz-line)] bg-transparent px-4 py-3 text-center font-mono text-lg tracking-wider text-[color:var(--vz-ink)] outline-none"
            />
            {err && <p className="mt-2 text-center text-[13px] text-red-400">{t(err)}</p>}
            <button onClick={verifyCode} disabled={busy} className="mt-4 w-full cursor-pointer rounded-full bg-[color:var(--vz-pill)] py-3 text-[14px] font-bold text-white transition hover:brightness-125 disabled:opacity-50">
              {busy ? '...' : t('Tasdiqlash')}
            </button>
          </div>
        )}

        {step === 'form' && (
          <div>
            <div className="mb-4 rounded-xl bg-green-500/10 px-4 py-3 text-center text-[13.5px] text-green-400">
              {t('NFC ID #{code} muvaffaqiyatli tasdiqlandi! Endi profilingizni yarating.', { code })}
            </div>
            <div className="space-y-2.5">
              <input value={form.name} onChange={set('name')} placeholder={t('Ism Familiya *')} className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
              <input value={form.username} onChange={set('username')} placeholder={t('Username / Nickname')} className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
              <input value={form.email} onChange={set('email')} type="email" placeholder={t('Email *')} className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
              <input value={form.password} onChange={set('password')} type="password" placeholder={t('Parol (kamida 6 belgi) *')} className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
              <input value={form.phone} onChange={set('phone')} placeholder={t('Telefon')} className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
              <input value={form.avatarUrl} onChange={set('avatarUrl')} placeholder={t('Profil rasmi (URL)')} className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
              <textarea value={form.bio} onChange={set('bio')} placeholder={t('Bio')} rows={2} className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
              <input value={form.instagram} onChange={set('instagram')} placeholder="Instagram" className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
              <input value={form.telegram} onChange={set('telegram')} placeholder="Telegram" className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
              <input value={form.youtube} onChange={set('youtube')} placeholder={t('YouTube (havola)')} className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
              <input value={form.tiktok} onChange={set('tiktok')} placeholder={t('TikTok (havola)')} className="w-full rounded-lg border border-[color:var(--vz-line)] bg-transparent px-3 py-2.5 text-sm text-[color:var(--vz-ink)] outline-none" />
            </div>
            {err && <p className="mt-2 text-center text-[13px] text-red-400">{t(err)}</p>}
            <button onClick={submit} disabled={busy} className="mt-4 w-full cursor-pointer rounded-full bg-[color:var(--vz-pill)] py-3 text-[14px] font-bold text-white transition hover:brightness-125 disabled:opacity-50">
              {busy ? '...' : t('Profil yaratish')}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center">
            <div className="text-5xl">{'\u2705'}</div>
            <h2 className="font-display mt-3 text-xl font-bold text-[color:var(--vz-ink)]">{t('Tayyor! Profilingiz yaratildi.')}</h2>
            <p className="mt-2 text-[13.5px]">{t("Hozir yo'naltirilasiz...")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
