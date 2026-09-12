import { Image } from 'expo-image';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useSvgId } from '@/lib/svgId';
import { useTheme } from '@/theme/ThemeProvider';

const LOGO = require('../../../../assets/logo.png');

/**
 * Sarlavha bezagi — spetsifikatsiya 3-bo'limi:
 *
 *   "Add two thin gold decorative lines entering from the left and right
 *    edges of the header, curving inward and sloping downward to converge
 *    at the center — the small brand logo sits at that convergence point"
 *
 * Egri chiziqlar va gradientlar maketdan aynan ko'chirilgan. Brend
 * belgisi ATAYLAB kichik (22px): u endi asosiy element emas, faqat
 * bezak (spetsifikatsiya: "no longer the dominant hero element").
 *
 * Maketda kenglik qat'iy 340px edi (390px freym ichida). Ilovada ekran
 * kengligi har xil, shuning uchun `viewBox` gorizontal cho'ziladi
 * (`preserveAspectRatio="none"`): chiziqlarning uchlari HAR DOIM ekran
 * chetiga tegib turishi kerak, aks holda bezak "uzilib" qoladi.
 * Telefon kengliklarida cho'zilish 2% atrofida — sezilmaydi.
 */
export function OrnamentLines() {
  const { theme } = useTheme();
  const left = useSvgId('ornL');
  const right = useSvgId('ornR');

  return (
    <View style={{ width: '100%', height: 38, marginBottom: 6 }}>
      <Svg width="100%" height={38} viewBox="0 0 340 38" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={left} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.a1} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.a1} stopOpacity={0.85} />
          </LinearGradient>
          <LinearGradient id={right} x1="1" y1="0" x2="0" y2="0">
            <Stop offset="0" stopColor={theme.a1} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.a1} stopOpacity={0.85} />
          </LinearGradient>
        </Defs>
        <Path
          d="M2 9C66 9 108 24 156 30"
          stroke={`url(#${left})`}
          strokeWidth={1}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M338 9C274 9 232 24 184 30"
          stroke={`url(#${right})`}
          strokeWidth={1}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>

      <Image
        source={LOGO}
        accessibilityLabel="NFCSTORE"
        contentFit="cover"
        style={{
          position: 'absolute',
          bottom: 0,
          alignSelf: 'center',
          width: 22,
          height: 22,
          borderRadius: 11,
          opacity: 0.95,
        }}
      />
    </View>
  );
}
