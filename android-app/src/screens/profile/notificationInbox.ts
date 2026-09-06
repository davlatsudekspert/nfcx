/**
 * In-app notification inbox — aggregation of REAL endpoints only.
 *
 * There is no notifications API in this product: `hosting/worker.js` has no
 * notifications route and the D1 schema has no notifications table
 * (android/docs/02-API_MAP.md §2.9, re-verified by direct search). The web app
 * has exactly the same gap and solves it the same way — src/pages/
 * NotificationsPage.jsx aggregates gift offers, won-pending auctions and
 * support replies client-side. This module mirrors that, minus support
 * replies: the web calls `GET /api/support`, which is **not ported** to the
 * Worker (only `/api/admin/support-messages` exists), so there is nothing
 * honest to show for it here.
 *
 * Sources, all confirmed live:
 *   GET /api/gift-offers        → incoming NFC ID gifts (actionable)
 *   GET /api/auctions/won/pending → auctions won and still unpaid
 *   GET /api/orders             → the user's own ID purchase orders
 *
 * Nothing is invented: if all three are empty, the screen says so.
 */
import * as SecureStore from 'expo-secure-store';
import type { GiftOffer, Order } from '../../api/types';
import { NOTIFICATION_CATEGORY_ICON, type NotificationCategory, type NotificationIcon } from '../../native/push';
import { formatSom, parseTimestampMs, safeText } from '../../lib/format';
import { fill, type ProfileCopyKey } from './profileCopy';
import type { StringKey } from '../../i18n';

export interface WonAuction {
  id: number;
  code: string;
  currentPrice: number;
  paymentDeadline: string;
}

export type InboxSource =
  | { type: 'gift'; offerId: number; code: string }
  | { type: 'auction'; auctionId: number; code: string; paymentDeadline: string | null }
  | { type: 'order'; orderId: number; code: string; status: string };

export interface InboxItem {
  /** Stable across refreshes — used as the local read-marker key. */
  id: string;
  category: NotificationCategory;
  icon: NotificationIcon;
  title: string;
  body: string;
  /** Secondary line (deadline, absolute date). Never empty-string. */
  meta: string | null;
  timestampMs: number | null;
  source: InboxSource;
}

export interface InboxInput {
  gifts: GiftOffer[];
  wonAuctions: WonAuction[];
  orders: Order[];
  nowMs?: number;
}

type Translate = (key: StringKey) => string;
type Copy = (key: ProfileCopyKey) => string;

/** Older finished orders stop being "news" — pending ones never expire from
 * the inbox because they still need the user to act. */
const FINISHED_ORDER_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Pure builder — every string is localized by the caller's `t`/`c`, and every
 * value passes through the format.ts guards, so no `NaN`/`undefined` can
 * reach the UI.
 */
export function buildInboxItems({ gifts, wonAuctions, orders, nowMs = Date.now() }: InboxInput, t: Translate, c: Copy): InboxItem[] {
  const items: InboxItem[] = [];

  for (const gift of gifts) {
    if (!gift || gift.id == null) continue;
    const code = safeText(gift.code, '—');
    items.push({
      id: `gift-${gift.id}`,
      category: 'gift',
      icon: NOTIFICATION_CATEGORY_ICON.gift,
      title: c('giftTitle'),
      body: fill(c('giftBody'), { from: safeText(gift.fromEmail, c('giftFromUnknown')), code }),
      meta: null,
      timestampMs: parseTimestampMs(gift.createdAt),
      source: { type: 'gift', offerId: gift.id, code },
    });
  }

  for (const auction of wonAuctions) {
    if (!auction || auction.id == null) continue;
    const code = safeText(auction.code, '—');
    items.push({
      id: `auction-${auction.id}`,
      category: 'auction',
      icon: NOTIFICATION_CATEGORY_ICON.auction,
      title: c('auctionWonTitle'),
      body: fill(c('auctionWonBody'), { code, price: formatSom(auction.currentPrice) }),
      meta: t('auction.payDeadline'),
      // Won auctions carry no "created at" — the payment deadline is the only
      // real timestamp the endpoint returns, so it is what the row shows.
      timestampMs: null,
      source: {
        type: 'auction',
        auctionId: auction.id,
        code,
        paymentDeadline: typeof auction.paymentDeadline === 'string' ? auction.paymentDeadline : null,
      },
    });
  }

  for (const order of orders) {
    if (!order || order.id == null) continue;
    const createdMs = parseTimestampMs(order.createdAt);
    const isPending = order.status === 'pending';
    if (!isPending && createdMs != null && nowMs - createdMs > FINISHED_ORDER_MAX_AGE_MS) continue;

    const code = safeText(order.code, '—');
    items.push({
      id: `order-${order.id}`,
      category: isPending ? 'payment' : 'id',
      icon: isPending ? NOTIFICATION_CATEGORY_ICON.payment : NOTIFICATION_CATEGORY_ICON.id,
      title: c(orderTitleKey(order.status)),
      body: fill(c('orderBody'), { code, price: formatSom(order.price) }),
      meta: null,
      timestampMs: createdMs,
      source: { type: 'order', orderId: order.id, code, status: safeText(order.status, 'pending') },
    });
  }

  // Newest first; rows without a real timestamp (won auctions) stay on top —
  // they are the ones that still need the user to act.
  return items.sort((a, b) => {
    if (a.timestampMs == null && b.timestampMs == null) return 0;
    if (a.timestampMs == null) return -1;
    if (b.timestampMs == null) return 1;
    return b.timestampMs - a.timestampMs;
  });
}

function orderTitleKey(status: string): ProfileCopyKey {
  switch (status) {
    case 'paid':
      return 'orderPaidTitle';
    case 'cancelled':
      return 'orderCancelledTitle';
    case 'expired':
      return 'orderExpiredTitle';
    default:
      return 'orderPendingTitle';
  }
}

/* ------------------------------------------------------------------ *
 * Local read markers
 *
 * "Unread" here means "this row hasn't been seen on this device yet" — it is
 * a client-side marker, not a server read-state (no endpoint exists for one).
 * Only opaque item ids are stored, capped so the value stays well inside
 * SecureStore's Android size limit.
 * ------------------------------------------------------------------ */

const SEEN_KEY = 'nfcstore.notifications.seen';
const MAX_SEEN_IDS = 40;

export async function loadSeenIds(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(SEEN_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_SEEN_IDS);
  } catch {
    return [];
  }
}

export async function saveSeenIds(ids: string[]): Promise<void> {
  try {
    const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string'))).slice(0, MAX_SEEN_IDS);
    await SecureStore.setItemAsync(SEEN_KEY, JSON.stringify(unique));
  } catch {
    /* read markers are a convenience — never load-bearing */
  }
}
