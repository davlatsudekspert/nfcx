import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart'
    show FontLoader, MethodChannel, rootBundle;
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/theme.dart';
import 'package:nfcstore/design/tokens.dart';
import 'package:nfcstore/design/type.dart';

/// VIZUAL PREVIEW — dizaynni ko'z bilan tekshirish uchun.
///
/// `flutter test --update-goldens test/preview` buyrug'i har lavhani
/// PNG qilib `test/preview/out/` ga yozadi. Bu testlar hech narsani
/// TEKSHIRMAYDI — ular rasm chiqaradi, biz esa uni dizayn maketi
/// bilan solishtiramiz.
///
/// Haqiqiy tekshiruv `test/audit/` dagi goldenlar zimmasida.

const previewSize = Size(390, 844);

Future<void> loadFonts() async {
  const fonts = {
    'PlayfairDisplay': [
      'assets/fonts/PlayfairDisplay-400.ttf',
      'assets/fonts/PlayfairDisplay-400Italic.ttf',
      'assets/fonts/PlayfairDisplay-500.ttf',
      'assets/fonts/PlayfairDisplay-500Italic.ttf',
      'assets/fonts/PlayfairDisplay-600.ttf',
      'assets/fonts/PlayfairDisplay-700.ttf',
    ],
    'PlusJakartaSans': [
      'assets/fonts/PlusJakartaSans-400.ttf',
      'assets/fonts/PlusJakartaSans-500.ttf',
      'assets/fonts/PlusJakartaSans-600.ttf',
      'assets/fonts/PlusJakartaSans-700.ttf',
      'assets/fonts/PlusJakartaSans-800.ttf',
    ],
    'SpaceMono': [
      'assets/fonts/SpaceMono-400.ttf',
      'assets/fonts/SpaceMono-700.ttf',
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

/// `cached_network_image` `path_provider` so'raydi — testda plagin
/// yo'q, shuning uchun vaqtinchalik papka qaytariladi.
void mockImageCacheDir() {
  final dir = Directory.systemTemp.createTempSync('nfcstore-preview');
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

/// Ilovaning haqiqiy qobig'i — `app.dart` dagi builder bilan bir xil.
Widget previewApp(Widget child) => MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      builder: (context, inner) => MediaQuery.withClampedTextScaling(
        minScaleFactor: 1,
        maxScaleFactor: 1.3,
        child: Material(
          type: MaterialType.canvas,
          color: C.bg,
          textStyle: T.body.copyWith(color: C.ink),
          child: inner ?? const SizedBox(),
        ),
      ),
      home: child,
    );

/// Lavhani chizib, PNG ga yozadi.
Future<void> shot(
  WidgetTester tester,
  Widget child,
  String name, {
  Size size = previewSize,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(previewApp(child));
  await tester.pump();

  // Rasm dekodlash ASINXRON. `flutter test` standart holatda
  // haqiqiy vaqtni to'xtatib turadi, shuning uchun `Image.asset`
  // hech qachon yuklanmaydi va logotip bo'sh doira bo'lib chiqadi.
  // `runAsync` shu qulfni vaqtincha ochadi.
  await tester.runAsync(() async {
    await Future<void>.delayed(const Duration(milliseconds: 260));
  });
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 60));
  await tester.pump(const Duration(milliseconds: 400));

  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile('out/$name.png'),
  );
}
