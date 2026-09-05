import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HomeStackParamList } from '../../navigation/types';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumSheet } from '../../design-system/components/PremiumSheet';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { ProfileView } from '../../composites/ProfileView';
import { recordsApi } from '../../api/records';
import { socialApi } from '../../api/social';
import { useAuthStore } from '../../state/authStore';
import { shareProfile } from '../../native/share';
import { saveContact, getContactsPermissionStatus, openAppSettings } from '../../native/contacts';
import { haptics } from '../../native/haptics';
import { useToast } from '../../design-system/components/PremiumToast';
import { color, space, touchTarget, type as typeTokens } from '../../design-system/tokens';
import type BottomSheet from '@gorhom/bottom-sheet';

type Props = NativeStackScreenProps<HomeStackParamList, 'PublicProfile'>;

/**
 * The NFC Profile View — brief §10, this app's most premium screen.
 * Deep-link target for nfcstore.uz/:code (android/docs/03-ARCHITECTURE.md
 * §3.5). "Like" from the mockup is implemented as the real, confirmed
 * social action this API actually has — follow/unfollow
 * (android/docs/02-API_MAP.md §2.6) — there is no separate "like" endpoint
 * confirmed anywhere in `hosting/worker.js`.
 */
export function PublicProfileScreen({ route, navigation }: Props) {
  const { code } = route.params;
  const user = useAuthStore((s) => s.user);
  const ownedCards = useAuthStore((s) => s.cards);
  const toast = useToast();
  const queryClient = useQueryClient();
  const sheetRef = React.useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const [permissionDenied, setPermissionDenied] = useState(false);

  const record = useQuery({ queryKey: ['records', code], queryFn: () => recordsApi.get(code) });
  const stats = useQuery({ queryKey: ['follow-stats', code], queryFn: () => socialApi.stats(code) });

  useEffect(() => {
    recordsApi.addView(code, 'link');
  }, [code]);

  const isOwner = !!user && ownedCards.some((c) => c.code === code);

  const followMutation = useMutation({
    mutationFn: () => (stats.data?.isFollowing ? socialApi.unfollow(code) : socialApi.follow(code)),
    onMutate: () => haptics.selection(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['follow-stats', code] }),
  });

  const onSaveContactPress = () => {
    sheetRef.current?.expand();
  };

  const onConfirmSaveContact = async () => {
    if (!record.data) return;
    const status = await getContactsPermissionStatus();
    if (status === 'denied') {
      setPermissionDenied(true);
      return;
    }
    const result = await saveContact({
      name: record.data.name,
      phone: record.data.phone,
      email: record.data.email,
      website: record.data.website,
      profileUrl: `https://nfcstore.uz/${code}`,
    });
    if (result.status === 'saved') {
      haptics.success();
      toast.show('Kontakt saqlandi.', 'success');
      sheetRef.current?.close();
    } else if (result.status === 'permission_denied') {
      setPermissionDenied(true);
    } else {
      toast.show('Kontaktni saqlashda xatolik.', 'danger');
    }
  };

  if (record.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <PremiumHeader onBack={navigation.canGoBack() ? navigation.goBack : undefined} />
        <PremiumLoadingSkeleton height={200} />
      </SafeAreaView>
    );
  }

  if (!record.data) {
    return (
      <SafeAreaView style={styles.safe}>
        <PremiumHeader onBack={navigation.canGoBack() ? navigation.goBack : undefined} />
        <PremiumEmptyState icon="user-x" title="Profil topilmadi" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <PremiumHeader
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        actions={[
          { icon: 'share-2', accessibilityLabel: "Ulashish", onPress: () => shareProfile(code, record.data?.name) },
          ...(user && !isOwner
            ? [{
                icon: 'heart' as const,
                accessibilityLabel: stats.data?.isFollowing ? 'Obunani bekor qilish' : "Obuna bo'lish",
                onPress: () => followMutation.mutate(),
              }]
            : []),
        ]}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ProfileView record={record.data} followStats={stats.data} />
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: space.lg + insets.bottom }]}>
        <PremiumButton label="KONTAKTNI SAQLASH" onPress={onSaveContactPress} />
      </View>

      <PremiumSheet ref={sheetRef} title="Kontaktni saqlash">
        {permissionDenied ? (
          <View>
            <Text style={styles.sheetText}>
              Kontaktlarga ruxsat berilmagan. Sozlamalardan ruxsat berishingiz mumkin.
            </Text>
            <PremiumButton label="Sozlamalarni ochish" onPress={openAppSettings} style={styles.sheetButton} />
          </View>
        ) : (
          <View>
            <Text style={styles.sheetText}>
              {record.data.name} kontaktini telefon kitobingizga saqlaymiz: ism, telefon, email va profil havolasi.
            </Text>
            <PremiumButton label="Saqlash" onPress={onConfirmSaveContact} style={styles.sheetButton} />
          </View>
        )}
      </PremiumSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  scrollContent: { paddingHorizontal: space.lg, paddingBottom: touchTarget + space.xl },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.lg,
    backgroundColor: color.bg,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  sheetText: { ...typeTokens.body, color: color.textSecondary, marginBottom: space.md },
  sheetButton: { marginTop: space.sm },
});
