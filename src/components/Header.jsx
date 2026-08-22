import { navigate } from '../lib/router.js';

function scrollTo(id) {
  navigate('');
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView();
  }, 50);
}

export default function Header() {
  return (
    <header>
      <div className="headbar wrap" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <button className="brand" onClick={() => navigate('')}>
          <div className="badge">B00</div>BELGI
        </button>
        <nav>
          <button onClick={() => scrollTo('tekshir')}>Tekshirish</button>
          <button onClick={() => scrollTo('katalog')}>Katalog</button>
          <button onClick={() => scrollTo('savollar')}>Savollar</button>
        </nav>
        <div className="navcta">
          <button className="btn btn-brass" onClick={() => scrollTo('tekshir')}>Vizitka olish</button>
        </div>
      </div>
    </header>
  );
}
