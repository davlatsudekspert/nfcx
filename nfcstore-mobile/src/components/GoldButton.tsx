import { LinearGradient } from 'expo-linear-gradient';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { A120 } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

import { GoldSweep } from './GoldSweep';
import { TapScale } from './TapScale';

/**
 * Birlamchi (aksent) tugma — maketdagi "Dashboard" / "Follow":
 *
 *   height:40px; border-radius:13px;
 *   background: linear-gradient(120deg, var(--a1), var(--a2));
 *   font: 700 13px/1 Manrope; color: var(--onAccent);
 *   + ::after sweep 5s
 *
 * MUHIM (spetsifikatsiya 5-bo'limdagi xato tuzatish): tugma HAR DOIM
 * faol temaning aksentini oladi. Maketda "Dashboard" ko'k ko'rinib
 * qolgan edi — sababi tema Midnight Blue da qolgani, kodda ko'k rang
 * yozilgani emas. Shuning uchun bu yerda hech qanday qattiq rang yo'q:
 * faqat `theme.a1`/`theme.a2`.
 */
export function GoldButton({
  label,
  onPress,
  style,
  /** Yorug'lik o'tishi — maketda faqat aksentli tugmalarda. */
  sweep = true,
  radius = 13,
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  sweep?: boolean;
  radius?: number;
}) {
  const { theme } = useTheme();

  return (
    <TapScale
      onPress={onPress}
      radius={radius}
      pulseColor={theme.a1}
      accessibilityLabel={label}
      style={[
        {
          height: 40,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[theme.a1, theme.a2]}
        start={A120.start}
        end={A120.end}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {sweep ? <GoldSweep duration={5000} radius={radius} /> : null}
      <Text style={[sans(700, 13), { color: theme.onAccent }]}>{label}</Text>
    </TapScale>
  );
}

/**
 * Ikkilamchi tugma — maketdagi "Edit profile" / "Following":
 *   background: rgba(255,255,255,.06); border: 1px solid var(--rim)
 */
export function GhostButton({
  label,
  onPress,
  style,
  radius = 13,
  children,
}: {
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  children?: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <TapScale
      onPress={onPress}
      radius={radius}
      accessibilityLabel={label}
      style={[
        {
          height: 40,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,.06)',
          borderWidth: 1,
          borderColor: theme.rim,
        },
        style,
      ]}
    >
      {children ?? (
        <Text style={[sans(600, 13), { color: theme.ink }]}>{label}</Text>
      )}
    </TapScale>
  );
}

/** Maketdagi ingichka ajratgich chiziq (stats orasidagi). */
export function VDivider({ height = 22 }: { height?: number }) {
  return (
    <View
      style={{ width: 1, height, backgroundColor: 'rgba(255,255,255,.1)' }}
    />
  );
}
