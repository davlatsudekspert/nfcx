// src/lib/exclusivePricing.js dan Worker nusxasini QAYTA YOZADI.
//
// NIMA UCHUN: build qoidasi bo'yicha hosting/worker.js `src/` dan import
// qila olmaydi (Worker alohida bundle). Ro'yxatlarni ikki joyga QO'LDA
// yozish esa vaqt o'tib ajralib ketadi — sayt bir narx, server boshqa
// narx ko'rsatadi. Shuning uchun manba bitta, nusxa generatsiya qilinadi.
//
//   node scripts/gen-exclusive-pricing.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = new URL('../src/lib/exclusivePricing.js', import.meta.url);
const DEST = new URL('../hosting/exclusive-pricing.generated.js', import.meta.url);

// Fayl AYNAN ko'chiriladi (export'lari bilan): u `hosting/` ichida
// turgani uchun Worker undan to'g'ridan-to'g'ri import qila oladi —
// build qoidasi faqat `src/` dan importni taqiqlaydi. Shunday qilib
// ro'yxatlar ikki marta yozilmaydi ham, ajralib ketmaydi ham.
const code = readFileSync(SRC, 'utf8');

const header = `// AVTOMATIK GENERATSIYA QILINGAN — QO'LDA TAHRIRLAMANG.
// Manba: src/lib/exclusivePricing.js
// Yangilash: node scripts/gen-exclusive-pricing.mjs
// Tekshiruv: node scripts/test-exclusive-pricing.mjs (ikki nusxani solishtiradi)

`;
writeFileSync(DEST, header + code);
console.log('yozildi:', DEST.pathname);
