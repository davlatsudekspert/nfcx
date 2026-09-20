import { useCallback, useEffect, useRef, useState } from 'react';
import { dbActivate, dbActivateCheck, dbActivateOptions } from '../lib/db.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// MAHSULOTNI FAOLLASHTIRISH — QR OCHADIGAN SAHIFA
//
// Xaridor Uzum Market'dan NFC karta yoki stiker oladi, konvertdagi
// QR'ni skanerlaydi va shu yerga tushadi.
//
// SAHIFA ATAYLAB SODDA. Har qadamda EKRANDA BITTA ISH bo'ladi:
//   1) kod         2) kirish        3) shaxsiy/biznes
//   4) qaysi profil 5) tayyor
// Sabab: bu odamning NFCSTORE bilan BIRINCHI uchrashuvi. Bir ekranda
// kod, ro'yxatdan o'tish va profil tanlovi birga turganda u
// "murakkab tizim" bo'lib ko'rinadi va odam yarim yo'lda tashlaydi.
//
// AKTIVATSIYA KODI URL'GA YOZILMAYDI. U faqat POST tanasida ketadi va
// sahifada `sessionStorage` da turadi — shunda odam kirish/ro'yxatdan
// o'tishga chiqib qaytsa, kodni QAYTA YOZMAYDI. `localStorage` emas:
// kod brauzerda abadiy qolmasligi kerak.
// ═══════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'nfc_activation_code';
const DEVICE_KEY = 'nfc_activation_device';
// Profil turi ham saqlanadi: odam kirishga chiqib qaytganda
// tanlovini QAYTA qilmasin.
const KIND_KEY = 'nfc_activation_kind';
function readStoredKind() {
  try { const v = sessionStorage.getItem(KIND_KEY); return v === 'personal' || v === 'business' ? v : ''; } catch { return ''; }
}
function storeKind(v) {
  try { if (v) sessionStorage.setItem(KIND_KEY, v); else sessionStorage.removeItem(KIND_KEY); } catch { /* private rejim */ }
}

function readStoredCode() {
  try { return sessionStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}
function storeCode(code) {
  try { if (code) sessionStorage.setItem(STORAGE_KEY, code); else sessionStorage.removeItem(STORAGE_KEY); } catch { /* private rejim */ }
}

// TEKKIZILGAN STIKERNING TOKENI.
//
// `/t/<token>` bog'lanmagan stikerni shu sahifaga `?d=` bilan
// yuboradi. Token saqlanadi, chunki odam oradan kirish yoki
// ro'yxatdan o'tishga chiqib ketishi mumkin — qaytganda qaysi
// stikerni tekkizgani ESDA qolishi kerak.
//
// Manzildan DARHOL olib tashlanadi: brauzer tarixida va `Referer`
// sarlavhasida qolib ketmasin.
function readStoredDevice() {
  try { return sessionStorage.getItem(DEVICE_KEY) || ''; } catch { return ''; }
}
function takeDeviceFromUrl() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const d = (params.get('d') || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!d) return readStoredDevice();
  try { sessionStorage.setItem(DEVICE_KEY, d); } catch { /* private rejim */ }
  params.delete('d');
  const clean = window.location.pathname + (params.toString() ? `?${params}` : '');
  window.history.replaceState(null, '', clean);
  return d;
}
function clearDevice() {
  try { sessionStorage.removeItem(DEVICE_KEY); } catch { /* private rejim */ }
}

// Kiritish paytida ko'rinishni tartibga soladi: NF-XXXX-XXXX.
// Tekshiruvning O'ZI serverda — bu faqat ko'rinish.
function prettyInput(raw) {
  const up = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = up.startsWith('NF') ? up.slice(2) : up;
  const a = body.slice(0, 4);
  const b = body.slice(4, 8);
  return b ? `NF-${a}-${b}` : a ? `NF-${a}` : '';
}

const ERRORS = {
  bad_code: 'Bunday kod topilmadi. Konvertdagi kodni tekshirib, qayta kiriting.',
  already_activated: 'Bu kod allaqachon faollashtirilgan.',
  code_blocked: 'Bu kod bloklangan. Qo‘llab-quvvatlashga murojaat qiling.',
  code_expired: 'Bu kodning muddati tugagan. Qo‘llab-quvvatlashga murojaat qiling.',
  activation_in_progress: 'Bu kod hozir faollashtirilmoqda. Bir necha soniyadan so‘ng qayta urinib ko‘ring.',
  rate_limited: 'Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.',
  not_your_profile: 'Bu profil sizga tegishli emas.',
  not_your_company: 'Bu kompaniya sizga tegishli emas.',
  company_required: 'Kompaniyani tanlang.',
  device_taken: 'Bu mahsulot boshqa hisobga bog‘langan.',
  id_allocation_failed: 'Hozir ID berib bo‘lmadi. Bir oz kutib, qayta urinib ko‘ring.',
  unauthorized: 'Avval tizimga kiring.',
};

export default function ActivatePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  // `undefined` — sessiya hali o'qilmagan. `null` — mehmon.
  const authReady = user !== undefined;

  const [code, setCode] = useState(() => prettyInput(readStoredCode()));
  // Tekkizilgan stiker (bo'lsa). Manzildan bir marta olinadi.
  const [deviceToken] = useState(takeDeviceFromUrl);
  const [product, setProduct] = useState(null);
  const [kind, setKind] = useState(readStoredKind);
  const [options, setOptions] = useState(null);
  const [choice, setChoice] = useState('');      // '' = yangi yaratish
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  // Bog'lash nega bo'lmagani — odamga aytiladi.
  const [attachWhy, setAttachWhy] = useState('');
  // Kirishdan keyin AYNAN shu yerga, stiker bilan birga qaytadi.
  const authNext = encodeURIComponent(deviceToken ? `/activate?d=${deviceToken}` : '/activate');
  const inputRef = useRef(null);

  const fail = useCallback((e) => {
    const key = e && e.code;
    setErr(ERRORS[key] ? t(ERRORS[key]) : t('Xatolik yuz berdi. Qayta urinib ko‘ring.'));
  }, [t]);

  // Kod saqlangan bo'lsa (odam kirishga chiqib qaytgan) — darhol
  // tekshiramiz va qadamni tiklaymiz. Odam kodni ikki marta
  // yozmasligi kerak.
  useEffect(() => {
    const saved = readStoredCode();
    if (!saved || product) return;
    let alive = true;
    dbActivateCheck(saved)
      .then((data) => {
        if (!alive) return;
        if (data?.alreadyActivated) { setResult(data.result); storeCode(''); return; }
        if (data?.ok) setProduct(data.product);
      })
      .catch(() => { /* kod eskirgan — odam qaytadan kiritadi */ });
    return () => { alive = false; };
  }, [product]);

  // ── TEKKIZILGAN STIKERNI DARHOL BOG'LASH ──────────────
  //
  // HAQIQIY HOLAT (2026-09-20, sinovda chiqdi): odam QR ni BIR
  // brauzerda skanerlab faollashtiradi, telefonni stikerga
  // tekkizganda esa iOS havolani STANDART brauzerda (Safari) ochadi.
  // Boshqa brauzer — boshqa sessiya, ya'ni odam u yerda KIRMAGAN.
  // Natijada bog'lash 401 bilan rad etilardi va u bo'sh kod
  // maydonini ko'rib "ishlamadi" deb o'ylardi.
  //
  // Endi: sahifa ochilganda ham, odam KIRGANDAN KEYIN ham urinib
  // ko'riladi. Kirish o'zi yetarli — kodni qayta terish shart emas,
  // chunki u allaqachon ishlatilgan.
  // `withCode` — odam kodni QO'LDA kiritganda. Shunda sessiya
  // umuman kerak emas: kodning o'zi konvert ochilganining isboti.
  const tryAttach = useCallback(async (withCode = '') => {
    if (!deviceToken) return null;
    try {
      const r = await fetch('/api/activate/attach-sticker', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(withCode ? { deviceToken, code: withCode } : { deviceToken }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.redirect) { clearDevice(); navigate(d.redirect, { replace: true }); return 'ok'; }
      // SABABNI SAQLAYMIZ. Ilgari jim tushib qolardi va odam
      // sababini bilmasdan bo'sh kod maydonini ko'rardi.
      return (d && d.error) || (r.status === 401 ? 'unauthorized' : 'failed');
    } catch { return 'failed'; }
  }, [deviceToken]);

  useEffect(() => {
    // MEHMON UCHUN HAM ISHLAYDI. Kirmagan odam ham izohni ko'rishi
    // kerak — aks holda u bo'sh kod maydonini sababsiz ko'rardi.
    if (!deviceToken || result) return;
    let alive = true;
    tryAttach().then((why) => { if (alive && why && why !== 'ok') setAttachWhy(why); });
    return () => { alive = false; };
  }, [deviceToken, user, result, tryAttach]);

  // Profil tanlovi: FAQAT o'zinikilar (server ham shuni qaytaradi va
  // egalikni yana bir bor TEKSHIRADI).
  useEffect(() => {
    if (!kind || !user) return;
    let alive = true;
    dbActivateOptions().then((o) => {
      if (!alive) return;
      setOptions(o);
      // STANDART TANLOV — MAVJUD PROFIL, "yangi" EMAS.
      //
      // Ro'yxatdan o'tishning O'ZI bepul NFC ID beradi. Ya'ni
      // marketplace'dan kelgan yangi xaridorda aktivatsiyaga
      // yetganda allaqachon bitta profil bor. Agar standart
      // "yangi profil yaratish" bo'lib qolsa, u IKKINCHI profilni
      // oladi va stiker BO'SH profilga ishora qilardi — birinchi,
      // ismi va kontaktlari bor profil esa kartasiz qolardi.
      //
      // Shuning uchun standart — asosiy (yoki birinchi) profil.
      // "Yangi profil yaratish" varianti joyida qoladi.
      const list = kind === 'business' ? o.business : o.personal;
      if (list.length > 0) {
        const primary = kind === 'business' ? list[0] : (list.find((x) => x.isPrimary) || list[0]);
        setChoice(kind === 'business' ? primary.companyId : primary.code);
      }
    }).catch(() => { if (alive) setOptions({ personal: [], business: [] }); });
    return () => { alive = false; };
  }, [kind, user]);

  const submitCode = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      // STIKER TEKKIZILGAN BO'LSA — AVVAL BOG'LASHGA URINAMIZ.
      //
      // Kod allaqachon ishlatilgan bo'lishi MUMKIN va bu normal:
      // odam QR bilan faollashtirgan, endi stikerini bog'lamoqda.
      // Ilgari bu yerda "Bu kod allaqachon faollashtirilgan" degan
      // XATO chiqardi va odam boshi berk ko'chaga tushardi —
      // qo'lida ham kod, ham stiker bo'lsa ham.
      if (deviceToken && (await tryAttach(code)) === 'ok') { storeCode(''); return; }
      const data = await dbActivateCheck(code);
      if (data?.alreadyActivated) {
        // KOD ALLAQACHON ISHLATILGAN — LEKIN SHU ODAM TOMONIDAN.
        //
        // Aynan shu holat ko'p uchraydi: odam QR bilan
        // faollashtirgan, keyin stikerga tekkizgan va kodini yana
        // kiritmoqda. Ilgari bu yerda faqat natija ko'rsatilardi,
        // STIKER esa bog'lanmay qolardi — ya'ni odam to'g'ri ish
        // qilsa ham mahsuloti ishlamasdi.
        setResult(data.result); storeCode(''); clearDevice(); return;
      }
      setProduct(data.product);
      storeCode(code);
    } catch (e2) { fail(e2); } finally { setBusy(false); }
  };

  const activate = async () => {
    setErr(''); setBusy(true);
    try {
      const payload = { code, profileKind: kind };
      if (kind === 'personal' && choice) payload.profileCode = choice;
      if (kind === 'business') payload.companyId = choice;
      // Odam tekkizgan stiker AYNAN shu profilga bog'lanadi.
      if (deviceToken) payload.deviceToken = deviceToken;
      const data = await dbActivate(payload);
      setResult(data.result);
      storeCode('');
      storeKind('');
      clearDevice();
    } catch (e2) { fail(e2); } finally { setBusy(false); }
  };

  // ── 5-QADAM: TAYYOR ────────────────────────────────────────────────
  if (result) {
    const href = result.profileKind === 'business' ? `/c/${String(result.profileCode).toLowerCase()}` : `/${String(result.profileCode).toLowerCase()}`;
    return (
      <main className="ac-page">
        <section className="ac-card ac-done">
          <div className="ac-check" aria-hidden="true">✓</div>
          <h1>{t('NFC mahsulotingiz faollashtirildi')}</h1>
          <dl className="ac-facts">
            <div><dt>{t('NFC ID')}</dt><dd><b>{result.profileCode}</b></dd></div>
            <div><dt>{t('Profil')}</dt><dd>{result.profileKind === 'business' ? t('Biznes') : t('Shaxsiy')}</dd></div>
            {result.productName && <div><dt>{t('Mahsulot')}</dt><dd>{result.productName}</dd></div>}
          </dl>
          {/* STIKER HALI BOG'LANMAGAN BO'LSA — BU MAJBURIY QADAM.
              QR bilan kelgan odam tokenni olib kelmaydi, shuning
              uchun stiker faollashtirish paytida bog'lanmaydi. U
              tegizganda bog'lanadi — va buni aytib qo'yish shart,
              aks holda odam tugatdim deb ketardi. */}
          {result.deviceBound
            ? <p className="ac-hint">{t('Stikeringiz shu profilga bog‘landi. Telefonga tekkizib ko‘ring.')}</p>
            : (
              <p className="ac-hint ac-hint-do">
                {t('ENDI KONVERTDAGI NFC STIKERNI TELEFONGA TEKKIZING — shunda u shu profilga bog‘lanadi va bundan keyin har tegizganda profilingiz ochiladi.')}
              </p>
            )}
          <div className="ac-actions">
            <button type="button" className="ac-primary" onClick={() => navigate(href)}>{t('Profilni ochish')}</button>
            <button type="button" className="ac-ghost" onClick={() => navigate('/account')}>{t('Kabinetga o‘tish')}</button>
          </div>
          {/* Cross-sell — oqim TUGAGANDAN keyin va kichik. Aktivatsiyaga
              xalaqit bermasligi shart. */}
          <a className="ac-cross" href="/katalog">{t('Boshqa NFC mahsulotlarini ham ko‘ring')} →</a>
        </section>
      </main>
    );
  }

  // ── 1-QADAM: KOD ───────────────────────────────────────────────────
  if (!product) {
    return (
      <main className="ac-page">
        <form className="ac-card" onSubmit={submitCode}>
          <div className="ac-brand">NFCSTORE</div>
          <h1>{t('NFCSTORE mahsulotingizni faollashtiring')}</h1>
          <p className="ac-sub">{t('Konvert ichidagi aktivatsiya kodini kiriting.')}</p>
          {/* STIKER TEKKIZILGAN, LEKIN BOG'LANMAGAN — SABABI.
              Ilgari bu jim tushib qolardi va odam nima
              bo'layotganini umuman bilmasdi. */}
          {deviceToken && attachWhy && (
            <p className="ac-why" role="status">
              {attachWhy === 'device_taken'
                  ? t('Bu stiker allaqachon boshqa profilga bog‘langan.')
                  : t('Stiker hali bog‘lanmagan. Konvertdagi kodni kiriting — shundan keyin u shu profilga bog‘lanadi.')}
            </p>
          )}
          <label className="ac-field">
            <span>{t('Aktivatsiya kodi')}</span>
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(prettyInput(e.target.value))}
              placeholder="NF-XXXX-XXXX"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!err}
            />
          </label>
          {err && <p className="ac-err" role="alert">{err}</p>}
          <button type="submit" className="ac-primary" disabled={busy || code.replace(/[^A-Z0-9]/g, '').length < 10}>
            {busy ? t('Tekshirilmoqda…') : t('Davom etish')}
          </button>
          <p className="ac-note">{t('Kod katta-kichik harfga bog‘liq emas.')}</p>
        </form>
      </main>
    );
  }

  if (!authReady) {
    return <main className="ac-page"><section className="ac-card"><p className="ac-sub">{t('Yuklanmoqda…')}</p></section></main>;
  }

  // ── 2-QADAM: SHAXSIY / BIZNES ──────────────────────────────────────
  if (!kind) {
    return (
      <main className="ac-page">
        <section className="ac-card">
          <div className="ac-badge">{product.name || t('NFC mahsulot')}</div>
          <h1>{t('Qanday profil kerak?')}</h1>
          <p className="ac-sub">{t('Buni keyin ham o‘zgartirish mumkin emas — shuning uchun o‘ylab tanlang.')}</p>
          <div className="ac-choices">
            <button type="button" className="ac-choice" onClick={() => { setKind('personal'); storeKind('personal'); setChoice(''); }}>
              <span className="ac-choice-ic" aria-hidden="true">{'\u{1F464}'}</span>
              <b>{t('Shaxsiy')}</b>
              <small>{t('Kontaktlaringiz, ijtimoiy tarmoqlaringiz va shaxsiy NFC profilingiz.')}</small>
            </button>
            <button type="button" className="ac-choice" onClick={() => { setKind('business'); storeKind('business'); setChoice(''); }}>
              <span className="ac-choice-ic" aria-hidden="true">{'\u{1F3E2}'}</span>
              <b>{t('Biznes')}</b>
              <small>{t('Kompaniyangiz, katalogingiz, aloqa ma’lumotlari va statistikangiz.')}</small>
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ── 3-QADAM: KIRISH — ENG OXIRIDA ────────────────────
  //
  // TARTIB ATAYLAB SHUNDAY. Ilgari kirish kodni kiritgandan KEYIN,
  // lekin profil turini tanlashdan OLDIN so'ralardi — odam nima
  // olayotganini ko'rmasdan turib ro'yxatdan o'tishi kerak edi.
  //
  // Endi u avval kodini kiritadi (mahsulot haqiqiy ekaniga ishonch
  // hosil qiladi), keyin nima olishini tanlaydi va FAQAT SHUNDAN
  // KEYIN hisob ochadi. Kod ham, tanlov ham saqlanib qoladi.
  if (!user) {
    return (
      <main className="ac-page">
        <section className="ac-card">
          <div className="ac-badge">{product.name || t('NFC mahsulot')}</div>
          <h1>{t('Kod to‘g‘ri')}</h1>
          <p className="ac-sub">{t('Oxirgi qadam — hisob oching. Kod va tanlovingiz saqlanib qoladi.')}</p>
          {/* BITTA TUGMA.
              Marketplace xaridorining deyarli hammasi YANGI odam —
              unga ikkita teng tugma ko'rsatish ortiqcha qaror edi.
              Hisobi borlar uchun pastda kichik havola bor, va
              ro'yxatdan o'tish sahifasida ham "Akkauntingiz bormi?"
              havolasi turadi (u ham `next` ni saqlaydi). */}
          <div className="ac-actions">
            <button type="button" className="ac-primary" onClick={() => { storeKind(kind); navigate(`/register?next=${authNext}`); }}>{t('Ro‘yxatdan o‘tish')}</button>
          </div>
          <button type="button" className="ac-linkish" onClick={() => { storeKind(kind); navigate(`/login?next=${authNext}`); }}>
            {t('Hisobim bor — kirish')}
          </button>
        </section>
      </main>
    );
  }

  // ── 4-QADAM: QAYSI PROFIL ──────────────────────────────────────────
  const list = kind === 'business' ? (options?.business || []) : (options?.personal || []);
  const loading = options === null;
  return (
    <main className="ac-page">
      <section className="ac-card">
        <button type="button" className="ac-back" onClick={() => { setKind(''); setChoice(''); setErr(''); }}>‹ {t('Orqaga')}</button>
        <div className="ac-badge">{product.name || t('NFC mahsulot')}</div>
        <h1>{kind === 'business' ? t('Qaysi kompaniyaga bog‘laymiz?') : t('Qaysi profilga bog‘laymiz?')}</h1>

        {loading && <p className="ac-sub">{t('Yuklanmoqda…')}</p>}

        {!loading && (
          <div className="ac-list">
            {kind === 'personal' && (
              <button type="button" className={`ac-opt${choice === '' ? ' is-on' : ''}`} onClick={() => setChoice('')}>
                <b>{t('Yangi profil yaratish')}</b>
                <small>{t('Sizga yangi NFC ID beriladi.')}</small>
              </button>
            )}
            {list.map((item) => {
              const value = kind === 'business' ? item.companyId : item.code;
              return (
                <button key={value} type="button" className={`ac-opt${choice === value ? ' is-on' : ''}`} onClick={() => setChoice(value)}>
                  <b>{kind === 'business' ? (item.displayName || value) : (item.name || value)}</b>
                  <small>{value}</small>
                </button>
              );
            })}
            {kind === 'business' && list.length === 0 && (
              <div className="ac-empty">
                <p>{t('Sizda hali kompaniya yo‘q.')}</p>
                {/* YANGI "marketplace biznes" oqimi YARATILMADI — saytning
                    O'Z kompaniya ochish oqimiga yuboramiz. Kod
                    `sessionStorage` da qoladi va odam qaytganda shu
                    yerdan davom etadi. */}
                <button type="button" className="ac-primary" onClick={() => navigate('/company/create')}>
                  {t('Kompaniya ochish')}
                </button>
                <p className="ac-note">{t('Kompaniya ochilgach shu sahifaga qayting — kod saqlanib qoladi.')}</p>
              </div>
            )}
          </div>
        )}

        {err && <p className="ac-err" role="alert">{err}</p>}

        {!loading && !(kind === 'business' && list.length === 0) && (
          <button type="button" className="ac-primary" onClick={activate} disabled={busy || (kind === 'business' && !choice)}>
            {busy ? t('Faollashtirilmoqda…') : t('Faollashtirish')}
          </button>
        )}
      </section>
    </main>
  );
}
