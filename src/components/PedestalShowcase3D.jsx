// Narxlar sahifasi — "luxury studio product showcase".
//
// MAVJUD <NfcCard/> (yozuv, ID, ism, "MEMBER SINCE", NFC belgisi, tipografiya
// — hammasi o'zgarishsiz) qalin, dumaloq qora granit podium ustida, old
// tomondan ko'rinib turadi. Karta hech qachon orqa tomonini ko'rsatmaydi —
// faqat juda sekin, nafis "showroom" tebranishi (±12° Y) + yengil suzish.
// Shu sabab "mirror text" umuman yuzaga kelmaydi va orqa yuz kerak emas.
//
// Orqada iliq oltin spotlight, kartadan podiumga tushadigan soya, podiumning
// o'z soyasi va chetidagi nozik oltin aks — 1-rasmdagi kompozitsiyaga
// iloji boricha yaqin. Faqat CSS transform/opacity (GPU-friendly).
// prefers-reduced-motion'da barcha harakat to'xtaydi (karta tik, old tomonda).
export default function PedestalShowcase3D({ children }) {
  return (
    <div className="ps-stage">
      <div className="ps-spotlight" aria-hidden />

      <div className="ps-scene">
        {/* KARTA — suzish (tashqi) + tebranish (ichki), old tomonga qaragan */}
        <div className="ps-card">
          <div className="ps-card-rot">{children}</div>
        </div>

        {/* Karta bilan podiumni bog'lovchi yumshoq oltin nur (orada bo'shliq) */}
        <div className="ps-underglow" aria-hidden />

        {/* PODIUM — statik, qalin CSS silindr: yon devor + tekis elliptik yuza */}
        <div className="ps-podium" aria-hidden>
          <div className="ps-podium-body" />
          <div className="ps-podium-top" />
          <div className="ps-podium-sheen" />
          {/* Kartadan podium yuzasiga tushadigan yumshoq soya */}
          <div className="ps-card-drop" />
        </div>

        {/* Podiumning yerga tushadigan soyasi */}
        <div className="ps-ground-shadow" aria-hidden />
      </div>
    </div>
  );
}
