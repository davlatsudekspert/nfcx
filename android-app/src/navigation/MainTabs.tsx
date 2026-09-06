import React, { useEffect, useMemo } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import type { MainTabParamList } from './types';
import { HomeNavigator } from './HomeNavigator';
import { IdNavigator } from './IdNavigator';
import { AuctionNavigator } from './AuctionNavigator';
import { CompanyNavigator } from './CompanyNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import { color, radius, space, type as typeTokens } from '../design-system/tokens';

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

/** The bar floor: a deep, slightly warm black that separates the furniture
 * from the screen above it without a drawn divider. */
const BAR = ['#0B0A09', '#050505'] as const;
/** The selected pill is a milled gold billet — light, body, shadowed edge,
 * bounced light — the one piece of real metal that is always on screen. */
const PILL = ['#F0DAA2', '#D7B65D', '#A8873A'] as const;

const PILL_MS = 220;
const PILL_SHEEN_MS = 460;

/**
 * Bottom nav — hard-capped at 5 tabs (brief §14).
 *
 * The selected tab sits on a polished gold billet that catches a single sweep
 * of light as it lands; the other four stay quiet, near-black and unlit. That
 * contrast is the whole point: on a deep-black bar, one lit metal element
 * reads as prestige, five would read as a slot machine.
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
 * sheen sweep. Nothing loops, so the bar costs nothing while the user reads
 * the screen above it.
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
  const sweep = useSharedValue(1.6);

  useEffect(() => {
    on.value = withTiming(focused ? 1 : 0, { duration: PILL_MS, easing: Easing.out(Easing.cubic) });
    if (focused) {
      sweep.value = withDelay(
        90,
        withSequence(
          withTiming(1.6, { duration: 0 }),
          withTiming(-1.6, { duration: 0 }),
          withTiming(1.6, { duration: PILL_SHEEN_MS, easing: Easing.out(Easing.cubic) }),
        ),
      );
    }
  }, [focused, on, sweep]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scaleX: 0.72 + on.value * 0.28 }],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${sweep.value * 100}%` }, { rotate: '18deg' }],
  }));

  return (
    <View style={styles.iconWrap}>
      <Animated.View style={[styles.pill, pillStyle]} pointerEvents="none">
        <LinearGradient
          colors={PILL}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.pillLip} />
        <Animated.View style={[styles.pillSheen, sweepStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,253,240,0.7)', 'transparent'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
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
    backgroundColor: 'rgba(215,182,93,0.20)',
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
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,246,214,0.55)',
  },
  pillLip: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255,252,235,0.6)',
  },
  pillSheen: { position: 'absolute', top: '-60%', bottom: '-60%', left: 0, width: '40%' },
});
