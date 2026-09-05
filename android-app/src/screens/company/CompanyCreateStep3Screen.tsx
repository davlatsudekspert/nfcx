import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { pickAndUploadImage } from '../../native/imageUpload';
import { useToast } from '../../design-system/components/PremiumToast';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate3'>;

export function CompanyCreateStep3Screen({ route, navigation }: Props) {
  const { draft } = route.params;
  const toast = useToast();
  const [logoUrl, setLogoUrl] = useState(draft.logoUrl);
  const [coverUrl, setCoverUrl] = useState(draft.coverUrl);
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);

  const pick = async (target: 'logo' | 'cover') => {
    setUploading(target);
    const result = await pickAndUploadImage();
    setUploading(null);
    if (result.status === 'ok') {
      const fullUrl = `https://nfcstore.uz${result.url}`;
      if (target === 'logo') setLogoUrl(fullUrl);
      else setCoverUrl(fullUrl);
    } else if (result.status === 'permission_denied') {
      toast.show('Galereyaga ruxsat berilmagan.', 'warning');
    } else if (result.status === 'error') {
      toast.show('Rasm yuklashda xatolik.', 'danger');
    }
  };

  return (
    <ScreenWithHeader title="Kompaniya — 3/5" onBack={navigation.goBack}>
      <Text style={styles.label}>Logotip</Text>
      <ImageUploadBox uri={logoUrl} loading={uploading === 'logo'} onPress={() => pick('logo')} />

      <Text style={styles.label}>Muqova rasmi</Text>
      <ImageUploadBox uri={coverUrl} loading={uploading === 'cover'} onPress={() => pick('cover')} wide />

      <PremiumButton
        label="Davom etish"
        onPress={() => navigation.navigate('CompanyCreate4', { draft: { ...draft, logoUrl, coverUrl } })}
      />
    </ScreenWithHeader>
  );
}

function ImageUploadBox({ uri, loading, onPress, wide }: { uri?: string; loading: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <View style={[styles.box, wide && styles.boxWide]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} /> : null}
      <PremiumButton label={uri ? "O'zgartirish" : 'Rasm tanlash'} variant="ghost" onPress={onPress} loading={loading} fullWidth={false} style={styles.boxButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typeTokens.caption, color: color.textSecondary, marginBottom: space.xs, marginTop: space.md },
  box: {
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: space.md,
  },
  boxWide: { height: 140 },
  boxButton: { paddingHorizontal: space.lg },
});
