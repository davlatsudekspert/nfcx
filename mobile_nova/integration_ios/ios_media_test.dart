import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
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
}
