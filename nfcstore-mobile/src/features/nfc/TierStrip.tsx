import { ScrollView, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { TapScale } from '@/components/TapScale';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

import { NFC_TIERS } from './nfcTiers';

/**
 * Tarif chizig'i — metall gradientli "medal" nishonlari (spetsifikatsiya
 * 7-bo'lim: embossed medal look, flat pill emas). Avval Home va NFC
 * ekranlarida ikki alohida nusxada edi — endi bitta komponent, `NFC_TIERS`
 * dan (haqiqiy narxlar, `src/lib/pricing.js` bilan bir xil).
 *
 * Xarid oqimi mobil ilovada QURILMAGAN: backend'da mobil-native ID
 * bandlash/checkout endpointi yo'q (faqat veb formasi bor), shuning
 * uchun bosilganda haqiqiy `${SITE}/narxlar` sahifasi ochiladi — bu
 * Home'dagi jismoniy karta buyurtmasi bilan bir xil, allaqachon
 * tasdiqlangan naqsh.
 */
export function TierStrip({ onPressTier }: { onPressTier: () => void }) {
  const { theme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 4 }}
    >
      {NFC_TIERS.map((t) => (
        <TapScale
          key={t.key}
          radius={14}
          onPress={onPressTier}
          accessibilityLabel={`${t.name} tarifi`}
          style={{ borderRadius: 14 }}
        >
          <Card
            radius={14}
            shadow="tier"
            style={{
              alignItems: 'flex-start',
              gap: 7,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            <TierMedal m1={t.m1} m2={t.m2} />
            <Text style={[sans(700, 11.5), { color: theme.ink }]}>{t.name}</Text>
            <Text style={[mono(500, 10), { color: 'rgba(255,255,255,.5)' }]}>
              {'from' in t && t.from ? `${money(t.price)} dan` : money(t.price)}
            </Text>
          </Card>
        </TapScale>
      ))}
    </ScrollView>
  );
}

/**
 * Metall nishon — ichki soya bilan "bosma medal" ko'rinishi.
 * Maketda bu `inset` box-shadow bilan qilingan; RN da inset soya yo'q,
 * shuning uchun effekt ikki qatlam gradient bilan taqlid qilinadi.
 */
export function TierMedal({ m1, m2 }: { m1: string; m2: string }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,.35)',
      }}
    >
      <View style={{ flex: 1, backgroundColor: m2 }}>
        <View
          style={{
            position: 'absolute',
            top: -2,
            left: -2,
            right: 6,
            bottom: 8,
            borderRadius: 11,
            backgroundColor: m1,
            opacity: 0.9,
          }}
        />
      </View>
    </View>
  );
}
