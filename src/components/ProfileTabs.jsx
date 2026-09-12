import { useLanguage } from '../lib/i18n.jsx';

// PROFIL BO'LIMLARI — bitta qator "tab" tugmalari.
//
// Bir xil ko'rinish IKKALA profilda ham ishlatiladi (shaxsiy va biznes):
// egasining talabi shu edi. Ilgari shaxsiy profilda ostiga chiziladigan
// tab, biznes profilda esa ustma-ust "01 Xizmatlar / 02 Yangiliklar"
// bo'limlari bor edi — ikki xil ko'rinish, ikki xil kod.
//
// BO'SH BO'LIM UMUMAN CHIZILMAYDI: restoranda "Menyu", do'konda
// "Tovarlar", xizmat ko'rsatuvchida "Xizmatlar" chiqadi. Bo'sh tab
// bosilganda "hech narsa yo'q" degan sahifa ochilardi.
//
// props:
//   tabs   — [{ id, label, count }] (count ixtiyoriy; 0 bo'lsa yozilmaydi)
//   value  — faol bo'lim id'si
//   onChange(id)
export default function ProfileTabs({ tabs = [], value, onChange }) {
  const { t } = useLanguage();
  const list = tabs.filter(Boolean);
  // Bitta bo'lim qolsa tanlash ma'nosiz — qator umuman chizilmaydi.
  if (list.length < 2) return null;
  return (
    <nav className="pf-tabs" role="tablist">
      {list.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={`pf-tab${value === tab.id ? ' is-on' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {t(tab.label)}
          {tab.count > 0 && <b>{tab.count}</b>}
        </button>
      ))}
    </nav>
  );
}
