import '../../data/models/models.dart';

// ═══════════════════════════════════════════════════════════════════
// PREMIUM HUQUQI — YAGONA MANBA (iPhone ham, Android ham)
//
// Bu fayl to'lov haqida HECH NARSA bilmaydi: faqat sessiyadagi
// foydalanuvchi maydonlaridan (`isPremium`, `premiumExpiresAt`,
// `trialExpiresAt`) "nima ochiq" degan savolga javob beradi. Xarid
// (Apple IAP) — `iap_controller.dart`, faqat iPhone.
// ═══════════════════════════════════════════════════════════════════

/// Premium bilan / Premiumsiz hajmlar — serverdagi qiymatlar bilan
/// AYNAN bir xil.
///
/// `hosting/worker.js`: `COMPANY_FREE_ITEM_LIMIT = 5`,
/// `COMPANY_PREMIUM_ITEM_LIMIT = 25` (biznes katalogi) va
/// `MUSIC_LIMIT_FREE_D1 = 5` / `MUSIC_LIMIT_PREMIUM_D1 = 10` (profil
/// qo'shiqlari, `musicLimitD1`). Post, istoriya, video va izoh bu
/// yerda YO'Q — ular hammaga bepul (egasining qarori, 2026-10-04).
const kCatalogFreeLimit = 5;
const kCatalogPremiumLimit = 25;
const kMusicFreeLimit = 5;
const kMusicPremiumLimit = 10;

/// TO'LANGAN Premium — server `isPremium` (eski muddatsiz yoki
/// `premiumExpiresAt` kelajakda; saytda yoki App Store'da olingan —
/// farqi yo'q). Bepul sinov bu yerga KIRMAYDI.
bool iapPaidPremium(User u, {DateTime? now}) =>
    u.premium || (u.premiumUntil?.isAfter(now ?? DateTime.now()) ?? false);

/// Hisobning bepul sinovi hozir faolmi (`trialExpiresAt` kelajakda).
bool premiumTrialActive(User u, {DateTime? now}) =>
    u.trialUntil?.isAfter(now ?? DateTime.now()) ?? false;

/// Premium darajasidagi imkoniyatlar ochiqmi: to'langan Premium YOKI
/// faol bepul sinov (server ham sinovni Premium "poli" deb biladi).
bool premiumAccessActive(User? u, {DateTime? now}) =>
    u != null &&
    (iapPaidPremium(u, now: now) || premiumTrialActive(u, now: now));

/// BEPUL SINOV necha kun qoldi (yuqoriga yaxlitlanadi, sayt
/// `trialDaysLeft` bilan bir xil). Sinov yo'q / tugagan / to'langan
/// Premium bo'lsa — `null`.
int? iapTrialDaysLeft(User? u, {DateTime? now}) {
  if (u == null) return null;
  final at = now ?? DateTime.now();
  if (iapPaidPremium(u, now: at) || !premiumTrialActive(u, now: at)) {
    return null;
  }
  return (u.trialUntil!.difference(at).inMilliseconds /
          Duration.millisecondsPerDay)
      .ceil();
}

/// PROFIL QO'SHIQLARI CHEGARASI — Premium yoki faol sinov: 10, aks
/// holda 5 (server `musicLimitD1`). Ikkala platformada bir xil.
int profileMusicLimit(User? u, {DateTime? now}) =>
    premiumAccessActive(u, now: now) ? kMusicPremiumLimit : kMusicFreeLimit;
