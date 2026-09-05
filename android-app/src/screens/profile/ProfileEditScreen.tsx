import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileEdit'>;

/** Real Live Preview + access.ts feature gating lands in Phase 9. */
export function ProfileEditScreen({ navigation }: Props) {
  return <StubScreen screenName="Profilni tahrirlash" phase="Phase 9 — Personal Profile" onBack={navigation.goBack} />;
}
