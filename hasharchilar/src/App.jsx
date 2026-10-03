import { useState } from 'react';
import { INITIAL_HASHARS } from './data.js';
import HasharCard from './components/HasharCard.jsx';
import HasharMap from './components/HasharMap.jsx';
import CreateModal from './components/CreateModal.jsx';
import { LeafIcon } from './components/icons.jsx';

export default function App() {
  const [hashars, setHashars] = useState(INITIAL_HASHARS);
  const [selectedId, setSelectedId] = useState(null);
  const [joined, setJoined] = useState(() => new Set());
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  };

  const join = (id) => {
    if (joined.has(id)) return;
    setJoined(new Set(joined).add(id));
    setHashars((list) => list.map((h) => (h.id === id ? { ...h, people: h.people + 1 } : h)));
    showToast("Siz ro'yxatga olindingiz. Rahmat!");
  };

  const create = (h) => {
    const item = { ...h, id: Date.now(), status: 'pending', people: 1 };
    setHashars((list) => [item, ...list]);
    setSelectedId(item.id);
    showToast("Hashar e'lon qilindi!");
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <header className="sticky top-0 z-[1000] bg-base-100/90 backdrop-blur shadow-sm">
        <div className="navbar mx-auto max-w-7xl px-4">
          <div className="navbar-start gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-white shadow-md">
              <LeafIcon className="h-6 w-6" />
            </span>
            <a href="/" className="text-xl font-extrabold tracking-tight sm:text-2xl">
              <span className="text-primary">hashar</span>
              <span className="text-warning">chilar</span>
              <span className="text-base-content/50">.uz</span>
            </a>
          </div>
          <div className="navbar-end">
            <button
              className="btn btn-warning shadow-md"
              onClick={() => document.getElementById('create_modal').showModal()}
            >
              <span className="text-lg leading-none">+</span>
              <span className="hidden sm:inline">Hashar e'lon qilish</span>
              <span className="sm:hidden">E'lon</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-4 pt-8 sm:pt-10">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
          Birgalikda <span className="text-primary">obod</span> qilamiz
        </h1>
        <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-lg">
          Mahallangizdagi hasharlarni toping yoki yangisini yaratib odamlarni chorlang.
        </p>
      </section>

      {/* Split view */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="order-2 flex flex-col gap-5 lg:order-1 lg:max-h-[600px] lg:overflow-y-auto lg:p-1 lg:pr-3 lg:overflow-x-hidden">
          {hashars.map((h) => (
            <HasharCard
              key={h.id}
              hashar={h}
              selected={h.id === selectedId}
              joined={joined.has(h.id)}
              onSelect={() => setSelectedId(h.id)}
              onJoin={() => join(h.id)}
            />
          ))}
        </div>
        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-24">
            <HasharMap hashars={hashars} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
      </main>

      <CreateModal onCreate={create} />

      {toast && (
        <div className="toast toast-center z-[2000]">
          <div className="alert alert-success text-white shadow-xl">{toast}</div>
        </div>
      )}
    </div>
  );
}
