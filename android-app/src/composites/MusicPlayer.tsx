import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import YoutubeIframe, { getYoutubeMeta, type YoutubeIframeRef, PLAYER_STATES } from 'react-native-youtube-iframe';
import Slider from '@react-native-community/slider';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import { parseMusicSource, yandexEmbedSrc } from '../lib/music';
import { color, radius, space, type as typeTokens } from '../design-system/tokens';
import { PremiumCard } from '../design-system/components/PremiumCard';

export interface MusicPlayerProps {
  url?: string | null;
}

/**
 * Real playback for all three profile-music source kinds (brief §1/§9/§10
 * "no shortcuts" — src/lib/music.ts ported 1:1 from the web app):
 * YouTube (react-native-youtube-iframe, real play/pause+progress), Yandex
 * Music (its own official iframe widget in a WebView — no public JS bridge
 * exists to drive external controls, so its own UI is used as-is, matching
 * what the web app does), and a direct audio file (expo-audio, real
 * play/pause+seek).
 */
export function MusicPlayer({ url }: MusicPlayerProps) {
  const source = parseMusicSource(url);
  if (!source) return null;
  if (source.kind === 'yandex') return <YandexPlayer frag={source.frag} />;
  if (source.kind === 'youtube') return <YoutubePlayer id={source.id} />;
  return <AudioFilePlayer url={source.url} />;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PlayerShell({
  title,
  subtitle,
  playing,
  onToggle,
  position,
  duration,
  onSeek,
}: {
  title: string;
  subtitle?: string;
  playing: boolean;
  onToggle: () => void;
  position: number;
  duration: number;
  onSeek?: (sec: number) => void;
}) {
  return (
    <PremiumCard style={styles.shell}>
      <View style={styles.row}>
        <Pressable onPress={onToggle} style={styles.playButton}>
          <Feather name={playing ? 'pause' : 'play'} size={20} color={color.bgDeep} />
        </Pressable>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={Math.max(duration, 1)}
          value={position}
          minimumTrackTintColor={color.gold}
          maximumTrackTintColor={color.border}
          thumbTintColor={color.gold}
          onSlidingComplete={onSeek}
          disabled={!onSeek}
        />
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </PremiumCard>
  );
}


function YoutubePlayer({ id }: { id: string }) {
  const ref = useRef<YoutubeIframeRef>(null);
  const [playing, setPlaying] = useState(false);
  const [meta, setMeta] = useState<{ title: string; author: string } | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    getYoutubeMeta(id)
      .then((m) => setMeta({ title: m.title, author: m.author_name }))
      .catch(() => setMeta(null));
  }, [id]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(async () => {
      const [t, d] = await Promise.all([ref.current?.getCurrentTime(), ref.current?.getDuration()]);
      if (typeof t === 'number') setPosition(t);
      if (typeof d === 'number') setDuration(d);
    }, 500);
    return () => clearInterval(interval);
  }, [playing]);

  return (
    <View>
      <View style={styles.hiddenPlayer}>
        <YoutubeIframe
          ref={ref}
          height={1}
          videoId={id}
          play={playing}
          initialPlayerParams={{ loop: true, controls: false }}
          onChangeState={(state: PLAYER_STATES) => setPlaying(state === PLAYER_STATES.PLAYING)}
        />
      </View>
      <PlayerShell
        title={meta?.title ?? 'YouTube musiqa'}
        subtitle={meta?.author}
        playing={playing}
        onToggle={() => setPlaying((p) => !p)}
        position={position}
        duration={duration}
        onSeek={(sec) => ref.current?.seekTo(sec, true)}
      />
    </View>
  );
}

function YandexPlayer({ frag }: { frag: string }) {
  return (
    <PremiumCard style={styles.shell}>
      <Text style={styles.title}>Yandex Music</Text>
      <View style={styles.yandexFrame}>
        <WebView source={{ uri: yandexEmbedSrc(frag) }} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />
      </View>
    </PremiumCard>
  );
}

function AudioFilePlayer({ url }: { url: string }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  return (
    <PlayerShell
      title="Profil musiqasi"
      playing={status.playing}
      onToggle={() => (status.playing ? player.pause() : player.play())}
      position={status.currentTime}
      duration={status.duration || 0}
      onSeek={(sec) => player.seekTo(sec)}
    />
  );
}

const styles = StyleSheet.create({
  shell: { marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: { ...typeTokens.h2, color: color.textPrimary },
  subtitle: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  slider: { flex: 1, height: 32 },
  time: { ...typeTokens.caption, color: color.textTertiary, width: 36, textAlign: 'center' },
  hiddenPlayer: { height: 1, overflow: 'hidden' },
  yandexFrame: { height: 180, borderRadius: radius.md, overflow: 'hidden', marginTop: space.sm },
});
