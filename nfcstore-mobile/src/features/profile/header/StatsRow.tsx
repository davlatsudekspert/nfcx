import { Text, View } from 'react-native';

import { VDivider } from '@/components/GoldButton';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * Statistika qatori — ko'rishlar · obunachilar · mahsulotlar (yoki
 * havolalar). Egasi ham, tashrifchi ham BIR XIL raqamlarni ko'radi
 * (spetsifikatsiya 5-bo'lim).
 *
 * Maketda yozuvlar inglizcha ("views", "followers") edi, lekin
 * NFCSTORE ning o'zi o'zbek tilida ishlaydi — shuning uchun bu yerda
 * o'zbekcha. Barcha yozuv shu faylda: boshqasiga o'tkazish kerak
 * bo'lsa bir joyda tahrirlanadi.
 */
export function StatsRow({
  views,
  followers,
  third,
}: {
  views: string;
  followers: string;
  /** Biznesda "mahsulot", shaxsiyda "havola". */
  third: { value: string; label: string };
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 22,
        marginTop: 14,
      }}
    >
      <Stat value={views} label="ko&#x2019;rishlar" />
      <VDivider />
      <Stat value={followers} label="obunachi" />
      <VDivider />
      <Stat value={third.value} label={third.label} />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[sans(800, 15), { color: theme.ink }]}>{value}</Text>
      <Text style={[sans(500, 10.5), { color: 'rgba(255,255,255,.42)', marginTop: 4 }]}>
        {label}
      </Text>
    </View>
  );
}
