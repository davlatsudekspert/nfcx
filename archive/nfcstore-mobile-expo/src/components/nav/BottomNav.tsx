import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useSvgId } from '@/lib/svgId';
import { A180 } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

import { NAV_ICONS, type NavIconName } from './NavIcons';
import { NavGlow } from './NavGlow';

/** Maketdagi tartib: Home / Katalog / Company / Profile. Auction YO'Q. */
const TABS: { route: string; icon: NavIconName; label: string }[] = [
  { route: 'index', icon: 'home', label: 'Home' },
  { route: 'katalog', icon: 'katalog', label: 'Katalog' },
  { route: 'company', icon: 'company', label: 'Company' },
  { route: 'profile', icon: 'profile', label: 'Profile' },
];

const INDICATOR_W = 26;

/**
 * `Tabs` ning `tabBar` prop'i beradigan ma'lumotning BIZGA KERAKLI
 * qismi. To'liq `BottomTabBarProps` expo-router ichidagi `build/`
 * papkasida yashiringan (ommaviy eksport emas), o'sha yo'lga bog'lanish
 * esa keyingi yangilanishda uzilib qolishi mumkin. Shuning uchun
 * struktura bo'yicha mos keladigan minimal tip shu yerda e'lon
 * qilinadi — bizga faqat faol indeks, marshrut nomlari va `navigate`
 * kerak.
 */
export type TabBarSlice = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: never) => void };
};

/**
 * Premium pastki navigatsiya — spetsifikatsiyaning "bottom nav upgrade"
 * bandi to'liq:
 *
 *   • faol ikonka gold gradient bilan to'ldirilgan (kontur emas)
 *   • ortidan yuqoriga taralayotgan yumshoq gold yorug'lik
 *   • faol yozuv gold va qalinroq, nofaol yozuv so'ngan kulrang
 *   • tablar orasida SILJIYDIGAN indikator (sakramaydi)
 *   • bosilganda ikonka ~1.12x ga kattalashib joyiga qaytadi
 */
export function BottomNav({ state, navigation }: TabBarSlice) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const glowId = useSvgId('indGlow');

  // Indikatorning gorizontal o'rni. Maketda:
  //   left: calc(index*25% + 12.5% - 13px)
  //   transition: left .34s cubic-bezier(.4,0,.2,1)
  const indicator = useSharedValue(0);

  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.route === state.routes[state.index]?.name),
  );

  useEffect(() => {
    if (width <= 0) return;
    const target = (activeIndex * 0.25 + 0.125) * width - INDICATOR_W / 2;
    indicator.value = withTiming(target, {
      duration: 340,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [activeIndex, width, indicator]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicator.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) {
      setWidth(w);
      // Birinchi o'lchashda indikator joyida TURIB qolsin, chapdan
      // uchib kelmasin.
      indicator.value = (activeIndex * 0.25 + 0.125) * w - INDICATOR_W / 2;
    }
  };

  return (
    <View
      onLayout={onLayout}
      style={{
        position: 'relative',
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,.08)',
        paddingTop: 9,
        paddingHorizontal: 4,
        // Maketda 8px; qurilmadagi gesture-bar uchun xavfsiz zona qo'shiladi.
        paddingBottom: 8 + insets.bottom,
        backgroundColor: theme.bg,
      }}
    >
      {/* linear-gradient(180deg, rgba(255,255,255,.03), transparent) */}
      <LinearGradient
        colors={['rgba(255,255,255,.03)', 'rgba(255,255,255,0)']}
        start={A180.start}
        end={A180.end}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              bottom: 3 + insets.bottom,
              left: 0,
              width: INDICATOR_W,
              height: 3,
            },
            indicatorStyle,
          ]}
        >
          {/* box-shadow: 0 0 10px a1 — RN da rangli soya Android'da
              yo'q, shuning uchun yorug'lik SVG radial bilan chiziladi:
              ikki platformada bir xil ko'rinadi. */}
          <Svg
            width={INDICATOR_W + 18}
            height={13}
            style={{ position: 'absolute', left: -9, top: -5 }}
          >
            <Defs>
              <RadialGradient id={glowId} cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={theme.a1} stopOpacity={0.55} />
                <Stop offset="1" stopColor={theme.a1} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse
              cx={(INDICATOR_W + 18) / 2}
              cy={6.5}
              rx={(INDICATOR_W + 18) / 2}
              ry={6.5}
              fill={`url(#${glowId})`}
            />
          </Svg>
          <LinearGradient
            colors={[theme.a1, theme.a2]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, borderRadius: 3 }}
          />
        </Animated.View>
      ) : null}

      {TABS.map((tab, i) => {
        const route = state.routes.find((r) => r.name === tab.route);
        return (
          <NavItem
            key={tab.route}
            tab={tab}
            focused={i === activeIndex}
            onPress={() => {
              if (!route) return;
              if (i !== activeIndex) {
                Haptics.selectionAsync().catch(() => {});
                navigation.navigate(route.name as never);
              }
            }}
          />
        );
      })}
    </View>
  );
}

function NavItem({
  tab,
  focused,
  onPress,
}: {
  tab: { route: string; icon: NavIconName; label: string };
  focused: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const pop = useSharedValue(1);
  const { Active, Idle } = NAV_ICONS[tab.icon];

  // @keyframes iconPop { 0%{scale(1)} 40%{scale(1.12)} 100%{scale(1)} }
  // davomiyligi .34s
  const press = () => {
    pop.value = withSequence(
      withTiming(1.12, { duration: 136, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 204, easing: Easing.inOut(Easing.ease) }),
    );
  };

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Pressable
      onPress={() => {
        press();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tab.label}
      android_ripple={Platform.OS === 'android' ? { color: 'transparent' } : undefined}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 5,
        position: 'relative',
      }}
    >
      {focused ? <NavGlow color={theme.a1} /> : null}
      <Animated.View style={iconStyle}>
        {focused ? (
          <Active a1={theme.a1} a2={theme.a2} bg={theme.bg} />
        ) : (
          <Idle color={theme.off} />
        )}
      </Animated.View>
      <Text
        style={[
          focused ? sans(700, 9.5) : sans(500, 9.5),
          { color: focused ? theme.a1 : theme.off },
        ]}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}
