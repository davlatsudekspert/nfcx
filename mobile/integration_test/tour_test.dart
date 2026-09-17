import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore/app.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/state/app_state.dart';

/// EKRANMA-EKRAN SAYOHAT — HAQIQIY ANDROID EKRANINING RASMI.
///
/// NIMA UCHUN BU `test/` DAGI GOLDEN'LARDAN BOSHQA: golden rasmlar
/// widget'ni soxta muhitda chizadi — tarmoq yo'q, plaginlar yo'q,
/// ilovaning `main()` i ishlamaydi. Ular "maket to'g'rimi" degan
/// savolga javob beradi, "ilova ISHLAYAPTIMI" degan savolga emas.
///
/// Bu fayl esa ilovani emulyatorda ishga tushiradi, haqiqiy server
/// bilan gaplashadi va HAR QADAMDA ANDROID EKRANINI suratga oladi.
/// Ya'ni rasmda ko'ringan narsa — chinakam ishlab turgan ilova.
///
/// RASMLAR ILOVANING O'Z PAPKASIGA yoziladi (ruxsat talab
/// qilinmaydi), CI esa ularni `adb pull` bilan oladi.
const _shotDir = '/sdcard/Android/data/uz.nfcstore.app/files/shots';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const base = String.fromEnvironment('API_BASE');
  if (base.isEmpty) {
    testWidgets('API_BASE berilishi SHART', (_) async {
      fail('API_BASE berilmagan: sayohat --dart-define=API_BASE=... bilan '
          'ishga tushiriladi.');
    });
    return;
  }

  /// Qaysi qadam yiqilgani — oxirida bittada aytiladi.
  final failures = <String>[];
  var shot = 0;

  Future<bool> waitFor(WidgetTester t, Finder f, {int steps = 40}) async {
    for (var i = 0; i < steps; i++) {
      await t.pump(const Duration(milliseconds: 250));
      if (f.evaluate().isNotEmpty) return true;
    }
    return false;
  }

  /// Ekranni suratga oladi va faylga yozadi.
  Future<void> capture(WidgetTester t, String name) async {
    shot++;
    final id = shot.toString().padLeft(2, '0');
    try {
      final bytes = await binding.takeScreenshot('$id-$name');
      final f = File('$_shotDir/$id-$name.png');
      f.parent.createSync(recursive: true);
      f.writeAsBytesSync(bytes);
      // ignore: avoid_print
      print('SHOT $id-$name ${bytes.length} bayt');
    } catch (e) {
      failures.add('$id-$name: suratga olinmadi ($e)');
    }
  }

  /// Bitta qadam. Yiqilsa BUTUN sayohatni to'xtatmaydi — qolgan
  /// ekranlar ham ko'rilsin, hisobot esa to'liq bo'lsin.
  Future<void> step(String name, Future<void> Function() body) async {
    try {
      await body();
    } catch (e) {
      failures.add('$name: $e');
    }
  }

  testWidgets('butun ilova bo‘ylab yurish va har ekranni suratga olish',
      (t) async {
    // Android'da surface'ni rasmga aylantirish SHART, aks holda
    // `takeScreenshot` bo'sh qaytaradi.
    await binding.convertFlutterSurfaceToImage();

    await t.pumpWidget(NfcstoreApp(state: AppState(api: Api(baseUrl: base))));
    await waitFor(
      t,
      find.byWidgetPredicate((w) =>
          w is Text &&
          (w.data == 'O‘tkazib yuborish' ||
              w.data == 'Xush kelibsiz' ||
              w.data == 'Bosh sahifa')),
    );
    await t.pumpAndSettle(const Duration(seconds: 2));

    // ── 1. TANISHTIRUV ──────────────────────────────────────────
    await capture(t, 'tanishtiruv');

    await step('tanishtiruvni yopish', () async {
      final skip = find.text('O‘tkazib yuborish');
      if (skip.evaluate().isNotEmpty) {
        await t.tap(skip);
        await t.pumpAndSettle(const Duration(seconds: 2));
      }
    });

    // ── 2. KIRISH ───────────────────────────────────────────────
    await capture(t, 'kirish');

    // ── 3. RO'YXATDAN O'TISH (shaxsiy / kompaniya) ──────────────
    await step('ro‘yxatdan o‘tish ochilishi', () async {
      await t.tap(find.text('Ro‘yxatdan o‘tish').first);
      await t.pumpAndSettle(const Duration(seconds: 2));
      expect(find.text('Shaxsiy profil'), findsOneWidget);
      expect(find.text('Kompaniya profili'), findsOneWidget);
    });
    await capture(t, 'royxatdan-otish');

    await step('kirishga qaytish', () async {
      final nav = t.state<NavigatorState>(find.byType(Navigator).first);
      if (nav.canPop()) {
        nav.pop();
        await t.pumpAndSettle(const Duration(seconds: 2));
      }
    });

    // ── 4. KIRISH AMALDA ────────────────────────────────────────
    await step('kirish', () async {
      final fields = find.byType(TextField);
      expect(fields, findsWidgets);
      await t.enterText(fields.at(0), 'dilshod@nfcstore.uz');
      await t.enterText(fields.at(1), 'demo1234');
      await t.pumpAndSettle();
      await t.tap(find.widgetWithText(GestureDetector, 'Kirish').last);
      final ok = await waitFor(t, find.text('Bosh sahifa'));
      await t.pumpAndSettle(const Duration(seconds: 3));
      expect(ok, isTrue, reason: 'kirgandan keyin qobiq ochilishi kerak');
    });
    await capture(t, 'bosh-sahifa');

    // ── 5. LENTA (bosh sahifaning pasti) ────────────────────────
    await step('lenta', () async {
      await t.dragUntilVisible(
        find.text('Lenta'),
        find.byType(CustomScrollView).first,
        const Offset(0, -320),
      );
      await t.pumpAndSettle(const Duration(seconds: 2));
    });
    await capture(t, 'lenta');

    // ── 6. REELS ────────────────────────────────────────────────
    await step('reels', () async {
      await t.tap(find.text('Reels').first);
      await t.pumpAndSettle(const Duration(seconds: 3));
    });
    await capture(t, 'reels');

    await step('reelsdan qaytish', () async {
      final nav = t.state<NavigatorState>(find.byType(Navigator).first);
      if (nav.canPop()) {
        nav.pop();
        await t.pumpAndSettle(const Duration(seconds: 2));
      }
    });

    // ── 7-10. PASTKI TABLAR ─────────────────────────────────────
    for (final tab in const [
      ('Qidiruv', 'qidiruv'),
      ('NFC', 'nfc-markazi'),
      ('Do‘kon', 'dokon'),
      ('Profil', 'profil'),
    ]) {
      await step('${tab.$1} tabi', () async {
        await t.tap(find.text(tab.$1).last);
        await t.pumpAndSettle(const Duration(seconds: 3));
      });
      await capture(t, tab.$2);
    }

    // ── 11. SOZLAMALAR ──────────────────────────────────────────
    await step('sozlamalar', () async {
      await t.tap(find.text('Sozlamalar').last);
      await t.pumpAndSettle(const Duration(seconds: 3));
    });
    await capture(t, 'sozlamalar');

    // ── 12. BUYURTMALARIM — BO'SH HOLAT ─────────────────────────
    await step('buyurtmalarim', () async {
      await t.dragUntilVisible(
        find.text('Buyurtmalarim'),
        find.byType(Scrollable).first,
        const Offset(0, -320),
      );
      await t.pumpAndSettle();
      await t.tap(find.text('Buyurtmalarim').last);
      await t.pumpAndSettle(const Duration(seconds: 3));
    });
    await capture(t, 'buyurtmalarim');

    // ── HISOBOT ─────────────────────────────────────────────────
    // ignore: avoid_print
    print('SAYOHAT: $shot ta surat, ${failures.length} ta nosozlik');
    for (final f in failures) {
      // ignore: avoid_print
      print('NOSOZLIK: $f');
    }
    expect(failures, isEmpty, reason: failures.join('\n'));
  }, timeout: const Timeout(Duration(minutes: 10)));
}
