// Persistence layer for BELGI records.
//
// Primary source: REST API (server/index.js -> PostgreSQL via Railway).
// If the API is unreachable (e.g. local dev without DATABASE_URL), every
// function transparently falls back to localStorage so the site keeps working.

const LS_KEY = 'belgi:records';

function lsRead() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function lsWrite(records) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(records));
  } catch {
    // storage full / disabled — ignore
  }
}

function lsGet(code) {
  return lsRead()[code] || null;
}

function lsSet(code, record) {
  const all = lsRead();
  all[code] = record;
  lsWrite(all);
  return record;
}

async function api(path, options) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('api_error_' + res.status);
  return res.json();
}

export async function dbGet(code) {
  try {
    return await api(`/records/${encodeURIComponent(code)}`);
  } catch {
    return lsGet(code);
  }
}

export async function dbList() {
  try {
    const list = await api('/records');
    return Array.isArray(list) ? list : [];
  } catch {
    return Object.values(lsRead());
  }
}

// Atomic reserve: returns the created record, or null if the code was
// already taken (409) / storage unavailable.
export async function dbCreate(code, data) {
  try {
    return await api(`/records/${encodeURIComponent(code)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err && err.message === 'api_error_409') return null;
    return lsGet(code) ? null : lsSet(code, { ...data, code });
  }
}

// Fire-and-forget view counter. Returns the new views count or null.
export async function dbAddView(code) {
  try {
    const res = await fetch(`/api/records/${encodeURIComponent(code)}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.views === 'number' ? data.views : null;
  } catch {
    return null;
  }
}
