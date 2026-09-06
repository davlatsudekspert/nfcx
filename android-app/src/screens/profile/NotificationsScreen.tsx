import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileStackParamList, MainTabParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { useToast } from '../../design-system/components/PremiumToast';
import { socialApi } from '../../api/social';
import { auctionsApi } from '../../api/auctions';
import { ordersApi } from '../../api/orders';
import { useAuthStore } from '../../state/authStore';
import { formatDateTime, timeAgo } from '../../lib/format';
import { useT } from '../../i18n';
import { useProfileCopy } from './profileCopy';
import { buildInboxItems, loadSeenIds, saveSeenIds, type InboxItem } from './notificationInbox';
import { color, elevation, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Notifications'>;

/**
 * The in-app inbox. Every row comes from a real, confirmed endpoint — see
 * ./notificationInbox.ts for the (short) list and for why there is no
 * notifications API to call instead. Unread marks are local read markers;
 * push delivery does not exist server-side and the footer says so rather than
 * implying notifications will arrive on their own.
 */
export function NotificationsScreen({ navigation }: Props) {
  const t = useT();
  const c = useProfileCopy();
  const toast = useToast();
  const queryClient = useQueryClient();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();

  const gifts = useQuery({ queryKey: ['gift-offers'], queryFn: () => socialApi.giftOffers() });
  const won = useQuery({ queryKey: ['auctions', 'won-pending'], queryFn: () => auctionsApi.wonPending() });
  const orders = useQuery({ queryKey: ['orders', 'mine'], queryFn: () => ordersApi.list() });

  const queries = [gifts, won, orders];
  const isLoading = queries.some((q) => q.isLoading);
  const allFailed = queries.every((q) => q.isError);
  const someFailed = !allFailed && queries.some((q) => q.isError);
  const firstError = queries.find((q) => q.isError)?.error;

  const items = useMemo(
    () =>
      buildInboxItems(
        {
          gifts: gifts.data?.incoming ?? [],
          wonAuctions: won.data?.auctions ?? [],
          orders: orders.data?.orders ?? [],
        },
        t,
        c,
      ),
    [gifts.data, won.data, orders.data, t, c],
  );

  /* Local read markers (see notificationInbox.ts). `seenIds` is loaded once so
   * badges stay stable while the screen is open; the current ids are persisted
   * on unmount, and "mark all read" clears them immediately. */
  const [seenIds, setSeenIds] = useState<string[] | null>(null);
  const latestIds = useRef<string[]>([]);

  useEffect(() => {
    latestIds.current = items.map((i) => i.id);
  }, [items]);

  useEffect(() => {
    let active = true;
    loadSeenIds().then((ids) => {
      if (active) setSeenIds(ids);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (latestIds.current.length) saveSeenIds(latestIds.current);
    },
    [],
  );

  const isUnread = useCallback(
    (id: string) => (seenIds ? !seenIds.includes(id) : false),
    [seenIds],
  );
  const unreadCount = items.filter((i) => isUnread(i.id)).length;

  const markAllRead = useCallback(() => {
    const ids = items.map((i) => i.id);
    setSeenIds(ids);
    saveSeenIds(ids);
  }, [items]);

  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([gifts.refetch(), won.refetch(), orders.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [gifts, won, orders]);

  const giftAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'accept' | 'reject' }) => socialApi.giftAction(id, action),
    onSuccess: (_data, variables) => {
      toast.show(variables.action === 'accept' ? c('giftAccepted') : c('giftRejected'), 'success');
      queryClient.invalidateQueries({ queryKey: ['gift-offers'] });
      // Accepting transfers card ownership — the session's card list changes.
      if (variables.action === 'accept') useAuthStore.getState().refresh().catch(() => {});
    },
    onError: () => toast.show(c('giftActionFailed'), 'danger'),
  });

  const openItem = useCallback(
    (item: InboxItem) => {
      if (item.source.type === 'auction') {
        tabNavigation?.navigate('AuctionTab', { screen: 'AuctionPayment', params: { auctionId: item.source.auctionId } });
        return;
      }
      if (item.source.type === 'order') {
        tabNavigation?.navigate('IdTab', {
          screen: 'PurchaseResult',
          params: { code: item.source.code, orderId: item.source.orderId },
        });
      }
    },
    [tabNavigation],
  );

  const headerActions = unreadCount
    ? [{ icon: 'check-circle' as const, accessibilityLabel: c('notificationsMarkRead'), onPress: markAllRead }]
    : undefined;

  return (
    <ScreenWithHeader
      title={t('notifications.title')}
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      actions={headerActions}
      scroll={false}
    >
      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={color.gold} colors={[color.gold]} />
        }
      >
        <View style={styles.introRow}>
          <Text style={styles.intro}>{c('notificationsSubtitle')}</Text>
          {unreadCount > 0 && <PremiumBadge label={`${unreadCount} ${c('notificationsNew')}`} tone="warning" />}
        </View>

        {someFailed && (
          <PremiumCard variant="sunken" style={styles.warnCard} contentStyle={styles.warnContent}>
            <Feather name="alert-triangle" size={16} color={color.warning} />
            <Text style={styles.warnText}>{c('notificationsPartialError')}</Text>
            <Pressable onPress={refreshAll} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.warnAction}>{t('common.retry')}</Text>
            </Pressable>
          </PremiumCard>
        )}

        <PremiumQueryState
          isLoading={isLoading}
          isError={allFailed}
          error={firstError}
          isEmpty={items.length === 0}
          onRetry={refreshAll}
          onUnauthorized={() => {
            useAuthStore.getState().refresh().catch(() => {});
          }}
          emptyIcon="bell-off"
          emptyTitle={t('notifications.empty')}
          emptyDescription={c('notificationsEmptyHint')}
          skeletonRows={3}
          skeletonHeight={84}
        >
          <View style={styles.list}>
            {items.map((item, index) => (
              <InboxRow
                key={item.id}
                item={item}
                index={index}
                unread={isUnread(item.id)}
                openLabel={c('openLabel')}
                acceptLabel={c('giftAccept')}
                rejectLabel={c('giftReject')}
                busy={giftAction.isPending}
                onOpen={() => openItem(item)}
                onGiftAction={(action) => {
                  if (item.source.type === 'gift') giftAction.mutate({ id: item.source.offerId, action });
                }}
              />
            ))}
          </View>
        </PremiumQueryState>

        <View style={styles.footerNote}>
          <Feather name="info" size={14} color={color.textTertiary} />
          <Text style={styles.footerText}>
            {c('notificationsSourceNote')} {c('pushSheetBody')}
          </Text>
        </View>
      </ScrollView>
    </ScreenWithHeader>
  );
}

interface InboxRowProps {
  item: InboxItem;
  index: number;
  unread: boolean;
  openLabel: string;
  acceptLabel: string;
  rejectLabel: string;
  busy: boolean;
  onOpen: () => void;
  onGiftAction: (action: 'accept' | 'reject') => void;
}

function InboxRow({ item, index, unread, openLabel, acceptLabel, rejectLabel, busy, onOpen, onGiftAction }: InboxRowProps) {
  const relative = item.timestampMs != null ? timeAgo(item.timestampMs) : '';
  const absolute =
    item.source.type === 'auction' && item.source.paymentDeadline
      ? `${item.meta ?? ''} ${formatDateTime(item.source.paymentDeadline)}`.trim()
      : item.timestampMs != null
        ? formatDateTime(item.timestampMs)
        : '';

  return (
    <PremiumCard variant={unread ? 'featured' : 'default'} index={index} style={styles.card} contentStyle={styles.cardContent}>
      <View style={styles.rowTop}>
        <View style={[styles.iconBubble, unread && styles.iconBubbleUnread]}>
          <Feather name={item.icon} size={18} color={unread ? color.gold : color.textSecondary} />
        </View>
        <View style={styles.rowTextWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            {unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.cardBody} numberOfLines={3}>
            {item.body}
          </Text>
          {!!(relative || absolute) && (
            <Text style={styles.timestamp} numberOfLines={1}>
              {[relative, absolute].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
      </View>

      {item.source.type === 'gift' ? (
        <View style={styles.actionsRow}>
          <PremiumButton label={acceptLabel} fullWidth={false} loading={busy} onPress={() => onGiftAction('accept')} style={styles.action} />
          <PremiumButton
            label={rejectLabel}
            variant="ghost"
            fullWidth={false}
            disabled={busy}
            onPress={() => onGiftAction('reject')}
            style={styles.action}
          />
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <PremiumButton label={openLabel} variant="ghost" fullWidth={false} onPress={onOpen} style={styles.action} />
        </View>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  scrollBody: { paddingBottom: space.xxl, gap: space.md },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  intro: { ...typeTokens.caption, color: color.textSecondary, flex: 1 },
  warnCard: { borderColor: color.borderStrong },
  warnContent: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  warnText: { ...typeTokens.caption, color: color.textSecondary, flex: 1 },
  warnAction: { ...typeTokens.caption, color: color.gold, fontWeight: '700' },
  list: { gap: space.md },
  card: { overflow: 'hidden' },
  cardContent: { padding: space.lg, gap: space.md },
  rowTop: { flexDirection: 'row', gap: space.md },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
  },
  iconBubbleUnread: { backgroundColor: color.goldMuted, borderColor: color.borderGold, ...elevation.card },
  rowTextWrap: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { ...typeTokens.bodyStrong, color: color.textPrimary, flexShrink: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.gold },
  cardBody: { ...typeTokens.body, color: color.textSecondary },
  timestamp: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: space.sm },
  action: { paddingHorizontal: space.lg, minHeight: 40 },
  footerNote: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xs, paddingTop: space.sm },
  footerText: { ...typeTokens.caption, color: color.textTertiary, flex: 1 },
});
