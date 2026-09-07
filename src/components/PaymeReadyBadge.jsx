import { usePaymentProviders } from '../lib/paymentsEnabled.jsx';

// To'lov tizimlari YOQILGAN holatidagi diqqatni tortuvchi belgi — katta,
// yaltiroq firma so'z belgisi, hech qanday "tez kunlarda" matni yo'q.
// PaymentUnavailableNotice.jsx'ning ijobiy (yoqilgan) hamkasbi.
//
// 2026-09: endi FAQAT Payme emas — haqiqatan yoqilgan tizimlarning
// hammasi ko'rsatiladi. Faqat Payme yoqilgan bo'lsa faqat Payme,
// ikkalasi yoqilsa ikkalasi chiqadi. Yoqilmagani bu yerda umuman
// ko'rinmaydi (uning o'rni — PaymentUnavailableNotice).
const BRANDS = [
  { id: 'payme', label: 'Payme' },
  { id: 'click', label: 'Click' },
];

export default function PaymeReadyBadge({ className = '' }) {
  const providers = usePaymentProviders();
  const ready = BRANDS.filter((b) => providers[b.id]?.enabled);
  // Holat hali kelmagan bo'lsa ham bo'sh joy qoldirmaymiz — avvalgidek
  // Payme ko'rsatiladi (bu komponent faqat to'lov yoqilgan tarmoqda
  // render qilinadi).
  const list = ready.length ? ready : [BRANDS[0]];

  return (
    <span className={`inline-flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {list.map((b) => (
        <span
          key={b.id}
          className={`payme-ready-badge${b.id === 'click' ? ' payme-ready-badge--click' : ''}`}
        >
          <span className="payme-ready-sweep" aria-hidden="true"></span>
          <span className="relative z-10">{b.label}</span>
        </span>
      ))}
    </span>
  );
}
