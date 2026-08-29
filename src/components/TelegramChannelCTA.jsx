import { useLanguage } from '../lib/i18n.jsx';
import { IconTelegram } from './Icons.jsx';

// "Band qilish" modalida to'lov hali yopiq bo'lgani uchun ko'rsatiladigan
// Telegram kanalga chaqiruv. Faqat "Telegram kanalga qo'shilish"
// link/tugmasi GOLD rangda — atrofdagi matnlar mavjud ranglarida qoladi.
//
// Loyihadagi mavjud rasmiy kanal URL'i qayta ishlatiladi (ProfilePage'dagi
// bilan bir xil): https://t.me/nfcstoreuz
export const TELEGRAM_CHANNEL_URL = 'https://t.me/nfcstoreuz';

export default function TelegramChannelCTA() {
  const { t } = useLanguage();
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-base-200/40 p-5">
      <div className="text-sm font-bold">{t('Band qilish tez kunlarda ishga tushadi')}</div>
      <p className="mt-1 text-sm leading-relaxed text-base-content/60">
        {t("To'lov tizimi ishga tushishi bilan ID'larni band qilish mumkin bo'ladi. Birinchi bo'lib xabardor bo'lish uchun Telegram kanalimizga qo'shiling.")}
      </p>
      <a
        href={TELEGRAM_CHANNEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#d4af5a]/45 bg-[#d4af5a]/10 px-4 py-2 text-sm font-semibold text-[#d4af5a] transition hover:border-[#d4af5a]/80 hover:bg-[#d4af5a]/15 hover:text-[#e8c165] hover:shadow-[0_0_18px_rgba(212,175,90,0.28)]"
      >
        <IconTelegram width="16" height="16" />
        {t('Telegram kanalga qo‘shilish')}
      </a>
      <p className="mt-2 text-xs leading-relaxed text-base-content/45">
        {t("Ishga tushirish sanasi, yangi ID'lar va NFCSTORE yangiliklari kanalda e'lon qilinadi.")}
      </p>
    </div>
  );
}
