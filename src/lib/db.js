// Persistence layer for NFCX records.
//
// Primary source: REST API (server/index.js -> PostgreSQL via Railway).
// If the API is unreachable (e.g. local dev without DATABASE_URL), every
// function transparently falls back to localStorage so the site keeps working.

const LS_KEY = 'nfcx:records';

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

// ---------- Sotuv ----------

// Sotuvdagi vizitkalar ro'yxati.
export async function dbListSales() {
  try {
    const list = await api('/sales');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const SALE_ERRORS = {
  unauthorized: "Sotib olish uchun avval tizimga kiring.",
  own_card: "Bu vizitka allaqachon sizniki.",
  not_for_sale: "Bu vizitka hozir sotuvda emas.",
  not_found: "Vizitka topilmadi.",
};

export async function dbBuy(code) {
  const res = await fetch(`/api/records/${encodeURIComponent(code)}/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(SALE_ERRORS[data && data.error] || 'Xatolik yuz berdi.');
  return data;
}

// Sotuvga qo'yish (list=true) yoki sotuvdan olish (list=false).
export async function dbSetSale(code, list) {
  const res = await fetch(`/api/records/${encodeURIComponent(code)}/sale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ list: !!list }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(SALE_ERRORS[data && data.error] || 'Xatolik yuz berdi.');
  return data;
}

// Rasm yuklash: dataUrl (base64) -> /uploads/... manzil.
export async function dbUploadImage(dataUrl) {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ dataUrl }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const key = data && data.error;
    if (key === 'too_large') throw new Error('Rasm hajmi juda katta.');
    if (key === 'unauthorized') throw new Error('Avval tizimga kiring.');
    throw new Error('Rasmni yuklab bo\u2019lmadi.');
  }
  return data.url;
}
