// ADMIN SHIKOYATLAR: QIDIRUV, SAHIFALASH, E2E YOZUVLARI YASHIRIN.
//
// Egasi (2026-09-23 surat): shikoyatlar navbati avtomatik sinovning
// "NOVA E2E TEST — DELETE" yozuvlari bilan to'lgan edi va haqiqiy
// shikoyat ko'rinmasdi; foydalanuvchi ko'paysa ro'yxat cheksiz
// uzayardi. Endi: E2E yozuvlari ro'yxatga chiqmaydi (o'chirilmaydi),
// istalgan so'z bo'yicha qidiruv, holat sonlari va "ko'proq".
//
//   node scripts/test-admin-reports-search.mjs

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const report = (who, json) => call('/api/reports', { method: 'POST', ...who, json });
const asA = { cookie: cookie.user };  // user@test.local
const asB = { cookie: cookie.other }; // other@test.local

let r = await report(asA, { targetKind: 'post', targetId: '23', ownerCode: 'VIP001', reason: 'other', note: 'NOVA E2E TEST — DELETE' });
check('0) E2E shikoyati qabul qilinadi (kontrakt o\'zgarmadi)', r.status < 300, true);
await report(asB, { targetKind: 'post', targetId: '5', ownerCode: 'VIP001', reason: 'spam', note: 'Reklama tarqatyapti' });
await report(asA, { targetKind: 'story', targetId: '9', ownerCode: 'OTH222', reason: 'insult', note: 'Haqoratli so\'zlar' });

const list = async (qs = '') => (await call(`/api/admin/reports${qs}`, { cookie: cookie.admin })).body;

let d = await list();
check('1) E2E yozuvi ro\'yxatda yo\'q', d.reports.some((x) => x.note.startsWith('NOVA E2E TEST')), false);
check('1) haqiqiy shikoyatlar bor', d.reports.length, 2);
check('1) holat sonlarida ham E2E yo\'q', d.counts.new, 2);
check('1) shikoyatchi emaili qaytadi', d.reports.map((x) => x.reporterEmail).sort(), ['other@test.local', 'user@test.local']);

check('2) izohdagi so\'z bo\'yicha', (await list('?q=reklama')).reports.map((x) => x.targetId), ['5']);
check('2) katta-kichik harfsiz', (await list('?q=HAQORAT')).reports.map((x) => x.targetId), ['9']);
check('2) kontent egasining kodi bo\'yicha', (await list('?q=oth222')).reports.map((x) => x.targetId), ['9']);
check('2) shikoyatchi emaili bo\'yicha', (await list('?q=other@')).reports.map((x) => x.targetId), ['5']);
check('2) nishon turi bo\'yicha', (await list('?q=story')).reports.map((x) => x.targetId), ['9']);
check('2) sabab bo\'yicha', (await list('?q=spam')).reports.map((x) => x.targetId), ['5']);
check('2) topilmasa bo\'sh', (await list('?q=yoq-narsa')).reports, []);
check('2) faqat % — hammasi emas', (await list('?q=%25')).reports, []);
check('2) E2E so\'zi bilan ham chiqmaydi', (await list('?q=e2e')).reports, []);

d = await list('?limit=1');
check('3) sahifa: 1 ta va yana bor', [d.reports.length, d.hasMore], [1, true]);
const first = d.reports[0].id;
d = await list('?limit=1&offset=1');
check('3) keyingi sahifa boshqa yozuv', [d.reports.length, d.hasMore, d.reports[0].id !== first], [1, false, true]);

const id = (await list('?q=reklama')).reports[0].id;
r = await call(`/api/admin/reports/${id}`, { method: 'PATCH', cookie: cookie.admin, json: { status: 'resolved' } });
check('4) holat o\'zgaradi', r.status, 200);
d = await list('?status=new');
check('4) holat filtri', d.reports.map((x) => x.targetId), ['9']);
checkTrue('4) sonlar yangilandi', d.counts.new === 1 && d.counts.resolved === 1);

check('5) oddiy foydalanuvchi kira olmaydi', (await call('/api/admin/reports', { cookie: cookie.user })).status, 401);

done();
