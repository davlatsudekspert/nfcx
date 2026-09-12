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
import { companyCta, companyEvent, getCompany } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import { IconPhone, IconTelegram, IconGlobe } from '../components/Icons.jsx';
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
  const items = useMemo(() => (company?.catalog || []).filter((item) => item.available !== false).slice(0, 4), [company]);
  // Qaysi bo'limlar BOR — shu tartibda: Post, Lenta, Katalog.
  // `activeTab` tanlanganini emas, MAVJUDINI qaytaradi: ma'lumot
  // keyinroq kelganda yoki bo'lim bo'shab qolganda sahifa bo'sh
  // ko'rinib qolmasin.
  const availableTabs = [
    posts.length > 0 && 'post',
    stories.length > 0 && 'lenta',
    items.length > 0 && 'katalog',
  ].filter(Boolean);
  const activeTab = availableTabs.includes(tab) ? tab : (availableTabs[0] || '');

  if (company === undefined) {
    return (
      <main className="cq-page" aria-busy="true">
        <div className="cq-shell" style={{ '--cq-cover': 'none' }}>
          <div className="cq-identity" style={{ paddingTop: 48 }}>
            <div className="vz-skel mx-auto" style={{ width: 82, height: 82, borderRadius: 25 }} />
            <div className="vz-skel mx-auto mt-4" style={{ width: '60%', height: 22 }} />
            <div className="vz-skel mx-auto mt-3" style={{ width: '40%' }} />
            <div className="vz-skel mx-auto mt-3" style={{ width: '80%' }} />
          </div>
          <div className="cq-actions"><div className="vz-skel" style={{ height: 44 }} /><div className="vz-skel" style={{ height: 44 }} /></div>
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

  return (
    <main className="cq-page" style={{ '--cq-cover': `url("${company.coverUrl || fallbackCover}")` }}>
      <div className="cq-shell">
        <header className="cq-top">
          <span className="cq-brand"><i><img src={logo} alt="NFCSTORE" /></i> NFCSTORE</span>
          {/* IKKALASIDAN BITTASI: kompaniya egasi bo'lsangiz —
              "Tahrirlash" (kabinetga), kirgan boshqa odam bo'lsangiz —
              o'z profilingizga qaytish. Mehmonga hech biri kerak emas:
              NFC kartani tegizgan odamda "qaytadigan" profil yo'q. */}
          {user && (String(user.id) === String(company.ownerUserId)
            ? <button type="button" className="cq-top-link" onClick={() => navigate(`/workspace/${company.companyId.toLowerCase()}`)}>✎ {t('Tahrirlash')}</button>
            : <button type="button" className="cq-top-link" onClick={() => navigate('/account')}>‹ {t('Profilga qaytish')}</button>)}
          <span className="cq-id">COMPANY ID · {company.companyId}</span>
        </header>
        <section className="cq-identity">
          <StoryRing stories={stories} title={company.displayName} avatarUrl={company.logoUrl}>
            <div className="cq-logo">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : (company.displayName || 'N').slice(0, 2).toUpperCase()}</div>
          </StoryRing>
          <span className="cq-live">● {t('TASDIQLANGAN KOMPANIYA')}</span>
          <h1 className="break-words">{company.displayName}</h1>
          <p className="cq-category break-words">{company.subcategory || company.categoryLabel || t('Kompaniya')} · {company.city || t('O‘zbekiston')}</p>
          <p className="cq-description break-words">{company.description || t('Kompaniya haqida qisqa ma’lumot.')}</p>
        </section>

        <CompanyHours hours={company.hours} openNow={company.openNow} compact />

        <CompanyStatsBar company={company} onChange={(patch) => setCompany((c) => ({ ...c, ...patch }))} />

        <section className="cq-actions" onClick={(e) => { const k = e.target.closest('[data-ev]')?.dataset.ev; if (k) companyEvent(company.companyId, 'action', k); }}>
          {company.phone && <a data-ev="phone" className="primary vz-tap" href={contactUrl('phone', company.phone)}><IconPhone width={14} height={14} aria-hidden="true" />&nbsp;{t('Qo‘ng‘iroq')}</a>}
          {company.telegram && <a data-ev="telegram" className="vz-tap" href={contactUrl('telegram', company.telegram)} target="_blank" rel="noreferrer"><IconTelegram width={14} height={14} aria-hidden="true" />&nbsp;Telegram</a>}
          {company.whatsapp && <a data-ev="whatsapp" className="vz-tap" href={contactUrl('whatsapp', company.whatsapp)} target="_blank" rel="noreferrer">WhatsApp</a>}
          {company.instagram && <a data-ev="instagram" className="vz-tap" href={socialUrl('ig', company.instagram)} target="_blank" rel="noreferrer">Instagram</a>}
          {company.facebook && <a data-ev="facebook" className="vz-tap" href={socialUrl('fb', company.facebook)} target="_blank" rel="noreferrer">Facebook</a>}
          {company.website && <a data-ev="website" className="vz-tap" href={contactUrl('website', company.website)} target="_blank" rel="noreferrer"><IconGlobe width={14} height={14} aria-hidden="true" />&nbsp;{t('Veb-sayt')}</a>}
          {mapUrl && <a data-ev="directions" className="vz-tap" href={mapUrl} target="_blank" rel="noreferrer"><IconGlobe width={14} height={14} aria-hidden="true" />&nbsp;{t('Yo‘nalish olish')}</a>}
          {geo && <a data-ev="yandex" className="vz-tap" href={yandexDirectionsUrl(company)} target="_blank" rel="noreferrer">{t('Yandex Karta')}</a>}
          {/* KARTA RAQAMI — ro'yxatda YASHIRIN turadi. Ochiq tursa u
              tasodifan ekranga tushadi (skrinshot, video, yonidagi
              odam); bosish esa ataylab qilingan harakat. */}
          {company.cardNumber && (
            <button data-ev="card" type="button" className="vz-tap" onClick={() => setShowCard(true)}>
              ▤ {t('Karta raqami')}
            </button>
          )}
          {/* Egasi o'zi qo'shgan havolalar. */}
          {extraLinks.map((l, i) => (
            <a key={`x${i}`} className="vz-tap" href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
          ))}
        </section>

        {/* Musiqa — NFC profilda ham ijro etiladi va telefon ekrani
            o'chsa ham to'xtamaydi (MediaSession). */}
        <CompanyMusicPlayer tracks={company.music} companyName={company.displayName} coverUrl={company.logoUrl || company.coverUrl} />

        {/* BO'LIMLAR — shaxsiy profildagi bilan BIR XIL qator.
            Ilgari bu yerda "01 Xizmatlar" va "02 Yangiliklar"
            ustma-ust turardi: sahifa uzayib ketardi va istorya
            (lenta) umuman alohida bo'lim emas edi.

            "Post" — doimiy, "Lenta" — 24 soatlik. Bo'sh bo'lim
            chizilmaydi; katalog nomi kompaniya turiga qarab
            "Menyu" / "Tovarlar" / "Xizmatlar" bo'ladi. */}
        <ProfileTabs
          value={activeTab}
          onChange={setTab}
          tabs={[
            posts.length > 0 && { id: 'post', label: 'Post', count: posts.length },
            stories.length > 0 && { id: 'lenta', label: 'Lenta', count: stories.length },
            items.length > 0 && { id: 'katalog', label: cta.noun, count: items.length },
          ]}
        />

        {activeTab === 'katalog' && items.length > 0 && (
          <section className="cq-offers" id="catalog">
            <div className="cq-section-head"><div><h2>{t(cta.noun)}</h2></div><button type="button" className="vz-tap" onClick={() => navigate(`/company/${company.companyId.toLowerCase()}#catalog`)}>{t(cta.label)} →</button></div>
            <div className="cq-item-grid">
              {items.map((item) => <article key={item.id} className="min-w-0"><img src={item.imageUrl || company.coverUrl || fallbackCover} alt="" /><div><b className="break-words">{item.name}</b><p>{item.description || item.category}</p><strong>{fmt(item.price)} {t('so‘m')}</strong>{company.ordersEnabled && <button type="button" className="cq-order-btn vz-tap" onClick={() => { companyEvent(company.companyId, 'item', String(item.id)); setOrderItem(item); }}>{t('Buyurtma berish')}</button>}</div></article>)}
            </div>
          </section>
        )}

        {activeTab === 'lenta' && (
          <StoryGrid stories={stories} title={company.displayName} avatarUrl={company.logoUrl} />
        )}

        {activeTab === 'post' && posts.length > 0 && (
          <section className="cq-posts">
            <div className="cq-post-strip">
              {posts.map((p) => (
                <article key={p.id}>
                  {p.videoUrl
                    ? <video src={p.videoUrl} controls playsInline preload="none" />
                    : <img src={p.imageUrl} alt={p.caption || ''} loading="lazy" />}
                  {p.caption && <p>{p.caption}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* O'Z NFC ID RAQAMI — egasining so'rovi bo'yicha eng pastda,
            bo'limlar ostida. Bu kompaniyaning doimiy manzili. */}
        <div className="pf-nfcid">
          <i aria-hidden="true">◉</i>
          <div style={{ textAlign: 'center' }}>
            <b>{company.companyId}</b>
            <small>NFC ID · nfcstore.uz/c/{company.companyId.toLowerCase()}</small>
          </div>
        </div>

        <button type="button" className="cq-public vz-tap" onClick={() => navigate(`/company/${company.companyId.toLowerCase()}`)}>{t('Kompaniya saytini to‘liq ochish')} <span>↗</span></button>
        {/* KONTAKTNI SAQLASH — eng ostida, oltin yozuvda. NFC kartaning
            butun ma'nosi shu: odam sahifani yopgandan keyin ham
            raqamingiz uning telefonida qoladi. */}
        <button
          type="button" className="cq-save vz-tap"
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
        <footer><span>{t('NFC orqali ochildi')}</span><b>NFCSTORE BUSINESS</b></footer>
        {orderItem && <CompanyOrderModal companyId={company.companyId} item={orderItem} onClose={() => setOrderItem(null)} />}
        {showCard && <CardNumberModal cardNumber={company.cardNumber} holder={company.displayName} onClose={() => setShowCard(false)} />}
      </div>
    </main>
  );
}
