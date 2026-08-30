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
    credentials: 'same-origin', // sessiya cookie'si albatta yuborilishi kerak
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 404) return null;
  // 401/409/422 kabi holatlarda ham serverdan kelgan xabarni saqlab qo'yamiz,
  // shunda chaqiruvchi kod "unauthorized" kabi aniq sababni bilib oladi.
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = new Error('api_error_' + res.status);
    err.code = data && data.error;
    throw err;
  }
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

// Reserve a code. Three possible outcomes now:
//  - 201: paynet disabled (dev fallback) -> full record returned immediately
//  - 202: paynet enabled -> { pending: true, orderId, payLink, code, price }
//  - 409: already taken -> null
// Throws for auth errors (err.code === 'unauthorized') so the caller can
// prompt the user to sign in / create an account first.
export async function dbCreate(code, data) {
  try {
    return await api(`/records/${encodeURIComponent(code)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err && err.message === 'api_error_409') return null;
    if (err && (err.code === 'unauthorized' || err.code === 'reserved_pending_payment' || err.code === 'exclusive_auction_only' || err.code === 'payments_disabled' || err.code === 'payme_disabled')) throw err;
    return lsGet(code) ? null : lsSet(code, { ...data, code });
  }
}

// Buyurtma holatini tekshirish (to'lov tasdiqlanganmi?).
export async function dbGetOrder(orderId) {
  return api(`/orders/${encodeURIComponent(orderId)}`);
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

// Sotuvdagi raqamli tashrif qog'ozlar ro'yxati.
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
  own_card: "Bu raqamli tashrif qog'ozi allaqachon sizniki.",
  not_for_sale: "Bu raqamli tashrif qog'ozi hozir sotuvda emas.",
  not_found: "Raqamli tashrif qog'ozi topilmadi.",
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

// Bir nechta raqamli tashrif qog'ozi (vizitka)dan birini "Asosiy" deb belgilash.
export async function dbSendSupportMessage(message) {
  const res = await fetch('/api/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ message }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error('Xatolik yuz berdi.');
  return data;
}

export async function dbListMySupportMessages() {
  const res = await fetch('/api/support', { credentials: 'same-origin' });
  const data = await res.json().catch(() => null);
  return (data && data.messages) || [];
}

export async function dbListReferrals() {
  const res = await fetch('/api/referrals', { credentials: 'same-origin' });
  const data = await res.json().catch(() => null);
  return (data && data.referrals) || [];
}

export async function dbRequestPasswordCode() {
  const res = await fetch('/api/settings/request-password-code', { method: 'POST', credentials: 'same-origin' });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const key = data && data.error;
    if (key === 'no_phone') throw new Error("Akkauntingizda telefon raqami yo'q.");
    if (key === 'tg_not_linked') throw new Error("Telefon raqamingiz botda tasdiqlanmagan. Avval botda ro'yxatdan o'ting.");
    if (key === 'tg_send_failed') throw new Error("Telegram'ga xabar yuborib bo'lmadi. Botni ishga tushirganingizni tekshiring.");
    throw new Error('Xatolik yuz berdi.');
  }
  return data;
}

export async function dbChangePassword(code, newPassword) {
  const res = await fetch('/api/settings/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ code, newPassword }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const key = data && data.error;
    if (key === 'bad_code') throw new Error("Kod noto'g'ri yoki muddati o'tgan.");
    if (key === 'weak_password') throw new Error('Parol kamida 6 belgidan iborat bo\u2019lishi kerak.');
    throw new Error('Xatolik yuz berdi.');
  }
  return data;
}

export async function dbSetPrimary(code) {
  const res = await fetch(`/api/records/${encodeURIComponent(code)}/set-primary`, {
    method: 'POST',
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error('Xatolik yuz berdi.');
  return data;
}

export async function dbOrderPhysicalCard(code, shipping) {
  const res = await fetch(`/api/records/${encodeURIComponent(code)}/order-physical-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(shipping),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const key = data && data.error;
    if (key === 'shipping_required') throw new Error("Ism, telefon va manzilni to'liq kiriting.");
    if (key === 'payme_disabled') throw new Error("Payme orqali to'lov imkoniyati tez kunlarda ishga tushadi.");
    if (key === 'unauthorized') throw new Error('Avval tizimga kiring.');
    throw new Error('Xatolik yuz berdi.');
  }
  return data;
}

// ---------- Sovg'a qilish ----------

const GIFT_ERRORS = {
  NOT_OWNER: 'Bu kod sizga tegishli emas.',
  NOT_GIFTABLE: "Bu avtomatik berilgan bepul ID sovg'a qilinmaydi.",
  RECIPIENT_NOT_FOUND: "Bunday NFC ID topilmadi — qabul qiluvchi avval o'z profilini yaratgan bo'lishi kerak.",
  CANNOT_GIFT_SELF: "O'zingizga sovg'a qila olmaysiz.",
  ALREADY_PENDING: "Bu kod uchun sovg'a taklifi allaqachon kutilmoqda.",
  to_code_required: "Qabul qiluvchining NFC ID'sini kiriting.",
  unauthorized: 'Avval tizimga kiring.',
};

export async function dbGiftCard(code, toCode) {
  const res = await fetch(`/api/records/${encodeURIComponent(code)}/gift`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ toCode }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(GIFT_ERRORS[data && data.error] || 'Xatolik yuz berdi.');
  return data;
}

export async function dbListGiftOffers() {
  const res = await fetch('/api/gift-offers', { credentials: 'same-origin' });
  const data = await res.json().catch(() => null);
  return data || { incoming: [], outgoing: [] };
}

export async function dbAcceptGift(id) {
  const res = await fetch(`/api/gift-offers/${id}/accept`, { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) throw new Error('Xatolik yuz berdi.');
  return res.json();
}

export async function dbRejectGift(id) {
  const res = await fetch(`/api/gift-offers/${id}/reject`, { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) throw new Error('Xatolik yuz berdi.');
  return res.json();
}

export async function dbCancelGift(id) {
  const res = await fetch(`/api/gift-offers/${id}/cancel`, { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) throw new Error('Xatolik yuz berdi.');
  return res.json();
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

export async function dbUploadAudio(dataUrl) {
  const res = await fetch('/api/upload-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ dataUrl }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const key = data && data.error;
    if (key === 'too_large') throw new Error("Musiqa fayli juda katta (maksimal ~8 MB).");
    if (key === 'unauthorized') throw new Error('Avval tizimga kiring.');
    if (key === 'bad_audio') throw new Error("Fayl formati qo'llab-quvvatlanmaydi (mp3, m4a, ogg, wav bo'lishi kerak).");
    throw new Error('Musiqani yuklab bo\u2019lmadi.');
  }
  return data.url;
}

// ---------- Auksion ----------

export async function dbListAuctions() {
  const data = await api('/auctions');
  return (data && data.auctions) || [];
}

// ---------- Yangiliklar ----------
export async function dbListNews() {
  try {
    const data = await api('/news');
    return (data && data.news) || [];
  } catch {
    return [];
  }
}

export async function dbGetAuction(id) {
  return api(`/auctions/${encodeURIComponent(id)}`);
}

const AUCTION_ERRORS = {
  not_owner: "Bu raqamli tashrif qog'ozi sizga tegishli emas.",
  already_in_auction: "Bu raqamli tashrif qog'ozi allaqachon auksionda.",
  bad_input: "Kiritilgan ma'lumotlar noto'g'ri.",
  BAD_INPUT: "Kiritilgan ma'lumotlar noto'g'ri.",
  buy_now_too_low: "\u2018Darhol sotib olish\u2019 narxi boshlang'ich narxdan yuqori bo'lishi kerak.",
  seller_payme_required: "To'lovni qabul qilish uchun Payme/karta raqamingizni kiriting.",
  unauthorized: 'Avval tizimga kiring.',
  AUCTION_NOT_FOUND: 'Auksion topilmadi.',
  AUCTION_ALREADY_CLOSED: 'Auksion allaqachon yakunlangan.',
  AUCTION_NOT_AWAITING_PAYMENT: "Bu auksion hozir to'lov kutish holatida emas.",
  NOT_WINNER: "Faqat auksion g'olibi to'lov qila oladi.",
  PAYMENT_DEADLINE_PASSED: "To'lov muddati (24 soat) o'tib ketgan.",
  payme_disabled: "Payme orqali to'lov imkoniyati tez kunlarda ishga tushadi.",
  OWN_AUCTION: "O'z auksioningizga taklif qila olmaysiz.",
  BID_TOO_LOW: "Taklifingiz joriy narxdan yuqori bo'lishi kerak.",
  BANNED: "Akkauntingiz vaqtincha bloklangan (to'lanmagan auksion sababli).",
  name_required: 'Ismingizni kiriting.',
  phone_required: 'Telefon raqamingizni kiriting.',
  SYSTEM: 'Tizim xatoligi yuz berdi, birozdan keyin qayta urinib ko\u2019ring.',
};

// MUHIM: kartani/kodni auksionga qo'yish endi faqat admin panel orqali
// (adminApi('/auctions', ...) — src/pages/AdminPage.jsx). Bu funksiya
// endi ishlatilmaydi, xavfsizlik uchun olib tashlandi.

// Foydalanuvchi adminga "shu noyob nomni auksionga qo'ying" deb so'rov
// yuboradi (real auksion emas — faqat taklif).
export async function dbRequestAuction(code, note) {
  const res = await fetch('/api/auction-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ code, note }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const key = data && data.error;
    if (key === 'unauthorized') throw new Error('Avval tizimga kiring.');
    if (key === 'code_taken') throw new Error('Bu kod allaqachon band.');
    if (key === 'ALREADY_PENDING') throw new Error("Bu kod uchun so'rovingiz allaqachon ko'rib chiqilmoqda.");
    if (key === 'bad_code') throw new Error("Kod formati noto'g'ri (3-16 ta harf/raqam).");
    throw new Error('Xatolik yuz berdi.');
  }
  return data;
}

// Foydalanuvchi yutib, hali to'lamagan auksionlari.
export async function dbListWonPendingAuctions() {
  const res = await fetch('/api/auctions/won/pending', { credentials: 'same-origin' });
  const data = await res.json().catch(() => null);
  return (data && data.auctions) || [];
}

// G'olib real to'lovni boshlaydi — profil ma'lumoti (ism) bilan birga,
// chunki bu kod uchun karta hali mavjud emas.
export async function dbPayAuctionWinner(auctionId, profile) {
  const res = await fetch(`/api/auctions/${encodeURIComponent(auctionId)}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(profile || {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(AUCTION_ERRORS[data && data.error] || 'Xatolik yuz berdi.');
  return data;
}

export async function dbPlaceBid(auctionId, amount, idempotencyKey) {
  const res = await fetch(`/api/auctions/${encodeURIComponent(auctionId)}/bid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ amount, idempotencyKey }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(AUCTION_ERRORS[data && data.error] || 'Xatolik yuz berdi.');
    err.code = data && data.error;
    err.available = data && data.available;
    throw err;
  }
  return data;
}

// ---------- Premium / Follow / Xabarlar ----------

const PREMIUM_FOLLOW_ERRORS = {
  unauthorized: 'Avval tizimga kiring.',
  ALREADY_PREMIUM: 'Siz allaqachon premium foydalanuvchisiz.',
  ALREADY_PENDING: "So'rovingiz allaqachon to'lov kutmoqda.",
  ALREADY_FOLLOWING: 'Siz allaqachon obuna bo\u2019lgansiz.',
  CANNOT_FOLLOW_SELF: "O'zingizga obuna bo'la olmaysiz.",
  NOT_FOUND: 'Topilmadi.',
  NOT_PREMIUM: 'Bu profil premium emas.',
  payme_disabled: "Payme orqali to'lov imkoniyati tez kunlarda ishga tushadi.",
};

async function dbApi(path, options) {
  const res = await fetch('/api' + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(PREMIUM_FOLLOW_ERRORS[data && data.error] || (data && data.error) || 'Xatolik yuz berdi.');
    err.code = data && data.error;
    err.available = data && data.available;
    throw err;
  }
  return data;
}

export const dbRequestPremium = () => dbApi('/premium/request', { method: 'POST' });
export const dbFollow = (code) => dbApi(`/follow/${encodeURIComponent(code)}`, { method: 'POST' });
export const dbUnfollow = (code) => dbApi(`/unfollow/${encodeURIComponent(code)}`, { method: 'POST' });
export const dbFollowStats = (code) => dbApi(`/follow-stats/${encodeURIComponent(code)}`);

export const dbGetLike = (code) => dbApi(`/records/${encodeURIComponent(code)}/like`);
export async function dbToggleLike(code) {
  const res = await fetch(`/api/records/${encodeURIComponent(code)}/like`, { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) throw new Error('Xatolik yuz berdi.');
  return res.json();
}

// ---------- Profil postlari ----------
export async function dbListPosts(code) {
  const data = await api(`/records/${encodeURIComponent(code)}/posts`);
  return (data && data.posts) || [];
}
export async function dbCreatePost(code, { imageUrl, caption }) {
  const res = await fetch(`/api/records/${encodeURIComponent(code)}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ imageUrl, caption }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const map = {
      unauthorized: 'Avval tizimga kiring.',
      bad_image: 'Avval rasm yuklang.',
      not_owner: 'Bu profil sizga tegishli emas.',
      limit_reached: data?.limit
        ? `Bu tarifda ${data.limit} tagacha post joylash mumkin.`
        : 'Postlar soni chegarasiga yetdingiz.',
      feature_locked: 'Post joylashtirish uchun Premium yoki yuqoriroq NFC ID kerak.',
    };
    const e = new Error(map[data?.error] || 'Postni joylab bo’lmadi.');
    if (data?.error === 'feature_locked') e.code = 'feature_locked';
    throw e;
  }
  return data;
}
export async function dbDeletePost(id) {
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
  if (!res.ok) throw new Error('Postni o’chirib bo’lmadi.');
  return res.json();
}
export async function dbTogglePostLike(id) {
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}/like`, { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) {
    const err = new Error('Xatolik yuz berdi.');
    if (res.status === 401) err.code = 'unauthorized';
    throw err;
  }
  return res.json();
}

export const dbListConversations = () => dbApi('/conversations');
export const dbUnreadCount = () => dbApi('/conversations/unread-count');
export const dbStartConversation = (code) => dbApi(`/conversations/with/${encodeURIComponent(code)}`, { method: 'POST' });
export const dbListMessages = (id, before) => dbApi(`/conversations/${id}/messages${before ? '?before=' + encodeURIComponent(before) : ''}`);
export const dbSendMessage = (id, body) => dbApi(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) });

// ---------- To'lovlar ----------

export const dbGetPayment = (orderId) => dbApi(`/payments/${encodeURIComponent(orderId)}`);
export const dbListPayments = () => dbApi('/payments');

// ---------- "Gift NFC ID" — yangi, izolyatsiyalangan ----------

export async function dbGetPendingGift(code) {
  const data = await dbApi(`/nfc-gifts/${encodeURIComponent(code)}`);
  return data?.gift || null;
}

export async function dbVerifyGiftCode(code, activationCode) {
  const res = await fetch(`/api/nfc-gifts/${encodeURIComponent(code)}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ activationCode }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error === 'bad_code' ? "Aktivatsiya kodi noto'g'ri." : 'Xatolik yuz berdi.');
  return data;
}

export async function dbActivateGift(code, payload) {
  const res = await fetch(`/api/nfc-gifts/${encodeURIComponent(code)}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const key = data?.error;
    const map = {
      bad_code: "Aktivatsiya kodi noto'g'ri.",
      email_taken: 'Bu email allaqachon ro\u2019yxatdan o\u2019tgan.',
      weak_password: 'Parol kamida 6 belgidan iborat bo\u2019lishi kerak.',
      bad_email: "Email noto'g'ri.",
      name_required: 'Ismingizni kiriting.',
      code_taken: 'Bu NFC ID allaqachon band bo\u2019lib qolgan.',
    };
    throw new Error(map[key] || 'Xatolik yuz berdi.');
  }
  return data;
}
