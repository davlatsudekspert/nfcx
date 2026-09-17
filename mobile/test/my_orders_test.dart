import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/design/theme.dart';
import 'package:nfcstore/screens/orders/my_orders.dart';
import 'package:nfcstore/state/app_state.dart';
import 'widget_test.dart' show FakeStore;
import 'settle.dart';

Widget host(Widget child, AppState state) => AppScope(
      state: state,
      child: MaterialApp(theme: buildTheme(), home: child),
    );

AppState stateWith(MockClient c) => AppState(api: Api(client: c), storage: FakeStore());

MockClient ordersReturning(List<Map<String, dynamic>> orders) =>
    MockClient((_) async => http.Response(jsonEncode({'orders': orders}), 200));

void main() {
  group('Buyurtmalarim', () {
    testWidgets('tugallanmagan to‘lovni DAVOM ETTIRISH mumkin', (tester) async {
      // Bu ekranning butun sababi shu: to‘lovni yarmida tashlab ketgan
      // odam qulflanib qolardi — kod 24 soat uning nomiga band bo‘ladi
      // va qaytadan urinsa "reserved_pending_payment" xatosini oladi.
      final state = stateWith(ordersReturning([
        {
          'id': 42,
          'code': 'GLD100',
          'price': 149000,
          'status': 'pending',
          'kind': 'card_purchase',
          'payLink': 'https://checkout.paycom.uz/abc',
          'expiresAtMs': DateTime.now().add(const Duration(hours: 3)).millisecondsSinceEpoch,
        },
      ]));

      await tester.pumpWidget(host(const MyOrdersScreen(), state));
      await settle(tester);

      expect(find.text('GLD100'), findsOneWidget);
      // HOLAT CHIPI ODDIY HARFDA. Dizaynda katta harf faqat mono
      // holat yozuvida ("HOLAT: KUTILMOQDA" — to‘lov ekrani), chip
      // esa gap boshidagidek yoziladi: u ro‘yxatdagi o‘nlab
      // qatorda takrorlanadi va baqirmasligi kerak.
      expect(find.text('Kutilmoqda'), findsOneWidget);
      expect(find.text('To‘lovni davom ettirish'), findsOneWidget);
      // Qolgan vaqt ko‘rsatiladi.
      expect(find.textContaining('Band qilish tugashi'), findsOneWidget);
      expect(find.textContaining('soat'), findsOneWidget);
    });

    testWidgets('to‘langan buyurtmada davom ettirish tugmasi yo‘q', (tester) async {
      final state = stateWith(ordersReturning([
        {'id': 7, 'code': 'VIP001', 'price': 490000, 'status': 'paid', 'kind': 'card_purchase'},
      ]));
      await tester.pumpWidget(host(const MyOrdersScreen(), state));
      await settle(tester);

      expect(find.text('To‘langan'), findsOneWidget);
      expect(find.text('To‘lovni davom ettirish'), findsNothing);
      expect(find.textContaining('Band qilish'), findsNothing);
    });

    testWidgets('muddat ma‘lum bo‘lmasa ham ekran ishlaydi', (tester) async {
      // `expiresAtMs` buzuq sana uchun null keladi — taymer o‘rniga
      // qisqa yozuv chiqadi, lekin davom ettirish IMKONI QOLADI.
      final state = stateWith(ordersReturning([
        {
          'id': 9,
          'code': 'SLV207',
          'price': 99000,
          'status': 'pending',
          'payLink': 'https://checkout.paycom.uz/x',
          'expiresAtMs': null,
        },
      ]));
      await tester.pumpWidget(host(const MyOrdersScreen(), state));
      await settle(tester);

      expect(find.text('To‘lov yakunlanmagan.'), findsOneWidget);
      expect(find.text('To‘lovni davom ettirish'), findsOneWidget);
    });

    testWidgets('muddati o‘tgan bo‘lsa taymer ko‘rsatilmaydi', (tester) async {
      final state = stateWith(ordersReturning([
        {
          'id': 11,
          'code': 'KTB482',
          'price': 49000,
          'status': 'pending',
          'expiresAtMs': DateTime.now().subtract(const Duration(minutes: 5)).millisecondsSinceEpoch,
        },
      ]));
      await tester.pumpWidget(host(const MyOrdersScreen(), state));
      await settle(tester);

      expect(find.textContaining('Band qilish tugashi'), findsNothing);
      expect(find.text('To‘lov yakunlanmagan.'), findsOneWidget);
    });

    testWidgets('buyurtma turi odam tilida', (tester) async {
      final state = stateWith(ordersReturning([
        {'id': 1, 'code': 'VIP001', 'price': 200000, 'status': 'paid', 'kind': 'physical_card_order'},
        {'id': 2, 'code': 'PREMIUM', 'price': 99000, 'status': 'paid', 'kind': 'premium_upgrade'},
      ]));
      await tester.pumpWidget(host(const MyOrdersScreen(), state));
      await settle(tester);

      expect(find.text('Jismoniy karta'), findsOneWidget);
      expect(find.text('Premium obuna'), findsOneWidget);
    });

    testWidgets('bo‘sh ro‘yxat BOSHI BERK emas — do‘konga yo‘l bor',
        (tester) async {
      final state = stateWith(ordersReturning([]));
      await tester.pumpWidget(host(const MyOrdersScreen(), state));
      await settle(tester);

      expect(find.text('Hozircha buyurtma yo‘q'), findsOneWidget);

      // ASOSIYSI — TUGMA. Odam aynan shu ekranda birinchi
      // buyurtmasini qilmoqchi bo'ladi; faqat "hali yo'q" deb
      // yozish uni do'konni o'zi qidirishga majbur qilardi.
      expect(find.text('Do‘konga o‘tish'), findsOneWidget);
    });

    testWidgets('xatoda ASOSIY XABAR jumla, texnik qator esa alohida',
        (tester) async {
      // QAROR ANIQLASHTIRILDI. Avval bu test "kod umuman ko'rinmasin"
      // deb turardi. Qurilmada esa buning narxi ko'rindi: ekranda
      // faqat umumiy jumla qolardi va nima yiqilgani — qaysi manzil,
      // qaysi kod — bilib bo'lmasdi.
      //
      // Endi ikkalasi ham bor va ular ARALASHMAYDI: odamga
      // mo'ljallangan jumla katta yozuvda, texnik qator esa ostida,
      // kichik va kulrang. Suratga olib yuborish kifoya.
      final state = stateWith(MockClient((_) async => http.Response('{"error":"boom"}', 500)));
      await tester.pumpWidget(host(const MyOrdersScreen(), state));
      await settle(tester);

      expect(find.text('Qayta urinish'), findsOneWidget);
      // Asosiy xabar — odam tilida, xom kalitsiz.
      expect(find.text('Serverda xatolik. Birozdan so‘ng qayta urining.'),
          findsOneWidget);
      // Texnik qator — kalit va holat bilan.
      expect(find.textContaining('boom'), findsOneWidget);
      expect(find.textContaining('HTTP 500'), findsOneWidget);
    });
  });
}
