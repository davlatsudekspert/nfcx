import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

/**
 * Ships fully built in Phase 5, but its CTA is gated behind a remote flag
 * until the backend owner confirms POST /api/auth/register is actually live
 * (android/docs/01-AUDIT.md §1.3/§1.6 item 1) — it 503s in the audited
 * revision of hosting/worker.js.
 */
export function RegisterScreen({ navigation }: Props) {
  return <StubScreen screenName="Register" phase="Phase 5 — Auth (backend-gated)" onBack={navigation.goBack} />;
}
