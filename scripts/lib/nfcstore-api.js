// ═══════════════════════════════════════════════════════════════════════
// NFCSTORE API MIJOZI — ingichka qatlam
//
// Bu yerda HECH QANDAY biznes qarori yo'q: faqat so'rov yuboradi, sessiya
// cookie'sini eslab qoladi va javobni qaytaradi. Qaror qabul qilish
// `demo-plan.js` da, yozish esa `demo-fill.mjs` da.
//
// MAXFIYLIK. Parol faqat bitta joyda — login so'rovining tanasida —
// ishlatiladi. U hech qayerda saqlanmaydi, log qilinmaydi va xato
// matniga tushmaydi: quyidagi `req()` xato chiqarganda so'rov TANASINI
// umuman ko'rsatmaydi, faqat yo'l va holat kodini yozadi.
// ═══════════════════════════════════════════════════════════════════════

export class NfcstoreApi {
  constructor({ base = 'https://nfcstore.uz', fetchImpl = globalThis.fetch } = {}) {
    this.base = String(base).replace(/\/+$/, '');
    this.fetch = fetchImpl;
    this.cookie = '';
    this.calls = [];   // tekshiruv uchun: qaysi yo'llarga borildi
  }

  async req(method, path, body) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.cookie) headers.cookie = this.cookie;

    const res = await this.fetch(this.base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });

    // Sessiya cookie'si — login javobidan olinadi va keyingi
    // so'rovlarga qo'shiladi.
    const setCookie = res.headers?.get?.('set-cookie');
    if (setCookie) {
      const first = String(setCookie).split(';')[0];
      if (first.includes('=')) this.cookie = first;
    }

    let data = null;
    const text = await res.text().catch(() => '');
    if (text) { try { data = JSON.parse(text); } catch { data = null; } }

    this.calls.push({ method, path, status: res.status });

    if (!res.ok) {
      // ATAYLAB: so'rov tanasi (ya'ni parol) xato matniga QO'SHILMAYDI.
      const err = new Error(`${method} ${path} -> ${res.status}${data?.error ? ' ' + data.error : ''}`);
      err.status = res.status;
      err.code = data?.error || '';
      err.body = data;
      throw err;
    }
    return data;
  }

  // ── Auth ───────────────────────────────────────────────────────────
  // Server `POST /api/auth/login` da AYNAN `{ email, password }` kutadi
  // va sessiyani cookie orqali beradi.
  login(email, password) {
    return this.req('POST', '/api/auth/login', { email, password });
  }

  // `{ user, cards }` — `cards` SERVER bergan o'z kartalarim ro'yxati.
  // Egalikning yagona manbai shu (va serverning o'z 403 tekshiruvi).
  me() { return this.req('GET', '/api/auth/me'); }

  logout() { return this.req('POST', '/api/auth/logout').catch(() => null); }

  // ── Shaxsiy profil ────────────────────────────────────────────────
  getRecord(code) { return this.req('GET', `/api/records/${encodeURIComponent(code)}`); }

  // DIQQAT: bu TO'LIQ ALMASHTIRISH. Server `updateRecord(code, record)`
  // ni chaqiradi, ya'ni yuborilmagan maydon YO'QOLADI. Shuning uchun
  // `body` har doim mavjud yozuvdan boshlab quriladi (demo-plan.js).
  putRecord(code, body) { return this.req('PUT', `/api/records/${encodeURIComponent(code)}`, body); }

  // ── Kompaniya ─────────────────────────────────────────────────────
  myCompanies() { return this.req('GET', '/api/companies/mine'); }
  getCompany(id) { return this.req('GET', `/api/companies/${encodeURIComponent(id)}`); }
  patchCompany(id, patch) { return this.req('PATCH', `/api/companies/${encodeURIComponent(id)}`, patch); }
  addCatalogItem(id, item) { return this.req('POST', `/api/companies/${encodeURIComponent(id)}/catalog`, item); }
  deleteCatalogItem(id, itemId) {
    return this.req('DELETE', `/api/companies/${encodeURIComponent(id)}/catalog/${encodeURIComponent(itemId)}`);
  }
}

export default NfcstoreApi;
