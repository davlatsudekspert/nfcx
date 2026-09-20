import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AnchoredMenu, { anchorTo } from './AnchoredMenu.jsx';
import { backdropProps } from '../lib/backdrop.js';
import { useLanguage } from '../lib/i18n.jsx';

// KONTENT MENYUSI ("⋯") — ommaviy profil sahifalarida.
//
// NIMA UCHUN SHIKOYAT KERAK: platformada foydalanuvchi joylagan
// kontent bor, lekin uni ko'rgan odam qo'lidan hech narsa kelmasdi
// va bizga u haqda xabar ham yetib kelmasdi. Profillar OCHIQ, ya'ni
// ularni ko'radiganlarning ko'pi ilovani umuman o'rnatmagan.
//
// NIMA UCHUN BAYROQ EMAS, MENYU: ilgari bu yerda bayroq belgisi
// turardi va u sahifada doim ko'rinib, saytni "shikoyat qilinadigan
// joy" qilib ko'rsatardi — egasi uni olib tashlashni so'radi.
//
// Shikoyatning O'ZI qoladi: Google Play foydalanuvchi kontenti
// bo'lgan ilovadan ilova ichida xabar berish yo'lini talab qiladi
// va ilova aynan shu sayt bilan bitta hisobga ishlaydi. Shuning
// uchun belgi emas, JOY o'zgardi — ilovadagi bilan bir xil
// (`report_sheet.dart` dagi `showContentMenu`).
//
// Kalitlar SERVERDAGI `REPORT_REASONS` bilan bir xil
// (hosting/api/moderation.js).
//
// YOZUVLAR QISQA — ATAYLAB. Ilgari bu yerda kontent qoidalarining
// to'liq jumlalari turardi va oyna butun ekranni egallagan qoidalar
// ro'yxatiga o'xshab qolgandi. Qoidalar matni O'Z JOYIDA bor: u
// rasm yoki video YUKLASHDAN OLDIN ko'rsatiladi
// (`ContentRulesGate`), ya'ni odam joylashdan avval o'qiydi. Bu
// yerda esa boshqa vazifa — allaqachon joylangan kontentni bir
// so'z bilan turkumlash.
const REASONS = [
  ['porn', 'Pornografiya'],
  ['religious', 'Diniy targ‘ibot'],
  ['political', 'Siyosat'],
  ['violence', 'Zo‘ravonlik'],
  ['insult', 'Haqorat'],
  ['spam', 'Spam'],
  ['illegal', 'Qonunga zid'],
  ['copyright', 'Mualliflik huquqi'],
  ['other', 'Boshqa'],
];

export default function ContentMenuButton({ targetKind, targetId, className = '' }) {
  const { t } = useLanguage();
  const [menu, setMenu] = useState(null);
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={t('Yana')}
        aria-label={t('Yana')}
        aria-haspopup="menu"
        aria-expanded={menu ? true : undefined}
        // Menyuni ochgan tugma "tashqari" hisoblanmaydi — aks holda
        // `mousedown` menyuni yopar, ketidan kelgan `click` qayta ochardi.
        data-anchored-anchor=""
        onClick={() => setMenu(menu ? null : anchorTo(btnRef.current, { width: 200, height: 64 }))}
        className={className}
      >
        {/* Uchta nuqta. Bitta band uchun menyu ortiqchadek
            tuyulishi mumkin, lekin gap ko'rinishda: shikoyat
            sahifada o'zini ko'rsatib turmasligi kerak. */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      <AnchoredMenu at={menu} onClose={closeMenu}>
        <button
          type="button"
          role="menuitem"
          onClick={() => { setMenu(null); setOpen(true); }}
          className="flex min-h-11 w-full items-center whitespace-nowrap rounded-[10px] px-3 text-left text-[14px] font-semibold hover:bg-white/5"
          style={{ color: 'inherit' }}
        >
          {t('Shikoyat qilish')}
        </button>
      </AnchoredMenu>

      {open && <ReportModal targetKind={targetKind} targetId={targetId} onClose={() => setOpen(false)} />}
    </>
  );
}

// Shikoyat oynasi — `ProfileMoreMenu` ham shu AYNAN oynani ochadi.
// Nusxa ko'chirilmaydi: shikoyat mantig'i (sabablar, yuborish,
// cheklovlar) bitta joyda qolishi kerak.
export function ReportModal({ targetKind, targetId, onClose }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!reason) { setErr(t('Avval sababni tanlang.')); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ targetKind, targetId, reason, ownerCode: targetId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error === 'too_many_requests'
          ? t('Juda ko‘p shikoyat yubordingiz. Ertaga qayta urining.')
          : t('Yuborib bo‘lmadi. Birozdan keyin qayta urining.'));
      }
      setSent(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal((
    <div className="co-modal-back" {...backdropProps(onClose)}>
      <div className="co-modal" role="dialog" aria-modal="true">
        {sent ? (
          <>
            <h3>{t('Shikoyat yuborildi')}</h3>
            <p className="cr-warn">{t('Moderator tekshiradi. Rahmat.')}</p>
            <button type="button" className="co-modal-cta" onClick={onClose}>{t('Yopish')}</button>
          </>
        ) : (
          <>
            <h3>{t('Shikoyat qilish')}</h3>
            <p className="cr-warn">
              {t('Sabab tanlang. Shikoyat moderatorga yuboriladi va kontent tekshiriladi.')}
            </p>
            {/* Qator emas, CHIPLAR: to'qqizta sabab butun kenglikdagi
                qatorlarda turganda oyna surilishi kerak bo'lardi. */}
            <div className="mt-3 flex flex-wrap gap-2">
              {REASONS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setReason(key); setErr(''); }}
                  aria-pressed={reason === key}
                  className={`min-h-11 rounded-xl border px-4 py-2 text-[13px] transition ${
                    reason === key
                      ? 'border-[color:var(--vz-gold)] bg-[color:var(--vz-gold)]/12 font-bold text-[color:var(--accent-text)]'
                      : 'border-white/12 text-base-content/80 hover:border-white/30'
                  }`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            {err && <p className="mt-2 text-[13px] text-[color:var(--vz-danger,#e5484d)]">{err}</p>}
            <button type="button" className="co-modal-cta" disabled={busy} onClick={send}>
              {busy ? t('Yuborilmoqda…') : t('Shikoyatni yuborish')}
            </button>
            <button type="button" className="cn-close" onClick={onClose}>{t('Bekor qilish')}</button>
          </>
        )}
      </div>
    </div>
  ), document.body);
}
