import { useEffect, useRef } from 'react';
import L from 'leaflet';

const CENTER = [41.3111, 69.2797];

const pin = (color, active) =>
  L.divIcon({
    className: 'hashar-pin',
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    html: `<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg) scale(${active ? 1.25 : 1});
      background:${color};border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.35)"></div>`,
  });

export const markerColor = (status) => (status === 'completed' ? '#10B981' : '#F59E0B');

export default function HasharMap({ hashars, selectedId, onSelect }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView(CENTER, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);

  useEffect(() => {
    layer.current.clearLayers();
    hashars.forEach((h) => {
      L.marker([h.lat, h.lng], { icon: pin(markerColor(h.status), h.id === selectedId) })
        .on('click', () => onSelect(h.id))
        .bindTooltip(h.title)
        .addTo(layer.current);
    });
  }, [hashars, selectedId, onSelect]);

  useEffect(() => {
    const h = hashars.find((x) => x.id === selectedId);
    if (h) map.current.flyTo([h.lat, h.lng], 14, { duration: 0.8 });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="z-0 h-[320px] w-full rounded-3xl shadow-lg sm:h-[420px] lg:h-[600px]" />;
}
