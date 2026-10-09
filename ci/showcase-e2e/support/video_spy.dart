// VIDEO/AUDIO PLEER KUZATUVCHISI — faqat o'qiydi, ilova kodiga tegmaydi.
//
// Ilova musiqa va videoni `video_player` orqali o'ynatadi
// (`ShowcasePage._music`, `_video`, Asosiydagi reklama kartasi). Ular
// vidjetning ichki (private) holatida — testdan ko'rinmaydi. Shuning
// uchun `VideoPlayerPlatform.instance` ga O'RAMA qo'yiladi: hamma
// chaqiruv o'zgarishsiz HAQIQIY platformaga (ExoPlayer / AVPlayer)
// uzatiladi, o'rama faqat yozib boradi: qaysi manzil, ovoz balandligi,
// play/pause va platformadan kelgan "o'ynayapti" hodisalari. Pozitsiya
// esa platformaning o'zidan (`getPosition`) o'qiladi — bu ovoz HAQIQATAN
// oldinga ketayotganining isboti.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

class PlayerRec {
  PlayerRec(this.id, this.uri, this.seq);
  final int id;
  final String uri;

  /// Yaratilish tartibi (bir xil manzil qayta yaratilsa — eng yangisi).
  final int seq;
  double volume = 1;
  bool playCalled = false;
  bool nativePlaying = false;
  bool initialized = false;
  bool disposed = false;
  bool looping = false;
  Duration duration = Duration.zero;
  String error = '';
  final List<String> log = [];

  void note(String s) {
    if (log.length < 40) log.add(s);
  }

  Map<String, Object?> toJson() => {
        'id': id,
        'uri': shortUri(uri),
        'volume': volume,
        'playCalled': playCalled,
        'nativePlaying': nativePlaying,
        'initialized': initialized,
        'disposed': disposed,
        'durationMs': duration.inMilliseconds,
        if (error.isNotEmpty) 'error': error,
      };
}

String shortUri(String u) {
  final i = u.lastIndexOf('/');
  return i >= 0 && i < u.length - 1 ? u.substring(i + 1) : u;
}

class SpyVideoPlatform extends VideoPlayerPlatform {
  SpyVideoPlatform(this.inner);

  final VideoPlayerPlatform inner;
  final List<PlayerRec> all = [];
  final Map<int, PlayerRec> _byId = {};
  int _seq = 0;
  final List<bool> mixCalls = [];

  PlayerRec? byId(int id) => _byId[id];

  /// Shu manzil uchun eng yangi, yopilmagan pleer.
  PlayerRec? latest(String uri, {bool alive = true}) {
    PlayerRec? best;
    final norm = Uri.tryParse(uri)?.toString() ?? uri;
    for (final r in all) {
      if (r.uri != uri && r.uri != norm) continue;
      if (alive && r.disposed) continue;
      if (best == null || r.seq > best.seq) best = r;
    }
    return best;
  }

  List<PlayerRec> get alive => all.where((r) => !r.disposed).toList();

  /// Platformadan haqiqiy pozitsiya (yopilgan bo'lsa — `null`).
  Future<Duration?> position(PlayerRec r) async {
    if (r.disposed) return null;
    try {
      return await inner.getPosition(r.id);
    } catch (_) {
      return null;
    }
  }

  void _rec(int? id, DataSource s) {
    if (id == null) return;
    final r = PlayerRec(id, s.uri ?? s.asset ?? '', ++_seq);
    all.add(r);
    _byId[id] = r;
  }

  @override
  Future<void> init() => inner.init();

  @override
  Future<void> dispose(int playerId) {
    _byId[playerId]?.disposed = true;
    return inner.dispose(playerId);
  }

  @override
  // ignore: deprecated_member_use
  Future<int?> create(DataSource dataSource) async {
    // ignore: deprecated_member_use
    final id = await inner.create(dataSource);
    _rec(id, dataSource);
    return id;
  }

  @override
  Future<int?> createWithOptions(VideoCreationOptions options) async {
    final id = await inner.createWithOptions(options);
    _rec(id, options.dataSource);
    return id;
  }

  @override
  Stream<VideoEvent> videoEventsFor(int playerId) =>
      inner.videoEventsFor(playerId).map((e) {
        final r = _byId[playerId];
        if (r != null) {
          switch (e.eventType) {
            case VideoEventType.initialized:
              r.initialized = true;
              r.duration = e.duration ?? Duration.zero;
              r.note('initialized');
            case VideoEventType.isPlayingStateUpdate:
              r.nativePlaying = e.isPlaying ?? false;
              r.note('native:${e.isPlaying}');
            case VideoEventType.completed:
              r.note('completed');
            default:
              break;
          }
        }
        return e;
      }, ).handleError((Object e, StackTrace st) {
        final r = _byId[playerId];
        if (r != null) {
          r.error = '$e';
          r.note('error');
        }
        // Xato ilovaga o'zgarishsiz qaytadi.
        Error.throwWithStackTrace(e, st);
      });

  @override
  Future<void> setLooping(int playerId, bool looping) {
    _byId[playerId]?.looping = looping;
    return inner.setLooping(playerId, looping);
  }

  @override
  Future<void> play(int playerId) {
    final r = _byId[playerId];
    if (r != null) {
      r.playCalled = true;
      r.note('play');
    }
    return inner.play(playerId);
  }

  @override
  Future<void> pause(int playerId) {
    final r = _byId[playerId];
    if (r != null) {
      r.playCalled = false;
      r.note('pause');
    }
    return inner.pause(playerId);
  }

  @override
  Future<void> setVolume(int playerId, double volume) {
    final r = _byId[playerId];
    if (r != null) {
      r.volume = volume;
      r.note('vol:$volume');
    }
    return inner.setVolume(playerId, volume);
  }

  @override
  Future<void> seekTo(int playerId, Duration position) =>
      inner.seekTo(playerId, position);

  @override
  Future<void> setPlaybackSpeed(int playerId, double speed) =>
      inner.setPlaybackSpeed(playerId, speed);

  @override
  Future<Duration> getPosition(int playerId) => inner.getPosition(playerId);

  @override
  // ignore: deprecated_member_use
  Widget buildView(int playerId) => inner.buildView(playerId);

  @override
  Widget buildViewWithOptions(VideoViewOptions options) =>
      inner.buildViewWithOptions(options);

  @override
  Future<void> setMixWithOthers(bool mixWithOthers) {
    if (mixCalls.length < 200) mixCalls.add(mixWithOthers);
    return inner.setMixWithOthers(mixWithOthers);
  }

  @override
  Future<void> setAllowBackgroundPlayback(bool allowBackgroundPlayback) =>
      inner.setAllowBackgroundPlayback(allowBackgroundPlayback);

  @override
  Future<void> setWebOptions(int playerId, VideoPlayerWebOptions options) =>
      inner.setWebOptions(playerId, options);

  @override
  Future<List<VideoAudioTrack>> getAudioTracks(int playerId) =>
      inner.getAudioTracks(playerId);

  @override
  Future<void> selectAudioTrack(int playerId, String trackId) =>
      inner.selectAudioTrack(playerId, trackId);

  @override
  bool isAudioTrackSupportAvailable() => inner.isAudioTrackSupportAvailable();

  @override
  Future<List<VideoTrack>> getVideoTracks(int playerId) =>
      inner.getVideoTracks(playerId);

  @override
  Future<void> selectVideoTrack(int playerId, VideoTrack? track) =>
      inner.selectVideoTrack(playerId, track);

  @override
  bool isVideoTrackSupportAvailable() => inner.isVideoTrackSupportAvailable();
}

/// Pleer HAQIQATAN o'ynayaptimi: [window] davomida pozitsiya kamida
/// [minAdvance] ga oldinga ketdi.
class Advance {
  Advance(this.p0, this.p1, this.window);
  final Duration? p0;
  final Duration? p1;
  final Duration window;
  Duration get delta =>
      (p0 == null || p1 == null) ? Duration.zero : p1! - p0!;

  /// Aylanib qaytgan bo'lishi mumkin (looping) — shunda ham farq bor.
  bool moving({Duration minAdvance = const Duration(milliseconds: 1500)}) =>
      p0 != null &&
      p1 != null &&
      (delta >= minAdvance || (p1! < p0! && p1! > Duration.zero));

  bool get still =>
      p0 != null && p1 != null && delta.abs() < const Duration(milliseconds: 300);

  Map<String, Object?> toJson() => {
        'pos0Ms': p0?.inMilliseconds,
        'pos1Ms': p1?.inMilliseconds,
        'deltaMs': delta.inMilliseconds,
        'windowMs': window.inMilliseconds,
      };
}

Future<Advance> measure(SpyVideoPlatform spy, PlayerRec r,
    {Duration window = const Duration(seconds: 3)}) async {
  final p0 = await spy.position(r);
  await Future<void>.delayed(window);
  final p1 = await spy.position(r);
  return Advance(p0, p1, window);
}
