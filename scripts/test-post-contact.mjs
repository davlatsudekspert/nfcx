// BIZNES POSTIDAGI "BOG'LANISH" TUGMASI (hosting/api/post-contact.js).
//
// Tekshiriladi: lentadagi va kompaniya ro'yxatidagi biznes postida
// `contact: { phone, telegram, mapUrl }` bor (yo'q qiymat — null), shaxsiy
// postda yo'q; faqat ochiq sahifadagi maydonlar — egasining emaili, admin
// izohi va boshqa ichki maydonlar chiqmaydi; yashirin (faol bo'lmagan)
// kompaniya hech narsa oshkor qilmaydi; lentaga qo'shimcha so'rov yo'q.
//
//   node scripts/test-post-contact.mjs
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { companyContact } from '../hosting/api/post-contact.js';

const { check, checkTrue, done } = makeChecker();
const { sqlite, call, addCompany } = await setupSocial();

addCompany('BAREBIZ', 2, {});                                    // kontaktsiz
addCompany('HIDDENBIZ', 2, { status: 'suspended', phone: '+998909999999', telegram: '@yashirin' });
addCompany('ADDRBIZ', 2, { address: 'Samarqand, Registon' });

const cpost = async (id, ck, caption) => {
  const r = await call(`/api/companies/${id}/posts`, { method: 'POST', cookie: ck, json: { agreed: true, imageUrl: '/uploads/c1abc.jpg', caption } });
  return r.body?.post?.id;
};
const acmePost = await cpost('ACMEUZ', cookie.user, 'acme');
const bareId = await cpost('BAREBIZ', cookie.other, 'bare');
const addrId = await cpost('ADDRBIZ', cookie.other, 'addr');
const hiddenId = await cpost('HIDDENBIZ', cookie.other, 'hidden');
const pr = await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/p1abc.jpg' } });
const personalId = pr.body.id;
checkTrue('0) postlar yaratildi', acmePost && bareId && addrId && hiddenId && personalId);

// ── 1) Lenta ───────────────────────────────────────────────────────
let r = await call('/api/feed?limit=30');
const feed = r.body.feed;
const acme = feed.find((f) => f.authorKind === 'company' && f.id === acmePost);
check('1) biznes postida contact', acme?.contact, {
  phone: '+998901234567',
  telegram: '@acme',
  mapUrl: 'https://www.google.com/maps/dir/?api=1&destination=41.2995%2C69.2401',
});
check('1) kontaktsiz biznes: hammasi null', feed.find((f) => f.authorKind === 'company' && f.id === bareId)?.contact,
  { phone: null, telegram: null, mapUrl: null });
check('1) koordinatasiz — manzil bo‘yicha xarita', feed.find((f) => f.authorKind === 'company' && f.id === addrId)?.contact?.mapUrl,
  'https://www.google.com/maps/dir/?api=1&destination=Samarqand%2C%20Registon');
const personal = feed.find((f) => f.authorKind === 'card' && f.id === personalId);
checkTrue('1) shaxsiy postda contact YO‘Q', personal && !('contact' in personal));
checkTrue('1) yashirin kompaniya posti lentada yo‘q', !feed.some((f) => f.authorKind === 'company' && f.id === hiddenId));
const raw = JSON.stringify(r.body);
checkTrue('1) lentada egasining emaili yo‘q', !raw.includes('secret.local'));
checkTrue('1) lentada admin izohi yo‘q', !raw.includes('ichki izoh'));
checkTrue('1) yashirin kompaniyaning telefoni/telegrami lentada yo‘q', !raw.includes('+998909999999') && !raw.includes('@yashirin'));
checkTrue('1) contact faqat 3 kalit', feed.filter((f) => f.contact).every((f) => Object.keys(f.contact).sort().join() === 'mapUrl,phone,telegram'));
checkTrue('1) istoriya qatorlarida contact yo‘q', feed.filter((f) => f.kind === 'story').every((f) => !('contact' in f)));

// ── 2) Kompaniya postlari ro'yxati ─────────────────────────────────
r = await call('/api/companies/ACMEUZ/posts');
check('2) ro‘yxatda contact', r.body.posts[0]?.contact?.phone, '+998901234567');
checkTrue('2) ro‘yxatda email/admin izohi yo‘q', !JSON.stringify(r.body).includes('secret.local') && !JSON.stringify(r.body).includes('ichki izoh'));
r = await call('/api/companies/HIDDENBIZ/posts');
check('2) yashirin kompaniya — begonaga bo‘sh ro‘yxat', r.body, { posts: [] });
r = await call('/api/companies/HIDDENBIZ/posts', { cookie: cookie.user });
check('2) yashirin kompaniya — boshqa kirgan odamga ham bo‘sh', r.body, { posts: [] });
r = await call('/api/companies/HIDDENBIZ/posts', { cookie: cookie.other });
check('2) yashirin kompaniya — egasiga postlar ko‘rinadi', r.body.posts.length, 1);
checkTrue('2) yashirin kompaniya — egasiga ham contact yo‘q (ommaga chiqmaydi)', !('contact' in r.body.posts[0]));
r = await call('/api/records/VIP001/posts');
checkTrue('2) shaxsiy profil postlarida contact yo‘q', r.body.posts.every((p) => !('contact' in p)));

// ── 3) Ochiq sahifa bilan bir xil manba (SEC-1) ────────────────────
r = await call('/api/companies/ACMEUZ');
check('3) ochiq sahifada ham shu telefon va telegram', [r.body.company.phone, r.body.company.telegram], ['+998901234567', '@acme']);
checkTrue('3) ochiq sahifada ownerEmail yo‘q (SEC-1)', !('ownerEmail' in r.body.company));

// ── 4) Yordamchi funksiya ──────────────────────────────────────────
check('4) bo‘sh satrlar null', companyContact({ phone: '  ', telegram: '', latitude: null, longitude: null, address: '' }), { phone: null, telegram: null, mapUrl: null });
check('4) 0 koordinata ham haqiqiy', companyContact({ latitude: 0, longitude: 0 }).mapUrl, 'https://www.google.com/maps/dir/?api=1&destination=0%2C0');
check('4) yarim koordinata — manzilga qaytadi', companyContact({ latitude: 41, longitude: null, address: 'X' }).mapUrl, 'https://www.google.com/maps/dir/?api=1&destination=X');
checkTrue('4) noma’lum maydonlar e’tiborsiz', !('email' in companyContact({ email: 'a@b', phone: '1' })));

// ── 5) Egasi o'chirilgan kompaniya — kontakt yo'q ──────────────────
sqlite.prepare(`UPDATE users SET deleted_at = '2026-10-01 00:00:00' WHERE id = 1`).run();
r = await call('/api/feed?limit=30', { cookie: cookie.other });
checkTrue('5) egasi o‘chirilgan — biznes posti va kontakti lentada yo‘q', !JSON.stringify(r.body).includes('+998901234567'));
r = await call('/api/companies/ACMEUZ/posts');
check('5) egasi o‘chirilgan — ro‘yxat bo‘sh', r.body, { posts: [] });

done();
