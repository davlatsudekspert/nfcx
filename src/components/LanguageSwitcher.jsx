import { useRef, useState } from 'react';
import { useLanguage, LANGUAGES } from '../lib/i18n.jsx';
import AnchoredMenu, { anchorTo } from './AnchoredMenu.jsx';
import FlagIcon from './FlagIcon.jsx';

// Til tanlash tugmasi — 🇺🇿/🇷🇺/🇬🇧, tanlov brauzerda saqlanadi.
// Header'da ham, header'siz "bare" sahifalarda (public profil, admin) ham
// ishlatiladi.
//
// NIMA UCHUN `AnchoredMenu` (2026-09). Ilgari ro'yxat shu yerda
// `absolute` bilan chizilardi va uni yopish uchun yonida ko'rinmas
// `fixed inset-0` qoplama turardi. Ikkalasi ham SARLAVHA ichida
// bo'lgani uchun buzilardi:
//
//   Sarlavhada `backdrop-blur` bor. `backdrop-filter` qo'yilgan element
//   o'z ichidagi `position: fixed` bolalari uchun YANGI o'lcham
//   boshlanishi (containing block) ochadi — ya'ni "butun ekranni
//   qopla" degan qoplama aslida FAQAT SARLAVHANI qoplardi.
//
// Oqibati telefonda quyidagicha edi (egasining shikoyati: "tepadagi til
// va menyuga kirish ishlamayapti"):
//   • qoplama til, mavzu va hamburger tugmalarini berkitib qo'yardi —
//     ularga tegib bo'lmasdi;
//   • sahifaning qolgan qismi qoplama OSTIDA emas edi, shuning uchun
//     chetga teginish ro'yxatni YOPMASDI ham.
// Natijada ro'yxat ochilgach, sarlavha sahifa yangilanmaguncha
// butunlay javob bermay qolardi. Kompyuterda sezilmasdi, chunki
// sichqoncha bilan odam odatda ro'yxatning o'zidan tilni tanlaydi.
//
// `AnchoredMenu` esa menyuni `document.body` ga chiqaradi: hech qanday
// o'ram uni kesmaydi, qoplama umuman kerak emas, yopilish esa
// tashqariga teginish / siljish / Escape orqali ishlaydi.
export default function LanguageSwitcher({ className = '' }) {
  const { lang, setLang } = useLanguage();
  const [at, setAt] = useState(null);
  const btnRef = useRef(null);
  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
  // Bo'y: 3 ta qator × 44px + ichki chetlar — pastda shuncha joy
  // bo'lmasa `anchorTo` menyuni tugmaning tepasidan ochadi.
  const place = () => anchorTo(btnRef.current, { width: 176, height: 152, align: 'right' });
  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        data-anchored-anchor
        className="btn btn-ghost btn-sm min-h-11 px-2"
        onClick={() => setAt((a) => (a ? null : place()))}
        aria-haspopup="menu"
        aria-expanded={!!at}
        aria-label={current.label}
      >
        <FlagIcon code={current.code} className="text-base" />
      </button>
      <AnchoredMenu at={at} onClose={() => setAt(null)} label={current.label}>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            role="menuitemradio"
            aria-checked={lang === l.code}
            onClick={() => { setLang(l.code); setAt(null); }}
            className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 ${lang === l.code ? 'text-accent' : ''}`}
          >
            <FlagIcon code={l.code} /> {l.label}
          </button>
        ))}
      </AnchoredMenu>
    </div>
  );
}
