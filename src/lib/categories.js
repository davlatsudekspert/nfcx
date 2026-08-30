import { useEffect, useState } from 'react';
import { dbListCategories } from './db.js';

// Kategoriyalar dinamik (adminda tahrirlanadi) — bir marta yuklab, sessiya
// bo'yicha keshlaymiz.
let _cache = null;
let _promise = null;

export function useCategories() {
  const [cats, setCats] = useState(_cache || []);
  useEffect(() => {
    if (_cache) { setCats(_cache); return; }
    if (!_promise) _promise = dbListCategories().then((c) => { _cache = c; return c; }).catch(() => []);
    _promise.then((c) => setCats(c));
  }, []);
  return cats;
}

export function catName(cat, lang) {
  if (!cat) return '';
  if (lang === 'ru') return cat.nameRu || cat.nameUz;
  if (lang === 'en') return cat.nameEn || cat.nameUz;
  return cat.nameUz;
}

export function findCat(cats, slug) {
  return slug ? cats.find((c) => c.slug === slug) || null : null;
}

// slug uchun "Asosiy soha › Kichik soha" ko'rinishidagi to'liq nom.
export function catPath(cats, slug, lang) {
  const leaf = findCat(cats, slug);
  if (!leaf) return '';
  if (!leaf.parentSlug) return catName(leaf, lang);
  const parent = findCat(cats, leaf.parentSlug);
  return parent ? `${catName(parent, lang)} › ${catName(leaf, lang)}` : catName(leaf, lang);
}
