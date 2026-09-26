// TELEFON RAMKASIDAGI SKRINSHOT — saytning hamma joyida bitta ko'rinish
// (stikerlar, ilova sahifasi, bosh sahifa).
//
// Egasi: "rasm aniq ilova bilan bir xil bo'lsin, kichkina xunuk bo'lib
// qolmasin". Shuning uchun:
//   • rasm ASL nisbatida — kesilmaydi va cho'zilmaydi (h-auto);
//   • fayllar retina uchun yetarli (780–810 px kenglik, public/ilova,
//     public/stikerlar);
//   • ramka ingichka va qora — e'tibor ekranga qaratiladi.

export function PhoneShot({ src, alt = '', className = '', eager = false }) {
  // `relative` faqat chaqiruvchi `absolute` bermagan bo'lsa: Tailwind'da
  // `.relative` CSS'da keyinroq turadi va `absolute` ni bosib ketardi —
  // ramka flex ichida cho'zilib, ekran ostida bo'sh qora joy qolardi.
  // Kenglik ham shunday: `w-full` ixtiyoriy `w-[36%]` dan kuchliroq chiqadi.
  const pos = /(^|\s)(absolute|fixed)(\s|$)/.test(className) ? '' : 'relative';
  const width = /(^|\s)w-/.test(className) ? '' : 'w-full';
  return (
    <figure className={`${pos} ${width} m-0 h-fit rounded-[2.4rem] bg-gradient-to-b from-[#34322e] via-[#161513] to-[#0a0a09] p-[7px] shadow-[0_34px_70px_-30px_rgba(0,0,0,.7),inset_0_0_0_1px_rgba(255,255,255,.09)] ${className}`}>
      <div className="overflow-hidden rounded-[2rem] bg-black ring-1 ring-black/60">
        <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className="block h-auto w-full" />
      </div>
    </figure>
  );
}

// Telefonlar qatori: kompyuterda to'r, telefonda yonga suriladigan lenta.
// Sahifaning o'zi gorizontal surilmaydi — faqat shu qator (manfiy margin
// sahifa chetidagi bo'shliq bilan teng: px-6 / sm:px-10).
export function PhoneRow({ items, cols = 'md:grid-cols-4' }) {
  return (
    <div className={`-mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-3 [scrollbar-width:none] sm:-mx-10 sm:px-10 md:mx-0 md:grid md:items-start md:gap-6 md:overflow-visible md:px-0 ${cols}`}>
      {items.map((it) => (
        <div key={it.src} className="w-[68vw] max-w-[300px] shrink-0 snap-center md:w-auto md:max-w-none">
          <PhoneShot src={it.src} alt={it.alt} />
          {it.cap && <p className="mt-4 text-center text-[14px] font-semibold text-[color:var(--vz-ink-2)]">{it.cap}</p>}
        </div>
      ))}
    </div>
  );
}
