// POST RO'YXATI — MEDIASIZ POST QORA SLOT BERMASIN
//
// SHIKOYAT (production, VIP001). "Post 18" deb turardi, lekin
// kartalarning ko'pida media joyi qop-qora edi — ostida esa izoh
// bor edi ("NOVA E2E TEST — DELETE · post · ...").
//
// SABAB. Post kartasidagi shart FAQAT `videoUrl` ga qarardi:
//
//     p.videoUrl ? <video .../> : <img src={p.imageUrl} />
//
// Media UMUMAN bo'lmagan postda ham `<img src="">` chizilardi.
// Brauzer bo'sh manzilni SAHIFANING O'ZI deb o'qiydi, HTML ni rasm
// sifatida yuklashga urinadi va jim yiqiladi — ekranda katta qora
// to'rtburchak qoladi. `onError` ham yo'q edi, ya'ni buzuq media ham
// aynan shunday ko'rinardi.
//
// QOIDA:
//   mediasiz post  -> media joyi UMUMAN chizilmaydi (matn kartasi);
//   mediali post   -> `MediaThumb` orqali (media kelmasa ham
//                     nomlangan qatlam ko'rsatadi);
//   video post     -> ▶ belgisi.
//
//   node scripts/test-post-grid.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';
import { mediaKind } from '../src/lib/media.js';

const { check, checkTrue, done } = makeChecker();
const src = stripComments(readFileSync(new URL('../src/pages/ProfilePage.jsx', import.meta.url), 'utf8'));

// Post kartasini o'z ichiga olgan bo'lak.
const start = src.indexOf('function PostsFeed(');
checkTrue('0) PostsFeed topildi', start > 0);
const feed = src.slice(start, src.indexOf('\nfunction ', start + 10));

// ── 1) MEDIASIZ POST — MATN KARTASI ──────────────────────────────────
{
  // Media joyi SHARTGA bog'langan bo'lsin.
  checkTrue('1) media joyi shart bilan chiziladi', /kind !== 'none' && \(/.test(feed));
  // Eski shart qaytib kelmasin.
  checkTrue('1) eski "videoUrl ? ... : <img>" sharti yo‘q',
    !/p\.videoUrl\s*\?[\s\S]{0,400}<img/.test(feed));
  checkTrue('1) xom <img src={p.imageUrl}> yo‘q', !/<img src=\{p\.imageUrl\}/.test(feed));
  // Butunlay bo'sh post ham nimadir aytsin.
  checkTrue('1) bo‘sh post uchun matn bor', feed.includes("kind === 'none' && !p.caption"));
}

// ── 2) MEDIALI POST — UMUMIY QATLAMDAN ───────────────────────────────
{
  checkTrue('2) MediaThumb ishlatiladi', /<MediaThumb item=\{p\}/.test(feed));
  // Media joyi O'LCHAMINI SAQLASIN: media yiqilsa karta yig'ilib
  // qolmasin, aks holda qatlamning to'ldiradigan joyi bo'lmasdi.
  checkTrue('2) media joyi o‘lchamini saqlaydi', /className="mt-post"/.test(feed));
  checkTrue('2) video uchun ▶ bor', /kind === 'video' && \(/.test(feed));
  // ▶ mediani bosib qo'ymasin, lekin ustida tursin.
  checkTrue('2) ▶ media ustida (z-index)', /z-\[2\]/.test(feed));
  checkTrue('2) ▶ bosishni to‘smaydi', /pointer-events-none/.test(feed));
}

// ── 3) QATTIQ QORA FON QOLMAGAN ──────────────────────────────────────
// Eski kartada `bg-black` ikki joyda edi: media yiqilsa aynan o'sha
// qora ko'rinardi.
{
  checkTrue('3) media joyida bg-black yo‘q', !/bg-black[^/]/.test(feed.replace(/bg-black\/\d+/g, '')));
}

// ── 4) KARTA QOLGAN QISMI JOYIDA ─────────────────────────────────────
// Tuzatish paytida like/vaqt/izoh yo'qolib ketmagan bo'lsin.
{
  checkTrue('4) izoh chiziladi', /p\.caption && </.test(feed));
  checkTrue('4) like tugmasi bor', /onLike\(p\.id\)/.test(feed));
  checkTrue('4) vaqt ko‘rsatiladi', /timeAgo\(p\.createdAt\)/.test(feed));
  checkTrue('4) bosilganda kattalashadi', /setZoom\(p\)/.test(feed));
  checkTrue('4) bo‘sh ro‘yxat holati bor', /posts\.length === 0/.test(feed));
}

// ── 5) TUR ANIQLASH — SOF FUNKSIYA ───────────────────────────────────
// Post qatori story qatori bilan BIR XIL shaklda keladi, shuning uchun
// bitta qoida ikkalasiga ham yetadi.
{
  check('5) mediasiz post -> none', mediaKind({ caption: 'faqat matn' }), 'none');
  check('5) bo‘sh satrli post -> none', mediaKind({ imageUrl: '', videoUrl: '' }), 'none');
  check('5) rasmli post -> image', mediaKind({ imageUrl: '/uploads/p.jpg' }), 'image');
  check('5) videoli post -> video', mediaKind({ videoUrl: '/uploads/p.mp4' }), 'video');
}

done('Post ro‘yxati');
