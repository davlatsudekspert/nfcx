import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { A150, A165, INSET_TOP, SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Standart karta qobig'i — spetsifikatsiyadagi "secondary card" shell:
 *
 *   background: linear-gradient(165deg, #171209, #120e08);
 *   border: 1px solid #2d2518;
 *   box-shadow: 0 10px 24px rgba(0,0,0,.5),
 *               inset 0 1px 0 rgba(255,255,255,.05),
 *               0 0 18px -6px #b3860f;      <- gold "rim-glow"
 *
 * `#2d2518` alohida token sifatida saqlanmaydi: u `rim`
 * (rgba(240,207,122,.14)) ning fon ustidagi qattiq ekvivalenti.
 * Shaffof variantni saqlaymiz, chunki u karta gradienti ustida ham
 * to'g'ri ishlaydi va tema almashganda o'zi moslashadi.
 *
 * Uch qatlamli tuzilish sababi:
 *   1. tashqi View — soya (`boxShadow`) va chegara. Soya bola
 *      elementlarga emas, aynan shu qutining shakliga chiziladi.
 *   2. `LinearGradient` — fon. `position:absolute` bilan, chunki
 *      `boxShadow` li elementning o'zini gradient qilib bo'lmaydi.
 *   3. `TopHighlight` — `inset 0 1px 0 rgba(255,255,255,.05)` ning
 *      o'rnini bosadigan 1px yorug'lik. RN ichki soyani BOLALAR ostida
 *      chizadi, ya'ni gradient uni bekitib qo'yardi.
 */
export function Card({
  children,
  style,
  radius = 16,
  /** 165deg (standart karta) yoki 150deg (mini NFC karta). */
  tilt = 165,
  /** Chegara rangi — mini NFC kartada bu to'q gold (`a2`). */
  borderColor,
  shadow = 'card',
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  tilt?: 150 | 165;
  borderColor?: string;
  shadow?: 'card' | 'cardTight' | 'mini' | 'tile' | 'none';
}) {
  const { theme } = useTheme();
  const dir = tilt === 150 ? A150 : A165;

  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: borderColor ?? theme.rim,
          // Soya shaffof qutida ham chizilishi uchun kartaning o'z foni
          // bo'lishi kerak; ustiga gradient tushadi, ya'ni ko'rinmaydi.
          backgroundColor: theme.c2,
          overflow: 'hidden',
        },
        shadow === 'none' ? null : SH[shadow](theme.a2),
        style,
      ]}
    >
      <LinearGradient
        colors={[theme.c1, theme.c2]}
        start={dir.start}
        end={dir.end}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <TopHighlight />
      {children}
    </View>
  );
}

/**
 * Kartaning FONI alohida — gradient + yuqori yorug'lik, `position:
 * absolute` bilan.
 *
 * `TapScale` bosiladigan elementning o'lchamini O'ZI belgilaydi
 * (padding, flex, gap shu yerda turishi kerak), shuning uchun uni
 * `Card` ichiga o'rash mumkin emas — u holda ikki qavat quti paydo
 * bo'lib, tartib buziladi. Yechim: `TapScale` ning o'ziga chegara va
 * soya beriladi, foni esa shu komponent bilan to'ldiriladi.
 */
export function CardSurface({ tilt = 165 }: { tilt?: 150 | 165 }) {
  const { theme } = useTheme();
  const dir = tilt === 150 ? A150 : A165;

  return (
    <>
      <LinearGradient
        colors={[theme.c1, theme.c2]}
        start={dir.start}
        end={dir.end}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <TopHighlight />
    </>
  );
}

/**
 * CSS `inset 0 1px 0 rgba(255,255,255,.05)` — kartaning yuqori chetidagi
 * nozik yorug'lik. U kartaga hajm beradi; bo'lmasa karta "yassi qora
 * to'rtburchak" bo'lib ko'rinadi.
 */
export function TopHighlight({ color = INSET_TOP }: { color?: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: color,
      }}
    />
  );
}
