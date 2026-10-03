import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { TASHKENT, formatDateTime } from '../lib/utils.js';

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

// Kutilayotgan = amber, bajarilgan = emerald.
const pinIcon = (status, active) =>
  L.divIcon({
    className: 'hashar-pin',
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    popupAnchor: [0, -32],
    html: `<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg) scale(${active ? 1.25 : 1});
      background:${status === 'COMPLETED' ? '#059669' : '#fbbf24'};border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.35)"></div>`,
  });

/** Popup DOM elementi (textContent — XSS dan xavfsiz). */
function buildPopup(h, joined, onJoin) {
  const el = document.createElement('div');
  el.style.minWidth = '180px';
  const title = Object.assign(document.createElement('strong'), { textContent: h.title });
  title.style.cssText = 'display:block;font-size:15px;margin-bottom:4px';
  const meta = Object.assign(document.createElement('div'), {
    textContent: `${formatDateTime(h.date_time)} · 👥 ${h.volunteer_count}`,
  });
  meta.style.cssText = 'color:#475569;font-size:13px;margin-bottom:8px';
  el.append(title, meta);
  if (h.status === 'PENDING') {
    const btn = Object.assign(document.createElement('button'), {
      textContent: joined ? '✓ Qatnashasiz' : 'Qatnashish',
      disabled: joined,
    });
    btn.style.cssText = 'width:100%;border:0;border-radius:12px;padding:8px;font-weight:700;background:#fbbf24;color:#0f172a;cursor:pointer';
    if (joined) btn.style.cssText += ';background:#f1f5f9;color:#64748b;cursor:default';
    btn.onclick = () => onJoin(h.id);
    el.append(btn);
  }
  return el;
}

/** Asosiy xarita: pinlar, popup, tanlangan hasharga uchish, foydalanuvchi joyi. */
export default function MapView({ hashars, joinedIds, selectedId, userPos, onSelect, onJoin }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const markers = useRef(new Map());
  const cb = useRef({ onSelect, onJoin });
  cb.current = { onSelect, onJoin };

  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView([TASHKENT.lat, TASHKENT.lng], 11);
    L.tileLayer(TILES, { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);

  // Pinlarni qayta chizish
  useEffect(() => {
    layer.current.clearLayers();
    markers.current.clear();
    hashars.forEach((h) => {
      const m = L.marker([h.lat, h.lng], { icon: pinIcon(h.status, h.id === selectedId) })
        .bindPopup(() => buildPopup(h, joinedIds.has(h.id), (id) => cb.current.onJoin(id)))
        .on('click', () => cb.current.onSelect(h.id))
        .addTo(layer.current);
      markers.current.set(h.id, m);
    });
  }, [hashars, joinedIds, selectedId]);

  // Tanlangan hasharga uchish va popupni ochish
  useEffect(() => {
    const h = hashars.find((x) => x.id === selectedId);
    if (!h) return;
    map.current.flyTo([h.lat, h.lng], Math.max(map.current.getZoom(), 14), { duration: 0.7 });
    markers.current.get(h.id)?.openPopup();
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foydalanuvchi joylashuvi
  useEffect(() => {
    if (!userPos) return;
    const dot = L.circleMarker([userPos.lat, userPos.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map.current);
    map.current.setView([userPos.lat, userPos.lng], 12);
    return () => dot.remove();
  }, [userPos]);

  return <div ref={el} className="z-0 h-[340px] w-full rounded-2xl shadow-lg sm:h-[440px] lg:h-[600px]" />;
}
