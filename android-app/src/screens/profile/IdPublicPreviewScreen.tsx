import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { PublicProfileBody } from '../home/PublicProfileScreen';

type Props = NativeStackScreenProps<ProfileStackParamList, 'IdPublicPreview'>;

/**
 * "NFC profilini ko'rish" — the owner's preview of their own card.
 *
 * It mounts the exact same component a real NFC-tap visitor gets
 * (`PublicProfileBody`), reading the same `GET /api/records/:code` response.
 * Nothing is reconstructed from the workspace's local draft, so the preview
 * cannot flatter a save that did not actually land. Preview mode only
 * changes the chrome (a clearly labelled banner, share instead of
 * save-contact) and suppresses the view-counter ping.
 */
export function IdPublicPreviewScreen({ route, navigation }: Props) {
  return (
    <PublicProfileBody
      code={route.params.code}
      mode="ownerPreview"
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
    />
  );
}
