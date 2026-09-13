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
export type SettingRow = {
  k: string;
  v: string;
  onPress?: () => void;
  /** Masalan "Chiqish" — qizil rangda ko'rsatiladi. */
  danger?: boolean;
};

export function SettingsSheet({
  visible,
  onClose,
  rows,
}: {
  visible: boolean;
  onClose: () => void;
  /** Hisob, bildirishnoma, til, to'lov, chiqish kabi qatorlar. */
  rows: SettingRow[];
}) {
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
      <SettingsBody rows={rows} />
    </Sheet>
  );
}

/**
 * Tema tanlagich + qatorlar — `SettingsSheet` (Profil varag'i) va
 * to'liq ekranli Settings TABI (`app/(tabs)/settings.tsx`) IKKALASI
 * HAM shu tarkibni ishlatadi, bir joyda saqlangan tarkib ikkalasida
 * ham bir xil bo'lsin deb (foydalanuvchi so'ragan: "bottombarga
 * settingsni ham qosh" — sheet ESKI joyida ham qoladi, YANGI tab esa
 * shu tarkibni to'liq sahifa sifatida ko'rsatadi).
 */
export function SettingsBody({ rows }: { rows: SettingRow[] }) {
  const { themeKey, setTheme } = useTheme();

  return (
    <>
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
        {rows.map((row) => {
          const content = (
            <>
              <Text
                style={[
                  sans(500, 13),
                  { color: row.danger ? '#e2685f' : 'rgba(255,255,255,.78)' },
                ]}
              >
                {row.k}
              </Text>
              <Text style={[mono(500, 12), { color: 'rgba(255,255,255,.4)' }]}>
                {row.v}
              </Text>
            </>
          );
          const rowStyle = {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'space-between' as const,
            paddingVertical: 13,
            paddingHorizontal: 2,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,.06)',
          };
          return row.onPress ? (
            <TapScale
              key={row.k}
              radius={0}
              onPress={row.onPress}
              accessibilityLabel={row.k}
              style={rowStyle}
            >
              {content}
            </TapScale>
          ) : (
            <View key={row.k} style={rowStyle}>
              {content}
            </View>
          );
        })}
      </View>
    </>
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
