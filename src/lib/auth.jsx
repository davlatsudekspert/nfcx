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
  if (!res.ok) throw new Error((data && data.error) || 'api_error_' + res.status);
  return data;
}

export const authLogin = (email, password) =>
  api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const authRegister = (email, password) =>
  api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });

export const authLogout = () => api('/auth/logout', { method: 'POST' });

// Vizitkani egasi sifatida tahrirlash.
export const authUpdateCard = (code, record) =>
  api(`/records/${encodeURIComponent(code)}`, { method: 'PUT', body: JSON.stringify(record) });
