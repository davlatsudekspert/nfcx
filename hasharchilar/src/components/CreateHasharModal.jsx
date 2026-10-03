import { useState } from 'react';
import Modal from './Modal.jsx';
import LocationPicker from './LocationPicker.jsx';
import { inputCls } from './JoinDialog.jsx';
import { CameraIcon } from './icons.jsx';

const SUGGESTED_ITEMS = ['Belkurak', "Qo'lqop", "Ko'chat", 'Axlat qoplari', "Cho'tka", "Bo'yoq", 'Suv'];
const STEPS = ['Nomi', 'Joy', 'Vaqt', 'Rasm'];

/** 4 bosqichli e'lon formasi: (1) nom (2) joy (3) vaqt+narsalar (4) "Oldin" rasmi. */
export default function CreateHasharModal({ profile, onSubmit, onClose }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({
    title: '',
    description: '',
    address: '',
    location: null,
    date: '',
    time: '09:00',
    items: [],
    photo: null,
    name: profile?.name || '',
    phone: profile?.phone || '+998',
  });
  const [customItem, setCustomItem] = useState('');

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleItem = (it) => setF({ ...f, items: f.items.includes(it) ? f.items.filter((x) => x !== it) : [...f.items, it] });
  const addCustom = () => {
    const v = customItem.trim();
    if (v && !f.items.includes(v)) setF({ ...f, items: [...f.items, v] });
    setCustomItem('');
  };

  // Har bosqich uchun "Keyingi" tugmasi shartlari
  const canNext = [f.title.trim().length >= 3, !!f.location, !!f.date && !!f.time, true][step];

  const submit = async () => {
    setBusy(true);
    setError('');
    const fd = new FormData();
    fd.set('title', f.title.trim());
    fd.set('description', f.description);
    fd.set('address', f.address);
    fd.set('lat', f.location.lat);
    fd.set('lng', f.location.lng);
    fd.set('date_time', `${f.date}T${f.time}`);
    fd.set('items', JSON.stringify(f.items));
    fd.set('name', f.name.trim());
    fd.set('phone', f.phone);
    if (f.photo) fd.set('photo', f.photo);
    try {
      await onSubmit(fd, { name: f.name.trim(), phone: f.phone });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Yangi hashar" onClose={onClose}>
      {/* Bosqich ko'rsatkichi */}
      <ol className="mb-5 flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-emerald-600' : 'bg-slate-200'}`} />
            <span className={`mt-1 block text-xs font-semibold ${i === step ? 'text-emerald-700' : 'text-slate-400'}`}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3">
        {step === 0 && (
          <>
            <input className={inputCls} placeholder="Hashar nomi (masalan: Bog'ni tozalash)" value={f.title} onChange={set('title')} maxLength={120} autoFocus />
            <textarea className={inputCls} rows={4} placeholder="Qisqacha tavsif: nima qilamiz?" value={f.description} onChange={set('description')} maxLength={1000} />
          </>
        )}

        {step === 1 && (
          <>
            <LocationPicker value={f.location} onChange={(location) => setF((s) => ({ ...s, location }))} />
            <input className={inputCls} placeholder="Manzil (mahalla, ko'cha) — ixtiyoriy" value={f.address} onChange={set('address')} maxLength={200} />
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className={inputCls} value={f.date} min={new Date().toISOString().slice(0, 10)} onChange={set('date')} />
              <input type="time" className={inputCls} value={f.time} onChange={set('time')} />
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-700">Kerakli narsalar</p>
            <div className="flex flex-wrap gap-2">
              {[...new Set([...SUGGESTED_ITEMS, ...f.items])].map((it) => (
                <button
                  type="button"
                  key={it}
                  onClick={() => toggleItem(it)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    f.items.includes(it) ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-700 hover:border-emerald-400'
                  }`}
                >
                  {it}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Boshqa narsa…"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
              />
              <button type="button" onClick={addCustom} className="rounded-xl bg-slate-100 px-4 font-bold text-slate-700 hover:bg-slate-200">
                +
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-6 text-center text-emerald-800 hover:bg-emerald-100">
              {f.photo ? (
                <img src={URL.createObjectURL(f.photo)} alt="Oldingi holat" className="max-h-40 rounded-xl object-cover" />
              ) : (
                <>
                  <CameraIcon className="h-8 w-8" />
                  <span className="font-semibold">"Oldin" rasmini yuklang</span>
                  <span className="text-xs text-emerald-700/80">Hozirgi holatni suratga oling — keyin natijani solishtiramiz (JPG/PNG/WebP, 5 MB gacha)</span>
                </>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setF({ ...f, photo: e.target.files[0] || null })} />
            </label>
            <p className="mt-1 text-sm font-semibold text-slate-700">Siz haqingizda</p>
            <input className={inputCls} placeholder="Ismingiz" value={f.name} onChange={set('name')} />
            <input className={inputCls} type="tel" inputMode="tel" placeholder="+998 90 123 45 67" value={f.phone} onChange={set('phone')} />
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-5 flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="rounded-2xl bg-slate-100 px-5 py-3.5 font-bold text-slate-700 hover:bg-slate-200">
            Orqaga
          </button>
        )}
        {step < 3 ? (
          <button
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
            className="flex-1 rounded-2xl bg-emerald-600 py-3.5 font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-40"
          >
            Keyingi
          </button>
        ) : (
          <button
            disabled={busy || f.name.trim().length < 2}
            onClick={submit}
            className="flex-1 rounded-2xl bg-amber-400 py-3.5 text-base font-bold shadow-md hover:bg-amber-500 disabled:opacity-50"
          >
            {busy ? 'Yuborilmoqda…' : "E'lon qilish"}
          </button>
        )}
      </div>
    </Modal>
  );
}
