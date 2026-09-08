import { useEffect, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import CloseButton from './CloseButton.jsx';

// Taklif berishdan OLDINGI ikki bosqichli oyna.
//
// 1-bosqich — AUKSION QOIDALARI. Qoidalarning 15-bandi: "Qoidalarni
//    tasdiqlamasdan narx taklif qilish imkoniyati berilmaydi". Belgi
//    qo'yilmaguncha tugma ochilmaydi.
// 2-bosqich — TAKLIFNI TASDIQLASH. Qoidalarning 4-bandi taklif alohida
//    tasdiqlanishini talab qiladi: "Siz ___ so'm miqdorida narx taklif
//    qilmoqdasiz. Taklifni tasdiqlaysizmi?"
//
// Rozilik BRAUZERDA saqlanadi (foydalanuvchi bo'yicha), shuning uchun
// har bir taklifda qoidalar qaytadan chiqavermaydi — faqat tasdiqlash
// oynasi chiqadi. Saqlash ishlamasa (yashirin oyna, xotira o'chirilgan)
// qoidalar qayta ko'rsatiladi: bu XAVFSIZ TOMON — rozilik hech qachon
// "bor" deb noto'g'ri taxmin qilinmaydi.
//
// TO'LOV TIZIMI ATAYLAB NOMLANMAGAN ("mavjud rasmiy to'lov usullaridan
// biri"): Click yoki boshqa tizim qo'shilganda bu matn o'zgarmaydi.

const ACCEPT_KEY = 'nfcx:auction-rules-accepted';

// Qoidalar versiyasi. Matn jiddiy o'zgarsa shu raqam oshiriladi va
// hamma foydalanuvchi yangi matnni qaytadan tasdiqlaydi.
export const AUCTION_RULES_VERSION = 1;

function acceptKeyFor(userId) {
  return `${ACCEPT_KEY}:${AUCTION_RULES_VERSION}:${userId || 'anon'}`;
}

export function hasAcceptedAuctionRules(userId) {
  try { return localStorage.getItem(acceptKeyFor(userId)) === '1'; } catch { return false; }
}

function rememberAcceptance(userId) {
  try { localStorage.setItem(acceptKeyFor(userId), '1'); } catch { /* saqlanmasa qoidalar qayta chiqadi */ }
}

const POINTS = [
  "G'olib tasodifiy tanlanmaydi.",
  "Eng yuqori amaldagi narx taklif qilgan ishtirokchi g'olib bo'ladi.",
  'Har bir yangi taklif belgilangan minimal qadamga mos bo’lishi kerak.',
  'Tasdiqlangan taklif auksion tarixida qayd etiladi.',
  "G'olib belgilangan muddatda NFCSTORE'da mavjud rasmiy to'lov usullaridan biri orqali to'lovni amalga oshirishi kerak.",
  "To'lov tasdiqlangach NFC ID g'olib akkauntiga biriktiriladi.",
  "Soxta takliflar, botlar va narxni sun'iy oshirish taqiqlanadi.",
  'Auksionda qatnashish orqali NFCSTORE Auksion qoidalariga rozilik bildirasiz.',
];

export default function AuctionBidGate({ open, amount, userId, busy, onCancel, onConfirm }) {
  const { t } = useLanguage();
  // Qoidalar allaqachon tasdiqlangan bo'lsa — to'g'ridan-to'g'ri tasdiqlash bosqichi.
  const [stage, setStage] = useState('rules');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChecked(false);
    setStage(hasAcceptedAuctionRules(userId) ? 'confirm' : 'rules');
  }, [open, userId]);

  // Escape bilan yopish — modal oynada kutiladigan xatti-harakat.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const acceptRules = () => {
    if (!checked) return;
    rememberAcceptance(userId);
    setStage('confirm');
  };

  const openRules = (e) => { e.preventDefault(); onCancel(); navigate('/auksion-qoidalari'); };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="flex min-h-full items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
        <div className="vz-card relative my-8 w-full max-w-lg p-6" role="dialog" aria-modal="true" aria-label={t('Auksion qoidalarini tasdiqlang')}>
          <CloseButton onClick={onCancel} className="absolute right-3 top-3 z-10" />

          {stage === 'rules' ? (
            <>
              <span className="vz-kicker">{t('Auksion')}</span>
              <h3 className="font-display mt-1 text-2xl font-semibold">{t('Auksion qoidalarini tasdiqlang')}</h3>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--vz-ink-2)' }}>
                {t('Siz NFCSTORE tomonidan savdoga chiqarilgan NFC ID uchun narx taklif qilmoqdasiz.')}
              </p>
              <ul className="mt-4 space-y-2 pl-5 text-sm leading-relaxed" style={{ color: 'var(--vz-ink-2)', listStyle: 'disc' }}>
                {POINTS.map((p) => <li key={p}>{t(p)}</li>)}
              </ul>

              <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm mt-0.5"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                <span>{t("Auksion qoidalarini o'qidim va roziman")}</span>
              </label>

              <button
                type="button"
                className="btn btn-gold mt-4 min-h-11 w-full"
                onClick={acceptRules}
                disabled={!checked}
                aria-disabled={!checked}
              >
                {t('Auksionda qatnashish')}
              </button>
              <a
                href="/auksion-qoidalari"
                onClick={openRules}
                className="vz-tap mt-3 block text-center text-sm font-semibold underline-offset-4 hover:underline"
                style={{ color: 'var(--vz-gold)' }}
              >
                {t("To'liq qoidalarni ko'rish")}
              </a>
            </>
          ) : (
            <>
              <span className="vz-kicker">{t('Tasdiqlash')}</span>
              <h3 className="font-display mt-1 text-2xl font-semibold">{t('Taklifni tasdiqlaysizmi?')}</h3>
              {/* Qoidalarning 4-bandidagi ogohlantirish — summa aniq ko'rsatiladi. */}
              <p className="mt-3 text-[15px] leading-relaxed">
                {t("Siz {n} so'm miqdorida narx taklif qilmoqdasiz.", { n: fmt(amount) })}
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--vz-ink-2)' }}>
                {t("Tasdiqlangan taklif auksion tarixida qayd etiladi. G'olib bo'lsangiz, belgilangan muddat ichida mavjud rasmiy to'lov usullaridan biri orqali to'lashingiz kerak.")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className="btn btn-gold min-h-11 flex-1" onClick={onConfirm} disabled={busy}>
                  {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Tasdiqlayman')}
                </button>
                <button type="button" className="btn btn-ghost-vz min-h-11" onClick={onCancel} disabled={busy}>
                  {t('Bekor qilish')}
                </button>
              </div>
              <a
                href="/auksion-qoidalari"
                onClick={openRules}
                className="vz-tap mt-3 block text-center text-xs font-semibold underline-offset-4 hover:underline"
                style={{ color: 'var(--vz-ink-2)' }}
              >
                {t("To'liq qoidalarni ko'rish")}
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
