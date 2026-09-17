import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
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
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  /// Butun ilova shu kalit ostida chiziladi — surat shundan olinadi.
  final shotKey = GlobalKey();

  const base = String.fromEnvironment('API_BASE');

  /// HISOB — berilmasa demo hisob ishlatiladi.
  ///
  /// PAROL KODDA EMAS, GitHub Secret'da. Uni faylga yozish — uni
  /// git tarixiga BIR UMRGA qoldirish degani: keyin o'chirilsa ham
  /// eski commit'da qolaveradi. Shuning uchun u faqat ishga
  /// tushirish paytida `--dart-define` orqali keladi va hech
  /// qayerda saqlanmaydi.
  const loginEmail =
      String.fromEnvironment('LOGIN_EMAIL', defaultValue: 'dilshod@nfcstore.uz');
  const loginPassword =
      String.fromEnvironment('LOGIN_PASSWORD', defaultValue: 'demo1234');

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

  /// CHEGARALANGAN KUTISH — `pumpAndSettle` O'RNIGA.
  ///
  /// NIMA UCHUN: `pumpAndSettle` kadrlar TO'XTAGUNCHA kutadi.
  /// Ilovada esa doim aylanadigan animatsiyalar bor (istorya oltin
  /// halqasi 9 soniyada bir marta aylanadi, aura, skeleton
  /// yaltirashi) — ular hech qachon to'xtamaydi. Natijada sayohat
  /// birinchi lentadayoq osilib qoldi va 10 daqiqadan keyin
  /// vaqt tugab, BITTA ham surat olinmadi.
  Future<void> settleFor(WidgetTester t,
      [Duration d = const Duration(seconds: 2)]) async {
    final steps = d.inMilliseconds ~/ 100;
    for (var i = 0; i < steps; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
  }

  Future<bool> waitFor(WidgetTester t, Finder f, {int steps = 40}) async {
    for (var i = 0; i < steps; i++) {
      await t.pump(const Duration(milliseconds: 250));
      if (f.evaluate().isNotEmpty) return true;
    }
    return false;
  }

  /// EKRANNI SURATGA OLADI — RENDER DARAXTIDAN.
  ///
  /// NIMA UCHUN `binding.takeScreenshot` EMAS: u `flutter drive`
  /// drayveriga suratni UZATADI va javobini kutadi. `flutter test`
  /// rejimida esa drayver yo'q — chaqiruv javobsiz osilib qoladi.
  /// Aynan shu sabab birinchi sayohat 10 daqiqa kutib, bitta ham
  /// `SHOT` satri chiqarmasdan yiqilgan edi.
  ///
  /// `RepaintBoundary.toImage()` esa Flutter'ning o'zida ishlaydi:
  /// hech qanday tashqi vosita kerak emas va rasm QURILMADA
  /// chizilgan haqiqiy kadr bo'ladi.
  ///
  /// CHEKLOV: platforma yuzalari (video) bo'sh chiqadi — ular
  /// Flutter kadridan tashqarida chiziladi. Maket va matn esa
  /// to'liq ko'rinadi.
  Future<void> capture(WidgetTester t, String name) async {
    shot++;
    final id = shot.toString().padLeft(2, '0');
    try {
      final obj = shotKey.currentContext?.findRenderObject();
      if (obj is! RenderRepaintBoundary) {
        failures.add('$id-$name: chizish chegarasi topilmadi');
        return;
      }
      final image = await obj.toImage(pixelRatio: 2);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      if (data == null) {
        failures.add('$id-$name: rasm bo‘sh qaytdi');
        return;
      }
      final bytes = data.buffer.asUint8List();
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
    await t.pumpWidget(
      RepaintBoundary(
        key: shotKey,
        child: NfcstoreApp(state: AppState(api: Api(baseUrl: base))),
      ),
    );
    await waitFor(
      t,
      find.byWidgetPredicate((w) =>
          w is Text &&
          (w.data == 'O‘tkazib yuborish' ||
              w.data == 'Xush kelibsiz' ||
              w.data == 'Bosh sahifa')),
    );
    await settleFor(t, const Duration(seconds: 2));

    // ── 1. TANISHTIRUV ──────────────────────────────────────────
    await capture(t, 'tanishtiruv');

    await step('tanishtiruvni yopish', () async {
      final skip = find.text('O‘tkazib yuborish');
      if (skip.evaluate().isNotEmpty) {
        await t.tap(skip);
        await settleFor(t, const Duration(seconds: 2));
      }
    });

    // ── 2. KIRISH ───────────────────────────────────────────────
    await capture(t, 'kirish');

    // ── 3. RO'YXATDAN O'TISH (shaxsiy / kompaniya) ──────────────
    await step('ro‘yxatdan o‘tish ochilishi', () async {
      await t.tap(find.text('Ro‘yxatdan o‘tish').first);
      await settleFor(t, const Duration(seconds: 2));
      expect(find.text('Shaxsiy profil'), findsOneWidget);
      expect(find.text('Kompaniya profili'), findsOneWidget);
    });
    await capture(t, 'royxatdan-otish');

    await step('kirishga qaytish', () async {
      final nav = t.state<NavigatorState>(find.byType(Navigator).first);
      if (nav.canPop()) {
        nav.pop();
        await settleFor(t, const Duration(seconds: 2));
      }
    });

    // ── 4. KIRISH AMALDA ────────────────────────────────────────
    await step('kirish', () async {
      final fields = find.byType(TextField);
      expect(fields, findsWidgets);
      await t.enterText(fields.at(0), loginEmail);
      await t.enterText(fields.at(1), loginPassword);
      await settleFor(t);
      await t.tap(find.widgetWithText(GestureDetector, 'Kirish').last);
      final ok = await waitFor(t, find.text('Bosh sahifa'));
      await settleFor(t, const Duration(seconds: 3));
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
      await settleFor(t, const Duration(seconds: 2));
    });
    await capture(t, 'lenta');

    // ── 6. REELS ────────────────────────────────────────────────
    await step('reels', () async {
      await t.tap(find.text('Reels').first);
      await settleFor(t, const Duration(seconds: 3));
    });
    await capture(t, 'reels');

    await step('reelsdan qaytish', () async {
      final nav = t.state<NavigatorState>(find.byType(Navigator).first);
      if (nav.canPop()) {
        nav.pop();
        await settleFor(t, const Duration(seconds: 2));
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
        await settleFor(t, const Duration(seconds: 3));
      });
      await capture(t, tab.$2);
    }

    // ── 11. SOZLAMALAR ──────────────────────────────────────────
    await step('sozlamalar', () async {
      await t.tap(find.text('Sozlamalar').last);
      await settleFor(t, const Duration(seconds: 3));
    });
    await capture(t, 'sozlamalar');

    // ── 12. BUYURTMALARIM — BO'SH HOLAT ─────────────────────────
    await step('buyurtmalarim', () async {
      await t.dragUntilVisible(
        find.text('Buyurtmalarim'),
        find.byType(Scrollable).first,
        const Offset(0, -320),
      );
      await settleFor(t);
      await t.tap(find.text('Buyurtmalarim').last);
      await settleFor(t, const Duration(seconds: 3));
    });
    await capture(t, 'buyurtmalarim');

    // ── 13-15. ILOVA QULFI (Sozlamalar → Xavfsizlik) ────────────
    //
    // Bu uch kadr ataylab OXIRIDA: qulfni yoqish ilovani qulflaydi
    // va undan keyingi ekranlarga o'tib bo'lmaydi.
    await step('ilova qulfi varaqasi', () async {
      await t.dragUntilVisible(
        find.text('PIN · barmoq izi · Face ID'),
        find.byType(Scrollable).first,
        const Offset(0, -320),
      );
      await settleFor(t);
      await t.tap(find.text('PIN · barmoq izi · Face ID').last);
      await settleFor(t, const Duration(seconds: 2));
    });
    await capture(t, 'sozlamalar-qulf');

    await step('PIN o‘rnatish ekrani', () async {
      // "PIN kod" belgisini yoqish → kod o'rnatish ekrani.
      final toggle = find.byType(Switch);
      if (toggle.evaluate().isNotEmpty) {
        await t.tap(toggle.first);
      } else {
        await t.tap(find.text('PIN kod').last);
      }
      await settleFor(t, const Duration(seconds: 3));
    });
    await capture(t, 'pin-ornatish');

    await step('PIN terish va qulf ekrani', () async {
      // To'rt raqam + tasdiqlash = qulf yoqiladi.
      for (final pass in [0, 1]) {
        for (final d in ['1', '2', '3', '4']) {
          final key = find.text(d);
          if (key.evaluate().isEmpty) return;
          await t.tap(key.last);
          await settleFor(t, const Duration(milliseconds: 300));
        }
        if (pass == 0) await settleFor(t);
      }
      await settleFor(t, const Duration(seconds: 2));
    });
    await capture(t, 'qulf-holati');

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
