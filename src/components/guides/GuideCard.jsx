import { useLanguage } from '../../lib/i18n.jsx';
import { GUIDE_CATEGORIES, guideDurationLabel } from '../../lib/guides.js';

// Kategoriya bo'yicha katta ikonka — kartochkaning eng ko'zga tashlanadigan
// belgilaridan biri (talab: 22-24px). Emoji ishlatamiz — qo'shimcha ikon
// kutubxonasi kerak emas, mavjud dizayn tili bilan bir xil (⏱️ va h.k.).
const CATEGORY_ICON = {
  profil: '👤',
  kompaniya: '🏢',
  nfc: '📡',
  auksion: '🔨',
};

export default function GuideCard({ guide, onOpen }) {
  const { t } = useLanguage();
  const catLabel = GUIDE_CATEGORIES.find((c) => c.id === guide.category)?.label || guide.category;
  const catIcon = CATEGORY_ICON[guide.category] || '✦';
  // Kartochka rasmi uchun — birinchi mavjud REAL frame'ni izlaymiz (ba'zi
  // darslar 'mock' frame bilan boshlanadi, masalan NFC tegizish namoyishi —
  // bunday holda ham karta hech qachon bo'sh/"Tez orada" ko'rinishida
  // qolmasligi kerak, chunki har bir darsda kamida bitta real frame bor).
  const thumb = guide.frames?.find((f) => f.kind === 'real');
  const thumbSrc = thumb ? thumb.thumb || thumb.image : null;
  const stepCount = guide.frames?.length || 0;

  return (
    <button
      onClick={() => onOpen(guide)}
      className="qollanma-card group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-base-200/60 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_0_0_1px_rgba(201,162,39,0.35),0_18px_40px_-12px_rgba(201,162,39,0.25)]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-base-100">
        {thumbSrc && (
          <img
            src={thumbSrc}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <span className="flex h-9 items-center gap-1.5 rounded-full bg-black/75 px-3.5 text-[13px] font-semibold text-white/90 backdrop-blur-sm">
            <span className="text-lg leading-none">{'⏱️'}</span> {t(guideDurationLabel(guide.durationMin))}
          </span>
          <span className="flex h-8 items-center gap-1 rounded-full bg-black/75 px-3 text-[13px] font-semibold text-white/80 backdrop-blur-sm">
            {stepCount} {t('qadam')}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="flex h-9 w-fit items-center gap-1.5 rounded-full border border-white/15 px-4 text-[13px] font-bold uppercase tracking-wide text-base-content/70">
          <span className="text-lg leading-none">{catIcon}</span> {t(catLabel)}
        </span>
        <h3 className="mt-3 text-lg font-bold leading-snug text-base-content group-hover:text-accent">{t(guide.title)}</h3>
        <p className="mt-2 line-clamp-2 flex-1 text-[13.5px] leading-relaxed text-base-content/60">{t(guide.description)}</p>
        <span className="btn mt-4 h-12 min-h-12 w-full border-white/15 bg-white/5 text-[15px] group-hover:border-accent/60 group-hover:bg-accent/10 group-hover:text-accent">
          {t("Ko'rish")}
        </span>
      </div>
    </button>
  );
}
