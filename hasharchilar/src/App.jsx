import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './lib/api.js';
import { distanceKm, store } from './lib/utils.js';
import Header from './components/Header.jsx';
import Tabs from './components/Tabs.jsx';
import MapView from './components/MapView.jsx';
import HasharCard from './components/HasharCard.jsx';
import CompletedGallery from './components/CompletedGallery.jsx';
import CreateHasharModal from './components/CreateHasharModal.jsx';
import JoinDialog from './components/JoinDialog.jsx';

export default function App() {
  const [hashars, setHashars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('map');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [profile, setProfile] = useState(() => store.get('profile', null));
  const [joinedIds, setJoinedIds] = useState(() => new Set(store.get('joined', [])));
  const [showCreate, setShowCreate] = useState(false);
  const [joinTarget, setJoinTarget] = useState(null); // profil yo'q bo'lganda kutayotgan hashar id
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .listHashars()
      .then(setHashars)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const remember = (id) => {
    const next = new Set(joinedIds).add(id);
    setJoinedIds(next);
    store.set('joined', [...next]);
  };

  // ----- Qatnashish: profil bo'lsa bir bosish, bo'lmasa bir marta so'raymiz -----
  const doJoin = async (id, who) => {
    const res = await api.join(id, who);
    setHashars((list) => list.map((h) => (h.id === id ? { ...h, volunteer_count: res.volunteer_count } : h)));
    remember(id);
    notify("Siz ro'yxatga olindingiz. Rahmat! 🌱");
  };

  const join = async (id) => {
    if (joinedIds.has(id)) return;
    if (!profile) return setJoinTarget(id);
    try {
      await doJoin(id, profile);
    } catch (e) {
      notify(e.message);
    }
  };

  const saveProfileAndJoin = async (who) => {
    await doJoin(joinTarget, who);
    setProfile(who);
    store.set('profile', who);
    setJoinTarget(null);
  };

  // ----- E'lon yaratish -----
  const create = async (formData, who) => {
    const created = await api.createHashar(formData);
    setHashars((list) => [created, ...list]);
    setProfile(who);
    store.set('profile', who);
    remember(created.id);
    setTab('map');
    setSelectedId(created.id);
    setShowCreate(false);
    notify("Hashar e'lon qilindi! 🎉");
  };

  // ----- "Yaqindagi" tabi: geolokatsiya -----
  const changeTab = (id) => {
    setTab(id);
    if (id === 'nearby' && !userPos) {
      navigator.geolocation?.getCurrentPosition(
        (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => notify("Joylashuvingizga ruxsat berilmadi — ro'yxat sana bo'yicha"),
      );
    }
  };

  // ----- Qidiruv va tab bo'yicha ro'yxat -----
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = hashars.filter((h) => !q || `${h.title} ${h.address} ${h.description}`.toLowerCase().includes(q));
    if (tab === 'done') return matches.filter((h) => h.status === 'COMPLETED');
    if (tab === 'nearby') {
      const pending = matches.filter((h) => h.status === 'PENDING').map((h) => ({ ...h, distance: userPos ? distanceKm(userPos, h) : null }));
      return userPos ? pending.sort((a, b) => a.distance - b.distance) : pending;
    }
    return matches;
  }, [hashars, query, tab, userPos]);

  return (
    <div className="min-h-screen">
      <Header query={query} onQuery={setQuery} onCreate={() => setShowCreate(true)} />

      <main className="mx-auto max-w-7xl px-4 pb-16">
        {/* Hero: 3 soniyada tushunarli bo'lishi kerak */}
        <section className="py-8">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Birgalikda <span className="text-emerald-600">obod</span> qilamiz
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-lg">
            Mahallangizdagi hasharlarni toping yoki yangisini yaratib odamlarni chorlang.
          </p>
          <ol className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-slate-700">
            {['🗺️ Xaritadan toping', '👆 Bir bosishda qo‘shiling', '✨ Oldin va keyinni ko‘ring'].map((t) => (
              <li key={t} className="rounded-full bg-white px-4 py-1.5 shadow-sm">{t}</li>
            ))}
          </ol>
        </section>

        <Tabs active={tab} onChange={changeTab} />

        <div className="mt-5">
          {error ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-md">
              <p className="font-semibold text-red-600">{error}</p>
              <button onClick={load} className="mt-3 rounded-xl bg-amber-400 px-5 py-2 font-bold hover:bg-amber-500">Qayta urinish</button>
            </div>
          ) : loading ? (
            <p className="py-16 text-center text-slate-500">Yuklanmoqda…</p>
          ) : tab === 'done' ? (
            <CompletedGallery hashars={visible} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="order-2 flex flex-col gap-4 lg:order-1 lg:max-h-[600px] lg:overflow-y-auto lg:overflow-x-hidden lg:p-1 lg:pr-3">
                {visible.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-md">Hech narsa topilmadi.</p>}
                {visible.map((h) => (
                  <HasharCard
                    key={h.id}
                    hashar={h}
                    distance={h.distance}
                    selected={h.id === selectedId}
                    joined={joinedIds.has(h.id)}
                    onSelect={() => setSelectedId(h.id)}
                    onJoin={join}
                  />
                ))}
              </div>
              <div className="order-1 lg:order-2">
                <div className="lg:sticky lg:top-24">
                  <MapView hashars={visible} joinedIds={joinedIds} selectedId={selectedId} userPos={userPos} onSelect={setSelectedId} onJoin={join} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showCreate && <CreateHasharModal profile={profile} onSubmit={create} onClose={() => setShowCreate(false)} />}
      {joinTarget && <JoinDialog onSubmit={saveProfileAndJoin} onClose={() => setJoinTarget(null)} />}

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-[4000] flex justify-center px-4">
          <div className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>
        </div>
      )}
    </div>
  );
}
