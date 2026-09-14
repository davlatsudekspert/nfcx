import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useSvgId } from '@/lib/svgId';
import { useTheme } from '@/theme/ThemeProvider';
import { mono } from '@/theme/type';

/**
 * Kunlik ko'rishlar grafigi.
 *
 * Server bo'sh kunlarni ham qaytaradi (`series` da har kun uchun bitta
 * yozuv), shuning uchun chiziq uzilmaydi va vaqt o'qi teng taqsimlanadi
 * — qo'shimcha to'ldirish kerak emas.
 *
 * Qasddan sodda: bitta chiziq + ostidagi gradient. Interaktiv grafik
 * (bosib qiymat ko'rish) bu bosqichda kiritilmadi.
 */
export function ViewsSparkline({
  series,
  height = 68,
}: {
  series: { day: string; views: number }[];
  height?: number;
}) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const fillId = useSvgId('spark');

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };

  const max = Math.max(1, ...series.map((s) => s.views));
  const step = series.length > 1 ? width / (series.length - 1) : 0;

  const points = series.map((s, i) => ({
    x: i * step,
    // 3px yuqoridan joy qoldiramiz: chiziq eng yuqori nuqtada kesilmasin.
    y: height - 3 - (s.views / max) * (height - 10),
  }));

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const area = points.length
    ? `${line} L ${width.toFixed(1)} ${height} L 0 ${height} Z`
    : '';

  return (
    <View style={{ gap: 6 }} onLayout={onLayout}>
      {width > 0 && points.length > 1 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.a1} stopOpacity={0.28} />
              <Stop offset="1" stopColor={theme.a1} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill={`url(#${fillId})`} />
          <Path
            d={line}
            stroke={theme.a1}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : (
        <View style={{ height }} />
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[mono(500, 9.5), { color: 'rgba(255,255,255,.35)' }]}>
          {series[0]?.day ?? ''}
        </Text>
        <Text style={[mono(500, 9.5), { color: 'rgba(255,255,255,.35)' }]}>
          eng yuqori {max}
        </Text>
        <Text style={[mono(500, 9.5), { color: 'rgba(255,255,255,.35)' }]}>
          {series[series.length - 1]?.day ?? ''}
        </Text>
      </View>
    </View>
  );
}
