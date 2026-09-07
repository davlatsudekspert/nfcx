import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { usePathRoute, navigate } from './lib/router.js';
import { parseAnyCode } from './lib/pricing.js';
import { companyIdLocalInfo } from './lib/company.js';
import { dbList } from './lib/db.js';
import { AuthProvider } from './lib/auth.jsx';
import { LanguageProvider, useLanguage } from './lib/i18n.jsx';
import { applySeo, seoForRoute, seoForProfile } from './lib/seo.js';
import { PaymentsEnabledProvider } from './lib/paymentsEnabled.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import AiAssistant from './components/AiAssistant.jsx';
import HomePage from './pages/HomePage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import { MESSAGING_ENABLED } from './lib/features.js';

const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const PricingPage = lazy(() => import('./pages/PricingPage.jsx'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage.jsx'));
const NewsPage = lazy(() => import('./pages/NewsPage.jsx'));
const CatalogPage = lazy(() => import('./pages/CatalogPage.jsx'));
const RankingPage = lazy(() => import('./pages/RankingPage.jsx'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'));
const GiftsPage = lazy(() => import('./pages/GiftsPage.jsx'));
const FaqPage = lazy(() => import('./pages/FaqPage.jsx'));
const ContactPage = lazy(() => import('./pages/ContactPage.jsx'));
const TermsPage = lazy(() => import('./pages/TermsPage.jsx'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.jsx'));
const AuctionsPage = lazy(() => import('./pages/AuctionsPage.jsx'));
const AuctionPage = lazy(() => import('./pages/AuctionPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const MessagesPage = lazy(() => import('./pages/MessagesPage.jsx'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage.jsx'));
const CardDesignerPage = lazy(() => import('./pages/CardDesignerPage.jsx'));
const BusinessWorkspacePage = lazy(() => import('./pages/BusinessWorkspacePage.jsx'));
const BusinessPublicDemoPage = lazy(() => import('./pages/BusinessPublicDemoPage.jsx'));
const CompanyCreatePage = lazy(() => import('./pages/CompanyCreatePage.jsx'));
const CompanyWorkspacePage = lazy(() => import('./pages/CompanyWorkspacePage.jsx'));
const CompanyQuickProfilePage = lazy(() => import('./pages/CompanyQuickProfilePage.jsx'));
const CompanyPublicPage = lazy(() => import('./pages/CompanyPublicPage.jsx'));

const STATIC_ROUTES = {
  '': null, // HomePage — handled separately
  login: AuthPage,
  register: AuthPage,
  account: AccountPage,
  narxlar: PricingPage,
  'qanday-ishlaydi': HowItWorksPage,
  yangiliklar: NewsPage,
  katalog: CatalogPage,
  savollar: FaqPage,
  aloqa: ContactPage,
  shartlar: TermsPage,
  maxfiylik: PrivacyPage,
  auksion: AuctionsPage,
  gifts: GiftsPage,
  qollanma: GuideRedirect,
  admin: AdminPage,
  xabarlar: MessagesPage,
  tolovlar: PaymentsPage,
  'karta-dizayni': CardDesignerPage,
  'biznes-namuna': BusinessPublicDemoPage,
};
// STATIC_ROUTES'dan tashqari, if-zanjirida ishlov beriladigan sahifalar ham
// "band" hisoblanadi — aks holda /reyting kabi manzillar profil kodi deb
// noto'g'ri talqin qilinishi mumkin.
const RESERVED = new Set([
  ...Object.keys(STATIC_ROUTES).filter(Boolean),
  'reyting', 'kompaniyalar', 'bildirishnomalar', 'sozlamalar', 'business', 'biznes-namuna', 'company', 'workspace', 'c',
]);

// Profil sifatida hal qilinadigan manzil: standart AAA000, ro'yxatdan o'tishda
// beriladigan 8 xonali ID, YOKI faqat-harfli so'z (3–16 belgi — kompaniya /
// maxsus profil nomi, masalan nfcstore.uz/kompaniya). Harfli kodlar bandlash
// oqimida o'chirilgan (parseAnyCode ularni qaytarmaydi), lekin admin bergan
// bunday profillar shu URL orqali ochilishi SHART.
const ROUTE_PROFILE_RE = /^(?:[A-Za-z]{3}[0-9]{3}|[0-9]{8}|[A-Za-z]{3,12})$/;

// SEO — marshrut yoki til o'zgarganda <title>/meta/canonical yangilanadi.
// LanguageProvider ichida turishi kerak (joriy tilni olish uchun), shuning
// uchun alohida kichik komponent. Profil sahifasida sarlavha = karta nomi.
function SeoSync({ route, profileCode, catalog }) {
  const { lang } = useLanguage();
  useEffect(() => {
    if (profileCode) {
      const rec = (catalog || []).find((r) => r && String(r.code || '').toUpperCase() === profileCode);
      applySeo(seoForProfile(rec || { code: profileCode }, lang));
      return;
    }
    applySeo(seoForRoute(route, lang));
  }, [route, lang, profileCode, catalog]);
  return null;
}

// URL bo'lagidan kanonik kompaniya ID'si. Yaroqsiz bo'lsa `null` —
// shunda sahifa umuman ochilmaydi va 404 mantig'i ishlaydi.
function companyIdFromRoute(route, pattern) {
  const m = route.match(pattern);
  if (!m) return null;
  let raw = m[1];
  try { raw = decodeURIComponent(raw); } catch { /* buzuq %-ketma-ketlik: xom holicha */ }
  const info = companyIdLocalInfo(raw);
  return info.valid ? info.companyId : null;
}

// /qollanma — qo'llanma bo'limi VIDEO darslarga qayta ishlanmoqda
// (2026-09). Eski rasmli darslar olib tashlandi; havolalar menyudan ham
// chiqarildi, lekin manzilning O'ZI band bo'lib qoladi va bosh sahifaga
// yo'naltiradi. Sababi: `qollanma` STATIC_ROUTES'dan olib tashlansa, u
// NFC ID kodi deb talqin qilinib "profil topilmadi" chiqardi — eski
// havolani bosgan odam uchun bu 404'dan ham yomonroq.
function GuideRedirect() {
  useEffect(() => { navigate('/', { replace: true }); }, []);
  return null;
}

export default function App() {
  const route = usePathRoute();
  const cleanRoute = route.replace(/^\/+|\/+$/g, '');
  const [catalog, setCatalog] = useState([]);

  const refreshCatalog = useCallback(async () => {
    const recs = await dbList();
    setCatalog(recs);
  }, []);

  useEffect(() => { refreshCatalog(); }, [refreshCatalog]);

  // Tahrirlash maydonidan tashqarida "Backspace" bosilishi ba'zi
  // brauzerlarda "orqaga" navigatsiyani chaqiradi (yoki sahifani bo'sh
  // holatga tashlaydi) — masalan hamma matn belgilanib (Ctrl+A) keyin
  // Backspace bosilganda. Bunday hollarda uni bloklaymiz.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Backspace') return;
      const el = e.target;
      const tag = el && el.tagName;
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable);
      if (!editable) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Har bir band qilingan raqamli tashrif qog'ozi o'zining alohida sahifasiga ega:
  // nfcstore.uz/aaa00 (harf katta-kichikligi farq qilmaydi).
  let page;
  let bare = false;
  let profileCode = null;
  const isAuctionDetail = cleanRoute.startsWith('auksion/');
  const isNewsDetail = cleanRoute.startsWith('yangiliklar/');
  const isMessagesDetail = cleanRoute.startsWith('xabarlar/');
  // Company System — Menyu/Mahsulotlar uchun alohida ulashiladigan URL:
  // nfcstore.uz/{code}/menyu, nfcstore.uz/{code}/mahsulotlar (Faz 9/10).
  // Yangi NFC ID talab qilinmaydi — bir xil ProfilePage, faqat boshlang'ich
  // tab oldindan belgilanadi.
  const businessWorkspaceMatch = cleanRoute.match(/^business\/([^/]+)$/);
  // Kompaniya ID'sida o'zbekcha O'/G' bo'lishi mumkin (nfcstore.uz/c/g'oya),
  // shuningdek turli apostrof belgilari va %27. Shuning uchun bo'lak keng
  // olinadi, `companyIdFromRoute()` esa uni kanonik shaklga keltirib
  // TEKSHIRADI — yaroqsiz bo'lsa `null` qaytadi va sahifa ochilmaydi.
  const companyQuickMatch = companyIdFromRoute(cleanRoute, /^c\/([^/]{1,40})$/);
  const companyPublicMatch = companyIdFromRoute(cleanRoute, /^company\/([^/]{1,40})$/);
  const companyWorkspaceMatch = companyIdFromRoute(cleanRoute, /^workspace\/([^/]{1,40})$/);
  const companySubMatch = cleanRoute.match(/^([^/]+)\/(menu|products|services|menyu|mahsulotlar|xizmatlar|aksiyalar)$/);
  if (!page && cleanRoute === 'company/create') {
    page = <CompanyCreatePage />;
    bare = true;
  }
  if (!page && companyQuickMatch) {
    page = <CompanyQuickProfilePage key={cleanRoute} companyId={companyQuickMatch} />;
    bare = true;
  }
  if (!page && companyPublicMatch) {
    page = <CompanyPublicPage key={cleanRoute} companyId={companyPublicMatch} />;
    bare = true;
  }
  if (!page && companyWorkspaceMatch) {
    page = <CompanyWorkspacePage key={cleanRoute} companyId={companyWorkspaceMatch} />;
    bare = true;
  }
  if (!page && businessWorkspaceMatch) {
    page = <BusinessWorkspacePage key={cleanRoute} code={businessWorkspaceMatch[1]} />;
    bare = true;
  }
  if (!page && !RESERVED.has(cleanRoute) && !isAuctionDetail && !isMessagesDetail && cleanRoute && !cleanRoute.includes('/')) {
    const parsedRoute = parseAnyCode(cleanRoute);
    const code = parsedRoute ? parsedRoute.code : (ROUTE_PROFILE_RE.test(cleanRoute) ? cleanRoute.toUpperCase() : null);
    if (code) {
      page = <ProfilePage key={code} code={code} catalog={catalog} />;
      bare = true;
      profileCode = code;
    }
  }
  if (!page && companySubMatch) {
    const [, rawCode, sub] = companySubMatch;
    const parsedRoute = parseAnyCode(rawCode);
    const code = parsedRoute ? parsedRoute.code : (ROUTE_PROFILE_RE.test(rawCode) ? rawCode.toUpperCase() : null);
    if (code) {
      const initialTab = ({ menu: 'menyu', products: 'mahsulotlar', services: 'xizmatlar' })[sub] || sub;
      page = <ProfilePage key={`${code}/${sub}`} code={code} catalog={catalog} initialTab={initialTab} />;
      bare = true;
    }
  }
  if (!page) {
    if (cleanRoute === 'login' || cleanRoute === 'register') page = <AuthPage mode={cleanRoute} />;
    else if (cleanRoute === 'account') page = <AccountPage refreshCatalog={refreshCatalog} />;
    else if (cleanRoute === 'sozlamalar') page = <SettingsPage />;
    else if (cleanRoute === 'narxlar') page = <PricingPage catalog={catalog} refreshCatalog={refreshCatalog} />;
    else if (cleanRoute === 'qanday-ishlaydi') page = <HowItWorksPage />;
    else if (cleanRoute === 'yangiliklar') page = <NewsPage />;
    else if (cleanRoute === 'katalog') page = <CatalogPage catalog={catalog} />;
    else if (cleanRoute === 'reyting') page = <RankingPage catalog={catalog} />;
    else if (cleanRoute === 'kompaniyalar') page = <CompaniesPage catalog={catalog} />;
    else if (cleanRoute === 'bildirishnomalar') page = <NotificationsPage />;
    else if (cleanRoute === 'savollar') page = <FaqPage catalog={catalog} />;
    else if (cleanRoute === 'aloqa') page = <ContactPage />;
    else if (cleanRoute === 'shartlar') page = <TermsPage />;
    else if (cleanRoute === 'maxfiylik') page = <PrivacyPage />;
    else if (cleanRoute === 'auksion') page = <AuctionsPage />;
    else if (cleanRoute === 'gifts') page = <GiftsPage catalog={catalog} />;
    else if (cleanRoute === 'qollanma') page = <GuideRedirect />;
    else if (cleanRoute === 'tolovlar') page = <PaymentsPage />;
    else if (cleanRoute === 'karta-dizayni') page = <CardDesignerPage />;
    else if (cleanRoute === 'biznes-namuna') { page = <BusinessPublicDemoPage />; bare = true; }
    else if (cleanRoute === 'admin') { page = <AdminPage />; bare = true; }
    else if (isAuctionDetail) page = <AuctionPage key={cleanRoute} id={cleanRoute.slice('auksion/'.length)} />;
    else if (isNewsDetail) page = <NewsPage key={cleanRoute} newsId={cleanRoute.slice('yangiliklar/'.length)} />;
    else if (cleanRoute === 'xabarlar' && MESSAGING_ENABLED) page = <MessagesPage />;
    else if (isMessagesDetail && MESSAGING_ENABLED) page = <MessagesPage key={cleanRoute} id={cleanRoute.slice('xabarlar/'.length)} />;
    else page = <HomePage catalog={catalog} refreshCatalog={refreshCatalog} />;
  }

  const renderedPage = (
    <Suspense fallback={<main className="mx-auto min-h-[55vh] w-full max-w-[1800px] px-6 py-16 text-sm text-base-content/50">Yuklanmoqda...</main>}>
      {page}
    </Suspense>
  );

  return (
    <LanguageProvider>
      <SeoSync route={cleanRoute} profileCode={profileCode} catalog={catalog} />
      <PaymentsEnabledProvider>
        <AuthProvider>
          {bare ? renderedPage : (
            <>
              <Header />
              {renderedPage}
              <Footer />
              <AiAssistant />
            </>
          )}
        </AuthProvider>
      </PaymentsEnabledProvider>
    </LanguageProvider>
  );
}
