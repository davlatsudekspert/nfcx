import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/entry/nfc_card_3d.dart';
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

    // QORONG'I mavzu bilan solishtiriladi. Ilgari bu yerda
    // `midnight` turardi; u `mono` (OQ-QORA, ya'ni YORUG') bilan
    // almashtirilganda taqqoslash ma'nosini yo'qotgan edi —
    // ikkala tomon ham yorug' bo'lib, matn rangi bir xil chiqardi.
    await pump(tester, const Size(390, 844), tokens: NfcTokens.noir);
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
    expect(File(NfcCard3D.front).existsSync(), isTrue);
    expect(File(NfcCard3D.back).existsSync(), isTrue);
  });

  test('karta rasmlari FONSIZ va yengil', () {
    // Karta burchaklari yumaloq — fon qirqilgan to'rtburchak bo'lib
    // ko'rinmasligi uchun alfa kanali SHART (`VP8X` 5-bit).
    for (final path in [NfcCard3D.front, NfcCard3D.back]) {
      final b = File(path).readAsBytesSync();
      expect(String.fromCharCodes(b.sublist(0, 4)), 'RIFF');
      expect(String.fromCharCodes(b.sublist(8, 12)), 'WEBP');
      expect(String.fromCharCodes(b.sublist(12, 16)), 'VP8X', reason: path);
      expect(b[20] & 0x10, 0x10, reason: '$path: ALPHA bayrog\'i o\'chirilgan');
      expect(b.length, lessThan(160 * 1024), reason: '$path juda og\'ir');
    }
    // Eski statik surat olib tashlangan — ilova hajmi ortmasin.
    expect(File('assets/welcome/nfc_hero.webp').existsSync(), isFalse);
  });

  test('animatsiya BITTA kontrollerda va 10 soniyalik halqa', () {
    final src =
        File('lib/features/entry/welcome_screen.dart').readAsStringSync();
    expect(src, contains('Duration(seconds: 10)'));
    expect(src, contains('..repeat()'));
    // Tizimda "animatsiyani kamaytirish" yoqilgan bo‘lsa — tinch.
    expect(src, contains('disableAnimationsOf'));
    expect(src, isNot(contains('Curves.bounce')));
  });

  group('3D karta aylanadi', () {
    String face(WidgetTester tester) =>
        ((tester.widget<Image>(find.byType(Image).first).image) as AssetImage)
            .assetName;

    testWidgets('old → orqa → old', (tester) async {
      await pump(tester, const Size(390, 844));
      expect(face(tester), NfcCard3D.front);
      await tester.pump(const Duration(milliseconds: 4700));
      expect(face(tester), NfcCard3D.back,
          reason: 'yarim halqada karta orqa tomoniga o\'girilishi kerak');
      await tester.pump(const Duration(milliseconds: 5000));
      expect(face(tester), NfcCard3D.front);
      expect(tester.takeException(), isNull);
    });

    testWidgets('"animatsiyani kamaytirish" — karta qimirlamaydi',
        (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
          tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
      await pump(tester, const Size(390, 844));
      final before = tester.getRect(find.byType(Image).first);
      await tester.pump(const Duration(milliseconds: 4700));
      expect(face(tester), NfcCard3D.front);
      expect(tester.getRect(find.byType(Image).first), before);
    });

    test('burchak silliq — sakrash yo\'q, halqa ulanadi', () {
      double wrap(double d) =>
          (d + math.pi) % (2 * math.pi) - math.pi; // -π..π
      const n = 2000;
      for (var i = 0; i <= n; i++) {
        final d = wrap(NfcCard3D.yaw((i + 1) / n) - NfcCard3D.yaw(i / n));
        expect(d.abs(), lessThan(.05), reason: 'p=${i / n} da sakrash');
      }
      // Bir halqada to'liq bir marta aylanadi (orqaga qaytmaydi).
      expect(NfcCard3D.yaw(.999) - NfcCard3D.yaw(0), closeTo(2 * math.pi, .05));
    });
  });
}
