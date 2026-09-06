import { useMemo } from 'react';
import BusinessPublicProfile from '../components/BusinessPublicProfile.jsx';
import { useLanguage } from '../lib/i18n.jsx';

// Namuna (demo) ma'lumotlari — matnlar t() orqali tarjima qilinadi, tuzilma
// va data-flow o'zgarmaydi (BusinessPublicProfile bir xil record oladi).
const record = {
  code: 'ELITE',
  name: 'ELITE QURILISH',
  role: 'Qurilish va arxitektura xizmatlari',
  profileType: 'business',
  categorySlug: 'construction',
  city: 'Toshkent',
  address: 'Chilonzor tumani, Bunyodkor ko‘chasi 12',
  latitude: 41.2825,
  longitude: 69.2121,
  phone: '+998 90 123 45 67',
  tg: '@elite_qurilish',
  email: 'info@elite-qurilish.uz',
  website: 'elite-qurilish.uz',
  about: 'Elite Qurilish — zamonaviy turar-joy va tijorat obyektlarini loyihalashdan kalit topshirishgacha olib boradigan qurilish kompaniyasi. Har bir loyihada aniq reja, sifatli material va ochiq muloqotga tayanamiz.',
  avatarUrl: '/logo-192.png',
  bgUrl: '/business-assets/construction-hero.jpg',
  verified: true,
  views: 1284,
  demo: true,
};

const services = [
  {
    id: 'construction',
    name: 'Qurilish',
    items: [
      { id: 1, name: 'Uy-joy qurilishi', description: 'Kalit topshirishgacha to‘liq qurilish xizmati — loyiha, material va nazorat bir jamoada.', price: 1500000, priceType: 'from', imageUrl: '/business-assets/construction-home.jpg', available: true },
    ],
  },
  {
    id: 'interior',
    name: 'Interyer va ta’mirlash',
    items: [
      { id: 2, name: 'Ta’mirlash ishlari', description: 'Dizayn asosida sifatli ichki ta’mirlash va muhandislik tizimlari.', price: 150000, priceType: 'from', imageUrl: '/business-assets/construction-interior.jpg', available: true },
      { id: 3, name: 'Interyer dizayni', description: 'Funksional rejalashtirish, 3D konsepsiya va mualliflik nazorati.', price: null, priceType: 'negotiable', imageUrl: '/business-assets/construction-design.jpg', available: true },
    ],
  },
  {
    id: 'architecture',
    name: 'Arxitektura',
    items: [
      { id: 4, name: 'Loyihalash', description: 'Arxitektura, konstruksiya va muhandislik hujjatlari.', price: 100000, priceType: 'from', imageUrl: '/business-assets/construction-hero.jpg', available: true },
    ],
  },
];

const gallery = [
  { id: 1, imageUrl: '/business-assets/construction-home.jpg', caption: 'Turar-joy loyihasi' },
  { id: 2, imageUrl: '/business-assets/construction-interior.jpg', caption: 'Interyer va ta’mirlash' },
  { id: 3, imageUrl: '/business-assets/construction-design.jpg', caption: 'Dizayn konsepsiyasi' },
  { id: 4, imageUrl: '/business-assets/construction-hero.jpg', caption: 'Tijorat arxitekturasi' },
];

// Demo matnlarini joriy tilga o'giradi (foydalanuvchi kontenti emas — namuna).
function localize(t) {
  const rec = { ...record, role: t(record.role), about: t(record.about), address: t(record.address), city: t(record.city) };
  const svc = services.map((group) => ({
    ...group,
    name: t(group.name),
    items: group.items.map((item) => ({ ...item, name: t(item.name), description: t(item.description) })),
  }));
  const gal = gallery.map((g) => ({ ...g, caption: t(g.caption) }));
  return { rec, svc, gal };
}

export default function BusinessPublicDemoPage() {
  const { t, lang } = useLanguage();
  const { rec, svc, gal } = useMemo(() => localize(t), [t, lang]);
  return <BusinessPublicProfile record={rec} services={svc} gallery={gal} t={t} />;
}
