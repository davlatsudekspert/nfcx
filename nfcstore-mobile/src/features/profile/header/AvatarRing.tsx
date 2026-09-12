import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { useSvgId } from '@/lib/svgId';
import { A145 } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono } from '@/theme/type';
import { SEEN_RING } from '@/theme/themes';

/**
 * Avatar va "yangi kontent" halqasi — spetsifikatsiya 3 va 8-bo'limlari.
 *
 *   • 24 soat ichida yangi post bo'lsa: gradient halqa (#f0cf7a →
 *     #b3860f) SEKIN aylanadi ("slowly rotating shimmer, not a static
 *     line") — maketda `shimmerSpin 9s linear infinite`.
 *   • Tashrifchi ko'rgandan keyin halqa KULRANGGA aylanadi va so'nadi.
 *   • Avatarni bosish oxirgi postni to'liq ekranda ochadi.
 *   • O'ng-pastda musiqa nishoni — faqat profilga fon musiqasi
 *     ulangan bo'lsa (`company.music` bo'sh bo'lmasa).
 *
 * CSS `conic-gradient` RN da ham, SVG da ham yo'q. Shuning uchun halqa
 * TO'RT CHORAK yoydan yasaladi va har bir yoyga o'z chizig'i bo'ylab
 * chiziqli gradient beriladi. Maketdagi conic to'xtash nuqtalari
 * (a2, a1, a2, a1, a2 — ya'ni har 90° da almashinadi) shu to'rt yoyga
 * AYNAN mos tushadi, demak natija ko'zga bir xil ko'rinadi.
 */
export function AvatarRing({
  size = 104,
  band = 5,
  photoUrl,
  hasNewContent,
  seen,
  hasMusic,
  onPress,
}: {
  size?: number;
  band?: number;
  photoUrl?: string;
  /** 24 soat ichida post bo'lganmi. `false` bo'lsa halqa umuman yonmaydi. */
  hasNewContent: boolean;
  /** Tashrifchi allaqachon ko'rganmi — halqa kulrang bo'ladi. */
  seen: boolean;
  hasMusic: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const spin = useSharedValue(0);
  const ringId = useSvgId('ring');

  const active = hasNewContent && !seen;

  useEffect(() => {
    if (active) {
      spin.value = 0;
      spin.value = withRepeat(
        withTiming(360, { duration: 9000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      spin.value = 0;
    }
  }, [active, spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const c = size / 2;
  const r = c - band / 2;
  // Chorak yoylarning uchlari: θ yuqoridan soat yo'nalishi bo'yicha.
  const top = { x: c, y: c - r };
  const right = { x: c + r, y: c };
  const bottom = { x: c, y: c + r };
  const left = { x: c - r, y: c };

  const [g1, g2] = active ? [theme.a2, theme.a1] : [SEEN_RING[0], SEEN_RING[1]];

  const quadrants = [
    { id: `${ringId}a`, from: top, to: right, c1: g1, c2: g2 },
    { id: `${ringId}b`, from: right, to: bottom, c1: g2, c2: g1 },
    { id: `${ringId}c`, from: bottom, to: left, c1: g1, c2: g2 },
    { id: `${ringId}d`, from: left, to: top, c1: g2, c2: g1 },
  ];

  const photoInset = band;
  const photoSize = size - photoInset * 2;
  // Maketda ichki doira `padding:2.5px` bilan fon rangida — halqa va
  // rasm orasida nafas oladigan bo'shliq qoldiradi.
  const gap = 2.5;

  return (
    <TapScale
      onPress={onPress}
      radius={size / 2}
      accessibilityRole="imagebutton"
      accessibilityLabel={
        active ? 'Yangi post — ochish uchun bosing' : 'Profil rasmi'
      }
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            opacity: active ? 1 : 0.6,
          },
          spinStyle,
        ]}
      >
        <Svg width={size} height={size}>
          <Defs>
            {quadrants.map((q) => (
              <LinearGradient
                key={q.id}
                id={q.id}
                x1={q.from.x}
                y1={q.from.y}
                x2={q.to.x}
                y2={q.to.y}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={q.c1} />
                <Stop offset="1" stopColor={q.c2} />
              </LinearGradient>
            ))}
          </Defs>
          {quadrants.map((q) => (
            <Path
              key={q.id}
              d={`M ${q.from.x} ${q.from.y} A ${r} ${r} 0 0 1 ${q.to.x} ${q.to.y}`}
              stroke={`url(#${q.id})`}
              strokeWidth={band}
              fill="none"
            />
          ))}
        </Svg>
      </Animated.View>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: photoInset,
          left: photoInset,
          width: photoSize,
          height: photoSize,
          borderRadius: photoSize / 2,
          backgroundColor: theme.bg,
          padding: gap,
        }}
      >
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            contentFit="cover"
            style={{ flex: 1, borderRadius: photoSize / 2 }}
          />
        ) : (
          <StripeFill
            step={7}
            style={{
              flex: 1,
              borderRadius: photoSize / 2,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={[
                mono(400, 8, 1.4),
                { color: theme.phInk, textAlign: 'center', letterSpacing: 0.4 },
              ]}
            >
              {'OWNER\nPHOTO'}
            </Text>
          </StripeFill>
        )}
      </View>

      {hasMusic ? <MusicBadge bgColor={theme.bg} a1={theme.a1} a2={theme.a2} onAccent={theme.onAccent} /> : null}
    </TapScale>
  );
}

/**
 * "Hozir ijro etilmoqda" nishoni — Instagram audio nishoni uslubida,
 * avatarning o'ng-past burchagida. Faqat profilga musiqa ulangan bo'lsa
 * ko'rinadi (spetsifikatsiya 3-bo'lim).
 */
function MusicBadge({
  bgColor,
  a1,
  a2,
  onAccent,
}: {
  bgColor: string;
  a1: string;
  a2: string;
  onAccent: string;
}) {
  return (
    <ExpoGradient
      colors={[a1, a2]}
      start={A145.start}
      end={A145.end}
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: 2,
        bottom: 4,
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2.5,
        borderColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={11} height={11} viewBox="0 0 24 24">
        <Path
          d="M9 18V6.5l9-2V16"
          stroke={onAccent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={6.6} cy={18} r={2.6} fill={onAccent} />
        <Circle cx={15.6} cy={15.6} r={2.6} fill={onAccent} />
      </Svg>
    </ExpoGradient>
  );
}
