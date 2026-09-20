import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// PROFILDAGI QR VA ULASHISH TUGMALARI.
///
/// Telefonda ikkalasi ham "ishlamadi" deb xabar qilindi. Kod
/// o'qib chiqilganda ulangan ko'rindi, shuning uchun bu testlar
/// tugmalar HAQIQATAN ishlayotganini tekshiradi — aks holda
/// muammo muhitda (emulyator/BlueStacks) bo'ladi.
void main() {
  /// Tizim ulashish oynasi sinovda yo'q — chaqiruvni ushlaymiz.
  late List<String> shared;

  Future<void> pump(WidgetTester tester) async {
    shared = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('dev.fluttercommunity.plus/share'),
      (call) async {
        shared.add(call.method);
        return null;
      },
    );
    addTearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
              const MethodChannel('dev.fluttercommunity.plus/share'), null);
    });

    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: MaterialApp(
        theme: buildTheme(NfcTokens.pearl),
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const ProfileScreen(),
      ),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }

  testWidgets('QR tugmasi bosilganda VARAQ ochiladi', (tester) async {
    await pump(tester);
    await tester.tap(find.byIcon(Icons.qr_code_rounded));
    // `pumpAndSettle` ISHLATILMAYDI: profil ekranida to'xtamaydigan
    // animatsiya bor (orb) va settle abadiy kutardi.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.byType(BottomSheet), findsOneWidget,
        reason: 'QR varag‘i ochilmadi');
  });

  testWidgets('Ulashish tugmasi TIZIM oynasini chaqiradi', (tester) async {
    await pump(tester);
    await tester.tap(find.byIcon(Icons.ios_share_rounded));
    await tester.pump(const Duration(milliseconds: 100));

    expect(shared, isNotEmpty,
        reason: 'ulashish chaqiruvi umuman ketmadi');
  });
}
