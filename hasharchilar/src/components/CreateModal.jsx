import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

const EMPTY = { title: '', address: '', date: '', time: '09:00', needs: '' };
const CENTER = [41.3111, 69.2797];

export default function CreateModal({ onCreate }) {
  const dialog = useRef(null);
  const mapEl = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [coords, setCoords] = useState(null);
  const [photo, setPhoto] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Mini xarita faqat modal ochiq bo'lganda o'lchamini to'g'ri oladi.
  useEffect(() => {
    const d = dialog.current;
    const onOpen = new MutationObserver(() => {
      if (!d.open) return;
      if (!map.current) {
        map.current = L.map(mapEl.current).setView(CENTER, 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map.current);
        map.current.on('click', (e) => {
          setCoords([e.latlng.lat, e.latlng.lng]);
          if (marker.current) marker.current.setLatLng(e.latlng);
          else marker.current = L.marker(e.latlng).addTo(map.current);
        });
      }
      setTimeout(() => map.current.invalidateSize(), 50);
    });
    onOpen.observe(d, { attributes: true, attributeFilter: ['open'] });
    return () => onOpen.disconnect();
  }, []);

  const reset = () => {
    setForm(EMPTY);
    setCoords(null);
    setPhoto(null);
    if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const [lat, lng] = coords || CENTER;
    onCreate({
      title: form.title.trim(),
      address: form.address.trim() || 'Xaritada belgilangan joy',
      date: form.date,
      time: form.time,
      needs: form.needs.split(',').map((s) => s.trim()).filter(Boolean),
      photo,
      lat,
      lng,
    });
    dialog.current.close();
    reset();
  };

  return (
    <dialog id="create_modal" ref={dialog} className="modal modal-bottom sm:modal-middle z-[3000]">
      <div className="modal-box max-w-xl">
        <form method="dialog">
          <button className="btn btn-circle btn-ghost btn-sm absolute right-3 top-3">✕</button>
        </form>
        <h3 className="text-2xl font-extrabold">Yangi hashar</h3>
        <p className="text-sm text-slate-500">Qisqa to'ldiring — odamlar sizga qo'shilishadi.</p>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <input className="input input-bordered w-full" placeholder="Hashar nomi" required
            value={form.title} onChange={set('title')} />

          <input className="input input-bordered w-full" placeholder="Manzil (mahalla, ko'cha)"
            value={form.address} onChange={set('address')} />

          <div>
            <div ref={mapEl} className="h-44 w-full rounded-2xl shadow-inner" />
            <p className="mt-1 text-xs text-slate-500">
              {coords ? '📍 Joy belgilandi' : 'Joyni belgilash uchun xaritaga bosing'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="date" className="input input-bordered w-full" required
              value={form.date} onChange={set('date')} />
            <input type="time" className="input input-bordered w-full" required
              value={form.time} onChange={set('time')} />
          </div>

          <input className="input input-bordered w-full" placeholder="Kerakli asboblar (vergul bilan): belkurak, qo'lqop"
            value={form.needs} onChange={set('needs')} />

          <input type="file" accept="image/*" className="file-input file-input-bordered w-full"
            onChange={(e) => setPhoto(e.target.files[0] ? URL.createObjectURL(e.target.files[0]) : null)} />

          <button type="submit" className="btn btn-warning btn-lg mt-1 w-full shadow-lg">
            E'lon qilish
          </button>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop"><button>yopish</button></form>
    </dialog>
  );
}
