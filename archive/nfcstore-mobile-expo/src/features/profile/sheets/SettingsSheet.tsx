import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { TapScale } from '@/components/TapScale';
import { A140, A165, SHADOW } from '@/theme/css';
import { THEME_KEYS, THEMES, type ThemeKey } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Sozlamalar varag'i — spetsifikatsiya 8-bo'limi.
 *
 * 4 ta preset: Black-Gold (standart), Silver, Midnight Blue, Warm
 * Bronze. Har biri fon tonini va aksent rangini o'zgartiradi, LEKIN
 * har doim qorong'u asos saqlanadi — yorug' tema YO'Q, premium
 * ko'rinish shunga bog'liq.
 *
 * Tanlov DARHOL qo'llanadi va qurilmada saqlanadi (ThemeProvider).
 * Bu "presetdan tanlash" darajasidagi MVP — to'liq rang tanlagich
 * ataylab yo'q.
 */
export function SettingsSheet({
  visible,
  onClose,
  rows,
}: {
  visible: boolean;
  onClose: () => void;
  /** Hisob, bildirishnoma, til, to'lov, chiqish kabi qatorlar. */
  rows: { k: string; v: string }[];
}) {
  const { themeKey, setTheme } = useTheme();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Ilova temasi"
      titleRight={
        <Text style={[mono(500, 10.5), { color: 'rgba(255,255,255,.4)' }]}>
          QURILMADA SAQLANADI
        </Text>
      }
    >
      <Text
        style={[
          sans(400, 11.5, 1.5),
          { color: 'rgba(255,255,255,.42)', marginBottom: 13 },
        ]}
      >
        Faqat presetlar. Har bir tema qorong’u asosni saqlaydi.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {THEME_KEYS.map((key) => (
          <ThemeCard
            key={key}
            themeKey={key}
            selected={key === themeKey}
            onPress={() => setTheme(key)}
          />
        ))}
      </View>

      <View
        style={{
          marginTop: 16,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,.07)',
        }}
      >
        {rows.map((row) => (
          <View
            key={row.k}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 13,
              paddingHorizontal: 2,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,.06)',
            }}
          >
            <Text style={[sans(500, 13), { color: 'rgba(255,255,255,.78)' }]}>
              {row.k}
            </Text>
            <Text style={[mono(500, 12), { color: 'rgba(255,255,255,.4)' }]}>
              {row.v}
            </Text>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

function ThemeCard({
  themeKey,
  selected,
  onPress,
}: {
  themeKey: ThemeKey;
  selected: boolean;
  onPress: () => void;
}) {
  const t = THEMES[themeKey];

  return (
    <TapScale
      radius={14}
      onPress={onPress}
      accessibilityLabel={t.label}
      accessibilityState={{ selected }}
      style={[
        {
          // Ikki ustun: varaq eni 16+16 padding, orasida 10.
          flexGrow: 1,
          flexBasis: '46%',
          gap: 9,
          padding: 13,
          borderRadius: 14,
          borderWidth: selected ? 1.5 : 1,
          borderColor: selected ? t.a1 : 'rgba(255,255,255,.09)',
          overflow: 'hidden',
        },
        selected ? null : SHADOW.tier,
      ]}
    >
      {/* Har bir karta O'Z temasining rangida chiziladi — odam tanlashdan
          oldin natijani ko'radi. Shuning uchun `useTheme()` emas, `t`. */}
      <LinearGradient
        colors={[t.c1, t.c2]}
        start={A165.start}
        end={A165.end}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <LinearGradient
          colors={[t.a1, t.a2]}
          start={A140.start}
          end={A140.end}
          style={{ width: 18, height: 18, borderRadius: 9 }}
        />
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: t.bg,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,.14)',
          }}
        />
      </View>

      <Text style={[sans(600, 12.5), { color: t.ink }]}>{t.label}</Text>
      <Text style={[mono(500, 10), { color: 'rgba(255,255,255,.4)' }]}>
        {selected ? 'TANLANGAN' : 'QO’LLASH'}
      </Text>
    </TapScale>
  );
}
