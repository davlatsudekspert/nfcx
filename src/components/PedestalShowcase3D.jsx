import { cloneElement } from 'react';

// Narxlar sahifasidagi "premium mahsulot vitrinasi".
//
// MAVJUD <NfcCard/> (rang, yozuv, chip yo'q, border, tipografiya — hammasi
// o'zgarishsiz) sahna markazida, qora granit pьedestal ustida "suzib"
// turadi va Y o'qi bo'ylab juda sekin, doimiy, tekis 360° aylanadi
// (taxminan 12 soniyada bir marta). FAQAT karta aylanadi — pьedestal
// STATIK. Aylanish paytida orqa tomonda "mirror text" ko'rinmasligi uchun
// haqiqiy ikki yuzli (front/back) 3D struktura + backface-visibility.
//
// Faqat CSS transform/opacity (GPU-friendly) — og'ir 3D kutubxona yo'q.
// prefers-reduced-motion'da aylanish va shimmer to'xtaydi (theme.css).
export default function PedestalShowcase3D({ children }) {
  // Orqa yuz — bir xil NfcCard'ning `back` propi bilan (o'zi qora/oltin
  // NFCSTORE dizayn tilida: belgi, havola, "MEMBER SINCE").
  const backChild = cloneElement(children, { back: true });

  return (
    <div className="ps-stage">
      <div className="ps-bg-glow" aria-hidden />

      {/* Karta — suzuvchi (yumshoq translateY) + aylanuvchi (rotateY) */}
      <div className="ps-card-float">
        <div className="ps-card-spin">
          <div className="ps-face">{children}</div>
          <div className="ps-face ps-face--back">{backChild}</div>
        </div>
      </div>

      {/* Karta bilan pьedestalni bog'lovchi yumshoq oltin nur */}
      <div className="ps-underglow" aria-hidden />

      {/* PYEDESTAL — statik, qora granit, nozik oltin halqa, sekin shimmer */}
      <div className="ps-pedestal" aria-hidden>
        <div className="ps-pedestal-disk" />
        <div className="ps-pedestal-rim" />
        <div className="ps-card-shadow" />
        <div className="ps-pedestal-shimmer" />
      </div>
    </div>
  );
}
