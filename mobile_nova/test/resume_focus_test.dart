import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

    // ASL SABAB SHU YERDA EDI.
    //
    // Boshqa ilovaga o'tib qaytganda fokus tuguni fokusni ushlab
    // turadi, klaviatura bilan bog'lanish esa uzilgan bo'ladi.
    // Ilgari kataklarga bosilganda `requestFocus()` chaqirilardi —
    // fokus allaqachon bor bo'lgani uchun u HECH NARSA qilmasdi
    // va klaviatura umuman ochilmasdi. Maydon o'lik qolardi.
    testWidgets('fokus turganda ham bosilsa klaviatura ochiladi',
        (tester) async {
      await tester.pumpWidget(
        wrapScreen(
          Material(child: Center(child: CodeField(onCompleted: (_) {}))),
        ),
      );
      await tester.pumpAndSettle();

      final node = tester.widget<TextField>(find.byType(TextField)).focusNode!;
      expect(node.hasFocus, isTrue);

      // Klaviatura yopilgan, lekin fokus tugunida fokus qolgan —
      // qurilmada qaytib kirgandan keyingi holat aynan shunday.
      tester.testTextInput.hide();
      expect(tester.testTextInput.isVisible, isFalse);

      // Aynan kataklar ustiga bosiladi: `CodeField` ning o'zi
      // `Column` bo'lgani uchun uning markazi kataklardan pastda
      // qolishi mumkin.
      await tester.tap(find.byKey(const ValueKey('code-boxes')));
      await tester.pumpAndSettle();

      expect(
        tester.testTextInput.isVisible,
        isTrue,
        reason: 'fokus bor bo\'lsa ham bosish klaviaturani ochishi shart — '
            'aks holda maydonga qaytib yozib bo\'lmaydi',
      );
    });

    // QO'SHIMCHA QO'RIQCHI — ASL SABAB EMAS.
    //
    // Buferda kod topilganda taklif qatori paydo bo'ladi va
    // `Column` bolalari [qutilar] dan [taklif, oraliq, qutilar] ga
    // aylanadi. Kalitsiz Flutter bolalarni o'rin bo'yicha
    // solishtiradi va kiritish maydonini butunlay almashtiradi —
    // klaviatura yopiladi, bog'lanish uziladi.
    //
    // Ya'ni taklifni ko'rsatishning o'zi yozish imkonini o'ldirardi.
    testWidgets('buferdan taklif chiqqanda kiritish maydoni saqlanadi',
        (tester) async {
      // Avval bufer bo'sh — taklif yo'q. Odam pochtada kodni
      // nusxalaydi va qaytadi: aynan shunda taklif paydo bo'ladi.
      var clipboard = '';
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async => call.method == 'Clipboard.getData'
            ? <String, dynamic>{'text': clipboard}
            : null,
      );
      addTearDown(() => tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));

      await tester.pumpWidget(
        wrapScreen(
          Material(child: Center(child: CodeField(onCompleted: (_) {}))),
        ),
      );
      await tester.pumpAndSettle();

      final before = tester.state(find.byType(TextField));
      expect(find.byKey(const ValueKey('clipboard-hint')), findsNothing);

      clipboard = '123456';
      await leaveAndReturn(tester);
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('clipboard-hint')), findsOneWidget,
          reason: 'buferdagi kod uchun taklif chiqishi kerak');

      final after = tester.state(find.byType(TextField));
      expect(
        identical(before, after),
        isTrue,
        reason: 'taklif chiqqanda kiritish maydoni qayta qurilsa, '
            'klaviatura yopiladi va qaytib ochilmaydi',
      );
      expect(
        tester.widget<TextField>(find.byType(TextField)).focusNode!.hasFocus,
        isTrue,
      );
    });

    test('kod maydonida autofill ishorasi YO\'Q', () {
      // `AutofillHints.oneTimeCode` qo'shilgan commitdan keyin
      // qurilmada pochtaga o'tib qaytganda klaviatura ochilmay
      // qoldi. Ishora Android autofill xizmatiga maydonni
      // topshiradi va qaytib kirilganda kiritish bog'lanishi
      // tiklanmasligi mumkin.
      //
      // Bu testlar bilan ushlanmaydi — faqat haqiqiy qurilmada
      // ko'rinadi. Shuning uchun qaror MANBADA qulflanadi:
      // qaytarilsa, bu test darhol yiqiladi va sabab o'qiladi.
      final src = File('lib/design/widgets/fields.dart').readAsStringSync();
      // Izohlar tashlab yuboriladi: qaror IZOHDA tushuntirilgan,
      // shuning uchun so'zning o'zi manbada uchrashi tabiiy.
      // Tekshiriladigan narsa — KODda chaqiruv bor-yo'qligi.
      final code = src
          .split('\n')
          .where((l) => !l.trimLeft().startsWith('//'))
          .join('\n');
      expect(
        code,
        isNot(contains('autofillHints:')),
        reason: 'kod maydoniga autofill ishorasi qaytarilgan — '
            'avval qurilmada sinab ko\'ring',
      );
      // Buferdagi kod taklifi esa o'z joyida qolishi shart: u
      // ishoradan keyin qolgan yagona qulaylik.
      expect(code, contains('_ClipboardHint'));
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
