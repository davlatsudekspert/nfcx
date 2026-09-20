// OCHIQ PROFIL BOSHI — BITTA TIZIM (2026-09)
//
// SHIKOYAT (egasi). Ikki narsa:
//   1. "Personal profilda avatarni sal pastga tushirish kk. tepaga
//      qadalib qolgan." — ega sifatida kirilganda mehmon qatori
//      chizilmasdi va panelda tepa bo'shlig'i yo'q edi, shuning
//      uchun avatar panelning chetiga yopishib turardi.
//   2. ⋮ va yurak bir-biridan uzoqda edi: ⋮ sahifaning eng tepasida,
//      yurak esa panel ichida, obunachilar sonining yonida — ya'ni
//      "statistika" qatorida. Ko'z ularni bog'lamasdi.
//
// QAROR. O'ng yuqori burchakdagi amallar HAMMA ochiq profilda bitta
// komponentdan keladi (`ProfileActionCluster`) va TARTIBI QAT'IY:
//
//        [nusxalash] [ulashish] [⋮] [♥ n]
//
// ⋮ YURAKDAN OLDIN. Yurak oxirgi va yagona ramkali element: u asosiy
// ijtimoiy harakat. ⋮ esa kamdan-kam ochiladigan menyu; yurakdan
// keyin tursa barmoq yurakka cho'zilganda tasodifan ochilardi.
//
// MUSIQA HALQASI. Biznes profilda avatar atrofida halqa bor edi,
// shaxsiyda yo'q. Endi ikkalasida ham, LEKIN:
//   • musiqa yo'q -> halqa UMUMAN chizilmaydi (bo'sh joy ham yo'q);
//   • ijro -> aylanadi;  to'xtagan -> tinch turadi;
//   • TASHQI halqa = STORY, ICHKI = MUSIQA va ular ustma-ust
//     tushmaydi (radiuslar ajratilgan).
//   • YAGONA PLEER. Halqa o'z audio manbasini yaratmaydi — u mavjud
//     `MusicPlayer` ni chaqiradi. Ikki pleer bo'lsa bitta sahifada
//     ikki manba bir vaqtda chalinishi mumkin edi.
//
//   node scripts/test-profile-header.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';

const { check, checkTrue, done } = makeChecker();
const raw = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const read = (rel) => stripComments(raw(rel));

const cluster = read('../src/components/ProfileActionCluster.jsx');
const ring = read('../src/components/MusicRing.jsx');
const profile = read('../src/pages/ProfilePage.jsx');
const business = read('../src/components/BusinessPublicProfile.jsx');
const qr = read('../src/components/ProfileQrModal.jsx');
const css = raw('../src/theme.css');

// ── 1) TARTIB: ⋮ YURAKDAN OLDIN ──────────────────────────────────────
{
  const iCopy = cluster.indexOf("t('Nusxalash')");
  const iShare = cluster.indexOf('<ShareButton');
  const iMore = cluster.indexOf('<ProfileMoreMenu');
  const iLike = cluster.indexOf('pf-like');
  checkTrue('1) nusxalash bor', iCopy > 0);
  checkTrue('1) ulashish bor', iShare > 0);
  checkTrue('1) ⋮ menyusi bor', iMore > 0);
  checkTrue('1) yurak bor', iLike > 0);
  checkTrue('1) nusxalash ulashishdan oldin', iCopy < iShare);
  checkTrue('1) ulashish ⋮ dan oldin', iShare < iMore);
  // ASOSIY TALAB.
  checkTrue('1) ⋮ YURAKDAN OLDIN', iMore < iLike);
}

// ── 2) YURAK YO'Q BO'LSA — BO'SH JOY HAM YO'Q ────────────────────────
// Biznes profilda yurak yo'q. `like` propi null bo'lsa element umuman
// chizilmasligi kerak, aks holda qatorda sababsiz bo'shliq qolardi.
{
  checkTrue('2) yurak shart bilan chiziladi', /\{like && \(/.test(cluster));
  checkTrue('2) yurak standart holatda yo‘q', /like = null/.test(cluster));
}

// ── 3) EGA AMALLARI FAQAT ⋮ ICHIDA ───────────────────────────────────
{
  checkTrue('3) to‘plam ownerActions ni ⋮ ga uzatadi',
    /<ProfileMoreMenu[\s\S]{0,300}ownerActions=\{ownerActions\}/.test(cluster));
  checkTrue('3) mehmonda ro‘yxat bo‘sh', /ownerActions = \[\]/.test(cluster));
  // Ega amallari `isOwner` shartisiz uzatilmasin.
  for (const [name, src] of [['shaxsiy', profile], ['biznes', business]]) {
    checkTrue(`3) ${name}: ownerActions faqat egaga`,
      /ownerActions=\{isOwner \? \[/.test(src));
  }
}

// ── 4) ⋮ ICHIDAGI EGA AMALLARI — IKKALA PROFILDA BIR XIL ─────────────
{
  const need = ['Profilni tahrirlash', 'Story qo‘shish', 'Post qo‘shish', 'QR kod'];
  for (const [name, src] of [['shaxsiy', profile], ['biznes', business]]) {
    for (const label of need) {
      checkTrue(`4) ${name}: ⋮ da "${label}"`, src.includes(`t('${label}')`));
    }
    checkTrue(`4) ${name}: ⋮ da "Mening ID'larim"`, src.includes(`t("Mening ID'larim")`));
  }
  // QR oynasi ham BITTA komponent — ikki nusxa bo'lsa biri orqada
  // qolardi.
  checkTrue('4) QR oynasi umumiy komponent', /<ProfileQrModal/.test(profile) && /<ProfileQrModal/.test(business));
  checkTrue('4) QR faqat ochilganda yuklanadi', /import\('qrcode'\)/.test(qr));
}

// ── 5) BIZNESDA KATTA "TAHRIRLASH" TUGMASI YO'Q ──────────────────────
// Ochiq profil — mehmonga ko'rsatiladigan sahifa; boshqaruv tugmasi
// uning eng ko'zga tashlanadigan joyida turmasligi kerak.
{
  checkTrue('5) biznesda oltin "Tahrirlash" tugmasi yo‘q',
    !/isOwner && <button type="button" className="bp-gold-btn"/.test(business));
  // Tahrirlash YO'QOLMADI — u ⋮ da va o'z NFC ID si bilan ketadi.
  checkTrue('5) biznesda tahrirlash ⋮ da, o‘z ID si bilan',
    /ownerActionUrl\(record\.code, 'edit'\)/.test(business));
}

// ── 6) MUSIQA HALQASI ────────────────────────────────────────────────
{
  // MUSIQA YO'Q -> HECH NARSA CHIZILMAYDI (bo'sh o'ram ham emas).
  checkTrue('6) musiqa yo‘q -> halqa umuman yo‘q',
    /if \(!hasMusic\) return children;/.test(ring));
  // Holat ko'rinadi.
  checkTrue('6) ijro holati sinfga chiqadi', /is-playing/.test(ring));
  checkTrue('6) ijro holati data-atributda ham', /data-music-state=/.test(ring));
  checkTrue('6) CSS: ijroda aylanadi', /\.music-ring\.is-playing \.music-ring-arc\{[^}]*animation:music-spin/.test(css));
  checkTrue('6) CSS: to‘xtaganda animatsiya yo‘q',
    /\.music-ring-arc\{[\s\S]{0,600}?opacity:\.45\s*\n?\}/.test(css));
  checkTrue('6) harakat kamaytirilgan rejim hurmat qilinadi',
    /prefers-reduced-motion[\s\S]{0,120}\.music-ring\.is-playing \.music-ring-arc\{animation:none\}/.test(css));
}

// ── 7) IKKI HALQA USTMA-UST TUSHMAYDI ────────────────────────────────
// TASHQI = STORY, ICHKI = MUSIQA. Musiqa bo'lganda story halqasining
// radiusi tashqariga suriladi.
{
  // DOM TARTIBI: MusicRing StoryRing ni O'RAB oladi.
  //
  // Ko'rinishda musiqa ICHKARIDA, story TASHQARIDA — buni RADIUSLAR
  // hal qiladi (pastdagi tekshiruvlar), DOM tartibi emas.
  //
  // Nima uchun aynan shunday va bu qoida nimani qo'riqlaydi: nota
  // tugmasi StoryRing ICHIGA tushganda u istorya tugmasining ichidagi
  // tugma bo'lib qolardi. Brauzerda o'lchangan haqiqiy natija: notani
  // bosganda bosish istorya tugmasiga ham yetib borib, to'liq
  // ekranli ko'ruvchi ochilardi (`.sv-back`), keyingi bosishlar esa
  // o'sha ko'ruvchiga tushib, musiqa umuman TO'XTAMASDI.
  checkTrue('7) JSX: MusicRing StoryRing ni O‘RAB oladi',
    /<MusicRing[\s\S]{0,300}<StoryRing[\s\S]{0,900}<\/StoryRing>[\s\S]{0,80}<\/MusicRing>/.test(profile));
  checkTrue('7) nota StoryRing ichiga qaytib tushmadi',
    !/<StoryRing[\s\S]{0,400}<MusicRing/.test(profile));
  // Yoy bezak — istorya halqasini bosishga xalaqit bermasin.
  checkTrue('7) CSS: musiqa yoyi bosishni to‘smaydi',
    /\.music-ring-arc\{[\s\S]{0,120}pointer-events:none/.test(css));
  // Nota tugmasi avatarning `z-10` idan YUQORI bo'lsin — aks holda u
  // avatar ostida qolib, umuman bosilmasdi.
  checkTrue('7) CSS: nota tugmasi avatar ustida',
    /\.music-ring \.music-ring-btn\{[\s\S]{0,120}z-index:30/.test(css));
  // Yoy istorya halqasidan YUQORIDA bo'lishi SHART. `.story-ring::before`
  // — TO'LDIRILGAN doira (halqa emas) va u -13px dan avatargacha bo'lgan
  // hamma joyni qoplaydi; istorya halqasi esa `.music-ring>*` dan
  // `z-index:1` oladi. Yoy undan past tursa, musiqa yoqilgan bo'lsa ham
  // halqa BUTUNLAY ko'rinmasdi (brauzerda aynan shunday bo'ldi).
  checkTrue('7) CSS: yoy istorya to‘ldirmasidan yuqori',
    /\.music-ring-arc\{[\s\S]{0,140}z-index:2;/.test(css));
  // Yoy avatar bilan istorya bo'shlig'i ORASIDA — ikkalasining ham
  // ustiga chiqmaydi.
  checkTrue('7) yoy istorya bo‘shlig‘idan ichkarida (-8 < -13 dan ichkari)',
    /\.music-ring-arc\{[\s\S]{0,60}inset:-8px/.test(css));
  checkTrue('7) avatar bilan yoy orasida qorong‘i bo‘shliq bor',
    /\.music-ring::before\{[\s\S]{0,140}inset:-4px/.test(css));
  checkTrue('7) o‘ramda musiqa holati bor', /pf-ava-rings\$\{hasMusic \? ' has-music' : ''\}/.test(profile));
  checkTrue('7) CSS: story halqasi tashqariga suriladi',
    /\.pf-ava-rings\.has-music \.story-ring-glow\{inset:-18px\}/.test(css));
  checkTrue('7) CSS: story oraligi ham suriladi',
    /\.pf-ava-rings\.has-music \.story-ring::before\{inset:-13px\}/.test(css));
  // Musiqa yoyi story halqasidan ICHKARIDA.
  const arc = css.match(/\.music-ring-arc\{\s*\n?\s*position:absolute;inset:(-\d+)px/);
  checkTrue('7) musiqa yoyi radiusi topildi', !!arc);
  if (arc) {
    checkTrue('7) musiqa yoyi story oralig‘idan ICHKARIDA', Number(arc[1].replace('-', '')) < 13);
  }
  // `:has()` ishlatilmasin — eski mobil brauzerlarda yo'q va halqalar
  // bir-birining ustiga chiqib ketardi.
  checkTrue('7) `:has()` ga tayanilmaydi', !/\.story-ring:has\(/.test(css));
}

// ── 8) YAGONA PLEER ──────────────────────────────────────────────────
// Halqa O'Z audio manbasini yaratmaydi.
{
  checkTrue('8) halqada <audio> yo‘q', !/<audio/.test(ring));
  checkTrue('8) halqada <iframe> yo‘q', !/<iframe/.test(ring));
  checkTrue('8) halqa tashqi dastakni chaqiradi', /onToggle/.test(ring));
  checkTrue('8) sahifada pleer bitta', (profile.match(/<MusicPlayer\b/g) || []).length === 1);
  checkTrue('8) pleer holatni tashqariga beradi', /onPlayingChange=\{setMusicPlaying\}/.test(profile));
  checkTrue('8) halqa pleerning dastagini bosadi', /musicCtl\.current\?\.toggle\(\)/.test(profile));
  // Manba BITTA joyda hisoblanadi va HAVOLA HAQIQIY ekani tekshiriladi
  // — bo'sh/buzuq havolada pleer chizilmaydi, halqa ham chiqmasligi
  // kerak (bosilganda hech narsa bo'lmasdi).
  checkTrue('8) musiqa bor-yo‘qligi parser bilan aniqlanadi',
    /const hasMusic = !!parseMusicSource\(musicUrls\[0\]\);/.test(profile));
  checkTrue('8) pleer ham o‘sha ro‘yxatni oladi', /urls=\{musicUrls\}/.test(profile));
}

// ── 8b) AMALLAR KARTANING ICHIDA, SAHIFA FONIDA EMAS ─────────────────
// Egasining ikkinchi xabari: "like/menyu alohida ekranga chiqib
// qolibdi". Ular panel USTIDA, ochiq fonda suzib turardi va premium
// kartaga tegishli emasdek ko'rinardi.
{
  const panelAt = profile.indexOf('rounded-[22px] px-7 pb-[30px]');
  const clusterAt = profile.indexOf('<ProfileActionCluster');
  checkTrue('8b) to‘plam panel ichida chiziladi', clusterAt > panelAt && panelAt > 0);
  checkTrue('8b) o‘z o‘rami bor', /<div className="pf-card-actions">/.test(profile));
  // Sahifa tepasidagi qatorda endi FAQAT orqaga tugmasi.
  const topRow = profile.slice(profile.indexOf("t('Bosh sahifaga')"), panelAt);
  checkTrue('8b) tepa qatorda boshqa amal yo‘q', !/<ProfileActionCluster|<ShareButton|<ProfileMoreMenu/.test(topRow));
  // Fon RASMI qo'yilgan profilda ham o'qilsin.
  checkTrue('8b) CSS: kartada shisha yostiq bor',
    /\.pf-card-actions \.pf-actions\{[\s\S]{0,260}backdrop-filter:blur/.test(css));
  checkTrue('8b) CSS: fon ustida ko‘rinadi',
    /\.pf-card-actions \.pf-actions\{[\s\S]{0,260}background:color-mix/.test(css));
  checkTrue('8b) CSS: avatar halqalari ostida qolmaydi',
    /\.pf-card-actions\{[\s\S]{0,160}z-index:3\}/.test(css));
}

// ── 9) AVATAR TEPAGA QADALIB QOLMAYDI ────────────────────────────────
{
  checkTrue('9) panelda tepa bo‘shlig‘i bor', /rounded-\[22px\] px-7 pb-\[30px\] pt-\[18px\]/.test(profile));
  checkTrue('9) avatar bloki tepadan surilgan', /className="mt-5 flex flex-col items-center"/.test(profile));
  checkTrue('9) eski yopishgan holat qaytmadi', !/className="mt-0\.5 flex flex-col items-center"/.test(profile));
  // Mehmon qatori endi o'z `pt-5` ini qo'shmaydi — aks holda
  // mehmonda bo'shliq ikki barobar bo'lardi.
  checkTrue('9) mehmon qatorida takroriy bo‘shliq yo‘q',
    !/justify-end gap-2\.5 pt-5/.test(profile));
}

// ── 10) YURAK ESKI JOYIDA QOLMAGAN ───────────────────────────────────
// Ikki joyda turgan yurak — eng oson yo'l bilan qaytib keladigan xato.
{
  checkTrue('10) obunachilar qatorida yurak yo‘q',
    !/obuna<\/button>[\s\S]{0,400}onClick=\{toggleLike\}/.test(profile));
  checkTrue('10) sahifada yurak tugmasi bitta ham emas (to‘plamda)',
    !/aria-label=\{t\('Yoqtirish'\)\}/.test(profile));
  checkTrue('10) yurak to‘plamda', /aria-label=\{t\('Yoqtirish'\)\}/.test(cluster));
  // Funksiya YO'QOLMADI: bosish va ro'yxat ochish o'sha-o'sha.
  checkTrue('10) bosish ishlaydi', /onToggle: toggleLike/.test(profile));
  checkTrue('10) son ro‘yxat ochadi', /onOpenList: \(\) => setFollowListDir\('likes'\)/.test(profile));
}

// ── 11) BARMOQ UCHUN O'LCHAM VA TOR EKRAN ────────────────────────────
{
  checkTrue('11) tugma 40px', /\.pf-act\{[\s\S]{0,200}width:40px;height:40px/.test(css));
  // 320px da ORALIQ siqiladi, O'LCHAM emas — kichraygan tugmaga
  // barmoq tegmay qolardi.
  checkTrue('11) tor ekranda oraliq siqiladi', /@media \(max-width:360px\)\{[\s\S]{0,160}\.pf-actions\{gap:0\}/.test(css));
  checkTrue('11) tor ekranda ham >=36px', /@media \(max-width:360px\)\{[\s\S]{0,200}\.pf-act\{width:36px\}/.test(css));
}

// ── 12) MAVZUGA BOG'LIQ RANGLAR ──────────────────────────────────────
// Qattiq yozilgan rang boshqa mavzuda ko'rinmay qolardi. Yagona
// istisno — yurakning qizili: u "yoqdi" degan umumiy belgi va mavzu
// bilan o'zgarmasligi kerak.
{
  const block = css.slice(css.indexOf('.pf-actions{'), css.indexOf('.music-ring-btn:focus-visible'));
  const hex = [...block.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase());
  const allowed = new Set(['#f2555a', '#fff', '#000']);
  const bad = hex.filter((h) => !allowed.has(h));
  check('12) ruxsatsiz qattiq rang yo‘q', bad.join(','), '');
  checkTrue('12) matn rangi tokendan', /color:var\(--vz-ink-faint\)/.test(block));
  checkTrue('12) ramka tokendan', /border:1px solid var\(--vz-line\)/.test(block));
  checkTrue('12) fokus halqasi tokendan', /outline:2px solid var\(--vz-accent\)/.test(block));
}

// ── 13) STORY VA POST AJRALGANICHA QOLADI ────────────────────────────
// Bu ish boshga tegdi, Story/Post oqimiga EMAS. Qayta birlashib
// qolmaganini shu yerda ham qo'riqlaymiz.
{
  checkTrue('13) ega amallarida story va post alohida',
    /ownerActionUrl\(record\.code, 'story'\)/.test(profile) && /ownerActionUrl\(record\.code, 'post'\)/.test(profile));
  checkTrue('13) biznesda ham alohida',
    /ownerActionUrl\(record\.code, 'story'\)/.test(business) && /ownerActionUrl\(record\.code, 'post'\)/.test(business));
}

done('Ochiq profil boshi va musiqa halqasi');
