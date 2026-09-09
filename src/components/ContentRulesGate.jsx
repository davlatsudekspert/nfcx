import { useState } from 'react';
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
export const CONTENT_RULES = [
  'Diniy adovat yoki targ‘ibot',
  'Pornografiya va shafqatsizlik',
  'Siyosiy targ‘ibot va da’vat',
  'So‘kinish va haqorat',
  'Boshqa odamning rasmi yoki ma’lumoti — ruxsatisiz',
];

export default function ContentRulesGate({ onAccept, onClose }) {
  const { t } = useLanguage();
  const [checked, setChecked] = useState(false);
  return (
    <div className="co-modal-back" {...backdropProps(onClose)}>
      <div className="co-modal cr-modal" role="dialog" aria-modal="true">
        <h3>{t('Joylashdan oldin o‘qing')}</h3>
        <p>{t('Quyidagilarni joylash TAQIQLANADI:')}</p>
        <ul className="cr-list">
          {CONTENT_RULES.map((rule) => <li key={rule}>{t(rule)}</li>)}
        </ul>
        <p className="cr-warn">
          {t('Joylagan kontentingiz uchun to‘liq javobgarlik SIZNING zimmangizda. Qonun buzilsa, materiallaringiz va akkaunt ma’lumotlaringiz vakolatli organlarga topshiriladi va siz qonun oldida javob berasiz.')}
        </p>
        <label className="cr-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{t('O‘qidim va roziman — javobgarlikni o‘z zimmamga olaman')}</span>
        </label>
        <button type="button" className="co-modal-cta" disabled={!checked} onClick={onAccept}>{t('Davom etish')}</button>
        <button type="button" className="cn-close" onClick={onClose}>{t('Bekor qilish')}</button>
      </div>
    </div>
  );
}
