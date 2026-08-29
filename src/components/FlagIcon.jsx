// Kichik SVG bayroqlar — regional-indicator emoji (🇺🇿/🇷🇺/🇬🇧) Windows
// brauzerlarida umuman chizilmaydi (faqat "UZ"/"RU"/"GB" harflari ko'rinadi),
// shuning uchun til tanlashda haqiqiy SVG ishlatamiz.
export default function FlagIcon({ code, className = '' }) {
  const common = {
    viewBox: '0 0 24 18',
    width: '1.15em',
    height: '0.86em',
    className: `inline-block shrink-0 rounded-[2px] ring-1 ring-black/10 ${className}`,
    'aria-hidden': true,
  };

  if (code === 'ru') {
    return (
      <svg {...common}>
        <rect width="24" height="6" y="0" fill="#fff" />
        <rect width="24" height="6" y="6" fill="#0039a6" />
        <rect width="24" height="6" y="12" fill="#d52b1e" />
      </svg>
    );
  }

  if (code === 'en') {
    return (
      <svg {...common}>
        <rect width="24" height="18" fill="#012169" />
        <path d="M0 0l24 18M24 0L0 18" stroke="#fff" strokeWidth="3.6" />
        <path d="M0 0l24 18M24 0L0 18" stroke="#c8102e" strokeWidth="2.1" />
        <path d="M12 0v18M0 9h24" stroke="#fff" strokeWidth="6" />
        <path d="M12 0v18M0 9h24" stroke="#c8102e" strokeWidth="3.6" />
      </svg>
    );
  }

  // uz (standart)
  return (
    <svg {...common}>
      <rect width="24" height="18" fill="#fff" />
      <rect width="24" height="5.4" y="0" fill="#0099b5" />
      <rect width="24" height="5.4" y="12.6" fill="#1eb53a" />
      <rect width="24" height="0.8" y="5.4" fill="#ce1126" />
      <rect width="24" height="0.8" y="11.8" fill="#ce1126" />
      <circle cx="4.6" cy="2.8" r="1.9" fill="#fff" />
      <circle cx="5.4" cy="2.8" r="1.9" fill="#0099b5" />
    </svg>
  );
}
