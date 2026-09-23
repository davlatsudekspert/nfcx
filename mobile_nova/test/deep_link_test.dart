import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// Sessiya tiklanishi QO'LDA tugaydi — Splash oralig'ini sinash uchun.
class _SlowAuth extends FakeAuthRepository {
  final gate = Completer<void>();

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async {
    await gate.future;
    return super.restore();
  }
}

Future<void> _frames(WidgetTester tester, [int n = 20]) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// DEEP LINK / NFC KARTA — tasdiqlangan audit topilmalari (F-H1, F-H2).
void main() {
  late ProviderContainer c;

  Future<GoRouter> boot(WidgetTester tester, {_SlowAuth? auth}) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    c = ProviderContainer(overrides: [
      ...await testOverrides(),
      if (auth != null) authRepositoryProvider.overrideWithValue(auth),
    ]);
    addTearDown(c.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: const NovaApp(),
    ));
    await _frames(tester);
    return c.read(routerProvider);
  }

  String loc(GoRouter r) => r.routerDelegate.currentConfiguration.uri.path;

  testWidgets('sessiya tiklanayotganda kelgan havola YO‘QOLMAYDI', (tester) async {
    final auth = _SlowAuth();
    final r = await boot(tester, auth: auth);
    r.go(Routes.user('VIP001'));
    await _frames(tester, 6);
    expect(loc(r), Routes.splash, reason: 'tiklanish paytida Splash');

    auth.gate.complete();
    await _frames(tester, 30);
    expect(loc(r), Routes.user('VIP001'),
        reason: 'sessiya faol bo‘lgach asl manzilga borishi kerak edi');
  });

  testWidgets('NFC karta havolasi /<KOD> va /<KOD>?t= profilga olib boradi',
      (tester) async {
    final r = await boot(tester);
    r.go('/vip001?t=abc');
    await _frames(tester, 20);
    expect(loc(r), Routes.user('VIP001'));
  });

  testWidgets('ilova yo‘llari karta havolasi deb olinmaydi', (tester) async {
    final r = await boot(tester);
    r.go(Routes.shop);
    await _frames(tester, 20);
    expect(loc(r), Routes.shop);
  });

  testWidgets('ro‘yxatdan o‘tgach profil sozlash ekrani OCHILADI',
      (tester) async {
    final r = await boot(tester);
    r.go(Routes.profileSetup);
    await _frames(tester, 20);
    expect(loc(r), Routes.profileSetup,
        reason: 'faol sessiya /register/setup ni Home ga burib yubordi');
  });

  testWidgets('chiqishdan keyin turgan ekran keyingi kirishga YOPISHMAYDI',
      (tester) async {
    final r = await boot(tester);
    r.go(Routes.settings);
    await _frames(tester, 10);
    await c.read(sessionProvider.notifier).logout();
    await _frames(tester, 20);
    expect(loc(r), Routes.welcome);
    await c.read(sessionProvider.notifier).adopt(testUser);
    await _frames(tester, 20);
    expect(loc(r), Routes.home);
  });
}
