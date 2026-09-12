import { useState } from 'react';
import { createPortal } from 'react-dom';
import { backdropProps } from '../lib/backdrop.js';
import { useLanguage } from '../lib/i18n.jsx';

// JOYLASHDAN OLDINGI OGOHLANTIRISH.
//
// Egasining talabi: post yoki istorya qo'yayotganda dini, pornografik,
// siyosiy kontent yoki so'kinish bo'lsa — qonun oldida javob berishi
// haqida ogohlantirish chiqsin.
//
// Rozilik SERVERGA ham yuboriladi (`agreed: true`) va u yerda
// tekshiriladi. Faqat shu oyna bo'lsa, to'g'ridan-to'g'ri API ga so'rov
// yuborib chetlab o'tish mumkin bo'lardi va bizda "u rozilik bergan"
// degan hech qanday dalil qolmasdi.
// MATN EGASI BERGAN TAHRIRDA — o'zgartirilmaydi, qisqartirilmaydi.
// Bitta joyda turadi: rasm, istorya, post va musiqa yuklashda AYNAN
// shu matn ko'rsatiladi (avval har birida boshqacha yozuv bor edi).
export const CONTENT_RULES_TEXT = 'Joylashtirilayotgan kontent quyidagilarni o‘z ichiga olmasligi shart: diniy targ‘ibot yoki ekstremistik mazmun, pornografik yoki jinsiy xarakterdagi tasvirlar, siyosiy targ‘ibot, shuningdek O‘zbekiston Respublikasi qonunchiligiga zid har qanday material. Ushbu qoidalar buzilgan taqdirda kontent ogohlantirishsiz o‘chiriladi.';
export const CONTENT_RULES_ACCEPT = 'Men qoidalarni o‘qidim va roziman';

export default function ContentRulesGate({ onAccept, onClose }) {
  const { t } = useLanguage();
  const [checked, setChecked] = useState(false);
  // `document.body` ga chiziladi. Sabab: rasm maydoni butun boshli
  // `<label>` ichida turadi, oyna esa uning ICHIDA chizilsa, oynaning
  // istalgan joyiga bosish label'ni ishga tushirib, fayl tanlash
  // oynasini ochib yuborardi. Portal buni butunlay yo'q qiladi va
  // z-index muammosini ham oldini oladi.
  return createPortal((
    <div className="co-modal-back" {...backdropProps(onClose)}>
      <div className="co-modal cr-modal" role="dialog" aria-modal="true">
        <h3>{t('Joylashdan oldin o‘qing')}</h3>
        <p className="cr-warn">{t(CONTENT_RULES_TEXT)}</p>
        <label className="cr-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{t(CONTENT_RULES_ACCEPT)}</span>
        </label>
        <button type="button" className="co-modal-cta" disabled={!checked} onClick={onAccept}>{t('Davom etish')}</button>
        <button type="button" className="cn-close" onClick={onClose}>{t('Bekor qilish')}</button>
      </div>
    </div>
  ), document.body);
}

// QOIDALAR DARVOZASI — qayta ishlatiladigan yordamchi.
//
// Chaqiruvchi `ask(fn)` deydi: avval qoidalar oynasi ochiladi, odam
// rozilik bergandagina `fn()` ishga tushadi (odatda fayl tanlash
// oynasini ochadi). Har bir joyda alohida holat yozilmasin uchun.
export function useContentRulesGate() {
  const [pending, setPending] = useState(null);
  const ask = (fn) => setPending(() => fn);
  const node = pending ? (
    <ContentRulesGate
      onClose={() => setPending(null)}
      onAccept={() => { const run = pending; setPending(null); run(); }}
    />
  ) : null;
  return { ask, node };
}
