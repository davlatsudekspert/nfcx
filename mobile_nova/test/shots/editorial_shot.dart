@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart'
    show rootBundle, FontLoader, MethodChannel;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_intro.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers.dart';

/// SOFT EDITORIAL — HAQIQIY EKRANLAR, HAQIQIY KONTENT, UCH O'LCHAM.
///
/// Egasining talabi: dizayn faqat maket bo'lib qolmasin; 360x800,
/// 390x844 va 430x932 da overflow, matn kesilishi va pastki nav
/// ustma-ust tushishi bo'lmasin; profil bo'sh demo bilan emas,
/// HAQIQIY kontent (surat, uzun ism, ko'p post, musiqa) bilan.
///
/// Ekranlar to'liq ROUTER orqali chiziladi — ya'ni pastki navigatsiya
/// ham, tablar orasidagi joylashuv ham haqiqiy ilovadagidek.
///
///     flutter test --run-skipped -t shots --update-goldens \
///       test/shots/editorial_shot.dart
const _a = 'assets/demo';

const _me = NfcId(
  code: 'VIP001',
  name: 'Muhammad Aliyev',
  role: 'Davlat sud eksperti',
  bio: 'NFC orqali bir tegishda tanishamiz. Toshkent · 2026',
  avatarUrl: '$_a/z_portrait.jpg',
  coverUrl: '$_a/z_cover.jpg',
  primary: true,
  views: 1284,
  followers: 9,
  following: 11,
  posts: 9,
  verified: true,
  tier: 'exclusive',
  musicUrls: ['https://nfcstore.uz/uploads/track.mp3'],
);

const _ids = [
  _me,
  NfcId(code: 'UZD772', name: 'Oybek Ergashev', tier: 'gold', views: 312),
  NfcId(code: 'TTS075', name: 'Tohir Shop', tier: 'silver', views: 88),
];

const _people = [
  NfcId(
      code: 'PPP777',
      name: 'Mashrabboy',
      role: 'Yangi g‘oyalar sari',
      avatarUrl: '$_a/z_post_cafe.jpg',
      followers: 5,
      posts: 12,
      tier: 'premium'),
  NfcId(
      code: 'ALI000',
      name: 'Aliyorbek Toshtemirov',
      role: 'Hayot davom etadi',
      avatarUrl: '$_a/z_post_rooftop.jpg',
      followers: 7,
      posts: 1,
      tier: 'gold'),
  NfcId(
      code: 'MHR555',
      name: 'Mohira Mansurova',
      role: 'Dizayner · brending',
      followers: 23,
      posts: 31,
      tier: 'silver'),
  NfcId(
      code: '33932023',
      name: 'Shaxnoza',
      role: '',
      followers: 0,
      posts: 0),
];

const _images = [
  '$_a/z_post_nfc.jpg',
  '$_a/m_card_metal.jpg',
  '$_a/z_post_cafe.jpg',
  '$_a/m_cards.jpg',
  '$_a/z_post_evening.jpg',
  '$_a/m_stickers.jpg',
  '$_a/z_post_rooftop.jpg',
  '$_a/m_gift_set.jpg',
  '$_a/m_hero.jpg',
];

class _RichSocial extends SocialRepository {
  _RichSocial() : super(ApiClient());

  static final _posts = [
    for (var i = 0; i < _images.length; i++)
      Post(
        id: 100 + i,
        code: 'VIP001',
        authorName: 'Muhammad Aliyev',
        authorAvatar: '$_a/z_portrait.jpg',
        text: i == 0
            ? 'NFCSTORE jamoasi bilan yangi metall kartalar ustida ishlayapmiz.'
            : 'Yangi kun — yangi tanishuvlar.',
        mediaUrls: [_images[i]],
        likes: 24 - i,
        comments: 5,
        createdAt: DateTime(2026, 9, 22, 12).subtract(Duration(hours: i * 7)),
      ),
  ];

  static final _stories = [
    StoryItem(id: 1, code: 'PPP777', authorName: 'Mashrabboy', authorAvatar: '$_a/z_post_cafe.jpg', likes: 3),
    StoryItem(id: 2, code: 'ALI000', authorName: 'Aliyorbek', authorAvatar: '$_a/z_post_rooftop.jpg', likes: 1),
    StoryItem(id: 3, code: 'MHR555', authorName: 'Mohira', likes: 0, seen: true),
  ];

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async => Ok(_posts);

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(code == 'VIP001' ? _posts : const []);

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => const Ok([]);

  @override
  Future<Result<List<StoryItem>>> followedStories() async => Ok(_stories);

  @override
  Future<Result<void>> markStorySeen(int id) async => const Ok(null);
}

class _RichProfile extends ProfileRepository {
  _RichProfile() : super(ApiClient());

  @override
  Future<Result<FollowStats>> followStats(String code) async => const Ok(
      (followers: 9, following: 11, isFollowing: false));
}

class _RichDiscover extends FakeDiscoverRepository {
  @override
  Future<Result<List<NfcId>>> suggested() async => const Ok(_people);

  @override
  Future<Result<List<NfcId>>> searchPeople(String q) async => const Ok(_people);
}

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

const sizes = <String, Size>{
  '360': Size(360, 800),
  '390': Size(390, 844),
  '430': Size(430, 932),
};

Future<List<Override>> _overrides() async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await Prefs.open();
  return [
    prefsProvider.overrideWithValue(prefs),
    authRepositoryProvider.overrideWithValue(FakeAuthRepository(ids: _ids)),
    socialRepositoryProvider.overrideWithValue(_RichSocial()),
    discoverRepositoryProvider.overrideWithValue(_RichDiscover()),
    profileRepositoryProvider.overrideWithValue(_RichProfile()),
  ];
}

Future<void> _settle(WidgetTester tester, [int frames = 16]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 80));
  }
}

void _size(WidgetTester tester, Size s) {
  tester.view.physicalSize = s * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

/// Router orqali tab ekrani.
Future<void> tabShot(
    WidgetTester tester, String location, String name, Size s,
    {bool end = false}) async {
  _size(tester, s);
  late GoRouter router;
  await tester.pumpWidget(ProviderScope(
    overrides: await _overrides(),
    child: Consumer(builder: (context, ref, _) {
      router = ref.watch(routerProvider);
      return MaterialApp.router(
        debugShowCheckedModeBanner: false,
        routerConfig: router,
        theme: buildTheme(NfcTokens.ivory),
        locale: const Locale('uz'),
        supportedLocales: LocaleController.supported,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      );
    }),
  ));
  await _settle(tester);
  router.go(location);
  await _settle(tester, 20);
  // Asset suratlar asinxron dekodlanadi — birinchi kadrda bo'sh
  // doira qolmasin.
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 400)));
  await _settle(tester, 4);
  if (end) {
    // Ro'yxat oxiri: pastki element nav OSTIDA qolmasligini ko'rish.
    final list = find.byType(Scrollable).hitTestable().first;
    for (var i = 0; i < 6; i++) {
      await tester.drag(list, const Offset(0, -900));
      await _settle(tester, 4);
    }
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
    await _settle(tester, 6);
  }
  await expectLater(
      find.byType(MaterialApp), matchesGoldenFile('png/ed-$name.png'));
}

/// Routersiz yakka ekran (ro'yxatdan o'tish, biznes formalar).
Future<void> soloShot(
    WidgetTester tester, Widget screen, String name, Size s) async {
  _size(tester, s);
  await tester.pumpWidget(ProviderScope(
    overrides: await _overrides(),
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(NfcTokens.ivory),
      locale: const Locale('uz'),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: screen,
    ),
  ));
  await _settle(tester);
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 400)));
  await _settle(tester, 4);
  await expectLater(
      find.byType(MaterialApp), matchesGoldenFile('png/ed-$name.png'));
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    // Musiqa kesh-menejeri vaqtinchalik papka so'raydi.
    final tmp = Directory.systemTemp.createTempSync('ed_shot').path;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (_) async => tmp,
    );
    await _loadFonts();
  });

  for (final e in sizes.entries) {
    final w = e.key;
    final s = e.value;
    testWidgets('home $w', (t) => tabShot(t, Routes.home, 'home-$w', s));
    testWidgets('discover $w',
        (t) => tabShot(t, Routes.discover, 'discover-$w', s));
    testWidgets('nfc $w', (t) => tabShot(t, Routes.nfc, 'nfc-$w', s));
    testWidgets('nfc-end $w',
        (t) => tabShot(t, Routes.nfc, 'nfc-end-$w', s, end: true));
    testWidgets('profile-end $w',
        (t) => tabShot(t, Routes.profile, 'profile-end-$w', s, end: true));
    testWidgets('profile $w',
        (t) => tabShot(t, Routes.profile, 'profile-$w', s));
    testWidgets('biz-intro $w',
        (t) => soloShot(t, const BusinessIntroScreen(), 'biz-intro-$w', s));
    testWidgets('biz-free $w',
        (t) => soloShot(t, const BusinessOnboardScreen(), 'biz-free-$w', s));
    testWidgets('register $w',
        (t) => soloShot(t, const RegisterScreen(), 'register-$w', s));
  }
}
