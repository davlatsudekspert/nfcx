import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { APP_PAGE_PATH, isIos } from '../lib/appDownload.js';

// "ILOVANI YUKLAB OLING" — OCHIQ PROFIL SAHIFASIDA (egasi, 2026-09-24).
//
// NFC kartani tekkizgan yoki havolani ochgan odam profilni ko'radi —
// NFCSTORE bilan eng ko'p uchrashadigan joy shu. Karta profil
// egasining kontentidan KEYIN, NFCSTORE rasmiy kanallari oldida
// turadi: ko'zga tashlanadi, lekin egasining tugmalarini
// to'smaydi. iPhone'da ko'rsatilmaydi (ilova hozircha Android uchun).
export default function AppDownloadCard() {
  const { t } = useLanguage();
  if (isIos()) return null;
  const open = (e) => {
    e.preventDefault();
    navigate(APP_PAGE_PATH);
  };
  return (
    <a
      href={APP_PAGE_PATH}
      onClick={open}
      data-testid="profile-app-download"
      className="mt-8 flex items-center gap-3.5 rounded-2xl p-3.5 no-underline transition hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(135deg, #16181b 0%, #23262b 100%)',
        border: '1px solid rgba(212, 175, 55, 0.45)',
        boxShadow: '0 10px 28px -14px rgba(0, 0, 0, 0.55)',
      }}
    >
      <img
        src="/logo-192.png"
        alt=""
        width="48"
        height="48"
        loading="lazy"
        className="h-12 w-12 shrink-0 rounded-xl"
        style={{ boxShadow: '0 0 0 1px rgba(212, 175, 55, 0.5)' }}
      />
      <span className="min-w-0 flex-1 text-left">
        <span className="block whitespace-nowrap text-[15px] font-bold leading-tight" style={{ color: '#f6f1e4' }}>
          {t('NFCSTORE ilovasi')}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: 'rgba(246, 241, 228, 0.65)' }}>
          {t("O'z raqamli vizitkangizni yarating — Android uchun")}
        </span>
      </span>
      <span
        className="shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold"
        style={{ background: 'linear-gradient(135deg, #f6de8d, #d4af37)', color: '#2a2012' }}
      >
        {t('Yuklab olish')}
      </span>
    </a>
  );
}
