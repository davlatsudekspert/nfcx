import { IconMail, IconTelegram, IconPhone } from '../components/Icons.jsx';

export default function ContactPage() {
  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <div className="eyebrow reveal"><span className="dot"></span> Aloqa</div>
        <h1 className="reveal reveal-1">Biz bilan <span className="accent shine-text">bog'laning</span></h1>
        <p className="sub reveal reveal-2">Savol, taklif yoki muammo bo'lsa — quyidagi kanallardan istalganida yozing.</p>
      </section>
      <section>
        <div className="contact-grid">
          <div className="contact-card reveal">
            <IconTelegram width="26" height="26" style={{ color: 'var(--brass-bright)' }} />
            <h3>Telegram</h3>
            <a href="https://t.me/nfcstore_support" target="_blank" rel="noreferrer">@nfcstore_support</a>
          </div>
          <div className="contact-card reveal reveal-1">
            <IconMail width="26" height="26" style={{ color: 'var(--brass-bright)' }} />
            <h3>Email</h3>
            <a href="mailto:support@nfcstore.uz">support@nfcstore.uz</a>
          </div>
          <div className="contact-card reveal reveal-2">
            <IconPhone width="26" height="26" style={{ color: 'var(--brass-bright)' }} />
            <h3>Telefon</h3>
            <a href="tel:+998900000000">+998 90 000 00 00</a>
          </div>
        </div>
      </section>
    </main>
  );
}
