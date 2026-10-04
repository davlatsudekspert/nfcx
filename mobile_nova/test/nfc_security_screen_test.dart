import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/nfc/nfc_misc_screens.dart';

import 'helpers.dart';

/// Xavfsizlik ekrani karta holatini `/api/my/nfc-devices` dan oladi.
///
/// Ilgari `NfcId.cardLinked` dan o'qilardi — server bu maydonni bermaydi,
/// shuning uchun kartaga ulangan VIP001 ham "Hozircha bo'sh" va tepada
/// doim "0 / N" turardi (egasi, 2026-10-04).
void main() {
  Future<void> pump(WidgetTester tester, List<NfcDevice> cards) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        myIdsProvider.overrideWithValue(const [
          NfcId(code: 'VIP001', primary: true),
          NfcId(code: 'UZD772'),
          NfcId(code: 'ALI777'),
        ]),
        nfcDevicesProvider.overrideWith((ref) async => cards),
      ],
      child: wrapScreen(const NfcSecurityScreen()),
    ));
    await settle(tester);
  }

  String statusOf(WidgetTester tester, String code) {
    final row = find.byKey(ValueKey('sec-id-$code'));
    final texts = tester.widgetList<Text>(
        find.descendant(of: row, matching: find.byType(Text)));
    return texts.map((t) => t.data).whereType<String>().last;
  }

  testWidgets('kartaga ulangan, bloklangan va bo‘sh ID to‘g‘ri ko‘rinadi',
      (tester) async {
    await pump(tester, const [
      NfcDevice(id: 1, code: 'VIP001'),
      NfcDevice(id: 2, code: 'ALI777', blockedByOwner: true),
    ]);
    expect(statusOf(tester, 'VIP001'), 'Kartaga ulangan');
    expect(statusOf(tester, 'ALI777'), 'Bloklangan');
    expect(statusOf(tester, 'UZD772'), 'Karta ulanmagan');
    // Tepadagi son haqiqiy: 3 tadan 2 tasi kartaga ulangan.
    expect(find.text('2 / 3 · Kartaga ulangan'), findsOneWidget);
  });

  testWidgets('kartasi yo‘q bo‘lsa hammasi "Karta ulanmagan", 0 / N',
      (tester) async {
    await pump(tester, const []);
    for (final c in ['VIP001', 'UZD772', 'ALI777']) {
      expect(statusOf(tester, c), 'Karta ulanmagan');
    }
    expect(find.text('0 / 3 · Kartaga ulangan'), findsOneWidget);
  });
}
