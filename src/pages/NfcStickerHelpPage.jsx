import { useEffect } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { PhoneShot } from '../components/PhoneShot.jsx';
import { navigate } from '../lib/router.js';
import { APP_APK_URL, APP_PAGE_PATH, APP_STORE_URL, PLAY_STORE_LIVE, PLAY_STORE_URL, isIos } from '../lib/appDownload.js';

// ═══════════════════════════════════════════════════════════════════════
// NFC STIKER — "QANDAY ISHLAYDI?" (nfcstore.uz/nfc-stiker, egasi 2026-09-26)
//
// Tashqi stikerdagi QR AYNAN SHU sahifani ochadi. Egasi: "tushunmaydiganlar
// bor, faqat QR kod deb o'ylashadi. QR'da faqat saytimiz havolasi bo'ladi —
// asosiysi NFC. QR saytga kirsin: NFC qanday ishlashi va ilovani yuklash".
//
// Do'kon sahifasi NFC orqali ochiladi (chip har bir biznesga alohida
// yoziladi), QR esa hamma stikerda bir xil — shuning uchun bu sahifa
// "telefonni tekkizing" deb o'rgatadi va ilovani taklif qiladi.
//
// Manzil tire bilan: harfli so'z (masalan /nfc) kimningdir profil ID'si
// bo'lib qolishi mumkin edi.
// ═══════════════════════════════════════════════════════════════════════

export const NFC_HELP_PATH = '/nfc-stiker';

const CONTENT = {
  uz: {
    kicker: 'NFCSTORE stikeri',
    title: 'Bu stiker NFC — telefonni tekkizing',
    lead: 'Kamerani ochish shart emas. Telefonning orqa tomonini stikerdagi doiraga 1–2 soniya yaqinlashtiring — do‘kon sahifasi o‘zi ochiladi: narxlar, katalog, ish vaqti, manzil va Telegram.',
    tapNow: 'Hozir sinab ko‘ring: telefonni stikerga tekkizing',
    iphone: 'iPhone',
    iphoneSteps: [
      'Ekran yoniq va qulfdan ochiq bo‘lsin.',
      'Telefonning yuqori qismini (kameralar tomoni) doiraga yaqinlashtiring.',
      'Ekran tepasida xabar chiqadi — ustiga bosing, sahifa ochiladi.',
    ],
    iphoneNote: 'iPhone XS va yangilarida o‘zi ishlaydi. iPhone 7–X: Boshqaruv markazidagi «NFC Tag Reader» tugmasini bosing.',
    android: 'Android',
    androidSteps: [
      'NFC yoqilgan bo‘lsin: ekranni yuqoridan pastga suring va «NFC» belgisini yoqing.',
      'Telefonning orqa o‘rtasini doiraga tekkizing.',
      'Sahifa brauzerda ochiladi — ilova o‘rnatish shart emas.',
    ],
    androidNote: 'Deyarli barcha zamonaviy Android telefonlarda NFC bor (kontaktsiz to‘lov ham shu).',
    failT: 'Ochilmadimi?',
    fail: [
      'Qalin yoki metall g‘ilofni olib turing.',
      'Telefonni sekin, doiraning markaziga qarab yaqinlashtiring va 1–2 soniya ushlab turing.',
      'Telefoningizda NFC bo‘lmasa — do‘kon nomini NFCSTORE’da qidiring.',
    ],
    search: 'Bizneslarni qidirish',
    appT: 'NFCSTORE ilovasi',
    appBarP: 'Stiker va kartalarni boshqaring, sevimli do‘konlarni saqlang.',
    appP: 'Sevimli do‘konlaringizni saqlang, o‘zingizga raqamli vizitka oching va istalgan NFC karta yoki stikerni profilingizga bog‘lang.',
    android_btn: 'Android uchun yuklab olish',
    androidPlay: 'Google Play’dan yuklab olish',
    appStore: 'App Store',
    soon: 'Tez kunda',
    more: 'Ilova haqida batafsil',
    bizT: 'O‘z biznesingizga ham shunday stiker kerakmi?',
    bizP: 'Do‘kon yopiq bo‘lsa ham mijoz narxlaringizni ko‘radi va sizga yozadi.',
    bizBtn: 'Stikerlar haqida',
    offNotice: 'Bu stiker hozircha o‘chirilgan — egasi uni vaqtincha o‘chirib qo‘ygan.',
    nav: [['tekkizish', 'Qanday ochiladi'], ['ulash', 'Stikerni ulash'], ['avto', 'Avto stiker'], ['ilova', 'Ilova']],
    ownerK: 'Stiker yoki karta egasi uchun',
    ownerT: 'Stiker yoki kartani profilingizga ulash — 1 daqiqa',
    ownerSteps: [
      'Konvertni oching: ichida bir martalik aktivatsiya kodi bor (NF-XXXX-XXXX).',
      'Telefonni stiker yoki kartaga tekkizing — faollashtirish sahifasi o‘zi ochiladi. Yoki nfcstore.uz/activate ga kiring.',
      'Kodni kiriting va tanlang: Shaxsiy yoki Biznes profil.',
      'Ro‘yxatdan o‘ting yoki kiring, stiker yoki karta qaysi profilni ochishini belgilang va «Faollashtirish»ni bosing.',
      'Tayyor. Endi tekkizilganda sizning sahifangiz ochiladi. Kod bilan saytdan faollashtirgan bo‘lsangiz, 7 kun ichida stiker yoki kartaga bir marta tekkizing — u shunda bog‘lanadi.',
    ],
    ownerBtn: 'Faollashtirish sahifasi',
    ownerNote: 'Kod bir martalik — uni hech kimga bermang.',
    manageT: 'Keyin qanday boshqariladi',
    manage: [
      ['Profilni almashtirish', 'Kabinet → «NFC karta» → «Nimani ochadi»: stiker shaxsiy yoki biznes profilingizni ochadi. Chipga qayta yozish shart emas.'],
      ['Vaqtincha o‘chirish', 'Stiker yo‘qolsa yoki kerak bo‘lmasa — o‘sha yerda «Vaqtincha o‘chirish». Keyin qayta yoqasiz.'],
      ['Ilovada', 'NFCSTORE ilovasi → «NFC markazi» → «Kartalar»: ulangan kartalar va stikerlaringiz ro‘yxati, bloklash va blokdan chiqarish.'],
      ['Ma’lumotni yangilash', 'Narx, ish vaqti, katalog va manzilni ilovada yoki saytda o‘zgartirasiz — stiker darhol yangisini ko‘rsatadi.'],
    ],
    avtoK: 'Avto stiker',
    avtoT: 'Mashina oynasiga — ichkaridan',
    avtoSteps: [
      'Oynaning ichki tomonini oyna tozalagich yoki spirt bilan artib, quriting.',
      'Joy tanlang: old oynaning pastki burchagi, yo‘lovchi tomonida — haydovchiga xalaqit bermaydi va tashqaridan qo‘l yetadi.',
      'Himoya qog‘ozini oching va stikerni yozuvi TASHQARIGA qaragan holda oynaga ichkaridan yopishtiring. Markazdan chetga siqib, pufakchalarni chiqaring.',
      'Stikerni faollashtiring va profil tanlang: shaxsiy — o‘zingiz haqingizda; biznes — mashinangiz yuradigan reklamaga aylanadi.',
      'Tekshiring: tashqaridan telefonni stikerga tekkizing — sahifangiz ochilishi kerak.',
    ],
    avtoCap: 'Tashqaridan shunday ko‘rinadi · Ø 80 mm',
    avtoNote: 'NFC oyna orqali bemalol o‘tadi. Isitish iplari va metall plyonkali (atermal) tonirovka ustiga qo‘ymang — ular signalni to‘sadi.',
    tashqiT: 'Tashqi stiker',
    tashqi: [
      'Eshik, vitrina yoki devorning tashqi tomoniga — toza, quruq va tekis yuzaga.',
      'Metall eshikka faqat «anti-metall» chipli variant ishlaydi — buyurtmada ayting.',
      'Oltin doira — NFC chip joyi. Uni boshqa stiker yoki reklama bilan to‘smang.',
    ],
    shotCap: ['Faollashtirish sahifasi', 'Ilovada: NFC markazi'],
  },
  ru: {
    kicker: 'Наклейка NFCSTORE',
    title: 'Это NFC-наклейка — приложите телефон',
    lead: 'Камеру открывать не нужно. Поднесите заднюю сторону телефона к кругу на наклейке на 1–2 секунды — страница магазина откроется сама: цены, каталог, часы работы, адрес и Telegram.',
    tapNow: 'Попробуйте прямо сейчас: приложите телефон к наклейке',
    iphone: 'iPhone',
    iphoneSteps: [
      'Экран включён и разблокирован.',
      'Поднесите верхнюю часть телефона (где камеры) к кругу.',
      'Вверху экрана появится уведомление — нажмите на него, страница откроется.',
    ],
    iphoneNote: 'На iPhone XS и новее работает само. iPhone 7–X: нажмите «Считыватель NFC-меток» в Пункте управления.',
    android: 'Android',
    androidSteps: [
      'NFC включён: проведите по экрану сверху вниз и включите значок «NFC».',
      'Приложите середину задней стороны телефона к кругу.',
      'Страница откроется в браузере — приложение не нужно.',
    ],
    androidNote: 'NFC есть почти во всех современных Android-телефонах (через него работает и бесконтактная оплата).',
    failT: 'Не открылось?',
    fail: [
      'Снимите толстый или металлический чехол.',
      'Подносите телефон медленно, к центру круга, и задержите на 1–2 секунды.',
      'Если в телефоне нет NFC — найдите магазин по названию в NFCSTORE.',
    ],
    search: 'Искать компании',
    appT: 'Приложение NFCSTORE',
    appBarP: 'Управляйте наклейками и картами, сохраняйте любимые магазины.',
    appP: 'Сохраняйте любимые магазины, создайте свою цифровую визитку и привяжите к профилю любую NFC-карту или наклейку.',
    android_btn: 'Скачать для Android',
    androidPlay: 'Скачать в Google Play',
    appStore: 'App Store',
    soon: 'Скоро',
    more: 'Подробнее о приложении',
    bizT: 'Нужна такая же наклейка для вашего бизнеса?',
    bizP: 'Даже когда вы закрыты, клиент видит ваши цены и пишет вам.',
    bizBtn: 'О наклейках',
    offNotice: 'Эта наклейка сейчас отключена — владелец временно её выключил.',
    nav: [['tekkizish', 'Как открыть'], ['ulash', 'Подключить наклейку'], ['avto', 'Автонаклейка'], ['ilova', 'Приложение']],
    ownerK: 'Для владельца наклейки или карты',
    ownerT: 'Подключить наклейку или карту к профилю — 1 минута',
    ownerSteps: [
      'Откройте конверт: внутри одноразовый код активации (NF-XXXX-XXXX).',
      'Приложите телефон к наклейке или карте — страница активации откроется сама. Или зайдите на nfcstore.uz/activate.',
      'Введите код и выберите: личный или бизнес-профиль.',
      'Зарегистрируйтесь или войдите, выберите, какой профиль будет открывать наклейка, и нажмите «Активировать».',
      'Готово. Теперь при касании откроется ваша страница. Если активировали кодом на сайте, в течение 7 дней один раз приложите телефон к наклейке — так она привяжется.',
    ],
    ownerBtn: 'Страница активации',
    ownerNote: 'Код одноразовый — никому его не передавайте.',
    manageT: 'Как управлять потом',
    manage: [
      ['Сменить профиль', 'Кабинет → «NFC-карта» → «Что открывает»: наклейка открывает личный или бизнес-профиль. Перезаписывать чип не нужно.'],
      ['Временно отключить', 'Если наклейка потерялась или не нужна — там же «Временно отключить». Потом включите обратно.'],
      ['В приложении', 'Приложение NFCSTORE → «NFC-центр» → «Карты»: список ваших карт и наклеек, блокировка и разблокировка.'],
      ['Обновить данные', 'Цены, часы работы, каталог и адрес меняете в приложении или на сайте — наклейка сразу показывает новое.'],
    ],
    avtoK: 'Автонаклейка',
    avtoT: 'На стекло машины — изнутри',
    avtoSteps: [
      'Протрите внутреннюю сторону стекла очистителем или спиртом и дайте высохнуть.',
      'Выберите место: нижний угол лобового стекла со стороны пассажира — не мешает водителю и доступно снаружи.',
      'Снимите защитную бумагу и наклейте изнутри так, чтобы надпись смотрела НАРУЖУ. Разгладьте от центра к краям, выгоняя пузырьки.',
      'Активируйте наклейку и выберите профиль: личный — о вас; бизнес — ваша машина становится ездящей рекламой.',
      'Проверьте: снаружи приложите телефон к наклейке — должна открыться ваша страница.',
    ],
    avtoCap: 'Так выглядит снаружи · Ø 80 мм',
    avtoNote: 'NFC спокойно проходит через стекло. Не клейте на нити обогрева и атермальную тонировку с металлом — они блокируют сигнал.',
    tashqiT: 'Уличная наклейка',
    tashqi: [
      'На внешнюю сторону двери, витрины или стены — на чистую, сухую и ровную поверхность.',
      'На металлическую дверь работает только вариант с «антиметалл» чипом — скажите при заказе.',
      'Золотой круг — место NFC-чипа. Не закрывайте его другими наклейками или рекламой.',
    ],
    shotCap: ['Страница активации', 'В приложении: NFC-центр'],
  },
  en: {
    kicker: 'NFCSTORE sticker',
    title: 'This is an NFC sticker — tap your phone',
    lead: 'No need to open the camera. Hold the back of your phone to the circle on the sticker for 1–2 seconds — the shop page opens by itself: prices, catalog, hours, address and Telegram.',
    tapNow: 'Try it now: tap your phone on the sticker',
    iphone: 'iPhone',
    iphoneSteps: [
      'Screen on and unlocked.',
      'Bring the top of your phone (the camera end) to the circle.',
      'A notification appears at the top — tap it and the page opens.',
    ],
    iphoneNote: 'iPhone XS and newer read it automatically. iPhone 7–X: tap “NFC Tag Reader” in Control Center.',
    android: 'Android',
    androidSteps: [
      'Make sure NFC is on: swipe down from the top and turn on “NFC”.',
      'Touch the middle of the back of your phone to the circle.',
      'The page opens in your browser — no app needed.',
    ],
    androidNote: 'Almost every modern Android phone has NFC (it’s what contactless payment uses).',
    failT: 'Didn’t open?',
    fail: [
      'Remove a thick or metal case.',
      'Move the phone slowly toward the centre of the circle and hold for 1–2 seconds.',
      'If your phone has no NFC — search for the shop by name on NFCSTORE.',
    ],
    search: 'Search businesses',
    appT: 'The NFCSTORE app',
    appBarP: 'Manage your stickers and cards, save your favourite shops.',
    appP: 'Save your favourite shops, create your own digital business card and link any NFC card or sticker to your profile.',
    android_btn: 'Download for Android',
    androidPlay: 'Get it on Google Play',
    appStore: 'App Store',
    soon: 'Coming soon',
    more: 'More about the app',
    bizT: 'Want a sticker like this for your business?',
    bizP: 'Even when you are closed, customers see your prices and message you.',
    bizBtn: 'About stickers',
    offNotice: 'This sticker is switched off for now — its owner has temporarily disabled it.',
    nav: [['tekkizish', 'How to open'], ['ulash', 'Link a sticker'], ['avto', 'Car sticker'], ['ilova', 'App']],
    ownerK: 'For sticker and card owners',
    ownerT: 'Link your sticker or card to your profile — 1 minute',
    ownerSteps: [
      'Open the envelope: inside is a one-time activation code (NF-XXXX-XXXX).',
      'Tap your phone on the sticker — the activation page opens by itself. Or go to nfcstore.uz/activate.',
      'Enter the code and choose: personal or business profile.',
      'Sign up or log in, choose which profile the sticker opens and tap “Activate”.',
      'Done. Now a tap opens your page. If you activated with the code on the website, tap the sticker once within 7 days — that links it.',
    ],
    ownerBtn: 'Activation page',
    ownerNote: 'The code is single-use — don’t share it with anyone.',
    manageT: 'Managing it later',
    manage: [
      ['Switch profile', 'Account → “NFC card” → “What it opens”: the sticker opens your personal or business profile. No need to rewrite the chip.'],
      ['Switch off temporarily', 'If the sticker is lost or not needed — “Switch off temporarily” in the same place. Turn it back on later.'],
      ['In the app', 'NFCSTORE app → “NFC Center” → “Cards”: your linked cards and stickers, block and unblock.'],
      ['Update your info', 'Change prices, hours, catalog and address in the app or on the site — the sticker shows the new version instantly.'],
    ],
    avtoK: 'Car sticker',
    avtoT: 'On the car glass — from the inside',
    avtoSteps: [
      'Wipe the inside of the glass with glass cleaner or alcohol and let it dry.',
      'Pick a spot: the lower corner of the windscreen on the passenger side — it doesn’t bother the driver and can be reached from outside.',
      'Peel off the backing and stick it on from the inside with the text facing OUTWARD. Smooth from the centre to the edges to push out bubbles.',
      'Activate the sticker and choose a profile: personal — about you; business — your car becomes a moving ad.',
      'Check it: from outside, tap your phone on the sticker — your page should open.',
    ],
    avtoCap: 'How it looks from outside · Ø 80 mm',
    avtoNote: 'NFC passes through glass easily. Don’t place it over heating lines or metallic (athermal) tint — they block the signal.',
    tashqiT: 'Outdoor sticker',
    tashqi: [
      'On the outside of a door, shop window or wall — on a clean, dry, flat surface.',
      'On metal doors only the “anti-metal” chip version works — mention it when ordering.',
      'The gold circle is where the NFC chip is. Don’t cover it with other stickers or ads.',
    ],
    shotCap: ['Activation page', 'In the app: NFC Center'],
  },
};

// Telefon stikerga yaqinlashadi, doiradan to'lqin tarqaladi. Harakatni
// kamaytirish yoqilgan bo'lsa — tinch rasm.
function TapAnimation() {
  return (
    <svg viewBox="0 0 320 230" className="nfc-tap w-full max-w-[420px]" role="img" aria-label="">
      <style>{`
        .nfc-tap .ph{animation:nfcTapMove 3.2s ease-in-out infinite}
        .nfc-tap .rg{animation:nfcTapRing 3.2s ease-out infinite;transform-box:fill-box;transform-origin:center;opacity:0}
        .nfc-tap .rg2{animation-delay:.35s}
        @keyframes nfcTapMove{0%,100%{transform:translate(58px,14px)}40%,62%{transform:translate(0,0)}}
        @keyframes nfcTapRing{0%,38%{opacity:0;transform:scale(.7)}48%{opacity:.95}82%,100%{opacity:0;transform:scale(1.5)}}
        @media (prefers-reduced-motion:reduce){.nfc-tap .ph{animation:none}.nfc-tap .rg{animation:none;opacity:.45}}
      `}</style>
      {/* stiker: oltin doira — NFC chip joyi */}
      <rect x="18" y="34" width="168" height="168" rx="16" fill="#0b0b0b" stroke="#c9a55a" strokeWidth="2.5" />
      <rect x="36" y="52" width="74" height="8" rx="4" fill="#c9a55a" opacity=".9" />
      <rect x="36" y="67" width="50" height="5" rx="2.5" fill="#f3ead3" opacity=".55" />
      <circle cx="112" cy="132" r="46" fill="none" stroke="#c9a55a" strokeWidth="1.6" opacity=".4" />
      <circle cx="112" cy="132" r="33" fill="none" stroke="#c9a55a" strokeWidth="2" opacity=".75" />
      <circle cx="112" cy="132" r="21" fill="#c9a55a" />
      <g fill="none" stroke="#0b0b0b" strokeWidth="2.6" strokeLinecap="round">
        <path d="M105 126a7 7 0 0 1 0 12" /><path d="M110 121a13 13 0 0 1 0 22" /><path d="M115 116a19 19 0 0 1 0 32" />
      </g>
      <circle className="rg" cx="112" cy="132" r="48" fill="none" stroke="#e4c97a" strokeWidth="3" />
      <circle className="rg rg2" cx="112" cy="132" r="48" fill="none" stroke="#e4c97a" strokeWidth="2" />
      {/* telefon: yuqori qismi doiraga tegadi, doira ko'rinib turadi */}
      <g className="ph">
        <g transform="translate(128 70) rotate(-16)">
          <rect x="0" y="0" width="80" height="152" rx="15" fill="#1b1a17" stroke="#4a463e" strokeWidth="2.5" />
          <rect x="6" y="8" width="68" height="136" rx="10" fill="#efebe3" />
          <rect x="16" y="24" width="48" height="7" rx="3.5" fill="#171716" opacity=".75" />
          <rect x="16" y="38" width="34" height="5" rx="2.5" fill="#171716" opacity=".35" />
          <rect x="16" y="116" width="48" height="14" rx="7" fill="#171716" opacity=".85" />
        </g>
      </g>
    </svg>
  );
}

// Ilovani yuklash — sahifaning yuqorisida ham, pastida ham. iPhone'da APK
// tugmasi ko'rsatilmaydi (o'rnatib bo'lmaydi), App Store — "Tez kunda".
function AppButtons({ c, ios, compact = false }) {
  const androidHref = PLAY_STORE_LIVE ? PLAY_STORE_URL : APP_APK_URL;
  const h = compact ? 'min-h-11' : 'min-h-12';
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {!ios && (
        <a href={androidHref} rel="noopener noreferrer" target={PLAY_STORE_LIVE ? '_blank' : undefined} className={`btn btn-gold ${h} px-5 no-underline`} data-testid="nfc-help-android">
          {PLAY_STORE_LIVE ? c.androidPlay : c.android_btn}
        </a>
      )}
      {APP_STORE_URL ? (
        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={`btn btn-outline ${h} rounded-full px-5 no-underline`}>{c.appStore}</a>
      ) : (
        <span className={`inline-flex ${h} items-center gap-2 rounded-full border border-[color:var(--vz-line)] px-4 text-[14px] font-semibold text-[color:var(--vz-ink-2)]`} aria-disabled="true">
          {c.appStore}
          <span className="rounded-full bg-[var(--accent-a14)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--accent-text)]">{c.soon}</span>
        </span>
      )}
    </div>
  );
}

function Steps({ items }) {
  return (
    <ol className="mt-4 space-y-3">
      {items.map((s, i) => (
        <li key={s} className="flex gap-3 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--vz-ink)] text-[13px] font-bold text-[color:var(--vz-bg,var(--bg-primary))]">{i + 1}</span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export default function NfcStickerHelpPage() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.uz;
  const ios = isIos();
  // iPhone'dan kirgan odamga iPhone ko'rsatmasi birinchi turadi.
  const guides = [
    { key: 'ios', title: c.iphone, steps: c.iphoneSteps, note: c.iphoneNote },
    { key: 'android', title: c.android, steps: c.androidSteps, note: c.androidNote },
  ];
  if (!ios) guides.reverse();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const stickerOff = params?.get('stiker') === 'ochiq-emas';

  // Avto stikerdagi QR (/qr-1) bu sahifani #avto bilan ochadi — SPA'da
  // brauzer o'zi aylantirmaydi, shuning uchun sahifa chizilgach o'tamiz.
  useEffect(() => {
    const id = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    if (!id) return undefined;
    const tm = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => clearTimeout(tm);
  }, []);
  const jump = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pb-20 sm:px-10">
      {stickerOff && (
        <div className="mt-6 rounded-[var(--vz-radius)] border border-[color:var(--accent-primary)]/40 bg-[var(--accent-a14)] px-5 py-4 text-[15px] font-semibold text-[color:var(--vz-ink)]" role="status" data-testid="nfc-sticker-off">{c.offNotice}</div>
      )}
      <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="">
        {c.nav.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={jump(id)} className="shrink-0 rounded-full border border-[color:var(--vz-line)] px-4 py-2 text-[14px] font-semibold text-[color:var(--vz-ink)] no-underline hover:border-[color:var(--accent-primary)]">{label}</a>
        ))}
      </nav>
      <section id="tekkizish" className="grid scroll-mt-24 items-center gap-8 pt-6 md:grid-cols-[1.1fr_.9fr] md:pt-10">
        <div className="flex flex-col items-start gap-4">
          <span className="vz-kicker">{c.kicker}</span>
          <h1 className="vz-h1 max-w-[16ch] text-[color:var(--vz-ink)]">{c.title}</h1>
          <p className="max-w-[54ch] text-[17px] leading-relaxed text-[color:var(--vz-ink-2)]">{c.lead}</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <TapAnimation />
          <p className="text-center text-[14px] font-semibold text-[color:var(--accent-text)]">{c.tapNow}</p>
        </div>
      </section>

      {/* ── ILOVANI YUKLASH — birinchi ekranda ── */}
      <section className="mt-8 flex flex-col gap-4 rounded-[var(--vz-radius)] border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="nfc-help-appbar">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0b0b0b] text-[#c9a55a]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 9.5a4 4 0 0 1 0 5M10 7.5a7 7 0 0 1 0 9M13 5.5a10 10 0 0 1 0 13" /></svg>
          </span>
          <div>
            <div className="text-[16px] font-bold text-[color:var(--vz-ink)]">{c.appT}</div>
            <div className="text-[13px] text-[color:var(--vz-ink-2)]">{c.appBarP}</div>
          </div>
        </div>
        <AppButtons c={c} ios={ios} compact />
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {guides.map((g) => (
          <article key={g.key} className="vz-card p-6" data-testid={`nfc-guide-${g.key}`}>
            <h2 className="text-[20px] font-bold text-[color:var(--vz-ink)]">{g.title}</h2>
            <Steps items={g.steps} />
            <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--vz-ink-2)]">{g.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-[var(--vz-radius)] border border-[color:var(--vz-line)] p-6">
        <h2 className="text-[18px] font-bold text-[color:var(--vz-ink)]">{c.failT}</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">
          {c.fail.map((f) => <li key={f} className="flex gap-2"><span aria-hidden="true" className="text-[color:var(--accent-text)]">•</span>{f}</li>)}
        </ul>
        <button type="button" onClick={() => navigate('/kompaniyalar')} className="btn btn-outline mt-4 min-h-11 rounded-full px-5">{c.search} →</button>
      </section>

      {/* ── STIKER EGASI: ULASH ── */}
      <section id="ulash" className="mt-16 scroll-mt-24">
        <span className="vz-kicker">{c.ownerK}</span>
        <h2 className="vz-h2 mt-3 text-[color:var(--vz-ink)]">{c.ownerT}</h2>
        <div className="mt-8 grid items-start gap-8 md:grid-cols-[1.2fr_.8fr]">
          <div>
            <Steps items={c.ownerSteps} />
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => navigate('/activate')} className="btn btn-gold min-h-12 px-6">{c.ownerBtn} →</button>
              <span className="text-[13px] text-[color:var(--vz-ink-2)]">{c.ownerNote}</span>
            </div>
            <h3 className="mt-10 text-[20px] font-bold text-[color:var(--vz-ink)]">{c.manageT}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {c.manage.map(([h, p]) => (
                <div key={h} className="vz-card p-5">
                  <h4 className="text-[15px] font-bold text-[color:var(--vz-ink)]">{h}</h4>
                  <p className="mt-1 text-[14px] leading-relaxed text-[color:var(--vz-ink-2)]">{p}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <figure className="m-0"><PhoneShot src="/ilova/faollashtirish.jpg" alt={c.shotCap[0]} /><figcaption className="mt-3 text-center text-[13px] font-semibold text-[color:var(--vz-ink-2)]">{c.shotCap[0]}</figcaption></figure>
            <figure className="m-0"><PhoneShot src="/ilova/nfc.jpg" alt={c.shotCap[1]} /><figcaption className="mt-3 text-center text-[13px] font-semibold text-[color:var(--vz-ink-2)]">{c.shotCap[1]}</figcaption></figure>
          </div>
        </div>
      </section>

      {/* ── AVTO STIKER (avto stikerdagi QR shu yerga olib keladi) ── */}
      <section id="avto" className="mt-16 scroll-mt-24">
        <span className="vz-kicker">{c.avtoK}</span>
        <h2 className="vz-h2 mt-3 text-[color:var(--vz-ink)]">{c.avtoT}</h2>
        <div className="mt-8 grid items-start gap-8 md:grid-cols-[1.2fr_.8fr]">
          <div>
            <Steps items={c.avtoSteps} />
            <p className="mt-5 rounded-[var(--vz-radius)] border border-[color:var(--vz-line)] p-4 text-[14px] leading-relaxed text-[color:var(--vz-ink-2)]">{c.avtoNote}</p>
          </div>
          <figure className="m-0 flex flex-col items-center gap-4 rounded-[var(--vz-radius)] bg-[radial-gradient(90%_70%_at_50%_40%,rgba(214,178,94,.14),transparent_70%),linear-gradient(160deg,#171613,#0a0a09)] px-6 py-8">
            <img src="/stikerlar/oyna-nfc.png" alt={c.avtoK} loading="lazy" className="w-[72%] max-w-[300px] drop-shadow-[0_18px_30px_rgba(0,0,0,.7)]" />
            <figcaption className="text-center text-[13px] font-semibold text-[#f4efe4]/75">{c.avtoCap}</figcaption>
          </figure>
        </div>
        <div className="vz-card mt-6 p-6">
          <h3 className="text-[18px] font-bold text-[color:var(--vz-ink)]">{c.tashqiT}</h3>
          <ul className="mt-3 grid gap-2 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)] md:grid-cols-3 md:gap-5">
            {c.tashqi.map((x) => <li key={x} className="flex gap-2"><span aria-hidden="true" className="text-[color:var(--accent-text)]">•</span>{x}</li>)}
          </ul>
        </div>
      </section>

      <section id="ilova" className="mt-16 grid scroll-mt-24 gap-4 md:grid-cols-2">
        <article className="vz-card flex flex-col items-start gap-3 p-6">
          <h2 className="vz-h2 text-[color:var(--vz-ink)]">{c.appT}</h2>
          <p className="text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{c.appP}</p>
          <div className="mt-2"><AppButtons c={c} ios={ios} /></div>
          <button type="button" onClick={() => navigate(APP_PAGE_PATH)} className="mt-1 text-[14px] font-semibold text-[color:var(--accent-text)]">{c.more} →</button>
        </article>
        <article className="vz-card flex flex-col items-start gap-3 p-6">
          <h2 className="vz-h2 text-[color:var(--vz-ink)]">{c.bizT}</h2>
          <p className="text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{c.bizP}</p>
          <button type="button" onClick={() => navigate('/stikerlar')} className="btn btn-outline mt-auto min-h-12 rounded-full px-6">{c.bizBtn} →</button>
        </article>
      </section>
    </main>
  );
}
