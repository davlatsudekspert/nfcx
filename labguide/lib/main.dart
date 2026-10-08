import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import 'app/app.dart';
import 'app/app_scope.dart';
import 'core/storage/kv_store.dart';
import 'features/auth/auth_controller.dart';
import 'features/auth/otp_auth.dart';
import 'features/content/content_controller.dart';
import 'features/qc/qc_controller.dart';
import 'features/settings/settings_controller.dart';

const _appVersion = '0.1.0';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final services = createServices(
    store: await PrefsKeyValueStore.open(),
    bundle: rootBundle,
    systemLocales: PlatformDispatcher.instance.locales,
  );
  // Kontent fonda yuklanadi; ekranlar loading/error holatini ko'rsatadi.
  unawaited(services.content.load());
  runApp(LabGuideApp(services: services));
}

/// Servislarni yig'ish — testlar ham shu funksiyadan foydalanadi.
AppServices createServices({
  required KeyValueStore store,
  required AssetBundle bundle,
  required Iterable<Locale> systemLocales,
  OtpAuthAdapter? otpAdapter,
}) {
  return AppServices(
    config: const AppConfig(
      appVersion: _appVersion,
      showDebugBadge: kDebugMode,
    ),
    store: store,
    settings: SettingsController(store, systemLocales: systemLocales),
    auth: AuthController(store, otpAdapter ?? createOtpAdapter()),
    content: ContentController(bundle: bundle),
    bookmarks: BookmarksController(store),
    qc: QcController(store),
  );
}
