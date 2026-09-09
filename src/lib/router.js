import { useEffect, useState } from 'react';

const ROUTE_EVENT = 'routechange';

// KOMPANIYANING O'Z DOMENI (menu.kompaniya.uz).
// Worker shu domenda SPA qobig'iga <meta name="nfc-company"> yozadi.
// Teg BIRINCHI renderdayoq o'qiladi — qo'shimcha so'rov kutilmaydi,
// shuning uchun sahifa "bo'sh" holatda ko'rinmaydi.
let domainCompany;
export function domainCompanyId() {
  if (domainCompany === undefined) {
    try {
      domainCompany = document.querySelector('meta[name="nfc-company"]')?.content?.trim().toUpperCase() || '';
    } catch { domainCompany = ''; }
  }
  return domainCompany;
}

function currentPath() {
  return window.location.pathname;
}

export function usePathRoute() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('popstate', onChange);
    window.addEventListener(ROUTE_EVENT, onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener(ROUTE_EVENT, onChange);
    };
  }, []);
  return path;
}

// Haqiqiy URL navigatsiyasi: nfcstore.uz/AAA00, /login, /account ...
export function navigate(path, { replace = false } = {}) {
  const url = String(path || '/').startsWith('/') ? path : '/' + path;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(ROUTE_EVENT));
  window.scrollTo(0, 0);
}
