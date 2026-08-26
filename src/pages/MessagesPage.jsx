import { useEffect, useRef, useState } from 'react';
import { dbListConversations, dbListMessages, dbSendMessage, dbUploadImage } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { timeAgo } from '../lib/format.js';
import { IconSend, IconPaperclip, IconEmoji } from '../components/Icons.jsx';

// DIQQAT: loyiha Supabase emas (Railway PostgreSQL + Express), shuning
// uchun "Supabase Realtime" ishlatilmaydi. Bu yerda 3 soniyalik POLLING
// orqali "real-time"ga yaqin tajriba beriladi — sahifa qayta yuklanmaydi,
// yangi xabarlar avtomatik paydo bo'ladi. Agar to'liq WebSocket push kerak
// bo'lsa, buni keyinroq `ws` kutubxonasi bilan almashtirish mumkin.

// Bir xabar matni "/uploads/..." bilan boshlanadigan rasm manziligina
// bo'lsa — xabar pufakchasi matn o'rniga rasm ko'rsatadi (skrepka orqali
// yuborilgan rasmlar shu tarzda aniqlanadi).
function isImageBody(body) {
  return typeof body === 'string' && /^\/uploads\/.+\.(png|jpe?g|gif|webp)$/i.test(body.trim());
}

const QUICK_EMOJIS = ['😀', '😂', '😍', '👍', '🙏', '🔥', '🎉', '❤️', '😅', '🤝', '👏', '😎', '🤔', '😢', '💯', '✅'];

function EmojiPopover({ onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 z-10 mb-2 grid w-[216px] grid-cols-6 gap-1 rounded-2xl border border-[rgba(201,162,39,0.25)] bg-base-200/95 p-2.5 shadow-[0_18px_44px_rgba(0,0,0,0.55)] backdrop-blur-xl"
    >
      {QUICK_EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className="cursor-pointer rounded-lg py-1 text-lg transition-colors hover:bg-white/10"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function ConversationList({ conversations, activeId, onSelect }) {
  if (conversations.length === 0) {
    return <div className="p-6 text-center text-sm text-base-content/45">Hozircha suhbatlaringiz yo'q.</div>;
  }
  return (
    <div className="divide-y divide-white/[0.06]">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.05] ${activeId === c.id ? 'bg-gradient-to-r from-[rgba(201,162,39,0.10)] to-transparent' : ''}`}
        >
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-base-300 to-base-100 text-sm font-bold text-base-content shadow-[0_0_0_1.5px_rgba(201,162,39,0.35),0_4px_10px_rgba(0,0,0,0.35)]">
              {(c.otherEmail || '?')[0].toUpperCase()}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{c.otherEmail}</span>
              {c.lastAt && <span className="shrink-0 text-[11px] text-base-content/40">{timeAgo(new Date(c.lastAt).getTime())}</span>}
            </div>
            <div className="truncate text-xs text-base-content/50">{isImageBody(c.lastMessage) ? '📷 Rasm' : (c.lastMessage || 'Xabar yo’q')}</div>
          </div>
          {c.unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-gradient-to-br from-[#f0d9a0] to-[#c9a227] px-1.5 py-0.5 text-[10px] font-bold text-[#1a1408] shadow-[0_2px_8px_rgba(201,162,39,0.4)]">
              {c.unreadCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function ReadTicks({ isRead }) {
  return isRead ? (
    // O'qilgan — ikkita qalin ptichka (WhatsApp uslubida).
    <svg width="15" height="11" viewBox="0 0 16 11" fill="none" aria-label="O'qilgan" className="shrink-0">
      <path d="M1 5.5L4.5 9L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 5.5L9 9L15.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    // Yuborildi, lekin hali o'qilmagan — bitta ptichka, xiraroq.
    <svg width="12" height="11" viewBox="0 0 13 11" fill="none" className="shrink-0 opacity-60" aria-label="Yuborildi">
      <path d="M1 5.5L4.5 9L11.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Thread({ conversationId, myUserId }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  const load = async () => {
    try {
      const data = await dbListMessages(conversationId);
      setMessages(data.messages);
    } catch { /* jim tur */ }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 3000);
    return () => clearInterval(pollRef.current);
  }, [conversationId]);

  useEffect(() => {
    // block: 'nearest' — faqat ichki xabarlar ro'yxatini pastga suradi;
    // standart 'start' esa elementni ekranning yuqorisiga tekislashga
    // urinib, kerak bo'lsa butun sahifani (window'ni) ham pastga surib
    // yuborardi (xabar yuborilgach ekran "sakrab" tushib qolish bugi).
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const send = async (text) => {
    const clean = (text ?? body).trim();
    if (!clean) return;
    setSending(true);
    setBody('');
    try {
      const msg = await dbSendMessage(conversationId, clean);
      setMessages((m) => [...m, msg]);
    } catch {
      setBody(clean); // xatolik bo'lsa matnni qaytaramiz
    } finally {
      setSending(false);
    }
  };

  const onPickEmoji = (e) => {
    setBody((b) => b + e);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const onPickFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploadErr('');
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const url = await dbUploadImage(dataUrl);
      await send(url);
    } catch (err) {
      setUploadErr(err.message || 'Rasmni yuborib bo’lmadi.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(600px_320px_at_100%_0%,rgba(201,162,39,0.05),transparent_60%)]">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {messages.map((m) => {
          const mine = m.senderId === myUserId;
          const img = isImageBody(m.body);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={
                  img
                    ? `max-w-[70%] overflow-hidden rounded-2xl p-1 ${mine ? 'rounded-br-md bg-gradient-to-br from-[#f0d9a0] to-[#c9a227] shadow-[0_4px_16px_rgba(201,162,39,0.28)]' : 'rounded-bl-md border border-white/10 bg-white/[0.04] shadow-[0_2px_10px_rgba(0,0,0,0.3)]'}`
                    : `max-w-[75%] px-3.5 py-2 text-sm ${
                        mine
                          ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-[#f0d9a0] to-[#c9a227] text-[#1a1408] shadow-[0_4px_16px_rgba(201,162,39,0.28)]'
                          : 'rounded-2xl rounded-bl-md border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] text-base-content shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                      }`
                }
              >
                {img ? (
                  <img src={m.body} alt="" className="block max-h-[280px] w-full rounded-xl object-cover" />
                ) : (
                  m.body
                )}
                <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-[#1a1408]/60' : 'text-base-content/40'} ${img ? 'px-1.5 pb-0.5 pt-1' : ''}`}>
                  {timeAgo(new Date(m.createdAt).getTime())}
                  {mine && <ReadTicks isRead={m.isRead} />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}></div>
      </div>

      {uploadErr && <div className="px-4 pb-1 text-xs text-error">{uploadErr}</div>}

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-[20px] border border-[rgba(201,162,39,0.22)] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-1.5 pl-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-shadow focus-within:border-[rgba(212,175,90,0.6)] focus-within:shadow-[0_0_0_3px_rgba(201,162,39,0.18)]">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          <button
            type="button"
            aria-label="Rasm biriktirish"
            onClick={() => fileRef.current && fileRef.current.click()}
            disabled={uploading}
            className="btn btn-circle btn-ghost btn-sm shrink-0 text-base-content/55 hover:text-[#e8c165]"
          >
            {uploading ? <span className="loading loading-spinner loading-xs"></span> : <IconPaperclip />}
          </button>

          <input
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Xabar yozing..."
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-base-content/35"
          />

          <div className="relative shrink-0">
            {showEmoji && <EmojiPopover onPick={onPickEmoji} onClose={() => setShowEmoji(false)} />}
            <button
              type="button"
              aria-label="Emoji"
              onClick={() => setShowEmoji((s) => !s)}
              className={`btn btn-circle btn-ghost btn-sm text-base-content/55 hover:text-[#e8c165] ${showEmoji ? 'text-[#e8c165]' : ''}`}
            >
              <IconEmoji />
            </button>
          </div>

          <button
            aria-label="Yuborish"
            onClick={() => send()}
            disabled={sending || !body.trim()}
            className="btn btn-circle btn-sm shrink-0 border-none bg-gradient-to-br from-[#e8c165] to-[#b3860f] text-[#17130a] shadow-[0_6px_18px_rgba(180,140,20,0.4)] hover:brightness-110 disabled:opacity-30 disabled:shadow-none"
          >
            <IconSend />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage({ id }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState(null);
  const activeId = id ? Number(id) : null;

  const loadConversations = () => dbListConversations().then((d) => setConversations(d.conversations));

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
    const t = setInterval(loadConversations, 5000);
    return () => clearInterval(t);
  }, [user]);

  if (user === undefined || user === null) {
    return <main className="mx-auto max-w-6xl px-5 pt-16 text-center text-base-content/45">Yuklanmoqda...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-5 pb-16">
      <h1 className="pt-10 text-2xl font-bold">Xabarlar</h1>
      <div className="mt-6 grid overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[0_30px_70px_rgba(0,0,0,0.45)] backdrop-blur-md sm:grid-cols-[280px_1fr]" style={{ height: '65vh' }}>
        <div className="min-h-0 overflow-y-auto border-r border-white/10 bg-white/[0.015] backdrop-blur-md">
          {conversations === null
            ? <div className="p-6 text-center text-sm text-base-content/45">Yuklanmoqda...</div>
            : <ConversationList conversations={conversations} activeId={activeId} onSelect={(cid) => navigate('/xabarlar/' + cid)} />}
        </div>
        {/* min-h-0 shart: grid/flex elementlarining standart min-height'i
           "auto" (ya'ni ichidagi kontent balandligi) bo'ladi, shu sababli
           bu panel xabarlar ko'p bo'lganda 65vh'dan tashqariga cho'zilib,
           butun sahifani birga scroll qilib yuborar edi. min-h-0 shu
           avtomatik minimal balandlikni bekor qiladi — endi faqat Thread
           ichidagi xabarlar ro'yxati o'z ichida scroll bo'ladi. */}
        <div className="hidden min-h-0 sm:block">
          {activeId
            ? <Thread key={activeId} conversationId={activeId} myUserId={user.id} />
            : <div className="flex h-full items-center justify-center text-sm text-base-content/40">Suhbat tanlang</div>}
        </div>
      </div>
      {activeId && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md sm:hidden" style={{ height: '65vh' }}>
          <Thread key={activeId} conversationId={activeId} myUserId={user.id} />
        </div>
      )}
    </main>
  );
}