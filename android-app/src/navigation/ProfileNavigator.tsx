import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { MyProfileScreen } from '../screens/profile/MyProfileScreen';
import { ProfileEditScreen } from '../screens/profile/ProfileEditScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { NotificationsScreen } from '../screens/profile/NotificationsScreen';
import { NfcReadScreen } from '../screens/profile/NfcReadScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyProfile" component={MyProfileScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NfcRead" component={NfcReadScreen} />
    </Stack.Navigator>
  );
}
