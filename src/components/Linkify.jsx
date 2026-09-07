import { linkifyParts } from '../lib/linkify.js';

// Oddiy matnni ko'rsatadi, ichidagi havolalarni bosiladigan qiladi.
//
// `dangerouslySetInnerHTML` ISHLATILMAYDI: matn bo'laklarga ajratiladi
// va React har birini o'zi ekranlaydi — admin kiritgan matn hech qachon
// HTML sifatida talqin qilinmaydi.
//
// `rel="noopener noreferrer nofollow"` — noopener yangi oynadan bizning
// sahifamizni boshqarishning oldini oladi, nofollow esa yangilikdagi
// tashqi havolalar saytimizning qidiruv reytingini olib ketmasligi uchun.
export default function Linkify({ text }) {
  const parts = linkifyParts(text);
  return (
    <>
      {parts.map((p, i) => (p.type === 'link' ? (
        <a
          key={i}
          href={p.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="break-all underline underline-offset-2"
          style={{ color: 'var(--vz-gold)' }}
        >
          {p.label}
        </a>
      ) : (
        // Fragment — matn bo'lagi o'z holicha, hech qanday o'ram
        // qo'shilmasdan chiqadi (ota elementdagi `whitespace-pre-wrap`
        // qatorlarni saqlab qolishi uchun).
        <span key={i}>{p.value}</span>
      )))}
    </>
  );
}
