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
// Sabablar ro'yxati SERVERDAGI `REPORT_REASONS` bilan bir xil
// (hosting/api/moderation.js) va saytdagi kontent qoidalari matni
// bilan bir xil narsalarni nomlaydi: odam qoidada o'qigan narsani
// shikoyatda ham topishi kerak.
const REASONS = [
  ['porn', 'Pornografik yoki jinsiy xarakterdagi'],
  ['religious', 'Diniy targ‘ibot yoki ekstremistik mazmun'],
  ['political', 'Siyosiy targ‘ibot'],
  ['violence', 'Zo‘ravonlik yoki shafqatsizlik'],
  ['insult', 'Haqorat, so‘kinish, kamsitish'],
  ['spam', 'Spam yoki aldov'],
  ['illegal', 'Qonunga zid boshqa material'],
  ['copyright', 'Mualliflik huquqi buzilgan'],
  ['other', 'Boshqa sabab'],
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
            <div className="mt-2 max-h-[46vh] overflow-y-auto">
              {REASONS.map(([key, label]) => (
                <label key={key} className="cr-check">
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === key}
                    onChange={() => { setReason(key); setErr(''); }}
                  />
                  <span>{t(label)}</span>
                </label>
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
