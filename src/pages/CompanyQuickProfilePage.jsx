import { useCallback, useEffect, useMemo, useState } from 'react';
import { directionsUrl, hasCoords } from '../lib/mapLink.js';
import { isPreviewVisit } from '../lib/preview.js';
import CompanyMusicPlayer from '../components/CompanyMusicPlayer.jsx';
import CompanyHours from '../components/CompanyHours.jsx';
import CompanyOrderModal from '../components/CompanyOrderModal.jsx';
import CardNumberModal from '../components/CardNumberModal.jsx';
import MapAppSheet from '../components/MapAppSheet.jsx';
import AddToHomeSheet from '../components/AddToHomeSheet.jsx';
import { downloadVcard } from '../lib/vcard.js';
import StoryRing from '../components/StoryRing.jsx';
import StoryGrid from '../components/StoryGrid.jsx';
import { useAuth } from '../lib/auth.jsx';
import { toggleCompanyFollow } from '../lib/company.js';
import { listCompanyPosts, listCompanyStories } from '../lib/company.js';
import { socialUrl } from '../lib/socialLinks.js';
import { companyCta, companyEvent, companyTier, getCompany } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import { TIER_COLOR, TIER_LABEL } from '../lib/pricing.js';
import ProfileManifest from '../components/ProfileManifest.jsx';
import {
  IconPhone, IconTelegram, IconGlobe, IconWhatsApp, IconInstagram, IconFacebook, IconLink,
  IconNote, IconPin, IconBankCard, IconExpand, IconCollapse,
} from '../components/Icons.jsx';
import logo from '../assets/logo-128.png';
import ProfileActionCluster from '../components/ProfileActionCluster.jsx';
import ProfileQrModal from '../components/ProfileQrModal.jsx';
import '../company-system.css';

const fallbackCover = '/business-assets/construction-hero.jpg';

function contactUrl(kind, value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (kind === 'phone') return `tel:${clean.replace(/[^+\d]/g, '')}`;
  if (kind === 'telegram') return socialUrl('tg', clean);
  if (kind === 'whatsapp') return clean.startsWith('http') ? clean : `https://wa.me/${clean.replace(/\D/g, '')}`;
  return clean.startsWith('http') ? clean : `https://${clean}`;
}

// Tarmoq xatosi (fetch yiqildi) — "topilmadi"dan farqli: qayta urinish taklif qilinadi.
function isNetworkError(err) {
  return err instanceof TypeError || /failed to fetch|network/i.test(String(err && err.message));
}

export default function CompanyQuickProfilePage({ companyId }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [company, setCompany] = useState(undefined);
  const [error, setError] = useState(null);
  const [orderItem, setOrderItem] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [stories, setStories] = useState([]);
  // Faol bo'lim. Boshlang'ich qiymat quyida — qaysi bo'limlar BOR
  // ekanini bilgandan keyin tanlanadi (bo'sh bo'limga tushib
  // qolmasligi uchun).
  const [tab, setTab] = useState('');
  const [posts, setPosts] = useState([]);
  // Musiqa pleeri — avatar yonidagi belgi bilan ochiladi/yopiladi.
  const [musicOpen, setMusicOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  // Xarita bosilgandagina yuklanadi (izohi pastda).
  const [mapOpen, setMapOpen] = useState(false);
  // Xarita ilovasini tanlash oynasi (Yandex Navigator / Google / …).
  const [mapPick, setMapPick] = useState(false);
  // TO'LIQ EKRAN — brauzerning manzil qatori va pastki tugmalarini
  // yashiradi. Egasining talabi: "NFC kartani urganda telefon ekranini
  // to'liq egallab chiqsin".
  //
  // Sayt buni O'ZICHA qila olmaydi — bu brauzerning xavfsizlik qoidasi
  // (aks holda istalgan sahifa butun ekranni egallab, tizim oynasiga
  // o'xshab qolardi). Faqat ODAMNING bosishi bilan mumkin, shuning
  // uchun tugma kerak.
  const [isFs, setIsFs] = useState(false);
  const [fsOk, setFsOk] = useState(false);
  // To'liq ekran rejimi qo'llab-quvvatlanmasa — "bosh ekranga qo'shish"
  // yo'riqnomasi (iPhone'dagi yagona yo'l).
  const [fsHelp, setFsHelp] = useState(false);
  useEffect(() => {
    // Tugma FAQAT bitta holatda chizilmaydi: sahifa allaqachon ilova
    // sifatida ochilgan bo'lsa — brauzer qatori o'sha yerda yo'q.
    //
    // Ilgari u "to'liq ekran qo'llab-quvvatlanmasa" ham yashirilardi.
    // Natijada egasi shuni ko'rdi: kompyuterda tugma bor, TELEFONDA
    // yo'q — ya'ni eng kerak bo'lgan joyda yo'q edi. Sababi: iOS'dagi
    // HAMMA brauzer (Safari, Chrome, Yandex — hammasi ichkarida bir xil
    // WebKit) sahifa uchun to'liq ekranni umuman bermaydi.
    //
    // Endi tugma doim turadi, faqat bosilganda nima bo'lishi qurilmaga
    // qarab farq qiladi (pastdagi `toggleFs`).
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    setFsOk(!standalone);
    const sync = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggleFs = () => {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    // `requestFullscreen` iOS'da UMUMAN yo'q; ba'zi brauzerlarda bor,
    // lekin ruxsat bermaydi (va'da rad etiladi). Ikkala holatda ham
    // odam bo'sh qolmasligi uchun yo'riqnomani ochamiz.
    if (!req || !document.fullscreenEnabled) { setFsHelp(true); return; }
    try {
      Promise.resolve(req.call(el)).catch(() => setFsHelp(true));
    } catch { setFsHelp(true); }
  };

  const load = useCallback(() => {
    let live = true;
    setCompany(undefined);
    setError(null);
    getCompany(companyId)
      .then((data) => live && setCompany(data.company))
      .catch((err) => {
        if (!live) return;
        if (isNetworkError(err)) setError(err);
        setCompany(null);
      });
    return () => { live = false; };
  }, [companyId]);

  useEffect(() => load(), [load]);

  // Istorya — dumaloq logo atrofidagi halqa. Alohida so'rov: asosiy
  // ma'lumot bilan birga kelmaydi, chunki u 24 soatda o'zgaradi va
  // profil javobi keshlanadi.
  useEffect(() => {
    if (!company?.companyId) return undefined;
    let live = true;
    listCompanyStories(company.companyId)
      .then((d) => live && setStories(d.stories || []))
      .catch(() => live && setStories([]));
    // POSTLAR — avval faqat to'liq kompaniya sahifasida chiqardi,
    // shuning uchun egasi post qo'yib, NFC profilida hech narsa
    // ko'rmasdi. Endi bu yerda ham bor.
    listCompanyPosts(company.companyId)
      .then((d) => live && setPosts(d.posts || []))
      .catch(() => live && setPosts([]));
    return () => { live = false; };
  }, [company?.companyId]);

  // NFC tegish — egasi uchun eng muhim raqam. Ma'lumot kelgach bir
  // marta sanaladi (yiqilgan so'rov statistikani shishirmasin).
  useEffect(() => {
    // "?preview=1" — admin ko'rib chiqyapti, sanalmaydi
    // (izohi src/lib/preview.js da).
    if (company?.companyId && !isPreviewVisit()) companyEvent(company.companyId, 'view');
  }, [company?.companyId]);

  // Obuna — kirmagan odam avval tizimga kiradi va SHU sahifaga qaytadi.
  const follow = async () => {
    if (followBusy || !company) return;
    if (!user) { navigate(`/login?next=${encodeURIComponent(`/c/${company.companyId.toLowerCase()}`)}`); return; }
    setFollowBusy(true);
    try {
      const res = await toggleCompanyFollow(company.companyId);
      setCompany((c) => ({ ...c, followers: res.followers, following: res.following }));
    } catch { /* jim tur */ } finally { setFollowBusy(false); }
  };

  const cta = companyCta(company?.category);
  const items = useMemo(() => (company?.catalog || []).filter((item) => item.available !== false), [company]);
  // Qaysi bo'limlar BOR — shu tartibda: Post, Stories, Katalog, Ma'lumot.
  // `activeTab` tanlanganini emas, MAVJUDINI qaytaradi: ma'lumot
  // keyinroq kelganda yoki bo'lim bo'shab qolganda sahifa bo'sh
  // ko'rinib qolmasin.
  const availableTabs = [
    items.length > 0 && 'katalog',
    posts.length > 0 && 'post',
    stories.length > 0 && 'lenta',
    'haqida',
  ].filter(Boolean);
  const activeTab = availableTabs.includes(tab) ? tab : (availableTabs[0] || '');
  // Halqa "yangi kontent bor" degani. Istorya baribir 24 soatlik,
  // POST esa doimiy — shuning uchun post uchun yoshini alohida
  // tekshiramiz, aks holda halqa bir marta yoqilib, mangu yonib
  // turardi.
  const hasFreshPost = posts.some((p) => p.createdAt && (Date.now() - Date.parse(p.createdAt)) < 24 * 3600_000);

  if (company === undefined) {
    return (
      <main className="qp-page" aria-busy="true" style={{ '--cq-cover': 'none' }}>
        <div className="qp-shell">
          <section className="qp-hero">
            <div className="qp-hero-row">
              <div className="vz-skel" style={{ width: 64, height: 64, borderRadius: 20, flex: 'none' }} />
              <div style={{ flex: 1 }}>
                <div className="vz-skel" style={{ width: '70%', height: 20 }} />
                <div className="vz-skel mt-2" style={{ width: '45%', height: 12 }} />
              </div>
            </div>
            <div className="vz-skel mt-3" style={{ height: 46 }} />
            <div className="vz-skel mt-3" style={{ height: 58 }} />
          </section>
          <span className="sr-only">{t('Yuklanmoqda…')}</span>
        </div>
      </main>
    );
  }

  if (!company) {
    return (
      <main className="cq-state">
        <div className="cq-mark"><img src={logo} alt="NFCSTORE" /></div>
        <h1 className="vz-h1" style={{ fontSize: 'clamp(26px,5vw,36px)' }}>{error ? t("Server bilan aloqa yo'q") : t('Kompaniya topilmadi')}</h1>
        <p className="vz-lead mx-auto">{error
          ? t("Ma'lumotni yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.")
          : t('Company ID faol emas yoki admin tomonidan hali tasdiqlanmagan.')}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {error && <button type="button" className="btn btn-gold" onClick={load}>{t('Qayta urinish')}</button>}
          <button type="button" className={error ? 'btn btn-ghost-vz' : 'btn btn-gold'} onClick={() => navigate('/kompaniyalar')}>{t('Kompaniyalarni ko‘rish')}</button>
        </div>
      </main>
    );
  }

  // `company.latitude && ...` EMAS: 0 — bu haqiqiy koordinata, lekin
  // JS uchun "yolg'on". hasCoords() aynan shuni to'g'ri tekshiradi.
  const geo = hasCoords(company.latitude, company.longitude);
  const mapUrl = geo
    ? directionsUrl(company)
    : company.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}` : '';
  const extraLinks = (company.extraLinks || []).filter((l) => l && l.label && l.url);

  // ── TARIF VA HAVOLALAR ──────────────────────────────────────────────
  const isOwner = user && String(user.id) === String(company.ownerUserId);
  const tier = companyTier(company.companyId);
  const tierColor = TIER_COLOR[tier] || TIER_COLOR.free;
  const shareUrl = `${window.location.origin}/c/${company.companyId.toLowerCase()}`;
  const workspaceUrl = `/workspace/${company.companyId.toLowerCase()}`;
  // Nusxalash RAD ETILISHI mumkin (ruxsatsiz brauzer, HTTPS bo'lmagan
  // muhit) — va'da qaytaradi, shuning uchun natija ROST aytiladi.
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* brauzer rad etdi — ulashish tugmasi baribir ishlaydi */ }
  };

  // ── ALOQA — oltin dumaloq tugmalar, ikonka O'Z FIRMA RANGIDA ────────
  // Egasining talabi: "ikonka Telegram va boshqalar o'zini rangida
  // bo'lsin". Shuning uchun katakcha oltin, ichidagi belgi esa
  // tarmoqning o'z rangida — ko'z Telegramni qidirmaydi, darrov topadi.
  const quick = [
    company.phone && { k: 'phone', href: contactUrl('phone', company.phone), label: t('Qo‘ng‘iroq'), color: '#0e7a3d', icon: <IconPhone width={26} height={26} aria-hidden="true" /> },
    // KARTA RAQAMI — QO'NG'IROQDAN KEYIN, IKKINCHI O'RINDA (egasining
    // savoli: "buni kim pul tashlayman desa"). Ilgari u ro'yxatning
    // oxirida edi va telefon ekranida UMUMAN KO'RINMASDI — odam uni
    // topish uchun qatorni surishi kerak edi. Endi surmasdan ko'rinadi.
    //
    // Nega birinchi emas: qo'ng'iroq — biznes kartadan kutiladigan eng
    // oddiy harakat, pul o'tkazish esa undan keyin keladi.
    //
    // Raqamning O'ZI ro'yxatda YASHIRIN: bosilganda QR bilan oyna
    // ochiladi. Ochiq tursa u tasodifan ekranga tushadi (skrinshot,
    // video, yonidagi odam).
    company.cardNumber && { k: 'card', label: t('Karta'), color: '#3d2e08', icon: <IconBankCard width={25} height={25} aria-hidden="true" />, onClick: () => setShowCard(true) },
    company.telegram && { k: 'telegram', href: contactUrl('telegram', company.telegram), label: 'Telegram', color: '#0f7ab0', icon: <IconTelegram width={26} height={26} aria-hidden="true" /> },
    company.whatsapp && { k: 'whatsapp', href: contactUrl('whatsapp', company.whatsapp), label: 'WhatsApp', color: '#0b8a3c', icon: <IconWhatsApp width={26} height={26} aria-hidden="true" /> },
    company.instagram && { k: 'instagram', href: socialUrl('ig', company.instagram), label: 'Instagram', color: '#b3175a', icon: <IconInstagram width={26} height={26} aria-hidden="true" /> },
    company.facebook && { k: 'facebook', href: socialUrl('fb', company.facebook), label: 'Facebook', color: '#0d4fa8', icon: <IconFacebook width={26} height={26} aria-hidden="true" /> },
    // MANZIL — bosilganda XARITA ILOVASINI TANLASH oynasi ochiladi
    // (Yandex Navigator, Yandex Xarita, Google Maps, iPhone'da Apple
    // Xarita). Ilgari bu yerda ikkita alohida tugma bor edi —
    // "Manzil" (Google/Apple) va "Yandex" — va odam qaysi biri
    // o'ziga kerakligini tugmadan bilolmasdi.
    mapUrl && { k: 'directions', label: t('Manzil'), color: '#b83a1e', icon: <IconPin width={26} height={26} aria-hidden="true" />, onClick: () => setMapPick(true) },
    company.website && { k: 'website', href: contactUrl('website', company.website), label: t('Sayt'), color: '#5a4410', icon: <IconGlobe width={26} height={26} aria-hidden="true" /> },
    ...extraLinks.map((l, i) => ({ k: `x${i}`, href: l.url, label: l.label, color: '#5a4410', icon: <IconLink width={26} height={26} aria-hidden="true" /> })),
  ].filter(Boolean);

  // TARTIB: avval KATALOG (xizmatlar / mahsulotlar / menyu) — egasining
  // qarori. NFC kartani tegizgan odam birinchi navbatda "nima sotasiz"
  // degan savolga javob ko'rishi kerak, post esa ikkinchi darajada.
  const tabs = [
    items.length > 0 && { id: 'katalog', label: cta.noun },
    posts.length > 0 && { id: 'post', label: 'POST' },
    stories.length > 0 && { id: 'lenta', label: 'STORIES' },
    { id: 'haqida', label: 'MA’LUMOT' },
  ].filter(Boolean);

  const saveContact = () => {
    companyEvent(company.companyId, 'action', 'vcard');
    downloadVcard({
      name: company.displayName,
      org: company.displayName,
      title: company.subcategory || company.categoryLabel || '',
      phone: company.phone,
      address: company.address || company.city,
      website: company.website,
      urls: [shareUrl],
      note: company.description,
    }, company.companyId.toLowerCase());
  };

  return (
    // SAHIFA TABIIY SURILADI: kontent o'z o'lchamida turadi, qobiq
    // esa kontentiga qarab o'sadi. "Kontaktni saqlash" tugmasi pastda
    // yopishib turadi (`position:sticky` — src/company-system.css).
    <main className="qp-page" style={{ '--cq-cover': `url("${company.coverUrl || fallbackCover}")`, '--tier': tierColor }}>
      {/* Bosh ekranga qo'shilganda AYNAN shu kompaniya ochilsin. */}
      <ProfileManifest kind="c" code={company.companyId} name={company.displayName} />
      <div className="qp-shell">
        <section className="qp-hero">
          {/* XIZMAT QATORI — logotipdan YUQORIDA, alohida satrda.
              Ilgari u logotip bilan BIR QATORDA, uch ustunli panjarada
              turardi. Logotip kattalashgach (104 -> 128px) yon
              ustunlarga atigi ~90px qoldi va "To'liq ekran" yozuvi
              oltin halqaga kirib, kesilib qoldi. Endi qator o'zining
              butun kengligiga ega va logotip markazda yolg'iz turadi —
              u sahifaning asosiy vizual langari. */}
          <div className="qp-topbar">
            <div className="qp-topbar-side">
              {fsOk && (
                <button
                  type="button" className="qp-fsbtn" onClick={toggleFs}
                  aria-label={isFs ? t('To‘liq ekrandan chiqish') : t('To‘liq ekran')}
                  title={isFs ? t('To‘liq ekrandan chiqish') : t('To‘liq ekran')}
                >
                  {isFs ? <IconCollapse width={12} height={12} aria-hidden="true" /> : <IconExpand width={12} height={12} aria-hidden="true" />}
                  <span>{isFs ? t('Chiqish') : t('To‘liq ekran')}</span>
                </button>
              )}
            </div>
            <div className="qp-topbar-side qp-topbar-side--right">
              {/* SHAXSIY PROFIL BILAN BITTA TIZIM.
                      [nusxalash] [ulashish] [⋮]
                  (yurak kompaniya sahifasida yo'q — bu yerda asosiy
                  ijtimoiy harakat "Obuna bo'lish", u pastda.)

                  Ilgari bu burchakda alohida mavzu tugmasi va katta
                  oltin "Tahrirlash" turardi — ya'ni bu sahifa
                  saytning qolgan ochiq profillaridan boshqacha
                  boshqarilardi. Mavzu endi ⋮ ichida (u SAYT qobig'i
                  rangi; kompaniyaning o'z bezagiga tegmaydi), ega
                  amallari ham o'sha yerda. */}
              <ProfileActionCluster
                url={shareUrl}
                shareTitle={company.displayName}
                shareText={company.description || company.displayName}
                onCopy={copyLink}
                targetKind="company"
                targetId={company.companyId}
                ownerActions={isOwner ? [
                  { label: t('Profilni tahrirlash'), icon: '✎', onClick: () => navigate(`${workspaceUrl}?tab=profile`) },
                  { label: t('Story qo‘shish'), icon: '＋', onClick: () => navigate(`${workspaceUrl}?tab=feed`) },
                  { label: t('Post qo‘shish'), icon: '＋', onClick: () => navigate(`${workspaceUrl}?tab=posts`) },
                  { label: t('QR kod'), icon: '▦', onClick: () => setQrOpen(true) },
                ] : []}
              />
            </div>
          </div>
          <div className="qp-ava-wrap">
            <StoryRing stories={stories} freshPost={hasFreshPost} title={company.displayName} avatarUrl={company.logoUrl}>
              <div className="qp-ava">
                {company.logoUrl ? <img src={company.logoUrl} alt="" /> : (company.displayName || 'N').slice(0, 2).toUpperCase()}
              </div>
            </StoryRing>
            {(company.music || []).length > 0 && (
              <button type="button" className={`qp-ava-note${musicOpen ? ' is-on' : ''}`} onClick={() => setMusicOpen((v) => !v)} aria-label={t('Musiqa')}>
                <IconNote width={15} height={15} aria-hidden="true" />
              </button>
            )}
          </div>

          <h1 className="qp-name break-words">
            {company.displayName}
            <i className="qp-verified" title={t('Tasdiqlangan kompaniya')} aria-label={t('Tasdiqlangan kompaniya')}>✓</i>
          </h1>
          {/* QISQA tanishtiruv (soha). Uzun tavsif ATAYLAB bu yerda
              emas: u to'rt qatorga cho'zilib, pastdagi kontent oynasini
              yeb qo'yardi. To'liq tavsif "Ma'lumot" bo'limida. */}
          <p className="qp-sub break-words">{company.subcategory || company.categoryLabel || t('Kompaniya')}</p>

          {/* META QATOR — shahar va ish vaqti yonma-yon. Ilgari ular
              ikki alohida satr edi va nom ostida uchta kulrang qator
              ketma-ket turardi; sahifa "to'ldirilgan forma"ga
              o'xshardi. Endi bu bitta ixcham belgilar qatori. */}
          <div className="qp-meta">
            {company.city && (
              <span className="qp-city">
                <IconPin width={13} height={13} aria-hidden="true" />
                {company.city}
              </span>
            )}
            <CompanyHours hours={company.hours} openNow={company.openNow} compact />
          </div>

          <div className="qp-stats">
            <div><b>{fmt(company.views || 0)}</b><small>{t('Ko‘rildi')}</small></div>
            <div><b>{fmt(company.followers || 0)}</b><small>{t('Obunachi')}</small></div>
            {items.length > 0 && <div><b>{fmt(items.length)}</b><small>{t(cta.noun)}</small></div>}
          </div>

          {/* OBUNA — mehmon uchun asosiy ikkinchi harakat, shuning uchun
              butun kenglikda va raqamlar ostida. Ataylab OLTIN
              TO'LDIRILGAN EMAS: to'ldirilgan oltin bitta tugmaga —
              "Kontaktni saqlash"ga — qoldirilgan, aks holda ikkalasi
              bir-biri bilan raqobatlashib, ko'z hech qaysisida
              to'xtamasdi. */}
          {!isOwner && (
            <button type="button" className={`qp-follow${company.following ? ' is-on' : ''}`} onClick={follow} disabled={followBusy}>
              {followBusy ? '…' : company.following ? t('Obuna bo‘lingan') : t('Obuna bo‘lish')}
            </button>
          )}

          <div className="qp-quick" onClick={(e) => { const k = e.target.closest('[data-ev]')?.dataset.ev; if (k) companyEvent(company.companyId, 'action', k); }}>
            {/* Ichki o'ram SHART: `justify-content:center` bo'lgan
                suriladigan qatorda kontent sig'masa BOSHI kesilib
                qoladi va unga umuman yetib bo'lmaydi. `margin:auto`
                esa sig'sa markazlaydi, sig'masa chapdan boshlaydi. */}
            <div className="qp-quick-in">
              {quick.map((q) => (q.href
                ? (
                  <a key={q.k} data-ev={q.k} className="qp-qbtn vz-tap" href={q.href} target={q.k === 'phone' ? undefined : '_blank'} rel="noreferrer">
                    <i style={{ color: q.color }}>{q.icon}</i><span>{q.label}</span>
                  </a>
                ) : (
                  <button key={q.k} data-ev={q.k} type="button" className="qp-qbtn vz-tap" onClick={q.onClick}>
                    <i style={{ color: q.color }}>{q.icon}</i><span>{q.label}</span>
                  </button>
                )
              ))}
              {/* ULASHISH BU QATORDAN OLIB TASHLANDI.
                  U endi tepadagi amallar to'plamida — shaxsiy
                  profildagidek. Ikkita bir xil "Ulashish" bitta
                  ekranda turgani aynan egasi shikoyat qilgan
                  "ortiqcha element" edi. */}
            </div>
          </div>
        </section>

        {tabs.length > 1 && (
          <nav className="qp-tabs" role="tablist">
            {/* Ichki o'ram — `.qp-quick` dagi bilan bir xil sabab:
                `justify-content:center` bo'lgan suriladigan qatorda
                kontent sig'masa BOSHI kesiladi va unga yetib
                bo'lmaydi. `margin:auto` esa sig'sa markazlaydi,
                sig'masa chapdan boshlaydi. Markazlash muhim: sahifada
                qolgan HAMMA narsa markazda, faqat shu qator chapga
                yopishib turardi. */}
            <div className="qp-tabs-in">
              {tabs.map((tb) => (
                <button
                  key={tb.id} type="button" role="tab"
                  aria-selected={activeTab === tb.id}
                  className={`qp-tab${activeTab === tb.id ? ' is-on' : ''}`}
                  onClick={() => setTab(tb.id)}
                >
                  {t(tb.label)}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Bo'lim kontenti — balandligi KONTENTIGA qarab. */}
        <div className="qp-body">
          {activeTab === 'katalog' && items.length > 0 && (
            <section className="qp-cards" id="catalog">
              {items.map((item) => (
                <article key={item.id} className="qp-item min-w-0">
                  <div className="qp-item-pic">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span>{t('RASM')} 1:1</span>}
                  </div>
                  <div className="qp-item-txt">
                    <b className="break-words">{item.name}</b>
                    <strong>{fmt(item.price)} {t('so‘m')}</strong>
                    {company.ordersEnabled && (
                      <button type="button" className="qp-order vz-tap" onClick={() => { companyEvent(company.companyId, 'item', String(item.id)); setOrderItem(item); }}>
                        {t('Buyurtma berish')}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}

          {activeTab === 'lenta' && <StoryGrid stories={stories} title={company.displayName} avatarUrl={company.logoUrl} />}

          {activeTab === 'post' && posts.length > 0 && (
            <section className="qp-posts">
              {posts.map((p) => (
                <article key={p.id}>
                  {p.videoUrl
                    ? <video src={p.videoUrl} controls playsInline preload="none" />
                    : <img src={p.imageUrl} alt={p.caption || ''} loading="lazy" />}
                  {p.caption && <p>{p.caption}</p>}
                </article>
              ))}
            </section>
          )}

          {activeTab === 'haqida' && (
            <section className="qp-about">
              <p className="qp-desc break-words">{company.description || t('Kompaniya haqida qisqa ma’lumot.')}</p>
              {/* MANZIL VA XARITA — egasining qarori: bu yerda NFC ID
                  havolasi turardi va u hech qanday ish bajarmasdi (odam
                  allaqachon o'sha havolada!).

                  XARITA BOSILGANDA YUKLANADI. Sabab: u tashqi
                  xizmatdan (OpenStreetMap) keladi va sekin tarmoqda
                  yoki xizmat yopiq bo'lganda brauzer BO'M-BO'SH
                  KULRANG kadr chizadi — bu premium sahifada juda
                  xunuk ko'rinadi. Endi odam ko'radigan narsa har doim
                  BIZNING kartochkamiz; xaritani xohlasa bir bosishda
                  ochadi. Yon ta'siri ham foydali: har bir tashrifchi
                  uchun tashqi so'rov yuborilmaydi — sahifa tezroq. */}
              {(geo || company.address) && (
                <div className="qp-map">
                  {mapOpen && geo ? (
                    <iframe
                      title={t('Kompaniya lokatsiyasi')}
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(company.longitude) - 0.006}%2C${Number(company.latitude) - 0.0035}%2C${Number(company.longitude) + 0.006}%2C${Number(company.latitude) + 0.0035}&layer=mapnik&marker=${company.latitude}%2C${company.longitude}`}
                    />
                  ) : (
                    <button
                      type="button" className="qp-map-card vz-tap"
                      onClick={() => (geo ? setMapOpen(true) : window.open(mapUrl, '_blank', 'noreferrer'))}
                    >
                      <i aria-hidden="true"><IconPin width={26} height={26} /></i>
                      <b className="break-words">{company.address || company.city}</b>
                      <small>{geo ? t('Xaritani ko‘rish') : t('Xaritada ochish')}</small>
                    </button>
                  )}
                </div>
              )}
              {mapUrl && (
                <button
                  type="button" className="qp-route vz-tap"
                  onClick={() => { companyEvent(company.companyId, 'action', 'directions'); setMapPick(true); }}
                >
                  <IconPin width={17} height={17} aria-hidden="true" /> {t('Yo‘nalish olish')}
                </button>
              )}

              {/* `tier-shine` OLIB TASHLANDI: tugma endi to'ldirilgan oltin
                  emas va yaltirash qorong'i yuzada oltin emas, KULRANG
                  chiziq bo'lib ko'rinardi — dog'ga o'xshardi. Yaltirash
                  sahifada bitta joyda qoldi: "Kontaktni saqlash". */}
              <button type="button" className="qp-public vz-tap" onClick={() => navigate(`/company/${company.companyId.toLowerCase()}`)}>
                {t('Kompaniya saytini to‘liq ochish')} <span aria-hidden="true">↗</span>
              </button>
              <p className="qp-foot"><span>{t('NFC orqali ochildi')}</span><b>NFCSTORE BUSINESS</b></p>
            </section>
          )}
        </div>

        {/* Musiqa — yopiq holatda joy egallamaydi, lekin ULANGAN qoladi:
            ekran o'chsa ham ijro to'xtamaydi (MediaSession). */}
        <div className={`qp-music${musicOpen ? ' is-open' : ''}`}>
          <CompanyMusicPlayer tracks={company.music} companyName={company.displayName} coverUrl={company.logoUrl || company.coverUrl} />
        </div>

        {/* KONTAKTNI SAQLASH — pastga YOPISHGAN oltin qator, sahifa
            qayerda bo'lmasin ko'rinib turadi. NFC kartaning butun
            ma'nosi shu: odam sahifani yopgandan keyin ham raqamingiz
            uning telefonida qoladi. */}
        <div className="qp-bottom">
          <button type="button" className="qp-save vz-tap" onClick={saveContact}>{t('Kontaktni saqlash')}</button>
        </div>

        {orderItem && <CompanyOrderModal companyId={company.companyId} item={orderItem} onClose={() => setOrderItem(null)} />}
        {showCard && <CardNumberModal cardNumber={company.cardNumber} holder={company.displayName} onClose={() => setShowCard(false)} />}
        {mapPick && <MapAppSheet company={company} onClose={() => setMapPick(false)} />}
        {fsHelp && <AddToHomeSheet onClose={() => setFsHelp(false)} />}

        {/* QR — ega uchun, ⋮ menyusidan. Shaxsiy va biznes profil
            bilan BITTA komponent. */}
        {qrOpen && (
          <ProfileQrModal url={shareUrl} name={company.displayName} onClose={() => setQrOpen(false)} />
        )}

        {/* Nusxalash natijasi KO'RINSIN — aks holda tugma
            "ishlamayotgandek" tuyulardi. */}
        {copied && <div className="bp-toast" role="status">{t('Havola nusxalandi!')}</div>}
      </div>
    </main>
  );
}
