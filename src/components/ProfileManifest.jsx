import { useEffect } from 'react';

// PROFILNI BOSH EKRANGA QO'SHISH — AYNAN O'SHA PROFIL OCHILSIN.
//
// Egasining shikoyati: "nfcstore.uz/vip001 ni add to home screen qilsam,
// ochilganda bosh sahifa chiqyapti".
//
// Sababi: butun saytda BITTA statik manifest bor (public/manifest.webmanifest)
// va uning `start_url` i "/" — ya'ni Android (Chrome) qaysi sahifadan
// qo'shilganidan qat'i nazar bosh sahifani ochadi. iPhone'da esa
// yorliq joriy manzilni oladi, shuning uchun u yerda muammo sezilmagan.
//
// Bu komponent profil sahifasi ochiq turganda `<link rel="manifest">` ni
// O'SHA PROFILNING manifestiga almashtiradi (`/api/manifest/p/<kod>` yoki
// `/api/manifest/c/<id>`), sahifa yopilganda esa saytning umumiy
// manifestini qaytaradi.
//
// NIMA UCHUN SERVER ENDPOINTI, `data:`/`blob:` EMAS: Chrome `start_url` ni
// MANIFEST manzili bo'yicha hisoblaydi va `data:`/`blob:` ning origin'i
// "opaque" bo'lgani uchun `start_url` yaroqsiz deb topiladi — ilova
// umuman o'rnatilmaydi.
//
// props:
//   kind — 'p' (jismoniy profil) yoki 'c' (kompaniya)
//   code — profil kodi / kompaniya ID'si
//   name — bosh ekrandagi yorliq nomi (iOS uchun)
export default function ProfileManifest({ kind, code, name = '' }) {
  useEffect(() => {
    if (!code) return undefined;
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return undefined;
    const previous = link.getAttribute('href');
    link.setAttribute('href', `/api/manifest/${kind}/${encodeURIComponent(String(code).toLowerCase())}`);

    // iOS yorliq nomini shu metadan oladi.
    const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const prevTitle = meta ? meta.getAttribute('content') : null;
    if (meta && name) meta.setAttribute('content', String(name).slice(0, 30));

    return () => {
      link.setAttribute('href', previous || '/manifest.webmanifest?v=5');
      if (meta && prevTitle != null) meta.setAttribute('content', prevTitle);
    };
  }, [kind, code, name]);

  return null;
}
