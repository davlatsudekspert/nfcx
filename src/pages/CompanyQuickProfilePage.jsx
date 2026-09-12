import { useCallback, useEffect, useMemo, useState } from 'react';
import { directionsUrl, hasCoords, yandexDirectionsUrl } from '../lib/mapLink.js';
import CompanyMusicPlayer from '../components/CompanyMusicPlayer.jsx';
import CompanyHours from '../components/CompanyHours.jsx';
import CompanyOrderModal from '../components/CompanyOrderModal.jsx';
import CardNumberModal from '../components/CardNumberModal.jsx';
import { downloadVcard } from '../lib/vcard.js';
import StoryRing from '../components/StoryRing.jsx';
import StoryGrid from '../components/StoryGrid.jsx';
import ProfileTabs from '../components/ProfileTabs.jsx';
import CompanyStatsBar from '../components/CompanyStatsBar.jsx';
import { useAuth } from '../lib/auth.jsx';
import { listCompanyPosts, listCompanyStories } from '../lib/company.js';
import { socialUrl } from '../lib/socialLinks.js';
import { companyCta, companyEvent, companyTier, getCompany } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import { TIER_COLOR, TIER_LABEL } from '../lib/pricing.js';
import ShareButton from '../components/ShareButton.jsx';
import { IconPhone, IconTelegram, IconGlobe, IconWhatsApp, IconInstagram, IconFacebook, IconChip, IconLink } from '../components/Icons.jsx';
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

  // ALOQA TUGMALARI — dumaloq ikonkalar qatori.
  //
  // Ilgari bular ustma-ust yotgan ETTITA keng tugma edi: faqat shuning
  // o'zi ekranning yarmini yeb, qolgan hamma narsa (bo'limlar, post,
  // menyu) ko'rinmas joyga tushib ketardi. Endi bitta gorizontal qator:
  // balandligi 7 ta tugma o'rniga bittasiniki, ikonka esa o'z firma
  // rangida — ko'z Telegramni qidirmaydi, darrov topadi.
  const quick = [
    company.phone && { k: 'phone', href: contactUrl('phone', company.phone), label: t('Qo‘ng‘iroq'), color: '#4ddb8f', icon: <IconPhone width={26} height={26} aria-hidden="true" /> },
    company.telegram && { k: 'telegram', href: contactUrl('telegram', company.telegram), label: 'Telegram', color: '#2aabee', icon: <IconTelegram width={26} height={26} aria-hidden="true" /> },
    company.whatsapp && { k: 'whatsapp', href: contactUrl('whatsapp', company.whatsapp), label: 'WhatsApp', color: '#25d366', icon: <IconWhatsApp width={26} height={26} aria-hidden="true" /> },
    company.instagram && { k: 'instagram', href: socialUrl('ig', company.instagram), label: 'Instagram', color: '#e1306c', icon: <IconInstagram width={26} height={26} aria-hidden="true" /> },
    company.facebook && { k: 'facebook', href: socialUrl('fb', company.facebook), label: 'Facebook', color: '#1877f2', icon: <IconFacebook width={26} height={26} aria-hidden="true" /> },
    company.website && { k: 'website', href: contactUrl('website', company.website), label: t('Sayt'), color: '#e6c169', icon: <IconGlobe width={26} height={26} aria-hidden="true" /> },
    mapUrl && { k: 'directions', href: mapUrl, label: t('Manzil'), color: '#ff7a59', icon: <IconGlobe width={26} height={26} aria-hidden="true" /> },
    geo && { k: 'yandex', href: yandexDirectionsUrl(company), label: 'Yandex', color: '#ff3f40', icon: <IconGlobe width={26} height={26} aria-hidden="true" /> },
    // KARTA RAQAMI — ro'yxatda YASHIRIN turadi. Ochiq tursa u tasodifan
    // ekranga tushadi (skrinshot, video, yonidagi odam); bosish esa
    // ataylab qilingan harakat.
    company.cardNumber && { k: 'card', onClick: () => setShowCard(true), label: t('Karta'), color: '#f0cf7b', icon: <IconChip width={26} height={26} aria-hidden="true" /> },
    // Egasi o'zi qo'shgan havolalar.
    ...extraLinks.map((l, i) => ({ k: `x${i}`, href: l.url, label: l.label, color: '#cfc6b4', icon: <IconLink width={26} height={26} aria-hidden="true" /> })),
  ].filter(Boolean);

  const isOwner = user && String(user.id) === String(company.ownerUserId);
  const tier = companyTier(company.companyId);
  const tierColor = TIER_COLOR[tier] || TIER_COLOR.free;
  const shareUrl = `${window.location.origin}/c/${company.companyId.toLowerCase()}`;

  return (
    <main className="qp-page" style={{ '--cq-cover': `url("${company.coverUrl || fallbackCover}")` }}>
      {/* BITTA EKRANLIK QOBIQ. Balandligi aynan telefon ekrani
          (100dvh) va o'zi SCROLL BO'LMAYDI: faqat o'rtadagi kontent
          qismi suriladi. NFC kartani tegizgan odam sahifani ochishi
          bilan hamma muhim narsani — nomi, holati, aloqa tugmalari va
          "Kontaktni saqlash"ni — bir qarashda ko'radi. */}
      <div className="qp-shell">
        <header className="qp-top">
          <span className="qp-brand"><i><img src={logo} alt="" /></i> NFCSTORE</span>
          {/* ID — KATTA va TARIF RANGIDA (egasining talabi). "nfcstore.uz/"
              prefiksi olib tashlandi: u har bir profilda bir xil va
              faqat joy egallaydi; odam eslab qoladigan narsa — ID ning
              o'zi. Rang ID darajasidan keladi (qancha qisqa — shuncha
              yuqori), ya'ni qimmat ID bir qarashda bilinadi. */}
          <span className="qp-idbig" style={{ '--tier': tierColor }} title={t('{tier} tarif', { tier: t(TIER_LABEL[tier] || tier) })}>
            {company.companyId}
          </span>
          {/* IKKALASIDAN BITTASI: kompaniya egasi bo'lsangiz —
              "Tahrirlash" (kabinetga), kirgan boshqa odam bo'lsangiz —
              o'z profilingizga qaytish. Mehmonga hech biri kerak emas:
              NFC kartani tegizgan odamda "qaytadigan" profil yo'q. */}
          {user && (isOwner
            ? <button type="button" className="qp-top-link" onClick={() => navigate(`/workspace/${company.companyId.toLowerCase()}`)}>✎ {t('Tahrirlash')}</button>
            : <button type="button" className="qp-top-link" onClick={() => navigate('/account')}>‹ {t('Profil')}</button>)}
        </header>

        <section className="qp-hero">
          <div className="qp-hero-row">
            <StoryRing stories={stories} freshPost={hasFreshPost} title={company.displayName} avatarUrl={company.logoUrl}>
              <div className="qp-avatar">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : (company.displayName || 'N').slice(0, 2).toUpperCase()}</div>
            </StoryRing>
            <div className="qp-hero-text">
              <h1 className="break-words">
                {company.displayName}
                <i className="qp-verified" title={t('Tasdiqlangan kompaniya')} aria-label={t('Tasdiqlangan kompaniya')}>✓</i>
              </h1>
              <p className="qp-cat break-words">{company.subcategory || company.categoryLabel || t('Kompaniya')} · {company.city || t('O‘zbekiston')}</p>
              <CompanyHours hours={company.hours} openNow={company.openNow} compact />
            </div>
          </div>

          <CompanyStatsBar company={company} showShare={false} onChange={(patch) => setCompany((c) => ({ ...c, ...patch }))} />

          {quick.length > 0 && (
            <div className="qp-quick" onClick={(e) => { const k = e.target.closest('[data-ev]')?.dataset.ev; if (k) companyEvent(company.companyId, 'action', k); }}>
              {quick.map((q) => (q.href
                ? <a key={q.k} data-ev={q.k} className="qp-quick-btn vz-tap" href={q.href} target={q.k === 'phone' ? undefined : '_blank'} rel="noreferrer"><i style={{ color: q.color }}>{q.icon}</i><span>{q.label}</span></a>
                : <button key={q.k} data-ev={q.k} type="button" className="qp-quick-btn vz-tap" onClick={q.onClick}><i style={{ color: q.color }}>{q.icon}</i><span>{q.label}</span></button>
              ))}
              {/* ULASHISH — qolgan havolalar bilan BIR QATORDA (egasining
                  talabi). Ilgari u yuqorida, raqamlar yonida turardi va
                  "aloqa usullari" ro'yxatidan tushib qolgan edi. */}
              <ShareButton
                url={shareUrl}
                title={company.displayName}
                text={company.description || company.displayName}
                label={t('Ulashish')}
                className="qp-quick-btn qp-quick-share vz-tap"
              />
            </div>
          )}
        </section>

        {/* BO'LIMLAR — shaxsiy profildagi bilan BIR XIL qator.
            "Post" — doimiy, "Stories" — 24 soatlik. Bo'sh bo'lim
            chizilmaydi; katalog nomi kompaniya turiga qarab
            "Menyu" / "Tovarlar" / "Xizmatlar" bo'ladi. */}
        <ProfileTabs
          value={activeTab}
          onChange={setTab}
          tabs={[
            posts.length > 0 && { id: 'post', label: 'Post', count: posts.length },
            stories.length > 0 && { id: 'lenta', label: 'Stories', count: stories.length },
            items.length > 0 && { id: 'katalog', label: cta.noun, count: items.length },
            { id: 'haqida', label: 'Ma’lumot' },
          ]}
        />

        {/* YAGONA SURILADIGAN QISM. Sahifaning o'zi emas, aynan shu
            oyna suriladi — shuning uchun tepadagi nomi va pastdagi
            "Kontaktni saqlash" hech qachon ko'zdan yo'qolmaydi. */}
        <div className="qp-body">
          {activeTab === 'katalog' && items.length > 0 && (
            <section className="qp-cards" id="catalog">
              {items.map((item) => (
                <article key={item.id} className="qp-item min-w-0">
                  <img src={item.imageUrl || company.coverUrl || fallbackCover} alt="" loading="lazy" />
                  <div>
                    <b className="break-words">{item.name}</b>
                    <p>{item.description || item.category}</p>
                    <strong>{fmt(item.price)} {t('so‘m')}</strong>
                    {company.ordersEnabled && <button type="button" className="qp-order vz-tap" onClick={() => { companyEvent(company.companyId, 'item', String(item.id)); setOrderItem(item); }}>{t('Buyurtma berish')}</button>}
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

          {/* "MA'LUMOT" — tavsif, musiqa, manzil, NFC ID va to'liq
              sahifaga o'tish. Bular ilgari sahifaning oxirida uzun
              ustun bo'lib yotardi; endi o'z bo'limida — hech narsa
              yo'qolmadi, lekin birinchi ekranni band qilmaydi. */}
          {activeTab === 'haqida' && (
            <section className="qp-about">
              <p className="qp-desc break-words">{company.description || t('Kompaniya haqida qisqa ma’lumot.')}</p>
              {company.address && <p className="qp-addr break-words">◎ {company.address}</p>}
              {/* Musiqa — NFC profilda ham ijro etiladi va telefon ekrani
                  o'chsa ham to'xtamaydi (MediaSession). */}
              <CompanyMusicPlayer tracks={company.music} companyName={company.displayName} coverUrl={company.logoUrl || company.coverUrl} />
              {/* O'Z NFC ID RAQAMI — kompaniyaning doimiy manzili. */}
              <div className="pf-nfcid">
                <i aria-hidden="true">◉</i>
                <div style={{ textAlign: 'center' }}>
                  <b>{company.companyId}</b>
                  <small>NFC ID · nfcstore.uz/c/{company.companyId.toLowerCase()}</small>
                </div>
              </div>
              <button type="button" className="cq-public vz-tap" onClick={() => navigate(`/company/${company.companyId.toLowerCase()}`)}>{t('Kompaniya saytini to‘liq ochish')} <span>↗</span></button>
              <p className="qp-foot"><span>{t('NFC orqali ochildi')}</span><b>NFCSTORE BUSINESS</b></p>
            </section>
          )}
        </div>

        {/* KONTAKTNI SAQLASH — doim ko'rinib turadigan pastki qator.
            NFC kartaning butun ma'nosi shu: odam sahifani yopgandan
            keyin ham raqamingiz uning telefonida qoladi. */}
        <div className="qp-bottom">
          <button
            type="button" className="qp-save vz-tap"
            onClick={() => {
              companyEvent(company.companyId, 'action', 'vcard');
              downloadVcard({
                name: company.displayName,
                org: company.displayName,
                title: company.subcategory || company.categoryLabel || '',
                phone: company.phone,
                address: company.address || company.city,
                website: company.website,
                urls: [`${window.location.origin}/c/${company.companyId.toLowerCase()}`],
                note: company.description,
              }, company.companyId.toLowerCase());
            }}
          >
            {t('Kontaktni saqlash')}
          </button>
        </div>

        {orderItem && <CompanyOrderModal companyId={company.companyId} item={orderItem} onClose={() => setOrderItem(null)} />}
        {showCard && <CardNumberModal cardNumber={company.cardNumber} holder={company.displayName} onClose={() => setShowCard(false)} />}
      </div>
    </main>
  );
}
