import { useEffect, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { APP_PAGE_PATH } from '../lib/appDownload.js';
import { PhoneRow } from '../components/PhoneShot.jsx';

// ═══════════════════════════════════════════════════════════════════════
// STIKERLAR DO'KONI — nfcstore.uz/stikerlar (egasi, 2026-09-26)
//
// "Ko'rgan odam foydali ekan, olishim kerak ekan desin." Sahifa sotadi:
// avval foyda (yopiq paytda ham savdo, qog'oz narx kerak emas), keyin
// mahsulotlar, telefonda nima ochilishi (haqiqiy profil rasmlari),
// ilova va savol-javob.
//
// NARXLAR QATTIQ YOZILMAYDI — NFCSTORE biznes katalogidan (/c/nfcstoreuz)
// jonli olinadi: admin narxni o'zgartirsa, bu sahifa ham o'zgaradi.
// Buyurtma katalogda o'chiq, shuning uchun "Buyurtma berish" Telegramga
// olib boradi.
//
// NARXLAR HOZIRCHA YASHIRIN (egasi, 2026-09-26: "narxlarni hozircha olib
// tashla, tez kunda deb qo'y"). `SHOW_PRICES = true` qilinsa jonli narxlar
// va "Katalogda ko'rish" tugmasi qaytadi.
// ═══════════════════════════════════════════════════════════════════════

const SHOP_ID = 'NFCSTOREUZ';
const ORDER_URL = 'https://t.me/nfcstoreuz';
const SHOP_PATH = '/c/nfcstoreuz';
const SHOW_PRICES = false;

// Mahsulot → katalogdagi nomi (narx shu bo'yicha topiladi).
const PRODUCTS = [
  { key: 'mini', img: '/stikerlar/sticker.jpg', catalog: 'NFC Sticker' },
  { key: 'oyna', img: '/stikerlar/avto.jpg', design: '/stikerlar/oyna.png', catalog: 'Avto NFC Sticker' },
  { key: 'tashqi', design: '/stikerlar/tashqi.png', catalog: null, isNew: true },
  { key: 'stend', img: '/stikerlar/stend.jpg', catalog: 'NFC Stend' },
];

const CONTENT = {
  uz: {
    kicker: 'NFC stikerlar · do‘kon, mashina, kafe uchun',
    title: 'Do‘koningiz yopiq bo‘lsa ham ochiq',
    lead: 'Eshikka, vitrinaga yoki mashina oynasiga bitta stiker. Odam telefonini tekkizadi yoki QR’ni skanerlaydi — sahifangiz ochiladi: narxlar, katalog, ish vaqti, manzil va Telegram. Mijoz ketib qolmaydi.',
    order: 'Buyurtma berish',
    how: 'Qanday ishlaydi',
    trust: ['Batareya va internet shart emas', 'Hamma telefonda: NFC yoki QR', 'Ma’lumotni istalgan vaqtda o‘zgartirasiz'],
    whyK: 'Nega foydali',
    whyT: 'Bitta stiker — kechayu kunduz ishlaydigan sotuvchi',
    why: [
      ['Yopiq paytda ham savdo', 'Kechqurun yoki dam olish kuni kelgan mijoz narxlarni ko‘radi va egasiga yozadi. Ertasi kuni u sizning mijozingiz.'],
      ['Qog‘oz narx varag‘i kerak emas', 'Narxni telefondan bir marta o‘zgartirasiz — hamma stikerlarda darhol yangilanadi.'],
      ['Mashina — yuradigan reklama', 'Oynadagi stiker biznes sahifangizni ochadi. Shahar bo‘ylab har kuni yangi odamlar ko‘radi.'],
      ['Kim qiziqqanini bilasiz', 'Nechta odam tekkizgani va nimani ko‘rgani kabinetingizda — statistika bilan.'],
    ],
    stepsK: 'Qanday ishlaydi',
    stepsT: 'Uch harakat — mijoz sahifangizda',
    steps: [
      ['Yopishtiring', 'Eshik, vitrina, kassa, stol yoki mashina oynasiga. Stiker sahifangizga bog‘lanadi.'],
      ['Tekkizadi', 'NFC’li telefonda ilovasiz ochiladi. NFC yo‘q bo‘lsa — shu stikerdagi QR.'],
      ['Sahifa ochiladi', 'Ish vaqti, narxlar, katalog, manzil, Telegram va buyurtma.'],
    ],
    prodK: 'Mahsulotlar',
    prodT: 'Qaysi biri sizga kerak',
    products: {
      mini: ['Mini stiker', 'Kassa, peshtaxta, telefon orqasi, noutbuk yoki menyu papkasi uchun. Oldidan yopishtiriladi, ichkarida ishlatiladi.'],
      oyna: ['Oyna stikeri — ichkaridan', 'Ko‘zgu aksida bosiladi va oynaning ICHKI tomoniga yopishtiriladi — tashqaridan to‘g‘ri o‘qiladi, yomg‘ir tegmaydi, o‘g‘irlab bo‘lmaydi. Mashina old oynasi va do‘kon vitrinasi uchun. Mashinada egasining profili ochiladi: xohlasa shaxsiy, xohlasa biznes profili.'],
      tashqi: ['Tashqi stiker', 'Eshik, devor, darvoza va tashqi vitrina uchun. Ustidan himoya laminati bor: yomg‘ir va quyoshga chidaydi. Metall eshik uchun maxsus «anti-metall» chipli varianti bor.'],
      stend: ['Stol va kassa stendi', 'Kafe stoli, kassa yoni, qabulxona. Menyu, narxlar va aloqa bir tegishda.'],
    },
    newTag: 'Yangi',
    askPrice: 'Narxini so‘rang',
    priceSoon: 'Narxi tez kunda',
    sum: 'so‘m',
    inCatalog: 'Katalogda ko‘rish',
    showK: 'Telefonda aynan shu ochiladi',
    showT: 'Haqiqiy NFCSTORE sahifalari',
    show: [
      ['Do‘kon eshigidagi stiker', 'Biznes profili: ish vaqti, «Hozir ochiq/yopiq», manzil, mahsulotlar va narxlar.'],
      ['Kafe stoli', 'Menyu rasmlar va narxlar bilan. Qog‘oz menyu kerak emas.'],
    ],
    appT: 'Stikerni ilovadan bir tegishda bog‘lang',
    app: 'NFCSTORE ilovasida istalgan karta, stiker yoki brelokni profilingizga bog‘laysiz, qaysi profil ochilishini tanlaysiz va narxlarni telefondan o‘zgartirasiz.',
    appBtn: 'Ilovani yuklab olish',
    showCap: ['Do‘kon profili', 'Mahsulotlar va narxlar', 'Kafe profili', 'Menyu rasmlar bilan'],
    appCap: ['Bir tegishda tanishuv', 'NFC markazi: karta va stikerlar', 'Sizning profilingiz'],
    faqT: 'Savollar',
    faq: [
      ['iPhone’da ishlaydimi?', 'Ha. iPhone XS va yangilarida tekkizish kifoya. Eski telefonlarda stikerdagi QR ishlaydi.'],
      ['Internet yoki batareya kerakmi?', 'Stikerga — yo‘q. Sahifani ochish uchun mijozning telefonida internet bo‘lsa yetadi.'],
      ['Ma’lumotni keyin o‘zgartirsa bo‘ladimi?', 'Ha, istalgan vaqtda. Stikerni qayta yopishtirish shart emas — sahifa o‘zgaradi.'],
      ['Tonirovkali oynaga bo‘ladimi?', 'Oddiy tonirovkaga — ha. Metall plyonkali (atermal) tonirovka NFC’ni to‘sishi mumkin, bunday oynada QR ishlaydi.'],
      ['Metall eshikka-chi?', 'Oddiy chip metallda ishlamaydi. Buning uchun tashqi stikerning «anti-metall» varianti bor — buyurtmada ayting.'],
    ],
    finalT: 'Birinchi mijozingiz ertaga eshik oldida bo‘ladi',
    finalP: 'Buyurtma bering — stikerni sahifangizga ulab, qanday ishlashini ko‘rsatib beramiz.',
  },
  ru: {
    kicker: 'NFC-наклейки · для магазина, машины, кафе',
    title: 'Ваш магазин открыт, даже когда закрыт',
    lead: 'Одна наклейка на дверь, витрину или стекло машины. Человек прикладывает телефон или сканирует QR — открывается ваша страница: цены, каталог, часы работы, адрес и Telegram. Клиент не уходит.',
    order: 'Заказать',
    how: 'Как это работает',
    trust: ['Без батареек и интернета', 'Работает на любом телефоне: NFC или QR', 'Данные меняете в любой момент'],
    whyK: 'Зачем это нужно',
    whyT: 'Одна наклейка — продавец, который работает круглосуточно',
    why: [
      ['Продажи, даже когда закрыто', 'Клиент, пришедший вечером или в выходной, видит цены и пишет владельцу. На следующий день он ваш покупатель.'],
      ['Без бумажных ценников', 'Меняете цену один раз в телефоне — она сразу обновляется на всех наклейках.'],
      ['Машина — движущаяся реклама', 'Наклейка на стекле открывает страницу вашего бизнеса. Каждый день её видят новые люди.'],
      ['Видно, кто интересовался', 'Сколько людей приложили телефон и что смотрели — в вашем кабинете со статистикой.'],
    ],
    stepsK: 'Как это работает',
    stepsT: 'Три действия — и клиент на вашей странице',
    steps: [
      ['Наклейте', 'На дверь, витрину, кассу, стол или стекло машины. Наклейка привязывается к вашей странице.'],
      ['Прикладывают телефон', 'На телефоне с NFC открывается без приложения. Нет NFC — QR на той же наклейке.'],
      ['Открывается страница', 'Часы работы, цены, каталог, адрес, Telegram и заказ.'],
    ],
    prodK: 'Товары',
    prodT: 'Что подойдёт вам',
    products: {
      mini: ['Мини-наклейка', 'Для кассы, прилавка, телефона, ноутбука или папки меню. Клеится лицевой стороной, для помещений.'],
      oyna: ['Наклейка на стекло — изнутри', 'Печатается зеркально и клеится на ВНУТРЕННЮЮ сторону стекла — снаружи читается правильно, не мокнет, её не украсть. Для лобового стекла машины и витрины магазина. На машине открывается профиль владельца: личный или бизнес — на выбор.'],
      tashqi: ['Уличная наклейка', 'Для двери, стены, ворот и внешней витрины. Защитный ламинат: не боится дождя и солнца. Для металлической двери есть вариант с анти-металл чипом.'],
      stend: ['Подставка на стол и кассу', 'Стол в кафе, касса, ресепшен. Меню, цены и контакты одним касанием.'],
    },
    newTag: 'Новинка',
    askPrice: 'Узнать цену',
    priceSoon: 'Цена скоро',
    sum: 'сум',
    inCatalog: 'Смотреть в каталоге',
    showK: 'Вот что откроется на телефоне',
    showT: 'Настоящие страницы NFCSTORE',
    show: [
      ['Наклейка на двери магазина', 'Бизнес-профиль: часы работы, «Сейчас открыто/закрыто», адрес, товары и цены.'],
      ['Стол в кафе', 'Меню с фото и ценами. Бумажное меню не нужно.'],
    ],
    appT: 'Привяжите наклейку в приложении одним касанием',
    app: 'В приложении NFCSTORE вы привязываете любую карту, наклейку или брелок к профилю, выбираете, какой профиль открывать, и меняете цены с телефона.',
    appBtn: 'Скачать приложение',
    showCap: ['Профиль магазина', 'Товары и цены', 'Профиль кафе', 'Меню с фото'],
    appCap: ['Знакомство в одно касание', 'NFC-центр: карты и наклейки', 'Ваш профиль'],
    faqT: 'Вопросы',
    faq: [
      ['Работает на iPhone?', 'Да. На iPhone XS и новее достаточно приложить телефон. На старых телефонах работает QR на наклейке.'],
      ['Нужны интернет или батарейка?', 'Наклейке — нет. Для открытия страницы достаточно интернета на телефоне клиента.'],
      ['Можно потом изменить данные?', 'Да, в любой момент. Переклеивать не нужно — меняется страница.'],
      ['Можно на тонированное стекло?', 'На обычную тонировку — да. Атермальная тонировка с металлом может блокировать NFC, тогда работает QR.'],
      ['А на металлическую дверь?', 'Обычный чип на металле не работает. Для этого есть уличная наклейка с анти-металл чипом — укажите в заказе.'],
    ],
    finalT: 'Первый клиент будет у двери уже завтра',
    finalP: 'Оформите заказ — мы привяжем наклейку к вашей странице и покажем, как всё работает.',
  },
  en: {
    kicker: 'NFC stickers · for shops, cars and cafés',
    title: 'Your shop stays open even when it’s closed',
    lead: 'One sticker on the door, the window or the car glass. People tap their phone or scan the QR and your page opens: prices, catalog, hours, address and Telegram. Customers don’t walk away.',
    order: 'Order now',
    how: 'How it works',
    trust: ['No battery or internet needed', 'Works on any phone: NFC or QR', 'Change your info any time'],
    whyK: 'Why it pays off',
    whyT: 'One sticker — a salesperson that works around the clock',
    why: [
      ['Sales even after hours', 'A customer who comes by in the evening or on a day off sees your prices and messages you. The next day they buy.'],
      ['No paper price tags', 'Change a price once on your phone — every sticker shows it instantly.'],
      ['Your car becomes an ad', 'The sticker on the glass opens your business page. New people see it every day across the city.'],
      ['See who was interested', 'How many people tapped and what they viewed — in your dashboard with statistics.'],
    ],
    stepsK: 'How it works',
    stepsT: 'Three steps — and the customer is on your page',
    steps: [
      ['Stick it', 'On the door, window, till, table or car glass. The sticker is linked to your page.'],
      ['They tap', 'Opens without an app on NFC phones. No NFC — the QR on the same sticker.'],
      ['Your page opens', 'Hours, prices, catalog, address, Telegram and orders.'],
    ],
    prodK: 'Products',
    prodT: 'Which one you need',
    products: {
      mini: ['Mini sticker', 'For the till, counter, phone back, laptop or menu folder. Sticks face-on, for indoor use.'],
      oyna: ['Glass sticker — from inside', 'Printed mirrored and stuck on the INSIDE of the glass — reads correctly from outside, stays dry and can’t be stolen. For car windshields and shop windows. On a car it opens the owner’s profile: personal or business, their choice.'],
      tashqi: ['Outdoor sticker', 'For doors, walls, gates and outside windows. Protective laminate against rain and sun. An anti-metal chip version is available for metal doors.'],
      stend: ['Table and counter stand', 'Café table, till, reception. Menu, prices and contacts in one tap.'],
    },
    newTag: 'New',
    askPrice: 'Ask for price',
    priceSoon: 'Price coming soon',
    sum: 'UZS',
    inCatalog: 'View in catalog',
    showK: 'This is what opens on the phone',
    showT: 'Real NFCSTORE pages',
    show: [
      ['Sticker on a shop door', 'Business profile: hours, “Open now / Closed”, address, products and prices.'],
      ['Café table', 'Menu with photos and prices. No paper menu needed.'],
    ],
    appT: 'Link your sticker in the app with one tap',
    app: 'In the NFCSTORE app you link any card, sticker or key fob to your profile, choose which profile opens and change prices from your phone.',
    appBtn: 'Download the app',
    showCap: ['Shop profile', 'Products and prices', 'Café profile', 'Menu with photos'],
    appCap: ['Meet in one tap', 'NFC Center: cards and stickers', 'Your profile'],
    faqT: 'Questions',
    faq: [
      ['Does it work on iPhone?', 'Yes. On iPhone XS and newer a tap is enough. Older phones use the QR on the sticker.'],
      ['Does it need internet or a battery?', 'The sticker doesn’t. The customer’s phone just needs internet to open the page.'],
      ['Can I change the info later?', 'Yes, any time. No need to re-stick — the page changes.'],
      ['Tinted glass?', 'Regular tint is fine. Metallic (athermal) tint can block NFC — the QR still works.'],
      ['Metal doors?', 'A regular chip doesn’t work on metal. Choose the outdoor sticker with an anti-metal chip — mention it in your order.'],
    ],
    finalT: 'Your first customer can be at the door tomorrow',
    finalP: 'Place an order — we’ll link the sticker to your page and show you how it works.',
  },
};

// NFCSTORE katalogidagi narxlar (jonli). Xato bo'lsa — narxsiz ko'rsatiladi.
function useCatalogPrices() {
  const [prices, setPrices] = useState({});
  useEffect(() => {
    if (!SHOW_PRICES) return undefined;
    let alive = true;
    fetch(`/api/companies/${SHOP_ID}`, { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const map = {};
        for (const it of d.company?.catalog || d.company?.items || []) {
          if (it?.name) map[it.name] = Number(it.promotionPrice || it.price) || 0;
        }
        setPrices(map);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return prices;
}

export default function StickersPage() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.uz;
  const prices = useCatalogPrices();
  const fmt = (n) => Number(n).toLocaleString('uz-UZ').replace(/,/g, ' ');

  const OrderBtn = ({ className = '' }) => (
    <a href={ORDER_URL} target="_blank" rel="noopener noreferrer" className={`btn btn-gold min-h-12 px-7 text-[15px] no-underline ${className}`}>{c.order}</a>
  );

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 pb-20 sm:px-10 lg:px-14">
      {/* ── HERO ── */}
      <section className="grid items-center gap-10 pt-10 md:pt-14 lg:grid-cols-[1.05fr_.95fr]">
        <div className="flex flex-col items-start gap-5">
          <span className="vz-kicker">{c.kicker}</span>
          <h1 className="vz-h1 max-w-[16ch] text-[color:var(--vz-ink)]">{c.title}</h1>
          <p className="max-w-[58ch] text-[17px] leading-relaxed text-[color:var(--vz-ink-2)]">{c.lead}</p>
          <div className="flex flex-wrap gap-3">
            <OrderBtn />
            <a href="#qanday" className="btn btn-outline min-h-12 rounded-full px-6 text-[15px] no-underline">{c.how}</a>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-[color:var(--vz-ink-2)]">
            {c.trust.map((x) => (
              <li key={x} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--accent-a14)] text-[11px] font-bold text-[color:var(--accent-text)]">✓</span>{x}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <img src="/stikerlar/avto.jpg" alt="" className="col-span-2 aspect-[16/10] w-full rounded-2xl object-cover object-[center_40%]" />
          <img src="/stikerlar/sticker.jpg" alt="" className="aspect-square w-full rounded-2xl object-cover" />
          <img src="/stikerlar/stend.jpg" alt="" className="aspect-square w-full rounded-2xl object-cover" />
        </div>
      </section>

      {/* ── NEGA FOYDALI ── */}
      <section className="mt-16 md:mt-20">
        <span className="vz-kicker">{c.whyK}</span>
        <h2 className="vz-h2 mt-3 max-w-[24ch] text-[color:var(--vz-ink)]">{c.whyT}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.why.map(([h, p]) => (
            <article key={h} className="vz-card p-6">
              <h3 className="text-[18px] font-bold text-[color:var(--vz-ink)]">{h}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{p}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── QANDAY ISHLAYDI ── */}
      <section id="qanday" className="mt-16 scroll-mt-24 md:mt-20">
        <span className="vz-kicker">{c.stepsK}</span>
        <h2 className="vz-h2 mt-3 text-[color:var(--vz-ink)]">{c.stepsT}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {c.steps.map(([h, p], i) => (
            <li key={h} className="vz-card flex gap-4 p-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--vz-ink)] font-bold text-[color:var(--vz-bg)]">{i + 1}</span>
              <div>
                <h3 className="text-[17px] font-bold text-[color:var(--vz-ink)]">{h}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{p}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── MAHSULOTLAR ── */}
      <section className="mt-16 md:mt-20">
        <span className="vz-kicker">{c.prodK}</span>
        <h2 className="vz-h2 mt-3 text-[color:var(--vz-ink)]">{c.prodT}</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {PRODUCTS.map((p) => {
            const [name, desc] = c.products[p.key];
            const price = p.catalog ? prices[p.catalog] : 0;
            return (
              <article key={p.key} className="vz-card flex flex-col overflow-hidden p-0" data-testid={`sticker-${p.key}`}>
                {/* Rasm maydoni hamma kartada BIR XIL nisbatda (4:3) — qatorlar tekis. */}
                <div className={`relative grid aspect-[4/3] grid-rows-1 overflow-hidden bg-[#0e0d0b] ${p.img && p.design ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {p.img && <img src={p.img} alt={name} loading="lazy" className="h-full min-h-0 w-full object-cover" />}
                  {p.design && (
                    <div className="flex h-full items-center justify-center p-6">
                      <img src={p.design} alt={p.img ? '' : name} loading="lazy" className="max-h-full w-auto max-w-full object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,.6)]" />
                    </div>
                  )}
                  {p.isNew && <span className="absolute left-3 top-3 rounded-full bg-[#7fb28e] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#0b0b0a]">{c.newTag}</span>}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <h3 className="text-[20px] font-bold text-[color:var(--vz-ink)]">{name}</h3>
                  <p className="flex-1 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{desc}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {SHOW_PRICES
                      ? <b className="text-[20px] text-[color:var(--vz-ink)]">{price ? `${fmt(price)} ${c.sum}` : c.askPrice}</b>
                      : <span className="rounded-full bg-[var(--accent-a14)] px-3 py-1.5 text-[13px] font-bold uppercase tracking-wider text-[color:var(--accent-text)]" data-testid="price-soon">{c.priceSoon}</span>}
                    <div className="flex flex-wrap gap-2">
                      {SHOW_PRICES && p.catalog && <button type="button" onClick={() => navigate(SHOP_PATH)} className="btn btn-outline btn-sm min-h-10 rounded-full">{c.inCatalog}</button>}
                      <a href={ORDER_URL} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-sm min-h-10 no-underline">{c.order}</a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── TELEFONDA NIMA OCHILADI ── */}
      <section className="mt-16 md:mt-24">
        <span className="vz-kicker">{c.showK}</span>
        <h2 className="vz-h2 mt-3 text-[color:var(--vz-ink)]">{c.showT}</h2>
        <div className="mt-4 grid max-w-5xl gap-x-10 gap-y-2 md:grid-cols-2">
          {c.show.map(([h, p]) => (
            <p key={h} className="text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]"><b className="text-[color:var(--vz-ink)]">{h}.</b> {p}</p>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-[1240px]">
          <PhoneRow items={[
            { src: '/stikerlar/ph-market.jpg', alt: 'Dasturxon Market', cap: c.showCap[0] },
            { src: '/stikerlar/ph-market-2.jpg', alt: '', cap: c.showCap[1] },
            { src: '/stikerlar/ph-kafe.jpg', alt: 'Kofe Burchak', cap: c.showCap[2] },
            { src: '/stikerlar/ph-kafe-2.jpg', alt: '', cap: c.showCap[3] },
          ]} />
        </div>
      </section>

      {/* ── ILOVA ── */}
      <section className="vz-card mt-16 overflow-hidden p-6 sm:p-10 md:mt-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <h2 className="vz-h2 text-[color:var(--vz-ink)]">{c.appT}</h2>
          <p className="text-[16px] leading-relaxed text-[color:var(--vz-ink-2)]">{c.app}</p>
          <button type="button" onClick={() => navigate(APP_PAGE_PATH)} className="btn btn-gold min-h-12 px-7">{c.appBtn}</button>
        </div>
        <div className="mx-auto mt-10 max-w-[980px]">
          <PhoneRow cols="md:grid-cols-3" items={[
            { src: '/ilova/start.jpg', alt: 'NFCSTORE', cap: c.appCap[0] },
            { src: '/ilova/nfc.jpg', alt: 'NFC markazi', cap: c.appCap[1] },
            { src: '/ilova/profil.jpg', alt: '', cap: c.appCap[2] },
          ]} />
        </div>
      </section>

      {/* ── SAVOLLAR ── */}
      <section className="mt-16 max-w-3xl md:mt-20">
        <h2 className="vz-h2 text-[color:var(--vz-ink)]">{c.faqT}</h2>
        <div className="mt-6 divide-y divide-[color:var(--vz-line)] border-y border-[color:var(--vz-line)]">
          {c.faq.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none text-[16px] font-bold text-[color:var(--vz-ink)]">{q}</summary>
              <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── YAKUNIY CHAQIRUV ── */}
      <section className="mt-16 flex flex-col items-start gap-4 md:mt-20">
        <h2 className="vz-h2 max-w-[22ch] text-[color:var(--vz-ink)]">{c.finalT}</h2>
        <p className="text-[16px] text-[color:var(--vz-ink-2)]">{c.finalP}</p>
        <OrderBtn />
      </section>
    </main>
  );
}
