// KO'RGAZMA POSTI (2026-10, hosting/api/showcase.js) — sarlavha, narx
// ("125 000 so'm"), katalog mahsuloti va tashqi havola (YouTube/Instagram).
// Oddiy postda hech narsa chizilmaydi. Server havolani allaqachon tekshirgan
// (faqat https + ruxsat etilgan xost) — bu yerda ham faqat https.
import { useLanguage } from '../lib/i18n.jsx';

export function formatUzs(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 0) return '';
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function ShowcaseInfo({ post, className = '' }) {
  const { t } = useLanguage();
  if (!post?.showcase) return null;
  const item = post.catalogItem || null;
  const link = /^https:\/\//i.test(String(post.linkUrl || '')) ? post.linkUrl : '';
  const price = post.priceUzs != null ? post.priceUzs : (item?.priceUzs ?? null);
  return (
    <div className={`mb-2 ${className}`} data-testid="showcase-info">
      {post.title && <div className="text-[17px] font-semibold leading-snug">{post.title}</div>}
      {price != null && <div className="mt-0.5 text-[16px] font-bold" style={{ color: 'var(--vz-gold-2, #c9a961)' }}>{formatUzs(price)} {t("so'm")}</div>}
      {(item || link) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {item && item.companyId && (
            <a className="btn btn-ghost-vz btn-xs min-h-9" href={`/company/${encodeURIComponent(String(item.companyId).toLowerCase())}`}>
              {t('Mahsulotni ko‘rish')}{item.name ? `: ${item.name}` : ''}
            </a>
          )}
          {link && (
            <a className="btn btn-ghost-vz btn-xs min-h-9" href={link} target="_blank" rel="noopener noreferrer nofollow">
              {t('Havolani ochish')} ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
