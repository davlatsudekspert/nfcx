import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';

// Kabinet navigatsiyasidan ochilgan sahifalar (Bildirishnomalar, To'lovlar,
// Sozlamalar) uchun — kabinetga qaytish tugmasi.
export default function BackToCabinet() {
  const { t } = useLanguage();
  return (
    <button
      onClick={() => navigate('/account')}
      className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-base-content/55 transition hover:text-base-content"
    >
      <span aria-hidden>&larr;</span> {t('Kabinetga qaytish')}
    </button>
  );
}
