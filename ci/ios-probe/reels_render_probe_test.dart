// iOS REELS RENDER PROBE — "Reels'da video qora" (egasi, 2026-10).
//
// Haqiqiy lentadagi videoni Reels bilan BIR XIL sozlamada ochadi
// (`networkUrl` + `mixWithOthers`, FittedBox(cover) + VideoPlayer),
// o'ynatadi va holatni jurnalga yozadi. Workflow `[RENDER] ready`
// qatorini ko'rgach simulyator ekranini suratga oladi va piksellar
// qora emasligini tekshiradi.
import 'dart:convert';
import 'dart:ui' show DartPluginRegistrant;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:video_player/video_player.dart';

void out(Map<String, Object?> m) {
  // ignore: avoid_print
  print('[RENDER] ${jsonEncode(m)}');
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  testWidgets('Reels video iOS render', (tester) async {
    final repo = SocialRepository(ApiClient());
    String? url;
    await tester.runAsync(() async {
      final r = await repo.feed(page: 1);
      if (r case Ok(:final value)) {
        for (final p in value) {
          final v = p.mediaUrls.isEmpty ? '' : p.mediaUrls.first;
          if (p.isVideo && v.isNotEmpty) {
            url = v;
            break;
          }
        }
      }
    });
    out({'stage': 'url', 'url': url});
    expect(url, isNotNull);

    final c = VideoPlayerController.networkUrl(Uri.parse(url!),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true));
    final sw = Stopwatch()..start();
    Object? initError;
    await tester.runAsync(() async {
      try {
        await c.initialize().timeout(const Duration(seconds: 40));
      } catch (e) {
        initError = e;
      }
    });
    out({
      'stage': 'init',
      'ms': sw.elapsedMilliseconds,
      'ok': c.value.isInitialized,
      'error': initError?.toString(),
      'errorDescription': c.value.errorDescription,
      'size': '${c.value.size.width}x${c.value.size.height}',
      'duration': c.value.duration.inMilliseconds,
    });

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        backgroundColor: Colors.black,
        body: SizedBox.expand(
          child: FittedBox(
            fit: BoxFit.cover,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(
              width: c.value.size.width == 0 ? 1 : c.value.size.width,
              height: c.value.size.height == 0 ? 1 : c.value.size.height,
              child: VideoPlayer(c),
            ),
          ),
        ),
      ),
    ));
    await tester.runAsync(() async {
      await c.setLooping(true);
      await c.play();
    });
    for (var i = 0; i < 12; i++) {
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 500)));
      await tester.pump();
    }
    out({
      'stage': 'ready',
      'playing': c.value.isPlaying,
      'positionMs': c.value.position.inMilliseconds,
      'buffered': c.value.buffered.map((r) => '${r.start.inMilliseconds}-${r.end.inMilliseconds}').join(','),
      'errorDescription': c.value.errorDescription,
    });
    // Workflow shu oraliqda ekranni suratga oladi.
    for (var i = 0; i < 20; i++) {
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 500)));
      await tester.pump();
    }
    out({
      'stage': 'end',
      'positionMs': c.value.position.inMilliseconds,
      'errorDescription': c.value.errorDescription,
    });
    await tester.runAsync(() => c.dispose());
  }, timeout: const Timeout(Duration(minutes: 5)));
}
