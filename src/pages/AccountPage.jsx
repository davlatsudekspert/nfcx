import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { googleDirectionsUrl } from '../lib/mapLink.js';
import { backdropProps } from '../lib/backdrop.js';
import CloseButton from '../components/CloseButton.jsx';
import { useAuth, authLogout, authUpdateCard } from '../lib/auth.jsx';
import { dbUploadImage, dbUploadCardVideo, dbUploadProfileBgMedia, PROFILE_BG_MAX_BYTES, dbUploadAudio, dbSetPrimary, dbDeleteOwnCard, dbOrderPhysicalCard, dbUploadCardPrint, dbRequestPremium, dbGetPayment, dbListWonPendingAuctions, dbListMyOrders, dbGiftCard, dbListGiftOffers, dbAcceptGift, dbRejectGift, dbCancelGift, dbSendSupportMessage, dbListMySupportMessages, dbListReferrals, dbListPosts, dbCreatePost, dbDeletePost, dbListStories, dbCreateStory, dbDeleteStory, dbGetMenuManage, dbAddMenuCategory, dbUpdateMenuCategory, dbDeleteMenuCategory, dbAddMenuItem, dbUpdateMenuItem, dbDeleteMenuItem, dbGetProductsManage, dbAddProductCategory, dbUpdateProductCategory, dbDeleteProductCategory, dbAddProduct, dbUpdateProduct, dbDeleteProduct, dbGetCatalogMeta, dbSaveCatalogPromotion, dbDeleteCatalogPromotion, dbGetServicesManage, dbAddServiceCategory, dbUpdateServiceCategory, dbDeleteServiceCategory, dbAddService, dbUpdateService, dbDeleteService, dbGetTeamManage, dbAddTeamMember, dbUpdateTeamMember, dbDeleteTeamMember, dbGetGalleryManage, dbAddGalleryImage, dbUpdateGalleryImage, dbDeleteGalleryImage } from '../lib/db.js';
import { navigate } from '../lib/router.js';
import { fmt, timeAgo, initials } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import { isEmbedMusic, isYoutubeMusic } from '../lib/music.js';
import { MESSAGING_ENABLED } from '../lib/features.js';
import { usePaymentsEnabled } from '../lib/paymentsEnabled.jsx';
import PaymentUnavailableNotice from '../components/PaymentUnavailableNotice.jsx';
import PaymeBlock from '../components/PaymeBlock.jsx';
import { openPayWindow } from '../lib/payWindow.js';
import { socialHandle } from '../lib/socialLinks.js';
import { MUSIC_LIMIT_FREE, MUSIC_LIMIT_PREMIUM, MUSIC_MAX_MB, musicLimit } from '../lib/musicLimits.js';
import LockedFeatureModal from '../components/LockedFeatureModal.jsx';
import { outerPageStyle, innerPanelStyle } from './ProfilePage.jsx';
import NfcCard from '../components/NfcCard.jsx';
import { PhoneFrame, MenuPreviewList, ProductsPreviewGrid, ServicesPreviewList, mergeDraftIntoCategories } from '../components/CompanyPhonePreview.jsx';
import StoryUploader from '../components/StoryUploader.jsx';
import StoryFeedBar from '../components/StoryFeedBar.jsx';
import { CARD_BACKGROUNDS, cardBackgroundFromUrl } from '../lib/cardBackgrounds.js';
import { listMyCompanies } from '../lib/company.js';
import { autoCropToContent, centerObject, removeBackground, whitenBackground, enhance } from '../lib/imageAI.js';
import { tierForCode, PROFILE_PREMIUM_FEE, PHYSICAL_CARD_FEE, PHYSICAL_CARD_FREE_DELIVERY_QTY, PHYSICAL_CARD_MAX_QTY, TIER_LABEL, tierLabelFor } from '../lib/pricing.js';
import { effectiveAccess, featureAllowed, menuEligible, productEligible, serviceEligible, businessModule, FEATURE_MIN, hasAccess } from '../lib/access.js';
import { useCategories, catName, findCat } from '../lib/categories.js';
const CardDesignerPage = lazy(() => import('./CardDesignerPage.jsx'));
import {
  IconLinkedIn, IconInstagram, IconTelegram, IconFacebook, IconX,
  IconPhone, IconGlobe, IconTag, IconLink, IconChevronDown, IconShare,
  IconCopy, IconImage, IconSupport, IconBell, IconChat, IconUser, IconCheck, IconStar,
} from '../components/Icons.jsx';

// Kabinet ichki ikonalari (Icons.jsx'da hali yo'q) — 18px, currentColor,
// Icons.jsx bilan bir xil uslub. Emoji o'rniga ishlatiladi.
const mkIcon = (paths) => function LocalIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths}</svg>
  );
};
const IconHome = mkIcon(<><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></>);
const IconGrid = mkIcon(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>);
const IconCog = mkIcon(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M4.9 19.1 7 17m10-10 2.1-2.1" /></>);
const IconGift = mkIcon(<><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12" /><path d="M12 8c-2-3-6-3-6-1s3 1 6 1zm0 0c2-3 6-3 6-1s-3 1-6 1z" /></>);
const IconTrash = mkIcon(<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />);
const IconEye = mkIcon(<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
const IconCrown = mkIcon(<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />);
const IconCard = mkIcon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>);
const IconMusic = mkIcon(<><path d="M9 18V6l11-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>);
const IconPin = mkIcon(<><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>);
const IconWallet = mkIcon(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h5M3 10h18" /></>);
const IconPalette = mkIcon(<><circle cx="12" cy="12" r="9" /><circle cx="8" cy="10" r="1.2" /><circle cx="12" cy="7" r="1.2" /><circle cx="16" cy="10" r="1.2" /><path d="M12 21a3 3 0 0 0 0-6h-1a2 2 0 0 1 0-4" /></>);
const IconPen = mkIcon(<><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M12 6l4 4" /></>);
const IconUsers = mkIcon(<><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14a5 5 0 0 1 6 5" /></>);
const IconIdCard = mkIcon(<><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="12" r="2" /><path d="M14 10h4M14 14h4M5 17h7" /></>);
const IconLock = mkIcon(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);
const IconBriefcase = mkIcon(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>);
const IconRefresh = mkIcon(<><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>);
const IconTrophy = mkIcon(<><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 5M16 6h3a3 3 0 0 1-3 5M12 13v4M8 21h8M10 17h4" /></>);
const IconWarn = mkIcon(<><path d="M12 3 2 21h20z" /><path d="M12 10v5m0 3v.5" /></>);

// Ro'yxat/so'rov holatlari — brief: loading (.vz-skel) / empty (.vz-empty) /
// error (matn + "Qayta urinish") / success. Har fetch bo'limi shu ikkitasini ishlatadi.
function SkeletonRows({ n = 3, h = 44 }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="vz-skel w-full" style={{ height: h }}></div>)}
    </div>
  );
}
function ErrorRetry({ text, onRetry }) {
  const { t } = useLanguage();
  return (
    <div className="vz-empty !border-error/40">
      <span className="text-error"><IconWarn /></span>
      <div className="text-sm text-base-content/70">{text || t("Server bilan aloqa yo'q. Qayta urinib ko'ring.")}</div>
      {onRetry && <button type="button" className="btn btn-outline-gold btn-sm min-h-11" onClick={onRetry}><IconRefresh width={14} height={14} /> {t('Qayta urinish')}</button>}
    </div>
  );
}

const THEMES = [
  { id: 'classic', label: 'Classic', css: 'linear-gradient(160deg,#241e17,#15120f)', accent: '#d4af5a' },
  { id: 'midnight', label: 'Onyx', css: 'linear-gradient(160deg,#0e0e10,#000000)', accent: '#ffffff' },
  { id: 'emerald', label: 'Graphite', css: 'linear-gradient(160deg,#3c4044,#2b2e31)', accent: '#9fb3bd' },
  { id: 'royal', label: 'Platinum', css: 'linear-gradient(160deg,#f3f5f8,#dfe3e9)', accent: '#5b6b85' },
  { id: 'sunset', label: 'Ink', css: 'linear-gradient(160deg,#161c3a,#0a0d1c)', accent: '#8ea2ff' },
  { id: 'gold', label: 'Gold', css: 'linear-gradient(160deg,#3a2a0c,#1a1206)', accent: '#f0c04a' },
  { id: 'glass', label: 'Shaffof', css: 'linear-gradient(160deg,#2a2f36,#0b0d10)', accent: '#cbd5e1' },
];

// Yig'iladigan/ochiladigan bo'lim — uzun formani mantiqiy blokларга ажратади.
// Yopiq (tarif yetmagan) dizayn kontrolini xira qilib, ustiga "bosing"
// qatlamini qo'yadi — bosilganda LockedFeatureModal ochiladi (onLock).
function Gate({ ok, onLock, children }) {
  const { t } = useLanguage();
  if (ok) return children;
  return (
    <div className="relative my-2 overflow-hidden rounded-xl">
      <div className="pointer-events-none select-none opacity-40 grayscale">{children}</div>
      <button
        type="button"
        onClick={onLock}
        className="absolute inset-0 flex items-center justify-center gap-1.5 bg-base-200/55 text-xs font-semibold text-base-content/75 transition hover:bg-base-200/70"
      >
        <IconLock width={14} height={14} /> {t('Premiumda ochiladi — bosing')}
      </button>
    </div>
  );
}

function Section({ title, subtitle, defaultOpen, openSignal, id, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  return (
    <div id={id} className={`mt-4 overflow-hidden rounded-2xl border bg-[color:var(--vz-card)] transition-all duration-200 first:mt-0 ${open ? 'border-accent/30 shadow-[0_10px_35px_rgba(0,0,0,0.35)]' : 'border-[color:var(--vz-line)] hover:border-white/20'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <div className="font-display text-[15px] font-semibold">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-base-content/45">{subtitle}</div>}
        </div>
        <span className={`shrink-0 text-base-content/50 transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`}>
          <IconChevronDown />
        </span>
      </button>
      {open && <div className="border-t border-white/10 px-4 pb-5 pt-4">{children}</div>}
    </div>
  );
}

// Restoran menyusi (Band 3.3) — egaga boshqaruv. Kategoriya → taom.
const MENU_ITEM_EMPTY = { name: '', description: '', price: '', discountPrice: '', imageUrl: '', available: true, featured: false };

// Rasm yuklashdan oldingi tahrirlash — "Avtomatik kesish"/"Markazlashtirish"
// HOZIR ishlaydi (canvas, provayder shart emas); "Fonni olib
// tashlash"/"Oq fon"/"Sifatni yaxshilash" hali ulanmagan — bosilganda
// aniq "tez orada" xabari ko'rsatiladi, hech qachon soxta natija bermaydi
// (Company System — Faz 17).
function ImageUploadTools({ canImage, imageUrl, busy, onPicked }) {
  const { t } = useLanguage();
  const [pending, setPending] = useState(null);
  const [toolBusy, setToolBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (!canImage) return null;

  const pickFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setMsg('');
    try { setPending(await fileToCompressedDataUrl(file)); }
    catch (err) { setMsg(err.message || t('Xatolik yuz berdi.')); }
  };
  const runTool = async (fn) => {
    if (!pending) return;
    setToolBusy(true); setMsg('');
    try {
      const res = await fn(pending);
      if (res.ok) setPending(res.dataUrl);
      else setMsg(res.reason || t('Hozircha mavjud emas.'));
    } finally { setToolBusy(false); }
  };
  const confirm = async () => {
    const dataUrl = pending;
    setPending(null);
    await onPicked(dataUrl);
  };

  if (pending) {
    return (
      <div className="w-full space-y-2 rounded-xl border border-accent/30 bg-black/20 p-2.5">
        <img src={pending} alt="" className="mx-auto h-24 w-24 rounded-lg object-cover" />
        {msg && <div className="text-center text-[13px] text-warning">{msg}</div>}
        <div className="flex flex-wrap justify-center gap-1">
          <button type="button" className="btn btn-ghost btn-xs" disabled={toolBusy} onClick={() => runTool(autoCropToContent)}>{t('Avtomatik kesish')}</button>
          <button type="button" className="btn btn-ghost btn-xs" disabled={toolBusy} onClick={() => runTool(centerObject)}>{t('Markazlashtirish')}</button>
          <button type="button" className="btn btn-ghost btn-xs opacity-50" disabled={toolBusy} title={t('Tez orada')} onClick={() => runTool(removeBackground)}>{t('Fonni olib tashlash')}</button>
          <button type="button" className="btn btn-ghost btn-xs opacity-50" disabled={toolBusy} title={t('Tez orada')} onClick={() => runTool(whitenBackground)}>{t('Oq fon qilish')}</button>
          <button type="button" className="btn btn-ghost btn-xs opacity-50" disabled={toolBusy} title={t('Tez orada')} onClick={() => runTool(enhance)}>{t('Sifatni yaxshilash')}</button>
        </div>
        <div className="flex justify-center gap-2">
          <button type="button" className="btn btn-primary btn-xs" disabled={toolBusy} onClick={confirm}>{t('Rasmni saqlash')}</button>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setPending(null)}>{t('Bekor')}</button>
        </div>
      </div>
    );
  }
  return (
    <label className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-base-100 text-[13px] text-base-content/40">
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : (busy ? '…' : t('rasm'))}
      <input type="file" accept="image/*" className="hidden" onChange={pickFile} />
    </label>
  );
}

function MenuItemRow({ code, item, canImage, onChanged, onDeleted, onDraftChange, onDraftEnd }) {
  const { t } = useLanguage();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(item);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => {
    const next = { ...s, [k]: e.target.value };
    onDraftChange?.(next);
    return next;
  });

  const save = async () => {
    setBusy(true);
    try {
      const row = await dbUpdateMenuItem(code, item.id, {
        name: f.name, description: f.description,
        price: f.price === '' ? null : f.price,
        discountPrice: f.discountPrice === '' ? null : f.discountPrice,
        available: f.available, featured: f.featured,
      });
      onChanged(row); setEdit(false); onDraftEnd?.();
    } finally { setBusy(false); }
  };
  const toggle = async (field) => {
    const row = await dbUpdateMenuItem(code, item.id, { [field]: !item[field] });
    onChanged(row);
  };
  const del = async () => {
    if (!confirm(t('Bu taomni o‘chirasizmi?'))) return;
    await dbDeleteMenuItem(code, item.id); onDeleted(item.id);
  };
  const applyImage = async (dataUrl) => {
    if (!dataUrl) return;
    setBusy(true);
    try {
      const url = await dbUploadImage(dataUrl);
      const row = await dbUpdateMenuItem(code, item.id, { imageUrl: url });
      onChanged(row);
    } catch { /* jim */ } finally { setBusy(false); }
  };

  if (edit) {
    return (
      <div className="rounded-xl border border-accent/30 bg-black/20 p-3 space-y-2">
        <input className="input input-bordered input-sm w-full bg-base-100" value={f.name} onChange={set('name')} placeholder={t('Taom nomi')} />
        <textarea className="textarea textarea-bordered textarea-sm w-full bg-base-100" rows={2} value={f.description || ''} onChange={set('description')} placeholder={t('Tavsif')} />
        <div className="flex gap-2">
          <input className="input input-bordered input-sm w-full bg-base-100" type="number" value={f.price ?? ''} onChange={set('price')} placeholder={t('Narx')} />
          <input className="input input-bordered input-sm w-full bg-base-100" type="number" value={f.discountPrice ?? ''} onChange={set('discountPrice')} placeholder={t('Chegirma narxi')} />
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-xs" onClick={save} disabled={busy}>{t('Saqlash')}</button>
          <button className="btn btn-ghost btn-xs" onClick={() => { setF(item); setEdit(false); onDraftEnd?.(); }}>{t('Bekor')}</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap gap-2.5 rounded-xl border border-white/10 bg-black/20 p-2.5 ${item.available ? '' : 'opacity-50'}`}>
      <ImageUploadTools canImage={canImage} imageUrl={item.imageUrl} busy={busy} onPicked={applyImage} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5 text-sm font-semibold">
          {item.featured && <span className="shrink-0 text-[color:var(--vz-gold)]"><IconStar width={12} height={12} /></span>}
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {item.price != null && (
            <span className="shrink-0 text-xs text-base-content/60">
              {fmt(item.price)}{item.discountPrice != null ? ` → ${fmt(item.discountPrice)}` : ''}
            </span>
          )}
        </div>
        {item.description && <div className="truncate text-[14px] text-base-content/50">{item.description}</div>}
        <div className="mt-1.5 flex items-center gap-1">
          <button className="btn btn-ghost btn-xs px-2" title={t('Tahrirlash')} onClick={() => { setF(item); setEdit(true); onDraftChange?.(item); }} aria-label={t('Tahrirlash')}><IconPen width={14} height={14} /></button>
          <button className="btn btn-ghost btn-xs px-2" title={item.available ? t('Yo‘q deb belgilash') : t('Bor deb belgilash')} onClick={() => toggle('available')}>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.available ? 'bg-success' : 'bg-base-content/30'}`} aria-hidden="true"></span>
          </button>
          <button className="btn btn-ghost btn-xs px-2" title={item.featured ? t('Tavsiyadan olib tashlash') : t('Tavsiya qilish')} onClick={() => toggle('featured')}>
            <span className={item.featured ? 'text-[color:var(--vz-gold)]' : 'text-base-content/40'}><IconStar width={14} height={14} /></span>
          </button>
          <button className="btn btn-ghost btn-xs px-2 text-error" title={t("O'chirish")} aria-label={t("O'chirish")} onClick={del}><IconTrash width={14} height={14} /></button>
        </div>
      </div>
    </div>
  );
}

// Ulashiladigan public URL qatori (Company System — Faz 9/10). Har bir
// biznes bo'lim ("menyu", "mahsulotlar") uchun alohida ulashish mumkin
// bo'lgan havolani ko'rsatadi — yangi NFC ID talab qilinmaydi.
function ShareLinkRow({ code, sub }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/${code.toLowerCase()}/${sub}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* jim tur */ }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
      <span className="shrink-0 text-base-content/40"><IconLink width={14} height={14} /></span>
      <code className="min-w-0 flex-1 truncate text-[14px] font-mono text-base-content/70">{link}</code>
      <button type="button" className="btn btn-ghost btn-xs shrink-0" onClick={copy}>{copied ? t('Nusxalandi!') : t('Nusxalash')}</button>
    </div>
  );
}

function MenuManagerSection({ code, allowed, onLock }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [adding, setAdding] = useState({}); // catId -> MENU_ITEM_EMPTY
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // Live Phone Preview (Faz 6) — hozir tahrirlanayotgan/qo'shilayotgan
  // element, local state — backend'ga har harfda so'rov yubormaydi.
  const [draft, setDraft] = useState(null);
  const [mobilePreview, setMobilePreview] = useState(false);

  const load = () => dbGetMenuManage(code).then(setData).catch(() => setErr(true));
  useEffect(() => { if (allowed) load(); }, [code, allowed]);

  if (!allowed) {
    return (
      <button type="button" onClick={onLock}
        className="w-full rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-left text-sm text-base-content/70 transition hover:bg-accent/10">
        <IconLock width={14} height={14} /> {t('Restoran menyusi — Silver NFC ID yoki undan yuqorida ochiladi.')}
      </button>
    );
  }
  if (err) return <ErrorRetry text={t('Menyuni yuklab bo‘lmadi.')} onRetry={() => { setErr(false); setData(null); load(); }} />;
  if (!data) return <SkeletonRows n={3} h={56} />;

  const { menu, limits, counts } = data;
  const eligible = data.eligible !== false;
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  const previewCategories = mergeDraftIntoCategories(menu, draft);

  const addCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    setBusy(true);
    try {
      await dbAddMenuCategory(code, { name });
      setNewCat(''); await load();
    } catch (e) {
      flash(e.message === 'limit_reached' ? t('Kategoriya limiti tugadi ({n} ta).', { n: e.limit })
        : e.message === 'not_restaurant' ? t('Menyu faqat "Restoran va ovqatlanish" sohasidagi profillar uchun. "Profil turi" bo‘limida sohani tanlang.')
        : t('Xatolik yuz berdi.'));
    } finally { setBusy(false); }
  };
  const updCat = async (id, patch) => { await dbUpdateMenuCategory(code, id, patch); await load(); };
  const delCat = async (id) => {
    if (!confirm(t('Kategoriya va uning barcha taomlari o‘chadi. Davom etamizmi?'))) return;
    await dbDeleteMenuCategory(code, id); await load();
  };
  const addItem = async (catId) => {
    const f = adding[catId] || MENU_ITEM_EMPTY;
    if (!f.name.trim()) return;
    setBusy(true);
    try {
      await dbAddMenuItem(code, {
        categoryId: catId, name: f.name, description: f.description,
        price: f.price === '' ? null : f.price,
        discountPrice: f.discountPrice === '' ? null : f.discountPrice,
        available: true,
      });
      setAdding((s) => ({ ...s, [catId]: MENU_ITEM_EMPTY }));
      setDraft(null);
      await load();
    } catch (e) {
      flash(e.message === 'limit_reached' ? t('Taom limiti tugadi ({n} ta).', { n: e.limit })
        : e.message === 'not_restaurant' ? t('Menyu faqat "Restoran va ovqatlanish" sohasidagi profillar uchun. "Profil turi" bo‘limida sohani tanlang.')
        : t('Xatolik yuz berdi.'));
    } finally { setBusy(false); }
  };

  const setAddF = (catId, k) => (e) => {
    const val = e.target.value;
    setAdding((s) => {
      const next = { ...(s[catId] || MENU_ITEM_EMPTY), [k]: val };
      setDraft({ ...next, id: '__draft__', categoryId: catId });
      return { ...s, [catId]: next };
    });
  };

  const editorBody = (
    <div className="space-y-4">
      {!eligible && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200/90">
          {t('Menyu faqat "Restoran va ovqatlanish" sohasidagi profillar uchun. "Profil turi" bo‘limida sohani tanlang.')}
        </div>
      )}
      <div className="text-xs text-base-content/50">
        {t('Kategoriyalar')}: {counts.cats}/{limits.cat} · {t('Taomlar')}: {counts.items}/{limits.item}
        {!limits.images && ` · ${t('rasm Gold+ dan')}`}
      </div>
      <ShareLinkRow code={code} sub="menyu" />
      {msg && <div className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{msg}</div>}

      {menu.map((cat) => (
        <div key={cat.id} className={`rounded-2xl border border-white/10 bg-base-200/40 p-3 ${cat.enabled ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-1">
            <input
              className="input input-ghost input-sm min-w-0 flex-1 px-1 font-semibold"
              defaultValue={cat.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== cat.name && updCat(cat.id, { name: e.target.value.trim() })}
            />
            <button className="btn btn-ghost btn-xs shrink-0 px-2" title={cat.enabled ? t('Yashirish') : t('Chiqarish')} onClick={() => updCat(cat.id, { enabled: !cat.enabled })}><span className={`inline-block h-2.5 w-2.5 rounded-full ${cat.enabled ? 'bg-success' : 'bg-base-content/30'}`} aria-hidden="true"></span></button>
            <button className="btn btn-ghost btn-xs shrink-0 px-2 text-error" title={t("O'chirish")} aria-label={t("O'chirish")} onClick={() => delCat(cat.id)}><IconTrash width={14} height={14} /></button>
          </div>
          <div className="mt-2 space-y-2">
            {cat.items.map((it) => (
              <MenuItemRow
                key={it.id} code={code} item={it} canImage={limits.images}
                onChanged={() => load()} onDeleted={() => load()}
                onDraftChange={(f) => setDraft({ ...f, categoryId: cat.id })}
                onDraftEnd={() => setDraft(null)}
              />
            ))}
          </div>
          {eligible && (
            <div className="mt-2 space-y-1.5">
              <input className="input input-bordered input-xs w-full bg-base-100" placeholder={t('Yangi taom nomi')}
                value={(adding[cat.id] || MENU_ITEM_EMPTY).name} onChange={setAddF(cat.id, 'name')} />
              <div className="flex gap-1.5">
                <input className="input input-bordered input-xs min-w-0 flex-1 bg-base-100" type="number" placeholder={t('Narx')}
                  value={(adding[cat.id] || MENU_ITEM_EMPTY).price} onChange={setAddF(cat.id, 'price')} />
                <button className="btn btn-primary btn-xs shrink-0" onClick={() => addItem(cat.id)} disabled={busy}>{t("+ Qo'shish")}</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {eligible && counts.cats < limits.cat && (
        <div className="flex gap-2">
          <input className="input input-bordered input-sm min-w-0 flex-1 bg-base-100" placeholder={t('Yangi kategoriya (masalan: Ichimliklar)')}
            value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={addCat} disabled={busy}>{t("Qo‘shish")}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_296px] lg:items-start lg:gap-6">
      {editorBody}

      {/* Desktop — jonli preview yon tomonda (sticky) */}
      <div className="hidden lg:sticky lg:top-20 lg:block">
        <PhoneFrame label={t('Jonli ko‘rinish')}>
          <MenuPreviewList categories={previewCategories} t={t} />
        </PhoneFrame>
      </div>

      {/* Mobil — suzuvchi "Ko'rish" tugmasi + fullscreen preview */}
      <button type="button" onClick={() => setMobilePreview(true)}
        className="fixed bottom-20 right-4 z-30 flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-accent-content shadow-lg lg:hidden">
        <IconEye width={14} height={14} /> {t('Ko‘rish')}
      </button>
      {mobilePreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/85 p-4 lg:hidden" onClick={() => setMobilePreview(false)}>
          <div className="mx-auto mt-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-sm font-bold text-white">
              {t('Jonli ko‘rinish')}
              <CloseButton onClick={() => setMobilePreview(false)} />
            </div>
            <PhoneFrame>
              <MenuPreviewList categories={previewCategories} t={t} />
            </PhoneFrame>
          </div>
        </div>
      )}
    </div>
  );
}

// Mahsulotlar katalogi (Company System — Products) — Menyu bilan bir xil
// naqsh, lekin soha bilan cheklanmagan (istalgan biznes profil uchun).
const PRODUCT_EMPTY = { name: '', description: '', price: '', discountPrice: '', imageUrl: '', available: true, featured: false };

function ProductItemRow({ code, item, canImage, onChanged, onDeleted, onDraftChange, onDraftEnd }) {
  const { t } = useLanguage();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(item);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => {
    const next = { ...s, [k]: e.target.value };
    onDraftChange?.(next);
    return next;
  });

  const save = async () => {
    setBusy(true);
    try {
      const row = await dbUpdateProduct(code, item.id, {
        name: f.name, description: f.description,
        price: f.price === '' ? null : f.price,
        discountPrice: f.discountPrice === '' ? null : f.discountPrice,
        available: f.available, featured: f.featured,
      });
      onChanged(row); setEdit(false); onDraftEnd?.();
    } finally { setBusy(false); }
  };
  const toggle = async (field) => {
    const row = await dbUpdateProduct(code, item.id, { [field]: !item[field] });
    onChanged(row);
  };
  const del = async () => {
    if (!confirm(t('Bu mahsulotni o‘chirasizmi?'))) return;
    await dbDeleteProduct(code, item.id); onDeleted(item.id);
  };
  const applyImage = async (dataUrl) => {
    if (!dataUrl) return;
    setBusy(true);
    try {
      const url = await dbUploadImage(dataUrl);
      const row = await dbUpdateProduct(code, item.id, { imageUrl: url });
      onChanged(row);
    } catch { /* jim */ } finally { setBusy(false); }
  };

  if (edit) {
    return (
      <div className="rounded-xl border border-accent/30 bg-black/20 p-3 space-y-2">
        <input className="input input-bordered input-sm w-full bg-base-100" value={f.name} onChange={set('name')} placeholder={t('Mahsulot nomi')} />
        <textarea className="textarea textarea-bordered textarea-sm w-full bg-base-100" rows={2} value={f.description || ''} onChange={set('description')} placeholder={t('Tavsif')} />
        <div className="flex gap-2">
          <input className="input input-bordered input-sm w-full bg-base-100" type="number" value={f.price ?? ''} onChange={set('price')} placeholder={t('Narx')} />
          <input className="input input-bordered input-sm w-full bg-base-100" type="number" value={f.discountPrice ?? ''} onChange={set('discountPrice')} placeholder={t('Chegirma narxi')} />
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-xs" onClick={save} disabled={busy}>{t('Saqlash')}</button>
          <button className="btn btn-ghost btn-xs" onClick={() => { setF(item); setEdit(false); onDraftEnd?.(); }}>{t('Bekor')}</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap gap-2.5 rounded-xl border border-white/10 bg-black/20 p-2.5 ${item.available ? '' : 'opacity-50'}`}>
      <ImageUploadTools canImage={canImage} imageUrl={item.imageUrl} busy={busy} onPicked={applyImage} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5 text-sm font-semibold">
          {item.featured && <span className="shrink-0 text-[color:var(--vz-gold)]"><IconStar width={12} height={12} /></span>}
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {item.price != null && (
            <span className="shrink-0 text-xs text-base-content/60">
              {fmt(item.price)}{item.discountPrice != null ? ` → ${fmt(item.discountPrice)}` : ''}
            </span>
          )}
        </div>
        {item.description && <div className="truncate text-[14px] text-base-content/50">{item.description}</div>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-base-content/55">
          <span className="rounded-full border border-rose-400/20 bg-rose-400/5 px-2 py-0.5 text-rose-300">♥ {fmt(item.engagement?.likes || 0)}</span>
          <span className="rounded-full border border-white/10 bg-white/[.02] px-2 py-0.5">↓ {fmt(item.engagement?.dislikes || 0)}</span>
          <span className="rounded-full border border-accent/20 bg-accent/5 px-2 py-0.5 text-accent">◉ {fmt(item.engagement?.views || 0)}</span>
          {item.engagement?.promotion?.active && new Date(item.engagement.promotion.endsAt).getTime() > Date.now() && <span className="rounded-full bg-accent px-2 py-0.5 text-accent-content">◆ {t('AKSIYA')}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <button className="btn btn-ghost btn-xs px-2" title={t('Tahrirlash')} onClick={() => { setF(item); setEdit(true); onDraftChange?.(item); }} aria-label={t('Tahrirlash')}><IconPen width={14} height={14} /></button>
          <button className="btn btn-ghost btn-xs px-2" title={item.available ? t('Yo‘q deb belgilash') : t('Bor deb belgilash')} onClick={() => toggle('available')}>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.available ? 'bg-success' : 'bg-base-content/30'}`} aria-hidden="true"></span>
          </button>
          <button className="btn btn-ghost btn-xs px-2" title={item.featured ? t('Tavsiyadan olib tashlash') : t('Tavsiya qilish')} onClick={() => toggle('featured')}>
            <span className={item.featured ? 'text-[color:var(--vz-gold)]' : 'text-base-content/40'}><IconStar width={14} height={14} /></span>
          </button>
          <button className="btn btn-ghost btn-xs px-2 text-error" title={t("O'chirish")} aria-label={t("O'chirish")} onClick={del}><IconTrash width={14} height={14} /></button>
        </div>
      </div>
    </div>
  );
}

function ProductManagerSection({ code, allowed, onLock }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [adding, setAdding] = useState({}); // catId -> PRODUCT_EMPTY
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // Live Phone Preview (Faz 8) — MenuManagerSection bilan bir xil naqsh.
  const [draft, setDraft] = useState(null);
  const [mobilePreview, setMobilePreview] = useState(false);

  const load = () => Promise.all([dbGetProductsManage(code), dbGetCatalogMeta(code, 'products')])
    .then(([payload, meta]) => setData({
      ...payload,
      products: payload.products.map((category) => ({
        ...category,
        items: category.items.map((item) => ({ ...item, engagement: meta.items?.[String(item.id)] || {} })),
      })),
    }))
    .catch(() => setErr(true));
  useEffect(() => { if (allowed) load(); }, [code, allowed]);

  if (!allowed) {
    return (
      <button type="button" onClick={onLock}
        className="w-full rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-left text-sm text-base-content/70 transition hover:bg-accent/10">
        <IconLock width={14} height={14} /> {t('Mahsulotlar katalogi — Silver NFC ID yoki undan yuqorida ochiladi.')}
      </button>
    );
  }
  if (err) return <ErrorRetry text={t('Katalogni yuklab bo‘lmadi.')} onRetry={() => { setErr(false); setData(null); load(); }} />;
  if (!data) return <SkeletonRows n={3} h={56} />;

  const { products, limits, counts } = data;
  const eligible = data.eligible !== false;
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  const previewCategories = mergeDraftIntoCategories(products, draft);

  const addCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    setBusy(true);
    try {
      await dbAddProductCategory(code, { name });
      setNewCat(''); await load();
    } catch (e) {
      flash(e.message === 'limit_reached' ? t('Kategoriya limiti tugadi ({n} ta).', { n: e.limit })
        : e.message === 'not_business' ? t('Mahsulotlar katalogi faqat biznes profillar uchun. "Profil turi" bo‘limida "Biznes"ni tanlang.')
        : t('Xatolik yuz berdi.'));
    } finally { setBusy(false); }
  };
  const updCat = async (id, patch) => { await dbUpdateProductCategory(code, id, patch); await load(); };
  const delCat = async (id) => {
    if (!confirm(t('Kategoriya va uning barcha mahsulotlari o‘chadi. Davom etamizmi?'))) return;
    await dbDeleteProductCategory(code, id); await load();
  };
  const addItem = async (catId) => {
    const f = adding[catId] || PRODUCT_EMPTY;
    if (!f.name.trim()) return;
    setBusy(true);
    try {
      await dbAddProduct(code, {
        categoryId: catId, name: f.name, description: f.description,
        price: f.price === '' ? null : f.price,
        discountPrice: f.discountPrice === '' ? null : f.discountPrice,
        available: true,
      });
      setAdding((s) => ({ ...s, [catId]: PRODUCT_EMPTY }));
      setDraft(null);
      await load();
    } catch (e) {
      flash(e.message === 'limit_reached' ? t('Mahsulot limiti tugadi ({n} ta).', { n: e.limit })
        : e.message === 'not_business' ? t('Mahsulotlar katalogi faqat biznes profillar uchun. "Profil turi" bo‘limida "Biznes"ni tanlang.')
        : t('Xatolik yuz berdi.'));
    } finally { setBusy(false); }
  };

  const setAddF = (catId, k) => (e) => {
    const val = e.target.value;
    setAdding((s) => {
      const next = { ...(s[catId] || PRODUCT_EMPTY), [k]: val };
      setDraft({ ...next, id: '__draft__', categoryId: catId });
      return { ...s, [catId]: next };
    });
  };

  const editorBody = (
    <div className="space-y-4">
      {!eligible && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200/90">
          {t('Mahsulotlar katalogi faqat biznes profillar uchun. "Profil turi" bo‘limida "Biznes"ni tanlang.')}
        </div>
      )}
      <div className="text-xs text-base-content/50">
        {t('Kategoriyalar')}: {counts.cats}/{limits.cat} · {t('Mahsulotlar')}: {counts.items}/{limits.item}
        {!limits.images && ` · ${t('rasm Gold+ dan')}`}
      </div>
      <ShareLinkRow code={code} sub="mahsulotlar" />
      {msg && <div className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{msg}</div>}

      {products.map((cat) => (
        <div key={cat.id} className={`rounded-2xl border border-white/10 bg-base-200/40 p-3 ${cat.enabled ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-1">
            <input
              className="input input-ghost input-sm min-w-0 flex-1 px-1 font-semibold"
              defaultValue={cat.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== cat.name && updCat(cat.id, { name: e.target.value.trim() })}
            />
            <button className="btn btn-ghost btn-xs shrink-0 px-2" title={cat.enabled ? t('Yashirish') : t('Chiqarish')} onClick={() => updCat(cat.id, { enabled: !cat.enabled })}><span className={`inline-block h-2.5 w-2.5 rounded-full ${cat.enabled ? 'bg-success' : 'bg-base-content/30'}`} aria-hidden="true"></span></button>
            <button className="btn btn-ghost btn-xs shrink-0 px-2 text-error" title={t("O'chirish")} aria-label={t("O'chirish")} onClick={() => delCat(cat.id)}><IconTrash width={14} height={14} /></button>
          </div>
          <div className="mt-2 space-y-2">
            {cat.items.map((it) => (
              <ProductItemRow
                key={it.id} code={code} item={it} canImage={limits.images}
                onChanged={() => load()} onDeleted={() => load()}
                onDraftChange={(f) => setDraft({ ...f, categoryId: cat.id })}
                onDraftEnd={() => setDraft(null)}
              />
            ))}
          </div>
          {eligible && (
            <div className="mt-2 space-y-1.5">
              <input className="input input-bordered input-xs w-full bg-base-100" placeholder={t('Yangi mahsulot nomi')}
                value={(adding[cat.id] || PRODUCT_EMPTY).name} onChange={setAddF(cat.id, 'name')} />
              <div className="flex gap-1.5">
                <input className="input input-bordered input-xs min-w-0 flex-1 bg-base-100" type="number" placeholder={t('Narx')}
                  value={(adding[cat.id] || PRODUCT_EMPTY).price} onChange={setAddF(cat.id, 'price')} />
                <button className="btn btn-primary btn-xs shrink-0" onClick={() => addItem(cat.id)} disabled={busy}>{t("+ Qo'shish")}</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {eligible && counts.cats < limits.cat && (
        <div className="flex gap-2">
          <input className="input input-bordered input-sm min-w-0 flex-1 bg-base-100" placeholder={t('Yangi kategoriya (masalan: Aksessuarlar)')}
            value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={addCat} disabled={busy}>{t("Qo‘shish")}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_296px] lg:items-start lg:gap-6">
      {editorBody}

      {/* Desktop — jonli preview yon tomonda (sticky) */}
      <div className="hidden lg:sticky lg:top-20 lg:block">
        <PhoneFrame label={t('Jonli ko‘rinish')}>
          <ProductsPreviewGrid categories={previewCategories} t={t} />
        </PhoneFrame>
      </div>

      {/* Mobil — suzuvchi "Ko'rish" tugmasi + fullscreen preview */}
      <button type="button" onClick={() => setMobilePreview(true)}
        className="fixed bottom-20 right-4 z-30 flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-accent-content shadow-lg lg:hidden">
        <IconEye width={14} height={14} /> {t('Ko‘rish')}
      </button>
      {mobilePreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/85 p-4 lg:hidden" onClick={() => setMobilePreview(false)}>
          <div className="mx-auto mt-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-sm font-bold text-white">
              {t('Jonli ko‘rinish')}
              <CloseButton onClick={() => setMobilePreview(false)} />
            </div>
            <PhoneFrame>
              <ProductsPreviewGrid categories={previewCategories} t={t} />
            </PhoneFrame>
          </div>
        </div>
      )}
    </div>
  );
}

function remainingPromotionDays(promotion) {
  if (!promotion?.endsAt) return 7;
  return Math.max(1, Math.ceil((new Date(promotion.endsAt).getTime() - Date.now()) / 86400000));
}

function PromotionProductRow({ code, item, onSaved }) {
  const { t } = useLanguage();
  const promotion = item.engagement?.promotion;
  const live = Boolean(promotion?.active && new Date(promotion.endsAt).getTime() > Date.now());
  const [form, setForm] = useState({
    oldPrice: promotion?.oldPrice ?? item.price ?? '',
    newPrice: promotion?.newPrice ?? item.discountPrice ?? '',
    days: remainingPromotionDays(promotion),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async () => {
    const oldPrice = Math.round(Number(form.oldPrice));
    const newPrice = Math.round(Number(form.newPrice));
    const days = Math.max(1, Math.min(365, Math.round(Number(form.days) || 1)));
    if (!(oldPrice > 0) || !(newPrice > 0) || newPrice >= oldPrice) {
      setMessage(t('Yangi narx eski narxdan kichik bo‘lishi kerak.'));
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await dbUpdateProduct(code, item.id, { price: oldPrice, discountPrice: newPrice });
      await dbSaveCatalogPromotion(code, 'products', item.id, { oldPrice, newPrice, days });
      setMessage(`✓ ${t('Aksiya saqlandi')}`);
      await onSaved();
    } catch (error) {
      setMessage(error.message === 'forbidden' ? t('Faqat profil egasi aksiyani o‘zgartira oladi.') : t('Aksiyani saqlab bo‘lmadi.'));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setMessage('');
    try {
      await dbDeleteCatalogPromotion(code, 'products', item.id);
      await dbUpdateProduct(code, item.id, { discountPrice: null });
      setMessage(`✓ ${t('Aksiya yakunlandi')}`);
      await onSaved();
    } catch {
      setMessage(t('Aksiyani yakunlab bo‘lmadi.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`overflow-hidden rounded-2xl border bg-black/20 ${live ? 'border-accent/45 shadow-[0_20px_55px_rgba(0,0,0,.22)]' : 'border-white/10'}`}>
      <div className="grid gap-4 p-4 sm:grid-cols-[112px_1fr]">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
          {item.imageUrl ? <img className="h-28 w-full object-cover sm:h-full" src={item.imageUrl} alt="" /> : <div className="flex h-28 items-center justify-center text-3xl font-black text-accent">{item.name?.slice(0, 1)}</div>}
          {live && <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-1 text-[9px] font-black text-accent-content">◆ {t('FAOL')}</span>}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-display text-base font-bold">{item.name}</h3><p className="mt-0.5 text-[14px] text-base-content/45">{item.categoryName}</p></div>
            <div className="flex gap-1 text-[13px] font-semibold"><span className="rounded-full border border-rose-400/20 px-2 py-1 text-rose-300">♥ {fmt(item.engagement?.likes || 0)}</span><span className="rounded-full border border-white/10 px-2 py-1">↓ {fmt(item.engagement?.dislikes || 0)}</span><span className="rounded-full border border-accent/20 px-2 py-1 text-accent">◉ {fmt(item.engagement?.views || 0)}</span></div>
          </div>
          {live && <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-accent">◆ {remainingPromotionDays(promotion)} {t('kun qoldi')} · {fmt(promotion.oldPrice)} → <b>{fmt(promotion.newPrice)} {t('so‘m')}</b></div>}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="form-control"><span className="mb-1 text-[13px] font-semibold text-base-content/55">{t('Eski narx')}</span><input className="input input-bordered input-sm w-full bg-base-100" type="number" value={form.oldPrice} onChange={change('oldPrice')} /></label>
            <label className="form-control"><span className="mb-1 text-[13px] font-semibold text-base-content/55">{t('Yangi narx')}</span><input className="input input-bordered input-sm w-full bg-base-100" type="number" value={form.newPrice} onChange={change('newPrice')} /></label>
            <label className="form-control"><span className="mb-1 text-[13px] font-semibold text-base-content/55">{t('Aksiya muddati (kun)')}</span><input className="input input-bordered input-sm w-full bg-base-100" type="number" min="1" max="365" value={form.days} onChange={change('days')} /></label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? <span className="loading loading-spinner loading-xs" /> : `◆ ${live ? t('Yangilash') : t('Aksiyani boshlash')}`}</button>{live && <button type="button" className="btn btn-ghost btn-sm text-error" onClick={stop} disabled={busy}>{t('Aksiyani yakunlash')}</button>}{message && <span className={`text-[14px] ${message.startsWith('✓') ? 'text-success' : 'text-error'}`}>{message}</span>}</div>
        </div>
      </div>
    </article>
  );
}

function PromotionsManagerSection({ code, allowed, onLock }) {
  const { t } = useLanguage();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const load = async () => {
    try {
      const [payload, meta] = await Promise.all([dbGetProductsManage(code), dbGetCatalogMeta(code, 'products')]);
      setItems(payload.products.flatMap((category) => category.items.map((item) => ({
        ...item,
        categoryName: category.name,
        engagement: meta.items?.[String(item.id)] || {},
      }))));
      setError(false);
    } catch {
      setError(true);
    }
  };
  useEffect(() => { if (allowed) load(); }, [code, allowed]);

  if (!allowed) return <button type="button" onClick={onLock} className="w-full rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-left text-sm text-base-content/70"><IconLock width={14} height={14} /> {t('Aksiyalar mahsulotlar katalogi bilan birga ochiladi.')}</button>;
  if (error) return <ErrorRetry text={t('Aksiyalarni yuklab bo‘lmadi.')} onRetry={load} />;
  if (!items) return <SkeletonRows n={3} h={56} />;
  if (!items.length) return <div className="vz-empty"><span className="text-sm">{t('Avval katalogga mahsulot qo‘shing, keyin unga aksiya belgilang.')}</span></div>;

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-accent/25 bg-accent/5 p-4"><div className="text-sm font-bold text-accent">◆ {t('Aksiya boshqaruvi')}</div><p className="mt-1 text-xs leading-relaxed text-base-content/55">{t('Eski va yangi narxni, aksiya davomiyligini belgilang. Taklif public profildagi “Aksiyalar” bo‘limiga avtomatik chiqadi.')}</p></div>
      <div className="space-y-3">{items.map((item) => <PromotionProductRow key={item.id} code={code} item={item} onSaved={load} />)}</div>
    </div>
  );
}

// Xizmatlar katalogi (Business Workspace) — Products bilan bir xil naqsh,
// qo'shimcha maydon: narx turi (belgilangan / dan boshlab / kelishiladi).
const SERVICE_EMPTY = { name: '', description: '', price: '', priceType: 'fixed', imageUrl: '', available: true, featured: false };
const PRICE_TYPE_LABEL = { fixed: 'Belgilangan', from: 'Dan boshlab', negotiable: 'Kelishiladi' };

function ServiceItemRow({ code, item, canImage, onChanged, onDeleted, onDraftChange, onDraftEnd }) {
  const { t } = useLanguage();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(item);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => {
    const next = { ...s, [k]: e.target.value };
    onDraftChange?.(next);
    return next;
  });

  const save = async () => {
    setBusy(true);
    try {
      const row = await dbUpdateService(code, item.id, {
        name: f.name, description: f.description,
        price: f.price === '' ? null : f.price,
        priceType: f.priceType || 'fixed',
        available: f.available, featured: f.featured,
      });
      onChanged(row); setEdit(false); onDraftEnd?.();
    } finally { setBusy(false); }
  };
  const toggle = async (field) => {
    const row = await dbUpdateService(code, item.id, { [field]: !item[field] });
    onChanged(row);
  };
  const del = async () => {
    if (!confirm(t('Bu xizmatni o‘chirasizmi?'))) return;
    await dbDeleteService(code, item.id); onDeleted(item.id);
  };
  const applyImage = async (dataUrl) => {
    if (!dataUrl) return;
    setBusy(true);
    try {
      const url = await dbUploadImage(dataUrl);
      const row = await dbUpdateService(code, item.id, { imageUrl: url });
      onChanged(row);
    } catch { /* jim */ } finally { setBusy(false); }
  };

  if (edit) {
    return (
      <div className="rounded-xl border border-accent/30 bg-black/20 p-3 space-y-2">
        <input className="input input-bordered input-sm w-full bg-base-100" value={f.name} onChange={set('name')} placeholder={t('Xizmat nomi')} />
        <textarea className="textarea textarea-bordered textarea-sm w-full bg-base-100" rows={2} value={f.description || ''} onChange={set('description')} placeholder={t('Tavsif')} />
        <div className="flex gap-2">
          <input className="input input-bordered input-sm w-full bg-base-100" type="number" value={f.price ?? ''} onChange={set('price')}
            placeholder={t('Narx')} disabled={f.priceType === 'negotiable'} />
          <select className="select select-bordered select-sm w-full bg-base-100" value={f.priceType || 'fixed'} onChange={set('priceType')}>
            {Object.entries(PRICE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-xs" onClick={save} disabled={busy}>{t('Saqlash')}</button>
          <button className="btn btn-ghost btn-xs" onClick={() => { setF(item); setEdit(false); onDraftEnd?.(); }}>{t('Bekor')}</button>
        </div>
      </div>
    );
  }
  const priceLabel = item.priceType === 'negotiable' ? t('Kelishiladi')
    : item.price != null ? `${fmt(item.price)}${item.priceType === 'from' ? ` ${t('dan')}` : ''}` : '';
  return (
    <div className={`flex flex-wrap gap-2.5 rounded-xl border border-white/10 bg-black/20 p-2.5 ${item.available ? '' : 'opacity-50'}`}>
      <ImageUploadTools canImage={canImage} imageUrl={item.imageUrl} busy={busy} onPicked={applyImage} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5 text-sm font-semibold">
          {item.featured && <span className="shrink-0 text-[color:var(--vz-gold)]"><IconStar width={12} height={12} /></span>}
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {priceLabel && <span className="shrink-0 text-xs text-base-content/60">{priceLabel}</span>}
        </div>
        {item.description && <div className="truncate text-[14px] text-base-content/50">{item.description}</div>}
        <div className="mt-1.5 flex items-center gap-1">
          <button className="btn btn-ghost btn-xs px-2" title={t('Tahrirlash')} onClick={() => { setF(item); setEdit(true); onDraftChange?.(item); }} aria-label={t('Tahrirlash')}><IconPen width={14} height={14} /></button>
          <button className="btn btn-ghost btn-xs px-2" title={item.available ? t('Yo‘q deb belgilash') : t('Bor deb belgilash')} onClick={() => toggle('available')}>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.available ? 'bg-success' : 'bg-base-content/30'}`} aria-hidden="true"></span>
          </button>
          <button className="btn btn-ghost btn-xs px-2" title={item.featured ? t('Tavsiyadan olib tashlash') : t('Tavsiya qilish')} onClick={() => toggle('featured')}>
            <span className={item.featured ? 'text-[color:var(--vz-gold)]' : 'text-base-content/40'}><IconStar width={14} height={14} /></span>
          </button>
          <button className="btn btn-ghost btn-xs px-2 text-error" title={t("O'chirish")} aria-label={t("O'chirish")} onClick={del}><IconTrash width={14} height={14} /></button>
        </div>
      </div>
    </div>
  );
}

function ServiceManagerSection({ code, allowed, onLock }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [adding, setAdding] = useState({}); // catId -> SERVICE_EMPTY
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // Live Phone Preview — Menu/ProductManagerSection bilan bir xil naqsh.
  const [draft, setDraft] = useState(null);
  const [mobilePreview, setMobilePreview] = useState(false);

  const load = () => dbGetServicesManage(code).then(setData).catch(() => setErr(true));
  useEffect(() => { if (allowed) load(); }, [code, allowed]);

  if (!allowed) {
    return (
      <button type="button" onClick={onLock}
        className="w-full rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-left text-sm text-base-content/70 transition hover:bg-accent/10">
        <IconLock width={14} height={14} /> {t('Xizmatlar katalogi — Silver NFC ID yoki undan yuqorida ochiladi.')}
      </button>
    );
  }
  if (err) return <ErrorRetry text={t('Katalogni yuklab bo‘lmadi.')} onRetry={() => { setErr(false); setData(null); load(); }} />;
  if (!data) return <SkeletonRows n={3} h={56} />;

  const { services, limits, counts } = data;
  const eligible = data.eligible !== false;
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  const previewCategories = mergeDraftIntoCategories(services, draft);

  const addCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    setBusy(true);
    try {
      await dbAddServiceCategory(code, { name });
      setNewCat(''); await load();
    } catch (e) {
      flash(e.message === 'limit_reached' ? t('Kategoriya limiti tugadi ({n} ta).', { n: e.limit })
        : e.message === 'not_service_business' ? t('Xizmatlar katalogi faqat biznes profillar uchun ochiladi.')
        : t('Xatolik yuz berdi.'));
    } finally { setBusy(false); }
  };
  const updCat = async (id, patch) => { await dbUpdateServiceCategory(code, id, patch); await load(); };
  const delCat = async (id) => {
    if (!confirm(t('Kategoriya va uning barcha xizmatlari o‘chadi. Davom etamizmi?'))) return;
    await dbDeleteServiceCategory(code, id); await load();
  };
  const addItem = async (catId) => {
    const f = adding[catId] || SERVICE_EMPTY;
    if (!f.name.trim()) return;
    setBusy(true);
    try {
      await dbAddService(code, {
        categoryId: catId, name: f.name, description: f.description,
        price: f.price === '' ? null : f.price,
        priceType: f.priceType || 'fixed',
        available: true,
      });
      setAdding((s) => ({ ...s, [catId]: SERVICE_EMPTY }));
      setDraft(null);
      await load();
    } catch (e) {
      flash(e.message === 'limit_reached' ? t('Xizmat limiti tugadi ({n} ta).', { n: e.limit })
        : e.message === 'not_service_business' ? t('Xizmatlar katalogi faqat biznes profillar uchun ochiladi.')
        : t('Xatolik yuz berdi.'));
    } finally { setBusy(false); }
  };

  const setAddF = (catId, k) => (e) => {
    const val = e.target.value;
    setAdding((s) => {
      const next = { ...(s[catId] || SERVICE_EMPTY), [k]: val };
      setDraft({ ...next, id: '__draft__', categoryId: catId });
      return { ...s, [catId]: next };
    });
  };

  const editorBody = (
    <div className="space-y-4">
      {!eligible && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200/90">
          {t('Xizmatlar katalogi faqat biznes profillar uchun ochiladi.')}
        </div>
      )}
      <div className="text-xs text-base-content/50">
        {t('Kategoriyalar')}: {counts.cats}/{limits.cat} · {t('Xizmatlar')}: {counts.items}/{limits.item}
        {!limits.images && ` · ${t('rasm Gold+ dan')}`}
      </div>
      <ShareLinkRow code={code} sub="xizmatlar" />
      {msg && <div className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{msg}</div>}

      {services.map((cat) => (
        <div key={cat.id} className={`rounded-2xl border border-white/10 bg-base-200/40 p-3 ${cat.enabled ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-1">
            <input
              className="input input-ghost input-sm min-w-0 flex-1 px-1 font-semibold"
              defaultValue={cat.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== cat.name && updCat(cat.id, { name: e.target.value.trim() })}
            />
            <button className="btn btn-ghost btn-xs shrink-0 px-2" title={cat.enabled ? t('Yashirish') : t('Chiqarish')} onClick={() => updCat(cat.id, { enabled: !cat.enabled })}><span className={`inline-block h-2.5 w-2.5 rounded-full ${cat.enabled ? 'bg-success' : 'bg-base-content/30'}`} aria-hidden="true"></span></button>
            <button className="btn btn-ghost btn-xs shrink-0 px-2 text-error" title={t("O'chirish")} aria-label={t("O'chirish")} onClick={() => delCat(cat.id)}><IconTrash width={14} height={14} /></button>
          </div>
          <div className="mt-2 space-y-2">
            {cat.items.map((it) => (
              <ServiceItemRow
                key={it.id} code={code} item={it} canImage={limits.images}
                onChanged={() => load()} onDeleted={() => load()}
                onDraftChange={(f) => setDraft({ ...f, categoryId: cat.id })}
                onDraftEnd={() => setDraft(null)}
              />
            ))}
          </div>
          {eligible && (
            <div className="mt-2 space-y-1.5">
              <input className="input input-bordered input-xs w-full bg-base-100" placeholder={t('Yangi xizmat nomi')}
                value={(adding[cat.id] || SERVICE_EMPTY).name} onChange={setAddF(cat.id, 'name')} />
              <div className="flex gap-1.5">
                <input className="input input-bordered input-xs min-w-0 flex-1 bg-base-100" type="number" placeholder={t('Narx')}
                  value={(adding[cat.id] || SERVICE_EMPTY).price} onChange={setAddF(cat.id, 'price')}
                  disabled={(adding[cat.id] || SERVICE_EMPTY).priceType === 'negotiable'} />
                <select className="select select-bordered select-xs shrink-0 bg-base-100" value={(adding[cat.id] || SERVICE_EMPTY).priceType} onChange={setAddF(cat.id, 'priceType')}>
                  {Object.entries(PRICE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                </select>
                <button className="btn btn-primary btn-xs shrink-0" onClick={() => addItem(cat.id)} disabled={busy}>{t("+ Qo'shish")}</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {eligible && counts.cats < limits.cat && (
        <div className="flex gap-2">
          <input className="input input-bordered input-sm min-w-0 flex-1 bg-base-100" placeholder={t('Yangi kategoriya (masalan: Ta’mirlash ishlari)')}
            value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={addCat} disabled={busy}>{t("Qo‘shish")}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_296px] lg:items-start lg:gap-6">
      {editorBody}

      {/* Desktop — jonli preview yon tomonda (sticky) */}
      <div className="hidden lg:sticky lg:top-20 lg:block">
        <PhoneFrame label={t('Jonli ko‘rinish')}>
          <ServicesPreviewList categories={previewCategories} t={t} />
        </PhoneFrame>
      </div>

      {/* Mobil — suzuvchi "Ko'rish" tugmasi + fullscreen preview */}
      <button type="button" onClick={() => setMobilePreview(true)}
        className="fixed bottom-20 right-4 z-30 flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-accent-content shadow-lg lg:hidden">
        <IconEye width={14} height={14} /> {t('Ko‘rish')}
      </button>
      {mobilePreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/85 p-4 lg:hidden" onClick={() => setMobilePreview(false)}>
          <div className="mx-auto mt-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-sm font-bold text-white">
              {t('Jonli ko‘rinish')}
              <CloseButton onClick={() => setMobilePreview(false)} />
            </div>
            <PhoneFrame>
              <ServicesPreviewList categories={previewCategories} t={t} />
            </PhoneFrame>
          </div>
        </div>
      )}
    </div>
  );
}

// Jamoa / Team (PHASE 5) — egaga boshqaruv (faqat biznes profillar).
const TEAM_EMPTY = { name: '', position: '', memberCode: '', photoUrl: '' };

function TeamSection({ code }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [form, setForm] = useState(TEAM_EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => dbGetTeamManage(code).then(setData).catch(() => setErr(true));
  useEffect(() => { load(); }, [code]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  if (err) return <ErrorRetry text={t('Jamoani yuklab bo‘lmadi.')} onRetry={() => { setErr(false); setData(null); load(); }} />;
  if (!data) return <SkeletonRows n={3} h={56} />;

  const { team, limit, count, eligible } = data;

  const uploadPhoto = async (file, onUrl) => {
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const url = await dbUploadImage(dataUrl);
      onUrl(url);
    } catch { flash(t('Rasmni yuklab bo‘lmadi.')); }
  };

  const add = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await dbAddTeamMember(code, { ...form, name: form.name.trim(), position: form.position.trim(), memberCode: form.memberCode.trim() });
      setForm(TEAM_EMPTY); await load();
    } catch (e) {
      const m = {
        limit_reached: t('Jamoa limiti tugadi ({n} ta).', { n: limit }),
        not_business: t('Jamoa faqat biznes profillar uchun. "Profil turi" bo‘limida "Biznes"ni tanlang.'),
        feature_locked: t('Xatolik yuz berdi.'),
      };
      flash(m[e.message] || t('Xatolik yuz berdi.'));
    } finally { setBusy(false); }
  };
  const upd = async (id, patch) => { try { await dbUpdateTeamMember(code, id, patch); await load(); } catch { flash(t('Xatolik yuz berdi.')); } };
  const del = async (id) => {
    if (!confirm(t('Bu a’zoni o‘chirasizmi?'))) return;
    try { await dbDeleteTeamMember(code, id); setData((d) => ({ ...d, team: d.team.filter((m) => m.id !== id), count: d.count - 1 })); }
    catch { flash(t('Xatolik yuz berdi.')); }
  };

  return (
    <div className="space-y-4">
      {!eligible && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200/90">
          {t('Jamoa faqat biznes profillar uchun. "Profil turi" bo‘limida "Biznes"ni tanlang.')}
        </div>
      )}
      <div className="text-xs text-base-content/50">{t('A’zolar')}: {count}/{limit}</div>
      {msg && <div className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{msg}</div>}

      <div className="space-y-2">
        {team.map((m) => (
          <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 p-2.5">
            <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/10 bg-base-100 text-[13px] text-base-content/40">
              {m.photoUrl ? <img src={m.photoUrl} alt="" className="h-full w-full object-cover" /> : t('rasm')}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadPhoto(f, (url) => upd(m.id, { photoUrl: url })); }} />
            </label>
            <div className="min-w-0 flex-1">
              <input className="input input-ghost input-xs w-full px-1 font-semibold" defaultValue={m.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== m.name && upd(m.id, { name: e.target.value.trim() })} />
              <input className="input input-ghost input-xs w-full px-1 text-base-content/60" defaultValue={m.position || ''} placeholder={t('Lavozim')}
                onBlur={(e) => e.target.value !== (m.position || '') && upd(m.id, { position: e.target.value.trim() })} />
              <input className="input input-ghost input-xs w-full px-1 font-mono text-[14px] text-base-content/40" defaultValue={m.memberCode || ''} placeholder={t('Profil kodi (ixtiyoriy)')}
                onBlur={(e) => e.target.value.toUpperCase() !== (m.memberCode || '') && upd(m.id, { memberCode: e.target.value.trim() })} />
            </div>
            <button className="btn btn-ghost btn-xs shrink-0 px-2 text-error" title={t("O'chirish")} aria-label={t("O'chirish")} onClick={() => del(m.id)}><IconTrash width={14} height={14} /></button>
          </div>
        ))}
      </div>

      {eligible && count < limit && (
        <div className="rounded-xl border border-white/10 bg-base-200/40 p-3 space-y-2">
          <div className="text-xs font-semibold">{t('Yangi a’zo')}</div>
          <div className="flex gap-2">
            <input className="input input-bordered input-sm min-w-0 flex-1 bg-base-100" placeholder={t('Ism')} value={form.name} onChange={set('name')} />
            <input className="input input-bordered input-sm min-w-0 flex-1 bg-base-100" placeholder={t('Lavozim')} value={form.position} onChange={set('position')} />
          </div>
          <div className="flex gap-2">
            <input className="input input-bordered input-sm min-w-0 flex-1 bg-base-100 font-mono text-xs" placeholder={t('Profil kodi (ixtiyoriy)')} value={form.memberCode} onChange={set('memberCode')} />
            <button className="btn btn-primary btn-sm" onClick={add} disabled={busy}>{t("Qo‘shish")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Galereya (Business Workspace) — biznes profil rasm galereyasi. Team
// bilan bir xil naqsh: oddiy ro'yxat, kategoriyasiz, faqat rasm+izoh.
function GallerySection({ code, onLock }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => dbGetGalleryManage(code).then(setData).catch(() => setErr(true));
  useEffect(() => { load(); }, [code]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  if (err) return <ErrorRetry text={t('Galereyani yuklab bo‘lmadi.')} onRetry={() => { setErr(false); setData(null); load(); }} />;
  if (!data) return <SkeletonRows n={3} h={56} />;

  const { gallery, limit, count, eligible } = data;

  if (!eligible) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200/90">
        {t('Galereya faqat biznes profillar uchun.')}
      </div>
    );
  }
  if (limit <= 0) {
    return (
      <button type="button" onClick={onLock}
        className="w-full rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-left text-sm text-base-content/70 transition hover:bg-accent/10">
        <IconLock width={14} height={14} /> {t('Galereya — Silver NFC ID yoki undan yuqorida ochiladi.')}
      </button>
    );
  }

  const addImage = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const url = await dbUploadImage(dataUrl);
      await dbAddGalleryImage(code, { imageUrl: url });
      await load();
    } catch (e) {
      flash(e.message === 'limit_reached' ? t('Galereya limiti tugadi ({n} ta).', { n: limit }) : t('Xatolik yuz berdi.'));
    } finally { setBusy(false); }
  };
  const del = async (id) => {
    if (!confirm(t('Bu rasmni o‘chirasizmi?'))) return;
    try { await dbDeleteGalleryImage(code, id); setData((d) => ({ ...d, gallery: d.gallery.filter((g) => g.id !== id), count: d.count - 1 })); }
    catch { flash(t('Xatolik yuz berdi.')); }
  };
  const setCaption = async (id, caption) => { try { await dbUpdateGalleryImage(code, id, { caption }); await load(); } catch { flash(t('Xatolik yuz berdi.')); } };

  return (
    <div className="space-y-4">
      <div className="text-xs text-base-content/50">{t('Rasmlar')}: {count}/{limit}</div>
      {msg && <div className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{msg}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {gallery.map((g) => (
          <div key={g.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
            <div className="relative aspect-square">
              <img src={g.imageUrl} alt="" className="h-full w-full object-cover" />
              <button className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-error" title={t("O'chirish")} aria-label={t("O'chirish")} onClick={() => del(g.id)}><IconTrash width={12} height={12} /></button>
            </div>
            <input className="input input-ghost input-xs w-full px-2 text-[14px]" defaultValue={g.caption || ''} placeholder={t('Izoh (ixtiyoriy)')}
              onBlur={(e) => e.target.value !== (g.caption || '') && setCaption(g.id, e.target.value.trim())} />
          </div>
        ))}

        {count < limit && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 bg-base-200/40 text-xs text-base-content/50 hover:border-accent/40 hover:text-accent">
            {busy ? <span className="loading loading-spinner loading-sm"></span> : <>
              <span className="text-xl">+</span>
              {t('Rasm qo‘shish')}
            </>}
            <input type="file" accept="image/*" className="hidden" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; addImage(f); }} />
          </label>
        )}
      </div>
    </div>
  );
}

// Tahrirlash paytida o'ng tomonda ko'rinadigan jonli telefon preview —
// ProfilePage'dagi haqiqiy fon/tema mantig'ini (vzStyle) qayta ishlatadi,
// shunda "qanday ko'rinadi" bilan haqiqiy profil bir xil bo'ladi.
function PhonePreview({ form, code }) {
  const { t } = useLanguage();
  const record = form;
  const socials = [
    form.tg && { Icon: IconTelegram, label: 'Telegram' },
    form.instagram && { Icon: IconInstagram, label: 'Instagram' },
    form.facebook && { Icon: IconFacebook, label: 'Facebook' },
    form.twitter && { Icon: IconX, label: 'X' },
    form.website && { Icon: IconGlobe, label: t('Veb-sayt') },
    form.linkedin && { Icon: IconLinkedIn, label: 'LinkedIn' },
    form.cardNumber && { Icon: IconTag, label: t('Karta') },
    form.phone && { Icon: IconPhone, label: t('Tel') },
  ].filter(Boolean);

  return (
    <div className="sticky top-6">
      {/* iPhone 17 Pro uslubidagi ramka: titan rangli chetlar + yon tugmalar —
          faqat vizual, ichidagi haqiqiy profil preview'iga tegilmagan. */}
      <div className="relative mx-auto w-[268px] rounded-[52px] bg-gradient-to-b from-[#4a4a4d] via-[#2c2c2e] to-[#19191b] p-[3px] shadow-[0_25px_60px_rgba(0,0,0,0.55)]">
        <div className="absolute -left-[2px] top-[108px] h-6 w-[3px] rounded-l-sm bg-[#3a3a3c]"></div>
        <div className="absolute -left-[2px] top-[144px] h-10 w-[3px] rounded-l-sm bg-[#3a3a3c]"></div>
        <div className="absolute -left-[2px] top-[188px] h-10 w-[3px] rounded-l-sm bg-[#3a3a3c]"></div>
        <div className="absolute -right-[2px] top-[132px] h-14 w-[3px] rounded-r-sm bg-[#3a3a3c]"></div>
        <div className="rounded-[49px] border-[5px] border-[#0c0c0d] bg-[#0c0c0d]">
        <div className="relative h-[540px] overflow-hidden rounded-[44px]" style={outerPageStyle(form.theme || 'classic', record, tierForCode(code), { fixedBg: false })}>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 pt-2.5 text-[11px] font-semibold text-[color:var(--vz-ink)]">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span className="flex items-end gap-[1.5px]">
                {[3, 5, 7, 9].map((h) => <span key={h} className="w-[2.5px] rounded-[1px] bg-current" style={{ height: h }}></span>)}
              </span>
              <svg width="14" height="10" viewBox="0 0 16 12" fill="none" className="ml-0.5"><path d="M1 5C3 1 13 1 15 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              <span className="ml-0.5 flex h-[10px] w-[19px] items-center rounded-[3px] border border-current px-[1.5px]">
                <span className="h-[6px] w-[13px] rounded-[1px] bg-current"></span>
              </span>
            </div>
          </div>
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black"></div>
          <div className="h-full overflow-y-auto px-3 pb-6 pt-11 text-center text-[color:var(--vz-ink)]">
            <div className="mx-auto inline-flex items-center gap-1 rounded-full border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] px-2.5 py-0.5 font-mono text-[9px] font-bold text-[color:var(--vz-ink)]">
              # {code}
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/12 px-3 pb-4 pt-3" style={innerPanelStyle(record)}>
            {/* Haqiqiy ochiq profildagi kabi — kattaroq, dumaloq avatar +
                yengil oltin porlash (premium ko'rinish, real vaqtda mos). */}
            <div className="relative mx-auto flex h-[88px] w-[88px] items-center justify-center">
              <span className="pointer-events-none absolute inset-[-14px] animate-[goldGlow_3.6s_ease-in-out_infinite] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--vz-accent) 45%, transparent), transparent 70%)' }}></span>
              <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-[color:var(--vz-card)] bg-gradient-to-br from-[#dfe3e6] to-[#cfd4d8] text-[22px] font-bold text-[#565c62] shadow-[0_0_0_1px_var(--vz-line)]">
                {form.avatarUrl ? <img src={form.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(form.name)}
              </div>
            </div>
            <div className="mt-2.5 text-[16.5px] font-bold leading-tight">{form.name || t('Ismingiz')}</div>
            {form.role && <div className="mt-0.5 text-[13px] text-[color:var(--vz-ink-dim)]">{form.role}</div>}
            {form.about && <p className="mx-auto mt-1.5 max-w-[190px] text-[9.5px] leading-snug text-[color:var(--vz-ink-dim)]">{form.about}</p>}

            {form.hashtags && (
              <div className="mt-2.5 flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-[8.5px] font-semibold text-[color:var(--vz-accent)]">
                {form.hashtags.split(',').map((h) => h.trim()).filter(Boolean).map((h) => <span key={h}>#{h}</span>)}
              </div>
            )}

            <div className="mx-auto mt-4 flex max-w-[210px] flex-col gap-1.5">
              {socials.length === 0 && (
                <div className="rounded-lg border border-dashed border-[color:var(--vz-line)] px-3 py-3 text-[9px] text-[color:var(--vz-ink-faint)]">
                  {t("Aloqa maydonlarini to'ldirsangiz, tugmalar shu yerda ko'rinadi")}
                </div>
              )}
              {socials.map(({ Icon, label }) => (
                <div key={label} className="flex items-center justify-center gap-1.5 rounded-lg bg-[color:var(--vz-pill)] px-3 py-2 text-[13px] font-bold text-white">
                  <Icon width={11} height={11} /> {label}
                </div>
              ))}
            </div>
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-1.5 left-1/2 h-[5px] w-[110px] -translate-x-1/2 rounded-full bg-[color:var(--vz-ink)] opacity-30"></div>
        </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[14px] text-base-content/40">{t("Jonli oldindan ko'rish — real vaqtda yangilanadi")}</p>
    </div>
  );
}

// Rasmini klientda siqish: max 512px, JPEG ~85% (yuklash tez bo'lishi uchun).
function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    // GIF ni MAGIC BAYTLAR bilan aniqlaymiz (iOS Safari file.type / fayl nomini
    // ishonchsiz beradi). "GIF8" = 47 49 46 38. Aniqlansa \u2014 xom holida
    // yuboriladi (canvas siqilsa animatsiya yo'qoladi), server 3 MB gacha.
    const head = new FileReader();
    head.onerror = () => reject(new Error('Fayl oqilmadi.'));
    head.onload = () => {
      const b = new Uint8Array(head.result || new ArrayBuffer(0));
      const isGif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
      if (isGif) {
        if (file.size > 3 * 1024 * 1024) {
          reject(new Error('GIF hajmi 3 MB dan oshmasligi kerak.'));
          return;
        }
        const gr = new FileReader();
        gr.onerror = () => reject(new Error('Fayl oqilmadi.'));
        gr.onload = () => resolve(String(gr.result || '').replace(/^data:[^;]*;/, 'data:image/gif;'));
        gr.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Fayl oqilmadi.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Rasm formati noto\u2019g\u2019ri.'));
        img.onload = () => {
          const max = 512;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    };
    head.readAsArrayBuffer(file.slice(0, 4));
  });
}

// Audio fayllar siqilmaydi (rasm kabi canvas orqali qayta ishlab bo'lmaydi) —
// shunchaki base64 data URL sifatida o'qiladi, hajm serverda tekshiriladi.
function audioFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Fayl oqilmadi.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

const PREMIUM_FEE = PROFILE_PREMIUM_FEE;  // src/lib/pricing.js — yagona manba

// Premium profilga o'tish — real Payme to'lovi (narx: PROFILE_PREMIUM_FEE,
// src/lib/pricing.js). E-wallet yo'q:
// to'lov tasdiqlangach status avtomatik "Premium"ga o'zgaradi (admin
// tasdig'i shart emas, chunki Payme to'lovning o'zi tasdiq beradi).
// Foydalanuvchi auksionda yutgan, hali to'lamagan kodlari — aniq
// ogohlantirish bilan: 24 soatda to'lamasa auksion bekor bo'ladi VA
// akkaunt 72 soatga bloklanadi.
// Kelgan va yuborilgan sovg'a takliflari — qabul qilish/rad etish/bekor
// qilish shu yerdan boshqariladi.
function GiftOffersPanel({ onChanged, onCount }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = () => dbListGiftOffers()
    .then((value) => {
      const next = {
        incoming: Array.isArray(value?.incoming) ? value.incoming : [],
        outgoing: Array.isArray(value?.outgoing) ? value.outgoing : [],
      };
      setData(next); setErr(false);
      onCount?.(next.incoming.length);
    })
    .catch(() => { setErr(true); setData((d) => d || { incoming: [], outgoing: [] }); });
  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = async (id) => {
    setBusy(id);
    try { await dbAcceptGift(id); await load(); onChanged?.(); }
    catch { alert(t("Qabul qilib bo'lmadi — taklif allaqachon ishlangan bo'lishi mumkin.")); }
    finally { setBusy(null); }
  };
  const reject = async (id) => {
    setBusy(id);
    try { await dbRejectGift(id); await load(); } finally { setBusy(null); }
  };
  const cancel = async (id) => {
    setBusy(id);
    try { await dbCancelGift(id); await load(); } finally { setBusy(null); }
  };

  const incoming = Array.isArray(data?.incoming) ? data.incoming : [];
  const outgoing = Array.isArray(data?.outgoing) ? data.outgoing : [];
  const empty = data && !err && incoming.length === 0 && outgoing.length === 0;

  return (
    <section className="vz-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><IconGift /> {t("Sovg'a takliflari")}</h2>
      {!data && <div className="mt-3"><SkeletonRows n={2} /></div>}
      {data && err && <div className="mt-3"><ErrorRetry onRetry={load} /></div>}
      {empty && <div className="mt-3 vz-empty"><span className="text-sm">{t("Hozircha sovg'a takliflari yo'q.")}</span></div>}
      <div className="mt-3 space-y-2">
        {incoming.map((g) => (
          <div key={'in' + g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
            <span><b className="font-mono">{g.code}</b> — <span className="text-base-content/60">{g.fromEmail}</span> {t('sizga sovg‘a qilmoqchi')}</span>
            <div className="flex gap-1.5">
              <button className="btn btn-gold btn-xs min-h-11" disabled={busy === g.id} onClick={() => accept(g.id)}>{t('Qabul qilish')}</button>
              <button className="btn btn-ghost btn-xs min-h-11" disabled={busy === g.id} onClick={() => reject(g.id)}>{t('Rad etish')}</button>
            </div>
          </div>
        ))}
        {outgoing.map((g) => (
          <div key={'out' + g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm">
            <span><b className="font-mono">{g.code}</b> — <span className="text-base-content/60">{g.toEmail}</span>{t('ga yuborilgan, javob kutilmoqda')}</span>
            <button className="btn btn-ghost btn-xs min-h-11" disabled={busy === g.id} onClick={() => cancel(g.id)}>{t('Bekor qilish')}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function WonAuctionsPanel({ onCount }) {
  const { t } = useLanguage();
  const PAYMENTS_ENABLED = usePaymentsEnabled();
  const [list, setList] = useState(null);
  const [err, setErr] = useState(false);
  const [, tick] = useState(0);

  const load = () => dbListWonPendingAuctions()
    .then((rows) => { const arr = Array.isArray(rows) ? rows : []; setList(arr); setErr(false); onCount?.(arr.length); })
    .catch(() => { setErr(true); setList((l) => l || []); });
  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    const ticker = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(timer); clearInterval(ticker); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tinch holat (yuklandi, xato yo'q, ro'yxat bo'sh) — bo'lim ko'rsatilmaydi:
  // g'olib bo'lmagan foydalanuvchi uchun bu shunchaki shovqin.
  if (list && !err && list.length === 0) return null;

  return (
    <section className="vz-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><IconTrophy /> {t('Yutgan auksionlaringiz')}</h2>
      {!list && <div className="mt-3"><SkeletonRows n={1} h={72} /></div>}
      {list && err && <div className="mt-3"><ErrorRetry onRetry={load} /></div>}
      <div className="mt-3 space-y-3">
        {(list || []).map((a) => {
          const msLeft = new Date(a.paymentDeadline).getTime() - Date.now();
          const h = Math.max(0, Math.floor(msLeft / 3600000));
          const m = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
          return (
            <div key={a.id} className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-bold">nfcstore.uz/{a.code.toLowerCase()}</div>
                  <div className="text-xs text-base-content/60">{t("Siz g'olib bo'ldingiz — {n} so'm", { n: fmt(a.currentPrice) })}</div>
                </div>
                {PAYMENTS_ENABLED
                  ? <button className="btn btn-gold btn-sm min-h-11" onClick={() => navigate('/auksion/' + a.id)}>{t("To'lov qiling")}</button>
                  : <button className="btn btn-sm min-h-11 btn-disabled !cursor-not-allowed opacity-60" disabled aria-disabled="true">{t("To'lov qiling")}</button>}
              </div>
              {PAYMENTS_ENABLED ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-warning">
                  <IconWarn width={14} height={14} className="mt-0.5 shrink-0" /> {t("Diqqat: {h} soat {m} daqiqa ichida to'lov qilmasangiz, auksion bekor bo'ladi va akkauntingiz 72 soatga bloklanadi.", { h, m })}
                </p>
              ) : (
                <div className="mt-2"><PaymentUnavailableNotice compact /></div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Premium ochadigan imkoniyatlar — src/lib/access.js FEATURE_MIN'dan (bitta manba).
const PREMIUM_UNLOCK_LABEL = {
  post: 'Postlar / Media', music: 'Profil musiqasi', innerBackground: 'Maxsus profil foni',
  advancedColors: 'Maxsus ranglar', animatedBackground: 'Animatsiyali fon', premiumThemes: 'Premium temalar',
  glassContent: 'Shisha (glass) kontent', linkStyle: 'Havola tugmalari uslubi', video: 'Video',
  physicalCardDesigner: 'Jismoniy NFC karta dizayni', profileCardCustom: 'Karta dizayni',
  leadCapture: 'Lidlarni yig‘ish', advancedAnalytics: 'Kengaytirilgan statistika', fileCatalog: 'Fayl / PDF katalog',
  location: 'Manzil va lokatsiya',
};

function PremiumPanel({ user, card, onBecamePremium }) {
  const { t } = useLanguage();
  const PAYMENTS_ENABLED = usePaymentsEnabled();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [order, setOrder] = useState(null);
  const [disabledByServer, setDisabledByServer] = useState(false);
  // Joriy daraja: NFC ID tarifi + Profile Premium (src/lib/access.js).
  const access = effectiveAccess(card || null, user);
  const unlocked = Object.keys(PREMIUM_UNLOCK_LABEL).filter((f) => hasAccess(access, FEATURE_MIN[f]));
  const lockedNow = Object.keys(PREMIUM_UNLOCK_LABEL).filter((f) => !hasAccess(access, FEATURE_MIN[f]) && hasAccess('premium', FEATURE_MIN[f]));

  useEffect(() => {
    if (!order) return;
    const timer = setInterval(async () => {
      try {
        const st = await dbGetPayment(order.orderId);
        if (st.status === 'paid') {
          clearInterval(timer);
          setOrder(null);
          setMsg({ type: 'ok', text: t("To'lov tasdiqlandi — siz endi Premium foydalanuvchisiz!") });
          onBecamePremium?.();
        } else if (st.status === 'cancelled') {
          clearInterval(timer);
          setOrder(null);
          setMsg({ type: 'err', text: t("To'lov bekor qilindi.") });
        }
      } catch { /* keyingi urinishda qayta tekshiramiz */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [order]);

  const submit = async () => {
    // To'lov oynasi BOSILGAN ZAHOTI ochiladi (hali await bo'lmasdan) —
    // aks holda brauzer uni bloklaydi va mijoz "To'lash" ni bosganda
    // hech narsa ochilmaydi. Batafsil: src/lib/payWindow.js izohi.
    const payWin = openPayWindow();
    setBusy(true);
    setMsg(null);
    try {
      const res = await dbRequestPremium();
      setOrder(res);
      // Havola kelmasa oyna yopiladi — mijoz osilib qolgan bo'sh
      // oynani ko'rmaydi.
      if (res && res.payLink) payWin.go(res.payLink);
      else payWin.close();
    } catch (err) {
      payWin.close();
      // 503 payments_disabled → to'lov vaqtincha o'chiq (PaymentUnavailableNotice);
      // 409 ALREADY_PREMIUM / ALREADY_PENDING → matn (db.js xaritasi); 429 → matn.
      if (err.code === 'payments_disabled' || err.code === 'payme_disabled') setDisabledByServer(true);
      if (err.code === 'ALREADY_PREMIUM') onBecamePremium?.();
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const paymentsOn = PAYMENTS_ENABLED && !disabledByServer;
  const tierLabel = t(tierLabelFor(card?.code, access));

  return (
    <div className="vz-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="vz-kicker">{t('Tarif')}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 font-display text-2xl font-semibold text-[color:var(--vz-gold-2)]"><IconCrown width={22} height={22} /> {tierLabel}</span>
            {user?.isPremium && <span className="vz-badge vz-badge--gold"><IconCheck width={12} height={12} /> {t("Premium a'zo")}</span>}
            {card?.code && <span className="vz-badge vz-badge--muted font-mono">{card.code}</span>}
          </div>
          <p className="mt-2 max-w-md text-sm text-base-content/55">
            {user?.isPremium
              ? t('Barcha premium imkoniyatlar faol. Amal qilish muddati cheklanmagan.')
              : t("Daraja = NFC ID tarifi yoki Profile Premium (qaysi biri yuqori bo'lsa). Premium — bir martalik to'lov, muddatsiz.")}
          </p>
        </div>
        {!user?.isPremium && (
          <div className="w-full shrink-0 sm:w-auto">
            {!paymentsOn ? (
              <button className="btn btn-gold btn-sm min-h-11 w-full btn-disabled !cursor-not-allowed opacity-60 sm:w-auto" disabled aria-disabled="true">
                {t("To'lash — {n} so'm", { n: fmt(PREMIUM_FEE) })}
              </button>
            ) : !order ? (
              <button className="btn btn-gold btn-sm min-h-11 w-full sm:w-auto" onClick={submit} disabled={busy}>
                {busy ? <span className="loading loading-spinner loading-xs"></span> : t("To'lash — {n} so'm", { n: fmt(PREMIUM_FEE) })}
              </button>
            ) : (
              <a href={order.payLink} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-sm min-h-11 w-full sm:w-auto">
                {t("To'lovga o'tish")} &rarr;
              </a>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="vz-panel min-w-0 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/45">{t('Sizga ochiq')}</div>
          {unlocked.length === 0 && <p className="mt-2 text-sm text-base-content/50">{t("Bepul tarifda faqat asosiy profil.")}</p>}
          <ul className="mt-2 space-y-1.5 text-sm">
            {unlocked.map((f) => (
              <li key={f} className="flex items-start gap-2"><span className="mt-0.5 shrink-0 text-success"><IconCheck width={14} height={14} /></span><span className="min-w-0 break-words">{t(PREMIUM_UNLOCK_LABEL[f])}</span></li>
            ))}
          </ul>
        </div>
        {!user?.isPremium && (
          <div className="vz-panel min-w-0 border-accent/30 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--vz-gold-2)]">{t('Premium ochadi')}</div>
            {lockedNow.length === 0 && <p className="mt-2 text-sm text-base-content/50">{t("NFC ID tarifingiz allaqachon Premium darajasida.")}</p>}
            <ul className="mt-2 space-y-1.5 text-sm">
              {lockedNow.map((f) => (
                <li key={f} className="flex items-start gap-2"><span className="mt-0.5 shrink-0 text-base-content/40"><IconLock width={14} height={14} /></span><span className="min-w-0 break-words">{t(PREMIUM_UNLOCK_LABEL[f])}</span></li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-base-content/45">{t("Narxi: {n} so'm (bir martalik). To'lov Payme orqali.", { n: fmt(PREMIUM_FEE) })}</p>
          </div>
        )}
      </div>

      {!paymentsOn && !user?.isPremium && <div className="mt-3"><PaymentUnavailableNotice compact /></div>}
      {order && (
        <p className="mt-3 flex items-center gap-2 text-xs text-base-content/45">
          <span className="loading loading-spinner loading-xs"></span> {t("To'lov kutilmoqda...")}
        </p>
      )}
      {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
    </div>
  );
}

// Profil postlarini boshqarish — rasm + izoh joylash, o'chirish.
// Rasm yuklashdan oldin foydalanuvchi qonuniy ogohlantirishni tasdiqlashi shart.
function PostsManager({ code }) {
  const { t } = useLanguage();
  const [posts, setPosts] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);

  const [postsErr, setPostsErr] = useState(false);
  const loadPosts = () => { setPostsErr(false); setPosts(null); dbListPosts(code).then(setPosts).catch(() => { setPosts([]); setPostsErr(true); }); };
  useEffect(() => { loadPosts(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [code]);

  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!agreed) {
      setMsg({ type: 'err', text: t('Avval quyidagi shartni belgilang.') });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const url = await dbUploadImage(dataUrl);
      setImageUrl(url); setVideoUrl('');
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onPickVideo = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!agreed) {
      setMsg({ type: 'err', text: t('Avval quyidagi shartni belgilang.') });
      if (videoRef.current) videoRef.current.value = '';
      return;
    }
    setUploading(true); setMsg(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error(t('Video 10 MB dan katta — kichraytiring.'));
      const url = await dbUploadCardVideo(file);
      setVideoUrl(url); setImageUrl('');
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setUploading(false);
      if (videoRef.current) videoRef.current.value = '';
    }
  };

  const publish = async () => {
    if (!imageUrl && !videoUrl) { setMsg({ type: 'err', text: t('Avval rasm yoki video yuklang.') }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const post = await dbCreatePost(code, { imageUrl, videoUrl, caption: caption.trim() });
      setPosts((list) => [post, ...(list || [])]);
      setImageUrl(''); setVideoUrl(''); setCaption(''); setAgreed(false);
      setMsg({ type: 'ok', text: t('Post joylandi.') });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm(t('Bu postni o‘chirasizmi?'))) return;
    try {
      await dbDeletePost(id);
      setPosts((list) => (list || []).filter((p) => p.id !== id));
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  };

  const inp = 'input input-bordered input-sm mt-1 w-full bg-base-100';
  return (
    <div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-base-content/55">{t('Yangi post')}</div>

        <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-base-content/70">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="checkbox checkbox-xs mt-0.5 shrink-0" />
          <span>{t('Men joylayotgan rasm O‘zbekiston Respublikasi qonunchiligiga zid emasligini tasdiqlayman. Diniy targ‘ibot, pornografik va axloq normalariga zid tasvirlar, giyohvand moddalar, spirtli ichimliklar hamda tamaki mahsulotlari reklamasi, zo‘ravonlik, kamsitish va boshqa noqonuniy mazmundagi rasmlarni joylash qat’iyan taqiqlanadi. Qoidaga rioya qilinmasa, post o‘chiriladi va NFC ID bloklanishi mumkin.')}</span>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} disabled={!agreed || uploading} className="file-input file-input-bordered file-input-sm flex-1 bg-base-100 disabled:opacity-50" />
          <button type="button" className="btn btn-outline-gold btn-sm min-h-11" disabled={!agreed || uploading} onClick={() => videoRef.current && videoRef.current.click()}>{t('Video')}</button>
          <input ref={videoRef} type="file" accept="video/mp4,video/webm" onChange={onPickVideo} className="hidden" />
        </div>
        <p className="mt-1 text-[14px] text-base-content/40">{t('Rasm yoki video (MP4/WebM, maks. 10 MB). iPhone’da GIF/video uchun “Fayllar”dan tanlang.')}</p>
        {uploading && <p className="mt-1 flex items-center gap-2 text-xs text-base-content/45"><span className="loading loading-spinner loading-xs"></span> {t('Yuklanmoqda...')}</p>}
        {imageUrl && <img src={imageUrl} alt="" className="mt-2 max-h-52 rounded-lg border border-white/10 object-cover" />}
        {videoUrl && <video src={videoUrl} controls playsInline className="mt-2 max-h-52 rounded-lg border border-white/10" />}

        <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 600))} placeholder={t('Izoh (ixtiyoriy)')} rows={2} className="textarea textarea-bordered textarea-sm mt-2 w-full bg-base-100" />

        <button type="button" className="btn btn-gold btn-sm mt-3 min-h-11 w-full" onClick={publish} disabled={!agreed || (!imageUrl && !videoUrl) || busy}>
          {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Joylash')}
        </button>
        {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
      </div>

      <div className="mt-4 space-y-2">
        {posts === null && <SkeletonRows n={2} h={64} />}
        {posts !== null && postsErr && <ErrorRetry onRetry={loadPosts} />}
        {posts !== null && !postsErr && posts.length === 0 && <div className="vz-empty"><span className="text-base-content/40"><IconImage /></span><span className="text-sm">{t('Hali post yo‘q')}</span></div>}
        {(posts || []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-2">
            {p.videoUrl
              ? <video src={p.videoUrl} muted className="h-12 w-12 shrink-0 rounded bg-black object-cover" />
              : <img src={p.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-base-content/70">{p.caption || <span className="text-base-content/35">{t('(izohsiz)')}</span>}</div>
              <div className="text-[13px] text-base-content/40">{timeAgo(p.createdAt)} · {t('{n} layk', { n: p.likeCount })}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-xs min-h-11 shrink-0 text-error" onClick={() => remove(p.id)}>{t('O‘chirish')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Umumiy markazlashgan modal (SupportModal uslubi).
function Modal({ title, onClose, children, wide }) {
  const { t } = useLanguage();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" {...backdropProps(onClose)}>
      <div className={`my-6 w-full rounded-2xl border border-white/10 bg-base-200 p-6 shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <CloseButton onClick={onClose} />
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

// Narx yagona manbadan — src/lib/pricing.js (backend nusxasi:
// hosting/api/account.js PHYSICAL_CARD_FEE).
const PHYSICAL_CARD_FEE_UZS = PHYSICAL_CARD_FEE;

// Curated profil kartasi ranglari — NfcCard FINISHES kalitlari.
const CARD_FINISHES = [
  { id: 'auto', label: 'Avtomatik (tarif bo‘yicha)', css: 'linear-gradient(135deg,#3a3834,#1f1e1c)' },
  { id: 'tier-exclusive', label: 'Ekslyuziv (tilla-qora)', css: 'linear-gradient(145deg,#3a3834,#1f1e1c)' },
  { id: 'black', label: 'Qora', css: 'linear-gradient(135deg,#201a10,#0a0908)' },
  { id: 'silver', label: 'Kumush', css: 'linear-gradient(135deg,#f4f4f5,#d6d7d9)' },
  { id: 'tier-gold', label: 'Tilla', css: 'linear-gradient(135deg,#f0c419,#a9840f)' },
  { id: 'graphite', label: 'Grafit', css: 'linear-gradient(135deg,#3a3730,#201f1a)' },
  { id: 'tier-premium', label: 'Platina', css: 'linear-gradient(145deg,#eef0f2,#b9bcc4)' },
  { id: 'tier-free', label: 'Zumrad', css: 'linear-gradient(135deg,#22352a,#14201a)' },
  { id: 'ink', label: 'Ink', css: 'linear-gradient(145deg,#10163a,#0a0d1c,#1b2456)' },
];

const DEFAULT_NAME_POS = { x: 0.3, y: 0.83 };
const DEFAULT_CODE_POS = { x: 0.5, y: 0.5 };
const DEFAULT_BRAND_POS = { x: 0.5, y: 0.32 };

// "Karta dizayni" modali — 2 tab: profil kartasi (rang/matn/fon) va bosma karta.
function CardDesignModal({ card, onClose, onSaved, initialTab = 'profile' }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState(initialTab);
  const d = card.cardDesign || {};
  const [finish, setFinish] = useState(d.finish || 'auto');
  const [name, setName] = useState(d.name || '');
  const [bgUrl, setBgUrl] = useState(d.bgUrl || '');
  const [namePos, setNamePos] = useState(
    Number.isFinite(d.nameX) && Number.isFinite(d.nameY) ? { x: d.nameX, y: d.nameY } : DEFAULT_NAME_POS
  );
  const [nameScale, setNameScale] = useState(Number.isFinite(d.nameScale) ? d.nameScale : 1);
  const [codePos, setCodePos] = useState(
    Number.isFinite(d.codeX) && Number.isFinite(d.codeY) ? { x: d.codeX, y: d.codeY } : DEFAULT_CODE_POS
  );
  const [codeScale, setCodeScale] = useState(Number.isFinite(d.codeScale) ? d.codeScale : 1);
  const [nameColor, setNameColor] = useState(d.nameColor || '');
  const [brandPos, setBrandPos] = useState(
    Number.isFinite(d.brandX) && Number.isFinite(d.brandY) ? { x: d.brandX, y: d.brandY } : DEFAULT_BRAND_POS
  );
  const [brandScale, setBrandScale] = useState(Number.isFinite(d.brandScale) ? d.brandScale : 1);
  const [brandColor, setBrandColor] = useState(d.brandColor || '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);

  // 2026-09 hotfix — jismoniy NFC karta buyurtmasi.
  // Bu oyna avval Payme holatini QATTIQ YOZIB qo'ygan edi: tugma har doim
  // `disabled`, tagida esa shartsiz "Tez kunlarda" izohi turardi va
  // dbOrderPhysicalCard() HECH QACHON chaqirilmasdi — ya'ni backend
  // (hosting/api/account.js `order-physical-card`) tayyor bo'lsa ham
  // buyurtma berib bo'lmasdi. Endi holat faqat PaymeBlock orqali
  // backend'dagi yagona manbadan keladi va yetkazib berish formasi bilan
  // to'liq buyurtma oqimi ishlaydi.
  const [shipName, setShipName] = useState('');
  const [shipPhone, setShipPhone] = useState('');
  // Yetkazib berish xizmatini mijozning o'zi tanlaydi.
  const [shipCarrier, setShipCarrier] = useState('');
  // Soni. Narx SERVERDA qayta hisoblanadi — bu yerdagi son faqat
  // ko'rsatish uchun.
  const [shipQty, setShipQty] = useState(1);
  const qty = Math.min(Math.max(Math.round(Number(shipQty)) || 1, 1), PHYSICAL_CARD_MAX_QTY);
  const freeDelivery = qty > PHYSICAL_CARD_FREE_DELIVERY_QTY;
  const [cardOrder, setCardOrder] = useState(null);
  // Manzil endi so'ralmaydi — ism va telefon yetarli.
  const shippingFilled = !!(shipName.trim() && shipPhone.trim());

  // To'lov tugmasi bosilgan, lekin yetkazib berish ma'lumotlari to'liq
  // emas. Avval tugma shunchaki `disabled` edi: bosilganda MUTLAQO hech
  // narsa bo'lmasdi va "tugma ishlamayapti" degan taassurot qolardi.
  // Endi qaysi maydon bo'sh ekani aytiladi va aynan o'shanga fokus
  // beriladi — telefonda bu maydonni ekranga ham suradi.
  const shipNameRef = useRef(null);
  const shipPhoneRef = useRef(null);
  const [shipErr, setShipErr] = useState('');

  const focusMissingShipping = () => {
    const missing = !shipName.trim()
      ? [t('Qabul qiluvchi ismini kiriting.'), shipNameRef]
      : !shipPhone.trim()
        ? [t('Telefon raqamingizni kiriting.'), shipPhoneRef]
        : null;
    if (!missing) return;
    setShipErr(missing[0]);
    missing[1].current?.focus();
  };

  // Dizayner o'zining joriy maketini shu ref orqali beradi (pastdagi
  // <CardDesignerPage printApi={printApiRef} />).
  const printApiRef = useRef(null);

  const orderPhysicalCard = async () => {
    if (!shippingFilled) {
      focusMissingShipping();
      return;
    }
    setBusy(true); setMsg(null); setShipErr('');
    try {
      // ─── MAKETNI BUYURTMAGA BIRIKTIRISH ─────────────────────────────
      // Avval buyurtma bilan faqat manzil ketardi — dizayn brauzerda
      // qolib ketar va admin nima chop etishni bilmasdi. Endi mijoz
      // ko'rib turgan maket AYNAN shu daqiqada ikkala tomon uchun
      // 600 DPI PNG qilib chiqariladi va yuklanadi.
      //
      // Yuklash muvaffaqiyatsiz bo'lsa BUYURTMA YARATILMAYDI: maketsiz
      // buyurtma admin uchun foydasiz — pul olinib, nima chop etishni
      // bilmay qolgandan ko'ra, mijozdan qayta urinishni so'ragan
      // yaxshiroq.
      let designFrontUrl = '';
      let designBackUrl = '';
      const api = printApiRef.current;
      if (api) {
        const pair = api.getPrintPair();
        [designFrontUrl, designBackUrl] = await Promise.all([
          dbUploadCardPrint(pair.front),
          dbUploadCardPrint(pair.back),
        ]);
      }

      const res = await dbOrderPhysicalCard(card.code, {
        // `shippingAddress` YUBORILMAYDI — manzil so'ralmaydi.
        shippingName: shipName.trim(), shippingPhone: shipPhone.trim(),
        shippingCarrier: shipCarrier, quantity: qty,
        designFrontUrl, designBackUrl,
      });
      setCardOrder(res);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const autoTier = tierForCode(card.code);
  const previewFinish = finish && finish !== 'auto' ? finish : ('tier-' + autoTier);

  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true); setMsg(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const url = await dbUploadImage(dataUrl);
      setBgUrl(url);
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const onPickVideo = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true); setMsg(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error(t('Video 10 MB dan katta — kichraytiring.'));
      const url = await dbUploadCardVideo(file);
      setBgUrl(url);
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
    finally { setUploading(false); if (videoRef.current) videoRef.current.value = ''; }
  };

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const touched = finish !== 'auto' || name.trim() || bgUrl || nameColor || brandColor
        || nameScale !== 1 || namePos.x !== DEFAULT_NAME_POS.x || namePos.y !== DEFAULT_NAME_POS.y
        || codeScale !== 1 || codePos.x !== DEFAULT_CODE_POS.x || codePos.y !== DEFAULT_CODE_POS.y
        || brandScale !== 1 || brandPos.x !== DEFAULT_BRAND_POS.x || brandPos.y !== DEFAULT_BRAND_POS.y;
      const cardDesign = touched
        ? {
            finish, name: name.trim(), bgUrl, nameColor, brandColor,
            nameX: namePos.x, nameY: namePos.y, nameScale,
            codeX: codePos.x, codeY: codePos.y, codeScale,
            brandX: brandPos.x, brandY: brandPos.y, brandScale,
          }
        : null;
      // Server validatsiyasi to'liq profil obyektini kutadi (ism majburiy) —
      // shuning uchun mavjud maydonlarni ham yuboramiz, faqat cardDesign yangi.
      await authUpdateCard(card.code, {
        name: card.name, role: card.role || '', avatarUrl: card.avatarUrl || '',
        bgUrl: card.bgUrl || '', accentColor: card.accentColor || '', bgColor: card.bgColor || '',
        bgAnimated: card.bgAnimated !== false,
        linkStyle: ['standard', 'transparent', 'glass'].includes(card.linkStyle) ? card.linkStyle : (card.linksTransparent ? 'glass' : 'standard'),
        musicUrls: card.musicUrls || [], tg: card.tg || '', phone: card.phone || '', hidePhone: !!card.hidePhone,
        email: card.email || '', linkedin: card.linkedin || '', instagram: card.instagram || '',
        facebook: card.facebook || '', twitter: card.twitter || '', website: card.website || '',
        about: card.about || '', cardNumber: card.cardNumber || '',
        extraLinks: card.extraLinks || [], cardNumbers: card.cardNumbers || [],
        theme: card.theme || 'classic', hashtags: card.hashtags || [],
        cardDesign,
      });
      setMsg({ type: 'ok', text: t('Saqlandi.') });
      onSaved?.();
      setTimeout(onClose, 500);
    } catch (err) { setMsg({ type: 'err', text: err.message || t('Saqlashda xatolik yuz berdi.') }); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={t('Karta dizayni')} onClose={onClose} wide>
      <div className="mb-4 flex gap-1 border-b border-white/10">
        <button className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'profile' ? 'border-accent text-accent' : 'border-transparent text-base-content/50'}`} onClick={() => setTab('profile')}>
          {t('Profil kartasi')}
        </button>
        <button className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'print' ? 'border-accent text-accent' : 'border-transparent text-base-content/50'}`} onClick={() => setTab('print')}>
          {t('Bosma karta')}
        </button>
      </div>

      {tab === 'profile' && (
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div>
            <div className="text-[14px] font-semibold uppercase tracking-wider text-base-content/45">{t('Karta rangi')}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {CARD_FINISHES.map((f) => (
                <button key={f.id} type="button" title={t(f.label)} onClick={() => setFinish(f.id)}
                  className={`h-8 w-8 shrink-0 rounded-lg border transition ${finish === f.id ? 'ring-2 ring-white ring-offset-2 ring-offset-base-200' : 'border-white/15'}`}
                  style={{ background: f.css }} />
              ))}
            </div>
            <div className="mt-1.5 text-xs text-base-content/45">{t(CARD_FINISHES.find((f) => f.id === finish)?.label || '')}</div>

            <label className="form-control mt-4 block">
              <span className="text-xs font-semibold text-base-content/70">{t('Kartadagi ism (bo‘sh — profil ismi)')}</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder={card.name} className="input input-bordered input-sm mt-1 w-full bg-base-100" />
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input type="color" value={nameColor || '#ffffff'} onChange={(e) => setNameColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0" />
              <span className="text-xs text-base-content/60">{t('Ism rangi')}</span>
              {nameColor && <button type="button" className="btn btn-ghost btn-xs" onClick={() => setNameColor('')}>{t('Andozaga qaytarish')}</button>}
            </div>

            <div className="mt-4">
              <span className="text-xs font-semibold text-base-content/70">{t('Karta foni: rasm, GIF yoki video (ixtiyoriy)')}</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*,image/gif" onChange={onPick} className="file-input file-input-bordered file-input-sm bg-base-100" disabled={uploading} />
                <button type="button" className="btn btn-outline btn-sm" disabled={uploading} onClick={() => videoRef.current && videoRef.current.click()}>{t('Video tanlash')}</button>
                <input ref={videoRef} type="file" accept="video/mp4,video/webm" onChange={onPickVideo} className="hidden" />
                {bgUrl && <button type="button" className="btn btn-ghost btn-xs" onClick={() => setBgUrl('')}>{t('Olib tashlash')}</button>}
              </div>
              <p className="mt-1 text-[14px] text-base-content/40">{t('GIF: iPhone’da “Fayllar”dan tanlang (Galereyadan tanlansa animatsiya yo‘qoladi). Rasm/GIF maks. 3 MB, video (MP4/WebM) maks. 10 MB.')}</p>
              {uploading && <p className="mt-1 text-xs text-base-content/45"><span className="loading loading-spinner loading-xs"></span> {t('Yuklanmoqda...')}</p>}

              {/* TAYYOR FONLAR — o'z rasmini izlab yurmasin. Bular
                  saytning o'z fayllari, shuning uchun yuklash ham,
                  hajm chegarasi ham yo'q: tanlash yetarli. */}
              <div className="mt-3">
                <span className="text-xs font-semibold text-base-content/70">{t('Yoki tayyor fonlardan tanlang')}</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CARD_BACKGROUNDS.map((bg) => {
                    const active = cardBackgroundFromUrl(bgUrl)?.id === bg.id;
                    return (
                      <button
                        key={bg.id} type="button" onClick={() => setBgUrl(bg.url)}
                        className={`overflow-hidden rounded-xl border text-left transition ${active ? 'border-accent ring-1 ring-accent/50' : 'border-white/10 hover:border-white/30'}`}
                      >
                        <img src={bg.thumb} alt="" loading="lazy" className="block h-auto w-full" />
                        <span className="block px-2 py-1 text-[11px] text-base-content/70">{t(bg.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-base-content/70">{t('Ism o‘lchami')}: {Math.round(nameScale * 100)}%</span>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => {
                  setNamePos(DEFAULT_NAME_POS); setNameScale(1);
                  setCodePos(DEFAULT_CODE_POS); setCodeScale(1);
                  setBrandPos(DEFAULT_BRAND_POS); setBrandScale(1); setBrandColor(''); setNameColor('');
                }}>{t('Andozaga qaytarish')}</button>
              </div>
              <input type="range" min={0.6} max={2.4} step={0.05} value={nameScale} onChange={(e) => setNameScale(Number(e.target.value))} className="range range-xs range-primary mt-1" />

              <div className="mt-3 text-xs font-semibold text-base-content/70">{t('NFC ID o‘lchami')}: {Math.round(codeScale * 100)}%</div>
              <input type="range" min={0.5} max={2.2} step={0.05} value={codeScale} onChange={(e) => setCodeScale(Number(e.target.value))} className="range range-xs range-primary mt-1" />

              <div className="mt-3 text-xs font-semibold text-base-content/70">{t('NFCSTORE yozuvi o‘lchami')}: {Math.round(brandScale * 100)}%</div>
              <input type="range" min={0.5} max={2.4} step={0.05} value={brandScale} onChange={(e) => setBrandScale(Number(e.target.value))} className="range range-xs range-primary mt-1" />
              <div className="mt-2 flex items-center gap-3">
                <input type="color" value={brandColor || '#cbd5e1'} onChange={(e) => setBrandColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0" />
                <span className="text-xs text-base-content/60">{t('NFCSTORE yozuvi rangi')}</span>
              </div>

              <p className="mt-1.5 text-xs text-base-content/45">{t('Kartadagi ism, NFC ID va NFCSTORE yozuvini sichqoncha bilan ushlab, istalgan joyga suring.')}</p>
            </div>

            <button className="btn btn-primary btn-sm mt-5" onClick={save} disabled={busy || uploading}>
              {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Saqlash')}
            </button>
            {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
          </div>

          <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-[14px] uppercase tracking-wider text-base-content/40">{t('Oldindan ko‘rish')}</div>
            <NfcCard
              code={card.code}
              name={name || card.name}
              finish={previewFinish}
              bgImage={bgUrl || ''}
              size="sm"
              since={card.ts}
              namePos={namePos}
              nameScale={nameScale}
              nameColor={nameColor}
              onNameChange={setNamePos}
              codePos={codePos}
              codeScale={codeScale}
              onCodeChange={setCodePos}
              brandPos={brandPos}
              brandScale={brandScale}
              brandColor={brandColor}
              onBrandChange={setBrandPos}
            />
          </div>
        </div>
      )}

      {tab === 'print' && (
        <div>
          <div className="mb-4">
            <PaymeBlock
              title={t('Jismoniy NFC karta buyurtma berish')}
              subtitle={t('Dizaynni tayyorlab, chop etilgan haqiqiy NFC kartani pochta orqali olasiz.')}
              amount={PHYSICAL_CARD_FEE_UZS * qty}
              payLink={cardOrder ? cardOrder.payLink : null}
              onPay={orderPhysicalCard}
              payLabel={cardOrder ? t("To'lovga o'tish") : t("Buyurtma berish va to'lash")}
              busy={busy}
              disabled={!cardOrder && !shippingFilled}
              onBlocked={focusMissingShipping}
              note={cardOrder
                ? t("Buyurtma qabul qilindi. To'lov tasdiqlangach kartani tayyorlashni boshlaymiz.")
                : (!shippingFilled ? t('Davom etish uchun yetkazib berish maʼlumotlarini toʻldiring.') : null)}
            >
              {!cardOrder && (
                <div className="mt-3 grid gap-2">
                  <input
                    ref={shipNameRef}
                    className="vz-input" value={shipName}
                    onChange={(e) => { setShipName(e.target.value); if (shipErr) setShipErr(''); }}
                    placeholder={t('Qabul qiluvchi ismi')} aria-label={t('Qabul qiluvchi ismi')}
                    aria-invalid={shipErr && !shipName.trim() ? true : undefined}
                  />
                  <input
                    ref={shipPhoneRef}
                    className="vz-input" value={shipPhone}
                    onChange={(e) => { setShipPhone(e.target.value); if (shipErr) setShipErr(''); }}
                    placeholder={t('Telefon raqamingiz (+998...)')} aria-label={t('Telefon raqamingiz (+998...)')}
                    aria-invalid={shipErr && !shipPhone.trim() ? true : undefined}
                    inputMode="tel"
                  />
                  {/* MANZIL SO'RALMAYDI (2026-09, egasining qarori):
                      yetkazib berish sayt orqali emas, to'lovdan keyin
                      to'g'ridan-to'g'ri kelishiladi. Shuning uchun ism va
                      telefon yetarli. */}
                  <label className="flex items-center gap-3">
                    <span className="shrink-0 text-sm text-base-content/70">{t('Nechta karta?')}</span>
                    <input
                      type="number" min={1} max={PHYSICAL_CARD_MAX_QTY} value={shipQty}
                      onChange={(e) => setShipQty(e.target.value)}
                      className="vz-input w-24" aria-label={t('Nechta karta?')}
                    />
                    <span className="text-sm text-base-content/50">
                      {qty} &times; {fmt(PHYSICAL_CARD_FEE)} = <b className="text-base-content/80">{fmt(PHYSICAL_CARD_FEE * qty)}</b> {t("so'm")}
                    </span>
                  </label>
                  <select
                    className="vz-input" value={shipCarrier} onChange={(e) => setShipCarrier(e.target.value)}
                    aria-label={t('Yetkazib berish xizmati')}
                  >
                    <option value="">{t('Yetkazib berish xizmatini tanlang')}</option>
                    {['BTS Express', 'Fargo‘', 'O‘zbekiston Pochtasi'].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                  {shipErr && <div role="alert" className="vz-err">{shipErr}</div>}
                  {/* Yetkazib berish sharti to'lovdan OLDIN ko'rinadi —
                      mijoz kuryerga qancha to'lashini keyin bilmasin. */}
                  <p className="text-xs leading-relaxed text-base-content/50">
                    {t('Toshkent shahri bo‘ylab yetkazib berish bepul. Viloyatlarga: bir buyurtmada {n} tadan ortiq karta bo‘lsa bepul, {n} tagacha bo‘lsa yetkazib berish haqini qabul qilishda kuryerga o‘zingiz to‘laysiz.', { n: PHYSICAL_CARD_FREE_DELIVERY_QTY })}
                  </p>
                  {/* Bepul yetkazish chegarasi bosib o'tilganini DARHOL
                      ko'rsatamiz — mijoz "yana bittasini qo'shsam bepul
                      bo'larkan" deb bilsin. */}
                  {freeDelivery && (
                    <p className="text-xs font-semibold text-[color:var(--vz-gold-2)]">
                      {t('✓ Yetkazib berish bepul — {n} tadan ortiq buyurtma.', { n: PHYSICAL_CARD_FREE_DELIVERY_QTY })}
                    </p>
                  )}
                </div>
              )}
            </PaymeBlock>
          </div>
          <Suspense fallback={<div className="py-10 text-center text-sm text-base-content/45">{t('Yuklanmoqda...')}</div>}>
            <CardDesignerPage embedded code={card.code} printApi={printApiRef} />
          </Suspense>
        </div>
      )}
    </Modal>
  );
}

// extraSections: [{ id, label, Icon, content, badge }] — kabinet (AccountPage)
//   shu forma navigatsiyasiga qo'shimcha bo'limlar (Premium, Sovg'a/Buyurtma)
//   beradi — natijada kabinetda BITTA navigatsiya bo'ladi.
// cabinetLinks: [{ id, label, Icon, onClick, disabled }] — boshqa sahifalarga
//   (Bildirishnomalar, To'lovlar, Akkaunt sozlamalari...) havolalar, sidebar'ning
//   pastki guruhi.
export function EditCardForm({ card, onSaved, workspaceOnly = false, myCards = [], onSelectCard, extraSections = [], cabinetLinks = [] }) {
  const { t, lang } = useLanguage();
  const { user, refresh } = useAuth();
  const cats = useCategories();
  // Bu kartaning effective access darajasi (NFC ID tarifi + Profile Premium).
  const access = effectiveAccess(card, user);
  const allow = (feature) => featureAllowed(feature, access);
  // Musiqa limiti FOYDALANUVCHINING premium holatiga bog'liq: oddiy 5,
  // Premium 10. Backend AYNAN shu qoidani qo'llaydi (hosting/worker.js
  // musicLimitD1(user.isPremium)) — ikkalasi bir manbadan
  // (src/lib/musicLimits.js) hisoblanadi.
  const isPremiumUser = !!user?.isPremium;
  const musicMax = musicLimit(isPremiumUser);
  const [locked, setLocked] = useState(null); // yopiq funksiya nomi (modal uchun)
  // "Joriy joylashuvimni olish" tugmasining holati.
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  // Business Workspace navigatsiyasi: 'asosiy' | 'katalog' | 'lokatsiya' | 'sozlamalar'.
  // Shaxsiy/expert profillar uchun ishlatilmaydi (ular eski flat accordion'da qoladi).
  const [wsTab, setWsTab] = useState(() => (card.profileType === 'business' ? 'asosiy' : 'boshqaruv'));
  const [form, setForm] = useState({
    name: card.name,
    role: card.role || '',
    profileType: ['personal', 'expert', 'business'].includes(card.profileType) ? card.profileType : 'personal',
    city: card.city || '',
    categorySlug: card.categorySlug || '',
    // Profilda ko'rsatiladigan kompaniya (bo'sh — ko'rsatilmaydi).
    companyId: card.companyId || '',
    address: card.address || '',
    latitude: card.latitude != null ? String(card.latitude) : '',
    longitude: card.longitude != null ? String(card.longitude) : '',
    hiddenFromDirectory: !!card.hiddenFromDirectory,
    avatarUrl: card.avatarUrl || '',
    bgUrl: card.bgUrl || '',

    accentColor: card.accentColor || '',
    bgColor: card.bgColor || '',
    bgAnimated: card.bgAnimated !== false,
    linkStyle: ['standard', 'transparent', 'glass'].includes(card.linkStyle)
      ? card.linkStyle
      : (card.linksTransparent ? 'glass' : 'standard'),
    // Ko'pi bilan 5 ta qo'shiq (eski bitta-URL kartalar bilan moslik uchun
    // `card.musicUrl` ham qabul qilinadi, agar `musicUrls` bo'lmasa).
    musicUrls: Array.isArray(card.musicUrls) ? card.musicUrls.slice(0, MUSIC_LIMIT_PREMIUM) : (card.musicUrl ? [card.musicUrl] : []),
    tg: card.tg || '',
    phone: card.phone || '',
    hidePhone: !!card.hidePhone,
    email: card.email || '',
    linkedin: card.linkedin || '',
    instagram: card.instagram || '',
    facebook: card.facebook || '',
    twitter: card.twitter || '',
    website: card.website || '',
    about: card.about || '',
    cardNumber: card.cardNumber || '',
    extraLinks: (card.extraLinks && card.extraLinks.length) ? card.extraLinks.map((l) => ({ ...l })) : [],
    cardNumbers: (card.cardNumbers && card.cardNumbers.length) ? card.cardNumbers.map((c) => ({ ...c })) : [],
    theme: card.theme || 'classic',
    hashtags: (card.hashtags || []).join(', '),
  });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  // Saqlanmagan o'zgarishlar: oxirgi saqlangan holat JSON'i bilan solishtiriladi.
  // dirty=false bo'lsa "Saqlash" o'chiq; dirty bo'lsa sahifadan chiqishda ogohlantirish.
  const savedFormRef = useRef(null);
  const formKey = JSON.stringify(form);
  if (savedFormRef.current === null) savedFormRef.current = formKey;
  const dirty = formKey !== savedFormRef.current;
  useEffect(() => {
    if (!dirty) return undefined;
    const guard = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [saleMsg, setSaleMsg] = useState(null);
  const fileRef = useRef(null);
  const bgFileRef = useRef(null);
  const musicFileRef = useRef(null);
  // Qaysi qo'shiq qatoriga fayl yuklanayotgani (bitta umumiy fayl input
  // barcha qatorlar uchun ishlatiladi) — ko'pi bilan 5 ta qo'shiq.
  const [musicUploadIndex, setMusicUploadIndex] = useState(null);
  // Musiqa xabari AYNAN o'sha qator ichida chiqadi. Avval u sahifaning
  // eng pastidagi umumiy `msg` blokida chiqardi — foydalanuvchi 4-5-qatorda
  // fayl tanlaganda xabar ekrandan tashqarida qolib, "hech narsa bo'lmadi"
  // degan taassurot berardi. { idx, type: 'err' | 'ok', text }
  const [musicMsg, setMusicMsg] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Oddiy foydalanuvchi limitga yetganda (6-qo'shiq) — Premium taklif
  // oynasi ochiladi. Premium foydalanuvchi 10 tagacha qo'sha oladi.
  const addMusic = () => {
    if (form.musicUrls.length >= musicMax) {
      if (!isPremiumUser) setLocked(t('5 tadan ortiq qo‘shiq'));
      return;
    }
    setForm((f) => ({ ...f, musicUrls: [...f.musicUrls, ''] }));
  };
  const updateMusic = (i) => (e) => {
    setMusicMsg((m) => (m && m.idx === i ? null : m));
    setForm((f) => ({ ...f, musicUrls: f.musicUrls.map((u, idx) => (idx === i ? e.target.value : u)) }));
  };
  // Qator o'chirilsa keyingilarning indeksi siljiydi — xabar boshqa
  // qatorga yopishib qolmasligi uchun tozalanadi.
  const removeMusic = (i) => {
    setMusicMsg(null);
    setForm((f) => ({ ...f, musicUrls: f.musicUrls.filter((_, idx) => idx !== i) }));
  };

  const addLink = () => setForm((f) => ({ ...f, extraLinks: [...f.extraLinks, { label: '', url: '' }] }));
  const updateLink = (i, key) => (e) => setForm((f) => {
    const list = f.extraLinks.map((l, idx) => (idx === i ? { ...l, [key]: e.target.value } : l));
    return { ...f, extraLinks: list };
  });
  const removeLink = (i) => setForm((f) => ({ ...f, extraLinks: f.extraLinks.filter((_, idx) => idx !== i) }));

  const addCardNum = () => setForm((f) => ({ ...f, cardNumbers: [...f.cardNumbers, { label: '', number: '' }] }));
  const updateCardNum = (i, key) => (e) => setForm((f) => {
    const list = f.cardNumbers.map((c, idx) => (idx === i ? { ...c, [key]: e.target.value } : c));
    return { ...f, cardNumbers: list };
  });
  const removeCardNum = (i) => setForm((f) => ({ ...f, cardNumbers: f.cardNumbers.filter((_, idx) => idx !== i) }));

  const onPickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const url = await dbUploadImage(dataUrl);
      setForm((f) => ({ ...f, avatarUrl: url }));
      setMsg({ type: 'ok', text: t('Rasm yuklandi. Saqlash tugmasini bosing.') });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Profil foni: oddiy rasm (JPG/PNG) avvalgidek siqiladi va /api/upload
  // orqali ketadi — uning limiti O'ZGARMAGAN. GIF va video esa 50 MB gacha
  // XOM BINAR sifatida /api/upload-profile-bg ga yuboriladi (siqilsa GIF
  // animatsiyasi yo'qolardi, base64 esa 50 MB ni ko'tara olmasdi).
  const onPickBgFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadingBg(true);
    setMsg(null);
    try {
      const type = String(file.type || '').toLowerCase();
      const isGif = type === 'image/gif' || /\.gif$/i.test(file.name || '');
      const isVideo = type.startsWith('video/') || /\.(mp4|webm|m4v|mov)$/i.test(file.name || '');
      let url;
      if (isGif || isVideo) {
        if (file.size > PROFILE_BG_MAX_BYTES) throw new Error(t('Maksimal hajm — 50 MB.'));
        url = await dbUploadProfileBgMedia(file);
      } else {
        const dataUrl = await fileToCompressedDataUrl(file);
        url = await dbUploadImage(dataUrl);
      }
      setForm((f) => ({ ...f, bgUrl: url }));
      setMsg({ type: 'ok', text: t('Fon yuklandi. Saqlash tugmasini bosing.') });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setUploadingBg(false);
      if (bgFileRef.current) bgFileRef.current.value = '';
    }
  };

  const onPickMusicFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    const idx = musicUploadIndex;
    if (!file || idx == null) return;
    if (file.size > MUSIC_MAX_MB * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setMusicMsg({ idx, type: 'err', text: t("Fayl {size} MB — maksimal {n} MB. Kichikroq fayl tanlang.", { size: mb, n: MUSIC_MAX_MB }) });
      if (musicFileRef.current) musicFileRef.current.value = '';
      setMusicUploadIndex(null);
      return;
    }
    setUploadingMusic(true);
    setMusicMsg(null);
    try {
      const dataUrl = await audioFileToDataUrl(file);
      const url = await dbUploadAudio(dataUrl);
      setForm((f) => ({ ...f, musicUrls: f.musicUrls.map((u, i) => (i === idx ? url : u)) }));
      setMusicMsg({ idx, type: 'ok', text: t('Musiqa yuklandi. Saqlash tugmasini bosing.') });
    } catch (err) {
      setMusicMsg({ idx, type: 'err', text: err.message });
    } finally {
      setUploadingMusic(false);
      setMusicUploadIndex(null);
      if (musicFileRef.current) musicFileRef.current.value = '';
    }
  };

  const [giftOpen, setGiftOpen] = useState(false);
  const [giftToCode, setGiftToCode] = useState('');
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftMsg, setGiftMsg] = useState(null);
  const [postModal, setPostModal] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [designModal, setDesignModal] = useState(null); // null | 'profile' | 'print'

  // Bosh sahifa yoki katalogdagi "NFC ID karta buyurtma berish" taklifidan
  // kelgan bo'lsa — dizayn oynasi O'ZI ochiladi, odam kabinetdan uni
  // qaytadan qidirmasin. Niyat ikki joyda: manzildagi `?open=` va
  // sessiyada (ro'yxatdan o'tish oqimi manzilni yo'qotib yuborishi
  // mumkin). Bir marta ishlaydi va darhol tozalanadi — sahifa
  // yangilanganda oyna qayta ochilib qolmasin.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !card?.isPrimary) return;
    let wanted = '';
    try {
      wanted = new URLSearchParams(window.location.search).get('open') || '';
      if (!wanted) wanted = sessionStorage.getItem('nfcx:open-after-auth') || '';
    } catch { /* jim */ }
    if (wanted !== 'nfc-karta') return;
    autoOpened.current = true;
    try { sessionStorage.removeItem('nfcx:open-after-auth'); } catch { /* jim */ }
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    // Tarif tekshiruvi tugmadagi bilan AYNAN bir xil: yetmasa "yopiq
    // funksiya" oynasi chiqadi va nima kerakligini aytadi.
    if (allow('physicalCardDesigner')) setDesignModal('print');
    else setLocked(t('Jismoniy NFC karta dizayni'));
  }, [card, allow, t]);
  const sendGift = async () => {
    if (!giftToCode.trim()) { setGiftMsg({ type: 'err', text: t("Qabul qiluvchining NFC ID'sini kiriting.") }); return; }
    setGiftBusy(true);
    setGiftMsg(null);
    try {
      await dbGiftCard(card.code, giftToCode.trim().toUpperCase());
      setGiftMsg({ type: 'ok', text: t("Sovg'a taklifi yuborildi — qabul qiluvchi tasdiqlagach, egalik o'tadi.") });
      setGiftToCode('');
      onSaved(card);
    } catch (err) {
      setGiftMsg({ type: 'err', text: err.message });
    } finally {
      setGiftBusy(false);
    }
  };

  const [primaryBusy, setPrimaryBusy] = useState(false);
  const makePrimary = async () => {
    setPrimaryBusy(true);
    setSaleMsg(null);
    try {
      await dbSetPrimary(card.code);
      onSaved({ ...card, isPrimary: true });
      setSaleMsg({ type: 'ok', text: t("Asosiy profil sifatida belgilandi.") });
    } catch (err) {
      setSaleMsg({ type: 'err', text: err.message });
    } finally {
      setPrimaryBusy(false);
    }
  };

  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const isFreeId = /^[0-9]{8}$/.test(card.code);
  const doDelete = async () => {
    setDelBusy(true);
    try {
      await dbDeleteOwnCard(card.code);
      setDelOpen(false);
      await onSaved();
    } catch (err) {
      setSaleMsg({ type: 'err', text: err.message });
      setDelOpen(false);
    } finally {
      setDelBusy(false);
    }
  };

  const submit = async () => {
    if (!form.name.trim()) { setMsg({ type: 'err', text: t("Ism bo'sh bo'lmasligi kerak.") }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const updated = await authUpdateCard(card.code, {
        name: form.name.trim(),
        role: form.role.trim(),
        profileType: form.profileType,
        city: form.city.trim(),
        categorySlug: form.categorySlug,
        companyId: form.companyId,
        address: form.address.trim(),
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
        hiddenFromDirectory: form.hiddenFromDirectory,
        avatarUrl: form.avatarUrl.trim(),
        bgUrl: form.bgUrl.trim(),
        accentColor: form.accentColor,
        bgColor: form.bgColor,
        bgAnimated: form.bgAnimated,
        linkStyle: form.linkStyle,
        musicUrls: form.musicUrls.map((u) => u.trim()).filter(Boolean).slice(0, musicMax),
        tg: socialHandle('tg', form.tg),
        phone: form.phone.trim(),
        hidePhone: form.hidePhone,
        email: form.email.trim(),
        linkedin: form.linkedin.trim(),
        // SAQLASHDA TOZALANADI: odam Instagram/Telegram'dagi "Havoladan
        // nusxa olish" tugmasi bergan TO'LIQ manzilni qo'yishi tabiiy.
        // Undan faqat username ajratib olinadi, kuzatuv parametrlari
        // (stkn, utm_*) tashlanadi — batafsil src/lib/socialLinks.js.
        instagram: socialHandle('ig', form.instagram),
        facebook: form.facebook.trim(),
        twitter: socialHandle('x', form.twitter),
        website: form.website.trim(),
        about: form.about,
        cardNumber: form.cardNumber.trim(),
        extraLinks: form.extraLinks
          .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
          .filter((l) => l.url),
        cardNumbers: form.cardNumbers
          .map((c) => ({ label: c.label.trim(), number: c.number.trim() }))
          .filter((c) => c.number),
        theme: form.theme,
        hashtags: form.hashtags.split(',').map((h) => h.trim()).filter(Boolean),
      });
      savedFormRef.current = JSON.stringify(form);
      setMsg({ type: 'ok', text: t('Saqlandi! Profilingiz yangilandi.') });
      onSaved(updated);
    } catch (err) {
      if (err.message === 'feature_locked') {
        const labels = {
          music: t('Profil musiqasi'),
          innerBackground: t('Maxsus profil foni'),
          advancedColors: t('Maxsus ranglar'),
          profileCardCustom: t('Karta dizayni'),
          linkStyle: t('Havola tugmalari uslubi'),
          leadCapture: t('Lidlarni yig‘ish'),
        };
        setLocked(labels[err.feature] || t('Bu sozlama'));
        setBusy(false);
        return;
      }
      const text = err.message === 'unauthorized'
        ? t('Avval tizimga kiring.')
        : err.message === 'forbidden'
          ? t("Bu raqamli tashrif qog'ozi sizga tegishli emas.")
          : (err.message === 'too_many_requests' || err.message === 'api_error_429')
            ? t("Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.")
            : err.name === 'TypeError'
              ? t("Server bilan aloqa yo'q. Qayta urinib ko'ring.")
              : t("Saqlashda xatolik yuz berdi.");
      setMsg({ type: 'err', text });
    } finally {
      setBusy(false);
    }
  };

  const inp = 'input input-bordered input-sm mt-1 w-full bg-base-100';

  // Shaxsiy Workspace sarlavhasidagi "Chiqish" — mavjud authLogout/refresh
  // handlerlaridan foydalanadi (AccountPage'dagi bilan bir xil), yangi
  // auth/session logikasi yo'q.
  const wsLogout = async () => {
    await authLogout().catch(() => {});
    await refresh();
    navigate('/');
  };

  // ── Business Workspace navigatsiyasi (Architecture Correction) ──────
  // Biznes profil uchun editor endi PERSONAL profil bilan bir xil uzun
  // accordion emas — alohida, moduliga qarab moslashuvchan tab navigatsiya.
  // Shaxsiy/expert profillar uchun bu butunlay tegmaydi — ular hamon
  // eski flat accordion ko'rinishida (wsTab shart tekshiruvi har doim
  // `!isBusiness ||` bilan bypass qilinadi).
  //
  // LIVE vs SAQLANGAN: tab-bar "Profil turi"da "Biznes" bosilgan zahoti
  // (hali saqlanmagan bo'lsa ham) ko'rinsin — shuning uchun `isBusiness`/
  // `catalogModule` joriy `form` qoralamasiga tayanadi. Lekin Katalog/
  // Galereya/Jamoa bo'limlari haqiqiy API chaqiradi (dbGetMenuManage va
  // h.k.), server esa SAQLANGAN `card.profileType`ga qarab ruxsat beradi
  // — shuning uchun ularning ICHKI kontenti `saved*` qiymatlarga tayanadi
  // va mos kelmasa "avval saqlang" xabari chiqadi (403 xatosini oldini olish).
  const isBusiness = form.profileType === 'business';

  // "Profil turi"da jonli (hali saqlanmagan) Shaxsiy<->Biznes almashtirilsa,
  // wsTab boshqa tizimning tab id'sida qolib ketmasin (aks holda tab bar
  // ko'rinadi-yu, ichi bo'sh qolib ketadi) — mos kelmasa mos andozaga qaytaramiz.
  useEffect(() => {
    const extraIds = extraSections.map((x) => x.id);
    const businessTabs = ['asosiy', 'katalog', 'aksiyalar', 'galereya', 'lokatsiya', 'sozlamalar', ...extraIds];
    // Shaxsiy profilda alohida "Sozlamalar" tabi yo'q — akkaunt sozlamalari
    // sidebar'ning "Kabinet" guruhidan (bitta kirish nuqtasi) ochiladi.
    const personalTabs = ['boshqaruv', 'profil', 'nfckarta', 'myids', 'postlar', ...extraIds];
    if (isBusiness && !businessTabs.includes(wsTab)) setWsTab('asosiy');
    if (!isBusiness && !personalTabs.includes(wsTab)) setWsTab('boshqaruv');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBusiness]);

  const savedIsBusiness = card.profileType === 'business';
  const catalogModule = businessModule(form.profileType, form.categorySlug); // 'menu' | 'products' | 'services' | null
  const savedCatalogModule = businessModule(card.profileType, card.categorySlug);
  const catalogReady = savedIsBusiness && savedCatalogModule === catalogModule;
  const CATALOG_TAB_LABEL = { menu: t('Menyu'), products: t('Mahsulotlar'), services: t('Xizmatlar') };

  // ── NFC ID boshqaruv paneli (kod/narx/ko'rishlar + Sovg'a/Post/Karta
  // dizayni/NFC buyurtma/O'chirish) — biznes profil uchun bu ENDI birinchi
  // ko'rinadigan narsa emas ("avvalgi NFC ID'ga tegishli narsalar bo'lmasin"
  // — Business Workspace faqat kompaniyaga tegishli bo'lsin). Shaxsiy/
  // ekspert profilda o'zgarishsiz yuqorida qoladi; biznes profilda esa
  // Sozlamalar tabiga ko'chadi — funksiya yo'qolmaydi, faqat joyi o'zgaradi.
  const nfcIdBlock = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-sm font-bold tracking-wide">
            nfcstore.uz/{card.code.toLowerCase()}
            {card.isPrimary && <span className="badge badge-accent badge-xs">{t("ASOSIY")}</span>}
          </div>
          <div className="mt-1 text-xs text-base-content/50">
            {t("{n} so'm", { n: fmt(card.price) })} · {timeAgo(card.ts)} · {t("{n} ko'rish", { n: fmt(card.views || 0) })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost-vz btn-sm min-h-11" onClick={() => navigate('/' + card.code)}><IconEye width={14} height={14} /> {t("Ko'rish")}</button>
          {!card.isPrimary && (
            <button className="btn btn-ghost-vz btn-sm min-h-11" onClick={makePrimary} disabled={primaryBusy}>
              {primaryBusy ? <span className="loading loading-spinner loading-xs"></span> : t('Asosiy qilish')}
            </button>
          )}
          {card.giftable !== false && (
            <button className="btn btn-outline-gold btn-sm min-h-11" onClick={() => setGiftOpen((o) => !o)}>
              <IconGift width={14} height={14} /> {t("Sovg'a qilish")}
            </button>
          )}
          <button
            className="btn btn-outline-gold btn-sm min-h-11"
            onClick={() => (allow('post') ? setPostModal(true) : setLocked(t('Post joylashtirish')))}
          >
            <IconImage width={14} height={14} /> {t('Post')}{!allow('post') && <span className="ml-1 opacity-70"><IconLock width={12} height={12} /></span>}
          </button>
          {/* ISTORYA — gold, premium, ekskluziv va premium obunachilar
              uchun. Yopiq bo'lsa tugma ko'rinadi-yu, qulf bilan: odam
              nima ochilishini bilsin (mavjud "Post" tugmasi bilan bir xil
              mantiq). */}
          <button
            className="btn btn-outline-gold btn-sm min-h-11"
            onClick={() => (allow('story') ? setStoryOpen(true) : setLocked(t('Istorya joylashtirish')))}
          >
            <IconImage width={14} height={14} /> {t('Istorya')}{!allow('story') && <span className="ml-1 opacity-70"><IconLock width={12} height={12} /></span>}
          </button>
          <button
            className="btn btn-outline-gold btn-sm min-h-11"
            onClick={() => (allow('profileCardCustom') ? setDesignModal('profile') : setLocked(t('Karta dizayni')))}
          >
            <IconPalette width={14} height={14} /> {t('Karta dizayni')}{!allow('profileCardCustom') && <span className="ml-1 opacity-70"><IconLock width={12} height={12} /></span>}
          </button>
          <button
            className="btn btn-outline-gold btn-sm min-h-11"
            onClick={() => (allow('physicalCardDesigner') ? setDesignModal('print') : setLocked(t('Jismoniy NFC karta dizayni')))}
          >
            <IconCard width={14} height={14} /> {t('NFC ID karta buyurtma berish')}{!allow('physicalCardDesigner') && <span className="ml-1 opacity-70"><IconLock width={12} height={12} /></span>}
          </button>
          <button className="btn btn-ghost btn-sm min-h-11 text-error" onClick={() => setDelOpen(true)}>
            <IconTrash width={14} height={14} /> {t("O'chirish")}
          </button>
        </div>
      </div>

      {/* Qisqa ekranda (iPhone SE va h.k.) matn uzun bo'lsa tasdiqlash
          tugmasi ostda qolib ketardi va unga yetib bo'lmasdi — na fon,
          na quti scroll bo'lardi. Sayt bo'ylab to'g'ri naqsh shu:
          fon scroll bo'ladi + quti balandligi cheklanadi. */}
      {delOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 p-4" onClick={() => !delBusy && setDelOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-error/30 bg-base-200 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-base font-bold text-error"><IconWarn /> {t("NFC ID'ni o'chirish")}</div>
            <p className="mt-2 text-sm leading-relaxed text-base-content/70">
              <b className="font-mono">nfcstore.uz/{card.code.toLowerCase()}</b> {t("butunlay o'chiriladi. Bu amalni QAYTARIB BO'LMAYDI — barcha postlar, menyu, fayllar va sozlamalar yo'qoladi.")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-base-content/70">
              {isFreeId
                ? t("Bu — ro'yxatdan o'tishda avtomatik berilgan bepul ID. O'chirilгач qayta sotuvga qo'yilmaydi.")
                : t("Bu NFC ID o'chirilгач yana bo'sh bo'ladi va boshqa foydalanuvchi uni band qilishi mumkin.")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm min-h-11" disabled={delBusy} onClick={() => setDelOpen(false)}>{t('Bekor')}</button>
              <button className="btn btn-error btn-sm min-h-11" disabled={delBusy} onClick={doDelete}>
                {delBusy ? <span className="loading loading-spinner loading-xs"></span> : t("Ha, butunlay o'chirish")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const giftBlock = (
    <>
      {giftOpen && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <input
            value={giftToCode}
            onChange={(e) => setGiftToCode(e.target.value)}
            placeholder={t("Qabul qiluvchining NFC ID'si (masalan ABZ007)")}
            className="input input-bordered input-sm flex-1 bg-base-100 font-mono"
          />
          <button className="btn btn-gold btn-sm min-h-11" onClick={sendGift} disabled={giftBusy}>
            {giftBusy ? <span className="loading loading-spinner loading-xs"></span> : t('Taklif yuborish')}
          </button>
          <p className="w-full text-xs text-base-content/45">{t("Pulsiz — qabul qiluvchi o'zi tasdiqlaguncha egalik o'tmaydi. U albatta o'z NFC ID'siga (mavjud profiliga) ega bo'lishi kerak.")}</p>
        </div>
      )}
      {giftMsg && <div className={`alert mt-3 py-2 text-sm ${giftMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(giftMsg.text)}</span></div>}
      {saleMsg && <div className={`alert mt-4 py-2 text-sm ${saleMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(saleMsg.text)}</span></div>}
    </>
  );

  // ── Profil formasi bo'limlari (JSX bloklari) — maydonlar va saqlash mantiqi
  // o'zgarmagan, faqat aniq sarlavhali guruhlarga ajratilgan. Shaxsiy va
  // biznes tablari shu bloklardan o'ziga keraklisini teradi (pastda).
  const secType = (
    <Section
      title={workspaceOnly ? t('Kompaniya yo‘nalishi') : t('Profil turi va soha')}
      subtitle={workspaceOnly ? t('Katalog moduli faoliyat sohasiga qarab avtomatik tanlanadi') : t('Katalog va qidiruvda qanday ko‘rinasiz')}
      defaultOpen
    >
      {!workspaceOnly && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ['personal', t('Shaxsiy'), t('Odam')],
            ['expert', t('Ekspert'), t('Mutaxassis')],
            ['business', t('Biznes'), t('Kompaniya')],
          ].map(([id, label, sub]) => (
            <button key={id} type="button"
              onClick={() => setForm((f) => ({ ...f, profileType: id }))}
              aria-pressed={form.profileType === id}
              className={`min-h-11 min-w-0 rounded-xl border p-3 text-left transition ${form.profileType === id ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/25'}`}>
              <div className={`truncate text-sm font-bold ${form.profileType === id ? 'text-accent' : ''}`}>{label}</div>
              <div className="mt-0.5 truncate text-[13px] text-base-content/45">{sub}</div>
            </button>
          ))}
        </div>
      )}
      {cats.length > 0 && (() => {
        const sel = findCat(cats, form.categorySlug);
        const mainSlug = sel ? (sel.parentSlug || sel.slug) : '';
        const subs = cats.filter((c) => c.parentSlug === mainSlug);
        return (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="form-control block min-w-0">
              <span className="text-xs font-semibold text-base-content/70">{t('Faoliyat sohasi')}</span>
              <select
                value={mainSlug}
                onChange={(e) => setForm((f) => ({ ...f, categorySlug: e.target.value }))}
                className="select select-bordered select-sm mt-1 min-h-11 w-full bg-base-100"
              >
                <option value="">{t('— tanlanmagan —')}</option>
                {cats.filter((c) => !c.parentSlug).map((c) => (
                  <option key={c.slug} value={c.slug}>{catName(c, lang)}</option>
                ))}
              </select>
            </label>
            {subs.length > 0 && (
              <label className="form-control block min-w-0">
                <span className="text-xs font-semibold text-base-content/70">{t('Kichik soha')}</span>
                <select
                  value={form.categorySlug === mainSlug ? '' : form.categorySlug}
                  onChange={(e) => setForm((f) => ({ ...f, categorySlug: e.target.value || mainSlug }))}
                  className="select select-bordered select-sm mt-1 min-h-11 w-full bg-base-100"
                >
                  <option value="">{t('Umumiy')}</option>
                  {subs.map((c) => (
                    <option key={c.slug} value={c.slug}>{catName(c, lang)}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        );
      })()}
      <label className="form-control mt-3 block">
        <span className="text-xs font-semibold text-base-content/70">{t('Shahar / viloyat (ixtiyoriy)')}</span>
        <input value={form.city} onChange={set('city')} placeholder={t('masalan Toshkent')} className={inp} />
      </label>
      <p className="mt-1.5 text-xs text-base-content/40">{t('Soha ro‘yxatда yo‘qmi? "Kasb / sarlavha" maydoniga o‘zingiz yozing.')}</p>
    </Section>
  );

  const secBasic = (
    <Section title={t("Asosiy ma'lumot")} subtitle={t("Ism, kasb va bio")} defaultOpen>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="form-control min-w-0"><span className="text-xs font-semibold text-base-content/70">{t("Ism *")}</span><input value={form.name} onChange={set('name')} className={inp} /></label>
        <label className="form-control min-w-0"><span className="text-xs font-semibold text-base-content/70">{t("Kasb / sarlavha")}</span><input value={form.role} onChange={set('role')} className={inp} /></label>
      </div>
      <label className="form-control mt-3 block">
        <span className="text-xs font-semibold text-base-content/70">{t("O'zingiz haqingizda (bio)")}</span>
        <textarea rows={3} value={form.about} onChange={set('about')} placeholder={t("Qisqacha o'zingiz haqingizda...")} className="textarea textarea-bordered mt-1 w-full bg-base-100" />
      </label>
    </Section>
  );

  const secContact = (
    <Section title={t('Aloqa')} subtitle={t('Telegram, telefon, email')} defaultOpen>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="form-control min-w-0"><span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconTelegram width={12} height={12} /> Telegram</span><input value={form.tg} onChange={set('tg')} placeholder="@username" className={inp} /></label>
        <label className="form-control min-w-0"><span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconPhone width={12} height={12} /> {t("Telefon")}</span><input value={form.phone} onChange={set('phone')} type="tel" className={inp} /></label>
        <label className="form-control min-w-0"><span className="text-xs font-semibold text-base-content/70">Email</span><input value={form.email} onChange={set('email')} type="email" className={inp} /></label>
      </div>
      {form.phone && (
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2.5">
          <input type="checkbox" className="checkbox checkbox-sm" checked={form.hidePhone} onChange={(e) => setForm((f) => ({ ...f, hidePhone: e.target.checked }))} />
          <span className="text-xs text-base-content/60">{t("Telefon raqamini profilda hammadan yashirish (faqat menga ko'rinsin)")}</span>
        </label>
      )}
    </Section>
  );

  const secSocial = (
    <Section title={t('Ijtimoiy tarmoqlar')} subtitle={t('Instagram, Facebook, X, LinkedIn, veb-sayt, havolalar, hashtaglar')}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="form-control min-w-0"><span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconInstagram width={12} height={12} /> Instagram</span><input value={form.instagram} onChange={set('instagram')} placeholder={t('@username yoki to‘liq havola')} className={inp} /></label>
        <label className="form-control min-w-0"><span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconFacebook width={12} height={12} /> Facebook</span><input value={form.facebook} onChange={set('facebook')} placeholder={t("username yoki havola")} className={inp} /></label>
        <label className="form-control min-w-0"><span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconX width={12} height={12} /> X (Twitter)</span><input value={form.twitter} onChange={set('twitter')} placeholder="@username" className={inp} /></label>
        <label className="form-control min-w-0"><span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconLinkedIn width={12} height={12} /> LinkedIn</span><input value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/..." className={inp} /></label>
        <label className="form-control min-w-0"><span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconGlobe width={12} height={12} /> {t("Veb-sayt")}</span><input value={form.website} onChange={set('website')} placeholder="https://sayt.uz" className={inp} /></label>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-base-content/55"><IconLink width={12} height={12} /> {t("Qo'shimcha havolalar (istalgancha)")}</div>
        <div className="mt-3 space-y-2">
          {form.extraLinks.map((l, i) => (
            <div className="flex flex-col gap-2 sm:flex-row" key={i}>
              <input value={l.label} onChange={updateLink(i, 'label')} placeholder={t("Nomi (masalan: Portfolio)")} className={`${inp} !mt-0 min-w-0`} />
              <div className="flex min-w-0 flex-1 gap-2">
                <input value={l.url} onChange={updateLink(i, 'url')} placeholder="https://..." className={`${inp} !mt-0 min-w-0 font-mono`} />
                <button type="button" className="btn btn-ghost btn-square btn-sm min-h-11 min-w-11 shrink-0" aria-label={t("O'chirish")} onClick={() => removeLink(i)}>&times;</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-xs mt-3 min-h-9" onClick={addLink}>{t("+ Havola qo‘shish")}</button>
      </div>
      <label className="form-control mt-4 block">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconTag width={12} height={12} /> {t("Hashtaglar (vergul bilan)")}</span>
        <input value={form.hashtags} onChange={set('hashtags')} className={inp} />
      </label>
    </Section>
  );

  const secMedia = (
    <Section title={t('Media (rasm/fon/musiqa)')} subtitle={t('Profil rasmi, fon rasmi va musiqa')}>
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-base-100 font-bold">
          {form.avatarUrl
            ? <img src={form.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            : <span>{initials(form.name)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-base-content/70">{t('Profil rasmi')}</div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickFile} />
          <button type="button" className="btn btn-ghost-vz btn-sm mt-1 min-h-11" onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}>
            {uploading ? <span className="loading loading-spinner loading-xs"></span> : <><IconImage width={14} height={14} /> {t('Rasm tanlash')}</>}
          </button>
          <p className="mt-2 text-xs text-base-content/45">{t("JPG/PNG. Avtomatik kichraytiriladi. Yoki quyida havola qoldiring.")}</p>
          <input className={`${inp} font-mono text-xs`} value={form.avatarUrl} onChange={set('avatarUrl')} placeholder={t("https://... yoki /uploads/...")} />
        </div>
      </div>

      <Gate ok={allow('innerBackground')} onLock={() => setLocked(t('Maxsus profil foni'))}>
      <div>
      <div className="mt-5 font-mono text-[13px] uppercase tracking-widest text-base-content/45">{t("Fon rasmi")}</div>
      <div className="mt-2 flex items-start gap-4">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-base-100">
          {form.bgUrl
            ? (/\.(mp4|webm)(\?|$)/i.test(form.bgUrl)
                ? <video src={form.bgUrl} muted loop playsInline autoPlay preload="metadata" className="h-full w-full object-cover" />
                : <img src={form.bgUrl} alt="fon" loading="lazy" className="h-full w-full object-cover" />)
            : <div className="flex h-full w-full items-center justify-center text-[13px] text-base-content/40">{t("Standart")}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <input ref={bgFileRef} type="file" accept="image/*,video/mp4,video/webm" style={{ display: 'none' }} onChange={onPickBgFile} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost-vz btn-sm min-h-11" onClick={() => bgFileRef.current && bgFileRef.current.click()} disabled={uploadingBg}>
              {uploadingBg ? <span className="loading loading-spinner loading-xs"></span> : t('Fon rasmi tanlash')}
            </button>
            {form.bgUrl && (
              <button type="button" className="btn btn-ghost btn-sm min-h-11" onClick={() => setForm((f) => ({ ...f, bgUrl: '' }))}>
                {t('Standart fonga qaytarish')}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-base-content/45">{t("O'z rasmingizni qo'ysangiz, u tema fonining o'rniga ishlatiladi.")} {t('GIF va video (MP4/WebM) ham mumkin. Maksimal hajm — 50 MB.')}</p>
          <input className={`${inp} font-mono text-xs`} value={form.bgUrl} onChange={set('bgUrl')} placeholder={t("https://... yoki /uploads/...")} />
        </div>
      </div>
      </div>
      </Gate>

      <Gate ok={allow('music')} onLock={() => setLocked(t('Profil musiqasi'))}>
      <label className="form-control mt-5 block">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconMusic width={12} height={12} /> {t('Profil musiqasi')} <span className="font-normal text-base-content/40">({form.musicUrls.length}/{musicMax})</span></span>
        <input ref={musicFileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={onPickMusicFile} />
        <div className="mt-2 space-y-3">
          {form.musicUrls.map((url, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-base-content/45">#{i + 1}</span>
                <input
                  className={`${inp} !mt-0 min-w-0 flex-1 font-mono text-xs`}
                  value={url}
                  onChange={updateMusic(i)}
                  placeholder={t("YouTube / Yandex Music havolasi yoki https://.../musiqa.mp3")}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm min-h-11 shrink-0"
                  onClick={() => { setMusicUploadIndex(i); musicFileRef.current && musicFileRef.current.click(); }}
                  disabled={uploadingMusic}
                >
                  {uploadingMusic && musicUploadIndex === i ? <span className="loading loading-spinner loading-xs"></span> : t('Fayl')}
                </button>
                <button type="button" className="btn btn-ghost btn-square btn-sm min-h-11 min-w-11 shrink-0" aria-label={t("O'chirish")} onClick={() => removeMusic(i)}>&times;</button>
              </div>
              {/* Yuklash natijasi SHU qatorning o'zida — pastdagi umumiy
                  xabar blokida emas (u uzun ro'yxatda ekrandan chiqib
                  ketardi). `role=status` + `aria-live` ekran o'quvchiga
                  ham darhol o'qib beradi. */}
              {musicMsg && musicMsg.idx === i && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`mt-2 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-xs leading-relaxed ${
                    musicMsg.type === 'err'
                      ? 'border-error/40 bg-error/10 text-error'
                      : 'border-success/30 bg-success/10 text-success'
                  }`}
                >
                  <span aria-hidden="true">{musicMsg.type === 'err' ? '\u26A0\uFE0F' : '\u2705'}</span>
                  <span>{musicMsg.text}</span>
                </div>
              )}
              {/* 2026-09: YouTube havolasi qo'yilganda OGOHLANTIRISH — ijro
                  paytida rasmiy player ko'rinib turishi YouTube qoidasi
                  (eng kichigi 200x200 px). Video umuman kerak bo'lmaganlar
                  uchun MP3 yo'li ko'rsatiladi (iPhone qadamlari bilan). */}
              {url && isYoutubeMusic(url) && (
                <div className="mt-2 flex gap-2 rounded-lg border border-warning/35 bg-warning/10 px-2.5 py-2 text-xs leading-relaxed text-warning">
                  <span aria-hidden="true">{'\u26A0\uFE0F'}</span>
                  <span>
                    <b>{t('YouTube havolasi — video ko‘rinadi.')}</b>{' '}
                    {t("YouTube qoidasiga ko'ra ijro paytida rasmiy player ko'rinib turishi shart (eng kichigi 200×200 px). U profilingizning o'ng-pastki burchagida kichkina oynada chiqadi.")}{' '}
                    <span className="text-base-content/70">{t("Video umuman kerak bo'lmasa — «Fayl» tugmasi orqali MP3/M4A/OGG yuklang, u holda faqat musiqa yangraydi.")}</span>
                  </span>
                </div>
              )}
              {url && !isYoutubeMusic(url) && isEmbedMusic(url) && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1.5 text-xs text-accent"><IconCheck width={12} height={12} /> {t('Musiqa havolasi ulandi — iPhone/Android hammasida ishlaydi.')}</div>
              )}
              {url && !isEmbedMusic(url) && (
                <>
                  <div className="mt-2 flex gap-2 rounded-lg border border-success/30 bg-success/10 px-2.5 py-2 text-xs leading-relaxed text-success">
                    <span aria-hidden="true">{'\u2705'}</span>
                    <span>
                      <b>{t("Audio fayl — video umuman yo‘q.")}</b>{' '}
                      <span className="text-base-content/70">{t("Faqat NFCSTORE pleeri: muqova, nom va oldingi / ijro / keyingi tugmalari.")}</span>
                    </span>
                  </div>
                  <audio controls src={url} className="mt-2 h-9 w-full" />
                </>
              )}
            </div>
          ))}
        </div>
        {/* Limitga yetganda tugma yo'qolmaydi — oddiy foydalanuvchida u
            Premium taklif oynasini ochadi (addMusic ichida). */}
        {(form.musicUrls.length < musicMax || !isPremiumUser) && (
          <button type="button" className="btn btn-ghost btn-sm mt-3 min-h-11" onClick={addMusic}>
            {form.musicUrls.length >= musicMax ? t("Premium bilan 10 tagacha qo‘shiq") : t("+ Qo'shiq qo‘shish")}
          </button>
        )}
        <p className="mt-2 text-xs text-base-content/45">{t("Oddiy profilda 5 ta, Premium'da 10 tagacha qo'shiq. YouTube yoki Yandex Music havolasini qo'ysangiz — fayl yuklamasdan, iPhone'da ham ishlaydi. Yoki to'g'ridan-to'g'ri .mp3 havolasi / fayl. Profilingizga kirgan odam pastdagi tugma orqali yoqib-o'chiradi va qo'shiqlar orasida almashtiradi.")}</p>
        <p className="mt-1.5 text-xs text-base-content/40">{t("iPhone'da MP3 qayerdan olinadi: Telegramda qo'shiqni oching → Ulashish → «Fayllarga saqlash», keyin shu yerdagi «Fayl» tugmasi orqali tanlang. Android'da fayl menejeridan to'g'ridan-to'g'ri tanlanadi. Maksimal hajm ~{n} MB.", { n: MUSIC_MAX_MB })}</p>
      </label>
      </Gate>
    </Section>
  );

  const secLook = (
    <Section title={t("Ko'rinish")} subtitle={t("Tema, ranglar va havola tugmalari uslubi")}>
      <div className="font-mono text-[13px] uppercase tracking-widest text-base-content/45">{t("Tema")}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {THEMES.map((th) => (
          <button key={th.id} type="button"
            aria-pressed={form.theme === th.id}
            className={`min-h-11 cursor-pointer rounded-xl border p-3 text-sm font-semibold transition-all ${form.theme === th.id ? 'border-base-content/70 ring-2 ring-white/30' : 'border-white/10 hover:border-white/30'}`}
            style={{ background: th.css }}
            onClick={() => setForm((f) => ({ ...f, theme: th.id, bgColor: '', bgUrl: '' }))}>
            <span style={{ color: th.accent }}>{th.label}</span>
          </button>
        ))}
      </div>

      <Gate ok={allow('innerBackground')} onLock={() => setLocked(t('Maxsus profil foni'))}>
      <div>
      <div className="mt-5 flex items-center gap-3">
        <input
          type="color"
          value={form.bgColor || '#1a1a1c'}
          onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
          className="h-11 w-11 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-base-content/70">{t("Profil fon rangi")}</div>
          <p className="mt-0.5 text-xs text-base-content/45">{t("Aksent rangdan mustaqil — butun profil foni shu rangda (sekin qimirlab turadigan gradient bilan) chiqadi. Diqqat: bu tanlangan temaning o'z fonidan ustun turadi — yuqoridagi temalardan birini qayta bossangiz, bu rang avtomatik tozalanadi.")}</p>
        </div>
        {form.bgColor && (
          <button type="button" className="btn btn-ghost btn-xs min-h-9" onClick={() => setForm((f) => ({ ...f, bgColor: '' }))}>
            {t('Andozaga qaytarish')}
          </button>
        )}
      </div>
      {form.bgColor && (
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="checkbox checkbox-sm" checked={form.bgAnimated} onChange={(e) => setForm((f) => ({ ...f, bgAnimated: e.target.checked }))} />
          <span>{t("Fon sekin qimirlab (animatsiyali) tursin")}</span>
        </label>
      )}
      </div>
      </Gate>

      <Gate ok={allow('advancedColors')} onLock={() => setLocked(t('Maxsus ranglar'))}>
      <div className="mt-5 flex items-center gap-3">
        <input
          type="color"
          value={form.accentColor || '#f5a524'}
          onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
          className="h-11 w-11 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-base-content/70">{t("Istalgan aksent rang")}</div>
          <p className="mt-0.5 text-xs text-base-content/45">{t("Tugmalar va urg'u rangi shu bilan almashadi — tema tanlovidan mustaqil.")}</p>
        </div>
        {form.accentColor && (
          <button type="button" className="btn btn-ghost btn-xs min-h-9" onClick={() => setForm((f) => ({ ...f, accentColor: '' }))}>
            {t('Andozaga qaytarish')}
          </button>
        )}
      </div>
      </Gate>

      <Gate ok={allow('linkStyle')} onLock={() => setLocked(t('Havola tugmalari uslubi'))}>
      <div className="mt-4">
        <div className="text-xs font-semibold text-base-content/70">{t('Havola tugmalari uslubi')}</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            ['standard', t('Standart')],
            ['transparent', t('Shaffof')],
            ['glass', t('Glass (shisha)')],
          ].map(([id, label]) => (
            <button key={id} type="button"
              aria-pressed={form.linkStyle === id}
              onClick={() => setForm((f) => ({ ...f, linkStyle: id }))}
              className={`min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold transition ${form.linkStyle === id ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 text-base-content/60 hover:border-white/25'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-base-content/45">{t("Shaffof/Glass — tugmalar yarim shaffof bo'lib, orqa fon ular ostidan ko'rinadi (maxsus fon bilan chiroyli).")}</p>
      </div>
      </Gate>
    </Section>
  );

  const secLocation = (
    <Section title={t('Manzil va lokatsiya')} subtitle={t("Qo'ng'iroq va xaritada ko'rsatish uchun")} defaultOpen={isBusiness}>
      <Gate ok={allow('location')} onLock={() => setLocked(t('Manzil va lokatsiya'))}>
        <label className="form-control block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconPin width={12} height={12} /> {t('Manzil')}</span>
          <input value={form.address} onChange={set('address')} placeholder={t('Ko‘cha, uy, mo‘ljal')} className={inp} />
        </label>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="form-control min-w-0">
            <span className="text-xs font-semibold text-base-content/70">{t('Kenglik (latitude)')}</span>
            <input value={form.latitude} onChange={set('latitude')} type="number" step="any" placeholder="41.311081" className={`${inp} font-mono`} />
          </label>
          <label className="form-control min-w-0">
            <span className="text-xs font-semibold text-base-content/70">{t('Uzunlik (longitude)')}</span>
            <input value={form.longitude} onChange={set('longitude')} type="number" step="any" placeholder="69.240562" className={`${inp} font-mono`} />
          </label>
        </div>
        {/* KOORDINATANI QO'LDA YOZISH SHART EMAS (2026-09). Avval odam
            Google Maps'ga borib, raqamlarni topib, ikkita maydonga
            ko'chirishi kerak edi — ko'pchilik buni qilmasdi yoki xato
            qilardi. Endi bitta tugma: brauzer joylashuvni o'zi beradi. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost-vz btn-sm min-h-11"
            disabled={geoBusy}
            onClick={() => {
              if (typeof navigator === 'undefined' || !navigator.geolocation) {
                setGeoMsg(t('Brauzeringiz joylashuvni aniqlay olmadi. Koordinatalarni qo‘lda kiriting.'));
                return;
              }
              setGeoBusy(true);
              setGeoMsg('');
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  // 6 xona ~ 10 sm aniqlik; ortiqchasi keraksiz.
                  setForm((f) => ({
                    ...f,
                    latitude: pos.coords.latitude.toFixed(6),
                    longitude: pos.coords.longitude.toFixed(6),
                  }));
                  setGeoBusy(false);
                  setGeoMsg(t('Joylashuv aniqlandi. Saqlashni unutmang.'));
                },
                () => {
                  setGeoBusy(false);
                  // Eng ko'p uchraydigan sabab — ruxsat berilmagani.
                  setGeoMsg(t('Joylashuvga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering yoki koordinatalarni qo‘lda kiriting.'));
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
              );
            }}
          >
            {geoBusy ? <span className="loading loading-spinner loading-xs"></span> : <IconPin width={14} height={14} />}
            {t('Joriy joylashuvimni olish')}
          </button>
          {(form.latitude || form.longitude) && (
            <button
              type="button"
              className="btn btn-ghost-vz btn-sm min-h-11"
              onClick={() => { setForm((f) => ({ ...f, latitude: '', longitude: '' })); setGeoMsg(''); }}
            >
              {t('Koordinatani tozalash')}
            </button>
          )}
          {form.latitude && form.longitude && (
            <a
              href={googleDirectionsUrl({ latitude: form.latitude, longitude: form.longitude })}
              target="_blank" rel="noopener noreferrer"
              className="vz-tap text-sm font-semibold underline-offset-4 hover:underline"
              style={{ color: 'var(--vz-gold)' }}
            >
              {t('Xaritada tekshirish')}
            </a>
          )}
        </div>
        {geoMsg && <p className="mt-2 text-[13px] text-base-content/60">{geoMsg}</p>}
        <p className="mt-2 text-[13px] text-base-content/40">
          {t('Tugmani bosing yoki koordinatalarni Google Maps’dan nusxalang. Kiritilsa, profilda "Yo‘nalish" tugmasi ko‘rinadi va telefonning o‘z xarita ilovasida ochiladi.')}
        </p>
      </Gate>
    </Section>
  );

  const secCards = (
    <Section title={t("To'lov kartalari")} subtitle={t("Profilda ko'rinadigan karta raqamlari")}>
      <label className="form-control block">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70"><IconCard width={12} height={12} /> {t("Asosiy karta raqami")}</span>
        <input value={form.cardNumber} onChange={set('cardNumber')} placeholder="8600 1234 5678 9012" className={`${inp} font-mono`} />
      </label>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-base-content/55">{t("Qo'shimcha karta raqamlari")}</div>
        <div className="mt-3 space-y-2">
          {form.cardNumbers.map((c, i) => (
            <div className="flex flex-col gap-2 sm:flex-row" key={i}>
              <input value={c.label} onChange={updateCardNum(i, 'label')} placeholder={t("Nomi (masalan: Humo)")} className={`${inp} !mt-0 min-w-0`} />
              <div className="flex min-w-0 flex-1 gap-2">
                <input value={c.number} onChange={updateCardNum(i, 'number')} placeholder="9860 1234 5678 9012" className={`${inp} !mt-0 min-w-0 font-mono`} />
                <button type="button" className="btn btn-ghost btn-square btn-sm min-h-11 min-w-11 shrink-0" aria-label={t("O'chirish")} onClick={() => removeCardNum(i)}>&times;</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-xs mt-3 min-h-9" onClick={addCardNum}>{t("+ Karta qo‘shish")}</button>
      </div>
    </Section>
  );

  const noteTools = (
    <div className="mt-4 rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] px-4 py-3.5 text-sm text-base-content/60">
      {t('Statistika, lidlar, fayllar va video —')}{' '}
      <button type="button" className="min-h-8 font-semibold text-accent underline underline-offset-2" onClick={() => navigate('/sozlamalar')}>
        {t('Sozlamalar')}
      </button>{' '}{t('sahifasida.')}
    </div>
  );

  // ── Yagona navigatsiya (sidebar lg / gorizontal tab qatori mobil) ──
  // Shaxsiy va biznes uchun ro'yxat `isBusiness` bilan tanlanadi; kabinet
  // qo'shimcha bo'limlari (extraSections) ikkalasiga ham qo'shiladi.
  const personalNav = [
    ['boshqaruv', t('Umumiy'), IconHome],
    ['profil', t('Profil'), IconUser],
    ['nfckarta', t('NFC karta'), IconCard],
    ['myids', t("Mening ID'larim"), IconIdCard],
    ['postlar', t('Postlar / Media'), IconImage],
  ];
  const businessNav = [
    ['asosiy', t('Asosiy'), IconBriefcase],
    ['katalog', CATALOG_TAB_LABEL[catalogModule] || t('Katalog'), IconGrid],
    ...(catalogModule === 'products' ? [['aksiyalar', t('Aksiyalar'), IconTag]] : []),
    ['galereya', t('Galereya'), IconImage],
    ['lokatsiya', t('Lokatsiya'), IconPin],
    ['sozlamalar', t('Sozlamalar'), IconCog],
  ];
  const navItems = [
    ...(isBusiness ? businessNav : personalNav),
    ...extraSections.map((x) => [x.id, x.label, x.Icon || IconGrid, x.badge]),
  ];
  const activeExtra = extraSections.find((x) => x.id === wsTab);
  // Katalog/Aksiyalar tabida modul o'z preview'iga ega; qo'shimcha kabinet
  // bo'limlarida (Premium, Sovg'alar) telefon preview kerak emas.
  const showPreview = !activeExtra && !(isBusiness && ['katalog', 'aksiyalar'].includes(wsTab));
  const isFormTab = isBusiness ? ['asosiy', 'sozlamalar', 'lokatsiya'].includes(wsTab) : wsTab === 'profil';
  const goPremium = () => {
    const prem = extraSections.find((x) => x.id === 'tarif');
    if (prem) { setWsTab('tarif'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else document.getElementById('premium-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const navBtn = (id, label, Icon, badge) => (
    <button
      key={id}
      type="button"
      onClick={() => setWsTab(id)}
      aria-current={wsTab === id ? 'page' : undefined}
      className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl border-l-[3px] px-3 py-2 text-left text-sm font-semibold transition lg:w-full ${wsTab === id ? 'border-[color:var(--vz-gold)] bg-[color:var(--vz-card-2)] text-[color:var(--vz-gold-2)]' : 'border-transparent text-base-content/60 hover:bg-white/5 hover:text-base-content'}`}
    >
      <span className="shrink-0"><Icon width={16} height={16} /></span>
      <span className="truncate">{label}</span>
      {badge > 0 && <span className="vz-badge vz-badge--gold ml-auto !px-1.5 !py-0 text-[11px]">{badge}</span>}
    </button>
  );
  const nav = (
    <aside className="mb-5 min-w-0 lg:sticky lg:top-6 lg:mb-0" aria-label={t('Kabinet bo‘limlari')}>
      <div className="hidden items-center gap-3 rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] p-3 lg:flex">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-base-100 text-sm font-bold">
          {form.avatarUrl ? <img src={form.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(form.name)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{form.name || card.name}</div>
          <div className="truncate font-mono text-[11px] text-base-content/45">NFC ID · {card.code}{card.isPrimary ? ` · ${t('ASOSIY')}` : ''}</div>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] p-1.5 lg:mt-3 lg:flex-col lg:overflow-visible">
        {navItems.map(([id, label, Icon, badge]) => navBtn(id, label, Icon, badge))}
        {cabinetLinks.length > 0 && (
          <>
            <div className="mx-1 hidden h-px bg-[color:var(--vz-line)] lg:my-1.5 lg:block"></div>
            <div className="hidden px-3 pt-1 text-[11px] font-bold uppercase tracking-wider text-base-content/35 lg:block">{t('Kabinet')}</div>
            {cabinetLinks.map(({ id, label, Icon, onClick, disabled }) => (
              <button key={id} type="button" onClick={onClick} disabled={disabled}
                className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl border-l-[3px] border-transparent px-3 py-2 text-left text-sm font-semibold text-base-content/60 transition hover:bg-white/5 hover:text-base-content disabled:opacity-40 lg:w-full">
                <span className="shrink-0">{Icon ? <Icon width={16} height={16} /> : null}</span>
                <span className="truncate">{label}</span>
              </button>
            ))}
          </>
        )}
      </nav>
    </aside>
  );

  return (
    <div className="mt-6 min-w-0">
      {workspaceOnly && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-base-100 text-lg font-bold text-base-content/70">
              {card.avatarUrl ? <img src={card.avatarUrl} alt="" className="h-full w-full object-cover" /> : (card.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate text-base font-bold">
                {card.name}
                {card.verified && <span className="shrink-0 text-accent" title={t('Tasdiqlangan profil')}><IconCheck width={14} height={14} /></span>}
              </div>
              <div className="font-mono text-xs text-base-content/45">nfcstore.uz/{card.code.toLowerCase()}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost-vz btn-sm min-h-11 shrink-0" onClick={() => navigate('/' + card.code)}><IconEye width={14} height={14} /> {t("Ko'rish")}</button>
            <button className="btn btn-ghost btn-sm min-h-11" onClick={wsLogout}>{t('Chiqish')}</button>
          </div>
        </div>
      )}

      {locked && (
        <LockedFeatureModal
          featureLabel={locked}
          onClose={() => setLocked(null)}
          onGoPremium={goPremium}
        />
      )}

      {postModal && (
        <Modal title={t('Postlar')} onClose={() => setPostModal(false)}>
          <PostsManager code={card.code} />
        </Modal>
      )}
      {storyOpen && (
        <Modal title={t('Istorya')} onClose={() => setStoryOpen(false)}>
          <StoriesManager code={card.code} />
        </Modal>
      )}
      {designModal && (
        <CardDesignModal
          card={card}
          initialTab={designModal}
          onClose={() => setDesignModal(null)}
          onSaved={onSaved}
        />
      )}

      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {nav}
        <div className="min-w-0">
        <div className={`grid gap-6 ${showPreview ? 'xl:grid-cols-[minmax(0,1fr)_280px]' : ''}`}>
        <div className="min-w-0">
        {activeExtra && <div className="min-w-0">{activeExtra.content}</div>}
        {!isBusiness && wsTab === 'boshqaruv' && (
          <div className="space-y-5">
            {/* PROFILDA KO'RSATILADIGAN KOMPANIYA — Telegramdagi "kanal"
                bloki kabi. Ikkitadan ortiq kompaniyasi bo'lsa, qaysi
                birini ko'rsatishni egasi TANLAYDI: profilda bittasi
                chiqadi, aks holda blok ro'yxatga aylanib ketardi.
                Kompaniyasi yo'q odamga bu bo'lim umuman ko'rinmaydi. */}
            <ProfileCompanyPicker form={form} setForm={setForm} t={t} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="vz-panel min-w-0 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/45">{t('Tarif')}</div>
                <div className="mt-1 flex items-center gap-1.5 text-lg font-black text-accent"><IconCrown width={16} height={16} /> {t(tierLabelFor(card?.code, access))}</div>
                <div className="mt-0.5 text-xs text-base-content/45">{user?.isPremium ? t('Jami imkoniyatlar ochiq') : t("Premium'ga o'tish mumkin")}</div>
              </div>
              <div className="vz-panel min-w-0 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/45">{t('Holat')}</div>
                <div className="mt-1 flex items-center gap-1.5 text-lg font-black text-success"><span className="inline-block h-2 w-2 rounded-full bg-current"></span> {t('Faol')}</div>
                <div className="mt-0.5 text-xs text-base-content/45">{form.hiddenFromDirectory ? t('Katalogda yashirin') : t('Public profil ochiq')}</div>
              </div>
              <div className="vz-panel min-w-0 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/45">{t('Public URL')}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="truncate font-mono text-sm font-bold">/{card.code.toLowerCase()}</span>
                  <button type="button" className="btn btn-ghost btn-xs min-h-8" onClick={() => { navigator.clipboard?.writeText(window.location.origin + '/' + card.code.toLowerCase()).then(() => setSaleMsg({ type: 'ok', text: t('Nusxalandi!') })).catch(() => {}); }}><IconCopy width={12} height={12} /> {t('Nusxalash')}</button>
                </div>
              </div>
              <div className="vz-panel min-w-0 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/45">{t('Primary ID')}</div>
                {card.isPrimary ? (
                  <div className="mt-1 text-lg font-black text-accent">{card.code}</div>
                ) : (
                  <button type="button" className="mt-1 text-sm font-semibold text-accent underline underline-offset-2 disabled:opacity-50" onClick={makePrimary} disabled={primaryBusy}>
                    {primaryBusy ? <span className="loading loading-spinner loading-xs"></span> : t('Asosiy qilish')}
                  </button>
                )}
                <div className="mt-0.5 text-xs text-base-content/45">{card.isPrimary ? t('Asosiy NFC karta') : t('Hozircha asosiy emas')}</div>
              </div>
            </div>

            <div className="vz-panel p-4">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-base-content/60">
                <span>{t("Profil {p}% to'ldirilgan", { p: personalProfileCompletion(form) })}</span>
                {personalProfileCompletion(form) < 100 && (
                  <button type="button" className="min-h-8 text-accent underline underline-offset-2" onClick={() => setWsTab('profil')}>{t("To'ldirish")}</button>
                )}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30">
                <div className="h-full rounded-full bg-[color:var(--vz-gold)] transition-all" style={{ width: `${personalProfileCompletion(form)}%` }}></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline-gold btn-sm min-h-11" onClick={async () => {
                const shareUrl = window.location.origin + '/' + card.code.toLowerCase();
                if (navigator.share) { try { await navigator.share({ title: form.name || card.code, url: shareUrl }); return; } catch { /* bekor qilindi */ } }
                navigator.clipboard?.writeText(shareUrl).then(() => setSaleMsg({ type: 'ok', text: t('Havola nusxalandi!') })).catch(() => {});
              }}><IconShare width={14} height={14} /> {t('Ulashish')}</button>
              <button type="button" className="btn btn-ghost-vz btn-sm min-h-11" onClick={() => navigate('/' + card.code)}><IconEye width={14} height={14} /> {t("Profilni ko'rish")}</button>
            </div>
            {saleMsg && <div className={`alert py-2 text-sm ${saleMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(saleMsg.text)}</span></div>}
          </div>
        )}

        {!isBusiness && wsTab === 'nfckarta' && (
          <Section title={t('NFC karta')} subtitle={t("Narx, ko'rishlar, dizayn va buyurtma")} defaultOpen>
            {nfcIdBlock}
            {giftBlock}
          </Section>
        )}

        {!isBusiness && wsTab === 'myids' && (
          <Section title={t("Mening ID'larim")} subtitle={t("Barcha raqamli tashrif qog'ozlaringiz")} defaultOpen>
            {myCards.length <= 1 ? (
              <div className="vz-empty">
                <span className="text-base-content/40"><IconIdCard /></span>
                <span className="text-sm">{t('Sizda hozircha faqat shu bitta ID bor.')}</span>
                <button type="button" className="btn btn-outline-gold btn-sm min-h-11" onClick={() => navigate('/')}>{t('Yangi ID band qilish')}</button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {myCards.map((c) => (
                  <div key={c.code} className={`rounded-xl border p-3 ${c.code === card.code ? 'border-accent/50 bg-accent/5' : 'border-white/10 bg-base-200/30'}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-base-300 text-xs font-bold">
                        {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : (c.name || c.code).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 truncate text-sm font-bold">
                          {c.code}
                          {c.isPrimary && <span className="badge badge-accent badge-xs shrink-0">{t('ASOSIY')}</span>}
                        </div>
                        <div className="truncate text-xs text-base-content/45">{c.name || c.code}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <button type="button" className="btn btn-outline-gold btn-xs min-h-11 flex-1" disabled={c.code === card.code} onClick={() => onSelectCard && onSelectCard(c.code)}>
                        {c.code === card.code ? t('Joriy') : t('Boshqarish')}
                      </button>
                      <button type="button" className="btn btn-ghost btn-xs min-h-11 flex-1" onClick={() => navigate('/' + c.code.toLowerCase())}>{t("Ko'rish")}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {!isBusiness && wsTab === 'postlar' && (
          <Section title={t('Postlar / Media')} subtitle={t('Rasm va izohlarni joylashtiring')} defaultOpen>
            <PostsManager code={card.code} />
          </Section>
        )}

          {/* ── Profil formasi: aniq bo'limlar (Asosiy / Aloqa / Ijtimoiy / Media / Ko'rinish) ── */}
          {((isBusiness && wsTab === 'asosiy') || (!isBusiness && wsTab === 'profil')) && (<>{secType}{secBasic}</>)}
          {!isBusiness && wsTab === 'profil' && (<>{secContact}{secSocial}</>)}
          {((isBusiness && wsTab === 'asosiy') || (!isBusiness && wsTab === 'profil')) && (<>{secMedia}{secLook}</>)}
          {((isBusiness && wsTab === 'lokatsiya') || (!isBusiness && wsTab === 'profil')) && secLocation}
          {!isBusiness && wsTab === 'profil' && (<>{secCards}{noteTools}</>)}
          {isBusiness && wsTab === 'sozlamalar' && (<>{secContact}{secSocial}{secCards}{noteTools}</>)}

          {isBusiness && wsTab === 'katalog' && !catalogReady && (
            <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-6 text-center text-sm text-base-content/70">
              {t('Katalog moduli profil saqlangandan keyin ochiladi. Avval "Profilni saqlash" tugmasini bosing.')}
            </div>
          )}

          {isBusiness && wsTab === 'katalog' && catalogReady && catalogModule === 'menu' && (
            <Section title={t('Restoran menyusi')} subtitle={t('Kategoriyalar va taomlar')} defaultOpen>
              <MenuManagerSection
                code={card.code}
                allowed={allow('restaurantMenu')}
                onLock={() => setLocked(t('Restoran menyusi'))}
              />
            </Section>
          )}

          {isBusiness && wsTab === 'katalog' && catalogReady && catalogModule === 'products' && (
            <Section title={t('Mahsulotlar katalogi')} subtitle={t('Kategoriyalar va mahsulotlar')} defaultOpen>
              <ProductManagerSection
                code={card.code}
                allowed={allow('productCatalog')}
                onLock={() => setLocked(t('Mahsulotlar katalogi'))}
              />
            </Section>
          )}

          {isBusiness && wsTab === 'katalog' && catalogReady && catalogModule === 'services' && (
            <Section title={t('Xizmatlar katalogi')} subtitle={t('Kategoriyalar va xizmatlar')} defaultOpen>
              <ServiceManagerSection
                code={card.code}
                allowed={allow('serviceCatalog')}
                onLock={() => setLocked(t('Xizmatlar katalogi'))}
              />
            </Section>
          )}

          {isBusiness && wsTab === 'aksiyalar' && catalogReady && catalogModule === 'products' && (
            <Section title={t('Aksiyalar')} subtitle={t('Eski narx, yangi narx va muddat')} defaultOpen>
              <PromotionsManagerSection
                code={card.code}
                allowed={allow('productCatalog')}
                onLock={() => setLocked(t('Aksiyalar'))}
              />
            </Section>
          )}

          {isBusiness && wsTab === 'galereya' && (
            savedIsBusiness ? (
              <Section title={t('Galereya')} subtitle={t('Kompaniya rasmlari')} defaultOpen>
                <GallerySection code={card.code} onLock={() => setLocked(t('Galereya'))} />
              </Section>
            ) : (
              <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-6 text-center text-sm text-base-content/70">
                {t('Galereya profil saqlangandan keyin ochiladi. Avval "Profilni saqlash" tugmasini bosing.')}
              </div>
            )
          )}

          {(isBusiness && wsTab === 'sozlamalar') && (
          <>
          {card.profileType === 'business' && (
            <Section title={t('Jamoa')} subtitle={t('Kompaniya a’zolari')}>
              <TeamSection code={card.code} />
            </Section>
          )}
          </>
          )}

          {isBusiness && wsTab === 'sozlamalar' && (
            workspaceOnly ? (
              <Section title={t('Workspace sozlamalari')} subtitle={t('NFC ID boshqaruvi alohida saqlanadi')}>
                <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
                  <div className="text-sm font-bold">{t('Bu bo‘lim faqat kompaniya profili va katalogi uchun.')}</div>
                  <p className="mt-1 text-xs leading-relaxed text-base-content/55">
                    {t('NFC ID tarifi, sovg‘a qilish, karta dizayni va IDni o‘chirish Mening profilim bo‘limida boshqariladi.')}
                  </p>
                  <button type="button" className="btn btn-outline-gold btn-sm mt-3 min-h-11" onClick={() => navigate('/account#mening-profilim')}>
                    {t('NFC ID boshqaruviga o‘tish')} &rarr;
                  </button>
                </div>
              </Section>
            ) : (
              <Section title={t("NFC ID sozlamalari")} subtitle={t("Sovg'a qilish, post, karta dizayni, o'chirish")}>
                {nfcIdBlock}
                {giftBlock}
              </Section>
            )
          )}

          {/* Yagona asosiy CTA — .btn-gold. Hech narsa o'zgarmagan bo'lsa o'chiq;
              mobil ekranda o'zgarish bo'lsa pastga yopishgan panel. */}
          {(isFormTab || dirty) && (
            <div className={dirty ? 'fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--vz-line)] bg-[color:var(--vz-bg)] p-3 lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0' : 'mt-5'}>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-gold min-h-11 w-full sm:w-auto" onClick={submit} disabled={busy || !dirty}>
                  {busy ? <span className="loading loading-spinner loading-sm"></span> : t('Profilni saqlash')}
                </button>
                {dirty
                  ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning"><IconWarn width={14} height={14} /> {t("Saqlanmagan o'zgarishlar bor")}</span>
                  : <span className="inline-flex items-center gap-1.5 text-xs text-base-content/40"><IconCheck width={14} height={14} /> {t("Barcha o'zgarishlar saqlangan")}</span>}
              </div>
            </div>
          )}
          {dirty && <div className="h-20 lg:hidden" aria-hidden="true"></div>}
          {msg && <div className={`alert mt-4 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
        </div>

        {/* Katalog tabida modul o'zining ichki preview'iga ega (Menu/Product/
            ServiceManagerSection) — asosiy karta preview'ini takrorlamaslik
            uchun shu yerda yashiramiz. */}
        {showPreview && (
          <div className="hidden xl:block">
            <PhonePreview form={form} code={card.code} />
          </div>
        )}
        </div>

        {/* Mobil/planshet uchun preview forma tagida ko'rinadi */}
        {showPreview && (
          <div className="mt-8 xl:hidden">
            <PhonePreview form={form} code={card.code} />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

const ORDER_STATUS_LABEL = {
  pending: { text: "To'lov kutilmoqda", cls: 'badge-warning' },
  paid: { text: "To'landi", cls: 'badge-success' },
  cancelled: { text: 'Bekor qilindi', cls: 'badge-ghost' },
  failed_code_taken: { text: "Kod band bo'lib qoldi — pul qaytariladi", cls: 'badge-error' },
};

// Account sahifasining yuqori "hero" qismi — profil kartalari uchun
// mavjud profileType qiymatlariga mos ko'rsatiladigan nom.
const CARD_TYPE_LABEL = { personal: 'Shaxsiy', expert: 'Ekspert', business: 'Biznes' };

// Profil to'ldirilish foizi — faqat REAL form maydonlariga qarab hisoblanadi,
// hech qanday soxta/qattiq-yozilgan qiymat yo'q.
function personalProfileCompletion(form) {
  const checks = [
    !!form.name.trim(),
    !!form.role.trim(),
    !!form.about.trim(),
    !!form.avatarUrl,
    !!(form.tg || form.instagram || form.facebook || form.twitter || form.website || form.linkedin),
    !!(form.phone || form.email),
    !!(form.city || form.address),
    !!form.cardNumber,
    !!form.hashtags.trim(),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// Profildagi "Adminga murojaat" — foydalanuvchi xabar yozadi, admin
// javob bersa shu yerda (o'tgan murojaatlar tarixida) ko'rinadi.
function SupportModal({ onClose }) {
  const { t } = useLanguage();
  const [history, setHistory] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const [histErr, setHistErr] = useState(false);
  const load = () => { setHistErr(false); return dbListMySupportMessages().then((rows) => setHistory(Array.isArray(rows) ? rows : [])).catch(() => { setHistory([]); setHistErr(true); }); };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await dbSendSupportMessage(text.trim());
      setText('');
      setMsg({ type: 'ok', text: t('Yuborildi — admin tez orada javob beradi.') });
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  // Sarlavha + murojaatlar tarixi + matn maydoni + tugma ~480px joy
  // egallaydi; qisqa ekranda yuborish tugmasiga yetib bo'lmasdi —
  // shuning uchun fon ham, quti ham scroll bo'ladi.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" {...backdropProps(onClose)}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-base-200 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><IconSupport /> {t('Adminga murojaat')}</h3>
          <CloseButton onClick={onClose} />
        </div>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {history === null && <SkeletonRows n={2} h={56} />}
          {history !== null && histErr && <ErrorRetry onRetry={load} />}
          {history?.length === 0 && !histErr && <div className="vz-empty !py-5"><span className="text-sm">{t("Hozircha murojaatingiz yo'q.")}</span></div>}
          {history?.map((m) => (
            <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <p className="text-base-content/80">{m.message}</p>
              {m.reply ? (
                <p className="mt-2 rounded-lg bg-accent/10 p-2 text-accent"><b>{t('Admin')}:</b> {m.reply}</p>
              ) : (
                <p className="mt-1 text-xs text-warning">{t('Kutilmoqda...')}</p>
              )}
            </div>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("Xabaringizni yozing...")}
          rows={3}
          className="textarea textarea-bordered mt-4 w-full bg-base-100"
        />
        <button className="btn btn-gold btn-sm mt-2 min-h-11 w-full" onClick={send} disabled={busy || !text.trim()}>
          {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Yuborish')}
        </button>
        {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
      </div>
    </div>
  );
}

// Do'st taklif qilish — o'z promokodini ko'rsatadi, ulashadi, taklif
// qilingan do'stlar ro'yxatini va kutilayotgan chegirmani ko'rsatadi.
function ReferralPanel({ user }) {
  const { t } = useLanguage();
  const [referrals, setReferrals] = useState(null);
  const [refErr, setRefErr] = useState(false);
  const [copied, setCopied] = useState(false);
  const load = () => { setRefErr(false); dbListReferrals().then((rows) => setReferrals(Array.isArray(rows) ? rows : [])).catch(() => { setReferrals([]); setRefErr(true); }); };
  useEffect(() => { load(); }, []);

  if (!user.promoCode) return null;
  const link = `${window.location.origin}/register?promo=${user.promoCode}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* jim tur */ }
  };

  return (
    <section className="vz-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><IconUsers /> {t("Do'st taklif qiling")}</h2>
      <div className="mt-3">
        <p className="text-sm text-base-content/70">
          {t("Do'stingiz shu havola orqali ro'yxatdan o'tsa, siz keyingi bandlashda avtomatik ")}<b className="text-accent">{t('10% chegirma')}</b>{t(' olasiz.')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 max-w-full break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-sm">{link}</code>
          <button className="btn btn-outline-gold btn-sm min-h-11" onClick={copy}><IconCopy width={14} height={14} /> {copied ? t('Nusxalandi!') : t('Nusxalash')}</button>
        </div>
        {user.pendingDiscountPct > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-success">
            <IconCheck width={14} height={14} /> {t('Sizda {p}% chegirma kutilmoqda — keyingi bandlashda avtomatik qo\'llanadi!', { p: user.pendingDiscountPct })}
          </div>
        )}
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="text-xs font-semibold text-base-content/50">{t('Taklif qilgan do\'stlaringiz')}{referrals ? ` (${referrals.length})` : ''}:</div>
          {referrals === null && <div className="mt-2"><SkeletonRows n={2} h={16} /></div>}
          {referrals !== null && refErr && <div className="mt-2"><ErrorRetry onRetry={load} /></div>}
          {referrals !== null && !refErr && referrals.length === 0 && <p className="mt-1.5 text-xs text-base-content/45">{t("Hali hech kim taklif qilinmagan.")}</p>}
          {referrals && referrals.length > 0 && (
            <ul className="mt-1.5 space-y-1 text-xs text-base-content/60">
              {referrals.map((r) => <li key={r.id} className="break-words">{r.referredEmail} — {timeAgo(new Date(r.createdAt).getTime())}</li>)}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default function AccountPage({ refreshCatalog }) {
  const { user, myCards, refresh } = useAuth();
  const { t } = useLanguage();
  // "Buyurtmalarim" ro'yxatidagi "To'lash" tugmasi uchun.
  const PAYMENTS_ENABLED = usePaymentsEnabled();
  const [selectedCode, setSelectedCode] = useState(null);
  useEffect(() => {
    if (myCards.length && !myCards.some((c) => c.code === selectedCode)) {
      setSelectedCode(myCards[0].code);
    }
  }, [myCards, selectedCode]);
  const selectedCard = myCards.find((c) => c.code === selectedCode) || myCards[0];
  const primaryCard = myCards.find((c) => c.isPrimary) || myCards[0];
  // `openBusinessWorkspace` va `businessCards` OLIB TASHLANDI (2026-09):
  // kompaniya bo'limi shaxsiy kabinetdan chiqarilgach, u yerdan Company
  // ID ochishga to'g'ridan-to'g'ri o'tish yo'li ham kerak emas —
  // hammasi /business dagi biznes kabinetdan boshlanadi.
  const [orders, setOrders] = useState(null);      // null = yuklanmoqda
  const [ordersErr, setOrdersErr] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  // Sidebar'dagi "Sovg'a va buyurtmalar" bo'limi uchun hisoblagich (badge).
  const [giftCount, setGiftCount] = useState(0);
  const [wonCount, setWonCount] = useState(0);

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  const loadOrders = async () => {
    try {
      const list = await dbListMyOrders();
      setOrders(list); setOrdersErr(false);
    } catch {
      setOrdersErr(true); setOrders((o) => o || []);
    }
  };
  useEffect(() => {
    if (!user) return undefined;
    let stop = false;
    const tick = () => { if (!stop) loadOrders(); };
    tick();
    const timer = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(timer); };
  }, [user]);

  if (user === undefined || user === null) {
    return (
      <main className="mx-auto w-full max-w-[1800px] px-5 sm:px-10 lg:px-14 pt-16 pb-16">
        <div className="vz-skel h-6 w-40"></div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="vz-skel h-64 w-full"></div>
          <div className="space-y-3"><div className="vz-skel h-24 w-full"></div><div className="vz-skel h-40 w-full"></div></div>
        </div>
      </main>
    );
  }

  // Auksionda g'olib chiqib, 24 soatda to'lamagan foydalanuvchi — 72 soat
  // akkauntga kirish taqiqlangan.
  if (user.bannedUntil) {
    const until = new Date(user.bannedUntil);
    return (
      <main className="mx-auto w-full max-w-[1800px] px-5 sm:px-10 lg:px-14 pt-16 pb-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-error/40 bg-error/10 p-7 text-center">
          <div className="flex justify-center text-error"><IconWarn width={32} height={32} /></div>
          <h1 className="mt-3 text-xl font-bold">{t('Akkauntingiz vaqtincha bloklangan')}</h1>
          <p className="mt-2 text-sm text-base-content/60">
            {t("Siz auksionda g'olib chiqib, 24 soat ichida to'lamadingiz. Shu sababli akkauntingiz ")}
            <b>{until.toLocaleString('uz-UZ')}</b> {t('gacha bloklangan.')}
          </p>
          <p className="mt-3 text-sm text-error">
            {t("Diqqat: bu takrorlansa, akkauntingiz doimiy bloklanishi yoki raqamli tashrif qog'ozilaringiz olib qo'yilishi mumkin.")}
          </p>
        </div>
      </main>
    );
  }

  const logout = async () => {
    await authLogout().catch(() => {});
    await refresh();
    refreshCatalog();
    navigate('/');
  };

  const onSaved = async () => {
    await refresh();
    refreshCatalog();
  };

  // Hero'da ko'rsatiladigan ism — real ma'lumot: asosiy kartaning nomi,
  // bo'lmasa email'ning @ dan oldingi qismi (hardcode emas).
  const heroName = primaryCard?.name || user.email.split('@')[0];
  const tierAccess = effectiveAccess(primaryCard || null, user);
  const openOrders = (orders || []).filter((o) => o.status !== 'paid' && o.kind !== 'auction_payment');
  const activityBadge = giftCount + wonCount + openOrders.length;

  // Kutilayotgan buyurtma uchun teskari hisob. Buyurtma yaratilgandan
  // 12 soat o'tgach kod avtomatik qayta sotuvga chiqadi (backend:
  // hosting/api/order-window.js) — foydalanuvchi qancha vaqti qolganini
  // ko'rib tursin, "To'lov kutilmoqda" degan yozuv oldida cheksiz
  // turgandek tuyulmasin.
  const OrderCountdown = ({ expiresAtMs }) => {
    const [left, setLeft] = useState(() => expiresAtMs - Date.now());
    useEffect(() => {
      setLeft(expiresAtMs - Date.now());
      const id = setInterval(() => setLeft(expiresAtMs - Date.now()), 1000);
      return () => clearInterval(id);
    }, [expiresAtMs]);
    if (left <= 0) {
      return (
        <span className="whitespace-nowrap text-[13px] font-semibold text-base-content/45">
          {t('Muddati tugadi — kod qayta sotuvda')}
        </span>
      );
    }
    const totalSec = Math.floor(left / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    // Oxirgi soatda diqqatni tortadi (oltin rang), aks holda xotirjam.
    const urgent = left < 60 * 60 * 1000;
    return (
      <span
        className={`whitespace-nowrap font-mono text-[13px] ${urgent ? 'font-bold text-[color:var(--vz-gold-2)]' : 'text-base-content/55'}`}
        title={t("Shu vaqt ichida to'lanmasa, kod qayta sotuvga chiqadi")}
      >
        {t("To'lovga")} {h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`}
      </span>
    );
  };

  // "Buyurtmalarim" — 4 holat (yuklanmoqda / xato+qayta / bo'sh / ro'yxat).
  const ordersBlock = (
    <section className="vz-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><IconWallet /> {t('Buyurtmalarim')}</h2>
      {orders === null && <div className="mt-3"><SkeletonRows n={2} /></div>}
      {orders !== null && ordersErr && <div className="mt-3"><ErrorRetry onRetry={loadOrders} /></div>}
      {orders !== null && !ordersErr && openOrders.length === 0 && (
        <div className="mt-3 vz-empty"><span className="text-sm">{t("Ochiq buyurtmalar yo'q.")}</span><button type="button" className="btn btn-ghost-vz btn-sm min-h-11" onClick={() => navigate('/tolovlar')}>{t("To'lovlar tarixi")}</button></div>
      )}
      {openOrders.length > 0 && (
        <div className="mt-3 space-y-2">
          {openOrders.map((o) => {
            const st = ORDER_STATUS_LABEL[o.status] || { text: o.status, cls: 'badge-ghost' };
            return (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm">
                <span className="min-w-0 break-all font-mono">nfcstore.uz/{String(o.code || '').toLowerCase()}</span>
                <span className="text-base-content/50">{t("{n} so'm", { n: fmt(o.price) })}</span>
                <span className={`badge ${st.cls}`}>{t(st.text)}</span>
                {o.status === 'pending' && o.expiresAtMs != null && <OrderCountdown expiresAtMs={o.expiresAtMs} />}
                {/* To'lovni DAVOM ETTIRISH — avval bu yerda ham faqat
                    holat va taymer turardi, to'lashning yo'li yo'q edi. */}
                {o.status === 'pending' && o.payLink && PAYMENTS_ENABLED && (
                  <a href={o.payLink} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-xs min-h-11">
                    {t("To'lash")}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  // Kabinetning qo'shimcha bo'limlari — EditCardForm sidebar'iga qo'shiladi
  // (bitta navigatsiya). Kartasiz foydalanuvchi uchun pastda alohida chiqadi.
  const extraSections = [
    {
      id: 'tarif', label: t('Tarif / Premium'), Icon: IconCrown,
      content: (
        <div id="premium-panel" className="space-y-5">
          <PremiumPanel user={user} card={primaryCard} onBecamePremium={refresh} />
          <ReferralPanel user={user} />
        </div>
      ),
    },
    {
      id: 'faoliyat', label: t("Sovg'a va buyurtmalar"), Icon: IconGift, badge: activityBadge,
      content: (
        <div className="space-y-5">
          <GiftOffersPanel onChanged={refresh} onCount={setGiftCount} />
          <WonAuctionsPanel onCount={setWonCount} />
          {ordersBlock}
        </div>
      ),
    },
  ];
  const cabinetLinks = [
    { id: 'bildirishnomalar', label: t('Bildirishnomalar'), Icon: IconBell, onClick: () => navigate('/bildirishnomalar') },
    { id: 'tolovlar', label: t("To'lovlar"), Icon: IconWallet, onClick: () => navigate('/tolovlar') },
    { id: 'xabarlar', label: t(MESSAGING_ENABLED ? 'Xabarlar' : 'Xabarlar · tez orada'), Icon: IconChat, onClick: () => MESSAGING_ENABLED && navigate('/xabarlar'), disabled: !MESSAGING_ENABLED },
    // KOMPANIYA BO'LIMI SHAXSIY KABINETDAN CHIQARILDI (2026-09, egasining
    // qarori: "kompaniyani alohida qilsak, profildan olib tashlasak").
    // Bu endi shaxsiy kabinetning bir bo'limi emas — /business dagi
    // ALOHIDA biznes kabinet. Havola qoldirildi, chunki ikkalasi ham bor
    // odam har safar manzilni qo'lda yozib yurmasin; lekin u boshqa
    // dunyoga o'tishini nomi bilan ham bildiradi.
    { id: 'business', label: t('Biznes kabinet ↗'), Icon: IconBriefcase, onClick: () => navigate('/business') },
    { id: 'sozlamalar', label: t('Akkaunt sozlamalari'), Icon: IconCog, onClick: () => navigate('/sozlamalar') },
    { id: 'support', label: t('Adminga murojaat'), Icon: IconSupport, onClick: () => setSupportOpen(true) },
  ];

  return (
    <main className="mx-auto w-full max-w-[1800px] overflow-x-hidden px-5 sm:px-10 lg:px-14 pb-16">
      <div className="pt-8 font-mono text-xs uppercase tracking-widest text-base-content/45">
        {t('Kabinet')} <span className="text-base-content/25">/</span> <span className="text-base-content/80">{t('Mening profilim')}</span>
      </div>

      {/* Obuna bo'lganlaringizning istoryasi. Hech kim qo'ymagan bo'lsa
          qator umuman chizilmaydi — bo'sh joy "buzuq" ko'rinardi. */}
      <div className="mt-4"><StoryFeedBar /></div>

      {/* Ixcham identifikatsiya paneli — faqat real user/card state. Navigatsiya
          bu yerda EMAS: bitta sidebar (EditCardForm) hamma bo'limlarni beradi. */}
      <section className="vz-card mt-4 p-5 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-accent/40 bg-accent/10 text-2xl font-black text-accent">
              {primaryCard?.avatarUrl
                ? <img src={primaryCard.avatarUrl} alt="" className="h-full w-full object-cover" />
                : heroName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-semibold">{heroName}</h1>
              {/* Email endi ixtiyoriy — bo'lmasa telefon ko'rsatiladi, aks
                  holda bu qator bo'm-bo'sh turardi. */}
              <p className="truncate text-sm text-base-content/55">{user.email || user.phone || ''}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="vz-badge vz-badge--ok"><span className="inline-block h-1.5 w-1.5 rounded-full bg-current"></span> {t('Faol')}</span>
                <span className="vz-badge vz-badge--gold"><IconCrown width={12} height={12} /> {t(tierLabelFor(primaryCard?.code, tierAccess))}</span>
                {primaryCard && <span className="vz-badge vz-badge--muted font-mono">{primaryCard.code} · {t('ASOSIY ID')}</span>}
                {primaryCard && <span className="vz-badge vz-badge--muted">{t(CARD_TYPE_LABEL[primaryCard.profileType] || 'Shaxsiy')}</span>}
                <span className="vz-badge vz-badge--muted">{t("{n} ta raqamli tashrif qog'ozi", { n: myCards.length })}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:shrink-0">
            <button
              className="btn btn-outline-gold btn-sm min-h-11"
              disabled={!primaryCard}
              onClick={() => primaryCard && navigate('/' + primaryCard.code.toLowerCase())}
            >
              <IconEye width={14} height={14} /> {t("Profilni ko'rish")}
            </button>
            <button className="btn btn-ghost-vz btn-sm min-h-11" onClick={logout}>{t('Chiqish')}</button>
          </div>
        </div>
      </section>

      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}

      <section id="mening-profilim">
        {myCards.length === 0 ? (
          <div className="mt-6 space-y-6">
            <div className="vz-empty">
              <span className="text-base-content/40"><IconIdCard width={28} height={28} /></span>
              <span className="text-sm">{t("Hozircha raqamli tashrif qog'ozingiz yo'q.")}</span>
              <button className="btn btn-gold btn-sm min-h-11" onClick={() => navigate('/')}>{t('Bosh sahifada band qilish')} &rarr;</button>
            </div>
            <div id="premium-panel"><PremiumPanel user={user} card={null} onBecamePremium={refresh} /></div>
            <GiftOffersPanel onChanged={refresh} onCount={setGiftCount} />
            <WonAuctionsPanel onCount={setWonCount} />
            {ordersBlock}
            <ReferralPanel user={user} />
          </div>
        ) : (
          <div id="kartani-tahrirlash">
              {selectedCard && (
                selectedCard.profileType === 'business' ? (
                  <div className="mt-6 space-y-6">
                    <div className="vz-card border-accent/30 p-6">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="vz-kicker">{t('Eski biznes profil')} · NFC ID {selectedCard.code}</div>
                          <h3 className="mt-2 font-display text-xl font-semibold">{selectedCard.name || selectedCard.code}</h3>
                          <p className="mt-1 max-w-xl text-sm leading-relaxed text-base-content/60">
                            {t('Bu NFC ID o‘z holicha qoladi. Kompaniya uchun faqat harflardan iborat alohida Company ID oching; admin tasdig‘idan keyin uning NFC va public profili mustaqil ishlaydi.')}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button type="button" className="btn btn-ghost-vz btn-sm min-h-11" onClick={() => navigate('/' + selectedCard.code)}>
                            <IconEye width={14} height={14} /> {t('Profilni ko‘rish')}
                          </button>
                          <button type="button" className="btn btn-gold btn-sm min-h-11" onClick={() => navigate('/company/create?from=' + selectedCard.code.toLowerCase())}>
                            {t('Company ID ochish')} &rarr;
                          </button>
                        </div>
                      </div>
                      {myCards.length > 1 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[color:var(--vz-line)] pt-4 text-sm">
                          <span className="text-base-content/50">{t("Boshqa ID'ga o'tish:")}</span>
                          {myCards.filter((c) => c.code !== selectedCard.code).map((c) => (
                            <button key={c.code} type="button" className="btn btn-ghost-vz btn-xs min-h-9 font-mono" onClick={() => setSelectedCode(c.code)}>{c.code}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div id="premium-panel"><PremiumPanel user={user} card={selectedCard} onBecamePremium={refresh} /></div>
                    <GiftOffersPanel onChanged={refresh} onCount={setGiftCount} />
                    <WonAuctionsPanel onCount={setWonCount} />
                    {ordersBlock}
                    <ReferralPanel user={user} />
                  </div>
                ) : (
                  <EditCardForm
                    key={selectedCard.code}
                    card={selectedCard}
                    onSaved={onSaved}
                    myCards={myCards}
                    onSelectCard={setSelectedCode}
                    extraSections={extraSections}
                    cabinetLinks={cabinetLinks}
                  />
                )
              )}
            </div>
        )}
      </section>
    </main>
  );
}

// ── ISTORYA (shaxsiy profil) ─────────────────────────────────────────
// 24 soatdan keyin o'zi yo'qoladi va profil rasmi atrofida halqa bo'lib
// ko'rinadi. Joylashdan oldin kontent qoidalari ko'rsatiladi
// (StoryUploader ichida) va rozilik SERVERGA ham yuboriladi.
function StoriesManager({ code }) {
  const { t } = useLanguage();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => dbListStories(code)
    .then((s) => setList(s))
    .catch(() => setList([]))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (id) => {
    setList((old) => old.filter((x) => x.id !== id));
    try { await dbDeleteStory(id); } catch { load(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-base-content/55">
        {t('Istorya profil rasmingiz atrofida halqa bo‘lib chiqadi va 24 soatdan keyin o‘zi yo‘qoladi. 10 tagacha.')}
      </p>

      {loading ? (
        <div className="vz-skel" style={{ height: 90 }} />
      ) : list.length ? (
        <div className="flex flex-wrap gap-2">
          {list.map((st) => (
            <div key={st.id} className="relative h-24 w-20 overflow-hidden rounded-xl border border-white/10">
              <img src={st.imageUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(st.id)}
                aria-label={t('O‘chirish')}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-base-content/40">{t('Hozircha istorya yo‘q.')}</p>
      )}

      <StoryUploader
        label={t('Istorya qo‘shish')}
        disabled={list.length >= 10}
        onSubmit={async (payload) => { await dbCreateStory(code, payload); load(); }}
      />
    </div>
  );
}

// ── PROFILDA KO'RSATILADIGAN KOMPANIYA ───────────────────────────────
// Faqat O'ZINING FAOL kompaniyalari ro'yxatga tushadi (server ham
// aynan shuni tekshiradi: begona brendni biriktirib bo'lmaydi).
function ProfileCompanyPicker({ form, setForm, t }) {
  const [companies, setCompanies] = useState(null);
  useEffect(() => {
    let live = true;
    listMyCompanies()
      .then((d) => live && setCompanies((d.companies || []).filter((c) => c.status === 'active')))
      .catch(() => live && setCompanies([]));
    return () => { live = false; };
  }, []);

  // Kompaniyasi yo'q odamga bu bo'lim keraksiz — umuman chizilmaydi.
  if (!companies || companies.length === 0) return null;

  return (
    <div className="vz-panel p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/45">{t('Profilda kompaniya')}</div>
      <p className="mt-1 text-xs leading-relaxed text-base-content/45">
        {t('Profilingizda kompaniyangiz alohida blok bo‘lib chiqadi va bosilganda kompaniya sahifasi ochiladi.')}
      </p>
      <div className="mt-3 space-y-1.5">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/5">
          <input
            type="radio" name="profile-company" className="radio radio-sm"
            checked={!form.companyId}
            onChange={() => setForm((f) => ({ ...f, companyId: '' }))}
          />
          <span className="text-sm text-base-content/70">{t('Ko‘rsatilmasin')}</span>
        </label>
        {companies.map((c) => (
          <label key={c.companyId} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/5">
            <input
              type="radio" name="profile-company" className="radio radio-sm"
              checked={form.companyId === c.companyId}
              onChange={() => setForm((f) => ({ ...f, companyId: c.companyId }))}
            />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-accent/40 bg-black/25 text-[11px] font-black text-accent">
              {c.logoUrl ? <img src={c.logoUrl} alt="" className="h-full w-full object-cover" /> : c.displayName.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{c.displayName}</span>
              <span className="block truncate font-mono text-[11px] text-base-content/45">/c/{c.companyId.toLowerCase()}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
