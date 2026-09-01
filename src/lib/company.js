export const COMPANY_STATUS = {
  draft: 'Qoralama',
  pending_review: 'Admin tekshiruvida',
  approved: 'Tasdiqlangan',
  payment_pending: "To‘lov kutilmoqda",
  paid: "To‘langan",
  active: 'Faol',
  rejected: 'Rad etilgan',
  suspended: 'Vaqtincha to‘xtatilgan',
};

export const COMPANY_TIERS = {
  silver: { label: 'SILVER', price: 349000, min: 8, max: 15 },
  gold: { label: 'GOLD', price: 549000, min: 6, max: 7 },
  premium: { label: 'PREMIUM', price: 749000, min: 4, max: 5 },
  exclusive: { label: 'EXCLUSIVE', price: 990000, min: 3, max: 3 },
};

export const COMPANY_CTA = {
  restaurant: { label: 'Menyuni ko‘rish', section: 'catalog', noun: 'Taomlar' },
  cafe: { label: 'Menyuni ko‘rish', section: 'catalog', noun: 'Taomlar' },
  market: { label: 'Mahsulotlarni ko‘rish', section: 'catalog', noun: 'Mahsulotlar' },
  shop: { label: 'Mahsulotlarni ko‘rish', section: 'catalog', noun: 'Mahsulotlar' },
  services: { label: 'Xizmatlarni ko‘rish', section: 'catalog', noun: 'Xizmatlar' },
  construction: { label: 'Xizmatlarni ko‘rish', section: 'catalog', noun: 'Xizmatlar' },
  clinic: { label: 'Xizmatlarni ko‘rish', section: 'catalog', noun: 'Xizmatlar' },
  pharmacy: { label: 'Mahsulotlarni ko‘rish', section: 'catalog', noun: 'Mahsulotlar' },
  education: { label: 'Kurslarni ko‘rish', section: 'catalog', noun: 'Kurslar' },
  other: { label: 'Takliflarni ko‘rish', section: 'catalog', noun: 'Takliflar' },
};

export const companyCta = (category) => COMPANY_CTA[category] || COMPANY_CTA.other;

export function normalizeCompanyId(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 15);
}

export function companyIdLocalInfo(value) {
  const companyId = normalizeCompanyId(value);
  if (!companyId || companyId.length < 3) return { companyId, valid: false, reason: 'Kamida 3 ta harf kiriting' };
  if (!/^[A-Z]{3,15}$/.test(companyId)) return { companyId, valid: false, reason: 'Faqat A–Z harflari mumkin' };
  const tier = companyId.length === 3 ? 'exclusive' : companyId.length <= 5 ? 'premium' : companyId.length <= 7 ? 'gold' : 'silver';
  return { companyId, valid: true, tier, price: COMPANY_TIERS[tier].price };
}

async function companyApi(path, options) {
  const res = await fetch('/api/companies' + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `api_error_${res.status}`);
    Object.assign(error, data);
    throw error;
  }
  return data;
}

export const checkCompanyId = (companyId) => companyApi(`/check?id=${encodeURIComponent(companyId)}`);
export const listMyCompanies = () => companyApi('/mine');
export const getCompany = (companyId) => companyApi(`/${encodeURIComponent(companyId)}`);
export const createCompany = (payload) => companyApi('', { method: 'POST', body: JSON.stringify(payload) });
export const updateCompany = (companyId, payload) => companyApi(`/${encodeURIComponent(companyId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const submitCompany = (companyId) => companyApi(`/${encodeURIComponent(companyId)}/submit`, { method: 'POST' });
export const beginCompanyPayment = (companyId) => companyApi(`/${encodeURIComponent(companyId)}/payment`, { method: 'POST' });
export const addCompanyItem = (companyId, payload) => companyApi(`/${encodeURIComponent(companyId)}/catalog`, { method: 'POST', body: JSON.stringify(payload) });
export const updateCompanyItem = (companyId, itemId, payload) => companyApi(`/${encodeURIComponent(companyId)}/catalog/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteCompanyItem = (companyId, itemId) => companyApi(`/${encodeURIComponent(companyId)}/catalog/${encodeURIComponent(itemId)}`, { method: 'DELETE' });

