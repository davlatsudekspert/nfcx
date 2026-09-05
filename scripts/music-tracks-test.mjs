// Profile music — up to 5 tracks stored in the existing `music_url` D1
// column as a JSON array (no schema migration), backward-compatible with
// the legacy single-URL string format.
//
// Runs the ACTUAL functions exported from hosting/worker.js against an
// in-memory, D1-API-compatible SQLite database — never touches production.
//
//   node scripts/music-tracks-test.mjs
import { DatabaseSync } from 'node:sqlite';
import {
  createRecordD1, getRecord, validateRecordBody, updateRecord, parseMusicUrls, ensureCoreSchema,
} from '../hosting/worker.js';

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}

const sqlite = new DatabaseSync(':memory:');
function makeStmt(sql) {
  return {
    _sql: sql, _args: [],
    bind(...args) { this._args = args; return this; },
    async first() {
      const row = sqlite.prepare(this._sql).get(...this._args);
      return row === undefined ? null : row;
    },
    async all() {
      const results = sqlite.prepare(this._sql).all(...this._args);
      return { results };
    },
    async run() {
      const info = sqlite.prepare(this._sql).run(...this._args);
      return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
    },
  };
}
const env = {
  DB: {
    prepare: (sql) => makeStmt(sql),
    async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; },
    exec: (sql) => sqlite.exec(sql),
  },
};
// Table ensureCoreSchema doesn't create (assumed pre-existing from the
// original D1 migration import) but that getRecord()'s query joins on —
// same as scripts/payme-order-flow-test.mjs.
env.DB.exec(`
  CREATE TABLE IF NOT EXISTS "nfc_gifts" (
    "id" INTEGER PRIMARY KEY NOT NULL, "code" TEXT (16) NOT NULL, "recipient_name" TEXT, "note" TEXT,
    "activation_code" TEXT (20) NOT NULL, "status" TEXT (20) DEFAULT 'reserved' NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, "activated_at" TEXT, "activated_by_user_id" INTEGER,
    "value" INTEGER, UNIQUE ("activation_code"), UNIQUE ("code")
  );
`);

await ensureCoreSchema(env);

// ---------- parseMusicUrls: pure-function unit tests ----------
check('parseMusicUrls: null/empty -> []', parseMusicUrls(null), []);
check('parseMusicUrls: legacy single URL string -> [url]', parseMusicUrls('https://a.test/x.mp3'), ['https://a.test/x.mp3']);
check('parseMusicUrls: JSON array passthrough', parseMusicUrls(JSON.stringify(['https://a.test/1.mp3', 'https://a.test/2.mp3'])), ['https://a.test/1.mp3', 'https://a.test/2.mp3']);
check('parseMusicUrls: caps at 5', parseMusicUrls(JSON.stringify(['1', '2', '3', '4', '5', '6', '7'])), ['1', '2', '3', '4', '5']);
check('parseMusicUrls: drops non-string entries', parseMusicUrls(JSON.stringify(['ok', 5, null, ''])), ['ok']);

// ---------- validateRecordBody: caps + validates + accepts legacy field ----------
{
  const urls = Array.from({ length: 7 }, (_, i) => `https://cdn.test/${i}.mp3`);
  const { record } = validateRecordBody({ name: 'Test', musicUrls: urls });
  check('validateRecordBody: musicUrls capped at 5', record.musicUrls.length, 5);
  check('validateRecordBody: musicUrls keeps first 5 in order', record.musicUrls, urls.slice(0, 5));
}
{
  const { record } = validateRecordBody({ name: 'Test', musicUrls: ['https://good.test/a.mp3', 'not a url', ''] });
  check('validateRecordBody: invalid entries filtered out', record.musicUrls, ['https://good.test/a.mp3']);
}
{
  const { record } = validateRecordBody({ name: 'Test', musicUrl: 'https://legacy.test/one.mp3' });
  check('validateRecordBody: legacy singular musicUrl still accepted', record.musicUrls, ['https://legacy.test/one.mp3']);
}
{
  const { record } = validateRecordBody({ name: 'Test' });
  check('validateRecordBody: no music -> empty array, not undefined', record.musicUrls, []);
}

// ---------- end-to-end: create -> update with 5 tracks -> read back ----------
await createRecordD1(env, { code: 'MUS001', name: 'Music Owner', price: 0 });
{
  const initial = await getRecord(env, 'MUS001');
  check('new record starts with no music', initial.musicUrls, []);
  check('new record legacy musicUrl field also empty', initial.musicUrl, '');
}
{
  const fiveUrls = [
    'https://cdn.test/song1.mp3', 'https://cdn.test/song2.mp3', 'https://cdn.test/song3.mp3',
    'https://cdn.test/song4.mp3', 'https://cdn.test/song5.mp3',
  ];
  const { record } = validateRecordBody({ name: 'Music Owner', musicUrls: fiveUrls });
  await updateRecord(env, 'MUS001', record);
  const after = await getRecord(env, 'MUS001');
  check('after update: all 5 tracks round-trip correctly', after.musicUrls, fiveUrls);
  check('after update: legacy musicUrl = first track (back-compat for old consumers)', after.musicUrl, fiveUrls[0]);
}
{
  // Trim down to 2 tracks — must fully replace, not merge/append.
  const { record } = validateRecordBody({ name: 'Music Owner', musicUrls: ['https://cdn.test/only-a.mp3', 'https://cdn.test/only-b.mp3'] });
  await updateRecord(env, 'MUS001', record);
  const after = await getRecord(env, 'MUS001');
  check('shrinking the list replaces (not merges) stored tracks', after.musicUrls, ['https://cdn.test/only-a.mp3', 'https://cdn.test/only-b.mp3']);
}
{
  // Clearing all music.
  const { record } = validateRecordBody({ name: 'Music Owner', musicUrls: [] });
  await updateRecord(env, 'MUS001', record);
  const after = await getRecord(env, 'MUS001');
  check('clearing musicUrls empties the list', after.musicUrls, []);
}

// ---------- backward compatibility: a pre-existing legacy row (plain URL
// string, not JSON) written directly, as a real production row from
// before this change would look ----------
await createRecordD1(env, { code: 'LEG001', name: 'Legacy Owner', price: 0 });
sqlite.prepare(`UPDATE cards SET music_url = ? WHERE code = ?`).run('https://old-style.test/track.mp3', 'LEG001');
{
  const rec = await getRecord(env, 'LEG001');
  check('legacy plain-string music_url row reads as a 1-item list', rec.musicUrls, ['https://old-style.test/track.mp3']);
  check('legacy plain-string music_url row still exposes singular musicUrl', rec.musicUrl, 'https://old-style.test/track.mp3');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
