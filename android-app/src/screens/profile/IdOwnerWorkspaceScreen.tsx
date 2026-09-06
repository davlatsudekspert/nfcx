import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import type { ProfileStackParamList } from '../../navigation/types';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { PremiumModal } from '../../design-system/components/PremiumModal';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { useToast } from '../../design-system/components/PremiumToast';
import { NfcIdCard } from '../../composites/NfcIdCard';
import { HeroStatChip } from '../../composites/HeroStatChip';
import { resolveMediaUrl } from '../../composites/mediaUrl';
import { PROFILE_TYPES, PROFILE_TYPE_LABEL, isProfileType, type ProfileType } from '../../composites/recordMeta';
import {
  buildRecordUpdateBody,
  normalizeExtraLinks,
  recordsApi,
  type FullNfcRecord,
  type RecordExtraLink,
} from '../../api/records';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
import { effectiveAccess, featureAllowed } from '../../lib/access';
import { tierForCode, TIER_LABEL } from '../../lib/pricing';
import { formatCount, formatDateTime } from '../../lib/format';
import { haptics } from '../../native/haptics';
import { pickAndUploadImage } from '../../native/imageUpload';
import { useT } from '../../i18n';
import { color, elevation, radius, space, touchTarget, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'IdOwnerWorkspace'>;

const MAX_EXTRA_LINKS = 20;
const ABOUT_MAX = 600;

interface Draft {
  name: string;
  role: string;
  about: string;
  city: string;
  profileType: ProfileType;
  avatarUrl: string;
  phone: string;
  email: string;
  website: string;
  tg: string;
  instagram: string;
  linkedin: string;
  musicUrl: string;
  hashtags: string;
  extraLinks: RecordExtraLink[];
  hidePhone: boolean;
  hiddenFromDirectory: boolean;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

function draftFromRecord(record: FullNfcRecord): Draft {
  return {
    name: str(record.name),
    role: str(record.role),
    about: str(record.about),
    city: str(record.city),
    profileType: isProfileType(record.profileType) ? record.profileType : 'personal',
    avatarUrl: str(record.avatarUrl),
    phone: str(record.phone),
    email: str(record.email),
    website: str(record.website),
    tg: str(record.tg),
    instagram: str(record.instagram),
    linkedin: str(record.linkedin),
    musicUrl: str(record.musicUrl),
    hashtags: (record.hashtags ?? []).map((h) => String(h).replace(/^#/, '')).filter(Boolean).join(', '),
    extraLinks: normalizeExtraLinks(record.extraLinks),
    hidePhone: record.hidePhone === true,
    hiddenFromDirectory: record.hiddenFromDirectory === true,
  };
}

/**
 * The per-ID owner workspace.
 *
 * This replaces the old ProfileEdit screen's hard-coded `cards[0]`, which
 * meant a multi-ID owner silently edited the wrong card. Everything here is
 * scoped to the `code` route param.
 *
 * Two backend contracts shape this screen and are worth stating plainly:
 *
 * 1. `PUT /api/records/:code` is a FULL REPLACE — the Worker rebuilds every
 *    profile column from the body. Saving therefore round-trips the loaded
 *    record through `buildRecordUpdateBody` and overrides only what the user
 *    edited; a naive partial PUT would blank every untouched field.
 * 2. `isPrimary` has NO write path — it is absent from `validateRecordBody`
 *    and from `updateRecord`'s column map, and there is no dedicated route.
 *    It is therefore shown as a read-only state with an honest explanation,
 *    not as a toggle that would silently do nothing.
 */
export function IdOwnerWorkspaceScreen({ route, navigation }: Props) {
  const { code } = route.params;
  const t = useT();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const cards = useAuthStore((s) => s.cards);
  const refreshAuth = useAuthStore((s) => s.refresh);

  const ownedCard = cards.find((c) => c.code === code);

  const record = useQuery({
    queryKey: ['records', code],
    queryFn: () => recordsApi.get(code),
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const leaveAction = useRef<(() => void) | null>(null);
  const loadedCode = useRef<string | null>(null);

  useEffect(() => {
    if (!record.data) return;
    if (loadedCode.current === code) return;
    const next = draftFromRecord(record.data);
    loadedCode.current = code;
    setDraft(next);
    setSaved(next);
  }, [record.data, code]);

  const dirty = useMemo(
    () => !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  const nameError = draft && draft.name.trim().length === 0 ? "Ism bo'sh bo'lishi mumkin emas." : null;
  const canSave = !!draft && !nameError && dirty;

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) throw new ApiError('unknown', 0);
      const body = buildRecordUpdateBody(record.data, {
        name: draft.name.trim(),
        role: draft.role.trim(),
        about: draft.about.trim().slice(0, ABOUT_MAX),
        city: draft.city.trim(),
        profileType: draft.profileType,
        avatarUrl: draft.avatarUrl.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        website: draft.website.trim(),
        tg: draft.tg.trim().replace(/^@/, ''),
        instagram: draft.instagram.trim().replace(/^@/, ''),
        linkedin: draft.linkedin.trim(),
        musicUrl: draft.musicUrl.trim(),
        hidePhone: draft.hidePhone,
        hiddenFromDirectory: draft.hiddenFromDirectory,
        hashtags: draft.hashtags
          .split(',')
          .map((h) => h.trim().replace(/^#/, ''))
          .filter(Boolean)
          .slice(0, 20),
        extraLinks: draft.extraLinks
          .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
          .filter((l) => l.url.length > 0)
          .slice(0, MAX_EXTRA_LINKS),
      });
      return recordsApi.update(code, body);
    },
    onSuccess: async (updated) => {
      const next = draftFromRecord(updated);
      setDraft(next);
      setSaved(next);
      setSaveError(null);
      haptics.success();
      queryClient.setQueryData(['records', code], updated);
      // The auth store's `cards` feed Home and "Mening ID'larim"; refreshing
      // it (plus invalidating the record query) is what makes the public
      // preview reflect the save immediately.
      await refreshAuth().catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['records', code] });
      toast.show(t('owner.saved'), 'success');
    },
    onError: (e) => {
      haptics.error();
      // A 422 from `validateRecordBody` carries a raw server string as its
      // code; never echo it — show the mapped field guidance instead.
      const message =
        e instanceof ApiError && e.status === 422
          ? "Ma'lumotlarni tekshiring."
          : e instanceof ApiError
            ? e.message
            : t('common.errorService');
      setSaveError(message);
    },
  });

  // One guard for every way out of this screen — header chevron, Android
  // hardware/gesture back, or a cross-screen dispatch. `bypassGuard` is what
  // lets the confirmed "Chiqish" through without the listener re-catching its
  // own re-dispatched action.
  const bypassGuard = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (bypassGuard.current || !dirty || save.isPending) return;
      e.preventDefault();
      leaveAction.current = () => {
        bypassGuard.current = true;
        navigation.dispatch(e.data.action);
      };
      setShowDiscard(true);
    });
    return unsubscribe;
  }, [navigation, dirty, save.isPending]);

  const onPickAvatar = async () => {
    setAvatarUploading(true);
    try {
      const result = await pickAndUploadImage();
      if (result.status === 'ok') {
        setDraft((d) => (d ? { ...d, avatarUrl: result.url } : d));
        toast.show('Rasm yuklandi. Saqlashni unutmang.', 'success');
      } else if (result.status === 'permission_denied') {
        toast.show('Galereyaga ruxsat berilmagan.', 'warning');
      } else if (result.status === 'error') {
        toast.show('Rasmni yuklab bo‘lmadi. Qayta urining.', 'danger');
      }
    } finally {
      setAvatarUploading(false);
    }
  };

  const goPreview = () => navigation.navigate('IdPublicPreview', { code });

  const tier = tierForCode(code);
  const access = effectiveAccess(
    { code, tierOverride: record.data?.tierOverride ?? ownedCard?.tierOverride ?? null },
    { isPremium: user?.isPremium },
  );
  const musicAllowed = featureAllowed('music', access);
  const isPrimary = record.data?.isPrimary === true || ownedCard?.isPrimary === true;

  const header = (
    <PremiumHeader
      title={t('owner.workspace')}
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      actions={record.data ? [{ icon: 'eye', accessibilityLabel: t('owner.publicPreview'), onPress: goPreview }] : []}
    />
  );

  if (!record.data || !draft) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        {header}
        <View style={styles.stateWrap}>
          <PremiumQueryState
            isLoading={record.isLoading}
            isError={record.isError}
            error={record.error}
            onRetry={() => record.refetch()}
            onUnauthorized={() => {
              void refreshAuth().catch(() => {});
            }}
            skeletonRows={3}
            skeletonHeight={120}
          />
        </View>
      </SafeAreaView>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {header}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: touchTarget + space.xxxl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Hero: which ID am I editing ----------
            The card itself, in its own metal — the same object the owner
            sees in the wallet and a visitor sees on an NFC tap. The numbers
            around it stay on the black floor so the card stays clean. */}
        <View style={styles.hero}>
          <NfcIdCard
            code={code}
            name={draft.name}
            state="owned"
            layout="hero"
            isPrimary={isPrimary}
            verified={record.data.verified === true}
            onPress={goPreview}
            accessibilityHint={t('owner.publicPreviewHint')}
          />

          <View style={styles.heroStats}>
            <HeroStatChip icon="eye" tone="blue" label={t('owner.views')} value={formatCount(record.data.views ?? 0)} />
            <HeroStatChip icon="award" tone="gold" label="Daraja" value={TIER_LABEL[tier]} small />
            <HeroStatChip icon="calendar" tone="amber" label="Yaratilgan" value={formatDateTime(record.data.ts)} small />
          </View>

          <PremiumButton label={t('owner.publicPreview')} onPress={goPreview} style={styles.heroCta} />
          <Text style={styles.heroHint}>{t('owner.publicPreviewHint')}</Text>
        </View>

        {/* ---------- a) Asosiy profil ---------- */}
        <SectionTitle icon="user" title={t('owner.profile')} />
        <PremiumCard>
          <View style={styles.avatarRow}>
            <Pressable
              onPress={avatarUploading ? undefined : onPickAvatar}
              disabled={avatarUploading}
              accessibilityRole="button"
              accessibilityLabel="Avatar rasmini almashtirish"
              accessibilityState={{ disabled: avatarUploading, busy: avatarUploading }}
              style={styles.avatarBox}
            >
              {resolveMediaUrl(draft.avatarUrl) ? (
                <Image source={{ uri: resolveMediaUrl(draft.avatarUrl) }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={28} color={color.textTertiary} />
              )}
              <View style={styles.avatarOverlay}>
                <Feather name={avatarUploading ? 'upload-cloud' : 'camera'} size={14} color={color.textOnGold} />
              </View>
            </Pressable>
            <View style={styles.avatarCopy}>
              <Text style={styles.avatarTitle}>Profil rasmi</Text>
              <Text style={styles.avatarHint}>
                {avatarUploading ? 'Yuklanmoqda...' : 'Rasm avtomatik siqiladi va serverga yuklanadi.'}
              </Text>
              {!!draft.avatarUrl && !avatarUploading && (
                <Pressable onPress={() => set('avatarUrl', '')} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.avatarRemove}>Rasmni olib tashlash</Text>
                </Pressable>
              )}
            </View>
          </View>

          <PremiumInput
            label="Ism *"
            value={draft.name}
            onChangeText={(v) => set('name', v)}
            error={nameError}
            maxLength={80}
          />
          <PremiumInput label="Rol / kasb" value={draft.role} onChangeText={(v) => set('role', v)} maxLength={100} />
          <PremiumInput
            label={`Bio (${draft.about.length}/${ABOUT_MAX})`}
            value={draft.about}
            onChangeText={(v) => set('about', v.slice(0, ABOUT_MAX))}
            multiline
            numberOfLines={4}
            style={styles.multiline}
            maxLength={ABOUT_MAX}
          />
          <PremiumInput label="Shahar" value={draft.city} onChangeText={(v) => set('city', v)} maxLength={60} />

          <Text style={styles.fieldLabel}>Profil turi</Text>
          <View style={styles.chipRow}>
            {PROFILE_TYPES.map((option) => {
              const active = draft.profileType === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    haptics.selection();
                    set('profileType', option);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{PROFILE_TYPE_LABEL[option]}</Text>
                </Pressable>
              );
            })}
          </View>

          <PremiumInput
            label="Hashtaglar (vergul bilan)"
            value={draft.hashtags}
            onChangeText={(v) => set('hashtags', v)}
            autoCapitalize="none"
          />

          <PremiumInput
            label={musicAllowed ? 'Musiqa havolasi' : 'Musiqa — Premium darajadan boshlab'}
            value={draft.musicUrl}
            onChangeText={(v) => set('musicUrl', v)}
            disabled={!musicAllowed}
            autoCapitalize="none"
            keyboardType="url"
          />
          {!musicAllowed && (
            <Text style={styles.gateNote}>
              Bu ID darajasi ({TIER_LABEL[tier]}) musiqa qo'shishga yetmaydi — Premium yoki undan yuqori kerak.
            </Text>
          )}
        </PremiumCard>

        {/* ---------- b) Kontaktlar ---------- */}
        <SectionTitle icon="phone" title={t('owner.contacts')} />
        <PremiumCard>
          <PremiumInput
            label="Telefon"
            value={draft.phone}
            onChangeText={(v) => set('phone', v)}
            keyboardType="phone-pad"
            maxLength={24}
          />
          <PremiumInput
            label="Email"
            value={draft.email}
            onChangeText={(v) => set('email', v)}
            autoCapitalize="none"
            keyboardType="email-address"
            maxLength={120}
          />
          <PremiumInput
            label="Veb-sayt"
            value={draft.website}
            onChangeText={(v) => set('website', v)}
            autoCapitalize="none"
            keyboardType="url"
          />
          <PremiumInput
            label="Telegram (@siz)"
            value={draft.tg}
            onChangeText={(v) => set('tg', v)}
            autoCapitalize="none"
            maxLength={40}
          />
          <PremiumInput
            label="Instagram (@siz)"
            value={draft.instagram}
            onChangeText={(v) => set('instagram', v)}
            autoCapitalize="none"
            maxLength={40}
          />
          <PremiumInput
            label="LinkedIn havolasi"
            value={draft.linkedin}
            onChangeText={(v) => set('linkedin', v)}
            autoCapitalize="none"
            keyboardType="url"
            maxLength={200}
          />

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>Qo'shimcha havolalar</Text>
          <Text style={styles.fieldHint}>
            Boshqa tarmoqlar uchun — nomi va havolasi profilda tugma bo'lib chiqadi.
          </Text>

          {draft.extraLinks.map((link, i) => (
            <View key={`extra-${i}`} style={styles.extraLinkRow}>
              <View style={styles.extraLinkFields}>
                <PremiumInput
                  label="Nomi"
                  value={link.label}
                  onChangeText={(v) =>
                    set('extraLinks', draft.extraLinks.map((l, idx) => (idx === i ? { ...l, label: v } : l)))
                  }
                  maxLength={40}
                />
                <PremiumInput
                  label="Havola"
                  value={link.url}
                  onChangeText={(v) =>
                    set('extraLinks', draft.extraLinks.map((l, idx) => (idx === i ? { ...l, url: v } : l)))
                  }
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              <Pressable
                onPress={() => set('extraLinks', draft.extraLinks.filter((_, idx) => idx !== i))}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}-havolani o'chirish`}
                style={styles.extraLinkRemove}
              >
                <Feather name="trash-2" size={18} color={color.danger} />
              </Pressable>
            </View>
          ))}

          <PremiumButton
            label="+ Havola qo'shish"
            variant="ghost"
            disabled={draft.extraLinks.length >= MAX_EXTRA_LINKS}
            onPress={() => set('extraLinks', [...draft.extraLinks, { label: '', url: '' }])}
          />
          {draft.extraLinks.length >= MAX_EXTRA_LINKS && (
            <Text style={styles.gateNote}>Maksimal {MAX_EXTRA_LINKS} ta havola qo'shish mumkin.</Text>
          )}
        </PremiumCard>

        {/* ---------- c) Ko'rinish ---------- */}
        <SectionTitle icon="eye-off" title={t('owner.visibility')} />
        <PremiumCard>
          <ToggleRow
            icon="phone-off"
            label={t('owner.hidePhone')}
            description="Yoqilsa, telefon raqamingiz ochiq profilda ko'rinmaydi."
            value={draft.hidePhone}
            onChange={(v) => set('hidePhone', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="compass"
            label="Katalogdan yashirish"
            description="Yoqilsa, profil ommaviy katalogda ko'rinmaydi. Havola va NFC orqali baribir ochiladi."
            value={draft.hiddenFromDirectory}
            onChange={(v) => set('hiddenFromDirectory', v)}
          />
          <View style={styles.divider} />

          {/* Read-only: the backend has no write path for `isPrimary`. */}
          <View style={styles.readonlyRow}>
            <Feather name={isPrimary ? 'star' : 'lock'} size={18} color={isPrimary ? color.gold : color.textTertiary} />
            <View style={styles.readonlyCopy}>
              <Text style={styles.toggleLabel}>{t('owner.primary')}</Text>
              <Text style={styles.toggleDescription}>
                {isPrimary
                  ? 'Bu sizning asosiy ID’ingiz — ro‘yxatlarda birinchi ko‘rsatiladi.'
                  : 'Asosiy ID’ni almashtirish hozircha ilovadan mumkin emas: serverda bu amal uchun endpoint yo‘q.'}
              </Text>
            </View>
            {isPrimary && <PremiumBadge label="ASOSIY" tone="gold" />}
          </View>
        </PremiumCard>

        {!!saveError && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={color.danger} />
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}
      </ScrollView>

      {/* ---------- Sticky save bar ---------- */}
      <View style={[styles.saveBar, { paddingBottom: space.lg + insets.bottom }]}>
        {dirty ? (
          <Text style={styles.saveHint}>Saqlanmagan o'zgarishlar bor.</Text>
        ) : (
          <Text style={styles.saveHintMuted}>Hammasi saqlangan.</Text>
        )}
        <PremiumButton
          label={t('common.save')}
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={!canSave || save.isPending}
        />
      </View>

      <PremiumModal
        visible={showDiscard}
        title="Saqlanmagan o'zgarishlar"
        onRequestClose={() => setShowDiscard(false)}
      >
        <Text style={styles.modalText}>Chiqsangiz o'zgarishlar yo'qoladi. Davom etamizmi?</Text>
        <PremiumButton
          label="Chiqish"
          variant="danger"
          onPress={() => {
            setShowDiscard(false);
            const proceed = leaveAction.current;
            leaveAction.current = null;
            proceed?.();
          }}
        />
        <PremiumButton
          label={t('common.cancel')}
          variant="ghost"
          onPress={() => setShowDiscard(false)}
          style={styles.modalSecondary}
        />
      </PremiumModal>
    </SafeAreaView>
  );
}

function SectionTitle({ icon, title }: { icon: React.ComponentProps<typeof Feather>['name']; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Feather name={icon} size={14} color={color.gold} />
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
    </View>
  );
}

interface ToggleRowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

/** Built from tokens rather than the platform `Switch` so the on-state is
 * the app's gold accent and the row keeps the 48dp touch target. */
function ToggleRow({ icon, label, description, value, onChange }: ToggleRowProps) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 140 });
  }, [value, progress]);

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * 20 }] }));

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={styles.toggleRow}
    >
      <Feather name={icon} size={18} color={value ? color.gold : color.textTertiary} />
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <Animated.View style={[styles.knob, value && styles.knobOn, knobStyle]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bgDeep },
  flex: { flex: 1 },
  stateWrap: { paddingHorizontal: space.lg },
  content: { paddingHorizontal: space.lg, gap: space.md },

  /** The hero card pads its own 3D stage by `space.xs`; pull that back so
   * its face spans the content width like every card below it. */
  hero: { marginTop: space.xs, marginHorizontal: -space.xs },
  heroStats: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, marginHorizontal: space.xs },
  heroCta: { marginTop: space.lg, marginHorizontal: space.xs },
  heroHint: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.sm, textAlign: 'center' },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.lg },
  sectionTitle: { ...typeTokens.overline, color: color.gold },

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.lg },
  avatarBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  avatarImage: { width: 70, height: 70, borderRadius: 35 },
  avatarOverlay: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: color.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.surface,
  },
  avatarCopy: { flex: 1, gap: 2 },
  avatarTitle: { ...typeTokens.bodyStrong, color: color.textPrimary },
  avatarHint: { ...typeTokens.caption, color: color.textTertiary },
  avatarRemove: { ...typeTokens.caption, color: color.danger, marginTop: space.xs },

  multiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  fieldLabel: { ...typeTokens.caption, color: color.textSecondary, marginBottom: space.xs },
  fieldHint: { ...typeTokens.caption, color: color.textTertiary, marginBottom: space.md },
  gateNote: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.xs },

  chipRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  chip: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  chipActive: { borderColor: color.borderGoldStrong, backgroundColor: color.goldMuted },
  chipText: { ...typeTokens.caption, color: color.textSecondary },
  chipTextActive: { color: color.gold, fontWeight: '700' },

  divider: { height: 1, backgroundColor: color.border, marginVertical: space.md },
  extraLinkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  extraLinkFields: { flex: 1 },
  extraLinkRemove: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touchTarget, paddingVertical: space.xs },
  toggleCopy: { flex: 1 },
  toggleLabel: { ...typeTokens.bodyStrong, color: color.textPrimary },
  toggleDescription: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },
  track: {
    width: 46,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceHigh,
    borderWidth: 1,
    borderColor: color.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  trackOn: { backgroundColor: color.goldMuted, borderColor: color.borderGoldStrong },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: color.textTertiary },
  knobOn: { backgroundColor: color.gold },

  readonlyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touchTarget },
  readonlyCopy: { flex: 1 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.danger,
    backgroundColor: color.surfaceSunken,
  },
  errorText: { ...typeTokens.caption, color: color.danger, flex: 1 },

  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: color.bgDeep,
    borderTopWidth: 1,
    borderTopColor: color.border,
    gap: space.sm,
    ...elevation.raised,
  },
  saveHint: { ...typeTokens.caption, color: color.gold, textAlign: 'center' },
  saveHintMuted: { ...typeTokens.caption, color: color.textTertiary, textAlign: 'center' },

  modalText: { ...typeTokens.body, color: color.textSecondary, marginBottom: space.lg },
  modalSecondary: { marginTop: space.sm },
});
