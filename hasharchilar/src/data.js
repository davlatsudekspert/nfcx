// Namuna ma'lumotlar (Toshkent). Keyinchalik API bilan almashtiriladi.
export const INITIAL_HASHARS = [
  {
    id: 1,
    title: "Mahalla bog'ini tozalash",
    address: "Chilonzor, 9-kvartal, Bunyodkor ko'chasi",
    date: '2026-10-11',
    time: '09:00',
    needs: ['Qo‘lqop', 'Axlat qoplari', 'Belkurak'],
    status: 'pending',
    people: 14,
    lat: 41.2756,
    lng: 69.2043,
  },
  {
    id: 2,
    title: "Ko'cha bo'yiga 50 ta ko'chat ekish",
    address: "Yunusobod, 4-mavze, Amir Temur shoh ko'chasi",
    date: '2026-10-12',
    time: '08:30',
    needs: ['Ko‘chat', 'Cho‘pon', 'Suv'],
    status: 'pending',
    people: 27,
    lat: 41.3646,
    lng: 69.2878,
  },
  {
    id: 3,
    title: "Bolalar maydonchasini bo'yash",
    address: "Mirzo Ulug'bek, Qorasaroy mahallasi",
    date: '2026-10-18',
    time: '10:00',
    needs: ['Bo‘yoq', 'Cho‘tka', 'Qo‘lqop'],
    status: 'pending',
    people: 9,
    lat: 41.3392,
    lng: 69.3341,
  },
  {
    id: 4,
    title: "Ariq va kanallarni tozalash",
    address: "Sergeli, Yangi Sergeli mahallasi",
    date: '2026-09-27',
    time: '08:00',
    needs: ['Belkurak', 'Etik'],
    status: 'completed',
    people: 32,
    lat: 41.2273,
    lng: 69.2189,
  },
];

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

export const formatDate = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}-${MONTHS[m - 1]}`;
};
