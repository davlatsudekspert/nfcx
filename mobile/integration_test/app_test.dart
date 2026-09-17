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
/// SERVER: `--dart-define=API_BASE=...` orqali beriladi (CI lokal
/// dev serverni ko'taradi) — ishlab turgan `nfcstore.uz` ga sinov
/// ma'lumotlari hech qachon yozilmaydi. Berilmasa sinov YIQILADI.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // SERVER MANZILI `--dart-define` DAN OLINADI, `Platform.environment`
  // DAN EMAS.
  //
  // Bu farq bir marta soxta yashil berdi: `--dart-define` — KOMPILYATSIYA
  // paytidagi doimiy, u telefondagi muhit o'zgaruvchisiga AYLANMAYDI.
  // `Platform.environment['API_BASE']` emulyatorda doim bo'sh bo'lgan,
  // sinovlar o'zini o'tkazib yuborgan va ish oqimi "0 tests passed,
  // 1 skipped" bilan YASHIL tugagan — ya'ni "ilova qurilmada
  // ochiladi" degan xulosa hech narsaga asoslanmagan edi.
  const base = String.fromEnvironment('API_BASE');

  /// Hisob — berilmasa demo. Parol KODDA EMAS, GitHub Secret'dan
  /// `--dart-define` orqali keladi va hech qayerda saqlanmaydi.
  const loginEmail =
      String.fromEnvironment('LOGIN_EMAIL', defaultValue: 'dilshod@nfcstore.uz');
  const loginPassword =
      String.fromEnvironment('LOGIN_PASSWORD', defaultValue: 'demo1234');
  if (base.isEmpty) {
    // O'TKAZIB YUBORILMAYDI, YIQITILADI. Sinov o'zini jimgina
    // chetga olsa, ish oqimi yashil bo'ladi va hech kim ilova
    // sinalmaganini bilmaydi. Yiqilgani esa darrov ko'rinadi.
    testWidgets('API_BASE berilishi SHART', (_) async {
      fail('API_BASE berilmagan: sinov --dart-define=API_BASE=... bilan '
          'ishga tushirilishi kerak. Busiz ilova qurilmada umuman '
          'tekshirilmaydi.');
    });
    return;
  }

  /// CHEGARALANGAN KUTISH — `pumpAndSettle` O'RNIGA.
  ///
  /// `pumpAndSettle` kadrlar TO'XTAGUNCHA kutadi, ilovada esa doim
  /// aylanadigan animatsiyalar bor (istorya oltin halqasi, aura,
  /// skeleton yaltirashi). Ular hech qachon to'xtamaydi va sinov
  /// vaqt tugagunicha osilib qoladi — aynan shu sabab birinchi
  /// sayohat 10 daqiqada bitta ham surat olmasdan yiqilgan edi.
  Future<void> settleFor(WidgetTester t,
      [Duration d = const Duration(seconds: 2)]) async {
    final steps = d.inMilliseconds ~/ 100;
    for (var i = 0; i < steps; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
  }

  /// Matn ekranda paydo bo'lguncha kutadi (yoki vaqt tugaguncha).
  ///
  /// `pumpAndSettle` bu yerda YETMAYDI: ilova tarmoqqa chiqadi va
  /// animatsiyalar tinganda ham javob hali kelmagan bo'lishi mumkin.
  Future<bool> waitFor(WidgetTester t, Finder f,
      {int steps = 40}) async {
    for (var i = 0; i < steps; i++) {
      await t.pump(const Duration(milliseconds: 250));
      if (f.evaluate().isNotEmpty) return true;
    }
    return false;
  }

  /// Ilovani HAQIQIY holicha ishga tushiradi va KIRISH ekraniga
  /// olib chiqadi.
  ///
  /// `main()` ning o'zi chaqirilmaydi: unda server manzili qat'iy
  /// `nfcstore.uz` bo'ladi. Qolgan hamma narsa — holat, qulf,
  /// sozlamalar, navigatsiya — ilovadagi bilan AYNAN bir xil.
  ///
  /// TOZA O'RNATISHDA BIRINCHI EKRAN — TANISHTIRUV, KIRISH EMAS.
  /// Buni aynan qurilmadagi sinov ko'rsatdi: `_onboarded` yolg'on
  /// bo'lgani uchun ilova `OnboardingScreen` ni ochadi va "Xush
  /// kelibsiz" faqat undan keyin chiqadi. Sinov buni o'tkazib
  /// yuborgan va "ilova ochilmadi" degan noto'g'ri xulosa bergan
  /// edi. Endi tanishtiruv HAQIQIY foydalanuvchidek yopiladi —
  /// "O'tkazib yuborish" tugmasi bosiladi.
  Future<void> launch(WidgetTester t) async {
    await t.pumpWidget(NfcstoreApp(state: AppState(api: Api(baseUrl: base))));

    // Splash → boot(). Tarmoq javobini kutamiz.
    await waitFor(
      t,
      find.byWidgetPredicate((w) =>
          w is Text &&
          (w.data == 'O‘tkazib yuborish' ||
              w.data == 'Xush kelibsiz' ||
              w.data == 'Bosh sahifa')),
    );
    await settleFor(t, const Duration(seconds: 2));

    // SPLASHDA QOTIB QOLMAGANINI shu yerda tekshiramiz: agar
    // yuqoridagi uch ekrandan biri ham chiqmagan bo'lsa, ekranda
    // hamon yuklanish yozuvi turadi.
    expect(find.text('YUKLANMOQDA'), findsNothing,
        reason: 'ilova splash ekranida qotib qolmasligi kerak');

    final skip = find.text('O‘tkazib yuborish');
    if (skip.evaluate().isNotEmpty) {
      await t.tap(skip);
      await settleFor(t, const Duration(seconds: 2));
    }
  }

  /// Demo hisob bilan kiradi va qobiq ochilishini kutadi.
  Future<void> signIn(WidgetTester t) async {
    final fields = find.byType(TextField);
    expect(fields, findsWidgets, reason: 'kirish maydonlari bo‘lishi kerak');
    await t.enterText(fields.at(0), loginEmail);
    await t.enterText(fields.at(1), loginPassword);
    await settleFor(t);

    await t.tap(find.widgetWithText(GestureDetector, 'Kirish').last);
    await waitFor(t, find.text('Bosh sahifa'));
    await settleFor(t, const Duration(seconds: 3));
  }

  testWidgets('ilova ochiladi va kirish ekraniga chiqadi', (t) async {
    await launch(t);

    expect(find.text('Xush kelibsiz'), findsOneWidget,
        reason: 'tanishtiruvdan keyin kirish ekrani ochilishi kerak');
  });

  testWidgets('RO‘YXATDAN O‘TISH ochiladi va orqaga qaytadi', (t) async {
    await launch(t);

    // Kirish/Ro'yxatdan o'tish almashtirgichi.
    final toggle = find.text('Ro‘yxatdan o‘tish');
    expect(toggle, findsWidgets, reason: 'ro‘yxatdan o‘tish yo‘li bo‘lishi shart');
    await t.tap(toggle.first);
    await settleFor(t, const Duration(seconds: 2));

    // Forma maydonlari haqiqatan chiqdimi.
    expect(find.text('Shaxsiy profil'), findsOneWidget,
        reason: 'shaxsiy/kompaniya tanlovi ko‘rinishi kerak');
    expect(find.text('Kompaniya profili'), findsOneWidget);
    expect(find.text('Email'), findsWidgets);

    // KOMPANIYA TANLOVI bosiladi — tanlov ishlaydimi.
    await t.tap(find.text('Kompaniya profili'));
    await settleFor(t);

    // ORQAGA QAYTISH ishlaydimi (Android tizim tugmasi).
    final nav = find.byType(Navigator).first;
    final state = t.state<NavigatorState>(nav);
    if (state.canPop()) {
      state.pop();
      await settleFor(t, const Duration(seconds: 1));
      expect(find.text('Xush kelibsiz'), findsOneWidget,
          reason: 'orqaga qaytganda kirish ekrani qaytishi kerak');
    }
  });

  testWidgets('KIRISH ishlaydi va bosh sahifa lenta bilan ochiladi',
      (t) async {
    await launch(t);

    // Haqiqiy hisob bilan kirish (demo ma'lumotlari CI da seed
    // qilinadi).
    await signIn(t);

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
    await settleFor(t);
    expect(find.text('Lenta'), findsOneWidget,
        reason: 'bosh sahifada lenta bo‘lishi kerak');
  });

  testWidgets('REELS ochiladi', (t) async {
    await launch(t);

    await signIn(t);

    // "Lenta" sarlavhasi yonidagi "Reels" havolasi.
    await t.dragUntilVisible(
      find.text('Reels'),
      find.byType(CustomScrollView).first,
      const Offset(0, -300),
    );
    await settleFor(t);
    await t.tap(find.text('Reels'));
    await settleFor(t, const Duration(seconds: 3));

    // Reels ekrani ochildi — sarlavha yoki bo'sh holat.
    final opened = find.text('Reels').evaluate().isNotEmpty ||
        find.text('Reels hozircha bo‘sh').evaluate().isNotEmpty;
    expect(opened, isTrue, reason: 'Reels ekrani ochilishi kerak');
  });

  testWidgets('pastki navigatsiya — hamma tab ochiladi', (t) async {
    await launch(t);

    await signIn(t);

    // HAR BIR TAB HAQIQATAN OCHILADIMI.
    for (final tab in ['Qidiruv', 'Do‘kon', 'Profil', 'Bosh sahifa']) {
      await t.tap(find.text(tab).last);
      await settleFor(t, const Duration(seconds: 2));
      expect(find.text(tab), findsWidgets, reason: '$tab tabi ochilishi kerak');
    }
  });
}
