// Rasm tanlash (kamera yoki galereya) + ko'rinish + avtomatik siqish (≤1600px JPEG).
import { useEffect, useId, useState } from 'react';
import { compressImage } from '../lib/image.js';
import { CameraIcon, RefreshIcon, TrashIcon } from './icons.jsx';
import { Spinner } from './ui.jsx';

export default function PhotoInput({ value, onChange, title, hint, tone = 'emerald' }) {
  const id = useId();
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Object URL ni boshqarish (xotira oqmasligi uchun)
  useEffect(() => {
    if (!value) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // bir xil faylni qayta tanlash mumkin bo'lsin
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      onChange(await compressImage(file));
    } catch (err) {
      setError(err.message || "Rasmni qayta ishlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  const ring = tone === 'amber' ? 'border-amber-300 bg-amber-50/60 hover:bg-amber-50' : 'border-emerald-300 bg-emerald-50/60 hover:bg-emerald-50';

  return (
    <div>
      <input id={id} type="file" accept="image/*" className="sr-only" onChange={pick} disabled={busy} aria-label={title} />
      {preview ? (
        <div className="relative overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          <img src={preview} alt="Tanlangan rasm" className="aspect-[4/3] w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10">
            <label
              htmlFor={id}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-sm font-bold text-slate-800 hover:bg-white"
            >
              <RefreshIcon className="h-4 w-4" /> Almashtirish
            </label>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-sm font-bold text-red-700 hover:bg-white"
            >
              <TrashIcon className="h-4 w-4" /> O'chirish
            </button>
          </div>
          <span className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-white">
            {Math.max(1, Math.round(value.size / 1024))} KB
          </span>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${ring}`}
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-emerald-600 shadow-sm">
            {busy ? <Spinner className="h-6 w-6" /> : <CameraIcon className="h-7 w-7" />}
          </span>
          <span className="mt-1 text-base font-bold text-slate-900">{busy ? 'Rasm tayyorlanmoqda…' : title}</span>
          {hint && <span className="max-w-xs text-sm text-slate-600">{hint}</span>}
        </label>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
