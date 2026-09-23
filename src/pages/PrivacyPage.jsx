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
    updated: 'Oxirgi yangilanish: 2026-yil 23-sentabr',
    intro: `Ushbu siyosat ${APP} ilovasi (Google Play) va nfcstore.uz sayti (birgalikda — NFCSTORE) qanday ma'lumot yig'ishi, nima uchun ishlatishi, kimga yuborishi va qanday saqlashini tushuntiradi.`,
    sections: [
      { h: "Qanday ma'lumot yig'amiz", list: [
        "Hisob: elektron pochta, parol (faqat xeshlangan holda), telefon raqami.",
        "Profil: ism, profil rasmi va muqova, bio, lavozim, kontaktlar va ijtimoiy tarmoq havolalari, profil musiqasi.",
        "Siz joylagan kontent: postlar, Reels, istoriyalar, izohlar, biznes katalogidagi mahsulot va xizmatlar.",
        "Ilova ichidagi harakatlar: layklar, obunalar, saqlangan Reels va katalog sevimlilari, profilingiz ko'rishlari statistikasi.",
        "Murojaatlar: qo'llab-quvvatlashga yozgan xabarlaringiz va yuborgan shikoyatlaringiz.",
        "Buyurtmalar: buyurtma va to'lov tarixi. Karta ma'lumotlaringiz bizda saqlanmaydi — to'lov Payme yoki Click sahifasida qilinadi.",
        "Texnik: IP-manzil, qurilma va brauzer turi, xavfsizlik jurnallari.",
      ] },
      { h: "Nima uchun ishlatamiz", p: "Hisobingiz va profilingizni ishlatish, kontentingizni ko'rsatish, obuna va bildirishnomalar, buyurtmalarni bajarish, qo'llab-quvvatlash, firibgarlik va qoidabuzarlikning oldini olish, xavfsizlik. Ma'lumotlar sotilmaydi va reklama maqsadida ishlatilmaydi. Ilovada reklama SDK yo'q." },
      { h: "Ommaviy ma'lumot", p: "Profilingizga qo'shgan ma'lumotlar va joylagan kontentingiz ochiq sahifangizda ko'rinadi — havolaga ega har kim ko'ra oladi. Faqat oshkor qilishga tayyor bo'lgan narsani joylang. Saqlanganlar va sevimlilar faqat sizga ko'rinadi." },
      { h: "Siz yuklagan rasm va videolar", p: "Profil rasmi, muqova, post, Reels, istoriya va katalog uchun yuklagan fayllaringiz saqlanadi. Istoriya 24 soatdan keyin avtomatik o'chadi; boshqalari siz o'chirguncha turadi. Ularni istalgan vaqtda ilovadan yoki saytdan o'chirishingiz mumkin." },
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
      { h: 'Saqlash muddati', p: "Ma'lumotlar hisobingiz faol ekan saqlanadi. Hisob o'chirilgach profil va kontent ommadan darhol olib tashlanadi. Buyurtma va to'lov yozuvlari buxgalteriya va soliq talablari uchun qonunda belgilangan muddatgacha, xavfsizlik jurnallari 5 yilgacha saqlanadi." },
      { h: "Hisobni va ma'lumotni o'chirish", p: `Hisobingizni istalgan vaqtda o'chirishingiz mumkin: ilovada Sozlamalar → Xavfsizlik → “Hisobni o'chirish”; saytda nfcstore.uz/delete-account sahifasida; yoki ${CONTACT} manziliga hisobingiz emailidan yozib.` },
      { h: 'Aloqa', p: `Savollar va so'rovlar uchun: ${CONTACT}` },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление: 23 сентября 2026',
    intro: `Эта политика объясняет, какие данные собирают приложение ${APP} (Google Play) и сайт nfcstore.uz (вместе — NFCSTORE), зачем они используются, кому передаются и как хранятся.`,
    sections: [
      { h: 'Какие данные мы собираем', list: [
        'Аккаунт: электронная почта, пароль (только в виде хеша), номер телефона.',
        'Профиль: имя, фото профиля и обложка, био, должность, контакты и ссылки на соцсети, музыка профиля.',
        'Ваш контент: посты, Reels, истории, комментарии, товары и услуги в каталоге бизнеса.',
        'Действия в приложении: лайки, подписки, сохранённые Reels и избранное каталога, статистика просмотров профиля.',
        'Обращения: сообщения в поддержку и отправленные жалобы.',
        'Заказы: история заказов и платежей. Данные карты у нас не хранятся — оплата проходит на странице Payme или Click.',
        'Технические: IP-адрес, тип устройства и браузера, журналы безопасности.',
      ] },
      { h: 'Зачем мы их используем', p: 'Работа аккаунта и профиля, показ вашего контента, подписки и уведомления, выполнение заказов, поддержка, предотвращение мошенничества и нарушений, безопасность. Данные не продаются и не используются для рекламы. Рекламных SDK в приложении нет.' },
      { h: 'Публичные данные', p: 'Данные профиля и опубликованный контент видны на вашей открытой странице — любой, у кого есть ссылка. Публикуйте только то, что готовы раскрыть. Сохранённое и избранное видите только вы.' },
      { h: 'Загруженные фото и видео', p: 'Файлы для фото профиля, обложки, постов, Reels, историй и каталога сохраняются. История удаляется через 24 часа; остальное — пока вы не удалите. Удалить можно в любой момент в приложении или на сайте.' },
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
      { h: 'Срок хранения', p: 'Данные хранятся, пока аккаунт активен. После удаления аккаунта профиль и контент сразу убираются из публичного доступа. Записи заказов и платежей хранятся в течение срока, установленного законом для бухгалтерии и налогов, журналы безопасности — до 5 лет.' },
      { h: 'Удаление аккаунта и данных', p: `Удалить аккаунт можно в любой момент: в приложении Настройки → Безопасность → «Удалить аккаунт»; на сайте на странице nfcstore.uz/delete-account; или написав на ${CONTACT} с адреса аккаунта.` },
      { h: 'Контакты', p: `Вопросы и запросы: ${CONTACT}` },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 23 September 2026',
    intro: `This policy explains what data the ${APP} app (Google Play) and the nfcstore.uz website (together — NFCSTORE) collect, why, who it is sent to and how it is kept.`,
    sections: [
      { h: 'What data we collect', list: [
        'Account: email, password (hashed only), phone number.',
        'Profile: name, profile photo and cover, bio, job title, contacts and social links, profile music.',
        'Your content: posts, Reels, stories, comments, products and services in a business catalogue.',
        'In-app activity: likes, follows, saved Reels and catalogue favourites, profile view statistics.',
        'Messages: messages to support and reports you send.',
        'Orders: order and payment history. Card details are not stored by us — payment happens on the Payme or Click page.',
        'Technical: IP address, device and browser type, security logs.',
      ] },
      { h: 'Why we use it', p: 'To run your account and profile, show your content, follows and notifications, fulfil orders, provide support, prevent fraud and abuse, and keep the service secure. Data is not sold and not used for advertising. The app contains no advertising SDK.' },
      { h: 'Public information', p: 'Your profile details and posted content are shown on your public page — anyone with the link can see them. Post only what you are willing to disclose. Saved items and favourites are visible only to you.' },
      { h: 'Photos and videos you upload', p: 'Files uploaded for profile photo, cover, posts, Reels, stories and catalogue are stored. Stories are deleted after 24 hours; the rest stays until you delete it. You can delete them at any time in the app or on the website.' },
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
      { h: 'Retention', p: 'Data is kept while your account is active. When the account is deleted, your profile and content are removed from public view immediately. Order and payment records are kept for the period required by accounting and tax law; security logs for up to 5 years.' },
      { h: 'Account and data deletion', p: `You can delete your account at any time: in the app Settings → Security → “Delete account”; on the website at nfcstore.uz/delete-account; or by writing to ${CONTACT} from your account email.` },
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
