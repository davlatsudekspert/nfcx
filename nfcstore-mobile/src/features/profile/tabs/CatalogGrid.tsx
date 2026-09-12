import { Image } from 'expo-image';
import { Text, useWindowDimensions, View } from 'react-native';

import type { CatalogItem, CompanyPlan } from '@/api/types';
import { CardBackdrop } from '@/components/Card';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { money } from '@/lib/format';
import { SHADOW } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

import { EmptyState } from './FeedGrid';

/**
 * Katalog — 2 ustunli mahsulot kartalari (maketda `gap:12px;
 * padding:14px`, karta radiusi 14px).
 *
 * Karta: 1:1 rasm, ostida nom (kichik qalin), ostida narx (gold, yana
 * kichikroq) — spetsifikatsiyaning dastlabki tavsifi bilan bir xil.
 *
 * Bepul tarifda mahsulot 5 ta bilan cheklanadi. Cheklovni SERVER
 * belgilaydi, lekin `plan` maydoni uni OLDINDAN ham beradi — shuning
 * uchun egasiga eslatma ko'rsatiladi va u "qo'shish" ni bosib 403
 * olmaydi.
 */
export function CatalogGrid({
  items,
  plan,
  isOwner,
  onOpen,
}: {
  items: CatalogItem[];
  plan?: CompanyPlan;
  isOwner: boolean;
  onOpen?: (item: CatalogItem) => void;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();

  // 2 ustun: chetlar 14+14, orasida 12.
  const cardW = (width - 28 - 12) / 2;

  const limitReached =
    isOwner &&
    plan?.productLimit != null &&
    items.length >= plan.productLimit;

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 26 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Text style={[sans(600, 12), { color: 'rgba(255,255,255,.5)' }]}>
          {items.length} mahsulot
        </Text>
        <Text style={[mono(500, 11.5), { color: theme.a1 }]}>Ommabop ▾</Text>
      </View>

      {limitReached ? (
        <Text
          style={[
            sans(500, 11.5, 1.45),
            { color: theme.off, marginBottom: 12 },
          ]}
        >
          Bepul tarifda {plan?.productLimit} mahsulot. Ko&#x2019;proq qo&#x2019;shish uchun
          Company ID sotib olish kerak.
        </Text>
      ) : null}

      {items.length === 0 ? (
        <EmptyState text="Katalog hozircha bo&#x2019;sh" />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {items.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              width={cardW}
              onPress={onOpen ? () => onOpen(item) : undefined}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ProductCard({
  item,
  width,
  onPress,
}: {
  item: CatalogItem;
  width: number;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const hasPromo = item.promotionPrice != null && item.promotionPrice < item.price;

  return (
    <TapScale
      radius={14}
      onPress={onPress}
      accessibilityLabel={item.name}
      style={[
        {
          width,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.rim,
          overflow: 'hidden',
        },
        SHADOW.card,
      ]}
    >
      <CardBackdrop radius={14} />

      <View
        style={{
          width: '100%',
          aspectRatio: 1,
          borderBottomWidth: 1,
          borderBottomColor: theme.rim,
        }}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} contentFit="cover" style={{ flex: 1 }} />
        ) : (
          <StripeFill
            step={8}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text
              style={[
                mono(400, 8.5, 1.4),
                { color: theme.phInk, textAlign: 'center', letterSpacing: 0.42 },
              ]}
            >
              {'PRODUCT SHOT\n1:1'}
            </Text>
          </StripeFill>
        )}
      </View>

      <View style={{ paddingHorizontal: 11, paddingTop: 10, paddingBottom: 12, gap: 4 }}>
        <Text style={[sans(600, 12.5, 1.3), { color: theme.ink }]} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[mono(600, 11.5), { color: theme.a1 }]}>
            {money(hasPromo ? item.promotionPrice! : item.price)}
          </Text>
          {hasPromo ? (
            <Text
              style={[
                mono(400, 10),
                {
                  color: 'rgba(255,255,255,.35)',
                  textDecorationLine: 'line-through',
                },
              ]}
            >
              {money(item.price)}
            </Text>
          ) : null}
        </View>
      </View>
    </TapScale>
  );
}
