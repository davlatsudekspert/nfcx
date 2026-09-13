import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/repo.dart';
import 'package:nfcstore/design/theme.dart';
import 'package:nfcstore/screens/business/business_stats.dart';
import 'package:nfcstore/screens/orders/owner_orders.dart';
import 'package:nfcstore/state/app_state.dart';
import 'widget_test.dart' show FakeStore;

Widget host(Widget child, AppState state) => AppScope(
      state: state,
      child: MaterialApp(theme: buildTheme(), home: child),
    );

AppState stateWith(MockClient client) =>
    AppState(api: Api(client: client), storage: FakeStore());

void main() {
  group('Ega buyurtmalari', () {
    testWidgets('holat bo‘yicha ajratiladi', (tester) async {
      final state = stateWith(MockClient((_) async => http.Response(
            jsonEncode({
              'orders': [
                {'id': 1, 'itemName': 'Qora karta', 'qty': 1, 'price': 1200000, 'name': 'Mijoz A', 'phone': '+998901112233', 'status': 'new'},
                {'id': 2, 'itemName': 'Smart teg', 'qty': 2, 'price': 580000, 'name': 'Mijoz B', 'status': 'done'},
              ],
            }),
            200,
          )));

      await tester.pumpWidget(host(OwnerOrdersScreen(companyId: 'DDD333'), state));
      await tester.pumpAndSettle();

      // Standart filtr — "Yangi": faqat birinchi buyurtma ko‘rinadi.
      expect(find.text('Qora karta · 1 dona'), findsOneWidget);
      expect(find.text('Smart teg · 2 dona'), findsNothing);
      expect(find.text('Yangi · 1'), findsOneWidget);

      await tester.tap(find.text('Bajarilgan · 1'));
      await tester.pumpAndSettle();
      expect(find.text('Smart teg · 2 dona'), findsOneWidget);
      expect(find.text('Qora karta · 1 dona'), findsNothing);
    });

    testWidgets('holat PATCH bilan SERVERGA yuboriladi', (tester) async {
      // Mahalliy o‘zgartirish yetarli emas: admin paneli va boshqa
      // qurilma ham yangi holatni ko‘rishi kerak.
      final sent = <http.Request>[];
      final state = stateWith(MockClient((r) async {
        sent.add(r);
        if (r.method == 'PATCH') return http.Response('{"ok":true}', 200);
        return http.Response(
          jsonEncode({
            'orders': [
              {'id': 77, 'itemName': 'Karta', 'qty': 1, 'price': 100, 'name': 'X', 'status': 'new'},
            ],
          }),
          200,
        );
      }));

      await tester.pumpWidget(host(OwnerOrdersScreen(companyId: 'DDD333'), state));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Bajarildi'));
      await tester.pumpAndSettle();

      final patch = sent.firstWhere((r) => r.method == 'PATCH');
      expect(patch.url.path, '/api/companies/DDD333/orders/77');
      expect(jsonDecode(patch.body), {'status': 'done'});
      // Yuborilgandan keyin ro‘yxat SERVERDAN qayta o‘qiladi.
      expect(sent.where((r) => r.method == 'GET').length, greaterThan(1));
    });

    testWidgets('bo‘sh ro‘yxatda tushunarli yozuv', (tester) async {
      final state = stateWith(MockClient(
        (_) async => http.Response(jsonEncode({'orders': []}), 200),
      ));
      await tester.pumpWidget(host(OwnerOrdersScreen(companyId: 'X'), state));
      await tester.pumpAndSettle();
      expect(find.text('Yangi buyurtma yo‘q.'), findsOneWidget);
    });
  });

  group('Biznes statistikasi', () {
    testWidgets('raqamlar serverdan chiqadi', (tester) async {
      final state = stateWith(MockClient((_) async => http.Response(
            jsonEncode({
              'days': 30,
              'views': 12400,
              'taps': 842,
              'orders': 42,
              'series': [
                {'day': '2026-09-01', 'views': 10},
                {'day': '2026-09-02', 'views': 40},
              ],
              'actions': [{'key': 'phone', 'hits': 120}],
              'items': [{'id': '1', 'name': 'Qora karta', 'hits': 18}],
            }),
            200,
          )));

      await tester.pumpWidget(host(const BusinessStatsScreen(companyId: 'DDD333'), state));
      await tester.pumpAndSettle();

      expect(find.text('12.4k'), findsOneWidget);
      expect(find.text('842'), findsOneWidget);
      expect(find.text('42'), findsOneWidget);
      expect(find.text('Qora karta'), findsOneWidget);
    });

    testWidgets('ma‘lumot yo‘q bo‘lsa bo‘sh holat', (tester) async {
      final state = stateWith(MockClient((_) async => http.Response(
            jsonEncode({'views': 0, 'taps': 0, 'orders': 0, 'series': [], 'actions': [], 'items': []}),
            200,
          )));
      await tester.pumpWidget(host(const BusinessStatsScreen(companyId: 'X'), state));
      await tester.pumpAndSettle();
      // Bo'sh holat endi sarlavha + izoh (audit talabi).
      expect(find.text('Ma‘lumot to‘planmagan'), findsOneWidget);
      expect(find.textContaining('shu yerda'), findsOneWidget);
    });

    testWidgets('xatoda kod emas, jumla va Qayta urinish', (tester) async {
      final state = stateWith(MockClient((_) async => http.Response('{"error":"boom"}', 500)));
      await tester.pumpWidget(host(const BusinessStatsScreen(companyId: 'X'), state));
      await tester.pumpAndSettle();

      expect(find.text('Qayta urinish'), findsOneWidget);
      expect(find.textContaining('500'), findsNothing);
      expect(find.textContaining('boom'), findsNothing);
    });
  });

  group('Tahrirlash', () {
    test('ko‘rsatilmaydigan maydonlar saqlanadi', () async {
      // `PUT` to‘liq yozuvni kutadi. Ekranda yo‘q maydonlar
      // (categorySlug, instagram, manzil) jimgina tozalanib
      // ketmasligi kerak.
      final sent = <http.Request>[];
      final api = Api(client: MockClient((r) async {
        sent.add(r);
        return http.Response(
          jsonEncode({
            'code': 'VIP001', 'name': 'Eski', 'categorySlug': 'dizayn',
            'instagram': 'eski_insta', 'address': 'Amir Temur 42',
          }),
          200,
        );
      }));
      final repo = Repo(api);
      final current = await repo.record('VIP001');
      await repo.updateRecord('VIP001', {
        'name': 'Yangi',
        'categorySlug': current.categorySlug,
        'instagram': current.instagram,
        'address': current.address,
      });

      final put = sent.firstWhere((r) => r.method == 'PUT');
      final body = jsonDecode(put.body) as Map;
      expect(body['name'], 'Yangi');
      expect(body['categorySlug'], 'dizayn');
      expect(body['instagram'], 'eski_insta');
      expect(body['address'], 'Amir Temur 42');
    });
  });
}
