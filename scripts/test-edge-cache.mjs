// Public javoblarni chekkada keshlash — xavfsizlik va to'g'rilik testi.
//   node scripts/test-edge-cache.mjs
//
// Keshlashda eng katta xavf — foydalanuvchiga bog'liq javobni boshqa
// odamga berib qo'yish. Shuning uchun bu yerda AYNAN shu tekshiriladi:
// kirgan foydalanuvchi keshga umuman tegmasligi kerak.

// Workers'dagi `caches` ni taqlid qilamiz — worker import qilinishidan OLDIN.
const store = new Map();
let puts = 0, hits = 0;
globalThis.caches = {
  default: {
    async match(req) {
      const k = typeof req === 'string' ? req : req.url;
      const r = store.get(k);
      if (r) { hits++; return r.clone(); }
      return undefined;
    },
    async put(req, res) {
      const k = typeof req === 'string' ? req : req.url;
      store.set(k, res.clone()); puts++;
    },
  },
};

const worker = (await import('../hosting/worker.js')).default;
const { makeEnv, seedBasic, cookie, req, makeChecker } = await import('./lib/d1-harness.mjs');

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const call = async (pathname, init) => {
  const r = await worker.fetch(req(pathname, init), env);
  const text = await r.text();
  return { status: r.status, cc: r.headers.get('cache-control'), text };
};

// ═══ 1. MEHMON: birinchi so'rov keshga yoziladi, ikkinchisi keshdan keladi ═══
{
  store.clear(); puts = 0; hits = 0;
  const a = await call('/api/records');
  check('birinchi so\'rov 200', a.status, 200);
  check('javobga cache-control qo\'yiladi', a.cc, 'public, max-age=60');
  check('kesh yozildi', puts, 1);

  const b = await call('/api/records');
  check('ikkinchi so\'rov keshdan keldi', hits, 1);
  check('kesh yana yozilmadi', puts, 1);
  check('keshdagi javob AYNAN bir xil', b.text, a.text);
  checkTrue('javob haqiqiy katalog (massiv)', Array.isArray(JSON.parse(b.text)));
}

// ═══ 2. KIRGAN FOYDALANUVCHI keshga UMUMAN tegmaydi ═══
// Eng muhim tekshiruv: sessiyasi bor odam na keshdan o'qiydi, na yozadi.
{
  store.clear(); puts = 0; hits = 0;
  const first = await call('/api/records', { cookie: cookie.user });
  check('kirgan foydalanuvchi javobi 200', first.status, 200);
  check('kirgan foydalanuvchi keshdan O\'QIMADI', hits, 0);
  check('kirgan foydalanuvchi keshga YOZMADI', puts, 0);
  check('unga cache-control qo\'yilmadi', first.cc, null);

  // Mehmon keshi to'lgan bo'lsa ham, kirgan odam yangi ma'lumot oladi.
  await call('/api/records');
  check('mehmon keshi to\'ldi', puts, 1);
  hits = 0;
  await call('/api/records', { cookie: cookie.user });
  check('kirgan foydalanuvchi hamon keshdan o\'qimaydi', hits, 0);
}

// ═══ 3. Kategoriyalar ham keshlanadi va mazmuni buzilmaydi ═══
{
  store.clear(); puts = 0; hits = 0;
  const a = await call('/api/categories');
  check('kategoriyalar 200', a.status, 200);
  checkTrue('javobda categories massivi bor', Array.isArray(JSON.parse(a.text).categories));
  const b = await call('/api/categories');
  check('kategoriyalar keshdan keldi', hits, 1);
  check('mazmuni o\'zgarmagan', b.text, a.text);
}

// ═══ 4. Har bir endpoint O'Z kalitida saqlanadi (aralashib ketmaydi) ═══
{
  store.clear();
  await call('/api/records');
  await call('/api/categories');
  check('ikkita alohida kesh kaliti', store.size, 2);
  const recs = await call('/api/records');
  checkTrue('katalog javobi hamon massiv (kategoriyalar bilan almashmagan)', Array.isArray(JSON.parse(recs.text)));
}

done();
