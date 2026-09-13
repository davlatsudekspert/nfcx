import { createPortal } from 'react-dom';
import { useLanguage } from '../lib/i18n.jsx';
import { IconExpand } from './Icons.jsx';

// "BOSH EKRANGA QO'SHISH" YO'RIQNOMASI.
//
// Nima uchun kerak: iPhone'da (va iOS'dagi HAMMA brauzerda — ular
// ichkarida bir xil WebKit'da ishlaydi) sahifa uchun to'liq ekran
// rejimi UMUMAN yo'q. `requestFullscreen` u yerda mavjud emas, ya'ni
// tugma bosilsa hech narsa bo'lmaydi.
//
// Ilgari shuning uchun tugmani o'sha qurilmalarda YASHIRGAN edik —
// egasi aynan shuni ko'rdi: "to'liq ekran qilish telefondan kirganda
// yo'q, lekin kompyuterdan kirganda ko'rinyabdi". Ya'ni tugma eng
// kerak bo'lgan joyda yo'q edi.
//
// Endi tugma DOIM turadi. To'liq ekran rejimi bo'lmasa — bu yo'riqnoma
// chiqadi: iPhone'da brauzer qatorlarini butunlay yo'qotishning YAGONA
// yo'li sahifani bosh ekranga qo'shish (u holda u ilovadek ochiladi).
// Buning uchun manifest allaqachon tayyor (ProfileManifest) — ya'ni
// bosh ekrandan aynan SHU profil ochiladi, bosh sahifa emas.
export default function AddToHomeSheet({ onClose }) {
  const { t } = useLanguage();

  const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
  const ios = /iPhone|iPad|iPod/i.test(ua)
    || (/Macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);

  // iOS'da Safari'DAN BOSHQA brauzerlar — Yandex, Chrome, Firefox,
  // Edge, Opera. Egasi aynan shu holatga tushdi: Yandex Browser'dan
  // kirgan, pastda «Ulashish» belgisi yo'q edi va yo'riqnoma uning
  // ekraniga umuman mos kelmasdi.
  //
  // Bu brauzerlarda "bosh ekranga qo'shish" yo ishonchli emas, yo
  // butunlay yo'q (masalan iOS Chrome'da yo'q). Yagona ishonchli yo'l —
  // sahifani Safari'da ochish.
  const iosOther = ios && /CriOS|YaBrowser|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);

  // Qadamlar brauzerga qarab — odam O'Z EKRANIDA ko'rgan so'zni o'qisin.
  let steps;
  if (iosOther) {
    steps = [
      t('Pastdagi ☰ menyuni oching'),
      t('«Safari’da ochish» ni tanlang'),
      t('Safari’da: «Ulashish» → «Bosh ekranga qo‘shish»'),
    ];
  } else if (ios) {
    steps = [
      t('Pastdagi «Ulashish» belgisini bosing'),
      t('Ro‘yxatdan «Bosh ekranga qo‘shish» ni tanlang'),
      t('«Qo‘shish» ni bosing'),
    ];
  } else {
    steps = [
      t('Brauzerning yuqori o‘ng burchagidagi ⋮ menyusini oching'),
      t('«Ilovani o‘rnatish» yoki «Bosh ekranga qo‘shish» ni tanlang'),
      t('Tasdiqlang'),
    ];
  }

  return createPortal(
    <div className="ma-veil" onClick={onClose}>
      <div className="ma-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="ma-head">
          <i aria-hidden="true"><IconExpand width={18} height={18} /></i>
          <b>{t('To‘liq ekranda ochish')}</b>
        </div>
        <p className="ma-note">
          {iosOther
            ? t('iPhone’da brauzer sahifani to‘liq ekranga chiqarishga ruxsat bermaydi. Bosh ekranga qo‘shish esa faqat Safari orqali ishlaydi — qo‘shilgandan keyin profil ilovadek, brauzer qatorlarisiz ochiladi.')
            : ios
              ? t('iPhone’da brauzer sahifani to‘liq ekranga chiqarishga ruxsat bermaydi. Profilni bosh ekranga qo‘shsangiz — u ilovadek, brauzer qatorlarisiz ochiladi.')
              : t('Profilni bosh ekranga qo‘shsangiz — u ilovadek, brauzer qatorlarisiz ochiladi.')}
        </p>
        <ol className="ma-steps">
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        <button type="button" className="ma-close" onClick={onClose}>{t('Tushunarli')}</button>
      </div>
    </div>,
    document.body,
  );
}
