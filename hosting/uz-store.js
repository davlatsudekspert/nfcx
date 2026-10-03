// ── O'ZBEKISTONDAGI BAZA VA FAYL OMBORI (D1 / R2 O'RNIGA) ─────────────
//
// 547-son "Shaxsga doir ma'lumotlar to'g'risida"gi Qonun, 27-1-modda:
// O'zbekiston fuqarolarining shaxsiy ma'lumotlari O'zbekiston hududidagi
// serverda saqlanishi shart. Worker Cloudflare'da qoladi, ma'lumotlar esa
// MYCLOUD (Toshkent) serverida:
//
//   env.DB      → sqld (libSQL, SQLite bilan mos), Hrana HTTP orqali
//   env.UPLOADS → Garage (S3 bilan mos), AWS SigV4 imzosi bilan
//
// Ikkala adapter D1 va R2 API'sini AYNAN takrorlaydi — ilovaning qolgan
// kodi (1000 dan ortiq `env.DB.prepare` chaqiruvi) o'zgarmaydi.
//
// Yoqish (Worker secret'lari): UZ_STORE=on, UZ_DB_URL, UZ_DB_TOKEN,
// UZ_S3_ENDPOINT, UZ_S3_BUCKET, UZ_S3_KEY_ID, UZ_S3_SECRET.
// UZ_STORE yo'q yoki "on" emas — hammasi avvalgidek D1/R2 da.
//
// UZ_UPLOADS_FALLBACK=r2 — ko'chirish davri uchun: fayl O'zbekistonda
// topilmasa R2 dan o'qiladi (yangi fayllar faqat O'zbekistonga yoziladi,
// o'chirish ikkalasidan). Oxirgi nusxalashdan keyin o'chiriladi.
//
// UZ_MAINTENANCE=on — bazani ko'chirish daqiqalari (tunda, ~5 daqiqa):
// Worker'ga kelgan har so'rov 503 "texnik ishlar" oladi, D1 ga hech kim
// yozmaydi — eksport va ko'chirish paytida birorta yozuv yo'qolmaydi.

const enc = new TextEncoder();

// ── D1 ↔ Hrana qiymatlari ─────────────────────────────────────────────

function d1TypeError(v) {
  return new Error(`D1_TYPE_ERROR: Type '${typeof v}' not supported for value '${String(v).slice(0, 40)}'`);
}

function bytesOf(v) {
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  return null;
}

function b64encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function b64decode(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toHrana(v) {
  if (v === null) return { type: 'null' };
  if (v === undefined) throw d1TypeError(v);
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { type: 'null' };
    // D1 kabi: butun son — INTEGER, kasr — REAL.
    return Number.isSafeInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  }
  // Yolg'iz surrogat (emoji o'rtasidan kesilgan matn) — sqld butun so'rovni
  // rad etadi, D1 esa saqlaydi va U+FFFD qilib qaytaradi. Biz ham shunday.
  if (typeof v === 'string') return { type: 'text', value: typeof v.toWellFormed === 'function' ? v.toWellFormed() : v };
  const bytes = bytesOf(v);
  if (bytes) return { type: 'blob', base64: b64encode(bytes) };
  throw d1TypeError(v);
}

export function fromHrana(v) {
  switch (v?.type) {
    case 'integer': return Number(v.value);
    case 'float': return Number(v.value);
    case 'text': return v.value;
    // D1 BLOB ni sonlar massivi qilib qaytaradi.
    case 'blob': return Array.from(b64decode(v.base64 || ''));
    default: return null;
  }
}

function d1Error(err) {
  const e = new Error(`D1_ERROR: ${err?.message || 'unknown error'}${err?.code ? `: ${err.code}` : ''}`);
  e.code = err?.code;
  return e;
}

function toD1Result(result, startedAt) {
  const names = (result.cols || []).map((c) => c.name);
  const results = (result.rows || []).map((row) => {
    const o = {};
    for (let i = 0; i < names.length; i++) o[names[i]] = fromHrana(row[i]);
    return o;
  });
  const changes = Number(result.affected_row_count || 0);
  return {
    success: true,
    results,
    meta: {
      served_by: 'uz-sqld',
      duration: Date.now() - startedAt,
      changes,
      last_row_id: result.last_insert_rowid == null ? 0 : Number(result.last_insert_rowid),
      changed_db: changes > 0,
      size_after: 0,
      rows_read: Number(result.rows_read || 0),
      rows_written: Number(result.rows_written || 0),
    },
  };
}

// SELECT emas — yozuvchi (batch BEGIN IMMEDIATE bilan boshlanadi).
const WRITE_SQL_RE = /^\s*(insert|update|delete|replace|create|drop|alter|reindex|vacuum|pragma\s+\w+\s*=|with\b[\s\S]*\b(insert|update|delete|replace)\b)/i;
export const isWriteSql = (sql) => WRITE_SQL_RE.test(String(sql || ''));

// ── D1 adapter (sqld, Hrana v2 HTTP pipeline) ─────────────────────────

// D1 tashqi kalitlarni DOIM tekshiradi (ON DELETE CASCADE ishlaydi),
// SQLite/sqld esa standart holatda yo'q. Shuning uchun har so'rov oqimi
// `PRAGMA foreign_keys = ON` bilan boshlanadi — xuddi D1 dagidek.
// `foreignKeys: false` — faqat ko'chirish vositasi uchun (jadvallar
// tartibi muhim bo'lmasin).
// Tarmoq/HTTP xatolari soni (SQL xatolari emas) — ensureCoreSchema sxema
// belgisini faqat shu davrda tarmoq xatosi bo'lmagan bo'lsa yozadi.
let netErrors = 0;
export const uzDbNetErrors = () => netErrors;

export function uzDb({ url, token, fetch: doFetch = (...a) => fetch(...a), foreignKeys = true }) {
  const endpoint = `${String(url).replace(/\/+$/, '')}/v2/pipeline`;
  const pragma = { type: 'execute', stmt: { sql: `PRAGMA foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`, want_rows: false } };

  // BIR HTTP SO'ROVGA BIRLASHTIRISH. Cloudflare bitta Worker so'roviga
  // tashqi so'rovlar sonini cheklaydi (Free: 50). Bir vaqtda (parallel
  // promise'lardan) kelgan statement'lar navbatga yig'iladi va bitta
  // pipeline bilan yuboriladi. Har biri pipeline'da MUSTAQIL so'rov —
  // natijasi va xatosi alohida; tranzaksiya (batch) bitta so'rov ichida
  // yaxlit qoladi, boshqalar unga aralashmaydi.
  const MAX_PER_HTTP = 60;
  let queue = [];
  let scheduled = false;

  async function send(requests) {
    let res;
    try {
      res = await doFetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ baton: null, requests: [pragma, ...requests, { type: 'close' }] }),
      });
    } catch (e) {
      netErrors++;
      throw new Error(`D1_ERROR: uz-db network ${String(e?.message || e).slice(0, 120)}`);
    }
    if (!res.ok) {
      netErrors++;
      const text = await res.text().catch(() => '');
      throw new Error(`D1_ERROR: uz-db HTTP ${res.status} ${text.slice(0, 120)}`);
    }
    const body = await res.json();
    const results = body.results || [];
    if (results[0]?.type !== 'ok') throw d1Error(results[0]?.error);
    return results.slice(1);
  }

  function flush() {
    scheduled = false;
    while (queue.length) {
      const group = [];
      let size = 0;
      while (queue.length && (!group.length || size + queue[0].requests.length <= MAX_PER_HTTP)) {
        const item = queue.shift();
        group.push(item);
        size += item.requests.length;
      }
      send(group.flatMap((g) => g.requests)).then((results) => {
        let k = 0;
        for (const g of group) { g.resolve(results.slice(k, k + g.requests.length)); k += g.requests.length; }
      }, (err) => { for (const g of group) g.reject(err); });
    }
  }

  function pipeline(requests) {
    return new Promise((resolve, reject) => {
      queue.push({ requests, resolve, reject });
      if (!scheduled) { scheduled = true; setTimeout(flush, 0); }
    });
  }

  const stmtJson = (sql, args) => ({ sql, args: args.map(toHrana), want_rows: true });

  class Statement {
    constructor(sql, args = []) { this._sql = sql; this._args = args; }

    // D1 kabi: `bind` YANGI statement qaytaradi, eskisi o'zgarmaydi.
    bind(...args) { return new Statement(this._sql, args); }

    async all() {
      const startedAt = Date.now();
      const [r] = await pipeline([{ type: 'execute', stmt: stmtJson(this._sql, this._args) }]);
      if (!r || r.type !== 'ok') throw d1Error(r?.error);
      return toD1Result(r.response.result, startedAt);
    }

    async run() { return this.all(); }

    async first(col) {
      const { results } = await this.all();
      const row = results[0];
      if (!row) return null;
      if (col === undefined) return row;
      if (!(col in row)) throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${col})`);
      return row[col];
    }

    async raw(opts = {}) {
      const { results } = await this.all();
      const rows = results.map((o) => Object.values(o));
      if (opts.columnNames) {
        const names = results[0] ? Object.keys(results[0]) : [];
        return [names, ...rows];
      }
      return rows;
    }
  }

  const db = {
    prepare: (sql) => new Statement(sql),

    // D1 `batch` — BITTA tranzaksiya: biror statement yiqilsa hammasi
    // bekor bo'ladi. Hrana batch shartlari bilan: BEGIN → har statement
    // oldingisi muvaffaqiyatli bo'lsa → COMMIT; COMMIT bo'lmasa ROLLBACK.
    async batch(stmts) {
      if (!stmts.length) return [];
      const startedAt = Date.now();
      const write = stmts.some((s) => isWriteSql(s._sql));
      const n = stmts.length;
      const steps = [{ stmt: { sql: write ? 'BEGIN IMMEDIATE' : 'BEGIN DEFERRED' } }];
      stmts.forEach((s, i) => steps.push({ stmt: stmtJson(s._sql, s._args), condition: { type: 'ok', step: i } }));
      steps.push({ stmt: { sql: 'COMMIT' }, condition: { type: 'ok', step: n } });
      steps.push({ stmt: { sql: 'ROLLBACK' }, condition: { type: 'not', cond: { type: 'ok', step: n + 1 } } });
      const [r] = await pipeline([{ type: 'batch', batch: { steps } }]);
      if (!r || r.type !== 'ok') throw d1Error(r?.error);
      const { step_results: res = [], step_errors: errs = [] } = r.response.result;
      // Birinchi xato — D1 ham aynan shu statement xatosini otadi.
      for (let i = 0; i <= n + 1; i++) if (errs[i]) throw d1Error(errs[i]);
      return stmts.map((_, i) => toD1Result(res[i + 1] || {}, startedAt));
    },

    async exec(sql) {
      const startedAt = Date.now();
      const [r] = await pipeline([{ type: 'sequence', sql }]);
      if (!r || r.type !== 'ok') throw d1Error(r?.error);
      return { count: String(sql).split(';').filter((s) => s.trim()).length, duration: Date.now() - startedAt };
    },

    withSession() { return { ...db, getBookmark: () => null }; },
  };
  return db;
}

// ── AWS Signature V4 (S3) ─────────────────────────────────────────────

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256Hex = async (data) => hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(msg));
}

// RFC 3986: faqat A-Z a-z 0-9 - _ . ~ ochiq qoladi (S3 talabi).
export const s3Encode = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const encodeKeyPath = (key) => String(key).split('/').map(s3Encode).join('/');

export async function signV4({ method, url, headers = {}, payloadHash, keyId, secret, region, now = new Date() }) {
  const u = new URL(url);
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const h = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])) };
  h.host = u.host;
  h['x-amz-date'] = amzDate;
  h['x-amz-content-sha256'] = payloadHash;
  const names = Object.keys(h).sort();
  const canonicalHeaders = names.map((k) => `${k}:${h[k].replace(/\s+/g, ' ')}\n`).join('');
  const signedHeaders = names.join(';');
  const query = [...u.searchParams.entries()]
    .map(([k, v]) => [s3Encode(k), s3Encode(v)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`).join('&');
  const canonicalRequest = [method, u.pathname, query, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');
  let k = await hmac(`AWS4${secret}`, day);
  k = await hmac(k, region);
  k = await hmac(k, 's3');
  k = await hmac(k, 'aws4_request');
  const signature = hex(await hmac(k, toSign));
  delete h.host; // fetch o'zi qo'yadi
  h.authorization = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return h;
}

// ── R2 adapter (Garage, S3 API) ───────────────────────────────────────

const HTTP_META = [
  ['contentType', 'content-type'],
  ['contentLanguage', 'content-language'],
  ['contentDisposition', 'content-disposition'],
  ['contentEncoding', 'content-encoding'],
  ['cacheControl', 'cache-control'],
];

function metaHeaders(opts = {}) {
  const out = {};
  let hm = opts.httpMetadata || {};
  if (typeof Headers !== 'undefined' && hm instanceof Headers) {
    const o = {};
    for (const [field, header] of HTTP_META) if (hm.get(header)) o[field] = hm.get(header);
    if (hm.get('expires')) o.cacheExpiry = new Date(hm.get('expires'));
    hm = o;
  }
  for (const [field, header] of HTTP_META) if (hm[field]) out[header] = String(hm[field]);
  if (hm.cacheExpiry) out.expires = new Date(hm.cacheExpiry).toUTCString();
  for (const [k, v] of Object.entries(opts.customMetadata || {})) {
    // Header qiymatida faqat ASCII bo'lishi mumkin — qolgani kodlanadi.
    out[`x-amz-meta-${String(k).toLowerCase()}`] = /^[\x20-\x7e]*$/.test(String(v)) ? String(v) : encodeURIComponent(String(v));
  }
  return out;
}

function objectFromResponse(key, res, range) {
  const h = res.headers;
  const etag = String(h.get('etag') || '').replace(/^W\//, '').replace(/^"|"$/g, '');
  const total = /\/(\d+)\s*$/.exec(h.get('content-range') || '');
  const size = total ? Number(total[1]) : Number(h.get('content-length') || 0);
  const httpMetadata = {};
  for (const [field, header] of HTTP_META) if (h.get(header)) httpMetadata[field] = h.get(header);
  if (h.get('expires')) httpMetadata.cacheExpiry = new Date(h.get('expires'));
  const customMetadata = {};
  for (const [k, v] of h.entries()) if (k.startsWith('x-amz-meta-')) customMetadata[k.slice(11)] = v;
  const lm = h.get('last-modified');
  return {
    key,
    version: etag,
    size,
    etag,
    httpEtag: `"${etag}"`,
    uploaded: lm ? new Date(lm) : new Date(0),
    httpMetadata,
    customMetadata,
    checksums: {},
    storageClass: 'Standard',
    range,
    writeHttpMetadata(headers) {
      for (const [field, header] of HTTP_META) if (httpMetadata[field]) headers.set(header, httpMetadata[field]);
      if (httpMetadata.cacheExpiry) headers.set('expires', httpMetadata.cacheExpiry.toUTCString());
    },
  };
}

async function bodyBytes(body) {
  if (body == null) return new Uint8Array(0);
  if (typeof body === 'string') return enc.encode(body);
  const b = bytesOf(body);
  if (b) return b;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  // R2 ham uzunligi noma'lum oqimni qabul qilmaydi — multipart kerak.
  throw new TypeError('uz-s3 put: ReadableStream uzunligi noma’lum — multipart ishlating');
}

function rangeHeader(range) {
  if (!range) return null;
  if (range instanceof Headers) return range.get('range');
  if (range.suffix != null) return `bytes=-${range.suffix}`;
  const offset = Number(range.offset || 0);
  return range.length != null ? `bytes=${offset}-${offset + Number(range.length) - 1}` : `bytes=${offset}-`;
}

async function s3Error(res, what) {
  const text = await res.text().catch(() => '');
  const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] || '';
  return new Error(`uz-s3 ${what}: HTTP ${res.status}${code ? ` ${code}` : ''}`);
}

export function uzBucket({ endpoint, bucket, keyId, secret, region = 'garage', fetch: doFetch = (...a) => fetch(...a) }) {
  const base = `${String(endpoint).replace(/\/+$/, '')}/${s3Encode(bucket)}`;
  const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  async function request(method, key, { query = '', headers = {}, body = null } = {}) {
    const url = `${base}/${encodeKeyPath(key)}${query ? `?${query}` : ''}`;
    const payloadHash = body ? await sha256Hex(body) : EMPTY_SHA;
    const signed = await signV4({ method, url, headers, payloadHash, keyId, secret, region });
    return doFetch(url, { method, headers: signed, body: body || undefined });
  }

  const bucketApi = {
    async head(key) {
      const res = await request('HEAD', key);
      if (res.status === 404) return null;
      if (!res.ok) throw await s3Error(res, 'head');
      return objectFromResponse(key, res);
    },

    async get(key, options = {}) {
      const r = rangeHeader(options.range);
      const res = await request('GET', key, { headers: r ? { range: r } : {} });
      if (res.status === 404) { await res.body?.cancel?.(); return null; }
      if (!res.ok) throw await s3Error(res, 'get');
      const obj = objectFromResponse(key, res, options.range);
      let used = false;
      const take = (fn) => { used = true; return fn(); };
      return Object.assign(obj, {
        body: res.body,
        get bodyUsed() { return used || res.bodyUsed; },
        arrayBuffer: () => take(() => res.arrayBuffer()),
        text: () => take(() => res.text()),
        json: () => take(() => res.json()),
        blob: () => take(() => res.blob()),
      });
    },

    async put(key, value, opts = {}) {
      const body = await bodyBytes(value);
      const res = await request('PUT', key, { headers: metaHeaders(opts), body });
      if (!res.ok) throw await s3Error(res, 'put');
      const etag = String(res.headers.get('etag') || '').replace(/^"|"$/g, '');
      const { httpMetadata = {}, customMetadata = {} } = opts;
      return {
        key, version: etag, size: body.length, etag, httpEtag: `"${etag}"`, uploaded: new Date(),
        httpMetadata, customMetadata, checksums: {}, storageClass: 'Standard',
        writeHttpMetadata(h) { for (const [f, hd] of HTTP_META) if (httpMetadata[f]) h.set(hd, httpMetadata[f]); },
      };
    },

    // R2 `list` (ListObjectsV2): { objects, truncated, cursor }.
    async list(options = {}) {
      const q = new URLSearchParams({ 'list-type': '2', 'max-keys': String(Math.min(Number(options.limit) || 1000, 1000)) });
      if (options.prefix) q.set('prefix', options.prefix);
      if (options.cursor) q.set('continuation-token', options.cursor);
      const query = [...q.entries()].map(([k, v]) => `${s3Encode(k)}=${s3Encode(v)}`).join('&');
      const url = `${base}?${query}`;
      const signed = await signV4({ method: 'GET', url, payloadHash: EMPTY_SHA, keyId, secret, region });
      const res = await doFetch(url, { method: 'GET', headers: signed });
      if (!res.ok) throw await s3Error(res, 'list');
      const xml = await res.text();
      const unxml = (t) => t.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      const tag = (src, name) => { const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(src); return m ? unxml(m[1]) : null; };
      const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, c]) => {
        const etag = String(tag(c, 'ETag') || '').replace(/^"|"$/g, '');
        return { key: tag(c, 'Key'), size: Number(tag(c, 'Size') || 0), etag, httpEtag: `"${etag}"`, uploaded: new Date(tag(c, 'LastModified') || 0) };
      });
      const truncated = tag(xml, 'IsTruncated') === 'true';
      return { objects, truncated, cursor: truncated ? tag(xml, 'NextContinuationToken') : undefined, delimitedPrefixes: [] };
    },

    // R2 kabi: bitta kalit yoki kalitlar massivi; yo'q kalit — xato emas.
    async delete(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (let i = 0; i < list.length; i += 8) {
        await Promise.all(list.slice(i, i + 8).map(async (k) => {
          const res = await request('DELETE', k);
          if (!res.ok && res.status !== 404) throw await s3Error(res, 'delete');
        }));
      }
    },

    async createMultipartUpload(key, opts = {}) {
      const res = await request('POST', key, { query: 'uploads=', headers: metaHeaders(opts) });
      if (!res.ok) throw await s3Error(res, 'multipart create');
      const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(await res.text())?.[1];
      if (!uploadId) throw new Error('uz-s3 multipart create: UploadId yo‘q');
      const q = `uploadId=${s3Encode(uploadId)}`;
      const sizes = new Map();
      return {
        key,
        uploadId,
        async uploadPart(partNumber, value) {
          const body = await bodyBytes(value);
          sizes.set(partNumber, body.length);
          const r = await request('PUT', key, { query: `partNumber=${partNumber}&${q}`, body });
          if (!r.ok) throw await s3Error(r, 'multipart part');
          return { partNumber, etag: String(r.headers.get('etag') || '').replace(/^"|"$/g, '') };
        },
        async complete(parts) {
          const xml = `<CompleteMultipartUpload>${parts
            .slice().sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>"${p.etag}"</ETag></Part>`).join('')}</CompleteMultipartUpload>`;
          const r = await request('POST', key, { query: q, headers: { 'content-type': 'application/xml' }, body: enc.encode(xml) });
          const text = await r.text();
          // S3 xatoni 200 bilan ham qaytarishi mumkin — tanada <Error>.
          if (!r.ok || /<Error>/.test(text)) throw new Error(`uz-s3 multipart complete: HTTP ${r.status}`);
          // Fayl saqlandi — qo'shimcha HEAD qilinmaydi (u yiqilsa saqlangan
          // fayl "xato" deb hisoblanib, yetim qolardi). Javobdan quriladi.
          const etag = (/<ETag>([^<]*)<\/ETag>/.exec(text)?.[1] || '').replace(/&quot;/g, '"').replace(/^"|"$/g, '');
          const { httpMetadata = {}, customMetadata = {} } = opts;
          return {
            key, version: etag, etag, httpEtag: `"${etag}"`,
            size: parts.reduce((n, p) => n + (sizes.get(p.partNumber) || 0), 0),
            uploaded: new Date(), httpMetadata, customMetadata, checksums: {}, storageClass: 'Standard',
            writeHttpMetadata(h) { for (const [f, hd] of HTTP_META) if (httpMetadata[f]) h.set(hd, httpMetadata[f]); },
          };
        },
        async abort() {
          const r = await request('DELETE', key, { query: q });
          if (!r.ok && r.status !== 404) throw await s3Error(r, 'multipart abort');
        },
      };
    },
  };
  return bucketApi;
}

// ── Ko'chirish davri: avval O'zbekiston, topilmasa R2 ──────────────────

function withR2Fallback(uz, r2) {
  return {
    ...uz,
    async head(key) { return (await uz.head(key)) || (await r2.head(key)); },
    async get(key, options) { return (await uz.get(key, options)) || (await r2.get(key, options)); },
    async delete(keys) { await uz.delete(keys); await r2.delete(keys); },
  };
}

// ── Worker kirish nuqtasi uchun ───────────────────────────────────────

export const uzStoreEnabled = (env) => String(env?.UZ_STORE || '').trim().toLowerCase() === 'on';
export const uzMaintenance = (env) => String(env?.UZ_MAINTENANCE || '').trim().toLowerCase() === 'on';

// Texnik rejimda ham o'tadigan so'rov: faqat vaqtinchalik eksport kaliti bilan
// (ko'chirish workflow'ining yakuniy tekshiruvlari). Kalit yo'q — false.
export async function uzMaintenanceBypass(request, env) {
  const key = String(env?.UZ_EXPORT_KEY || '');
  const given = request.headers.get('x-uz-export-key') || '';
  if (key.length < 32 || !given) return false;
  return sameSecret(key, given);
}

const wrapped = new WeakMap();

// `env` ni bir marta o'raydi (isolate davomida qayta ishlatiladi).
// UZ_STORE yoqilmagan bo'lsa — aynan o'sha `env` qaytadi.
export function withUzStores(env) {
  if (!uzStoreEnabled(env)) return env;
  const hit = wrapped.get(env);
  if (hit) return hit;
  const missing = ['UZ_DB_URL', 'UZ_DB_TOKEN', 'UZ_S3_ENDPOINT', 'UZ_S3_BUCKET', 'UZ_S3_KEY_ID', 'UZ_S3_SECRET']
    .filter((k) => !String(env[k] || '').trim());
  if (missing.length) {
    // Yarim sozlangan holatda D1/R2 da qolamiz — sayt yiqilmasin.
    console.error('uz_store_misconfigured', missing.join(','));
    return env;
  }
  const bucket = uzBucket({
    endpoint: env.UZ_S3_ENDPOINT, bucket: env.UZ_S3_BUCKET,
    keyId: env.UZ_S3_KEY_ID, secret: env.UZ_S3_SECRET, region: env.UZ_S3_REGION || 'garage',
  });
  const fallback = String(env.UZ_UPLOADS_FALLBACK || '').trim().toLowerCase() === 'r2' && env.UPLOADS;
  const out = {
    ...env,
    DB: uzDb({ url: env.UZ_DB_URL, token: env.UZ_DB_TOKEN }),
    UPLOADS: fallback ? withR2Fallback(bucket, env.UPLOADS) : bucket,
    UZ_STORE_ACTIVE: '1',
  };
  wrapped.set(env, out);
  return out;
}

const MAINTENANCE_HTML = `<!doctype html><html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>NFCSTORE — texnik ishlar</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;
font-family:system-ui,sans-serif;background:#F4F4F2;color:#1d1d1b;text-align:center;padding:24px}
h1{font-size:22px;margin:0 0 8px}p{margin:4px 0;color:#4A4A48}</style></head><body><main>
<h1>Texnik ishlar olib borilmoqda</h1><p>Sayt bir necha daqiqada qayta ishlaydi.</p>
<p>Технические работы — сайт заработает через несколько минут.</p></main></body></html>`;

export function maintenanceResponse(request) {
  const accept = String(request?.headers?.get('accept') || '');
  const isApi = /\/api(\/|$)/.test(new URL(request?.url || 'https://x/').pathname);
  const html = !isApi && accept.includes('text/html');
  return new Response(html ? MAINTENANCE_HTML : JSON.stringify({ error: 'maintenance', retry_after: 300 }), {
    status: 503,
    headers: {
      'content-type': html ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
      'retry-after': '300',
      'cache-control': 'no-store',
    },
  });
}

// ── D1 EKSPORTI (ko'chirish uchun, faqat vaqtinchalik kalit bilan) ─────
//
// GitHub tokenida D1 ruxsati yo'q, Worker'da esa D1 bog'lanishi bor —
// shuning uchun bazani Worker o'zi beradi. Yo'l FAQAT `UZ_EXPORT_KEY`
// secret'i mavjud bo'lganda ishlaydi (ko'chirish workflow'i uni bir
// necha daqiqaga qo'yadi va darhol o'chiradi); aks holda oddiy 404.
// Faqat o'qiydi: sxema, qatorlar (quote() — tur aniq saqlanadi) va
// har jadval uchun SHA-256 (uz-migrate.mjs dagi bilan AYNAN bir xil).

const EXPORT_SKIP = (n) => /^(sqlite_|_cf_)/.test(String(n || ''));
const qid = (s) => `"${String(s).replace(/"/g, '""')}"`;

// Qatorning aniq SQL ko'rinishi (UZ ga yozish uchun, uz-migrate.mjs db-import).
// quote() matnni NUL baytda kesib qo'yadi — shuning uchun TEXT hex orqali:
// CAST(X'..' AS TEXT) baytma-bayt bir xil tiklanadi. INTEGER, REAL (aniq,
// %!.20e gacha), BLOB va NULL uchun quote() aniq.
export const rowLiteralSql = (cols) => cols
  .map((c) => `CASE typeof(${qid(c)}) WHEN 'text' THEN 'CAST(X''' || hex(${qid(c)}) || ''' AS TEXT)' ELSE quote(${qid(c)}) END`)
  .join(` || ',' || `);

// ── USTUNMA-USTUN KO'RINISH (eksport va tekshiruv) ─────────────────────
// D1 cheklovlari: bitta satr ≤ 2 MB (butun qatorni bitta satrga yig'ib
// bo'lmaydi) va natijada ≤ 100 ustun (har ustunga ikkita ustun ham bo'lmaydi).
// Shuning uchun har ustun — BITTA natija ustuni, tur esa bitta harf prefiks:
//   i — integer (quote: 2^53 dan katta son ham aniq)   r — real (quote: to'liq aniqlik)
//   t — matnning o'zi (hex siz)   x — NUL baytli matn, hex   b — blob, hex   NULL — null
const colEncSql = (c) => {
  const q = qid(c);
  return `CASE typeof(${q}) WHEN 'integer' THEN 'i' || quote(${q}) WHEN 'real' THEN 'r' || quote(${q}) WHEN 'blob' THEN 'b' || hex(${q}) WHEN 'text' THEN CASE WHEN instr(CAST(${q} AS BLOB), X'00') > 0 THEN 'x' || hex(CAST(${q} AS BLOB)) ELSE 't' || ${q} END ELSE NULL END`;
};
export const rowColumnsSql = (cols, offset = 0) => cols.map((c, i) => `${colEncSql(c)} AS "c${i + offset}"`).join(', ');
const ENC_TYPE = { i: 'integer', r: 'real', t: 'text', x: 'texthex', b: 'blob' };
export const rowPairs = (row, n) => Array.from({ length: n }, (_, i) => {
  const v = row[`c${i}`];
  if (v == null) return ['null', null];
  const t = ENC_TYPE[String(v)[0]];
  if (!t) throw new Error(`noma'lum tur belgisi: ${String(v)[0]}`);
  return [t, String(v).slice(1)];
});

// Tekshiruv xeshi — D1 (Worker), mahalliy fayl va UZ uchun AYNAN bir xil.
// Uzunlik prefiksi bilan: qiymat ichidagi belgi chegarani buzolmaydi.
const canonRow = (pairs) => pairs.map(([t, v]) => (v == null ? `${t}:` : `${t}:${String(v).length}:${v}`)).join('\u0001');
export async function digestPairs(rows) {
  return sha256Hex(enc.encode(rows.map((p) => `${canonRow(p)}\n`).join('')));
}

// Juftlikdan INSERT: matn — bog'langan parametr (? — hajmi oshmaydi),
// qolgani — aniq SQL literal.
export function insertForPairs(table, cols, pairs, rowidLiteral = null) {
  const names = []; const vals = []; const args = [];
  if (rowidLiteral != null) { names.push('rowid'); vals.push(String(rowidLiteral)); }
  cols.forEach((c, i) => {
    const [t, v] = pairs[i];
    names.push(qid(c));
    if (v == null || t === 'null') vals.push('NULL');
    else if (t === 'text') { vals.push('?'); args.push(String(v)); }
    else if (t === 'texthex' || t === 'blob') {
      if (!/^[0-9A-Fa-f]*$/.test(String(v))) throw new Error('noto‘g‘ri hex');
      vals.push(t === 'blob' ? `X'${v}'` : `CAST(X'${v}' AS TEXT)`);
    } else if (t === 'integer' || t === 'real') {
      if (!/^-?[0-9][0-9.eE+-]*$/.test(String(v))) throw new Error(`noto'g'ri son: ${String(v).slice(0, 30)}`);
      vals.push(String(v));
    } else throw new Error(`noma'lum tur: ${t}`);
  });
  return { sql: `INSERT INTO ${qid(table)} (${names.join(', ')}) VALUES (${vals.join(', ')})`, args };
}

async function sameSecret(a, b) {
  const [x, y] = await Promise.all([sha256Hex(String(a)), sha256Hex(String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function exportTables(db) {
  const master = (await db.prepare(`SELECT type, name, tbl_name, sql FROM sqlite_master
    WHERE sql IS NOT NULL AND substr(name, 1, 7) <> 'sqlite_' AND substr(name, 1, 4) <> '_cf_' AND substr(tbl_name, 1, 4) <> '_cf_' ORDER BY rowid`).all()).results
    .filter((r) => !EXPORT_SKIP(r.name) && !EXPORT_SKIP(r.tbl_name));
  return master;
}

async function exportColumns(db, table) {
  const info = (await db.prepare(`PRAGMA table_xinfo(${qid(table)})`).all()).results;
  return info.filter((c) => !Number(c.hidden)).map((c) => c.name);
}

export async function handleUzExport(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/__uz/export') return null;
  const key = String(env.UZ_EXPORT_KEY || '');
  const notFound = () => new Response('not found', { status: 404 });
  if (key.length < 32 || request.method !== 'GET') return notFound();
  if (!(await sameSecret(key, request.headers.get('x-uz-export-key') || ''))) return notFound();
  const db = env.DB;
  const json = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const master = await exportTables(db);
  const op = url.searchParams.get('op');

  if (op === 'schema') {
    const sequence = await db.prepare(`SELECT name, seq FROM sqlite_sequence`).all().then((r) => r.results).catch(() => []);
    const columns = {};
    for (const t of master.filter((r) => r.type === 'table')) columns[t.name] = await exportColumns(db, t.name);
    return json({ master, sequence: sequence.filter((r) => !EXPORT_SKIP(r.name)), columns });
  }

  const table = url.searchParams.get('table');
  const def = master.find((r) => r.type === 'table' && r.name === table);
  if (!def) return json({ error: 'no_table' });
  const cols = await exportColumns(db, table);
  // D1 natijasida ≤ 100 ustun: ko'p ustunli jadval guruhlarga bo'linib so'raladi.
  const CHUNK = 90;
  const chunks = [];
  for (let i = 0; i < cols.length; i += CHUNK) chunks.push([i, cols.slice(i, i + CHUNK)]);
  async function select(build, binds, withRowid) {
    let merged = null; let rq = null;
    for (const [off, cc] of chunks) {
      const res = (await db.prepare(build(`${withRowid ? 'quote(rowid) AS _rq, ' : ''}${rowColumnsSql(cc, off)}`)).bind(...binds).all()).results;
      if (!merged) { merged = res.map((r) => ({ ...r })); rq = res.map((r) => r._rq); continue; }
      // Guruhlar orasida qatorlar o'zgarmagan bo'lishi shart.
      if (res.length !== merged.length || (withRowid && res.some((r, k) => r._rq !== rq[k]))) throw new Error('export_unstable');
      res.forEach((r, k) => Object.assign(merged[k], r));
    }
    return merged || [];
  }
  const order = cols.map(qid).join(', ');

  if (op === 'rows') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 500, 1), 5000);
    if (/\bWITHOUT\s+ROWID\b/i.test(def.sql)) {
      const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
      const rows = await select((s) => `SELECT ${s} FROM ${qid(table)} ORDER BY ${order} LIMIT ? OFFSET ?`, [limit, offset], false);
      return json({ cols, rowid: false, rows: rows.map((r) => [null, rowPairs(r, cols.length)]), next: rows.length === limit ? offset + limit : null });
    }
    const after = String(url.searchParams.get('after') || '-9223372036854775808');
    if (!/^-?\d{1,19}$/.test(after)) return json({ error: 'bad_after' });
    // rowid matn sifatida keladi va CAST qilinadi: 2^53 dan katta rowid ham aniq.
    const rows = await select((s) => `SELECT ${s} FROM ${qid(table)} WHERE rowid > CAST(? AS INTEGER) ORDER BY rowid LIMIT ?`, [after, limit], true);
    return json({ cols, rowid: true, rows: rows.map((r) => [r._rq, rowPairs(r, cols.length)]), next: rows.length === limit ? rows[rows.length - 1]._rq : null });
  }

  if (op === 'digest') {
    const rows = await select((s) => `SELECT ${s} FROM ${qid(table)} ORDER BY ${order}`, [], false);
    return json({ count: rows.length, sha: await digestPairs(rows.map((r) => rowPairs(r, cols.length))) });
  }
  return json({ error: 'bad_op' });
}
