import { useLanguage } from '../../lib/i18n.jsx';
import { GUIDE_CATEGORIES, guideDurationLabel } from '../../lib/guides.js';

export default function GuideCard({ guide, onOpen }) {
  const { t } = useLanguage();
  const catLabel = GUIDE_CATEGORIES.find((c) => c.id === guide.category)?.label || guide.category;
  const thumb = guide.frames?.[0];
  const thumbSrc = thumb?.kind === 'real' ? thumb.thumb || thumb.image : null;

  return (
    <button
      onClick={() => onOpen(guide)}
      className="qollanma-card group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-base-200/60 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_0_0_1px_rgba(201,162,39,0.35),0_18px_40px_-12px_rgba(201,162,39,0.25)]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-base-100">
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center border-b border-dashed border-white/10 text-[11px] text-base-content/35">
            {t('Tez orada')}
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
          {'⏱️'} {t(guideDurationLabel(guide.durationMin))}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className="w-fit rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-base-content/50">
          {t(catLabel)}
        </span>
        <h3 className="mt-2 text-[16px] font-bold leading-snug text-base-content group-hover:text-accent">{t(guide.title)}</h3>
        <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-base-content/60">{t(guide.description)}</p>
        <span className="btn btn-sm mt-4 w-full border-white/15 bg-white/5 group-hover:border-accent/60 group-hover:bg-accent/10 group-hover:text-accent">
          {t("Ko'rish")}
        </span>
      </div>
    </button>
  );
}
