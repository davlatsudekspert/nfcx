import { useEffect, useState } from 'react';
import { listPublicCompanies } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// BOSH SAHIFA: NAMUNA BIZNESLAR KARUSELI (2026-09-26)
//
// Egasi: "odam kirganda ko'rinadigan joyga joylansin" — tanlangan
// variant: bosh sahifada karusel. Namunalar (`demo: true`,
// hosting/api/demo-businesses.js) yonma-yon suriladigan kartochkalarda;
// bosilsa profil ochiladi. Namunalar yo'q bo'lsa (admin o'chirgan) —
// bo'lim umuman chizilmaydi.
// ═══════════════════════════════════════════════════════════════════════

/// `compact` — Kompaniyalar sahifasi uchun: qisqa sarlavha, tavsif va
/// tugmalarsiz, sahifa chetiga chiqmaydi. `fallback` — namunalar yo'q
/// bo'lsa (admin o'chirgan) o'rniga chiziladigan narsa.
/// `tight` — bosh sahifa hero'si ichida: tepadagi bo'shliq kichik, sarlavha
/// ixchamroq — namunalar birinchi ekranda ko'rinsin (egasi, 2026-09-26:
/// "pastda ko'rinmay turgan biznes profillarni teparoqqa chiqar").
export default function SampleBusinessesStrip({ compact = false, fallback = null, tight = false }) {
  const { t } = useLanguage();
  const [items, setItems] = useState(null);

  useEffect(() => {
    let alive = true;
    listPublicCompanies()
      .then((list) => { if (alive) setItems((list || []).filter((c) => c.demo)); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, []);

  if (!items) return null;
  if (items.length === 0) return fallback;

  const open = (id) => navigate(`/c/${String(id).toLowerCase()}`);

  return (
    <section id={compact ? 'namuna-profillar' : 'namuna-bizneslar'} className={compact ? 'mt-7 text-left' : tight ? 'relative z-[2] mt-2 md:mt-4 lg:mt-0' : 'mt-12 md:mt-16'} aria-labelledby="namuna-bizneslar-title">
      {compact ? (
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="namuna-bizneslar-title" className="text-[18px] font-bold text-[color:var(--vz-ink)] sm:text-[20px]">{t('Namuna profillar')}</h2>
          <span className="hidden text-[12.5px] text-[color:var(--vz-ink-3)] sm:inline">{t('Biznesingiz sahifasi shunday bo‘ladi')} →</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id="namuna-bizneslar-title" className={tight ? 'font-display text-[26px] font-semibold leading-tight text-[color:var(--vz-ink)] sm:text-[30px]' : 'vz-h2 text-[color:var(--vz-ink)]'}>{t('Bizneslar NFCSTORE’da qanday ko‘rinadi')}</h2>
            {tight ? (
              // Bosh sahifada — bitta qisqa, jalb qiluvchi qator (egasi,
              // 2026-09-26: "motivatsiya qiladigan jumla qo'shaylik").
              <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">
                {t('Biznesingiz uchun tayyor mini-sayt: menyu, narxlar, ish vaqti, manzil va postlar — saytda ham, ilovada ham.')}
              </p>
            ) : (
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">
                {t('Har sohadan namuna profillar: menyu, narxlar, ish vaqti va postlar. Birini oching — biznesingiz sahifasi ham shunday bo‘ladi.')}
              </p>
            )}
          </div>
          <button type="button" onClick={() => navigate('/kompaniyalar')} className="shrink-0 text-[14px] font-bold text-[color:var(--accent-text)]">
            {t('Hammasi')} →
          </button>
        </div>
      )}

      <div className={compact
        ? 'mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3'
        : `-mx-6 ${tight ? 'mt-3' : 'mt-6'} flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-3 sm:-mx-10 sm:scroll-px-10 sm:px-10 lg:-mx-14 lg:scroll-px-14 lg:px-14`} style={{ scrollbarWidth: 'thin' }}>
        {items.map((c) => (
          <button
            key={c.companyId}
            type="button"
            onClick={() => open(c.companyId)}
            className={`vz-card group relative shrink-0 snap-start overflow-hidden p-0 text-left transition-transform duration-300 hover:-translate-y-1 ${compact ? 'w-[208px] sm:w-[232px]' : 'w-[248px] sm:w-[272px]'}`}
            aria-label={`${c.displayName} — ${t('Namuna')}`}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--vz-card-2)]">
              {c.coverUrl && (
                <img src={c.coverUrl} alt="" loading="lazy" decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              )}
              <span className="absolute left-3 top-3 rounded-full border border-dashed border-[color:var(--accent-primary)] bg-black/55 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[.12em] text-[color:var(--accent-text)] backdrop-blur-sm">
                {t('Namuna')}
              </span>
            </div>
            <div className="flex items-center gap-3 p-4">
              <span className="-mt-10 h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[color:var(--accent-primary)] bg-[var(--vz-card)] shadow-lg">
                {c.logoUrl && <img src={c.logoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-bold text-[color:var(--vz-ink)]">{c.displayName}</span>
                <span className="block truncate text-[13px] text-[color:var(--vz-ink-3)]">{c.subcategory || c.city}</span>
              </span>
            </div>
          </button>
        ))}
      </div>

      {!compact && (
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button type="button" onClick={() => navigate('/company/create')} className="btn btn-gold">
            {t('O‘z biznesingizni oching — bepul')}
          </button>
          {/* AFZALLIKLAR — odamni harakatga undaydigan qisqa va'dalar. */}
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-[color:var(--vz-ink-2)]">
            {['5 daqiqada tayyor', 'Mijoz NFC yoki QR orqali bir tegishda ochadi', 'Ilovada ham ko‘rinadi', 'Katalog va buyurtmalar bir joyda'].map((x) => (
              <li key={x} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--accent-a14)] text-[11px] font-bold text-[color:var(--accent-text)]">✓</span>
                {t(x)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
