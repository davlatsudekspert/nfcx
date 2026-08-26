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
    <main className="mx-auto w-full max-w-[1800px] px-6 pb-16 sm:px-10 lg:px-14">
      <div className="mx-auto max-w-3xl">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          Savollar
        </span>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight">
          Tez-tez so'raladigan <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">savollar</span>
        </h1>
      </section>

      <section className="mt-10 space-y-3">
        {items.map((f, i) => (
          <div key={i} className={`collapse collapse-arrow rounded-2xl border border-white/10 bg-base-200/60 ${openFaq === i ? 'collapse-open' : ''}`}>
            <button
              className="collapse-title cursor-pointer pr-12 text-left font-semibold"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              {f.q}
            </button>
            <div className="collapse-content">
              <p className="text-sm leading-relaxed text-base-content/60">{f.a}</p>
            </div>
          </div>
        ))}
      </section>
      </div>
    </main>
  );
}
