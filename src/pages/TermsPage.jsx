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
          "1.2. Platforma Mijozga NFC texnologiyasi asosidagi aqlli vizitkalar ochish, noyob foydalanuvchi kodlarini band qilish va ularga texnik xizmat ko'rsatish imkoniyatini taqdim etadi.",
        ],
      },
      {
        h: "2. To'lovlarni amalga oshirish tartibi",
        p: [
          "2.1. NFCSTORE platformasidagi xizmatlar, jumladan auksiondagi eksklyuziv darajadagi kodlar uchun to'lovlar O'zbekiston Respublikasi hududida faoliyat yurituvchi litsenziyalangan to'lov tizimlari operatorlari va to'lov tashkilotlari orqali onlayn tarzda amalga oshiriladi.",
          "2.2. Auksion orqali xarid qilingan noyob kodlar uchun to'lov g'olib aniqlangandan so'ng 24 soat ichida to'liq hajmda amalga oshirilishi shart.",
          "2.3. Raqamli mahsulot (NFC ID, raqamli tashrif qog'ozi). To'lov muvaffaqiyatli tasdiqlangan zahoti kod Mijozning profiliga biriktiriladi va raqamli mulk huquqi Mijozga o'tadi, ya'ni xizmat to'liq ko'rsatilgan hisoblanadi. Shu sababli to'lov tasdiqlangandan keyin xarid bekor qilinmaydi va pul mablag'lari qaytarilmaydi.",
          "2.4. Jismoniy NFC karta. Jismoniy karta har bir Mijozning ismi va shaxsiy ma'lumotlari bilan yakka tartibda (buyurtmaga muvofiq) tayyorlanadi. Shu sababli tegishli sifatdagi (nuqsonsiz) jismoniy karta almashtirilmaydi va qaytarilmaydi.",
          "2.5. Pul qaytariladigan hollar. Quyidagi hollarda Mijoz to'langan summani to'liq qaytarishni yoki xizmatni qayta ko'rsatishni talab qilish huquqiga ega: (a) Platforma texnik sabab bilan xizmatni umuman ko'rsata olmasa yoki band qilingan kodni Mijozga bera olmasa; (b) summa xato yoki takroran yechilgan bo'lsa; (c) jismoniy karta nuqsonli bo'lsa, ishlamasa yoki buyurtmadan farq qilsa. 2.3 va 2.4-bandlar bu huquqni cheklamaydi.",
          "2.6. Pul qaytarish tartibi. Ariza nfcstore.uz saytidagi «Aloqa» bo'limi yoki rasmiy Telegram bot orqali beriladi. Ariza kelib tushgan kundan boshlab 10 (o'n) ish kuni ichida ko'rib chiqiladi. Tasdiqlangan summa faqat to'lov amalga oshirilgan usul va o'sha karta hisobiga qaytariladi; qaytarish muddati to'lov tizimi va bank qoidalariga bog'liq.",
          "2.7. To'lanmagan buyurtma. Band qilingan, lekin to'lovi amalga oshirilmagan buyurtma 24 soatdan keyin avtomatik bekor qilinadi va kod qayta sotuvga chiqadi. Bu holda Mijozdan hech qanday summa yechilmaydi.",
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
          '2.3. Цифровой продукт (NFC ID, цифровая визитка). Сразу после успешного подтверждения платежа код закрепляется за профилем Клиента и права на цифровую собственность переходят к Клиенту, то есть услуга считается оказанной в полном объёме. Поэтому после подтверждения платежа покупка не отменяется и денежные средства не возвращаются.',
          '2.4. Физическая NFC-карта. Физическая карта изготавливается индивидуально по заказу — с именем и персональными данными Клиента. Поэтому физическая карта надлежащего качества (без дефектов) обмену и возврату не подлежит.',
          '2.5. Случаи возврата денежных средств. Клиент вправе требовать полного возврата уплаченной суммы или повторного оказания услуги в следующих случаях: (a) Платформа по техническим причинам не может оказать услугу или передать Клиенту забронированный код; (b) сумма списана ошибочно или повторно; (c) физическая карта имеет дефект, не работает или не соответствует заказу. Пункты 2.3 и 2.4 не ограничивают это право.',
          '2.6. Порядок возврата. Заявление подаётся через раздел «Контакты» на сайте nfcstore.uz или официальный Telegram-бот. Заявление рассматривается в течение 10 (десяти) рабочих дней с даты поступления. Подтверждённая сумма возвращается исключительно тем же способом оплаты и на тот же карточный счёт; срок зачисления зависит от правил платёжной системы и банка.',
          '2.7. Неоплаченный заказ. Забронированный, но не оплаченный заказ автоматически отменяется через 24 часа, и код возвращается в продажу. В этом случае с Клиента не списывается никакая сумма.',
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
          '2.3. Digital product (NFC ID, digital business card). As soon as the payment is successfully confirmed, the code is attached to the Client\u2019s profile and digital property rights pass to the Client, meaning the service is deemed fully rendered. Therefore, once a payment is confirmed the purchase cannot be cancelled and funds are not refunded.',
          '2.4. Physical NFC card. A physical card is produced individually to order, bearing the Client\u2019s name and personal details. Therefore a physical card of proper quality (free of defects) is not subject to exchange or return.',
          '2.5. Cases in which funds are refunded. The Client is entitled to a full refund of the amount paid, or to have the service performed again, where: (a) the Platform is unable, for technical reasons, to render the service or to deliver the reserved code to the Client; (b) an amount was charged in error or charged twice; (c) a physical card is defective, does not work, or does not match the order. Clauses 2.3 and 2.4 do not limit this right.',
          '2.6. Refund procedure. A request is submitted through the \u201cContact\u201d section of nfcstore.uz or the official Telegram bot. It is reviewed within 10 (ten) business days of receipt. An approved amount is refunded solely via the original payment method and to the same card account; crediting times depend on the payment system and bank rules.',
          '2.7. Unpaid order. An order that is reserved but not paid is cancelled automatically after 24 hours and the code returns to sale. No amount is charged to the Client in that case.',
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
        <span className="vz-kicker mt-14">NFCSTORE</span>
        <h1 className="vz-h1 mt-3">{c.title}</h1>
        <div className="mt-3 font-mono text-xs uppercase tracking-wider text-base-content/40">{c.updated}</div>
        <div className="mt-6 space-y-6 break-words text-[15px] leading-relaxed text-base-content/70">
          <p>{c.intro}</p>

          {c.sections.map((s, i) => (
            <div key={i}>
              <h2 className="font-display text-lg font-bold text-base-content">{s.h}</h2>
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
