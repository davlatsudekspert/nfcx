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
import ComingSoon from './components/ComingSoon.jsx';

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
};
const RESERVED = new Set(Object.keys(STATIC_ROUTES).filter(Boolean));

export default function App() {
  const route = usePathRoute();
  const cleanRoute = route.replace(/^\/+|\/+$/g, '');
  const [catalog, setCatalog] = useState([]);
  const [showComingSoon, setShowComingSoon] = useState(true);

  const refreshCatalog = useCallback(async () => {
    const recs = await dbList();
    setCatalog(recs);
  }, []);

  useEffect(() => { refreshCatalog(); }, [refreshCatalog]);

  // Har bir band qilingan vizitka o'zining alohida sahifasiga ega:
  // nfcstore.uz/aaa00 (harf katta-kichikligi farq qilmaydi).
  let page;
  let bare = false;
  if (!RESERVED.has(cleanRoute)) {
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
    else page = <HomePage catalog={catalog} refreshCatalog={refreshCatalog} />;
  }

  return (
    <AuthProvider>
      {showComingSoon ? (
        <ComingSoon />
      ) : bare ? page : (
        <>
          <Header />
          {page}
          <Footer />
        </>
      )}
    </AuthProvider>
  );
}
