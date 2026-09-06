import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../lib/i18n.jsx';

// Qayta ishlatiluvchi tasdiqlash oynasi (window.confirm / prompt o'rniga).
// - `danger` — xavfli amal (qizil tugma).
// - `input` — { label, type, placeholder } berilsa matn/parol so'raladi;
//   bunda onConfirm(value) chaqiriladi va bo'sh qiymat qabul qilinmaydi
//   (`input.optional` bo'lmasa).
export default function ConfirmDialog({
  open, title, message, confirmLabel, cancelLabel, danger = false, busy = false,
  input = null, error = null, onConfirm, onCancel,
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState('');
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setValue('');
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const id = setTimeout(() => firstRef.current?.focus(), 30);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(id); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const needValue = input && !input.optional && !value.trim();

  const submit = (e) => {
    e?.preventDefault?.();
    if (busy || needValue) return;
    onConfirm?.(input ? value : true);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4" onClick={() => { if (!busy) onCancel?.(); }} role="presentation">
      <form
        role="dialog" aria-modal="true" aria-labelledby="vz-confirm-title"
        className="vz-card w-full max-w-md p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div id="vz-confirm-title" className="font-display text-lg font-semibold leading-snug break-words" style={{ color: 'var(--vz-ink)' }}>
          {title || t('Tasdiqlaysizmi?')}
        </div>
        {message && <p className="mt-2 text-sm leading-relaxed break-words" style={{ color: 'var(--vz-ink-2)' }}>{message}</p>}
        {input && (
          <label className="mt-4 block">
            {input.label && <span className="vz-label">{input.label}</span>}
            <input
              ref={firstRef}
              type={input.type || 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={input.placeholder || ''}
              autoComplete={input.type === 'password' ? 'current-password' : 'off'}
              className="vz-input"
            />
          </label>
        )}
        {error && <div className="vz-err mt-2">{error}</div>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost-vz min-h-11" disabled={busy} onClick={onCancel}>
            {cancelLabel || t('Bekor qilish')}
          </button>
          <button
            type="submit"
            ref={input ? null : firstRef}
            className={`btn min-h-11 ${danger ? 'btn-error rounded-full font-bold' : 'btn-gold'}`}
            disabled={busy || !!needValue}
          >
            {busy ? <span className="loading loading-spinner loading-xs"></span> : (confirmLabel || t('Tasdiqlash'))}
          </button>
        </div>
      </form>
    </div>
  );
}

// Hook: `const { confirm, dialog } = useConfirm();` — `{dialog}` ni JSX ga
// qo'ying, keyin `if (!(await confirm({ title, message, danger }))) return;`.
// `input` berilsa Promise matn (yoki bekor bo'lsa null) bilan yakunlanadi.
export function useConfirm() {
  const [state, setState] = useState(null); // { opts, resolve }

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setState({ opts: opts || {}, resolve });
  }), []);

  const close = (result) => {
    setState((s) => { s?.resolve(result); return null; });
  };

  const dialog = state ? (
    <ConfirmDialog
      open
      {...state.opts}
      onConfirm={(v) => close(state.opts.input ? v : true)}
      onCancel={() => close(state.opts.input ? null : false)}
    />
  ) : null;

  return { confirm, dialog };
}
