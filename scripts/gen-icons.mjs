// LOGOTIP VA IKONKALARNI QAYTA CHIQARISH.
//
// Egasining talabi: "logoni sifatini yaxshilash" va "faviconni ham
// o'zgartirish".
//
// Nima uchun ALOHIDA SKRIPT: ikonkalar qo'lda chizilmaydi, ular BITTA
// manbadan (src/assets/nfcstore-logo-source.png) hisoblanadi. Shunda
// keyingi safar logotip o'zgarsa, hammasi bir buyruq bilan yangilanadi
// va o'lchamlar orasida farq qolib ketmaydi.
//
//   node scripts/gen-icons.mjs
//
// DIQQAT: bu skript Python (Pillow) ni chaqiradi — u tasvirni
// sifatli kichraytirish (Lanczos) va dumaloq niqob uchun kerak.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('python3', [join(root, 'scripts', 'gen-icons.py')], { cwd: root, stdio: 'inherit' });
