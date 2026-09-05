import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

/** Real POST /api/auth/login wiring + cookie-jar device testing lands in Phase 5. */
export function LoginScreen({ navigation }: Props) {
  return <StubScreen screenName="Login" phase="Phase 5 — Auth" onBack={navigation.canGoBack() ? navigation.goBack : undefined} />;
}
