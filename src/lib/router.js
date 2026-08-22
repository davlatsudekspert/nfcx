import { useEffect, useState } from 'react';

const ROUTE_EVENT = 'routechange';

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
