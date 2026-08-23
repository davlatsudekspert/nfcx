import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';

export default function Header() {
  const { user } = useAuth();

  return (
    <header>
      <div className="headbar wrap" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <button className="brand" onClick={() => navigate('/')}>
          <div className="badge">N00</div>NFCSTORE
        </button>
        <nav>
          <button onClick={() => navigate('/narxlar')}>Narxlar</button>
          <button onClick={() => navigate('/qanday-ishlaydi')}>Qanday ishlaydi</button>
          <button onClick={() => navigate('/katalog')}>Katalog</button>
          <button onClick={() => navigate('/savollar')}>Savollar</button>
        </nav>
        <div className="navcta">
          {user ? (
            <button className="btn btn-ghost" onClick={() => navigate('/account')}>Mening profilim</button>
          ) : (
            <button className="btn btn-ghost" onClick={() => navigate('/login')}>Kirish</button>
          )}
          <button className="btn btn-brass" onClick={() => navigate('/')}>Vizitka olish</button>
        </div>
      </div>
    </header>
  );
}
