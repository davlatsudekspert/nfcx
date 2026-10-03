// Soxta S3 (Garage o'rniga) — hosting/uz-store.js dagi R2 adapterini butun
// test to'plami bilan sinash uchun. Imzo tuzilishi va tana xeshi tekshiriladi;
// haqiqiy SigV4 mosligi alohida: scripts/test-uz-store.mjs (mahalliy Garage).
import { createHash } from 'node:crypto';

const META = ['content-type', 'content-language', 'content-disposition', 'content-encoding', 'cache-control', 'expires'];

export function s3Fetch({ bucket = 'test-bucket' } = {}) {
  const store = new Map();
  const uploads = new Map();
  let nextUpload = 1;

  const etagOf = (bytes) => createHash('md5').update(bytes).digest('hex');
  // Yozuv shakli d1-harness R2 mock'i bilan bir xil (`bytes`, `httpMetadata`,
  // `customMetadata`) — testlar `env.UPLOADS._store` ni o'zgarishsiz o'qiydi.
  const entry = (bytes, meta, etag) => ({
    bytes, meta, etag, uploaded: new Date(),
    httpMetadata: {
      ...(meta['content-type'] ? { contentType: meta['content-type'] } : {}),
      ...(meta['cache-control'] ? { cacheControl: meta['cache-control'] } : {}),
    },
    customMetadata: Object.fromEntries(Object.entries(meta).filter(([k]) => k.startsWith('x-amz-meta-')).map(([k, v]) => [k.slice(11), v])),
    httpEtag: `"${etag}"`,
  });
  const xml = (status, body) => new Response(body, { status, headers: { 'content-type': 'application/xml' } });
  const err = (status, code) => xml(status, `<?xml version="1.0"?><Error><Code>${code}</Code></Error>`);

  function objHeaders(o) {
    const h = new Headers();
    for (const [k, v] of Object.entries(o.meta)) h.set(k, v);
    h.set('etag', `"${o.etag}"`);
    h.set('last-modified', o.uploaded.toUTCString());
    h.set('accept-ranges', 'bytes');
    return h;
  }

  const fn = async (url, init = {}) => {
    const u = new URL(url);
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {});
    const auth = headers.get('authorization') || '';
    if (!auth.startsWith('AWS4-HMAC-SHA256 Credential=') || !headers.get('x-amz-date')) return err(403, 'AccessDenied');
    const body = init.body ? new Uint8Array(init.body) : new Uint8Array(0);
    const sha = createHash('sha256').update(body).digest('hex');
    if (headers.get('x-amz-content-sha256') !== sha) return err(400, 'XAmzContentSHA256Mismatch');
    const [, b, ...rest] = u.pathname.split('/');
    if (decodeURIComponent(b) !== bucket) return err(404, 'NoSuchBucket');
    const key = rest.map(decodeURIComponent).join('/');
    const q = u.searchParams;

    if (method === 'GET' && q.get('list-type') === '2') {
      const prefix = q.get('prefix') || '';
      const max = Number(q.get('max-keys') || 1000);
      const after = q.get('continuation-token') || '';
      const all = [...store.keys()].filter((k) => k.startsWith(prefix) && k > after).sort();
      const page = all.slice(0, max);
      const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const items = page.map((k) => { const o = store.get(k); return `<Contents><Key>${esc(k)}</Key><Size>${o.bytes.length}</Size><ETag>&quot;${o.etag}&quot;</ETag><LastModified>${o.uploaded.toISOString()}</LastModified></Contents>`; }).join('');
      const more = all.length > max;
      return xml(200, `<ListBucketResult><IsTruncated>${more}</IsTruncated>${items}${more ? `<NextContinuationToken>${esc(page[page.length - 1])}</NextContinuationToken>` : ''}</ListBucketResult>`);
    }

    if (method === 'POST' && q.has('uploads')) {
      const id = `up${nextUpload++}`;
      const meta = {};
      for (const [k, v] of headers) if (META.includes(k) || k.startsWith('x-amz-meta-')) meta[k] = v;
      uploads.set(id, { key, meta, parts: new Map() });
      return xml(200, `<InitiateMultipartUploadResult><Bucket>${bucket}</Bucket><Key>${key}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
    }
    if (method === 'PUT' && q.has('uploadId')) {
      const up = uploads.get(q.get('uploadId'));
      if (!up) return err(404, 'NoSuchUpload');
      const etag = etagOf(body);
      up.parts.set(Number(q.get('partNumber')), { body, etag });
      return new Response(null, { status: 200, headers: { etag: `"${etag}"` } });
    }
    if (method === 'POST' && q.has('uploadId')) {
      const up = uploads.get(q.get('uploadId'));
      if (!up) return err(404, 'NoSuchUpload');
      const text = new TextDecoder().decode(body);
      const parts = [...text.matchAll(/<PartNumber>(\d+)<\/PartNumber><ETag>"?([^<"]+)"?<\/ETag>/g)].map((m) => [Number(m[1]), m[2]]);
      const chunks = [];
      for (const [n, etag] of parts) {
        const p = up.parts.get(n);
        if (!p || p.etag !== etag) return err(400, 'InvalidPart');
        chunks.push(p.body);
      }
      const all = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
      let off = 0; for (const c of chunks) { all.set(c, off); off += c.length; }
      const mpEtag = `${etagOf(all)}-${parts.length}`;
      store.set(key, entry(all, up.meta, mpEtag));
      uploads.delete(q.get('uploadId'));
      return xml(200, `<CompleteMultipartUploadResult><Key>${key}</Key><ETag>&quot;${mpEtag}&quot;</ETag></CompleteMultipartUploadResult>`);
    }
    if (method === 'DELETE' && q.has('uploadId')) { uploads.delete(q.get('uploadId')); return new Response(null, { status: 204 }); }

    if (method === 'PUT') {
      const meta = {};
      for (const [k, v] of headers) if (META.includes(k) || k.startsWith('x-amz-meta-')) meta[k] = v;
      const etag = etagOf(body);
      store.set(key, entry(body, meta, etag));
      return new Response(null, { status: 200, headers: { etag: `"${etag}"` } });
    }
    if (method === 'DELETE') { store.delete(key); return new Response(null, { status: 204 }); }

    const o = store.get(key);
    if (!o) return method === 'HEAD' ? new Response(null, { status: 404 }) : err(404, 'NoSuchKey');
    const h = objHeaders(o);
    if (method === 'HEAD') { h.set('content-length', String(o.bytes.length)); return new Response(null, { status: 200, headers: h }); }
    const range = /^bytes=(\d*)-(\d*)$/.exec(headers.get('range') || '');
    if (range) {
      const size = o.bytes.length;
      let start; let end;
      if (range[1] === '') { start = Math.max(0, size - Number(range[2])); end = size - 1; } else { start = Number(range[1]); end = range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1); }
      if (start >= size) return err(416, 'InvalidRange');
      h.set('content-range', `bytes ${start}-${end}/${size}`);
      h.set('content-length', String(end - start + 1));
      return new Response(o.bytes.slice(start, end + 1), { status: 206, headers: h });
    }
    h.set('content-length', String(o.bytes.length));
    return new Response(o.bytes, { status: 200, headers: h });
  };
  fn._store = store;
  return fn;
}
