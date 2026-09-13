import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/app.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/design/theme.dart';
import 'package:nfcstore/design/tokens.dart';
import 'package:nfcstore/design/type.dart';
import 'package:nfcstore/state/app_lock.dart';
import 'package:nfcstore/state/app_state.dart';
import '../widget_test.dart' show FakeStore;
import 'fixtures.dart';

/// Dizayn kadri — handoffdagi 390×844.
const auditSize = Size(390, 844);

/// SHRIFTLARNI YUKLASH.
///
/// `flutter test` standart holatda hamma matnni bo'sh to'rtburchak
/// ("Ahem") shrifti bilan chizadi. Vizual audit uchun bu yaroqsiz:
/// tipografika — dizaynning yarmi. Shuning uchun haqiqiy TTF fayllar
/// yuklanadi.
Future<void> loadAuditFonts() async {
  const fonts = {
    'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
    'Manrope': [
      'assets/fonts/Manrope-400.ttf',
      'assets/fonts/Manrope-500.ttf',
      'assets/fonts/Manrope-600.ttf',
      'assets/fonts/Manrope-700.ttf',
      'assets/fonts/Manrope-800.ttf',
    ],
    'IBMPlexMono': [
      'assets/fonts/IBMPlexMono-400.ttf',
      'assets/fonts/IBMPlexMono-500.ttf',
      'assets/fonts/IBMPlexMono-600.ttf',
      'assets/fonts/IBMPlexMono-700.ttf',
    ],
  };
  for (final e in fonts.entries) {
    final loader = FontLoader(e.key);
    for (final path in e.value) {
      loader.addFont(rootBundle.load(path));
    }
    await loader.load();
  }
}

/// Audit uchun holat — soxta server bilan.
///
/// Token OLDINDAN qo'yiladi: `boot()` uni topmasa ilova "kirilmagan"
/// holatga o'tadi va egalik talab qiladigan ekranlar (QR, o'z profili,
/// karta buyurtmasi) umuman ochilmaydi.
AppState auditState() => AppState(
      api: Api(client: auditClient()),
      storage: FakeStore({'nfc_session_token': 'audit-token'}),
    );

/// ILOVANING HAQIQIY QOBIG'I.
///
/// `app.dart` dagi builder bilan AYNAN bir xil: Material qatlami,
/// mavzu, matn masshtabi chegarasi. Aks holda audit ekranni haqiqiy
/// ilovadagidan boshqacha ko'rsatardi va xulosa yolg'on bo'lardi.
Widget auditApp(Widget child, AppState state, {AppLock? lock}) => AppScope(
      state: state,
      child: AppLockScope(
        lock: lock ?? AppLock(storage: FakeStore()),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(),
          builder: (context, inner) => MediaQuery.withClampedTextScaling(
            minScaleFactor: 1,
            maxScaleFactor: 1.3,
            child: Material(
              type: MaterialType.canvas,
              color: C.obsidian,
              textStyle: T.body.copyWith(color: C.offWhite),
              child: inner ?? const SizedBox(),
            ),
          ),
          home: child,
        ),
      ),
    );

/// Ekranni kadrga joylab, tarmoq javoblarini kutadi.
Future<void> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  AppState? state,
  AppLock? lock,
}) async {
  tester.view.physicalSize = auditSize * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(auditApp(screen, state ?? auditState(), lock: lock));
  // Soxta server javoblari va animatsiyalar tugasin.
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(seconds: 2));
}
