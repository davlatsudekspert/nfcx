import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/design/theme.dart';
import 'package:nfcstore/screens/business/edit_business.dart';
import 'package:nfcstore/screens/business/working_hours.dart';
import 'package:nfcstore/state/app_state.dart';
import 'widget_test.dart' show FakeStore;

/// BIZNES TAHRIRI — SAQLANMAGAN MA'LUMOT YO'QOLMASLIGI.
///
/// Ish vaqti, katalog va galereya ALOHIDA ekranda va o'zlari
/// saqlanadi. Demak odam shaklda nom yozib, saqlamasdan o'sha
/// bo'limga o'tsa — yozgani yo'qolishi mumkin edi. Bu eng jim
/// ketadigan xato turi: hech qanday xato xabari chiqmaydi, faqat
/// odamning ishi yo'qoladi.
void main() {
  final company = Company(
    id: 'DDD333',
    name: 'NFCSTORE',
    about: 'Premium NFC biznes kartalar va smart teglar uchun do‘kon.',
    city: 'Toshkent',
    phone: '+998901112233',
    hours: const [DayHours(closed: false, open: '10:00', close: '19:00')],
  );

  AppState stateWith(MockClient client) =>
      AppState(api: Api(client: client), storage: FakeStore());

  Widget host(Widget child, AppState state) => AppScope(
        state: state,
        child: MaterialApp(theme: buildTheme(), home: child),
      );

  /// «Bo'limlar» ro'yxati shaklning eng pastida — testda ham
  /// haqiqiy odam kabi pastga tushish kerak.
  Future<void> toSections(WidgetTester tester) async {
    await tester.dragUntilVisible(
      find.text('Ish vaqti'),
      find.byType(ListView).first,
      const Offset(0, -300),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('o‘zgarishsiz — bo‘lim darhol ochiladi', (tester) async {
    final state = stateWith(MockClient(
        (_) async => http.Response(jsonEncode({'company': {}}), 200)));

    await tester.pumpWidget(host(EditBusinessScreen(company: company), state));
    await tester.pumpAndSettle();
    await toSections(tester);

    await tester.tap(find.text('Ish vaqti'));
    await tester.pumpAndSettle();

    expect(find.byType(WorkingHoursScreen), findsOneWidget);
  });

  testWidgets('o‘zgarish bo‘lsa — avval so‘raladi', (tester) async {
    var patched = false;
    final state = stateWith(MockClient((req) async {
      if (req.method == 'PATCH') patched = true;
      return http.Response(jsonEncode({'company': {}, 'user': {}, 'cards': []}), 200);
    }));

    await tester.pumpWidget(host(EditBusinessScreen(company: company), state));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(EditableText).first, 'YANGI NOM');
    await tester.pumpAndSettle();
    await toSections(tester);

    await tester.tap(find.text('Ish vaqti'));
    await tester.pumpAndSettle();

    // Ekran ALMASHMAYDI: oldin savol chiqadi.
    expect(find.byType(WorkingHoursScreen), findsNothing);
    expect(find.text('Saqlanmagan o‘zgarishlar'), findsOneWidget);
    expect(patched, isFalse);
  });
}
