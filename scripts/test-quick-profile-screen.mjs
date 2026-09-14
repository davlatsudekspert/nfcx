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
//
// BIR XIL NOMLI QOIDALAR BIRLASHTIRILADI. Ilgari bu funksiya FAQAT
// birinchi uchraganini qaytarardi va `.qp-bottom` uchun `@media
// (min-width:601px)` ichidagi kichik ustma-ust yozuv birinchi kelardi
// (u yerda atigi `bottom` va `border-radius` bor). Natijada test
// "`flex:none` yo'q" deb YOLG'ON xato berardi. Endi hamma nusxasi
// qo'shib o'qiladi.
function rule(selector) {
  let out = '';
  let i = css.indexOf(selector + '{');
  while (i >= 0) {
    out += css.slice(i + selector.length + 1, css.indexOf('}', i)) + ';';
    i = css.indexOf(selector + '{', i + 1);
  }
  // IZOHLAR OLIB TASHLANADI. Bu faylda izohlar qoidaning O'ZI qanday
  // bo'lgani haqida yozilgan ("`overflow:hidden` OLIB TASHLANDI") —
  // ya'ni izohdagi matn tekshiruvni chalg'itadi va qoida yo'q bo'lsa
  // ham "bor" deb ko'rsatardi.
  return out.replace(/\/\*[\s\S]*?\*\//g, '');
}

// ── 1) SAHIFA TABIIY SURILADI ────────────────────────────────────────
//
// QAROR O'ZGARDI — VA TEST HAM SHUNGA MOS KELISHI KERAK.
//
// Boshida qobiq AYNAN ekran balandligida (`height:100dvh`) qotirilgan
// va faqat o'rtadagi kichik oyna surilardi. Egasi buni qurilmada
// ko'rib rad etdi: "siqilgan va kichkina, premium his qilinmayapti" —
// hamma narsa bitta ekranga sig'ishi uchun kichraytirilgan edi.
//
// Endi kontent O'Z o'lchamida turadi va sahifa oddiy sahifa kabi
// suriladi; "Kontaktni saqlash" esa pastda YOPISHIB turadi.
//
// Shuning uchun bu yerdagi tekshiruvlar TESKARISIGA o'girildi: qat'iy
// balandlik va `overflow:hidden` QAYTIB KELMASLIGI kerak — ular
// qaytsa, yopishgan tugma ham buziladi (`position:sticky` ota-blokda
// `overflow:hidden` bo'lsa ishlamaydi).
const shell = rule('.qp-shell');
checkTrue('1) qobiq kontentga qarab o‘sadi', shell.includes('min-height:100dvh'));
checkTrue('1) qobiq qat‘iy balandlikda EMAS', !/(^|;)height:100dvh/.test(shell));
checkTrue('1) qobiqda overflow:hidden YO‘Q (sticky buzilmasin)', !shell.includes('overflow:hidden'));
checkTrue('1) qobiq ustun bo‘lib tizilgan', shell.includes('flex-direction:column'));
checkTrue('1) sahifa suriladi', !rule('.qp-page').includes('overflow:hidden'));

// ── 2) KONTENT ALOHIDA SURILMAYDI ────────────────────────────────────
// Ichki oyna o'z scroll'iga ega bo'lsa, sahifada IKKITA surish joyi
// paydo bo'ladi va telefonda barmoq qaysi biriga tushgani noaniq
// bo'lardi. Endi surish bitta — sahifaning o'zi.
const body = rule('.qp-body');
checkTrue('2) kontentda ichki scroll YO‘Q', !body.includes('overflow-y:auto'));
checkTrue('2) kontent qolgan joyni oladi', body.includes('flex:1'));

// ── 3) Tepa, bo'limlar va pastki qator — surilmaydigan qismlar ───────
for (const sel of ['.qp-hero', '.qp-bottom']) {
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
for (const key of ['phone', 'telegram', 'whatsapp', 'instagram', 'facebook', 'website', 'directions', 'card']) {
  checkTrue(`5) ${key} aloqasi joyida`, page.includes(`k: '${key}'`));
}
// KARTA — qo'ng'iroqdan keyin, IKKINCHI o'rinda (egasining savoli:
// "buni kim pul tashlayman desa"). Ilgari u ro'yxatning oxirida edi va
// telefon ekranida umuman ko'rinmasdi — odam uni topish uchun qatorni
// surishi kerak edi.
checkTrue('5) karta qo‘ng‘iroqdan keyin', page.indexOf("k: 'card'") < page.indexOf("k: 'telegram'"));
checkTrue('5) qo‘ng‘iroq birinchi', page.indexOf("k: 'phone'") < page.indexOf("k: 'card'"));
// Karta belgisi OLTIN katakcha ustida ko'rinishi kerak: `IconChip` ning
// rangi ichkarida qat'iy oltin gradient bilan berilgan va u oltin
// ustida oltin bo'lib yo'qolib ketardi.
checkTrue('5) karta belgisi oltin ustida ko‘rinadi', page.includes('IconBankCard') && !page.includes('IconChip'));
// Yandex ENDI alohida ikonka emas: u "Manzil" bosilganda chiqadigan
// tanlov oynasida — ikkita xarita ikonkasi qator joyini yeb qo'yardi.
checkTrue('5) yandex alohida ikonka emas', !page.includes("k: 'yandex'"));
checkTrue('5) manzil tanlov oynasini ochadi', page.includes('setMapPick(true)'));
checkTrue('5) egasining havolalari joyida', page.includes('extraLinks.map'));

// ── 6) Hech narsa YO'QOLMADI — tavsif, manzil, xarita, musiqa ───────
// Ular endi "Ma'lumot" bo'limida; birinchi ekranni band qilmaydi.
checkTrue('6) "Ma’lumot" bo‘limi bor', page.includes("'haqida'"));
// Bo'limlar — matnli tugmalar (egasining maketi), faoli OLTIN.
// Faol bo'lim OLTIN. `var(--gold-face)` o'rniga to'g'ridan-to'g'ri
// gradient yozilgan: bu yerda boshqa (quyuqroq) oltin kerak edi —
// tugma kichkina va ochiq oltin ustida qora yozuv o'qilmasdi.
// Tekshiruv "oltin gradientmi" degan savolga qaraydi, aniq qiymatga
// emas.
checkTrue('6) faol bo‘lim oltin', /linear-gradient|var\(--gold-face\)/.test(rule('.qp-tab.is-on')));
checkTrue('6) tavsif joyida', page.includes('qp-desc'));
// XARITA — NFC ID havolasining o'rniga (egasining qarori): havola
// hech qanday ish bajarmasdi, odam allaqachon o'sha havolada edi.
checkTrue('6) xarita joyida', page.includes('qp-map') && page.includes('openstreetmap.org/export/embed'));
// Xarita FAQAT bosilganda yuklanadi. Tashqi xizmat sekin yoki yopiq
// bo'lganda brauzer bo'm-bo'sh KULRANG kadr chizadi — premium
// sahifada bu juda xunuk. Shuning uchun yopiq holatda BIZNING
// kartochkamiz turadi.
checkTrue('6) xarita bosilgandagina yuklanadi', page.includes('mapOpen && geo') && page.includes('qp-map-card'));
checkTrue('6) yo‘nalish tugmasi joyida', page.includes('qp-route'));
// Manzil xarita kartochkasining O'ZIDA — tepada takrorlanmaydi.
checkTrue('6) manzil takrorlanmaydi', !page.includes('qp-addr'));
// Tepadagi ID yozuvi OLIB TASHLANDI (egasining qarori).
checkTrue('6) tepada takroriy ID yozuvi yo‘q', !page.includes('qp-cid'));
checkTrue('6) manzil joyida', page.includes('company.address || company.city'));
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
// Tepada — `--vz-safe-top` orqali. U butun loyihada bitta joyda
// belgilanadi (`:root{--vz-safe-top:env(safe-area-inset-top,0px)}`,
// theme.css) — bosh ekranga qo'shilgan ilovada sarlavha status
// qatori ostida qolib ketmasin uchun (PR #60). Shuning uchun bu yerda
// `env(...)` ning O'ZI emas, o'sha o'zgaruvchi kutiladi.
checkTrue('9) tepada safe-area', /var\(--vz-safe-top|env\(safe-area-inset-top/.test(rule('.qp-hero')));
checkTrue('9) pastda safe-area', rule('.qp-bottom').includes('env(safe-area-inset-bottom'));

// ── 10) PAST EKRAN UCHUN KICHRAYTIRISH ENDI KERAK EMAS ───────────────
// U qat'iy balandlikdagi maketning yamog'i edi: hamma narsa bitta
// ekranga sig'ishi kerak bo'lgani uchun past ekranda o'lchamlar
// kichraytirilardi. Sahifa suriladigan bo'lgach bu yamoq o'z-o'zidan
// keraksiz qoldi — va u QAYTMASLIGI kerak, chunki aynan shu
// kichraytirish "premium emas" degan bahoga olib kelgan edi.
checkTrue('10) kichraytirish yamog‘i qaytmagan', !css.includes('@media(max-height:740px)'));



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

// ── 15) "To'liq ochish" — IKKINCHI DARAJALI tugma ────────────────────
// Ilgari u ham oltin to'ldirilgan va yaltiroq edi. Sahifada ikkita
// bir xil yorqin tugma bo'lib qoldi va ko'z qaysisiga qarashni
// bilmasdi. To'ldirilgan oltin BITTA tugmaga — "Kontaktni saqlash"ga
// qoldirildi; bu esa hoshiyali bo'ldi. Shuning uchun tekshiruv
// "oltinmi" emas, "ikkinchi darajalimi" degan savolga qaraydi.
{
  const pub = rule('.qp-public');
  checkTrue('15) to‘liq sahifa tugmasi bor', pub.length > 0);
  checkTrue('15) u to‘ldirilgan oltin EMAS', !pub.includes('var(--gold-face)'));
  checkTrue('15) hoshiyasi oltin rangda', /border[^;]*rgba\(226,190,110/.test(pub));
  // Yagona to'ldirilgan oltin — saqlash tugmasi, va yaltiroq faqat unda.
  checkTrue('15) yaltiroq faqat saqlash tugmasida', rule('.qp-save::after').includes('qp-sweep 4.2s'));
}


// ── 16) OBUNA TUGMASI — butun kenglikda, ALOHIDA qatorda ─────────────
// Ilgari u logotip yonida, kichkina tugmada osilib turardi va ko'zga
// tashlanmasdi. Endi raqamlar ostida, butun kenglikda.
checkTrue('16) obuna tugmasi alohida qatorda', /!isOwner && \(\s*<button[^>]*className=\{`qp-follow/.test(page));
checkTrue('16) butun kenglikda', rule('.qp-follow').includes('width:100%'));
// TO'LDIRILGAN OLTIN ATAYLAB FAQAT BITTA tugmada — "Kontaktni
// saqlash"da. Ikkalasi to'ldirilgan bo'lsa ko'z hech qaysisida
// to'xtamaydi.
checkTrue('16) obuna to‘ldirilgan oltin EMAS', !rule('.qp-follow').includes('var(--gold-face)'));
checkTrue('16) saqlash esa to‘ldirilgan oltin', rule('.qp-save').includes('var(--gold-face)'));

// ── 17) ISH VAQTI HOLATI RANGDA ham bilinadi ─────────────────────────
// Rangni belgilaydigan yagona manba — yashil nuqta (`.ch-dot.is-open`),
// ya'ni rang bilan matn hech qachon bir-biriga zid bo'lib qolmaydi.
checkTrue('17) ochiq — yashil', css.includes('.qp-hero .ch-box:has(.ch-dot.is-open) .ch-head'));
checkTrue('17) yopiq — qizg‘ish', css.includes('.qp-hero .ch-box:not(:has(.ch-dot.is-open)) .ch-head'));

// ── 18) Aloqa qatorining o'ng cheti so'nadi ──────────────────────────
// `mask-image` ATAYLAB: u KONTENTNI so'ndiradi, fon ustiga to'rtburchak
// chizmaydi. Gradientli qoplama muqova rasmi ustida dog' bo'lib
// qolgan edi.
checkTrue('18) o‘ng chet so‘nadi', rule('.qp-quick').includes('mask-image'));
checkTrue('18) qoplama emas, niqob', !rule('.qp-quick').includes('::after'));


// ── 19) TO'LIQ EKRAN TUGMASI ─────────────────────────────────────────
// Egasining talabi: "NFC kartani urganda telefon ekranini to'liq
// egallab chiqsin" — ya'ni brauzerning manzil qatori va pastki
// tugmalari ko'rinmasin.
//
// Sayt buni O'ZICHA qila olmaydi: bu brauzerning xavfsizlik qoidasi
// (aks holda istalgan sahifa butun ekranni egallab, tizim oynasiga
// o'xshab qolardi). Faqat ODAMNING bosishi bilan mumkin.
checkTrue('19) to‘liq ekran tugmasi bor', page.includes('qp-fsbtn') && page.includes('requestFullscreen'));
// Tugma TELEFONDA HAM ko'rinishi SHART. Ilgari u "to'liq ekran
// qo'llab-quvvatlanmasa" yashirilardi va natijada kompyuterda bor,
// telefonda yo'q bo'lib qolgan edi — sababi: iOS'dagi hamma brauzer
// (Safari, Chrome, Yandex — hammasi bir xil WebKit) sahifa uchun
// to'liq ekranni bermaydi. Ya'ni tugma eng kerak joyda yo'q edi.
checkTrue('19) tugma qo‘llab-quvvatlashga bog‘liq EMAS', !/setFsOk\(\s*can\b/.test(page));
checkTrue('19) faqat ilova rejimida yashiriladi', /setFsOk\(!standalone\)/.test(page));
// Qo'llab-quvvatlanmasa odam bo'sh qolmasligi kerak — "bosh ekranga
// qo'shish" yo'riqnomasi ochiladi (iPhone'dagi YAGONA yo'l).
const a2h = readFileSync(new URL('../src/components/AddToHomeSheet.jsx', import.meta.url), 'utf8');
checkTrue('19) yo‘riqnoma ulangan', page.includes('AddToHomeSheet') && page.includes('setFsHelp(true)'));
checkTrue('19) va‘da rad etilsa ham yo‘riqnoma', page.includes('.catch(() => setFsHelp(true))'));
checkTrue('19) yo‘riqnoma qurilmaga qarab', a2h.includes('iPhone|iPad|iPod') && a2h.includes('Bosh ekranga qo‘shish'));
// iOS'da Safari'DAN BOSHQA brauzer (Yandex, Chrome, ...) alohida
// holat: u yerda pastda «Ulashish» belgisi YO'Q va qadamlar odamning
// ekraniga mos kelmasdi — egasi aynan Yandex Browser'dan kirgan edi.
checkTrue('19) iOS’dagi boshqa brauzerlar ajratiladi', /CriOS\|YaBrowser/.test(a2h) && a2h.includes('Safari’da ochish'));
checkTrue('19) yo‘riqnoma uslubi bor', css.includes('.ma-steps'));
// Ilova sifatida ochilgan bo'lsa brauzer qatori allaqachon yo'q.
checkTrue('19) ilova rejimida ham chizilmaydi', page.includes("display-mode: standalone"));
// Holat brauzerdan kuzatiladi: odam ESC bossa yoki tizim chiqarsa
// tugma belgisi ham qaytishi kerak.
checkTrue('19) holat brauzerdan kuzatiladi', page.includes("addEventListener('fullscreenchange'"));


// ── 20) XARITA ILOVASINI TANLASH ─────────────────────────────────────
// Egasining talabi: "xaritani tanlashda telefonda Yandex Navigator va
// boshqalarga yo'naltirishi kerak, faqat Google Maps'ni ochmoqchi
// emas". Ilgari "Yo'nalish olish" to'g'ridan-to'g'ri bitta xaritaga
// olib borardi.
const sheet = readFileSync(new URL('../src/components/MapAppSheet.jsx', import.meta.url), 'utf8');
const lib = readFileSync(new URL('../src/lib/mapLink.js', import.meta.url), 'utf8');
checkTrue('20) tanlov oynasi ulangan', page.includes('MapAppSheet') && page.includes('mapPick'));
checkTrue('20) yo‘nalish tugmasi oynani ochadi', page.includes("companyEvent(company.companyId, 'action', 'directions')") && page.includes('setMapPick(true)'));
// Yandex Navigator — O'zbekistonda yo'nalish uchun asosiy ilova.
checkTrue('20) yandex navigator bor', lib.includes('yandexnavi://build_route_on_map'));
checkTrue('20) yandex xarita bor', lib.includes('yandexDirectionsUrl'));
checkTrue('20) google maps bor', lib.includes('googleDirectionsUrl'));
// Ilova o'rnatilmagan bo'lsa sxemali havola HECH NARSA qilmaydi va
// odam bo'sh ekranda qoladi — zaxira havola shart.
checkTrue('20) ilova yo‘q bo‘lsa zaxira havola', lib.includes('fallback') && lib.includes('document.hidden'));
// `geo:` havolasi EMAS: Android'da ishlaydi, iPhone'da umuman yo'q.
// Izohlar olib tashlanadi — aks holda shu qarorni TUSHUNTIRGAN izohning
// o'zi topilib qolardi.
const libCode = lib.replace(/^\s*\/\/.*$/gm, '');
checkTrue('20) geo: havolasiga tayanmaydi', !libCode.includes('geo:'));
checkTrue('20) oyna body ga portal qilinadi', sheet.includes('createPortal') && sheet.includes('document.body'));
// Portal `.qp-shell` dan tashqarida — uni `overflow:hidden` kesmasligi
// uchun uslubi ham fixed bo'lishi shart.
checkTrue('20) oyna uslubi bor', rule('.ma-veil').includes('position:fixed') && css.includes('.ma-item'));
checkTrue('20) bekor qilish tugmasi bor', sheet.includes('ma-close'));

done();
