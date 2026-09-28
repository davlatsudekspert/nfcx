import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/contact_info.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/card_number_sheet.dart';
import 'package:nfcstore_nova/design/widgets/contact_buttons.dart';
import 'package:nfcstore_nova/features/profile/contact_editor.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'helpers.dart';

/// PLASTIK KARTA ALOQA QATORIDA (egasi, 2026-09-28: "bu qatorda
/// plastik karta ham qo'yiladi, unga ham shularga moslab logo qilib
/// qo'y"; "karta yozsa, o'sha belgini bossa QR kod va ostida karta
/// nomeri ko'rinishi kerak").
void main() {
  group('model — saytdagi maydonlar', () {
    test('profil: asosiy + qo‘shimcha kartalar tugma bo‘ladi', () {
      final c = ContactInfo.fromRecord({
        'tg': 'nfcstore',
        'website': 'nfcstore.uz',
        'cardNumber': '8600 1234 5678 9012',
        'cardNumbers': [
          {'label': 'Humo', 'number': '9860 0000 1111 2222'},
          {'label': 'bo‘sh', 'number': ''},
        ],
        'extraLinks': [
          {'label': 'Menyu', 'url': 'https://menu.uz'},
        ],
      });
      final kinds = c.actions().map((a) => a.kind).toList();
      expect(kinds, [
        ContactKind.telegram,
        ContactKind.website,
        ContactKind.card,
        ContactKind.card,
        ContactKind.link,
      ], reason: 'karta — veb-saytdan keyin, qo‘shimcha havolalardan oldin');
      final cards = c.actions().where((a) => a.kind == ContactKind.card);
      expect(cards.first.url, '8600 1234 5678 9012');
      expect(cards.last.label, 'Humo');
    });

    test('karta yo‘q — tugma ham yo‘q', () {
      final c = ContactInfo.fromRecord({'tg': 'nfcstore'});
      expect(c.actions().any((a) => a.kind == ContactKind.card), isFalse);
    });

    test('biznes: cardNumber', () {
      final c = ContactInfo.fromCompany({'cardNumber': '8600123456789012'});
      expect(c.actions().single.kind, ContactKind.card);
      expect(c.toCompanyJson()['cardNumber'], '8600123456789012');
    });

    test('saqlash: asosiy raqam yuboriladi, qo‘shimchalar tegilmaydi', () {
      final c = ContactInfo.fromRecord({
        'cardNumber': '8600 1234 5678 9012',
        'cardNumbers': [
          {'label': 'Humo', 'number': '9860 0000 1111 2222'},
        ],
      });
      final j = c.toRecordJson();
      expect(j['cardNumber'], '8600 1234 5678 9012');
      expect(j.containsKey('cardNumbers'), isFalse,
          reason: 'saytdagi qo‘shimcha kartalar ilova saqlaganda o‘chmasin');
      expect(c.copyWith(phone: '1').cardNumbers.single.label, 'Humo');
    });
  });

  test('raqam 4 tadan ajratiladi', () {
    expect(prettyCardNumber('8600123456789012'), '8600 1234 5678 9012');
    expect(prettyCardNumber('8600 1234 5678 9012'), '8600 1234 5678 9012');
  });

  group('tugma va oyna', () {
    Future<void> pump(WidgetTester tester, List<ContactAction> actions,
        {NfcTokens? tokens}) async {
      tester.view.physicalSize = const Size(390, 844) * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(wrapScreen(
        Scaffold(
          body: Center(child: ContactButtons(actions: actions)),
        ),
        tokens: tokens,
      ));
      await tester.pump();
    }

    testWidgets('"Karta" belgisi qatorda, boshqalar bilan bir uslubda',
        (tester) async {
      await pump(tester, const [
        ContactAction(kind: ContactKind.telegram, url: 'https://t.me/x'),
        ContactAction(kind: ContactKind.instagram, url: 'https://ig.com/x'),
        ContactAction(kind: ContactKind.email, url: 'mailto:a@b.uz'),
        ContactAction(kind: ContactKind.map, url: 'https://maps'),
        ContactAction(kind: ContactKind.card, url: '8600123456789012'),
      ]);
      expect(find.byKey(const ValueKey('contact-card')), findsOneWidget);
      expect(find.text('Karta'), findsOneWidget);
      expect(tester.takeException(), isNull);
      // Raqam qatorda OCHIQ turmaydi.
      expect(find.textContaining('8600'), findsNothing);
    });

    testWidgets('bosilsa: QR, ostida raqam, nusxalash', (tester) async {
      final copied = <String>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') {
          copied.add((call.arguments as Map)['text'] as String);
        }
        return null;
      });
      addTearDown(() => tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));

      await pump(tester, const [
        ContactAction(
            kind: ContactKind.card, url: '8600 1234 5678 9012', label: 'Humo'),
      ]);
      expect(find.text('Humo'), findsOneWidget, reason: 'egasi bergan nom');
      await tester.tap(find.byKey(const ValueKey('contact-card')));
      await tester.pumpAndSettle();

      final qr = tester.widget<QrImageView>(find.byType(QrImageView));
      expect(qr, isNotNull);
      final qrBox = tester.getRect(find.byKey(const ValueKey('card-number-qr')));
      final num = tester.getRect(find.byKey(const ValueKey('card-number-text')));
      expect(num.top, greaterThan(qrBox.bottom), reason: 'raqam QR OSTIDA');
      expect(find.text('8600 1234 5678 9012'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('card-number-copy')));
      await tester.pump();
      expect(copied, ['8600123456789012'],
          reason: 'bo‘shliqsiz — bank ilovasiga to‘g‘ri tushsin');
      expect(find.text('Karta raqami nusxalandi'), findsOneWidget);
    });
  });

  testWidgets('tahrirda karta raqami maydoni — faqat raqamlar saqlanadi',
      (tester) async {
    ContactInfo? last;
    await tester.pumpWidget(wrapScreen(Scaffold(
      body: SingleChildScrollView(
        child: ContactEditor(
          initial: const ContactInfo(),
          onChanged: (c) => last = c,
        ),
      ),
    )));
    await tester.enterText(
        find.byKey(const ValueKey('edit-card')), '8600-1234 5678 9012');
    expect(last?.cardNumber, '86001234 5678 9012');
    expect(last!.actions().single.kind, ContactKind.card);
  });
}
