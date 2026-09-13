import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { CardSurface } from '@/components/Card';
import { TapScale } from '@/components/TapScale';
import { tapLight } from '@/lib/haptics';
import { mediaUrl } from '@/lib/media';
import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * PROFIL FON MUSIQASI — pleyer.
 *
 * Ilgari profilda faqat musiqa NISHONI bor edi, pleyerning o'zi
 * qurilmagandi: nishon bosilsa hech narsa bo'lmasdi.
 *
 * MUHIM QAROR — musiqa O'ZI BOSHLANMAYDI. Saytda u avtomatik
 * boshlanishi mumkin, lekin telefonda bu qo'pol: odam jamoat joyida
 * profil ochsa, ovoz to'satdan yangraydi. Shuning uchun bu yerda ochiq
 * boshqaruv bor va odam o'zi bosadi.
 *
 * Bir nechta qo'shiq bo'lsa (`musicUrls` 5 tagacha) — oldinga/orqaga
 * o'tish tugmalari chiqadi.
 */
export function MusicBar({ urls }: { urls: string[] }) {
  const { theme } = useTheme();
  const [i, setI] = useState(0);

  const list = urls.map((u) => mediaUrl(u)).filter((u): u is string => !!u);
  const src = list[i];

  const player = useAudioPlayer(src ? { uri: src } : null);
  const status = useAudioPlayerStatus(player);

  // Telefon "jimlik" rejimida bo'lsa ham ovoz chiqsin (iOS), va
  // boshqa ilova musiqasi to'xtatilmasin.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Qo'shiq tugaganda keyingisiga o'tamiz.
  useEffect(() => {
    if (status.didJustFinish && list.length > 1) {
      setI((prev) => (prev + 1) % list.length);
    }
  }, [status.didJustFinish, list.length]);

  if (!list.length) return null;

  const playing = status.playing;

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 11,
            paddingHorizontal: 13,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.rim,
            backgroundColor: theme.c2,
            overflow: 'hidden',
          },
          SH.cardTight(theme.a2),
        ]}
      >
        <CardSurface />

        <TapScale
          radius={19}
          onPress={() => {
            tapLight();
            if (playing) player.pause();
            else player.play();
          }}
          accessibilityLabel={playing ? 'To’xtatish' : 'Qo’yish'}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.a2,
          }}
        >
          {playing ? <PauseGlyph color={theme.onAccent} /> : <PlayGlyph color={theme.onAccent} />}
        </TapScale>

        <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
          <Text style={[sans(600, 12.5), { color: theme.ink }]} numberOfLines={1}>
            Profil musiqasi
          </Text>
          {/* Ijro chizig'i — qo'shiqning qaysi joyidaligi. */}
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,.12)',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${progressPct(status.currentTime, status.duration)}%`,
                height: '100%',
                backgroundColor: theme.a1,
              }}
            />
          </View>
        </View>

        {list.length > 1 ? (
          <>
            <Text style={[mono(500, 10), { color: 'rgba(255,255,255,.42)' }]}>
              {i + 1}/{list.length}
            </Text>
            <TapScale
              radius={15}
              onPress={() => {
                tapLight();
                setI((prev) => (prev + 1) % list.length);
              }}
              accessibilityLabel="Keyingi qo’shiq"
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <NextGlyph color={theme.a1} />
            </TapScale>
          </>
        ) : null}
      </View>
    </View>
  );
}

function progressPct(current?: number, duration?: number): number {
  if (!duration || duration <= 0 || !Number.isFinite(duration)) return 0;
  const pct = ((current ?? 0) / duration) * 100;
  return Math.min(100, Math.max(0, pct));
}

function PlayGlyph({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Path d="M7 4.6l12 7.4-12 7.4z" fill={color} />
    </Svg>
  );
}

function PauseGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Rect x={5.5} y={4} width={4.6} height={16} rx={1.4} fill={color} />
      <Rect x={13.9} y={4} width={4.6} height={16} rx={1.4} fill={color} />
    </Svg>
  );
}

function NextGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path d="M6 5l9 7-9 7z" fill={color} />
      <Rect x={16.4} y={5} width={2.6} height={14} rx={1.2} fill={color} />
    </Svg>
  );
}
