import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { APP_APK_URL, APP_STORE_URL, PLAY_STORE_LIVE, PLAY_STORE_URL, isIos } from '../lib/appDownload.js';
import { PhoneShot, PhoneRow } from '../components/PhoneShot.jsx';

// ═══════════════════════════════════════════════════════════════════════
// NFCSTORE ILOVASI — nfcstore.uz/ilova-yuklash (egasi, 2026-09-26)
//
// "Ilova bo'limiga ilovaning imkoniyatlarini hammasini yoz, odamni jalb
// qilsin. App Store ham tez kunda de, Android'ga yuklab olish bo'lsin.
// Boshqa ilovalardan afzalliklari."
//
// Faqat HAQIQATDA bor imkoniyatlar yoziladi. Rasmlar — Play Market'dagi
// haqiqiy skrinshotlar (public/ilova, asl nisbatda, components/PhoneShot).
// Android tugmasi: Play'da hammaga ochilguncha — Play imzolagan APK
// (src/lib/appDownload.js); PLAY_STORE_LIVE=true bo'lgach — Play sahifasi.
// iPhone'da APK tugmasi ko'rsatilmaydi, App Store "Tez kunda".
// ═══════════════════════════════════════════════════════════════════════

const ICONS = {
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 10h5M7 14h3M16 10.5a1.5 1.5 0 1 0 0 .01',
  nfc: 'M6 8.5a6 6 0 0 1 0 7M9 6a9.5 9.5 0 0 1 0 12M12.5 4a13 13 0 0 1 0 16M16 7l4 5-4 5',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  swap: 'M7 7h11l-3-3M17 17H6l3 3',
  shop: 'M4 9l1.5-5h13L20 9M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM9 20v-6h6v6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  play: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM10 9l5 3-5 3z',
  music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  id: 'M4 6h16v12H4zM8 10h.01M8 14h8M12 10h4',
  theme: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3M12 15v2',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
};

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const CONTENT = {
  uz: {
    kicker: 'NFCSTORE ilovasi · Android',
    title: 'Butun NFC dunyongiz — bitta ilovada',
    lead: 'Raqamli vizitka, NFC karta va stikerlar, shaxsiy va biznes profil, katalog va Reels. Telefonni tekkizing — tanishuv boshlandi.',
    android: 'Android uchun yuklab olish',
    androidPlay: 'Google Play’dan yuklab olish',
    appStore: 'App Store',
    soon: 'Tez kunda',
    meta: 'Bepul · Google Play imzosi bilan · o‘zbek, rus, ingliz tilida',
    iosNote: 'iPhone ilovasi tez kunda App Store’da chiqadi. Shu vaqtgacha profilingiz saytda to‘liq ishlaydi, iPhone esa NFC stiker va kartalarni ilovasiz o‘qiydi.',
    stats: [['NFC + QR', 'har qanday telefonda'], ['2 profil', 'shaxsiy va biznes'], ['3 til', 'uz · ru · en'], ['0 so‘m', 'boshlash bepul']],
    featK: 'Imkoniyatlar',
    featT: 'Ilovada nimalar bor',
    features: [
      ['card', 'Raqamli vizitka', 'Ism, kasb, telefon, Telegram va Instagram — bitta sahifada. Mijoz kontaktingizni bir tugmada telefoniga saqlaydi.'],
      ['nfc', 'NFC markazi', 'Istalgan NFC karta, stiker yoki brelokni profilingizga bog‘lang — ilova o‘zi yozadi, telefonni tekkizish kifoya.'],
      ['qr', 'NFC yo‘q telefonda ham', 'QR kodni ko‘rsating yoki havolani Telegram, SMS orqali yuboring — profilingiz baribir ochiladi.'],
      ['swap', 'Shaxsiy va biznes profil', 'Bitta hisobda ikkalasi. Bir tugma bilan almashtirasiz, kartaning qaysi profilni ochishini o‘zingiz tanlaysiz.'],
      ['shop', 'Biznes katalogi', 'Mahsulot va xizmatlar, narx va aksiyalar, ish vaqti, «Hozir ochiq» belgisi, manzil. Narxni telefondan o‘zgartirasiz.'],
      ['search', 'Tanlov — umumiy katalog', 'Odamlar, bizneslar va mahsulotlarni bir joyda qidiradi. Mijozlar sizni o‘zlari topadi.'],
      ['play', 'Lenta, Reels va storislar', 'Ishingizni rasm va video bilan ko‘rsating, obunachilar yig‘ing, izohlarga javob bering.'],
      ['music', 'Profilga musiqa', 'Sahifangizga kayfiyat qo‘shing — mehmon profilingizda sevimli musiqangizni tinglaydi.'],
      ['chart', 'Statistika', 'Nechta odam ko‘rgani, obunachi va postlar soni — hammasi bir qarashda.'],
      ['id', 'NFC ID', 'Esda qoladigan shaxsiy ID tanlang — nfcstore.uz/ID havolasi faqat sizniki.'],
      ['theme', 'Ivory va Noir mavzulari', 'Sutdek och Ivory yoki oltin chiziqli tungi Noir. Ko‘zni charchatmaydi.'],
      ['lock', 'Xavfsizlik', 'PIN va barmoq izi bilan qulf. Hisobni o‘chirish ham ilovaning o‘zida — yashirin shartlarsiz.'],
    ],
    shotsK: 'Ilova ichidan',
    shotsT: 'Qanday ko‘rinadi — haqiqiy ekranlar',
    shots: ['Bir tegishda tanishuv', 'NFC markazi', 'Tanlov: odamlar va bizneslar', 'Sizning profilingiz'],
    whyK: 'Afzalliklar',
    whyT: 'Oddiy vizitka ilovalaridan farqi',
    why: [
      ['Istalgan NFC kartani bog‘laysiz', 'Faqat bizning kartamiz emas — qo‘lingizdagi istalgan NFC karta, stiker yoki brelok ishlaydi.'],
      ['Vizitka emas — tayyor mini-sayt', 'Biznesingiz uchun katalog, narxlar, ish vaqti va manzil. Alohida sayt qildirish shart emas.'],
      ['Ijtimoiy tarmoq ichida', 'Lenta, Reels, obunachilar va izohlar — profilingiz jonli, har kuni yangilanadi.'],
      ['O‘zbekiston uchun qilingan', 'O‘zbek tilida, mahalliy bizneslar uchun, qo‘llab-quvvatlash Telegram’da o‘zimizdan.'],
      ['Sayt bilan bitta hisob', 'Ilovada nima o‘zgartirsangiz — nfcstore.uz dagi sahifangizda darhol ko‘rinadi.'],
      ['Stikerlar bilan birga ishlaydi', 'Do‘kon eshigi yoki mashina oynasidagi NFC stikerni ilovadan boshqarasiz.'],
    ],
    stickerT: 'Do‘kon yoki mashinangiz uchun NFC stiker kerakmi?',
    stickerP: 'Stikerni ilovada profilingizga bog‘laysiz — yopiq paytda ham mijoz narxlaringizni ko‘radi.',
    stickerBtn: 'Stikerlarni ko‘rish',
    stepsT: 'Android’ga qanday o‘rnatiladi',
    steps: [
      '«Android uchun yuklab olish» tugmasini bosing — fayl telefoningizga tushadi.',
      'Faylni oching. Telefon so‘rasa, brauzerga «noma’lum manbalardan o‘rnatish»ga ruxsat bering.',
      '«O‘rnatish»ni bosing. Play Protect ogohlantirsa — «Baribir o‘rnatish»ni tanlang.',
      'Ilovani oching va NFCSTORE hisobingiz bilan kiring yoki bepul ro‘yxatdan o‘ting.',
    ],
    stepsNote: 'Fayl Google Play imzosi bilan — ilova Play Market’da hammaga ochilgach, uni o‘chirmasdan Play orqali yangilaysiz. Savol bo‘lsa: @nfcstore_admin',
    finalT: 'Tanishuvning yangi usuli — cho‘ntagingizda',
    finalP: 'Bepul yuklab oling, bir necha daqiqada profil oching va birinchi kartangizni bog‘lang.',
  },
  ru: {
    kicker: 'Приложение NFCSTORE · Android',
    title: 'Весь ваш NFC-мир — в одном приложении',
    lead: 'Цифровая визитка, NFC-карты и наклейки, личный и бизнес-профиль, каталог и Reels. Приложите телефон — знакомство началось.',
    android: 'Скачать для Android',
    androidPlay: 'Скачать в Google Play',
    appStore: 'App Store',
    soon: 'Скоро',
    meta: 'Бесплатно · подписано Google Play · на узбекском, русском и английском',
    iosNote: 'Приложение для iPhone скоро появится в App Store. А пока ваш профиль полностью работает на сайте, и iPhone читает NFC-наклейки и карты без приложения.',
    stats: [['NFC + QR', 'на любом телефоне'], ['2 профиля', 'личный и бизнес'], ['3 языка', 'uz · ru · en'], ['0 сум', 'начать бесплатно']],
    featK: 'Возможности',
    featT: 'Что есть в приложении',
    features: [
      ['card', 'Цифровая визитка', 'Имя, профессия, телефон, Telegram и Instagram — на одной странице. Клиент сохраняет ваш контакт одной кнопкой.'],
      ['nfc', 'NFC-центр', 'Привяжите к профилю любую NFC-карту, наклейку или брелок — приложение запишет само, достаточно приложить телефон.'],
      ['qr', 'Даже без NFC', 'Покажите QR-код или отправьте ссылку в Telegram, SMS — профиль всё равно откроется.'],
      ['swap', 'Личный и бизнес-профиль', 'Оба в одном аккаунте. Переключение одной кнопкой, а какой профиль открывает карта — решаете вы.'],
      ['shop', 'Бизнес-каталог', 'Товары и услуги, цены и акции, часы работы, значок «Сейчас открыто», адрес. Цены меняете с телефона.'],
      ['search', 'Выбор — общий каталог', 'Люди, компании и товары в одном поиске. Клиенты находят вас сами.'],
      ['play', 'Лента, Reels и сторис', 'Показывайте работу в фото и видео, набирайте подписчиков, отвечайте на комментарии.'],
      ['music', 'Музыка в профиле', 'Добавьте настроение — гость послушает вашу любимую музыку прямо в профиле.'],
      ['chart', 'Статистика', 'Сколько людей посмотрели, подписчики и публикации — всё с одного взгляда.'],
      ['id', 'NFC ID', 'Выберите запоминающийся ID — ссылка nfcstore.uz/ID только ваша.'],
      ['theme', 'Темы Ivory и Noir', 'Молочная Ivory или ночная Noir с золотыми линиями. Глаза не устают.'],
      ['lock', 'Безопасность', 'Блокировка PIN-кодом и отпечатком. Удаление аккаунта — тоже прямо в приложении, без скрытых условий.'],
    ],
    shotsK: 'Внутри приложения',
    shotsT: 'Как это выглядит — настоящие экраны',
    shots: ['Знакомство в одно касание', 'NFC-центр', 'Выбор: люди и компании', 'Ваш профиль'],
    whyK: 'Преимущества',
    whyT: 'Чем отличается от обычных приложений-визиток',
    why: [
      ['Любая NFC-карта', 'Не только наша карта — работает любая NFC-карта, наклейка или брелок, который у вас есть.'],
      ['Не визитка, а готовый мини-сайт', 'Каталог, цены, часы работы и адрес для бизнеса. Отдельный сайт заказывать не нужно.'],
      ['Внутри соцсети', 'Лента, Reels, подписчики и комментарии — ваш профиль живой и обновляется каждый день.'],
      ['Сделано для Узбекистана', 'На узбекском языке, для местного бизнеса, поддержка в Telegram — от нас напрямую.'],
      ['Один аккаунт с сайтом', 'Всё, что вы меняете в приложении, сразу видно на вашей странице на nfcstore.uz.'],
      ['Работает с наклейками', 'NFC-наклейкой на двери магазина или стекле машины управляете из приложения.'],
    ],
    stickerT: 'Нужна NFC-наклейка для магазина или машины?',
    stickerP: 'Привяжите наклейку к профилю в приложении — клиент увидит ваши цены даже когда вы закрыты.',
    stickerBtn: 'Смотреть наклейки',
    stepsT: 'Как установить на Android',
    steps: [
      'Нажмите «Скачать для Android» — файл загрузится на телефон.',
      'Откройте файл. Если телефон спросит, разрешите браузеру «установку из неизвестных источников».',
      'Нажмите «Установить». Если Play Защита предупредит — выберите «Всё равно установить».',
      'Откройте приложение и войдите в аккаунт NFCSTORE или зарегистрируйтесь бесплатно.',
    ],
    stepsNote: 'Файл подписан Google Play — когда приложение откроется для всех в Play Маркете, вы обновите его через Play без удаления. Вопросы: @nfcstore_admin',
    finalT: 'Новый способ знакомиться — в вашем кармане',
    finalP: 'Скачайте бесплатно, откройте профиль за несколько минут и привяжите первую карту.',
  },
  en: {
    kicker: 'NFCSTORE app · Android',
    title: 'Your whole NFC world — in one app',
    lead: 'Digital business card, NFC cards and stickers, personal and business profiles, catalog and Reels. Tap a phone — the introduction has begun.',
    android: 'Download for Android',
    androidPlay: 'Get it on Google Play',
    appStore: 'App Store',
    soon: 'Coming soon',
    meta: 'Free · signed by Google Play · in Uzbek, Russian and English',
    iosNote: 'The iPhone app is coming soon to the App Store. Until then your profile works fully on the website, and iPhone reads NFC stickers and cards without an app.',
    stats: [['NFC + QR', 'on any phone'], ['2 profiles', 'personal and business'], ['3 languages', 'uz · ru · en'], ['Free', 'to get started']],
    featK: 'Features',
    featT: 'What’s inside the app',
    features: [
      ['card', 'Digital business card', 'Name, job, phone, Telegram and Instagram — on one page. Customers save your contact with one button.'],
      ['nfc', 'NFC Center', 'Link any NFC card, sticker or key fob to your profile — the app writes it for you, just tap your phone.'],
      ['qr', 'Even without NFC', 'Show your QR code or send your link via Telegram or SMS — your profile still opens.'],
      ['swap', 'Personal and business profiles', 'Both in one account. Switch with one button and choose which profile your card opens.'],
      ['shop', 'Business catalog', 'Products and services, prices and deals, hours, an “Open now” badge and address. Change prices from your phone.'],
      ['search', 'Discover — shared catalog', 'People, businesses and products in one search. Customers find you on their own.'],
      ['play', 'Feed, Reels and stories', 'Show your work in photos and video, grow followers, reply to comments.'],
      ['music', 'Music on your profile', 'Add a mood — visitors can play your favourite music right on your profile.'],
      ['chart', 'Statistics', 'Views, followers and posts — all at a glance.'],
      ['id', 'NFC ID', 'Pick a memorable ID — the nfcstore.uz/ID link is yours alone.'],
      ['theme', 'Ivory and Noir themes', 'Milky Ivory or night Noir with gold accents. Easy on the eyes.'],
      ['lock', 'Security', 'PIN and fingerprint lock. Account deletion is right in the app too — no hidden conditions.'],
    ],
    shotsK: 'Inside the app',
    shotsT: 'What it looks like — real screens',
    shots: ['Meet in one tap', 'NFC Center', 'Discover: people and businesses', 'Your profile'],
    whyK: 'Advantages',
    whyT: 'How it differs from ordinary business card apps',
    why: [
      ['Any NFC card', 'Not just our card — any NFC card, sticker or key fob you already have works.'],
      ['Not a card — a ready mini-site', 'Catalog, prices, hours and address for your business. No need to order a separate website.'],
      ['Inside a social network', 'Feed, Reels, followers and comments — your profile is alive and updated every day.'],
      ['Made for Uzbekistan', 'In Uzbek, for local businesses, with support on Telegram directly from us.'],
      ['One account with the site', 'Whatever you change in the app shows up on your nfcstore.uz page instantly.'],
      ['Works with stickers', 'Manage the NFC sticker on your shop door or car glass from the app.'],
    ],
    stickerT: 'Need an NFC sticker for your shop or car?',
    stickerP: 'Link the sticker to your profile in the app — customers see your prices even when you are closed.',
    stickerBtn: 'See stickers',
    stepsT: 'How to install on Android',
    steps: [
      'Tap “Download for Android” — the file lands on your phone.',
      'Open the file. If asked, allow your browser to “install unknown apps”.',
      'Tap “Install”. If Play Protect warns you — choose “Install anyway”.',
      'Open the app and sign in with your NFCSTORE account or register for free.',
    ],
    stepsNote: 'The file is signed by Google Play — once the app is public on Play, you update it through Play without reinstalling. Questions: @nfcstore_admin',
    finalT: 'A new way to meet — in your pocket',
    finalP: 'Download for free, open a profile in minutes and link your first card.',
  },
};

// Play belgisi (uchburchak) va Apple belgisi — tugmalar uchun.
const PlayMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="currentColor" d="M4.5 2.8 13.9 12l-9.4 9.2c-.3-.2-.5-.6-.5-1V3.8c0-.4.2-.8.5-1zm10.6 10.4 2.3 2.2-10.6 6 8.3-8.2zm4.3-3.4c.9.5.9 1.8 0 2.3l-2.5 1.4L14.5 12l2.4-2.3 2.5 1.4zM6.8 2.6l10.6 6-2.3 2.2-8.3-8.2z" /></svg>
);
const AppleMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-1-2.4-3.9zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z" /></svg>
);

function StoreButtons({ c, ios }) {
  const androidHref = PLAY_STORE_LIVE ? PLAY_STORE_URL : APP_APK_URL;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!ios && (
        <a href={androidHref} rel="noopener noreferrer" target={PLAY_STORE_LIVE ? '_blank' : undefined} className="btn btn-gold min-h-[52px] gap-2.5 px-7 text-[15px] no-underline" data-testid="app-android">
          <PlayMark />{PLAY_STORE_LIVE ? c.androidPlay : c.android}
        </a>
      )}
      {APP_STORE_URL ? (
        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline min-h-[52px] gap-2.5 rounded-full px-6 text-[15px] no-underline"><AppleMark />{c.appStore}</a>
      ) : (
        <span className="inline-flex min-h-[52px] cursor-default items-center gap-2.5 rounded-full border border-[color:var(--vz-line)] px-6 text-[15px] font-semibold text-[color:var(--vz-ink-2)]" aria-disabled="true" data-testid="app-ios-soon">
          <AppleMark />{c.appStore}
          <span className="rounded-full bg-[var(--accent-a14)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--accent-text)]">{c.soon}</span>
        </span>
      )}
    </div>
  );
}

export default function AppDownloadPage() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.uz;
  const ios = isIos();

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 pb-20 sm:px-10 lg:px-14">
      {/* ── HERO ── */}
      <section className="grid items-center gap-12 pt-10 md:pt-14 lg:grid-cols-[1.05fr_.95fr]">
        <div className="flex flex-col items-start gap-6">
          <span className="vz-kicker">{c.kicker}</span>
          <h1 className="vz-h1 max-w-[15ch] text-[color:var(--vz-ink)]">{c.title}</h1>
          <p className="max-w-[56ch] text-[17px] leading-relaxed text-[color:var(--vz-ink-2)]">{c.lead}</p>
          <StoreButtons c={c} ios={ios} />
          {ios
            ? <p className="max-w-[56ch] rounded-2xl border border-[color:var(--vz-line)] p-4 text-[14px] leading-relaxed text-[color:var(--vz-ink-2)]">{c.iosNote}</p>
            : <p className="text-[13px] text-[color:var(--vz-ink-2)]">{c.meta}</p>}
        </div>
        {/* Uch telefon: o'rtadagisi oldinda. Kichik ekranda faqat o'rtadagi. */}
        <div className="relative mx-auto flex w-full max-w-[560px] items-center justify-center">
          <PhoneShot src="/ilova/nfc.jpg" alt="" className="absolute left-0 top-1/2 hidden w-[36%] -translate-y-1/2 opacity-95 sm:block" />
          <PhoneShot src="/ilova/profil.jpg" alt="" className="absolute right-0 top-1/2 hidden w-[36%] -translate-y-1/2 opacity-95 sm:block" />
          <PhoneShot src="/ilova/start.jpg" alt="NFCSTORE" eager className="relative z-[1] w-[64%] max-w-[300px] sm:w-[44%]" />
        </div>
      </section>

      {/* ── RAQAMLAR ── */}
      <section className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--vz-radius)] border border-[color:var(--vz-line)] bg-[color:var(--vz-line)] md:grid-cols-4">
        {c.stats.map(([big, small]) => (
          <div key={big} className="bg-[color:var(--vz-bg,var(--bg-primary))] px-5 py-6 text-center">
            <div className="font-[family-name:var(--font-display)] text-[28px] font-semibold text-[color:var(--vz-ink)]">{big}</div>
            <div className="mt-1 text-[13px] text-[color:var(--vz-ink-2)]">{small}</div>
          </div>
        ))}
      </section>

      {/* ── IMKONIYATLAR ── */}
      <section className="mt-16 md:mt-24">
        <span className="vz-kicker">{c.featK}</span>
        <h2 className="vz-h2 mt-3 text-[color:var(--vz-ink)]">{c.featT}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.features.map(([icon, h, p]) => (
            <article key={h} className="vz-card flex gap-4 p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--vz-line)] text-[color:var(--accent-text)]"><Icon name={icon} /></span>
              <div>
                <h3 className="text-[17px] font-bold text-[color:var(--vz-ink)]">{h}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{p}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── HAQIQIY EKRANLAR ── */}
      <section className="mt-16 md:mt-24">
        <span className="vz-kicker">{c.shotsK}</span>
        <h2 className="vz-h2 mt-3 text-[color:var(--vz-ink)]">{c.shotsT}</h2>
        <div className="mx-auto mt-10 max-w-[1240px]">
          <PhoneRow items={[
            { src: '/ilova/start.jpg', alt: '', cap: c.shots[0] },
            { src: '/ilova/nfc.jpg', alt: '', cap: c.shots[1] },
            { src: '/ilova/tanlov.jpg', alt: '', cap: c.shots[2] },
            { src: '/ilova/profil.jpg', alt: '', cap: c.shots[3] },
          ]} />
        </div>
      </section>

      {/* ── AFZALLIKLAR ── */}
      <section className="mt-16 md:mt-24">
        <span className="vz-kicker">{c.whyK}</span>
        <h2 className="vz-h2 mt-3 max-w-[26ch] text-[color:var(--vz-ink)]">{c.whyT}</h2>
        <div className="mt-8 grid gap-x-10 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
          {c.why.map(([h, p]) => (
            <div key={h} className="flex gap-3.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-a14)] text-[color:var(--accent-text)]"><Icon name="check" className="h-4 w-4" /></span>
              <div>
                <h3 className="text-[17px] font-bold text-[color:var(--vz-ink)]">{h}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{p}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── STIKERLAR BILAN ── */}
      <section className="vz-card mt-16 grid items-center gap-6 overflow-hidden p-6 sm:p-8 md:mt-24 md:grid-cols-[auto_1fr_auto]">
        <img src="/stikerlar/oyna.png" alt="" loading="lazy" className="h-24 w-24 drop-shadow-[0_10px_20px_rgba(0,0,0,.45)]" />
        <div>
          <h2 className="text-[22px] font-bold text-[color:var(--vz-ink)]">{c.stickerT}</h2>
          <p className="mt-1 text-[15px] text-[color:var(--vz-ink-2)]">{c.stickerP}</p>
        </div>
        <button type="button" onClick={() => navigate('/stikerlar')} className="btn btn-outline min-h-12 rounded-full px-6">{c.stickerBtn} →</button>
      </section>

      {/* ── O'RNATISH (faqat Android, APK bosqichida) ── */}
      {!ios && !PLAY_STORE_LIVE && (
        <section className="mt-16 max-w-3xl md:mt-24">
          <h2 className="vz-h2 text-[color:var(--vz-ink)]">{c.stepsT}</h2>
          <ol className="mt-6 space-y-4">
            {c.steps.map((s, i) => (
              <li key={s} className="flex gap-4 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--vz-ink)] text-[14px] font-bold text-[color:var(--vz-bg,var(--bg-primary))]">{i + 1}</span>
                <span className="pt-1">{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[13px] text-[color:var(--vz-ink-2)]">{c.stepsNote}</p>
        </section>
      )}

      {/* ── YAKUNIY CHAQIRUV ── */}
      <section className="mt-16 flex flex-col items-start gap-5 md:mt-24">
        <h2 className="vz-h2 max-w-[24ch] text-[color:var(--vz-ink)]">{c.finalT}</h2>
        <p className="text-[16px] text-[color:var(--vz-ink-2)]">{c.finalP}</p>
        <StoreButtons c={c} ios={ios} />
      </section>
    </main>
  );
}
