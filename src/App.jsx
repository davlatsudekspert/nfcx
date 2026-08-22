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

const RESERVED = new Set(['login', 'register', 'account']);

export default function App() {
  const route = usePathRoute();
  const cleanRoute = route.replace(/^\/+|\/+$/g, '');
  const [catalog, setCatalog] = useState([]);

  const refreshCatalog = useCallback(async () => {
    const recs = await dbList();
    setCatalog(recs);
  }, []);

  useEffect(() => { refreshCatalog(); }, [refreshCatalog]);

  // Har bir band qilingan vizitka o'zining alohida sahifasiga ega:
  // nfcstore.uz/aaa00 yoki nfcstore.uz/ali (harf katta-kichikligi farq qilmaydi).
  let page;
  let bare = false;
  if (!RESERVED.has(cleanRoute)) {
    const parsedRoute = cleanRoute ? parseAnyCode(cleanRoute) : null;
    if (parsedRoute) {
      page = <ProfilePage key={parsedRoute.code} code={parsedRoute.code} />;
      bare = true;
    }
  }
  if (!page) {
    if (cleanRoute === 'login' || cleanRoute === 'register') page = <AuthPage mode={cleanRoute} />;
    else if (cleanRoute === 'account') page = <AccountPage refreshCatalog={refreshCatalog} />;
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
