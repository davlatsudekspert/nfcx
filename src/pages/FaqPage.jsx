import { useState } from 'react';
import { fmt } from '../lib/format.js';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';

export default function FaqPage({ catalog }) {
  const [openFaq, setOpenFaq] = useState(0);
  const items = [
    { q: "Raqamli tashrif qog'ozini sotib olgach o'zgartirsa bo'ladimi?", a: "Ha! Akkaunt yaratsangiz, raqamli tashrif qog'ozingiz profilingizga biriktiriladi va uni /account sahifasidan istalgan vaqt tahrirlaysiz: ism, kasb, rasm, ijtimoiy tarmoqlar, profil mavzusi va boshqalar." },
    { q: 'Narx qanday hisoblanadi?', a: "NFC ID'ning narxi bandlangan soniga emas, faqat undagi harf/raqam naqshiga bog'liq: Tekin (naqshsiz), Silver (99 000 so'm), Gold (149 000 so'm), Premium (199 000 so'm) va Ekslyuziv (faqat auksion orqali) — narx doim qat'iy, o'zgarmaydi." },
    { q: "Raqamli tashrif qog'ozimni boshqa odamga bera olamanmi?", a: "Ha — endi «Sovg'a qilish» funksiyasi orqali, hech qanday to'lovsiz, qabul qiluvchining roziligi bilan egalikni o'tkazishingiz mumkin." },
    { q: "Profilim qanday ko'rinadi?", a: "Har bir raqamli tashrif qog'ozining o'z shaxsiy sahifasi bor: rasmingiz, kasbingiz, bio, kontaktlar, ijtimoiy tarmoqlar (Telegram, Instagram, Facebook, X), to'lov karta raqamingiz va tanlagan dizayn mavzuingiz bilan." },
    { q: "Bir nechta raqamli tashrif qog'oziga ega bo'lsam bo'ladimi?", a: "Ha, bitta hisobga istalgancha raqamli tashrif qog'ozi biriktirishingiz mumkin. Profilingizda boshqa raqamli tashrif qog'ozilaringiz ro'yxati ham ko'rinadi." },
    { q: "Jismoniy NFC karta ham beriladimi?", a: "Profilingiz tayyor bo'lgach, uni jismoniy NFC kartaga yozdirib, telefon bilan bir tegishda ulashishingiz mumkin." },
  ];
  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 pb-16 sm:px-10 lg:px-14">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className="max-w-3xl">
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

      {/* O'ng tarafdagi bo'sh joyni to'ldiruvchi jonli NFC vizual */}
      <div className="relative hidden pt-14 lg:block">
        <div className="sticky top-24 flex flex-col items-center gap-8">
          <div className="animate-[floatY_5.5s_ease-in-out_infinite]">
            <Interactive3DCard>
              <NfcCard code="SAV777" name="SIZNING ISMINGIZ" finish="gold" size="md" />
            </Interactive3DCard>
          </div>
          <div className="relative h-40 w-40">
            <span className="absolute inset-0 animate-[spinSlow_14s_linear_infinite] rounded-full border border-dashed border-white/15"></span>
            <span className="absolute inset-4 animate-[spinSlow_22s_linear_infinite_reverse] rounded-full border border-white/10"></span>
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-accent"></span>
          </div>
          <p className="max-w-[220px] text-center text-xs text-base-content/40">Savolingiz qolmadimi? Kartani bosib aylantiring — u ham javob beradi 🙂</p>
        </div>
      </div>
      </div>
    </main>
  );
}
