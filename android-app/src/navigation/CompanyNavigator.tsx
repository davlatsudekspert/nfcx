import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from './types';
import { CompanyHomeScreen } from '../screens/company/CompanyHomeScreen';
import { CompanyCreateStep1Screen } from '../screens/company/CompanyCreateStep1Screen';
import { CompanyCreateStep2Screen } from '../screens/company/CompanyCreateStep2Screen';
import { CompanyCreateStep3Screen } from '../screens/company/CompanyCreateStep3Screen';
import { CompanyCreateStep4Screen } from '../screens/company/CompanyCreateStep4Screen';
import { CompanyCreateStep5Screen } from '../screens/company/CompanyCreateStep5Screen';
import { CompanyDashboardScreen } from '../screens/company/CompanyDashboardScreen';
import { CatalogListScreen } from '../screens/company/CatalogListScreen';
import { PublicCompanyScreen } from '../screens/company/PublicCompanyScreen';

const Stack = createNativeStackNavigator<CompanyStackParamList>();

export function CompanyNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CompanyHome" component={CompanyHomeScreen} />
      <Stack.Screen name="CompanyCreate1" component={CompanyCreateStep1Screen} />
      <Stack.Screen name="CompanyCreate2" component={CompanyCreateStep2Screen} />
      <Stack.Screen name="CompanyCreate3" component={CompanyCreateStep3Screen} />
      <Stack.Screen name="CompanyCreate4" component={CompanyCreateStep4Screen} />
      <Stack.Screen name="CompanyCreate5" component={CompanyCreateStep5Screen} />
      <Stack.Screen name="CompanyDashboard" component={CompanyDashboardScreen} />
      <Stack.Screen name="CatalogList" component={CatalogListScreen} />
      <Stack.Screen name="PublicCompany" component={PublicCompanyScreen} />
    </Stack.Navigator>
  );
}
