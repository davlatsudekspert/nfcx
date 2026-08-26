import { navigate } from '../lib/router.js';
import NfcCard from '../components/NfcCard.jsx';

const STEPS = [
  { n: '01', title: 'Kodni tanlang va tekshiring', text: "3 harf + 3 raqamdan iborat vizitkangizni kiriting (masalan ABZ007) — bo'sh yoki bandligini shu zahoti ko'rasiz." },
  { n: '02', title: "Ro'yxatdan o'ting va bandlang", text: 'Hisob yaratasiz, narxni ko\'rasiz va bir bosishda vizitkani o\'zingizga biriktirasiz.' },
  { n: '03', title: 'Profilingizni sozlang', text: "Kabinetdan ism, kasb, rasm, bio, ijtimoiy tarmoqlar (Telegram, Instagram, Facebook, X), to'lov kartasi va dizayn mavzusini qo'shasiz." },
  { n: '04', title: 'Ulashing', text: "Profilingiz nfcstore.uz/kodingiz manzilida yashaydi — havolani ulashing yoki jismoniy NFC kartangizga yozdiring." },
  { n: '05', title: 'Xohlasangiz — soting', text: "Vizitka endi kerak bo'lmasa, uni kabinetdan sotuvga qo'yasiz. Boshqa foydalanuvchi sotib olsa, egalik unga o'tadi." },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-16">
      <section className="pt-14 text-center">
        <span className="inline-flex items-center justify-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          Qanday ishlaydi
        </span>
        <h1 className="mx-auto mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
          “Barcha ma’lumotlaringiz — bitta raqamli profilda.”
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-base-content/60">
          NFCSTORE orqali shaxsiy raqamli vizitka olish besh qadamdan iborat — bandlashdan tortib
          uni qayta sotishgacha.
        </p>
        <div className="mt-8 flex justify-center">
          <div className="animate-[floatY_5s_ease-in-out_infinite]">
            <NfcCard code="ABZ007" name="SIZNING ISMINGIZ" finish="black" size="md" />
          </div>
        </div>
      </section>

      <section className="mt-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-base-200/60 p-6 transition-colors hover:border-white/25">
              <div className="font-mono text-sm font-bold tracking-widest text-base-content/40">{s.n}</div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-base-content/55">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <button className="btn btn-primary" onClick={() => navigate('/narxlar')}>Narxlarni ko'rish</button>
        </div>
      </section>
    </main>
  );
}
