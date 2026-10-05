// YAQIN ATROFDAGI BIZNESLAR (hosting/api/nearby.js).
//
// Tekshiriladi: masofa bo'yicha saralash va `distanceKm`; radius va limit;
// kirish qiymatlari tekshiruvi; faqat faol, egasi tirik, namuna va sinov
// bo'lmagan, koordinatali bizneslar; ichki maydonlar (egasi, emaili, admin
// izohi) chiqmaydi; sana chizig'i (±180°) atrofi; `/api/companies/nearby`
// kompaniya sahifasi deb o'qilmaydi.
//
//   node scripts/test-nearby.mjs
import { setupSocial, makeChecker } from './lib/social-fixture.mjs';
import { haversineKm } from '../hosting/api/nearby.js';
import { DEMO_OWNER } from '../hosting/api/demo-businesses.js';

const { check, checkTrue, done } = makeChecker();
const { sqlite, call, addCompany } = await setupSocial();

// Markaz: Toshkent, Amir Temur xiyoboni (41.3111, 69.2797).
const C = { lat: 41.3111, lng: 69.2797 };
// ACMEUZ fixture'da: 41.2995, 69.2401 (~3.5 km). Qo'shimchalari:
addCompany('NEARONE', 2, { lat: 41.3120, lng: 69.2800, name: 'Juda yaqin' });      // ~0.1 km
addCompany('MIDTWO', 2, { lat: 41.3500, lng: 69.2797, name: 'O‘rtacha' });          // ~4.3 km
addCompany('FARSAM', 2, { lat: 39.6542, lng: 66.9597, name: 'Samarqand' });          // ~270 km
addCompany('NOGEO', 2, { name: 'Koordinatasiz' });
addCompany('SUSPBIZ', 2, { lat: 41.3112, lng: 69.2798, status: 'suspended' });
addCompany('DRAFTBIZ', 2, { lat: 41.3112, lng: 69.2798, status: 'draft' });
sqlite.prepare(`INSERT INTO users (id, email, password_hash, is_test) VALUES (5, 'sinov@test.local', 'x', 1)`).run();
addCompany('TESTBIZ', 5, { lat: 41.3112, lng: 69.2798 });
sqlite.prepare(`INSERT INTO users (id, email, password_hash, deleted_at) VALUES (6, 'gone@test.local', 'x', '2026-10-01')`).run();
addCompany('GONEBIZ', 6, { lat: 41.3112, lng: 69.2798 });
addCompany('DEMOBIZ', DEMO_OWNER, { lat: 41.3112, lng: 69.2798 });
// Sana chizig'i: 179.99 va -179.99 — bir-biriga ~1.7 km.
addCompany('EASTEDGE', 2, { lat: 10, lng: 179.99 });
addCompany('WESTEDGE', 2, { lat: 10, lng: -179.99 });

const q = (params) => call(`/api/companies/nearby?${new URLSearchParams(params)}`);

// ── 1) Asosiy ──────────────────────────────────────────────────────
let r = await q({ lat: C.lat, lng: C.lng });
check('1) 200', r.status, 200);
check('1) standart radius 5 km, masofa bo‘yicha', r.body.items.map((x) => x.companyId), ['NEARONE', 'ACMEUZ', 'MIDTWO']);
check('1) radiusKm javobda', [r.body.radiusKm, r.body.hasMore], [5, false]);
const near = r.body.items[0];
checkTrue('1) distanceKm to‘g‘ri (≈0.1 km)', near.distanceKm > 0.05 && near.distanceKm < 0.15);
checkTrue('1) distanceKm o‘sib boradi', r.body.items.every((x, i, a) => i === 0 || a[i - 1].distanceKm <= x.distanceKm));
check('1) element kalitlari', Object.keys(near).sort(),
  ['address', 'category', 'city', 'companyId', 'coverUrl', 'displayName', 'distanceKm', 'latitude', 'logoUrl', 'longitude', 'openNow', 'subcategory'].sort());
const raw = JSON.stringify(r.body);
checkTrue('1) egasi, emaili, admin izohi, telefoni chiqmaydi', !raw.includes('secret.local') && !raw.includes('ichki izoh') && !raw.includes('owner') && !raw.includes('+99890'));

// ── 2) Filtrlar ────────────────────────────────────────────────────
r = await q({ lat: C.lat, lng: C.lng, radiusKm: 50 });
const ids = r.body.items.map((x) => x.companyId);
for (const id of ['SUSPBIZ', 'DRAFTBIZ', 'TESTBIZ', 'GONEBIZ', 'DEMOBIZ', 'NOGEO', 'FARSAM']) {
  checkTrue(`2) ${id} ro‘yxatda yo‘q`, !ids.includes(id));
}
r = await q({ lat: C.lat, lng: C.lng, radiusKm: 1 });
check('2) radius 1 km', r.body.items.map((x) => x.companyId), ['NEARONE']);
r = await q({ lat: C.lat, lng: C.lng, limit: 2 });
check('2) limit 2 — hasMore', [r.body.items.length, r.body.hasMore], [2, true]);
r = await q({ lat: 39.6542, lng: 66.9597, radiusKm: 0.5 });
check('2) Samarqand markazida', r.body.items.map((x) => x.companyId), ['FARSAM']);
check('2) o‘sha joyda masofa 0', r.body.items[0].distanceKm, 0);

// ── 3) Sana chizig'i ───────────────────────────────────────────────
r = await q({ lat: 10, lng: 179.995, radiusKm: 5 });
check('3) +180 atrofida ikkala tomon', r.body.items.map((x) => x.companyId), ['EASTEDGE', 'WESTEDGE']);
r = await q({ lat: 10, lng: -179.995, radiusKm: 5 });
check('3) -180 atrofida ikkala tomon', r.body.items.map((x) => x.companyId), ['WESTEDGE', 'EASTEDGE']);

// ── 4) Tekshiruv ───────────────────────────────────────────────────
for (const [label, params, err] of [
  ['lat yo‘q', { lng: 69 }, 'bad_location'],
  ['lng yo‘q', { lat: 41 }, 'bad_location'],
  ['lat 91', { lat: 91, lng: 69 }, 'bad_location'],
  ['lng -181', { lat: 41, lng: -181 }, 'bad_location'],
  ['lat matn', { lat: 'abc', lng: 69 }, 'bad_location'],
  ['lat bo‘sh', { lat: '', lng: 69 }, 'bad_location'],
  ['radius 51', { lat: 41, lng: 69, radiusKm: 51 }, 'bad_radius'],
  ['radius 0', { lat: 41, lng: 69, radiusKm: 0 }, 'bad_radius'],
  ['radius matn', { lat: 41, lng: 69, radiusKm: 'x' }, 'bad_radius'],
  ['limit 51', { lat: 41, lng: 69, limit: 51 }, 'bad_limit'],
  ['limit 0', { lat: 41, lng: 69, limit: 0 }, 'bad_limit'],
  ['limit kasr', { lat: 41, lng: 69, limit: 2.5 }, 'bad_limit'],
]) {
  r = await q(params);
  check(`4) ${label}: 422 ${err}`, [r.status, r.body?.error], [422, err]);
}
check('4) radius 50 va limit 50 — chegarada', (await q({ lat: 41, lng: 69, radiusKm: 50, limit: 50 })).status, 200);
check('4) POST: 405', (await call('/api/companies/nearby?lat=41&lng=69', { method: 'POST', json: {} })).status, 405);

// ── 5) Marshrut ────────────────────────────────────────────────────
r = await q({ lat: C.lat, lng: C.lng });
checkTrue('5) "nearby" kompaniya ID deb o‘qilmaydi', Array.isArray(r.body.items) && !('company' in r.body));
r = await call('/api/companies/check?id=NEARBY');
check('5) NEARBY ID band (yo‘l bilan to‘qnashmasin)', r.body.available, false);

// ── 6) Haversine ───────────────────────────────────────────────────
const d = haversineKm(41.3111, 69.2797, 39.6542, 66.9597);
checkTrue(`6) Toshkent–Samarqand ≈ 270 km (${d.toFixed(1)})`, d > 260 && d < 280);
check('6) bir nuqta — 0', haversineKm(1, 2, 1, 2), 0);

done();
