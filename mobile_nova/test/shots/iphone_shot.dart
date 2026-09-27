@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader, MethodChannel;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/business/business_intro.dart';
import 'package:nfcstore_nova/features/entry/splash_screen.dart';
import 'package:nfcstore_nova/features/shop/nfc_id_market.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import '../support/fake_video_platform.dart';
import '../support/rich_fakes.dart';
import 'editorial_shot.dart' show soloShot, tabShot;

/// iPHONE 16 PRO MAX — ASOSIY EKRANLAR.
///
/// `editorial_shot.dart` dagi o'sha haqiqiy router va boy kontent,
/// faqat uchta farq bilan:
///
/// * o'lcham 440x956 @3x = 1320x2868 — App Store'ning 6.9" o'lchami;
/// * xavfsiz hudud: tepada Dynamic Island (62 pt), pastda uy
///   chizig'i (34 pt) — shu yerda nima bosilib qolishi ko'rinadi;
/// * platforma iOS — iPhone qoidalari (raqamli narx yo'q,
///   `store_policy.dart`), Cupertino o'tishlar va scroll.
///
///     flutter test --run-skipped -t shots --update-goldens \
///       test/shots/iphone_shot.dart
const _iphone = Size(440, 956);

Future<void> _loadFonts() async {
  final families = <String, List<String>>{};
  String? current;
  for (final raw in File('pubspec.yaml').readAsLinesSync()) {
    final fam = RegExp(r'^\s{4}- family:\s*(\S+)').firstMatch(raw);
    if (fam != null) {
      current = fam.group(1);
      families[current!] = <String>[];
      continue;
    }
    final asset = RegExp(r'^\s+- asset:\s*(\S+)').firstMatch(raw);
    if (asset != null && current != null) families[current]!.add(asset.group(1)!);
  }
  for (final family in families.entries) {
    final loader = FontLoader(family.key);
    for (final path in family.value) {
      loader.addFont(rootBundle.load(path));
    }
    await loader.load();
  }
  // NovaIcons = CupertinoIcons (Reels tugmalari). Ilovada shrift
  // paket bilan keladi; testda uni o'zimiz yuklaymiz, aks holda
  // belgilar bo'sh kvadrat bo'lib chiqadi.
  final home = Platform.environment['HOME'] ?? '/root';
  final cup = Directory('$home/.pub-cache/hosted/pub.dev')
      .listSync()
      .whereType<Directory>()
      .where((d) => d.path.contains('cupertino_icons-'))
      .map((d) => File('${d.path}/assets/CupertinoIcons.ttf'))
      .where((f) => f.existsSync())
      .toList();
  if (cup.isNotEmpty) {
    await (FontLoader('packages/cupertino_icons/CupertinoIcons')
          ..addFont(Future.value(cup.last.readAsBytesSync().buffer.asByteData())))
        .load();
  }
  final root = Platform.environment['FLUTTER_ROOT'] ??
      File(Platform.resolvedExecutable).parent.parent.parent.path;
  final icons =
      File('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  if (icons.existsSync()) {
    final l = FontLoader('MaterialIcons')
      ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData()));
    await l.load();
  }
}

/// Dynamic Island va uy chizig'i — fizik pikselda (@3x).
void _iosInsets(WidgetTester t) {
  t.view.padding = const FakeViewPadding(top: 62 * 3, bottom: 34 * 3);
  t.view.viewPadding = const FakeViewPadding(top: 62 * 3, bottom: 34 * 3);
  addTearDown(t.view.resetPadding);
  addTearDown(t.view.resetViewPadding);
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    VideoPlayerPlatform.instance = FakeVideoPlatform(frames: const [
      '$richAssets/z_post_evening.jpg',
      '$richAssets/m_card_metal.jpg',
    ]);
    final tmp = Directory.systemTemp.createTempSync('iphone_shot').path;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (_) async => tmp,
    );
    await _loadFonts();
  });

  final ios = TargetPlatformVariant.only(TargetPlatform.iOS);

  void tab(String name, String location,
      {String? tapText, Object? extra, bool end = false}) {
    testWidgets('iphone $name', (t) async {
      _iosInsets(t);
      await tabShot(t, location, 'iphone-$name', _iphone,
          tapText: tapText, extra: extra, end: end);
    }, variant: ios);
  }

  void solo(String name, Widget screen, {List<Override> extra = const []}) {
    testWidgets('iphone $name', (t) async {
      _iosInsets(t);
      await soloShot(t, screen, 'iphone-$name', _iphone, extra: extra);
    }, variant: ios);
  }

  solo('01-splash', const SplashScreen());
  solo('02-login', const LoginScreen());
  tab('03-home', Routes.home);
  tab('04-discover', Routes.discover);
  tab('05-catalog', Routes.discover, tapText: 'Katalog');
  tab('06-product', Routes.catalogProduct('NFCSTORE', 'p1'),
      extra: richProducts.first);
  tab('07-reels', Routes.reels);
  tab('08-nfc', Routes.nfc);
  tab('09-profile', Routes.profile);
  solo('10-business', const BusinessIntroScreen());
  // iPhone qoidasi ko'rinib tursin: darajalar bor, narx yo'q.
  solo('11-nfc-id-market', const NfcIdMarketScreen(), extra: [
    idPricingProvider.overrideWith((ref) async => const [
          IdTier(tier: 'exclusive', price: 2000000, from: true),
          IdTier(tier: 'premium', price: 900000, from: true),
          IdTier(tier: 'gold', price: 500000),
          IdTier(tier: 'silver', price: 150000),
          IdTier(tier: 'free', price: 0),
        ]),
  ]);
  tab('12-profile-end', Routes.profile, end: true);
}
