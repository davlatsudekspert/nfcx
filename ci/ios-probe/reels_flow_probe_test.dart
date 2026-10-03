// iOS REELS OQIMI PROBE — Reels kabi: A o'ynaydi, B oldindan yuklanadi
// (jim, pauza, boshiga), keyin swipe: A pauza, B o'ynaydi. Har qadam
// alohida timeout bilan o'lchanadi (osilib qolsa — qaysi qadam ekani
// ko'rinadi). Workflow `[FLOW] shot:<nom>` qatorlarida ekranni suratga oladi.
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
  print('[FLOW] ${jsonEncode(m)}');
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  testWidgets('Reels oqimi iOS', (tester) async {
    Future<T?> step<T>(String what, Future<T> Function() run,
        {int sec = 30}) async {
      final sw = Stopwatch()..start();
      T? v;
      Object? err;
      await tester.runAsync(() async {
        try {
          v = await run().timeout(Duration(seconds: sec));
        } catch (e) {
          err = e;
        }
      });
      out({'step': what, 'ms': sw.elapsedMilliseconds,
        if (err != null) 'error': '$err'.split('\n').first});
      return v;
    }

    Future<void> idle(int ms) async {
      for (var i = 0; i < ms ~/ 250; i++) {
        await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 250)));
        await tester.pump();
      }
    }

    String state(VideoPlayerController c) =>
        'init=${c.value.isInitialized} play=${c.value.isPlaying} '
        'pos=${c.value.position.inMilliseconds} buf=${c.value.isBuffering} '
        'size=${c.value.size.width.round()}x${c.value.size.height.round()} '
        'err=${c.value.errorDescription}';

    final urls = <String>[];
    await step('feed', () async {
      final r = await SocialRepository(ApiClient()).feed(page: 1);
      if (r case Ok(:final value)) {
        for (final p in value) {
          if (p.isVideo && p.mediaUrls.isNotEmpty) urls.add(p.mediaUrls.first);
        }
      }
      return urls.length;
    });
    out({'videos': urls});
    expect(urls.length, greaterThanOrEqualTo(2));

    final current = ValueNotifier<VideoPlayerController?>(null);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        backgroundColor: Colors.black,
        body: ValueListenableBuilder<VideoPlayerController?>(
          valueListenable: current,
          builder: (_, c, __) => c == null || !c.value.isInitialized
              ? const SizedBox.expand()
              : SizedBox.expand(
                  child: FittedBox(
                    fit: BoxFit.cover,
                    clipBehavior: Clip.hardEdge,
                    child: SizedBox(
                      width: c.value.size.width,
                      height: c.value.size.height,
                      child: VideoPlayer(c),
                    ),
                  ),
                ),
        ),
      ),
    ));

    VideoPlayerController make(String u) => VideoPlayerController.networkUrl(
        Uri.parse(u),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true));

    // A — ko'rinayotgan reel.
    final a = make(urls[0]);
    await step('A.initialize', a.initialize, sec: 40);
    await step('A.setLooping', () => a.setLooping(true));
    current.value = a;
    await step('A.setVolume', () => a.setVolume(1));
    await step('A.play', a.play);
    await idle(3000);
    out({'A': state(a)});
    out({'shot': 'A'});
    await idle(3000);

    // B — keyingi reel, A o'ynab turganda oldindan yuklanadi.
    final b = make(urls[1]);
    await step('B.initialize(preload)', b.initialize, sec: 40);
    await step('B.setLooping', () => b.setLooping(true));
    await step('B.setVolume0', () => b.setVolume(0));
    await step('B.pause', b.pause);
    await step('B.seekTo0', () => b.seekTo(Duration.zero));
    out({'A': state(a), 'B': state(b)});

    // Swipe: A pauza, B ko'rinadi va o'ynaydi.
    await step('A.pause', a.pause);
    current.value = b;
    await tester.pump();
    await step('B.setVolume1', () => b.setVolume(1));
    await step('B.play', b.play);
    await idle(3000);
    out({'B': state(b)});
    out({'shot': 'B'});
    await idle(3000);
    out({'B_after': state(b)});

    // Orqaga: B pauza, A qayta ko'rinadi.
    await step('B.pause', b.pause);
    current.value = a;
    await tester.pump();
    await step('A.play(again)', a.play);
    await idle(3000);
    out({'A_again': state(a)});
    out({'shot': 'A2'});
    await idle(3000);

    current.value = null;
    await tester.pump();
    await step('dispose', () async {
      await a.dispose();
      await b.dispose();
      return true;
    });
    out({'done': true});
  }, timeout: const Timeout(Duration(minutes: 8)));
}
