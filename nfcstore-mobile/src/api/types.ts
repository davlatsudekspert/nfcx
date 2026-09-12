/**
 * Backend javob shakllari.
 *
 * Bu turlar TAXMIN emas — hosting/worker.js dan o'qib olingan:
 *   Company  -> rowCompany() + companyWithItems()  (worker.js:662, 719)
 *   Card     -> rowToRecord()                       (worker.js:2975)
 *   Post     -> GET /api/companies/:id/posts        (worker.js:1196)
 *   Story    -> listStoriesD1()                     (worker.js:1207)
 *   TapInfo  -> GET /api/tap/:chipToken             (worker.js:902)
 */

export type CompanyHours = {
  /** 0 = yakshanba … 6 = shanba (normalizeHoursD1) */
  day: number;
  open: string;
  close: string;
  closed: boolean;
};

export type CatalogItem = {
  /**
   * UUID SATR, son emas — server `crypto.randomUUID()` bilan yaratadi
   * (worker.js, catalog POST). PATCH/DELETE yo'llariga ham xuddi shu
   * satr qo'yiladi.
   */
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  promotionPrice: number | null;
  imageUrl: string;
  available: boolean;
  sortOrder: number;
};

export type CompanyPlan = {
  plan: 'free' | 'paid' | string;
  /** Bepul tarifda 5 — spetsifikatsiya 6-bo'lim. */
  productLimit?: number | null;
  productCount?: number;
  canAddProduct?: boolean;
  canPost?: boolean;
  trialActive?: boolean;
  trialExpiresAt?: string | null;
};

export type Company = {
  id: number;
  companyId: string;
  ownerUserId: string;
  ownerEmail: string;
  displayName: string;
  category: string;
  subcategory: string;
  city: string;
  address: string;
  description: string;
  phone: string;
  telegram: string;
  whatsapp: string;
  website: string;
  instagram: string;
  facebook: string;
  cardNumber: string;
  /** Profil fon musiqasi — 5 tagacha manzil. Bo'sh bo'lsa musiqa nishoni chizilmaydi. */
  music: string[];
  hours: CompanyHours[];
  /** SERVERDA Toshkent vaqti bo'yicha hisoblanadi — telefon vaqtiga tayanmaymiz. */
  openNow: boolean;
  ordersEnabled: boolean;
  plan: CompanyPlan;
  logoUrl: string;
  coverUrl: string;
  gallery: string[];
  tier: string;
  price: number;
  status: 'active' | 'pending_review' | 'rejected' | 'draft' | string;
  createdAt: string | null;
  catalog: CatalogItem[];
  /** companyWithItems() qo'shadigan maydonlar */
  views: number;
  followers: number;
  following: boolean;
};

export type ExtraLink = { label?: string; url?: string; title?: string; href?: string };

export type Card = {
  code: string;
  name: string;
  role: string;
  avatarUrl: string;
  companyId: string;
  city: string;
  address: string;
  profileType: 'personal' | 'expert' | 'business';
  phone: string;
  email: string;
  tg: string;
  instagram: string;
  facebook: string;
  twitter: string;
  linkedin: string;
  website: string;
  about: string;
  musicUrls: string[];
  extraLinks: ExtraLink[];
  /** Shaxsiy kartada BOR (kompaniyada yo'q — worker.js:2983). */
  verified: boolean;
  hidePhone: boolean;
  isPrimary: boolean;
  views: number;
  ts: number;
};

export type AuthMe = {
  user: {
    id: number;
    email: string;
    phone: string | null;
    isPremium: boolean;
    trialExpiresAt?: string | null;
    premiumExpiresAt?: string | null;
    tgLinked?: boolean;
  } | null;
  cards: Card[];
};

export type CompanyPost = {
  id: number;
  imageUrl: string;
  /** To'ldirilgan bo'lsa — bu Reels. Egasi tasdiqladi. */
  videoUrl: string;
  caption: string;
  createdAt: string;
};

export type CompanyStory = {
  id: number;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: string;
  /** Tashrifchi ko'rganmi — halqa rangini shu belgilaydi. */
  seen?: boolean;
  viewed?: boolean;
};

export type FollowResult = { following: boolean; followers: number };

export type TapInfo = { active: boolean; linkedCode: string | null };

/* ══ Katalog (ochiq direktoriya) ═════════════════════════════════════
   GET /api/records        -> catalogCard[] (YALANG'OCH massiv, {records} emas)
   GET /api/records/search -> { records: catalogCard[] }
   Ikkisi ham `catalogCard()` shaklini qaytaradi (worker.js).             */

export type CatalogRecord = {
  code: string;
  name: string;
  role: string;
  avatarUrl: string;
  tg: string;
  hashtags: string[];
  theme: string;
  price: number;
  ts: number;
  views: number;
  /** Filtrlar uchun: All / Personal / Expert / Business. */
  profileType: 'personal' | 'expert' | 'business';
  city: string;
  categorySlug: string;
  verified: boolean;
  tierOverride: string;
  /** Haqiqiy sovg'a yozuvidan (narxdan EMAS). */
  isGift: boolean;
  notForSale: boolean;
};

/** GET /api/companies -> ochiq, FAQAT faol kompaniyalar (maxfiy maydonlarsiz). */
export type PublicCompany = {
  companyId: string;
  displayName: string;
  logoUrl: string;
  coverUrl: string;
  category: string;
  subcategory: string;
  city: string;
  createdAt: string | null;
};

/* ══ Obuna statistikasi (shaxsiy kartalar) ═══════════════════════════
   Kompaniyada bitta toggle endpoint bor, shaxsiy kartada esa UCHTA
   alohida endpoint: stats / follow / unfollow.                        */

export type FollowStats = {
  followers: number;
  following: number;
  isFollowing: boolean;
};

/* ══ Home ekrani ════════════════════════════════════════════════════ */

/** GET /api/settings/physical-nfc-pricing */
export type PhysicalPricing = {
  tiers: { minQty: number; maxQty: number | null; pricePerUnit: number }[];
  delivery: { minDays: number; maxDays: number };
};

/** GET /api/gift-offers — kutilayotgan sovg'alar (ikki yo'nalish). */
export type GiftOffers = {
  incoming: { id: number; code: string; createdAt: string; fromEmail: string }[];
  outgoing: { id: number; code: string; createdAt: string; toEmail: string }[];
};

/** GET /api/settings/payments-enabled */
export type PaymentsSettings = {
  enabled: boolean;
  sandbox: boolean;
  providers?: Record<string, { enabled: boolean; sandbox?: boolean }>;
};

/* ══ Dashboard ══════════════════════════════════════════════════════ */

/** GET /api/companies/:id/stats?days=30 */
export type CompanyStats = {
  days: number;
  views: number;
  taps: number;
  orders: number;
  /** Har kun uchun bitta yozuv — bo'sh kunlar ham bor (grafik uzilmasin). */
  series: { day: string; views: number }[];
  /** Bosilgan amallar: telefon, telegram, manzil va h.k. */
  actions: { key: string; hits: number }[];
  /** Eng ko'p ochilgan 10 mahsulot. */
  items: { id: string; name: string; hits: number }[];
};

/** GET /api/companies/:id/orders */
export type CompanyOrder = {
  id: number;
  itemId: string;
  itemName: string;
  qty: number;
  price: number;
  name: string;
  phone: string;
  note: string;
  status: string;
  createdAt: string;
};
