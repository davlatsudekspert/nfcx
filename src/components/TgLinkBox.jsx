import { useEffect, useRef, useState } from 'react';
import { authTgLinkStart, authTgLinkStatus } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { IconTelegram, IconCheck } from './Icons.jsx';

// ═══════════════════════════════════════════════════════════════════════
// TELEGRAM BILAN BIR BOSISHDA TASDIQLASH (2026-09)
//
// NEGA BU YOZILDI. Avval tasdiqlash shunday edi: odam botga o'zi boradi,
// raqamini yozadi, biz unga 6 xonali kod yuboramiz va odam O'SHA KODNI
// SAYTGA KO'CHIRADI.
//
// Bu firibgarlik sxemasining AYNAN ko'rinishi. Odamlarga "Telegramga
// kelgan kodni hech kimga bermang" deb o'rgatilgan — va bu TO'G'RI
// o'rgatish, u odamlarni akkaunt o'g'irlanishidan saqlaydi. Biz esa
// xuddi shuni so'rayotgan edik. Natijada odamlar qo'rqib, ro'yxatdan
// o'tmay ketardi — aybi ularda emas, bizning oqimda edi.
//
// Endi yo'nalish TESKARI:
//   1. sayt bir martalik token oladi va botga havola beradi;
//   2. odam botda "Kontaktni ulashish" tugmasini bosadi — tamom;
//   3. sayt holatni so'rab turadi va o'zi davom etadi.
//
// Telegramdan saytga HECH QANDAY sir ko'chmaydi. Shuning uchun pastda
// "bizdan hech qachon kod so'ralmaydi" deb ochiq yozib qo'yilgan — bu
// endi va'da emas, oqimning o'zi shunday.
//
// Raqam ham FORMDAN emas, Telegramning o'zidan keladi: server uni
// tokendan oladi, ya'ni birov boshqa odamning raqamini yozib yubora
// olmaydi.
// ═══════════════════════════════════════════════════════════════════════

const POLL_MS = 2500;
const GIVE_UP_MS = 15 * 60 * 1000;   // serverdagi token muddati bilan bir xil

export default function TgLinkBox({ botUsername, onLinked, linkedPhone = '', title = '' }) {
  const { t } = useLanguage();
  const [state, setState] = useState('idle');   // idle | waiting | linked | expired | error
  const [err, setErr] = useState('');
  const timerRef = useRef(null);
  const stopRef = useRef(null);

  // Sahifadan chiqilganda so'rov halqasi to'xtaydi.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => { if (linkedPhone) setState('linked'); }, [linkedPhone]);

  const poll = (token, deadline) => {
    timerRef.current = setTimeout(async () => {
      if (stopRef.current !== token) return;
      try {
        const r = await authTgLinkStatus(token);
        if (stopRef.current !== token) return;
        if (r?.status === 'linked') { setState('linked'); onLinked(r.phone || '', token); return; }
        if (r?.status === 'expired' || Date.now() > deadline) { setState('expired'); return; }
      } catch { /* tarmoq uzildi — keyingi urinishda davom etadi */ }
      if (Date.now() > deadline) { setState('expired'); return; }
      poll(token, deadline);
    }, POLL_MS);
  };

  const start = async () => {
    setErr('');
    try {
      const r = await authTgLinkStart();
      if (!r?.url || !r?.token) throw new Error('bad_response');
      stopRef.current = r.token;
      setState('waiting');
      // Yangi oynada ochamiz — odam formadagi yozganlarini yo'qotmasin.
      window.open(r.url, '_blank', 'noopener,noreferrer');
      poll(r.token, Date.now() + GIVE_UP_MS);
    } catch (e) {
      setState('error');
      setErr(e?.message === 'bot_not_configured'
        ? t('Telegram bot hozir sozlanmagan. Birozdan so‘ng urinib ko‘ring.')
        : e?.message === 'too_many_requests'
          ? t('Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.')
          : t('Aloqa xatosi. Qayta urinib ko‘ring.'));
    }
  };

  if (state === 'linked') {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/10 p-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent">
          <IconCheck width={16} height={16} /> {t('Telegram tasdiqlandi')}
        </div>
        {linkedPhone && <div className="mt-1 font-mono text-sm text-base-content/70">{linkedPhone}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3.5">
      <div className="text-sm font-semibold text-base-content/85">{title || t('Telegram orqali tasdiqlash')}</div>

      <button type="button" onClick={start} disabled={state === 'waiting'}
        className="btn btn-gold mt-2.5 min-h-11 w-full">
        <IconTelegram width={16} height={16} />
        {state === 'waiting' ? t('Botda tugmani bosing…') : t('Telegramda tasdiqlash')}
      </button>

      {state === 'waiting' && (
        <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-base-content/65">
          <span className="loading loading-spinner loading-xs mt-0.5 shrink-0"></span>
          {t('Bot ochildi. U yerda «Kontaktni ulashish» tugmasini bosing — shu sahifa o‘zi davom etadi.')}
        </p>
      )}
      {state === 'expired' && (
        <p className="mt-2 text-xs leading-relaxed text-error">
          {t('Vaqt tugadi. Tugmani qayta bosing.')}
        </p>
      )}
      {state === 'error' && err && <p className="mt-2 text-xs leading-relaxed text-error">{err}</p>}

      {/* Eng muhim jumla. Odam aynan shundan qo'rqadi — javobini
          bosishdan OLDIN ko'rsin. */}
      <p className="mt-2.5 border-t border-white/10 pt-2.5 text-xs leading-relaxed text-base-content/55">
        🔒 <b>{t('Sizdan kod so‘ralmaydi.')}</b>{' '}
        {t('Botda bitta tugma bosasiz — saytga hech narsa ko‘chirmaysiz. Telegramga kelgan kodni hech kimga bermang.')}
      </p>
      {botUsername && (
        <p className="mt-1.5 text-xs text-base-content/40">
          {t('Botimiz:')} <span className="font-mono">@{botUsername}</span>
        </p>
      )}
    </div>
  );
}
