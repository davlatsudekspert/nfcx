import { useCallback, useEffect, useState } from 'react';
import { usePathRoute } from './lib/router.js';
import { parseAnyCode } from './lib/pricing.js';
import { dbList } from './lib/db.js';
import { AuthProvider } from './lib/auth.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import HomePage from './pages/HomePage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import HowItWorksPage from './pages/HowItWorksPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import FaqPage from './pages/FaqPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import AuctionsPage from './pages/AuctionsPage.jsx';
import AuctionPage from './pages/AuctionPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import MessagesPage from './pages/MessagesPage.jsx';
import PaymentsPage from './pages/PaymentsPage.jsx';
import CardDesignerPage from './pages/CardDesignerPage.jsx';

const STATIC_ROUTES = {
  '': null, // HomePage — handled separately
  login: AuthPage,
  register: AuthPage,
  account: AccountPage,
  narxlar: PricingPage,
  'qanday-ishlaydi': HowItWorksPage,
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
const RESERVED = new Set(Object.keys(STATIC_ROUTES).filter(Boolean));

export default function App() {
  const route = usePathRoute();
  const cleanRoute = route.replace(/^\/+|\/+$/g, '');
  const [catalog, setCatalog] = useState([]);

  const refreshCatalog = useCallback(async () => {
    const recs = await dbList();
    setCatalog(recs);
  }, []);

  useEffect(() => { refreshCatalog(); }, [refreshCatalog]);

  // Har bir band qilingan raqamli tashrif qog'ozi o'zining alohida sahifasiga ega:
  // nfcstore.uz/aaa00 (harf katta-kichikligi farq qilmaydi).
  let page;
  let bare = false;
  const isAuctionDetail = cleanRoute.startsWith('auksion/');
  const isMessagesDetail = cleanRoute.startsWith('xabarlar/');
  if (!RESERVED.has(cleanRoute) && !isAuctionDetail && !isMessagesDetail) {
    const parsedRoute = cleanRoute ? parseAnyCode(cleanRoute) : null;
    if (parsedRoute) {
      page = <ProfilePage key={parsedRoute.code} code={parsedRoute.code} catalog={catalog} />;
      bare = true;
    }
  }
  if (!page) {
    if (cleanRoute === 'login' || cleanRoute === 'register') page = <AuthPage mode={cleanRoute} />;
    else if (cleanRoute === 'account') page = <AccountPage refreshCatalog={refreshCatalog} />;
    else if (cleanRoute === 'narxlar') page = <PricingPage catalog={catalog} refreshCatalog={refreshCatalog} />;
    else if (cleanRoute === 'qanday-ishlaydi') page = <HowItWorksPage />;
    else if (cleanRoute === 'katalog') page = <CatalogPage catalog={catalog} />;
    else if (cleanRoute === 'savollar') page = <FaqPage catalog={catalog} />;
    else if (cleanRoute === 'aloqa') page = <ContactPage />;
    else if (cleanRoute === 'shartlar') page = <TermsPage />;
    else if (cleanRoute === 'maxfiylik') page = <PrivacyPage />;
    else if (cleanRoute === 'auksion') page = <AuctionsPage />;
    else if (cleanRoute === 'tolovlar') page = <PaymentsPage />;
    else if (cleanRoute === 'karta-dizayni') page = <CardDesignerPage />;
    else if (cleanRoute === 'admin') { page = <AdminPage />; bare = true; }
    else if (isAuctionDetail) page = <AuctionPage key={cleanRoute} id={cleanRoute.slice('auksion/'.length)} />;
    else if (cleanRoute === 'xabarlar') page = <MessagesPage />;
    else if (isMessagesDetail) page = <MessagesPage key={cleanRoute} id={cleanRoute.slice('xabarlar/'.length)} />;
    else page = <HomePage catalog={catalog} refreshCatalog={refreshCatalog} />;
  }

  return (
    <AuthProvider>
      {bare ? page : (
        <>
          <Header />
          {page}
          <Footer />
        </>
      )}
    </AuthProvider>
  );
}