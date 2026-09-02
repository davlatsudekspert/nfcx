import { useLanguage } from '../../lib/i18n.jsx';
import { GUIDE_CATEGORIES, guideDurationLabel } from '../../lib/guides.js';
import GuideMockFrame from './GuideMockFrame.jsx';

export default function GuideCard({ guide, onOpen }) {
  const { t } = useLanguage();
  const catLabel = GUIDE_CATEGORIES.find((c) => c.id === guide.category)?.label || guide.category;
  const thumb = guide.frames?.[0];

  return (
    <div className="qollanma-card group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-base-200/60 transition hover:border-white/20">
      <div className="p-3 pb-0">
        {thumb ? (
          <GuideMockFrame variant={thumb.image} className="pointer-events-none" />
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-base-100/40 text-[11px] text-base-content/35">
            {t('Tez orada')}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-[11px] text-base-content/45">
          <span className="rounded-full border border-white/10 px-2 py-0.5 uppercase tracking-wide">{t(catLabel)}</span>
          <span>·</span>
          <span>{'⏱️'} {t(guideDurationLabel(guide.durationMin))}</span>
        </div>
        <h3 className="mt-2 text-[15px] font-bold leading-snug">{t(guide.title)}</h3>
        <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-base-content/55">{t(guide.description)}</p>
        <button
          onClick={() => onOpen(guide)}
          className="btn btn-sm mt-4 w-full border-white/15 bg-white/5 hover:border-accent/60 hover:bg-accent/10 hover:text-accent"
        >
          {t("Ko'rish")}
        </button>
      </div>
    </div>
  );
}
