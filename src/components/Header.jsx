import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { IconWave } from './Icons.jsx';

function scrollTo(id) {
  navigate('/');
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView();
  }, 50);
}

export default function Header() {
  const { user } = useAuth();

  return (
    <header>
      <div className="headbar wrap" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <button className="brand" onClick={() => navigate('/')}>
          <div className="badge">N00</div>NFCSTORE
          <IconWave className="brand-wave" style={{ color: 'var(--brass-bright)' }} />
        </button>
        <nav>
          <button onClick={() => scrollTo('tekshir')}>Tekshirish</button>
          <button onClick={() => scrollTo('nomlar')}>Nomlar</button>
          <button onClick={() => scrollTo('katalog')}>Katalog</button>
          <button onClick={() => scrollTo('savollar')}>Savollar</button>
        </nav>
        <div className="navcta">
          {user ? (
            <button className="btn btn-ghost" onClick={() => navigate('/account')}>Mening profilim</button>
          ) : (
            <button className="btn btn-ghost" onClick={() => navigate('/login')}>Kirish</button>
          )}
          <button className="btn btn-brass" onClick={() => scrollTo('tekshir')}>Vizitka olish</button>
        </div>
      </div>
    </header>
  );
}
