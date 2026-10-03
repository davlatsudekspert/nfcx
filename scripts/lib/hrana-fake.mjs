// Soxta sqld: Hrana v2 HTTP pipeline (`/v2/pipeline`) node:sqlite ustida.
// hosting/uz-store.js dagi D1 adapterini butun test to'plami bilan sinash
// uchun — adapter tarmoqqa chiqmaydi, `fetch` o'rniga shu funksiya beriladi.
// Haqiqiy sqld bilan moslik alohida: scripts/test-uz-store.mjs (UZ_TEST_DB_URL).

const fromArg = (v) => {
  switch (v?.type) {
    case 'integer': { const n = Number(v.value); return Number.isSafeInteger(n) ? n : BigInt(v.value); }
    case 'float': return Number(v.value);
    case 'text': return v.value;
    case 'blob': return Uint8Array.from(Buffer.from(v.base64 || '', 'base64'));
    default: return null;
  }
};

const toValue = (v) => {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  if (typeof v === 'string') return { type: 'text', value: v };
  if (v instanceof Uint8Array) return { type: 'blob', base64: Buffer.from(v).toString('base64') };
  return { type: 'text', value: String(v) };
};

const READ_RE = /^\s*(select|values|pragma\s+\w+\s*(\(|;|$))/i;

// Haqiqiy sqld so'rovni o'z parseri bilan QAYTA YOZIB bajaradi: qo'shtirnoqsiz
// SQLite kalit so'zi bo'lgan nom (`AS following`, `ADD COLUMN plan`) KATTA harf
// bilan qaytadi (yagona istisno — bitta CREATE TABLE). Soxta server ham shunday
// qiladi, aks holda bunday xato testlarda ko'rinmasdi.
export const SQLITE_KEYWORDS = new Set('ABORT ACTION ADD AFTER ALL ALTER ALWAYS ANALYZE AND AS ASC ATTACH AUTOINCREMENT BEFORE BEGIN BETWEEN BY CASCADE CASE CAST CHECK COLLATE COLUMN COMMIT CONFLICT CONSTRAINT CREATE CROSS CURRENT CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP DATABASE DEFAULT DEFERRABLE DEFERRED DELETE DESC DETACH DISTINCT DO DROP EACH ELSE END ESCAPE EXCEPT EXCLUDE EXCLUSIVE EXISTS EXPLAIN FAIL FILTER FIRST FOLLOWING FOR FOREIGN FROM FULL GENERATED GLOB GROUP GROUPS HAVING IF IGNORE IMMEDIATE IN INDEX INDEXED INITIALLY INNER INSERT INSTEAD INTERSECT INTO IS ISNULL JOIN KEY LAST LEFT LIKE LIMIT MATCH MATERIALIZED NATURAL NO NOT NOTHING NOTNULL NULL NULLS OF OFFSET ON OR ORDER OTHERS OUTER OVER PARTITION PLAN PRAGMA PRECEDING PRIMARY QUERY RAISE RANGE RECURSIVE REFERENCES REGEXP REINDEX RELEASE RENAME REPLACE RESTRICT RETURNING RIGHT ROLLBACK ROW ROWS SAVEPOINT SELECT SET TABLE TEMP TEMPORARY THEN TIES TO TRANSACTION TRIGGER UNBOUNDED UNION UNIQUE UPDATE USING VACUUM VALUES VIEW VIRTUAL WHEN WHERE WINDOW WITH WITHOUT'.split(' '));
export function sqldRewrite(sql) {
  if (/^\s*CREATE\s+TABLE\b/i.test(sql)) return sql;
  return sql.replace(/\b(AS|ADD\s+COLUMN)(\s+)([A-Za-z_][A-Za-z0-9_]*)\b/gi,
    (m, kw, sp, name) => (SQLITE_KEYWORDS.has(name.toUpperCase()) ? `${kw}${sp}${name.toUpperCase()}` : m));
}

export function hranaFetch(sqlite, { token = 'test-token', log } = {}) {
  function execute(stmt) {
    const args = (stmt.args || []).map(fromArg);
    const st = sqlite.prepare(sqldRewrite(stmt.sql));
    const cols = st.columns().map((c) => ({ name: c.name, decltype: c.type }));
    let rows = [];
    let affected = 0;
    let lastId = null;
    if (cols.length) {
      rows = st.all(...args).map((r) => cols.map((c) => toValue(r[c.name])));
      if (!READ_RE.test(stmt.sql)) {
        const m = sqlite.prepare('SELECT changes() AS c, last_insert_rowid() AS r').get();
        affected = m.c; lastId = String(m.r);
      }
    } else {
      const info = st.run(...args);
      affected = READ_RE.test(stmt.sql) ? 0 : Number(info.changes);
      lastId = String(info.lastInsertRowid);
    }
    return { cols, rows, affected_row_count: affected, last_insert_rowid: lastId, rows_read: rows.length, rows_written: affected };
  }

  function evalCond(cond, results, errors) {
    if (!cond) return true;
    switch (cond.type) {
      case 'ok': return results[cond.step] != null;
      case 'error': return errors[cond.step] != null;
      case 'not': return !evalCond(cond.cond, results, errors);
      case 'and': return cond.conds.every((c) => evalCond(c, results, errors));
      case 'or': return cond.conds.some((c) => evalCond(c, results, errors));
      default: throw new Error(`unknown condition ${cond.type}`);
    }
  }

  function batch({ steps }) {
    const results = []; const errors = [];
    steps.forEach((step, i) => {
      results[i] = null; errors[i] = null;
      if (!evalCond(step.condition, results, errors)) return;
      try { results[i] = execute(step.stmt); } catch (e) { errors[i] = { message: e.message, code: e.code || 'SQLITE_ERROR' }; }
    });
    return { step_results: results, step_errors: errors };
  }

  return async (url, init = {}) => {
    if (!String(url).endsWith('/v2/pipeline')) return new Response('not found', { status: 404 });
    if ((init.headers?.authorization || '') !== `Bearer ${token}`) return new Response('unauthorized', { status: 401 });
    const body = JSON.parse(init.body);
    log?.(body);
    const results = body.requests.map((req) => {
      try {
        switch (req.type) {
          case 'close': return { type: 'ok', response: { type: 'close' } };
          case 'execute': return { type: 'ok', response: { type: 'execute', result: execute(req.stmt) } };
          case 'batch': return { type: 'ok', response: { type: 'batch', result: batch(req.batch) } };
          case 'sequence': sqlite.exec(req.sql); return { type: 'ok', response: { type: 'sequence' } };
          default: return { type: 'error', error: { message: `unknown request ${req.type}` } };
        }
      } catch (e) {
        return { type: 'error', error: { message: e.message, code: e.code || 'SQLITE_ERROR' } };
      }
    });
    return new Response(JSON.stringify({ baton: null, base_url: null, results }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
}
