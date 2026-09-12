import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/**
 * Company — ko'p kompaniyali boshqaruv ekrani.
 * Endpoint tayyor: GET /api/companies/mine, POST /api/companies.
 */
export default function CompanyTab() {
  return (
    <PlaceholderScreen
      title="Kompaniyalar"
      note="Bir nechta kompaniyani boshqarish va yangi Company ID ochish. Bepul tarifda 5 mahsulot, sotib olingan Company ID da cheklov yo'q."
      planned={[
        'Kompaniyalar ro’yxati: egasi / admin roli, mahsulot va obunachi soni',
        'Yangi Company ID ochish (bepul avtomatik ID yoki tanlangan nom)',
        'Dashboard: statistika, buyurtmalar, sozlamalar',
      ]}
    />
  );
}
