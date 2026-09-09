import { useEffect, useState } from 'react';
import StoryViewer from './StoryViewer.jsx';
import { dbStoryFeed } from '../lib/db.js';
import { useLanguage } from '../lib/i18n.jsx';
import { initials } from '../lib/format.js';

// OBUNA BO'LGANLARINGIZNING ISTORYASI — Instagram uslubidagi yuqoridagi
// dumaloqchalar qatori.
//
// Faqat siz obuna bo'lgan odamlar ko'rinadi. Hammaning istoryasini
// ko'rsatish tanlov emas, tasodifiy oqim bo'lardi — va tanish bo'lmagan
// odamning kontenti kutilmaganda chiqib qolardi.
//
// Hech kim istorya qo'ymagan bo'lsa — qator UMUMAN chizilmaydi.
// Bo'sh joy "buzuq" ko'rinadi va foydasiz o'rin egallaydi.
export default function StoryFeedBar() {
  const { t } = useLanguage();
  const [feed, setFeed] = useState([]);
  const [open, setOpen] = useState(-1);
  const [seen, setSeen] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('nfc_seen_stories') || '[]')); } catch { return new Set(); }
  });

  useEffect(() => {
    let live = true;
    dbStoryFeed().then((f) => live && setFeed(f)).catch(() => {});
    return () => { live = false; };
  }, []);

  if (!feed.length) return null;

  // "Ko'rilgan" belgisi FAQAT shu brauzerda saqlanadi (localStorage).
  // Serverga yozish uchun har ko'rishda so'rov kerak bo'lardi — bu esa
  // hech kimga kerak bo'lmagan yuk va yana bir kuzatuv izi.
  const markSeen = (entry) => {
    const next = new Set(seen);
    for (const st of entry.stories) next.add(st.id);
    setSeen(next);
    try { localStorage.setItem('nfc_seen_stories', JSON.stringify([...next].slice(-500))); } catch { /* jim tur */ }
  };

  const current = open >= 0 ? feed[open] : null;

  return (
    <>
      <div className="sf-bar" aria-label={t('Istoryalar')}>
        {feed.map((entry, i) => {
          const unseen = entry.stories.some((st) => !seen.has(st.id));
          return (
            <button
              key={entry.code} type="button" className={`sf-item ${unseen ? 'is-new' : ''}`}
              onClick={() => { markSeen(entry); setOpen(i); }}
            >
              <span className="sf-ring" aria-hidden="true" />
              <span className="sf-avatar">
                {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" /> : initials(entry.name)}
              </span>
              <small>{entry.name}</small>
            </button>
          );
        })}
      </div>

      {current && (
        <StoryViewer
          stories={current.stories}
          title={current.name}
          avatarUrl={current.avatarUrl}
          onClose={() => setOpen(-1)}
        />
      )}
    </>
  );
}
