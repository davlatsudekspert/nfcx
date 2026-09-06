import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import type { HomeStackParamList } from '../../navigation/types';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumSheet } from '../../design-system/components/PremiumSheet';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { NfcIdCard } from '../../composites/NfcIdCard';
import { ProfileView } from '../../composites/ProfileView';
import { recordsApi } from '../../api/records';
import { socialApi } from '../../api/social';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
import { shareProfile } from '../../native/share';
import { saveContact, getContactsPermissionStatus, openAppSettings } from '../../native/contacts';
import { haptics } from '../../native/haptics';
import { useToast } from '../../design-system/components/PremiumToast';
import { useT } from '../../i18n';
import { color, radius, space, touchTarget, type as typeTokens } from '../../design-system/tokens';
import type BottomSheet from '@gorhom/bottom-sheet';

type Props = NativeStackScreenProps<HomeStackParamList, 'PublicProfile'>;

/** `public` — a real visitor (NFC tap / deep link). `ownerPreview` — the
 * owner checking their own card from the ID workspace. Same data source,
 * same body; only the chrome and the side effects differ. */
export type ProfileViewMode = 'public' | 'ownerPreview';

export interface PublicProfileBodyProps {
  code: string;
  mode?: ProfileViewMode;
  onBack?: () => void;
}

/**
 * The NFC Profile View — brief §10, this app's most premium screen, and the
 * deep-link target for nfcstore.uz/:code.
 *
 * Extracted from the screen wrapper so the ID owner workspace can mount the
 * *identical* view in preview mode. The preview is built from the live
 * `GET /api/records/:code` response, never from the workspace's local draft
 * — that is the whole point: an owner who taps "NFC profilini ko'rish" sees
 * exactly what a stranger's phone renders, including a field that failed to
 * save.
 *
 * "Like" from the mockup is implemented as the real, confirmed social action
 * this API actually has — follow/unfollow (android/docs/02-API_MAP.md §2.6);
 * there is no separate "like" endpoint in `hosting/worker.js`.
 */
export function PublicProfileBody({ code, mode = 'public', onBack }: PublicProfileBodyProps) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const ownedCards = useAuthStore((s) => s.cards);
  const toast = useToast();
  const queryClient = useQueryClient();
  const sheetRef = React.useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const [permissionDenied, setPermissionDenied] = useState(false);

  const isPreview = mode === 'ownerPreview';

  const record = useQuery({
    queryKey: ['records', code],
    queryFn: () => recordsApi.get(code),
    // The preview must never show a cached pre-save copy of the profile.
    staleTime: isPreview ? 0 : 15_000,
    refetchOnMount: isPreview ? 'always' : true,
  });
  const stats = useQuery({ queryKey: ['follow-stats', code], queryFn: () => socialApi.stats(code) });

  useEffect(() => {
    // An owner previewing their own card must not inflate their own view
    // counter — that would make the analytics they see a lie.
    if (isPreview) return;
    recordsApi.addView(code, 'link');
  }, [code, isPreview]);

  const isOwner = !!user && ownedCards.some((c) => c.code === code);

  const followMutation = useMutation({
    mutationFn: () => (stats.data?.isFollowing ? socialApi.unfollow(code) : socialApi.follow(code)),
    onMutate: () => haptics.selection(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['follow-stats', code] }),
    onError: (e) => toast.show(e instanceof ApiError ? e.message : t('common.errorService'), 'danger'),
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

  const notFound = record.isError && record.error instanceof ApiError && record.error.status === 404;

  const header = (
    <PremiumHeader
      title={isPreview ? t('owner.publicPreview') : undefined}
      onBack={onBack}
      actions={
        record.data
          ? [
              { icon: 'share-2', accessibilityLabel: t('common.share'), onPress: () => shareProfile(code, record.data?.name) },
              ...(user && !isOwner && !isPreview
                ? [
                    {
                      icon: 'heart' as const,
                      accessibilityLabel: stats.data?.isFollowing ? 'Obunani bekor qilish' : "Obuna bo'lish",
                      onPress: () => followMutation.mutate(),
                    },
                  ]
                : []),
            ]
          : []
      }
    />
  );

  if (notFound) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {header}
        <PremiumEmptyState
          icon="user-x"
          title="Profil topilmadi"
          description={`#${code} bo'yicha ochiq profil mavjud emas.`}
          ctaLabel={onBack ? t('common.back') : undefined}
          onPressCta={onBack}
        />
      </SafeAreaView>
    );
  }

  if (record.isLoading || record.isError || !record.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.stateWrap}>
          <PremiumQueryState
            isLoading={record.isLoading}
            isError={record.isError || !record.data}
            error={record.error}
            onRetry={() => record.refetch()}
            skeletonRows={2}
            skeletonHeight={180}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {header}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isPreview && (
          <View style={styles.previewBanner}>
            <Feather name="eye" size={16} color={color.gold} />
            <Text style={styles.previewBannerText}>{t('owner.publicPreviewHint')}</Text>
          </View>
        )}
        {/* Identity hero — the ID as the physical metal card it is, the same
            object the owner sees in their wallet and in the workspace. */}
        <View style={styles.identityCard}>
          <NfcIdCard
            code={record.data.code}
            name={record.data.name}
            state="owned"
            layout="hero"
            verified={record.data.verified === true}
            isPrimary={record.data.isPrimary === true}
            onPress={() => shareProfile(code, record.data?.name)}
            accessibilityHint={t('common.share')}
          />
        </View>

        <ProfileView record={record.data} followStats={stats.data} hideIdentityRow />
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: space.lg + insets.bottom }]}>
        {isPreview ? (
          <PremiumButton label={t('common.share')} variant="ghost" onPress={() => shareProfile(code, record.data?.name)} />
        ) : (
          <PremiumButton label="KONTAKTNI SAQLASH" onPress={onSaveContactPress} />
        )}
      </View>

      {!isPreview && (
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
      )}
    </SafeAreaView>
  );
}

export function PublicProfileScreen({ route, navigation }: Props) {
  return (
    <PublicProfileBody code={route.params.code} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bgDeep },
  stateWrap: { paddingHorizontal: space.lg },
  scrollContent: { paddingHorizontal: space.lg, paddingBottom: touchTarget + space.xxl },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: color.goldWash,
  },
  previewBannerText: { ...typeTokens.caption, color: color.textSecondary, flex: 1 },
  identityCard: { marginTop: space.lg },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.lg,
    backgroundColor: color.bgDeep,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  sheetText: { ...typeTokens.body, color: color.textSecondary, marginBottom: space.md },
  sheetButton: { marginTop: space.sm },
});
