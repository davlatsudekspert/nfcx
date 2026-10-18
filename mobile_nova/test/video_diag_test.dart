import 'dart:io';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/media/video_diag.dart';
import 'package:nfcstore_nova/features/showcase/ad_video_loader.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'support/fake_video_platform.dart';

/// Hodisalarni qo'lda beradigan ichki platforma (FakeVideoPlatform ustiga).
class _Inner extends FakeVideoPlatform {
  final ctrls = <int, StreamController<VideoEvent>>{};
  bool failCreate = false;
  final calls = <String>[];

  @override
  Future<int?> createWithOptions(VideoCreationOptions options) async {
    if (failCreate) {
      throw PlatformException(code: 'E_CREATE', message: 'no codec');
    }
    final id = (await super.createWithOptions(options))!;
    ctrls[id] = StreamController<VideoEvent>();
    return id;
  }

  @override
  Stream<VideoEvent> videoEventsFor(int playerId) => ctrls[playerId]!.stream;

  @override
  Future<void> play(int playerId) {
    calls.add('play');
    return super.play(playerId);
  }

  @override
  Future<void> dispose(int playerId) async {
    calls.add('dispose');
    // super.dispose() ni chaqirmaymiz: u tinglovchisiz oqimni kutib osiladi.
    disposed.add(playerId);
    unawaited(ctrls[playerId]?.close());
  }
}

VideoCreationOptions _opts(String uri) => VideoCreationOptions(
  dataSource: DataSource(sourceType: DataSourceType.network, uri: uri),
  viewType: VideoViewType.textureView,
);

void main() {
  late VideoPlayerPlatform saved;
  setUp(() => saved = VideoPlayerPlatform.instance);
  tearDown(() => VideoPlayerPlatform.instance = saved);

  test('create -> initialized -> play -> error -> dispose yoziladi', () async {
    var t = DateTime(2026, 1, 1);
    final inner = _Inner();
    final d = DiagVideoPlatform(inner, clock: () => t);

    final id = (await d.createWithOptions(
      _opts('https://x.uz/media/promo_boy777.mp4'),
    ))!;
    final got = <VideoEvent>[];
    final errs = <Object>[];
    d.videoEventsFor(id).listen(got.add, onError: errs.add);

    t = t.add(const Duration(milliseconds: 420));
    inner.ctrls[id]!.add(
      VideoEvent(
        eventType: VideoEventType.initialized,
        duration: const Duration(seconds: 15),
        size: const Size(1080, 1920),
      ),
    );
    inner.ctrls[id]!.add(VideoEvent(eventType: VideoEventType.bufferingStart));
    inner.ctrls[id]!.add(VideoEvent(eventType: VideoEventType.bufferingEnd));
    await d.setVolume(id, .5);
    await d.play(id);
    inner.ctrls[id]!.add(
      VideoEvent(
        eventType: VideoEventType.isPlayingStateUpdate,
        isPlaying: true,
      ),
    );
    final err = PlatformException(
      code: 'VideoError',
      message: 'Source error: -12938',
    );
    inner.ctrls[id]!.addError(err);
    await Future<void>.delayed(Duration.zero);

    // Xato ilovaga O'ZGARISHSIZ yetib keldi, hodisalar ham.
    expect(errs, [same(err)]);
    expect(got.map((e) => e.eventType), [
      VideoEventType.initialized,
      VideoEventType.bufferingStart,
      VideoEventType.bufferingEnd,
      VideoEventType.isPlayingStateUpdate,
    ]);
    // Hamma narsa haqiqiy platformaga uzatildi.
    expect(inner.calls, ['play']);
    expect(inner.volumeOf[id], .5);

    final r = d.records.single;
    expect(r.playerId, id);
    expect(r.uri, 'https://x.uz/media/promo_boy777.mp4');
    expect(r.initialized, isTrue);
    expect(r.initMs, 420);
    expect(r.size, const Size(1080, 1920));
    expect(r.duration, const Duration(seconds: 15));
    expect(r.bufferingStarts, 1);
    expect(r.bufferingEnds, 1);
    expect(r.playing, isTrue);
    expect(r.playCalls, 1);
    expect(r.lastPlayCall, isTrue);
    expect(r.volume, .5);
    expect(r.volumeCalls, 1);
    expect(r.errors.single, contains('code=VideoError'));
    expect(r.errors.single, contains('Source error: -12938'));
    expect(r.disposed, isFalse);

    await d.dispose(id);
    expect(r.disposed, isTrue);
    expect(inner.calls, ['play', 'dispose']);

    final text = d.report();
    expect(text, contains('promo_boy777.mp4'));
    expect(text, contains('Source error: -12938'));
    expect(text, contains('1080x1920'));
    expect(text, contains('yopilgan: HA'));
  });

  test('create xatosi yoziladi va qayta tashlanadi', () async {
    final inner = _Inner()..failCreate = true;
    final d = DiagVideoPlatform(inner);
    await expectLater(
      d.createWithOptions(_opts('https://x.uz/a/b.mp4')),
      throwsA(isA<PlatformException>()),
    );
    expect(d.records.single.createError, contains('E_CREATE'));
    expect(d.report(), contains('CREATE XATO'));
  });

  test('faqat oxirgi 20 ta pleer saqlanadi', () async {
    final d = DiagVideoPlatform(_Inner());
    for (var i = 0; i < 25; i++) {
      await d.createWithOptions(_opts('https://x.uz/v$i.mp4'));
    }
    expect(d.records, hasLength(20));
    expect(diagShortUri(d.records.first.uri), 'v5.mp4');
    expect(diagShortUri(d.records.last.uri), 'v24.mp4');
  });

  test('installVideoDiag bir marta o\'raydi va xato tashlamaydi', () {
    VideoPlayerPlatform.instance = FakeVideoPlatform();
    installVideoDiag();
    final first = VideoPlayerPlatform.instance;
    expect(first, isA<DiagVideoPlatform>());
    installVideoDiag();
    expect(VideoPlayerPlatform.instance, same(first));
  });

  testWidgets('oyna uri va xatoni ko\'rsatadi', (tester) async {
    final inner = _Inner();
    final d = DiagVideoPlatform(inner);
    VideoPlayerPlatform.instance = d;
    final id = (await d.createWithOptions(_opts('https://x.uz/m/lol707.mp4')))!;
    d.videoEventsFor(id).listen((_) {}, onError: (_) {});
    inner.ctrls[id]!.addError(
      PlatformException(code: 'VideoError', message: 'AVPlayer failed'),
    );
    await tester.pump();

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (c) => Scaffold(
            body: TextButton(
              onPressed: () => showVideoDiag(c),
              child: const Text('ochish'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('ochish'));
    await tester.pumpAndSettle();

    expect(find.textContaining('lol707.mp4'), findsWidgets);
    expect(find.textContaining('AVPlayer failed'), findsOneWidget);
    expect(find.text('Nusxa olish'), findsOneWidget);

    // Nusxa olish — butun matn almashish buferiga tushadi.
    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          copied = (call.arguments as Map)['text'] as String?;
        }
        return null;
      },
    );
    await tester.tap(find.byKey(const ValueKey('video-diag-copy')));
    await tester.pump();
    expect(copied, contains('lol707.mp4'));
    expect(copied, contains('AVPlayer failed'));
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      null,
    );
  });

  testWidgets('aylanani uzun bosish oynani ochadi, oddiy bosish emas', (
    tester,
  ) async {
    VideoPlayerPlatform.instance = DiagVideoPlatform(_Inner());
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Stack(
            fit: StackFit.expand,
            children: [
              GestureDetector(onTap: () => taps++),
              const VideoLoadingRing(),
            ],
          ),
        ),
      ),
    );
    await tester.tap(
      find.byType(CircularProgressIndicator),
      warnIfMissed: false,
    );
    await tester.pump();
    expect(taps, 1, reason: 'oddiy bosish pastdagi vidjetga yetadi');
    expect(find.byKey(const ValueKey('video-diag-text')), findsNothing);

    await tester.longPress(
      find.byType(CircularProgressIndicator),
      warnIfMissed: false,
    );
    // Aylana to'xtovsiz aylanadi — pumpAndSettle ishlamaydi.
    await tester.pump(const Duration(seconds: 1));
    expect(find.byKey(const ValueKey('video-diag-text')), findsOneWidget);
  });

  group('reliz qoidasi (App Store 2.5.19)', () {
    test('diagnostika faqat debug rejimida mavjud', () {
      // Relizda yashirin imo-ishora bo'lmasligi shart: o'rnatish ham,
      // uzun bosish ham `kVideoDiagAvailable` (= kDebugMode) ortida.
      final src = File('lib/core/media/video_diag.dart').readAsStringSync();
      expect(src, contains('const bool kVideoDiagAvailable = kDebugMode;'));
      expect(src, contains('if (!kVideoDiagAvailable) return;'));
      expect(src,
          contains('onLongPress: kVideoDiagAvailable ? () => showVideoDiag(context) : null'));
      final ad = File('lib/features/showcase/ad_fullscreen.dart').readAsStringSync();
      expect(ad, contains('kVideoDiagAvailable ? () => showVideoDiag(context) : null'));
      expect(ad, isNot(contains('onLongPress: () => showVideoDiag(context)')));
    });
  });
}
