import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/id_plate.dart';
import 'package:nfcstore_nova/features/discover/discover_cards.dart';

import 'helpers.dart';

/// TANLOV → ODAMLAR: KO'RISHLAR SONI VA O'RIN (egasi, 2026-09-28:
/// "saytda reytingda chiqar edi, bu yerda soni ko'rinmayapti").
///
/// Ro'yxat saytdagi Reyting bilan bir xil tartibda edi (ko'rishlar
/// bo'yicha), lekin sonning o'zi kartada yo'q edi. Endi har kartada
/// `276 ko'rish`, suratda o'rin: 1–3 medal, 4 dan `#4`.
void main() {
  const person = NfcId(
    code: 'PPP777',
    name: 'Mashrabboy',
    views: 276,
    followers: 7,
    following: 4,
    tier: 'exclusive',
  );

  Future<void> pump(WidgetTester tester, {int? rank, NfcTokens? tokens,
      double width = 390, double scale = 1}) async {
    tester.view.physicalSize = Size(width, 400) * 3;
    tester.view.devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = scale;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: wrapScreen(
        Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(20),
            child: DiscoverPersonCard(id: person, rank: rank),
          ),
        ),
        tokens: tokens,
      ),
    ));
    await tester.pump(const Duration(milliseconds: 100));
  }

  testWidgets('ko‘rishlar soni kartada — saytdagi bilan bir xil son',
      (tester) async {
    await pump(tester, rank: 1);
    expect(find.text('276 ko‘rish'), findsOneWidget);
    expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
  });

  testWidgets('1–3 o‘rin — tilla, kumush, bronza medal', (tester) async {
    for (final (rank, tier) in [(1, 'gold'), (2, 'silver'), (3, 'free')]) {
      await pump(tester, rank: rank);
      final badge = find.byKey(ValueKey('discover-rank-$rank'));
      expect(badge, findsOneWidget);
      expect(find.descendant(of: badge, matching: find.text('$rank')),
          findsOneWidget);
      final box = tester.widget<Container>(badge).decoration as BoxDecoration;
      expect(box.color, IdPlate.tierColors[tier],
          reason: '$rank-o‘rin medali $tier rangida bo‘lishi kerak');
    }
  });

  testWidgets('4 dan — #4, #5 ...', (tester) async {
    await pump(tester, rank: 5);
    expect(find.text('#5'), findsOneWidget);
    expect(RankBadge.medal(5), isNull);
  });

  testWidgets('qidiruv natijasida o‘rin yo‘q, son bor', (tester) async {
    await pump(tester);
    expect(find.byType(RankBadge), findsNothing);
    expect(find.text('276 ko‘rish'), findsOneWidget);
  });

  testWidgets('ekran o‘quvchi: "1-o‘rin"', (tester) async {
    final h = tester.ensureSemantics();
    await pump(tester, rank: 1);
    expect(find.bySemanticsLabel(RegExp('1-o‘rin')), findsWidgets);
    h.dispose();
  });

  testWidgets('tor ekran / katta shrift — son surat ustida qoladi',
      (tester) async {
    await pump(tester, rank: 2, width: 320, scale: 1.3);
    expect(tester.takeException(), isNull);
    expect(find.text('276'), findsOneWidget,
        reason: 'joy yo‘q — son surat pastida qisqa yorliqda');
    expect(find.text('276 ko‘rish'), findsNothing);
  });

  testWidgets('tor ekran va katta shrift — toshib ketmaydi', (tester) async {
    for (final (w, s) in [
      (320.0, 1.0), (320.0, 1.3), (360.0, 1.3), (390.0, 1.4)
    ]) {
      for (final t in [NfcTokens.pearl, NfcTokens.noir]) {
        await pump(tester, rank: 12, width: w, scale: s, tokens: t);
        expect(tester.takeException(), isNull,
            reason: '${w.toInt()} dp, shrift x$s, ${t.id} da toshdi');
      }
    }
  });

  test('o‘rin faqat Odamlar ro‘yxatida, qidiruvsiz', () {
    final src =
        File('lib/features/discover/discover_screen.dart').readAsStringSync();
    expect(src, contains('rank: tab == DiscoverTab.people && query.isEmpty'));
    expect(src, contains('DiscoverPersonCard(id: i, rank: rank)'));
    // Tartib — ko'rishlar bo'yicha (o'rin raqami shunga tayanadi).
    expect(src, contains('_byViews(v)'));
  });
}
