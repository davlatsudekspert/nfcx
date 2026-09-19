import { createPortal } from 'react-dom';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { IconImage, IconUser } from './Icons.jsx';

// ═══════════════════════════════════════════════════════════════════════
// HOZIR CHIZILMAYDI — qarang: pastdagi "JOYLASHUV" izohi.
//
// Shu fayldan HOZIR ishlatiladigan yagona narsa — `ownerActionUrl()`.
// Uni profil sahifasidagi "Tahrirlash" va "Story qo'shish"
// tugmalari chaqiradi.
//
// EGANING BOSHQARUV PANELI (telefon uchun)
//
// MUAMMO. NFC kartani telefonga tekkizgan ODAM O'ZI karta egasi bo'lsa,
// u o'z profilining public ko'rinishiga tushadi. Bu yerdan biror narsa
// qo'shish uchun avval yuqoridagi kichik "Tahrirlash" tugmasini topishi,
// keyin kabinetda kerakli bo'limni QIDIRISHI kerak edi. Telefonda bu
// uzun yo'l — eng ko'p qilinadigan uchta ish (story, post, profilni
// tahrirlash) ko'zdan yashiringan edi.
//
// YECHIM. Sahifaning pastida, barmoq yetadigan joyda, TO'RTTA aniq
// tugma. Har biri AYNAN SHU NFC ID bilan kabinetga olib boradi.
//
// BU PUBLIC NAVIGATSIYA EMAS. Panel faqat egaga ko'rinadi: mehmon,
// boshqa foydalanuvchi yoki tizimga kirmagan odam uni umuman ko'rmaydi
// (shart `ProfilePage.jsx` da — `isOwner`).
//
// JOYLASHUV (2026-09, egasining qarori). Panel avval PROFIL
// sahifasining pastida turardi. Egasi uni olib tashlashni so'radi:
// profil — uning ommaga ko'rinadigan yuzi, pastda yopishib turgan
// qator esa o'sha ko'rinishni to'sib, dizaynni buzardi
// ("profil eski holatda bo'lsin pastki joyi").
//
// Shuning uchun profilda endi avvalgidek ikki tugma turadi —
// "Tahrirlash" va "Story qo'shish" — faqat ular endi AYNAN shu
// NFC ID ni olib ketadi (`ownerActionUrl`).
//
// Panelning o'zi saqlab qolindi: egasi uni sayt sahifalarida
// (profil emas) ko'rishni istagan edi, lekin qaysi NFC ID ustida
// ishlashi hal qilinmagan. Joylashuv aniqlangach shu komponent
// qayta ulanadi — qaytadan yozish shart emas.
//
// NIMA UCHUN FAQAT TELEFONDA. Kompyuterda profilning o'zida inline
// "Tahrirlash" / "Story qo'shish" tugmalari bor va ular yaxshi
// ko'rinadi — pastda yana bir qator qo'yilsa, bir xil ish ikki marta
// takrorlanib, sahifa iflos bo'lardi. Shuning uchun panel `lg:hidden`.
//
// RANG VA `createPortal`. Panel — SAYT interfeysi, profil bezagi emas:
// u GLOBAL mavzu (NFCSTORE Original / Pearl / Graphite / Ocean / Aurora
// / Midnight) bilan o'zgarishi kerak.
//
// Lekin profil sahifasi `.vz-profile-page` sinfi bilan o'ralgan va u
// mavzu tokenlarini ATAYLAB eski (legacy) qiymatlarda QOTIRIB turadi —
// shunda global mavzu profil EGASINING bazadagi dizaynini buzmaydi.
// Panel shu qobiq ichida chizilsa, u ham legacy'da qotib qolardi va
// hamma mavzuda bir xil ko'rinardi.
//
// Shuning uchun panel `createPortal` bilan `document.body` ga chiqariladi
// — xuddi musiqa pleeri kabi. U allaqachon `position: fixed`, ya'ni
// joylashuvi bundan o'zgarmaydi; endi esa tokenlarni `:root` dan, ya'ni
// GLOBAL mavzudan oladi. Profil egasining `theme / accentColor / bgColor`
// qiymatlariga bu hech qanday ta'sir qilmaydi.
//
// Qoidalar `src/theme.css` dagi `.vz-owner-dock` da.
// ═══════════════════════════════════════════════════════════════════════

// Kabinetga AYNAN shu NFC ID bilan o'tish.
//
// Nima uchun manzilda kod: kabinet saqlangan tanlov bo'lmasa har doim
// ro'yxatdagi BIRINCHI kartani ochadi. Odamda bir nechta NFC ID bo'lsa
// (AAA000, VIP001, TTS075) va u TTS075 kartasini bosib kelgan bo'lsa,
// kodsiz manzil uni AAA000 ustiga olib tushardi — ya'ni odam o'zi
// bilmagan holda boshqa kartasini tahrirlab yuborishi mumkin edi.
export function ownerActionUrl(code, action) {
  const c = String(code || '').trim().toLowerCase();
  if (!c) return '/account';
  return `/account?code=${encodeURIComponent(c)}${action ? `&action=${action}` : ''}`;
}

// Story — uzuq halqa (profil rasmi atrofidagi story halqasiga ishora).
// Shu yerda yoziladi, chunki `Icons.jsx` da bunday belgi yo'q va u
// faqat shu panelda kerak.
function IconStoryRing(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8.2" strokeDasharray="3.1 2.3" />
      <path strokeLinecap="round" d="M12 8.8v6.4M8.8 12h6.4" />
    </svg>
  );
}

// Tahrirlash — qalam. (`Icons.jsx` dagi `IconNote` MUSIQA notasi, shuning
// uchun bu yerda ishlatilmaydi.)
function IconPencil(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 20.2h4.1L19 9.3a2.4 2.4 0 0 0 0-3.4l-.9-.9a2.4 2.4 0 0 0-3.4 0L3.8 16.1v4.1Z" />
      <path d="m13.6 6.6 3.8 3.8" />
    </svg>
  );
}

export default function OwnerDock({ code }) {
  const { t } = useLanguage();
  if (!code) return null;

  const items = [
    { key: 'story', action: 'story', label: t('Story'), Icon: IconStoryRing, plus: true },
    { key: 'post', action: 'post', label: t('Post'), Icon: IconImage, plus: true },
    { key: 'edit', action: 'edit', label: t('Tahrirlash'), Icon: IconPencil, plus: false },
    { key: 'account', action: '', label: t('Kabinet'), Icon: IconUser, plus: false },
  ];

  const dock = (
    // `role="group"` — bu navigatsiya menyusi emas, bitta narsaning
    // (shu NFC ID'ning) boshqaruv tugmalari to'plami.
    <div className="vz-owner-dock lg:hidden" role="group" aria-label={t('NFC ID boshqaruvi')}>
      <div className="vz-owner-dock-row">
        {items.map(({ key, action, label, Icon, plus }) => (
          <button
            key={key}
            type="button"
            className="vz-owner-dock-btn"
            onClick={() => navigate(ownerActionUrl(code, action))}
          >
            <span className="vz-owner-dock-ico">
              <Icon width={22} height={22} />
              {/* Story va Post — QO'SHISH amali. Kichik "+" buni
                  yozuvni uzaytirmasdan aytadi (320px ekranda har bir
                  yozuvga juda oz joy qoladi). */}
              {plus && <span className="vz-owner-dock-plus" aria-hidden="true">+</span>}
            </span>
            <span className="vz-owner-dock-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return createPortal(dock, document.body);
}
