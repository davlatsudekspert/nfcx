import 'dart:convert';
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
    testWidgets('ko‘rinadi, lekin BOSILMAYDI; to‘lov bandlari yo‘q',
        (tester) async {
      // Google Play to'lov qoidasi (egasining qarori, 2026-09): ilovada
      // saytga bosiladigan havola yo'q, "To'lovlar tarixi" va "Premium"
      // menyudan olingan (`shop/store_policy.dart`).
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
      expect(opened, isEmpty, reason: 'sayt kartasi havola bo‘lib qoldi');

      // Ro'yxat dangasa quriladi (ekrandan tashqaridagisi chizilmaydi),
      // shuning uchun menyu bandlari manbadan tekshiriladi.
      final src =
          File('lib/features/settings/settings_screen.dart').readAsStringSync();
      expect(src, isNot(contains('Routes.paymentHistory')));
      expect(src, isNot(contains('Routes.settingsPremium')));
      expect(src, contains('Routes.orders'),
          reason: 'jismoniy karta buyurtmalari qolishi kerak');
      final post =
          File('lib/features/social/post_screens.dart').readAsStringSync();
      expect(post, isNot(contains('Routes.settingsPremium')),
          reason: 'post ekranida Premium xarid tugmasi qolmasin');
    });

    test('matn saytga UNDAYDI, quruq havola emas', () async {
      final l = await L.delegate.load(const Locale('uz'));
      expect(l.siteCardTitle, 'nfcstore.uz');
      // Odamga NIMA borligi aytiladi.
      expect(l.siteCardBody.toLowerCase(), contains('katalog'));
    });
  });

  group('Sahifa o‘tishi — tizimniki (Apple/Samsung kabi)', () {
    final src =
        File('lib/design/theme/app_theme.dart').readAsStringSync();

    test('Android — Zoom, iPhone — Cupertino', () {
      // O'zimizning fade+scale o'tishi IKKALA sahifani ham har kadrda
      // shaffof qatlamga chizardi — telefonda qotish (egasi, 2026-09).
      // Tizim o'tishlari ikkala sahifani ham harakatlantiradi va
      // Zoom sahifani rasmga olib harakatlantiradi — eng arzon yo'l.
      expect(src, contains('ZoomPageTransitionsBuilder()'));
      expect(src, contains('CupertinoPageTransitionsBuilder()'));
      expect(src, isNot(contains('_FadeScaleTransitions')));
      // Keskin yoki sakraydigan egri chiziqlar bo'lmasin.
      expect(src, isNot(contains('Curves.bounce')));
      expect(src, isNot(contains('Curves.elasticOut')));
    });
  });

  group('Qotib qoladigan kanallar', () {
    // `Clipboard.setData` — bu kanal javob bermasa MANGU kutadi va
    // istisno ham tashlamaydi. Buni sinovda ushlab bo'lmaydi: test
    // muhitida kanal doim javob beradi. Shuning uchun qoida manba
    // darajasida tekshiriladi — `lib/` ichida faqat bitta joy,
    // `core/utils/`, bu kanalga to'g'ridan-to'g'ri tegadi.
    test('lib/ ichida himoyasiz Clipboard.setData qolmagan', () {
      final bad = <String>[];
      for (final f in Directory('lib').listSync(recursive: true)) {
        if (f is! File || !f.path.endsWith('.dart')) continue;
        if (f.path.contains('core/utils/')) continue;
        final src = f.readAsStringSync();
        for (final line in const LineSplitter().convert(src)) {
          // Izoh satri chaqiruv emas — aks holda bu sinov o'zining
          // tushuntirish matnini "xato" deb topadi.
          final code = line.trimLeft();
          if (code.startsWith('//')) continue;
          if (code.contains('Clipboard.setData')) bad.add('${f.path}: $code');
        }
      }
      expect(bad, isEmpty,
          reason: 'bu chaqiruvlar qotib qolishi mumkin — '
              'copyToClipboard() orqali o‘tkazing');
    });
  });
}
