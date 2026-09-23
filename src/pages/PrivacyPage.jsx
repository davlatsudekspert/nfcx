import { useLanguage } from '../lib/i18n.jsx';

const CONTENT = {
  uz: {
    title: 'Maxfiylik siyosati',
    updated: 'Oxirgi yangilanish: 2026-yil 23-sentabr',
    intro: "Ushbu sahifa NFCSTORE xizmati ma'lumotlarni qanday yig'ishi, saqlashi va xavfsizligini ta'minlashini tushuntiradi.",
    sections: [
      { h: "Qanday ma'lumot yig'amiz", p: "Ro'yxatdan o'tishda kiritilgan elektron pochta, login va parollar tizimda qat'iy xeshlangan holatda saqlanadi. Xavfsizlikni ta'minlash maqsadida qurilmalarning IP-manzillari hamda tizimdagi harakatlar tarixi (loglar) qayd etib boriladi. Profilni to'ldirish uchun kiritgan ism, rasm, bio va kontaktlaringiz ham saqlanadi." },
      { h: "Ma'lumotdan foydalanish va Ommaviylik", p: "Kiritilgan ma'lumotlar faqat sizning shaxsiy profilingizni shakllantirish va xizmatni uzluksiz ishlashi uchun ishlatiladi. Siz profilga qo'shgan ma'lumotlar ochiq sahifangizda ko'rinadi — faqat o'zingiz oshkor qilishni istagan ma'lumotlarni kiriting. Ushbu ma'lumotlar uchinchi shaxslarga tijorat maqsadida sotilmaydi." },
      { h: "Siz yuklagan rasm va videolar", p: "Profil rasmi, muqova, post, story va katalog uchun yuklagan rasm va videolaringiz saqlanadi. Ular OCHIQ profil sahifangizda ko'rinadi va havolaga ega har qanday odam ularni ko'ra oladi — shuning uchun faqat oshkor qilishga tayyor bo'lgan materialni yuklang. Story 24 soatdan keyin avtomatik o'chadi; post va boshqa rasmlar siz o'chirguncha turadi. Ularni istalgan vaqtda ilovadan yoki saytdan o'chirishingiz mumkin. Yuklangan material uchinchi tomonga sotilmaydi va reklama maqsadida ishlatilmaydi." },
      { h: 'Xavfsizlik choralari', p: "Platformada foydalanuvchilarni identifikatsiya, autentifikatsiya va avtorizatsiya qilish tizimlari joriy etilgan bo'lib, ruxsatsiz kirishning oldini olish choralari to'liq ko'rilgan. Tizimda konfidensial ma'lumotlar bilan ishlash huquqi xodimlarning lavozim majburiyatlaridan kelib chiqib qat'iy cheklangan. Shuningdek, mijozlarning tizimdagi amaliyotlari va harakatlariga oid ma'lumotlar elektron arxivlarda kamida besh yil davomida xavfsiz saqlanishi ta'minlanadi." },
      { h: "Yuklangan rasmlarni avtomatik tekshirish", p: "Qonun va platforma qoidalariga zid kontent (18+, zo'ravonlik, ekstremizm, giyohvand moddalar, nafrat) tarqalmasligi uchun yuklangan rasmlar avtomatik tekshiriladi. Buning uchun rasm Google'ning Gemini xizmatiga faqat tekshirish maqsadida yuboriladi. Taqiqlangan rasm saqlanmaydi; bunday urinish haqida faqat vaqt va sabab (rasmning o'zisiz) qayd etiladi. Videolar shikoyat orqali moderator tomonidan ko'rib chiqiladi." },
      { h: "Saqlanganlar va sevimlilar", p: "Ilovada saqlagan Reels va katalogdagi sevimli mahsulotlaringiz hisobingizga bog'lab saqlanadi — telefon almashsa ham yo'qolmasligi uchun. Ular faqat sizga ko'rinadi." },
      { h: "NFC", p: "Ilova NFC'dan faqat siz kartani telefonga tekkizganingizda foydalanadi: karta ichidagi profil havolasini o'qish yoki kartaga profilingiz havolasini yozish uchun. Fonda hech narsa o'qilmaydi." },
      { h: "Hisobni va ma'lumotni o'chirish", p: "Hisobingizni istalgan vaqtda o'chirishingiz mumkin: ilovada Sozlamalar → Xavfsizlik → “Hisobni o'chirish”, yoki saytda nfcstore.uz/delete-account sahifasida, yoki support@nfcstore.uz orqali. O'chirilgach kira olmaysiz, profillaringiz va kontentingiz darhol olib tashlanadi. Buyurtma va to'lov yozuvlari buxgalteriya va soliq talablari uchun qonunda belgilangan muddatgacha saqlanadi." },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление: 23 сентября 2026',
    intro: 'Эта страница объясняет, как сервис NFCSTORE собирает, хранит и обеспечивает безопасность данных.',
    sections: [
      { h: 'Какие данные мы собираем', p: 'Введённые при регистрации электронная почта, логин и пароли хранятся в системе в строго хешированном виде. В целях обеспечения безопасности фиксируются IP-адреса устройств и история действий в системе (логи). Также сохраняются имя, фото, био и контакты, которые вы указали при заполнении профиля.' },
      { h: 'Использование данных и публичность', p: 'Введённые данные используются только для формирования вашего личного профиля и бесперебойной работы сервиса. Данные, которые вы добавили в профиль, отображаются на вашей публичной странице — указывайте только те данные, которые готовы раскрыть. Эти данные не продаются третьим лицам в коммерческих целях.' },
      { h: 'Загруженные вами фото и видео', p: 'Сохраняются фото и видео, загруженные вами для фото профиля, обложки, постов, историй и каталога. Они отображаются на вашей ОТКРЫТОЙ странице профиля, и любой, у кого есть ссылка, может их увидеть — поэтому загружайте только то, что готовы раскрыть. История автоматически удаляется через 24 часа; посты и остальные изображения хранятся, пока вы их не удалите. Вы можете удалить их в любой момент из приложения или с сайта. Загруженные материалы не продаются третьим лицам и не используются в рекламных целях.' },
      { h: 'Меры безопасности', p: 'На платформе внедрены системы идентификации, аутентификации и авторизации пользователей, полностью приняты меры по предотвращению несанкционированного доступа. Право работы с конфиденциальными данными строго ограничено в соответствии с должностными обязанностями сотрудников. Кроме того, данные об операциях и действиях клиентов в системе безопасно хранятся в электронных архивах не менее пяти лет.' },
      { h: 'Автоматическая проверка загружаемых фото', p: 'Чтобы не распространялся контент, нарушающий закон и правила платформы (18+, насилие, экстремизм, наркотики, ненависть), загружаемые фото проверяются автоматически. Для этого фото отправляется в сервис Google Gemini только с целью проверки. Запрещённое фото не сохраняется; о попытке фиксируются только время и причина (без самого фото). Видео проверяются модератором по жалобам.' },
      { h: 'Сохранённое и избранное', p: 'Сохранённые Reels и избранные товары каталога хранятся привязанными к аккаунту — чтобы не потерялись при смене телефона. Они видны только вам.' },
      { h: 'NFC', p: 'Приложение использует NFC только когда вы подносите карту к телефону: чтобы прочитать ссылку на профиль с карты или записать на карту ссылку на ваш профиль. В фоне ничего не считывается.' },
      { h: 'Удаление аккаунта и данных', p: 'Вы можете удалить аккаунт в любой момент: в приложении Настройки → Безопасность → «Удалить аккаунт», на сайте на странице nfcstore.uz/delete-account или через support@nfcstore.uz. После удаления войти нельзя, профили и контент сразу убираются. Записи заказов и платежей хранятся в течение срока, установленного законом для бухгалтерии и налогов.' },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 23 September 2026',
    intro: 'This page explains how the NFCSTORE service collects, stores and secures data.',
    sections: [
      { h: 'What data we collect', p: 'The email, login and passwords entered during registration are stored in the system in strictly hashed form. To ensure security, device IP addresses and the history of actions in the system (logs) are recorded. The name, photo, bio and contacts you entered to fill out your profile are also stored.' },
      { h: 'Use of data and publicity', p: 'The data entered is used only to build your personal profile and for the uninterrupted operation of the service. The data you add to your profile is shown on your public page — enter only the data you are willing to disclose. This data is not sold to third parties for commercial purposes.' },
      { h: 'Photos and videos you upload', p: 'Photos and videos you upload for your profile picture, cover, posts, stories and catalogue are stored. They appear on your PUBLIC profile page and anyone with the link can see them — so upload only what you are willing to disclose. Stories are deleted automatically after 24 hours; posts and other images remain until you delete them. You can delete them at any time from the app or the website. Uploaded material is not sold to third parties and is not used for advertising.' },
      { h: 'Security measures', p: 'The platform has implemented user identification, authentication and authorization systems, and measures to prevent unauthorized access have been fully taken. The right to work with confidential data is strictly limited according to the job duties of employees. In addition, data on customers’ operations and actions in the system is stored securely in electronic archives for at least five years.' },
      { h: 'Automatic checking of uploaded photos', p: 'To stop content that violates the law and platform rules (18+, violence, extremism, drugs, hate) from spreading, uploaded photos are checked automatically. For this, the photo is sent to Google’s Gemini service for checking only. A prohibited photo is not stored; only the time and reason of the attempt are logged (without the photo). Videos are reviewed by a moderator after reports.' },
      { h: 'Saved items and favourites', p: 'Reels you save and catalogue favourites are stored with your account so they are not lost when you change phones. Only you can see them.' },
      { h: 'NFC', p: 'The app uses NFC only when you tap a card to the phone: to read the profile link from the card or to write your profile link to the card. Nothing is read in the background.' },
      { h: 'Account and data deletion', p: 'You can delete your account at any time: in the app Settings → Security → “Delete account”, on the website at nfcstore.uz/delete-account, or via support@nfcstore.uz. After deletion you cannot sign in and your profiles and content are removed immediately. Order and payment records are kept for the period required by accounting and tax law.' },
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
              <p className="mt-1.5">{s.p}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
