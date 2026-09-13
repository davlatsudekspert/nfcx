import * as Haptics from 'expo-haptics';

/**
 * Taktil javob — barmoq ostidagi qisqa titrash.
 *
 * Hamma chaqiruv `catch` bilan yutiladi: qurilmada motor bo'lmasligi
 * yoki tizim sozlamasida o'chirilgan bo'lishi mumkin, bu esa ilovani
 * to'xtatadigan xato emas.
 *
 * QOIDA: titrash HAR BOSISHDA emas. U "nimadir sodir bo'ldi" degan
 * belgi — ortiqcha ishlatilsa, ilova asabiylashtiradi. Shuning uchun
 * faqat holat o'zgarganda: tab almashganda, profil tanlanganda,
 * varaq ochilganda, natija kelganda.
 */
export const tapLight = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Tanlov o'zgardi — tab, filtr, profil almashtirish. */
export const tapSelect = () => {
  Haptics.selectionAsync().catch(() => {});
};

/** Muvaffaqiyat — saqlandi, buyurtma yaratildi, karta o'qildi. */
export const tapSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

/** Xato — forma rad etildi, kod band. */
export const tapError = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
};
