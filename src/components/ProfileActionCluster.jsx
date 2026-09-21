import ShareButton from './ShareButton.jsx';
import ProfileMoreMenu from './ProfileMoreMenu.jsx';
import { useLanguage } from '../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// OCHIQ PROFIL TEPASIDAGI AMALLAR — BITTA TIZIM
//
// Ilgari har bir ochiq profil o'z tepasini o'zi chizardi: shaxsiy
// profilda nusxalash/ulashish/⋮ bir joyda, yurak esa BUTUNLAY boshqa
// qatorda (obunachilar sonining yonida) turardi; biznes profilda esa
// ⋮ yonida "Kompaniyalar" va katta oltin "Tahrirlash" bor edi.
// Natijada bir saytning ikki sahifasi ikki xil boshqarilardi.
//
// Endi o'ng yuqori burchakdagi amallar HAMMA ochiq profilda shu bitta
// komponentdan keladi va TARTIBI QAT'IY:
//
//        [nusxalash] [ulashish] [⋮] [♥ n]
//
// ⋮ YURAKDAN OLDIN. Yurak — eng oxirgi, eng o'ngdagi va yagona RANGLI
// element: u sahifadagi asosiy ijtimoiy harakat va ko'z unga tushishi
// kerak. ⋮ esa kamdan-kam ochiladigan menyu; u yurakdan keyin tursa,
// barmoq yurakka cho'zilganda tasodifan menyu ochilardi.
//
// EGA AMALLARI ⋮ ICHIDA. Ochiq profil — mehmonga ko'rsatiladigan
// sahifa, boshqaruv paneli emas. Mehmonda `ownerActions` bo'sh bo'ladi
// va menyuda "Egasi uchun" bo'limi umuman chizilmaydi.
// ═══════════════════════════════════════════════════════════════════════

// `like` — { count, liked, onToggle, onOpenList } yoki null.
// `null` bo'lsa yurak umuman chizilmaydi (masalan biznes profilda),
// BO'SH JOY HAM QOLMAYDI: qator shunchaki qisqaradi.
export default function ProfileActionCluster({
  url,
  shareTitle = '',
  shareText = '',
  onCopy,
  targetKind = 'record',
  targetId = '',
  ownerActions = [],
  like = null,
  className = '',
}) {
  const { t } = useLanguage();

  return (
    <div className={`pf-actions ${className}`.trim()}>
      {onCopy && (
        <button type="button" className="pf-act" onClick={onCopy} title={t('Nusxalash')} aria-label={t('Nusxalash')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2.5" />
            <path d="M5 15V6a2.5 2.5 0 0 1 2.5-2.5H15" />
          </svg>
        </button>
      )}

      {url && (
        <ShareButton
          url={url}
          title={shareTitle}
          text={shareText}
          className="pf-act"
        />
      )}

      {/* ⋮ — MAVZU, TIL, SHIKOYAT va (egaga) profil amallari.
          Yurakdan OLDIN — yuqoridagi izohga qarang. */}
      <ProfileMoreMenu
        targetKind={targetKind}
        targetId={targetId}
        className="pf-act"
        ownerActions={ownerActions}
      />

      {/* YURAK — eng oxirgi. Bosish/bekor qilish va SON alohida tugma:
          son "kim yoqtirdi" ro'yxatini ochadi. Ilgari son yurakning
          ichida edi va ro'yxatni ochishning iloji yo'q edi. */}
      {like && (
        <span className={`pf-like${like.liked ? ' is-on' : ''}`}>
          <button type="button" className="pf-like-heart" onClick={like.onToggle} aria-pressed={!!like.liked} aria-label={t('Yoqtirish')}>
            {like.liked ? '❤️' : '\u{1F90D}'}
          </button>
          <button type="button" className="pf-like-count" onClick={like.onOpenList} aria-label={t('Yoqtirganlar')}>
            <b>{Number(like.count || 0)}</b>
          </button>
        </span>
      )}
    </div>
  );
}
