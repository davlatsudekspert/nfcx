import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore_nova/core/media/image_prep.dart';
import 'package:nfcstore_nova/core/media/video_prep.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';
import 'package:video_player/video_player.dart';

/// IPHONE SIMULYATORIDA HAQIQIY MEDIA (egasi, 2026-09-27: "mp3 player
/// ham ishlaydimi", "reels qo'yish, post qo'yishni ham tekshir").
///
/// Soxta pleer yo'q: iOS'ning AVPlayer va AVAssetExportSession'i
/// ishlaydi. `nova-ios.yml` (simulator) quyidagilarni beradi:
///   MP3_URL — serverdagi haqiqiy trek (profil musiqasi);
///   MOV_URL — iPhone kamerasi beradigan HEVC `.mov` (runner'da haqiqiy
///             reel videosidan `avconvert` bilan yasaladi va lokal
///             HTTP orqali beriladi).
const _mp3 = String.fromEnvironment('MP3_URL');
const _mov = String.fromEnvironment('MOV_URL');

Future<void> _wait(WidgetTester t, bool Function() done, {int tries = 120}) async {
  for (var i = 0; i < tries && !done(); i++) {
    await t.pump(const Duration(milliseconds: 250));
  }
}


/// Shovqinli (siqilmaydigan) PNG — skrinshot/dizayn rasmi o'rnida.
/// [holeAlpha] < 255 bo'lsa chap-yuqori burchak shaffof (logotip kabi).
Future<File> _png(Directory dir, String name, int w, int h,
    {int holeAlpha = 255}) async {
  final px = Uint8List(w * h * 4);
  var seed = 7;
  for (var i = 0; i < w * h; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    px[i * 4] = seed & 0xff;
    px[i * 4 + 1] = (seed >> 8) & 0xff;
    px[i * 4 + 2] = (seed >> 16) & 0xff;
    final x = i % w, y = i ~/ w;
    px[i * 4 + 3] = (x < 40 && y < 40) ? holeAlpha : 255;
  }
  final done = Completer<ui.Image>();
  ui.decodeImageFromPixels(px, w, h, ui.PixelFormat.rgba8888, done.complete);
  final img = await done.future;
  final data = await img.toByteData(format: ui.ImageByteFormat.png);
  final f = File('${dir.path}/$name');
  await f.writeAsBytes(data!.buffer.asUint8List());
  return f;
}

Future<(int, int)> _size(File f) async {
  final codec = await ui.instantiateImageCodec(await f.readAsBytes());
  final fr = await codec.getNextFrame();
  return (fr.image.width, fr.image.height);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('mp3: profil pleeri haqiqiy trekni o‘ynaydi va to‘xtaydi',
      (t) async {
    expect(_mp3, isNotEmpty, reason: 'MP3_URL berilmagan');
    final c = ProviderContainer();
    addTearDown(c.dispose);
    await t.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: const MaterialApp(home: SizedBox()),
    ));
    final player = c.read(musicPlayerProvider.notifier);
    await player.play(_mp3);
    await _wait(t, () {
      final s = c.read(musicPlayerProvider);
      return s.playing || s.failed;
    });
    final s = c.read(musicPlayerProvider);
    expect(s.failed, isFalse, reason: 'trek ochilmadi: ${s.error}');
    expect(s.playing, isTrue);
    expect(s.duration, greaterThan(const Duration(seconds: 30)));

    // Pozitsiya oldinga siljiydimi. CI runner'da ovoz qurilmasi
    // bo'lmasligi mumkin — shunda AVPlayer soati turib qoladi. Bu ilova
    // xatosi emas, shuning uchun faqat jurnalga yoziladi; asosiy dalil
    // yuqorida: trek ochildi, davomiylik o'qildi, ijro boshlandi.
    await _wait(t, () => c.read(musicPlayerProvider).position > Duration.zero,
        tries: 40);
    // ignore: avoid_print
    print('MEDIA|mp3|pozitsiya=${c.read(musicPlayerProvider).position}|'
        'davomiylik=${c.read(musicPlayerProvider).duration}');

    await player.pause();
    await t.pump(const Duration(milliseconds: 500));
    expect(c.read(musicPlayerProvider).playing, isFalse);
    player.stop();
  });

  testWidgets('video: iPhone .mov (HEVC) → H.264 .mp4 → o‘ynaydi', (t) async {
    expect(_mov, isNotEmpty, reason: 'MOV_URL berilmagan');
    final dir = await Directory.systemTemp.createTemp('nova_media');
    final src = File('${dir.path}/IMG_0001.MOV');
    final http = HttpClient();
    final res = await (await http.getUrl(Uri.parse(_mov))).close();
    expect(res.statusCode, 200);
    await res.pipe(src.openWrite());
    http.close();
    expect(await src.length(), greaterThan(10000));

    final out = await prepareVideoForUpload(src.path);
    expect(out, isNot(src.path), reason: 'eksport ishlamadi — asl fayl qaytdi');
    expect(out, endsWith('.mp4'));

    final bytes = await File(out).readAsBytes();
    final text = String.fromCharCodes(bytes);
    expect(String.fromCharCodes(bytes.sublist(8, 12)), isNot('qt  '),
        reason: 'QuickTime konteyner qoldi');
    expect(text.contains('avc1'), isTrue, reason: 'H.264 emas');
    expect(text.contains('hvc1') || text.contains('hev1'), isFalse,
        reason: 'HEVC qoldi');
    // `moov` fayl boshida — ijro to'liq yuklanishni kutmaydi.
    expect(text.indexOf('moov'), lessThan(text.indexOf('mdat')));

    final v = VideoPlayerController.file(File(out));
    addTearDown(v.dispose);
    await v.initialize();
    expect(v.value.duration, greaterThan(Duration.zero));
    expect(v.value.size.width, greaterThan(0));
    await v.play();
    await _wait(t, () => v.value.position > Duration.zero, tries: 40);
    expect(v.value.isPlaying, isTrue);
    // ignore: avoid_print
    print('MEDIA|video|${v.value.size.width.round()}x'
        '${v.value.size.height.round()}|davomiylik=${v.value.duration}|'
        'pozitsiya=${v.value.position}|mp4=${bytes.length} bayt');
  });

  // Egasi (2026-09-28): "rasm qo'yilganda razmerni ham telefonga moslab
  // oladimi — iOS'da ham". Swift `toJpeg` HAQIQATDA ishlaydi.
  testWidgets('rasm: katta PNG → 1600 px JPEG; shaffof PNG tegilmaydi',
      (t) async {
    final dir = await Directory.systemTemp.createTemp('nova_img');
    final big = await _png(dir, 'Screenshot.png', 2400, 1800);
    final before = await big.length();
    expect(before, greaterThan(kImagePrepMinBytes));

    final out = await t.runAsync(() => prepareImageForUpload(big.path));
    expect(out, isNot(big.path), reason: 'JPEG ga o‘tmadi — asl fayl qaytdi');
    final jpg = File(out!);
    final head = await jpg.openRead(0, 3).first;
    expect(head.sublist(0, 3), [0xFF, 0xD8, 0xFF], reason: 'JPEG emas');
    final after = await jpg.length();
    expect(after, lessThan(before));
    final (w, h) = (await t.runAsync(() => _size(jpg)))!;
    expect(w, 1600, reason: 'uzun tomoni 1600 px');
    expect(h, 1200, reason: 'nisbat saqlanadi (4:3)');

    final logo = await _png(dir, 'logo.png', 1400, 1400, holeAlpha: 0);
    expect(await logo.length(), greaterThan(kImagePrepMinBytes));
    final same = await t.runAsync(() => prepareImageForUpload(logo.path));
    expect(same, logo.path, reason: 'shaffof rasm JPEG bo‘lib qoldi');
    // ignore: avoid_print
    print('MEDIA|rasm|png=$before bayt -> jpg=$after bayt|${w}x$h');
  });
}
