import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// BIZNES PROFIL POSTLARI — "QAYTA URINISH" TO'G'RI MANBANI YANGILAYDI
/// (UI auditi, UIQ-1).
///
/// Biznes profilda to'r `companyPostsProvider` ni ko'rsatadi, lekin
/// xato paneli va pastga tortib yangilash `profilePostsProvider` ni
/// yangilardi — xato hech qachon ketmasdi.
class _BizRepo extends BusinessRepository {
  _BizRepo() : super(ApiClient());

  bool offline = true;
  int postCalls = 0;

  @override
  Future<Result<List<Business>>> mine() async =>
      const Ok([Business(companyId: 'ELITE', displayName: 'Elite Qurilish')]);

  @override
  Future<Result<List<Post>>> posts(String companyId) async {
    postCalls++;
    if (offline) return const Err(AppError(AppErrorKind.offline));
    return const Ok([
      Post(id: 9, code: 'ELITE', text: 'Yangi loyiha', authorKind: 'company'),
    ]);
  }
}

void main() {
  testWidgets('UIQ-1: biznes postlari xatosidan keyin Qayta urinish ishlaydi',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final repo = _BizRepo();
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      businessRepositoryProvider.overrideWithValue(repo),
    ]);
    addTearDown(c.dispose);
    await c.read(sessionProvider.notifier).restore();
    await c.read(myBusinessesProvider.future);
    await c.read(modeProvider.notifier).set(AppMode.business);

    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: wrapScreen(const ProfileScreen()),
    ));
    await settle(tester, frames: 16);
    expect(c.read(activeProfileProvider)?.isBusiness, isTrue,
        reason: 'sinov biznes profilda bo‘lishi kerak');

    final retry = find.text(LUz().actionRetry);
    // To'r dangasa (SM-1): panel ekranga yaqinlashgandagina quriladi.
    await tester.scrollUntilVisible(retry, 200,
        scrollable: find.byType(Scrollable).first);
    expect(retry, findsOneWidget, reason: 'postlar xato paneli chiqmadi');
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -200));
    await settle(tester, frames: 4);
    await tester.ensureVisible(retry);
    await settle(tester, frames: 4);
    final before = repo.postCalls;

    repo.offline = false;
    await tester.tap(retry);
    await settle(tester, frames: 16);

    expect(repo.postCalls, greaterThan(before),
        reason: 'Qayta urinish kompaniya postlarini qayta so‘ramadi');
    expect(find.text(LUz().actionRetry), findsNothing,
        reason: 'xato paneli ketmadi');
  });
}
