import { useState } from 'react';
import { backdropProps } from '../lib/backdrop.js';
import { createCompanyOrder } from '../lib/company.js';
import { fmt } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';

// Katalogdan buyurtma. Mijozdan FAQAT ism va telefon so'raladi —
// manzil ham, to'lov ham yo'q: yetkazib berishni va hisob-kitobni
// kompaniyaning o'zi mijoz bilan kelishadi. Sayt bu yerda faqat
// xabarchi, shuning uchun "to'landi" degan va'da berilmaydi.
export default function CompanyOrderModal({ companyId, item, onClose }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: '', phone: '', qty: 1, note: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const set = (key) => (e) => setForm((old) => ({ ...old, [key]: e.target.value }));

  const unit = item ? (item.promotionPrice != null && item.promotionPrice !== '' ? Number(item.promotionPrice) : Number(item.price || 0)) : 0;
  const qty = Math.min(999, Math.max(1, Math.round(Number(form.qty) || 1)));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr('');
    try {
      await createCompanyOrder(companyId, { itemId: item?.id, name: form.name, phone: form.phone, qty, note: form.note });
      setDone(true);
    } catch (error) {
      const code = error?.error || error?.message;
      setErr(code === 'too_many_requests' ? t('Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.')
        : code === 'orders_disabled' ? t('Bu kompaniya hozircha saytdan buyurtma qabul qilmaydi.')
          : code === 'required_fields' ? t('Ism va telefon raqamini to‘g‘ri kiriting.')
            : t('Yuborib bo‘lmadi. Qayta urinib ko‘ring.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="co-modal-back" {...backdropProps(onClose)}>
      <div className="co-modal" role="dialog" aria-modal="true">
        {done ? (
          <>
            <h3>{t('Buyurtmangiz yuborildi')}</h3>
            <p>{t('Kompaniya tez orada siz bilan bog‘lanadi. To‘lov va yetkazib berish kompaniya bilan kelishiladi.')}</p>
            <button type="button" className="co-modal-cta" onClick={onClose}>{t('Yopish')}</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h3>{t('Buyurtma berish')}</h3>
            {item && (
              <p className="co-modal-item">
                <b>{item.name}</b>
                {unit > 0 && <span>{fmt(unit * qty)} {t('so‘m')}</span>}
              </p>
            )}
            <label><span>{t('Ismingiz')}</span><input required value={form.name} onChange={set('name')} maxLength={80} /></label>
            <label><span>{t('Telefon raqamingiz')}</span><input required value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="+998 90 123 45 67" maxLength={40} /></label>
            <label><span>{t('Soni')}</span><input type="number" min="1" max="999" value={form.qty} onChange={set('qty')} /></label>
            <label><span>{t('Izoh (ixtiyoriy)')}</span><textarea value={form.note} onChange={set('note')} maxLength={300} /></label>
            {err && <small role="alert" className="co-modal-err">{err}</small>}
            <p className="co-modal-note">{t('To‘lov saytda amalga oshirilmaydi — kompaniya siz bilan bog‘lanadi.')}</p>
            <button className="co-modal-cta" disabled={busy}>{busy ? t('Yuborilmoqda…') : t('Yuborish')}</button>
          </form>
        )}
      </div>
    </div>
  );
}
