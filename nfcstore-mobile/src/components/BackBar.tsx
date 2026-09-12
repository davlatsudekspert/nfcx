import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { TapScale } from '@/components/TapScale';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Tashqi profil va Dashboard uchun yuqori qator: orqaga tugmasi va
 * sarlavha. Profil TABIDA bu ishlatilmaydi — u yerda handle +
 * sozlamalar turadi.
 */
export function BackBar({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingTop: 8 + insets.top,
        paddingHorizontal: 14,
        paddingBottom: 6,
      }}
    >
      <TapScale
        radius={12}
        onPress={() => {
          // `canGoBack` bo'lmasa (masalan deep link bilan to'g'ridan-to'g'ri
          // ochilgan) Profil tabiga qaytamiz — ilova boshi berk ko'chada
          // qolmasin.
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/profile');
        }}
        accessibilityLabel="Orqaga"
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,.04)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={17} height={17} viewBox="0 0 24 24">
          <Path
            d="M14.5 5.5L8 12l6.5 6.5"
            stroke={theme.ink}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </TapScale>

      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
        <Text style={[sans(700, 14), { color: theme.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[mono(500, 10.5), { color: 'rgba(255,255,255,.42)' }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}

/**
 * "Bu karta faol emas" ogohlantirishi.
 *
 * Saytdagi xatti-harakat bilan bir xil (src/pages/ProfilePage.jsx):
 * profil BARIBIR ko'rsatiladi, faqat ustida ogohlantirish chiqadi.
 * Karta bloklangan yoki auksionda boshqa odamga o'tgan bo'lishi mumkin.
 */
export function TapInactiveBanner() {
  const { theme } = useTheme();

  return (
    <View
      style={{
        marginHorizontal: 14,
        marginBottom: 8,
        paddingVertical: 11,
        paddingHorizontal: 13,
        borderRadius: 12,
        backgroundColor: 'rgba(190,80,80,.12)',
        borderWidth: 1,
        borderColor: 'rgba(190,80,80,.26)',
      }}
    >
      <Text style={[sans(600, 12, 1.4), { color: '#d98b8b' }]}>
        Bu jismoniy karta faol emas
      </Text>
      <Text
        style={[sans(400, 11.5, 1.45), { color: 'rgba(255,255,255,.5)', marginTop: 4 }]}
      >
        Karta egasi tomonidan bloklangan yoki boshqa profilga o’tgan. Profil
        ma’lumotlari quyida ko’rsatilgan.
      </Text>
    </View>
  );
}
