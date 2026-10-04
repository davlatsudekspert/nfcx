import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/sharing.dart';

/// iPhone'da "Ulashish" ishlamasdi (egasi, 2026-10-04):
/// `share_plus` iOS'da popover oyna uchun bo'sh `sharePositionOrigin`
/// bilan oynani ochmaydi; iOS'da natija esa oyna YOPILGANDA keladi —
/// 5 s taymaut ochiq oynani "ochilmadi" deb hisoblardi.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async => null);
  });

  tearDown(() {
    shareInvokerOverride = null;
    shareTimeout = const Duration(seconds: 5);
    debugDefaultTargetPlatformOverride = null;
  });

  test('chiqish nuqtasi hech qachon bo‘sh emas', () {
    final r = shareOrigin();
    expect(r.isEmpty, isFalse);
    expect(r.width > 0 && r.height > 0, isTrue);
  });

  test('iOS: oyna uzoq ochiq tursa ham taymaut "ochilmadi" demaydi', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    shareTimeout = const Duration(milliseconds: 50);
    shareInvokerOverride =
        (_, __) => Future<void>.delayed(const Duration(milliseconds: 200));
    expect(await shareLink('https://nfcstore.uz/VIP001'), isTrue);
  });

  test('Android: osilib qolgan kanal taymaut bilan to‘xtaydi (avvalgidek)',
      () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    shareTimeout = const Duration(milliseconds: 50);
    shareInvokerOverride = (_, __) => Completer<void>().future;
    expect(await shareLink('https://nfcstore.uz/VIP001'), isFalse);
  });

  test('izohsiz post ham ulashiladi — muallif havolasi bilan', () {
    expect(contentShareText(caption: '', code: 'VIP001', company: false),
        '$kApiBase/VIP001');
    expect(contentShareText(caption: '  Salom ', code: 'NFC', company: true),
        'Salom\n\n$kApiBase/c/NFC');
    expect(contentShareText(caption: 'Faqat matn', code: '', company: false),
        'Faqat matn');
  });

  test('Reels/post havolasi — profil emas, AYNAN shu post', () {
    expect(
        contentShareText(
            caption: 'Kech', code: 'VIP001', company: false, postId: 42),
        'Kech\n\n$kApiBase/post/42?code=VIP001');
    expect(
        contentShareText(
            caption: '', code: 'KARTAUZ', company: true, postId: 7),
        '$kApiBase/post/7?code=KARTAUZ&company=1');
  });

  testWidgets('ulashish ochilmasa ekranda "Havola nusxalandi" chiqadi',
      (tester) async {
    shareInvokerOverride = (_, __) async => throw PlatformException(
        code: 'error', message: 'sharePositionOrigin: argument must be set');
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => shareWithFeedback(context, '$kApiBase/VIP001',
                copiedMessage: 'Havola nusxalandi'),
            child: const Text('ulash'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('ulash'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Havola nusxalandi'), findsOneWidget);
  });
}
