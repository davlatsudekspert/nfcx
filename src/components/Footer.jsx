import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import logo from '../assets/logo-128.png';

const COLS = [
  { title: 'Mahsulot', links: [['Narxlar', '/narxlar'], ['Qanday ishlaydi', '/qanday-ishlaydi'], ['Katalog', '/katalog'], ['Kompaniyalar', '/kompaniyalar'], ['Biznes kabinet', '/business']] },
  { title: 'Kompaniya', links: [['Yangiliklar', '/yangiliklar'], ['Savollar', '/savollar'], ['Aloqa', '/aloqa']] },
  { title: 'Huquqiy', links: [['Foydalanish shartlari', '/shartlar'], ['Maxfiylik siyosati', '/maxfiylik']] },
];

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-[color:var(--vz-line)] bg-page-bg">
      <div className="h-px bg-gradient-to-r from-transparent via-[rgba(212,175,90,0.45)] to-transparent"></div>
      <div className="mx-auto w-full max-w-[1800px] px-6 py-12 sm:px-10 lg:px-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-2 flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-[0.08em] text-[color:var(--vz-gold-2)]">
              <img src={logo} alt="NFCSTORE" className="h-8 w-8 object-contain" />
              NFCSTORE
            </div>
            <p className="max-w-[28ch] text-sm text-[color:var(--vz-ink-2)]">{t('NFC karta + raqamli profil')}</p>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[color:var(--vz-gold)]">{t(col.title)}</div>
              {/* Bosish maydoni 44px — saytdagi qolgan tugmalar bilan bir xil
                  (telefonda barmoq bilan aniq tegish uchun minimal o'lcham).
                  Avval 32px edi. Oraliq `gap` kichraytirildi, shuning uchun
                  ustunning umumiy balandligi deyarli o'zgarmaydi. */}
              <ul className="flex flex-col gap-0.5">
                {col.links.map(([label, href]) => (
                  <li key={href}>
                    <button
                      onClick={() => navigate(href)}
                      className="flex min-h-11 cursor-pointer items-center text-left text-[15px] text-[color:var(--vz-ink-2)] transition-colors hover:text-[color:var(--vz-ink)]"
                    >
                      {t(label)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-[color:var(--vz-line)] pt-5 text-xs text-[color:var(--vz-ink-3)] sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 NFCSTORE.UZ</span>
          {/* To'lov tizimi ATAYLAB nomlanmagan: Click yoki boshqa tizim
              qo‘shilganda bu yozuvni qidirib yurish shart bo'lmasin. */}
          <span>{t('Cloudflare tarmog‘ida ishlaydi · To‘lovlar rasmiy to‘lov tizimlari orqali')}</span>
        </div>
      </div>
    </footer>
  );
}