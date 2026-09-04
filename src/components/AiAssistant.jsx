import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';

// O'ng past burchakdagi AI yordamchi. Server ANTHROPIC_API_KEY bilan
// sozlanmagan bo'lsa — vidjet ko'rinmaydi.
export default function AiAssistant() {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]); // { role, content }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    fetch('/api/assistant/status')
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open, busy]);

  if (!enabled) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = res.ok && data.reply
        ? data.reply
        : t('Kechirasiz, hozir javob bera olmayapman. Birozdan so‘ng urinib ko‘ring yoki @nfcstore_admin ga yozing.');
      setMsgs((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: t('Kechirasiz, hozir javob bera olmayapman. Birozdan so‘ng urinib ko‘ring yoki @nfcstore_admin ga yozing.') }]);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t('AI yordamchi')}
          className="fixed bottom-4 right-4 z-[120] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-accent-content shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition hover:brightness-110"
        >
          {'\u{1F4AC}'}
        </button>
      )}

      {open && (
        <div className="fixed bottom-0 right-0 z-[120] flex h-[70vh] max-h-[560px] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-base-200 shadow-2xl sm:bottom-4 sm:right-4 sm:h-[520px] sm:w-[380px] sm:rounded-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-base-300/60 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="text-lg">{'\u{1F4AC}'}</span> {t('AI yordamchi')}
            </div>
            <button onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-base-content/60 hover:text-base-content">✕</button>
          </div>

          <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {msgs.length === 0 && (
              <div className="rounded-xl bg-base-100/60 px-3 py-2.5 text-[16px] leading-relaxed text-base-content/70">
                {t('Salom! Men NFCSTORE yordamchisiman. Profil yaratish, NFC karta, narxlar yoki sozlamalar bo‘yicha savol bering.')}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[16px] leading-relaxed ${
                  m.role === 'user' ? 'bg-accent text-accent-content' : 'bg-base-100 text-base-content/85'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-base-100 px-3 py-2 text-[16px] text-base-content/50">
                  <span className="loading loading-dots loading-sm"></span>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-end gap-2 border-t border-white/10 p-2.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder={t('Savolingizni yozing...')}
              className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-white/10 bg-base-100 px-3 py-2 text-[16px] outline-none focus:border-accent/50"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-content disabled:opacity-40"
            >
              {'↑'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
