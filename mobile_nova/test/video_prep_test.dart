import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/media/video_prep.dart';

/// IPHONE VIDEOSI → H.264 MP4 (egasi, 2026-09-27: "reels qo'yish, post
/// qo'yishni ham tekshir").
///
/// iPhone videosi .MOV/HEVC bo'ladi — Android va brauzerda o'ynamasligi
/// mumkin. iOS'da yuklashdan oldin H.264 .mp4 ga o'tkaziladi; Android'da
/// katta video 1080p H.264 ga siqiladi (2026-09-28); xato bo'lsa asl fayl.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  final calls = <MethodCall>[];
  void mock(Future<Object?>? Function(MethodCall) handler) {
    calls.clear();
    messenger.setMockMethodCallHandler(videoPrepChannel, (c) {
      calls.add(c);
      return handler(c);
    });
    addTearDown(() => messenger.setMockMethodCallHandler(videoPrepChannel, null));
  }

  group('Android', () {
    setUp(() => debugDefaultTargetPlatformOverride = TargetPlatform.android);
    tearDown(() => debugDefaultTargetPlatformOverride = null);

    test('katta video — siqilgan nusxa yuboriladi', () async {
      mock((_) async => '/tmp/nova_c_1.mp4');
      expect(await prepareVideoForUpload('/tmp/VID_1.mp4'), '/tmp/nova_c_1.mp4');
      expect(calls.single.method, 'compress');
      expect((calls.single.arguments as Map)['path'], '/tmp/VID_1.mp4');
      expect((calls.single.arguments as Map)['out'], endsWith('.mp4'));
    });

    test('kichik video yoki xato — asl fayl (yuklash to‘xtamaydi)', () async {
      mock((_) async => null);
      expect(await prepareVideoForUpload('/tmp/VID_2.mp4'), '/tmp/VID_2.mp4');
      mock((_) async => throw PlatformException(code: 'x'));
      expect(await prepareVideoForUpload('/tmp/VID_3.mp4'), '/tmp/VID_3.mp4');
    });
  });

  group('iPhone', () {
    setUp(() => debugDefaultTargetPlatformOverride = TargetPlatform.iOS);
    tearDown(() => debugDefaultTargetPlatformOverride = null);

    test('MOV → eksport qilingan .mp4 yuboriladi', () async {
      mock((_) async => '/tmp/nova_abc.mp4');
      expect(await prepareVideoForUpload('/tmp/IMG_0001.MOV'), '/tmp/nova_abc.mp4');
      expect(calls.single.method, 'toMp4');
      expect(calls.single.arguments, {'path': '/tmp/IMG_0001.MOV'});
    });

    test('eksport xatosi — asl fayl (yuklash to‘xtamaydi)', () async {
      mock((_) async => throw PlatformException(code: 'export_failed'));
      expect(await prepareVideoForUpload('/tmp/IMG_0002.MOV'), '/tmp/IMG_0002.MOV');
    });

    test('bo‘sh javob — asl fayl', () async {
      mock((_) async => '');
      expect(await prepareVideoForUpload('/tmp/IMG_0003.MOV'), '/tmp/IMG_0003.MOV');
    });

    test('kanal umuman yo‘q (eski build) — asl fayl', () async {
      messenger.setMockMethodCallHandler(videoPrepChannel, null);
      expect(await prepareVideoForUpload('/tmp/IMG_0004.MOV'), '/tmp/IMG_0004.MOV');
    });
  });

  group('manba qo‘riqchisi', () {
    String code(String p) => File(p)
        .readAsLinesSync()
        .where((l) => !l.trimLeft().startsWith('//'))
        .join('\n');

    test('reels/post videosi yuklashdan OLDIN tayyorlanadi', () {
      final src = code('lib/features/social/post_screens.dart');
      final prep = src.indexOf('prepareVideoForUpload(');
      final upload = src.indexOf('repo.uploadVideo(');
      expect(prep, greaterThan(0), reason: 'tayyorlash chaqirilmayapti');
      expect(upload, greaterThan(prep), reason: 'tayyorlash yuklashdan keyin');
      // Yuklashga ASL fayl emas, tayyorlangan yo'l ketadi.
      expect(src, contains('repo.uploadVideo(path,'));
    });

    test('iOS tomoni: kanal nomi mos, H.264 .mp4, faststart', () {
      final swift = File('ios/Runner/AppDelegate.swift').readAsStringSync();
      expect(swift, contains('"${videoPrepChannel.name}"'));
      expect(swift, contains('"toMp4"'));
      expect(swift, contains('AVAssetExportPreset1920x1080'));
      expect(swift, contains('outputFileType = .mp4'));
      expect(swift, contains('shouldOptimizeForNetworkUse = true'));
      // HEVC presetiga tushib qolmasin — maqsad aynan H.264.
      expect(swift, isNot(contains('AVAssetExportPresetHEVC')));
    });

    test('Android tomoni: kanal, 1080p H.264, HDR→SDR, media3 versiyasi bir', () {
      final kt = code('android/app/src/main/kotlin/uz/nfcstore/nova/MainActivity.kt');
      expect(kt, contains('"${videoPrepChannel.name}"'));
      expect(kt, contains('"compress"'));
      final c = code(
          'android/app/src/main/kotlin/uz/nfcstore/nova/VideoCompressor.kt');
      expect(c, contains('Presentation.createForShortSide(SHORT_SIDE)'));
      expect(c, contains('SHORT_SIDE = 1080'));
      expect(c, contains('MimeTypes.VIDEO_H264'));
      expect(c, contains('HDR_MODE_TONE_MAP_HDR_TO_SDR_USING_OPEN_GL'));
      // Media3 modullari bitta versiyada (video_player_android bilan).
      final g = File('android/app/build.gradle.kts').readAsStringSync();
      final vers = RegExp(r'androidx\.media3:media3-[a-z]+:([0-9.]+)')
          .allMatches(g)
          .map((m) => m.group(1))
          .toSet();
      expect(vers, hasLength(1), reason: 'media3 versiyalari aralash: $vers');
    });
  });
}
