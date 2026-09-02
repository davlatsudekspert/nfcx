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

// zoomTarget: CSS `transform-origin` qiymati ("center", "top left", ...).
export default function GuideMockFrame({ variant = 'form', label, cursorX, cursorY, clickEffect, highlight, zoomTarget, accent = '#c9a227', className = '' }) {
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
        <Comp highlight={highlight} />
      </div>
      {label && (
        <div className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold text-white/85">{label}</div>
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
