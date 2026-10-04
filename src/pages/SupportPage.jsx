import { IconTelegram, IconPhone, IconSupport } from '../components/Icons.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';

// QO'LLAB-QUVVATLASH — nfcstore.uz/support, /contact, /help, /yordam.
//
// App Store "Support URL" shu sahifani ochadi (2026-10). Ilgari bu
// manzillar NFC ID deb o'qilib "Bu ID bo'sh — band qiling" sahifasini
// ko'rsatardi. So'zlar NFC ID sifatida ham band qilingan
// (hosting/api/reserved-codes.js).
//
// FAQAT ishlayotgan kanallar: Telegram, telefon va ilova/kabinetdagi
// murojaat formasi (POST /api/support). Yangi kontakt QO'SHILMAGAN.
// Matn tilga qarab tanlanadi (PrivacyPage/TermsPage kabi), shuning
// uchun lug'atga kalit qo'shish shart emas.

const TELEGRAM = { value: '@nfcstore_admin', href: 'https://t.me/nfcstore_admin' };
const PHONE = { value: '+998 50 090 82 77', href: 'tel:+998500908277' };

const CONTENT = {
  uz: {
    kicker: 'Yordam',
    title: "Qo'llab-quvvatlash",
    intro: "NFCSTORE ilovasi (iPhone va Android) yoki nfcstore.uz sayti bo'yicha savol, muammo yoki shikoyat bo'lsa — quyidagi kanallardan biriga yozing.",
    telegram: 'Telegram',
    telegramNote: 'Eng tez javob shu yerda.',
    phone: 'Telefon',
    phoneNote: "Qo'ng'iroq yoki SMS.",
    form: 'Ilova ichidagi murojaat',
    formNote: "Ilovada: Sozlamalar → Yordam. Saytda: Kabinet → «Adminga murojaat». Javob shu yerning o'zida ko'rinadi.",
    formCta: 'Kabinetni ochish',
    sections: [
      { h: 'Nomaqbul kontent yoki foydalanuvchi haqida xabar berish', p: "Har bir profil, post, Reels, istoriya, izoh va biznes sahifasida «Shikoyat qilish» tugmasi bor; istalgan foydalanuvchi yoki biznesni «Bloklash» mumkin. Shikoyatlarni moderator ko'rib chiqadi: qoidabuzar kontent o'chiriladi, qoidabuzarning hisobi bloklanishi mumkin. Batafsil — Foydalanish shartlarining 6-bo'limida." },
      { h: 'Hisob', p: "Kirishda muammo bo'lsa yoki hisobingizni o'chirmoqchi bo'lsangiz — yuqoridagi kanallarga yozing. Hisobni o'zingiz ham o'chirishingiz mumkin: ilovada Sozlamalar → Xavfsizlik → «Hisobni o'chirish» yoki saytda «Hisobni o'chirish» sahifasida." },
    ],
    links: [['Foydalanish shartlari', '/shartlar'], ['Maxfiylik siyosati', '/privacy'], ["Hisobni o'chirish", '/delete-account'], ['Savollar', '/savollar']],
  },
  ru: {
    kicker: 'Помощь',
    title: 'Поддержка',
    intro: 'Если у вас вопрос, проблема или жалоба по приложению NFCSTORE (iPhone и Android) или сайту nfcstore.uz — напишите в любой из каналов ниже.',
    telegram: 'Telegram',
    telegramNote: 'Здесь отвечаем быстрее всего.',
    phone: 'Телефон',
    phoneNote: 'Звонок или SMS.',
    form: 'Обращение в приложении',
    formNote: 'В приложении: Настройки → Поддержка. На сайте: Кабинет → «Обращение к администратору». Ответ появится там же.',
    formCta: 'Открыть кабинет',
    sections: [
      { h: 'Сообщить о недопустимом контенте или пользователе', p: 'На каждом профиле, посте, Reels, истории, комментарии и странице бизнеса есть кнопка «Пожаловаться»; любого пользователя или бизнес можно «Заблокировать». Жалобы рассматривает модератор: нарушающий контент удаляется, аккаунт нарушителя может быть заблокирован. Подробнее — в разделе 6 Условий использования.' },
      { h: 'Аккаунт', p: 'Если не получается войти или вы хотите удалить аккаунт — напишите в каналы выше. Удалить аккаунт можно и самостоятельно: в приложении Настройки → Безопасность → «Удалить аккаунт» или на сайте на странице «Удаление аккаунта».' },
    ],
    links: [['Условия использования', '/shartlar'], ['Политика конфиденциальности', '/privacy'], ['Удаление аккаунта', '/delete-account'], ['Вопросы', '/savollar']],
  },
  en: {
    kicker: 'Help',
    title: 'Support',
    intro: 'If you have a question, a problem or a complaint about the NFCSTORE app (iPhone and Android) or the nfcstore.uz website, write to us on any of the channels below.',
    telegram: 'Telegram',
    telegramNote: 'The fastest way to reach us.',
    phone: 'Phone',
    phoneNote: 'Call or SMS.',
    form: 'In-app support form',
    formNote: 'In the app: Settings → Support. On the website: Dashboard → “Contact admin”. The reply appears in the same place.',
    formCta: 'Open dashboard',
    sections: [
      { h: 'Report objectionable content or a user', p: 'Every profile, post, Reel, story, comment and business page has a “Report” button, and any user or business can be blocked with “Block”. Reports are reviewed by a moderator: violating content is removed and the offender’s account may be suspended. See section 6 of the Terms of Use for details.' },
      { h: 'Account', p: 'If you cannot sign in or want your account deleted, write to us on the channels above. You can also delete your account yourself: in the app Settings → Security → “Delete account”, or on the website on the “Delete account” page.' },
    ],
    links: [['Terms of Use', '/shartlar'], ['Privacy Policy', '/privacy'], ['Delete account', '/delete-account'], ['FAQ', '/savollar']],
  },
};

const CARD = 'flex flex-col rounded-2xl border border-[color:var(--vz-line)] bg-base-200/60 p-6 transition-all hover:-translate-y-0.5 hover:border-[color:var(--vz-ink-dim)]';

export default function SupportPage() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.uz;
  return (
    <main className="mx-auto w-full max-w-[1800px] px-4 pb-16 sm:px-10 lg:px-14">
      <div className="mx-auto max-w-3xl">
        <span className="vz-kicker mt-14">{c.kicker}</span>
        <h1 className="vz-h1 mt-3">{c.title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-base-content/70">{c.intro}</p>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <a href={TELEGRAM.href} target="_blank" rel="noreferrer" className={CARD}>
            <IconTelegram width="26" height="26" />
            <h2 className="mt-4 font-semibold text-base-content">{c.telegram}</h2>
            <p className="mt-1 text-sm text-base-content/70 underline-offset-4 hover:underline">{TELEGRAM.value}</p>
            <p className="mt-2 text-xs text-base-content/50">{c.telegramNote}</p>
          </a>
          <a href={PHONE.href} className={CARD}>
            <IconPhone width="26" height="26" />
            <h2 className="mt-4 font-semibold text-base-content">{c.phone}</h2>
            <p className="mt-1 text-sm text-base-content/70 underline-offset-4 hover:underline">{PHONE.value}</p>
            <p className="mt-2 text-xs text-base-content/50">{c.phoneNote}</p>
          </a>
          {/* Tugma ichida faqat "phrasing" elementlar (h2/p emas) — HTML qoidasi. */}
          <button type="button" onClick={() => navigate('/account')} className={`${CARD} text-left`}>
            <IconSupport width="26" height="26" />
            <span className="mt-4 block text-base font-semibold text-base-content">{c.form}</span>
            <span className="mt-1 block text-sm text-base-content/70">{c.formNote}</span>
            <span className="mt-2 block text-xs font-semibold text-base-content/60">{c.formCta} →</span>
          </button>
        </section>

        <div className="mt-10 space-y-6 break-words text-[15px] leading-relaxed text-base-content/70">
          {c.sections.map((s) => (
            <div key={s.h}>
              <h2 className="font-display text-lg font-bold text-base-content">{s.h}</h2>
              <p className="mt-1.5">{s.p}</p>
            </div>
          ))}
        </div>

        <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-1 border-t border-[color:var(--vz-line)] pt-5">
          {c.links.map(([label, href]) => (
            <button
              key={href}
              type="button"
              onClick={() => navigate(href)}
              className="flex min-h-11 items-center text-[15px] text-base-content/70 underline-offset-4 hover:text-base-content hover:underline"
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
