import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/premium/premium_access.dart';
import 'package:nfcstore_nova/features/profile/profile_edit_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// PROFIL QO'SHIQLARI CHEGARASI — yagona manba (`profileMusicLimit`).
///
/// Server (`musicLimitD1`): to'langan Premium (saytda yoki App
/// Store'da) yoki faol bepul sinov — 10 ta, aks holda 5 ta. Ilova
/// ikkala platformada bir xil chegarani qo'llaydi.

User _paid() => User(
    id: 1,
    email: 'p@b.uz',
    premiumUntil: DateTime.now().add(const Duration(days: 20)));
User _legacy() => const User(id: 1, email: 'l@b.uz', premium: true);
User _trial() => User(
    id: 1,
    email: 't@b.uz',
    trialUntil: DateTime.now().add(const Duration(days: 60)));
User _expired() => User(
    id: 1,
    email: 'e@b.uz',
    trialUntil: DateTime.now().subtract(const Duration(days: 1)),
    premiumUntil: DateTime.now().subtract(const Duration(days: 3)));
User _free() => const User(id: 1, email: 'f@b.uz');

class _Auth extends FakeAuthRepository {
  _Auth(this.user)
      : super(ids: const [
          NfcId(code: '48210377', name: 'Test', primary: true),
        ]);
  final User user;

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async =>
      Ok((user: user, ids: ids));
}

class _Repo extends ProfileRepository {
  _Repo() : super(ApiClient());
}

Future<void> _pump(WidgetTester tester, User user) async {
  tester.view.physicalSize = const Size(393 * 3, 2400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...await testOverrides(),
      authRepositoryProvider.overrideWithValue(_Auth(user)),
      profileRepositoryProvider.overrideWithValue(_Repo()),
    ],
    child: MaterialApp.router(
      routerConfig: GoRouter(initialLocation: '/edit', routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const SizedBox.shrink(),
          routes: [
            GoRoute(
                path: 'edit', builder: (_, __) => const ProfileEditScreen()),
          ],
        ),
      ]),
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
  await settle(tester, frames: 20);
  final section = find.byKey(const ValueKey('edit-section-music'));
  await tester.scrollUntilVisible(section, 300,
      scrollable: find.byType(Scrollable).first);
  await settle(tester, frames: 4);
}

void main() {
  group('profileMusicLimit — yagona manba', () {
    final now = DateTime(2026, 10, 6, 12);
    test('to‘langan Premium (muddatli va eski muddatsiz) — 10', () {
      expect(
          profileMusicLimit(
              User(
                  id: 1,
                  email: 'a',
                  premiumUntil: now.add(const Duration(days: 1))),
              now: now),
          kMusicPremiumLimit);
      expect(profileMusicLimit(_legacy(), now: now), 10);
    });
    test('faol bepul sinov — 10', () {
      expect(
          profileMusicLimit(
              User(
                  id: 1,
                  email: 'a',
                  trialUntil: now.add(const Duration(minutes: 1))),
              now: now),
          10);
    });
    test('oddiy / sinov va obuna tugagan / sessiyasiz — 5', () {
      expect(profileMusicLimit(_free(), now: now), kMusicFreeLimit);
      expect(
          profileMusicLimit(
              User(
                  id: 1,
                  email: 'a',
                  trialUntil: now.subtract(const Duration(seconds: 1)),
                  premiumUntil: now.subtract(const Duration(days: 1))),
              now: now),
          5);
      expect(profileMusicLimit(null, now: now), 5);
    });
    test('premiumAccessActive va sinov kunlari bir mantiqdan', () {
      final t = User(
          id: 1, email: 'a', trialUntil: now.add(const Duration(days: 3)));
      expect(premiumAccessActive(t, now: now), isTrue);
      expect(iapTrialDaysLeft(t, now: now), 3);
      expect(premiumAccessActive(_free(), now: now), isFalse);
      expect(iapTrialDaysLeft(_free(), now: now), isNull);
    });
  });

  // Tahrir ekranidagi hisoblagich — iPhone ham, Android ham.
  for (final ios in [true, false]) {
    final variant = TargetPlatformVariant.only(
        ios ? TargetPlatform.iOS : TargetPlatform.android);
    final p = ios ? 'iPhone' : 'Android';
    for (final (name, user, max) in [
      ('to‘langan Premium', _paid, 10),
      ('eski muddatsiz Premium', _legacy, 10),
      ('faol bepul sinov', _trial, 10),
      ('sinov va obuna tugagan', _expired, 5),
      ('oddiy hisob', _free, 5),
    ]) {
      testWidgets('$p, $name: profil qo‘shiqlari 0/$max', (tester) async {
        await _pump(tester, user());
        expect(tester.takeException(), isNull);
        expect(find.text('0/$max'), findsOneWidget);
        expect(find.text('0/${max == 10 ? 5 : 10}'), findsNothing);
      }, variant: variant);
    }
  }
}
