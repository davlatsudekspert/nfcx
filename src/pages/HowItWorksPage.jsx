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
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <div className="eyebrow reveal"><span className="dot"></span> Qanday ishlaydi</div>
        <h1 className="reveal reveal-1">Bir kod. <span className="accent shine-text">Bir profil.</span> Bir siz.</h1>
        <p className="sub reveal reveal-2">
          NFCSTORE orqali shaxsiy raqamli vizitka olish besh qadamdan iborat — bandlashdan tortib
          uni qayta sotishgacha.
        </p>
        <div className="hero-card-stage reveal reveal-3" style={{ padding: '10px 0 0' }}>
          <div className="floaty"><NfcCard code="ABZ007" name="SIZNING ISMINGIZ" finish="black" size="md" /></div>
        </div>
      </section>

      <section>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div className="step-card reveal" key={s.n}>
              <div className="step-num mono">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 34 }}>
          <button className="btn btn-brass pulse" onClick={() => navigate('/narxlar')}>Narxlarni ko'rish</button>
        </div>
      </section>
    </main>
  );
}
