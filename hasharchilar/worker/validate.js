// Kiruvchi ma'lumotlarni tekshirish.
export class ValidationError extends Error {}

/** Telefonni +998XXXXXXXXX ko'rinishiga keltiradi. */
export function parsePhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  const full = digits.length === 9 ? `998${digits}` : digits;
  if (!/^998\d{9}$/.test(full)) throw new ValidationError("Telefon raqami noto'g'ri (+998 90 123 45 67)");
  return `+${full}`;
}

/** Hashar yaratish formasidagi maydonlarni tozalaydi. */
export function parseHasharFields(form) {
  const title = String(form.get('title') || '').trim();
  if (title.length < 3 || title.length > 120) throw new ValidationError('Sarlavha 3–120 belgidan iborat bo‘lsin');

  const lat = Number(form.get('lat'));
  const lng = Number(form.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new ValidationError('Joylashuvni xaritada belgilang');
  }

  const date_time = String(form.get('date_time') || '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date_time) || Number.isNaN(Date.parse(date_time))) {
    throw new ValidationError("Sana va vaqtni to'g'ri kiriting");
  }

  let items = [];
  try {
    items = JSON.parse(String(form.get('items') || '[]'));
  } catch {
    throw new ValidationError("Kerakli narsalar formati noto'g'ri");
  }
  items = (Array.isArray(items) ? items : []).map((s) => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 12);

  return {
    title,
    description: String(form.get('description') || '').trim().slice(0, 1000),
    address: String(form.get('address') || '').trim().slice(0, 200),
    lat,
    lng,
    date_time,
    items,
  };
}
