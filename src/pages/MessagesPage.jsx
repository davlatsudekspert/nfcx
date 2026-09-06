import { useEffect, useRef, useState } from 'react';
import { dbListConversations, dbListMessages, dbSendMessage, dbUploadImage } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { timeAgo } from '../lib/format.js';
import { IconSearch, IconPhone, IconArrowLeft } from '../components/Icons.jsx';
import { useLanguage } from '../lib/i18n.jsx';

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
  const { t } = useLanguage();
  const query = q.trim().toLowerCase();
  const filtered = conversations.filter((c) =>
    !query || (c.otherEmail || '').toLowerCase().includes(query) || (c.lastMessage || '').toLowerCase().includes(query));

  if (filtered.length === 0) {
    return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-base-content/45">{t("Hozircha suhbat topilmadi.")}</div>;
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
              {c.lastAt && <span className="shrink-0 text-[14px] text-base-content/40">{timeAgo(new Date(c.lastAt).getTime())}</span>}
            </div>
            <div className="truncate text-xs text-base-content/50">{c.lastMessage || t('Xabar yo\u2019q')}</div>
          </div>
          {c.unreadCount > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[14px] font-bold text-black">{c.unreadCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ m, mine }) {
  const { t } = useLanguage();
  const isImage = IMAGE_URL_RE.test(m.body.trim());
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[75%] ${mine ? 'bg-gradient-to-br from-accent to-[#b3860f] text-black' : 'bg-base-300'}`}>
        {isImage ? (
          <a href={m.body} target="_blank" rel="noopener noreferrer">
            <img src={m.body} alt={t('rasm')} className="max-h-56 max-w-full rounded-lg object-cover" />
          </a>
        ) : (
          <span className="whitespace-pre-wrap break-words">{m.body}</span>
        )}
        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[13px] ${mine ? 'text-black/60' : 'opacity-60'}`}>
          {timeAgo(new Date(m.createdAt).getTime())}
          {mine && (
            m.isRead ? (
              <svg width="15" height="11" viewBox="0 0 16 11" fill="none" role="img" aria-label={t("O'qilgan")}>
                <path d="M1 5.5L4.5 9L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.5 5.5L9 9L15.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="12" height="11" viewBox="0 0 13 11" fill="none" className="opacity-70" role="img" aria-label={t('Yuborildi')}>
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
  const { t } = useLanguage();
  const [messages, setMessages] = useState(null); // null = hali yuklanmagan
  const [loadError, setLoadError] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const fileRef = useRef(null);
  const loadedRef = useRef(false);

  const load = async () => {
    try {
      const data = await dbListMessages(conversation.id);
      loadedRef.current = true;
      setMessages(data.messages);
      setLoadError(false);
    } catch {
      // Birinchi yuklash muvaffaqiyatsiz bo'lsa xato ko'rsatamiz; polling
      // vaqtida esa eski xabarlar qoladi (jim).
      if (!loadedRef.current) setLoadError(true);
    }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 3000);
    return () => clearInterval(pollRef.current);
  }, [conversation.id]);

  const messageCount = messages ? messages.length : 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messageCount]);

  const sendText = async (text) => {
    if (!text) return;
    try {
      const msg = await dbSendMessage(conversation.id, text);
      setMessages((m) => [...(m || []), msg]);
      setSendError(false);
    } catch {
      setBody(text);
      setSendError(true);
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
          <button className="btn btn-ghost btn-circle btn-sm shrink-0 sm:hidden" onClick={onBack} aria-label={t("Orqaga")}>
            <IconArrowLeft width={18} height={18} />
          </button>
        )}
        <Avatar label={conversation.otherEmail} active={isRecentlyActive(conversation.lastAt)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{conversation.otherEmail}</div>
          <div className="text-[14px] text-base-content/45">{isRecentlyActive(conversation.lastAt) ? t('Onlayn') : t('Oxirgi faollik:') + ' ' + (conversation.lastAt ? timeAgo(new Date(conversation.lastAt).getTime()) : '\u2014')}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-circle vz-tap hidden text-base-content/50 sm:inline-flex" aria-label={t('Qidirish')}><IconSearch width={16} height={16} /></button>
        <button type="button" className="btn btn-ghost btn-circle vz-tap text-base-content/50" aria-label={t('Qo‘ng‘iroq')}><IconPhone width={16} height={16} /></button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
        {messages === null && !loadError && (
          <div className="space-y-3" aria-busy="true" aria-label={t('Yuklanmoqda...')}>
            <div className="vz-skel w-1/2" style={{ height: 36 }} />
            <div className="vz-skel ml-auto w-2/3" style={{ height: 36 }} />
            <div className="vz-skel w-2/5" style={{ height: 36 }} />
          </div>
        )}
        {loadError && (
          <div className="vz-empty" role="alert">
            <b>{t("Server bilan aloqa yo'q")}</b>
            <p className="text-sm">{t("Xabarlarni yuklab bo'lmadi.")}</p>
            <button type="button" className="btn btn-outline-gold btn-sm mt-2" onClick={() => { setLoadError(false); load(); }}>{t('Qayta urinish')}</button>
          </div>
        )}
        {messages !== null && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-base-content/40">{t("Xabar yo'q — birinchi bo'lib yozing.")}</div>
        )}
        {(messages || []).map((m) => <MessageBubble key={m.id} m={m} mine={m.senderId === myUserId} />)}
        <div ref={bottomRef}></div>
      </div>

      {sendError && (
        <div className="shrink-0 px-3 pb-1 text-xs text-error" role="alert">{t("Xabar yuborilmadi. Qayta urinib ko'ring.")}</div>
      )}

      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 p-2.5 sm:p-3" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        <button type="button" className="btn btn-ghost btn-circle vz-tap shrink-0 text-base-content/50" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label={t('Rasm yuborish')}>
          {uploading ? <span className="loading loading-spinner loading-xs"></span> : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95L10.13 17.12a2 2 0 01-2.83-2.83l8.49-8.49" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder={t("Xabar yozing...")}
          className="input input-bordered min-h-11 min-w-0 flex-1 bg-base-100"
          aria-label={t("Xabar yozing...")}
        />
        <button type="button" className="btn btn-circle vz-tap shrink-0 border-none bg-gradient-to-br from-accent to-[#b3860f] text-black" onClick={send} disabled={sending || !body.trim()} aria-label={t('Yuborish')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
        </button>
      </div>
    </div>
  );
}

const FEATURES = [
  { title: 'Premium dizayn', text: "Qora fon va oltin rang uyg'unligi brendga mos premium ko'rinish." },
  { title: "O'qildi belgisi", text: '\u2713 yuborildi, \u2713\u2713 o\u2019qildi belgilar xabar holatini ko\u2019rsatadi.' },
  { title: 'Fayl biriktirish', text: "Rasm yuklab, suhbatdoshingizga to'g'ridan-to'g'ri yuborishingiz mumkin." },
  { title: 'Faollik holati', text: "So'nggi 5 daqiqada yozgan foydalanuvchi yashil nuqta bilan ko'rinadi." },
  { title: 'Bildirishnomalar', text: "Yangi xabarlar soni yuqoridagi Xabarlar bo'limida ko'rsatiladi." },
];

export default function MessagesPage({ id }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [conversations, setConversations] = useState(null);
  const [convError, setConvError] = useState(false);
  const convLoadedRef = useRef(false);
  const [q, setQ] = useState('');
  const activeId = id ? Number(id) : null;

  const loadConversations = () => dbListConversations()
    .then((d) => { convLoadedRef.current = true; setConversations(d.conversations); setConvError(false); })
    .catch(() => { if (!convLoadedRef.current) setConvError(true); });

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
    const timer = setInterval(loadConversations, 5000);
    return () => clearInterval(timer);
  }, [user]);

  if (user === undefined || user === null) {
    return (
      <main className="mx-auto w-full max-w-[1800px] px-6 pt-16 sm:px-10 lg:px-14" aria-busy="true">
        <div className="vz-skel w-40" style={{ height: 24 }} />
        <div className="vz-skel mt-4 w-full" style={{ height: 44 }} />
        <div className="vz-skel mt-3 w-full" style={{ height: 44 }} />
        <span className="sr-only">{t('Yuklanmoqda...')}</span>
      </main>
    );
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
            <h1 className="font-display text-lg font-bold">{t("Xabarlar")}</h1>
          </div>
          <div className="shrink-0 border-b border-white/10 p-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <IconSearch width={14} height={14} className="shrink-0 text-base-content/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("Suhbat yoki foydalanuvchi qidirish...")}
                className="min-h-9 w-full bg-transparent text-sm outline-none placeholder:text-base-content/35"
                aria-label={t("Suhbat yoki foydalanuvchi qidirish...")}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {convError && conversations === null ? (
              <div className="vz-empty m-3" role="alert">
                <b>{t("Server bilan aloqa yo'q")}</b>
                <p className="text-sm">{t("Suhbatlarni yuklab bo'lmadi.")}</p>
                <button type="button" className="btn btn-outline-gold btn-sm mt-2" onClick={() => { setConvError(false); loadConversations(); }}>{t('Qayta urinish')}</button>
              </div>
            ) : conversations === null ? (
              <div className="space-y-3 p-4" aria-busy="true" aria-label={t('Yuklanmoqda...')}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="vz-skel h-11 w-11 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1"><div className="vz-skel w-2/3" /><div className="vz-skel mt-2 w-1/2" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <ConversationList conversations={conversations} activeId={activeId} q={q} onSelect={(cid) => navigate('/xabarlar/' + cid)} />
            )}
          </div>
        </div>

        {/* Ochiq suhbat — mobilda faqat shu ko'rinadi (butun ekranni egallaydi) */}
        <div className={`min-h-0 ${showThreadOnMobile ? 'block' : 'hidden sm:block'}`} style={{ height: 'calc(100dvh - 64px)' }}>
          {active
            ? <Thread key={active.id} conversation={active} myUserId={user.id} onBack={() => navigate('/xabarlar')} />
            : <div className="flex h-full items-center justify-center text-sm text-base-content/40">{t("Suhbat tanlang")}</div>}
        </div>
      </div>

      {!showThreadOnMobile && (
        <section className="mt-10 hidden gap-3 px-6 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="vz-card min-w-0 p-4">
              <div className="vz-kicker">0{i + 1}</div>
              <div className="mt-2 text-sm font-semibold">{t(f.title)}</div>
              <p className="mt-1 text-xs leading-relaxed text-base-content/50">{t(f.text)}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
