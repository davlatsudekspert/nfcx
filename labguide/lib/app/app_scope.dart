import 'package:material_ui/material_ui.dart';

import '../core/storage/kv_store.dart';
import '../features/auth/auth_controller.dart';
import '../features/content/content_controller.dart';
import '../features/settings/settings_controller.dart';

/// Build va siyosat sozlamalari. Biznes qarorlari (masalan, qurilmalar
/// soni) kodga qotirilmaydi — shu yerda, keyin remote config'dan keladi.
@immutable
class AppConfig {
  const AppConfig({
    required this.appVersion,
    required this.showDebugBadge,
    this.maxActiveDevicesProposal = 2,
  });

  final String appVersion;

  /// Debug buildda demo adapterlar ishlayotganini ko'rsatish.
  final bool showDebugBadge;

  /// Taklif: 1 hisob / 2 faol qurilma. Hali qat'iy qaror emas.
  final int maxActiveDevicesProposal;
}

/// Ilova bo'ylab umumiy servislar. Har biri o'z holatini ChangeNotifier
/// orqali e'lon qiladi; widgetlar kerakli controllerni tinglaydi.
class AppServices {
  AppServices({
    required this.config,
    required this.store,
    required this.settings,
    required this.auth,
    required this.content,
    required this.bookmarks,
  });

  final AppConfig config;
  final KeyValueStore store;
  final SettingsController settings;
  final AuthController auth;
  final ContentController content;
  final BookmarksController bookmarks;

  /// "Lokal ma'lumotlarni o'chirish": omborni tozalaydi va xotiradagi
  /// holatni boshlang'ichga qaytaradi.
  Future<void> deleteLocalData(Iterable<Locale> systemLocales) async {
    await store.clear();
    await auth.signOut();
    bookmarks.resetInMemory();
    settings.resetToDefaults(systemLocales);
  }
}

class AppScope extends InheritedWidget {
  const AppScope({super.key, required this.services, required super.child});

  final AppServices services;

  static AppServices of(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope not found');
    return scope!.services;
  }

  @override
  bool updateShouldNotify(AppScope oldWidget) => services != oldWidget.services;
}

extension AppScopeX on BuildContext {
  AppServices get services => AppScope.of(this);
}
