import { useCallback, useEffect, useMemo, useState } from 'react';
import { directionsUrl, hasCoords, yandexDirectionsUrl } from '../lib/mapLink.js';
import CompanyMusicPlayer from '../components/CompanyMusicPlayer.jsx';
import CompanyHours from '../components/CompanyHours.jsx';
import CompanyOrderModal from '../components/CompanyOrderModal.jsx';
import CardNumberModal from '../components/CardNumberModal.jsx';
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
import ShareButton from '../components/ShareButton.jsx';
import ProfileManifest from '../components/ProfileManifest.jsx';
import {
  IconPhone, IconTelegram, IconGlobe, IconWhatsApp, IconInstagram, IconFacebook, IconChip, IconLink,
  IconGrid, IconBox, IconStories, IconInfo, IconHome, IconBuilding, IconCard, IconNote,
  IconChevronDown, IconDownload, IconCopy, IconUser, IconWave, IconPin,
} from '../components/Icons.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import logo from '../assets/logo-128.png';
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
  // Tepadagi chip menyusi (nusxalash / to'liq sahifa / tahrirlash).
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  // Musiqa pleeri — avatar yonidagi belgi bilan ochiladi/yopiladi.
  const [musicOpen, setMusicOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

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
    if (company?.companyId) companyEvent(company.companyId, 'view');
  }, [company?.companyId]);

  // Havolani nusxalash. `clipboard.writeText` VA'DA qaytaradi va uning
  // xatosi sinxron `try/catch` bilan ushlanmaydi — shuning uchun
  // `catch` aynan va'dada.
  const copyLink = () => {
    const url = `${window.location.origin}/c/${String(companyId || '').toLowerCase()}`;
    navigator.clipboard?.writeText(url)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })
      .catch(() => {});
  };

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
    posts.length > 0 && 'post',
    stories.length > 0 && 'lenta',
    items.length > 0 && 'katalog',
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
          <header className="qp-top"><span className="vz-skel" style={{ width: 110, height: 14 }} /></header>
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
  const handle = `@${(company.customDomain || company.companyId).toLowerCase()}`;

  // ── ALOQA — dumaloq ikonkalar qatori ────────────────────────────────
  // Birinchisi — KONTAKTNI SAQLASH va u OLTIN: NFC kartaning butun
  // ma'nosi shunda, ya'ni u qolganlaridan ajralib turishi kerak.
  const quick = [
    { k: 'vcard', primary: true, label: t('Saqlash'), icon: <IconDownload width={22} height={22} aria-hidden="true" />,
      onClick: () => {
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
      } },
    company.phone && { k: 'phone', href: contactUrl('phone', company.phone), label: t('Qo‘ng‘iroq'), color: '#4ddb8f', icon: <IconPhone width={22} height={22} aria-hidden="true" /> },
    company.telegram && { k: 'telegram', href: contactUrl('telegram', company.telegram), label: 'Telegram', color: '#2aabee', icon: <IconTelegram width={22} height={22} aria-hidden="true" /> },
    company.whatsapp && { k: 'whatsapp', href: contactUrl('whatsapp', company.whatsapp), label: 'WhatsApp', color: '#25d366', icon: <IconWhatsApp width={22} height={22} aria-hidden="true" /> },
    company.instagram && { k: 'instagram', href: socialUrl('ig', company.instagram), label: 'Instagram', color: '#e1306c', icon: <IconInstagram width={22} height={22} aria-hidden="true" /> },
    company.facebook && { k: 'facebook', href: socialUrl('fb', company.facebook), label: 'Facebook', color: '#1877f2', icon: <IconFacebook width={22} height={22} aria-hidden="true" /> },
    company.website && { k: 'website', href: contactUrl('website', company.website), label: t('Sayt'), color: '#e6c169', icon: <IconGlobe width={22} height={22} aria-hidden="true" /> },
    mapUrl && { k: 'directions', href: mapUrl, label: t('Manzil'), color: '#ff7a59', icon: <IconPin width={22} height={22} aria-hidden="true" /> },
    geo && { k: 'yandex', href: yandexDirectionsUrl(company), label: 'Yandex', color: '#ff3f40', icon: <IconPin width={22} height={22} aria-hidden="true" /> },
    // KARTA RAQAMI — ro'yxatda YASHIRIN: bosilganda QR bilan oyna ochiladi.
    company.cardNumber && { k: 'card', label: t('Karta'), color: '#f0cf7b', icon: <IconChip width={24} height={19} aria-hidden="true" />, onClick: () => setShowCard(true) },
    ...extraLinks.map((l, i) => ({ k: `x${i}`, href: l.url, label: l.label, color: '#cfc6b4', icon: <IconLink width={22} height={22} aria-hidden="true" /> })),
  ].filter(Boolean);

  // ── BO'LIMLAR — YOZUVSIZ, faqat ikonka (egasining maketi) ───────────
  const tabs = [
    posts.length > 0 && { id: 'post', label: 'Post', icon: IconGrid },
    stories.length > 0 && { id: 'lenta', label: 'Stories', icon: IconStories },
    items.length > 0 && { id: 'katalog', label: cta.noun, icon: IconBox },
    { id: 'haqida', label: 'Ma’lumot', icon: IconInfo },
  ].filter(Boolean);

  return (
    // BITTA EKRANLIK QOBIQ: balandligi aynan telefon ekrani, o'zi
    // SURILMAYDI — faqat o'rtadagi kontent qismi suriladi.
    <main className="qp-page" style={{ '--cq-cover': `url("${company.coverUrl || fallbackCover}")`, '--tier': tierColor }}>
      {/* Bosh ekranga qo'shilganda AYNAN shu kompaniya ochilsin. */}
      <ProfileManifest kind="c" code={company.companyId} name={company.displayName} />
      <div className="qp-shell">
        <header className="qp-top">
          {/* CHAP CHIP — kompaniyaning "manzili" va shu bilan birga
              menyu tugmasi: nusxalash, to'liq sahifa, egasiga
              tahrirlash. Rangi TARIFDAN keladi (ID qancha qisqa —
              shuncha yuqori daraja), ya'ni qimmat ID bilinib turadi. */}
          <div className="qp-handle-wrap">
            <button
              type="button" className="qp-handle" onClick={() => setMenu((v) => !v)}
              aria-expanded={menu} aria-haspopup="menu"
              title={t('{tier} tarif', { tier: t(TIER_LABEL[tier] || tier) })}
            >
              {handle}
              <IconChevronDown width={13} height={13} aria-hidden="true" />
            </button>
            {menu && (
              <>
                <span className="qp-menu-veil" onClick={() => setMenu(false)} />
                <div className="qp-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); copyLink(); }}>
                    <IconCopy width={15} height={15} aria-hidden="true" /> {copied ? t('Nusxalandi!') : t('Havolani nusxalash')}
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); navigate(`/company/${company.companyId.toLowerCase()}`); }}>
                    <IconGlobe width={15} height={15} aria-hidden="true" /> {t('Kompaniya saytini to‘liq ochish')}
                  </button>
                  {isOwner && (
                    <button type="button" role="menuitem" onClick={() => { setMenu(false); navigate(`/workspace/${company.companyId.toLowerCase()}`); }}>
                      <IconCard width={15} height={15} aria-hidden="true" /> {t('Tahrirlash')}
                    </button>
                  )}
                  {user && !isOwner && (
                    <button type="button" role="menuitem" onClick={() => { setMenu(false); navigate('/account'); }}>
                      <IconUser width={15} height={15} aria-hidden="true" /> {t('Profilga qaytish')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <LanguageSwitcher className="qp-lang" />
        </header>

        <section className="qp-hero">
          {/* Ikki nozik oltin chiziq NFC belgisida uchrashadi — premium
              ko'rinishning imzosi va "bu NFC profil" degan belgi. */}
          <div className="qp-nfcline" aria-hidden="true">
            <i /><span className="qp-nfcbadge"><IconWave width={16} height={16} /></span><i />
          </div>

          <div className="qp-ava-wrap">
            <StoryRing stories={stories} freshPost={hasFreshPost} title={company.displayName} avatarUrl={company.logoUrl}>
              <div className="qp-ava">
                {company.logoUrl ? <img src={company.logoUrl} alt="" /> : (company.displayName || 'N').slice(0, 2).toUpperCase()}
              </div>
            </StoryRing>
            {/* Musiqa — avatar yonidagi kichik belgi. Faqat kompaniya
                musiqa qo'ygan bo'lsa chiqadi va pleerni ochadi. */}
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

          <CompanyHours hours={company.hours} openNow={company.openNow} compact />

          <p className="qp-line break-words">
            {[company.phone, company.city || company.subcategory || company.categoryLabel].filter(Boolean).join(' • ')}
          </p>

          <div className="qp-stats">
            <div><b>{fmt(company.views || 0)}</b><small>{t('ko‘rildi')}</small></div>
            <div><b>{fmt(company.followers || 0)}</b><small>{t('obunachi')}</small></div>
            {items.length > 0 && <div><b>{fmt(items.length)}</b><small>{t(cta.noun)}</small></div>}
          </div>

          <div className="qp-cta">
            {!isOwner && (
              <button type="button" className={`qp-follow${company.following ? ' is-on' : ''}`} onClick={follow} disabled={followBusy}>
                {followBusy ? '…' : company.following ? t('Obuna bo‘lingan') : t('Obuna bo‘lish')}
              </button>
            )}
            {isOwner && (
              <button type="button" className="qp-follow" onClick={() => navigate(`/workspace/${company.companyId.toLowerCase()}`)}>
                ✎ {t('Tahrirlash')}
              </button>
            )}
            <ShareButton url={shareUrl} title={company.displayName} text={company.description || company.displayName} className="qp-sharebtn" />
          </div>

          <div className="qp-quick" onClick={(e) => { const k = e.target.closest('[data-ev]')?.dataset.ev; if (k) companyEvent(company.companyId, 'action', k); }}>
            {/* Ichki o'ram SHART: `justify-content:center` bo'lgan
                suriladigan qatorda kontent sig'masa, BOSHI kesilib
                qoladi va unga umuman yetib bo'lmaydi (oltin "Saqlash"
                aynan shunday yo'qolgan edi). `margin:auto` esa sig'sa
                markazlaydi, sig'masa chapdan boshlaydi. */}
            <div className="qp-quick-in">
            {quick.map((q) => (q.href
              ? (
                <a key={q.k} data-ev={q.k} className="qp-qbtn vz-tap" href={q.href} target={q.k === 'phone' ? undefined : '_blank'} rel="noreferrer" title={q.label}>
                  <i style={{ color: q.color }}>{q.icon}</i><span>{q.label}</span>
                </a>
              ) : (
                <button key={q.k} data-ev={q.k} type="button" className={`qp-qbtn vz-tap${q.primary ? ' is-primary' : ''}`} onClick={q.onClick} title={q.label}>
                  <i style={q.color ? { color: q.color } : undefined}>{q.icon}</i><span>{q.label}</span>
                </button>
              )
            ))}
            </div>
          </div>
        </section>

        {/* BO'LIMLAR — yozuvsiz ikonkalar, faoli ostiga oltin chiziq. */}
        {tabs.length > 1 && (
          <nav className="qp-itabs" role="tablist">
            {tabs.map((tb) => {
              const Ico = tb.icon;
              return (
                <button
                  key={tb.id} type="button" role="tab"
                  aria-selected={activeTab === tb.id}
                  aria-label={t(tb.label)} title={t(tb.label)}
                  className={`qp-itab${activeTab === tb.id ? ' is-on' : ''}`}
                  onClick={() => setTab(tb.id)}
                >
                  <Ico width={21} height={21} />
                </button>
              );
            })}
          </nav>
        )}

        {/* YAGONA SURILADIGAN QISM. */}
        <div className="qp-body">
          {activeTab === 'katalog' && items.length > 0 && (
            <section className="qp-cards" id="catalog">
              {items.map((item) => (
                <article key={item.id} className="qp-item min-w-0">
                  <div className="qp-item-pic">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt="" loading="lazy" />
                      : <span>{t('RASM')} 1:1</span>}
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
              {company.address && <p className="qp-addr break-words">◎ {company.address}</p>}
              <div className="pf-nfcid">
                <i aria-hidden="true">◉</i>
                <div style={{ textAlign: 'center' }}>
                  <b>{company.companyId}</b>
                  <small>NFC ID · nfcstore.uz/c/{company.companyId.toLowerCase()}</small>
                </div>
              </div>
              <p className="qp-foot"><span>{t('NFC orqali ochildi')}</span><b>NFCSTORE BUSINESS</b></p>
            </section>
          )}
        </div>

        {/* Musiqa pleeri — avatar yonidagi belgi bilan ochiladi.
            Har doim ulanган: ekran o'chsa ham ijro to'xtamaydi. */}
        <div className={`qp-music${musicOpen ? ' is-open' : ''}`}>
          <CompanyMusicPlayer tracks={company.music} companyName={company.displayName} coverUrl={company.logoUrl || company.coverUrl} />
        </div>

        {/* PASTKI NAVIGATSIYA — maketdagidek. */}
        <nav className="qp-nav">
          <button type="button" onClick={() => navigate('/')}><IconHome width={19} height={19} /><span>{t('Bosh')}</span></button>
          <button type="button" onClick={() => navigate('/katalog')}><IconCard width={19} height={19} /><span>{t('Katalog')}</span></button>
          <button type="button" className="is-on" onClick={() => navigate(`/company/${company.companyId.toLowerCase()}`)}><IconBuilding width={19} height={19} /><span>{t('Kompaniya')}</span></button>
          <button type="button" onClick={() => navigate(user ? '/account' : '/login')}><IconUser width={19} height={19} /><span>{t('Profil')}</span></button>
        </nav>

        {orderItem && <CompanyOrderModal companyId={company.companyId} item={orderItem} onClose={() => setOrderItem(null)} />}
        {showCard && <CardNumberModal cardNumber={company.cardNumber} holder={company.displayName} onClose={() => setShowCard(false)} />}
      </div>
    </main>
  );
}
