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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { check, checkTrue, done } = makeChecker();

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

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

const APPS = [
  {
    name: 'Nova (yangi)',
    manifest: 'mobile_nova/android/app/src/main/AndroidManifest.xml',
    gradle: 'mobile_nova/android/app/build.gradle.kts',
    plist: 'mobile_nova/ios/Runner/Info.plist',
    label: 'NFCSTORE',
    appId: 'uz.nfcstore.nova',
  },
  {
    name: 'Classic (eski)',
    manifest: 'mobile/android/app/src/main/AndroidManifest.xml',
    gradle: 'mobile/android/app/build.gradle.kts',
    plist: 'mobile/ios/Runner/Info.plist',
    label: 'NFCSTORE Classic',
    appId: 'uz.nfcstore.app',
  },
];

for (const app of APPS) {
  check(`${app.name}: Android nomi`, androidLabel(read(app.manifest)), app.label);
  check(`${app.name}: iOS nomi`, iosName(read(app.plist)), app.label);

  // `applicationId = "..."` — `applicationIdSuffix` bilan
  // ADASHTIRILMAYDI (Nova'da debug uchun `.debug` qo'shimchasi bor).
  const gradle = read(app.gradle);
  const m = gradle.match(/applicationId\s*=\s*"([^"]+)"/);
  check(`${app.name}: paket ID`, m ? m[1] : '', app.appId);
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
