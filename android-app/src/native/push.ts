/**
 * Push-notification "ready architecture" — brief §15/§19: no real push
 * backend exists anywhere in this repo (android/docs/01-AUDIT.md §1.6 item
 * 4, confirmed by a direct search: no APNs/FCM/webpush code, no
 * `notifications` table in the D1 schema). Per the brief's own instruction
 * ("agar backend push tayyor bo'lmasa fake notification backend
 * yaratma"), this wires the *client-side* machinery — permission request,
 * token retrieval, foreground display config, and payload→display mapping
 * — without inventing a server to send anything. `registerForPushToken()`
 * intentionally does NOT send its result anywhere; there is no endpoint to
 * receive it yet. Wiring that POST is a one-line follow-up the moment the
 * backend adds one — tracked, not guessed at here.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * There is no server anywhere in this repo that can *send* a push (no FCM/APNs
 * credentials, no `notifications` table, no send endpoint — android/docs/
 * 01-AUDIT.md §1.6 item 4, re-verified against `hosting/worker.js`). The UI
 * reads this constant so the Settings screen states that plainly instead of
 * implying pushes will start arriving once permission is granted.
 */
export const PUSH_DELIVERY_BACKEND_AVAILABLE = false;

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Reads the OS-level notification permission without prompting. Returns
 * 'unavailable' when the native module isn't present (e.g. a bare emulator),
 * so callers never crash on a device that can't do notifications at all. */
export async function getPushPermission(): Promise<PushPermission> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'unavailable';
  }
}

export interface PushReadiness {
  permission: PushPermission;
  /** Whether a device token could actually be obtained right now. */
  tokenAvailable: boolean;
  /** Always false today — see PUSH_DELIVERY_BACKEND_AVAILABLE. */
  deliveryBackendAvailable: boolean;
}

/**
 * Honest, user-presentable push status. Never returns or logs the token
 * itself (brief §17 — no secrets in logs), only whether one exists.
 */
export async function getPushReadiness(): Promise<PushReadiness> {
  const permission = await getPushPermission();
  let tokenAvailable = false;
  if (permission === 'granted') {
    try {
      const { data } = await Notifications.getExpoPushTokenAsync();
      tokenAvailable = typeof data === 'string' && data.length > 0;
    } catch {
      tokenAvailable = false;
    }
  }
  return { permission, tokenAvailable, deliveryBackendAvailable: PUSH_DELIVERY_BACKEND_AVAILABLE };
}

/**
 * Retrieves an Expo push token for this device. Returns null if permission
 * is denied or (as in this sandbox) no real project/credentials are
 * configured — callers must treat that as "push not available right now",
 * not an error to surface to the user.
 */
export async function registerForPushToken(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
  const granted = await requestNotificationPermission();
  if (!granted) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    return data;
  } catch {
    return null;
  }
}

/** The notification categories the web app's own in-app aggregation uses
 * (brief §15) — kept as the contract a future real push payload should
 * follow, so the render path below is ready the day a backend exists. */
export type NotificationCategory =
  | 'auction'
  | 'payment'
  | 'company'
  | 'profile'
  | 'system'
  /** NFC ID gifting between users (`GET /api/gift-offers`). */
  | 'gift'
  /** NFC ID purchase/order lifecycle (`GET /api/orders`). */
  | 'id';

export interface NotificationPayload {
  category: NotificationCategory;
  title: string;
  body: string;
  /** In-app deep-link target, e.g. `nfcstore://auksion/42`. */
  deepLink?: string;
}

export type NotificationIcon =
  | 'trending-up'
  | 'credit-card'
  | 'briefcase'
  | 'user'
  | 'bell'
  | 'gift'
  | 'hash';

export interface NotificationDisplay {
  title: string;
  body: string;
  icon: NotificationIcon;
}

/** One category→icon table shared by the in-app inbox and the (future) push
 * render path, so the same event never gets two different icons. */
export const NOTIFICATION_CATEGORY_ICON: Record<NotificationCategory, NotificationIcon> = {
  auction: 'trending-up',
  payment: 'credit-card',
  company: 'briefcase',
  profile: 'user',
  system: 'bell',
  gift: 'gift',
  id: 'hash',
};

/**
 * Pure mapping from a notification payload to its display shape — the
 * "render code path", unit-testable without any real push ever arriving
 * (android/docs/06-IMPLEMENTATION_PLAN.md Phase 11 test note).
 */
export function mapPayloadToDisplay(payload: NotificationPayload): NotificationDisplay {
  return {
    title: payload.title,
    body: payload.body,
    icon: NOTIFICATION_CATEGORY_ICON[payload.category] ?? 'bell',
  };
}
