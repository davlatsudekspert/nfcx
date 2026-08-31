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
    throw err;
  }
  return data;
}

export const authLogin = (email, password) =>
  api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const authRegister = (email, password, extra = {}) =>
  api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, ...extra }) });

// Ro'yxatdan o'tishdan oldin — botga ulangan telefon raqamiga tasdiqlash
// kodi yuborishni so'raydi (Telegram orqali).
export const authRequestRegisterCode = (phone) =>
  api('/auth/request-register-code', { method: 'POST', body: JSON.stringify({ phone }) });

export const authLogout = () => api('/auth/logout', { method: 'POST' });

// Raqamli tashrif qog'ozini egasi sifatida tahrirlash.
export const authUpdateCard = (code, record) =>
  api(`/records/${encodeURIComponent(code)}`, { method: 'PUT', body: JSON.stringify(record) });
