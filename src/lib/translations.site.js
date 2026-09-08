// DICT_SITE — kalit = o'zbekcha manba matn; { ru, en }.
// Ommaviy sahifalar (kompaniyalar, sovg'alar, xabarlar, auksion, narxlar,
// katalog) va umumiy holat matnlari (xato / bo'sh / qayta urinish).
export const DICT_SITE = {
  // ─────────────────────────── Umumiy holatlar ───────────────────────────
  "Server bilan aloqa yo'q": { ru: 'Нет связи с сервером', en: 'No connection to the server' },
  "Server bilan aloqa yo'q. Qayta urinish": { ru: 'Нет связи с сервером. Повторить', en: 'No connection to the server. Retry' },
  "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.": { ru: 'Слишком много попыток. Попробуйте чуть позже.', en: 'Too many attempts. Please try again in a moment.' },
  "Ma'lumotni yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.": { ru: 'Не удалось загрузить данные. Проверьте интернет и попробуйте снова.', en: 'Could not load the data. Check your connection and try again.' },

  // ─────────────────────────── Kompaniya tezkor profili (/c/ID) ───────────────────────────
  'Kompaniya topilmadi': { ru: 'Компания не найдена', en: 'Company not found' },
  'Company ID faol emas yoki admin tomonidan hali tasdiqlanmagan.': { ru: 'Company ID неактивен или ещё не подтверждён администратором.', en: 'This Company ID is inactive or has not been approved by an admin yet.' },
  'Kompaniyalarni ko‘rish': { ru: 'Смотреть компании', en: 'Browse companies' },
  'TASDIQLANGAN KOMPANIYA': { ru: 'ПОДТВЕРЖДЁННАЯ КОМПАНИЯ', en: 'VERIFIED COMPANY' },
  'Kompaniya haqida qisqa ma’lumot.': { ru: 'Краткая информация о компании.', en: 'A short description of the company.' },
  'Kompaniya saytini to‘liq ochish': { ru: 'Открыть полный сайт компании', en: 'Open the full company page' },
  'NFC orqali ochildi': { ru: 'Открыто через NFC', en: 'Opened via NFC' },
  'Kurslar': { ru: 'Курсы', en: 'Courses' },
  'Takliflar': { ru: 'Предложения', en: 'Offers' },
  'Menyuni ko‘rish': { ru: 'Смотреть меню', en: 'View menu' },
  'Mahsulotlarni ko‘rish': { ru: 'Смотреть товары', en: 'View products' },
  'Xizmatlarni ko‘rish': { ru: 'Смотреть услуги', en: 'View services' },
  'Kurslarni ko‘rish': { ru: 'Смотреть курсы', en: 'View courses' },
  'Takliflarni ko‘rish': { ru: 'Смотреть предложения', en: 'View offers' },

  // ─────────────────────────── Kompaniyalar katalogi ───────────────────────────
  'PREMIUM MENYU': { ru: 'ПРЕМИУМ МЕНЮ', en: 'PREMIUM MENU' },
  'Bugungi tavsiya': { ru: 'Рекомендация дня', en: "Today's pick" },
  'Chef tanlovi': { ru: 'Выбор шефа', en: "Chef's choice" },
  'Yangi, mazali va mehr bilan': { ru: 'Свежо, вкусно и с любовью', en: 'Fresh, tasty, made with care' },
  'PREMIUM KATALOG': { ru: 'ПРЕМИУМ КАТАЛОГ', en: 'PREMIUM CATALOG' },
  'Smartfon qidiring': { ru: 'Найти смартфон', en: 'Search smartphones' },
  "Qidiruv natijalarini yuklab bo'lmadi.": { ru: 'Не удалось загрузить результаты поиска.', en: 'Could not load search results.' },

  // ─────────────────────────── Kompaniya ochish ───────────────────────────
  'Qoralama': { ru: 'Черновик', en: 'Draft' },
  'Admin tekshiruvida': { ru: 'На проверке у админа', en: 'Under admin review' },
  'To‘lov kutilmoqda': { ru: 'Ожидается оплата', en: 'Awaiting payment' },
  'Rad etilgan': { ru: 'Отклонено', en: 'Rejected' },
  'Vaqtincha to‘xtatilgan': { ru: 'Временно приостановлено', en: 'Temporarily suspended' },
  'Restoran / kafe': { ru: 'Ресторан / кафе', en: 'Restaurant / cafe' },
  'Tibbiyot': { ru: 'Медицина', en: 'Medical' },
  'Dorixona': { ru: 'Аптека', en: 'Pharmacy' },
  'Ta’lim': { ru: 'Образование', en: 'Education' },
  'Kamida 3 ta harf kiriting': { ru: 'Введите минимум 3 буквы', en: 'Enter at least 3 letters' },
  'Faqat A–Z harflari mumkin': { ru: 'Допустимы только буквы A–Z', en: 'Only letters A–Z are allowed' },
  'Faqat 3–15 ta lotin harfi mumkin': { ru: 'Только 3–15 латинских букв', en: 'Only 3–15 Latin letters' },
  'Bu ID band': { ru: 'Этот ID занят', en: 'This ID is taken' },
  'Bu ID rezervlangan yoki sotuvda emas': { ru: 'Этот ID зарезервирован или не продаётся', en: 'This ID is reserved or not for sale' },

  // ─────────────────────────── Biznes namuna (demo) ───────────────────────────
  'Qurilish va arxitektura xizmatlari': { ru: 'Строительные и архитектурные услуги', en: 'Construction and architecture services' },
  'Chilonzor tumani, Bunyodkor ko‘chasi 12': { ru: 'Чиланзарский район, ул. Бунёдкор 12', en: '12 Bunyodkor St., Chilonzor district' },
  'Elite Qurilish — zamonaviy turar-joy va tijorat obyektlarini loyihalashdan kalit topshirishgacha olib boradigan qurilish kompaniyasi. Har bir loyihada aniq reja, sifatli material va ochiq muloqotga tayanamiz.': {
    ru: 'Elite Qurilish — строительная компания, которая ведёт современные жилые и коммерческие объекты от проектирования до сдачи под ключ. В каждом проекте мы опираемся на чёткий план, качественные материалы и открытое общение.',
    en: 'Elite Qurilish is a construction company that takes modern residential and commercial projects from design to turnkey delivery. Every project rests on a clear plan, quality materials and open communication.',
  },
  'Uy-joy qurilishi': { ru: 'Жилищное строительство', en: 'Residential construction' },
  'Kalit topshirishgacha to‘liq qurilish xizmati — loyiha, material va nazorat bir jamoada.': { ru: 'Полный цикл строительства под ключ — проект, материалы и контроль в одной команде.', en: 'Full turnkey construction — design, materials and supervision by one team.' },
  'Interyer va ta’mirlash': { ru: 'Интерьер и ремонт', en: 'Interior and renovation' },
  'Ta’mirlash ishlari': { ru: 'Ремонтные работы', en: 'Renovation works' },
  'Dizayn asosida sifatli ichki ta’mirlash va muhandislik tizimlari.': { ru: 'Качественный внутренний ремонт по дизайн-проекту и инженерные системы.', en: 'Quality interior renovation based on a design plan, plus engineering systems.' },
  'Interyer dizayni': { ru: 'Дизайн интерьера', en: 'Interior design' },
  'Funksional rejalashtirish, 3D konsepsiya va mualliflik nazorati.': { ru: 'Функциональное планирование, 3D-концепция и авторский надзор.', en: 'Functional planning, 3D concept and design supervision.' },
  'Arxitektura': { ru: 'Архитектура', en: 'Architecture' },
  'Loyihalash': { ru: 'Проектирование', en: 'Design and planning' },
  'Arxitektura, konstruksiya va muhandislik hujjatlari.': { ru: 'Архитектурная, конструктивная и инженерная документация.', en: 'Architectural, structural and engineering documentation.' },
  'Turar-joy loyihasi': { ru: 'Жилой проект', en: 'Residential project' },
  'Dizayn konsepsiyasi': { ru: 'Дизайн-концепция', en: 'Design concept' },
  'Tijorat arxitekturasi': { ru: 'Коммерческая архитектура', en: 'Commercial architecture' },

  // ─────────────────────────── Sovg'alar ───────────────────────────
  'Sovg‘a': { ru: 'Подарок', en: 'Gift' },
  'Sovg‘a qilindi': { ru: 'Подарено', en: 'Gifted' },
  'NFCSTORE yozuvli oltin bantli premium sovg‘a qutisi': { ru: 'Премиальная подарочная коробка с золотой лентой и надписью NFCSTORE', en: 'Premium gift box with a gold ribbon and the NFCSTORE mark' },
  "Sovg'alar ro'yxatini yuklab bo'lmadi.": { ru: 'Не удалось загрузить список подарков.', en: 'Could not load the gifts list.' },

  // ─────────────────────────── Xabarlar ───────────────────────────
  "O'qilgan": { ru: 'Прочитано', en: 'Read' },
  'Yuborildi': { ru: 'Отправлено', en: 'Sent' },
  'Rasm yuborish': { ru: 'Отправить изображение', en: 'Send an image' },
  "Xabarlarni yuklab bo'lmadi.": { ru: 'Не удалось загрузить сообщения.', en: 'Could not load messages.' },
  "Xabar yuborilmadi. Qayta urinib ko'ring.": { ru: 'Сообщение не отправлено. Попробуйте снова.', en: 'Message not sent. Please try again.' },
  "Suhbatlarni yuklab bo'lmadi.": { ru: 'Не удалось загрузить чаты.', en: 'Could not load conversations.' },

  // ─────────────────────────── Auksion ───────────────────────────
  'Auksion topilmadi': { ru: 'Аукцион не найден', en: 'Auction not found' },
  "Auksion ma'lumotini yuklab bo'lmadi.": { ru: 'Не удалось загрузить данные аукциона.', en: 'Could not load the auction.' },
  "Bu auksion mavjud emas yoki o'chirilgan.": { ru: 'Этот аукцион не существует или был удалён.', en: 'This auction does not exist or was removed.' },
};
