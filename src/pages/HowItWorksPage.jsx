import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import NfcCard from '../components/NfcCard.jsx';

const STEPS = {
  uz: [
    { n: '01', title: 'Profil oching', text: 'Ism, kasb, telefon, ijtimoiy tarmoqlar, sayt va boshqa muhim ma’lumotlaringizni kiriting.' },
    { n: '02', title: 'Kartani yaqinlashtiring', text: 'NFC kartani telefonning orqa qismiga tuting. Hech qanday ilova o‘rnatish shart emas.' },
    { n: '03', title: 'Profil ochiladi', text: 'Raqamli profilingiz telefon brauzerida avtomatik ochiladi.' },
    { n: '04', title: 'Kontaktni saqlang', text: 'Suhbatdoshingiz aloqa ma’lumotlaringizni bir tugma orqali telefoniga saqlaydi.' },
  ],
  // AUKSION BEKOR QILINDI (2026-09): ru/en endi uz bilan bir xil — 4 qadam,
  // auksion va "narx oshadi" qadamlari olib tashlandi.
  ru: [
    { n: '01', title: 'Создайте профиль', text: 'Укажите имя, профессию, телефон, соцсети, сайт и другие важные данные.' },
    { n: '02', title: 'Поднесите карту', text: 'Приложите NFC-карту к задней части телефона. Устанавливать приложение не нужно.' },
    { n: '03', title: 'Профиль откроется', text: 'Ваш цифровой профиль автоматически откроется в браузере телефона.' },
    { n: '04', title: 'Сохраните контакт', text: 'Собеседник сохраняет ваши контакты в телефон одной кнопкой.' },
  ],
  en: [
    { n: '01', title: 'Create a profile', text: 'Add your name, profession, phone, social networks, website and other key details.' },
    { n: '02', title: 'Tap the card', text: 'Hold the NFC card to the back of the phone. No app needs to be installed.' },
    { n: '03', title: 'The profile opens', text: 'Your digital profile opens automatically in the phone’s browser.' },
    { n: '04', title: 'Save the contact', text: 'The other person saves your contact details to their phone with one button.' },
  ],
};

const HEADER = {
  uz: {
    kicker: 'Qanday ishlaydi',
    title: 'Barcha kontaktlaringiz — bitta profilda.',
    sub: 'Telefon, ijtimoiy tarmoqlar, sayt va boshqa muhim ma’lumotlaringizni jamlang. NFC karta orqali ulashish esa bir necha soniya vaqt oladi.',
    demoName: 'SIZNING ISMINGIZ',
    cta: 'Bepul profil ochish',
  },
  ru: {
    kicker: 'Как это работает',
    title: 'Все ваши контакты — в одном профиле.',
    sub: 'Соберите телефон, соцсети, сайт и другие важные данные в одном месте. А поделиться ими через NFC-карту — дело нескольких секунд.',
    demoName: 'ВАШЕ ИМЯ',
    cta: 'Создать бесплатный профиль',
  },
  en: {
    kicker: 'How it works',
    title: 'All your contacts — in one profile.',
    sub: 'Bring your phone, social networks, website and other key details together. Sharing them with an NFC card takes just a few seconds.',
    demoName: 'YOUR NAME',
    cta: 'Create a free profile',
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
              <p className="mt-2 text-[16px] leading-relaxed text-base-content/55">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <button className="btn btn-primary" onClick={() => navigate('/register')}>{h.cta}</button>
        </div>
      </section>
    </main>
  );
}
