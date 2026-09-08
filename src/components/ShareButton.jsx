import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { shareLink } from '../lib/share.js';
import { IconShare, IconCheck, IconLink } from './Icons.jsx';

// "Ulashish" tugmasi.
//
// Telefonda tizimning o'z ulashish oynasini ochadi (Telegram, WhatsApp,
// Instagram...), kompyuterda esa havolani nusxalaydi va tugmaning o'zi
// 2 soniyaga "Nusxalandi" ga aylanadi — alohida bildirishnoma tizimiga
// bog'lanmasligi uchun, shunda tugmani istalgan sahifaga qo'yish mumkin.
//
// props:
//   url   — ulashiladigan to'liq havola (majburiy)
//   title — ulashish oynasidagi sarlavha
//   text  — ulashish oynasidagi qisqa tavsif
//   label — tugma matni; berilmasa faqat belgi chiqadi (ixcham holat)
//   className — tashqi uslub (btn o'lchami v.h.)
//   forceCopy — tizim oynasini chetlab o'tib to'g'ridan-to'g'ri nusxalash
//               (ulashish oynasi ishlamaydigan brauzerlar uchun zaxira tugma)
export default function ShareButton({ url, title, text, label, forceCopy = false, className = 'btn btn-ghost-vz btn-sm' }) {
  const { t } = useLanguage();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  // Komponent yopilganidan keyin setState chaqirilmasligi uchun.
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onClick = async () => {
    const result = await shareLink({ url, title, text, forceCopy });
    // 'shared' — foydalanuvchi natijani o'zi ko'rdi;
    // 'cancelled' — o'zi bekor qildi, xabar chiqarish noto'g'ri bo'lardi.
    if (result !== 'copied' && result !== 'failed') return;
    const ok = result === 'copied';
    setDone(ok);
    setFailed(!ok);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setDone(false); setFailed(false); }, 2000);
  };

  const caption = done ? t('Nusxalandi!') : failed ? t('Nusxalab bo‘lmadi') : label;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} min-h-11 gap-2`}
      aria-label={label ? undefined : t(forceCopy ? 'Havolani nusxalash' : 'Ulashish')}
      title={t(forceCopy ? 'Havolani nusxalash' : 'Ulashish')}
    >
      {done ? <IconCheck /> : forceCopy ? <IconLink /> : <IconShare />}
      {caption && <span>{caption}</span>}
    </button>
  );
}
