import { useLanguage } from '../lib/i18n.jsx';

// MAXFIYLIK SIYOSATI — nfcstore.uz/privacy va /maxfiylik.
//
// Google Play Data safety bilan BIR XIL bo'lishi shart (2026-09): u yerda
// belgilangan har bir ma'lumot turi, maqsad va xizmat ko'rsatuvchi shu
// yerda ham yozilgan. Birini o'zgartirsangiz — ikkinchisini ham.

const CONTACT = 'davlatsudekspert@gmail.com';
const APP = 'NFCSTORE: Raqamli vizitka';

const CONTENT = {
  uz: {
    title: 'Maxfiylik siyosati',
    updated: 'Oxirgi yangilanish: 2026-yil 25-sentabr',
    intro: `Ushbu siyosat ${APP} ilovasi (Google Play) va nfcstore.uz sayti (birgalikda — NFCSTORE) qanday ma'lumot yig'ishi, nima uchun ishlatishi, kimga yuborishi va qanday saqlashini tushuntiradi.`,
    sections: [
      { h: "Qanday ma'lumot yig'amiz", list: [
        "Hisob: elektron pochta, parol (faqat xeshlangan holda), telefon raqami.",
        "Profil: ism, profil rasmi va muqova, bio, lavozim, kontaktlar va ijtimoiy tarmoq havolalari, profil musiqasi.",
        "Siz joylagan kontent: postlar, Reels, istoriyalar, izohlar, biznes katalogidagi mahsulot va xizmatlar.",
        "Ilova ichidagi harakatlar: layklar, obunalar, saqlangan Reels va katalog sevimlilari, profilingiz ko'rishlari statistikasi, ilovani birinchi va oxirgi ochgan vaqtingiz va ochilishlar soni.",
        "Murojaatlar: qo'llab-quvvatlashga yozgan xabarlaringiz va yuborgan shikoyatlaringiz.",
        "Buyurtmalar: buyurtma va to'lov tarixi. Karta ma'lumotlaringiz bizda saqlanmaydi — to'lov Payme yoki Click sahifasida qilinadi.",
        "Texnik: IP-manzil, qurilma va brauzer turi, xavfsizlik jurnallari.",
      ] },
      { h: "Nima uchun ishlatamiz", p: "Hisobingiz va profilingizni ishlatish, kontentingizni ko'rsatish, obuna va bildirishnomalar, buyurtmalarni bajarish, qo'llab-quvvatlash, firibgarlik va qoidabuzarlikning oldini olish, xavfsizlik. Ma'lumotlar sotilmaydi va reklama maqsadida ishlatilmaydi. Ilovada reklama SDK yo'q." },
      { h: "Ommaviy ma'lumot", p: "Profilingizga qo'shgan ma'lumotlar va joylagan kontentingiz ochiq sahifangizda ko'rinadi — havolaga ega har kim ko'ra oladi. Faqat oshkor qilishga tayyor bo'lgan narsani joylang. Saqlanganlar va sevimlilar faqat sizga ko'rinadi." },
      { h: "Siz yuklagan rasm va videolar", p: "Profil rasmi, muqova, post, Reels, istoriya va katalog uchun yuklagan fayllaringiz saqlanadi. Istoriya 24 soatdan keyin ommadan avtomatik olinadi; boshqalari siz o'chirguncha turadi. Ularni istalgan vaqtda ilovadan yoki saytdan o'chirishingiz mumkin (o'chirilgan kontent nusxasi haqida — «Saqlash muddati» bo'limida)." },
      { h: "Yuklangan rasmlarni avtomatik tekshirish", p: "Qonun va qoidalarga zid kontent (18+, zo'ravonlik, ekstremizm, giyohvand moddalar, nafrat) tarqalmasligi uchun yuklangan rasmlar avtomatik tekshiriladi. Buning uchun rasm Google Gemini xizmatiga faqat tekshirish maqsadida, bizning topshirig'imiz bilan yuboriladi. Taqiqlangan rasm saqlanmaydi; urinish haqida faqat vaqt va sabab (rasmning o'zisiz) qayd etiladi. Videolar shikoyat orqali moderator tomonidan ko'rib chiqiladi." },
      { h: "NFC", p: "Ilova NFC'dan faqat siz kartani telefonga tekkizganingizda foydalanadi: kartadagi profil havolasini o'qish yoki kartaga profilingiz havolasini yozish uchun. Fonda hech narsa o'qilmaydi va NFC ma'lumotlari serverga yuborilmaydi." },
      { h: "Ma'lumot yuboriladigan xizmatlar", list: [
        "Cloudflare — sayt va ilova serveri, ma'lumotlar bazasi va fayllarni saqlash.",
        "Resend — tasdiqlash kodlari va xizmat xatlarini emailga yuborish.",
        "Telegram — hisobingizni Telegram'ga bog'lasangiz: tasdiqlash va bildirishnomalar.",
        "Google Gemini — yuklangan rasmlarni avtomatik tekshirish va saytdagi yordamchi.",
        "Payme va Click — saytdagi to'lovlar.",
      ], after: "Bu xizmatlar ma'lumotni faqat bizning topshirig'imiz bilan va faqat shu maqsadda qayta ishlaydi. Qonun talab qilgan holatlardan tashqari ma'lumot boshqa uchinchi shaxslarga berilmaydi." },
      { h: "Yosh cheklovi", p: `${APP} faqat 18 yoshdan katta foydalanuvchilar uchun. 18 yoshga to'lmagan bo'lsangiz, xizmatdan foydalanmang. Bunday hisob aniqlansa, u o'chiriladi.` },
      { h: "Kontent qoidalari, shikoyat va bloklash", p: "18+, zo'ravonlik, ekstremizm va terrorizm, noqonuniy mahsulot, giyohvand moddalar, spam va firibgarlik, haqorat va nafrat taqiqlanadi — joylashdan oldin ilova qoidalarni ko'rsatadi. Har bir profil, post, Reels, istoriya, izoh va biznes sahifasidan shikoyat qilish, har qanday foydalanuvchi yoki biznesni bloklash mumkin. Shikoyatlarni moderator ko'rib chiqadi: qoidabuzar kontent o'chiriladi, takrorlansa hisob bloklanadi." },
      { h: 'Xavfsizlik', p: "Parollar xeshlanadi, ulanish shifrlangan (HTTPS), ilovada sessiya kaliti qurilmaning xavfsiz xotirasida saqlanadi. Maxfiy ma'lumotlarga kirish huquqi xodimlarning vazifasiga qarab qat'iy cheklangan." },
      { h: 'Saqlash muddati', p: "Ma'lumotlar hisobingiz faol ekan saqlanadi. Hisobni o'chirishni so'raganingizda profil va kontent ommadan darhol olib tashlanadi, hisob esa 30 kundan keyin butunlay o'chiriladi: shaxsiy ma'lumotlar, profil, biznes sahifalari, kontent va yuklangan fayllar o'chiriladi. Hisobda pul qoldig'i, yakunlanmagan buyurtma yoki auksion bo'lsa, o'chirish ular hal bo'lguncha kechikadi. Firibgarlik yoki tergov holatida, shuningdek hisob administrator tomonidan qoidabuzarlik uchun yopilgan bo'lsa, o'chirish ko'rib chiqish tugaguncha to'xtatilishi mumkin. Faqat quyidagilar saqlanadi: (1) buyurtma va to'lov yozuvlari — buxgalteriya va soliq qonunchiligida belgilangan muddat davomida, ism, telefon va manzilsiz; (2) o'chirilgan post, istoriya, izoh, rasm, video va fayllarning nusxasi (kim, qachon joylagan va kim o'chirgan) hamda muallifning email va telefoni — yopiq arxivda, faqat shikoyatlarni ko'rib chiqish, qoidabuzarlik va firibgarlikni tekshirish hamda vakolatli davlat organlarining qonuniy so'rovlariga javob berish uchun; arxivga faqat vakolatli adminlar kiradi va har bir qidiruv jurnalga yoziladi; (3) xavfsizlik jurnallari (email, telefon va IP manzil bo'lishi mumkin) — 5 yilgacha. Qo'llab-quvvatlash xabarlari, biznes sahifasi mijozlarining buyurtmalari va suhbatdoshlar yozgan xabarlar hozircha saqlanadi. O'chirilgan hisobning NFC ID va Business ID'lari 90 kun hech kimga berilmaydi. O'chirilgan fayllar tarmoq va qurilma keshlarida keshdan chiqquncha qolishi mumkin; zaxira nusxalardan ma'lumot 30 kun ichida o'chadi." },
      { h: "Qonunchilik va huquqlaringiz", p: "Shaxsga doir ma'lumotlaringiz O'zbekiston Respublikasining 2019-yil 2-iyuldagi O'RQ-547-son «Shaxsga doir ma'lumotlar to'g'risida»gi Qonuni asosida, ro'yxatdan o'tishda bergan rozilingiz bilan qayta ishlanadi. Siz o'zingiz haqingizdagi ma'lumotni va u qanday qayta ishlanayotganini bilish, noto'g'ri ma'lumotni tuzattirish, uni o'chirishni talab qilish, rozilikni qaytarib olish (bu hisobni o'chirish bilan teng) hamda vakolatli davlat organiga shikoyat qilish huquqiga egasiz. So'rovlarga 30 kun ichida javob beramiz." },
      { h: "Ma'lumotni oshkor qilish", p: "Ma'lumotlaringiz sotilmaydi va uchinchi shaxslarga berilmaydi. Istisno — qonunda nazarda tutilgan hollar: sud, tergov va boshqa vakolatli davlat organlarining rasmiylashtirilgan so'roviga ma'lumot faqat so'ralgan hajmda beriladi." },
      { h: "Chegaradan tashqariga uzatish", p: "Yuqorida ko'rsatilgan xizmat ko'rsatuvchilarning (Cloudflare, Google, Resend, Telegram) serverlari O'zbekistondan tashqarida joylashgan bo'lishi mumkin. Ro'yxatdan o'tishda siz ma'lumotlaringiz shu xizmatlar orqali, faqat ushbu siyosatda yozilgan maqsadlarda qayta ishlanishiga rozilik berasiz." },
      { h: "Hisobni va ma'lumotni o'chirish", p: `Hisobingizni istalgan vaqtda o'chirishingiz mumkin: ilovada Sozlamalar → Xavfsizlik → “Hisobni o'chirish”; saytda nfcstore.uz/delete-account sahifasida; yoki ${CONTACT} manziliga hisobingiz emailidan yozib (hisobingiz vaqtincha bloklangan bo'lsa ham). So'rovdan keyin hisob darhol yopiladi va 30 kundan keyin butunlay o'chiriladi (tafsilotlar “Saqlash muddati” bo'limida). 30 kun ichida bekor qilish uchun ${CONTACT} ga yozing.` },
      { h: 'Aloqa', p: `Savollar va so'rovlar uchun: ${CONTACT}` },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление: 25 сентября 2026',
    intro: `Эта политика объясняет, какие данные собирают приложение ${APP} (Google Play) и сайт nfcstore.uz (вместе — NFCSTORE), зачем они используются, кому передаются и как хранятся.`,
    sections: [
      { h: 'Какие данные мы собираем', list: [
        'Аккаунт: электронная почта, пароль (только в виде хеша), номер телефона.',
        'Профиль: имя, фото профиля и обложка, био, должность, контакты и ссылки на соцсети, музыка профиля.',
        'Ваш контент: посты, Reels, истории, комментарии, товары и услуги в каталоге бизнеса.',
        'Действия в приложении: лайки, подписки, сохранённые Reels и избранное каталога, статистика просмотров профиля, время первого и последнего открытия приложения и число открытий.',
        'Обращения: сообщения в поддержку и отправленные жалобы.',
        'Заказы: история заказов и платежей. Данные карты у нас не хранятся — оплата проходит на странице Payme или Click.',
        'Технические: IP-адрес, тип устройства и браузера, журналы безопасности.',
      ] },
      { h: 'Зачем мы их используем', p: 'Работа аккаунта и профиля, показ вашего контента, подписки и уведомления, выполнение заказов, поддержка, предотвращение мошенничества и нарушений, безопасность. Данные не продаются и не используются для рекламы. Рекламных SDK в приложении нет.' },
      { h: 'Публичные данные', p: 'Данные профиля и опубликованный контент видны на вашей открытой странице — любой, у кого есть ссылка. Публикуйте только то, что готовы раскрыть. Сохранённое и избранное видите только вы.' },
      { h: 'Загруженные фото и видео', p: 'Файлы для фото профиля, обложки, постов, Reels, историй и каталога сохраняются. История автоматически убирается из публичного доступа через 24 часа; остальное — пока вы не удалите. Удалить можно в любой момент в приложении или на сайте (о копии удалённого контента — в разделе «Срок хранения»).' },
      { h: 'Автоматическая проверка загружаемых фото', p: 'Чтобы не распространялся контент, нарушающий закон и правила (18+, насилие, экстремизм, наркотики, ненависть), загружаемые фото проверяются автоматически. Для этого фото отправляется в сервис Google Gemini только для проверки и по нашему поручению. Запрещённое фото не сохраняется; фиксируются только время и причина (без фото). Видео проверяются модератором по жалобам.' },
      { h: 'NFC', p: 'Приложение использует NFC только когда вы подносите карту к телефону: чтобы прочитать ссылку на профиль или записать на карту ссылку на ваш профиль. В фоне ничего не считывается, данные NFC на сервер не отправляются.' },
      { h: 'Сервисы, которым передаются данные', list: [
        'Cloudflare — сервер сайта и приложения, база данных и хранение файлов.',
        'Resend — отправка кодов подтверждения и служебных писем.',
        'Telegram — если вы привяжете аккаунт: подтверждение и уведомления.',
        'Google Gemini — автоматическая проверка загружаемых фото и помощник на сайте.',
        'Payme и Click — оплата на сайте.',
      ], after: 'Эти сервисы обрабатывают данные только по нашему поручению и только для указанной цели. Другим третьим лицам данные не передаются, кроме случаев, требуемых законом.' },
      { h: 'Возрастное ограничение', p: `${APP} предназначено только для пользователей старше 18 лет. Если вам меньше 18, не пользуйтесь сервисом. Такой аккаунт при обнаружении удаляется.` },
      { h: 'Правила контента, жалобы и блокировка', p: 'Запрещены 18+, насилие, экстремизм и терроризм, незаконные товары, наркотики, спам и мошенничество, оскорбления и ненависть — перед публикацией приложение показывает правила. На любой профиль, пост, Reels, историю, комментарий и страницу бизнеса можно пожаловаться, любого пользователя или бизнес можно заблокировать. Жалобы рассматривает модератор: нарушающий контент удаляется, при повторении аккаунт блокируется.' },
      { h: 'Безопасность', p: 'Пароли хешируются, соединение зашифровано (HTTPS), ключ сессии в приложении хранится в защищённом хранилище устройства. Доступ к конфиденциальным данным строго ограничен обязанностями сотрудников.' },
      { h: 'Срок хранения', p: 'Данные хранятся, пока аккаунт активен. После запроса на удаление профиль и контент сразу убираются из публичного доступа, а через 30 дней аккаунт удаляется полностью: личные данные, профиль, бизнес-страницы, контент и загруженные файлы. Если на аккаунте есть остаток средств, незавершённый заказ или аукцион, удаление откладывается до их завершения. При мошенничестве или расследовании, а также если аккаунт закрыт администратором за нарушения, удаление может быть приостановлено до окончания проверки. Сохраняется только: (1) записи заказов и платежей — в течение срока, установленного законодательством о бухгалтерии и налогах, без имени, телефона и адреса; (2) копия удалённых постов, историй, комментариев, фото, видео и файлов (кто и когда опубликовал и кто удалил), а также email и телефон автора — в закрытом архиве, только для рассмотрения жалоб, проверки нарушений и мошенничества и ответа на законные запросы уполномоченных государственных органов; доступ есть только у уполномоченных администраторов, каждый поиск записывается в журнал; (3) журналы безопасности (могут содержать email, телефон и IP-адрес) — до 5 лет. Обращения в поддержку, заказы клиентов бизнес-страницы и сообщения собеседников пока сохраняются. NFC ID и Business ID удалённого аккаунта 90 дней никому не выдаются. Удалённые файлы могут оставаться в кэше сети и устройств, пока он не обновится; из резервных копий данные исчезают в течение 30 дней.' },
      { h: 'Законодательство и ваши права', p: 'Ваши персональные данные обрабатываются на основании Закона Республики Узбекистан от 2 июля 2019 года № ЗРУ-547 «О персональных данных» и согласия, данного вами при регистрации. Вы вправе знать, какие данные о вас есть и как они обрабатываются, требовать исправления неверных данных, требовать их удаления, отозвать согласие (это равносильно удалению аккаунта) и подать жалобу в уполномоченный государственный орган. Мы отвечаем на запросы в течение 30 дней.' },
      { h: 'Раскрытие данных', p: 'Ваши данные не продаются и не передаются третьим лицам. Исключение — случаи, предусмотренные законом: по оформленному запросу суда, следствия и других уполномоченных государственных органов данные предоставляются только в запрошенном объёме.' },
      { h: 'Трансграничная передача', p: 'Серверы указанных выше поставщиков услуг (Cloudflare, Google, Resend, Telegram) могут находиться за пределами Узбекистана. При регистрации вы даёте согласие на обработку ваших данных через эти сервисы только в целях, указанных в этой политике.' },
      { h: 'Удаление аккаунта и данных', p: `Удалить аккаунт можно в любой момент: в приложении Настройки → Безопасность → «Удалить аккаунт»; на сайте на странице nfcstore.uz/delete-account; или написав на ${CONTACT} с адреса аккаунта (даже если аккаунт временно заблокирован). После запроса аккаунт сразу закрывается, а через 30 дней удаляется полностью (подробности — в разделе «Срок хранения»). Чтобы отменить в течение 30 дней, напишите на ${CONTACT}.` },
      { h: 'Контакты', p: `Вопросы и запросы: ${CONTACT}` },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 25 September 2026',
    intro: `This policy explains what data the ${APP} app (Google Play) and the nfcstore.uz website (together — NFCSTORE) collect, why, who it is sent to and how it is kept.`,
    sections: [
      { h: 'What data we collect', list: [
        'Account: email, password (hashed only), phone number.',
        'Profile: name, profile photo and cover, bio, job title, contacts and social links, profile music.',
        'Your content: posts, Reels, stories, comments, products and services in a business catalogue.',
        'In-app activity: likes, follows, saved Reels and catalogue favourites, profile view statistics, when you first and last opened the app and how many times.',
        'Messages: messages to support and reports you send.',
        'Orders: order and payment history. Card details are not stored by us — payment happens on the Payme or Click page.',
        'Technical: IP address, device and browser type, security logs.',
      ] },
      { h: 'Why we use it', p: 'To run your account and profile, show your content, follows and notifications, fulfil orders, provide support, prevent fraud and abuse, and keep the service secure. Data is not sold and not used for advertising. The app contains no advertising SDK.' },
      { h: 'Public information', p: 'Your profile details and posted content are shown on your public page — anyone with the link can see them. Post only what you are willing to disclose. Saved items and favourites are visible only to you.' },
      { h: 'Photos and videos you upload', p: 'Files uploaded for profile photo, cover, posts, Reels, stories and catalogue are stored. Stories are removed from public view automatically after 24 hours; the rest stays until you delete it. You can delete them at any time in the app or on the website (see “Retention” about copies of deleted content).' },
      { h: 'Automatic checking of uploaded photos', p: 'To stop content that violates the law and rules (18+, violence, extremism, drugs, hate) from spreading, uploaded photos are checked automatically. For this the photo is sent to Google Gemini for checking only, on our behalf. A prohibited photo is not stored; only the time and reason are logged (without the photo). Videos are reviewed by a moderator after reports.' },
      { h: 'NFC', p: 'The app uses NFC only when you tap a card to the phone: to read the profile link from it or write your profile link to it. Nothing is read in the background and NFC data is not sent to the server.' },
      { h: 'Service providers', list: [
        'Cloudflare — website and app server, database and file storage.',
        'Resend — sending verification codes and service emails.',
        'Telegram — if you link your account: verification and notifications.',
        'Google Gemini — automatic checking of uploaded photos and the website assistant.',
        'Payme and Click — payments on the website.',
      ], after: 'These providers process data only on our behalf and only for these purposes. Data is not shared with other third parties except where required by law.' },
      { h: 'Age restriction', p: `${APP} is only for users aged 18 and over. If you are under 18, do not use the service. Such accounts are deleted when found.` },
      { h: 'Content rules, reporting and blocking', p: '18+, violence, extremism and terrorism, illegal goods, drugs, spam and fraud, insults and hate are prohibited — the app shows the rules before posting. Every profile, post, Reel, story, comment and business page can be reported, and any user or business can be blocked. Reports are reviewed by a moderator: violating content is removed and repeat offenders are banned.' },
      { h: 'Security', p: 'Passwords are hashed, connections are encrypted (HTTPS), and the app keeps its session key in the device’s secure storage. Access to confidential data is strictly limited to staff who need it.' },
      { h: 'Retention', p: 'Data is kept while your account is active. When you request deletion, your profile and content are removed from public view immediately and the account is permanently deleted after 30 days: personal data, profiles, business pages, content and uploaded files are deleted. If the account has a remaining balance or an unfinished order or auction, deletion is postponed until these are resolved. In case of fraud or an investigation, or if an administrator closed the account for violations, deletion may be paused until the review ends. Only the following is kept: (1) order and payment records — for the period required by accounting and tax law, without name, phone or address; (2) a copy of deleted posts, stories, comments, photos, videos and files (who posted it and when, and who deleted it) together with the author’s email and phone — in a closed archive, only to review reports, investigate abuse and fraud, and answer lawful requests from authorised state bodies; only authorised admins can access it and every search is logged; (3) security logs (which may include email, phone and IP address) — for up to 5 years. Support messages, orders from customers of a business page and messages sent by other people are kept for now. NFC IDs and Business IDs of a deleted account are not given to anyone for 90 days. Deleted files may remain in network and device caches until they expire; data disappears from backups within 30 days.' },
      { h: 'Law and your rights', p: 'Your personal data is processed under Law of the Republic of Uzbekistan No. ZRU-547 “On Personal Data” of 2 July 2019 and the consent you give when signing up. You have the right to know what data we hold about you and how it is processed, to have incorrect data corrected, to request deletion, to withdraw consent (which equals deleting your account) and to complain to the authorised state body. We answer requests within 30 days.' },
      { h: 'Disclosure', p: 'Your data is not sold or given to third parties. The exception is cases provided by law: on a formal request from a court, investigators or another authorised state body, data is provided only to the extent requested.' },
      { h: 'Cross-border transfer', p: 'The servers of the service providers listed above (Cloudflare, Google, Resend, Telegram) may be located outside Uzbekistan. When signing up you consent to your data being processed through these services, only for the purposes described in this policy.' },
      { h: 'Account and data deletion', p: `You can delete your account at any time: in the app Settings → Security → “Delete account”; on the website at nfcstore.uz/delete-account; or by writing to ${CONTACT} from your account email (even if your account is temporarily blocked). After the request the account is closed immediately and permanently deleted after 30 days (details under “Retention”). To cancel within 30 days, write to ${CONTACT}.` },
      { h: 'Contact', p: `Questions and requests: ${CONTACT}` },
    ],
  },
};

export default function PrivacyPage() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.uz;
  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 pb-16 sm:px-10 lg:px-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="pt-14 text-3xl font-extrabold tracking-tight">{c.title}</h1>
        <div className="mt-2 font-mono text-xs uppercase tracking-wider text-base-content/40">{c.updated}</div>
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-base-content/70">
          <p>{c.intro}</p>
          {c.sections.map((s, i) => (
            <div key={i}>
              <h2 className="text-lg font-bold text-base-content">{s.h}</h2>
              {s.p && <p className="mt-1.5">{s.p}</p>}
              {s.list && (
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {s.list.map((x) => <li key={x}>{x}</li>)}
                </ul>
              )}
              {s.after && <p className="mt-1.5">{s.after}</p>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
