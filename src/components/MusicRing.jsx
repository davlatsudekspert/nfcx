import { useLanguage } from '../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// AVATAR ATROFIDAGI MUSIQA HALQASI
//
// IKKI HALQA, IKKI MA'NO — VA ULAR USTMA-UST TUSHMAYDI:
//
//      TASHQI halqa  = STORY  (StoryRing) — bosilsa istorya ochiladi;
//      ICHKI  halqa  = MUSIQA (shu komponent) — bosilsa musiqa
//                      yonadi/to'xtaydi.
//
// Tartib ataylab shunday: istorya — VAQTINCHALIK (24 soat) va tashqi
// qavatda turgani uchun ko'zga birinchi tashlanadi; musiqa esa
// profilning DOIMIY bezagi va avatarga yaqinroq turadi. Ikkalasi bir
// vaqtda bo'lsa ham bir-birini yopmaydi, chunki radiuslar har xil
// (StoryRing::before -13px atrofida, bu halqa -6px).
//
// MUSIQA YO'Q BO'LSA — HECH NARSA CHIZILMAYDI.
// Bo'sh "joy egallab turuvchi" halqa ham yo'q: `children` o'zi
// qaytariladi. Shunda musiqasiz profil avvalgidek ko'rinadi.
//
// BU KOMPONENT PLEER EMAS. U ijro holatini faqat KO'RSATADI va
// bosilganda tashqaridagi YAGONA pleerni chaqiradi (ProfilePage
// MusicPlayer). Ikkinchi pleer arxitekturasi yaratilmadi — aks holda
// bitta sahifada ikki audio manba bir vaqtda chalinishi mumkin edi.
//
// NIMA UCHUN BU KOMPONENT StoryRing NI O'RAB OLADI, ICHIGA
// KIRMAYDI. Ko'rinishda musiqa ichkarida, story tashqarida — buni
// RADIUSLAR hal qiladi (yoy -6px, story halqasi -18px), DOM tartibi
// emas. Agar nota tugmasi StoryRing ichiga tushsa, u istorya
// tugmasining ICHIDAGI tugma bo'lib qolardi: brauzerda bu haqiqiy
// xato edi — nota bosilganda bosish istorya tugmasiga ham yetib
// borar va to'liq ekranli ko'ruvchi ochilib ketardi (o'lchandi:
// bosishdan keyin `.sv-back` paydo bo'lardi), keyingi bosishlar esa
// o'sha ko'ruvchiga tushib, musiqa umuman to'xtamasdi.
export default function MusicRing({ hasMusic = false, playing = false, onToggle, children }) {
  const { t } = useLanguage();
  if (!hasMusic) return children;

  const label = playing ? t('Musiqani to‘xtatish') : t('Musiqani yoqish');
  return (
    <span className={`music-ring${playing ? ' is-playing' : ''}`} data-music-state={playing ? 'playing' : 'idle'}>
      {/* Yoy — bezak. `pointer-events:none`, shuning uchun ostidagi
          istorya halqasini bosishga XALAQIT BERMAYDI. */}
      <span className="music-ring-arc" aria-hidden="true" />
      {children}
      {/* Nota — `children` ning YONIDA, ichida emas: yuqoridagi
          izohga qarang. Bosish istorya tugmasiga yetib bormaydi. */}
      <button type="button" className="music-ring-btn" onClick={onToggle} aria-label={label} title={label} aria-pressed={playing}>
        {playing
          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          : <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z" /></svg>}
      </button>
    </span>
  );
}
