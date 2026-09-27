// IKKI ILOVANING NOMI VA PAKET ID'SI.
//
//   node scripts/test-app-identity.mjs
//
// ── NIMA UCHUN BU TEST BOR ────────────────────────────────────────
//
// Bitta telefonda IKKALA ilova ham turishi mumkin:
//
//   uz.nfcstore.app   — eski ilova, "NFCSTORE Classic"
//   uz.nfcstore.nova  — yangi ilova, "NFCSTORE"
//
// Ikki xavf bor va ikkalasi ham jimgina sodir bo'ladi:
//
//   1. NOMLAR BIR XIL BO'LIB QOLSA — odam qaysi birini
//      ochayotganini bilmaydi. Ekranda ikkita bir xil belgi
//      turadi.
//
//   2. `applicationId` O'ZGARSA — bu Android uchun BOSHQA ilova.
//      Play Store yangilanish o'rniga ikkinchi nusxa o'rnatadi,
//      o'rnatilgan ilova esa yangilanishni umuman olmaydi.
//      Bu qaytarib bo'lmaydigan xato: paket nomini keyin
//      o'zgartirib bo'lmaydi.
//
// `flutter analyze` ham, `npm run build` ham bunga xato bermaydi.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeChecker } from './lib/d1-harness.mjs';
import { badTagOpens } from './lib/xml-wellformed.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { check, checkTrue, done } = makeChecker();

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/// MANIFEST YAROQLI XML MI.
///
/// NIMA UCHUN BU TEKSHIRUV BOR — HAQIQIY XATODAN.
///
/// Ilova nomini o'zgartirganda izoh `<application ...>` TEGINING
/// ICHIGA, atributlar orasiga tushib qoldi. Bu yaroqsiz XML va
/// `flutter build` uni "Error parsing LocalFile" bilan rad etdi.
///
/// Eng yomoni — buni HECH NARSA oldindan aytmadi: `flutter
/// analyze` ham, `flutter test` ham (519 ta test) manifestni
/// O'QIMAYDI. Xato faqat CI da, APK qurish bosqichida chiqdi.
///
/// Shuning uchun tuzilish shu yerda tekshiriladi: teglar
/// juftligi va atributlarning teg ichida ekani.
function assertWellFormedXml(label, xml) {
  // Mantiq `scripts/lib/xml-wellformed.mjs` da — NUSXA OLINMAYDI.
  // U yerda `scripts/test-android-manifests.mjs` ham ishlatadi:
  // ikki nusxa bo'lsa, biri tuzatilib ikkinchisi eskirib qolardi.
  const bad = badTagOpens(xml);
  if (bad.length) {
    console.log(`  ${label}: teg ichida begona "<":`);
    for (const b of bad) console.log(`    ${b}`);
  }
  check(`${label}: teg ichida begona "<" yo‘q`, bad.length, 0);
  checkTrue(`${label}: <manifest> yopilgan`, /<\/manifest>\s*$/.test(xml.trim()));
}

/** `android:label="..."` — izohlar ichidagi matn hisobga olinmaydi. */
function androidLabel(manifest) {
  const clean = manifest.replace(/<!--[\s\S]*?-->/g, '');
  const m = clean.match(/android:label="([^"]*)"/);
  return m ? m[1] : '';
}

/** `CFBundleDisplayName` ning qiymati. */
function iosName(plist) {
  const m = plist.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/);
  return m ? m[1] : '';
}

/// ILOVANING iOS BUNDLE ID LARI — `RunnerTests` dan tashqari.
///
/// Uchta konfiguratsiya (Debug/Release/Profile) — uchalasi bir xil
/// bo'lishi kerak: biri farq qilsa, TestFlight'ga boshqa ilova
/// bo'lib ketadi. Bundle ID App Store Connect'da ilova yaratilgach
/// O'ZGARTIRIB BO'LMAYDI — Android'dagi `applicationId` bilan bir
/// xil qaytarib bo'lmaydigan xato.
function iosBundleIds(pbxproj) {
  return [...pbxproj.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)]
    .map((m) => m[1].trim())
    .filter((id) => !id.endsWith('.RunnerTests'));
}

const APPS = [
  {
    name: 'Nova (yangi)',
    manifest: 'mobile_nova/android/app/src/main/AndroidManifest.xml',
    gradle: 'mobile_nova/android/app/build.gradle.kts',
    plist: 'mobile_nova/ios/Runner/Info.plist',
    pbxproj: 'mobile_nova/ios/Runner.xcodeproj/project.pbxproj',
    label: 'NFCSTORE',
    appId: 'uz.nfcstore.nova',
    // Egasining qarori (2026-09-27): iOS ham Android bilan bir xil.
    // Flutter yaratgan `uz.nfcstore.nfcstoreNova` hech qayerda
    // ro'yxatdan o'tmagan edi.
    iosId: 'uz.nfcstore.nova',
  },
  {
    name: 'Classic (eski)',
    manifest: 'mobile/android/app/src/main/AndroidManifest.xml',
    gradle: 'mobile/android/app/build.gradle.kts',
    plist: 'mobile/ios/Runner/Info.plist',
    pbxproj: 'mobile/ios/Runner.xcodeproj/project.pbxproj',
    label: 'NFCSTORE Classic',
    appId: 'uz.nfcstore.app',
    iosId: 'uz.nfcstore.nfcstore',
  },
];

for (const app of APPS) {
  // TUZILISH AVVAL: buzuq manifestdan o'qilgan nom ma'nosiz.
  assertWellFormedXml(app.name, read(app.manifest));
  check(`${app.name}: Android nomi`, androidLabel(read(app.manifest)), app.label);
  check(`${app.name}: iOS nomi`, iosName(read(app.plist)), app.label);

  // `applicationId = "..."` — `applicationIdSuffix` bilan
  // ADASHTIRILMAYDI (Nova'da debug uchun `.debug` qo'shimchasi bor).
  const gradle = read(app.gradle);
  const m = gradle.match(/applicationId\s*=\s*"([^"]+)"/);
  check(`${app.name}: paket ID`, m ? m[1] : '', app.appId);

  const bundles = iosBundleIds(read(app.pbxproj));
  check(`${app.name}: iOS konfiguratsiyalar soni`, bundles.length, 3);
  checkTrue(
    `${app.name}: iOS bundle ID = ${app.iosId} (${[...new Set(bundles)].join(', ')})`,
    bundles.length > 0 && bundles.every((id) => id === app.iosId),
  );
}

checkTrue(
  'iOS bundle ID lari FARQ qiladi',
  APPS[0].iosId !== APPS[1].iosId,
);

// ── iOS BELGISI — NFCSTORE, ALFA KANALSIZ ────────────────────────
//
// Nova'da iOS belgisi uzoq vaqt Flutter'ning STANDART ko'k logosi
// bo'lib qolgan edi — hech kim iPhone'da ochib ko'rmagani uchun
// sezilmadi. App Store esa:
//   * shaffof yoki alfa kanalli 1024 belgini yuklashda RAD ETADI;
//   * "placeholder" belgili ilovani ko'rib chiqishda rad etadi.
// PNG IHDR'dagi rang turi: 2 = RGB (alfa yo'q), 6 = RGBA.
{
  const icon = readFileSync(join(ROOT,
    'mobile_nova/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png'));
  check('iOS 1024 belgi: PNG rang turi RGB (alfa yo‘q)', icon[25], 2);
  const { createHash } = await import('node:crypto');
  const sha = createHash('sha256').update(icon).digest('hex');
  checkTrue('iOS belgisi Flutter standart logosi EMAS',
    sha !== '7770183009e914112de7d8ef1d235a6a30c5834424858e0d2f8253f6b8d31926');
}

// ── ENG MUHIMI: NOMLAR BIR XIL EMAS ──────────────────────────────
const labels = APPS.map((a) => androidLabel(read(a.manifest)));
checkTrue('ikkala ilovaning nomi FARQ qiladi', labels[0] !== labels[1]);

const ids = APPS.map((a) => {
  const m = read(a.gradle).match(/applicationId\s*=\s*"([^"]+)"/);
  return m ? m[1] : '';
});
checkTrue('paket ID lari FARQ qiladi', ids[0] !== ids[1] && ids[0] && ids[1]);

// ── "Nova" SO'ZI FOYDALANUVCHIGA KO'RINMAYDI ─────────────────────
//
// "Nova" ichki loyiha nomi. U telefon ekranida yoki do'konda
// turmasligi kerak — foydalanuvchiga hech narsa demaydi.
// `pubspec.yaml` dagi `name: nfcstore_nova` — Dart paketi nomi,
// u KO'RINMAYDI va o'zgartirilsa import yo'llari buziladi.
checkTrue('Android nomida "Nova" yo‘q', !/nova/i.test(labels[0]));
checkTrue('iOS nomida "Nova" yo‘q', !/nova/i.test(iosName(read(APPS[0].plist))));

done('Ilova nomi va paket ID');
