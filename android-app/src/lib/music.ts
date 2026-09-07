/**
 * Profile music source parser — the URL grammar is ported 1:1 from
 * src/lib/music.js (web app), then hardened for a native release build:
 *
 *  - YouTube (youtube.com / youtu.be / music.youtube.com / shorts / live)
 *    → IFrame Player API in a WebView. A `list=` playlist parameter, which
 *    the Worker stores verbatim (`recSafeUrl`), is kept so the player can
 *    auto-advance through the playlist.
 *  - Yandex Music (music.yandex.{ru,com,uz,…} track/album/playlist)
 *    → Yandex's official iframe widget (no public SDK exists).
 *  - Direct audio file (.mp3/.m4a, or the `/uploads/<file>` path that
 *    `POST /api/upload-audio` returns) → native playback via expo-audio.
 *
 * The web app plays `/uploads/x.mp3` because the browser resolves it against
 * the page origin; on Android there is no origin, so the bare path must be
 * turned into an absolute https URL here. Plain `http://` is upgraded too —
 * the release build ships with `usesCleartextTraffic: false`, so a cleartext
 * URL would be refused by the OS rather than played.
 *
 * `musicUrl` is a single string on the wire (see `validateRecordBody` in
 * hosting/worker.js — `uploadOrSafeUrl`, which rejects anything that is not
 * one http(s) URL or one `/uploads/` path). There is no comma/newline list
 * form on the web either, so none is invented here.
 */
import { resolveMediaUrl } from '../composites/mediaUrl';

export type MusicSource =
  | { kind: 'youtube'; id: string; listId?: string }
  | { kind: 'yandex'; frag: string; collection: boolean }
  | { kind: 'audio'; url: string };

const YT_ID_RE = /(?:youtube\.com\/(?:watch\?(?:[^ ]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;
const YT_HOST_RE = /(?:^|\/\/)(?:www\.|m\.|music\.)?youtube\.com\//i;

export function parseMusicSource(url?: string | null): MusicSource | null {
  const s = String(url || '').trim();
  if (!s) return null;

  const yt = s.match(YT_ID_RE);
  if (yt) return withList({ kind: 'youtube', id: yt[1] }, s);

  if (/music\.youtube\.com/i.test(s)) {
    const m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m) return withList({ kind: 'youtube', id: m[1] }, s);
  }

  // A bare playlist link (youtube.com/playlist?list=PL…) has no video id;
  // the IFrame API starts at the list's first item.
  if (YT_HOST_RE.test(s)) {
    const listId = youtubeListId(s);
    if (listId) return { kind: 'youtube', id: '', listId };
  }

  if (/music\.yandex\.[a-z.]+/i.test(s)) {
    const frag = yandexFragment(s);
    if (frag) return { kind: 'yandex', frag, collection: !frag.startsWith('track/') };
  }

  const audio = resolveAudioUrl(s);
  return audio ? { kind: 'audio', url: audio } : null;
}

function withList(source: { kind: 'youtube'; id: string }, raw: string): MusicSource {
  const listId = youtubeListId(raw);
  return listId ? { ...source, listId } : source;
}

/** The `list=` playlist id, if the URL carries one that the embed player can
 * actually load. Auto-generated "Mix" radios (`RD…`) are refused by the
 * IFrame API on embeds, so they are ignored rather than surfaced as a
 * playlist that then never advances. */
export function youtubeListId(url: string): string | null {
  const m = String(url || '').match(/[?&#]list=([A-Za-z0-9_-]{10,})/i);
  if (!m) return null;
  if (/^RD/.test(m[1])) return null;
  return m[1];
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

/** Absolute, https-only URL for a direct audio file, or null when the stored
 * value cannot be loaded by the native player at all (a bare word, a
 * javascript: URL, an empty string). */
export function resolveAudioUrl(value?: string | null): string | null {
  const resolved = resolveMediaUrl(value);
  if (!resolved) return null;
  if (/^http:\/\//i.test(resolved)) return resolved.replace(/^http:\/\//i, 'https://');
  if (/^https:\/\//i.test(resolved)) return resolved;
  // data:/file:/content: sources are never what the backend stores for
  // profile music; refusing them keeps a corrupt row from spinning up a
  // player that can only error.
  return null;
}

export function yandexEmbedSrc(frag: string): string {
  return `https://music.yandex.ru/iframe/#${frag}`;
}

export function isEmbedMusic(url?: string | null): boolean {
  const p = parseMusicSource(url);
  return !!p && (p.kind === 'youtube' || p.kind === 'yandex');
}
