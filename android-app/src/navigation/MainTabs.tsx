import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import type { MainTabParamList } from './types';
import { HomeNavigator } from './HomeNavigator';
import { IdNavigator } from './IdNavigator';
import { AuctionNavigator } from './AuctionNavigator';
import { CompanyNavigator } from './CompanyNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { color } from '../design-system/tokens';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, React.ComponentProps<typeof Feather>['name']> = {
  HomeTab: 'home',
  IdTab: 'hash',
  AuctionTab: 'trending-up',
  CompanyTab: 'briefcase',
  ProfileTab: 'user',
};

const LABELS: Record<keyof MainTabParamList, string> = {
  HomeTab: 'Bosh sahifa',
  IdTab: 'ID',
  AuctionTab: 'Auksion',
  CompanyTab: 'Kompaniya',
  ProfileTab: 'Profil',
};

/** Bottom nav — hard-capped at 5 tabs (brief §14). Active = gold, inactive = gray. */
export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: color.gold,
        tabBarInactiveTintColor: color.textSecondary,
        tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.border },
        tabBarIcon: ({ color: tint, size }) => (
          <Feather name={ICONS[route.name as keyof MainTabParamList]} size={size} color={tint} />
        ),
        tabBarLabel: LABELS[route.name as keyof MainTabParamList],
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeNavigator} />
      <Tab.Screen name="IdTab" component={IdNavigator} />
      <Tab.Screen name="AuctionTab" component={AuctionNavigator} />
      <Tab.Screen name="CompanyTab" component={CompanyNavigator} />
      <Tab.Screen name="ProfileTab" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}
