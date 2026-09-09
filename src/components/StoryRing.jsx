import { useState } from 'react';
import StoryViewer from './StoryViewer.jsx';
import { useLanguage } from '../lib/i18n.jsx';

// Dumaloq rasm (avatar/logo) atrofidagi istorya halqasi — Instagram
// mantiqi: halqa bor = ko'rilmagan istorya bor.
//
// `children` — o'sha dumaloq rasmning O'ZI. Ya'ni bu komponent mavjud
// avatarni O'RAB oladi, uni qayta chizmaydi: har sahifada avatar boshqa
// o'lchamda va uslubda, ularni takrorlash ikki xil ko'rinishga olib
// kelardi.
export default function StoryRing({ stories = [], title = '', avatarUrl = '', canDelete = false, onDelete, children }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const list = Array.isArray(stories) ? stories.filter(Boolean) : [];
  if (!list.length) return children;

  return (
    <>
      <button type="button" className="story-ring" onClick={() => setOpen(true)} aria-label={t('Istoryani ko‘rish')}>
        <span className="story-ring-glow" aria-hidden="true" />
        {children}
      </button>
      {open && (
        <StoryViewer
          stories={list} title={title} avatarUrl={avatarUrl}
          canDelete={canDelete} onDelete={onDelete}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
