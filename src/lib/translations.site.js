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

  // ─────────────────────────── Media oynachasi (MediaThumb) ───────────────────────────
  // Rasm/video ko'rsatiladigan HAR joyda chiqadi: lenta, postlar.
  // Ular ekrandagi yagona izoh bo'lgani uchun tarjimasi shart —
  // aks holda rus va ingliz tilidagi tashrifchi o'zbekcha ogohlantirish
  // ko'rardi.
  'Media ochilmadi': { ru: 'Медиа не открылось', en: 'Media could not load' },
  'Media javob bermadi': { ru: 'Медиа не отвечает', en: 'Media did not respond' },
  'Bu postda matn ham, media ham yo‘q.': { ru: 'В этом посте нет ни текста, ни медиа.', en: 'This post has no text and no media.' },

  // ─────────────────────────── Profil ⋮ menyusi ───────────────────────────
  'Rang mavzusi': { ru: 'Цветовая тема', en: 'Colour theme' },
  'Til': { ru: 'Язык', en: 'Language' },

  // NFC tegish — yo'naltirish paytidagi qisqa kutish.
  'Ochilmoqda…': { ru: 'Открывается…', en: 'Opening…' },

  // Marketplace aktivatsiyasi — stikerni tegizish talabi.
  'Stikeringiz shu profilga bog‘landi. Telefonga tekkizib ko‘ring.': { ru: 'Ваш стикер привязан к этому профилю. Приложите его к телефону.', en: 'Your sticker is linked to this profile. Tap it with your phone.' },
  'ENDI KONVERTDAGI NFC STIKERNI TELEFONGA TEKKIZING — shunda u shu profilga bog‘lanadi va bundan keyin har tegizganda profilingiz ochiladi.': { ru: 'ТЕПЕРЬ ПРИЛОЖИТЕ NFC-СТИКЕР ИЗ КОНВЕРТА К ТЕЛЕФОНУ — он привяжется к этому профилю, и дальше при каждом касании будет открываться ваш профиль.', en: 'NOW TAP THE NFC STICKER FROM THE ENVELOPE WITH YOUR PHONE — it links to this profile, and from then on every tap opens your profile.' },

  'NFC stiker ulandi': { ru: 'NFC-стикер подключён', en: 'NFC sticker connected' },
  'Bundan keyin stikerni telefonga tekkizsangiz shu profil ochiladi.': { ru: 'Теперь при касании стикера телефоном будет открываться этот профиль.', en: 'From now on, tapping the sticker with your phone opens this profile.' },

  // Stiker tekkizildi, lekin odam boshqa brauzerda kirmagan.
  'Stikeringizni bog‘lash': { ru: 'Привязать ваш стикер', en: 'Link your sticker' },
  'Hisobingizga kiring — stiker o‘zi bog‘lanadi. Kodni qayta kiritish shart emas.': { ru: 'Войдите в аккаунт — стикер привяжется сам. Код вводить заново не нужно.', en: 'Sign in and the sticker links itself. You do not need to enter the code again.' },
  'Menda aktivatsiya kodi bor': { ru: 'У меня есть код активации', en: 'I have an activation code' },

  // Stiker bog'lanmagani — sababi.
  'Stikeringizni bog‘lash uchun avval kiring.': { ru: 'Чтобы привязать стикер, сначала войдите.', en: 'Sign in first to link your sticker.' },
  'Bu stiker allaqachon boshqa profilga bog‘langan.': { ru: 'Этот стикер уже привязан к другому профилю.', en: 'This sticker is already linked to another profile.' },
  'Stiker hali bog‘lanmagan. Konvertdagi kodni kiriting — shundan keyin u shu profilga bog‘lanadi.': { ru: 'Стикер пока не привязан. Введите код из конверта — после этого он привяжется к этому профилю.', en: 'The sticker is not linked yet. Enter the code from the envelope and it will link to this profile.' },

  // Aktivatsiya: oxirgi qadam — hisob ochish.
  'Oxirgi qadam — hisob oching. Kod va tanlovingiz saqlanib qoladi.': { ru: 'Последний шаг — создайте аккаунт. Код и ваш выбор сохранятся.', en: 'Last step — create an account. Your code and choice are kept.' },
  'Hisobim bor — kirish': { ru: 'У меня есть аккаунт — войти', en: 'I have an account — sign in' },
  // ─────────────────────────── Izohlar (post ostida) ───────────────────────────
  //
  // Izoh tizimi backend'da allaqachon bor edi, lekin uni faqat ilova
  // chaqirardi: telefonda yozilgan izoh saytda umuman ko'rinmasdi.
  'Izohlar': { ru: 'Комментарии', en: 'Comments' },
  'Izoh yozish': { ru: 'Написать комментарий', en: 'Write a comment' },
  'Izohingiz…': { ru: 'Ваш комментарий…', en: 'Your comment…' },
  'Hali izoh yo‘q.': { ru: 'Пока нет комментариев.', en: 'No comments yet.' },
  'Izohlar yuklanmadi.': { ru: 'Не удалось загрузить комментарии.', en: 'Could not load the comments.' },
  'Izoh yuborilmadi.': { ru: 'Комментарий не отправлен.', en: 'The comment was not sent.' },
  'Izoh o‘chirilmadi.': { ru: 'Комментарий не удалён.', en: 'The comment was not deleted.' },
  'Izoh o‘chirilsinmi?': { ru: 'Удалить комментарий?', en: 'Delete the comment?' },
  'Izoh bo‘sh.': { ru: 'Комментарий пустой.', en: 'The comment is empty.' },
  'Izoh yozish uchun tizimga kiring.': { ru: 'Войдите, чтобы написать комментарий.', en: 'Sign in to write a comment.' },
  'Izoh yozish Premium a’zolar uchun.': { ru: 'Комментарии доступны Premium-участникам.', en: 'Commenting is for Premium members.' },
  'Hisobingiz vaqtincha bloklangan.': { ru: 'Ваш аккаунт временно заблокирован.', en: 'Your account is temporarily blocked.' },
  'Juda tez yozyapsiz. Biroz kuting.': { ru: 'Вы пишете слишком быстро. Подождите немного.', en: 'You are writing too fast. Please wait a moment.' },
  'Avval tizimga kiring.': { ru: 'Сначала войдите в систему.', en: 'Please sign in first.' },
  'Yuklanmoqda…': { ru: 'Загрузка…', en: 'Loading…' },
  // ─────────────────────────── Android ilovasi (/ilova-yuklash, profil kartasi) ───────────────────────────
  'Android ilovasi': { ru: 'Android-приложение', en: 'Android app' },
  'NFCSTORE ilovasini': { ru: 'Скачайте приложение', en: 'Get the NFCSTORE' },
  'yuklab oling': { ru: 'NFCSTORE', en: 'app' },
  "Ilova tez orada Google Play'da chiqadi. Hozircha uni shu yerdan o'rnating — keyin Play Market orqali yangilanadi.": {
    ru: 'Скоро приложение появится в Google Play. Пока установите его отсюда — потом оно будет обновляться через Play Маркет.',
    en: 'The app is coming to Google Play soon. For now, install it from here — later it will update through the Play Store.' },
  "Hozircha ilova faqat Android uchun. iPhone versiyasi tez orada — shu vaqtgacha profilingiz saytda to'liq ishlaydi.": {
    ru: 'Пока приложение только для Android. Версия для iPhone скоро — а до тех пор ваш профиль полностью работает на сайте.',
    en: 'For now the app is Android only. The iPhone version is coming soon — until then your profile works fully on the website.' },
  'Yuklab olish (Android)': { ru: 'Скачать (Android)', en: 'Download (Android)' },
  'Beta versiya · ~65 MB': { ru: 'Бета-версия · ~65 МБ', en: 'Beta version · ~65 MB' },
  'Raqamli vizitkangiz doim telefoningizda': { ru: 'Цифровая визитка всегда в телефоне', en: 'Your digital business card always on your phone' },
  'NFC karta va stikerlarga profil yozish': { ru: 'Запись профиля на NFC-карты и стикеры', en: 'Write your profile to NFC cards and stickers' },
  'Lenta, Reels va istoriyalar': { ru: 'Лента, Reels и истории', en: 'Feed, Reels and stories' },
  'Biznes sahifasi va katalog': { ru: 'Бизнес-страница и каталог', en: 'Business page and catalog' },
  "Qanday o'rnatiladi": { ru: 'Как установить', en: 'How to install' },
  "«Yuklab olish» tugmasini bosing — fayl telefoningizga tushadi.": {
    ru: 'Нажмите «Скачать» — файл загрузится на телефон.', en: 'Tap “Download” — the file is saved to your phone.' },
  "Faylni oching. Telefon so'rasa, brauzerga «noma'lum manbalardan o'rnatish»ga ruxsat bering.": {
    ru: 'Откройте файл. Если телефон спросит, разрешите браузеру «установку из неизвестных источников».',
    en: 'Open the file. If your phone asks, allow the browser to “install unknown apps”.' },
  "«O'rnatish» tugmasini bosing. Play Protect ogohlantirsa — «Baribir o'rnatish»ni tanlang.": {
    ru: 'Нажмите «Установить». Если Play Защита предупредит — выберите «Всё равно установить».',
    en: 'Tap “Install”. If Play Protect warns you, choose “Install anyway”.' },
  'Ilovani oching va NFCSTORE hisobingiz bilan kiring.': {
    ru: 'Откройте приложение и войдите в свой аккаунт NFCSTORE.', en: 'Open the app and sign in with your NFCSTORE account.' },
  "Fayl Google Play imzosi bilan — ilova Play Market'ga chiqqach, uni o'chirmasdan Play orqali yangilaysiz. Muammo bo'lsa: @nfcstore_admin": {
    ru: 'Файл подписан Google Play — когда приложение выйдет в Play Маркет, вы обновите его через Play без удаления. Если что-то не так: @nfcstore_admin',
    en: 'The file carries the Google Play signature — once the app is in the Play Store you can update it there without reinstalling. Problems? @nfcstore_admin' },
  'NFCSTORE ilovasi': { ru: 'Приложение NFCSTORE', en: 'NFCSTORE app' },
  "O'z raqamli vizitkangizni yarating — Android uchun": {
    ru: 'Создайте свою цифровую визитку — для Android', en: 'Create your own digital business card — for Android' },
};
