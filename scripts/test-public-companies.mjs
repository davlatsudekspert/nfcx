// OCHIQ KOMPANIYALAR RO'YXATI — /api/companies (GET).
//
// Egasining shikoyati: "Kompaniyalar sahifasida NFCSTORE biznes
// profili ko'rinmayapti". Sababi: o'sha ro'yxat FAQAT `cards`
// jadvalidagi biznes turidagi kartalardan yig'ilardi. `companies`
// jadvalidagi HAQIQIY kompaniya profillari (Company ID va /c/<ID>
// sahifasi bilan) u yerga umuman tushmasdi — ya'ni kompaniya ochgan
// odam o'zini kompaniyalar katalogida topa olmasdi.
//
//   node scripts/test-public-companies.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const j = async (path, init) => { const r = await worker.fetch(req(path, init), env); return { status: r.status, body: await r.json().catch(() => null) }; };
const mk = async (id, name, who = cookie.user) => j('/api/companies', {
  method: 'POST', cookie: who,
  json: { companyId: id, displayName: name, city: 'Toshkent', phone: '+998901112233', category: 'other', description: 'Test kompaniya tavsifi, yigirma belgidan uzunroq matn.' },
});

// ── 1) Bo'sh ro'yxat ham to'g'ri shaklda ─────────────────────────────
const empty = await j('/api/companies');
check('1) ro‘yxat ochiq (kirmasdan ham)', [empty.status, empty.body?.companies], [200, []]);

// ── 2) FAQAT faol kompaniyalar ko'rinadi ─────────────────────────────
await mk('NFCSTOREUZ', 'NFCSTORE');
await mk('DRAFTCO', 'Draft Co');
await mk('OTHERCO', 'Other Co', cookie.other);
await env.DB.prepare(`UPDATE companies SET status='active', logo_url='/uploads/logo.png', cover_url='/uploads/cover.png', subcategory='IT', city='Toshkent' WHERE company_id='NFCSTOREUZ'`).run();
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='OTHERCO'`).run();
// DRAFTCO qoralama holida qoladi.

const list = (await j('/api/companies')).body.companies;
check('2) faqat faol kompaniyalar', list.map((c) => c.companyId).sort(), ['NFCSTOREUZ', 'OTHERCO']);
checkTrue('2) qoralama ko‘rinmaydi', !list.some((c) => c.companyId === 'DRAFTCO'));

// Sahifada ko'rinadigan maydonlar to'liq keladi.
const nfc = list.find((c) => c.companyId === 'NFCSTOREUZ');
check('2) nomi', nfc.displayName, 'NFCSTORE');
check('2) logotip', nfc.logoUrl, '/uploads/logo.png');
check('2) muqova', nfc.coverUrl, '/uploads/cover.png');
check('2) shahar va yo‘nalish', [nfc.city, nfc.subcategory], ['Toshkent', 'IT']);

// ── 3) MAXFIY maydonlar YUBORILMAYDI ─────────────────────────────────
// Ro'yxat kirmagan odamga ham ochiq — egasi, telefoni, to'lov holati
// va admin izohi u yerda bo'lmasligi shart.
for (const k of ['ownerUserId', 'owner_user_id', 'ownerEmail', 'phone', 'adminNote', 'admin_note', 'price', 'tier', 'status']) {
  checkTrue(`3) "${k}" qaytmaydi`, !(k in nfc));
}

// ── 4) To'xtatilsa ro'yxatdan chiqadi ────────────────────────────────
await env.DB.prepare(`UPDATE companies SET status='suspended' WHERE company_id='OTHERCO'`).run();
check('4) to‘xtatilgani ko‘rinmaydi', (await j('/api/companies')).body.companies.map((c) => c.companyId), ['NFCSTOREUZ']);

// ── 5) POST buzilmagan ───────────────────────────────────────────────
// Bir xil manzilda GET qo'shildi — yaratish avvalgidek ishlashi kerak.
const created = await mk('YANGICO', 'Yangi Co');
check('5) kompaniya yaratish ishlaydi', created.status, 201);
check('5) lekin faol emas — ro‘yxatda yo‘q', (await j('/api/companies')).body.companies.map((c) => c.companyId), ['NFCSTOREUZ']);

done();
