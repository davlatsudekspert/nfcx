import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/**
 * Katalog — saytdagi mavjud Catalog funksiyasi (barcha band qilingan
 * profillar katalogi), BITTA ID sotib olish ekrani EMAS.
 *
 * Maketda ro'yxat elementlari mini NFC kartalar shaklida: qora fon,
 * ingichka gold chegara, chapda rasm, kartada nom + ID kod.
 * Filtrlar: All / Personal / Expert / Business.
 *
 * Endpoint tayyor: GET /api/companies (ochiq) va /api/records/search.
 */
export default function KatalogTab() {
  return (
    <PlaceholderScreen
      title="Katalog"
      note="Band qilingan profillar katalogi — mini NFC karta ko'rinishidagi ro'yxat, All / Personal / Expert / Business filtrlari bilan."
      planned={[
        'Mini NFC karta: rasm + nom + ID kod, ingichka gold chegara',
        'Filtrlar: Barchasi / Shaxsiy / Ekspert / Biznes',
        'Qidiruv va sahifalab yuklash',
      ]}
    />
  );
}
