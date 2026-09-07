// Tugma ichidagi RASMIY so'z belgisi (wordmark) — Payme o'z merchantlariga
// beradigan tugma ko'rinishining aynan o'zi: "Pay" oq harflarda, "me" esa
// uchi o'tkir oq yorliq ichida turkuaz rangda.
//
// NIMA UCHUN SVG, RASM EMAS: PNG har xil ekran zichligida xiralashadi va
// qora/oq mavzuda fonini olib yuradi. SVG istalgan o'lchamda tiniq
// chiqadi va tugma balandligiga qarab o'ziga o'zi moslashadi.
//
// `textLength` + `lengthAdjust` — shrift yuklanmagan yoki boshqa
// platformada boshqacha o'lchangan taqdirda ham harflar yorliqdan
// chiqib ketmasligi uchun kenglik QAT'IY belgilanadi. Busiz "me" so'zi
// oq yorliqning uchidan oshib ketishi mumkin edi.
const MARK_FONT = "'Manrope Variable', Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif";

export default function BrandMark({ provider = 'payme' }) {
  if (provider === 'click') {
    // Click uchun rasmiy grafik belgi bizda yo'q — o'ylab topilgani
    // brendni buzadi, shuning uchun faqat toza oq so'z belgisi.
    return (
      <svg role="img" aria-label="Click" viewBox="0 0 62 28" height="20" width="44">
        <text
          x="0" y="21" textLength="60" lengthAdjust="spacingAndGlyphs"
          fontFamily={MARK_FONT} fontSize="23" fontWeight="800" fill="currentColor"
        >Click</text>
      </svg>
    );
  }
  return (
    <svg role="img" aria-label="Payme" viewBox="0 0 100 28" height="20" width="71">
      <text
        x="0" y="21" textLength="42" lengthAdjust="spacingAndGlyphs"
        fontFamily={MARK_FONT} fontSize="23" fontWeight="800" fill="currentColor"
      >Pay</text>
      {/* O'ng uchi o'tkir oq yorliq — Payme belgisining eng tanilgan qismi */}
      <path d="M51 2 H86 L100 14 L86 26 H51 A6 6 0 0 1 45 20 V8 A6 6 0 0 1 51 2 Z" fill="#ffffff" />
      <text
        x="52" y="21" textLength="30" lengthAdjust="spacingAndGlyphs"
        fontFamily={MARK_FONT} fontSize="23" fontWeight="800" fill="#12a08f"
      >me</text>
    </svg>
  );
}

