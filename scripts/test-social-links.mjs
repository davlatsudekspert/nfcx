// Ijtimoiy tarmoq havolalari (2026-09).
//   node scripts/test-social-links.mjs
//
// NIMA UCHUN: maydonlar faqat username kutardi va havola
// `https://instagram.com/${qiymat}` deb yopishtirilardi. Odam esa
// Instagram bergan TO'LIQ manzilni qo'yadi — natijada havola
// `https://instagram.com/https://www.instagram.com/...` bo'lib buzilardi
// va profil o'rniga Instagram bosh sahifasi ochilardi.
import { socialUrl, socialHandle } from '../src/lib/socialLinks.js';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

// ═══ 1. INSTAGRAM — hamma ko'rinish bir xil natija beradi ═══
{
  const want = 'https://instagram.com/neomsongs';
  for (const input of [
    'neomsongs',
    '@neomsongs',
    '  neomsongs  ',
    'instagram.com/neomsongs',
    'www.instagram.com/neomsongs',
    'https://instagram.com/neomsongs',
    'https://www.instagram.com/neomsongs/',
    // Ishlab chiqarishda uchragan AYNAN shu havola (QR tugmasidan):
    'https://www.instagram.com/neomsongs?stkn=eXdhZmVxbDhxazAz&utm_source=qr',
  ]) {
    check(`ig: ${input.slice(0, 44)}`, socialUrl('ig', input), want);
  }
  checkTrue('buzilgan qo\'sh havola YASALMAYDI',
    !socialUrl('ig', 'https://www.instagram.com/neomsongs?stkn=x').includes('instagram.com/https'));
}

// ═══ 2. TELEGRAM — maxsus havolalar buzilmaydi ═══
{
  check('tg: username', socialUrl('tg', '@muhammad'), 'https://t.me/muhammad');
  check('tg: to\'liq manzil', socialUrl('tg', 'https://t.me/muhammad'), 'https://t.me/muhammad');
  // Taklif havolasi — yo'l BIR NECHTA bo'lakli va ma'noli, qisqartirilmaydi.
  check('tg: taklif havolasi (+)', socialUrl('tg', 'https://t.me/+AbCd123'), 'https://t.me/+AbCd123');
  check('tg: joinchat', socialUrl('tg', 'https://t.me/joinchat/XYZ'), 'https://t.me/joinchat/XYZ');
}

// ═══ 3. X va FACEBOOK ═══
{
  check('x: kuzatuv parametri tashlanadi', socialUrl('x', 'https://x.com/elon?s=20'), 'https://x.com/elon');
  check('x: username', socialUrl('x', '@elon'), 'https://x.com/elon');
  // Facebook profil manzillari xilma-xil — to'liq manzilga TEGILMAYDI.
  check('fb: to\'liq manzil saqlanadi',
    socialUrl('fb', 'https://facebook.com/profile.php?id=61'), 'https://facebook.com/profile.php?id=61');
  check('fb: username', socialUrl('fb', 'mycompany'), 'https://facebook.com/mycompany');
}

// ═══ 4. BO'SH va NOTO'G'RI qiymat ═══
{
  check('bo\'sh -> bo\'sh havola', socialUrl('ig', ''), '');
  check('faqat bo\'shliq -> bo\'sh', socialUrl('ig', '   '), '');
  check('null -> bo\'sh', socialUrl('ig', null), '');
  check('faqat @ -> bo\'sh', socialUrl('ig', '@'), '');
}

// ═══ 5. SAQLASHDA TOZALANADI ═══
// Bazaga to'liq manzil emas, toza username yoziladi.
{
  check('ig handle', socialHandle('ig', 'https://www.instagram.com/neomsongs?stkn=x'), 'neomsongs');
  check('x handle', socialHandle('x', 'https://x.com/elon?s=20'), 'elon');
  check('tg handle', socialHandle('tg', 'https://t.me/muhammad'), 'muhammad');
  check('oddiy username o\'zgarmaydi', socialHandle('ig', 'neomsongs'), 'neomsongs');
}

done();
