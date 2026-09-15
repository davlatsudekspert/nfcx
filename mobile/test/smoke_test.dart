import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/app.dart';
import 'package:nfcstore/data/deep_link.dart';
import 'package:nfcstore/design/components/logo.dart';
import 'package:nfcstore/design/components/nav_bar.dart';
import 'package:nfcstore/l10n/strings.dart';
import 'package:nfcstore/screens/shell.dart';
import 'package:nfcstore/state/app_lock.dart';
import 'package:nfcstore/state/app_prefs.dart';
import 'audit/harness.dart' show auditSize, auditState, loadAuditFonts, mockImageCacheDir;
import 'widget_test.dart' show FakeStore;
import 'settle.dart';

/// RELIZDAN OLDINGI DUD SINOVI.
///
/// NIMA UCHUN KERAK EDI: qolgan barcha testlar EKRANLARNI alohida
/// ochadi. Ilovaning O'ZI — `NfcstoreApp` — hech qayerda ishga
/// tushirilmasdi. Holbuki u yerda eng ko'p narsa bor: sozlamalarni
/// o'qish, qulf, havolalar oqimi, sessiyani tiklash, to'rt tabli
/// qobiq. Bu qatlamdagi xato ilovani BIRINCHI EKRANDAYOQ o'ldiradi
/// va uni hech bir ekran testi ko'rmaydi.
///
/// Bu yerda haqiqiy ildiz widget ishga tushiriladi va to'rt tab
/// aylanib chiqiladi.
void main() {
  // HAQIQIY SHRIFT VA HAQIQIY EKRAN O'LCHAMI.
  //
  // Ularsiz test yolg'on gapiradi. Shriftsiz Flutter hamma matnni
  // "Ahem" bilan chizadi va uning o'lchamlari boshqacha: maket
  // test muhitida toshib ketadi, telefonda esa hammasi joyida
  // bo'ladi. Standart 800x600 oynasi ham telefon emas.
  setUpAll(loadAuditFonts);
  setUp(mockImageCacheDir);

  /// Haqiqiy ilova — soxta server bilan.
  ///
  /// Qulf va sozlamalar `FakeStore` da: aks holda ular platforma
  /// kanaliga (Keystore) murojaat qilardi va test muhitida
  /// mavjud emas.
  Future<void> boot(WidgetTester tester, {String? locale}) async {
    tester.view.physicalSize = auditSize * 3;
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final state = auditState();
    await tester.pumpWidget(NfcstoreApp(
      state: state,
      lock: AppLock(storage: FakeStore()),
      // Til HAQIQIY YO'L bilan beriladi — saqlangan sozlamadan.
      // `applyLocale()` ni to'g'ridan-to'g'ri chaqirib bo'lmaydi:
      // ilova ishga tushganda saqlangan qiymatni o'qib, uni
      // baribir ustiga yozadi.
      prefs: AppPrefs(
        storage: FakeStore({if (locale != null) 'app_locale': locale}),
      ),
      // Havolalar oqimi bo'sh: plagin test muhitida yo'q va
      // haqiqiy oqim kutilmagan xato berardi.
      links: DeepLinks(stream: const Stream.empty(), initial: Future.value(null)),
    ));
    await settle(tester);
  }

  testWidgets('ilova ishga tushadi va qobiqqa yetadi', (tester) async {
    await boot(tester);
    expect(find.byType(Shell), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('to‘rt tab ham ochiladi', (tester) async {
    await boot(tester);
    for (var i = 0; i < NavBar.tabs.length; i++) {
      final label = NavBar.tabs[i].label;
      // MARKAZIY TAB YORLIQSIZ: u brend medalyoni bilan
      // ko‘rsatiladi, ya‘ni matn bo‘yicha topib bo‘lmaydi.
      await tester.tap(
        i == NavBar.nfcIndex ? find.byType(BrandMark) : find.text(label),
      );
      await settle(tester);
      expect(tester.takeException(), isNull, reason: label);
    }
  });

  /// TAB NOMLARI HAM TARJIMA QILINSIN.
  ///
  /// Pastki panel — ilovaning eng ko'p ko'rinadigan joyi. U
  /// o'zbekcha qolib, qolgan hammasi ruschaga o'tsa, ilova
  /// "yarim tarjima" bo'lib ko'rinardi.
  testWidgets('pastki panel tanlangan tilda', (tester) async {
    addTearDown(() => applyLocale(AppLocale.uz));

    await boot(tester, locale: 'ru');
    expect(find.text('Главная'), findsOneWidget);
    expect(find.text('Home'), findsNothing);
  });
}
