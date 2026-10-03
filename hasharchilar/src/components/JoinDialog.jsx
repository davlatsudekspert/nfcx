import { useState } from 'react';
import Modal from './Modal.jsx';

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30';

/** Birinchi marta qo'shilganda ism+telefon so'raydi (keyin eslab qolinadi → bir bosish). */
export default function JoinDialog({ onSubmit, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+998');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), phone });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Qatnashish" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">Tashkilotchi siz bilan bog'lanishi uchun ma'lumot qoldiring. Faqat bir marta so'raymiz.</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input className={inputCls} placeholder="Ismingiz" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus />
        <input className={inputCls} type="tel" inputMode="tel" placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button disabled={busy} className="rounded-2xl bg-amber-400 py-3.5 text-base font-bold shadow-md hover:bg-amber-500 disabled:opacity-60">
          {busy ? 'Yuborilmoqda…' : 'Qo‘shilaman'}
        </button>
      </form>
    </Modal>
  );
}
