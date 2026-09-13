// PROFIL JAVOBIDA TARIF BO'LISHI KERAK.
//
// Ilgari javobda tarif yo'q edi va mijozlar (mobil ilova) uni NARXDAN
// taxmin qilardi. Sovg'a qilingan yoki narxi 0 bo'lgan ID'da bu xato
// beradi: VIP001 ilovada "Free" bo'lib ko'rinardi, holbuki u
// ekslyuziv. Qoida endi bitta joyda — serverda.
//
//   node scripts/test-record-tier.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

const add = sqlite.prepare(
  `INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES (?,?,?,?,1,'personal')`);
// VIP001 seedBasic da allaqachon bor — narxini 0 qilamiz, ya'ni
// narxga qarab taxmin qilish ishlamay qoladi.
sqlite.prepare(`UPDATE cards SET price = 0 WHERE code = 'VIP001'`).run();
add.run('KTB482', 'Bronza', 49000, Date.now());
add.run('AAA111', 'Bir xil', 0, Date.now());

const tier = async (code) => {
  const r = await worker.fetch(req(`/api/records/${code}`), env);
  return (await r.json()).tier;
};

// VIP — ekslyuziv so'z. Narxi 0 bo'lsa ham tarif to'g'ri kelishi kerak.
check('VIP001 narxi 0 bo‘lsa ham exclusive', await tier('VIP001'), 'exclusive');
// Harflar ham, raqamlar ham bir xil — ekslyuziv.
check('AAA111 exclusive', await tier('AAA111'), 'exclusive');
// Oddiy kod.
checkTrue('KTB482 tarifi bor', typeof (await tier('KTB482')) === 'string');

// `tierOverride` hamma narsadan ustun — admin qo‘lda belgilagan.
sqlite.prepare(`UPDATE cards SET tier_override = 'silver' WHERE code = 'VIP001'`).run();
check('tierOverride ustun turadi', await tier('VIP001'), 'silver');

// `/api/auth/me` javobidagi kartalarda ham bo‘lishi kerak — ilova
// shaxs almashtirgichini aynan shundan quradi.
const me = await (await worker.fetch(req('/api/auth/me', { cookie: cookie.user }), env)).json();
checkTrue('me.cards da tarif bor', (me.cards || []).every((c) => typeof c.tier === 'string' && c.tier));

// Mavjud maydonlar JOYIDA — sayt shu javobga bog'langan.
const one = await (await worker.fetch(req('/api/records/VIP001'), env)).json();
for (const k of ['code', 'name', 'price', 'views', 'profileType', 'verified']) {
  checkTrue(`maydon joyida: ${k}`, Object.hasOwn(one, k));
}

done();
