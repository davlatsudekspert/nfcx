import { createContext, useContext, useState, useCallback } from 'react';

// Sayt tillari: O'zbek (standart) / Rus / Ingliz. Tanlangan til
// brauzerda saqlanadi (localStorage) — sahifa yangilansa ham eslab qoladi.
// DIQQAT: tarjima lug'ati hozircha eng ko'p ko'rinadigan qismlarni
// (navigatsiya, Header, Footer, Bosh sahifa) qamrab oladi. Boshqa
// sahifalarga tarjima vaqt o'tishi bilan qo'shiladi — kalit topilmasa,
// t() funksiyasi original (o'zbekcha) matnni qaytaradi, hech narsa
// buzilmaydi.

export const LANGUAGES = [
  { code: 'uz', label: "O'zbek", flag: '\u{1F1FA}\u{1F1FF}' },
  { code: 'ru', label: 'Русский', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
];

const DICT = {
  // ---- Navigatsiya (Header) ----
  'Narxlar': { ru: 'Цены', en: 'Pricing' },
  'Qanday ishlaydi': { ru: 'Как это работает', en: 'How it works' },
  'Katalog': { ru: 'Каталог', en: 'Catalog' },
  'Reyting': { ru: 'Рейтинг', en: 'Ranking' },
  'Kompaniyalar': { ru: 'Компаниям', en: 'Companies' },
  'Auksion': { ru: 'Аукцион', en: 'Auction' },
  'Savollar': { ru: 'Вопросы', en: 'FAQ' },
  'Xabarlar': { ru: 'Сообщения', en: 'Messages' },
  "To'lovlar": { ru: 'Платежи', en: 'Payments' },
  'Mening profilim': { ru: 'Мой профиль', en: 'My profile' },
  "Raqamli tashrif qog'ozi olish": { ru: 'Получить NFC-визитку', en: 'Get a digital card' },
  'Kirish': { ru: 'Войти', en: 'Login' },
  'Chiqish': { ru: 'Выйти', en: 'Logout' },

  // ---- Bosh sahifa (asosiy qismlar) ----
  "O'zingizga shaxsiy raqamli tashrif qog'ozi": { ru: 'Ваша личная цифровая визитка', en: 'Your personal digital card' },
  "Shaxsiy raqamli profilingiz — har doim yoningizda.": { ru: 'Ваш цифровой профиль — всегда с вами.', en: 'Your digital profile — always with you.' },
  "Bir tegish — profilingiz ochiladi.": { ru: 'Одно касание — и профиль открыт.', en: 'One tap — your profile opens.' },
  "Band qilingan": { ru: 'Занято', en: 'Taken' },
  "Bo'sh": { ru: 'Свободно', en: 'Available' },
  "Bandlash": { ru: 'Забронировать', en: 'Reserve' },

  // ---- Footer ----
  'Mahsulot': { ru: 'Продукт', en: 'Product' },
  'Kompaniya': { ru: 'Компания', en: 'Company' },
  'Huquqiy': { ru: 'Правовое', en: 'Legal' },
  "Bog'lanish": { ru: 'Связаться', en: 'Contact' },
  "Foydalanish shartlari": { ru: 'Условия использования', en: 'Terms of use' },
  "Maxfiylik siyosati": { ru: 'Политика конфиденциальности', en: 'Privacy policy' },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('nfc_lang') || 'uz'; } catch { return 'uz'; }
  });

  const setLang = useCallback((code) => {
    setLangState(code);
    try { localStorage.setItem('nfc_lang', code); } catch { /* jim tur */ }
  }, []);

  const t = useCallback((text) => {
    if (lang === 'uz') return text;
    const entry = DICT[text];
    return (entry && entry[lang]) || text;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: 'uz', setLang: () => {}, t: (x) => x };
  return ctx;
}
