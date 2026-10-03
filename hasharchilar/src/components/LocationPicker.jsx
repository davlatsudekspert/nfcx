import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { TASHKENT } from '../lib/utils.js';

/** Mini xarita: bosilgan joyning lat/lng ini avtomatik oladi. */
export default function LocationPicker({ value, onChange }) {
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const place = (latlng) => {
    if (marker.current) marker.current.setLatLng(latlng);
    else marker.current = L.marker(latlng).addTo(map.current);
  };

  useEffect(() => {
    const start = value ? [value.lat, value.lng] : [TASHKENT.lat, TASHKENT.lng];
    map.current = L.map(el.current).setView(start, value ? 15 : 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map.current);
    if (value) place(start);
    map.current.on('click', (e) => {
      place(e.latlng);
      onChangeRef.current({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) });
    });
    return () => map.current.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const locate = () =>
    navigator.geolocation?.getCurrentPosition((p) => {
      const pos = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) };
      place([pos.lat, pos.lng]);
      map.current.setView([pos.lat, pos.lng], 16);
      onChangeRef.current(pos);
    });

  return (
    <div>
      <div ref={el} className="z-0 h-56 w-full rounded-2xl shadow-inner" />
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className={value ? 'font-medium text-emerald-700' : 'text-slate-500'}>
          {value ? `📍 ${value.lat}, ${value.lng}` : 'Joyni belgilash uchun xaritaga bosing'}
        </span>
        <button type="button" onClick={locate} className="font-semibold text-emerald-700 hover:underline">
          Mening joylashuvim
        </button>
      </div>
    </div>
  );
}
