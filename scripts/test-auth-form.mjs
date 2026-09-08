// Kirish formasining tuzilishi — src/pages/AuthPage.jsx.
//
// NIMA UCHUN BU TEST BOR: 2026-09-08 da ro'yxatdan o'tish formasi ikki
// ustunga bo'linganda o'rovchi <div> `{isRegister && <div ...>` ichida
// ochilib qolgan edi. JSX'da bunday yozuv butun blokni shartga
// bog'laydi — kirish sahifasida PAROL MAYDONI umuman render bo'lmadi va
// hech kim akkauntiga kira olmadi. `npm run build` bunga hech qanday
// xato bermaydi: JSX to'g'ri, mantiq noto'g'ri.
//
// Shuning uchun bu yerda AYNAN shu narsa tekshiriladi: kirish uchun
// kerak bo'lgan maydonlar `isRegister` shartining ICHIDA turmasin.
//
//   node scripts/test-auth-form.mjs
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}
const checkTrue = (label, v) => check(label, !!v, true);

const src = readFileSync(new URL('../src/pages/AuthPage.jsx', import.meta.url), 'utf8');

// Faylning berilgan o'rni nechta OCHIQ `{isRegister && ...}` blok ichida
// turganini sanaydi. JSX ifodalari `{` bilan ochilib `}` bilan yopiladi,
// shuning uchun qavslarni sanash yetarli — satrlar (' " `) ichidagi
// qavslar hisobga olinmasligi uchun ular o'tkazib yuboriladi.
function registerOnlyDepthAt(text, index) {
  const stack = [];
  let i = 0;
  while (i < index) {
    const c = text[i];
    // IZOHLARNI ham o'tkazamiz. Bu shart: o'zbekcha izohlarda apostrof
    // ko'p ("Ko'p odam", "bo'lsa"), va ular satr boshlanishi deb
    // qaralsa qavslar sanog'i butunlay chalkashadi. Izoh satrdan
    // OLDIN tekshiriladi — lekin qo'shtirnoq ichidagi "https://" ni
    // izoh deb o'qimaslik uchun satr tekshiruvi shu tartibda turadi:
    // biz qavs belgisidamiz yoki satr belgisidamiz, ikkalasi bir vaqtda emas.
    if (c === '/' && text[i + 1] === '/') {
      while (i < index && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < index && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // Satr ichini butunlay o'tkazamiz — ichidagi { } JSX qavsi emas.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < index && text[i] !== quote) { if (text[i] === '\\') i++; i++; }
      i++;
      continue;
    }
    if (c === '{') {
      // Shu qavsdan keyin darhol `isRegister &&` kelayotgan bo'lsa —
      // bu "faqat ro'yxatdan o'tishda" bloki.
      stack.push(/^\{\s*isRegister\s*&&/.test(text.slice(i, i + 24)));
      i++;
      continue;
    }
    if (c === '}') { stack.pop(); i++; continue; }
    i++;
  }
  return stack.filter(Boolean).length;
}

// ── 1) PAROL MAYDONI kirishda ham bo'lishi SHART ──────────────────────
const pwIdx = src.indexOf("autoComplete={isRegister ? 'new-password' : 'current-password'}");
checkTrue('parol maydoni topildi', pwIdx > 0);
check('parol maydoni `isRegister` shartidan TASHQARIDA', registerOnlyDepthAt(src, pwIdx), 0);

// ── 2) Login/email maydoni va yuborish tugmasi ham ────────────────────
// 2026-09: "yaratish" so'zi diniy sabab bilan "ochish" ga almashtirildi.
const submitIdx = src.indexOf("isRegister ? t('Akkaunt ochish') : t('Kirish')");
checkTrue('yuborish tugmasi topildi', submitIdx > 0);
check('yuborish tugmasi shartdan tashqarida', registerOnlyDepthAt(src, submitIdx), 0);

const idIdx = src.indexOf("autoComplete=\"username\"");
checkTrue('login (telefon yoki email) maydoni topildi', idIdx > 0);
check('login maydoni shartdan tashqarida', registerOnlyDepthAt(src, idIdx), 0);

// ── 3) Faqat ro'yxatdan o'tishga tegishli maydonlar ICHIDA bo'lsin ────
// (test o'zini tekshiradi: agar sanoq mantig'i buzilsa, bu ham yiqiladi)
for (const [label, needle] of [
  // DIQQAT: `Parolni qayta kiriting` matni parolni TIKLASH formasida ham
  // bor (u isRegister shartiga kirmaydi), shuning uchun aynan ro'yxatdan
  // o'tishdagi maydonning o'zgaruvchisi bo'yicha qidiriladi.
  ['parolni takrorlash', 'value={password2}'],
  ['email (ixtiyoriy)', 'placeholder="ism@gmail.com"'],
  ['promokod', "value={promoCode}"],
]) {
  const i = src.indexOf(needle);
  checkTrue(`${label} maydoni topildi`, i > 0);
  checkTrue(`${label} — faqat ro'yxatdan o'tishda`, registerOnlyDepthAt(src, i) > 0);
}

// ── 4) Shartli o'rovchi element umuman bo'lmasin ──────────────────────
// Aynan xatoga olib kelgan shakl: `{isRegister && <div ...>` — ochilgan
// teg shart ichida, yopilgani esa tashqarida.
check('shartli ochiladigan <div> yo‘q', /\{\s*isRegister\s*&&\s*<(div|form|section|fieldset)[^/>]*>\s*$/m.test(src), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
