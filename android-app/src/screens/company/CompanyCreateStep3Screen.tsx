import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import type { CompanyStackParamList } from '../../navigation/types';
import { CompanyStepShell } from './CompanyStepShell';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { useToast } from '../../design-system/components/PremiumToast';
import { NoticeLine, SectionHeader } from './CompanyVisuals';
import { absoluteUploadUrl } from './companyForm';
import { pickAndUploadImage } from '../../native/imageUpload';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate3'>;

/** Step 3/5 — brand images. Both are optional and the company is created
 * without them just fine, so this step can be skipped outright. */
export function CompanyCreateStep3Screen({ route, navigation }: Props) {
  const { draft } = route.params;
  const toast = useToast();
  const [logoUrl, setLogoUrl] = useState(draft.logoUrl);
  const [coverUrl, setCoverUrl] = useState(draft.coverUrl);
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);

  const pick = async (target: 'logo' | 'cover') => {
    if (uploading) return;
    setUploading(target);
    const result = await pickAndUploadImage();
    setUploading(null);

    if (result.status === 'ok') {
      const url = absoluteUploadUrl(result.url);
      if (target === 'logo') setLogoUrl(url);
      else setCoverUrl(url);
      toast.show('Rasm yuklandi.', 'success');
      return;
    }
    if (result.status === 'permission_denied') {
      toast.show('Galereyaga ruxsat berilmagan.', 'warning');
      return;
    }
    if (result.status === 'error') {
      toast.show('Rasm yuklanmadi. Qayta urinib ko‘ring.', 'danger');
    }
  };

  const goNext = () =>
    navigation.push('CompanyCreate4', { draft: { ...draft, logoUrl, coverUrl } });

  return (
    <CompanyStepShell
      step={3}
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      primaryLabel="Davom etish"
      onPrimary={goNext}
      secondaryLabel={!logoUrl && !coverUrl ? "Hozircha o'tkazib yuborish" : undefined}
      onSecondary={!logoUrl && !coverUrl ? goNext : undefined}
    >
      <PremiumCard animate={false}>
        <SectionHeader title="LOGOTIP" />
        <View style={styles.logoRow}>
          <UploadSlot
            uri={logoUrl}
            loading={uploading === 'logo'}
            onPress={() => void pick('logo')}
            onClear={() => setLogoUrl(undefined)}
            style={styles.logoSlot}
            icon="image"
          />
          <View style={styles.logoCopy}>
            <Text style={styles.slotTitle}>Kvadrat logotip</Text>
            <Text style={styles.slotBody}>Kartochka va ochiq sahifada birinchi bo'lib shu ko'rinadi.</Text>
          </View>
        </View>
      </PremiumCard>

      <PremiumCard animate={false}>
        <SectionHeader title="MUQOVA" />
        <UploadSlot
          uri={coverUrl}
          loading={uploading === 'cover'}
          onPress={() => void pick('cover')}
          onClear={() => setCoverUrl(undefined)}
          style={styles.coverSlot}
          icon="layout"
        />
        <Text style={styles.slotBody}>Keng format — sahifa yuqorisidagi fon rasmi.</Text>
      </PremiumCard>

      <NoticeLine
        icon="info"
        text="Rasmlar avtomatik siqiladi. Keyinroq boshqaruv panelidan ham almashtirsangiz bo'ladi."
      />
    </CompanyStepShell>
  );
}

function UploadSlot({
  uri,
  loading,
  onPress,
  onClear,
  style,
  icon,
}: {
  uri?: string;
  loading: boolean;
  onPress: () => void;
  onClear: () => void;
  style: StyleProp<ViewStyle>;
  icon: React.ComponentProps<typeof Feather>['name'];
}) {
  return (
    <View style={[styles.slot, style]}>
      {loading ? (
        <PremiumLoadingSkeleton height={120} />
      ) : (
        <Pressable
          onPress={onPress}
          style={styles.slotPress}
          accessibilityRole="button"
          accessibilityLabel={uri ? "Rasmni o'zgartirish" : 'Rasm tanlash'}
        >
          {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          {!uri && (
            <View style={styles.slotPlaceholder}>
              <Feather name={icon} size={20} color={color.gold} />
              <Text style={styles.slotAction}>Rasm tanlash</Text>
            </View>
          )}
        </Pressable>
      )}

      {uri && !loading ? (
        <Pressable
          onPress={onClear}
          hitSlop={8}
          style={styles.clearButton}
          accessibilityRole="button"
          accessibilityLabel="Rasmni olib tashlash"
        >
          <Feather name="x" size={14} color={color.textPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceSunken,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  slotPress: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 96 },
  slotPlaceholder: { alignItems: 'center', gap: space.xs },
  slotAction: { ...typeTokens.caption, color: color.gold, fontWeight: '700' },
  logoRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  logoSlot: { width: 96, height: 96 },
  logoCopy: { flex: 1 },
  coverSlot: { height: 132, marginBottom: space.sm },
  slotTitle: { ...typeTokens.bodyStrong, color: color.textPrimary },
  slotBody: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2, lineHeight: 17 },
  clearButton: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
