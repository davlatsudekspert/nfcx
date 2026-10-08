import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/core/utils/sharing.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/activity_repository.dart';
import 'package:nfcstore_nova/features/activity/activity_screen.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/features/settings/invite_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// "DO'STLARNI TAKLIF QILISH" — iPhone va Android.

const _summary = ReferralSummary(
  code: 'ALI77',
  link: 'https://nfcstore.uz/i/ALI77',
  invited: 3,
  rewardedDays: 60,
);

final _ios = TargetPlatformVariant.only(TargetPlatform.iOS);

Future<L> _uz() => L.delegate.load(const Locale('uz'));

Future<void> _pumpInvite(WidgetTester tester) async {
  tester.view.physicalSize = const Size(393 * 3, 1800 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...await testOverrides(),
      referralSummaryProvider.overrideWith((ref) async => _summary),
    ],
    child: wrapScreen(const InviteScreen()),
  ));
  await settle(tester);
}

class _Activity extends ActivityRepository {
  _Activity() : super(ApiClient());
  @override
  Future<Result<NotificationPage>> list({int cursor = 0}) async =>
      const Ok(NotificationPage(items: [
        ActivityEvent(
            id: 9, kind: ActivityKind.referral, title: 'Zafar', read: true),
      ]));
}

void main() {
  test('server javobi va kod qoidasi', () {
    final s = ReferralSummary.fromJson(const {
      'code': 'ALI77',
      'link': 'https://nfcstore.uz/i/ALI77',
      'invited': 3,
      'rewardedDays': 90,
      'nextRewardDays': 30,
    });
    expect([s.invited, s.rewardedMonths, s.nextRewardDays], [3, 3, 30]);
    expect(normalizeInviteCode(' ali77 '), 'ALI77');
    expect(normalizeInviteCode('bad code!'), isNull);
    expect(normalizeInviteCode(''), isNull);
    expect(
        ActivityEvent.fromJson(const {'id': 1, 'type': 'referral_reward'}).kind,
        ActivityKind.referral);
  });

  /// Saytdagi chegirma eslatmasi Android'da ham YO'Q (2026-10-08, Google
  /// Play to'lov qoidasi: ilovadan tashqaridagi xaridga undov,
  /// `showDigitalSiteHints`).
  testWidgets('Android: havola, nusxa/ulashish, natija; chegirma eslatmasi yo‘q',
      (tester) async {
    final shared = <String>[];
    shareInvokerOverride = (text, _) async => shared.add(text);
    addTearDown(() => shareInvokerOverride = null);
    await _pumpInvite(tester);
    final l = await _uz();
    expect(find.text('https://nfcstore.uz/i/ALI77'), findsOneWidget);
    expect(find.text(l.inviteStats(3, 2)), findsOneWidget);
    expect(find.text(l.inviteStep3), findsOneWidget);
    expect(find.textContaining(l.inviteSiteDiscount), findsNothing);
    expect(find.textContaining('chegirma'), findsNothing);
    expect(find.textContaining("so'm"), findsNothing);
    expect(find.text(l.inviteTrialNote), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('invite-share')));
    await settle(tester);
    expect(shared.single, l.inviteShareText('https://nfcstore.uz/i/ALI77'));
    expect(shared.single, contains('https://nfcstore.uz/i/ALI77'));
  });

  testWidgets('iPhone: chegirma ham, narx ham YO‘Q', (tester) async {
    await _pumpInvite(tester);
    final l = await _uz();
    expect(find.text(l.inviteStep3), findsOneWidget);
    expect(find.textContaining(l.inviteSiteDiscount), findsNothing);
    expect(find.textContaining('chegirma'), findsNothing);
    expect(find.textContaining('%'), findsNothing);
    expect(find.textContaining("so'm"), findsNothing);
  }, variant: _ios);

  test('iPhone matnlarida chegirma / narx so‘zi yo‘q (uch tilda)', () async {
    for (final c in ['uz', 'ru', 'en']) {
      final l = await L.delegate.load(Locale(c));
      for (final s in [
        l.inviteTitle,
        l.inviteHeadline,
        l.inviteStep1,
        l.inviteStep2,
        l.inviteStep3,
        l.inviteTrialNote,
        l.inviteShareText('x'),
        l.inviteStats(1, 1),
        l.activityReferralReward,
      ]) {
        expect(s.toLowerCase(),
            isNot(anyOf(contains('chegirma'), contains('скидк'), contains('discount'), contains('%'))),
            reason: '$c: $s');
      }
    }
  });

  testWidgets('Sozlamalar → Hisob: taklif qatori (Android va iPhone)',
      (tester) async {
    tester.view.physicalSize = const Size(393 * 3, 2000 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final opened = <String>[];
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, __) => const SettingsScreen()),
      GoRoute(
          path: Routes.invite,
          builder: (_, __) {
            opened.add(Routes.invite);
            return const Scaffold(body: Text('INVITE'));
          }),
    ]);
    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    ));
    await settle(tester);
    final l = await _uz();
    await tester.tap(find.text(l.inviteTitle));
    await settle(tester);
    expect(opened, [Routes.invite]);
  }, variant: TargetPlatformVariant.only(TargetPlatform.iOS));

  group('/i/<kod> havolasi', () {
    Future<GoRouter> boot(WidgetTester tester, {required bool signedIn}) async {
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final c = ProviderContainer(overrides: [
        ...await testOverrides(signedIn: signedIn),
        referralSummaryProvider.overrideWith((ref) async => _summary),
      ]);
      addTearDown(c.dispose);
      await tester.pumpWidget(
          UncontrolledProviderScope(container: c, child: const NovaApp()));
      for (var i = 0; i < 30; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      return c.read(routerProvider);
    }

    Future<void> frames(WidgetTester tester) async {
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    testWidgets('kirmagan: ro‘yxatdan o‘tish, kod yozilgan', (tester) async {
      final r = await boot(tester, signedIn: false);
      r.go('/i/ali77');
      await frames(tester);
      final uri = r.routerDelegate.currentConfiguration.uri;
      expect(uri.path, Routes.register);
      expect(uri.queryParameters['ref'], 'ALI77');
      final reg = tester.widget<RegisterScreen>(find.byType(RegisterScreen));
      expect(reg.initialPromo, 'ALI77');
    });

    testWidgets('kirgan: taklif ekrani', (tester) async {
      final r = await boot(tester, signedIn: true);
      r.go('/i/ALI77');
      await frames(tester);
      expect(r.routerDelegate.currentConfiguration.uri.path, Routes.invite);
      expect(find.byType(InviteScreen), findsOneWidget);
    });

    testWidgets('yaroqsiz kod — taklif emas', (tester) async {
      final r = await boot(tester, signedIn: false);
      r.go('/i/bad!code');
      await frames(tester);
      expect(r.routerDelegate.currentConfiguration.uri.queryParameters['ref'],
          isNull);
    });

    test('Android App Links: /i/ manifestda', () {
      final m = File('android/app/src/main/AndroidManifest.xml')
          .readAsStringSync();
      expect(m, contains('android:pathPrefix="/i/"'));
    });
  });

  testWidgets('bildirishnoma referral_reward — matn va taklif ekrani',
      (tester) async {
    String? opened;
    final router = GoRouter(initialLocation: '/activity', routes: [
      GoRoute(
        path: '/',
        builder: (_, __) => const SizedBox.shrink(),
        routes: [
          GoRoute(path: 'activity', builder: (_, __) => const ActivityScreen()),
          GoRoute(
              path: 'invite',
              builder: (_, s) {
                opened = s.uri.toString();
                return const SizedBox.shrink();
              }),
        ],
      ),
    ]);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        activityRepositoryProvider.overrideWithValue(_Activity()),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    ));
    await settle(tester);
    final l = await _uz();
    expect(find.text('Zafar'), findsOneWidget);
    expect(find.text(l.activityReferralReward), findsOneWidget);
    await tester.tap(find.text(l.activityReferralReward));
    await settle(tester);
    expect(opened, Routes.invite);
  });
}
