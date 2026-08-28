import { useLanguage } from '../lib/i18n.jsx';

// Uzun huquqiy matn — tilga qarab tanlanadi. Dizayn / tuzilma o'zgarmaydi,
// faqat matn tarjimasi. Yuridik matn ishlab chiqarishdan oldin ona tili
// ko'rigi tavsiya etiladi.
const CONTENT = {
  uz: {
    title: 'Ommaviy oferta',
    updated: 'Oxirgi yangilanish: 2026',
    intro: "Ushbu Ommaviy oferta (keyingi o'rinlarda — Oferta) NFCSTORE (nfcstore.uz) ma'muriyati va platformadan foydalanuvchi (keyingi o'rinlarda — Mijoz) o'rtasida raqamli tashrif qog'ozlarini xarid qilish, auksionlarda qatnashish va raqamli profil xizmatlaridan foydalanishda to'lovlarni amalga oshirish shartlarini belgilaydi.",
    sections: [
      {
        h: '1. Umumiy qoidalar va Shartnoma predmeti',
        p: [
          "1.1. Mazkur Oferta O'zbekiston Respublikasi Fuqarolik kodeksiga muvofiq ochiq shartnoma hisoblanadi. Mijoz platformada ro'yxatdan o'tish va/yoki xizmatlar uchun to'lovni amalga oshirish orqali ushbu Oferta shartlarini to'liq va so'zsiz qabul qilgan (akseptlagan) hisoblanadi.",
          "1.2. Platforma Mijozga NFC texnologiyasi asosidagi aqlli vizitkalar yaratish, noyob foydalanuvchi kodlarini band qilish va ularga texnik xizmat ko'rsatish imkoniyatini taqdim etadi.",
        ],
      },
      {
        h: "2. To'lovlarni amalga oshirish tartibi",
        p: [
          "2.1. NFCSTORE platformasidagi xizmatlar, jumladan auksiondagi eksklyuziv darajadagi kodlar uchun to'lovlar O'zbekiston Respublikasi hududida faoliyat yurituvchi litsenziyalangan to'lov tizimlari operatorlari va to'lov tashkilotlari orqali onlayn tarzda amalga oshiriladi.",
          "2.2. Auksion orqali xarid qilingan noyob kodlar uchun to'lov g'olib aniqlangandan so'ng 24 soat ichida to'liq hajmda amalga oshirilishi shart.",
          "2.3. Xizmat xususiyatidan kelib chiqib (raqamli mulk huquqining avtomatik o'tishi sababli), to'lov muvaffaqiyatli tasdiqlangach, xarid bekor qilinmaydi va pul mablag'lari qaytarilmaydi.",
        ],
      },
      {
        h: '3. Axborot xavfsizligi va Frodga (firibgarlikka) qarshi choralar',
        p: [
          "3.1. Platforma orqali amalga oshiriladigan barcha to'lovlar ma'lumotlari O'zbekiston Respublikasi Markaziy bankining axborot xavfsizligi va kiberxavfsizlikni ta'minlash talablariga qat'iy muvofiq ravishda himoyalanadi.",
          "3.2. To'lovlarni amalga oshirish jarayonida ruxsatsiz kirishning oldini olish maqsadida to'lov xizmatlarini yetkazib beruvchilar tizimida identifikatsiya va ko'p omilli autentifikatsiya qilish (masalan, SMS orqali bir martalik tasdiqlash kodlari) usullari qo'llaniladi.",
          "3.3. Jismoniy va yuridik shaxslarning roziligisiz yoki ruxsatisiz amalga oshiriladigan noqonuniy to'lovlarni oldini olish maqsadida integratsiya qilingan to'lov tizimlarida maxsus antifrod (frodga qarshi) tizimlari ishlaydi.",
          "3.4. Agar Mijozning akkauntida, bank kartasida yoki elektron hamyonida shubhali (frod) operatsiyalar yoki firibgarlik harakatlari aniqlansa, vakolatli organlar yoki Markaziy bank ko'rsatmasiga asosan ushbu akkauntdan foydalanish va to'lov operatsiyalari 3 kungacha bo'lgan muddatga vaqtincha cheklanishi (bloklanishi) mumkin.",
        ],
      },
      {
        h: '4. Tomonlarning huquq va majburiyatlari',
        p: ['4.1. Mijozning majburiyatlari:'],
        ul: [
          "Mijoz to'lovlarni amalga oshirishda masofaviy axborot tizimlari tomonidan taqdim etiladigan bir martalik tasdiqlash kodlarini (SMS) va o'z parollarini qat'iy sir saqlashi hamda uchinchi shaxslarga oshkor qilmasligi shart.",
          "Mijoz o'z bank kartasi va akkaunt ma'lumotlarini ruxsatsiz ko'chirish, o'zgartirish yoki uchinchi shaxslarga taqdim etishdan shaxsan himoyalashi javobgarligini o'z zimmasiga oladi.",
        ],
        p2: "4.2. NFCSTORE ma'muriyatining huquq va majburiyatlari:",
        ul2: [
          "Platforma to'lov axborotlari shakllantirilishini, to'lov hujjatining haqqoniyligi tekshirilishini va to'lov haqidagi ma'lumotlar uchinchi shaxslarga ruxsatsiz tarqalishining oldini olishni ta'minlaydi.",
          "Mijozlarning to'lovlar bilan bog'liq amaliyotlari (elektron bayonnomalar) ma'lumotlar bazasida elektron arxivlarda xavfsiz holda kamida 5 yil davomida saqlanadi.",
          "Platforma profil ma'lumotlarini faqat xizmatni ko'rsatish maqsadida ishlatadi hamda Mijoz roziligisiz to'lov yechib olinishiga yo'l qo'ymaydi.",
        ],
      },
      {
        h: '5. Fors-major holatlar',
        p: [
          "5.1. Tomonlar o'z majburiyatlarini qisman yoki to'liq bajarmaganliklari uchun, agar bu holat yengib bo'lmaydigan kuchlar (tabiiy ofatlar, davlat organlarining qarorlari, telekommunikatsiya yoki to'lov tizimlari operatorlari tarmog'idagi umumiy uzilishlar) natijasida yuzaga kelgan bo'lsa, javobgarlikdan ozod qilinadi. To'lov tizimi ishlashidagi vaqtinchalik uzilishlar zaxira axborot tizimlari orqali qayta tiklanishi ta'minlanadi.",
        ],
      },
    ],
  },
  ru: {
    title: 'Публичная оферта',
    updated: 'Последнее обновление: 2026',
    intro: 'Настоящая Публичная оферта (далее — Оферта) определяет условия осуществления платежей между администрацией NFCSTORE (nfcstore.uz) и пользователем платформы (далее — Клиент) при покупке цифровых визиток, участии в аукционах и использовании сервисов цифрового профиля.',
    sections: [
      {
        h: '1. Общие положения и предмет договора',
        p: [
          '1.1. Настоящая Оферта является публичным договором в соответствии с Гражданским кодексом Республики Узбекистан. Регистрируясь на платформе и/или осуществляя оплату услуг, Клиент считается полностью и безоговорочно принявшим (акцептовавшим) условия настоящей Оферты.',
          '1.2. Платформа предоставляет Клиенту возможность создавать умные визитки на основе технологии NFC, бронировать уникальные пользовательские коды и получать их техническое обслуживание.',
        ],
      },
      {
        h: '2. Порядок осуществления платежей',
        p: [
          '2.1. Оплата услуг платформы NFCSTORE, включая коды эксклюзивного уровня на аукционе, производится онлайн через лицензированных операторов платёжных систем и платёжные организации, действующие на территории Республики Узбекистан.',
          '2.2. Оплата за уникальные коды, приобретённые на аукционе, должна быть произведена в полном объёме в течение 24 часов после определения победителя.',
          '2.3. В силу характера услуги (автоматический переход прав на цифровую собственность) после успешного подтверждения платежа покупка не отменяется и денежные средства не возвращаются.',
        ],
      },
      {
        h: '3. Информационная безопасность и меры против мошенничества (фрода)',
        p: [
          '3.1. Все данные о платежах, осуществляемых через платформу, защищаются в строгом соответствии с требованиями Центрального банка Республики Узбекистан по обеспечению информационной и кибербезопасности.',
          '3.2. В процессе осуществления платежей в целях предотвращения несанкционированного доступа в системах поставщиков платёжных услуг применяются методы идентификации и многофакторной аутентификации (например, одноразовые коды подтверждения по SMS).',
          '3.3. В целях предотвращения незаконных платежей, совершаемых без согласия или разрешения физических и юридических лиц, в интегрированных платёжных системах работают специальные антифрод-системы.',
          '3.4. При выявлении подозрительных (фрод) операций или мошеннических действий в аккаунте, на банковской карте или в электронном кошельке Клиента, по указанию уполномоченных органов или Центрального банка использование данного аккаунта и платёжные операции могут быть временно ограничены (заблокированы) на срок до 3 дней.',
        ],
      },
      {
        h: '4. Права и обязанности сторон',
        p: ['4.1. Обязанности Клиента:'],
        ul: [
          'Клиент обязан строго хранить в тайне и не раскрывать третьим лицам одноразовые коды подтверждения (SMS), предоставляемые дистанционными информационными системами, и свои пароли.',
          'Клиент принимает на себя ответственность за самостоятельную защиту данных своей банковской карты и аккаунта от несанкционированного копирования, изменения или передачи третьим лицам.',
        ],
        p2: '4.2. Права и обязанности администрации NFCSTORE:',
        ul2: [
          'Платформа обеспечивает формирование платёжной информации, проверку подлинности платёжного документа и предотвращение несанкционированного распространения данных о платеже третьим лицам.',
          'Операции Клиентов, связанные с платежами (электронные выписки), безопасно хранятся в базе данных в электронных архивах не менее 5 лет.',
          'Платформа использует данные профиля исключительно в целях оказания услуги и не допускает списания платежей без согласия Клиента.',
        ],
      },
      {
        h: '5. Форс-мажорные обстоятельства',
        p: [
          '5.1. Стороны освобождаются от ответственности за частичное или полное неисполнение своих обязательств, если это вызвано обстоятельствами непреодолимой силы (стихийные бедствия, решения государственных органов, общие сбои в сетях операторов телекоммуникаций или платёжных систем). Временные сбои в работе платёжной системы восстанавливаются через резервные информационные системы.',
        ],
      },
    ],
  },
  en: {
    title: 'Public Offer',
    updated: 'Last updated: 2026',
    intro: 'This Public Offer (hereinafter — the Offer) defines the terms of payment between the administration of NFCSTORE (nfcstore.uz) and the platform user (hereinafter — the Customer) when purchasing digital cards, taking part in auctions and using digital profile services.',
    sections: [
      {
        h: '1. General provisions and subject of the agreement',
        p: [
          '1.1. This Offer is a public contract in accordance with the Civil Code of the Republic of Uzbekistan. By registering on the platform and/or making a payment for services, the Customer is deemed to have fully and unconditionally accepted the terms of this Offer.',
          '1.2. The platform provides the Customer with the ability to create smart cards based on NFC technology, reserve unique user codes and receive technical support for them.',
        ],
      },
      {
        h: '2. Payment procedure',
        p: [
          '2.1. Payment for the services of the NFCSTORE platform, including exclusive-tier codes at auction, is made online through licensed payment system operators and payment organizations operating in the territory of the Republic of Uzbekistan.',
          '2.2. Payment for unique codes purchased at auction must be made in full within 24 hours after the winner is determined.',
          '2.3. Due to the nature of the service (automatic transfer of digital property rights), once a payment is successfully confirmed the purchase cannot be cancelled and funds are not refunded.',
        ],
      },
      {
        h: '3. Information security and anti-fraud measures',
        p: [
          '3.1. All data on payments made through the platform is protected in strict compliance with the requirements of the Central Bank of the Republic of Uzbekistan for ensuring information and cyber security.',
          '3.2. During the payment process, in order to prevent unauthorized access, identification and multi-factor authentication methods (for example, one-time confirmation codes via SMS) are used in the systems of payment service providers.',
          '3.3. In order to prevent illegal payments made without the consent or permission of individuals and legal entities, special anti-fraud systems operate in the integrated payment systems.',
          "3.4. If suspicious (fraud) transactions or fraudulent actions are detected in the Customer's account, bank card or e-wallet, on the instructions of authorized bodies or the Central Bank, the use of this account and payment transactions may be temporarily restricted (blocked) for up to 3 days.",
        ],
      },
      {
        h: '4. Rights and obligations of the parties',
        p: ['4.1. Customer obligations:'],
        ul: [
          'The Customer must strictly keep secret and not disclose to third parties the one-time confirmation codes (SMS) provided by remote information systems and their own passwords.',
          "The Customer assumes responsibility for personally protecting their bank card and account data from unauthorized copying, alteration or transfer to third parties.",
        ],
        p2: '4.2. Rights and obligations of the NFCSTORE administration:',
        ul2: [
          'The platform ensures the generation of payment information, verification of the authenticity of the payment document and prevention of unauthorized distribution of payment data to third parties.',
          "Customers' payment-related operations (electronic statements) are stored securely in the database in electronic archives for at least 5 years.",
          'The platform uses profile data solely for the purpose of providing the service and does not allow payments to be charged without the Customer’s consent.',
        ],
      },
      {
        h: '5. Force majeure',
        p: [
          '5.1. The parties are released from liability for partial or complete failure to fulfill their obligations if this is caused by force majeure (natural disasters, decisions of government bodies, general outages in the networks of telecommunications or payment system operators). Temporary interruptions in the operation of the payment system are restored through backup information systems.',
        ],
      },
    ],
  },
};

export default function TermsPage() {
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
              {(s.p || []).map((p, j) => (
                <p key={j} className={j === 0 && s.ul ? 'mt-1.5 font-semibold text-base-content/80' : 'mt-1.5'}>{p}</p>
              ))}
              {s.ul && (
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {s.ul.map((li, j) => <li key={j}>{li}</li>)}
                </ul>
              )}
              {s.p2 && <p className="mt-3 font-semibold text-base-content/80">{s.p2}</p>}
              {s.ul2 && (
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {s.ul2.map((li, j) => <li key={j}>{li}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
