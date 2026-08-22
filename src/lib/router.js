import { useEffect, useState } from 'react';

export function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash.replace(/^#\/?/, ''));
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.replace(/^#\/?/, ''));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function navigate(path) {
  window.location.hash = path;
}
