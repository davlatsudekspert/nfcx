// PAROL IKKI MARTA YOZILADI.
//
// NIMA UCHUN: parol yopiq yoziladi va odam nima yozganini ko'rmaydi.
// Bitta maydon bo'lsa, xato bosilgan bitta harf faqat KEYIN —
// birinchi kirish urinishida — bilinardi va odam "parolim
// ishlamayapti" degan holatga tushardi. Ikkinchi maydon xatoni
// yozilayotgan paytida ushlaydi va serverga umuman so'rov ketmaydi.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/design/components/input.dart';
import 'package:nfcstore/design/theme.dart';
import 'package:nfcstore/screens/entry/register.dart';
import 'package:nfcstore/state/app_state.dart';

import 'settle.dart';
import 'widget_test.dart' show FakeStore;

void main() {
  Widget host(Widget child, AppState state) => AppScope(
        state: state,
        child: MaterialApp(theme: buildTheme(), home: child),
      );

  /// Formani to'liq to'ldiradi; parollarni chaqiruvchi beradi.
  Future<int> submit(
    WidgetTester tester, {
    required String password,
    required String repeat,
  }) async {
    var calls = 0;
    final state = AppState(
      api: Api(client: MockClient((_) async {
        calls++;
        return http.Response(jsonEncode({'channel': 'email'}), 200);
      })),
      storage: FakeStore(),
    );

    await tester.pumpWidget(host(const RegisterScreen(), state));
    await settle(tester);

    // BIRINCHI QADAM — PROFIL TURI. Forma faqat shundan keyin
    // ochiladi (saytdagi tartib), shuning uchun test ham avval
    // turni tanlaydi.
    await tester.tap(find.text('Men'));
    await settle(tester);

    final fields = find.byType(Field);
    await tester.enterText(fields.at(0), 'Ali Valiyev');
    await tester.enterText(fields.at(1), 'ali@gmail.com');
    await tester.enterText(fields.at(2), '901234567');
    await tester.enterText(fields.at(3), password);
    await tester.enterText(fields.at(4), repeat);

    // Tugma klaviaturasiz ham ekranning pastida qoladi — bosishdan
    // oldin ko'rinadigan joyga suriladi.
    final button = find.text('Kodni emailga yuborish');
    await tester.ensureVisible(button);
    await settle(tester);
    await tester.tap(button);
    await settle(tester);
    return calls;
  }

  testWidgets('parol maydoni IKKITA', (tester) async {
    final state = AppState(
      api: Api(client: MockClient((_) async => http.Response('{}', 200))),
      storage: FakeStore(),
    );
    await tester.pumpWidget(host(const RegisterScreen(), state));
    await settle(tester);
    await tester.tap(find.text('Men'));
    await settle(tester);

    expect(find.text('PAROL'), findsOneWidget);
    expect(find.text('PAROLNI TAKRORLANG'), findsOneWidget);
  });

  testWidgets('parollar mos kelmasa — SERVERGA SO‘ROV KETMAYDI',
      (tester) async {
    final calls = await submit(
      tester,
      password: 'Ali19821004',
      repeat: 'Ali19821005',
    );

    expect(calls, 0, reason: 'xato forma serverga yuborilmasligi kerak');
    expect(find.textContaining('Parollar bir xil emas'), findsOneWidget);
  });

  testWidgets('parollar mos kelsa — kod so‘raladi', (tester) async {
    final calls = await submit(
      tester,
      password: 'Ali19821004',
      repeat: 'Ali19821004',
    );

    expect(calls, 1);
    expect(find.textContaining('Parollar bir xil emas'), findsNothing);
  });

  testWidgets('qisqa parol avvalgidek to‘xtatiladi', (tester) async {
    // Ikkinchi maydon birinchi qoidani bosib ketmasligi kerak:
    // ikkalasi bir xil, lekin qisqa bo'lsa ham forma o'tmaydi.
    final calls = await submit(tester, password: 'Ali12', repeat: 'Ali12');

    expect(calls, 0);
    expect(find.textContaining('kamida 8 belgi'), findsOneWidget);
  });
}
