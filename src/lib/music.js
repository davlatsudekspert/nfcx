// Profil musiqasi manbasini tahlil qiladi:
//  - YouTube havolasi (youtube.com / youtu.be / music.youtube.com / shorts) →
//    iframe orqali ijro etiladi (iOS'da ham ishlaydi, faylsiz).
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

  return { kind: 'audio', url: s };
}

export function isYoutubeMusic(url) {
  const p = parseMusicSource(url);
  return !!p && p.kind === 'youtube';
}
