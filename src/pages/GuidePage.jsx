import { useMemo, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { GUIDES, GUIDE_CATEGORIES } from '../lib/guides.js';
import GuideCard from '../components/guides/GuideCard.jsx';
import GuideViewer from '../components/guides/GuideViewer.jsx';

// /qollanma — NFCSTORE o'quv markazi. TO'LIQ frontend-only: hech qanday
// D1/Worker/R2 chaqiruvi yo'q, kontent src/lib/guides.js'dagi structured
// datadan olinadi. Mavjud auth/profil/auksion/pricing logikasiga hech
// qanday yozuv/ta'sir yo'q.
//
// 2026-09 QAYTA DIZAYN: sahifa saytning qolgan qismidagi Black & Gold
// tiliga o'tkazildi — `.vz-kicker` / `.vz-h1` / `.vz-h2` / `.vz-lead`,
// oltin urg'u va katalog bilan bir xil qidiruv/filtr uslubi. Avval bu
// yerda alohida `text-4xl font-extrabold` sarlavha, oq gradient va 36px
// filtr tugmalari ishlatilardi — sayt yangilangach, faqat shu sahifa
// eski ko'rinishda qolib ketgan edi. Filtr tugmalari endi 44px (telefonda
// barmoq bilan aniq bosiladi).
//
// Yuqorida — "qanday ishlatish" uchun uch qadamli qisqa yo'riqnoma:
// qo'llanmaga birinchi marta kirgan odam nima qilishini darhol tushunsin.
export default function GuidePage() {
  const { t } = useLanguage();
  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null); // ochiq GuideViewer uchun tanlangan dars

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return GUIDES
      .filter((g) => category === 'all' || g.category === category)
      .filter((g) => !query || g.title.toLowerCase().includes(query) || g.description.toLowerCase().includes(query))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [category, q]);

  const totalMin = GUIDES.reduce((s, g) => s + (g.durationMin || 0), 0);

  const HOW = [
    ['01', t('Darsni tanlang'), t('Har bir dars — bitta aniq vazifa. Boshidan boshlang yoki kerakligini qidiring.')],
    ['02', t('Qadamma-qadam ko‘ring'), t('Har bir qadam haqiqiy ekran rasmi bilan ko‘rsatiladi. To‘xtatish, orqaga qaytish va sekin ko‘rish mumkin.')],
    ['03', t('O‘zingiz takrorlang'), t('Darsni yoningizda ochiq qoldiring va xuddi shu qadamlarni o‘z profilingizda bajaring.')],
  ];

  return (
    <main className="qollanma-page mx-auto w-full max-w-[1800px] px-6 pb-20 sm:px-10 lg:px-14">
      <section className="pt-10 text-center">
        <span className="vz-kicker">{t('Qo‘llanma')}</span>
        <h1 className="vz-h1 mx-auto mt-4 max-w-3xl">
          {t("NFCSTORE'dan foydalanishni")} <span className="text-[var(--vz-gold-2)]">{t('o‘rganing')}</span>
        </h1>
        <p className="vz-lead mx-auto mt-3 max-w-2xl">
          {t("Profil yaratishdan NFC kartadan foydalanishgacha — barcha imkoniyatlarni bosqichma-bosqich o'rganing.")}
        </p>
        <p className="mt-3 font-mono text-xs tracking-wider text-base-content/45">
          {t('{n} ta dars', { n: GUIDES.length })} · {t('jami ~{n} daqiqa', { n: totalMin })}
        </p>

        <div className="mx-auto mt-6 flex max-w-md items-center rounded-lg border border-white/15 bg-black/40 focus-within:border-[var(--vz-gold)]">
          <span className="shrink-0 pl-3 font-mono text-xs text-base-content/40">{t('qidirish')}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Qaysi mavzu bo‘yicha yordam kerak?')}
            autoComplete="off"
            aria-label={t('qidirish')}
            className="min-h-11 w-full min-w-0 bg-transparent px-2 py-3 text-sm outline-none"
          />
        </div>
      </section>

      {/* Uch qadamli yo'riqnoma — qo'llanmani QANDAY ishlatishni tushuntiradi.
          Qidiruv yozilganda yashiriladi: odam aniq narsa qidirayotganda
          bu blok faqat xalaqit beradi. */}
      {!q.trim() && (
        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {HOW.map(([num, title, text]) => (
            <div key={num} className="rounded-2xl border border-white/10 bg-base-200/40 p-5 text-left">
              <div className="font-mono text-[13px] font-bold tracking-widest text-[var(--vz-gold-2)]">{num}</div>
              <div className="font-display mt-2 text-[17px] font-semibold">{title}</div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-base-content/55">{text}</p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="text-left">
            <div className="vz-kicker">{t('Darslar')}</div>
            <h2 className="vz-h2 mt-2">
              {t('Barcha darslar')} <span className="text-base font-normal text-base-content/40">({filtered.length})</span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GUIDE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={`min-h-11 rounded-full border px-3.5 py-1.5 text-[16px] font-semibold transition ${category === c.id ? 'border-accent bg-accent/10 text-accent' : 'border-white/12 text-base-content/60 hover:border-white/25'}`}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="qollanma-grid mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 && (
            <div className="vz-empty col-span-full">
              <b>{t('Hech narsa topilmadi.')}</b>
              <button type="button" className="btn btn-outline-gold btn-sm mt-2" onClick={() => { setQ(''); setCategory('all'); }}>
                {t('Filtrlarni tozalash')}
              </button>
            </div>
          )}
          {filtered.map((g) => (
            <GuideCard key={g.id} guide={g} onOpen={setActive} />
          ))}
        </div>
      </section>

      {active && <GuideViewer guide={active} onClose={() => setActive(null)} />}
    </main>
  );
}
