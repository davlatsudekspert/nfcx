import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/entry/welcome_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// BIRINCHI KIRISH EKRANI.
///
/// Eng muhim talab: rasm ekranni TO'LIQ egallasin, pastda bo'sh
/// joy qolmasin — har qanday kenglikda.
void main() {
  Future<void> pump(WidgetTester tester, Size size,
      {NfcTokens? tokens}) async {
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: wrapScreen(const WelcomeScreen(), tokens: tokens),
    ));
    await tester.pump(const Duration(milliseconds: 300));
  }

  group('Rasm ekranni TO‘LIQ egallaydi', () {
    for (final s in const [
      Size(320, 780),
      Size(360, 800),
      Size(390, 844),
      Size(430, 932),
      // Eng cho‘ziq holat — bo‘sh joy aynan shu yerda chiqardi.
      Size(360, 880),
    ]) {
      testWidgets('${s.width.toInt()}x${s.height.toInt()}', (tester) async {
        await pump(tester, s);

        final img = tester.widget<Image>(find.byType(Image).first);
        expect(img.fit, BoxFit.cover,
            reason: 'cover bo‘lmasa chetlarda bo‘sh joy ochiladi');

        // Rasm qutisi ekrandan KICHIK bo‘lmasligi kerak.
        final box = tester.getRect(find.byType(Image).first);
        expect(box.left, lessThanOrEqualTo(0));
        expect(box.top, lessThanOrEqualTo(0));
        expect(box.right, greaterThanOrEqualTo(s.width),
            reason: 'o‘ngda bo‘sh joy qolyapti');
        expect(box.bottom, greaterThanOrEqualTo(s.height),
            reason: 'PASTDA BO‘SH JOY QOLYAPTI');
      });
    }
  });

  testWidgets('sarlavha va ikkala tugma bor', (tester) async {
    await pump(tester, const Size(390, 844));
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.welcomeHeadline), findsOneWidget);
    expect(find.text(l.welcomeStart), findsOneWidget);
    expect(find.text(l.welcomeLogin), findsOneWidget);
  });

  testWidgets('MAVZU almashganda matn rangi ham o‘zgaradi', (tester) async {
    final l = await L.delegate.load(const Locale('uz'));

    await pump(tester, const Size(390, 844), tokens: NfcTokens.pearl);
    final light = tester
        .widget<Text>(find.text(l.welcomeHeadline))
        .style!
        .color!;

    await pump(tester, const Size(390, 844), tokens: NfcTokens.midnight);
    final dark =
        tester.widget<Text>(find.text(l.welcomeHeadline)).style!.color!;

    expect(light, isNot(dark),
        reason: 'matn mavzuga bog‘lanmagan — qat‘iy rang yozilgan');
    // Ochiq mavzuda to‘q matn, qorong‘ida ochiq matn.
    expect(light.computeLuminance(), lessThan(dark.computeLuminance()));
  });

  test('sarlavha SURATDA emas, kodda', () {
    // Surat telefondan kengroq (0.563 va 0.45–0.46), ya'ni `cover`
    // yon tomonlarini kesadi. Yozuv suratda qolsa, tor ekranda
    // kesilardi — 360x800 da bu o'lchab isbotlangan.
    final src =
        File('lib/features/entry/welcome_screen.dart').readAsStringSync();
    expect(src, contains('l.welcomeHeadline'));
    expect(File('assets/welcome/nfc_hero.jpg').existsSync(), isTrue);
  });

  test('animatsiya BITTA kontrollerda va 5 soniyalik halqa', () {
    final src =
        File('lib/features/entry/welcome_screen.dart').readAsStringSync();
    expect(src, contains('Duration(seconds: 5)'));
    expect(src, contains('..repeat()'));
    // Tizimda "animatsiyani kamaytirish" yoqilgan bo‘lsa — tinch.
    expect(src, contains('disableAnimationsOf'));
    expect(src, isNot(contains('Curves.bounce')));
  });
}
