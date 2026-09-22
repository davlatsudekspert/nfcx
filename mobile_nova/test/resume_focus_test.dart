import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/widgets/brand_logo.dart';
import 'package:nfcstore_nova/design/widgets/fields.dart';

import 'helpers.dart';

/// Pochtadan qaytganda kod yozilishi va brendda bitta nom turishi.

/// Ilovadan chiqib QAYTISHNI to'liq taqlid qiladi.
///
/// Android'da holatlar zanjiri: `inactive → hidden → paused`, qaytishda
/// esa `hidden → inactive → resumed`. Flutter oraliq holatlarni tashlab
/// ketishga ruxsat bermaydi, shuning uchun zanjir to'liq yuriladi —
/// test haqiqiy qurilmadagi yo'lni takrorlaydi.
Future<void> leaveAndReturn(WidgetTester tester) async {
  for (final s in const [
    AppLifecycleState.inactive,
    AppLifecycleState.hidden,
    AppLifecycleState.paused,
    AppLifecycleState.hidden,
    AppLifecycleState.inactive,
    AppLifecycleState.resumed,
  ]) {
    tester.binding.handleAppLifecycleStateChanged(s);
    await tester.pump();
  }
  await tester.pump();
}

void main() {
  group('Kod maydoni — ilovadan chiqib qaytish', () {
    // HAQIQIY NOSOZLIK (qurilmada topilgan): odam kodni ko'rish
    // uchun Gmail'ga o'tib qaytganida kod maydoni fokusni
    // yo'qotgan holda qolardi — klaviatura ochilmasdi va raqam
    // yozilmasdi. Ekran qotib qolganday ko'rinardi.
    //
    // Bildirishnoma ustki lentada chiqqanda (ilovadan
    // chiqilmaganda) hammasi ishlardi. Aynan shu farq sababni
    // ko'rsatdi: muammo kodda ham, tarmoqda ham emas, fokusda.
    testWidgets('qaytib kirganda klaviatura qayta ochiladi',
        (tester) async {
      await tester.pumpWidget(
        wrapScreen(
          Material(child: Center(child: CodeField(onCompleted: (_) {}))),
        ),
      );
      await tester.pumpAndSettle();

      final node = tester.widget<TextField>(find.byType(TextField)).focusNode!;
      expect(node.hasFocus, isTrue, reason: 'boshida autofocus ishlaydi');

      // Odam ilovadan chiqadi — tizim fokusni oladi.
      node.unfocus();
      await tester.pump();
      expect(node.hasFocus, isFalse);

      await leaveAndReturn(tester);

      expect(node.hasFocus, isTrue,
          reason: 'qaytib kirganda fokus tiklanmasa, kod yozilmaydi');
    });

    testWidgets('maydon o\'chirilgan bo\'lsa fokus so\'ralmaydi',
        (tester) async {
      // Muddat tugagan yoki so'rov ketayotgan paytda klaviaturani
      // majburan ochish odamni chalg'itadi.
      await tester.pumpWidget(
        wrapScreen(
          Material(
            child: Center(
              child: CodeField(onCompleted: (_) {}, enabled: false),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final node = tester.widget<TextField>(find.byType(TextField)).focusNode!;
      await leaveAndReturn(tester);

      expect(node.hasFocus, isFalse);
    });

    test('kod to\'liq bo\'lsa bufer qayta o\'qilmaydi', () {
      // `Clipboard.getData` platforma oqimiga boradi. Kerak
      // bo\'lmaganda uni chaqirish — bekorga xavf: kod allaqachon
      // to\'liq bo\'lsa taklifning ma\'nosi ham yo\'q.
      final src = File('lib/design/widgets/fields.dart').readAsStringSync();
      expect(src, contains('Clipboard.getData'));
      expect(
        src,
        contains('if (_c.text.length >= widget.length) return;'),
        reason: 'ortiqcha bufer chaqiruvi to\'silishi kerak',
      );
    });
  });

  group('Brend — ilovada bitta nom', () {
    // Odam o'rnatish sahifasida, splash'da va "Ilova haqida"da
    // ikkita boshqa nom ko'rsa, qaysi biri ilova ekanini bilmaydi.
    // `nova` faqat ICHKI kod nomi: papka, paket yo'li, CI ishi.
    testWidgets('splash so\'z belgisida NOVA yo\'q', (tester) async {
      await tester.pumpWidget(
        wrapScreen(const Center(child: BrandLockup(size: 100))),
      );
      await tester.pumpAndSettle();

      expect(find.text('NFCSTORE'), findsOneWidget);
      expect(find.text('NOVA'), findsNothing);
      expect(find.text('Nova'), findsNothing);
    });

    test('MaterialApp sarlavhasi va tarjimalarda NOVA yo\'q', () {
      // `title` Android\'ning "so\'nggi ilovalar" ro\'yxatida
      // ko\'rinadi.
      expect(
        File('lib/app/app.dart').readAsStringSync(),
        contains("title: 'NFCSTORE',"),
      );
      for (final f in ['app_uz', 'app_en', 'app_ru']) {
        expect(
          File('lib/l10n/arb/$f.arb').readAsStringSync(),
          contains('"appName": "NFCSTORE"'),
          reason: '$f da brend nomi bitta bo\'lsin',
        );
      }
    });
  });
}
