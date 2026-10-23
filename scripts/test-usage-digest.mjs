import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { collectUsageDigest, formatUsageDigest, runUsageDigest, handle } from '../hosting/api/usage-digest.js';

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,created_at TEXT,deleted_at TEXT,is_test INTEGER,is_internal INTEGER);
CREATE TABLE admin_settings(key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE app_users(user_id INTEGER PRIMARY KEY,first_seen TEXT,last_seen TEXT,platform TEXT);
CREATE TABLE cards(code TEXT PRIMARY KEY,user_id INTEGER);
CREATE TABLE card_events(code TEXT,event_type TEXT,created_at TEXT);
CREATE TABLE posts(user_id INTEGER,created_at TEXT);
CREATE TABLE content_comments(user_id INTEGER,created_at TEXT,deleted_at TEXT);`);
function stmt(sql,args=[]) {
  return { bind(...a){return stmt(sql,a);}, async first(){return db.prepare(sql).get(...args)||null;}, async all(){return {results:db.prepare(sql).all(...args)};}, async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}};} };
}
const env={DB:{prepare:stmt},TELEGRAM_BOT_TOKEN:'test',ADMIN_CHAT_ID:'test'};
const now=Date.parse('2026-10-23T16:00:00Z');
db.exec(`INSERT INTO users VALUES
 (1,'2026-10-23T10:00:00Z',NULL,0,0),
 (2,'2026-10-22 16:00:00+00',NULL,0,0),
 (3,'2026-10-23T12:00:00Z',NULL,1,0),
 (4,'2026-10-23T12:00:00Z',NULL,0,1),
 (5,'2026-10-23T12:00:00Z','2026-10-23',0,0),
 (6,'2026-10-23T16:00:00Z',NULL,0,0),
 (7,'2026-10-22T15:59:59Z',NULL,0,0);
 INSERT INTO app_users VALUES
 (1,'2026-10-23T10:00:00Z','2026-10-23T15:00:00Z','android'),
 (2,'2026-10-01T10:00:00Z','2026-10-23 12:00:00+00','ios'),
 (3,'2026-10-23T10:00:00Z','2026-10-23T15:00:00Z','android'),
 (7,'2026-10-01T10:00:00Z','2026-10-22T15:59:59Z','android');
 INSERT INTO cards VALUES ('REAL',1),('TEST',3);
 INSERT INTO card_events VALUES ('REAL','profile_view','2026-10-23T14:00:00Z'),('REAL','contact_save','2026-10-23 14:00:00+00'),('TEST','profile_view','2026-10-23T14:00:00Z');
 INSERT INTO posts VALUES(1,'2026-10-23T12:00:00Z'),(3,'2026-10-23T12:00:00Z');
 INSERT INTO content_comments VALUES(1,'2026-10-23T12:00:00Z',NULL),(1,'2026-10-23T12:00:00Z','deleted'),(4,'2026-10-23T12:00:00Z',NULL);`);
const d=await collectUsageDigest(env,now);
assert.equal(d.total,4);
assert.equal(d.signups,2,'mixed timestamps, inclusive lower / exclusive upper bounds');
assert.equal(d.active,2);assert.equal(d.firstApp,1);assert.equal(d.android,1);assert.equal(d.ios,1);
assert.equal(d.profiles,1);assert.equal(d.contactSaves,1);assert.equal(d.posts,1);assert.equal(d.comments,1);
const text=formatUsageDigest(d);
assert.ok(text.includes('2026-10-23 21:00'));
assert.ok(text.includes('yuklab olishlari: ulanmagan'));
assert.ok(!text.includes('test-bot-token'));
let calls=0;
const H={sendTelegramMessage:async()=>{calls++;return true;}};
assert.deepEqual(await runUsageDigest(env,H,now),{sent:true});
assert.deepEqual(await runUsageDigest(env,H,now+1000),{skipped:'already_claimed'});assert.equal(calls,1);
await assert.rejects(runUsageDigest(env,{sendTelegramMessage:async()=>false},now+86400000),/telegram_send_failed/);
assert.deepEqual(await runUsageDigest(env,H,now+86400000),{sent:true},'failed delivery permits retry');
await env.DB.prepare('INSERT INTO admin_settings VALUES (?,?)').bind('telegram_usage_digest:2026-10-25',String(now+2*86400000-601000)).run();
assert.deepEqual(await runUsageDigest(env,H,now+2*86400000),{sent:true},'abandoned lease recovers');
assert.deepEqual(await runUsageDigest({...env,TELEGRAM_BOT_TOKEN:''},H,now),{skipped:'not_configured'});
db.exec('DROP TABLE content_comments');
assert.equal((await collectUsageDigest(env,now)).comments,null,'missing metric is unavailable, not zero');
const json=(data,status=200)=>Response.json(data,{status});
const url=new URL('https://nfcstore.uz/api/admin/usage-digest');
assert.equal((await handle(new Request(url),env,url,{json,requireAdmin:async()=>null})).status,401);
assert.equal((await handle(new Request(url),env,url,{json,requireAdmin:async()=>({role:'manager'})})).status,403);
const before=calls;
assert.equal((await handle(new Request(url),env,url,{...H,json,requireAdmin:async()=>({role:'super_admin'})})).status,200);
assert.equal(calls,before,'GET preview never sends');
console.log('PASS: digest counts, real-user filters, UTC+5 formatting, bounds, deduplication, retries, missing tables, permissions and read-only preview');
