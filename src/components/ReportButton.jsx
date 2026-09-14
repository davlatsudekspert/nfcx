import { useState } from 'react';
import { createPortal } from 'react-dom';
import { backdropProps } from '../lib/backdrop.js';
import { useLanguage } from '../lib/i18n.jsx';

// SHIKOYAT TUGMASI — ommaviy profil sahifalarida.
//
// NIMA UCHUN KERAK: platformada foydalanuvchi joylagan kontent bor,
// lekin uni ko'rgan odam qo'lidan hech narsa kelmasdi va bizga u
// haqda xabar ham yetib kelmasdi.
//
// Ilovada bu allaqachon bor (`report_sheet.dart`) — saytda ham
// bo'lishi shart: profillar OCHIQ, ya'ni ularni ko'radiganlarning
// ko'pi ilovani umuman o'rnatmagan.
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

export default function ReportButton({ targetKind, targetId, className = '' }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        title={t('Shikoyat qilish')}
        aria-label={t('Shikoyat qilish')}
        onClick={() => setOpen(true)}
        className={className}
      >
        {/* Bayroq — shikoyat belgisi. Qo'ng'iroq BILDIRISHNOMA deb
            o'qilardi. */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5.5 21V4" />
          <path d="M5.5 4.6c4-2 8 2 13 0v8.6c-5 2-9-2-13 0z" />
        </svg>
      </button>
      {open && <ReportModal targetKind={targetKind} targetId={targetId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportModal({ targetKind, targetId, onClose }) {
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
                      ? 'border-[color:var(--vz-gold)] bg-[color:var(--vz-gold)]/12 font-bold text-[color:var(--vz-gold-2)]'
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
