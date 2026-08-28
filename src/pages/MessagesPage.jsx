import { useEffect, useRef, useState } from 'react';
import { dbListConversations, dbListMessages, dbSendMessage, dbUploadImage } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { timeAgo } from '../lib/format.js';
import { IconSearch, IconPhone, IconArrowLeft } from '../components/Icons.jsx';

// DIQQAT: loyiha Supabase emas (Railway PostgreSQL + Express), shuning
// uchun "Supabase Realtime" ishlatilmaydi. Bu yerda 3 soniyalik POLLING
// orqali "real-time"ga yaqin tajriba beriladi.
//
// MOBIL UX: Instagram DM uslubida — mobil ekranda BIR VAQTNING O'ZIDA
// faqat bittasi ko'rinadi: yo suhbatlar ro'yxati, yo ochiq suhbat (orqaga
// tugmasi bilan). Ikkalasi hech qachon bir-birining ustiga cho'zilib,
// scroll qilishga majburlamaydi. Desktopda (sm+) klassik ikki ustunli.

const IMAGE_URL_RE = /\/uploads\/[\w-]+\.(png|jpe?g|webp|gif)$/i;

function isRecentlyActive(lastAt) {
  if (!lastAt) return false;
  return Date.now() - new Date(lastAt).getTime() < 5 * 60_000;
}

function Avatar({ label, active, size = 'h-11 w-11 text-sm' }) {
  return (
    <div className="relative shrink-0">
      <div className={`flex ${size} items-center justify-center rounded-full bg-gradient-to-br from-accent/70 to-accent/30 font-bold text-black`}>
        {(label || '?')[0].toUpperCase()}
      </div>
      {active && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-base-300 bg-green-400"></span>
      )}
    </div>
  );
}

function ConversationList({ conversations, activeId, q, onSelect }) {
  const query = q.trim().toLowerCase();
  const filtered = conversations.filter((c) =>
    !query || (c.otherEmail || '').toLowerCase().includes(query) || (c.lastMessage || '').toLowerCase().includes(query));

  if (filtered.length === 0) {
    return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-base-content/45">Hozircha suhbat topilmadi.</div>;
  }
  return (
    <div className="divide-y divide-white/5">
      {filtered.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/[0.06] active:bg-accent/[0.1] ${activeId === c.id ? 'bg-accent/10' : ''}`}
        >
          <Avatar label={c.otherEmail} active={isRecentlyActive(c.lastAt)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{c.otherEmail}</span>
              {c.lastAt && <span className="shrink-0 text-[11px] text-base-content/40">{timeAgo(new Date(c.lastAt).getTime())}</span>}
            </div>
            <div className="truncate text-xs text-base-content/50">{c.lastMessage || 'Xabar yo\u2019q'}</div>
          </div>
          {c.unreadCount > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-black">{c.unreadCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ m, mine }) {
  const isImage = IMAGE_URL_RE.test(m.body.trim());
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[75%] ${mine ? 'bg-gradient-to-br from-accent to-[#b3860f] text-black' : 'bg-base-300'}`}>
        {isImage ? (
          <a href={m.body} target="_blank" rel="noopener noreferrer">
            <img src={m.body} alt="rasm" className="max-h-56 rounded-lg object-cover" />
          </a>
        ) : (
          <span className="whitespace-pre-wrap break-words">{m.body}</span>
        )}
        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-black/60' : 'opacity-60'}`}>
          {timeAgo(new Date(m.createdAt).getTime())}
          {mine && (
            m.isRead ? (
              <svg width="15" height="11" viewBox="0 0 16 11" fill="none" aria-label="O'qilgan">
                <path d="M1 5.5L4.5 9L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.5 5.5L9 9L15.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="12" height="11" viewBox="0 0 13 11" fill="none" className="opacity-70" aria-label="Yuborildi">
                <path d="M1 5.5L4.5 9L11.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Thread({ conversation, myUserId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const data = await dbListMessages(conversation.id);
      setMessages(data.messages);
    } catch { /* jim tur */ }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 3000);
    return () => clearInterval(pollRef.current);
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const sendText = async (text) => {
    if (!text) return;
    try {
      const msg = await dbSendMessage(conversation.id, text);
      setMessages((m) => [...m, msg]);
    } catch {
      setBody(text);
    }
  };

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setBody('');
    await sendText(text);
    setSending(false);
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Fayl o\u2019qilmadi.'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const url = await dbUploadImage(dataUrl);
      await sendText(url);
    } catch { /* jim tur */ } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-3 sm:gap-3 sm:px-5">
        {onBack && (
          <button className="btn btn-ghost btn-circle btn-sm shrink-0 sm:hidden" onClick={onBack} aria-label="Orqaga">
            <IconArrowLeft width={18} height={18} />
          </button>
        )}
        <Avatar label={conversation.otherEmail} active={isRecentlyActive(conversation.lastAt)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{conversation.otherEmail}</div>
          <div className="text-[11px] text-base-content/45">{isRecentlyActive(conversation.lastAt) ? 'Onlayn' : 'Oxirgi faollik: ' + (conversation.lastAt ? timeAgo(new Date(conversation.lastAt).getTime()) : '\u2014')}</div>
        </div>
        <button className="btn btn-ghost btn-circle btn-sm hidden text-base-content/50 sm:inline-flex"><IconSearch width={16} height={16} /></button>
        <button className="btn btn-ghost btn-circle btn-sm text-base-content/50"><IconPhone width={16} height={16} /></button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-base-content/40">Xabar yo'q — birinchi bo'lib yozing.</div>
        )}
        {messages.map((m) => <MessageBubble key={m.id} m={m} mine={m.senderId === myUserId} />)}
        <div ref={bottomRef}></div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 p-2.5 sm:p-3" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        <button className="btn btn-ghost btn-circle btn-sm shrink-0 text-base-content/50" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <span className="loading loading-spinner loading-xs"></span> : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95L10.13 17.12a2 2 0 01-2.83-2.83l8.49-8.49" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Xabar yozing..."
          className="input input-bordered input-sm flex-1 bg-base-100"
        />
        <button className="btn btn-circle btn-sm shrink-0 border-none bg-gradient-to-br from-accent to-[#b3860f] text-black" onClick={send} disabled={sending || !body.trim()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
        </button>
      </div>
    </div>
  );
}

export default function MessagesPage({ id }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState(null);
  const [q, setQ] = useState('');
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
    return <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pt-16 text-center text-base-content/45">Yuklanmoqda...</main>;
  }

  const active = conversations?.find((c) => c.id === activeId) || null;
  // Mobilda: suhbat tanlanganida FAQAT thread ko'rinadi (ro'yxat butunlay
  // yashiriladi) — Instagram DM'dagidek, "orqaga" tugmasi bilan qaytiladi.
  const showThreadOnMobile = !!active;

  return (
    <main className="mx-auto w-full max-w-[1800px] px-0 pb-16 sm:px-10 lg:px-14">
      <div
        className="mt-0 overflow-hidden border-white/10 bg-base-200/40 sm:mt-6 sm:grid sm:grid-cols-[300px_1fr] sm:rounded-2xl sm:border sm:shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
        style={{ height: 'calc(100dvh - 64px)' }}
      >
        {/* Suhbatlar ro'yxati — mobilda thread ochiq bo'lsa yashiriladi */}
        <div className={`flex min-h-0 flex-col border-white/10 sm:border-r ${showThreadOnMobile ? 'hidden sm:flex' : 'flex'}`} style={{ height: 'calc(100dvh - 64px)' }}>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 p-4">
            <h1 className="text-lg font-bold">Xabarlar</h1>
          </div>
          <div className="shrink-0 border-b border-white/10 p-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <IconSearch width={14} height={14} className="shrink-0 text-base-content/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Suhbat yoki foydalanuvchi qidirish..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-base-content/35"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations === null
              ? <div className="p-6 text-center text-sm text-base-content/45">Yuklanmoqda...</div>
              : <ConversationList conversations={conversations} activeId={activeId} q={q} onSelect={(cid) => navigate('/xabarlar/' + cid)} />}
          </div>
        </div>

        {/* Ochiq suhbat — mobilda faqat shu ko'rinadi (butun ekranni egallaydi) */}
        <div className={`min-h-0 ${showThreadOnMobile ? 'block' : 'hidden sm:block'}`} style={{ height: 'calc(100dvh - 64px)' }}>
          {active
            ? <Thread key={active.id} conversation={active} myUserId={user.id} onBack={() => navigate('/xabarlar')} />
            : <div className="flex h-full items-center justify-center text-sm text-base-content/40">Suhbat tanlang</div>}
        </div>
      </div>

    </main>
  );
}
