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

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
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
    });
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
export type NotificationCategory = 'auction' | 'payment' | 'company' | 'profile' | 'system';

export interface NotificationPayload {
  category: NotificationCategory;
  title: string;
  body: string;
  /** In-app deep-link target, e.g. `nfcstore://auksion/42`. */
  deepLink?: string;
}

export interface NotificationDisplay {
  title: string;
  body: string;
  icon: 'trending-up' | 'credit-card' | 'briefcase' | 'user' | 'bell';
}

const CATEGORY_ICON: Record<NotificationCategory, NotificationDisplay['icon']> = {
  auction: 'trending-up',
  payment: 'credit-card',
  company: 'briefcase',
  profile: 'user',
  system: 'bell',
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
    icon: CATEGORY_ICON[payload.category] ?? 'bell',
  };
}
