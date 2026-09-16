import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart'
    show FontLoader, MethodChannel, rootBundle;
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/media.dart';
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
    // KIRILL ZAXIRASI — ilovada pubspec orqali yuklanadi.
    // Bu yerda ham bo'lishi SHART: aks holda vizual kadrlarda
    // ruscha matn bo'sh kvadratlar bo'lib chiqadi va etalon
    // ilovadan farq qiladi.
    'ManropeCyr': [
      'assets/fonts/ManropeCyr-400.ttf',
      'assets/fonts/ManropeCyr-500.ttf',
      'assets/fonts/ManropeCyr-600.ttf',
      'assets/fonts/ManropeCyr-700.ttf',
      'assets/fonts/ManropeCyr-800.ttf',
    ],
    'PlexMonoCyr': [
      'assets/fonts/PlexMonoCyr-400.ttf',
      'assets/fonts/PlexMonoCyr-700.ttf',
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

/// TARMOQSIZ MUHITDA "HAQIQIY" RASM.
///
/// NIMA UCHUN: vizual kadrlar tarmoqsiz olinadi va har bir rasm
/// bo'sh o'rin bo'lib chiqadi. Natijada kadrga qarab "lenta qanday
/// ko'rinadi?" degan savolga javob berib bo'lmaydi — post kartasi
/// ham, Reels ham kulrang to'rtburchak.
///
/// BU YERDA HECH NARSA SOXTALASHTIRILMAYDI: bu FAQAT preview
/// qobig'i, ilovaga kirmaydi (`NetImage.debugImageBuilder` ilovada
/// har doim `null`). Auditda ham ATAYLAB qo'yilmaydi — u yerda
/// "rasm kelmadi" holati alohida baholanadi.
void installImageStub() {
  NetImage.debugImageBuilder = (url, fit) => CustomPaint(
        painter: _StubPhoto(url.hashCode),
        child: const SizedBox.expand(),
      );
  addTearDown(() => NetImage.debugImageBuilder = null);
}

/// Manzildan kelib chiqib chiziladigan "surat".
///
/// Bir xil manzil — HAR DOIM bir xil rasm: kadrlar barqaror
/// bo'lishi uchun tasodif ishlatilmaydi.
class _StubPhoto extends CustomPainter {
  _StubPhoto(this.seed);

  final int seed;

  static const _tones = [
    [Color(0xFF6B4A2F), Color(0xFFC79A63)],
    [Color(0xFF1E2A44), Color(0xFF5A79B8)],
    [Color(0xFF3A2438), Color(0xFF9A6B8C)],
    [Color(0xFF204034), Color(0xFF6FA88A)],
    [Color(0xFF4A2A22), Color(0xFFB97A55)],
    [Color(0xFF232733), Color(0xFF7E8798)],
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final pair = _tones[seed.abs() % _tones.length];
    final rect = Offset.zero & size;

    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: pair,
        ).createShader(rect),
    );

    // Yumshoq yorug'lik dog'i — tekis to'rtburchak "rasm"ga
    // o'xshamaydi, shu sababli bitta nur qo'shiladi.
    canvas.drawCircle(
      Offset(size.width * .72, size.height * .26),
      size.shortestSide * .42,
      Paint()..color = const Color(0x26FFFFFF),
    );
    canvas.drawCircle(
      Offset(size.width * .18, size.height * .82),
      size.shortestSide * .30,
      Paint()..color = const Color(0x1A000000),
    );
  }

  @override
  bool shouldRepaint(_StubPhoto old) => old.seed != seed;
}
