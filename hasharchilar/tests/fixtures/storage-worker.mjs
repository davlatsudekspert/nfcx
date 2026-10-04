// FAQAT tests/storage.test.mjs uchun (vaqtinchalik wrangler dev da ishlaydi, deploy qilinmaydi).
// Bir xil so'rovlarni haqiqiy lokal D1 (env.D1) va HasharDB adapteri (env.HASHAR_DB) da bajarib,
// natija yoki xato matnini qaytaradi — test ularni solishtiradi.
import { DoDatabase } from '../../worker/d1-adapter.js';
import { HasharDB } from '../../worker/do-db.js';
import { MIGRATIONS } from '../../worker/migrations.js';
import { splitSql } from '../../worker/sql-split.js';

export { HasharDB };

const stmt = (db, s) => db.prepare(s.sql).bind(...(s.params || []));

async function runOp(db, target, op) {
  switch (op.kind) {
    case 'migrate':
      // DO o'zi (konstruktorda) qo'llaydi; D1 ga — xuddi shu migratsiyalar
      if (target === 'd1') for (const m of MIGRATIONS) await db.batch(splitSql(m.sql).map((sql) => db.prepare(sql)));
      return null;
    case 'all':
      return stmt(db, op).all();
    case 'run':
      return stmt(db, op).run();
    case 'first':
      return op.col === undefined ? stmt(db, op).first() : stmt(db, op).first(op.col);
    case 'raw':
      return stmt(db, op).raw(op.options);
    case 'batch':
      return db.batch(op.stmts.map((s) => stmt(db, s)));
    case 'bind':
      // bind() turini tekshirish (undefined → D1_TYPE_ERROR, boolean → 0/1)
      return db.prepare('SELECT ?1 AS v').bind(op.value === '__undefined__' ? undefined : op.value).first('v');
    default:
      throw new Error(`noma'lum op: ${op.kind}`);
  }
}

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('ok'); // tayyorlik tekshiruvi
    const { target, name = 'test', ops } = await req.json();
    const db = target === 'd1' ? env.D1 : new DoDatabase(env.HASHAR_DB.get(env.HASHAR_DB.idFromName(name)));
    const out = [];
    for (const op of ops) {
      try {
        out.push({ ok: true, value: (await runOp(db, target, op)) ?? null });
      } catch (err) {
        out.push({ ok: false, error: String(err?.message ?? err) });
      }
    }
    return Response.json(out);
  },
};
