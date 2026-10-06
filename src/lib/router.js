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

// ICHKI HAVOLA UCHUN onClick (2026-10, sayt auditi). Menyu va pastki
// qismdagi havolalar <button onClick={navigate}> edi: qidiruv robotlari
// ularni havola deb ko'rmasdi, sichqonchaning o'rta tugmasi / Ctrl+bosish
// yangi tabda ochmasdi. Endi ular <a href> — oddiy bosishda SPA ichida
// o'tiladi (sahifa qayta yuklanmaydi), Ctrl/Cmd/Shift/o'rta tugma esa
// brauzerning o'z ishini qiladi.
export function linkClick(href, before) {
  return (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (before) before();
    navigate(href);
  };
}

// Haqiqiy URL navigatsiyasi: nfcstore.uz/AAA00, /login, /account ...
export function navigate(path, { replace = false } = {}) {
  const url = String(path || '/').startsWith('/') ? path : '/' + path;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(ROUTE_EVENT));
  window.scrollTo(0, 0);
}
