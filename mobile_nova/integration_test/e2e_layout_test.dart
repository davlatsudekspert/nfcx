import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import '../test/support/fake_video_platform.dart';
import '../test/support/rich_fakes.dart';

/// HAQIQIY ANDROID QURILMADA (emulyator) LAYOUT TEKSHIRUVI.
///
/// Egasining talabi: yakuniy tekshiruv faqat test-muhit screenshoti
/// emas — haqiqiy Android'da, 360x800 / 390x844 / 430x932 da.
///
/// Ekran o'lchami tashqaridan beriladi (`tool/e2e_device.sh`:
/// `adb shell wm size ... && wm density 480`), bu to'plam esa HAQIQIY
/// `NovaApp` ni (mavzu, router, pastki navigatsiya, shriftlar, Impeller)
/// soxta, lekin boy ma'lumot bilan ochadi — tarmoqqa chiqmaydi, hisobga
/// kirmaydi, kirish chegarasini yemaydi.
///
/// Har ekran uchun:
///   * overflow / render xatosi yo'qligi (FlutterError yig'iladi);
///   * qurilmada chizilgan kadr — PNG (`<cache>/nova_shots/`), skript
///     uni `adb exec-out run-as` bilan tortib oladi;
///   * klaviatura: matn maydoni bosilganda IME haqiqatan ochiladimi.
///
/// Natija qatorlari: `LAYOUT|<o'lcham>|<ekran>|PASS|FAIL|WARN|izoh`.
const _tag = String.fromEnvironment('LAYOUT_TAG', defaultValue: 'device');

final _shell = GlobalKey();

Future<void> _wait(WidgetTester t, [int ms = 1600]) async {
  // Cheksiz animatsiyalar (NFC to'lqini, gravyura) bor — pumpAndSettle
  // tugamaydi. Qurilmada haqiqiy vaqt o'tadi.
  final end = DateTime.now().add(Duration(milliseconds: ms));
  while (DateTime.now().isBefore(end)) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _shot(String name) async {
  final ctx = _shell.currentContext;
  if (ctx == null) return;
  final boundary = ctx.findRenderObject()! as RenderRepaintBoundary;
  final dpr = ui.PlatformDispatcher.instance.views.first.devicePixelRatio;
  final image = await boundary.toImage(pixelRatio: dpr);
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  final dir = Directory('${Directory.systemTemp.path}/nova_shots')
    ..createSync(recursive: true);
  File('${dir.path}/$_tag-$name.png')
      .writeAsBytesSync(bytes!.buffer.asUint8List());
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  testWidgets('LAYOUT — haqiqiy qurilmada asosiy ekranlar ($_tag)',
      (tester) async {
    VideoPlayerPlatform.instance = FakeVideoPlatform(frames: const [
      'assets/demo/z_post_evening.jpg',
      'assets/demo/m_card_metal.jpg',
    ]);

    final errors = <String>[];
    final prev = FlutterError.onError;
    FlutterError.onError = (d) {
      errors.add(d.exceptionAsString().split('\n').first);
    };
    addTearDown(() => FlutterError.onError = prev);

    final view = tester.view;
    final logical = view.physicalSize / view.devicePixelRatio;
    // ignore: avoid_print
    print('LAYOUT|$_tag|device|INFO|${logical.width.round()}x'
        '${logical.height.round()} dp @${view.devicePixelRatio}x');

    // Tasodifiy so'rov PRODUCTION'ga ketmasin: soxta repozitoriylar
    // qoplamagan har qanday so'rov yopiq mahalliy manzilga boradi va
    // darhol "oflayn" bo'ladi.
    final offline = ApiClient(baseUrl: 'http://127.0.0.1:9');
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await richOverrides(),
        apiProvider.overrideWithValue(offline),
      ],
      child: RepaintBoundary(key: _shell, child: const NovaApp()),
    ));
    await _wait(tester, 2500);

    final container =
        ProviderScope.containerOf(_shell.currentContext!);
    final router = container.read(routerProvider);

    final results = <String, String>{};

    // QADAM IZI — emulyator qulasa (E2E #47-#49: 360 dp, Home'dan keyin
    // qemu jarayoni yo'qoldi) aynan qaysi amalda qulaganini ko'rsatadi.
    // ignore: avoid_print
    void step(String s) => print('STEP|$_tag|$s|${DateTime.now().toIso8601String()}');

    Future<void> screen(String name, String route,
        {Object? extra, Future<void> Function()? then}) async {
      errors.clear();
      step('$name go');
      router.go(route, extra: extra);
      await _wait(tester);
      step('$name waited');
      if (then != null) {
        await then();
        await _wait(tester, 900);
      }
      step('$name shot');
      await _shot(name);
      step('$name shot-done');
      final ok = errors.isEmpty;
      results[name] = ok ? 'PASS' : 'FAIL';
      // ignore: avoid_print
      print('LAYOUT|$_tag|$name|${ok ? 'PASS' : 'FAIL'}|'
          '${ok ? '' : errors.toSet().join(' ; ')}');
    }

    await screen('home', Routes.home);
    await screen('discover', Routes.discover);
    await screen('catalog', Routes.discover, then: () async {
      final k = find.text('Katalog').hitTestable();
      if (k.evaluate().isNotEmpty) await tester.tap(k.first);
    });
    await screen('product', Routes.catalogProduct('NFCSTORE', 'p1'),
        extra: richProducts.first);
    await screen('nfc', Routes.nfc);
    await screen('profile', Routes.profile);
    await screen('reels', Routes.reels);
    await screen('business-intro', Routes.businessIntro);
    await screen('compose-post', Routes.postCreate);

    // KLAVIATURA — haqiqiy IME ochiladimi.
    errors.clear();
    final field = find.byType(EditableText).hitTestable();
    var kb = 'WARN|matn maydoni topilmadi';
    if (field.evaluate().isNotEmpty) {
      await tester.tap(field.first);
      await _wait(tester, 1800);
      final inset = tester.view.viewInsets.bottom / tester.view.devicePixelRatio;
      await _shot('keyboard');
      kb = inset > 80
          ? 'PASS|IME ${inset.round()} dp'
          : 'WARN|IME ko‘rinmadi (emulyatorda apparat klaviatura bo‘lishi mumkin)';
      FocusManager.instance.primaryFocus?.unfocus();
    }
    // ignore: avoid_print
    print('LAYOUT|$_tag|keyboard|$kb');

    // ignore: avoid_print
    print('<<<LAYOUT_DONE $_tag>>>');
    final failed = results.entries.where((e) => e.value == 'FAIL').map((e) => e.key);
    expect(failed, isEmpty, reason: 'overflow/render xatosi: ${failed.join(', ')}');
  });
}
