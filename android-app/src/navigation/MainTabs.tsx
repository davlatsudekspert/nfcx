import React, { useEffect, useMemo } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import type { MainTabParamList } from './types';
import { HomeNavigator } from './HomeNavigator';
import { IdNavigator } from './IdNavigator';
import { AuctionNavigator } from './AuctionNavigator';
import { CompanyNavigator } from './CompanyNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import { color, depth, gradient, radius, space, type as typeTokens } from '../design-system/tokens';
import { GoldSheen } from '../design-system/components/GoldSheen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, React.ComponentProps<typeof Feather>['name']> = {
  HomeTab: 'home',
  IdTab: 'hash',
  AuctionTab: 'trending-up',
  CompanyTab: 'briefcase',
  ProfileTab: 'user',
};

const LABEL_KEYS: Record<keyof MainTabParamList, StringKey> = {
  HomeTab: 'tab.home',
  IdTab: 'tab.id',
  AuctionTab: 'tab.auction',
  CompanyTab: 'tab.company',
  ProfileTab: 'tab.profile',
};

/** The bar floor: the warm near-black, settling slightly deeper at the
 * bottom so it separates from the screen above without a drawn divider. */
const BAR = [color.bgWarm, color.bg] as const;
/** Specular corner on the selected pill — the light source is top-left. */
const SPECULAR = ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.06)', 'transparent'] as const;

const PILL_MS = 220;

/**
 * Bottom nav — hard-capped at 5 tabs (brief §14).
 *
 * The selected tab sits on a gold gradient pill that catches a single sweep
 * of light as it lands and rests in a soft gold glow; the other four stay
 * quiet, near-black and unlit. That contrast is the whole point: on a warm
 * black bar, one lit metal element reads as prestige, five would read as a
 * slot machine.
 *
 * `tabBarHideOnKeyboard` keeps the bar from being shoved up over a focused
 * input (brief §23), and each tab keeps its own stack state because every tab
 * hosts its own native-stack navigator.
 */
export function MainTabs() {
  const t = useT();
  const insets = useSafeAreaInsets();
  /* The bar owns its own height, so it also has to own the gesture-bar inset
     and the user's font scale — otherwise a large system font clips the
     labels and a gesture-nav device draws the bar under the system handle. */
  const fontScale = Math.min(PixelRatio.getFontScale() || 1, 1.6);
  const barStyle = useMemo(
    () => [
      styles.bar,
      {
        height: Math.round(64 + Math.max(0, fontScale - 1) * 18) + insets.bottom,
        paddingBottom: space.sm + insets.bottom,
      },
    ],
    [fontScale, insets.bottom],
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const name = route.name as keyof MainTabParamList;
        return {
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: color.gold,
          tabBarInactiveTintColor: color.textTertiary,
          tabBarStyle: barStyle,
          tabBarItemStyle: styles.item,
          tabBarLabelStyle: styles.label,
          tabBarBackground: () => (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <LinearGradient colors={BAR} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.barEdge} />
            </View>
          ),
          tabBarIcon: ({ color: tint, focused }) => (
            <TabIcon name={ICONS[name]} tint={tint} focused={focused} />
          ),
          tabBarLabel: t(LABEL_KEYS[name]),
        };
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeNavigator} />
      <Tab.Screen name="IdTab" component={IdNavigator} />
      <Tab.Screen name="AuctionTab" component={AuctionNavigator} />
      <Tab.Screen name="CompanyTab" component={CompanyNavigator} />
      <Tab.Screen name="ProfileTab" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}

/**
 * The pill only animates when selection changes — one 220ms settle plus one
 * `GoldSheen` sweep (mounted per selection, never looping). Nothing runs
 * while the user reads the screen above it.
 */
function TabIcon({
  name,
  tint,
  focused,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  tint: string;
  focused: boolean;
}) {
  const on = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(focused ? 1 : 0, { duration: PILL_MS, easing: Easing.out(Easing.cubic) });
  }, [focused, on]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scaleX: 0.72 + on.value * 0.28 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: on.value }));

  return (
    <View style={styles.iconWrap}>
      <Animated.View style={[styles.pillGlow, glowStyle]} pointerEvents="none" />
      <Animated.View style={[styles.pill, pillStyle]} pointerEvents="none">
        <LinearGradient
          colors={gradient.goldButton}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={SPECULAR}
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.pillLip} />
        {/* Mounted only while selected: GoldSheen sweeps once on mount, so
            every new selection gets exactly one sweep and nothing loops. */}
        {focused ? <GoldSheen loop={false} band={0.4} intensity={0.8} /> : null}
      </Animated.View>
      <Feather name={name} size={19} color={focused ? color.textOnGold : tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingTop: space.sm,
    elevation: 0,
  },
  /** One warm hairline where the bar meets the screen — a machined seam
   * instead of a drawn divider. */
  barEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,90,0.28)',
  },
  item: { paddingVertical: 2 },
  label: { ...typeTokens.caption, fontSize: 11, marginTop: 2, letterSpacing: 0.2 },
  iconWrap: {
    minWidth: 48,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The glow is a sibling of the clipped pill so it can bloom past the edge. */
  pillGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: radius.pill,
    ...depth.glow,
  },
  pill: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: color.goldDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,246,214,0.55)',
    ...depth.chip,
  },
  pillLip: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255,252,235,0.6)',
  },
});
