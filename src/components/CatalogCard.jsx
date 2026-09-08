import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { useCategories, catPath } from '../lib/categories.js';
import { IconEye } from './Icons.jsx';
import { tierForCode, TIER_COLOR, TIER_LABEL, TIER_EMOJI } from '../lib/pricing.js';

// ═══════════════════════════════════════════════════════════════════════
// KATALOG KARTASI — YAGONA ta'rif (2026-09)
//
// Bu ko'rinish ilgari faqat /katalog sahifasining ichida yozilgan edi.
// Sovg'alar sahifasidagi "Yangi egasini topgan NFC ID'lar" ro'yxati esa
// o'zining kichkina, `transform: scale(.54)` bilan qisqartirilgan
// variantini ishlatardi — matni deyarli o'qilmasdi va katalogdagi
// kartaga umuman o'xshamasdi.
//
// Endi ikkala joyda AYNAN shu komponent. Nusxa bo'lsa, vaqt o'tib biri
// o'zgarib, ikkinchisi eskirib qolardi.
// ═══════════════════════════════════════════════════════════════════════
export default function CatalogCard({ item: it, idx = 0 }) {
  const { t, lang } = useLanguage();
  const cats = useCategories();
  const cp = catPath(cats, it.categorySlug, lang);
  const tier = it.tierOverride || tierForCode(it.code);
  const tc = TIER_COLOR[tier] || '#8a8a8a';

  return (
    <button
      type="button"
      className="cat-card cat-card--v2 tier-shine min-w-0 cursor-pointer rounded-2xl p-5 text-left"
      style={{
        '--tier': tc,
        '--tier-line': tc + 'b3',
        '--tier-glow': tc + '3d',
        '--tier-fill': tc + '14',
        '--shine-delay': `${(idx % 7) * 0.55}s`,
      }}
      onClick={() => navigate('/' + it.code)}
    >
      {/* ── Bosh qism: dumaloq profil rasmi + ID + ism ──
          Rasm AVTOMATIK: profilga qo'yilgan bo'lsa shu yerda ham
          chiqadi (`avatarUrl` katalog API'sida allaqachon bor),
          qo'lda hech narsa belgilanmaydi. Rasm yo'q bo'lsa
          ismning bosh harfi turadi. */}
      <div className="cat-head">
        {it.avatarUrl
          ? <img className="cat-av" src={it.avatarUrl} alt="" loading="lazy" decoding="async" />
          : <span className="cat-av" aria-hidden="true">{(it.name || it.code).trim().charAt(0).toUpperCase()}</span>}
        <span className="cat-idwrap">
          {/* `nfcstore.uz/` prefiksi olib tashlandi — kartaning
              istalgan joyi bosilsa profil ochilaveradi. */}
          <span className="cat-id">{it.code.toUpperCase()}</span>
          {/* 2026-09: FAQAT asosiy ko'rinadigan ism. Avval yonida
              Telegram username ham chiqardi ("Ali · davlatsudekspert").
              Bu FAQAT katalog kartasiga tegishli — public profil,
              Admin Panel va kabinet ma'lumotlari o'z holicha. */}
          <span className="cat-name">
            <span>{it.name}</span>
            {it.verified && <span title={t('Tasdiqlangan')} className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-[9px] font-black text-white">✓</span>}
          </span>
        </span>
        {/* O'ngda: tarif belgisi, ostida ko'rishlar soni. */}
        <span className="cat-meta">
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[13px] font-bold uppercase tracking-wide"
            style={{ color: tc, background: tc + '1f', border: `1px solid ${tc}44` }}
          >
            {TIER_EMOJI[tier] ? TIER_EMOJI[tier] + ' ' : ''}{t(TIER_LABEL[tier] || tier)}
          </span>
          <span className="cat-views" title={t("Ko'rishlar")}>
            <IconEye /> {fmt(it.views || 0)}
          </span>
        </span>
      </div>
      {it.role && <div className="cat-role">{it.role}</div>}
      {(cp || it.city) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[14px] text-base-content/45">
          {cp && <span className="rounded-full border border-white/10 px-2 py-0.5">{cp}</span>}
          {it.city && <span className="rounded-full border border-white/10 px-2 py-0.5">{it.city}</span>}
        </div>
      )}
      <div className="cat-rule" />
      {/* Admin sovg'asi -> narx o'rniga "Sovg'a" (sotuvga
          qo'yilgandek ko'rinmasin). `isGift` backend'dan keladi va
          `nfc_gifts` jadvalidagi HAQIQIY sovg'a yozuvidan
          hisoblanadi (status='activated') — narxi 0 bo'lgani uchun
          EMAS. Oddiy xarid qilingan kartalar narxi o'zgarmaydi. */}
      <div className="cat-foot">
        {it.isGift
          ? <span className="rounded-full bg-[color:var(--vz-gold,#d4af5a)]/15 px-2.5 py-0.5 text-[13px] font-bold text-[color:var(--vz-gold-2,#f0cf7a)]">{t("Sovg'a")}</span>
          : <span className="cat-price">{t("{n} so'm", { n: fmt(it.price) })}</span>}
        <span className="cat-when">{timeAgo(it.ts)}</span>
      </div>
    </button>
  );
}
