import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

class _BizRepo extends BusinessRepository {
  _BizRepo() : super(ApiClient());

  @override
  Future<Result<List<Business>>> mine() async => const Ok([
        Business(companyId: 'ELITE', displayName: 'Elite Qurilish'),
        Business(companyId: 'NFCSTOREUZ', displayName: 'NFCSTORE'),
      ]);
}

const _ids = [
  NfcId(code: 'VIP001', name: 'Muhammad', primary: true, followers: 5),
  NfcId(code: 'UZD772', name: 'Oybek'),
  NfcId(code: 'TTS075', name: 'Tohir'),
];

Future<void> _frames(WidgetTester tester, [int n = 30]) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// PROFILDA ALMASHTIRIB, BOSH SAHIFAGA O'TISH.
///
/// Egasi (2026-09): "profildan almashtirib bosh menyuga o'tsa qotib
/// qolyapti". Butun ilova (router + tablar) bilan takrorlanadi.
void main() {
  Future<ProviderContainer> boot(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final container = ProviderContainer(overrides: [
      ...await testOverrides(),
      authRepositoryProvider.overrideWithValue(FakeAuthRepository(ids: _ids)),
      businessRepositoryProvider.overrideWithValue(_BizRepo()),
    ]);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const NovaApp(),
    ));
    await _frames(tester);
    container.read(routerProvider).go(Routes.profile);
    await _frames(tester);
    return container;
  }

  testWidgets('boshqa NFC ID tanlab, bosh sahifaga o‘tish', (tester) async {
    final c = await boot(tester);
    c.read(selectedPersonalCodeProvider.notifier).state = 'UZD772';
    await _frames(tester);
    c.read(routerProvider).go(Routes.home);
    await _frames(tester, 60);
    expect(tester.takeException(), isNull);
    expect(c.read(activeProfileProvider)?.code, 'UZD772');
    expect(find.text('UZD772'), findsWidgets);
  });

  testWidgets('biznesga o‘tib, bosh sahifaga o‘tish', (tester) async {
    final c = await boot(tester);
    c.read(selectedBusinessProvider.notifier).state = 'NFCSTOREUZ';
    await c.read(modeProvider.notifier).set(AppMode.business);
    await _frames(tester);
    c.read(routerProvider).go(Routes.home);
    await _frames(tester, 60);
    expect(tester.takeException(), isNull);
    expect(c.read(activeProfileProvider)?.isBusiness, isTrue);
    expect(find.text('NFCSTORE'), findsWidgets);

    // Va qaytib shaxsiyga.
    await c.read(modeProvider.notifier).set(AppMode.personal);
    await _frames(tester, 40);
    expect(tester.takeException(), isNull);
    expect(find.text('VIP001'), findsWidgets);
  });
}
