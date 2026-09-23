import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// GOOGLE PLAY: hisobni o'chirish ILOVA ICHIDA haqiqatan ishlashi kerak.
///
/// Ilgari tugma faqat qo'llab-quvvatlashga murojaat yuborardi. Endi
/// `DELETE /api/account` chaqiriladi, "Tushundim" belgisisiz tugma
/// ishlamaydi, muvaffaqiyatdan keyin sessiya yopiladi.
class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());
  int deletes = 0;
  final supportCalls = <String>[];

  @override
  Future<Result<void>> deleteAccount() async {
    deletes++;
    return const Ok(null);
  }

  @override
  Future<Result<void>> support(String message) async {
    supportCalls.add(message);
    return const Ok(null);
  }
}

void main() {
  testWidgets('tasdiqlagach hisob o‘chadi va sessiya yopiladi', (tester) async {
    tester.view.physicalSize = const Size(390, 2400) * 3;
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final repo = _Profile();
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      profileRepositoryProvider.overrideWithValue(repo),
    ]);
    addTearDown(c.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: wrapScreen(const SecuritySettingsScreen(), tokens: NfcTokens.ivory),
    ));
    await settle(tester, frames: 8);
    await c.read(sessionProvider.notifier).restore();
    await settle(tester, frames: 4);
    expect(c.read(sessionProvider), isA<SessionActive>());
    final l = await L.delegate.load(const Locale('uz'));

    final button = find.widgetWithText(Scrollable, l.settingsDeleteAccount);
    await tester.scrollUntilVisible(find.text(l.settingsDeleteAccount).last, 300,
        scrollable: find.byType(Scrollable).first);
    expect(button, findsWidgets);
    await tester.tap(find.text(l.settingsDeleteAccount).last);
    await settle(tester, frames: 8);

    // "Tushundim" belgisisiz o'chirish tugmasi ishlamaydi.
    await tester.tap(find.byKey(const ValueKey('delete-confirm')));
    await settle(tester, frames: 6);
    expect(repo.deletes, 0);
    expect(find.text(l.deleteAccountWhat), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('delete-understood')));
    await settle(tester, frames: 4);
    await tester.tap(find.byKey(const ValueKey('delete-confirm')));
    await settle(tester, frames: 10);

    expect(repo.deletes, 1, reason: 'HAQIQIY o‘chirish chaqirildi');
    expect(repo.supportCalls, isEmpty, reason: 'endi faqat murojaat emas');
    expect(c.read(sessionProvider), isA<SessionAnonymous>());
  });
}
