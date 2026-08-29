import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { usePathRoute } from './lib/router.js';
import { parseAnyCode } from './lib/pricing.js';
import { dbList } from './lib/db.js';
import { AuthProvider } from './lib/auth.jsx';
import { LanguageProvider } from './lib/i18n.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
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
  admin: AdminPage,
  xabarlar: MessagesPage,
  tolovlar: PaymentsPage,
  'karta-dizayni': CardDesignerPage,
};
// STATIC_ROUTES'dan tashqari, if-zanjirida ishlov beriladigan sahifalar ham
// "band" hisoblanadi — aks holda /reyting kabi manzillar profil kodi deb
// noto'g'ri talqin qilinishi mumkin.
const RESERVED = new Set([
  ...Object.keys(STATIC_ROUTES).filter(Boolean),
  'reyting', 'kompaniyalar', 'bildirishnomalar', 'sozlamalar',
]);

// Profil sifatida hal qilinadigan manzil: standart AAA000, ro'yxatdan o'tishda
// beriladigan 8 xonali ID, YOKI faqat-harfli so'z (3–16 belgi — kompaniya /
// maxsus profil nomi, masalan nfcstore.uz/kompaniya). Harfli kodlar bandlash
// oqimida o'chirilgan (parseAnyCode ularni qaytarmaydi), lekin admin bergan
// bunday profillar shu URL orqali ochilishi SHART.
const ROUTE_PROFILE_RE = /^(?:[A-Za-z]{3}[0-9]{3}|[0-9]{8}|[A-Za-z]{3,12})$/;

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
  const isAuctionDetail = cleanRoute.startsWith('auksion/');
  const isMessagesDetail = cleanRoute.startsWith('xabarlar/');
  if (!RESERVED.has(cleanRoute) && !isAuctionDetail && !isMessagesDetail && cleanRoute && !cleanRoute.includes('/')) {
    const parsedRoute = parseAnyCode(cleanRoute);
    const code = parsedRoute ? parsedRoute.code : (ROUTE_PROFILE_RE.test(cleanRoute) ? cleanRoute.toUpperCase() : null);
    if (code) {
      page = <ProfilePage key={code} code={code} catalog={catalog} />;
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
    else if (cleanRoute === 'kompaniyalar') page = <CompaniesPage />;
    else if (cleanRoute === 'bildirishnomalar') page = <NotificationsPage />;
    else if (cleanRoute === 'savollar') page = <FaqPage catalog={catalog} />;
    else if (cleanRoute === 'aloqa') page = <ContactPage />;
    else if (cleanRoute === 'shartlar') page = <TermsPage />;
    else if (cleanRoute === 'maxfiylik') page = <PrivacyPage />;
    else if (cleanRoute === 'auksion') page = <AuctionsPage />;
    else if (cleanRoute === 'tolovlar') page = <PaymentsPage />;
    else if (cleanRoute === 'karta-dizayni') page = <CardDesignerPage />;
    else if (cleanRoute === 'admin') { page = <AdminPage />; bare = true; }
    else if (isAuctionDetail) page = <AuctionPage key={cleanRoute} id={cleanRoute.slice('auksion/'.length)} />;
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
      <AuthProvider>
        {bare ? renderedPage : (
          <>
            <Header />
            {renderedPage}
            <Footer />
          </>
        )}
      </AuthProvider>
    </LanguageProvider>
  );
}