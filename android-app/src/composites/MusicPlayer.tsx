import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { NavigationContext } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { parseMusicSource, yandexEmbedSrc } from '../lib/music';
import { formatClock } from '../lib/format';
import { ensureAudioMode } from '../native/audioMode';
import {
  YOUTUBE_BASE_URL,
  YT_STATE,
  buildYoutubePlayerHtml,
  parseYoutubeBridgeMessage,
  youtubeCommandScript,
  youtubeSeekScript,
} from '../native/audioYoutube';
import { haptics } from '../native/haptics';
import { GoldSheen } from '../design-system/components/GoldSheen';
import { color, gradient, radius, space, touchTarget, type as typeTokens } from '../design-system/tokens';

export interface MusicPlayerProps {
  url?: string | null;
  /** Row position in the contact list — staggers the sheen like the buttons. */
  index?: number;
}

/**
 * Profile music as one thin, full-width bar in the same outline language as
 * the contact buttons it sits under: play/pause, title, elapsed / total in
 * tabular digits, a hairline gold progress line. One player instance per
 * source kind, paused when the screen blurs or the app backgrounds.
 *
 *  - Direct file (`/uploads/x.mp3`, https://…): expo-audio. Loops like the
 *    web app's `<audio loop>` — a single file has no "next".
 *  - YouTube: the IFrame Player API in a WebView (src/native/audioYoutube).
 *    A `list=` playlist auto-advances and shows "n / total"; a single video
 *    loops. YouTube refuses to play audio from an invisible embed, so the
 *    video panel unfolds under the bar while playing (web-app parity).
 *  - Yandex Music: the official widget — Yandex exposes no control API, so
 *    the bar opens/closes the widget and playback is driven inside it.
 */
export function MusicPlayer({ url, index = 0 }: MusicPlayerProps) {
  const source = useMemo(() => parseMusicSource(url), [url]);
  if (!source) return null;
  if (source.kind === 'youtube') return <YoutubeBar key={`${source.id}|${source.listId ?? ''}`} id={source.id} listId={source.listId} index={index} />;
  if (source.kind === 'yandex') return <YandexBar key={source.frag} frag={source.frag} collection={source.collection} index={index} />;
  return <AudioFileBar key={source.url} url={source.url} index={index} />;
}

/* ----------------------------------------------------------------------- */
/* Shared                                                                  */
/* ----------------------------------------------------------------------- */

/** Pauses when the hosting screen loses focus or the app leaves the
 * foreground. Safe outside a navigator (no context → only AppState). */
function usePauseOnLeave(pause: () => void) {
  const navigation = useContext(NavigationContext);
  const pauseRef = useRef(pause);
  useEffect(() => {
    pauseRef.current = pause;
  });
  useEffect(() => {
    const unsubscribe = navigation?.addListener('blur', () => pauseRef.current());
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pauseRef.current();
    });
    return () => {
      unsubscribe?.();
      sub.remove();
    };
  }, [navigation]);
}

interface PlayerBarProps {
  title: string;
  subtitle?: string;
  playing: boolean;
  busy?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  positionMs?: number;
  durationMs?: number;
  onSeek?: (ms: number) => void;
  trailing?: React.ReactNode;
  index: number;
  accessibilityLabel: string;
}

function PlayerBar({
  title,
  subtitle,
  playing,
  busy = false,
  disabled = false,
  onToggle,
  positionMs,
  durationMs,
  onSeek,
  trailing,
  index,
  accessibilityLabel,
}: PlayerBarProps) {
  const hasClock = typeof durationMs === 'number' || typeof positionMs === 'number';
  const duration = Math.max(0, durationMs ?? 0);
  const position = Math.min(Math.max(0, positionMs ?? 0), duration || Number.MAX_SAFE_INTEGER);
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <View style={styles.bar}>
      <LinearGradient
        colors={gradient.cardSurface}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={HAIRLINE}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.hairline}
        pointerEvents="none"
      />
      {playing && <GoldSheen loop index={index} band={0.35} intensity={0.45} />}

      <View style={styles.row}>
        <Pressable
          onPress={() => {
            if (disabled) return;
            haptics.light();
            onToggle();
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled, selected: playing }}
          hitSlop={8}
          style={({ pressed }) => [styles.playButton, disabled && styles.playButtonDisabled, pressed && styles.playButtonPressed]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={color.gold} />
          ) : (
            <Feather name={playing ? 'pause' : 'play'} size={14} color={disabled ? color.textTertiary : color.gold} style={playing ? undefined : styles.playGlyph} />
          )}
        </Pressable>

        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          )}
        </View>

        {hasClock && (
          <Text style={styles.clock} numberOfLines={1}>
            <Text style={styles.clockElapsed}>{formatClock(position * 1000)}</Text>
            <Text style={styles.clockTotal}>{` / ${formatClock(duration * 1000)}`}</Text>
          </Text>
        )}
        {trailing}
      </View>

      {hasClock && <ProgressLine pct={pct} onSeek={onSeek && duration > 0 ? (ratio) => onSeek(ratio * duration) : undefined} />}
    </View>
  );
}

function ProgressLine({ pct, onSeek }: { pct: number; onSeek?: (ratio: number) => void }) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);
  return (
    <Pressable
      onLayout={onLayout}
      disabled={!onSeek}
      onPress={(e) => {
        if (!onSeek || width <= 0) return;
        onSeek(Math.min(1, Math.max(0, e.nativeEvent.locationX / width)));
      }}
      accessibilityRole={onSeek ? 'adjustable' : undefined}
      accessibilityLabel="Ijro holati"
      style={styles.progressHit}
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Number.isFinite(pct) ? pct : 0}%` }]} />
      </View>
    </Pressable>
  );
}

/* ----------------------------------------------------------------------- */
/* Direct audio file — expo-audio                                          */
/* ----------------------------------------------------------------------- */

function AudioFileBar({ url, index }: { url: string; index: number }) {
  const player = useAudioPlayer({ uri: url }, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [wantPlay, setWantPlay] = useState(false);

  useEffect(() => {
    ensureAudioMode();
  }, []);

  useEffect(() => {
    // Web-app parity (`<audio loop>`): one file has no "next", so it repeats.
    try {
      player.loop = true;
    } catch {
      /* released player — nothing to configure */
    }
  }, [player]);

  const pause = useCallback(() => {
    setWantPlay(false);
    try {
      player.pause();
    } catch {
      /* already released */
    }
  }, [player]);

  usePauseOnLeave(pause);

  const failed = typeof status.error === 'string' && status.error.length > 0;
  const playing = status.playing;
  const busy = wantPlay && !playing && !failed && (!status.isLoaded || status.isBuffering);

  const toggle = async () => {
    if (playing) {
      pause();
      return;
    }
    setWantPlay(true);
    await ensureAudioMode();
    try {
      // A finished, non-looping player sits at the end; restart it cleanly.
      if (!status.loop && status.duration > 0 && status.currentTime >= status.duration) await player.seekTo(0);
      player.play();
    } catch {
      setWantPlay(false);
    }
  };

  const seek = (ms: number) => {
    player.seekTo(ms / 1000).catch(() => {});
  };

  return (
    <PlayerBar
      title="Profil musiqasi"
      subtitle={failed ? "Musiqa faylini yuklab bo'lmadi" : undefined}
      playing={playing}
      busy={busy}
      disabled={failed}
      onToggle={toggle}
      positionMs={status.currentTime * 1000}
      durationMs={status.duration * 1000}
      onSeek={status.isLoaded ? seek : undefined}
      index={index}
      accessibilityLabel={playing ? "Musiqani to'xtatish" : 'Musiqani yoqish'}
    />
  );
}

/* ----------------------------------------------------------------------- */
/* YouTube — IFrame Player API in a WebView                                */
/* ----------------------------------------------------------------------- */

interface YoutubeStatus {
  t: number;
  d: number;
  title: string;
  author: string;
  index: number;
  count: number;
}

const EMPTY_YT_STATUS: YoutubeStatus = { t: 0, d: 0, title: '', author: '', index: -1, count: 0 };

function YoutubeBar({ id, listId, index }: { id: string; listId?: string; index: number }) {
  const webRef = useRef<React.ComponentRef<typeof WebView>>(null);
  const [ready, setReady] = useState(false);
  const [wantPlay, setWantPlay] = useState(false);
  const [state, setState] = useState<number>(YT_STATE.UNSTARTED);
  const [status, setStatus] = useState<YoutubeStatus>(EMPTY_YT_STATUS);
  const [failed, setFailed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(0);

  const html = useMemo(() => buildYoutubePlayerHtml({ videoId: id, listId }), [id, listId]);

  const send = useCallback((script: string) => {
    webRef.current?.injectJavaScript(script);
  }, []);

  const pause = useCallback(() => {
    setWantPlay(false);
    send(youtubeCommandScript('pause'));
  }, [send]);

  usePauseOnLeave(pause);

  useEffect(() => {
    if (ready && wantPlay) send(youtubeCommandScript('play'));
  }, [ready, wantPlay, send]);

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = parseYoutubeBridgeMessage(e.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'state') setState(msg.state);
    else if (msg.type === 'status') setStatus({ t: msg.t, d: msg.d, title: msg.title, author: msg.author, index: msg.index, count: msg.count });
    else if (msg.type === 'error') {
      // Playlist: a private/removed item errors but the list moves on by
      // itself; only a dead single video is a hard failure.
      if (!listId) {
        setFailed(true);
        setWantPlay(false);
      }
    }
  };

  const playing = state === YT_STATE.PLAYING;
  const busy = wantPlay && !playing && !failed && (!ready || state === YT_STATE.BUFFERING || state === YT_STATE.UNSTARTED || state === YT_STATE.CUED);
  const inPlaylist = status.count > 1;
  const panelOpen = wantPlay && !failed;
  const panelHeight = panelOpen && panelWidth > 0 ? Math.round((panelWidth * 9) / 16) : 1;

  const subtitle = failed
    ? "YouTube videoni ochib bo'lmadi"
    : [status.author, inPlaylist && status.index >= 0 ? `${status.index + 1} / ${status.count}` : '']
        .filter(Boolean)
        .join(' · ') || (listId ? 'YouTube pleylist' : 'YouTube');

  return (
    <View style={styles.stack} onLayout={(e) => setPanelWidth(e.nativeEvent.layout.width)}>
      <PlayerBar
        title={status.title || (listId ? 'YouTube pleylist' : 'YouTube')}
        subtitle={subtitle}
        playing={playing}
        busy={busy}
        disabled={failed}
        onToggle={() => {
          if (playing) pause();
          else setWantPlay(true);
        }}
        positionMs={status.t * 1000}
        durationMs={status.d * 1000}
        onSeek={ready ? (ms) => send(youtubeSeekScript(ms / 1000)) : undefined}
        index={index}
        accessibilityLabel={playing ? "Musiqani to'xtatish" : 'Musiqani yoqish'}
        trailing={
          inPlaylist ? (
            <Pressable
              onPress={() => {
                haptics.light();
                setWantPlay(true);
                send(youtubeCommandScript('next'));
              }}
              accessibilityRole="button"
              accessibilityLabel="Keyingi trek"
              hitSlop={8}
              style={styles.trailingButton}
            >
              <Feather name="skip-forward" size={14} color={color.gold} />
            </Pressable>
          ) : undefined
        }
      />
      {/* Kept mounted at 1px while closed so the player keeps its state;
          Android runs the embed's JS at that size but YouTube will not
          emit audio from it, hence the unfold while playing. */}
      <View style={[styles.panel, { height: panelHeight, opacity: panelOpen ? 1 : 0, marginTop: panelOpen ? space.sm : 0 }]} pointerEvents={panelOpen ? 'auto' : 'none'}>
        <WebView
          ref={webRef}
          source={{ html, baseUrl: YOUTUBE_BASE_URL }}
          originWhitelist={['*']}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={false}
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          overScrollMode="never"
          style={styles.webview}
          onError={() => setFailed(true)}
        />
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------------- */
/* Yandex Music — official widget, no control API                          */
/* ----------------------------------------------------------------------- */

function YandexBar({ frag, collection, index }: { frag: string; collection: boolean; index: number }) {
  const [open, setOpen] = useState(false);
  usePauseOnLeave(() => setOpen(false));
  // Web-app parity: a track gets the compact widget, an album/playlist the
  // taller one with its track list (which the widget itself steps through).
  const height = collection ? 220 : 180;

  return (
    <View style={styles.stack}>
      <PlayerBar
        title="Yandex Music"
        subtitle={collection ? "Albom / pleylist — vidjet ichida ijro etiladi" : 'Vidjet ichida ijro etiladi'}
        playing={open}
        onToggle={() => setOpen((v) => !v)}
        index={index}
        accessibilityLabel={open ? 'Vidjetni yopish' : 'Vidjetni ochish'}
        trailing={<Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={color.textTertiary} />}
      />
      {open && (
        <View style={[styles.panel, styles.panelOpen, { height }]}>
          <WebView
            source={{ uri: yandexEmbedSrc(frag) }}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            style={styles.webview}
          />
        </View>
      )}
    </View>
  );
}

const HAIRLINE = ['rgba(240,207,122,0)', 'rgba(240,207,122,0.65)', 'rgba(240,207,122,0)'] as const;

const styles = StyleSheet.create({
  stack: { width: '100%' },
  bar: {
    width: '100%',
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  hairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.md,
    paddingRight: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm + 2,
    minHeight: touchTarget - 2,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderGoldStrong,
    backgroundColor: color.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonPressed: { backgroundColor: 'rgba(212,175,90,0.28)' },
  playButtonDisabled: { borderColor: color.border, backgroundColor: 'transparent' },
  /** Optical centering — a play triangle reads left-heavy when geometrically centered. */
  playGlyph: { marginLeft: 2 },
  textCol: { flex: 1, minWidth: 0 },
  title: { ...typeTokens.h2, fontSize: 15, lineHeight: 20, color: color.textPrimary },
  subtitle: { ...typeTokens.caption, color: color.textTertiary, marginTop: 1 },
  clock: { ...typeTokens.caption, fontVariant: ['tabular-nums'], color: color.textTertiary, letterSpacing: 0.3 },
  clockElapsed: { color: color.textSecondary },
  clockTotal: { color: color.textTertiary },
  trailingButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -space.xs,
  },
  progressHit: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, justifyContent: 'flex-end' },
  progressTrack: { height: 2, backgroundColor: 'rgba(212,175,90,0.14)' },
  progressFill: { height: 2, backgroundColor: color.gold },
  panel: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.bgDeep,
  },
  panelOpen: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: color.borderGold,
  },
  webview: { flex: 1, backgroundColor: color.bgDeep },
});
