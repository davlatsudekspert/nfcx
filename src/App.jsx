import { useCallback, useEffect, useState } from 'react';
import { useHashRoute } from './lib/router.js';
import { parseCode } from './lib/pricing.js';
import { dbList } from './lib/db.js';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import HomePage from './pages/HomePage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

export default function App() {
  const route = useHashRoute();
  const cleanRoute = route.replace(/^\//, '');
  const [catalog, setCatalog] = useState([]);

  const refreshCatalog = useCallback(async () => {
    const recs = await dbList();
    setCatalog(recs);
  }, []);

  useEffect(() => { refreshCatalog(); }, [refreshCatalog]);

  const parsedRoute = cleanRoute ? parseCode(cleanRoute) : null;

  // Each reserved code renders its own ProfilePage instance, addressed by
  // its own route (#/<code>) — i.e. every vizitka effectively "opens" its
  // own page, driven by the same component with that record's data.
  if (parsedRoute) {
    return <ProfilePage code={parsedRoute.code} />;
  }

  return (
    <>
      <Header />
      <HomePage catalog={catalog} refreshCatalog={refreshCatalog} />
      <Footer />
    </>
  );
}
