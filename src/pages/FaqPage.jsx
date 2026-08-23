import { useState } from 'react';
import { fmt } from '../lib/format.js';
import { currentBase, PRICE_GROWTH } from '../lib/pricing.js';

export default function FaqPage({ catalog }) {
  const [openFaq, setOpenFaq] = useState(0);
  const items = [
    { q: "Vizitkani sotib olgach o'zgartirsa bo'ladimi?", a: "Ha! Akkaunt yaratsangiz, vizitkangiz profilingizga biriktiriladi va uni /account sahifasidan istalgan vaqt tahrirlaysiz: ism, kasb, rasm, ijtimoiy tarmoqlar, profil mavzusi va boshqalar." },
    { q: 'Narx qanday hisoblanadi?', a: `Joriy minimal narx ${fmt(currentBase(catalog.length))} so'm va har savdoda +${Math.round(PRICE_GROWTH * 100)}%ga oshadi. Kamyob harf/raqam kombinatsiyalari (masalan bir xil harflar yoki "00") qimmatroq bo'ladi.` },
    { q: "Vizitkamni qayta sotishim mumkinmi?", a: "Ha. Kabinetda «Sotuvga qo'yish» tugmasini bosasiz — narx avtomatik joriy narxdan qimmat qilib belgilanadi. Xohlagan foydalanuvchi uni sotib olgach, vizitka uning profiliga o'tadi." },
    { q: "Profilim qanday ko'rinadi?", a: "Har bir vizitkaning o'z shaxsiy sahifasi bor: rasmingiz, kasbingiz, bio, kontaktlar, ijtimoiy tarmoqlar (Telegram, Instagram, Facebook, X), to'lov karta raqamingiz va tanlagan dizayn mavzuingiz bilan." },
    { q: 'Bir nechta vizitkaga ega bo\'lsam bo\'ladimi?', a: "Ha, bitta hisobga istalgancha vizitka biriktirishingiz mumkin. Profilingizda boshqa vizitkalaringiz ro'yxati ham ko'rinadi." },
    { q: "Jismoniy NFC karta ham beriladimi?", a: "Profilingiz tayyor bo'lgach, uni jismoniy NFC kartaga yozdirib, telefon bilan bir tegishda ulashishingiz mumkin." },
  ];
  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <div className="eyebrow reveal"><span className="dot"></span> Savollar</div>
        <h1 className="reveal reveal-1">Tez-tez so'raladigan <span className="accent shine-text">savollar</span></h1>
      </section>
      <section>
        <div className="panel glow-panel reveal" style={{ padding: '8px 28px' }}>
          {items.map((f, i) => (
            <div className={'faq-item' + (openFaq === i ? ' open' : '')} key={i}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>{f.q} <span className="x">+</span></button>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
