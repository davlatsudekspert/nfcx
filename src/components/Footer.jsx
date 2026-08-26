import { navigate } from '../lib/router.js';
import logo from '../assets/logo-128.png';

const COLS = [
  { title: 'Mahsulot', links: [['Narxlar', '/narxlar'], ['Qanday ishlaydi', '/qanday-ishlaydi'], ['Katalog', '/katalog'], ['Karta dizayni', '/karta-dizayni']] },
  { title: 'Kompaniya', links: [['Savollar', '/savollar'], ['Aloqa', '/aloqa']] },
  { title: 'Huquqiy', links: [['Foydalanish shartlari', '/shartlar'], ['Maxfiylik siyosati', '/maxfiylik']] },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-base-100">
      <div className="mx-auto w-full max-w-[1800px] px-6 py-10 sm:px-10 lg:px-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <div className="mb-2 flex items-center gap-2.5 text-[15px] font-extrabold tracking-wide">
              <img src={logo} alt="NFCSTORE" className="h-8 w-8 object-contain" />
              NFCSTORE
            </div>
            <p className="text-sm text-base-content/50">Raqamli shaxsiy vizitka xizmati</p>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-base-content/60">{col.title}</div>
              <ul className="flex flex-col gap-2">
                {col.links.map(([label, href]) => (
                  <li key={href}>
                    <button
                      onClick={() => navigate(href)}
                      className="cursor-pointer text-left text-[13px] text-base-content/40 transition-colors hover:text-base-content"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 border-t border-white/5 pt-5 text-xs text-base-content/35">© 2026 NFCSTORE</div>
      </div>
    </footer>
  );
}