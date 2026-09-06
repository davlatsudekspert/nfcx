// DICT_ACCOUNT — kalit = o'zbekcha manba matn; { ru, en }.
// Kabinet (AccountPage), Auth, Sozlamalar, Bildirishnomalar, To'lovlar,
// Business Workspace va src/lib/db.js xato matnlari uchun tarjimalar.
export const DICT_ACCOUNT = {
  // ───────────── Auth: kirish / ro'yxat / parolni tiklash ─────────────
  "Bu akkaunt o'chirilgan. Yangi akkaunt ochishingiz mumkin.": { ru: 'Этот аккаунт удалён. Вы можете создать новый.', en: 'This account has been deleted. You can create a new one.' },
  "Akkauntingiz vaqtincha to'xtatilgan. Admin bilan bog'laning.": { ru: 'Ваш аккаунт временно приостановлен. Свяжитесь с администратором.', en: 'Your account is temporarily suspended. Contact the administrator.' },
  "Server bilan aloqa yo'q. Qayta urinib ko'ring.": { ru: 'Нет связи с сервером. Попробуйте ещё раз.', en: 'No connection to the server. Please try again.' },
  'Email manzilingizni kiriting.': { ru: 'Введите ваш email.', en: 'Enter your email address.' },
  "Agar bu email ro'yxatda bo'lsa va telefoningiz botga ulangan bo'lsa, kod Telegram'ga yuborildi.": { ru: 'Если этот email зарегистрирован и телефон привязан к боту, код отправлен в Telegram.', en: 'If this email is registered and your phone is linked to the bot, a code has been sent to Telegram.' },
  '6 xonali kodni kiriting.': { ru: 'Введите 6-значный код.', en: 'Enter the 6-digit code.' },
  'Parol yangilandi. Endi yangi parol bilan kiring.': { ru: 'Пароль обновлён. Войдите с новым паролем.', en: 'Password updated. Sign in with your new password.' },
  'Parolni tiklash': { ru: 'Восстановление пароля', en: 'Reset password' },
  'Email manzilingizni kiriting — tasdiqlash kodi akkauntingizga ulangan Telegram botga yuboriladi.': { ru: 'Введите email — код подтверждения придёт в Telegram-бот, привязанный к аккаунту.', en: 'Enter your email — a confirmation code will be sent to the Telegram bot linked to your account.' },
  "Telegram'ga kelgan 6 xonali kodni va yangi parolni kiriting.": { ru: 'Введите 6-значный код из Telegram и новый пароль.', en: 'Enter the 6-digit code from Telegram and a new password.' },
  'Yangi parol': { ru: 'Новый пароль', en: 'New password' },
  'Parolni yangilash': { ru: 'Обновить пароль', en: 'Update password' },
  'Kod kelmadimi? Telefoningiz botga ulanganini tekshiring:': { ru: 'Код не пришёл? Проверьте, что телефон привязан к боту:', en: "Didn't get the code? Check that your phone is linked to the bot:" },
  'Kirish sahifasiga qaytish': { ru: 'Вернуться ко входу', en: 'Back to sign in' },
  'Odam, mutaxassis': { ru: 'Человек, специалист', en: 'Person, professional' },
  'Biznes, do‘kon, restoran': { ru: 'Бизнес, магазин, ресторан', en: 'Business, shop, restaurant' },
  "Ro'yxatdan o'tgach, kompaniya uchun alohida Company ID ochish sahifasiga o'tasiz.": { ru: 'После регистрации вы перейдёте на страницу создания отдельного Company ID.', en: 'After signing up you will go to the page for opening a separate Company ID.' },
  "Ro'yxatdan o'tgach, bepul shaxsiy NFC ID bilan kabinetga kirasiz.": { ru: 'После регистрации вы попадёте в кабинет с бесплатным личным NFC ID.', en: 'After signing up you will enter the cabinet with a free personal NFC ID.' },
  'Parolni unutdingizmi?': { ru: 'Забыли пароль?', en: 'Forgot password?' },

  // ───────────── Kabinet: Premium / tarif ─────────────
  "Hozircha sovg'a takliflari yo'q.": { ru: 'Пока нет предложений подарков.', en: 'No gift offers yet.' },
  "Premium a'zo": { ru: 'Premium-участник', en: 'Premium member' },
  'Barcha premium imkoniyatlar faol. Amal qilish muddati cheklanmagan.': { ru: 'Все premium-возможности активны. Срок действия не ограничен.', en: 'All premium features are active. No expiry.' },
  "Daraja = NFC ID tarifi yoki Profile Premium (qaysi biri yuqori bo'lsa). Premium — bir martalik to'lov, muddatsiz.": { ru: 'Уровень = тариф NFC ID или Profile Premium (что выше). Premium — разовый платёж, бессрочно.', en: 'Level = NFC ID tier or Profile Premium (whichever is higher). Premium is a one-time payment, no expiry.' },
  'Sizga ochiq': { ru: 'Вам доступно', en: 'Available to you' },
  'Bepul tarifda faqat asosiy profil.': { ru: 'На бесплатном тарифе — только базовый профиль.', en: 'The free tier includes the basic profile only.' },
  'Premium ochadi': { ru: 'Premium откроет', en: 'Premium unlocks' },
  'NFC ID tarifingiz allaqachon Premium darajasida.': { ru: 'Тариф вашего NFC ID уже на уровне Premium.', en: 'Your NFC ID tier is already at the Premium level.' },
  "Narxi: {n} so'm (bir martalik). To'lov Payme orqali.": { ru: 'Цена: {n} сум (разово). Оплата через Payme.', en: 'Price: {n} UZS (one-time). Payment via Payme.' },
  'Animatsiyali fon': { ru: 'Анимированный фон', en: 'Animated background' },
  'Premium temalar': { ru: 'Premium-темы', en: 'Premium themes' },
  'Shisha (glass) kontent': { ru: 'Стеклянный (glass) контент', en: 'Glass content' },
  'Fayl / PDF katalog': { ru: 'Файлы / PDF-каталог', en: 'Files / PDF catalog' },
  'Tarif / Premium': { ru: 'Тариф / Premium', en: 'Plan / Premium' },
  "Sovg'a va buyurtmalar": { ru: 'Подарки и заказы', en: 'Gifts & orders' },

  // ───────────── Kabinet: profil formasi bo'limlari ─────────────
  '{n} layk': { ru: '{n} лайк(ов)', en: '{n} likes' },
  'Profil turi va soha': { ru: 'Тип профиля и сфера', en: 'Profile type & industry' },
  'Ism, kasb va bio': { ru: 'Имя, профессия и био', en: 'Name, title and bio' },
  'Telegram, telefon, email': { ru: 'Telegram, телефон, email', en: 'Telegram, phone, email' },
  'Ijtimoiy tarmoqlar': { ru: 'Соцсети', en: 'Social networks' },
  'Instagram, Facebook, X, LinkedIn, veb-sayt, havolalar, hashtaglar': { ru: 'Instagram, Facebook, X, LinkedIn, сайт, ссылки, хэштеги', en: 'Instagram, Facebook, X, LinkedIn, website, links, hashtags' },
  'Media (rasm/fon/musiqa)': { ru: 'Медиа (фото/фон/музыка)', en: 'Media (photo/background/music)' },
  'Profil rasmi, fon rasmi va musiqa': { ru: 'Фото профиля, фон и музыка', en: 'Profile photo, background and music' },
  'Fayl': { ru: 'Файл', en: 'File' },
  "+ Qo'shiq qo'shish": { ru: '+ Добавить трек', en: '+ Add track' },
  "Ko'pi bilan 5 ta qo'shiq. YouTube yoki Yandex Music havolasini qo'ysangiz — fayl yuklamasdan, iPhone'da ham ishlaydi. Yoki to'g'ridan-to'g'ri .mp3 havolasi / fayl. Profilingizga kirgan odam pastdagi tugma orqali yoqib-o'chiradi va qo'shiqlar orasida almashtiradi.": { ru: 'До 5 треков. Ссылка на YouTube или Яндекс Музыку работает без загрузки файла, в том числе на iPhone. Либо прямая ссылка на .mp3 / файл. Посетитель включает и переключает треки кнопкой внизу профиля.', en: 'Up to 5 tracks. A YouTube or Yandex Music link works without uploading a file, iPhone included. Or a direct .mp3 link / file. Visitors play and switch tracks with the button at the bottom of the profile.' },
  "Ko'rinish": { ru: 'Внешний вид', en: 'Appearance' },
  'Tema, ranglar va havola tugmalari uslubi': { ru: 'Тема, цвета и стиль кнопок-ссылок', en: 'Theme, colors and link button style' },
  "Mening ID'larim": { ru: 'Мои ID', en: 'My IDs' },
  'Postlar / Media': { ru: 'Посты / Медиа', en: 'Posts / Media' },
  'Jami imkoniyatlar ochiq': { ru: 'Все возможности открыты', en: 'All features unlocked' },
  "Premium'ga o'tish mumkin": { ru: 'Можно перейти на Premium', en: 'Upgrade to Premium available' },
  'Katalogda yashirin': { ru: 'Скрыт в каталоге', en: 'Hidden from directory' },
  'Public profil ochiq': { ru: 'Публичный профиль открыт', en: 'Public profile is live' },
  'Public URL': { ru: 'Публичный URL', en: 'Public URL' },
  'Primary ID': { ru: 'Основной ID', en: 'Primary ID' },
  'Asosiy NFC karta': { ru: 'Основная NFC-карта', en: 'Primary NFC card' },
  'Hozircha asosiy emas': { ru: 'Пока не основной', en: 'Not primary yet' },
  "Profil {p}% to'ldirilgan": { ru: 'Профиль заполнен на {p}%', en: 'Profile {p}% complete' },
  "To'ldirish": { ru: 'Заполнить', en: 'Complete' },
  "Profilni ko'rish": { ru: 'Открыть профиль', en: 'View profile' },
  "Narx, ko'rishlar, dizayn va buyurtma": { ru: 'Цена, просмотры, дизайн и заказ', en: 'Price, views, design and order' },
  "Barcha raqamli tashrif qog'ozlaringiz": { ru: 'Все ваши цифровые визитки', en: 'All your digital business cards' },
  'Sizda hozircha faqat shu bitta ID bor.': { ru: 'Пока у вас только этот ID.', en: 'You only have this one ID so far.' },
  'Yangi ID band qilish': { ru: 'Забронировать новый ID', en: 'Reserve a new ID' },
  'Joriy': { ru: 'Текущий', en: 'Current' },
  'Boshqarish': { ru: 'Управлять', en: 'Manage' },
  'Rasm va izohlarni joylashtiring': { ru: 'Публикуйте фото и подписи', en: 'Post photos and captions' },
  "Saqlanmagan o'zgarishlar bor": { ru: 'Есть несохранённые изменения', en: 'You have unsaved changes' },
  "Barcha o'zgarishlar saqlangan": { ru: 'Все изменения сохранены', en: 'All changes saved' },
  'Hali hech kim taklif qilinmagan.': { ru: 'Пока никто не приглашён.', en: 'No one invited yet.' },
  "Ochiq buyurtmalar yo'q.": { ru: 'Открытых заказов нет.', en: 'No open orders.' },
  'ASOSIY ID': { ru: 'ОСНОВНОЙ ID', en: 'PRIMARY ID' },
  "{n} ta raqamli tashrif qog'ozi": { ru: 'Цифровых визиток: {n}', en: '{n} digital business cards' },
  'Eski biznes profil': { ru: 'Старый бизнес-профиль', en: 'Legacy business profile' },
  "Boshqa ID'ga o'tish:": { ru: 'Перейти к другому ID:', en: 'Switch to another ID:' },

  // ───────────── To'lovlar / Business Workspace ─────────────
  'Sinov (sandbox)': { ru: 'Тест (sandbox)', en: 'Test (sandbox)' },
  "Kutilayotgan to'lovlarni yuklab bo'lmadi.": { ru: 'Не удалось загрузить ожидающие платежи.', en: 'Could not load pending payments.' },
  "Tranzaksiya tarixini yuklab bo'lmadi.": { ru: 'Не удалось загрузить историю транзакций.', en: 'Could not load transaction history.' },
  'Yangi Company System': { ru: 'Новая Company System', en: 'New Company System' },

  // ───────────── src/lib/db.js xato matnlari (t() orqali) ─────────────
  "Payme orqali to'lov imkoniyati tez kunlarda ishga tushadi.": { ru: 'Оплата через Payme скоро станет доступна.', en: 'Payment via Payme will be available soon.' },
  'Bu imkoniyat hozirgi tarifingizda yopiq.': { ru: 'Эта функция недоступна на вашем тарифе.', en: 'This feature is locked on your current plan.' },
  "Bu amal uchun ruxsatingiz yo'q.": { ru: 'У вас нет прав на это действие.', en: 'You are not allowed to do this.' },
  'Xabar matnini kiriting.': { ru: 'Введите текст сообщения.', en: 'Enter the message text.' },
  'Bu NFC ID sizga tegishli emas.': { ru: 'Этот NFC ID вам не принадлежит.', en: 'This NFC ID does not belong to you.' },
  'Jismoniy karta dizayni hozirgi tarifingizda yopiq (Silver va undan yuqori).': { ru: 'Дизайн физической карты недоступен на вашем тарифе (Silver и выше).', en: 'Physical card design is locked on your plan (Silver and above).' },
  "Email formati noto'g'ri.": { ru: 'Неверный формат email.', en: 'Invalid email format.' },
  "Kod noto'g'ri yoki muddati o'tgan. Qaytadan so'rang.": { ru: 'Код неверный или истёк. Запросите новый.', en: 'The code is wrong or expired. Request a new one.' },

  // ─── Yagona Payme to'lov bloki (src/components/PaymeBlock.jsx, 2026-09) ───
  "To'lov summasi": { ru: 'Сумма оплаты', en: 'Payment amount' },
  "Payme orqali to'lash": { ru: 'Оплатить через Payme', en: 'Pay with Payme' },
  "Buyurtma berish va to'lash": { ru: 'Оформить заказ и оплатить', en: 'Place the order and pay' },
  "To'lovga o'tish": { ru: 'Перейти к оплате', en: 'Go to payment' },
  'Vaqtincha mavjud emas': { ru: 'Временно недоступно', en: 'Temporarily unavailable' },
  'PAYME SANDBOX \u00b7 TEST REJIMI': { ru: 'PAYME SANDBOX \u00b7 ТЕСТОВЫЙ РЕЖИМ', en: 'PAYME SANDBOX \u00b7 TEST MODE' },
  'Real pul yechilmaydi \u2014 bu test to\u2019lovi.': { ru: 'Реальные деньги не списываются \u2014 это тестовый платёж.', en: 'No real money is charged \u2014 this is a test payment.' },
  "To'lov Payme'ning himoyalangan sahifasida amalga oshiriladi \u2014 karta ma'lumotlaringiz saytda saqlanmaydi.":
    { ru: 'Оплата проходит на защищённой странице Payme \u2014 данные вашей карты на сайте не хранятся.', en: 'Payment happens on Payme\u2019s secure page \u2014 your card details are never stored on this site.' },
  "To'lov tizimi vaqtincha o'chirilgan.": { ru: 'Платёжная система временно отключена.', en: 'The payment system is temporarily disabled.' },
  "To'lov tizimi hozircha o'chirilgan. Buyurtmani biroz keyinroq rasmiylashtirasiz.":
    { ru: 'Платёжная система пока отключена. Вы сможете оформить заказ чуть позже.', en: 'The payment system is off for now. You will be able to place the order shortly.' },
  'Qabul qiluvchi ismi': { ru: 'Имя получателя', en: 'Recipient name' },
  'Yetkazib berish manzili': { ru: 'Адрес доставки', en: 'Delivery address' },
  'Davom etish uchun yetkazib berish ma\u02bclumotlarini to\u02bcldiring.':
    { ru: 'Для продолжения заполните данные доставки.', en: 'Fill in the delivery details to continue.' },
  "Buyurtma yaratildi. To'lov tasdiqlangach kartani tayyorlashni boshlaymiz.":
    { ru: 'Заказ создан. Как только оплата подтвердится, мы начнём изготовление карты.', en: 'Order created. Once the payment is confirmed we start producing the card.' },
  "Ism, telefon va manzilni to'liq kiriting.": { ru: 'Укажите имя, телефон и адрес полностью.', en: 'Fill in the name, phone and address completely.' },
  'Arizangiz qabul qilindi \u2014 kompaniya tarifi tasdiqlangach faollashadi.':
    { ru: 'Ваша заявка принята \u2014 компания активируется после подтверждения тарифа.', en: 'Your request was received \u2014 the company becomes active once the plan is confirmed.' },
  'Arizangiz qabul qilindi \u2014 admin tasdig\u2019i kutilmoqda.':
    { ru: 'Ваша заявка принята \u2014 ожидается подтверждение администратора.', en: 'Your request was received \u2014 awaiting admin confirmation.' },
  'To\u2018lov tizimi vaqtincha o\u2018chirilgan.': { ru: 'Платёжная система временно отключена.', en: 'The payment system is temporarily disabled.' },

  // 2026-09: kompaniya nomida taqiqlangan so'z (src/lib/nameGuard.js)
  'Kompaniya nomida ushbu so\u2018zdan foydalanish mumkin emas.':
    { ru: '\u042d\u0442\u043e \u0441\u043b\u043e\u0432\u043e \u043d\u0435\u043b\u044c\u0437\u044f \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c \u0432 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0438 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0438.',
      en: 'This word cannot be used in a company name.' },
  'Kutilmoqda...': { ru: '\u041e\u0436\u0438\u0434\u0430\u043d\u0438\u0435...', en: 'Please wait...' },

  // 2026-09: profil foni uchun GIF/video (50 MB)
  'Maksimal hajm \u2014 50 MB.':
    { ru: '\u041c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439 \u0440\u0430\u0437\u043c\u0435\u0440 \u2014 50 \u041c\u0411.', en: 'Maximum size \u2014 50 MB.' },
  'GIF va video (MP4/WebM) ham mumkin. Maksimal hajm \u2014 50 MB.':
    { ru: 'GIF \u0438 \u0432\u0438\u0434\u0435\u043e (MP4/WebM) \u0442\u043e\u0436\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0442. \u041c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439 \u0440\u0430\u0437\u043c\u0435\u0440 \u2014 50 \u041c\u0411.',
      en: 'GIF and video (MP4/WebM) are supported too. Maximum size \u2014 50 MB.' },
  'Fon yuklandi. Saqlash tugmasini bosing.':
    { ru: '\u0424\u043e\u043d \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d. \u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c\u00bb.', en: 'Background uploaded. Press Save.' },
  'Faqat GIF, MP4 yoki WebM fayl.':
    { ru: '\u0422\u043e\u043b\u044c\u043a\u043e \u0444\u0430\u0439\u043b GIF, MP4 \u0438\u043b\u0438 WebM.', en: 'Only GIF, MP4 or WebM files.' },
  'Fayl formati qo\u2018llab-quvvatlanmaydi.':
    { ru: '\u0424\u043e\u0440\u043c\u0430\u0442 \u0444\u0430\u0439\u043b\u0430 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f.', en: 'This file format is not supported.' },
};
