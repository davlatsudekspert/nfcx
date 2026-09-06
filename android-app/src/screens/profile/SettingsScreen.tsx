import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import type { ProfileStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumListRow } from '../../design-system/components/PremiumListRow';
import { PremiumSheet } from '../../design-system/components/PremiumSheet';
import { PremiumModal } from '../../design-system/components/PremiumModal';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { useToast } from '../../design-system/components/PremiumToast';
import { useAuthStore } from '../../state/authStore';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { useAppLockStore } from '../../native/appLock';
import { authenticateWithBiometrics, getBiometricSupport, type BiometricSupport } from '../../native/biometrics';
import { getPushReadiness, requestNotificationPermission, type PushReadiness } from '../../native/push';
import { LOCALE_LABEL, useLocale, useLocaleStore, useT, type LocaleCode } from '../../i18n';
import { formatCount, safeText } from '../../lib/format';
import { useProfileCopy, profileText, type ProfileCopyKey } from './profileCopy';
import { color, elevation, radius, space, touchTarget, type as typeTokens, font } from '../../design-system/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

/** Real, published support channels (src/pages/ContactPage.jsx) — nothing invented. */
const SUPPORT_CHANNELS: Array<{
  key: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  labelKey: ProfileCopyKey;
  value: string;
  url: string;
}> = [
  { key: 'telegram', icon: 'send', labelKey: 'supportTelegram', value: '@nfcstore_admin', url: 'https://t.me/nfcstore_admin' },
  { key: 'email', icon: 'mail', labelKey: 'supportEmail', value: 'support@nfcstore.uz', url: 'mailto:support@nfcstore.uz' },
  { key: 'phone', icon: 'phone', labelKey: 'supportPhone', value: '+998 50 090 82 77', url: 'tel:+998500908277' },
];

const LOCALES: LocaleCode[] = ['uz', 'ru', 'en'];

type ExplainerKind = 'push' | 'biometric' | 'payments' | null;

/**
 * The account hub: who you are signed in as, what language the app speaks,
 * what the security and payment state actually is right now, and how to get
 * out. Every row either navigates somewhere real or opens an explanation —
 * there are no decorative dead rows, and no state is faked (payments come
 * from the server flag, biometrics from the real sensor probe, push from the
 * real OS permission plus the honest "no delivery backend" fact).
 */
export function SettingsScreen({ navigation }: Props) {
  const t = useT();
  const c = useProfileCopy();
  const locale = useLocale();
  const toast = useToast();

  const user = useAuthStore((s) => s.user);
  const cards = useAuthStore((s) => s.cards);
  const logout = useAuthStore((s) => s.logout);

  const paymentsStatus = usePaymentsEnabledStore((s) => s.status);
  const refreshPayments = usePaymentsEnabledStore((s) => s.refresh);

  const lockEnabled = useAppLockStore((s) => s.enabled);
  const lockHydrated = useAppLockStore((s) => s.hydrated);
  const lockUnlocked = useAppLockStore((s) => s.unlocked);

  const [biometrics, setBiometrics] = useState<BiometricSupport | null>(null);
  const [push, setPush] = useState<PushReadiness | null>(null);
  const [explainer, setExplainer] = useState<ExplainerKind>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [busyLock, setBusyLock] = useState(false);
  const languageSheet = useRef<BottomSheet>(null);
  const promptedRef = useRef(false);

  useEffect(() => {
    useAppLockStore.getState().hydrate();
    let active = true;
    getBiometricSupport().then((support) => {
      if (active) setBiometrics(support);
    });
    getPushReadiness().then((readiness) => {
      if (active) setPush(readiness);
    });
    return () => {
      active = false;
    };
  }, []);

  const runUnlock = useCallback(async () => {
    setUnlocking(true);
    try {
      const ok = await authenticateWithBiometrics(c('biometricPrompt'));
      if (ok) useAppLockStore.getState().markUnlocked();
      else toast.show(c('biometricFailed'), 'warning');
    } finally {
      setUnlocking(false);
    }
  }, [c, toast]);

  const locked = lockHydrated && lockEnabled && !lockUnlocked;

  useEffect(() => {
    if (locked && !promptedRef.current) {
      promptedRef.current = true;
      runUnlock();
    }
  }, [locked, runUnlock]);

  const onConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      // No explicit navigation: RootNavigator swaps to the Auth flow as soon
      // as authStore.status becomes 'guest'.
    } catch {
      toast.show(c('logoutFailed'), 'danger');
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  const onPickLocale = async (next: LocaleCode) => {
    languageSheet.current?.close();
    if (next === locale) return;
    await useLocaleStore.getState().setLocale(next);
    toast.show(profileText('languageChanged', next), 'success');
  };

  const onToggleLock = async (nextEnabled: boolean) => {
    if (biometrics?.capability !== 'available') return;
    setBusyLock(true);
    try {
      const ok = await authenticateWithBiometrics(c('biometricPrompt'));
      if (!ok) {
        toast.show(c('biometricFailed'), 'warning');
        return;
      }
      await useAppLockStore.getState().setEnabled(nextEnabled);
      setExplainer(null);
    } finally {
      setBusyLock(false);
    }
  };

  const onRequestPush = async () => {
    const granted = await requestNotificationPermission();
    const readiness = await getPushReadiness();
    setPush(readiness);
    if (!granted) toast.show(c('pushDeniedHint'), 'warning');
  };

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      toast.show(c('supportOpenFailed'), 'danger');
    }
  };

  const appVersion = safeText(Constants.expoConfig?.version, '1.0.0');

  if (locked) {
    return (
      <ScreenWithHeader title={t('profile.settings')} onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
        <View style={styles.lockedWrap}>
          <View style={styles.lockedIcon}>
            <Feather name="lock" size={28} color={color.gold} />
          </View>
          <Text style={styles.lockedTitle}>{c('lockedTitle')}</Text>
          <Text style={styles.lockedBody}>{c('lockedBody')}</Text>
          <PremiumButton label={c('unlock')} onPress={runUnlock} loading={unlocking} style={styles.lockedButton} />
        </View>
      </ScreenWithHeader>
    );
  }

  return (
    <ScreenWithHeader title={t('profile.settings')} onBack={navigation.canGoBack() ? navigation.goBack : undefined} scroll={false}>
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Account hero */}
        {user ? (
          <PremiumCard variant="featured" contentStyle={styles.heroContent}>
            <View style={styles.heroRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{initialOf(user.email)}</Text>
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroEmail} numberOfLines={1}>
                  {safeText(user.email, c('accountEmailMissing'))}
                </Text>
                <Text style={styles.heroMeta} numberOfLines={1}>
                  {formatCount(cards.length)} {c('accountIdCount')}
                </Text>
              </View>
              <PremiumBadge
                label={user.isPremium ? c('accountPremium') : c('accountStandard')}
                tone={user.isPremium ? 'gold' : 'neutral'}
              />
            </View>
            <Text style={styles.heroHint}>{c('settingsSubtitle')}</Text>
          </PremiumCard>
        ) : (
          <PremiumCard variant="sunken" contentStyle={styles.heroContent}>
            <Text style={styles.heroEmail}>{c('accountGuest')}</Text>
            <Text style={styles.heroHint}>{c('accountGuestHint')}</Text>
            {/* Defensive branch (the stack is auth-gated, so `user` is
                normally set): clearing the session drops straight into the
                Auth flow via RootNavigator — a real route, not a dead button. */}
            <PremiumButton label={c('accountLogin')} onPress={() => logout()} style={styles.guestButton} />
          </PremiumCard>
        )}

        <Section title={c('sectionAccount')}>
          <PremiumListRow icon="user" label={c('rowProfileEdit')} onPress={() => navigation.navigate('ProfileEdit')} />
          <Divider />
          <PremiumListRow icon="hash" label={c('rowMyIds')} value={formatCount(cards.length)} onPress={() => navigation.navigate('MyProfile')} />
          <Divider />
          <PremiumListRow
            icon="credit-card"
            label={c('paymentsRow')}
            value={paymentsLabel(paymentsStatus, c)}
            onPress={() => setExplainer('payments')}
          />
        </Section>

        <Section title={c('sectionApp')}>
          <PremiumListRow
            icon="globe"
            label={t('profile.language')}
            value={LOCALE_LABEL[locale]}
            onPress={() => languageSheet.current?.snapToIndex(0)}
          />
          <Divider />
          <PremiumListRow
            icon="bell"
            label={t('profile.notifications')}
            value={c('rowNotificationsHint')}
            onPress={() => navigation.navigate('Notifications')}
          />
          <Divider />
          <PremiumListRow icon="send" label={c('pushRow')} value={pushLabel(push, c)} onPress={() => setExplainer('push')} />
          <Divider />
          <PremiumListRow icon="radio" label={c('rowNfc')} value={c('rowNfcHint')} onPress={() => navigation.navigate('NfcRead')} />
        </Section>

        <Section title={c('sectionSecurity')}>
          <PremiumListRow
            icon={biometrics?.hasFace && !biometrics?.hasFingerprint ? 'smile' : 'lock'}
            label={c('biometricRow')}
            value={biometricLabel(biometrics, lockEnabled, c)}
            onPress={() => setExplainer('biometric')}
          />
        </Section>

        <Section title={c('sectionSupport')}>
          {SUPPORT_CHANNELS.map((channel, index) => (
            <React.Fragment key={channel.key}>
              {index > 0 && <Divider />}
              <PremiumListRow
                icon={channel.icon}
                label={c(channel.labelKey)}
                value={channel.value}
                onPress={() => openUrl(channel.url)}
              />
            </React.Fragment>
          ))}
        </Section>

        <Section title={c('sectionAbout')}>
          <PremiumListRow icon="info" label={c('versionRow')} value={appVersion} showChevron={false} />
        </Section>

        <View style={styles.logoutWrap}>
          <PremiumListRow icon="log-out" label={t('profile.logout')} destructive showChevron={false} onPress={() => setConfirmLogout(true)} />
        </View>
      </ScrollView>

      {/* Language picker */}
      <PremiumSheet ref={languageSheet} title={c('languageSheetTitle')} snapPoints={['42%']}>
        <View style={styles.localeList}>
          {LOCALES.map((code) => {
            const active = code === locale;
            return (
              <Pressable
                key={code}
                onPress={() => onPickLocale(code)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.localeRow, active && styles.localeRowActive]}
              >
                <Text style={[styles.localeLabel, active && styles.localeLabelActive]}>{LOCALE_LABEL[code]}</Text>
                {active && <Feather name="check" size={18} color={color.gold} />}
              </Pressable>
            );
          })}
        </View>
      </PremiumSheet>

      {/* Explainers — every non-navigating row opens one, so no row is dead. */}
      <PremiumModal visible={explainer === 'payments'} title={c('paymentsSheetTitle')} onRequestClose={() => setExplainer(null)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            {paymentsStatus === 'enabled' ? c('paymentsOpenBody') : paymentsStatus === 'disabled' ? c('paymentsClosedBody') : c('paymentsUnknown')}
          </Text>
          <PremiumButton label={c('paymentsRecheck')} variant="ghost" onPress={() => refreshPayments()} />
          <PremiumButton label={t('common.close')} variant="ghost" onPress={() => setExplainer(null)} />
        </View>
      </PremiumModal>

      <PremiumModal visible={explainer === 'push'} title={c('pushSheetTitle')} onRequestClose={() => setExplainer(null)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>{c('pushSheetBody')}</Text>
          <Text style={styles.modalMeta}>
            {c('pushRow')}: {pushLabel(push, c)}
          </Text>
          {push?.permission === 'undetermined' && <PremiumButton label={c('pushRequest')} onPress={onRequestPush} />}
          {push?.permission === 'denied' && <Text style={styles.modalMeta}>{c('pushDeniedHint')}</Text>}
          <PremiumButton label={t('common.close')} variant="ghost" onPress={() => setExplainer(null)} />
        </View>
      </PremiumModal>

      <PremiumModal visible={explainer === 'biometric'} title={c('biometricSheetTitle')} onRequestClose={() => setExplainer(null)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>{c('biometricSheetBody')}</Text>
          {biometrics?.capability === 'available' ? (
            <PremiumButton
              label={lockEnabled ? c('biometricDisable') : c('biometricEnable')}
              variant={lockEnabled ? 'danger' : 'filled'}
              loading={busyLock}
              onPress={() => onToggleLock(!lockEnabled)}
            />
          ) : (
            <Text style={styles.modalMeta}>
              {biometrics?.capability === 'not_enrolled' ? c('biometricNotEnrolledHint') : c('biometricUnavailable')}
            </Text>
          )}
          <PremiumButton label={t('common.close')} variant="ghost" onPress={() => setExplainer(null)} />
        </View>
      </PremiumModal>

      <PremiumModal visible={confirmLogout} title={c('logoutConfirmTitle')} onRequestClose={() => setConfirmLogout(false)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>{c('logoutConfirmBody')}</Text>
          <PremiumButton label={c('logoutConfirm')} variant="danger" onPress={onConfirmLogout} loading={loggingOut} />
          <PremiumButton label={t('common.cancel')} variant="ghost" onPress={() => setConfirmLogout(false)} disabled={loggingOut} />
        </View>
      </PremiumModal>
    </ScreenWithHeader>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <PremiumCard variant="default" animate={false} contentStyle={styles.sectionCard}>
        {children}
      </PremiumCard>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function initialOf(email: unknown): string {
  const text = typeof email === 'string' ? email.trim() : '';
  return text ? text.charAt(0).toUpperCase() : '?';
}

function paymentsLabel(status: 'unknown' | 'enabled' | 'disabled', c: (key: 'paymentsOpen' | 'paymentsClosed' | 'paymentsUnknown') => string): string {
  if (status === 'enabled') return c('paymentsOpen');
  if (status === 'disabled') return c('paymentsClosed');
  return c('paymentsUnknown');
}

function pushLabel(
  push: PushReadiness | null,
  c: (key: 'pushBackendMissing' | 'pushGranted' | 'pushDenied' | 'pushUndetermined' | 'pushUnavailable') => string,
): string {
  if (!push) return '…';
  if (push.permission === 'unavailable') return c('pushUnavailable');
  // Permission alone would overstate things: nothing can arrive while no
  // server can send. The row says that plainly.
  if (push.permission === 'granted') return c('pushBackendMissing');
  if (push.permission === 'denied') return c('pushDenied');
  return c('pushUndetermined');
}

function biometricLabel(
  support: BiometricSupport | null,
  enabled: boolean,
  c: (key: 'biometricOn' | 'biometricOff' | 'biometricUnavailable' | 'biometricNotEnrolled') => string,
): string {
  if (!support) return '…';
  if (support.capability === 'unavailable') return c('biometricUnavailable');
  if (support.capability === 'not_enrolled') return c('biometricNotEnrolled');
  return enabled ? c('biometricOn') : c('biometricOff');
}

const styles = StyleSheet.create({
  scrollBody: { paddingBottom: space.xxl, gap: space.lg },
  heroContent: { padding: space.lg, gap: space.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.goldMuted,
    borderWidth: 1,
    borderColor: color.borderGold,
  },
  avatarLetter: { ...typeTokens.h2, color: color.gold },
  heroTextWrap: { flex: 1, gap: 2 },
  heroEmail: { ...typeTokens.h3, color: color.textPrimary },
  heroMeta: { ...typeTokens.caption, color: color.textSecondary },
  heroHint: { ...typeTokens.caption, color: color.textTertiary },
  guestButton: { marginTop: space.sm },
  section: { gap: space.sm },
  sectionTitle: { ...typeTokens.overline, color: color.textTertiary, paddingHorizontal: space.xs },
  sectionCard: { paddingVertical: space.xs, paddingHorizontal: space.xs },
  divider: { height: 1, backgroundColor: color.border, marginLeft: space.xl + space.sm },
  logoutWrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingVertical: space.xs,
  },
  localeList: { gap: space.xs },
  localeRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  localeRowActive: { backgroundColor: color.goldWash, borderColor: color.borderGold },
  localeLabel: { ...typeTokens.body, color: color.textPrimary },
  localeLabelActive: { color: color.gold, fontFamily: font.sansSemi },
  modalBody: { gap: space.sm },
  modalText: { ...typeTokens.body, color: color.textSecondary },
  modalMeta: { ...typeTokens.caption, color: color.textTertiary },
  lockedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.xl },
  lockedIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.goldMuted,
    borderWidth: 1,
    borderColor: color.borderGold,
    marginBottom: space.md,
    ...elevation.gold,
  },
  lockedTitle: { ...typeTokens.h1, color: color.textPrimary, textAlign: 'center' },
  lockedBody: { ...typeTokens.body, color: color.textSecondary, textAlign: 'center' },
  lockedButton: { marginTop: space.lg, width: '100%' },
});
