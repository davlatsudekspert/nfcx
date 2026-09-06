import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

/**
 * Bottom nav — hard-capped at 5 tabs (brief §14).
 *
 * The selected tab gets a soft gold "pill" behind its icon rather than only a
 * tint change, which reads as deliberate on a near-black bar and survives
 * being glanced at on a phone. `tabBarHideOnKeyboard` keeps the bar from being
 * shoved up over a focused input (brief §23), and each tab keeps its own stack
 * state because every tab hosts its own native-stack navigator.
 */
export function MainTabs() {
  const t = useT();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const name = route.name as keyof MainTabParamList;
        return {
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: color.gold,
          tabBarInactiveTintColor: color.textTertiary,
          tabBarStyle: styles.bar,
          tabBarItemStyle: styles.item,
          tabBarLabelStyle: styles.label,
          tabBarIcon: ({ color: tint, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Feather name={ICONS[name]} size={20} color={tint} />
            </View>
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

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.bgDeep,
    borderTopColor: color.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 64,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  item: { paddingVertical: 2 },
  label: { ...typeTokens.caption, fontSize: 11, marginTop: 2 },
  iconWrap: {
    minWidth: 46,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: color.goldMuted,
  },
});
