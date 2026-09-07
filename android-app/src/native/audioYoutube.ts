/**
 * YouTube playback for profile music — a self-contained IFrame Player API
 * page rendered in a `react-native-webview`, driven from React Native via
 * `injectJavaScript` and reporting back through `postMessage`.
 *
 * Why not `react-native-youtube-iframe`'s component: its playlist path is
 * broken in 2.4.1 (`loadPlaylist` references a `const` before its
 * declaration, and the initial embed passes the playlist id as `listType`
 * and as a `playlist` video-id list), and by default it loads a third-party
 * github.io page. The web app (src/pages/ProfilePage.jsx `loadYouTubeApi`)
 * talks to the IFrame API directly for the same reasons; this is that
 * approach with a message bridge.
 *
 * The page is loaded with `baseUrl: https://nfcstore.uz` so the embed has a
 * real origin/referrer — the same one nfcstore.uz itself embeds from.
 */
export const YOUTUBE_BASE_URL = 'https://nfcstore.uz';

/** YT.PlayerState codes (https://developers.google.com/youtube/iframe_api_reference#Playback_status). */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YoutubeBridgeMessage =
  | { type: 'ready' }
  | { type: 'state'; state: number }
  | {
      type: 'status';
      /** Seconds. */
      t: number;
      /** Seconds; 0 until the player knows. */
      d: number;
      title: string;
      author: string;
      /** Position in the playlist (0-based) or -1 when not in a playlist. */
      index: number;
      /** Playlist length or 0. */
      count: number;
    }
  | { type: 'error'; code: number };

export type YoutubeCommand = 'play' | 'pause' | 'next' | 'previous';

export interface YoutubePageOptions {
  videoId: string;
  listId?: string;
}

/** JavaScript to inject for a control command. Always ends in `true` so the
 * WebView bridge does not warn about a non-boolean result. */
export function youtubeCommandScript(command: YoutubeCommand): string {
  return `window.__nfcCmd(${JSON.stringify(command)});true;`;
}

export function youtubeSeekScript(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `window.__nfcSeek(${s});true;`;
}

/** Parses one `onMessage` payload; null for anything that is not ours. */
export function parseYoutubeBridgeMessage(raw: unknown): YoutubeBridgeMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const m = JSON.parse(raw) as { type?: unknown };
    if (!m || typeof m !== 'object' || typeof m.type !== 'string') return null;
    if (m.type === 'ready') return { type: 'ready' };
    if (m.type === 'state') {
      const state = Number((m as { state?: unknown }).state);
      return Number.isFinite(state) ? { type: 'state', state } : null;
    }
    if (m.type === 'error') {
      const code = Number((m as { code?: unknown }).code);
      return { type: 'error', code: Number.isFinite(code) ? code : -1 };
    }
    if (m.type === 'status') {
      const s = m as Record<string, unknown>;
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
      return {
        type: 'status',
        t: Math.max(0, num(s.t)),
        d: Math.max(0, num(s.d)),
        title: typeof s.title === 'string' ? s.title : '',
        author: typeof s.author === 'string' ? s.author : '',
        index: typeof s.index === 'number' && Number.isFinite(s.index) ? s.index : -1,
        count: Math.max(0, Math.floor(num(s.count))),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The player page. Single video: `loop:1` + `playlist:<id>` (the documented
 * way to loop one video, same as the web app). Playlist: `list`/`listType`
 * so YouTube itself advances to the next item when one ends and wraps at
 * the end of the list.
 */
export function buildYoutubePlayerHtml({ videoId, listId }: YoutubePageOptions): string {
  const safeVideoId = /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : '';
  const safeListId = listId && /^[A-Za-z0-9_-]{10,}$/.test(listId) ? listId : '';
  const playerVars = safeListId
    ? `{ listType: 'playlist', list: ${JSON.stringify(safeListId)}, playsinline: 1, controls: 0, rel: 0, loop: 1, fs: 0, iv_load_policy: 3 }`
    : `{ playsinline: 1, controls: 0, rel: 0, loop: 1, playlist: ${JSON.stringify(safeVideoId)}, fs: 0, iv_load_policy: 3 }`;
  const videoIdArg = safeListId ? '' : `videoId: ${JSON.stringify(safeVideoId)},`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; padding: 0; background: #070503; overflow: hidden; height: 100%; }
  #player { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="player"></div>
<script>
(function () {
  var player = null;
  var timer = null;
  function post(m) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {}
  }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
  function snapshot() {
    if (!player || typeof player.getCurrentTime !== 'function') return;
    var data = null, index = -1, list = null;
    try { data = player.getVideoData(); } catch (e) {}
    try { index = player.getPlaylistIndex(); } catch (e) {}
    try { list = player.getPlaylist(); } catch (e) {}
    var t = 0, d = 0;
    try { t = num(player.getCurrentTime()); } catch (e) {}
    try { d = num(player.getDuration()); } catch (e) {}
    post({
      type: 'status',
      t: t,
      d: d,
      title: data && data.title ? String(data.title) : '',
      author: data && data.author ? String(data.author) : '',
      index: typeof index === 'number' ? index : -1,
      count: list && list.length ? list.length : 0
    });
  }
  function startTimer() {
    if (timer) return;
    timer = setInterval(snapshot, 500);
  }
  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  window.__nfcCmd = function (cmd) {
    if (!player) return;
    try {
      if (cmd === 'play') player.playVideo();
      else if (cmd === 'pause') player.pauseVideo();
      else if (cmd === 'next') player.nextVideo();
      else if (cmd === 'previous') player.previousVideo();
    } catch (e) {}
  };
  window.__nfcSeek = function (seconds) {
    if (!player) return;
    try { player.seekTo(seconds, true); snapshot(); } catch (e) {}
  };
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
      width: '100%',
      height: '100%',
      ${videoIdArg}
      playerVars: ${playerVars},
      events: {
        onReady: function () { post({ type: 'ready' }); snapshot(); },
        onStateChange: function (e) {
          post({ type: 'state', state: e.data });
          snapshot();
          if (e.data === 1) startTimer(); else stopTimer();
          if (e.data === 0 && ${safeListId ? 'false' : 'true'}) {
            // Single video: the loop/playlist params usually restart it, but
            // not always (same fallback the web app ships).
            try { e.target.seekTo(0, true); e.target.playVideo(); } catch (err) {}
          }
        },
        onError: function (e) { post({ type: 'error', code: e.data }); }
      }
    });
  };
  var s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.async = true;
  s.onerror = function () { post({ type: 'error', code: -2 }); };
  document.head.appendChild(s);
})();
</script>
</body>
</html>`;
}
