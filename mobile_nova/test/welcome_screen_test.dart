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
/// Talab o'zgardi. Ilgari surat butun ekranni qoplashi kerak edi
/// (`BoxFit.cover`) va matn uning ustida turardi. Endi ekran
/// ikkiga bo'lingan: TEPADA vizual, PASTDA matn va tugmalar.
///
/// Shuning uchun bu yerdagi o'lchovlar ham boshqacha va, aslida,
/// qattiqroq: ilgari faqat "bo'sh joy yo'qmi" tekshirilardi,
/// endi esa surat tugmalarga XALAQIT BERMASLIGI o'lchanadi.
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

  const sizes = [
    Size(320, 780),
    Size(360, 800),
    Size(390, 844),
    Size(430, 932),
    // Eng cho'ziq holat.
    Size(360, 880),
    // Eng past holat — tugmalar aynan shu yerda qisilardi.
    Size(360, 640),
  ];

  group('vizual tepada, tugmalar pastda', () {
    for (final s in sizes) {
      testWidgets('${s.width.toInt()}x${s.height.toInt()}', (tester) async {
        await pump(tester, s);
        final l = await L.delegate.load(const Locale('uz'));

        final img = tester.widget<Image>(find.byType(Image).first);
        expect(img.fit, BoxFit.contain,
            reason: 'cover suratni yon tomonlaridan kesadi — '
                'telefon ham, NFC kartasi ham chala ko\'rinardi');

        final hero = tester.getRect(find.byType(Image).first);
        final startBtn = tester.getRect(find.text(l.welcomeStart));
        final loginBtn = tester.getRect(find.text(l.welcomeLogin));

        // 1. Surat TUGMALARGA TEGMAYDI.
        expect(hero.bottom, lessThanOrEqualTo(startBtn.top),
            reason: 'surat "Boshlash" tugmasining ustiga tushyapti');

        // 2. Ikkala tugma ham EKRAN ICHIDA — pastdan kesilmagan.
        expect(loginBtn.bottom, lessThanOrEqualTo(s.height),
            reason: '"Kirish" tugmasi ekrandan chiqib ketdi');
        expect(startBtn.top, greaterThanOrEqualTo(0));

        // 3. Vizual ekranning TEPA qismida.
        expect(hero.top, lessThan(s.height * 0.5),
            reason: 'asosiy vizual tepada bo\'lishi kerak');

        // 4. Suratning eni ekrandan oshib ketmaydi.
        expect(hero.left, greaterThanOrEqualTo(0));
        expect(hero.right, lessThanOrEqualTo(s.width));
      });
    }
  });

  testWidgets('hech qayerda toshib ketish yo\'q', (tester) async {
    for (final s in sizes) {
      await pump(tester, s);
      expect(tester.takeException(), isNull,
          reason: '${s.width.toInt()}x${s.height.toInt()} da toshib ketdi');
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
    final src =
        File('lib/features/entry/welcome_screen.dart').readAsStringSync();
    expect(src, contains('l.welcomeHeadline'));
    expect(File('assets/welcome/nfc_hero.webp').existsSync(), isTrue);
  });

  test('surat FONSIZ — alfa kanali bor', () {
    // Fon qirqilgan to'rtburchak bo'lib ko'rinmasligi uchun
    // suratda alfa kanali BO'LISHI SHART. WebP sarlavhasidagi
    // `VP8X` bayrog'ining 5-biti — aynan shu.
    final b = File('assets/welcome/nfc_hero.webp').readAsBytesSync();
    expect(String.fromCharCodes(b.sublist(0, 4)), 'RIFF');
    expect(String.fromCharCodes(b.sublist(8, 12)), 'WEBP');
    final chunk = String.fromCharCodes(b.sublist(12, 16));
    expect(chunk, 'VP8X',
        reason: 'alfa kanalsiz WebP — fon oq to\'rtburchak bo\'lib turadi');
    expect(b[20] & 0x10, 0x10, reason: 'ALPHA bayrog\'i o\'chirilgan');
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
