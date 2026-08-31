import { fmt } from '../lib/format.js';

// Jonli telefon ko'rinishi (Company System — Live Phone Preview, Faz 6/8).
// Owner Menu/Mahsulotlar tahrirlayotganda — nom yozsa, narx kiritsa, rasm
// yuklasa — bu komponent DARHOL yangilanadi (local state, backend so'rovsiz).
// Saqlash alohida (mavjud "Saqlash"/"+ Qo'shish" tugmalari orqali).

// Kategoriyalar ro'yxatiga "draft" (hozir tahrirlanayotgan/qo'shilayotgan)
// elementni jonli qo'shib/almashtirib beradi — haqiqiy saqlangan ma'lumotni
// o'zgartirmaydi, faqat preview uchun.
export function mergeDraftIntoCategories(categories, draft) {
  if (!draft || !draft.categoryId) return categories || [];
  return (categories || []).map((cat) => {
    if (String(cat.id) !== String(draft.categoryId)) return cat;
    const exists = (cat.items || []).some((it) => String(it.id) === String(draft.id));
    const items = exists
      ? cat.items.map((it) => (String(it.id) === String(draft.id) ? { ...it, ...draft } : it))
      : [...(cat.items || []), { ...draft, id: draft.id || '__draft__' }];
    return { ...cat, items };
  });
}

// Telefon ramkasi — Company owner admin ichida ishlatiladigan (kattaroq,
// haqiqiy ma'lumot bilan) versiya. CompaniesPage'dagi kichik DEMO
// telefondan farqli — bu YAKUNIY, egaga tegishli preview.
export function PhoneFrame({ children, label }) {
  return (
    <div className="mx-auto w-[280px] shrink-0 rounded-[2.2rem] border-[3px] border-white/15 bg-black/70 p-2.5 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.65)]">
      <div className="flex items-center justify-center py-1.5">
        <span className="h-1 w-10 rounded-full bg-white/20" />
      </div>
      <div className="max-h-[560px] overflow-y-auto rounded-[1.6rem] bg-base-100 p-3 text-base-content">
        {label && (
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {label}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// Menyu — ro'yxat ko'rinishi (public MenuView bilan bir xil uslub, kichikroq).
export function MenuPreviewList({ categories, t }) {
  const money = (n) => `${fmt(n)} ${t("so'm")}`;
  const shown = (categories || []).filter((c) => c.items && c.items.length > 0);
  if (shown.length === 0) {
    return <div className="py-10 text-center text-xs text-base-content/40">{t('Menyuingiz shunday ko‘rinishi mumkin')}</div>;
  }
  return (
    <div className="flex flex-col gap-4">
      {shown.map((cat) => (
        <div key={cat.id}>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-base-content/70">{cat.name}</div>
          <div className="flex flex-col gap-1.5">
            {cat.items.map((it) => (
              <div key={it.id} className={`flex gap-2 rounded-xl border border-white/10 bg-black/20 p-2 ${it.available === false ? 'opacity-45' : ''} ${it.id === '__draft__' ? 'ring-1 ring-accent/60' : ''}`}>
                {it.imageUrl && <img src={it.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 truncate text-[12px] font-bold">{it.featured && '⭐'} {it.name || t('Nomsiz')}</div>
                    {it.price != null && it.price !== '' && (
                      <div className="shrink-0 text-[11px] font-bold">
                        {it.discountPrice != null && it.discountPrice !== '' ? (
                          <><span className="mr-1 text-base-content/40 line-through">{money(it.price)}</span><span className="text-accent">{money(it.discountPrice)}</span></>
                        ) : money(it.price)}
                      </div>
                    )}
                  </div>
                  {it.description && <p className="mt-0.5 truncate text-[10.5px] text-base-content/50">{it.description}</p>}
                  {it.available === false && <div className="mt-0.5 text-[9.5px] font-semibold text-base-content/40">{t('Hozircha yo‘q')}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mahsulotlar — grid ko'rinishi (public ProductsView bilan bir xil uslub).
export function ProductsPreviewGrid({ categories, t }) {
  const money = (n) => `${fmt(n)} ${t("so'm")}`;
  const shown = (categories || []).filter((c) => c.items && c.items.length > 0);
  if (shown.length === 0) {
    return <div className="py-10 text-center text-xs text-base-content/40">{t('Katalogingiz shunday ko‘rinishi mumkin')}</div>;
  }
  return (
    <div className="flex flex-col gap-4">
      {shown.map((cat) => (
        <div key={cat.id}>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-base-content/70">{cat.name}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {cat.items.map((it) => (
              <div key={it.id} className={`overflow-hidden rounded-xl border border-white/10 bg-black/20 ${it.available === false ? 'opacity-45' : ''} ${it.id === '__draft__' ? 'ring-1 ring-accent/60' : ''}`}>
                <div className="flex aspect-square items-center justify-center bg-white/5">
                  {it.imageUrl
                    ? <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                    : <span className="px-1 text-center text-[9px] text-base-content/35">{it.name || t('Nomsiz')}</span>}
                </div>
                <div className="p-1.5">
                  <div className="truncate text-[10.5px] font-bold">{it.featured && '⭐'} {it.name || t('Nomsiz')}</div>
                  {it.price != null && it.price !== '' && (
                    <div className="mt-0.5 text-[10px] font-bold">
                      {it.discountPrice != null && it.discountPrice !== '' ? (
                        <span className="text-accent">{money(it.discountPrice)}</span>
                      ) : money(it.price)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Xizmatlar — grid ko'rinishi (public ServicesView bilan bir xil uslub).
// Products'dan farqi: narx o'rniga narx TURI (belgilangan/dan boshlab/kelishiladi).
export function ServicesPreviewList({ categories, t }) {
  const money = (n) => `${fmt(n)} ${t("so'm")}`;
  const priceLabel = (it) => {
    if (it.priceType === 'negotiable') return t('Kelishiladi');
    if (it.price == null || it.price === '') return '';
    return it.priceType === 'from' ? `${money(it.price)} ${t('dan')}` : money(it.price);
  };
  const shown = (categories || []).filter((c) => c.items && c.items.length > 0);
  if (shown.length === 0) {
    return <div className="py-10 text-center text-xs text-base-content/40">{t('Xizmatlaringiz shunday ko‘rinishi mumkin')}</div>;
  }
  return (
    <div className="flex flex-col gap-4">
      {shown.map((cat) => (
        <div key={cat.id}>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-base-content/70">{cat.name}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {cat.items.map((it) => (
              <div key={it.id} className={`overflow-hidden rounded-xl border border-white/10 bg-black/20 ${it.available === false ? 'opacity-45' : ''} ${it.id === '__draft__' ? 'ring-1 ring-accent/60' : ''}`}>
                <div className="flex aspect-square items-center justify-center bg-white/5">
                  {it.imageUrl
                    ? <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                    : <span className="px-1 text-center text-[9px] text-base-content/35">{it.name || t('Nomsiz')}</span>}
                </div>
                <div className="p-1.5">
                  <div className="truncate text-[10.5px] font-bold">{it.featured && '⭐'} {it.name || t('Nomsiz')}</div>
                  {priceLabel(it) && <div className="mt-0.5 text-[10px] font-bold">{priceLabel(it)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
