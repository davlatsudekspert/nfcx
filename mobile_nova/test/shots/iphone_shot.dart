@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader, MethodChannel;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/widgets/contact_buttons.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
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

/// HAQIQIY SOYALAR. `flutter_test` soyalarni odatda qattiq bo'yoq
/// qilib chizadi (`debugDisableShadows`) — surat solishtirish barqaror
/// bo'lsin deb. Bu yerda maqsad telefondagi ko'rinish, shuning uchun
/// yumshoq soya yoqiladi va test oxirida qaytariladi.
Future<void> _realShadows(Future<void> Function() body) async {
  debugDisableShadows = false;
  try {
    await body();
  } finally {
    debugDisableShadows = true;
  }
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
      {String? tapText,
      Object? extra,
      bool end = false,
      NfcTokens? tokens,
      Key? tapKey,
      double? tapAlign}) {
    testWidgets('iphone $name', (t) async {
      _iosInsets(t);
      await _realShadows(() => tabShot(t, location, 'iphone-$name', _iphone,
          tapText: tapText,
          extra: extra,
          end: end,
          tokens: tokens,
          tapKey: tapKey,
          tapAlign: tapAlign));
    }, variant: ios);
  }

  void solo(String name, Widget screen,
      {List<Override> extra = const [], NfcTokens? tokens}) {
    testWidgets('iphone $name', (t) async {
      _iosInsets(t);
      await _realShadows(() => soloShot(t, screen, 'iphone-$name', _iphone,
          extra: extra, tokens: tokens));
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
  // Egasi (2026-09-27): "profil bo'limlaridan rasm tashla, mp3 player
  // ham ishlaydimi" — postlar va reels tablari, musiqa pleeri va
  // kontent yaratish oynalari.
  tab('13-profile-posts', Routes.profile,
      tapKey: const ValueKey('profile-grid-tab-0'), tapAlign: .1);
  tab('14-profile-reels', Routes.profile,
      tapKey: const ValueKey('profile-grid-tab-1'), tapAlign: .1);
  testWidgets('iphone 15-music-playing', (t) async {
    _iosInsets(t);
    await _realShadows(() => tabShot(
        t, Routes.profile, 'iphone-15-music-playing', _iphone,
        tapKey: const ValueKey('music-eq'), playMusic: true));
  }, variant: ios);
  tab('16-compose-post', Routes.postCreate);
  tab('17-compose-reel', Routes.reelCreate);
  tab('18-compose-story', Routes.storyCreate);

  // HAMMA MAVZU — egasining talabi (2026-09-27): "boshqa temalarga
  // ham e'tibor ber, ayollar temasi ham bor", "o'zing test qilib chiq
  // hammasini". Sozlamalarda tanlanadigan har mavzu (`NfcTokens.all`)
  // asosiy ekranlarda iPhone o'lchamida chiziladi.
  for (final th in NfcTokens.all.where((x) => x.id != 'ivory')) {
    final id = th.id;
    tab('$id-a-home', Routes.home, tokens: th);
    tab('$id-b-discover', Routes.discover, tokens: th);
    tab('$id-c-reels', Routes.reels, tokens: th);
    tab('$id-d-nfc', Routes.nfc, tokens: th);
    tab('$id-e-profile', Routes.profile, tokens: th);
    tab('$id-f-settings', Routes.settings, tokens: th);
    solo('$id-g-login', const LoginScreen(), tokens: th);
    solo('$id-h-splash', const SplashScreen(), tokens: th);
  }
  tab('ivory-f-settings', Routes.settings);

  // ALOQA TUGMALARI — iPhone ilova belgilari uslubi (egasi,
  // 2026-09-27). Uch xil mavzuda: yorug', qorong'i, pushti.
  const row1 = [
    ContactAction(kind: ContactKind.phone, url: 'tel:+998900000000'),
    ContactAction(kind: ContactKind.telegram, url: 'https://t.me/nfcstore'),
    ContactAction(kind: ContactKind.whatsapp, url: 'https://wa.me/998900000000'),
    ContactAction(kind: ContactKind.instagram, url: 'https://instagram.com/nfcstore'),
  ];
  const row2 = [
    ContactAction(kind: ContactKind.facebook, url: 'https://facebook.com/nfcstore'),
    ContactAction(kind: ContactKind.email, url: 'mailto:info@nfcstore.uz'),
    ContactAction(kind: ContactKind.map, url: 'https://maps.google.com'),
    ContactAction(kind: ContactKind.website, url: 'https://nfcstore.uz'),
  ];
  for (final th in [NfcTokens.ivory, NfcTokens.noir, NfcTokens.sakura]) {
    solo(
      'contacts-${th.id}',
      const Scaffold(
        body: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ContactButtons(actions: row1),
                SizedBox(height: 28),
                ContactButtons(actions: row2),
              ],
            ),
          ),
        ),
      ),
      tokens: th,
    );
  }
}
