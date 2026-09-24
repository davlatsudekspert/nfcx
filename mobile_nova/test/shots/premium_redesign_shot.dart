@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/shop/nfc_id_market.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import '../helpers.dart';

/// PREMIUM REDIZAYN (2026-09) — Home, Profil va pastki navigatsiya.
///
///   flutter test test/shots/premium_redesign_shot.dart \
///     --run-skipped -t shots --update-goldens
class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());

  static const biz = Business(
    companyId: 'NFCSTOREUZ',
    displayName: 'NFCSTORE',
    subcategory: 'Digital Identity & MarTech',
    city: 'Toshkent',
    address: 'Amir Temur ko‘chasi, 12',
    status: 'published',
    tier: 'gold',
    logoUrl: 'assets/demo/m_card_metal.jpg',
    description: 'NFCSTORE.UZ — shaxsiy va biznes raqamli profillar, noyob '
        'NFC ID va zamonaviy NFC mahsulotlari bitta platformada.',
    followers: 128,
    views: 5400,
    openNow: true,
    todayOpen: '09:00',
    todayClose: '20:00',
    ordersEnabled: true,
    contact: ContactInfo(
      phone: '+998901234567',
      telegram: 'nfcstoreuz',
      whatsapp: '+998901234567',
      instagram: 'nfcstore.uz',
      facebook: 'nfcstoreuz',
      address: 'Toshkent',
    ),
  );

  static final items = [
    for (final (i, n, img, p, sp) in [
      (1, 'NFC ID Karta', 'm_cards.jpg', 220000, 200000),
      (2, 'NFC Uzuk', 'm_product_duo.jpg', 550000, 500000),
      (3, 'NFC Brelok', 'm_gift_set.jpg', 110000, 100000),
      (4, 'NFC Braslet', 'm_card_metal.jpg', 750000, 710000),
      (5, 'NFC Sticker', 'm_stickers.jpg', 75000, 70000),
      (6, 'NFC Stend', 'm_stand.jpg', 150000, 130000),
      (7, 'Korporativ NFC sovg‘a', 'm_hero.jpg', 750000, 710000),
      (8, 'NFC ID Sovg‘a Konverti', 'm_gift_set.jpg', 330000, 300000),
    ])
      CatalogItem(
        id: i,
        ref: 'item-$i',
        name: n,
        description: 'Raqamli profilingizni bir teginishda ulashing.',
        imageUrl: 'assets/demo/$img',
        price: p,
        salePrice: sp,
      ),
  ];

  @override
  Future<Result<Business>> byId(String companyId) async =>
      Ok(companyId == 'NFCSTOREUZ'
          ? biz
          : Business(
              companyId: companyId,
              displayName: companyId == 'CAFEUZ' ? 'Bellissimo' : 'Grand Auto',
              subcategory:
                  companyId == 'CAFEUZ' ? 'Kafe va restoran' : 'Avtomobil savdosi',
              city: 'Andijon',
              address: 'Bobur shoh ko‘chasi 12',
              coverUrl: companyId == 'CAFEUZ' ? 'assets/demo/z_post_cafe.jpg' : '',
              openNow: companyId == 'CAFEUZ',
              todayOpen: '09:00',
              todayClose: '23:00',
              followers: 42,
            ));

  @override
  Future<Result<List<CatalogItem>>> catalog(String companyId) async =>
      Ok(companyId == 'NFCSTOREUZ' ? items : const <CatalogItem>[]);

  @override
  Future<Result<List<Post>>> posts(String companyId) async => const Ok([]);

  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);
}

class _Disc extends DiscoverRepository {
  _Disc() : super(ApiClient());

  static const people = [
    NfcId(code: 'VIP001', name: 'Muhammad', role: 'Davlat Sud Ekspert',
        avatarUrl: 'assets/demo/z_portrait.jpg', tier: 'exclusive',
        posts: 9, followers: 5, following: 12),
    NfcId(code: 'PPP777', name: 'Mashrabboy',
        avatarUrl: 'assets/demo/z_post_rooftop.jpg', tier: 'premium',
        posts: 0, followers: 5, following: 4),
    NfcId(code: 'ONE111', name: 'One Brand (Abdurahmon)', tier: 'gold',
        posts: 0, followers: 1, following: 0),
    NfcId(code: 'ALI011', name: 'Aliyorbek', role: 'Developer',
        avatarUrl: 'assets/demo/z_post_evening.jpg',
        posts: 1, followers: 5, following: 3),
  ];

  @override
  Future<Result<List<NfcId>>> suggested() async => const Ok(people);

  @override
  Future<Result<List<Business>>> companies() async => const Ok([
        Business(companyId: 'NFCSTOREUZ', displayName: 'NFCSTORE',
            category: 'shop', city: 'Toshkent',
            coverUrl: 'assets/demo/m_hero.jpg',
            logoUrl: 'assets/demo/m_card_metal.jpg'),
        Business(companyId: 'CAFEUZ', displayName: 'Bellissimo',
            category: 'restaurant', city: 'Andijon',
            coverUrl: 'assets/demo/z_post_cafe.jpg'),
        Business(companyId: 'GRANDAUTO', displayName: 'Grand Auto',
            category: 'services', city: 'Andijon'),
      ]);
}

class _Social extends SocialRepository {
  _Social() : super(ApiClient());

  static final _stories = [
    StoryItem(
      id: 1,
      code: 'VIP001',
      authorName: 'Muhammad',
      caption: 'Yangi NFC kartalar',
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
    ),
  ];

  static final _posts = [
    for (var i = 0; i < 6; i++)
      Post(
        id: 40 + i,
        code: 'VIP001',
        authorName: 'Muhammad',
        text: 'Post $i',
        mediaUrls: [
          [
            'assets/demo/z_post_nfc.jpg',
            'assets/demo/z_post_cafe.jpg',
            'assets/demo/z_post_rooftop.jpg',
            'assets/demo/m_card_metal.jpg',
            'assets/demo/z_post_evening.jpg',
            'assets/demo/m_cards.jpg',
          ][i]
        ],
        createdAt: DateTime(2026, 9, 20 - i),
      ),
  ];

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => Ok(_stories);
  @override
  Future<Result<List<StoryItem>>> followedStories() async => const Ok([]);
  @override
  Future<Result<List<Post>>> feed({int page = 1}) async => Ok(_posts);
  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(_posts);
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final fams = {
      'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
      'Manrope': [
        'assets/fonts/Manrope-400.ttf',
        'assets/fonts/Manrope-500.ttf',
        'assets/fonts/Manrope-600.ttf',
        'assets/fonts/Manrope-700.ttf',
      ],
      'IBMPlexMono': [
        'assets/fonts/IBMPlexMono-400.ttf',
        'assets/fonts/IBMPlexMono-500.ttf',
        'assets/fonts/IBMPlexMono-600.ttf',
      ],
      'PlayfairDisplay': ['assets/fonts/PlayfairDisplay-500.ttf'],
    };
    for (final f in fams.entries) {
      final loader = FontLoader(f.key);
      for (final p in f.value) {
        if (File(p).existsSync()) loader.addFont(rootBundle.load(p));
      }
      await loader.load();
    }
    // NovaIcons = CupertinoIcons (paket shrifti).
    final cup = File('${Platform.environment['HOME']}/.pub-cache/hosted/'
        'pub.dev/cupertino_icons-1.0.9/assets/CupertinoIcons.ttf');
    if (cup.existsSync()) {
      await (FontLoader('packages/cupertino_icons/CupertinoIcons')
            ..addFont(Future.value(cup.readAsBytesSync().buffer.asByteData())))
          .load();
    }
    final root = Platform.environment['FLUTTER_ROOT'] ?? '';
    final icons = File(
        '$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      await (FontLoader('MaterialIcons')
            ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData())))
          .load();
    }
  });

  Future<void> settle(WidgetTester tester, [int n = 16]) async {
    for (var i = 0; i < n; i++) {
      await tester.pump(const Duration(milliseconds: 80));
      // Asset rasmlar haqiqiy vaqtda dekodlanadi.
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 30)));
    }
  }

  Future<void> app(WidgetTester tester, String route, String name,
      {Size size = const Size(390, 844),
      bool business = false,
      bool bizTab = false,
      String? push}) async {
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2.0;
    tester.view.padding = const FakeViewPadding(top: 64, bottom: 48);
    tester.view.viewPadding = const FakeViewPadding(top: 64, bottom: 48);
    addTearDown(tester.view.reset);
    debugDisableShadows = false;
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      socialRepositoryProvider.overrideWithValue(_Social()),
      businessRepositoryProvider.overrideWithValue(_Biz()),
      discoverRepositoryProvider.overrideWithValue(_Disc()),
      idPricingProvider.overrideWith((ref) async => const [
            IdTier(tier: 'exclusive', price: 490000, from: true),
            IdTier(tier: 'premium', price: 199000),
            IdTier(tier: 'gold', price: 149000),
            IdTier(tier: 'silver', price: 99000),
            IdTier(tier: 'free', price: 49000),
          ]),
      authRepositoryProvider.overrideWithValue(FakeAuthRepository(ids: const [
        NfcId(
            code: 'VIP001',
            name: 'Muhammad',
            role: 'Davlat Sud Ekspert',
            avatarUrl: 'assets/demo/z_portrait.jpg',
            primary: true,
            tier: 'exclusive',
            views: 193,
            followers: 5,
            following: 4,
            posts: 9,
            contact: ContactInfo(
              phone: '+998901234567',
              telegram: 'nfcstoreuz',
              whatsapp: '+998901234567',
              instagram: 'nfcstore.uz',
              facebook: 'nfcstoreuz',
              address: 'Toshkent',
            ),
            cardLinked: true),
        NfcId(code: 'ALI777', name: 'Oybek', tier: 'premium', views: 2),
        NfcId(code: 'XYZ007', name: 'Tohir', tier: 'gold', views: 5),
        NfcId(code: 'LOL101', name: 'Shaxnoza', tier: 'silver', views: 3),
        NfcId(code: 'MXK413', name: 'Aziz', tier: 'free', views: 1),
      ])),
    ]);
    addTearDown(c.dispose);
    await c.read(prefsProvider)
        .setThemeId(Platform.environment['THEME'] ?? 'ivory');
    if (business) await c.read(prefsProvider).setMode('business');
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: const NovaApp(),
    ));
    await settle(tester);
    c.read(routerProvider).go(route);
    await settle(tester, 24);
    if (bizTab) {
      c.read(discoverTabProvider.notifier).state = DiscoverTab.businesses;
      await settle(tester, 24);
    }
    if (push != null) {
      c.read(routerProvider).push(push);
      await settle(tester, 24);
    }
    await expectLater(
        find.byType(MaterialApp), matchesGoldenFile('png/$name.png'));
    debugDisableShadows = true;
  }

  final tag = Platform.environment['SHOT_TAG'] ?? 'now';
  testWidgets('Home 390', (t) async {
    await app(t, Routes.home, 'redesign-$tag-home',
        size: const Size(390, 1400));
  });
  testWidgets('Home 390 ekran', (t) async {
    await app(t, Routes.home, 'redesign-$tag-home-fold');
  });
  testWidgets('Profil 390', (t) async {
    await app(t, Routes.profile, 'redesign-$tag-profile',
        size: const Size(390, 1250));
  });
  testWidgets('Tanlov -> profil (pastki panel bilan)', (t) async {
    await app(t, Routes.discover, 'redesign-$tag-user-from-discover',
        push: Routes.user('VIP001'));
  });
  testWidgets('NFC IDlarim', (t) async {
    await app(t, Routes.nfcIds, 'redesign-$tag-my-ids',
        size: const Size(390, 1500));
  });
  testWidgets('Sovga', (t) async {
    await app(t, Routes.nfcGift('ALI777'), 'redesign-$tag-gift');
  });
  testWidgets('NFC ID olish', (t) async {
    await app(t, Routes.nfcMarket, 'redesign-$tag-id-market');
  });
  testWidgets('Tanlov bizneslar', (t) async {
    await app(t, Routes.discover, 'redesign-$tag-discover-biz',
        size: const Size(390, 1100), bizTab: true);
  });
  testWidgets('Tanlov bizneslar 360', (t) async {
    await app(t, Routes.discover, 'redesign-$tag-discover-biz-360',
        size: const Size(360, 1100), bizTab: true);
  });
  testWidgets('Biznes profil', (t) async {
    await app(t, Routes.discover, 'redesign-$tag-company',
        size: const Size(390, 2300), push: Routes.storefront('NFCSTOREUZ'));
  });
  testWidgets('Biznes profil 360', (t) async {
    await app(t, Routes.discover, 'redesign-$tag-company-360',
        size: const Size(360, 2300), push: Routes.storefront('NFCSTOREUZ'));
  });
  testWidgets('Biznes profil ekran', (t) async {
    await app(t, Routes.discover, 'redesign-$tag-company-fold',
        push: Routes.storefront('NFCSTOREUZ'));
  });
  testWidgets('Biznes katalog', (t) async {
    await app(t, Routes.discover, 'redesign-$tag-store-catalog',
        size: const Size(390, 1900),
        push: Routes.storeCatalog('NFCSTOREUZ'));
  });
  testWidgets('Biznes katalog toifa', (t) async {
    await app(t, Routes.discover, 'redesign-$tag-store-catalog-cat',
        push: Routes.storeCatalog('NFCSTOREUZ', category: 'promo'));
  });
  testWidgets('Biznes tovar', (t) async {
    await app(t, Routes.discover, 'redesign-$tag-store-product',
        size: const Size(390, 1500),
        push: Routes.catalogProduct('NFCSTOREUZ', 'item-1'));
  });
  testWidgets('Tanlov', (t) async {
    await app(t, Routes.discover, 'redesign-$tag-discover',
        size: const Size(390, 1200));
  });
  testWidgets('NFC markazi', (t) async {
    await app(t, Routes.nfc, 'redesign-$tag-nfc', size: const Size(390, 1200));
  });
  testWidgets('Reels', (t) async {
    await app(t, Routes.reels, 'redesign-$tag-reels');
  });
  testWidgets('Post', (t) async {
    await app(t, Routes.home, 'redesign-$tag-post',
        push: Routes.post(40, code: 'VIP001'));
  });
  testWidgets('Lenta', (t) async {
    await app(t, Routes.home, 'redesign-$tag-feed',
        size: const Size(390, 2600));
  });
  testWidgets('Profil 360', (t) async {
    await app(t, Routes.profile, 'redesign-$tag-profile-360',
        size: const Size(360, 1100));
  });
  testWidgets('Profil 430', (t) async {
    await app(t, Routes.profile, 'redesign-$tag-profile-430',
        size: const Size(430, 1100));
  });
  testWidgets('Home 360', (t) async {
    await app(t, Routes.home, 'redesign-$tag-home-360',
        size: const Size(360, 780));
  });
}
