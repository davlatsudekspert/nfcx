import { useEffect, useMemo, useState } from 'react';
import { AdminCard, AdminLoading, EmptyState, ForbiddenState, KpiCard, LoadError, StatusBadge } from './AdminUI.jsx';
import { useLanguage } from '../../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// MARKETPLACE / AKTIVATSIYA
//
// NFCSTORE fizik mahsulotlari (NFC karta, stiker, avtomobil stikeri)
// Uzum Market va boshqa marketplace'larda sotiladi. Bu bo'lim
// mahsulotlarni, aktivatsiya kodlarini va aktivatsiyalar tarixini
// boshqaradi.
//
// TO'LIQ KOD FAQAT BIR MARTA KO'RINADI — yaratilgan zahoti, chop
// etish va eksport uchun. Bazada faqat xesh va oxirgi 4 belgi bor,
// shuning uchun uni keyin qayta ko'rsatib BO'LMAYDI. Sahifa buni
// ochiq aytadi va yopishdan oldin ogohlantiradi.
//
// `adminApi` PROP orqali keladi, import qilinmaydi: u `AdminPage.jsx`
// ichida va bu fayl uni import qilsa aylanma bog'liqlik hosil
// bo'lardi.
// ═══════════════════════════════════════════════════════════════════════

// ── RO'YXATLAR SERVERDAN KELADI ──────────────────────────────────────
//
// Ilgari marketplace va mahsulot turlari SHU YERDA ham, backendda ham
// alohida yozilgandi. Ikkisi ajralib ketsa xato JIM bo'lardi: admin
// ro'yxatdan yangi marketplace'ni tanlaydi, backend uni tanimaydi va
// mahsulotni indamay 'uzum' deb saqlab qo'yadi.
//
// Endi manba BITTA — `hosting/api/marketplace.js`. Ro'yxat
// mahsulotlar javobida keladi. Yangi marketplace qo'shish uchun
// bu faylga TEGILMAYDI.
//
// Quyidagi zaxira faqat ro'yxat hali yuklanmagan lahza uchun:
// eski yozuvning yozuvini ko'rsatish kerak bo'lsa, `id` ning o'zi
// chiqadi — bo'sh katak emas.
const EMPTY_CATALOG = { marketplaces: [], physicalTypes: [], tiers: [] };

const STATUS_TONE = {
  new: 'muted', exported: 'info', sold: 'warning',
  activating: 'warning', activated: 'success', blocked: 'danger', expired: 'danger',
};
const SUBTABS = [
  ['dashboard', 'Statistika'],
  ['products', 'Mahsulotlar'],
  ['codes', 'Aktivatsiya kodlari'],
  ['batch', 'Batch yaratish'],
  ['orders', 'Buyurtmalar (CSV)'],
  ['history', 'Tarix'],
];

// Jurnal amali -> odamga tushunarli matn. Noma'lum amal bo'lsa
// texnik nomi ko'rsatiladi — jim yo'qolgandan ko'ra shunisi yaxshi.
const ACTION_LABEL = {
  marketplace_product_created: 'Mahsulot yaratildi',
  marketplace_product_updated: 'Mahsulot o‘zgartirildi',
  marketplace_codes_created: 'Kodlar yaratildi',
  marketplace_code_exported: 'Kod eksport qilindi',
  marketplace_marked_sold: 'Sotilgan deb belgilandi',
  marketplace_order_attached: 'Buyurtma biriktirildi',
  marketplace_orders_imported: 'Buyurtmalar CSV dan yuklandi',
  marketplace_blocked: 'Bloklandi',
  marketplace_unblocked: 'Blokdan chiqarildi',
  marketplace_expired: 'Muddati tugatildi',
  marketplace_activated: 'Faollashtirildi',
  marketplace_reassigned: 'Qayta taqsimlandi',
};

const labelOf = (list, id) => (list.find((x) => x.id === id) || { label: id }).label;

export default function MarketplaceTab({ adminApi, isManager, apiErrText }) {
  const { t } = useLanguage();
  const [sub, setSub] = useState('dashboard');
  const [products, setProducts] = useState(null);
  const [catalog, setCatalog] = useState(EMPTY_CATALOG);
  const [prodErr, setProdErr] = useState(null);

  const loadProducts = () => {
    setProdErr(null);
    return adminApi('/marketplace/products')
      .then((d) => {
        setProducts(Array.isArray(d?.products) ? d.products : []);
        // Ro'yxatlar SERVERDAN. Eski javobda `catalog` bo'lmasligi
        // mumkin (deploy oralig'i) — shunda bo'sh qoladi va
        // yozuvlar o'rniga `id` ko'rinadi, sahifa buzilmaydi.
        if (d?.catalog) setCatalog({ ...EMPTY_CATALOG, ...d.catalog });
      })
      .catch((e) => setProdErr(e));
  };
  useEffect(() => { loadProducts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div className="mk-subnav" role="tablist">
        {SUBTABS.map(([id, label]) => (
          <button
            key={id} type="button" role="tab" aria-selected={sub === id}
            className={`mk-subtab${sub === id ? ' is-on' : ''}`}
            onClick={() => setSub(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {sub === 'dashboard' && <Dashboard adminApi={adminApi} t={t} catalog={catalog} />}
      {sub === 'products' && (
        <Products
          adminApi={adminApi} t={t} isManager={isManager} apiErrText={apiErrText}
          products={products} err={prodErr} reload={loadProducts} catalog={catalog}
        />
      )}
      {sub === 'codes' && <Codes adminApi={adminApi} t={t} isManager={isManager} products={products || []} catalog={catalog} apiErrText={apiErrText} />}
      {sub === 'batch' && (isManager
        ? <Batch adminApi={adminApi} t={t} products={(products || []).filter((p) => p.active)} apiErrText={apiErrText} />
        : <ForbiddenState hint={t('Kod yaratish faqat Manager va Super Admin uchun.')} />)}
      {sub === 'history' && <History adminApi={adminApi} t={t} />}
      {sub === 'orders' && (isManager
        ? <Orders adminApi={adminApi} t={t} apiErrText={apiErrText} />
        : <ForbiddenState hint={t('Buyurtmalarni bog‘lash faqat Manager va Super Admin uchun.')} />)}
    </div>
  );
}

// ── STATISTIKA ───────────────────────────────────────────────────────
function Dashboard({ adminApi, t, catalog }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => { setErr(null); setData(null); return adminApi('/marketplace/stats').then(setData).catch(setErr); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <LoadError err={err} onRetry={load} title={t('Statistikani yuklab bo‘lmadi.')} />;
  if (!data) return <AdminLoading />;
  const c = data.counts || {};
  return (
    <div className="space-y-5">
      <div className="mk-kpis">
        <KpiCard icon="tag" label={t('Jami kod')} value={data.total ?? 0} />
        <KpiCard icon="check" label={t('Faollashtirilgan')} value={c.activated ?? 0} tone="success" />
        <KpiCard icon="bag" label={t('Sotilgan')} value={c.sold ?? 0} />
        <KpiCard icon="clipboard" label={t('Yangi')} value={c.new ?? 0} />
        <KpiCard icon="download" label={t('Eksport qilingan')} value={c.exported ?? 0} />
        <KpiCard icon="lock" label={t('Bloklangan')} value={c.blocked ?? 0} tone="danger" />
        <KpiCard icon="alert" label={t('Muddati tugagan')} value={c.expired ?? 0} tone="danger" />
        <KpiCard icon="users" label={t('Shaxsiy / Biznes')} value={`${data.profileKinds?.personal ?? 0} / ${data.profileKinds?.business ?? 0}`} />
      </div>

      {/* Jadval O'RAMSIZ qoldirilganda 360px telefonda butun sahifani
          ufqiy suradigan qilib qo'yardi (brauzerda o'lchandi: main
          360 -> 408px). Boshqa bo'limlardagi jadvallar kabi o'z
          o'ramida suriladi. */}
      <AdminCard title={t('Marketplace kesimida')}>
        {(data.byMarketplace || []).length === 0
          ? <EmptyState icon="clipboard" title={t('Hozircha ma’lumot yo‘q.')} />
          : (
            <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead><tr><th>{t('Marketplace')}</th><th className="text-right">{t('Kod')}</th></tr></thead>
              <tbody>
                {data.byMarketplace.map((m) => (
                  <tr key={m.marketplace}><td>{t(labelOf(catalog.marketplaces, m.marketplace))}</td><td className="text-right font-bold">{m.count}</td></tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
      </AdminCard>

      <AdminCard title={t('Mahsulot kesimida')}>
        {(data.byProduct || []).length === 0
          ? <EmptyState icon="clipboard" title={t('Hozircha ma’lumot yo‘q.')} />
          : (
            <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead><tr><th>SKU</th><th>{t('Nomi')}</th><th className="text-right">{t('Kod')}</th><th className="text-right">{t('Faollashtirilgan')}</th></tr></thead>
              <tbody>
                {data.byProduct.map((p) => (
                  <tr key={p.sku}>
                    <td className="font-mono text-xs">{p.sku}</td>
                    <td className="text-xs">{p.name}</td>
                    <td className="text-right">{p.count}</td>
                    <td className="text-right font-bold">{p.activated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
      </AdminCard>
    </div>
  );
}

// ── MAHSULOTLAR ──────────────────────────────────────────────────────
function Products({ adminApi, t, isManager, products, err, reload, apiErrText, catalog }) {
  const [form, setForm] = useState({ name: '', sku: '', externalSku: '', marketplace: 'uzum', physicalType: 'nfc_sticker', includedTier: 'auto', price: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async () => {
    setBusy(true); setMsg(null);
    try {
      await adminApi('/marketplace/products', { method: 'POST', body: JSON.stringify({ ...form, price: form.price === '' ? null : Number(form.price) }) });
      setForm({ name: '', sku: '', externalSku: '', marketplace: 'uzum', physicalType: 'nfc_sticker', includedTier: 'auto', price: '', description: '' });
      setMsg({ ok: true, text: t('Mahsulot qo‘shildi.') });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: e.code === 'sku_taken' ? t('Bu SKU allaqachon band.') : e.code === 'required_fields' ? t('Nomi va SKU majburiy.') : apiErrText(e, t) });
    } finally { setBusy(false); }
  };

  const toggle = async (p) => {
    try { await adminApi(`/marketplace/products/${p.id}`, { method: 'PATCH', body: JSON.stringify({ active: !p.active }) }); await reload(); }
    catch (e) { setMsg({ ok: false, text: apiErrText(e, t) }); }
  };

  // Marketplace'ning O'Z SKU si e'lon joylangandan KEYIN ma'lum
  // bo'ladi — shuning uchun uni keyin ham qo'yish/o'zgartirish
  // mumkin. Bo'sh qoldirilsa — tozalanadi.
  const setExternal = async (p) => {
    const next = window.prompt(t('Marketplace SKU (bo‘sh qoldirilsa tozalanadi):'), p.externalSku || '');
    if (next == null) return;
    try { await adminApi(`/marketplace/products/${p.id}`, { method: 'PATCH', body: JSON.stringify({ externalSku: next.trim() }) }); await reload(); }
    catch (e) { setMsg({ ok: false, text: apiErrText(e, t) }); }
  };

  return (
    <div className="space-y-5">
      {isManager && (
        <AdminCard title={t('Yangi mahsulot')}>
          <p className="mk-hint">
            {t('Mahsulot UNIVERSAL: shaxsiy yoki biznes ekanini xaridorning O‘ZI aktivatsiya paytida tanlaydi.')}
          </p>
          <div className="mk-form">
            <label><span>{t('Nomi')}</span><input className="vz-input" value={form.name} onChange={set('name')} placeholder="NFC Smart Sticker" /></label>
            <label><span>{t('SKU (ichki)')}</span><input className="vz-input font-mono uppercase" value={form.sku} onChange={set('sku')} placeholder="UZ-NFC-STICKER" /></label>
            {/* Marketplace'ning O'Z SKU si — e'lon joylangandan KEYIN
                ma'lum bo'ladi, shuning uchun bo'sh qoldirsa ham
                bo'ladi va keyin qo'shiladi. */}
            <label><span>{t('Marketplace SKU (ixtiyoriy)')}</span><input className="vz-input font-mono uppercase" value={form.externalSku} onChange={set('externalSku')} placeholder="UZUM-777001" /></label>
            <label><span>{t('Marketplace')}</span>
              <select className="vz-input" value={form.marketplace} onChange={set('marketplace')}>
                {catalog.marketplaces.map((m) => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
              </select>
            </label>
            <label><span>{t('Fizik mahsulot turi')}</span>
              <select className="vz-input" value={form.physicalType} onChange={set('physicalType')}>
                {catalog.physicalTypes.map((x) => <option key={x.id} value={x.id}>{t(x.label)}</option>)}
              </select>
            </label>
            <label><span>{t('Tarif')}</span>
              <select className="vz-input" value={form.includedTier} onChange={set('includedTier')}>
                {catalog.tiers.map((x) => <option key={x.id} value={x.id}>{t(x.label)}</option>)}
              </select>
            </label>
            <label><span>{t('Narx (ichki, ixtiyoriy)')}</span><input className="vz-input" type="number" min="0" value={form.price} onChange={set('price')} /></label>
            <label className="mk-wide"><span>{t('Tavsif (ixtiyoriy)')}</span><input className="vz-input" value={form.description} onChange={set('description')} /></label>
          </div>
          <button className="btn btn-gold mt-3 w-full sm:w-auto" disabled={busy || !form.name.trim() || !form.sku.trim()} onClick={create}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : t('Mahsulot qo‘shish')}
          </button>
          {msg && <div role="alert" className={`alert mt-3 py-2 text-xs ${msg.ok ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}
        </AdminCard>
      )}

      {err ? <LoadError err={err} onRetry={reload} title={t('Mahsulotlarni yuklab bo‘lmadi.')} />
        : !products ? <AdminLoading />
        : products.length === 0 ? <EmptyState icon="tag" title={t('Hozircha mahsulot yo‘q.')} />
        : (
          <AdminCard title={t('Mahsulotlar')} pad={false}>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead><tr><th>SKU</th><th>{t('Marketplace SKU')}</th><th>{t('Nomi')}</th><th>{t('Marketplace')}</th><th>{t('Turi')}</th><th>{t('Tarif')}</th><th>{t('Holat')}</th>{isManager && <th />}</tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs font-bold">{p.sku}</td>
                      <td className="font-mono text-xs">{p.externalSku || '—'}</td>
                      <td className="text-xs">{p.name}</td>
                      <td className="text-xs">{t(labelOf(catalog.marketplaces, p.marketplace))}</td>
                      <td className="text-xs">{t(labelOf(catalog.physicalTypes, p.physicalType))}</td>
                      <td className="text-xs uppercase">{p.includedTier}</td>
                      <td><StatusBadge tone={p.active ? 'success' : 'muted'}>{p.active ? t('Faol') : t('Nofaol')}</StatusBadge></td>
                      {isManager && (
                        <td>
                          <div className="mk-row-actions">
                            <button type="button" className="btn btn-xs" onClick={() => toggle(p)}>{p.active ? t('O‘chirish') : t('Yoqish')}</button>
                            <button type="button" className="btn btn-xs" onClick={() => setExternal(p)}>{t('Marketplace SKU')}</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>
        )}
    </div>
  );
}

// ── BATCH YARATISH ───────────────────────────────────────────────────
function Batch({ adminApi, t, products, apiErrText }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [batch, setBatch] = useState(null);

  useEffect(() => { if (!productId && products.length) setProductId(String(products[0].id)); }, [products, productId]);

  const create = async () => {
    setBusy(true); setMsg(null);
    try {
      const data = await adminApi('/marketplace/batch', {
        method: 'POST',
        body: JSON.stringify({ productId: Number(productId), quantity: Number(quantity), expiresAt: expiresAt || undefined }),
      });
      setBatch(data);
    } catch (e) { setMsg({ ok: false, text: apiErrText(e, t) }); } finally { setBusy(false); }
  };

  if (products.length === 0) {
    return <EmptyState icon="tag" title={t('Avval faol mahsulot qo‘shing.')} hint={t('Kod har doim aniq mahsulotga tegishli bo‘ladi.')} />;
  }

  if (batch) return <BatchResult batch={batch} t={t} onDone={() => setBatch(null)} />;

  return (
    <AdminCard title={t('Batch yaratish')}>
      <p className="mk-hint">
        {t('TO‘LIQ kodlar FAQAT bir marta — shu yerda — ko‘rinadi. Bazada faqat xesh saqlanadi, shuning uchun keyin ularni qayta ko‘rsatib bo‘lmaydi. Chop eting yoki CSV yuklab oling.')}
      </p>
      <div className="mk-form">
        <label><span>{t('Mahsulot')}</span>
          <select className="vz-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </label>
        <label><span>{t('Soni')}</span>
          <select className="vz-input" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
            {[10, 50, 100, 500, 1000].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label><span>{t('Amal qilish muddati (ixtiyoriy)')}</span>
          <input className="vz-input" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
      </div>
      <button className="btn btn-gold mt-3 w-full sm:w-auto" disabled={busy || !productId} onClick={create}>
        {busy ? <span className="loading loading-spinner loading-xs" /> : t('{n} ta kod yaratish', { n: quantity })}
      </button>
      {msg && <div role="alert" className="alert alert-error mt-3 py-2 text-xs"><span>{msg.text}</span></div>}
    </AdminCard>
  );
}

// ── BATCH NATIJASI: CHOP ETISH VA CSV ────────────────────────────────
function BatchResult({ batch, t, onDone }) {
  const [acked, setAcked] = useState(false);
  const codes = batch.codes || [];
  const sku = batch.product?.sku || '';

  const csv = () => {
    // Excel o'zbekcha/kirill matnni to'g'ri ochishi uchun BOM.
    const head = 'code,sku,product,marketplace,batch\n';
    const rows = codes.map((c) => [c.code, sku, batch.product?.name || '', batch.product?.marketplace || '', batch.batchId]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + head + rows], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nfcstore-${sku || 'batch'}-${batch.batchId}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const print = async () => {
    const QRCode = await import('qrcode');
    const origin = window.location.origin;
    const cards = [];
    for (const c of codes) {
      // QR ichida FAQAT sahifa manzili. Kodning O'ZI QR'ga
      // yozilmaydi: konvert ochilmasdan skanerlansa kod sizib
      // chiqardi, va u har qanday kamerada o'qiladi.
      const url = await QRCode.toDataURL(`${origin}/activate`, { margin: 1, width: 260, color: { dark: '#000000', light: '#ffffff' } });
      cards.push(`<article class="c"><h2>NFCSTORE</h2><img src="${url}" alt=""><p class="k">${c.code}</p><ol>
        <li>QR kodni skanerlang.</li><li>NFCSTORE'ga kiring yoki ro'yxatdan o'ting.</li>
        <li>Aktivatsiya kodni kiriting.</li><li>Shaxsiy yoki Biznes profilni tanlang.</li>
        <li>NFC mahsulotingiz tayyor.</li></ol></article>`);
    }
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>NFCSTORE — ${sku}</title><style>
      @page{size:A4;margin:10mm}
      *{box-sizing:border-box}
      body{margin:0;font:12px/1.45 system-ui,sans-serif;color:#000;background:#fff}
      .g{display:grid;grid-template-columns:repeat(2,1fr);gap:6mm}
      .c{border:1px dashed #999;border-radius:4mm;padding:6mm;text-align:center;break-inside:avoid;page-break-inside:avoid}
      .c h2{margin:0 0 3mm;font-size:11px;letter-spacing:.22em}
      .c img{width:34mm;height:34mm}
      .c .k{margin:3mm 0;font:700 17px/1 ui-monospace,Menlo,monospace;letter-spacing:.09em}
      .c ol{margin:0;padding-left:5mm;text-align:left;font-size:9.5px;line-height:1.5}
    </style></head><body><div class="g">${cards.join('')}</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <AdminCard title={t('{n} ta kod yaratildi', { n: codes.length })}>
      <div className="alert alert-warning py-2 text-xs" role="alert">
        <span>{t('Bu kodlar BOSHQA KO‘RSATILMAYDI. Yopishdan oldin chop eting yoki CSV yuklab oling.')}</span>
      </div>
      <div className="mk-batch-actions">
        <button type="button" className="btn btn-gold" onClick={print}>{t('Chop etish (A4)')}</button>
        <button type="button" className="btn" onClick={csv}>{t('CSV yuklab olish')}</button>
      </div>
      <div className="mk-codes">
        {codes.map((c) => <code key={c.id}>{c.code}</code>)}
      </div>
      <label className="mk-ack">
        <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
        <span>{t('Kodlarni chop etdim yoki saqlab oldim.')}</span>
      </label>
      <button type="button" className="btn mt-2 w-full sm:w-auto" disabled={!acked} onClick={onDone}>{t('Yopish')}</button>
    </AdminCard>
  );
}

// ── AKTIVATSIYA KODLARI ──────────────────────────────────────────────
function Codes({ adminApi, t, isManager, products, apiErrText, catalog }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', marketplace: '', productId: '', profileKind: '' });
  const [msg, setMsg] = useState(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    p.set('limit', '200');
    return p.toString();
  }, [filters]);

  const load = () => {
    setErr(null); setRows(null);
    return adminApi(`/marketplace/activations?${query}`)
      .then((d) => setRows(Array.isArray(d?.activations) ? d.activations : []))
      .catch(setErr);
  };
  useEffect(() => { load(); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (row, action, body) => {
    setMsg(null);
    try {
      await adminApi(`/marketplace/activations/${row.id}/${action}`, { method: 'POST', body: JSON.stringify(body || {}) });
      await load();
    } catch (e) {
      setMsg({
        ok: false,
        text: e.code === 'already_activated' ? t('Faollashtirilgan kodni o‘zgartirib bo‘lmaydi.')
          : e.code === 'device_taken' ? t('Bu chip boshqa kodga yoki odamga biriktirilgan.')
          : e.code === 'chip_token_required' ? t('Chip tokenini kiriting.')
          : apiErrText(e, t),
      });
    }
  };

  // FAOLLASHTIRILGAN KODNI QAYTA TAQSIMLASH — maxsus tasdiq va SABAB
  // bilan. Oddiy "reset" tugmasi ATAYLAB yo'q: bir bosishda odamning
  // ishlab turgan kartasi uzilib qolardi.
  const reassign = async (row) => {
    const reason = window.prompt(t('Sabab (kamida 10 belgi) — audit logga yoziladi:'));
    if (!reason || reason.trim().length < 10) return;
    if (!window.confirm(t('Bu kodni qayta taqsimlaysizmi? Xaridorning profili bog‘lanmagan holatga qaytadi.'))) return;
    await act(row, 'reassign', { confirm: true, reason: reason.trim() });
  };

  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <AdminCard title={t('Qidiruv va filtr')}>
        <div className="mk-form">
          <label className="mk-wide"><span>{t('Qidiruv')}</span>
            <input className="vz-input" value={filters.search} onChange={setF('search')} placeholder={t('Kod, SKU, buyurtma raqami yoki NFC ID')} />
          </label>
          <label><span>{t('Holat')}</span>
            <select className="vz-input" value={filters.status} onChange={setF('status')}>
              <option value="">{t('Hammasi')}</option>
              {['new', 'exported', 'sold', 'activating', 'activated', 'blocked', 'expired'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label><span>{t('Marketplace')}</span>
            <select className="vz-input" value={filters.marketplace} onChange={setF('marketplace')}>
              <option value="">{t('Hammasi')}</option>
              {catalog.marketplaces.map((m) => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
            </select>
          </label>
          <label><span>{t('Mahsulot')}</span>
            <select className="vz-input" value={filters.productId} onChange={setF('productId')}>
              <option value="">{t('Hammasi')}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku}</option>)}
            </select>
          </label>
          <label><span>{t('Profil turi')}</span>
            <select className="vz-input" value={filters.profileKind} onChange={setF('profileKind')}>
              <option value="">{t('Hammasi')}</option>
              <option value="personal">{t('Shaxsiy')}</option>
              <option value="business">{t('Biznes')}</option>
            </select>
          </label>
        </div>
        <p className="mk-hint mt-2">
          {t('Qidiruvga TO‘LIQ kod kiritsangiz aniq topiladi. Bazada to‘liq kod yo‘q — ro‘yxatda faqat oxirgi 4 belgi ko‘rinadi.')}
        </p>
      </AdminCard>

      {msg && <div role="alert" className="alert alert-error py-2 text-xs"><span>{msg.text}</span></div>}

      {err ? <LoadError err={err} onRetry={load} title={t('Kodlarni yuklab bo‘lmadi.')} />
        : !rows ? <AdminLoading />
        : rows.length === 0 ? <EmptyState icon="clipboard" title={t('Hech narsa topilmadi.')} />
        : (
          <AdminCard title={t('{n} ta yozuv', { n: rows.length })} pad={false}>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>{t('Kod')}</th><th>SKU</th><th>{t('Marketplace')}</th><th>{t('Qurilma')}</th>
                    <th>{t('Holat')}</th><th>{t('Buyurtma')}</th><th>{t('Foydalanuvchi')}</th>
                    <th>{t('Profil')}</th><th>{t('NFC ID')}</th>{isManager && <th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs font-bold">{r.codeMasked}</td>
                      <td className="font-mono text-xs">{r.sku}</td>
                      <td className="text-xs">{t(labelOf(catalog.marketplaces, r.marketplace))}</td>
                      <td className="font-mono text-xs">{r.deviceTokenTail ? `…${r.deviceTokenTail}` : '—'}</td>
                      <td><StatusBadge tone={STATUS_TONE[r.status] || 'muted'}>{r.status}</StatusBadge></td>
                      <td className="text-xs">{r.marketplaceOrderId || '—'}</td>
                      <td className="text-xs">{r.activatedByEmail || '—'}</td>
                      <td className="text-xs">{r.profileKind === 'business' ? t('Biznes') : r.profileKind === 'personal' ? t('Shaxsiy') : '—'}</td>
                      <td className="font-mono text-xs">{r.profileCode || '—'}</td>
                      {isManager && (
                        <td>
                          <div className="mk-row-actions">
                            {r.status === 'activated' ? (
                              <button type="button" className="btn btn-xs btn-outline" onClick={() => reassign(r)}>{t('Qayta taqsimlash')}</button>
                            ) : (
                              <>
                                {r.status === 'blocked'
                                  ? <button type="button" className="btn btn-xs" onClick={() => act(r, 'unblock')}>{t('Blokdan chiqarish')}</button>
                                  : <button type="button" className="btn btn-xs" onClick={() => act(r, 'block')}>{t('Bloklash')}</button>}
                                {['new', 'exported'].includes(r.status) && (
                                  <button type="button" className="btn btn-xs" onClick={() => act(r, 'mark-sold')}>{t('Sotildi')}</button>
                                )}
                                {r.status === 'new' && (
                                  <button type="button" className="btn btn-xs" onClick={() => act(r, 'mark-exported')}>{t('Eksport qilindi')}</button>
                                )}
                                <button
                                  type="button" className="btn btn-xs"
                                  onClick={() => {
                                    const orderId = window.prompt(t('Marketplace buyurtma raqami:'), r.marketplaceOrderId || '');
                                    if (orderId == null) return;
                                    act(r, 'attach-order', { marketplaceOrderId: orderId.trim() });
                                  }}
                                >
                                  {t('Buyurtma')}
                                </button>
                                {/* CHIP TOKENI — stiker qaysi kodga
                                    solinganini yozib qo'yadi. Usiz
                                    faollashtirilgan mahsulot
                                    tegizilganda hech qayerga olib
                                    bormaydi. */}
                                <button
                                  type="button" className="btn btn-xs"
                                  onClick={() => {
                                    const token = window.prompt(t('Chip tokeni (stikerdagi):'), '');
                                    if (token == null || !token.trim()) return;
                                    act(r, 'attach-device', { chipToken: token.trim() });
                                  }}
                                >
                                  {t('Qurilma')}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>
        )}
    </div>
  );
}

// ── MARKETPLACE BUYURTMALARI (CSV) ───────────────────────────────────
//
// Uzum'ning API si hali yo'q. Bog'lanish QO'LDA boshlanadi: omborchi
// qaysi kodni qaysi buyurtmaga solganini yozib boradi, o'sha ro'yxat
// shu yerga tushadi.
//
// CSV BRAUZERDA o'qiladi va qatorlar sifatida yuboriladi — fayl
// serverga YUKLANMAYDI. Shunda har satr uchun aniq natija qaytariladi
// va nima bog'lanmagani ko'rinib turadi.
function Orders({ adminApi, t, apiErrText }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parseErr, setParseErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  // Oddiy CSV o'quvchi: qo'shtirnoq ichidagi vergul va ikkilangan
  // qo'shtirnoqni tushunadi. Excel shu formatda saqlaydi.
  const parseCsv = (text) => {
    const out = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const push = () => { row.push(cell); cell = ''; };
    const endRow = () => { push(); if (row.some((c) => c.trim() !== '')) out.push(row); row = []; };
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',' || ch === ';' || ch === '\t') push();
      else if (ch === '\n') endRow();
      else if (ch !== '\r') cell += ch;
    }
    endRow();
    return out;
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseErr(''); setResult(null); setErr(''); setFileName(file.name);
    // BOM ni olib tashlaymiz — Excel saqlagan faylda u birinchi
    // ustun nomiga yopishib, sarlavha topilmay qolardi.
    const text = (await file.text()).replace(/^\uFEFF/, '');
    const table = parseCsv(text);
    if (!table.length) { setParseErr(t('Fayl bo‘sh.')); setRows([]); return; }
    const head = table[0].map((h) => h.trim().toLowerCase());
    const idx = (...names) => head.findIndex((h) => names.includes(h));
    const iCode = idx('code', 'kod', 'activation_code');
    const iOrder = idx('marketplace_order_id', 'order_id', 'order', 'buyurtma');
    const iRef = idx('customer_reference', 'customer', 'mijoz');
    // `sku` IXTIYORIY. Bo'lsa — kodning haqiqiy mahsuloti bilan
    // solishtiriladi va mos kelmasa satr bog'lanmaydi: bu
    // "konvertga boshqa mahsulotning kodi solingan" degani.
    const iSku = idx('sku', 'product_sku', 'marketplace_sku');
    // Chip tokeni — ishlab chiqarish faylidan keladi.
    const iChip = idx('chip_token', 'chip', 'token', 'nfc_token');
    // `code` SHART; qolganidan hech bo'lmasa bittasi bo'lsin.
    if (iCode < 0 || (iOrder < 0 && iChip < 0)) {
      setParseErr(t('Sarlavhada "code" va hech bo‘lmasa "marketplace_order_id" yoki "chip_token" ustuni bo‘lishi kerak.'));
      setRows([]);
      return;
    }
    const parsed = table.slice(1).map((r) => ({
      code: (r[iCode] || '').trim(),
      marketplaceOrderId: iOrder >= 0 ? (r[iOrder] || '').trim() : '',
      customerReference: iRef >= 0 ? (r[iRef] || '').trim() : '',
      sku: iSku >= 0 ? (r[iSku] || '').trim() : '',
      chipToken: iChip >= 0 ? (r[iChip] || '').trim() : '',
    })).filter((r) => r.code || r.marketplaceOrderId || r.chipToken);
    setRows(parsed);
  };

  const send = async () => {
    setBusy(true); setErr(''); setResult(null);
    try { setResult(await adminApi('/marketplace/orders/import', { method: 'POST', body: JSON.stringify({ rows }) })); }
    catch (e) { setErr(apiErrText(e, t)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <AdminCard title={t('Buyurtmalarni CSV dan bog‘lash')}>
        <p className="mk-hint">
          {t('Ustunlar: code va (ixtiyoriy) marketplace_order_id, customer_reference, sku, chip_token. Ishlab chiqarish fayli chip_token bilan, sotuv fayli buyurtma raqami bilan keladi — ikkalasi ham shu yerdan o‘tadi. `sku` berilsa, u kodning haqiqiy mahsuloti bilan solishtiriladi.')}
        </p>
        <input type="file" accept=".csv,text/csv" className="vz-input" onChange={onFile} aria-label={t('CSV fayl')} />
        {fileName && <p className="mk-hint mt-2">{fileName} — {t('{n} ta qator', { n: rows.length })}</p>}
        {parseErr && <div role="alert" className="alert alert-error mt-3 py-2 text-xs"><span>{parseErr}</span></div>}
        <button className="btn btn-gold mt-3 w-full sm:w-auto" disabled={busy || rows.length === 0} onClick={send}>
          {busy ? <span className="loading loading-spinner loading-xs" /> : t('Bog‘lash')}
        </button>
        {err && <div role="alert" className="alert alert-error mt-3 py-2 text-xs"><span>{err}</span></div>}
      </AdminCard>

      {result && (
        <AdminCard title={t('Natija')}>
          <div className="mk-kpis">
            <KpiCard icon="check" label={t('Bog‘landi')} value={result.linked} tone="success" />
            <KpiCard icon="clipboard" label={t('Jami qator')} value={result.total} />
            <KpiCard icon="alert" label={t('Muammoli')} value={(result.problems || []).length} tone={result.problems?.length ? 'danger' : 'muted'} />
          </div>
          {(result.problems || []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead><tr><th>{t('Satr')}</th><th>{t('Kod')}</th><th>{t('Sabab')}</th></tr></thead>
                <tbody>
                  {result.problems.map((p) => (
                    <tr key={`${p.line}-${p.code}`}>
                      <td>{p.line}</td>
                      <td className="font-mono text-xs">{p.code || '—'}</td>
                      <td className="text-xs">
                        {p.reason === 'not_found' ? t('Bunday kod topilmadi')
                          : p.reason === 'bad_code' ? t('Kod formati noto‘g‘ri')
                          : p.reason === 'sku_mismatch' ? t('SKU mos kelmadi — konvertda boshqa mahsulotning kodi')
                          : p.reason === 'device_taken' ? t('Chip band — boshqa kodga yoki odamga biriktirilgan')
                          : t('Buyurtma raqami yo‘q')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      )}
    </div>
  );
}

// ── AKTIVATSIYALAR TARIXI ────────────────────────────────────────────
//
// Kodlar ro'yxati "hozir nima" ni ko'rsatadi, tarix esa "nima
// bo'ldi" ni. "Bu kod nega bloklangan?" degan savolga faqat shu
// yerda javob bor — jumladan qayta taqsimlash SABABI.
function History({ adminApi, t }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => { setErr(null); setRows(null); return adminApi('/marketplace/history').then((d) => setRows(d?.history || [])).catch(setErr); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <LoadError err={err} onRetry={load} title={t('Tarixni yuklab bo‘lmadi.')} />;
  if (!rows) return <AdminLoading />;
  if (rows.length === 0) return <EmptyState icon="clipboard" title={t('Hozircha tarix yo‘q.')} />;

  return (
    <AdminCard title={t('Aktivatsiyalar tarixi')} pad={false}>
      <p className="mk-hint px-4 pt-4">
        {t('Oxirgi 200 amal. Kodlar bu yerda ham maskalangan — to‘liq kod hech qayerda saqlanmaydi.')}
      </p>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>{t('Vaqt')}</th><th>{t('Amal')}</th><th>{t('Tafsilot')}</th><th>{t('O‘zgarish')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{String(r.createdAt || '').replace('T', ' ').slice(0, 16)}</td>
                <td className="text-xs font-semibold">{ACTION_LABEL[r.action] ? t(ACTION_LABEL[r.action]) : r.action}</td>
                <td className="text-xs">{r.details || '—'}</td>
                <td className="text-xs">{r.from || r.to ? `${r.from || '—'} → ${r.to || '—'}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}
