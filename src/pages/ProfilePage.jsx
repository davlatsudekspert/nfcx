import { useEffect, useRef, useState } from 'react';
import { directionsUrl, yandexDirectionsUrl } from '../lib/mapLink.js';
import CloseButton from '../components/CloseButton.jsx';
import StoryRing from '../components/StoryRing.jsx';
import { socialUrl } from '../lib/socialLinks.js';
import { createPortal } from 'react-dom';
import { dbGet, dbAddView, dbLogEvent, dbFollow, dbUnfollow, dbFollowStats, dbFollowList, dbStartConversation, dbGetLike, dbToggleLike, dbLikeList, dbGetPendingGift, dbVerifyGiftCode, dbActivateGift, dbListPosts, dbListStories, dbTogglePostLike, dbSubmitLead, dbGetMenu, dbGetProducts, dbGetServices, dbGetFiles, dbGetTeam, dbGetGallery } from '../lib/db.js';
import { MESSAGING_ENABLED } from '../lib/features.js';
import { fmt, timeAgo, initials } from '../lib/format.js';
import { parseAnyCode, letterPattern, digitPattern, tierForCode, TIER_LABEL, TIER_COLOR, TIER_EMOJI, TIER_PAGE_GLOW } from '../lib/pricing.js';
import { menuEligible, productEligible, serviceEligible } from '../lib/access.js';
import { listMyCompanies } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { readFollowAs, rememberFollowAs } from '../lib/followIdentity.js';
import ShareButton from '../components/ShareButton.jsx';
import CardNumberModal from '../components/CardNumberModal.jsx';
import ProfileTabs from '../components/ProfileTabs.jsx';
import StoryGrid from '../components/StoryGrid.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { parseMusicSource, yandexEmbedSrc, fetchYoutubeTitle, cachedYoutubeTitle, audioFileTitle } from '../lib/music.js';
import { useCategories, catPath } from '../lib/categories.js';
import NfcCard, { cardFinish } from '../components/NfcCard.jsx';
import BusinessPublicProfile from '../components/BusinessPublicProfile.jsx';
import {
  IconLinkedIn, IconInstagram, IconTelegram, IconFacebook, IconX,
  IconPhone, IconMail, IconGlobe, IconTag, IconLink, IconSupport, IconChat,
} from '../components/Icons.jsx';
import logo from '../assets/logo-128.png';
import '../company-system.css';

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

// Tema (va foydalanuvchi aksent rangi) — faqat CSS o'zgaruvchilari, FON YO'Q.
// Bu ROOT div'ga beriladi; fon esa alohida (outer = tarif, inner = user).
export function vzVars(theme, record) {
  const base = VZ_THEMES[theme] || VZ_THEMES.classic;
  return record && record.accentColor
    ? { ...base, '--vz-accent': record.accentColor, '--vz-pill': record.accentColor }
    : base;
}

// ─── OUTER FON — NFC ID darajasining vizual identity'si ───────────────
// Tema gradienti + tarif "halo"si. Foydalanuvchi fon rasm/gif qo'ygan bo'lsa
// — endi shu YERDA, BUTUN sahifa (header + NFC karta + asosiy panel) foniga
// yoyiladi (avval faqat ichki panel ichida ko'rinardi).
// `fixedBg=false` — kichik telefon namoyishi (Sozlamalar) uchun: u o'zi
// scroll bo'lmaydigan kichik ramka ichida joylashgan, shuning uchun
// backgroundAttachment:'fixed' (brauzer oynasiga nisbatan) sahifa
// aylantirilganda fonni maketdan "sirg'anib" ketkazadi — shu holatda
// 'scroll' berilib, fon har doim ramka ichida, o'z joyida qoladi.
export function outerPageStyle(theme, record, tier, opts = {}) {
  const { fixedBg = true } = opts;
  const vars = vzVars(theme, record);
  // ─── 2026-09 hotfix — FON RASMI ENDI SAHIFAGA YOYILMAYDI ───
  // Avval foydalanuvchining `bgUrl` rasmi AYNAN SHU YERDA butun sahifa
  // (min-h-screen) foni sifatida chizilardi. Natijada u profil bo'limidan
  // tashqariga — yuqoridagi navigatsiya qatori, NFC ID belgisi, karta
  // ko'rinishi va sahifaning pastki bo'sh qismiga ham — yoyilib ketardi.
  // Endi rasm FAQAT profil panelining o'zida (innerPanelStyle) chiziladi:
  // panelda `overflow-hidden` + `rounded-[22px]` bor, shuning uchun rasm
  // bo'lim chegarasidan chiqmaydi. Foydalanuvchi tanlagan fon ALMASHTIRILMAYDI
  // — u faqat o'z bo'limiga qaytarildi.
  //
  // Sahifa foni esa daraja (tier) gradientida qoladi, shu sababli matn
  // kontrasti va tugmalar o'qilishi buzilmaydi.
  const glow = TIER_PAGE_GLOW[tier] || TIER_PAGE_GLOW.free;
  return {
    ...vars,
    backgroundColor: 'var(--vz-bg-a)',
    backgroundImage: `${glow}, linear-gradient(160deg, var(--vz-bg-a), var(--vz-bg-b))`,
    backgroundAttachment: fixedBg ? 'fixed' : 'scroll',
  };
}

// ─── INNER FON — profil kontent PANELI ichida (butun sahifada emas) ───
// 2026-09 hotfix: foydalanuvchining `bgUrl` fon rasmi endi AYNAN SHU
// YERDA — profil bo'limining o'z qutisida — chiziladi (avval u butun
// sahifaga yoyilib ketardi, outerPageStyle izohiga qarang).
//
// Bo'lim ichida ushlab turish kafolatlari:
//   • backgroundSize: 'cover'      — rasm cho'zilmaydi/deformatsiyalanmaydi
//   • backgroundPosition: 'center' — markazlashgan kadrlash
//   • backgroundRepeat: 'no-repeat'
//   • backgroundAttachment: 'scroll' — rasm brauzer oynasiga emas, SHU
//     elementga nisbatan hisoblanadi, ya'ni panel bilan birga harakatlanadi
//   • panelning o'zida `overflow-hidden` + `rounded-[22px]` bor (JSX'da),
//     shuning uchun rasm burchaklardan chiqib ketmaydi
//   • ustidan qora gradient qatlam — matn, tugmalar, tablar va musiqa
//     paneli kontrasti saqlanadi
// bgColor → sekin gradient; aks holda tema kartasi rangi.
// Fon URL'i video (MP4/WebM) mi? Video CSS `background-image` bilan
// chizilmaydi — u alohida <video> elementi sifatida panelning ichida
// render qilinadi (pastdagi ProfileBgVideo).
export function isVideoBg(url) {
  return /\.(mp4|webm)(\?|$)/i.test(String(url || ''));
}

// Profil bo'limi ichidagi VIDEO fon.
//  • panel `overflow-hidden` + `rounded-[22px]` -> video bo'limdan chiqmaydi
//  • `object-cover` + `object-center` -> cho'zilmaydi, markazlashadi
//  • muted + loop + playsInline -> iOS/Android'da avtomatik ijro bo'ladi
//  • `preload="none"` va IntersectionObserver -> mobil internetda sahifa
//    qotib qolmasligi uchun video FAQAT ko'rinishga kirganda yuklanadi
//  • listener va manba sahifadan chiqishda tozalanadi
function ProfileBgVideo({ src }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let io = null;
    const start = () => {
      if (el.dataset.loaded === '1') return;
      el.dataset.loaded = '1';
      el.src = src;
      el.load();
      const p = el.play();
      if (p && p.catch) p.catch(() => { /* avtomatik ijro bloklandi — jim */ });
    };
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { start(); io.disconnect(); io = null; }
      }, { rootMargin: '200px' });
      io.observe(el);
    } else {
      start();
    }
    return () => {
      if (io) io.disconnect();
      // Media resursini bo'shatamiz — sahifadan chiqqach fonda yuklanib
      // yoki ijro bo'lib qolmasin.
      try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* ignore */ }
    };
  }, [src]);

  return (
    <>
      <video
        ref={ref}
        muted
        loop
        playsInline
        autoPlay
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
        className="profile-bg-layer pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      />
      {/* Matn kontrasti uchun qoraytiruvchi qatlam (rasm fonidagi bilan bir xil) */}
      <div className="profile-bg-layer pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 to-black/65" />
    </>
  );
}

export function innerPanelStyle(record) {
  if (record && record.bgUrl && isVideoBg(record.bgUrl)) {
    // Video holatida faqat qoraytiruvchi qatlam va matn ranglari — rasm
    // yo'q, chunki videoning o'zi panel ichida alohida chiziladi.
    return {
      backgroundColor: 'var(--vz-bg-a)',
      '--vz-ink': '#ffffff',
      '--vz-ink-dim': 'rgba(255,255,255,0.86)',
      '--vz-ink-faint': 'rgba(255,255,255,0.62)',
      '--vz-card': 'rgba(255,255,255,0.10)',
      '--vz-line': 'rgba(255,255,255,0.22)',
      '--vz-pill': 'rgba(255,255,255,0.16)',
    };
  }
  if (record && record.bgUrl) {
    return {
      backgroundColor: 'var(--vz-bg-a)',
      backgroundImage: `linear-gradient(rgba(0,0,0,0.52), rgba(0,0,0,0.62)), url("${record.bgUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'scroll',
      // Rasm ustida hamma narsa oq matn bilan o'qilishi uchun — bu
      // o'zgaruvchilar FAQAT shu panel ichida amal qiladi.
      '--vz-ink': '#ffffff',
      '--vz-ink-dim': 'rgba(255,255,255,0.86)',
      '--vz-ink-faint': 'rgba(255,255,255,0.62)',
      '--vz-card': 'rgba(255,255,255,0.10)',
      '--vz-line': 'rgba(255,255,255,0.22)',
      '--vz-pill': 'rgba(255,255,255,0.16)',
    };
  }
  if (record && record.bgColor) {
    const c1 = record.bgColor;
    const c2 = shadeColor(record.bgColor, -22);
    const c3 = shadeColor(record.bgColor, 14);
    const animated = record.bgAnimated !== false;
    return {
      backgroundImage: `linear-gradient(120deg, ${c1}, ${c2}, ${c3}, ${c1})`,
      backgroundSize: animated ? '300% 300%' : '100% 100%',
      backgroundRepeat: 'no-repeat',
      animation: animated ? 'bgShift 16s ease-in-out infinite' : undefined,
    };
  }
  return { background: 'var(--vz-card)' };
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

function buildVcf(record) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${record.name}`,
    record.role ? `TITLE:${record.role}` : '',
    record.about ? `NOTE:${record.about.replace(/\n/g, ' ')}` : '',
    (record.phone && !record.hidePhone) ? `TEL;TYPE=CELL:${record.phone}` : '',
    record.email ? `EMAIL:${record.email}` : '',
    record.tg ? `URL:${socialUrl('tg', record.tg)}` : '',
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

// Havola yasash YAGONA manbadan — src/lib/socialLinks.js.
// Avval bu yerda `https://instagram.com/${qiymat}` deb to'g'ridan-to'g'ri
// yopishtirilardi va odam to'liq manzil qo'ysa havola buzilardi
// (batafsil izoh o'sha faylda).

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
// uchun bosiladigan tugma sifatida ko'rsatamiz; birinchi bosishda ijro
// boshlanadi va aylanayotgan belgi bilan holat ko'rsatiladi. Profil
// dizayniga mos, ichki (statik) premium blok sifatida joylashgan —
// suzuvchi/siljitiladigan widget emas.
// YouTube havolasi: mobil (iOS/Android) brauzerlar yashirin iframe ovozini
// bloklaydi — shu sabab ijro paytida KICHIK video paneli ko'rsatiladi
// (foydalanuvchi bir marta bosib qo'yadi, keyin ovoz chiqadi). Panelni
// yig'ish (chevron) mumkin.

// YouTube IFrame Player API'ni bir marta yuklaydi. Mobil (iOS/Android)
// brauzerlar oddiy `autoplay=1` iframe ovozini bloklaydi — ovoz faqat
// foydalanuvchi imo-ishorasidan keyingina chiqadi. Shu sabab bu yerda
// haqiqiy Player API ishlatiladi: pleer oldindan tayyorlanadi va tugma
// bosilgan zahoti (aynan shu bosish ichida) player.playVideo() chaqiriladi.
let _ytApiPromise = null;
function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (_ytApiPromise) return _ytApiPromise;
  _ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') { try { prev(); } catch { /* ignore */ } }
      resolve(window.YT);
    };
    if (!document.getElementById('yt-iframe-api')) {
      const s = document.createElement('script');
      s.id = 'yt-iframe-api';
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return _ytApiPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUZUVCHI MINI-PLEER (2026-09)
// ─────────────────────────────────────────────────────────────────────────────
// Avval pleer profil kontentining ICHIDA turardi va YouTube ochilganda
// kartaning bir qismini egallardi; "yig'ish" bosilsa esa musiqa TO'XTARDI
// (iframe DOM'dan chiqarilgani uchun). Endi pleer sahifaning O'NG-PASTKI
// burchagida suzib turadi:
//   • YOPIQ holat — 64px ixcham kapsula, YouTube iframe UMUMAN yuklanmaydi;
//   • Play bosilganda — rasmiy YouTube playeri o'sha burchakda 200x200
//     bo'lib ochiladi va sahifani aylantirsangiz ham qolaveradi, ya'ni
//     musiqani to'xtatmasdan profilni to'liq ko'rish mumkin;
//   • MP3/M4A/OGG — video UMUMAN yo'q, kapsulaning o'zi (progress bar bilan).
//
// MUHIM (texnik): iframe DOM'da boshqa joyga KO'CHIRILMAYDI — brauzer uni
// qayta yuklab, qo'shiqni boshidan boshlab yuborardi. Shuning uchun butun
// pleer `createPortal` orqali `document.body` ga bir marta joylashtiriladi
// va faqat CSS holati o'zgaradi.
//
// YouTube qoidalari: audio videodan ajratilmaydi, yuklab olinmaydi va
// proxy qilinmaydi; ijro paytida rasmiy player KO'RINIB turadi (>= 200x200,
// display:none / opacity:0 / 1x1 / ekran tashqarisi YO'Q, ustiga element
// qo'yilmaydi); birinchi ijro faqat foydalanuvchining Play bosishi bilan.
// `ownerName` va `coverUrl` — qulf ekranidagi kartochka uchun (MediaSession).
function MusicPlayer({ urls = [], accentColor, onOpenChange, ownerName = '', coverUrl = '' }) {
  const audioRef = useRef(null);
  const ytHostRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytReadyRef = useRef(false);
  const wantPlayRef = useRef(false);
  // Yopilganda saqlangan ijro vaqti: videoId -> soniya (qayta Play shu
  // joydan davom ettiradi).
  const ytResumeRef = useRef(new Map());
  const endedRef = useRef(() => {});
  const [playing, setPlaying] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [thumbFailed, setThumbFailed] = useState(false);
  // Audio fayl uchun progress (video yo'q, shuning uchun o'zimiz ko'rsatamiz).
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  // Sudrab ko'chirish: {dx, dy} — boshlang'ich o'ng-past burchakdan siljish.
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const { t } = useLanguage();

  const url = urls[trackIndex] || '';
  const source = parseMusicSource(url);
  const ytId = source && source.kind === 'youtube' ? source.id : null;
  const ydFrag = source && source.kind === 'yandex' ? source.frag : null;
  const ydH = ydFrag && ydFrag.startsWith('track/') ? 180 : 220;

  useEffect(() => { setMounted(true); }, []);
  // Ochiq/yopiq holatni tashqariga bildiramiz — mobil ekranda kontent
  // oxiriga bo'sh joy qo'shiladi va pleer aloqa tugmalarini TO'SMAYDI.
  useEffect(() => { if (onOpenChange) onOpenChange(embedOpen); }, [embedOpen, onOpenChange]);

  const rememberYtTime = () => {
    const p = ytPlayerRef.current;
    if (!ytId || !p || !ytReadyRef.current) return;
    try {
      const sec = Number(p.getCurrentTime());
      if (Number.isFinite(sec) && sec > 1) ytResumeRef.current.set(ytId, Math.floor(sec));
    } catch { /* ignore */ }
  };

  const goToTrack = (nextIndex, keepPlaying) => {
    rememberYtTime();
    wantPlayRef.current = !!keepPlaying;
    setPlaying(false);
    setEmbedOpen(!!keepPlaying);
    setTrackIndex(nextIndex);
  };
  const switchTrack = (delta) => goToTrack((trackIndex + delta + urls.length) % urls.length, playing);
  // Trek tugadi -> keyingisiga. Oxirgisida (repeat sozlamasi yo'q) TO'XTAYDI.
  const handleTrackEnded = () => {
    if (trackIndex < urls.length - 1) goToTrack(trackIndex + 1, true);
    else { wantPlayRef.current = false; setPlaying(false); }
  };
  endedRef.current = handleTrackEnded;

  // Yopish: 1) pauza, 2) vaqtni saqlash, 3) iframe DOM'dan chiqadi
  // (effekt cleanup player.destroy() ni chaqiradi). Ko'rinmaydigan "fon
  // pleeri" QOLMAYDI.
  const closeEmbed = () => {
    const p = ytPlayerRef.current;
    if (p) { try { p.pauseVideo(); } catch { /* ignore */ } rememberYtTime(); }
    wantPlayRef.current = false;
    setPlaying(false);
    setEmbedOpen(false);
  };

  // Qo'shiq nomi: YouTube -> rasmiy oEmbed metadata; audio -> fayl nomi.
  useEffect(() => {
    let alive = true;
    if (ytId) {
      const cached = cachedYoutubeTitle(ytId);
      setTitle(cached || '');
      if (!cached) fetchYoutubeTitle(ytId).then((v) => { if (alive && v) setTitle(v); });
    } else if (ydFrag) {
      setTitle('Yandex Music');
    } else {
      setTitle(audioFileTitle(source && source.url) || '');
    }
    setThumbFailed(false);
    setPos(0); setDur(0);
    return () => { alive = false; };
  }, [ytId, ydFrag, source && source.url]);

  // YouTube pleeri FAQAT Play bosilgandan keyin yaratiladi.
  useEffect(() => {
    if (!ytId || !embedOpen) return undefined;
    let cancelled = false;
    ytReadyRef.current = false;
    const resumeAt = ytResumeRef.current.get(ytId) || 0;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !YT || !ytHostRef.current) return;
      const mount = document.createElement('div');
      mount.className = 'h-full w-full';
      ytHostRef.current.appendChild(mount);
      ytPlayerRef.current = new YT.Player(mount, {
        width: '100%',
        height: '100%',
        videoId: ytId,
        playerVars: {
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
          controls: 1,
          start: resumeAt || undefined,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            if (resumeAt) { try { ytPlayerRef.current.seekTo(resumeAt, true); } catch { /* ignore */ } }
            if (wantPlayRef.current) { try { ytPlayerRef.current.playVideo(); } catch { /* ignore */ } }
          },
          onStateChange: (e) => {
            if (e.data === 1) setPlaying(true);
            else if (e.data === 2) setPlaying(false);
            else if (e.data === 0) endedRef.current();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try { ytPlayerRef.current && ytPlayerRef.current.destroy(); } catch { /* ignore */ }
      ytPlayerRef.current = null;
      ytReadyRef.current = false;
      wantPlayRef.current = false;
      if (ytHostRef.current) ytHostRef.current.innerHTML = '';
    };
  }, [ytId, embedOpen]);

  const toggle = () => {
    if (ytId) {
      const p = ytPlayerRef.current;
      if (playing) {
        wantPlayRef.current = false;
        try { p && p.pauseVideo(); } catch { /* ignore */ }
        rememberYtTime();
        setPlaying(false);
        return;
      }
      wantPlayRef.current = true;
      if (!embedOpen) { setEmbedOpen(true); return; }
      setPlaying(true);
      if (p && ytReadyRef.current) { try { p.playVideo(); } catch { /* ignore */ } }
      return;
    }
    if (ydFrag) {
      if (embedOpen) { setEmbedOpen(false); setPlaying(false); return; }
      setEmbedOpen(true);
      setPlaying(true);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else el.play().then(() => setPlaying(true)).catch(() => {});
  };

  // ─── EKRAN O'CHGANDA HAM IJRO (MediaSession) ────────────────────────
  //
  // MUAMMO: telefonda ekran o'chsa yoki brauzer fonga o'tsa, o'zimiz
  // yuklagan qo'shiq to'xtab qolardi. Sabab — sahifa oddiy <audio> chalsa,
  // tizim uni "haqiqiy musiqa" deb tanimaydi va fonda ovozni to'xtatadi.
  //
  // YECHIM: MediaSession orqali tizimga trekning nomi, rasmi va boshqaruv
  // tugmalari beriladi. Shunda Android/iOS uni musiqa ilovasidek qabul
  // qiladi: ijro fonda davom etadi va QULF EKRANIDA Play/Pauza/keyingi
  // tugmalari chiqadi.
  //
  // FAQAT O'ZIMIZNING FAYLLAR uchun. YouTube'ni bu yo'l bilan fonda
  // chaldirib bo'lmaydi — YouTube o'z qoidasi bilan mobil brauzerda buni
  // bloklaydi, va uni chetlab o'tish ularning shartlarini buzadi.
  useEffect(() => {
    if (ytId || ydFrag) return undefined;
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return undefined;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new window.MediaMetadata({
        title: title || t('Musiqa'),
        artist: ownerName || 'NFCSTORE',
        album: 'NFCSTORE',
        // Qulf ekranidagi rasm — profil rasmi bo'lsa o'sha, bo'lmasa logotip.
        artwork: [{ src: coverUrl || '/logo-512.png', sizes: '512x512', type: 'image/png' }],
      });
    } catch { /* eski brauzer — metadata bo'lmasa ham ijro ishlaydi */ }

    const el = () => audioRef.current;
    const handlers = [
      ['play', () => { const a = el(); if (a) a.play().then(() => setPlaying(true)).catch(() => {}); }],
      ['pause', () => { const a = el(); if (a) { a.pause(); setPlaying(false); } }],
      ['previoustrack', urls.length > 1 ? () => switchTrack(-1) : null],
      ['nexttrack', urls.length > 1 ? () => switchTrack(1) : null],
      ['seekto', (d) => { const a = el(); if (a && d && d.seekTime != null) a.currentTime = d.seekTime; }],
    ];
    for (const [name, fn] of handlers) {
      // Brauzer qo'llab-quvvatlamaydigan amal `setActionHandler` da
      // xato beradi — qolganlari baribir o'rnatilishi kerak.
      try { ms.setActionHandler(name, fn); } catch { /* qo'llab-quvvatlanmaydi */ }
    }
    return () => {
      for (const [name] of handlers) {
        try { ms.setActionHandler(name, null); } catch { /* ignore */ }
      }
    };
    // `trackIndex` va `playing` ham bog'liqliklarda: ularsiz qulf
    // ekranidagi "keyingi trek" tugmasi ESKI trek raqamini eslab qolib,
    // bir necha trekdan keyin noto'g'ri joyga sakrardi.
  }, [ytId, ydFrag, title, urls.length, ownerName, coverUrl, t, trackIndex, playing]);

  // Tizim qulf ekranida to'g'ri holatni ko'rsatishi uchun.
  useEffect(() => {
    if (ytId || ydFrag) return;
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch { /* ignore */ }
  }, [playing, ytId, ydFrag]);

  // Audio: trek almashganda ijroni davom ettirish.
  useEffect(() => {
    if (ytId || ydFrag) return;
    const el = audioRef.current;
    if (!el || !wantPlayRef.current) return;
    el.play().then(() => setPlaying(true)).catch(() => { wantPlayRef.current = false; });
  }, [url, ytId, ydFrag]);

  // Sudrab ko'chirish — pleer kerakli joyni to'sib qolsa, foydalanuvchi uni
  // suradi. Pleer HAR DOIM ekran ichida qoladi (yashirilmaydi).
  //
  // MUHIM: harakat 6px dan oshmaguncha sudrash BOSHLANMAYDI va
  // `preventDefault()` chaqirilmaydi — aks holda telefonda oddiy teginish
  // (Play/keyingi trek) sudrash deb qabul qilinib, tugma ishlamay qolardi.
  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - d.px;
      const dy = pt.clientY - d.py;
      if (!d.active) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // hali teginish
        d.active = true;
      }
      const maxX = Math.max(0, window.innerWidth - 120);
      const maxY = Math.max(0, window.innerHeight - 120);
      setDrag({
        x: Math.max(-maxX, Math.min(0, d.x0 + dx)),
        y: Math.max(-maxY, Math.min(0, d.y0 + dy)),
      });
      if (e.cancelable) e.preventDefault();
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);
  const startDrag = (e) => {
    // Tugma (Play / oldingi / keyingi / yopish) bosilganda sudrash
    // umuman boshlanmaydi.
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const pt = e.touches ? e.touches[0] : e;
    dragRef.current = { px: pt.clientX, py: pt.clientY, x0: drag.x, y0: drag.y, active: false };
  };

  if (!source || !mounted) return null;
  const isYt = source.kind === 'youtube';
  const isYd = source.kind === 'yandex';
  const trackLabel = urls.length > 1 ? `${t('Musiqa')} ${trackIndex + 1}/${urls.length}` : t('Musiqa');
  const displayTitle = title || t('Musiqa');
  const mmss = (s) => {
    const v = Math.max(0, Math.floor(Number(s) || 0));
    return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
  };
  const ctrl = 'flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--vz-ink,#f7f2e8)] transition hover:bg-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';
  const closeBtn = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/55 text-[13px] leading-none text-white/75 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

  const widget = (
    // `position: fixed` + portal — sahifani aylantirganda ham burchakda
    // qoladi, ya'ni musiqa uzilmasdan butun profilni ko'rish mumkin.
    // z-index modallardan (z-[200]) PAST — ular ustidan chiqmaydi.
    <div
      data-music-player=""
      className="fixed z-[120] w-[320px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-white/12 bg-[rgba(18,16,13,0.96)] shadow-[0_18px_46px_rgba(0,0,0,0.6)] backdrop-blur-md"
      style={{
        right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        transform: `translate(${drag.x}px, ${drag.y}px)`,
        color: 'var(--vz-ink, #f7f2e8)',
      }}
    >
      {/* ─── RASMIY YOUTUBE PLAYERI — faqat Play bosilgandan keyin ───
          200x200: YouTube ruxsat bergan eng kichik o'lcham. Quti RAMKASIZ,
          shuning uchun content viewport 200px dan kichrayib qolmaydi.
          Yashirilmaydi va ustiga hech narsa qo'yilmaydi. */}
      {isYt && embedOpen && (
        <div className="relative px-2.5 pb-1 pt-2.5">
          <div ref={ytHostRef} className="mx-auto block overflow-hidden rounded-xl bg-black" style={{ width: 200, height: 200 }} />
          <button
            type="button"
            onClick={closeEmbed}
            className={`absolute right-4 top-4 ${closeBtn}`}
            aria-label={t('Musiqani yopish')}
            title={t('Musiqani yopish')}
          >
            {'✕'}
          </button>
        </div>
      )}
      {isYd && embedOpen && (
        <div className="relative px-2.5 pb-1 pt-2.5">
          <div className="mx-auto overflow-hidden rounded-xl bg-black" style={{ width: 240, height: ydH }}>
            <iframe
              title="profil-musiqasi"
              src={yandexEmbedSrc(ydFrag)}
              frameBorder="0"
              allow="autoplay; encrypted-media"
              className="block"
              style={{ border: 'none', width: 240, height: ydH }}
            />
          </div>
          <button type="button" onClick={closeEmbed} className={`absolute right-4 top-4 ${closeBtn}`} aria-label={t('Musiqani yopish')} title={t('Musiqani yopish')}>{'✕'}</button>
        </div>
      )}
      {/* Oddiy audio fayl — HECH QANDAY video yoki katta muqova YO'Q. */}
      {!isYt && !isYd && (
        <audio
          ref={audioRef}
          src={source.url}
          preload="none"
          onEnded={handleTrackEnded}
          onTimeUpdate={(e) => setPos(e.target.currentTime)}
          onDurationChange={(e) => setDur(e.target.duration)}
          onLoadedMetadata={(e) => setDur(e.target.duration)}
        />
      )}

      {/* ─── IXCHAM QATOR (yopiq holatning O'ZI, ~64px) ─── */}
      <div
        className="flex items-center gap-2.5 px-2.5 py-2"
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{ cursor: 'grab' }}
      >
        {/* Embed ochiq bo'lganda kichik muqova KO'RSATILMAYDI — videoning
            o'zi muqova vazifasini bajaradi va qo'shiq nomiga joy bo'shaydi. */}
        {!embedOpen && (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/12 bg-white/5">
          {isYt && !thumbFailed ? (
            <img
              src={`https://i.ytimg.com/vi/${ytId}/default.jpg`}
              alt=""
              loading="lazy"
              onError={() => setThumbFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[17px] opacity-70" aria-hidden="true">{'\u{1F3B5}'}</span>
          )}
        </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold leading-tight" title={displayTitle}>{displayTitle}</div>
          {/* YouTube/Yandex — manba belgisi va trek raqami.
              Audio fayl — progress bar va vaqt (video yo'q, shuning uchun
              boshqarish uchun shu kerak). */}
          {isYt || isYd ? (
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px] leading-tight opacity-60">
              {isYt && (
                <span className="inline-flex shrink-0 items-center" aria-label="YouTube" title="YouTube">
                  <svg width="16" height="12" viewBox="0 0 28 20" aria-hidden="true">
                    <rect width="28" height="20" rx="5" fill="#FF0000" />
                    <path d="M11.2 5.6v8.8L18.4 10z" fill="#fff" />
                  </svg>
                </span>
              )}
              <span className="truncate">{trackLabel}</span>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px] leading-tight opacity-60">
              <span className="tabular-nums">{mmss(pos)}</span>
              <span className="relative h-[3px] min-w-[40px] flex-1 overflow-hidden rounded-full bg-white/20">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: dur ? `${Math.min(100, (pos / dur) * 100)}%` : '0%', background: accentColor || 'var(--vz-accent, #d4af5a)' }}
                />
              </span>
              <span className="tabular-nums">{dur ? mmss(dur) : trackLabel}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {urls.length > 1 && (
            <button type="button" onClick={() => switchTrack(-1)} className={ctrl} aria-label={t('Oldingi qo‘shiq')} title={t('Oldingi qo‘shiq')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.5 5.2v13.6c0 .8-.9 1.2-1.5.7l-7.6-6.1v5.4c0 .8-.9 1.2-1.5.7L7 18.4V5.6l.9-1.1c.6-.5 1.5-.1 1.5.7v5.4l7.6-6.1c.6-.5 1.5-.1 1.5.7z" /><rect x="5" y="4.5" width="2.2" height="15" rx="1" /></svg>
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ background: accentColor || 'var(--vz-accent, #d4af5a)' }}
            aria-label={playing ? t('Musiqani to‘xtatish') : t('Musiqani yoqish')}
            title={playing ? t('Musiqani to‘xtatish') : t('Musiqani yoqish')}
          >
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          {urls.length > 1 && (
            <button type="button" onClick={() => switchTrack(1)} className={ctrl} aria-label={t('Keyingi qo‘shiq')} title={t('Keyingi qo‘shiq')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.5 5.2v13.6c0 .8.9 1.2 1.5.7l7.6-6.1v5.4c0 .8.9 1.2 1.5.7l.9-1.1V5.6L16.1 4.5c-.6-.5-1.5-.1-1.5.7v5.4L7 4.5c-.6-.5-1.5-.1-1.5.7z" /><rect x="16.8" y="4.5" width="2.2" height="15" rx="1" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(widget, document.body);
}

// Profil postlari lentasi — rasm + izoh + like. Tashrif buyuruvchi
// (tizimga kirgan) like bosa oladi; egasi postlarni /account'da boshqaradi.
function PostsFeed({ posts, onLike, t }) {
  const [zoom, setZoom] = useState(null);
  if (!posts || posts.length === 0) {
    return <div className="mt-8 text-center text-sm text-[color:var(--vz-ink-faint)]">{t('Hali post yo‘q')}</div>;
  }
  return (
    <div className="mt-6 flex flex-col gap-5">
      {zoom && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-3"
          onClick={() => setZoom(null)}
        >
          <button
            type="button"
            aria-label="Yopish"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-lg text-white"
            onClick={() => setZoom(null)}
          >
            ✕
          </button>
          {zoom.videoUrl
            ? <video src={zoom.videoUrl} controls autoPlay playsInline className="max-h-[92vh] max-w-[96vw] rounded-lg" onClick={(e) => e.stopPropagation()} />
            : <img src={zoom.imageUrl} alt="" className="max-h-[92vh] max-w-[96vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />}
        </div>
      )}
      {posts.map((p) => (
        <div key={p.id} className="overflow-hidden rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)]">
          {p.videoUrl ? (
            <button type="button" onClick={() => setZoom(p)} className="group relative block w-full cursor-pointer bg-black">
              <video src={p.videoUrl} muted playsInline preload="metadata" className="block max-h-[520px] w-full bg-black object-contain" />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-2xl text-white transition group-hover:bg-black/70">▶</span>
              </span>
            </button>
          ) : (
            <button type="button" onClick={() => setZoom(p)} className="block w-full cursor-pointer">
              <img src={p.imageUrl} alt="" loading="lazy" className="block max-h-[520px] w-full object-cover" />
            </button>
          )}
          <div className="px-4 py-3">
            {p.caption && <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-[color:var(--vz-ink-dim)]">{p.caption}</p>}
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => onLike(p.id)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[15px] transition ${p.liked ? 'border-red-400/50 text-red-400' : 'border-[color:var(--vz-line)] text-[color:var(--vz-ink-dim)]'}`}
              >
                <span>{p.liked ? '❤️' : '\u{1F90D}'}</span><b>{p.likeCount}</b>
              </button>
              <span className="text-[14px] text-[color:var(--vz-ink-faint)]">{timeAgo(p.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Obunachilar / obunalar / YOQTIRGANLAR ro'yxati — har biri profilga
// link. Uchalasi bir xil shaklda keladi ({kind, code, name, ...}),
// shuning uchun bitta modal: `dir` faqat sarlavha va manbani tanlaydi.
// Uni ikkiga bo'lish nusxa-kod bo'lardi va vaqt o'tib ajralib ketardi.
function FollowListModal({ code, dir, onClose, t }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setList(null);
    setError(false);
    let cancelled = false;
    (dir === 'likes' ? dbLikeList(code) : dbFollowList(code, dir))
      .then((rows) => { if (!cancelled) setList(rows); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [code, dir]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-3xl bg-[color:var(--vz-bg-a,#15171b)] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-bold text-[color:var(--vz-ink)]">
            {dir === 'likes' ? t('Yoqtirganlar') : dir === 'following' ? t('Obunalar') : t('Obunachilar')}
          </span>
          <CloseButton onClick={onClose} />
        </div>
        <div className="overflow-y-auto p-2">
          {list === null && !error && (
            <div className="space-y-1 p-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/10" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/5 animate-pulse rounded bg-white/10" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="p-6 text-center text-sm text-[color:var(--vz-ink-faint)]">
              {t("Ro'yxatni yuklab bo'lmadi. Qaytadan urinib ko'ring.")}
            </div>
          )}
          {list && !error && list.length === 0 && <div className="p-6 text-center text-sm text-[color:var(--vz-ink-faint)]">{t('Ro‘yxat bo‘sh')}</div>}
          {list && !error && list.map((m) => (
            <button
              key={(m.kind === 'company' ? 'c:' : 'p:') + m.code}
              onClick={() => { onClose(); navigate(m.kind === 'company' ? `/c/${m.code.toLowerCase()}` : '/' + m.code); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
            >
              {/* Kompaniya nomidan obuna bo'lgan bo'lsa — logotip
                  YUMALOQ-KVADRAT, shaxsiy avatar esa dumaloq. Shakl
                  bilanoq kim ekani bilinadi. */}
              <div className={`h-10 w-10 shrink-0 overflow-hidden bg-[color:var(--vz-pill)] ${m.kind === 'company' ? 'rounded-xl border border-[color:var(--vz-gold-2,#c9a24b)]/50' : 'rounded-full'}`}>
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                  : <span className="flex h-full w-full items-center justify-center text-[16px] font-bold text-[color:var(--vz-ink)]">{initials(m.name)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate text-[16px] font-semibold text-[color:var(--vz-ink)]">
                  {m.name}
                  {m.kind === 'company'
                    ? <span className="shrink-0 rounded-full border border-[color:var(--vz-gold-2,#c9a24b)]/50 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-[color:var(--vz-gold-2,#c9a24b)]">{t('Biznes')}</span>
                    : m.verified && <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-[9px] font-black text-white">✓</span>}
                </div>
                <div className="truncate font-mono text-[14px] text-[color:var(--vz-ink-faint)]">
                  nfcstore.uz/{m.kind === 'company' ? `c/${m.code.toLowerCase()}` : m.code.toLowerCase()}
                </div>
                {/* Kompaniya orqasiga butunlay yashirinib olmasin:
                    kim ekani ham ko'rinib tursin. */}
                {m.kind === 'company' && m.personName && (
                  <div className="truncate text-[13px] text-[color:var(--vz-ink-faint)]">{m.personName}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Profildagi vizual karta — bosilsa aylanadi (orqa tomon: faqat "NFC STORE").
function FlipNfcCard({ finish, t, children }) {
  const [flipped, setFlipped] = useState(false);
  const f = cardFinish(finish);
  return (
    <div className="[perspective:1200px]">
      <div
        onClick={() => setFlipped((v) => !v)}
        title={t('Aylantirish uchun bosing')}
        className="relative h-[176px] w-[280px] cursor-pointer transition-transform duration-[600ms] ease-[cubic-bezier(.2,.8,.2,1)] [transform-style:preserve-3d]"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:translateZ(0.1px)]">{children}</div>
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{ background: f.bg, border: f.border || 'none', boxShadow: '0 20px 45px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)' }}
        >
          <span className="font-display text-[20px] font-extrabold tracking-[0.12em]" style={{ color: f.sub }}>NFCSTORE</span>
        </div>
      </div>
    </div>
  );
}

// Jamoa / Team (PHASE 5) — biznes profil a'zolari. member_code bo'lsa —
// o'sha a'zoning o'z profiliga o'tadi.
function ProfileTeam({ team, t }) {
  if (!team || team.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="mb-2.5 text-[15px] font-extrabold uppercase tracking-[0.09em] text-[color:var(--vz-ink-faint)]">{t('Jamoa')}</div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {team.map((m) => {
          const clickable = !!m.memberCode;
          const Wrap = clickable ? 'button' : 'div';
          return (
            <Wrap
              key={m.id}
              onClick={clickable ? () => navigate('/' + m.memberCode) : undefined}
              className={`flex flex-col items-center rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] p-3 text-center ${clickable ? 'cursor-pointer transition hover:border-[color:var(--vz-ink-dim)]' : ''}`}
            >
              <div className="h-14 w-14 overflow-hidden rounded-full bg-[color:var(--vz-pill)] text-[color:var(--vz-ink)]">
                {m.photoUrl
                  ? <img src={m.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <span className="flex h-full w-full items-center justify-center text-[15px] font-bold">{initials(m.name)}</span>}
              </div>
              <div className="mt-1.5 text-[15px] font-bold text-[color:var(--vz-ink)]">{m.name}</div>
              {m.position && <div className="text-[14px] text-[color:var(--vz-ink-dim)]">{m.position}</div>}
              {clickable && <div className="mt-0.5 font-mono text-[13px] text-[color:var(--vz-ink-faint)]">/{m.memberCode.toLowerCase()}</div>}
            </Wrap>
          );
        })}
      </div>
    </div>
  );
}


// Galereya (Business Workspace) — biznes profil rasm galereyasi, ProfileTeam
// bilan bir xil naqsh (vizitka tabida, Jamoa/Fayllar bilan bir qatorda).
function ProfileGallery({ gallery, t }) {
  if (!gallery || gallery.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="mb-2.5 text-[15px] font-extrabold uppercase tracking-[0.09em] text-[color:var(--vz-ink-faint)]">{t('Galereya')}</div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {gallery.map((g) => (
          <div key={g.id} className="overflow-hidden rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)]">
            <div className="aspect-square">
              <img src={g.imageUrl} alt={g.caption || ''} loading="lazy" className="h-full w-full object-cover" />
            </div>
            {g.caption && <div className="p-1.5 text-center text-[13px] text-[color:var(--vz-ink-dim)]">{g.caption}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Restoran menyusi (Band 3.3) — public ko'rinish. Mobil-first.
function MenuView({ menu, t }) {
  const money = (n) => `${fmt(n)} ${t("so'm")}`;
  const shown = (menu || []).filter((c) => c.items && c.items.length > 0);
  if (shown.length === 0) {
    return <div className="mt-8 text-center text-sm text-[color:var(--vz-ink-faint)]">{t('Menyu hozircha bo‘sh')}</div>;
  }
  return (
    <div className="mt-6 flex flex-col gap-7">
      {shown.map((cat) => (
        <div key={cat.id}>
          <div className="mb-2.5 text-[15px] font-extrabold uppercase tracking-[0.09em] text-[color:var(--vz-ink)]">{cat.name}</div>
          <div className="flex flex-col gap-2.5">
            {cat.items.map((it) => (
              <div key={it.id} className={`flex gap-3 rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] p-3 ${it.available ? '' : 'opacity-45'}`}>
                {it.imageUrl && (
                  <img src={it.imageUrl} alt="" loading="lazy" className="h-[74px] w-[74px] shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[16.5px] font-bold text-[color:var(--vz-ink)]">
                      {it.featured && <span className="mr-1">⭐</span>}{it.name}
                    </div>
                    {it.price != null && (
                      <div className="shrink-0 text-right text-[16px] font-bold text-[color:var(--vz-ink)]">
                        {it.discountPrice != null ? (
                          <>
                            <span className="mr-1.5 text-[color:var(--vz-ink-faint)] line-through">{money(it.price)}</span>
                            <span className="text-[color:var(--vz-accent)]">{money(it.discountPrice)}</span>
                          </>
                        ) : money(it.price)}
                      </div>
                    )}
                  </div>
                  {it.description && <p className="mt-0.5 text-[15px] leading-snug text-[color:var(--vz-ink-dim)]">{it.description}</p>}
                  {!it.available && <div className="mt-1 text-[14px] font-semibold text-[color:var(--vz-ink-faint)]">{t('Hozircha yo‘q')}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mahsulotlar katalogi (Company System — Products) — MenuView'dan farqli,
// grid (karta) ko'rinishida, chunki umumiy mahsulot katalogi (masalan
// "NFC Market" namunasidagi kabi) ro'yxatdan ko'ra karta bilan yaxshi o'qiladi.
function ProductsView({ products, t }) {
  const money = (n) => `${fmt(n)} ${t("so'm")}`;
  const shown = (products || []).filter((c) => c.items && c.items.length > 0);
  if (shown.length === 0) {
    return <div className="mt-8 text-center text-sm text-[color:var(--vz-ink-faint)]">{t('Katalog hozircha bo‘sh')}</div>;
  }
  return (
    <div className="mt-6 flex flex-col gap-7">
      {shown.map((cat) => (
        <div key={cat.id}>
          <div className="mb-2.5 text-[15px] font-extrabold uppercase tracking-[0.09em] text-[color:var(--vz-ink)]">{cat.name}</div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {cat.items.map((it) => (
              <div key={it.id} className={`flex flex-col overflow-hidden rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] ${it.available ? '' : 'opacity-45'}`}>
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-black/20">
                  {it.imageUrl
                    ? <img src={it.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <span className="text-[13px] text-[color:var(--vz-ink-faint)]">{it.name}</span>}
                </div>
                <div className="min-w-0 flex-1 p-2.5">
                  <div className="text-[15px] font-bold leading-snug text-[color:var(--vz-ink)]">
                    {it.featured && <span className="mr-1">⭐</span>}{it.name}
                  </div>
                  {it.price != null && (
                    <div className="mt-1 text-[15px] font-bold text-[color:var(--vz-ink)]">
                      {it.discountPrice != null ? (
                        <>
                          <span className="mr-1 text-[14px] text-[color:var(--vz-ink-faint)] line-through">{money(it.price)}</span>
                          <span className="text-[color:var(--vz-accent)]">{money(it.discountPrice)}</span>
                        </>
                      ) : money(it.price)}
                    </div>
                  )}
                  {!it.available && <div className="mt-1 text-[13px] font-semibold text-[color:var(--vz-ink-faint)]">{t('Hozircha yo‘q')}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Xizmatlar katalogi (Business Workspace) — ProductsView bilan bir xil
// grid, lekin narx o'rniga narx TURI hisobga olinadi (belgilangan / dan
// boshlab / kelishiladi) — qurilish, IT, go'zallik va h.k. sohalar uchun.
function ServicesView({ services, t }) {
  const money = (n) => `${fmt(n)} ${t("so'm")}`;
  const priceLabel = (it) => {
    if (it.priceType === 'negotiable') return t('Narx kelishiladi');
    if (it.price == null) return '';
    return it.priceType === 'from' ? `${money(it.price)} ${t('dan')}` : money(it.price);
  };
  const shown = (services || []).filter((c) => c.items && c.items.length > 0);
  if (shown.length === 0) {
    return <div className="mt-8 text-center text-sm text-[color:var(--vz-ink-faint)]">{t('Xizmatlar hozircha bo‘sh')}</div>;
  }
  return (
    <div className="mt-6 flex flex-col gap-7">
      {shown.map((cat) => (
        <div key={cat.id}>
          <div className="mb-2.5 text-[15px] font-extrabold uppercase tracking-[0.09em] text-[color:var(--vz-ink)]">{cat.name}</div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {cat.items.map((it) => (
              <div key={it.id} className={`flex flex-col overflow-hidden rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] ${it.available ? '' : 'opacity-45'}`}>
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-black/20">
                  {it.imageUrl
                    ? <img src={it.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <span className="text-[13px] text-[color:var(--vz-ink-faint)]">{it.name}</span>}
                </div>
                <div className="min-w-0 flex-1 p-2.5">
                  <div className="text-[15px] font-bold leading-snug text-[color:var(--vz-ink)]">
                    {it.featured && <span className="mr-1">⭐</span>}{it.name}
                  </div>
                  {priceLabel(it) && (
                    <div className="mt-1 text-[15px] font-bold text-[color:var(--vz-ink)]">{priceLabel(it)}</div>
                  )}
                  {!it.available && <div className="mt-1 text-[13px] font-semibold text-[color:var(--vz-ink-faint)]">{t('Hozircha yo‘q')}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Lead Capture (Band 3.2) — tashrifchi kontaktini qoldiradi. Egasi
// "Lidlarni yig'ish" ni yoqqan Gold+/Premium profillarda ko'rinadi.
function LeadForm({ code, linkBtn, onDone }) {
  const { t } = useLanguage();
  const [f, setF] = useState({ name: '', phone: '', telegram: '', email: '', company: '', note: '', website_url: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async () => {
    setErr('');
    if (!f.name.trim()) { setErr(t('Ismingizni kiriting.')); return; }
    if (!f.phone.trim() && !f.telegram.trim() && !f.email.trim()) {
      setErr(t('Kamida bitta aloqa usulini qoldiring (telefon, Telegram yoki email).'));
      return;
    }
    setBusy(true);
    try {
      await dbSubmitLead(code, f);
      setDone(true);
      if (onDone) onDone();
    } catch (e) {
      const m = {
        lead_limit_reached: t('Bugungi limit tugadi, ertaga urinib ko‘ring.'),
        lead_disabled: t('Bu profil hozircha kontakt qabul qilmayapti.'),
        contact_required: t('Kamida bitta aloqa usulini qoldiring (telefon, Telegram yoki email).'),
        name_required: t('Ismingizni kiriting.'),
        too_many_requests: t('Juda ko‘p urinish. Birozdan so‘ng qayta urining.'),
      };
      setErr(m[e.code] || t('Yuborishda xatolik. Qayta urining.'));
    } finally {
      setBusy(false);
    }
  };

  const inCls = 'w-full rounded-xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] px-3 py-2.5 text-[16px] text-[color:var(--vz-ink)] outline-none placeholder:text-[color:var(--vz-ink-faint)] focus:border-[color:var(--vz-ink-dim)]';

  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] p-5 text-center">
        <div className="text-2xl">✅</div>
        <div className="mt-1.5 text-[16.5px] font-bold text-[color:var(--vz-ink)]">{t('Rahmat! Kontaktingiz yuborildi.')}</div>
        <div className="mt-1 text-[15px] text-[color:var(--vz-ink-faint)]">{t('Profil egasi tez orada bog‘lanadi.')}</div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] p-5">
      <div className="text-[16px] font-extrabold uppercase tracking-[0.08em] text-[color:var(--vz-ink)]">{t('Kontaktingizni qoldiring')}</div>
      <div className="mt-1 text-[15px] text-[color:var(--vz-ink-faint)]">{t('Profil egasi siz bilan bog‘lanadi.')}</div>
      <div className="mt-3 flex flex-col gap-2">
        <input className={inCls} value={f.name} onChange={set('name')} placeholder={t('Ismingiz')} autoComplete="name" />
        <input className={inCls} value={f.phone} onChange={set('phone')} placeholder={t('Telefon')} inputMode="tel" autoComplete="tel" />
        <input className={inCls} value={f.telegram} onChange={set('telegram')} placeholder="Telegram (@username)" />
        <input className={inCls} value={f.email} onChange={set('email')} placeholder="Email" inputMode="email" autoComplete="email" />
        <input className={inCls} value={f.company} onChange={set('company')} placeholder={t('Kompaniya (ixtiyoriy)')} />
        <textarea className={inCls} value={f.note} onChange={set('note')} rows={2} placeholder={t('Izoh (ixtiyoriy)')} />
        {/* Honeypot — ekranда ko'rinmaydi, faqat botlar to'ldiradi */}
        <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={f.website_url} onChange={set('website_url')} />
      </div>
      {err && <div className="mt-2 text-[15px] text-red-400">{err}</div>}
      <button onClick={submit} disabled={busy} className={`${linkBtn} mt-3 w-full cursor-pointer disabled:opacity-60`}>
        {busy ? t('Yuborilmoqda...') : t('Yuborish')}
      </button>
    </div>
  );
}

export default function ProfilePage({ code, catalog, initialTab }) {
  const [record, setRecord] = useState(undefined);
  // Istorya — asosiy ma'lumotdan ALOHIDA so'rov: u 24 soatda o'zgaradi,
  // profil javobi esa keshlanadi.
  const [stories, setStories] = useState([]);
  const [pendingGift, setPendingGift] = useState(undefined); // "Gift NFC ID" — yangi, izolyatsiyalangan
  const [toast, setToast] = useState('');
  // Company System — nfcstore.uz/{code}/menyu va /{code}/mahsulotlar
  // to'g'ridan-to'g'ri shu tabga ochiladi (Faz 9/10).
  // Boshlang'ich bo'lim BO'SH: qaysi bo'limlar bor ekani ma'lum
  // bo'lgach quyida tanlanadi (biznes profildagi bilan bir xil qoida).
  // `initialTab` — /vip001/menyu kabi manzillardan keladi va u ustun.
  const [tab, setTab] = useState(initialTab || '');
  const [tapInactive, setTapInactive] = useState(false);
  // Suzuvchi mini-pleer ochiqmi — ochiq bo'lsa kontent oxiriga bo'sh joy
  // qo'shiladi, shunda pleer aloqa tugmalarini to'sib qolmaydi.
  const [musicOpen, setMusicOpen] = useState(false);
  const [followStats, setFollowStats] = useState(null);
  const [likeInfo, setLikeInfo] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);
  // Kim nomidan obuna bo'lyapman: '' — shaxsiy profil, aks holda
  // o'zimning kompaniyam Company ID si.
  const [myCompanies, setMyCompanies] = useState([]);
  // Tanlov ESLAB QOLINADI. Egasi "biznes profilga o'tdim" deb
  // o'ylaydi — har bir yangi profilda tanlovni qaytadan qidirishi
  // shart emas: bir marta tanlangani keyingi profillarda ham turadi.
  const [followAs, setFollowAs] = useState(() => readFollowAs() || '');
  // Brauzerda saqlangan tanlov BORMI. Yo'q bo'lsa — profilga
  // biriktirilgan kompaniya standart yuz bo'ladi (egasining so'rovi:
  // hisobda kompaniyani tanlagach, boshqa profillarga ham o'sha
  // kompaniya nomidan obuna bo'lish kerak).
  const followAsRemembered = useRef(readFollowAs() !== null);
  const [followMsg, setFollowMsg] = useState(null);
  const [posts, setPosts] = useState([]);
  const [menu, setMenu] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [files, setFiles] = useState([]);
  const [team, setTeam] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [leadOpen, setLeadOpen] = useState(false);
  const [followListDir, setFollowListDir] = useState(null); // null | 'followers' | 'following' | 'likes'
  // Karta raqami oynasi: {number, label} yoki null.
  const [cardModal, setCardModal] = useState(null);
  const { user, myCards } = useAuth();
  // O'Z profiliga biriktirilgan kompaniya (asosiy karta birinchi). Bu
  // ODDIY SATR — quyidagi useEffect bog'liqliklariga massiv qo'yilsa,
  // har render'da yangi havola bo'lib effektni cheksiz qayta ishga
  // tushirardi.
  const attachedCompanyId = (() => {
    const own = (Array.isArray(myCards) ? myCards : []).filter((c) => c && c.companyId);
    return (own.find((c) => c.isPrimary) || own[0] || {}).companyId || '';
  })();
  const { t, lang } = useLanguage();
  const cats = useCategories();

  useEffect(() => {
    // Bu profilga ALLAQACHON obuna bo'lgan bo'lsa — serverdagi yuz
    // ko'rsatiladi. Obuna bo'lmagan bo'lsa esa eslab qolingan tanlov
    // saqlanadi (aks holda u har bir yangi profilda "shaxsiy"ga
    // qaytib ketardi).
    dbFollowStats(code).then((st) => {
      setFollowStats(st);
      if (st.isFollowing) setFollowAs(st.asCompanyId || '');
    }).catch(() => {});
    dbGetLike(code).then(setLikeInfo).catch(() => {});
    dbListPosts(code).then(setPosts).catch(() => setPosts([]));
    dbListStories(code).then(setStories).catch(() => setStories([]));
    dbGetMenu(code).then(setMenu).catch(() => setMenu([]));
    dbGetProducts(code).then(setProducts).catch(() => setProducts([]));
    dbGetServices(code).then(setServices).catch(() => setServices([]));
    dbGetFiles(code).then(setFiles).catch(() => setFiles([]));
    dbGetTeam(code).then(setTeam).catch(() => setTeam([]));
    dbGetGallery(code).then(setGallery).catch(() => setGallery([]));
  }, [code, user]);

  // "Menyu" tabi ochilganda bir marta menu_view hodisasini yozamiz.
  const menuViewLogged = useRef(false);
  useEffect(() => {
    if (tab === 'menyu' && !menuViewLogged.current && record && !isOwner) {
      menuViewLogged.current = true;
      dbLogEvent(code, 'menu_view');
    }
  }, [tab]);

  // "Mahsulotlar" tabi ochilganda bir marta products_view hodisasini yozamiz.
  const productsViewLogged = useRef(false);
  useEffect(() => {
    if (tab === 'mahsulotlar' && !productsViewLogged.current && record && !isOwner) {
      productsViewLogged.current = true;
      dbLogEvent(code, 'products_view');
    }
  }, [tab]);

  // "Xizmatlar" tabi ochilganda bir marta services_view hodisasini yozamiz.
  const servicesViewLogged = useRef(false);
  useEffect(() => {
    if (tab === 'xizmatlar' && !servicesViewLogged.current && record && !isOwner) {
      servicesViewLogged.current = true;
      dbLogEvent(code, 'services_view');
    }
  }, [tab]);

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
      // Layk ham obuna kabi: kim NOMIDAN bosilgani saqlanadi va
      // "Yoqtirganlar" ro'yxatida o'sha yuz ko'rinadi.
      const res = await dbToggleLike(code, followAs);
      setLikeInfo((prev) => ({ liked: res.liked, count: (prev?.count || 0) + (res.liked ? 1 : -1), asCompanyId: res.asCompanyId || '' }));
    } catch { /* jim tur */ }
  };

  // O'ZIMNING FAOL KOMPANIYALARIM — "kim nomidan obuna bo'laman"
  // tanlovi uchun. Kirmagan yoki kompaniyasi yo'q odamda bu ro'yxat
  // bo'sh qoladi va tanlov umuman ko'rsatilmaydi.
  //
  // `isOwner` ga BOG'LANMAYDI: u shu funksiyada ANCHA PASTDA `const`
  // bilan e'lon qilingan, ya'ni bu yerda unga murojaat qilish
  // "Cannot access before initialization" xatosini beradi va butun
  // sahifa ochilmay qoladi (production'da aynan shu bo'ldi).
  // Zarurat ham yo'q: tanlov faqat obuna tugmasi yonida chiqadi, u esa
  // profil egasiga umuman ko'rsatilmaydi.
  useEffect(() => {
    if (!user) { setMyCompanies([]); return undefined; }
    let live = true;
    listMyCompanies()
      .then((d) => {
        if (!live) return;
        const active = (d.companies || []).filter((c) => c.status === 'active');
        setMyCompanies(active);
        setFollowAs((cur) => {
          // Eslab qolingan kompaniya o'chirilgan yoki to'xtatilgan
          // bo'lsa — shaxsiy profilga qaytamiz. Aks holda tanlov
          // ro'yxatda yo'q qiymatda qolib, server har safar rad
          // etardi va odam sababini tushunmasdi.
          if (cur && !active.some((c) => c.companyId === cur)) return '';
          if (cur || followAsRemembered.current) return cur;
          return active.some((c) => c.companyId === attachedCompanyId) ? attachedCompanyId : '';
        });
      })
      .catch(() => live && setMyCompanies([]));
    return () => { live = false; };
  }, [user, attachedCompanyId]);

  // Obuna endi har doim bepul va darhol amalga oshadi.
  const toggleFollow = async () => {
    setFollowBusy(true);
    setFollowMsg(null);
    try {
      if (followStats?.isFollowing) {
        await dbUnfollow(code);
      } else {
        await dbFollow(code, followAs);
      }
      const stats = await dbFollowStats(code);
      setFollowStats(stats);
      if (stats.isFollowing) setFollowAs(stats.asCompanyId || '');
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
            const sp = new URLSearchParams(window.location.search);
            const ref = sp.get('t') ? 'nfc' : (['qr', 'link'].includes(sp.get('ref')) ? sp.get('ref') : undefined);
            const views = await dbAddView(code, ref);
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

  // Analytics — havola/kontakt bosilishini yozadi (egasi bosgani hisobga
  // olinmaydi). Fire-and-forget, hech qachon UI'ni bloklamaydi.
  const track = (type, ref) => {
    if (!isOwner && record && record.code) dbLogEvent(record.code, type, ref);
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
          <button onClick={() => navigate('/aloqa')} className="mt-5 cursor-pointer rounded-full bg-[color:var(--vz-pill)] px-[18px] py-2.5 text-[16px] font-bold text-white transition hover:brightness-125">{t('Aloqa')}</button>
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
            ? <button onClick={() => navigate('/')} className="mt-5 cursor-pointer rounded-full bg-[color:var(--vz-pill)] px-[18px] py-2.5 text-[16px] font-bold text-white transition hover:brightness-125">{t('Bosh sahifada band qilish')}</button>
            : <p className="text-[16px]">{t("Format noto'g'ri: ABZ007 yoki faqat harflardan iborat so'z bo'lishi kerak.")}</p>}
        </div>
      </div>
    );
  }

  const isOwner = !!(user && myCards.some((c) => c.code === record.code));
  const tgUrl = socialUrl('tg', record.tg);
  const igUrl = socialUrl('ig', record.instagram);
  const hasLocation = (record.latitude != null && record.longitude != null) || !!record.address;
  // Yo'nalish havolasi — qurilmaga mos xarita ilovasida (iPhone'da
  // Apple Maps, qolganlarida Google Maps). Avval hamma joyda Google
  // Maps'ning QIDIRUV havolasi edi: nuqtani ko'rsatardi, lekin yo'nalish
  // bermasdi. Yandex alohida tugma — O'zbekistonda ko'p ishlatiladi.
  const mapsUrl = directionsUrl(record);
  const yandexUrl = yandexDirectionsUrl(record);
  const fbUrl = socialUrl('fb', record.facebook);
  const xUrl = socialUrl('x', record.twitter);
  const liUrl = record.linkedin ? socialUrl('li', record.linkedin) : '';
  const wsUrl = record.website || '';

  // Business profil shaxsiy NFC vizitkasining nusxasi emas. Katalog,
  // galereya, lokatsiya va aloqa uchun maxsus professional public layout.
  if (record.profileType === 'business') {
    return (
      <BusinessPublicProfile
        record={record}
        menu={menu}
        products={products}
        services={services}
        gallery={gallery}
        team={team}
        initialTab={initialTab}
        isOwner={isOwner}
        t={t}
      />
    );
  }
  // hasSocials endi ishlatilmaydi — shaxsiy ijtimoiy tarmoq havolalari
  // faqat yuqoridagi to'liq nomli tugmalarda ko'rsatiladi (takrorlanmaydi).
  // Admin sovg'a qilgan NFC ID — kod tekin daraja bo'lsa ham karta rangi
  // (va tarif belgisi) EKSLYUZIV bo'ladi.
  const tier = record.isGift ? 'exclusive' : (record.tierOverride || tierForCode(record.code));
  const tierColor = TIER_COLOR[tier];
  const tierEmoji = TIER_EMOJI[tier];
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

  const linkStyleName = ['standard', 'transparent', 'glass'].includes(record.linkStyle)
    ? record.linkStyle
    : (record.linksTransparent ? 'glass' : 'standard');
  const linkStyleCls = linkStyleName === 'glass' ? ' vz-link--glass' : linkStyleName === 'transparent' ? ' vz-link--transparent' : '';
  // 2026-09: `text-center` + `min-h-[52px]` qo'shildi — yorliq ikki qatorga
  // o'tganda ham matn tugma ichida gorizontal VA vertikal markazda qoladi,
  // barcha aloqa tugmalari bir xil tekislikda turadi (touch maydoni >=44px).
  const linkBtn = `vz-link${linkStyleCls} flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-transparent bg-[color:var(--vz-pill)] px-4 py-3.5 text-center text-[16px] font-bold uppercase tracking-wide text-white no-underline transition-all duration-150 hover:-translate-y-0.5 hover:border-white/25 hover:brightness-125`;

  // QAYSI BO'LIMLAR BOR — shu tartibda. `activeTab` tanlanganini emas,
  // MAVJUDINI qaytaradi: ma'lumot keyinroq kelganda yoki bo'lim bo'shab
  // qolganda sahifa bo'sh ko'rinib qolmasin.
  const availableTabs = [
    posts.length > 0 && 'postlar',
    stories.length > 0 && 'lenta',
    menu.length > 0 && menuEligible(record.profileType, record.categorySlug) && 'menyu',
    products.length > 0 && productEligible(record.profileType, record.categorySlug) && 'mahsulotlar',
    services.length > 0 && serviceEligible(record.profileType, record.categorySlug) && 'xizmatlar',
    'vizitka',
  ].filter(Boolean);
  const activeTab = availableTabs.includes(tab) ? tab : availableTabs[0];

  // ── ALOQA — biznes profildagi bilan AYNAN BIR XIL dumaloq ikonkalar
  //    qatori (egasining talabi: "jismoniy va kompaniyanikini bir xil
  //    qil"). Ilgari bu yerda ustma-ust yotgan, butun kenglikdagi
  //    tugmalar ro'yxati bor edi va u ekranni yeb, qolgan hamma
  //    narsani pastga surib yuborardi.
  const quick = [
    record.phone && (!record.hidePhone || isOwner) && {
      k: 'phone', href: `tel:${record.phone}`, label: t('Qo‘ng‘iroq'), color: '#4ddb8f',
      icon: <IconPhone width={26} height={26} aria-hidden="true" />, ev: 'phone_click',
    },
    tgUrl && { k: 'telegram', href: tgUrl, label: 'Telegram', color: '#2aabee', icon: <IconTelegram width={26} height={26} aria-hidden="true" />, ev: 'telegram_click' },
    igUrl && { k: 'instagram', href: igUrl, label: 'Instagram', color: '#e1306c', icon: <IconInstagram width={26} height={26} aria-hidden="true" />, ev: 'instagram_click' },
    fbUrl && { k: 'facebook', href: fbUrl, label: 'Facebook', color: '#1877f2', icon: <IconFacebook width={26} height={26} aria-hidden="true" /> },
    xUrl && { k: 'x', href: xUrl, label: 'X', color: '#e7e2d8', icon: <IconX width={26} height={26} aria-hidden="true" /> },
    liUrl && { k: 'linkedin', href: liUrl, label: 'LinkedIn', color: '#0a66c2', icon: <IconLinkedIn width={26} height={26} aria-hidden="true" /> },
    record.email && { k: 'email', href: `mailto:${record.email}`, label: t('Pochta'), color: '#e6c169', icon: <IconMail width={26} height={26} aria-hidden="true" />, ev: 'email_click' },
    hasLocation && mapsUrl && { k: 'directions', href: mapsUrl, label: t('Manzil'), color: '#ff7a59', icon: <IconGlobe width={26} height={26} aria-hidden="true" /> },
    hasLocation && yandexUrl && { k: 'yandex', href: yandexUrl, label: 'Yandex', color: '#ff3f40', icon: <IconGlobe width={26} height={26} aria-hidden="true" /> },
    // KARTA RAQAMI — ro'yxatda YASHIRIN turadi: bosilganda QR kod bilan
    // oyna ochiladi. Ochiq tursa u tasodifan ekranga tushardi.
    record.cardNumber && {
      k: 'card', label: t('Karta'), color: '#f0cf7b', icon: <IconTag width={26} height={26} aria-hidden="true" />,
      onClick: () => { track('link_click', 'card_number'); setCardModal({ number: record.cardNumber, label: '' }); },
    },
    ...(record.cardNumbers || []).filter((c) => c && c.number).map((c, i) => ({
      k: `cn${i}`, label: c.label || t('Karta'), color: '#f0cf7b', icon: <IconTag width={26} height={26} aria-hidden="true" />,
      onClick: () => { track('link_click', 'card_number'); setCardModal({ number: c.number, label: c.label || '' }); },
    })),
    ...(record.extraLinks || []).filter((l) => l && l.url).map((l, i) => ({
      k: `x${i}`, href: l.url, label: l.label || t('Havola'), color: '#cfc6b4', icon: <IconLink width={26} height={26} aria-hidden="true" />,
    })),
    record.leadCapture && !isOwner && {
      k: 'lead', label: t('Kontakt'), color: '#9bd1ff', icon: <IconMail width={26} height={26} aria-hidden="true" />,
      onClick: () => setLeadOpen(true),
    },
    !isOwner && MESSAGING_ENABLED && {
      k: 'chat', label: t('Xabar'), color: '#a5b4fc', icon: <IconChat width={26} height={26} aria-hidden="true" />, onClick: startChat,
    },
  ].filter(Boolean);

  const profileUrl = `${window.location.origin}/${record.code.toLowerCase()}`;
  const videoBg = hasBg && isVideoBg(record.bgUrl);

  return (
    // BITTA EKRANLIK QOBIQ — biznes profilidagi bilan bir xil
    // (`.qp-*`). Balandligi aynan telefon ekrani va o'zi SCROLL
    // BO'LMAYDI: faqat o'rtadagi kontent qismi suriladi.
    <main
      className="qp-page"
      style={{
        ...outerPageStyle(record.theme || 'classic', record, tier),
        '--cq-cover': hasBg && !videoBg ? `url("${record.bgUrl}")` : 'none',
      }}
    >
      <div className="qp-shell">
        {/* Video fon — CSS `background-image` bilan chizilmaydi. */}
        {videoBg && <ProfileBgVideo src={record.bgUrl} />}

        <header className="qp-top">
          <span className="qp-brand"><i><img src={logo} alt="" /></i> NFCSTORE</span>
          {/* ID — KATTA va TARIF RANGIDA. "nfcstore.uz/" prefiksi olib
              tashlandi: u har bir profilda bir xil va faqat joy
              egallardi; odam eslab qoladigan narsa — ID ning o'zi. */}
          <span className="qp-idbig" style={{ '--tier': tierColor }} title={t('{tier} tarif', { tier: t(TIER_LABEL[tier] || tier) })}>
            {record.code}
          </span>
          {isOwner
            ? <button type="button" className="qp-top-link" onClick={() => navigate('/account')}>✎ {t('Tahrirlash')}</button>
            : <button type="button" className="qp-top-link" onClick={() => copyText(profileUrl, t('Havola nusxalandi!'))} title={t('Nusxalash')}>⧉</button>}
        </header>

        <section className="qp-hero">
          <div className="qp-hero-row">
            <StoryRing stories={stories} title={record.name} avatarUrl={record.avatarUrl}>
              <div className="qp-avatar qp-avatar--round">
                {record.avatarUrl ? <img src={record.avatarUrl} alt={record.name} /> : initials(record.name)}
              </div>
            </StoryRing>
            <div className="qp-hero-text">
              <h1 className="break-words">
                {record.name}
                {record.verified && <i className="qp-verified" title={t('Tasdiqlangan profil')} aria-label={t('Tasdiqlangan profil')}>✓</i>}
              </h1>
              {(record.role || record.company?.displayName) && (
                <p className="qp-cat break-words">
                  {[record.role, record.company?.displayName].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="qp-sub break-words">
                {tierEmoji && <span>{tierEmoji} </span>}
                {t(TIER_LABEL[tier] || tier)}
                {record.city ? ` · ${record.city}` : ''}
                {topRank ? ` · TOP #${topRank}` : ''}
              </p>
            </div>
          </div>

          {/* RAQAMLAR — biznes profildagi bilan bir xil qator. Har biri
              bosiladi: obunachilar, obunalar va yoqtirganlar ro'yxati. */}
          <div className="cq-metrics">
            <div className="cq-metric"><b>{fmt(record.views || 0)}</b><small>{t('ko‘rildi')}</small></div>
            <button type="button" className="cq-metric" onClick={() => setFollowListDir('followers')}>
              <b>{fmt(followStats?.followers || 0)}</b><small>{t('obunachi')}</small>
            </button>
            <button type="button" className="cq-metric" onClick={() => setFollowListDir('likes')}>
              <b>{fmt(likeInfo?.count || 0)}</b><small>{t('yoqtirish')}</small>
            </button>
            <div className="cq-metric-actions">
              {!isOwner && (
                <>
                  <button
                    type="button"
                    className={`cq-follow ${followStats?.isFollowing ? 'is-on' : ''}`}
                    onClick={toggleFollow}
                    disabled={followBusy}
                  >
                    {followBusy ? '…' : followStats?.isFollowing ? t('Obuna bo‘lingan') : t('Obuna bo‘lish')}
                  </button>
                  {/* Yurak — bosish/bekor qilish. Soni yuqoridagi
                      raqamlar qatorida va u ro'yxatni ochadi. */}
                  <button
                    type="button"
                    className={`qp-like ${likeInfo?.liked ? 'is-on' : ''}`}
                    onClick={toggleLike}
                    aria-label={t('Yoqtirish')}
                  >
                    {likeInfo?.liked ? '❤️' : '\u{1F90D}'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* KIM NOMIDAN — faqat o'z FAOL kompaniyasi bor odamga
              ko'rinadi. Obunadan keyin ham almashtirish mumkin: yangi
              obuna yaratilmaydi, faqat ko'rinadigan yuz o'zgaradi. */}
          {!isOwner && myCompanies.length > 0 && (
            <label className="qp-asrow">
              <span>{t('Kim nomidan')}:</span>
              <select
                value={followAs}
                disabled={followBusy}
                onChange={async (e) => {
                  const next = e.target.value;
                  setFollowAs(next);
                  rememberFollowAs(next);
                  if (!followStats?.isFollowing) return;
                  setFollowBusy(true);
                  try {
                    await dbFollow(code, next);
                    setFollowStats(await dbFollowStats(code));
                  } catch { /* jim tur */ } finally { setFollowBusy(false); }
                }}
              >
                <option value="">{t('Shaxsiy profilim')}</option>
                {myCompanies.map((c) => <option key={c.companyId} value={c.companyId}>{c.displayName}</option>)}
              </select>
            </label>
          )}
          {followMsg && <div className="qp-warn">{t(followMsg)}</div>}

          {quick.length > 0 && (
            <div className="qp-quick">
              {quick.map((q) => (q.href
                ? (
                  <a
                    key={q.k} className="qp-quick-btn vz-tap" href={q.href}
                    target={q.k === 'phone' || q.k === 'email' ? undefined : '_blank'} rel="noreferrer"
                    onClick={() => track(q.ev || 'link_click', q.ev ? undefined : q.k)}
                  >
                    <i style={{ color: q.color }}>{q.icon}</i><span>{q.label}</span>
                  </a>
                ) : (
                  <button key={q.k} type="button" className="qp-quick-btn vz-tap" onClick={q.onClick}>
                    <i style={{ color: q.color }}>{q.icon}</i><span>{q.label}</span>
                  </button>
                )
              ))}
              {/* ULASHISH — qolgan havolalar bilan BIR QATORDA. */}
              <ShareButton
                url={profileUrl}
                title={record.name || 'NFCSTORE'}
                text={t('Mening raqamli tashrif qog‘ozim')}
                label={t('Ulashish')}
                className="qp-quick-btn qp-quick-share vz-tap"
              />
            </div>
          )}
        </section>

        {/* BO'LIMLAR — biznes profildagi bilan bir xil qator. */}
        <ProfileTabs
          value={activeTab}
          onChange={setTab}
          tabs={[
            posts.length > 0 && { id: 'postlar', label: 'Post', count: posts.length },
            stories.length > 0 && { id: 'lenta', label: 'Stories', count: stories.length },
            menu.length > 0 && menuEligible(record.profileType, record.categorySlug) && { id: 'menyu', label: 'Menyu' },
            products.length > 0 && productEligible(record.profileType, record.categorySlug) && { id: 'mahsulotlar', label: 'Mahsulotlar' },
            services.length > 0 && serviceEligible(record.profileType, record.categorySlug) && { id: 'xizmatlar', label: 'Xizmatlar' },
            { id: 'vizitka', label: 'Ma’lumot' },
          ]}
        />

        {/* YAGONA SURILADIGAN QISM. */}
        <div className="qp-body">
          {activeTab === 'postlar' && <PostsFeed posts={posts} onLike={togglePostLike} t={t} />}
          {activeTab === 'lenta' && <StoryGrid stories={stories} title={record.name} avatarUrl={record.avatarUrl} />}
          {activeTab === 'menyu' && <MenuView menu={menu} t={t} />}
          {activeTab === 'mahsulotlar' && <ProductsView products={products} t={t} />}
          {activeTab === 'xizmatlar' && <ServicesView services={services} t={t} />}

          {activeTab === 'vizitka' && (
            <>
              {record.about && <p className="qp-desc break-words">{record.about}</p>}
              {record.hashtags && record.hashtags.length > 0 && (
                <div className="qp-tags">{record.hashtags.map((h) => <span key={h}>#{h}</span>)}</div>
              )}
              {record.address && <p className="qp-addr break-words">◎ {record.address}</p>}

              {/* BIRIKTIRILGAN KOMPANIYA — Telegramdagi "kanal" bloki kabi. */}
              {record.company && (
                <button type="button" className="qp-company vz-tap" onClick={() => navigate(`/c/${record.company.companyId.toLowerCase()}`)}>
                  <span className="qp-company-logo">
                    {record.company.logoUrl
                      ? <img src={record.company.logoUrl} alt="" />
                      : (record.company.displayName || 'N').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="qp-company-text">
                    <b className="break-words">{record.company.displayName}</b>
                    <small className="break-words">
                      {[record.company.subtitle, record.company.city].filter(Boolean).join(' · ')
                        || `nfcstore.uz/c/${record.company.companyId.toLowerCase()}`}
                    </small>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              )}

              {/* NFC KARTANING O'ZI — aylantirib ikki tomonini ko'rish
                  mumkin. U endi birinchi ekranni band qilmaydi. */}
              <div className="qp-cardwrap">
                <FlipNfcCard finish={design.finish && design.finish !== 'auto' ? design.finish : ('tier-' + tier)} t={t}>
                  <NfcCard
                    hideBrand
                    code={record.code}
                    name={design.name || record.name}
                    since={record.ts}
                    finish={design.finish && design.finish !== 'auto' ? design.finish : ('tier-' + tier)}
                    bgImage={design.bgUrl || ''}
                    namePos={Number.isFinite(design.nameX) && Number.isFinite(design.nameY) ? { x: design.nameX, y: design.nameY } : null}
                    nameScale={Number.isFinite(design.nameScale) ? design.nameScale : 1}
                    nameColor={design.nameColor || ''}
                    codePos={Number.isFinite(design.codeX) && Number.isFinite(design.codeY) ? { x: design.codeX, y: design.codeY } : null}
                    codeScale={Number.isFinite(design.codeScale) ? design.codeScale : 1}
                    brandPos={Number.isFinite(design.brandX) && Number.isFinite(design.brandY) ? { x: design.brandX, y: design.brandY } : null}
                    brandScale={Number.isFinite(design.brandScale) ? design.brandScale : 1}
                    brandColor={design.brandColor || ''}
                    size="md"
                  />
                </FlipNfcCard>
              </div>

              <ProfileTeam team={team} t={t} />
              <ProfileGallery gallery={gallery} t={t} />

              {files.length > 0 && (
                <div className="qp-files">
                  <div className="qp-section-title">{t('Fayllar')}</div>
                  {files.map((f) => (
                    <a key={f.id} href={f.fileUrl} target="_blank" rel="noreferrer" download
                      onClick={() => track('link_click', 'file')} className="qp-file">
                      <span aria-hidden="true">📄</span>
                      <span className="qp-file-name">{f.title}</span>
                      {f.sizeBytes != null && <small>{Math.round(f.sizeBytes / 1024)} KB</small>}
                    </a>
                  ))}
                </div>
              )}

              {/* Musiqa — sahifaning o'ng-pastki burchagida suzib turadi
                  (portal orqali), shuning uchun bu yerda joy egallamaydi. */}
              <MusicPlayer
                urls={Array.isArray(record.musicUrls) && record.musicUrls.length ? record.musicUrls : (record.musicUrl ? [record.musicUrl] : [])}
                accentColor={record.accentColor}
                onOpenChange={setMusicOpen}
                ownerName={record.name || ''}
                coverUrl={record.avatarUrl || ''}
              />

              {/* O'Z NFC ID RAQAMI — profilning doimiy manzili. */}
              <div className="pf-nfcid">
                <i aria-hidden="true">◉</i>
                <div style={{ textAlign: 'center' }}>
                  <b>{record.code}</b>
                  <small>NFC ID · nfcstore.uz/{record.code.toLowerCase()}</small>
                </div>
              </div>

              {/* Egaga: boshqa raqamli tashrif qog'ozlari. */}
              {otherCodes.length > 0 && (
                <select
                  className="qp-othercodes"
                  value=""
                  onChange={(e) => { if (e.target.value) navigate('/' + e.target.value); }}
                  aria-label={t("Boshqa raqamli tashrif qog'ozlaringiz")}
                >
                  <option value="">{t("Boshqa raqamli tashrif qog'ozlaringiz")} ({otherCodes.length})</option>
                  {otherCodes.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              )}

              {/* NFCSTORE'ning rasmiy kanallari — har bir profilda bir xil. */}
              <div className="qp-official">
                <a href="https://t.me/nfcstoreuz" target="_blank" rel="noreferrer" title="NFCSTORE Telegram"><IconTelegram /></a>
                <a href="https://www.instagram.com/nfcstore.uz" target="_blank" rel="noreferrer" title="NFCSTORE Instagram"><IconInstagram /></a>
                <a href="https://t.me/nfcstore_admin" target="_blank" rel="noreferrer" title={t("Qo'llab-quvvatlash")}><IconSupport /></a>
              </div>
              <p className="qp-foot"><span>{t('NFC orqali ochildi')}</span><b>NFCSTORE</b></p>
            </>
          )}
        </div>

        {/* KONTAKTNI SAQLASH — doim ko'rinib turadigan pastki qator. */}
        <div className="qp-bottom">
          <button type="button" className="qp-save vz-tap" onClick={() => { track('contact_save'); downloadVcf(record); }}>
            {t('Kontaktni saqlash')}
          </button>
        </div>
      </div>

      {toast && <div className="qp-toast">{toast}</div>}

      {followListDir && record && (
        <FollowListModal code={record.code} dir={followListDir} onClose={() => setFollowListDir(null)} t={t} />
      )}

      {cardModal && (
        <CardNumberModal
          cardNumber={cardModal.number}
          holder={cardModal.label || (record ? record.name : '')}
          onClose={() => setCardModal(null)}
        />
      )}

      {leadOpen && record && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setLeadOpen(false)}>
          <div className="flex max-h-[90vh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-3xl bg-[color:var(--vz-bg-a,#15171b)] p-1 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 justify-end px-3 pt-2">
              <CloseButton onClick={() => setLeadOpen(false)} />
            </div>
            <div className="overflow-y-auto px-4 pb-5">
              <LeadForm code={record.code} linkBtn={linkBtn} onDone={() => setTimeout(() => setLeadOpen(false), 1400)} />
            </div>
          </div>
        </div>
      )}
    </main>
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
            <p className="text-[16.5px]">{t("Konvert ichidagi bir martalik aktivatsiya kodini kiritib, o'z profilingizni to‘ldiring.")}</p>
            <button onClick={() => setStep('code')} className="mt-6 cursor-pointer rounded-full bg-[color:var(--vz-pill)] px-7 py-3 text-[16.5px] font-bold text-white transition hover:brightness-125">
              {t("Sovg'ani faollashtirish")}
            </button>
          </div>
        )}

        {step === 'code' && (
          <div>
            <h2 className="font-display mb-2 text-xl font-bold text-[color:var(--vz-ink)]">{t('Aktivatsiya kodi')}</h2>
            <p className="mb-4 text-[16px]">{t('Konvertdagi kartochkada yozilgan kodni kiriting (masalan: NFC-X7K9-P2LM).')}</p>
            <input
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
              placeholder="NFC-XXXX-XXXX"
              className="w-full rounded-xl border border-[color:var(--vz-line)] bg-transparent px-4 py-3 text-center font-mono text-lg tracking-wider text-[color:var(--vz-ink)] outline-none"
            />
            {err && <p className="mt-2 text-center text-[16px] text-red-400">{t(err)}</p>}
            <button onClick={verifyCode} disabled={busy} className="mt-4 w-full cursor-pointer rounded-full bg-[color:var(--vz-pill)] py-3 text-[16.5px] font-bold text-white transition hover:brightness-125 disabled:opacity-50">
              {busy ? '...' : t('Tasdiqlash')}
            </button>
          </div>
        )}

        {step === 'form' && (
          <div>
            <div className="mb-4 rounded-xl bg-green-500/10 px-4 py-3 text-center text-[16px] text-green-400">
              {t('NFC ID #{code} muvaffaqiyatli tasdiqlandi! Endi profilingizni to‘ldiring.', { code })}
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
            {err && <p className="mt-2 text-center text-[16px] text-red-400">{t(err)}</p>}
            <button onClick={submit} disabled={busy} className="mt-4 w-full cursor-pointer rounded-full bg-[color:var(--vz-pill)] py-3 text-[16.5px] font-bold text-white transition hover:brightness-125 disabled:opacity-50">
              {busy ? '...' : t('Profil ochish')}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center">
            <div className="text-5xl">{'\u2705'}</div>
            <h2 className="font-display mt-3 text-xl font-bold text-[color:var(--vz-ink)]">{t('Tayyor! Profilingiz ochildi.')}</h2>
            <p className="mt-2 text-[16px]">{t("Hozir yo'naltirilasiz...")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
