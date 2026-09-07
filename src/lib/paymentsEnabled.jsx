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
// Har bir to'lov tizimi alohida holatga ega. Backend
// `/api/settings/payments-enabled` javobidagi `providers` shundan keladi;
// eski `enabled`/`sandbox` maydonlari ham saqlanadi (mavjud sahifalar
// ularga tayanadi).
const EMPTY_PROVIDERS = {
  payme: { enabled: false, sandbox: false },
  click: { enabled: false, sandbox: false },
};

const PaymentsEnabledContext = createContext({
  enabled: false, sandbox: false, loaded: false, providers: EMPTY_PROVIDERS,
});

export function PaymentsEnabledProvider({ children }) {
  const [info, setInfo] = useState({ enabled: false, sandbox: false, loaded: false, providers: EMPTY_PROVIDERS });
  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/payments-enabled')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        // Eski backend (hali `providers` qaytarmaydigan) bilan ham
        // ishlaydi: u holda Payme holati umumiy `enabled` dan olinadi.
        const p = (d && d.providers) || {};
        setInfo({
          enabled: !!(d && d.enabled),
          sandbox: !!(d && d.sandbox),
          loaded: true,
          providers: {
            payme: {
              enabled: p.payme ? !!p.payme.enabled : !!(d && d.enabled),
              sandbox: p.payme ? !!p.payme.sandbox : !!(d && d.sandbox),
            },
            click: { enabled: !!(p.click && p.click.enabled), sandbox: !!(p.click && p.click.sandbox) },
          },
        });
      })
      .catch(() => {
        // xavfsiz tomonga — o'chiq holatda qoladi. `loaded: true` qo'yiladi,
        // shunda interfeys abadiy "yuklanmoqda" holatida osilib qolmaydi.
        if (!cancelled) setInfo({ enabled: false, sandbox: false, loaded: true, providers: EMPTY_PROVIDERS });
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

// Har bir to'lov tizimining holati:
//   { payme: { enabled, sandbox }, click: { enabled, sandbox } }
// PaymentBlock shu orqali qaysi brendni "faol", qaysinisini
// "tez kunlarda" deb ko'rsatishni biladi.
export function usePaymentProviders() {
  return useContext(PaymentsEnabledContext).providers;
}
