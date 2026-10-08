import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:labguide/app/app.dart';
import 'package:labguide/app/app_scope.dart';
import 'package:labguide/app/widgets/lg_page.dart';
import 'package:labguide/core/storage/kv_store.dart';
import 'package:labguide/features/auth/otp_auth.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:labguide/main.dart';
import 'package:material_ui/material_ui.dart';

/// Haqiqiy Inter va Material Icons shriftlarini yuklaydi: overflow
/// tekshiruvi test shriftida (har harf = kvadrat) emas, ilovadagi kabi
/// matn kengligida o'tadi.
Future<void> loadAppFonts() async {
  Future<ByteData> file(String path) async =>
      ByteData.sublistView(File(path).readAsBytesSync());
  final inter = FontLoader('Inter');
  for (final w in [400, 500, 600, 700]) {
    inter.addFont(file('assets/fonts/Inter-$w.ttf'));
  }
  await inter.load();
  final icons = FontLoader('MaterialIcons')
    ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
  await icons.load();
}

/// Test uchun servislar: xotiradagi ombor, tasdiqlangan kontent yuklangan.
Future<AppServices> makeServices(
  WidgetTester tester, {
  MemoryKeyValueStore? store,
  OtpAuthAdapter? otpAdapter,
  AppLanguage language = AppLanguage.uz,
  AppRole? role = AppRole.lab,
  bool onboarded = true,
  ThemeMode themeMode = ThemeMode.light,
  AssetBundle? bundle,
}) async {
  final s = store ?? MemoryKeyValueStore();
  final services = createServices(
    store: s,
    bundle: bundle ?? rootBundle,
    systemLocales: [language.locale],
    otpAdapter: otpAdapter ?? DemoOtpAdapter(releaseBuild: false),
  );
  await services.settings.setLanguage(language);
  await services.settings.setThemeMode(themeMode);
  if (role != null) await services.settings.setRole(role);
  if (onboarded) {
    await services.auth.continueAsGuest();
    await services.settings.completeOnboarding();
  }
  await tester.runAsync(services.content.load);
  return services;
}

/// Telefon kabi ekran: o'lcham (logik px), safe area, shrift masshtabi,
/// tizim mavzusi, reduced motion.
Future<void> pumpApp(
  WidgetTester tester,
  AppServices services, {
  Size size = const Size(390, 844),
  double textScale = 1,
  Brightness platformBrightness = Brightness.light,
  bool reduceMotion = false,
  bool notch = true,
}) async {
  const ratio = 3.0;
  tester.view.devicePixelRatio = ratio;
  tester.view.physicalSize = size * ratio;
  if (notch) {
    tester.view.padding = const FakeViewPadding(
      top: 47 * ratio,
      bottom: 34 * ratio,
    );
  }
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  tester.platformDispatcher.platformBrightnessTestValue = platformBrightness;
  if (reduceMotion) {
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
  }
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearAllTestValues);
  await tester.pumpWidget(LabGuideApp(services: services));
  await tester.pumpAndSettle();
}

/// Joriy routerni olish (ko'rinib turgan sahifa orqali).
GoRouter routerOf(WidgetTester tester) =>
    GoRouter.of(tester.element(find.byType(LgPage).first));

Future<void> goTo(WidgetTester tester, String location) async {
  routerOf(tester).go(location);
  await tester.pumpAndSettle();
}

/// Lokalizatsiya obyektini joriy til bo'yicha olish.
T l10n<T>(WidgetTester tester, T Function(BuildContext) read) =>
    read(tester.element(find.byType(LgPage).first));

/// Kontent paketini buzib beradigan asset bundle (xato holatini sinash).
class TamperingBundle extends CachingAssetBundle {
  TamperingBundle(this._inner);

  final AssetBundle _inner;

  @override
  Future<ByteData> load(String key) async {
    final data = await _inner.load(key);
    if (!key.endsWith('core/pack.json')) return data;
    final bytes = Uint8List.fromList(
      data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
    );
    bytes[42] ^= 0x01;
    return ByteData.sublistView(bytes);
  }
}

/// Paket JSON'ini o'zgartirib, manifestni (size + sha256) mos ravishda
/// qayta hisoblaydigan bundle — tekshiruvdan o'tadigan, lekin boshqacha
/// kontentli paket (masalan, “faqat tuzilma” kartasini ko'rsatish uchun).
class PatchedPackBundle extends CachingAssetBundle {
  PatchedPackBundle(this._inner, this._patch);

  final AssetBundle _inner;
  final void Function(Map<String, Object?> pack) _patch;
  Uint8List? _pack;

  Future<Uint8List> _patchedPack() async {
    if (_pack != null) return _pack!;
    final raw = await _inner.loadString('assets/content/core/pack.json');
    final json = jsonDecode(raw) as Map<String, Object?>;
    _patch(json);
    return _pack = Uint8List.fromList(utf8.encode(jsonEncode(json)));
  }

  @override
  Future<ByteData> load(String key) async {
    if (key.endsWith('core/pack.json')) {
      return ByteData.sublistView(await _patchedPack());
    }
    if (key.endsWith('core/manifest.json')) {
      final bytes = await _patchedPack();
      final manifest =
          jsonDecode(await _inner.loadString(key)) as Map<String, Object?>;
      manifest['files'] = [
        {
          'path': 'pack.json',
          'size': bytes.length,
          'sha256': sha256.convert(bytes).toString(),
        },
      ];
      return ByteData.sublistView(
        Uint8List.fromList(utf8.encode(jsonEncode(manifest))),
      );
    }
    return _inner.load(key);
  }
}
