import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { useCategories, catPath } from '../lib/categories.js';
import { IconEye } from './Icons.jsx';
import { tierForCode, TIER_COLOR, TIER_LABEL, TIER_EMOJI, TIER_CARD_MIX } from '../lib/pricing.js';

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
  // TARIF MATERIALI (egasi, 2026-09-26: "kartalarni o'zining tarifi bilan
  // rang qilib qo'y, sariqliklarni olib tashla"). Ilgari hamma karta
  // och fonda oltin hoshiyali edi — Ekslyuziv, Premium va Gold uchalasi
  // ham sarg'ish bo'lib, bir-biridan ajralmasdi. Endi karta Narxlar
  // sahifasidagi tarif kartasi bilan AYNAN bir xil: qoradan tarif rangiga
  // yumshoq o'tish, oq yozuv. Mavzuga bog'liq emas — ID hamma joyda bir xil.
  const mix = TIER_CARD_MIX[tier] || TIER_CARD_MIX.silver;
  const tc = mix.nameColor || TIER_COLOR[tier] || '#c6cdd6';

  return (
    <button
      type="button"
      className="cat-card cat-card--v2 cat-card--mix tier-shine min-w-0 cursor-pointer rounded-2xl p-5 text-left"
      style={{
        background: mix.background,
        border: mix.border,
        // Ichki matnlar `--tint-base` dan olinadi — qora kartada oq.
        '--tint-base': '#ffffff',
        '--text-primary': '#f4f1e8',
        '--tier': tc,
        '--tier-line': mix.iconBg,
        '--tier-glow': mix.iconBg,
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
            style={{ color: mix.iconColor, background: mix.iconBg, border: mix.border }}
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
        <div className="cat-chips mt-2 flex flex-wrap gap-1.5 text-[14px]">
          {cp && <span className="rounded-full px-2 py-0.5">{cp}</span>}
          {it.city && <span className="rounded-full px-2 py-0.5">{it.city}</span>}
        </div>
      )}
      <div className="cat-rule" />
      {/* Admin sovg'asi -> narx o'rniga "Sovg'a" (sotuvga
          qo'yilgandek ko'rinmasin). `isGift` backend'dan keladi va
          `nfc_gifts` jadvalidagi HAQIQIY sovg'a yozuvidan
          hisoblanadi (status='activated') — narxi 0 bo'lgani uchun
          EMAS. Oddiy xarid qilingan kartalar narxi o'zgarmaydi. */}
      <div className="cat-foot">
        {/* Summasiz kartalarda «Sovg'a» yoziladi.
            Bir muddat egasi bor ekslyuziv ID'lar «Sotuvda emas» deb
            turardi — chunki bazada ular uchun sovg'a yozuvi yo'q edi.
            Amalda esa bu ID'larni egasining O'ZI sovg'a qilib bergan,
            ya'ni yozuv to'g'ri. Ma'lumot darajasida farq saqlanadi
            (`isGift` — bazadagi haqiqiy sovg'a yozuvi, `notForSale` —
            egasi bor ekslyuziv): Sovg'alar sahifasi faqat birinchisini
            ko'rsatadi va keyinchalik bu ID'lar sotuvga qo'yilsa,
            yorliq o'zi o'zgaradi. */}
        {(it.isGift || it.notForSale)
          ? <span className="rounded-full px-2.5 py-0.5 text-[13px] font-bold" style={{ color: mix.nameColor, background: mix.iconBg }}>{t("Sovg'a")}</span>
          : <span className="cat-price">{t("{n} so'm", { n: fmt(it.price) })}</span>}
        <span className="cat-when">{timeAgo(it.ts)}</span>
      </div>
    </button>
  );
}
