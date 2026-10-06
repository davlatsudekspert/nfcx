// NAMUNA BIZNESLARNING SOHASI — RU/EN TARJIMASI (sayt auditi, 2026-10).
//
// Namuna bizneslar (hosting/api/demo-businesses.js) bazada o'zbekcha
// `subcategory` bilan yozilgan: "Milliy taomlar", "Go‘zallik saloni" ...
// Rus/ingliz tilidagi tashrifchi ham shu o'zbekcha matnni ko'rardi.
// Bazadagi ma'lumot O'ZGARTIRILMAYDI — tarjima shu yerda, ko'rsatishda
// qilinadi. Kalit — o'zbekcha nom (apostrof turlari bir xillashtiriladi),
// shuning uchun xuddi shu sohani yozgan haqiqiy kompaniya ham tarjima
// qilinadi; ro'yxatda yo'q nom o'zgarishsiz qoladi.
const LABELS = {
  'milliy taomlar': { ru: 'Национальная кухня', en: 'National cuisine' },
  qahvaxona: { ru: 'Кофейня', en: 'Coffee shop' },
  'kiyim-kechak': { ru: 'Одежда', en: 'Clothing' },
  'elektronika va maishiy texnika': { ru: 'Электроника и бытовая техника', en: 'Electronics & home appliances' },
  'oziq-ovqat': { ru: 'Продукты', en: 'Groceries' },
  sartaroshxona: { ru: 'Барбершоп', en: 'Barbershop' },
  "go'zallik saloni": { ru: 'Салон красоты', en: 'Beauty salon' },
  avtoservis: { ru: 'Автосервис', en: 'Car service' },
  "ta'mir va qurilish": { ru: 'Ремонт и строительство', en: 'Renovation & construction' },
  stomatologiya: { ru: 'Стоматология', en: 'Dentistry' },
  dorixona: { ru: 'Аптека', en: 'Pharmacy' },
  "o'quv markazi": { ru: 'Учебный центр', en: 'Training centre' },
};

function norm(label) {
  return String(label || '').trim().toLowerCase().replace(/[‘’ʻʼ`´]/g, "'");
}

export function subcategoryLabel(label, lang = 'uz') {
  if (!label || lang === 'uz') return label || '';
  const hit = LABELS[norm(label)];
  return (hit && hit[lang]) || label;
}
