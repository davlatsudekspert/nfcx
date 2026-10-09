import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/app_config_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/home/widgets/showcase_ad_card.dart';
import 'package:nfcstore_nova/features/showcase/showcase_screen.dart'
    show showcaseFocusProvider;
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// ASOSIYDAGI KO'RGAZMA REKLAMASI — `/api/showcase/ads?video=1`.
class _AdsRepo extends FakeSocialRepository {
  _AdsRepo({this.items = const [], this.fail = false});
  final List<Post> items;
  final bool fail;
  int calls = 0;

  @override
  Future<Result<ReelsPage>> showcaseAds({int limit = 4}) async {
    calls++;
    if (fail) return const Err(AppError(AppErrorKind.offline));
    return Ok(ReelsPage(items: items));
  }
}

class _Api extends ApiClient {
  final gets = <(String, Map<String, dynamic>?)>[];

  @override
  Future<Result<T>> get<T>(String path, {Map<String, dynamic>? query}) async {
    gets.add((path, query));
    return Ok(
      <String, dynamic>{
            'items': [
              {
                'id': 900,
                'ad': true,
                'featured': true,
                'adSlot': 3,
                'title': 'Boy777',
                'videoUrl': '/uploads/promo_boy777.mp4',
                'imageUrl': '/promo/boy777.jpg',
              },
            ],
            'hasMore': false,
            'nextCursor': null,
          }
          as T,
    );
  }
}

Post _ad(int id, String name) => Post.fromJson({
  'id': id,
  'code': 'NFCSTORE',
  'authorName': 'NFCSTORE',
  'ad': true,
  'featured': true,
  'title': name,
  'text': 'Yangi NFC kartalar',
  'videoUrl': '/uploads/promo_${name.toLowerCase()}.mp4',
  'imageUrl': '/promo/${name.toLowerCase()}.jpg',
});

final _boy = _ad(900, 'BOY777');
final _lol = _ad(901, 'LOL707');

const _card = ValueKey('home-ad-card');

Future<({ProviderContainer c, _AdsRepo repo, GoRouter router})> _pump(
  WidgetTester tester, {
  List<Post>? items,
  bool fail = false,
  bool flag = true,
  double above = 120,
  Future<void> Function(Prefs p)? beforeShow,
}) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final repo = _AdsRepo(items: items ?? [_boy, _lol], fail: fail);
  final base = await testOverrides();
  final prefs = await Prefs.open();
  // Kalit holati — `AppFlagsController` keshdan boshlanadi.
  await prefs.setAppFlagsJson(AppFlags(showcase: flag).encode());
  await beforeShow?.call(prefs);
  final c = ProviderContainer(
    overrides: [...base, socialRepositoryProvider.overrideWithValue(repo)],
  );
  addTearDown(c.dispose);
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (_, __) => Scaffold(
          body: ListView(
            key: const ValueKey('home-list'),
            children: [
              SizedBox(height: above),
              const HomeShowcaseAdCard(),
              const SizedBox(height: 1200),
            ],
          ),
        ),
      ),
      GoRoute(
        path: Routes.showcase,
        builder: (_, __) => const Scaffold(body: Text('SHOWCASE')),
      ),
    ],
  );
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: c,
      child: MaterialApp.router(
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
      ),
    ),
  );
  await settle(tester, frames: 4);
  await _drain(tester);
  return (c: c, repo: repo, router: router);
}

Future<void> _drain(WidgetTester tester) async {
  await tester.runAsync(
    () => Future<void>.delayed(const Duration(milliseconds: 40)),
  );
  await settle(tester, frames: 4);
}

void main() {
  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/path_provider'),
          (_) async => Directory.systemTemp.createTempSync('nova').path,
        );
  });
  setUp(() => VideoPlayerPlatform.instance = FakeVideoPlatform());
  tearDown(() => homeAdClock = DateTime.now);

  test('so‘rov: /api/showcase/ads, video=1 doim, Ko‘rgazma modeli', () async {
    final api = _Api();
    final res = await SocialRepository(api).showcaseAds();
    expect(api.gets.single.$1, '/api/showcase/ads');
    expect(api.gets.single.$2, {'video': 1, 'limit': 4});
    final p = res.valueOrNull!.items.single;
    expect(p.isShowcaseVideoAd, isTrue);
    expect(p.videoUrl, 'https://nfcstore.uz/uploads/promo_boy777.mp4');
    expect(p.posterUrl, 'https://nfcstore.uz/promo/boy777.jpg');
  });

  test('navbat: kun va ochilish bo‘yicha almashadi', () {
    final day = DateTime(2026, 10, 9, 15);
    final a = homeAdIndex(2, day: day, launch: 1);
    final b = homeAdIndex(2, day: day, launch: 2);
    expect(a, isNot(b), reason: 'keyingi ochilish — boshqa reklama');
    final tomorrow = homeAdIndex(
      2,
      day: day.add(const Duration(days: 1)),
      launch: 1,
    );
    expect(tomorrow, isNot(a), reason: 'ertaga — boshqa reklama');
    // Kun ichidagi soat ahamiyatsiz.
    expect(homeAdIndex(2, day: DateTime(2026, 10, 9, 1), launch: 1), a);
    expect(homeAdIndex(0, day: day, launch: 5), 0);
    for (var n = 1; n <= 4; n++) {
      final seen = {
        for (var i = 0; i < n; i++) homeAdIndex(n, day: day, launch: i),
      };
      expect(seen, hasLength(n), reason: 'hammasi navbat bilan: $n');
    }
    expect(homeAdDay(DateTime(2026, 1, 5)), '2026-01-05');
  });

  testWidgets('har ochilishda boshqa reklama (BOY777 / LOL707)', (
    tester,
  ) async {
    final titles = <String>{};
    for (var launch = 0; launch < 2; launch++) {
      await _pump(tester, beforeShow: (p) => p.setHomeAdLaunch(launch));
      titles.add(
        tester.widget<Text>(find.byKey(const ValueKey('home-ad-title'))).data!,
      );
      await tester.pumpWidget(const SizedBox());
    }
    expect(titles, {'BOY777', 'LOL707'});
    expect((await Prefs.open()).homeAdLaunch, 2, reason: 'har ochilishda +1');
    await tester.pump(const Duration(minutes: 1));
  });

  testWidgets('bo‘sh javob, xato yoki kalit o‘chiq — hech narsa chizilmaydi', (
    tester,
  ) async {
    Future<void> expectNothing() async {
      expect(find.byKey(_card), findsNothing);
      expect(find.text(LUz().feedSponsored), findsNothing);
      // Bo'sh joy ham yo'q: karta o'rni nol balandlikda.
      expect(tester.getSize(find.byType(HomeShowcaseAdCard)).height, 0);
      await tester.pumpWidget(const SizedBox());
    }

    await _pump(tester, items: const []);
    await expectNothing();
    await _pump(tester, fail: true);
    await expectNothing();
    final off = await _pump(tester, flag: false);
    expect(off.repo.calls, 0, reason: 'kalit o‘chiq — so‘rov ham yo‘q');
    await expectNothing();
  });

  testWidgets('karta: "Reklama", ×, sarlavha; video OVOZSIZ, faqat ko‘rinsa va '
      'Asosiy tab ochiq bo‘lsa', (tester) async {
    final v = FakeVideoPlatform();
    VideoPlayerPlatform.instance = v;
    final r = await _pump(tester, items: [_boy], above: 1000);
    // Karta qurilgan (ro'yxat keshida), lekin ekranda emas — pleer yo'q.
    expect(find.byKey(_card, skipOffstage: false), findsOneWidget);
    expect(find.text(LUz().feedSponsored, skipOffstage: false), findsOneWidget);
    expect(
      find.byKey(const ValueKey('home-ad-close'), skipOffstage: false),
      findsOneWidget,
    );
    expect(v.created, isEmpty, reason: 'ko‘rinmaydi — video ochilmaydi');

    // To'liq ko'rinadi — ovozsiz o'ynaydi.
    await tester.drag(
      find.byKey(const ValueKey('home-list')),
      const Offset(0, -700),
    );
    await settle(tester, frames: 4);
    await _drain(tester);
    expect(v.created, hasLength(1));
    final id = v.created.single;
    expect(v.urls[id], 'https://nfcstore.uz/uploads/promo_boy777.mp4');
    expect(v.playing, {id});
    expect(v.volumeOf[id], 0.0, reason: 'Asosiyda ovoz yo‘q');
    expect(v.mixCalls, [true], reason: 'boshqa ilova ovozi to‘xtamaydi');

    // Kartaning faqat ~30% i ko'rinadi — pauza (pleer saqlanadi).
    final card = tester.getRect(find.byKey(_card));
    await tester.drag(
      find.byKey(const ValueKey('home-list')),
      Offset(0, -(card.bottom - card.height * .3)),
    );
    await settle(tester, frames: 4);
    await _drain(tester);
    final now = tester.getRect(find.byKey(_card));
    expect(now.bottom, lessThan(now.height * .5));
    expect(v.playing, isEmpty, reason: '60% dan kam ko‘rinadi');
    expect(v.alive, {id});

    // Yana to'liq ko'rinadi — davom etadi.
    await tester.drag(
      find.byKey(const ValueKey('home-list')),
      Offset(0, card.bottom - card.height * .3),
    );
    await settle(tester, frames: 4);
    await _drain(tester);
    expect(v.playing, {id});

    // Boshqa tab — yo'q qilinadi; qaytilsa yangi pleer, yana ovozsiz.
    r.c.read(activeTabProvider.notifier).state = kShowcaseTab;
    await settle(tester, frames: 4);
    await _drain(tester);
    expect(v.playing, isEmpty);
    expect(v.alive, isEmpty);
    r.c.read(activeTabProvider.notifier).state = 0;
    await settle(tester, frames: 4);
    await _drain(tester);
    expect(v.created, hasLength(2));
    expect(v.playing, {v.created.last});
    expect(v.volumeOf[v.created.last], 0.0);

    // Ilova fonda — yo'q qilinadi.
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await settle(tester, frames: 2);
    await _drain(tester);
    expect(v.alive, isEmpty);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await settle(tester, frames: 2);
    await _drain(tester);
    expect(v.playing, {v.created.last}, reason: 'qaytildi — yana o‘ynaydi');
    expect(v.volumeOf[v.created.last], 0.0);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(minutes: 1));
  });

  testWidgets('× — shu kun oxirigacha yashirin, ertaga qaytadi', (
    tester,
  ) async {
    homeAdClock = () => DateTime(2026, 10, 9, 12);
    final r = await _pump(tester, items: [_boy]);
    expect(find.byKey(_card), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('home-ad-close')));
    await settle(tester, frames: 4);
    expect(find.byKey(_card), findsNothing);
    expect(r.c.read(prefsProvider).homeAdHiddenDay, '2026-10-09');
    expect(r.c.read(showcaseFocusProvider), isNull, reason: '× ochmaydi');
    expect(r.router.routerDelegate.currentConfiguration.uri.toString(), '/');
    await tester.pumpWidget(const SizedBox());

    // Shu kun, ilova qayta ochildi — hamon yashirin.
    homeAdClock = () => DateTime(2026, 10, 9, 23, 59);
    await _pump(
      tester,
      items: [_boy],
      beforeShow: (p) => p.setHomeAdHiddenDay('2026-10-09'),
    );
    expect(find.byKey(_card), findsNothing);
    await tester.pumpWidget(const SizedBox());

    // Ertasi kun — yana chiqadi.
    homeAdClock = () => DateTime(2026, 10, 10, 8);
    await _pump(
      tester,
      items: [_boy],
      beforeShow: (p) => p.setHomeAdHiddenDay('2026-10-09'),
    );
    expect(find.byKey(_card), findsOneWidget);
  });

  testWidgets('bosilsa — Ko‘rgazma tabi shu reklama bilan', (tester) async {
    final v = FakeVideoPlatform();
    VideoPlayerPlatform.instance = v;
    final r = await _pump(tester, items: [_lol]);
    expect(v.playing, hasLength(1));
    await tester.tap(find.byKey(const ValueKey('home-ad-title')));
    await settle(tester, frames: 6);
    await _drain(tester);
    expect(
      r.router.routerDelegate.currentConfiguration.uri.toString(),
      Routes.showcase,
    );
    expect(find.text('SHOWCASE'), findsOneWidget);
    expect(r.c.read(showcaseFocusProvider)?.id, _lol.id);
    expect(v.alive, isEmpty, reason: 'kartadagi pleer yopildi');
  });
}
