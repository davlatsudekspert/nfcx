import 'dart:async';

import 'package:flutter/services.dart';
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

  /// Shu bo'lakni o'z ichiga olgan URL BIR MARTA yuklanmaydi (xato beradi).
  final failOnce = <String>{};

  /// Shu bo'lakli URL BIR MARTA umuman javob bermaydi (`initialize()`
  /// osilib qoladi — sekin/uzilgan tarmoq).
  final hangOnce = <String>{};

  /// Shu bo'lakli URL [initDelay] dan tashqari yana shuncha sekin
  /// yuklanadi (masalan, faqat musiqa sekin).
  final slow = <String, Duration>{};
  final positions = <int, Duration>{};
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
    if (mixCalls.isNotEmpty) mixOf[id] = mixCalls.last;
    final c = StreamController<VideoEvent>();
    _events[id] = c;
    final hang = hangOnce.where((f) => (uri ?? '').contains(f)).toList();
    if (hang.isNotEmpty) {
      hangOnce.remove(hang.first);
      return id;
    }
    var extra = Duration.zero;
    slow.forEach((f, d) {
      if ((uri ?? '').contains(f) && d > extra) extra = d;
    });
    Future<void>.delayed(initDelay + extra, () {
      if (c.isClosed) return;
      // Bir martalik yuklash xatosi (sekin tarmoq) — URL bo'lagi bo'yicha.
      final fail = failOnce.where((f) => (uri ?? '').contains(f)).toList();
      if (fail.isNotEmpty) {
        failOnce.remove(fail.first);
        c.addError(PlatformException(
            code: 'VideoError', message: 'Source error: Read timed out'));
        return;
      }
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

  /// Ijroni TASHQARIDAN to'xtatadi (iOS: audio sessiya uzilishi — AVPlayer
  /// o'zi to'xtaydi va plagin `isPlaying: false` yuboradi).
  void externalPause(int playerId) {
    playing.remove(playerId);
    _events[playerId]?.add(VideoEvent(
      eventType: VideoEventType.isPlayingStateUpdate,
      isPlaying: false,
    ));
  }

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
  Future<void> setVolume(int playerId, double volume) async =>
      volumeOf[playerId] = volume;

  /// Oxirgi `setVolume` qiymati — ovoz sinovlari uchun.
  final volumeOf = <int, double>{};
  @override
  Future<void> seekTo(int playerId, Duration position) async =>
      positions[playerId] = position;
  @override
  Future<void> setPlaybackSpeed(int playerId, double speed) async {}
  /// Shu bo'lakli URL o'ynasa ham pozitsiyasi JOYIDAN JILMAYDI (iPhone:
  /// AVPlayer buferda qotib qoldi — pushti birinchi kadr).
  final frozen = <String>{};
  final _progress = <int, Duration>{};

  /// O'ynayotgan pleerning pozitsiyasi har so'rovda 100 ms ilgarilaydi
  /// (haqiqiy pleerdagidek); `seekTo` qiymati boshlanish nuqtasi.
  @override
  Future<Duration> getPosition(int playerId) async {
    final base = positions[playerId] ?? Duration.zero;
    final url = urls[playerId] ?? '';
    if (playing.contains(playerId) && !frozen.any(url.contains)) {
      _progress[playerId] =
          (_progress[playerId] ?? Duration.zero) +
              const Duration(milliseconds: 100);
    }
    return base + (_progress[playerId] ?? Duration.zero);
  }
  @override
  Future<void> setMixWithOthers(bool mixWithOthers) async =>
      mixCalls.add(mixWithOthers);

  /// `setMixWithOthers` chaqiruvlari (pleer ochilganda) — audio fokus
  /// sinovlari uchun.
  final mixCalls = <bool>[];

  /// Pleer yaratilganda amalda bo'lgan `mixWithOthers` (controller uni
  /// `create` dan oldin yuboradi). `true` — audio fokusni olmaydi.
  final mixOf = <int, bool>{};

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
