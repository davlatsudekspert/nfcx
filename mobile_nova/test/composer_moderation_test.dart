import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// Joylash ekrani: media, izoh, qoidalar ogohlantirishi va moderatsiya
/// xabarlari — faqat serverda HAQIQATAN bor narsa.
void main() {
  for (final kind in ComposerKind.values) {
    testWidgets('${kind.name}: izoh maydoni va taqiqlar kartasi', (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 1400 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(ComposerScreen(kind: kind), tokens: NfcTokens.ivory),
      ));
      await settle(tester);
      final l = await L.delegate.load(const Locale('uz'));

      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('composer-caption')), findsOneWidget,
          reason: 'istoryada ham izoh bor (server caption qabul qiladi)');
      expect(find.byKey(const ValueKey('content-rules-card')), findsOneWidget);
      for (final b in [
        l.rulesBan18,
        l.rulesBanViolence,
        l.rulesBanExtremism,
        l.rulesBanIllegal,
        l.rulesBanSpam,
      ]) {
        expect(find.text(b), findsOneWidget, reason: b);
      }
    });
  }

  test('bloklangan/to‘xtatilgan hisob — aniq sabab', () async {
    final l = await L.delegate.load(const Locale('uz'));
    expect(
        describeError(l,
            const AppError(AppErrorKind.forbidden, code: 'BANNED', status: 403)),
        l.errBanned);
    expect(
        describeError(l,
            const AppError(AppErrorKind.forbidden, code: 'account_suspended')),
        l.errBanned);
    expect(
        describeError(l,
            const AppError(AppErrorKind.validation, code: 'rules_not_accepted')),
        l.rulesNotAccepted);
  });
}
