// ISTORYA MEDIASI — TURINI ANIQLASH VA BIRINCHI KADRNI SO'RASH
//
// NIMA UCHUN ALOHIDA FAYL. Bu ikki qoida lentada ham (StoryGrid),
// to'liq ekranda ham (StoryViewer) bir xil bo'lishi kerak: biri
// "video" deb, ikkinchisi "rasm" deb qarasa, odam bosgan katak bilan
// ochilgan oyna bir-biriga mos kelmasdi. Alohida fayl bo'lgani uchun
// ularni `scripts/test-story-grid.mjs` to'g'ridan-to'g'ri chaqirib
// tekshira oladi (JSX ni Node import qila olmaydi).

// Qator qanday media ko'rsatadi?
//
// `video` ustunligi ATAYLAB: server bitta qatorga ikkalasini ham
// yozmaydi, lekin eski qatorlarda ikkalasi to'lgan bo'lsa video —
// aniqroq tanlov (rasm ko'rsatib, bosilganda video ochilishi
// chalkashtirardi).
//
// `none` — ikkala maydon ham bo'sh. Bu MA'LUMOT XATOSI: ilgari
// bunday qator `<img src="">` ga aylanardi, brauzer esa bo'sh
// manzilni SAHIFANING O'ZI deb o'qib, HTML ni rasm sifatida
// yuklashga urinardi va jim yiqilardi — ekranda shunchaki qora
// katak qolardi. Endi u ochiq xato holati bo'lib ko'rinadi.
export function storyMediaKind(story) {
  if (story && story.videoUrl) return 'video';
  if (story && story.imageUrl) return 'image';
  return 'none';
}

export function storyMediaUrl(story) {
  const kind = storyMediaKind(story);
  if (kind === 'video') return String(story.videoUrl);
  if (kind === 'image') return String(story.imageUrl);
  return '';
}

// VIDEODAN BIRINCHI KADRNI SO'RASH.
//
// `preload="metadata"` brauzerga "uzunligi va o'lchamini ol, KADR
// OLMA" deydi. Ya'ni element chizilgan bo'ladi-yu, ichida
// ko'rsatadigan pikselning o'zi bo'lmaydi — natija qora to'rtburchak.
// `poster` rasmi bizda yo'q (uni yaratish uchun serverda videoni
// qayta kodlash kerak bo'lardi).
//
// `#t=0.1` — media fragmenti: brauzer 0.1-soniyaga o'tib, O'SHA
// kadrni chizadi. Ya'ni oldindan ko'rinish FAYLNING O'ZIDAN,
// qo'shimcha so'rovsiz olinadi.
//
// Havolada allaqachon fragment bo'lsa — tegilmaydi (ikkita `#`
// bo'lgan manzil yaroqsiz bo'lardi).
export function videoPosterSrc(url) {
  const s = String(url == null ? '' : url);
  return !s || s.includes('#') ? s : `${s}#t=0.1`;
}
