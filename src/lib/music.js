// Profil musiqasi manbasini tahlil qiladi:
//  - YouTube havolasi (youtube.com / youtu.be / music.youtube.com / shorts) →
//    IFrame Player API orqali ijro etiladi (iOS'da ham ishlaydi, faylsiz).
//  - Yandex Music havolasi (music.yandex.ru/… track/album/playlist) →
//    Yandex rasmiy iframe-vidjeti orqali (iOS/Android'da ham ishlaydi).
//  - To'g'ridan-to'g'ri audio fayl (.mp3, .m4a, /uploads/...) → <audio> tegi.
export function parseMusicSource(url) {
  const s = String(url || '').trim();
  if (!s) return null;

  // youtu.be/<id>, youtube.com/watch?v=<id>, /embed/<id>, /shorts/<id>, /live/<id>
  const yt = s.match(
    /(?:youtube\.com\/(?:watch\?(?:[^ ]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  );
  if (yt) return { kind: 'youtube', id: yt[1] };

  // music.youtube.com/watch?v=<id>
  if (/music\.youtube\.com/i.test(s)) {
    const m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m) return { kind: 'youtube', id: m[1] };
  }

  // Yandex Music: music.yandex.{ru,com,uz,kz,by,…}
  if (/music\.yandex\.[a-z.]+/i.test(s)) {
    const frag = yandexFragment(s);
    if (frag) return { kind: 'yandex', frag };
  }

  return { kind: 'audio', url: s };
}

// Yandex havolasidan iframe fragmenti: "track/<t>/<a>", "album/<a>",
// "playlist/<uid>/<kind>". Topilmasa null.
function yandexFragment(s) {
  let m = s.match(/\/album\/(\d+)\/track\/(\d+)/i);
  if (m) return `track/${m[2]}/${m[1]}`;

  m = s.match(/\/iframe\/#?((?:track|album|playlist)\/[^?&\s]+)/i);
  if (m) return m[1].replace(/\/+$/, '');

  m = s.match(/\/track\/(\d+)/i);
  if (m) return `track/${m[1]}`;

  m = s.match(/\/users\/([^/?\s]+)\/playlists\/(\d+)/i);
  if (m) return `playlist/${m[1]}/${m[2]}`;

  m = s.match(/\/album\/(\d+)/i);
  if (m) return `album/${m[1]}`;

  return null;
}

export function yandexEmbedSrc(frag) {
  return `https://music.yandex.ru/iframe/#${frag}`;
}

export function isYoutubeMusic(url) {
  const p = parseMusicSource(url);
  return !!p && p.kind === 'youtube';
}

// Yuklangan fayl emas, tashqi vidjet (YouTube/Yandex) — iPhone/Android'da ishlaydi.
export function isEmbedMusic(url) {
  const p = parseMusicSource(url);
  return !!p && (p.kind === 'youtube' || p.kind === 'yandex');
}
