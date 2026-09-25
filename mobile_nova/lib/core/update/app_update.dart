import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:in_app_update/in_app_update.dart';

import '../../l10n/gen/app_localizations.dart';

/// ILOVA ICHIDAN YANGILASH (egasi, 2026-09-25: "biz yangilasak,
/// ularda ham avtomatik bo'lsin").
///
/// Google Play'ning rasmiy In-App Updates vositasi: ilova ochilganda
/// Play'dan yangi versiya bor-yo'qligi so'raladi. Bor bo'lsa, Play'ning
/// o'z "Yangilash" oynasi chiqadi; yangilanish FONDA yuklanadi (odam
/// ilovadan foydalanishda davom etadi), tugagach pastda "Qayta ishga
/// tushirish" tugmasi chiqadi.
///
/// Yangilash faqat Play orqali — ilova o'zini boshqa manbadan
/// yangilamaydi (Play qoidasi). Play'dan o'rnatilmagan nusxada
/// (masalan, saytdagi APK) Play xato qaytaradi — jim o'tkaziladi.
class AppUpdate {
  AppUpdate._();

  static bool _checked = false;

  /// Sinovlarda va boshqa platformalarda o'chiq.
  @visibleForTesting
  static bool enabled = !kIsWeb && !kDebugMode && Platform.isAndroid;

  /// Bir ishga tushirishda bir marta tekshiradi.
  static Future<void> checkOnce(BuildContext context) async {
    if (_checked || !enabled) return;
    _checked = true;
    final messenger = ScaffoldMessenger.maybeOf(context);
    final l = L.of(context);
    try {
      final info = await InAppUpdate.checkForUpdate();
      if (info.updateAvailability != UpdateAvailability.updateAvailable) {
        return;
      }
      if (info.flexibleUpdateAllowed) {
        final r = await InAppUpdate.startFlexibleUpdate();
        if (r != AppUpdateResult.success || messenger == null) return;
        messenger.showSnackBar(SnackBar(
          duration: const Duration(days: 1),
          content: Text(l.updateReady),
          action: SnackBarAction(
            label: l.updateRestart,
            onPressed: () => InAppUpdate.completeFlexibleUpdate(),
          ),
        ));
      } else if (info.immediateUpdateAllowed) {
        await InAppUpdate.performImmediateUpdate();
      }
    } catch (_) {
      // Play yo'q, ilova Play'dan o'rnatilmagan yoki tarmoq xatosi —
      // odamga ko'rsatiladigan narsa yo'q.
    }
  }
}
