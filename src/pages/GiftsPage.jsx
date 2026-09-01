import { useEffect, useState } from 'react';
import { dbPublicGifts } from '../lib/db.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import NfcCard from '../components/NfcCard.jsx';

function giftDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Public sovg'a kartasi — YUBORUVCHI ko'rsatilmaydi.
export function GiftCard({ gift }) {
  const { t } = useLanguage();
  return (
    <div className="auc-card flex flex-col rounded-2xl p-5">
      <div className="text-lg" aria-hidden>{'\u{1F381}'}</div>
      <button
        type="button"
        onClick={() => navigate('/' + gift.code)}
        className="mt-1 cursor-pointer py-2 text-center font-mono text-2xl font-extrabold tracking-[0.14em] text-[#f2d9a0] transition-colors hover:text-[#ffe9bf]"
      >
        {gift.code}
      </button>
      <div className="mt-2 text-center text-xs uppercase tracking-widest text-base-content/40">{t('Yangi egasi')}</div>
      <div className="mt-0.5 text-center text-sm font-semibold">
        {gift.recipientName
          ? (gift.recipientCode
            ? <button type="button" onClick={() => navigate('/' + gift.recipientCode)} className="cursor-pointer hover:underline">{gift.recipientName}</button>
            : gift.recipientName)
          : <span className="text-base-content/55">{t('Yangi egasiga topshirildi')}</span>}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
        <span className="font-semibold text-success">{t('✓ Sovg‘a qilindi')}</span>
        <span className="text-base-content/40">{giftDate(gift.date)}</span>
      </div>
    </div>
  );
}

export default function GiftsPage({ catalog = [] }) {
  const { t } = useLanguage();
  const [gifts, setGifts] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    dbPublicGifts(1).then(({ gifts, hasMore }) => { setGifts(gifts); setHasMore(hasMore); });
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    const next = page + 1;
    const { gifts: more, hasMore: hm } = await dbPublicGifts(next);
    setGifts((prev) => [...(prev || []), ...more]);
    setHasMore(hm);
    setPage(next);
    setLoadingMore(false);
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="pt-14 gift-page-heading">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          {t('Sovg‘alar')}
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">{'\u{1F381}'} {t('Sovg‘alar')}</h1>
        <p className="mt-3 max-w-xl text-[15px] text-base-content/60">
          {t("NFCStore'da yangi egalariga topshirilgan noyob NFC ID'lar.")}
        </p>
      </section>

      <section className="mt-8">
        <div className="gift-luxe-hero grid items-center gap-8 rounded-3xl border border-[#e6c165]/20 bg-gradient-to-br from-[#17130c] via-[#100d09] to-[#070605] p-6 sm:p-9 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <span className="gift-luxe-kicker">NFCSTORE GOLD EDITION</span>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              {t('NFC ID — nafaqat siz uchun')}
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-base-content/65">
              {t('O‘zingizga esda qoladigan NFC ID tanlang yoki uni yaqin insoningizga sovg‘a qiling. NFC ID egasi o‘z ID’sini boshqa NFCStore foydalanuvchisiga xavfsiz tarzda o‘tkazishi mumkin.')}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button onClick={() => navigate('/narxlar')} className="btn btn-primary min-h-11 px-5">{t('NFC ID tanlash')}</button>
              <button onClick={() => navigate('/account')} className="btn btn-ghost min-h-11 px-5">{'\u{1F381}'} {t('NFC ID sovg‘a qilish')}</button>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-bold">{'\u{1F381}'} {t('Noyob ID — unutilmas sovg‘a')}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-base-content/55">
                {t('Ism, sana, brend yoki alohida ma’noga ega NFC ID’ni tanlang va yaqin insoningizga raqamli sovg‘a sifatida taqdim eting.')}
              </p>
            </div>
          </div>
          <div className="gift-luxe-visual">
            <img src="/business-assets/nfcstore-gift-gold.png" alt="NFCSTORE yozuvli oltin bantli premium sovg‘a qutisi" />
            <div className="gift-luxe-card">
              <NfcCard code="VIP007" name={t('Noyob ID — unutilmas sovg‘a')} finish="showcase" size="md" />
            </div>
            <span className="gift-luxe-seal">NFC<br />GIFT</span>
          </div>
        </div>
      </section>

      <section className="mt-10">
        {gifts === null && <div className="py-10 text-center text-base-content/45">{t('Yuklanmoqda...')}</div>}

        {gifts !== null && gifts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-base-content/50">
            {t("Hozircha sovg'a qilingan NFC ID yo'q.")}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(gifts || []).map((g, i) => <GiftCard key={g.code + i} gift={g} />)}
        </div>

        {hasMore && (
          <div className="mt-8 text-center">
            <button className="btn btn-outline btn-sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <span className="loading loading-spinner loading-xs"></span> : t('Ko‘proq ko‘rsatish')}
            </button>
          </div>
        )}
      </section>

      {catalog.length > 0 && (
        <section className="gift-live-profiles mt-12">
          <header>
            <div>
              <span>NFCSTORE LIVE</span>
              <h2>{t('Yangi egasini topgan NFC ID’lar')}</h2>
              <p>{t('Bazaga ulangan haqiqiy profillar — NFC karta yoki havola orqali o‘z sahifasini ochadi.')}</p>
            </div>
            <button type="button" onClick={() => navigate('/katalog')}>{t('Barchasini ko‘rish')} →</button>
          </header>
          <div>
            {catalog.slice(0, 6).map((item) => (
              <button type="button" key={item.code} onClick={() => navigate('/' + item.code.toLowerCase())}>
                <NfcCard code={item.code} name={(item.name || item.code).toUpperCase()} finish="showcase" size="sm" rim />
                <span><b>{item.name || item.code}</b><small>{item.city || item.role || `nfcstore.uz/${item.code.toLowerCase()}`}</small></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="mt-14 max-w-3xl text-xs leading-relaxed text-base-content/40">
        {t('NFCStore NFC ID egaligini texnik jihatdan o‘tkazish xizmatini taqdim etadi. Foydalanuvchilar o‘rtasidagi mustaqil kelishuvlar va hisob-kitoblarda NFCStore taraf, to‘lov agenti yoki vositachi sifatida ishtirok etmaydi.')}
      </p>
    </main>
  );
}
