import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';

// HISOBNI O'CHIRISH — nfcstore.uz/delete-account (2026-09).
//
// Google Play talabi: ilovasi o'rnatilmagan odam ham hisobini o'chirishni
// so'ray olishi uchun OCHIQ veb-sahifa bo'lishi kerak. Bu sahifa:
//   * kirgan bo'lsa — hisobni shu yerning o'zida o'chiradi
//     (`DELETE /api/account`, ilovadagi tugma bilan AYNAN bir yo'l);
//   * kirmagan bo'lsa — uchta yo'lni aytadi: ilova, sayt, email.
// Nima o'chishi va nima qonun bo'yicha saqlanishi ROSTINI yozadi
// (hosting/api/account.js — "YUMSHOQ O'CHIRISH" izohi).

// Play Console'dagi aloqa manzili bilan BIR XIL (Google shu manzilga
// yozilgan so'rovni tekshiradi).
const CONTACT = 'davlatsudekspert@gmail.com';
// Play'dagi ilova nomi — Google sahifada aynan shu nom ko'rinishini talab qiladi.
const APP = 'NFCSTORE: Raqamli vizitka';

const T = {
  uz: {
    title: 'Hisobni o‘chirish',
    lead: `${APP} ilovasi (Google Play) va nfcstore.uz saytidagi NFCSTORE hisobingizni va unga bog‘langan ma’lumotlarni o‘chirishingiz mumkin.`,
    whatH: 'Nima o‘chadi',
    what: [
      'Hisobingizga kira olmaysiz, barcha qurilmalardagi sessiyalar darhol yopiladi.',
      'NFC ID profillaringiz, postlar, istoriyalar, izohlar, obunalar va saqlanganlar saytdan ham, ilovadan ham darhol olib tashlanadi.',
      'Biznes sahifalaringiz ommaga ko‘rinmay qoladi.',
    ],
    keepH: 'Nima saqlanadi va qancha muddat',
    keep: 'Buyurtma va to‘lov yozuvlari (Payme/Click) buxgalteriya va soliq talablari uchun qonunda belgilangan muddatgacha saqlanadi; xavfsizlik jurnallari 5 yilgacha. O‘chirilgan kontent nusxasi (kim, qachon joylagan) yopiq arxivda faqat shikoyatlarni tekshirish va vakolatli davlat organlarining qonuniy so‘rovlari uchun saqlanadi. Bu ma’lumotlar ommaga ko‘rinmaydi va boshqa maqsadda ishlatilmaydi.',
    howH: 'Qanday o‘chiriladi',
    how: [
      'Ilovada: Sozlamalar → Xavfsizlik → “Hisobni o‘chirish”.',
      'Saytda: hisobingizga kiring va shu sahifada pastdagi tugmani bosing.',
      `Email orqali: ${CONTACT} manziliga hisobingiz emaili bilan “Hisobni o‘chirish” deb yozing — 30 kun ichida bajariladi.`,
    ],
    login: 'Kirish',
    signedAs: 'Kirgansiz:',
    understood: 'Tushundim: hisobim o‘chadi va buni qaytarib bo‘lmaydi.',
    button: 'Hisobimni o‘chirish',
    busy: 'O‘chirilmoqda…',
    done: 'Hisobingiz o‘chirildi. Barcha qurilmalarda sessiyalar yopildi.',
    error: `O‘chirib bo‘lmadi. Qayta urinib ko‘ring yoki ${CONTACT} ga yozing.`,
    privacy: 'Maxfiylik siyosati',
  },
  ru: {
    title: 'Удаление аккаунта',
    lead: `Вы можете удалить аккаунт NFCSTORE в приложении ${APP} (Google Play) и на сайте nfcstore.uz, а также связанные с ним данные.`,
    whatH: 'Что удаляется',
    what: [
      'Вход в аккаунт становится невозможным, сессии на всех устройствах сразу закрываются.',
      'Ваши профили NFC ID, посты, истории, комментарии, подписки и сохранённое сразу убираются с сайта и из приложения.',
      'Ваши бизнес-страницы перестают быть публичными.',
    ],
    keepH: 'Что сохраняется и как долго',
    keep: 'Записи заказов и платежей (Payme/Click) хранятся в течение срока, установленного законом для бухгалтерии и налогов; журналы безопасности — до 5 лет. Копия удалённого контента (кто и когда опубликовал) хранится в закрытом архиве только для проверки жалоб и законных запросов уполномоченных государственных органов. Эти данные не публикуются и не используются в других целях.',
    howH: 'Как удалить',
    how: [
      'В приложении: Настройки → Безопасность → «Удалить аккаунт».',
      'На сайте: войдите в аккаунт и нажмите кнопку ниже на этой странице.',
      `По email: напишите на ${CONTACT} с адреса аккаунта «Удалить аккаунт» — выполняется в течение 30 дней.`,
    ],
    login: 'Войти',
    signedAs: 'Вы вошли:',
    understood: 'Понимаю: аккаунт будет удалён, это необратимо.',
    button: 'Удалить мой аккаунт',
    busy: 'Удаление…',
    done: 'Аккаунт удалён. Сессии на всех устройствах закрыты.',
    error: `Не удалось удалить. Попробуйте ещё раз или напишите на ${CONTACT}.`,
    privacy: 'Политика конфиденциальности',
  },
  en: {
    title: 'Delete account',
    lead: `You can delete your NFCSTORE account used in the ${APP} app (Google Play) and on nfcstore.uz, and the data linked to it.`,
    whatH: 'What is deleted',
    what: [
      'You can no longer sign in; sessions on all devices are closed immediately.',
      'Your NFC ID profiles, posts, stories, comments, follows and saved items are removed from the website and the app immediately.',
      'Your business pages stop being public.',
    ],
    keepH: 'What is kept and for how long',
    keep: 'Order and payment records (Payme/Click) are kept for the period required by accounting and tax law; security logs for up to 5 years. A copy of deleted content (who posted it and when) is kept in a closed archive only to review reports and answer lawful requests from authorised state bodies. This data is not public and is not used for any other purpose.',
    howH: 'How to delete',
    how: [
      'In the app: Settings → Security → “Delete account”.',
      'On the website: sign in and press the button below on this page.',
      `By email: write “Delete account” to ${CONTACT} from your account email — completed within 30 days.`,
    ],
    login: 'Sign in',
    signedAs: 'Signed in as:',
    understood: 'I understand: my account will be deleted and this cannot be undone.',
    button: 'Delete my account',
    busy: 'Deleting…',
    done: 'Your account has been deleted. Sessions on all devices are closed.',
    error: `Could not delete. Try again or write to ${CONTACT}.`,
    privacy: 'Privacy policy',
  },
};

export default function DeleteAccountPage() {
  const { lang } = useLanguage();
  const t = T[lang] || T.uz;
  const { user, refresh } = useAuth() || {};
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState('idle'); // idle | busy | done | error

  const remove = async () => {
    if (!agree || state === 'busy') return;
    setState('busy');
    try {
      const res = await fetch('/api/account', { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      setState('done');
      await refresh?.();
    } catch {
      setState('error');
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 pb-16 sm:px-10 lg:px-14">
      <div className="mx-auto max-w-3xl">
        <div className="pt-14 font-mono text-xs uppercase tracking-wider text-base-content/50" data-testid="app-name">{APP}</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{t.title}</h1>
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-base-content/70">
          <p>{t.lead}</p>
          <section>
            <h2 className="text-lg font-bold text-base-content">{t.whatH}</h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">{t.what.map((s) => <li key={s}>{s}</li>)}</ul>
          </section>
          <section>
            <h2 className="text-lg font-bold text-base-content">{t.keepH}</h2>
            <p className="mt-1.5">{t.keep}</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-base-content">{t.howH}</h2>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5">{t.how.map((s) => <li key={s}>{s}</li>)}</ol>
          </section>

          <section className="rounded-2xl border border-base-content/10 p-5" data-testid="delete-account-box">
            {state === 'done' ? (
              <p className="font-semibold text-base-content">{t.done}</p>
            ) : user === undefined ? null : user ? (
              <>
                <p className="text-sm">{t.signedAs} <b className="text-base-content">{user.email}</b></p>
                <label className="mt-4 flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="checkbox mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>{t.understood}</span>
                </label>
                <button
                  type="button"
                  className="btn btn-error mt-5"
                  disabled={!agree || state === 'busy'}
                  onClick={remove}
                >
                  {state === 'busy' ? t.busy : t.button}
                </button>
                {state === 'error' && <p className="mt-3 text-sm text-error">{t.error}</p>}
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>{t.login}</button>
            )}
          </section>

          <p>
            <a className="link" href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>{t.privacy}</a>
          </p>
        </div>
      </div>
    </main>
  );
}
