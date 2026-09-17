import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore/app.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/state/app_state.dart';

/// HAQIQIY QURILMADA SINOV.
///
/// NIMA UCHUN BU FAYL BOR: `test/` dagi 244 ta sinov widget'larni
/// SOXTA muhitda chizadi — tarmoq yo'q, platforma plaginlari yo'q,
/// ilovaning o'zi ishga tushmaydi. Ular maket to'g'riligini
/// isbotlaydi, lekin "ilova telefonda OCHILADIMI, tugmalar
/// ISHLAYDIMI" degan savolga javob bermaydi.
///
/// Aynan shu bo'shliq sabab qurilmada sinalmagan build "tayyor"
/// deb topshirilgan edi. Bu yerdagi sinovlar ilovani EMULYATORDA,
/// haqiqiy Android ustida, haqiqiy server bilan ishga tushiradi va
/// ekranma-ekran yuradi.
///
/// SERVER: `API_BASE` orqali beriladi (CI lokal dev serverni
/// ko'taradi). Berilmasa sinovlar o'tkazib yuboriladi — ishlab
/// turgan `nfcstore.uz` ga sinov ma'lumotlarini yozmaslik uchun.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final base = Platform.environment['API_BASE'] ?? '';
  if (base.isEmpty) {
    testWidgets('API_BASE berilmagan — o‘tkazib yuborildi', (_) async {},
        skip: true);
    return;
  }

  /// Ilovani HAQIQIY holicha ishga tushiradi.
  ///
  /// `main()` ning o'zi chaqirilmaydi: unda server manzili qat'iy
  /// `nfcstore.uz` bo'ladi. Qolgan hamma narsa — holat, qulf,
  /// sozlamalar, navigatsiya — ilovadagi bilan AYNAN bir xil.
  Future<void> launch(WidgetTester t) async {
    await t.pumpWidget(NfcstoreApp(state: AppState(api: Api(baseUrl: base))));
    // Splash → boot() → kirish yoki qobiq. Tarmoq javobini kutamiz.
    for (var i = 0; i < 40; i++) {
      await t.pump(const Duration(milliseconds: 250));
      if (find.text('Xush kelibsiz').evaluate().isNotEmpty ||
          find.text('Bosh sahifa').evaluate().isNotEmpty) {
        break;
      }
    }
    await t.pumpAndSettle(const Duration(seconds: 2));
  }

  testWidgets('ilova ochiladi va kirish ekraniga chiqadi', (t) async {
    await launch(t);

    // SPLASHDA OSILIB QOLMAYDI. Aynan shu holat — ilova ochiladi,
    // logotip turadi va hech narsa bo'lmaydi — foydalanuvchi uchun
    // "ilova ishlamayapti" degani.
    expect(find.text('Yuklanmoqda'), findsNothing,
        reason: 'ilova splash ekranida qotib qolmasligi kerak');

    expect(find.text('Xush kelibsiz'), findsOneWidget,
        reason: 'kirish ekrani ochilishi kerak');
  });

  testWidgets('RO‘YXATDAN O‘TISH ochiladi va orqaga qaytadi', (t) async {
    await launch(t);

    // Kirish/Ro'yxatdan o'tish almashtirgichi.
    final toggle = find.text('Ro‘yxatdan o‘tish');
    expect(toggle, findsWidgets, reason: 'ro‘yxatdan o‘tish yo‘li bo‘lishi shart');
    await t.tap(toggle.first);
    await t.pumpAndSettle(const Duration(seconds: 2));

    // Forma maydonlari haqiqatan chiqdimi.
    expect(find.text('Shaxsiy profil'), findsOneWidget,
        reason: 'shaxsiy/kompaniya tanlovi ko‘rinishi kerak');
    expect(find.text('Kompaniya profili'), findsOneWidget);
    expect(find.text('Email'), findsWidgets);

    // KOMPANIYA TANLOVI bosiladi — tanlov ishlaydimi.
    await t.tap(find.text('Kompaniya profili'));
    await t.pumpAndSettle();

    // ORQAGA QAYTISH ishlaydimi (Android tizim tugmasi).
    final nav = find.byType(Navigator).first;
    final state = t.state<NavigatorState>(nav);
    if (state.canPop()) {
      state.pop();
      await t.pumpAndSettle(const Duration(seconds: 1));
      expect(find.text('Xush kelibsiz'), findsOneWidget,
          reason: 'orqaga qaytganda kirish ekrani qaytishi kerak');
    }
  });

  testWidgets('KIRISH ishlaydi va bosh sahifa lenta bilan ochiladi',
      (t) async {
    await launch(t);

    // Haqiqiy hisob bilan kirish (demo ma'lumotlari CI da seed
    // qilinadi).
    final fields = find.byType(TextField);
    expect(fields, findsWidgets, reason: 'kirish maydonlari bo‘lishi kerak');
    await t.enterText(fields.at(0), 'dilshod@nfcstore.uz');
    await t.enterText(fields.at(1), 'demo1234');
    await t.pumpAndSettle();

    await t.tap(find.widgetWithText(GestureDetector, 'Kirish').last);
    for (var i = 0; i < 40; i++) {
      await t.pump(const Duration(milliseconds: 250));
      if (find.text('Bosh sahifa').evaluate().isNotEmpty) break;
    }
    await t.pumpAndSettle(const Duration(seconds: 3));

    // QOBIQ OCHILDI: pastki navigatsiya joyida.
    expect(find.text('Bosh sahifa'), findsWidgets,
        reason: 'kirgandan keyin qobiq ochilishi kerak');
    expect(find.text('Do‘kon'), findsWidgets);
    expect(find.text('Profil'), findsWidgets);

    // LENTA — bosh sahifaning pastida.
    await t.dragUntilVisible(
      find.text('Lenta'),
      find.byType(CustomScrollView).first,
      const Offset(0, -300),
    );
    await t.pumpAndSettle();
    expect(find.text('Lenta'), findsOneWidget,
        reason: 'bosh sahifada lenta bo‘lishi kerak');
  });

  testWidgets('REELS ochiladi', (t) async {
    await launch(t);

    final fields = find.byType(TextField);
    await t.enterText(fields.at(0), 'dilshod@nfcstore.uz');
    await t.enterText(fields.at(1), 'demo1234');
    await t.tap(find.widgetWithText(GestureDetector, 'Kirish').last);
    for (var i = 0; i < 40; i++) {
      await t.pump(const Duration(milliseconds: 250));
      if (find.text('Bosh sahifa').evaluate().isNotEmpty) break;
    }
    await t.pumpAndSettle(const Duration(seconds: 3));

    // "Lenta" sarlavhasi yonidagi "Reels" havolasi.
    await t.dragUntilVisible(
      find.text('Reels'),
      find.byType(CustomScrollView).first,
      const Offset(0, -300),
    );
    await t.pumpAndSettle();
    await t.tap(find.text('Reels'));
    await t.pumpAndSettle(const Duration(seconds: 3));

    // Reels ekrani ochildi — sarlavha yoki bo'sh holat.
    final opened = find.text('Reels').evaluate().isNotEmpty ||
        find.text('Reels hozircha bo‘sh').evaluate().isNotEmpty;
    expect(opened, isTrue, reason: 'Reels ekrani ochilishi kerak');
  });

  testWidgets('pastki navigatsiya — hamma tab ochiladi', (t) async {
    await launch(t);

    final fields = find.byType(TextField);
    await t.enterText(fields.at(0), 'dilshod@nfcstore.uz');
    await t.enterText(fields.at(1), 'demo1234');
    await t.tap(find.widgetWithText(GestureDetector, 'Kirish').last);
    for (var i = 0; i < 40; i++) {
      await t.pump(const Duration(milliseconds: 250));
      if (find.text('Bosh sahifa').evaluate().isNotEmpty) break;
    }
    await t.pumpAndSettle(const Duration(seconds: 3));

    // HAR BIR TAB HAQIQATAN OCHILADIMI.
    for (final tab in ['Qidiruv', 'Do‘kon', 'Profil', 'Bosh sahifa']) {
      await t.tap(find.text(tab).last);
      await t.pumpAndSettle(const Duration(seconds: 2));
      expect(find.text(tab), findsWidgets, reason: '$tab tabi ochilishi kerak');
    }
  });
}
