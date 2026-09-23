import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

class _BizRepo extends BusinessRepository {
  _BizRepo() : super(ApiClient());

  @override
  Future<Result<List<Business>>> mine() async =>
      const Ok([Business(companyId: 'ELITE', displayName: 'Elite Qurilish')]);
}

/// BOSH SAHIFADA "Shaxsiy | Biznes" ALMASHTIRGICHI.
///
/// Egasi (2026-09): shaxsiy rejimda "Biznes" bosilsa o'tmayapti,
/// faqat Profil bo'limidan o'tsa almashadi.
void main() {
  for (final size in const [Size(360, 740), Size(390, 844), Size(430, 932)]) {
    testWidgets('Biznes bosilganda rejim almashadi (${size.width.toInt()})',
        (tester) async {
      tester.view.physicalSize = size * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      final container = ProviderContainer(overrides: [
        ...await testOverrides(),
        businessRepositoryProvider.overrideWithValue(_BizRepo()),
      ]);
      addTearDown(container.dispose);
      await container.read(sessionProvider.notifier).restore();

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: wrapScreen(const HomeScreen()),
      ));
      await settle(tester);
      expect(container.read(modeProvider), AppMode.personal);

      final biz = find.text(LUz().modeBusiness).first;
      await tester.ensureVisible(biz);
      await settle(tester);
      await tester.tap(biz, warnIfMissed: true);
      await settle(tester, frames: 20);

      expect(container.read(modeProvider), AppMode.business,
          reason: 'bosh sahifada Biznes bosildi, lekin rejim o‘zgarmadi');
      expect(container.read(activeProfileProvider)?.isBusiness, isTrue);

      await tester.tap(find.text(LUz().modePersonal).first);
      await settle(tester, frames: 20);
      expect(container.read(modeProvider), AppMode.personal);
    });
  }
}
