import { createContext, useContext, useEffect, useState } from 'react';

// To'lov tizimi yoqilgan/yoqilmaganligi endi BACKEND'dan (Cloudflare
// secrets orqali boshqariladigan paymentsEnabledD1()) real vaqtda
// olinadi — avval frontendda alohida qattiq-yozilgan
// (src/lib/features.js'dagi PAYMENTS_ENABLED) bayroq bo'lib, uni har safar
// backend bilan QO'LDA sinxronlashtirish (va shu bilan birga saytni qayta
// build+deploy qilish) kerak edi. Endi ikkalasi mos kelmasligi mumkin
// emas: yagona haqiqat manbai — backend. Tarmoq xatosi/ulanmagan holatda
// XAVFSIZ TOMONGA (false — to'lov o'chiq) qoladi.
//
// 2026-09: kontekst endi obyekt saqlaydi ({ enabled, sandbox, loaded }),
// lekin `usePaymentsEnabled()` AVVALGIDEK sof boolean qaytaradi — shu
// sababli uni ishlatayotgan barcha sahifalar (ReserveModal, PayButton,
// AccountPage, AuctionPage, PaymentsPage...) o'zgarishsiz ishlayveradi.
// Sandbox belgisi kerak bo'lgan joylar `usePaymentsInfo()` chaqiradi.
const PaymentsEnabledContext = createContext({ enabled: false, sandbox: false, loaded: false });

export function PaymentsEnabledProvider({ children }) {
  const [info, setInfo] = useState({ enabled: false, sandbox: false, loaded: false });
  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/payments-enabled')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setInfo({ enabled: !!(d && d.enabled), sandbox: !!(d && d.sandbox), loaded: true });
      })
      .catch(() => {
        // xavfsiz tomonga — o'chiq holatda qoladi. `loaded: true` qo'yiladi,
        // shunda interfeys abadiy "yuklanmoqda" holatida osilib qolmaydi.
        if (!cancelled) setInfo({ enabled: false, sandbox: false, loaded: true });
      });
    return () => { cancelled = true; };
  }, []);
  return <PaymentsEnabledContext.Provider value={info}>{children}</PaymentsEnabledContext.Provider>;
}

export function usePaymentsEnabled() {
  return useContext(PaymentsEnabledContext).enabled;
}

// { enabled, sandbox, loaded } — PaymeBlock kabi to'liq to'lov oynalari uchun.
export function usePaymentsInfo() {
  return useContext(PaymentsEnabledContext);
}
