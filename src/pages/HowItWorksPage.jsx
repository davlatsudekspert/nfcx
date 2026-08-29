import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import NfcCard from '../components/NfcCard.jsx';

const STEPS = {
  uz: [
    { n: '01', title: 'Kodni tanlang va tekshiring', text: "3 harf + 3 raqamdan iborat raqamli tashrif qog'ozingizni kiriting (masalan ABZ007) — bo'sh yoki bandligini shu zahoti ko'rasiz." },
    { n: '02', title: "Ro'yxatdan o'ting va bandlang", text: "Hisob yaratasiz, narxni ko'rasiz va bir bosishda raqamli tashrif qog'ozini o'zingizga biriktirasiz." },
    { n: '03', title: 'Profilingizni sozlang', text: "Kabinetdan ism, kasb, rasm, bio, ijtimoiy tarmoqlar (Telegram, Instagram, Facebook, X), to'lov kartasi va dizayn mavzusini qo'shasiz." },
    { n: '04', title: 'Ulashing', text: "Profilingiz nfcstore.uz/kodingiz manzilida yashaydi — havolani ulashing yoki jismoniy NFC kartangizga yozdiring." },
    { n: '05', title: 'Auksionda qatnashing', text: "Noyob kodlar vaqti-vaqti bilan auksionga qo'yiladi — taklif bering, g'olib chiqsangiz 24 soat ichida to'lab olasiz." },
    { n: '06', title: 'Narxlar oshishidan oldin ulguring', text: "Loyihamiz kengayishi bilan premium va qisqa ID'lar narxi oshib boradi. Boshqalar eng chiroyli raqamli kombinatsiyalar va noyob NFC ID'larni band qilib qo'ymasidan oldin, ularni o'zingizniki qiling. Hozirgi narxlar — xarid uchun eng qulay vaqt." },
  ],
  ru: [
    { n: '01', title: 'Выберите и проверьте код', text: 'Введите свою визитку из 3 букв + 3 цифр (например ABZ007) — сразу увидите, свободна она или занята.' },
    { n: '02', title: 'Зарегистрируйтесь и забронируйте', text: 'Создаёте аккаунт, видите цену и в один клик закрепляете визитку за собой.' },
    { n: '03', title: 'Настройте профиль', text: 'В кабинете добавляете имя, профессию, фото, био, соцсети (Telegram, Instagram, Facebook, X), платёжную карту и тему дизайна.' },
    { n: '04', title: 'Делитесь', text: 'Ваш профиль живёт по адресу nfcstore.uz/ваш-код — делитесь ссылкой или запишите её на физическую NFC-карту.' },
    { n: '05', title: 'Участвуйте в аукционе', text: 'Уникальные коды время от времени выставляются на аукцион — делайте ставку, при победе оплачиваете в течение 24 часов.' },
    { n: '06', title: 'Успейте до роста цен', text: 'По мере расширения проекта цена на премиум и короткие ID растёт. Пока другие не заняли самые красивые числовые комбинации и редкие NFC ID — сделайте их своими. Текущие цены — лучшее время для покупки.' },
  ],
  en: [
    { n: '01', title: 'Pick and check a code', text: 'Enter your card of 3 letters + 3 digits (e.g. ABZ007) — you instantly see whether it is free or taken.' },
    { n: '02', title: 'Sign up and reserve', text: 'You create an account, see the price and claim the card for yourself in one click.' },
    { n: '03', title: 'Set up your profile', text: 'From your dashboard you add name, profession, photo, bio, social networks (Telegram, Instagram, Facebook, X), a payment card and a design theme.' },
    { n: '04', title: 'Share', text: 'Your profile lives at nfcstore.uz/your-code — share the link or write it to a physical NFC card.' },
    { n: '05', title: 'Take part in auctions', text: 'Rare codes are put up for auction from time to time — place a bid, and if you win you pay within 24 hours.' },
    { n: '06', title: 'Act before prices rise', text: 'As our project grows, the price of premium and short IDs goes up. Before others reserve the most beautiful number combinations and rare NFC IDs, make them yours. Today’s prices are the best time to buy.' },
  ],
};

const HEADER = {
  uz: {
    kicker: 'Qanday ishlaydi',
    title: '“Barcha ma’lumotlaringiz — bitta raqamli profilda.”',
    sub: "NFCSTORE orqali shaxsiy raqamli tashrif qog'ozi olish olti qadamdan iborat — bandlashdan tortib profilni sozlash va auksionda qatnashishgacha.",
    demoName: 'SIZNING ISMINGIZ',
    cta: "Narxlarni ko'rish",
  },
  ru: {
    kicker: 'Как это работает',
    title: '«Все ваши данные — в одном цифровом профиле.»',
    sub: 'Получить личную цифровую визитку через NFCSTORE — это шесть шагов: от бронирования до настройки профиля и участия в аукционе.',
    demoName: 'ВАШЕ ИМЯ',
    cta: 'Посмотреть цены',
  },
  en: {
    kicker: 'How it works',
    title: '“All your details — in one digital profile.”',
    sub: 'Getting a personal digital card through NFCSTORE takes six steps — from reserving it to setting up your profile and taking part in an auction.',
    demoName: 'YOUR NAME',
    cta: 'See pricing',
  },
};

export default function HowItWorksPage() {
  const { lang } = useLanguage();
  const steps = STEPS[lang] || STEPS.uz;
  const h = HEADER[lang] || HEADER.uz;
  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="pt-14 text-center">
        <span className="inline-flex items-center justify-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          {h.kicker}
        </span>
        <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:whitespace-nowrap sm:text-4xl">
          {h.title}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-base-content/60">
          {h.sub}
        </p>
        <div className="mt-8 flex justify-center">
          <div className="animate-[floatY_5s_ease-in-out_infinite]">
            <NfcCard code="ABZ007" name={h.demoName} finish="showcase" size="md" />
          </div>
        </div>
      </section>

      <section className="mt-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-base-200/60 p-6 transition-colors hover:border-white/25">
              <div className="font-mono text-sm font-bold tracking-widest text-base-content/40">{s.n}</div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-base-content/55">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <button className="btn btn-primary" onClick={() => navigate('/narxlar')}>{h.cta}</button>
        </div>
      </section>
    </main>
  );
}
