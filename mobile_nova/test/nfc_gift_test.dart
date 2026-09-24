import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/repositories/nfc_repository.dart';
import 'package:nfcstore_nova/features/nfc/nfc_misc_screens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// SOVG'A QILISH (egasi, 2026-09-24: "sovg'a qilish ishlamayapti").
///
/// Server (`hosting/api/account.js`) va sayt (`src/lib/db.js`) qabul
/// qiluvchining NFC ID'sini `toCode` da kutadi. Ilova `email` yuborardi
/// va har safar "Nimadir noto'g'ri ketdi" chiqardi.
class _Nfc extends NfcRepository {
  _Nfc({this.error}) : super(ApiClient());
  final String? error;
  final sent = <(String, String)>[];

  @override
  Future<Result<void>> gift({required String code, required String toCode}) async {
    sent.add((code, toCode));
    if (error != null) {
      return Err(AppError(AppErrorKind.conflict, code: error));
    }
    return const Ok(null);
  }
}

void main() {
  final l = LUz();

  test('kontrakt: toCode yuboriladi (email emas)', () {
    final src = File('lib/data/repositories/nfc_repository.dart').readAsStringSync();
    expect(src, contains("{'toCode': toCode}"));
    expect(src, isNot(contains("gift', {'email'")));
    final server = File('../hosting/api/account.js').readAsStringSync();
    expect(server, contains('body.toCode'));
  });

  Future<_Nfc> pump(WidgetTester tester, {String? error}) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final nfc = _Nfc(error: error);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        nfcRepositoryProvider.overrideWithValue(nfc),
      ],
      child: wrapScreen(const NfcGiftScreen(code: 'ALI777')),
    ));
    await settle(tester);
    return nfc;
  }

  testWidgets('NFC ID kiritiladi, tozalanib yuboriladi', (tester) async {
    final nfc = await pump(tester);
    await tester.enterText(find.byKey(const ValueKey('gift-to-code')).last, 'vip001');
    await tester.tap(find.text(l.actionConfirm));
    await settle(tester);
    expect(nfc.sent, [('ALI777', 'VIP001')]);
    expect(find.text(l.nfcGiftSent), findsOneWidget);
  });

  testWidgets('o‘ziga sovg‘a — serverga bormaydi, sabab aytiladi', (tester) async {
    final nfc = await pump(tester);
    await tester.enterText(find.byKey(const ValueKey('gift-to-code')).last, 'ALI777');
    await tester.tap(find.text(l.actionConfirm));
    await settle(tester);
    expect(nfc.sent, isEmpty);
    expect(find.text(l.giftErrSelf), findsOneWidget);
  });

  testWidgets('server xatosi — saytdagi aniq matn', (tester) async {
    await pump(tester, error: 'RECIPIENT_NOT_FOUND');
    await tester.enterText(find.byKey(const ValueKey('gift-to-code')).last, 'ZZZ999');
    await tester.tap(find.text(l.actionConfirm));
    await settle(tester);
    expect(find.text(l.giftErrNotFound), findsOneWidget);
    expect(find.text(l.errUnknown), findsNothing);
  });
}
