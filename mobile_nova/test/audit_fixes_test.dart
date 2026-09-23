import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/features/settings/app_lock.dart';
import 'package:nfcstore_nova/features/social/moderation.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class _FakeSecure extends SecureStore {
  _FakeSecure() : super(const FlutterSecureStorage());
  String? _pin;

  @override
  Future<String?> readPin() async => _pin;
  @override
  Future<void> writePin(String pin) async => _pin = pin;
  @override
  Future<void> deletePin() async => _pin = null;
  @override
  Future<void> clear() async {}
}

class _LogoutSpy extends FakeAuthRepository {
  int logouts = 0;
  @override
  Future<void> logout() async => logouts++;
}

/// Tasdiqlangan audit topilmalari (F-H6, F-H7, F-M11).
void main() {
  group('Bloklanganlar ro‘yxati (F-H6)', () {
    for (final w in [320.0, 360.0, 430.0]) {
      testWidgets('${w.toInt()} dp — xatosiz chiziladi, tugmalar bor',
          (tester) async {
        tester.view.physicalSize = Size(w * 3, 2400);
        tester.view.devicePixelRatio = 3;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(ProviderScope(
          overrides: [
            ...await testOverrides(),
            blocksProvider.overrideWith((ref) async => const [
                  BlockedItem(kind: 'user', id: 'VERYLONGUSERCODE12345'),
                  BlockedItem(kind: 'company', id: 'ACME'),
                ]),
          ],
          child: wrapScreen(const BlockedScreen()),
        ));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
        expect(tester.takeException(), isNull);
        final btn = find.text(LUz().unblockUser);
        expect(btn, findsNWidgets(2));
        for (final e in btn.evaluate()) {
          final size = (e.renderObject! as RenderBox).size;
          expect(size.width.isFinite && size.width > 0, isTrue);
        }
      });
    }
  });

  group('Ilova qulfi — PIN unutilsa (F-H7, F-M11)', () {
    testWidgets('“unutdingizmi” — avval CHIQADI, keyin qulf tiklanadi',
        (tester) async {
      SharedPreferences.setMockInitialValues({'nova.appLock': true});
      final prefs = await Prefs.open();
      final spy = _LogoutSpy();
      final secure = _FakeSecure().._pin = '1234';
      final c = ProviderContainer(overrides: [
        prefsProvider.overrideWithValue(prefs),
        secureStoreProvider.overrideWithValue(secure),
        authRepositoryProvider.overrideWithValue(spy),
      ]);
      addTearDown(c.dispose);
      expect(c.read(appLockProvider).locked, isTrue);

      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        // Ishlab chiqarishdagidek: qulf `MaterialApp.builder` da.
        child: MaterialApp(
          theme: buildTheme(NfcTokens.ivory),
          locale: const Locale('uz'),
          supportedLocales: L.supportedLocales,
          localizationsDelegates: const [
            L.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (context, child) =>
              AppLockGate(child: child ?? const SizedBox.shrink()),
          home: const Text('kontent'),
        ),
      ));
      await tester.pump();

      // F-M11: qulf matnlari Material ichida — debug uslubi yo'q.
      final title = tester.widget<Text>(find.text(LUz().lockTitle));
      final style = DefaultTextStyle.of(
              tester.element(find.text(LUz().lockTitle)))
          .style
          .merge(title.style);
      expect(style.decoration, isNot(TextDecoration.underline));

      // Kichik ekranda ham tugmaga yetib boriladi (qulf ekrani suriladi).
      await tester.ensureVisible(find.byKey(const ValueKey('lock-forgot')));
      await tester.tap(find.byKey(const ValueKey('lock-forgot')));
      await tester.pump();
      await tester
          .ensureVisible(find.byKey(const ValueKey('lock-forgot-confirm')));
      await tester.tap(find.byKey(const ValueKey('lock-forgot-confirm')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(spy.logouts, 1, reason: 'qulf olib tashlanishidan oldin chiqish');
      expect(c.read(sessionProvider), isA<SessionAnonymous>());
      expect(c.read(appLockProvider).enabled, isFalse);
      expect(c.read(appLockProvider).locked, isFalse);
      expect(await secure.readPin(), isNull);
      expect(tester.takeException(), isNull);
    });
  });
}
