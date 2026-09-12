import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/**
 * Home — bu bosqichda vaqtinchalik ekran. Maketda u tezkor amal
 * kartalari va tarif chizig'idan iborat, hamda Personal va Business
 * uchun boshqa-boshqa kartalar ko'rsatadi.
 */
export default function HomeTab() {
  return (
    <PlaceholderScreen
      title="Home"
      note="Tezkor amal kartalari va tarif chizig'i. Personal va Business uchun kartalar farq qiladi — maketdagidek."
      planned={[
        'ID holati va oylik teginishlar soni',
        "Jismoniy karta buyurtmasi — 200 000 so'm",
        'Mahsulot qo’shish / havolalarni tahrirlash',
        'ID ni sovg’a qilish — bepul, qabul qiluvchi tasdiqlaydi',
        "Tarif chizig'i: Bronze / Silver / Gold / Premium / Exclusive",
      ]}
    />
  );
}
