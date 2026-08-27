import { IconMail, IconTelegram, IconPhone } from '../components/Icons.jsx';

const CHANNELS = [
  {
    icon: <IconTelegram width="26" height="26" />,
    title: 'Telegram',
    value: '@nfcstore_admin',
    href: 'https://t.me/nfcstore_admin',
  },
  {
    icon: <IconMail width="26" height="26" />,
    title: 'Email',
    value: 'support@nfcstore.uz',
    href: 'mailto:support@nfcstore.uz',
  },
  {
    icon: <IconPhone width="26" height="26" />,
    title: 'Telefon',
    value: '+998 50 090 82 77',
    href: 'tel:+998500908277',
  },
];

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          Aloqa
        </span>
        <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
          Biz bilan <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">bog'laning</span>
        </h1>
        <p className="mt-3 max-w-lg text-[15px] text-base-content/60">Savol, taklif yoki muammo bo'lsa — quyidagi kanallardan istalganida yozing.</p>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {CHANNELS.map((c) => (
          <a
            key={c.title}
            href={c.href}
            target={c.href.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-base-200/60 p-6 transition-all hover:-translate-y-0.5 hover:border-white/25"
          >
            <div className="text-base-content">{c.icon}</div>
            <h3 className="mt-4 font-semibold">{c.title}</h3>
            <p className="mt-1 text-sm text-base-content/60 underline-offset-4 hover:underline">{c.value}</p>
          </a>
        ))}
      </section>
    </main>
  );
}
