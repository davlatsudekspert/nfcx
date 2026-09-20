import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/activity/activity_screen.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/entry/welcome_screen.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';

import 'helpers.dart';

/// TOR EKRAN SUPURISHI.
///
/// Eng kichik real Android telefoni ~320dp. Bu kenglikda
/// `RenderFlex overflowed` yoki matn qirqilishi chiqsa, sinov
/// yiqiladi — chunki Flutter bunday holatda istisno tashlaydi va
/// test muhitida u xato bo'lib hisoblanadi.
///
/// Ruscha eng uzun matnlar bilan ham sinaladi: tarjima o'zbekchadan
/// uzunroq va aynan shu yerda joy yetmay qoladi.
void main() {
  final screens = <String, Widget Function()>{
    'Bosh sahifa': () => const HomeScreen(),
    'Tanlov': () => const DiscoverScreen(),
    'NFC markaz': () => const NfcCenterScreen(),
    'Harakatlar': () => const ActivityScreen(),
    'Sozlamalar': () => const SettingsScreen(),
    'Xush kelibsiz': () => const WelcomeScreen(),
  };

  for (final entry in screens.entries) {
    for (final locale in const [Locale('uz'), Locale('ru')]) {
      testWidgets('${entry.key} — 320dp x1.3 shrift, ${locale.languageCode}',
          (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1.0;
        // Shrift kattaligi VIEW dan beriladi. Uni `MaterialApp`
        // tashqarisidagi `MediaQuery` bilan berib bo'lmaydi:
        // `MaterialApp` o'z `MediaQuery`sini view'dan qayta quradi
        // va tashqaridagisini E'TIBORGA OLMAYDI — ya'ni sinov
        // hech narsani tekshirmagan bo'lardi.
        tester.platformDispatcher.textScaleFactorTestValue = 1.3;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

        await tester.pumpWidget(ProviderScope(
          overrides: [...await testOverrides()],
          child: wrapScreen(
            entry.value(),
            tokens: NfcTokens.ocean,
            locale: locale,
          ),
        ));
        await settle(tester, frames: 24);

        expect(tester.takeException(), isNull,
            reason: '${entry.key} 320dp da (${locale.languageCode}) '
                'joylashuvni buzdi');
      });
    }
  }
}
