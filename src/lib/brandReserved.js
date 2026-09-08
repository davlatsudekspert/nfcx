// ═══════════════════════════════════════════════════════════════════════
// BAND QILINGAN NOMLAR — TO'RT GURUH (2026-09)
//
// Bir nom NFC ID yoki Company ID bo'la olmasligining to'rt sababi bor va
// ular BIR XIL EMAS: foydalanuvchiga aytiladigan gap ham, keyingi qadam
// ham har xil. Shuning uchun bitta "band" ro'yxati emas, to'rtta guruh.
//
//   BLOCKED   Umuman taqiqlangan (haqorat, giyohvandlik, qimor).
//             Admin bilan bog'lanish ham taklif qilinmaydi.
//   BRAND     Tovar belgisi egasiga tegishli (UZUM, APPLE, VISA).
//             Rasmiy vakil admin bilan bog'lanishi mumkin.
//   CRYPTO    Kripto atamalari (USDT, NFT, WEB3). Hozircha saqlanadi,
//             keyinchalik alohida toifa sifatida chiqariladi.
//   AUCTION   Kuchli umumiy nomlar (BANK, GOLD, CHAT). Bular brend
//             EMAS — ular NFCSTORE auksioniga chiqariladi.
//
// USTUVORLIK: BLOCKED > BRAND > CRYPTO > AUCTION. Bir nom ikki guruhga
// tushsa, yuqoridagisi g'olib. Ro'yxatlar generatsiya paytida shu
// tartibda tozalangan, ya'ni takror yozuv yo'q.
//
// ─────────────────────────────────────────────────────────────────────
// TAQQOSLASH QOIDASI — AYNAN TENGLIK, "ichida bor" EMAS.
//
// Avval nom normallashtiriladi: katta harfga o'tkaziladi va HARFDAN
// boshqa hamma narsa olib tashlanadi (bo'shliq, chiziq, apostrof,
// raqam). Shundan keyin ro'yxat bilan AYNAN solishtiriladi.
//
//   "UZUM MARKET" / "uzum-market" / "UzumMarket"  ->  UZUMMARKET  ✓
//   "MERCEDES-BENZ" / "Mercedes Benz"             ->  MERCEDESBENZ ✓
//
// "Ichida bor" qoidasi ATAYLAB ishlatilmaydi — u begunoh nomlarni
// bloklab qo'yardi: BON -> BONU, ANOR -> ANORA, MARS -> MARSEL
// (uchalasi ham keng tarqalgan ism). Aynan tenglikda bunday yolg'on
// ijobiy natija bo'lmaydi.
//
// UCH HARFDAN QISQA yozuvlar ro'yxatga KIRITILMAYDI (AI, QR, TV, HP):
// ID uchun eng kami 3 harf, ya'ni ular baribir hech qachon mos
// kelmasdi va ro'yxatda faqat chalkashlik bo'lardi.
//
// ─────────────────────────────────────────────────────────────────────
// DIQQAT: ro'yxatlar va mantiq hosting/worker.js ichidagi nusxasi bilan
// AYNAN bir xil bo'lishi shart (Worker modullari `src/` dan import qila
// olmaydi). scripts/test-brand-reserved.mjs ikkalasini solishtirib
// turadi — biri o'zgarib ikkinchisi eskirsa, forma bir narsani
// ko'rsatib, server boshqasini qilardi.
// ═══════════════════════════════════════════════════════════════════════

// Global auksionga chiqariladigan nomlarning boshlang'ich narxi.
export const AUCTION_START_PRICE = 2000000;
// Auksion davomiyligi — soatda.
export const AUCTION_HOURS = 72;
// Auksion ochilishi uchun kerakli talab soni (mavjud "Talab" taxtasi
// chegarasi bilan bir xil).
export const AUCTION_DEMAND_THRESHOLD = 20;

// Umuman taqiqlangan — hech qanday holatda berilmaydi.
export const BLOCKED_NAMES = [
  'FUCK', 'PORN', 'NUDE', 'EROTIC', 'COCAINE', 'DRUG', 'POISON', 'HITLER',
  'NIGGA', 'NIGGER', 'PSYCHOPATH', 'CASINO', 'CASINOBOT', 'POKER', 'BETTING',
  'BETS', 'GAMBLE', 'GAMBLING', 'LOTTERY', 'ROULETTE', 'BLACKJACK', 'SLOT',
  'SLOTS', 'JACKPOT', 'HIGHROLLER', 'BETWINNER', 'BETMOBILE', 'FONBET',
];

// Tovar belgisi egasiga tegishli.
export const BRAND_RESERVED = [
  'UZUM', 'UZUMMARKET', 'UZUMBANK', 'UZUMNASIYA', 'UZUMTEZKOR', 'PAYME',
  'CLICK', 'PAYNET', 'OSON', 'ALIF', 'ALIFNASIYA', 'HUMANS', 'ZOOD',
  'ZOODMALL', 'ASAXIY', 'OLCHA', 'MYUZCARD', 'UZCARD', 'HUMO', 'ANOR',
  'ANORBANK', 'KAPITALBANK', 'HAMKORBANK', 'IPAKYULI', 'IPAKYULIBANK', 'TBC',
  'TBCBANK', 'SQB', 'SANOATQURILISHBANK', 'NBU', 'ALOQABANK', 'AGROBANK',
  'ASAKABANK', 'IPOTEKABANK', 'INFINBANK', 'TRASTBANK', 'DAVRBANK',
  'OCTOBANK', 'TENGEBANK', 'ZIRAATBANK', 'POYTAXTBANK', 'GARANTBANK',
  'ORIENTFINANS', 'OFB', 'UZTELECOM', 'UZMOBILE', 'UCELL', 'BEELINE',
  'MOBIUZ', 'PERFECTUM', 'EVO', 'TPS', 'SARKOR', 'EASTTELECOM', 'KORZINKA',
  'HAVAS', 'MAKRO', 'MAGNUM', 'BARAKA', 'TEXNOMART', 'MEDIAPARK', 'GOODZONE',
  'ELMAKON', 'ARTEL', 'AKFA', 'IMZO', 'AVALON', 'SHIVAKI', 'ROISON', 'EVOS',
  'OQTEPA', 'OQTEPALAVASH', 'BELLISSIMO', 'MAXWAY', 'LESAILES', 'FEEDUP',
  'SAFIA', 'CRAFERS', 'BON', 'YAPONAMAMA', 'BASRIBABA', 'CHOPAR',
  'DODOPIZZA', 'KFC', 'UZAUTO', 'UZAUTOMOTORS', 'CHEVROLET', 'BYD', 'ADM',
  'KIA', 'CHERY', 'HAVAL', 'MYTAXI', 'YANDEXGO', 'UZBEKISTANAIRWAYS',
  'UZRAILWAYS', 'MURADBUILDINGS', 'GOLDENHOUSE', 'NRG', 'DREAMCITY',
  'AKAYCITY', 'XONSAROY', 'BIGROUP', 'NAJOTTALIM', 'PDP', 'MOHIRDEV',
  'REGISTAN', 'CAMBRIDGE', 'INTERNATION', 'MARSIT', 'THOMPSON', 'KUNUZ',
  'DARYOUZ', 'GAZETAUZ', 'SEVIMLI', 'ZORTV', 'MILLIYTV', 'OLX', 'BTS',
  'BTSEXPRESS', 'FARGO', 'EMU', 'UZPOST', 'APPLE', 'IPHONE', 'IPAD',
  'MACBOOK', 'SAMSUNG', 'XIAOMI', 'REDMI', 'HUAWEI', 'OPPO', 'VIVO', 'NOKIA',
  'SONY', 'PHILIPS', 'PANASONIC', 'LENOVO', 'ASUS', 'ACER', 'DELL', 'CANON',
  'EPSON', 'DYSON', 'BOSCH', 'SIEMENS', 'TEFAL', 'BEKO', 'HAIER', 'MIDEA',
  'HISENSE', 'GREE', 'GOOGLE', 'YOUTUBE', 'MICROSOFT', 'WINDOWS', 'OPENAI',
  'CHATGPT', 'FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'TELEGRAM', 'TIKTOK',
  'SNAPCHAT', 'LINKEDIN', 'PINTEREST', 'SPOTIFY', 'NETFLIX', 'YANDEX',
  'GMAIL', 'BAIDU', 'YAHOO', 'GROK', 'DZEN', 'ORACLE', 'GITLAB', 'XBOX',
  'MERCEDES', 'MERCEDESBENZ', 'BMW', 'AUDI', 'TOYOTA', 'LEXUS', 'HYUNDAI',
  'HONDA', 'NISSAN', 'INFINITI', 'MAZDA', 'MITSUBISHI', 'VOLKSWAGEN',
  'PORSCHE', 'LANDROVER', 'RANGEROVER', 'VOLVO', 'FORD', 'RENAULT',
  'PEUGEOT', 'TESLA', 'GEELY', 'ZEEKR', 'JETOUR', 'AVATR', 'HONGQI',
  'LIAUTO', 'LIXIANG', 'GAC', 'JAC', 'ISUZU', 'MAN', 'KAMAZ', 'NIKE',
  'ADIDAS', 'PUMA', 'REEBOK', 'NEWBALANCE', 'SKECHERS', 'UNDERARMOUR',
  'ZARA', 'LCWAIKIKI', 'DEFACTO', 'BERSHKA', 'GUCCI', 'CHANEL', 'DIOR',
  'PRADA', 'VERSACE', 'ARMANI', 'BURBERRY', 'HERMES', 'LOUISVUITTON',
  'BALENCIAGA', 'LACOSTE', 'TOMMYHILFIGER', 'CALVINKLEIN', 'ROLEX',
  'CARTIER', 'FENDI', 'HUGOBOSS', 'PANDORA', 'PLAYBOY', 'COCACOLA', 'COKE',
  'PEPSI', 'FANTA', 'SPRITE', 'REDBULL', 'LIPTON', 'NESTLE', 'NESCAFE',
  'KINDER', 'FERRERO', 'NUTELLA', 'SNICKERS', 'TWIX', 'BOUNTY', 'KITKAT',
  'MILKA', 'OREO', 'DANONE', 'ACTIVIA', 'HEINZ', 'BURGERKING', 'MCDONALDS',
  'DOMINOS', 'STARBUCKS', 'PAPAJOHNS', 'IQOS', 'AMAZON', 'ALIBABA',
  'ALIEXPRESS', 'TEMU', 'WILDBERRIES', 'OZON', 'TRENDYOL', 'EBAY', 'SHEIN',
  'IKEA', 'MINISO', 'LEGOLAND', 'VISA', 'MASTERCARD', 'MAESTRO', 'UNIONPAY',
  'WESTERNUNION', 'MONEYGRAM', 'BINANCE', 'COINMARKETCAP', 'COINBASE',
  'PAYPAL', 'REVOLUT', 'SWIFT', 'PAYBOX', 'QIWI', 'EXMO', 'SBER', 'JPMORGAN',
  'HSBC', 'TURKISHAIRLINES', 'EMIRATES', 'FLYDUBAI', 'QATARAIRWAYS',
  'AIRASTANA', 'WIZZAIR', 'HILTON', 'HYATT', 'MARRIOTT', 'RADISSON',
  'WYNDHAM', 'BOOKING', 'AIRBNB', 'DHL', 'FEDEX', 'UPS', 'GLOVO', 'WOLT',
  'GETT', 'TINDER', 'FIFA', 'MANCITY', 'MANCHESTERCITY', 'ARSENAL', 'MSNBC',
  'FORBES', 'POLYMARKET', 'XBET', 'NAKHEEL', 'NEOM', 'EMAAR', 'DAMAC',
];

// Kripto atamalari — keyinroq alohida toifa.
export const CRYPTO_RESERVED = [
  'DOGE', 'DOGECOIN', 'USDT', 'USDC', 'BUSD', 'TRON', 'SHIB', 'DEFI', 'DAPP',
  'WEB', 'TOKEN', 'TOKENS', 'CRYPTO', 'CRYPTOFUND', 'CRYPTOCARD',
  'CRYPTOHOLDER', 'HUOBI', 'OKEX', 'ZCASH', 'MEMECOIN', 'NFT', 'NFTS',
  'METAVERSE', 'ETHER',
];

// Kuchli umumiy nomlar — NFCSTORE auksioniga chiqariladi.
export const GLOBAL_AUCTION_RESERVED = [
  'AERO', 'AIR', 'AIRPORT', 'ALEXA', 'APP', 'ARENA', 'ASIA', 'ASSET',
  'ATLAS', 'AURA', 'AUTO', 'AVIA', 'BALANCE', 'BANK', 'BAR', 'BEST', 'BLACK',
  'BOND', 'BOOK', 'BOSS', 'BOT', 'BRAND', 'BRIDGE', 'BUILD', 'BUILDING',
  'BURGER', 'BUSINESS', 'CAFE', 'CALENDAR', 'CAPITAL', 'CAR', 'CARS', 'CASH',
  'CAST', 'CHART', 'CHAT', 'CHECKOUT', 'CHEF', 'CHESS', 'CHIEF', 'CITY',
  'CLOUD', 'CLUB', 'CODE', 'COFFEE', 'COIN', 'COMPANY', 'CONCIERGE',
  'CONNECT', 'CREATE', 'CREDIT', 'CURRENCY', 'DATA', 'DEAL', 'DECOR',
  'DELIVERY', 'DEPOSIT', 'DESIGN', 'DIGIT', 'DIGITAL', 'DISCOUNT', 'DOMAIN',
  'DOMAINS', 'DRAGON', 'DREAM', 'EARN', 'EASY', 'EBANK', 'ECOM', 'ELITE',
  'EMPIRE', 'ENGLISH', 'ESPORT', 'ESTATE', 'EVENTS', 'EXCHANGE', 'EXPO',
  'FAMILY', 'FANS', 'FAST', 'FINANCE', 'FITNESS', 'FOOD', 'FOOTBALL',
  'FORECAST', 'FOREX', 'FUND', 'GAME', 'GAMES', 'GEMS', 'GENIUS', 'GIFT',
  'GIFTS', 'GLOBAL', 'GOAL', 'GOLD', 'GOOD', 'GRAM', 'GRAND', 'GULF', 'HERO',
  'HOME', 'HONEST', 'HONOR', 'HOST', 'HOTEL', 'HOTELS', 'HOUSE', 'HUGO',
  'IDEA', 'INSURANCE', 'INTERIOR', 'INTERNET', 'INVEST', 'INVESTOR', 'KIDS',
  'KING', 'LAND', 'LEGEND', 'LESSONS', 'LIFE', 'LINK', 'LION', 'LIVE',
  'LOCAL', 'LOGO', 'LORD', 'LOVE', 'MAIL', 'MALL', 'MANGO', 'MARKET',
  'MARKETPLACE', 'MARS', 'MASTER', 'MEDIA', 'MEET', 'MESSAGE', 'META',
  'MONEY', 'MOON', 'MOVE', 'MUSIC', 'NEOBANK', 'NEWS', 'OFFER', 'OFFICE',
  'ONLINE', 'OPERA', 'ORDER', 'PAYMENT', 'PETS', 'PIZZA', 'PLANE', 'PLAY',
  'PLAYER', 'PLUS', 'POINT', 'POLO', 'PORT', 'PREMIUM', 'PRESTIGE', 'PRICE',
  'PRIDE', 'PROFIT', 'PROMO', 'PROPERTY', 'QRCODE', 'QUEEN', 'REALESTATE',
  'RESTAURANT', 'RICH', 'SALE', 'SALES', 'SCHOOL', 'SCORE', 'SCORES',
  'SECRET', 'SERVER', 'SERVICE', 'SHOP', 'SMART', 'SPORT', 'SPORTS', 'STAR',
  'STARS', 'STOCK', 'STORE', 'STORY', 'STUDIO', 'SUPER', 'SUPERIOR', 'SWEET',
  'SYSTEM', 'TAXI', 'TEA', 'TECH', 'TECHNOLOGY', 'TICKET', 'TICKETS',
  'TIGER', 'TOTAL', 'TOUR', 'TOURIST', 'TRADE', 'TRADING', 'TRAVEL',
  'TRAVELS', 'TRIP', 'TRUST', 'UNION', 'VEHICLE', 'VENTURE', 'VERIFY',
  'VIDEO', 'VIDEOS', 'VIP', 'VLOG', 'WALLSTREET', 'WATCH', 'WEALTH', 'WIFI',
  'WORLD',
];

const SETS = [
  ['blocked', new Set(BLOCKED_NAMES)],
  ['brand', new Set(BRAND_RESERVED)],
  ['crypto', new Set(CRYPTO_RESERVED)],
  ['auction', new Set(GLOBAL_AUCTION_RESERVED)],
];

// Bo'shliq, chiziq, apostrof, raqam — hammasi olib tashlanadi.
export function normalizeBrand(value) {
  return String(value || '').normalize('NFKC').toUpperCase().replace(/[^A-Z]/g, '');
}

// Nomning holati: 'blocked' | 'brand' | 'crypto' | 'auction' | ''.
// Bo'sh satr — nom ochiq, oddiy tartibda sotiladi.
//
// RAQAM QOIDASI (2026-09, egasining qarori): himoya faqat SOF NOMGA
// tegishli. "BMW" — band (keyinchalik auksionga qo'yiladi), "BMW112",
// "BMW007" kabi raqamli NFC ID'lar esa oddiy tartibda sotilaveradi.
// Shu sabab ichida bitta raqam bo'lsa ham nom band hisoblanmaydi.
// Chetlab o'tish xavfi yo'q: kompaniya ID'sida raqam umuman ishlatilmaydi
// (companyId() faqat harflarni qabul qiladi), ya'ni "BMW1" deb yozib
// brend nomini olib bo'lmaydi.
export function reservedStatus(value) {
  const raw = String(value || '');
  if (/[0-9]/.test(raw)) return '';
  const v = normalizeBrand(raw);
  if (!v) return '';
  for (const [status, set] of SETS) if (set.has(v)) return status;
  return '';
}

// Har qanday sababdan band bo'lsa — true.
export function isReservedName(value) {
  return reservedStatus(value) !== '';
}

// Eski nom (mos kelish uchun): faqat BREND guruhini bildiradi.
export function isBrandReserved(value) {
  return reservedStatus(value) === 'brand';
}
