import { createContext, useContext, useEffect, useState } from 'react';

// To'lov tizimi yoqilgan/yoqilmaganligi endi BACKEND'dan (Cloudflare
// secrets orqali boshqariladigan paymentsEnabledD1()) real vaqtda
// olinadi — avval frontendda alohida qattiq-yozilgan
// (src/lib/features.js'dagi PAYMENTS_ENABLED) bayroq bo'lib, uni har safar
// backend bilan QO'LDA sinxronlashtirish (va shu bilan birga saytni qayta
// build+deploy qilish) kerak edi. Endi ikkalasi mos kelmasligi mumkin
// emas: yagona haqiqat manbai — backend. Tarmoq xatosi/ulanmagan holatda
// XAVFSIZ TOMONGA (false — to'lov o'chiq) qoladi.
const PaymentsEnabledContext = createContext(false);

export function PaymentsEnabledProvider({ children }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/payments-enabled')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setEnabled(!!(d && d.enabled)); })
      .catch(() => { /* xavfsiz tomonga — o'chiq holatda qoladi */ });
    return () => { cancelled = true; };
  }, []);
  return <PaymentsEnabledContext.Provider value={enabled}>{children}</PaymentsEnabledContext.Provider>;
}

export function usePaymentsEnabled() {
  return useContext(PaymentsEnabledContext);
}
