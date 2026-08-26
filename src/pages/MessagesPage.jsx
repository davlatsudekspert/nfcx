import { useEffect, useRef, useState } from 'react';
import { dbListConversations, dbListMessages, dbSendMessage } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { timeAgo } from '../lib/format.js';

// DIQQAT: loyiha Supabase emas (Railway PostgreSQL + Express), shuning
// uchun "Supabase Realtime" ishlatilmaydi. Bu yerda 3 soniyalik POLLING
// orqali "real-time"ga yaqin tajriba beriladi — sahifa qayta yuklanmaydi,
// yangi xabarlar avtomatik paydo bo'ladi. Agar to'liq WebSocket push kerak
// bo'lsa, buni keyinroq `ws` kutubxonasi bilan almashtirish mumkin.

function ConversationList({ conversations, activeId, onSelect }) {
  if (conversations.length === 0) {
    return <div className="p-6 text-center text-sm text-base-content/45">Hozircha suhbatlaringiz yo'q.</div>;
  }
  return (
    <div className="divide-y divide-white/10">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${activeId === c.id ? 'bg-white/5' : ''}`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base-300 text-sm font-bold">
            {(c.otherEmail || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{c.otherEmail}</span>
              {c.lastAt && <span className="shrink-0 text-[11px] text-base-content/40">{timeAgo(new Date(c.lastAt).getTime())}</span>}
            </div>
            <div className="truncate text-xs text-base-content/50">{c.lastMessage || 'Xabar yo\u2019q'}</div>
          </div>
          {c.unreadCount > 0 && (
            <span className="badge badge-accent badge-sm shrink-0">{c.unreadCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function Thread({ conversationId, myUserId }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setBody('');
    try {
      const msg = await dbSendMessage(conversationId, text);
      setMessages((m) => [...m, msg]);
    } catch {
      setBody(text); // xatolik bo'lsa matnni qaytaramiz
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map((m) => {
          const mine = m.senderId === myUserId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-accent text-accent-content' : 'bg-base-300'}`}>
                {m.body}
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
                  {timeAgo(new Date(m.createdAt).getTime())}
                  {mine && (
                    m.isRead ? (
                      // O'qilgan — ikkita qalin ptichka (WhatsApp uslubida).
                      <svg width="15" height="11" viewBox="0 0 16 11" fill="none" aria-label="O'qilgan">
                        <path d="M1 5.5L4.5 9L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5.5 5.5L9 9L15.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      // Yuborildi, lekin hali o'qilmagan — bitta ptichka, xiraroq.
                      <svg width="12" height="11" viewBox="0 0 13 11" fill="none" className="opacity-60" aria-label="Yuborildi">
                        <path d="M1 5.5L4.5 9L11.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}></div>
      </div>
      <div className="flex gap-2 border-t border-white/10 p-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Xabar yozing..."
          className="input input-bordered input-sm flex-1 bg-base-100"
        />
        <button className="btn btn-primary btn-sm" onClick={send} disabled={sending || !body.trim()}>Yuborish</button>
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
      <div className="mt-6 grid overflow-hidden rounded-2xl border border-white/10 sm:grid-cols-[280px_1fr]" style={{ height: '65vh' }}>
        <div className="overflow-y-auto border-r border-white/10">
          {conversations === null
            ? <div className="p-6 text-center text-sm text-base-content/45">Yuklanmoqda...</div>
            : <ConversationList conversations={conversations} activeId={activeId} onSelect={(cid) => navigate('/xabarlar/' + cid)} />}
        </div>
        <div className="hidden sm:block">
          {activeId
            ? <Thread key={activeId} conversationId={activeId} myUserId={user.id} />
            : <div className="flex h-full items-center justify-center text-sm text-base-content/40">Suhbat tanlang</div>}
        </div>
      </div>
      {activeId && (
        <div className="mt-4 sm:hidden">
          <Thread key={activeId} conversationId={activeId} myUserId={user.id} />
        </div>
      )}
    </main>
  );
}
