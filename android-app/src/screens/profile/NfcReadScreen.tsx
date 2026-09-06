import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View, type AppStateStatus } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import type BottomSheet from '@gorhom/bottom-sheet';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { ProfileStackParamList, MainTabParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { PremiumTab } from '../../design-system/components/PremiumTab';
import { PremiumSheet } from '../../design-system/components/PremiumSheet';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { useToast } from '../../design-system/components/PremiumToast';
import {
  getNfcHardwareState,
  openNfcSettings,
  readNfcTag,
  stopNfc,
  writeProfileUrlToTag,
  NFC_PROFILE_ORIGIN,
  type NfcHardwareState,
} from '../../native/nfc';
import { contentApi } from '../../api/content';
import { useAuthStore } from '../../state/authStore';
import { haptics } from '../../native/haptics';
import { safeText } from '../../lib/format';
import { useT } from '../../i18n';
import { useProfileCopy, fill } from './profileCopy';
import { color, elevation, radius, space, touchTarget, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'NfcRead'>;

type Mode = 'read' | 'write';
type ReadPhase = 'idle' | 'scanning' | 'checking' | 'success' | 'tagUnsupported' | 'failed';
type WritePhase = 'idle' | 'writing' | 'success' | 'tagUnsupported' | 'failed';

/**
 * Real NFC, every state visible.
 *
 * READ  — foreground-dispatch NDEF read (src/native/nfc.ts) of a physical
 *         NFCSTORE card, whose tag holds `https://nfcstore.uz/<CODE>?t=<token>`;
 *         the token is validated against the real `GET /api/tap/:chipToken`
 *         (android/docs/02-API_MAP.md §2.7) before the profile opens.
 * WRITE — writes this account's own public profile URL to a blank/rewritable
 *         tag. It never fabricates a chip token — those are server-issued.
 *
 * Hardware state is probed for real (`isSupported`/`isEnabled`) on mount, on
 * focus and on every foreground, so toggling NFC in Android settings is
 * reflected without restarting the app. On a device or emulator without NFC
 * the screen degrades to an honest, non-crashing explanation.
 */
export function NfcReadScreen({ navigation }: Props) {
  const t = useT();
  const c = useProfileCopy();
  const toast = useToast();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const cards = useAuthStore((s) => s.cards);

  const [hardware, setHardware] = useState<NfcHardwareState>('unknown');
  const [mode, setMode] = useState<Mode>('read');
  const [readPhase, setReadPhase] = useState<ReadPhase>('idle');
  const [readMessage, setReadMessage] = useState<string | null>(null);
  const [writePhase, setWritePhase] = useState<WritePhase>('idle');
  const [writeMessage, setWriteMessage] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const cardSheet = useRef<BottomSheet>(null);

  const probeHardware = useCallback(async () => {
    setHardware(await getNfcHardwareState());
  }, []);

  // Re-probe whenever the app comes back to the foreground — the usual way a
  // user turns NFC on is to leave for Android settings and come back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') probeHardware();
    });
    return () => sub.remove();
  }, [probeHardware]);

  // Probes on mount and on every focus, and cancels any in-flight technology
  // request when the screen loses focus, so a pending scan never leaks into
  // another screen.
  useFocusEffect(
    useCallback(() => {
      probeHardware();
      return () => {
        stopNfc();
      };
    }, [probeHardware]),
  );

  const activeCode = selectedCode ?? cards.find((card) => card.isPrimary)?.code ?? cards[0]?.code ?? null;

  const openProfile = useCallback(
    (code: string) => {
      tabNavigation?.navigate('HomeTab', { screen: 'PublicProfile', params: { code } });
    },
    [tabNavigation],
  );

  const tapCheck = useMutation({
    mutationFn: ({ chipToken }: { chipToken: string; fallbackCode: string | null }) => contentApi.tap(chipToken),
    onSuccess: (result, variables) => {
      const target = result.linkedCode ?? variables.fallbackCode;
      if (!result.active) {
        haptics.warning();
        setReadPhase('failed');
        setReadMessage(c('nfcCardInactive'));
        return;
      }
      if (!target) {
        haptics.warning();
        setReadPhase('failed');
        setReadMessage(c('nfcCardNotLinked'));
        return;
      }
      haptics.success();
      setReadPhase('success');
      setReadMessage(fill(c('nfcSuccessBody'), { code: safeText(target, '—') }));
      openProfile(target);
    },
    onError: () => {
      haptics.error();
      setReadPhase('failed');
      setReadMessage(t('common.error'));
    },
  });

  const startScan = async () => {
    setReadMessage(null);
    setReadPhase('scanning');
    const result = await readNfcTag();

    switch (result.status) {
      case 'ok': {
        if (result.chipToken) {
          setReadPhase('checking');
          tapCheck.mutate({ chipToken: result.chipToken, fallbackCode: result.payload.code });
          return;
        }
        if (result.payload.code) {
          haptics.success();
          setReadPhase('success');
          setReadMessage(fill(c('nfcSuccessBody'), { code: result.payload.code }));
          openProfile(result.payload.code);
          return;
        }
        setReadPhase('tagUnsupported');
        setReadMessage(c('nfcTagUnsupportedBody'));
        return;
      }
      case 'unsupported':
        setHardware('unsupported');
        setReadPhase('idle');
        return;
      case 'disabled':
        setHardware('disabled');
        setReadPhase('idle');
        return;
      case 'cancelled':
        setReadPhase('idle');
        toast.show(c('nfcCancelled'), 'info');
        return;
      case 'tag_unsupported':
        haptics.warning();
        setReadPhase('tagUnsupported');
        setReadMessage(c('nfcTagUnsupportedBody'));
        return;
      default:
        haptics.error();
        setReadPhase('failed');
        setReadMessage(c('nfcReadFailed'));
    }
  };

  const startWrite = async () => {
    if (!activeCode) return;
    setWriteMessage(null);
    setWritePhase('writing');
    const result = await writeProfileUrlToTag(activeCode);

    switch (result.status) {
      case 'ok':
        haptics.success();
        setWritePhase('success');
        setWriteMessage(fill(c('nfcWriteSuccessBody'), { url: result.url }));
        toast.show(t('nfc.writeSuccess'), 'success');
        return;
      case 'unsupported':
        setHardware('unsupported');
        setWritePhase('idle');
        return;
      case 'disabled':
        setHardware('disabled');
        setWritePhase('idle');
        return;
      case 'cancelled':
        setWritePhase('idle');
        toast.show(c('nfcCancelled'), 'info');
        return;
      case 'tag_unsupported':
        haptics.warning();
        setWritePhase('tagUnsupported');
        setWriteMessage(c('nfcWriteTagUnsupported'));
        return;
      default:
        haptics.error();
        setWritePhase('failed');
        setWriteMessage(t('nfc.writeFailed'));
    }
  };

  const onOpenSettings = async () => {
    const opened = await openNfcSettings();
    if (!opened) toast.show(c('nfcSettingsFailed'), 'warning');
  };

  const scanning = readPhase === 'scanning' || readPhase === 'checking' || writePhase === 'writing';

  /* ---- Hardware-level states: no tabs, no dead controls ---- */
  if (hardware === 'unsupported') {
    return (
      <ScreenWithHeader title={t('nfc.title')} onBack={navigation.goBack}>
        <HardwarePill state={hardware} c={c} />
        <PremiumEmptyState
          icon="wifi-off"
          title={t('nfc.unsupported')}
          description={c('nfcUnsupportedBody')}
          ctaLabel={t('profile.myIds')}
          onPressCta={() => navigation.navigate('MyProfile')}
        />
      </ScreenWithHeader>
    );
  }

  if (hardware === 'disabled') {
    return (
      <ScreenWithHeader title={t('nfc.title')} onBack={navigation.goBack}>
        <HardwarePill state={hardware} c={c} />
        <PremiumCard variant="featured" contentStyle={styles.stateCard}>
          <View style={styles.stateIcon}>
            <Feather name="power" size={24} color={color.warning} />
          </View>
          <Text style={styles.stateTitle}>{t('nfc.disabled')}</Text>
          <Text style={styles.stateBody}>{c('nfcDisabledBody')}</Text>
          <PremiumButton label={t('nfc.openSettings')} onPress={onOpenSettings} />
          <PremiumButton label={c('nfcRetry')} variant="ghost" onPress={probeHardware} />
        </PremiumCard>
      </ScreenWithHeader>
    );
  }

  return (
    <ScreenWithHeader title={t('nfc.title')} onBack={navigation.goBack} scroll={false}>
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <HardwarePill state={hardware} c={c} />

        <PremiumTab
          items={[
            { key: 'read', label: c('nfcTabRead') },
            { key: 'write', label: c('nfcTabWrite') },
          ]}
          activeKey={mode}
          onChange={(key) => {
            if (scanning) return;
            setMode(key === 'write' ? 'write' : 'read');
          }}
        />

        {mode === 'read' ? (
          <View style={styles.pane}>
            <NfcRipple scanning={readPhase === 'scanning'} tone={readPhase === 'failed' ? 'danger' : 'gold'} />

            <Text style={styles.title}>{readTitle(readPhase, t, c)}</Text>
            <Text style={styles.subtitle}>{c('nfcReadIntro')}</Text>

            {!!readMessage && (
              <Text style={[styles.message, readPhase === 'success' && styles.messageSuccess]}>{readMessage}</Text>
            )}

            <PremiumButton
              label={readPhase === 'scanning' ? t('nfc.scanning') : readPhase === 'idle' ? c('nfcStartScan') : c('nfcRetry')}
              onPress={startScan}
              loading={readPhase === 'scanning' || readPhase === 'checking'}
              style={styles.primaryButton}
            />
          </View>
        ) : (
          <View style={styles.pane}>
            {cards.length === 0 ? (
              <PremiumEmptyState
                icon="hash"
                title={c('nfcWriteNoCards')}
                description={t('home.emptyIdsHint')}
                ctaLabel={t('home.chooseId')}
                onPressCta={() => tabNavigation?.navigate('IdTab', { screen: 'IdSearch' })}
              />
            ) : (
              <>
                <NfcRipple scanning={writePhase === 'writing'} tone={writePhase === 'failed' ? 'danger' : 'gold'} />

                <Text style={styles.title}>{writeTitle(writePhase, t, c)}</Text>
                <Text style={styles.subtitle}>{c('nfcWriteIntro')}</Text>

                <Pressable
                  onPress={() => cards.length > 1 && cardSheet.current?.snapToIndex(0)}
                  accessibilityRole={cards.length > 1 ? 'button' : undefined}
                  style={styles.codeRow}
                >
                  <View style={styles.codeTextWrap}>
                    <Text style={styles.codeLabel}>{c('nfcWritePick')}</Text>
                    <Text style={styles.codeValue} numberOfLines={1}>
                      {NFC_PROFILE_ORIGIN.replace('https://', '')}/{safeText(activeCode, '—')}
                    </Text>
                  </View>
                  {cards.length > 1 && <Feather name="chevron-down" size={18} color={color.textTertiary} />}
                </Pressable>

                {!!writeMessage && (
                  <Text style={[styles.message, writePhase === 'success' && styles.messageSuccess]}>{writeMessage}</Text>
                )}

                <PremiumButton
                  label={
                    writePhase === 'writing'
                      ? c('nfcWriteWaiting')
                      : writePhase === 'success'
                        ? c('nfcWriteAgain')
                        : writePhase === 'idle'
                          ? c('nfcWriteStart')
                          : c('nfcRetry')
                  }
                  onPress={startWrite}
                  loading={writePhase === 'writing'}
                  disabled={!activeCode}
                  style={styles.primaryButton}
                />

                <View style={styles.noteRow}>
                  <Feather name="info" size={14} color={color.textTertiary} />
                  <Text style={styles.noteText}>{c('nfcWriteNote')}</Text>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>

      <PremiumSheet ref={cardSheet} title={c('nfcWritePickTitle')} snapPoints={['45%', '75%']}>
        <View style={styles.sheetList}>
          {cards.map((card) => {
            const active = card.code === activeCode;
            return (
              <Pressable
                key={card.code}
                onPress={() => {
                  setSelectedCode(card.code);
                  setWritePhase('idle');
                  setWriteMessage(null);
                  cardSheet.current?.close();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.sheetRow, active && styles.sheetRowActive]}
              >
                <View style={styles.sheetTextWrap}>
                  <Text style={[styles.sheetCode, active && styles.sheetCodeActive]}>{safeText(card.code, '—')}</Text>
                  <Text style={styles.sheetName} numberOfLines={1}>
                    {safeText(card.name, '—')}
                  </Text>
                </View>
                {active && <Feather name="check" size={18} color={color.gold} />}
              </Pressable>
            );
          })}
        </View>
      </PremiumSheet>
    </ScreenWithHeader>
  );
}

function readTitle(phase: ReadPhase, t: (key: 'nfc.ready' | 'nfc.scanning' | 'nfc.tagUnsupported') => string, c: (key: 'nfcCheckPending' | 'nfcSuccessTitle' | 'nfcReadFailed') => string): string {
  switch (phase) {
    case 'scanning':
      return t('nfc.scanning');
    case 'checking':
      return c('nfcCheckPending');
    case 'success':
      return c('nfcSuccessTitle');
    case 'tagUnsupported':
      return t('nfc.tagUnsupported');
    case 'failed':
      return c('nfcReadFailed');
    default:
      return t('nfc.ready');
  }
}

function writeTitle(phase: WritePhase, t: (key: 'nfc.write' | 'nfc.writeSuccess' | 'nfc.writeFailed') => string, c: (key: 'nfcWriteWaiting' | 'nfcWriteTagUnsupported') => string): string {
  switch (phase) {
    case 'writing':
      return c('nfcWriteWaiting');
    case 'success':
      return t('nfc.writeSuccess');
    case 'tagUnsupported':
      return c('nfcWriteTagUnsupported');
    case 'failed':
      return t('nfc.writeFailed');
    default:
      return t('nfc.write');
  }
}

function HardwarePill({
  state,
  c,
}: {
  state: NfcHardwareState;
  c: (key: 'nfcHardwareReady' | 'nfcHardwareDisabled' | 'nfcHardwareUnsupported') => string;
}) {
  if (state === 'unknown') return null;
  const label =
    state === 'ready' ? c('nfcHardwareReady') : state === 'disabled' ? c('nfcHardwareDisabled') : c('nfcHardwareUnsupported');
  return (
    <View style={styles.pillRow}>
      <PremiumBadge label={label} tone={state === 'ready' ? 'success' : state === 'disabled' ? 'warning' : 'neutral'} />
    </View>
  );
}

function NfcRipple({ scanning, tone }: { scanning: boolean; tone: 'gold' | 'danger' }) {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ringColor = tone === 'danger' ? color.danger : color.gold;

  useEffect(() => {
    if (!scanning) {
      ring1.value = 0;
      ring2.value = 0;
      return;
    }
    ring1.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    ring2.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [scanning, ring1, ring2]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ring1.value * 1.6 }],
    opacity: (1 - ring1.value) * 0.5,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    // Offset the second ring by starting its progress half a cycle behind
    // ring1's, so the two ripples don't pulse in lockstep.
    transform: [{ scale: 1 + ((ring2.value + 0.5) % 1) * 1.6 }],
    opacity: (1 - ((ring2.value + 0.5) % 1)) * 0.5,
  }));

  return (
    <View style={styles.rippleWrapper}>
      {scanning && <Animated.View style={[styles.ring, { borderColor: ringColor }, ring1Style]} />}
      {scanning && <Animated.View style={[styles.ring, { borderColor: ringColor }, ring2Style]} />}
      <View style={[styles.rippleCore, scanning && styles.rippleCoreActive]}>
        <Feather name="wifi" size={40} color={scanning ? color.gold : color.textTertiary} style={styles.rippleIcon} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollBody: { paddingBottom: space.xxl, gap: space.lg },
  pillRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  pane: { alignItems: 'center', gap: space.sm, paddingTop: space.xl },
  rippleWrapper: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  ring: { position: 'absolute', width: 108, height: 108, borderRadius: 54, borderWidth: 2 },
  rippleCore: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
  },
  rippleCoreActive: { backgroundColor: color.goldMuted, borderColor: color.borderGold, ...elevation.gold },
  rippleIcon: { transform: [{ rotate: '90deg' }] },
  title: { ...typeTokens.h1, color: color.textPrimary, textAlign: 'center' },
  subtitle: { ...typeTokens.body, color: color.textSecondary, textAlign: 'center' },
  message: { ...typeTokens.caption, color: color.warning, textAlign: 'center', marginTop: space.sm },
  messageSuccess: { color: color.success },
  primaryButton: { marginTop: space.xl, width: '100%' },
  codeRow: {
    marginTop: space.md,
    width: '100%',
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: color.bgDeep,
  },
  codeTextWrap: { flex: 1, paddingVertical: space.sm },
  codeLabel: { ...typeTokens.caption, color: color.textTertiary },
  codeValue: { ...typeTokens.mono, color: color.gold },
  noteRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md, paddingHorizontal: space.xs },
  noteText: { ...typeTokens.caption, color: color.textTertiary, flex: 1 },
  stateCard: { alignItems: 'center', gap: space.sm, padding: space.xl },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
    marginBottom: space.sm,
  },
  stateTitle: { ...typeTokens.h2, color: color.textPrimary, textAlign: 'center' },
  stateBody: { ...typeTokens.body, color: color.textSecondary, textAlign: 'center', marginBottom: space.sm },
  sheetList: { gap: space.xs },
  sheetRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sheetRowActive: { backgroundColor: color.goldWash, borderColor: color.borderGold },
  sheetTextWrap: { flex: 1, paddingVertical: space.sm },
  sheetCode: { ...typeTokens.mono, color: color.textPrimary },
  sheetCodeActive: { color: color.gold },
  sheetName: { ...typeTokens.caption, color: color.textSecondary },
});
