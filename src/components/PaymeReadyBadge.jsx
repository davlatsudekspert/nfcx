// Payme YOQILGAN holatidagi diqqatni tortuvchi belgi — katta, yaltiroq
// "Payme" logotipi, hech qanday "tez kunlarda" matni yo'q.
// PaymentUnavailableNotice.jsx'ning ijobiy (yoqilgan) hamkasbi — u
// to'lov o'chiq bo'lganda ko'rinsa, bu Payme yoqilgan joylarda ko'rinadi
// (masalan ReserveModal.jsx).
export default function PaymeReadyBadge({ className = '' }) {
  return (
    <span className={`payme-ready-badge ${className}`}>
      <span className="payme-ready-sweep" aria-hidden="true"></span>
      <span className="relative z-10">Payme</span>
    </span>
  );
}
