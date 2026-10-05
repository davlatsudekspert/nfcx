import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';

// POSTNI KO'TARISH — nfcstore.uz/kotarish (egasi, 2026-10-05).
//
// Biznes (yoki oddiy profil egasi) o'z postini lenta va Reels tepasiga
// "Tavsiya etilgan" qilib chiqaradi. Bu Instagram'dagi reklama bilan bir
// xil g'oya. Ilovada (Android) ham shu yo'l bor; iPhone ilovasida tugma
// ATAYLAB yo'q (App Store 3.1.1) — iPhone foydalanuvchilari shu sahifadan
// sotib oladi.
//
// Narx, egalik va takrorlanish SERVERDA tekshiriladi
// (hosting/api/featured.js). Bu sahifa faqat tanlaydi va Payme/Click
// sahifasini ochadi: slot to'lov tasdiqlangandan keyin serverda yonadi.

const T = {
  uz: {
    title: 'Postni ko‘tarish',
    lead: 'Postingiz asosiy lentada va Reels’da «Reklama» belgisi va «Profilni ochish» tugmasi bilan ko‘rinadi. Joylar cheklangan — har bir reklama ko‘pchilikka yetadi. Muddat tugagach o‘zi oddiy holatga qaytadi.',
    login: 'Davom etish uchun hisobingizga kiring.',
    loginBtn: 'Kirish',
    loading: 'Yuklanmoqda…',
    noPosts: 'Sizda hali post yo‘q. Avval ilova yoki sayt orqali post joylang.',
    choose: '1. Postni tanlang',
    pack: '2. Muddatni tanlang',
    days: (n) => `${n} kun`,
    som: 'so‘m',
    pay: 'To‘lovga o‘tish',
    payWith: 'To‘lov usulini tanlang:',
    active: 'Faol',
    pending: 'To‘lov kutilmoqda',
    until: 'gacha',
    cancel: 'Bekor qilish',
    disabled: 'To‘lovlar vaqtincha o‘chirilgan. Birozdan so‘ng urinib ko‘ring.',
    err: {
      already_featured: 'Bu post allaqachon ko‘tarilgan yoki to‘lov kutilmoqda.',
      too_many_active: 'Bir vaqtda ko‘pi bilan 3 ta post ko‘tarish mumkin.',
      sold_out: 'Hozir lentadagi hamma joylar band.',
      payments_disabled: 'To‘lovlar vaqtincha o‘chirilgan.',
      banned: 'Hisobingiz cheklangan.',
      forbidden: 'Bu post sizniki emas.',
      default: 'Amal bajarilmadi. Qayta urinib ko‘ring.',
    },
    why: [
      'Reklama kabineti, karta yoki dollar kerak emas — Payme yoki Click, so‘mda.',
      'O‘zbekistondagi tirik auditoriya: asosiy lenta va Reels.',
      'Natija shu yerning o‘zida: nechta yangi odam ko‘rdi va jami ko‘rishlar.',
      'Ko‘rgan odam bir bosishda profilingiz, katalog va aloqaga o‘tadi.',
    ],
    preview: 'Lentada shunday ko‘rinadi',
    slots: (a, m) => `Lentadagi joylar: ${m - a} / ${m} bo‘sh`,
    freeAt: 'Eng yaqin joy bo‘shaydi:',
    badge: 'Reklama',
    results: 'Reklamalarim va natijalari',
    reach: 'yangi odam ko‘rdi',
    viewsN: 'ko‘rish',
    ended: 'Tugagan',
    stopped: 'To‘xtatilgan',
    cancelled: 'Bekor qilingan',
    noResults: 'Hali reklama yo‘q.',
    company: 'Biznes',
    video: 'Video',
  },
  ru: {
    title: 'Продвижение поста',
    lead: 'Ваш пост будет показан в главной ленте и Reels с пометкой «Реклама» и кнопкой «Открыть профиль». Мест немного — каждую рекламу увидят многие. После окончания срока пост вернётся в обычный режим.',
    login: 'Войдите в аккаунт, чтобы продолжить.',
    loginBtn: 'Войти',
    loading: 'Загрузка…',
    noPosts: 'У вас пока нет постов. Сначала опубликуйте пост в приложении или на сайте.',
    choose: '1. Выберите пост',
    pack: '2. Выберите срок',
    days: (n) => `${n} дн.`,
    som: 'сум',
    pay: 'Перейти к оплате',
    payWith: 'Выберите способ оплаты:',
    active: 'Активно',
    pending: 'Ожидает оплаты',
    until: 'до',
    cancel: 'Отменить',
    disabled: 'Платежи временно отключены. Попробуйте позже.',
    err: {
      already_featured: 'Этот пост уже продвигается или ожидает оплаты.',
      too_many_active: 'Одновременно можно продвигать не более 3 постов.',
      sold_out: 'Сейчас все места в ленте заняты.',
      payments_disabled: 'Платежи временно отключены.',
      banned: 'Ваш аккаунт ограничен.',
      forbidden: 'Этот пост не ваш.',
      default: 'Не удалось выполнить. Попробуйте ещё раз.',
    },
    why: [
      'Без рекламного кабинета, карты и долларов — Payme или Click, в сумах.',
      'Живая аудитория Узбекистана: главная лента и Reels.',
      'Результат прямо здесь: сколько новых людей увидели и сколько просмотров.',
      'Зритель в одно касание переходит в ваш профиль, каталог и контакты.',
    ],
    preview: 'Так это выглядит в ленте',
    slots: (a, m) => `Свободно мест в ленте: ${m - a} из ${m}`,
    freeAt: 'Ближайшее место освободится:',
    badge: 'Реклама',
    results: 'Мои продвижения и результаты',
    reach: 'новых людей увидели',
    viewsN: 'просмотров',
    ended: 'Завершено',
    stopped: 'Остановлено',
    cancelled: 'Отменено',
    noResults: 'Продвижений пока нет.',
    company: 'Бизнес',
    video: 'Видео',
  },
  en: {
    title: 'Promote a post',
    lead: 'Your post is shown in the main feed and Reels with a “Sponsored” label and a “View profile” button. Slots are limited, so every ad reaches many people. When the period ends it returns to normal.',
    login: 'Sign in to continue.',
    loginBtn: 'Sign in',
    loading: 'Loading…',
    noPosts: 'You have no posts yet. Publish a post in the app or on the site first.',
    choose: '1. Choose a post',
    pack: '2. Choose a period',
    days: (n) => `${n} day${n === 1 ? '' : 's'}`,
    som: 'UZS',
    pay: 'Continue to payment',
    payWith: 'Choose a payment method:',
    active: 'Active',
    pending: 'Awaiting payment',
    until: 'until',
    cancel: 'Cancel',
    disabled: 'Payments are temporarily disabled. Please try again later.',
    err: {
      already_featured: 'This post is already promoted or awaiting payment.',
      too_many_active: 'You can promote at most 3 posts at a time.',
      sold_out: 'All feed slots are taken right now.',
      payments_disabled: 'Payments are temporarily disabled.',
      banned: 'Your account is restricted.',
      forbidden: 'This post is not yours.',
      default: 'Something went wrong. Please try again.',
    },
    why: [
      'No ads manager, card or dollars — pay with Payme or Click in UZS.',
      'A real audience in Uzbekistan: the main feed and Reels.',
      'Results right here: how many new people saw it and total views.',
      'Viewers reach your profile, catalog and contacts in one tap.',
    ],
    preview: 'How it looks in the feed',
    slots: (a, m) => `Free feed slots: ${m - a} of ${m}`,
    freeAt: 'Next slot frees up:',
    badge: 'Sponsored',
    results: 'My promotions and results',
    reach: 'new people reached',
    viewsN: 'views',
    ended: 'Ended',
    stopped: 'Stopped',
    cancelled: 'Cancelled',
    noResults: 'No promotions yet.',
    company: 'Business',
    video: 'Video',
  },
};

async function getJson(url) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export default function PromotePage() {
  const { user, myCards } = useAuth();
  const { lang } = useLanguage();
  const s = T[lang] || T.uz;

  const [packages, setPackages] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [capacity, setCapacity] = useState(null);
  const [posts, setPosts] = useState(null);
  const [slots, setSlots] = useState([]);
  const [picked, setPicked] = useState(null);
  const [days, setDays] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [links, setLinks] = useState(null);

  const cardCodes = useMemo(
    () => (Array.isArray(myCards) ? myCards : []).map((c) => c && c.code).filter(Boolean),
    [myCards],
  );

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [pk, mine, cos] = await Promise.all([
        getJson('/api/featured/packages'),
        getJson('/api/featured/mine'),
        getJson('/api/companies/mine'),
      ]);
      const companies = (cos?.companies || []).map((c) => c.companyId).filter(Boolean);
      const lists = await Promise.all([
        ...cardCodes.map((code) => getJson(`/api/records/${encodeURIComponent(code)}/posts`)
          .then((j) => (j?.posts || []).map((p) => ({ ...p, kind: 'post', owner: code })))),
        ...companies.map((id) => getJson(`/api/companies/${encodeURIComponent(id)}/posts`)
          .then((j) => (j?.posts || []).map((p) => ({ ...p, kind: 'company_post', owner: id })))),
      ]);
      if (!alive) return;
      setPackages(pk?.packages || []);
      setEnabled(pk?.enabled !== false);
      setCapacity(pk?.capacity || null);
      setSlots(mine?.slots || []);
      setPosts(lists.flat().filter((p) => p.imageUrl || p.videoUrl));
    })();
    return () => { alive = false; };
  }, [user, cardCodes]);

  const slotOf = (p) => slots.find((x) => x.targetKind === p.kind && Number(x.targetId) === Number(p.id)
    && (x.status === 'active' || x.status === 'pending'));

  const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU') : '');

  const submit = async () => {
    if (!picked || !days) return;
    setBusy(true);
    setErr('');
    setLinks(null);
    try {
      const res = await fetch('/api/featured', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKind: picked.kind, targetId: picked.id, days }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(s.err[j.error] || s.err.default);
        if (j.error === 'sold_out') setCapacity({ max: j.max, active: j.active, nextFreeAt: j.nextFreeAt });
        return;
      }
      setLinks(j.payLinks || {});
      setSlots((prev) => [...prev, j.slot].filter(Boolean));
    } catch {
      setErr(s.err.default);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (slot) => {
    const res = await fetch(`/api/featured/${slot.id}/cancel`, { method: 'POST', credentials: 'same-origin' });
    if (res.ok) setSlots((prev) => prev.map((x) => (x.id === slot.id ? { ...x, status: 'cancelled' } : x)));
  };

  if (user === undefined) return <div className="mx-auto max-w-2xl px-4 py-10">{s.loading}</div>;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-8 text-[color:var(--vz-ink)]">
      <h1 className="text-2xl font-semibold">{s.title}</h1>
      <p className="mt-2 text-[15px] opacity-80">{s.lead}</p>
      <ul className="mt-4 space-y-1.5 text-[14px]">
        {s.why.map((w) => (
          <li key={w} className="flex gap-2"><span className="text-[color:var(--vz-gold)]">✦</span><span>{w}</span></li>
        ))}
      </ul>

      {!user && (
        <div className="mt-6">
          <p>{s.login}</p>
          <button type="button" className="btn btn-gold mt-3 px-6" onClick={() => navigate('/login?next=/kotarish')}>
            {s.loginBtn}
          </button>
        </div>
      )}

      {user && !enabled && <p className="mt-6 text-red-500">{s.disabled}</p>}

      {user && posts === null && <p className="mt-6">{s.loading}</p>}

      {user && posts && posts.length === 0 && <p className="mt-6">{s.noPosts}</p>}

      {user && posts && posts.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">{s.choose}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {posts.map((p) => {
              const slot = slotOf(p);
              const on = picked && picked.kind === p.kind && picked.id === p.id;
              return (
                <button
                  key={`${p.kind}-${p.id}`}
                  type="button"
                  disabled={!!slot}
                  onClick={() => { setPicked(p); setLinks(null); setErr(''); }}
                  className={`relative aspect-square overflow-hidden rounded-xl border-2 ${on ? 'border-[color:var(--vz-gold,#c9a45c)]' : 'border-transparent'} ${slot ? 'opacity-70' : ''}`}
                >
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center bg-black/80 text-sm text-white">▶ {s.video}</div>}
                  {p.kind === 'company_post' && (
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{s.company}</span>
                  )}
                  {slot && (
                    <span className="absolute inset-x-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-[11px] text-white">
                      {slot.status === 'active' ? `${s.active} · ${fmtDate(slot.endsAt)} ${s.until}` : s.pending}
                    </span>
                  )}
                </button>
              );
            })}
          </div>


          {picked && (
            <>
              <h2 className="mt-8 text-lg font-semibold">{s.preview}</h2>
              <div className="mt-3 max-w-[340px] overflow-hidden rounded-2xl border border-[color:var(--vz-line)]" data-testid="promote-preview">
                <div className="flex items-center gap-2 px-3 py-2 text-[13px] font-semibold">
                  <span className="h-7 w-7 rounded-full bg-[color:var(--vz-gold)] opacity-70" />
                  <span className="flex-1 truncate">{picked.owner}</span>
                  <span className="rounded-full bg-[var(--accent-a14)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--accent-text)]">{s.badge}</span>
                </div>
                {picked.imageUrl
                  ? <img src={picked.imageUrl} alt="" className="aspect-square w-full object-cover" />
                  : <video src={picked.videoUrl} muted playsInline preload="metadata" className="aspect-square w-full bg-black object-cover" />}
                {picked.caption && <p className="line-clamp-2 px-3 py-2 text-[13px]">{picked.caption}</p>}
              </div>

              <h2 className="mt-8 text-lg font-semibold">{s.pack}</h2>
              {capacity && (
                <p className="mt-1 text-[13px] opacity-80" data-testid="promote-capacity">
                  {s.slots(capacity.active, capacity.max)}
                  {capacity.nextFreeAt ? ` · ${s.freeAt} ${new Date(capacity.nextFreeAt).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {(packages || []).map((pk) => (
                  <button
                    key={pk.days}
                    type="button"
                    onClick={() => { setDays(pk.days); setLinks(null); }}
                    className={`btn px-5 ${days === pk.days ? 'btn-gold' : 'btn-outline-gold'}`}
                  >
                    {s.days(pk.days)} — {Number(pk.price).toLocaleString('uz-UZ')} {s.som}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-gold mt-6 w-full"
                disabled={!days || busy || !enabled || (capacity && capacity.active >= capacity.max)}
                onClick={submit}
              >
                {s.pay}
              </button>
            </>
          )}

          {err && <p className="mt-4 text-red-500">{err}</p>}

          {links && (
            <div className="mt-6 rounded-xl border border-[color:var(--vz-line)] p-4">
              <p className="mb-3">{s.payWith}</p>
              <div className="flex flex-wrap gap-2">
                {links.payme && <a className="btn btn-gold px-6 no-underline" href={links.payme} rel="noopener">Payme</a>}
                {links.click && <a className="btn btn-outline-gold px-6 no-underline" href={links.click} rel="noopener">Click</a>}
              </div>
            </div>
          )}
        </>
      )}
      {user && posts && (
        <section className="mt-10" data-testid="promote-results">
          <h2 className="text-lg font-semibold">{s.results}</h2>
          {slots.filter((x) => x.status !== 'cancelled').length === 0 && <p className="mt-2 text-[14px] opacity-70">{s.noResults}</p>}
          <div className="mt-3 space-y-2">
            {slots.filter((x) => x.status !== 'cancelled').map((x) => {
              const p = (posts || []).find((q) => q.kind === x.targetKind && Number(q.id) === Number(x.targetId));
              const label = { active: s.active, pending: s.pending, expired: s.ended, stopped: s.stopped }[x.status] || x.status;
              return (
                <div key={x.id} className="flex items-center gap-3 rounded-xl border border-[color:var(--vz-line)] p-2.5 text-[14px]">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/70">
                    {p?.imageUrl && <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {label} · {s.days(x.days)}{x.status === 'active' && x.endsAt ? ` · ${fmtDate(x.endsAt)} ${s.until}` : ''}
                    </div>
                    {x.stats && (
                      <div className="text-[13px] opacity-80">
                        <b>{Number(x.stats.reach).toLocaleString('uz-UZ')}</b> {s.reach} · <b>{Number(x.stats.views).toLocaleString('uz-UZ')}</b> {s.viewsN}
                      </div>
                    )}
                  </div>
                  {x.status === 'pending' && (
                    <button type="button" className="text-[13px] font-semibold underline opacity-80" onClick={() => cancel(x)}>{s.cancel}</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
