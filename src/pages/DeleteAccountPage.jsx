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
// Nima o'chishi va nima qonun bo'yicha saqlanishi ROSTINI yozadi:
// so'rovdan keyin darhol yashirish, 30 kundan keyin butunlay o'chirish
// (hosting/api/account-purge.js). Egasining qarori (2026-09-25): 30 kun;
// pullik ID'lar uchun pul qaytarilmaydi, ular 90 kundan keyin qayta beriladi.

// Play Console'dagi aloqa manzili bilan BIR XIL (Google shu manzilga
// yozilgan so'rovni tekshiradi).
const CONTACT = 'davlatsudekspert@gmail.com';
// Play'dagi ilova nomi — Google sahifada aynan shu nom ko'rinishini talab qiladi.
const APP = 'NFCSTORE: Raqamli vizitka';

const T = {
  uz: {
    title: 'Hisobni o‘chirish',
    lead: `${APP} ilovasi (Google Play) va nfcstore.uz saytidagi NFCSTORE hisobingizni va unga bog‘langan ma’lumotlarni o‘chirishingiz mumkin.`,
    whatH: 'Nima bo‘ladi',
    what: [
      'So‘rovdan so‘ng darhol: barcha qurilmalardagi sessiyalar yopiladi va hisobga kira olmaysiz. NFC ID profillaringiz, biznes sahifalaringiz, postlar, istoriyalar, izohlar va obunalar saytdan ham, ilovadan ham yashiriladi.',
      '30 kundan keyin hisob butunlay o‘chiriladi: email, telefon, parol, profil va biznes ma’lumotlari, postlar, istoriyalar, izohlar, layklar, obunalar, saqlanganlar, siz yozgan xabarlar, bildirishnomalar va yuklangan fayllar (rasm, video, musiqa). Bu bosqichni qaytarib bo‘lmaydi.',
      `30 kun ichida fikringizdan qaytsangiz, ${CONTACT} manziliga yozing — hisobingiz tiklanadi.`,
      'Hisobingizda pul qoldig‘i, to‘lov kutilayotgan yoki yetkazilmagan buyurtma, faol auksion bo‘lsa yoki firibgarlik bo‘yicha tekshiruv ketayotgan bo‘lsa, butunlay o‘chirish shular hal bo‘lguncha kechiktiriladi.',
      'NFC ID va Business ID’laringiz ham hisob bilan birga ketadi, ular uchun to‘langan pul qaytarilmaydi. Bu ID’lar 90 kun hech kimga berilmaydi (eski NFC karta va havolalaringiz begona profilni ochmasligi uchun), keyin qayta sotuvga chiqadi.',
      'O‘chirilgan rasm va videolar tarmoq keshlarida va ularni avval ochgan qurilmalarda keshdan chiqib ketguncha ochilishi mumkin.',
    ],
    keepH: 'Nima saqlanadi va qancha muddat',
    keep: 'Qonun talablari va xavfsizlik uchun faqat quyidagilar saqlanadi. Ular ommaga ko‘rinmaydi va boshqa maqsadda ishlatilmaydi: buyurtma va to‘lov yozuvlari (Payme/Click: summa, sana, holat, mahsulot turi, tranzaksiya raqami) — buxgalteriya va soliq qonunchiligida belgilangan muddat davomida, ism, telefon va manzilsiz; o‘chirilgan kontent nusxasi va muallifning email hamda telefoni — yopiq dalil arxivida, faqat shikoyatlarni tekshirish, firibgarlikka qarshi kurash va vakolatli davlat organlarining qonuniy so‘rovlari uchun; xavfsizlik jurnallari (ularda email, telefon va IP manzil bo‘lishi mumkin) — 5 yilgacha. Qo‘llab-quvvatlashga yozgan xabarlaringiz, biznes sahifangiz mijozlarining buyurtmalari va suhbatdoshlaringiz sizga yozgan xabarlar ham hozircha saqlanadi. Zaxira nusxalardan ma’lumotlar 30 kun ichida o‘chib ketadi.',
    howH: 'Qanday o‘chiriladi',
    how: [
      'Ilovada: Sozlamalar → Xavfsizlik → “Hisobni o‘chirish”.',
      'Saytda: hisobingizga kiring va shu sahifada pastdagi tugmani bosing.',
      `Email orqali: ${CONTACT} manziliga hisobingiz emailidan “Hisobni o‘chirish” deb yozing (faqat telefon bilan ro‘yxatdan o‘tgan bo‘lsangiz — hisobdagi telefon raqamini ko‘rsating). Shaxsingizni tasdiqlaganimizdan keyin so‘rov 7 kun ichida qabul qilinadi va yuqoridagi tartib amal qiladi. Hisobingiz vaqtincha bloklangan bo‘lsa, shu yo‘ldan foydalaning.`,
    ],
    login: 'Kirish',
    signedAs: 'Kirgansiz:',
    understood: 'Tushundim: hisobim darhol yopiladi va 30 kundan keyin butunlay o‘chiriladi. Shundan keyin uni qaytarib bo‘lmaydi.',
    button: 'Hisobimni o‘chirish',
    busy: 'O‘chirilmoqda…',
    done: `So‘rov qabul qilindi, barcha qurilmalarda sessiyalar yopildi. Hisobingiz {date} kuni butunlay o‘chiriladi. Ungacha bekor qilish uchun ${CONTACT} ga yozing.`,
    error: `O‘chirib bo‘lmadi. Qayta urinib ko‘ring yoki ${CONTACT} ga yozing.`,
    privacy: 'Maxfiylik siyosati',
  },
  ru: {
    title: 'Удаление аккаунта',
    lead: `Вы можете удалить аккаунт NFCSTORE в приложении ${APP} (Google Play) и на сайте nfcstore.uz, а также связанные с ним данные.`,
    whatH: 'Что происходит',
    what: [
      'Сразу после запроса: сессии на всех устройствах закрываются, войти в аккаунт нельзя. Ваши профили NFC ID, бизнес-страницы, посты, истории, комментарии и подписки скрываются с сайта и из приложения.',
      'Через 30 дней аккаунт удаляется полностью: email, телефон, пароль, данные профиля и бизнеса, посты, истории, комментарии, лайки, подписки, сохранённое, ваши сообщения, уведомления и загруженные файлы (фото, видео, музыка). Этот шаг необратим.',
      `Если в течение 30 дней передумаете, напишите на ${CONTACT} — аккаунт восстановим.`,
      'Если на аккаунте есть остаток средств, неоплаченный или недоставленный заказ, активный аукцион или идёт проверка по мошенничеству, полное удаление откладывается до их завершения.',
      'Ваши NFC ID и Business ID удаляются вместе с аккаунтом, оплата за них не возвращается. 90 дней эти ID никому не выдаются (чтобы старые NFC-карты и ссылки не открывали чужой профиль), затем снова поступают в продажу.',
      'Удалённые фото и видео могут открываться из кэша сети и устройств, где их открывали раньше, пока кэш не обновится.',
    ],
    keepH: 'Что сохраняется и как долго',
    keep: 'По требованиям закона и безопасности сохраняется только следующее. Эти данные не публикуются и не используются в других целях: записи заказов и платежей (Payme/Click: сумма, дата, статус, тип товара, номер транзакции) — в течение срока, установленного законодательством о бухгалтерии и налогах, без имени, телефона и адреса; копия удалённого контента и email и телефон автора — в закрытом архиве доказательств, только для проверки жалоб, борьбы с мошенничеством и законных запросов уполномоченных государственных органов; журналы безопасности (в них могут быть email, телефон и IP-адрес) — до 5 лет. Ваши обращения в поддержку, заказы клиентов вашей бизнес-страницы и сообщения, которые вам писали собеседники, пока тоже сохраняются. Из резервных копий данные исчезают в течение 30 дней.',
    howH: 'Как удалить',
    how: [
      'В приложении: Настройки → Безопасность → «Удалить аккаунт».',
      'На сайте: войдите в аккаунт и нажмите кнопку ниже на этой странице.',
      `По email: напишите «Удалить аккаунт» на ${CONTACT} с адреса аккаунта (если регистрировались только по телефону — укажите номер телефона аккаунта). После подтверждения личности запрос принимается в течение 7 дней, дальше действует порядок выше. Если аккаунт временно заблокирован, используйте этот способ.`,
    ],
    login: 'Войти',
    signedAs: 'Вы вошли:',
    understood: 'Понимаю: аккаунт сразу закроется и через 30 дней будет удалён полностью. После этого его нельзя вернуть.',
    button: 'Удалить мой аккаунт',
    busy: 'Удаление…',
    done: `Запрос принят, сессии на всех устройствах закрыты. Аккаунт будет полностью удалён {date}. До этого, чтобы отменить, напишите на ${CONTACT}.`,
    error: `Не удалось удалить. Попробуйте ещё раз или напишите на ${CONTACT}.`,
    privacy: 'Политика конфиденциальности',
  },
  en: {
    title: 'Delete account',
    lead: `You can delete your NFCSTORE account used in the ${APP} app (Google Play) and on nfcstore.uz, and the data linked to it.`,
    whatH: 'What happens',
    what: [
      'Immediately after the request: sessions on all devices are closed and you can no longer sign in. Your NFC ID profiles, business pages, posts, stories, comments and follows are hidden from the website and the app.',
      'After 30 days the account is permanently deleted: email, phone, password, profile and business details, posts, stories, comments, likes, follows, saved items, messages you wrote, notifications and uploaded files (photos, videos, music). This step cannot be undone.',
      `If you change your mind within 30 days, write to ${CONTACT} and we will restore the account.`,
      'If the account has a remaining balance, an unpaid or undelivered order, an active auction, or a fraud investigation is in progress, permanent deletion is postponed until these are resolved.',
      'Your NFC IDs and Business IDs go with the account and payments for them are not refunded. These IDs are not given to anyone for 90 days (so your old NFC cards and links do not open someone else’s profile), then they go back on sale.',
      'Deleted photos and videos may still open from network caches and from devices that opened them before, until those caches expire.',
    ],
    keepH: 'What is kept and for how long',
    keep: 'Only the following is kept, for legal and security reasons. It is not public and is not used for any other purpose: order and payment records (Payme/Click: amount, date, status, product type, transaction ID) — for the period required by accounting and tax law, without name, phone or address; a copy of deleted content and the author’s email and phone — in a closed evidence archive, only to review reports, fight fraud and answer lawful requests from authorised state bodies; security logs (which may include email, phone and IP address) — for up to 5 years. Your support messages, orders from customers of your business page and messages other people sent you are also kept for now. Data disappears from backups within 30 days.',
    howH: 'How to delete',
    how: [
      'In the app: Settings → Security → “Delete account”.',
      'On the website: sign in and press the button below on this page.',
      `By email: write “Delete account” to ${CONTACT} from your account email (if you signed up with a phone number only, include the account’s phone number). After we verify your identity the request is accepted within 7 days and the steps above apply. If your account is temporarily blocked, use this option.`,
    ],
    login: 'Sign in',
    signedAs: 'Signed in as:',
    understood: 'I understand: my account is closed now and permanently deleted after 30 days. After that it cannot be restored.',
    button: 'Delete my account',
    busy: 'Deleting…',
    done: `Request received; sessions on all devices are closed. Your account will be permanently deleted on {date}. To cancel before then, write to ${CONTACT}.`,
    error: `Could not delete. Try again or write to ${CONTACT}.`,
    privacy: 'Privacy policy',
  },
};

// Butunlay o'chirish sanasi (server `purgeAfter`) — sahifa tilida.
const LOCALE = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };
function purgeDate(iso, lang) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 30 * 86_400_000);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(LOCALE[lang] || 'uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export default function DeleteAccountPage() {
  const { lang } = useLanguage();
  const t = T[lang] || T.uz;
  const { user, refresh } = useAuth() || {};
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState('idle'); // idle | busy | done | error
  const [purgeAfter, setPurgeAfter] = useState('');

  const remove = async () => {
    if (!agree || state === 'busy') return;
    setState('busy');
    try {
      const res = await fetch('/api/account', { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json().catch(() => ({}));
      setPurgeAfter(String(body?.purgeAfter || ''));
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
              <p className="font-semibold text-base-content" data-testid="delete-account-done">{t.done.replace('{date}', purgeDate(purgeAfter, lang))}</p>
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
