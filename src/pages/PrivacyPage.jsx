import { useLanguage } from '../lib/i18n.jsx';

const CONTENT = {
  uz: {
    title: 'Maxfiylik siyosati',
    updated: 'Oxirgi yangilanish: 2026',
    intro: "Ushbu sahifa NFCSTORE xizmati ma'lumotlarni qanday yig'ishi, saqlashi va xavfsizligini ta'minlashini tushuntiradi.",
    sections: [
      { h: "Qanday ma'lumot yig'amiz", p: "Ro'yxatdan o'tishda kiritilgan elektron pochta, login va parollar tizimda qat'iy xeshlangan holatda saqlanadi. Xavfsizlikni ta'minlash maqsadida qurilmalarning IP-manzillari hamda tizimdagi harakatlar tarixi (loglar) qayd etib boriladi. Profilni to'ldirish uchun kiritgan ism, rasm, bio va kontaktlaringiz ham saqlanadi." },
      { h: "Ma'lumotdan foydalanish va Ommaviylik", p: "Kiritilgan ma'lumotlar faqat sizning shaxsiy profilingizni shakllantirish va xizmatni uzluksiz ishlashi uchun ishlatiladi. Siz profilga qo'shgan ma'lumotlar ochiq sahifangizda ko'rinadi — faqat o'zingiz oshkor qilishni istagan ma'lumotlarni kiriting. Ushbu ma'lumotlar uchinchi shaxslarga tijorat maqsadida sotilmaydi." },
      { h: 'Xavfsizlik choralari', p: "Platformada foydalanuvchilarni identifikatsiya, autentifikatsiya va avtorizatsiya qilish tizimlari joriy etilgan bo'lib, ruxsatsiz kirishning oldini olish choralari to'liq ko'rilgan. Tizimda konfidensial ma'lumotlar bilan ishlash huquqi xodimlarning lavozim majburiyatlaridan kelib chiqib qat'iy cheklangan. Shuningdek, mijozlarning tizimdagi amaliyotlari va harakatlariga oid ma'lumotlar elektron arxivlarda kamida besh yil davomida xavfsiz saqlanishi ta'minlanadi." },
      { h: "Ma'lumotni o'chirish", p: "Hisobingizni va barcha bog'langan ma'lumotlarni butunlay o'chirishni xohlasangiz, qo'llab-quvvatlash xizmatiga onlayn murojaat qilishingiz mumkin." },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление: 2026',
    intro: 'Эта страница объясняет, как сервис NFCSTORE собирает, хранит и обеспечивает безопасность данных.',
    sections: [
      { h: 'Какие данные мы собираем', p: 'Введённые при регистрации электронная почта, логин и пароли хранятся в системе в строго хешированном виде. В целях обеспечения безопасности фиксируются IP-адреса устройств и история действий в системе (логи). Также сохраняются имя, фото, био и контакты, которые вы указали при заполнении профиля.' },
      { h: 'Использование данных и публичность', p: 'Введённые данные используются только для формирования вашего личного профиля и бесперебойной работы сервиса. Данные, которые вы добавили в профиль, отображаются на вашей публичной странице — указывайте только те данные, которые готовы раскрыть. Эти данные не продаются третьим лицам в коммерческих целях.' },
      { h: 'Меры безопасности', p: 'На платформе внедрены системы идентификации, аутентификации и авторизации пользователей, полностью приняты меры по предотвращению несанкционированного доступа. Право работы с конфиденциальными данными строго ограничено в соответствии с должностными обязанностями сотрудников. Кроме того, данные об операциях и действиях клиентов в системе безопасно хранятся в электронных архивах не менее пяти лет.' },
      { h: 'Удаление данных', p: 'Если вы хотите полностью удалить свою учётную запись и все связанные данные, вы можете обратиться в службу поддержки онлайн.' },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 2026',
    intro: 'This page explains how the NFCSTORE service collects, stores and secures data.',
    sections: [
      { h: 'What data we collect', p: 'The email, login and passwords entered during registration are stored in the system in strictly hashed form. To ensure security, device IP addresses and the history of actions in the system (logs) are recorded. The name, photo, bio and contacts you entered to fill out your profile are also stored.' },
      { h: 'Use of data and publicity', p: 'The data entered is used only to build your personal profile and for the uninterrupted operation of the service. The data you add to your profile is shown on your public page — enter only the data you are willing to disclose. This data is not sold to third parties for commercial purposes.' },
      { h: 'Security measures', p: 'The platform has implemented user identification, authentication and authorization systems, and measures to prevent unauthorized access have been fully taken. The right to work with confidential data is strictly limited according to the job duties of employees. In addition, data on customers’ operations and actions in the system is stored securely in electronic archives for at least five years.' },
      { h: 'Data deletion', p: 'If you want to completely delete your account and all associated data, you can contact support online.' },
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
