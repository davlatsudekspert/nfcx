import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// OMMAVIY OFERTAGA ROZILIK.
///
/// Server `tosAccepted !== true` bo'lsa 422 qaytaradi, ilova esa uni
/// repozitoriyda QOTIRIB `true` yuborardi va rozilik so'raydigan joy
/// umuman yo'q edi. Ya'ni odam ko'rmagan shartga uning nomidan
/// rozilik yozilardi — huquqiy jihatdan ham, Google Play talablari
/// bo'yicha ham noto'g'ri.
void main() {
  group('Ro‘yxatdan o‘tish — oferta roziligi', () {
    testWidgets('oxirgi qadamda rozilik katagi KO‘RINADI', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides(signedIn: false)],
        child: wrapScreen(const RegisterScreen()),
      ));
      await settle(tester, frames: 12);
      final l = await L.delegate.load(const Locale('uz'));

      // Birinchi qadamda hali ko'rinmaydi.
      expect(find.byType(Checkbox), findsNothing);

      // Hisob turi, keyin to'rtta ma'lumot qadami.
      await tester.tap(find.byKey(const ValueKey('signup-type-personal')));
      await tester.pump();
      await tester.tap(find.text(l.actionNext));
      await settle(tester, frames: 14);

      await tester.enterText(find.byType(TextField).first, 'Test Foydalanuvchi');
      await tester.tap(find.text(l.actionNext));
      await settle(tester, frames: 14);

      await tester.enterText(find.byType(TextField).first, 'a@nfcstore.uz');
      await tester.tap(find.text(l.actionNext));
      await settle(tester, frames: 14);

      await tester.enterText(find.byType(TextField).first, '+998901234567');
      await tester.tap(find.text(l.actionNext));
      await settle(tester, frames: 14);

      expect(find.byType(Checkbox), findsOneWidget,
          reason: 'oxirgi qadamda rozilik katagi yo‘q — odam shartni '
              'ko‘rmasdan ro‘yxatdan o‘tadi');
      // Havola `Text.rich` ichidagi BO'LAK, shuning uchun
      // `find.text` emas — u butun vidjet matnini solishtiradi.
      expect(
        find.textContaining(l.registerTosLink, findRichText: true),
        findsOneWidget,
      );
    });
  });

  group('Manbadagi qoida', () {
    test('`tosAccepted` QOTIRIB yuborilmaydi', () {
      final src =
          File('lib/data/repositories/auth_repository.dart').readAsStringSync();
      final bad = <String>[];
      for (final line in const LineSplitter().convert(src)) {
        final code = line.trimLeft();
        if (code.startsWith('//')) continue;
        if (code.replaceAll(' ', '').contains("'tosAccepted':true")) {
          bad.add(code);
        }
      }
      expect(bad, isEmpty,
          reason: 'rozilik odamdan emas, koddan kelyapti: $bad');
    });

    test('ro‘yxatdan o‘tish roziliksiz chaqirilmaydi', () {
      final src =
          File('lib/data/repositories/auth_repository.dart').readAsStringSync();
      expect(src, contains('required bool tosAccepted'),
          reason: 'chaqiruvchi rozilikni berishga MAJBUR bo‘lishi kerak — '
              'ixtiyoriy parametr yana jimgina `true` ga tushib qolardi');
    });
  });
}
