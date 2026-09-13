// NFC BIZNES PROFILI — BITTA EKRANGA SIG'ISHI.
//
// Egasining talabi: "Nfc kartani urganda telefon ekranida to'liq
// chiqishi kerak, ortiqcha scrollarsiz."
//
// Ilgari /c/:id bitta uzun ustun edi — logo, nom, tavsif, ETTITA
// ustma-ust yotgan aloqa tugmasi, keyin bo'limlar, keyin NFC ID va eng
// oxirida "Kontaktni saqlash". Telefonda birinchi ekranda faqat logo
// bilan tugmalar ko'rinardi; menyu ham, post ham, hatto eng muhim
// "Kontaktni saqlash" ham uch marta surgandan keyin chiqardi.
//
// Endi qobiq aynan ekran balandligida va O'ZI SURILMAYDI: faqat
// o'rtadagi kontent oynasi suriladi. Bu test o'sha qarorni
// qo'riqlaydi — ya'ni kimdir bexosdan `overflow`ni yoki qat'iy
// balandlikni olib tashlasa, shu yerda qulaydi.
//
//   node scripts/test-quick-profile-screen.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const page = readFileSync(new URL('../src/pages/CompanyQuickProfilePage.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/company-system.css', import.meta.url), 'utf8');

// Bitta CSS qoidasining tanasini ajratib oladi (`.qp-body{...}`).
function rule(selector) {
  const i = css.indexOf(selector + '{');
  if (i < 0) return '';
  return css.slice(i + selector.length + 1, css.indexOf('}', i));
}

// ── 1) Qobiq ekran balandligida va o'zi surilmaydi ───────────────────
const shell = rule('.qp-shell');
checkTrue('1) qobiq ekran balandligida', shell.includes('height:100dvh'));
checkTrue('1) qobiq o‘zi surilmaydi', shell.includes('overflow:hidden'));
checkTrue('1) qobiq ustun bo‘lib tizilgan', shell.includes('flex-direction:column'));
checkTrue('1) sahifa ham surilmaydi', rule('.qp-page').includes('overflow:hidden'));

// ── 2) YAGONA suriladigan qism — o'rtadagi kontent ───────────────────
const body = rule('.qp-body');
checkTrue('2) kontent oynasi suriladi', body.includes('overflow-y:auto'));
checkTrue('2) kontent oynasi qolgan joyni oladi', body.includes('flex:1'));
// `min-height:0` BO'LMASA flex element ichidagi kontentdan kichrayolmaydi
// va scroll o'rniga qobiqni cho'zib yuboradi — bu eng tez unutiladigan
// qator, shuning uchun alohida tekshiriladi.
checkTrue('2) flex element kichrayishi mumkin', body.includes('min-height:0'));

// ── 3) Tepa, bo'limlar va pastki qator — surilmaydigan qismlar ───────
for (const sel of ['.qp-top', '.qp-hero', '.qp-bottom']) {
  checkTrue(`3) ${sel} qat'iy (flex:none)`, rule(sel).includes('flex:none'));
}
checkTrue('3) bo‘limlar qatori ham qat‘iy', rule('.qp-tabs').includes('flex:none'));

// ── 4) "Kontaktni saqlash" DOIM ko'rinib turadi ──────────────────────
// NFC kartaning butun ma'nosi shu tugmada: odam sahifani yopgandan
// keyin ham raqam uning telefonida qoladi. Shuning uchun u pastda,
// alohida surilmaydigan qatorda va OLTIN.
const bottomBlock = page.slice(page.indexOf('className="qp-bottom"'), page.indexOf('className="qp-bottom"') + 500);
checkTrue('4) saqlash tugmasi pastki qatorda', bottomBlock.includes('qp-save') && bottomBlock.includes('Kontaktni saqlash'));
checkTrue('4) oltin ko‘rinishda', rule('.qp-save').includes('var(--gold-face)'));
checkTrue('4) vCard yuklab olinadi', page.includes('downloadVcard'));

// ── 5) Aloqa — ustma-ust tugmalar EMAS, bitta ikonkalar qatori ───────
checkTrue('5) dumaloq ikonkalar qatori bor', page.includes('className="qp-quick"'));
checkTrue('5) qator yon tomonga suriladi', rule('.qp-quick').includes('overflow-x:auto'));
// Ichki o'ram SHART: `justify-content:center` bo'lgan suriladigan
// qatorda kontent sig'masa BOSHI kesilib qoladi va unga yetib
// bo'lmaydi — oltin "Saqlash" aynan shunday yo'qolgan edi.
checkTrue('5) qator boshi kesilmaydi (ichki o‘ram)', page.includes('qp-quick-in') && rule('.qp-quick-in').includes('margin:0 auto'));
checkTrue('5) qatorning o‘zi markazlamaydi', !rule('.qp-quick').includes('justify-content:center'));
checkTrue('5) eski ustun olib tashlandi', !page.includes('className="cq-actions"'));
// Hech bir aloqa turi yo'qolmasligi kerak.
for (const key of ['phone', 'telegram', 'whatsapp', 'instagram', 'facebook', 'website', 'directions', 'yandex', 'card']) {
  checkTrue(`5) ${key} aloqasi joyida`, page.includes(`k: '${key}'`));
}
checkTrue('5) egasining havolalari joyida', page.includes('extraLinks.map'));

// ── 6) Hech narsa YO'QOLMADI — tavsif, manzil, NFC ID, musiqa ────────
// Ular endi "Ma'lumot" bo'limida; birinchi ekranni band qilmaydi.
checkTrue('6) "Ma’lumot" bo‘limi bor', page.includes("'haqida'"));
// Bo'limlar YOZUVSIZ — faqat ikonka (egasining maketi). Shu sababli
// har birida `aria-label` bo'lishi SHART: aks holda ekran o'quvchi
// uchun qator to'rtta nomsiz tugmaga aylanadi.
// Bo'limlar — matnli tugmalar (egasining maketi), faoli OLTIN.
checkTrue('6) faol bo‘lim oltin', rule('.qp-tab.is-on').includes('var(--gold-face)'));
checkTrue('6) tavsif joyida', page.includes('qp-desc'));
checkTrue('6) manzil joyida', page.includes('qp-addr'));
checkTrue('6) NFC ID joyida', page.includes('pf-nfcid'));
checkTrue('6) musiqa pleeri joyida', page.includes('CompanyMusicPlayer'));
checkTrue('6) to‘liq sahifa havolasi joyida', page.includes("navigate(`/company/${company.companyId.toLowerCase()}`)"));

// ── 7) Ish vaqti jadvali hero'ni cho'zib yubormaydi ──────────────────
// U ochilganda ustiga tushadigan oyna bo'lishi shart: aks holda jadval
// ochilishi bilan pastdagi kontent oynasi qisqarib ketardi.
checkTrue('7) ish vaqti jadvali ustiga tushadi', rule('.qp-hero .ch-list').includes('position:absolute'));

// ── 8) `font` qisqartmasida `inherit` BO'LMASIN ──────────────────────
// `font:700 10px/1 inherit` — noto'g'ri: `inherit` oila sifatida qabul
// qilinmaydi va BUTUN qoida tashlab yuboriladi (ilgari aynan shu sabab
// yozuv qiyshiq chiqqan edi).
// Izohlar olib tashlanadi — aks holda shu izohning O'ZI topilib
// qolardi. Yolg'iz `font:inherit` esa TO'G'RI: butun qisqartma meros
// qilib olinadi; xato faqat oxiriga `inherit` yopishtirilgan holat.
const qpCss = css.slice(css.indexOf('.qp-page{')).replace(/\/\*[\s\S]*?\*\//g, '');
check('8) buzuq font qisqartmasi yo‘q', (qpCss.match(/font:\s*(?!inherit\s*[;}])[^;}]*\binherit\b/g) || []), []);

// ── 9) Telefon "tirnog'i" (safe-area) hisobga olingan ────────────────
checkTrue('9) tepada safe-area', rule('.qp-top').includes('env(safe-area-inset-top'));
checkTrue('9) pastda safe-area', rule('.qp-bottom').includes('env(safe-area-inset-bottom'));

// ── 10) Past ekranlar uchun kichrayish qoidasi bor ───────────────────
checkTrue('10) past ekran uchun media so‘rov', css.includes('@media(max-height:740px)'));



// ── 11) ALOQA IKONKALARI O'Z FIRMA RANGIDA ───────────────────────────
// Egasining talabi: "faqat ikonka Telegram va boshqalar o'zini
// rangida bo'lsin". Katakcha oltin, ichidagi belgi esa tarmoqning
// o'z rangida — ko'z Telegramni qidirmaydi, darrov topadi.
checkTrue('11) katakcha oltin', rule('.qp-qbtn i').includes('var(--gold-face)'));
for (const [net, color] of [['telegram', '#0f7ab0'], ['whatsapp', '#0b8a3c'], ['instagram', '#b3175a'], ['facebook', '#0d4fa8']]) {
  checkTrue(`11) ${net} o‘z rangida`, page.includes(`k: '${net}'`) && page.includes(`color: '${color}'`));
}
// Oltin ustida belgi o'qilishi uchun yengil oq soya.
checkTrue('11) belgi oltin ustida o‘qiladi', rule('.qp-qbtn i>svg').includes('drop-shadow'));


// ── 12) TUGMA SHRIFTI QISQARTMA BILAN QAYTA YOZILMASIN ───────────────
// `.qp-page button{font:inherit}` — 0,1,1 aniqlikda va `font` QISQARTMA
// bo'lgani uchun o'lcham bilan qalinlikni HAM qayta yozadi. Natijada
// `.qp-tab{font-size:10.5px}` kabi qoidalar (0,1,0) undan zaif bo'lib,
// HAMMA tugma 16px/400 da chiqardi (egasi: "yozuvlar katta bo'lib
// ketgan"). Faqat OILA meros qilinishi kerak.
checkTrue('12) tugma shriftida faqat oila meros qilinadi', rule('.qp-page button').includes('font-family:inherit'));
check('12) `font` qisqartmasi ishlatilmaydi', (rule('.qp-page button').match(/(^|;)\s*font\s*:/g) || []), []);
// Bo'limlar va tugmalar o'z o'lchamini BERADI (aks holda yuqoridagi
// qoida ularni bosib ketgani bilinmay qoladi).
for (const sel of ['.qp-tab', '.qp-sidebtn', '.qp-save', '.qp-order']) {
  checkTrue(`12) ${sel} o‘z o‘lchamini beradi`, /font-size:\s*[\d.]+px/.test(rule(sel)));
}

// ── 13) ISTORYA HALQASI KO'RINADI ────────────────────────────────────
// Egasining talabi: "istorya qo'yilgan bo'lsa bilinsin-da, Instagramga
// o'xshab". Halqa OLTIN halqadan TASHQARIDA bo'lishi shart: `.qp-ava`
// ning oltin soyasi 10 pikselgacha cho'ziladi va halqa undan ichkarida
// bo'lsa, soya uni butunlay yopib qo'yardi.
{
  const glow = rule('.qp-hero .story-ring-glow');
  const m = /inset:-(\d+)px/.exec(glow);
  checkTrue('13) istorya halqasi kattaroq insetda', !!m && Number(m[1]) > 10);
  checkTrue('13) halqa bilan logotip orasida qora bo‘shliq', /inset:-(\d+)px/.test(rule('.qp-hero .story-ring::before')));
}

// ── 14) BO'LIMLAR TARTIBI: avval KATALOG ─────────────────────────────
// Egasining qarori: NFC kartani tegizgan odam birinchi navbatda
// "nima sotasiz" degan savolga javob ko'rishi kerak.
{
  const order = ['katalog', 'post', 'lenta', 'haqida'];
  const tabsBlock = page.slice(page.indexOf('const tabs = ['), page.indexOf('const tabs = [') + 420);
  const seen = order.filter((id) => tabsBlock.includes(`id: '${id}'`));
  check('14) bo‘limlar tartibi', seen, order);
  checkTrue('14) katalog birinchi', tabsBlock.indexOf("id: 'katalog'") < tabsBlock.indexOf("id: 'post'"));
  // Boshlang'ich bo'lim SHU ro'yxatdan tanlanadi — ikkalasi bir xil
  // tartibda bo'lmasa, ochilganda boshqa bo'lim faol bo'lib qolardi.
  const avail = page.slice(page.indexOf('const availableTabs = ['), page.indexOf('const availableTabs = [') + 320);
  checkTrue('14) boshlang‘ich bo‘lim ham katalogdan boshlanadi', avail.indexOf("'katalog'") < avail.indexOf("'post'"));
}

// ── 15) "To'liq ochish" — oltin va yaltiroq ──────────────────────────
checkTrue('15) to‘liq sahifa tugmasi oltin', rule('.qp-public').includes('var(--gold-face)'));
checkTrue('15) ustidan yaltiroq o‘tadi', page.includes('qp-public tier-shine'));

done();
