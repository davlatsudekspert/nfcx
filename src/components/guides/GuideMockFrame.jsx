import { useLanguage } from '../../lib/i18n.jsx';

// "Qo'llanma" bo'limi uchun sxematik (mock) ekran ko'rinishi.
//
// MUHIM: bu yerda HECH QANDAY real NFCSTORE production screenshot
// ishlatilmagan — barcha shakllar quyida oddiy <div>/border bilan qo'lda
// chizilgan, mavhum "interfeys eskizi". Sabab: darslar orasida haqiqiy
// tarmoq/hisob ma'lumotlarini o'z ichiga olgan screenshot ishlatish (yoki
// production'da real mutatsiya qilib screenshot olish) xavfli/keraksiz —
// buning o'rniga umumiy "qanday ishlaydi" g'oyasini ko'rsatuvchi neytral
// eskiz yetarli. Keyinchalik shu `variant` qiymatlarini real screenshot
// URL'lariga almashtirish mumkin — GuideViewer/frame ma'lumotlar shakli
// o'zgarmaydi.
const VARIANTS = {
  form: FormMock,
  dashboard: DashboardMock,
  grid: GridMock,
  card: CardMock,
  tap: TapMock,
  qr: QrMock,
  companyForm: CompanyFormMock,
  companyTabs: CompanyTabsMock,
  companyPublic: CompanyPublicMock,
};

// `highlight` — joriy frame'ning `highlight` maydoni bilan mos keladigan
// qismga oltin rangli halqa (ring) qo'shadi. Faqat vizual urg'u — matn
// ma'nosini o'zgartirmaydi.
const hl = (highlight, part) => (highlight === part ? 'ring-2 ring-[var(--mock-accent)] ring-offset-2 ring-offset-base-100' : '');

function FormMock({ highlight }) {
  return (
    <div className="flex h-full flex-col gap-3 p-6">
      <div className={`h-3 w-24 rounded-full bg-white/15 ${hl(highlight, 'topbar')}`} />
      <div className="mt-4 h-8 w-full rounded-lg border border-white/10 bg-white/5" />
      <div className="h-8 w-full rounded-lg border border-white/10 bg-white/5" />
      <div className="mt-2 h-9 w-32 rounded-lg bg-[var(--mock-accent)]/80" />
    </div>
  );
}

function DashboardMock({ highlight }) {
  return (
    <div className="flex h-full flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded-full bg-white/15" />
        <div className={`h-6 w-6 rounded-full bg-[var(--mock-accent)]/70 ${hl(highlight, 'topbar')}`} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="h-14 rounded-lg border border-white/10 bg-white/5" />
        <div className="h-14 rounded-lg border border-white/10 bg-white/5" />
        <div className="h-14 rounded-lg border border-white/10 bg-white/5" />
      </div>
      <div className="mt-2 h-16 w-full rounded-lg border border-white/10 bg-white/5" />
    </div>
  );
}

function GridMock({ highlight }) {
  return (
    <div className="grid h-full grid-cols-2 gap-2.5 p-6">
      {[0, 1, 2, 3].map((i) => {
        const part = i === 1 ? 'card-2' : `card-${i}`;
        return (
          <div
            key={i}
            className={`rounded-xl border p-2.5 ${i === 1 ? 'border-[var(--mock-accent)]/60 bg-[var(--mock-accent)]/10' : 'border-white/10 bg-white/5'} ${hl(highlight, part)}`}
          >
            <div className="h-2.5 w-10 rounded-full bg-white/20" />
            <div className="mt-2 h-2 w-14 rounded-full bg-white/10" />
          </div>
        );
      })}
    </div>
  );
}

function CardMock({ highlight }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-[220px] rounded-xl border border-white/10 bg-white/5 p-4">
        <div className={`h-10 w-10 rounded-full bg-[var(--mock-accent)]/70 ${hl(highlight, 'avatar')}`} />
        <div className="mt-3 h-2.5 w-20 rounded-full bg-white/20" />
        <div className="mt-2 h-2 w-28 rounded-full bg-white/10" />
        <div className={`mt-3 h-6 w-16 rounded-md bg-white/10 ${hl(highlight, 'price')}`} />
      </div>
    </div>
  );
}

function QrMock({ highlight }) {
  // Sof CSS "soxta QR" naqshi — haqiqiy skanerlanadigan kod emas, faqat
  // "bu yerda QR kod bo'ladi" g'oyasini ko'rsatuvchi vizual eskiz.
  const cells = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1];
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className={`grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-white/5 p-4 ${hl(highlight, 'qr')}`}>
        {cells.map((on, i) => (
          <span key={i} className={`h-4 w-4 rounded-sm ${on ? 'bg-[var(--mock-accent)]' : 'bg-white/10'}`} />
        ))}
      </div>
    </div>
  );
}

function TapMock({ highlight }) {
  return (
    <div className="relative flex h-full items-center justify-center">
      <div className="h-24 w-14 rounded-xl border-2 border-white/25" />
      <div className={`absolute h-16 w-28 -translate-y-6 rounded-2xl border border-dashed border-[var(--mock-accent)]/70 ${hl(highlight, 'nfc-zone')}`} />
    </div>
  );
}

// Kompaniya tizimi (CompanyCreatePage/CompanyWorkspacePage — faqat
// production D1 Worker'da mavjud, shu bois mahalliy sinov muhitida haqiqiy
// skrinshot olib bo'lmaydi) uchun 3 ta qo'shimcha mock — lekin ichidagi
// barcha maydon nomlari REAL kod (CompanyCreatePage.jsx/CompanyWorkspacePage.jsx)
// dan tekshirilgan haqiqiy matnlar, o'ylab topilmagan.
// Kompaniya mock'lari uchun qiymat render qiluvchi yordamchi — narx
// `{ som: 250000 }` shaklida bo'lsa "250 000 <so'm/сум/UZS>" qilib
// yig'adi (raqam o'zgarmaydi, faqat valyuta so'zi t() orqali tarjima
// qilinadi), aks holda oddiy matnni to'g'ridan-to'g'ri t() orqali
// o'tkazadi (masalan "Kelishiladi" yoki mahsulot nomi — proper noun
// bo'lsa, DICT'da yozuv yo'q, t() asl matnni o'zgarishsiz qaytaradi).
function mockValue(t, v) {
  if (v && typeof v === 'object' && typeof v.som === 'number') {
    return `${v.som.toLocaleString('uz-UZ')} ${t("so'm")}`;
  }
  return t(v);
}

function CompanyFormMock({ data }) {
  const { t } = useLanguage();
  const d = data || {};
  return (
    <div className="flex h-full flex-col gap-2.5 p-6">
      <div className="text-[14px] font-bold uppercase tracking-widest text-[var(--mock-accent)]">{t('COMPANY ID')}</div>
      <div className="flex h-8 items-center rounded-lg border border-[var(--mock-accent)]/50 bg-white/5 px-3 font-mono text-xs text-white/80">
        nfcstore.uz/c/{d.companyId || 'DEMOSHOP'}
      </div>
      {(d.fields || []).map((f, i) => (
        <div key={i} className={`flex h-8 items-center justify-between rounded-lg border px-3 text-xs ${f.focus ? 'border-[var(--mock-accent)] ring-1 ring-[var(--mock-accent)]/50' : 'border-white/10'} bg-white/5`}>
          <span className="text-white/40">{t(f.label)}</span>
          <span className="font-semibold text-white/80">{mockValue(t, f.value)}</span>
        </div>
      ))}
      <div className="mt-1 h-8 w-full rounded-lg bg-[var(--mock-accent)]/80" />
    </div>
  );
}

function CompanyTabsMock({ data }) {
  const { t } = useLanguage();
  const d = data || {};
  const tabs = d.tabs || ['Boshqaruv', 'Profil', 'Katalog', 'Aloqa', 'Sozlamalar'];
  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex gap-1 overflow-hidden rounded-lg border border-white/10 bg-black/20 p-1">
        {tabs.map((tb) => (
          <div key={tb} className={`rounded-md px-2.5 py-1 text-[13px] font-semibold ${tb === d.activeTab ? 'bg-[var(--mock-accent)] text-black' : 'text-white/50'}`}>{t(tb)}</div>
        ))}
      </div>
      <div className="mt-3 text-[14px] font-bold text-white/70">{t(d.panelTitle || 'Kompaniya profili')}</div>
      <div className="mt-2 flex-1 space-y-2">
        {(d.rows || []).map((r, i) => (
          <div key={i} className="flex h-7 items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 text-[14px]">
            <span className="text-white/40">{t(r.label)}</span>
            <span className="text-white/75">{mockValue(t, r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyPublicMock({ data }) {
  const { t } = useLanguage();
  const d = data || {};
  return (
    <div className="flex h-full items-center justify-center gap-5 p-6">
      <div className="flex h-[85%] w-[46%] flex-col rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="h-12 w-12 rounded-lg bg-[var(--mock-accent)]/70" />
        <div className="mt-2 h-2.5 w-20 rounded-full bg-white/25" />
        <div className="mt-1.5 h-2 w-14 rounded-full bg-white/10" />
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-8 rounded-md bg-white/5" />)}
        </div>
      </div>
      <div className="flex h-full flex-1 flex-col justify-center gap-2">
        <div className="text-[13px] font-bold uppercase tracking-widest text-[var(--mock-accent)]">{t(d.categoryLabel || 'Mahsulotlar')}</div>
        {(d.items || []).map((it, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[14px]">
            <span className="text-white/75">{t(it.name)}</span>
            <span className="font-semibold text-[var(--mock-accent)]">{mockValue(t, it.price)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// zoomTarget: CSS `transform-origin` qiymati ("center", "top left", ...).
export default function GuideMockFrame({ variant = 'form', label, cursorX, cursorY, clickEffect, highlight, zoomTarget, data, accent = '#c9a227', className = '' }) {
  const Comp = VARIANTS[variant] || VARIANTS.form;
  return (
    <div
      className={`qollanma-mockframe relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-base-100 ${className}`}
      style={{ '--mock-accent': accent }}
    >
      <div
        className="absolute inset-0 transition-transform duration-500 ease-out"
        style={zoomTarget ? { transform: 'scale(1.3)', transformOrigin: zoomTarget } : undefined}
      >
        <Comp highlight={highlight} data={data} />
      </div>
      {label && (
        <div className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[13px] font-semibold text-white/85">{label}</div>
      )}
      {cursorX != null && cursorY != null && (
        <div
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: `${cursorX}%`, top: `${cursorY}%` }}
        >
          <div className="h-full w-full rounded-full border-2 border-white/90 bg-black/50 shadow-lg" />
          {clickEffect && <span className="absolute inset-0 animate-ping rounded-full bg-white/60" />}
        </div>
      )}
    </div>
  );
}
