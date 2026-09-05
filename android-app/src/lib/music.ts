/**
 * Profile music source parser — ported 1:1 from src/lib/music.js (web app).
 * Three real source kinds must be supported (brief §1/§9 "no shortcuts"):
 * YouTube (embed), Yandex Music (embed, no official SDK), and direct audio
 * files (native playback via expo-av). See android/docs/03-ARCHITECTURE.md
 * §3.6 and 04-SCREEN_MAP.md's `MusicPlayer` composite.
 */
export type MusicSource =
  | { kind: 'youtube'; id: string }
  | { kind: 'yandex'; frag: string }
  | { kind: 'audio'; url: string };

export function parseMusicSource(url?: string | null): MusicSource | null {
  const s = String(url || '').trim();
  if (!s) return null;

  const yt = s.match(
    /(?:youtube\.com\/(?:watch\?(?:[^ ]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
  );
  if (yt) return { kind: 'youtube', id: yt[1] };

  if (/music\.youtube\.com/i.test(s)) {
    const m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m) return { kind: 'youtube', id: m[1] };
  }

  if (/music\.yandex\.[a-z.]+/i.test(s)) {
    const frag = yandexFragment(s);
    if (frag) return { kind: 'yandex', frag };
  }

  return { kind: 'audio', url: s };
}

function yandexFragment(s: string): string | null {
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

export function yandexEmbedSrc(frag: string): string {
  return `https://music.yandex.ru/iframe/#${frag}`;
}

export function youtubeEmbedSrc(id: string): string {
  // playlist=<id> loops a single video via the YouTube IFrame API, matching
  // the web app's loop behavior (ProfilePage.jsx loadYouTubeApi).
  return `https://www.youtube.com/embed/${id}?autoplay=0&playsinline=1&loop=1&playlist=${id}`;
}

export function isEmbedMusic(url?: string | null): boolean {
  const p = parseMusicSource(url);
  return !!p && (p.kind === 'youtube' || p.kind === 'yandex');
}
