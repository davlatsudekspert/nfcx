import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = yuklanmoqda
  const [myCards, setMyCards] = useState([]);

  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const data = await res.json();
      setUser(data.user || null);
      setMyCards(Array.isArray(data.cards) ? data.cards : []);
    } catch {
      setUser(null);
      setMyCards([]);
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <AuthContext.Provider value={{ user, myCards, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

async function api(path, options) {
  const res = await fetch('/api' + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.error) || 'api_error_' + res.status);
    if (data && data.feature) err.feature = data.feature;
    if (data && data.limit != null) err.limit = data.limit;
    // Xatoning QO'SHIMCHA sababi (masalan email yuborishda "http_403").
    // Maxfiy emas — server u yerga faqat holat kodini qo'yadi.
    if (data && data.reason != null) err.reason = data.reason;
    if (data && data.detail != null) err.detail = data.detail;
    throw err;
  }
  return data;
}

export const authLogin = (email, password) =>
  api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const authRegister = (email, password, extra = {}) =>
  api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, ...extra }) });

// Ro'yxatdan o'tish kodini so'raydi.
//
// EMAIL berilsa kod EMAILGA ketadi (asosiy yo'l). Email xizmati
// o'chiq bo'lsa yoki faqat telefon berilsa — server eski yo'lga,
// Telegramga o'tadi. Javobdagi `channel` kod QAYERGA ketganini
// aytadi, shunda odamga "pochtangizni oching" deb aniq aytamiz.
export const authRequestRegisterCode = ({ email, phone } = {}) =>
  api('/auth/request-register-code', { method: 'POST', body: JSON.stringify({ email, phone }) });

// ── Telegram bilan BIR BOSISHDA bog'lanish ────────────────────────────
// Sayt bir martalik token oladi va odamni botga yuboradi. Odam botda
// bitta tugma bosadi, sayt esa holatni so'rab turadi va o'zi davom
// etadi. Foydalanuvchi HECH QANDAY kod ko'chirmaydi — shuning uchun
// "kodni hech kimga bermang" qoidasi buzilmaydi.
export const authTgLinkStart = () => api('/auth/tg-link/start', { method: 'POST' });
export const authTgLinkStatus = (token) =>
  api(`/auth/tg-link/status?token=${encodeURIComponent(token)}`);

export const authLogout = () => api('/auth/logout', { method: 'POST' });

// Raqamli tashrif qog'ozini egasi sifatida tahrirlash.
export const authUpdateCard = (code, record) =>
  api(`/records/${encodeURIComponent(code)}`, { method: 'PUT', body: JSON.stringify(record) });
