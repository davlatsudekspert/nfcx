import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

/// Test uchun video platformasi — haqiqiy dekoder o'rniga.
///
/// Nima uchun kerak: `VideoPlayerController` test muhitida platforma
/// kanali yo'qligi sababli `initialize()` da yiqiladi va Reels'ning
/// hayotiy sikli (oldindan yuklash, yo'q qilish, tabdan chiqish)
/// UMUMAN sinalmasdi. Bu soxta platforma nechta player yaratilgani,
/// qaysi biri o'ynayotgani va qaysilari yo'q qilinganini sanaydi.
///
/// `frames` berilsa, `buildView` video o'rniga shu rasmni chizadi —
/// suratlar (shots) uchun.
class FakeVideoPlatform extends VideoPlayerPlatform {
  FakeVideoPlatform({this.frames = const [], this.initDelay = Duration.zero});

  final List<String> frames;
  final Duration initDelay;

  int _next = 1;
  final created = <int>[];
  final disposed = <int>[];
  final playing = <int>{};
  final urls = <int, String>{};
  final _events = <int, StreamController<VideoEvent>>{};

  Set<int> get alive => created.toSet().difference(disposed.toSet());

  @override
  Future<void> init() async {}

  @override
  Future<int?> create(DataSource dataSource) async => _make(dataSource.uri);

  @override
  Future<int?> createWithOptions(VideoCreationOptions options) async =>
      _make(options.dataSource.uri);

  int _make(String? uri) {
    final id = _next++;
    created.add(id);
    urls[id] = uri ?? '';
    final c = StreamController<VideoEvent>();
    _events[id] = c;
    Future<void>.delayed(initDelay, () {
      if (c.isClosed) return;
      c.add(VideoEvent(
        eventType: VideoEventType.initialized,
        duration: const Duration(seconds: 15),
        size: const Size(1080, 1920),
      ));
    });
    return id;
  }

  @override
  Stream<VideoEvent> videoEventsFor(int playerId) => _events[playerId]!.stream;

  @override
  Future<void> dispose(int playerId) async {
    disposed.add(playerId);
    playing.remove(playerId);
    await _events[playerId]?.close();
  }

  @override
  Future<void> setLooping(int playerId, bool looping) async {}
  @override
  Future<void> play(int playerId) async => playing.add(playerId);
  @override
  Future<void> pause(int playerId) async => playing.remove(playerId);
  @override
  Future<void> setVolume(int playerId, double volume) async {}
  @override
  Future<void> seekTo(int playerId, Duration position) async {}
  @override
  Future<void> setPlaybackSpeed(int playerId, double speed) async {}
  @override
  Future<Duration> getPosition(int playerId) async =>
      const Duration(seconds: 4);
  @override
  Future<void> setMixWithOthers(bool mixWithOthers) async {}

  @override
  Widget buildView(int playerId) => _frame(playerId);

  @override
  Widget buildViewWithOptions(VideoViewOptions options) =>
      _frame(options.playerId);

  Widget _frame(int id) {
    if (frames.isEmpty) return const SizedBox.expand();
    final url = urls[id] ?? '';
    final i = url.hashCode.abs() % frames.length;
    return Image.asset(frames[i], fit: BoxFit.cover);
  }
}
