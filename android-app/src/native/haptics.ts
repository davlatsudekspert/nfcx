/**
 * Centralized haptic triggers — every PremiumButton press, bid confirm, and
 * success state routes through here (brief §4/§8) so the feel is consistent
 * and can be globally disabled (e.g. respecting a future "kamaytirilgan
 * animatsiya" accessibility setting) from one place.
 */
import * as Haptics from 'expo-haptics';

export const haptics = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
  selection: () => Haptics.selectionAsync().catch(() => {}),
};
