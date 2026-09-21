import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';

/**
 * IZOHLAR — SAYTDA.
 *
 * ## NIMA UCHUN KERAK BO'LDI
 *
 * Izoh tizimi backend'da allaqachon bor edi (`hosting/api/comments.js`,
 * `content_comments` jadvali), lekin uni FAQAT ilova chaqirardi.
 * Saytda izoh UI umuman yo'q edi.
 *
 * Oqibati: telefonda yozilgan izoh saytda ko'rinmasdi. Bitta post
 * ikki joyda ikki xil ko'rinardi — ilovada "izohlar: 4", saytda
 * hech narsa. Biznes uchun bu ayniqsa og'ir: mijoz savolini
 * telefonda yozadi, egasi esa kompyuterda ishlaydi va savolni
 * umuman ko'rmaydi.
 *
 * ## BITTA MANBA
 *
 * Bu komponent ilova chaqiradigan AYNAN o'sha endpointlarga
 * boradi. Sayt uchun alohida jadval ham, alohida API ham
 * yaratilmadi — aks holda ikkita izoh oqimi paydo bo'lardi.
 *
 * @param {string} kind - post | company_post | story | company_story
 * @param {number} id - kontent ID'si
 * @param {number} initialCount - lentadan kelgan izohlar soni
 */
export default function Comments({ kind, id, initialCount = 0 }) {
  const { t } = useLanguage();
  const { user } = useAuth();

  // `null` — hali ochilmagan. Izohlar ro'yxati POSTNING O'ZI bilan
  // birga yuklanmaydi: sahifada o'nta post bo'lsa, o'nta ortiqcha
  // so'rov ketardi va ularning aksariyati hech qachon o'qilmasdi.
  const [list, setList] = useState(null);
  const [total, setTotal] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await fetch(`/api/comments/${kind}/${id}`, {
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error('load');
      setList(Array.isArray(data?.comments) ? data.comments : []);
      if (typeof data?.total === 'number') setTotal(data.total);
    } catch {
      // Ro'yxat kelmasa BO'SH ro'yxat ko'rsatilmaydi: "izoh yo'q"
      // bilan "yuklanmadi" ikki xil narsa va ularni aralashtirish
      // odamni chalg'itadi.
      setList([]);
      setError(t('Izohlar yuklanmadi.'));
    }
  };

  useEffect(() => {
    if (open && list === null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/comments/${kind}/${id}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // SERVER SABABINI AYTADI. Umumiy "xatolik" bu yerda
        // yaramaydi: "premium kerak" va "bloklangansiz" ikki xil
        // narsa va odam ikkalasida ham boshqa ish qiladi.
        const code = data?.error;
        setError(
          code === 'premium_required' ? t('Izoh yozish Premium a’zolar uchun.')
          : code === 'banned' ? t('Hisobingiz vaqtincha bloklangan.')
          : code === 'too_many_requests' ? t('Juda tez yozyapsiz. Biroz kuting.')
          : code === 'empty' ? t('Izoh bo‘sh.')
          : code === 'unauthorized' ? t('Avval tizimga kiring.')
          : t('Izoh yuborilmadi.'),
        );
        return;
      }
      // Yangi izoh RO'YXAT BOSHIGA qo'shiladi — server ham shunday
      // tartiblaydi (yangisi yuqorida), ya'ni sahifa yangilanganda
      // o'rni o'zgarmaydi.
      if (data?.comment) setList((prev) => [data.comment, ...(prev || [])]);
      if (typeof data?.total === 'number') setTotal(data.total);
      setText('');
    } catch {
      setError(t('Izoh yuborilmadi.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (commentId) => {
    // Tasdiq so'raladi: o'chirishni qaytarib bo'lmaydi (odam uchun;
    // serverda dalil arxivi qoladi, lekin u faqat moderator uchun).
    if (!window.confirm(t('Izoh o‘chirilsinmi?'))) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('del');
      const data = await res.json().catch(() => null);
      setList((prev) => (prev || []).filter((c) => c.id !== commentId));
      if (typeof data?.total === 'number') setTotal(data.total);
    } catch {
      setError(t('Izoh o‘chirilmadi.'));
    }
  };

  return (
    <div className="mt-3 border-t border-[color:var(--vz-line)] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-1.5 text-[14px] text-[color:var(--vz-ink-faint)] transition hover:text-[color:var(--vz-ink-dim)]"
      >
        <span aria-hidden="true">💬</span>
        <span>
          {total > 0
            ? `${t('Izohlar')} · ${total}`
            : t('Izoh yozish')}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          {/* KIRMAGAN ODAMGA MAYDON KO'RSATILMAYDI.
              Yozgandan keyin 401 olish — bekorga yozilgan matn. */}
          {user ? (
            <form onSubmit={submit} className="flex items-start gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder={t('Izohingiz…')}
                className="flex-1 resize-none rounded-xl border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] px-3 py-2 text-[15px] text-[color:var(--vz-ink)] outline-none focus:border-[color:var(--vz-accent)]"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="rounded-xl border border-[color:var(--vz-line)] px-3 py-2 text-[14px] text-[color:var(--vz-ink-dim)] transition disabled:opacity-40"
              >
                {busy ? '…' : t('Yuborish')}
              </button>
            </form>
          ) : (
            <p className="text-[14px] text-[color:var(--vz-ink-faint)]">
              {t('Izoh yozish uchun tizimga kiring.')}
            </p>
          )}

          {error && (
            <p className="mt-2 text-[14px] text-red-400">{error}</p>
          )}

          {list === null && (
            <p className="mt-3 text-[14px] text-[color:var(--vz-ink-faint)]">{t('Yuklanmoqda…')}</p>
          )}

          {list !== null && list.length === 0 && !error && (
            <p className="mt-3 text-[14px] text-[color:var(--vz-ink-faint)]">{t('Hali izoh yo‘q.')}</p>
          )}

          <ul className="mt-3 flex flex-col gap-3">
            {(list || []).map((c) => (
              <li key={c.id} className="flex items-start gap-2.5">
                {c.avatarUrl
                  ? <img src={c.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--vz-line)] text-[12px] text-[color:var(--vz-ink-dim)]">
                      {(c.name || c.code || '?').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    {c.code ? (
                      <a
                        href={`/${encodeURIComponent(c.code)}`}
                        className="truncate text-[14px] font-semibold text-[color:var(--vz-ink)] hover:underline"
                      >
                        {c.name || c.code}
                      </a>
                    ) : (
                      <span className="truncate text-[14px] font-semibold text-[color:var(--vz-ink)]">
                        {c.name || '—'}
                      </span>
                    )}
                    {/* O'Z izohingni o'chirish. Kontent EGASI ham
                        o'chira oladi, lekin buni ilova bilmaydi —
                        server tekshiradi va tugma faqat o'z
                        izohingda ko'rsatiladi. */}
                    {c.mine && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        className="ml-auto shrink-0 cursor-pointer text-[13px] text-[color:var(--vz-ink-faint)] hover:text-red-400"
                      >
                        {t('O‘chirish')}
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[color:var(--vz-ink-dim)]">
                    {c.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
