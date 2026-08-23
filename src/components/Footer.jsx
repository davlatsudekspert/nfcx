import { navigate } from '../lib/router.js';

const COLS = [
  { title: 'Mahsulot', links: [['Narxlar', '/narxlar'], ['Qanday ishlaydi', '/qanday-ishlaydi'], ['Katalog', '/katalog']] },
  { title: 'Kompaniya', links: [['Savollar', '/savollar'], ['Aloqa', '/aloqa']] },
  { title: 'Huquqiy', links: [['Foydalanish shartlari', '/shartlar'], ['Maxfiylik siyosati', '/maxfiylik']] },
];

export default function Footer() {
  return (
    <footer>
      <div className="wrap fgrid">
        <div>
          <div className="brand" style={{ fontSize: 16, marginBottom: 8 }}>
            <div className="badge" style={{ width: 22, height: 22, fontSize: 10 }}>N00</div>NFCSTORE
          </div>
          Raqamli shaxsiy vizitka xizmati
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <div style={{ color: 'var(--ink-dim)', fontWeight: 700, fontSize: 12.5, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>{col.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.links.map(([label, href]) => (
                <button key={href} onClick={() => navigate(href)} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', textAlign: 'left', padding: 0, fontSize: 13 }}>{label}</button>
              ))}
            </div>
          </div>
        ))}
        <div>© 2026 NFCSTORE</div>
      </div>
    </footer>
  );
}
