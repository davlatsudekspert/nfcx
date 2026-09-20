import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/utils/external_link.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// YAKUNIY SAYQAL: sayt havolasi va sahifa o'tishlari.
void main() {
  group('Bosh menyudagi sayt kartasi', () {
    testWidgets('ko‘rinadi va SAYTGA olib boradi', (tester) async {
      final opened = <String>[];
      openLinkOverride = (u) async {
        opened.add('$u');
        return true;
      };
      addTearDown(() => openLinkOverride = null);

      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides()],
        child: wrapScreen(const SettingsScreen()),
      ));
      await settle(tester, frames: 18);
      final l = await L.delegate.load(const Locale('uz'));

      final card = find.text(l.siteCardTitle);
      await tester.scrollUntilVisible(card, 160,
          scrollable: find.byType(Scrollable).first);
      await settle(tester);

      expect(find.text(l.siteCardBody), findsOneWidget);
      await tester.tap(card);
      await settle(tester);

      expect(opened, ['https://nfcstore.uz'],
          reason: 'sayt kartasi bosilganda hech qayerga borilmadi');
    });

    test('matn saytga UNDAYDI, quruq havola emas', () async {
      final l = await L.delegate.load(const Locale('uz'));
      expect(l.siteCardTitle, 'nfcstore.uz');
      // Odamga NIMA borligi aytiladi.
      expect(l.siteCardBody.toLowerCase(), contains('katalog'));
    });
  });

  group('Sahifa o‘tishi — ikki tomonlama', () {
    final src =
        File('lib/design/theme/app_theme.dart').readAsStringSync();

    test('CHIQUVCHI sahifa ham harakatlanadi', () {
      // Ilgari faqat kiruvchisi harakatlanardi, eskisi joyida
      // qotib turardi va almashuv "sakrash" bo'lib sezilardi.
      expect(src, contains('secondaryAnimation'));
      expect(src, contains('outCurve'));
    });

    test('egri chiziq YUMSHOQ', () {
      expect(src, contains('Cubic(.22, 1, .36, 1)'));
      // Keskin yoki sakraydigan egri chiziqlar bo'lmasin.
      expect(src, isNot(contains('Curves.bounce')));
      expect(src, isNot(contains('Curves.elasticOut')));
    });
  });
}
