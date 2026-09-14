import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show MethodChannel, rootBundle, FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/app.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/design/theme.dart';
import 'package:nfcstore/design/tokens.dart';
import 'package:nfcstore/design/type.dart';
import 'package:nfcstore/state/app_lock.dart';
import 'package:nfcstore/state/app_prefs.dart';
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

/// RASM KESHI UCHUN PAPKA.
///
/// `cached_network_image` ish boshlashi bilan `path_provider` dan
/// vaqtinchalik papka so'raydi. Testda plagin yo'q va so'rov
/// istisno bilan tugaydi — natijada galereya kabi HAQIQIY manzilli
/// rasmlar bor ekran umuman chizilmasdi.
///
/// Tarmoq baribir yo'q: rasm kelmaydi va o'rniga bo'sh joy
/// ko'rinadi — auditda aynan shu holat ham baholanadi.
void mockImageCacheDir() {
  final dir = Directory.systemTemp.createTempSync('nfcstore-audit');
  addTearDown(() {
    try {
      dir.deleteSync(recursive: true);
    } catch (_) {}
  });
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
    const MethodChannel('plugins.flutter.io/path_provider'),
    (call) async => dir.path,
  );
}

/// Audit uchun holat — soxta server bilan.
///
/// Token OLDINDAN qo'yiladi: `boot()` uni topmasa ilova "kirilmagan"
/// holatga o'tadi va egalik talab qiladigan ekranlar (QR, o'z profili,
/// karta buyurtmasi) umuman ochilmaydi.
AppState auditState({AuditMode mode = AuditMode.normal}) => AppState(
      api: Api(client: auditClient(mode: mode)),
      storage: FakeStore({'nfc_session_token': 'audit-token'}),
    );

/// ILOVANING HAQIQIY QOBIG'I.
///
/// `app.dart` dagi builder bilan AYNAN bir xil: Material qatlami,
/// mavzu, matn masshtabi chegarasi. Aks holda audit ekranni haqiqiy
/// ilovadagidan boshqacha ko'rsatardi va xulosa yolg'on bo'lardi.
Widget auditApp(Widget child, AppState state,
        {AppLock? lock, AppPrefs? prefs, GlobalKey<NavigatorState>? navKey}) =>
    AppScope(
      state: state,
      // KO'RINISH SOZLAMALARI ham o'ralishi SHART: haqiqiy ilovada
      // ular ildizda turadi va ekranlar ularni o'qiydi. Auditda
      // bo'lmasa, kadr haqiqiy ilovadan farq qilardi (va sozlamalar
      // ekrani umuman ochilmasdi).
      child: AppPrefsScope(
        prefs: prefs ?? AppPrefs(storage: FakeStore()),
        child: AppLockScope(
        lock: lock ?? AppLock(storage: FakeStore()),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          navigatorKey: navKey,
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
      ),
    );

/// Ekranni kadrga joylab, tarmoq javoblarini kutadi.
Future<void> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  AppState? state,
  AppLock? lock,
  AppPrefs? prefs,
}) async {
  tester.view.physicalSize = auditSize * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  // EKRAN ILDIZ USTIGA QO'YILADI — `home:` ga tashlanmaydi.
  //
  // Sabab: `TopBar` orqaga tugmasini `Navigator.canPop()` ga qarab
  // chizadi (tab ildizida qaytadigan joy yo'q va tugma bosilganda
  // javob bermasdi — qurilmada aynan shu xato topildi). Ekran
  // stekda yolg'iz tursa, auditda orqaga tugmasi hech qachon
  // ko'rinmasdi, holbuki haqiqiy ilovada bu ekranlar ustiga
  // qo'yiladi va tugma bor. Ya'ni kadr ilovadan farq qilardi.
  //
  // Tab ildizlari (Shell, ProfileTab) bundan ta'sirlanmaydi:
  // ularning ichida o'z Navigator'i bor va u yerda `canPop()`
  // baribir `false`.
  final navKey = GlobalKey<NavigatorState>();
  await tester.pumpWidget(auditApp(const SizedBox.shrink(), state ?? auditState(),
      lock: lock, prefs: prefs, navKey: navKey));
  await tester.pump();
  navKey.currentState!.push(MaterialPageRoute<void>(builder: (_) => screen));

  // Soxta server javoblari va animatsiyalar tugasin.
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(seconds: 2));
}
