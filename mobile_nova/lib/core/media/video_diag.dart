// VIDEO DIAGNOSTIKASI — haqiqiy iPhone'da "video cheksiz aylanadi" holatini
// egasi O'ZI skrinshot qilib ko'ra olishi uchun.
//
// `VideoPlayerPlatform.instance` ga o'rama qo'yiladi: har bir chaqiruv
// o'zgarishsiz HAQIQIY platformaga (AVPlayer / ExoPlayer) uzatiladi, o'rama
// faqat yozib boradi — qaysi manzil, qachon yaratildi, `initialized`
// qancha vaqtda keldi, bufer, play/pause/ovoz, platforma xatolari.
// Oxirgi [DiagVideoPlatform.maxRecords] ta pleer saqlanadi.
//
// Foydalanuvchiga ko'rinmaydi: oynani aylana (spinner) ustini UZUN
// BOSISH ochadi ([showVideoDiag]).
import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

/// Bitta pleer haqidagi yozuv.
class DiagRecord {
  DiagRecord({
    required this.seq,
    required this.playerId,
    required this.uri,
    required this.createdAt,
  });

  /// Yaratilish tartibi (1 dan).
  final int seq;

  /// Platforma bergan pleer raqami (create xatosi bo'lsa -1).
  final int playerId;
  final String uri;
  final DateTime createdAt;

  /// `create()` o'zi tashlagan xato (bo'lsa).
  String? createError;

  bool initialized = false;
  int? initMs;
  Size? size;
  Duration? duration;

  int bufferingStarts = 0;
  int bufferingEnds = 0;
  bool? playing;
  bool completed = false;

  /// Platforma oqimidan kelgan xatolar (to'liq matn).
  final List<String> errors = [];

  int playCalls = 0;
  int pauseCalls = 0;
  bool? lastPlayCall;
  double? volume;
  int volumeCalls = 0;
  bool? looping;
  DateTime? disposedAt;

  /// Vaqt chizig'i: "+123ms initialized" (oxirgi 14 ta).
  final List<String> timeline = [];

  bool get disposed => disposedAt != null;

  /// Yaratilgandan beri o'tgan millisekund.
  int _ms(DateTime now) => now.difference(createdAt).inMilliseconds;

  void note(DateTime now, String s) {
    if (timeline.length >= 14) timeline.removeAt(0);
    timeline.add('+${_ms(now)}ms $s');
  }
}

/// Manzilning oxirgi bo'lagi ("promo_boy777.mp4").
String diagShortUri(String u) {
  final q = u.indexOf('?');
  final s = q >= 0 ? u.substring(0, q) : u;
  final i = s.lastIndexOf('/');
  return i >= 0 && i < s.length - 1 ? s.substring(i + 1) : s;
}

String _errText(Object e) {
  if (e is PlatformException) {
    return 'PlatformException code=${e.code} message=${e.message} '
        'details=${e.details}';
  }
  return '${e.runtimeType}: $e';
}

/// Hamma narsani haqiqiy platformaga uzatadigan va yozib boradigan o'rama.
class DiagVideoPlatform extends VideoPlayerPlatform {
  DiagVideoPlatform(this.inner, {DateTime Function()? clock})
    : _clock = clock ?? DateTime.now {
    installedAt = _clock();
  }

  static const maxRecords = 20;

  final VideoPlayerPlatform inner;
  final DateTime Function() _clock;
  late final DateTime installedAt;

  /// Eskidan yangiga (oxirgi [maxRecords] ta).
  final List<DiagRecord> records = [];
  final Map<int, DiagRecord> _byId = {};
  final List<bool> mixCalls = [];
  int _seq = 0;

  DiagRecord? byId(int id) => _byId[id];

  DiagRecord _add(int id, DataSource s, DateTime at) {
    final r = DiagRecord(
      seq: ++_seq,
      playerId: id,
      uri: s.uri ?? s.asset ?? '',
      createdAt: at,
    );
    records.add(r);
    if (id >= 0) _byId[id] = r;
    while (records.length > maxRecords) {
      final old = records.removeAt(0);
      if (_byId[old.playerId] == old) _byId.remove(old.playerId);
    }
    return r;
  }

  @override
  Future<void> init() => inner.init();

  @override
  Future<void> dispose(int playerId) {
    final r = _byId[playerId];
    if (r != null) {
      final now = _clock();
      r.disposedAt = now;
      r.note(now, 'dispose');
    }
    return inner.dispose(playerId);
  }

  Future<int?> _create(DataSource s, Future<int?> Function() make) async {
    final at = _clock();
    try {
      final id = await make();
      if (id != null) {
        _add(id, s, at).note(_clock(), 'create ok');
      }
      return id;
    } catch (e) {
      final r = _add(-1, s, at)..createError = _errText(e);
      r.note(_clock(), 'create ERROR');
      rethrow;
    }
  }

  @override
  // ignore: deprecated_member_use
  Future<int?> create(DataSource dataSource) =>
      // ignore: deprecated_member_use
      _create(dataSource, () => inner.create(dataSource));

  @override
  Future<int?> createWithOptions(VideoCreationOptions options) =>
      _create(options.dataSource, () => inner.createWithOptions(options));

  @override
  Stream<VideoEvent> videoEventsFor(int playerId) => inner
      .videoEventsFor(playerId)
      .transform(
        StreamTransformer<VideoEvent, VideoEvent>.fromHandlers(
          handleData: (e, sink) {
            _onEvent(playerId, e);
            sink.add(e);
          },
          handleError: (e, st, sink) {
            _onError(playerId, e);
            // Xato ilovaga o'zgarishsiz qaytadi.
            sink.addError(e, st);
          },
        ),
      );

  void _onEvent(int playerId, VideoEvent e) {
    final r = _byId[playerId];
    if (r == null) return;
    final now = _clock();
    switch (e.eventType) {
      case VideoEventType.initialized:
        if (!r.initialized) r.initMs = r._ms(now);
        r.initialized = true;
        r.size = e.size;
        r.duration = e.duration;
        r.note(
          now,
          'initialized ${e.size?.width.toInt()}x'
          '${e.size?.height.toInt()} ${e.duration?.inMilliseconds}ms',
        );
      case VideoEventType.bufferingStart:
        r.bufferingStarts++;
        r.note(now, 'bufferingStart');
      case VideoEventType.bufferingEnd:
        r.bufferingEnds++;
        r.note(now, 'bufferingEnd');
      case VideoEventType.isPlayingStateUpdate:
        r.playing = e.isPlaying;
        r.note(now, 'isPlaying=${e.isPlaying}');
      case VideoEventType.completed:
        r.completed = true;
        r.note(now, 'completed');
      case VideoEventType.bufferingUpdate:
      case VideoEventType.unknown:
        break;
    }
  }

  void _onError(int playerId, Object e) {
    final r = _byId[playerId];
    if (r == null) return;
    r.errors.add(_errText(e));
    r.note(_clock(), 'ERROR');
  }

  @override
  Future<void> setLooping(int playerId, bool looping) {
    _byId[playerId]?.looping = looping;
    return inner.setLooping(playerId, looping);
  }

  @override
  Future<void> play(int playerId) {
    final r = _byId[playerId];
    if (r != null) {
      r.playCalls++;
      r.lastPlayCall = true;
      r.note(_clock(), 'play()');
    }
    return inner.play(playerId);
  }

  @override
  Future<void> pause(int playerId) {
    final r = _byId[playerId];
    if (r != null) {
      r.pauseCalls++;
      r.lastPlayCall = false;
      r.note(_clock(), 'pause()');
    }
    return inner.pause(playerId);
  }

  @override
  Future<void> setVolume(int playerId, double volume) {
    final r = _byId[playerId];
    if (r != null) {
      r.volume = volume;
      r.volumeCalls++;
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
    if (mixCalls.length < 50) mixCalls.add(mixWithOthers);
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

  /// Yopilmagan pleerlarning joriy pozitsiyasi (platformadan, bir marta).
  Future<Map<int, String>> livePositions() async {
    final out = <int, String>{};
    for (final r in records) {
      if (r.disposed || r.playerId < 0) continue;
      try {
        final p = await inner
            .getPosition(r.playerId)
            .timeout(const Duration(seconds: 1));
        out[r.playerId] = '${p.inMilliseconds}ms';
      } catch (e) {
        out[r.playerId] = 'xato: $e';
      }
    }
    return out;
  }

  /// Butun hisobot matni (eng yangisi tepada).
  String report({Map<int, String> positions = const {}}) {
    final now = _clock();
    final b = StringBuffer()
      ..writeln('VIDEO DIAGNOSTIKA')
      ..writeln(
        '${Platform.operatingSystem} '
        '${Platform.operatingSystemVersion}',
      )
      ..writeln('vaqt: ${now.toIso8601String()}')
      ..writeln(
        'ilova ishlagan: '
        '${now.difference(installedAt).inSeconds}s',
      )
      ..writeln('pleerlar: ${records.length} (oxirgi $maxRecords)')
      ..writeln(
        'mixWithOthers: ${mixCalls.isEmpty ? '-' : mixCalls.join(',')}',
      );
    if (records.isEmpty) b.writeln('\n(hali video yaratilmagan)');
    for (final r in records.reversed) {
      b
        ..writeln('\n#${r.seq} id=${r.playerId} ${diagShortUri(r.uri)}')
        ..writeln('  uri: ${r.uri}')
        ..writeln('  holat: ${_state(r)}')
        ..writeln(
          '  init: ${r.initMs == null ? "KELMADI" : "${r.initMs} ms"}'
          '  o\'lcham: ${_size(r.size)}'
          '  davomiylik: ${r.duration?.inMilliseconds ?? "-"} ms',
        )
        ..writeln(
          '  bufer: start=${r.bufferingStarts} '
          'end=${r.bufferingEnds}',
        )
        ..writeln(
          '  o\'ynayapti: ${r.playing ?? "-"}'
          '  play()=${r.playCalls} pause()=${r.pauseCalls}'
          '  oxirgi=${r.lastPlayCall ?? "-"}',
        )
        ..writeln(
          '  ovoz: ${r.volume ?? "-"} (${r.volumeCalls} marta)'
          '  loop: ${r.looping ?? "-"}',
        )
        ..writeln('  yaratilgan: ${r.createdAt.toIso8601String()}')
        ..writeln('  yopilgan: ${r.disposed ? "HA" : "yo'q"}');
      if (positions.containsKey(r.playerId)) {
        b.writeln('  pozitsiya: ${positions[r.playerId]}');
      }
      if (r.createError != null) {
        b.writeln('  CREATE XATO: ${r.createError}');
      }
      for (final e in r.errors) {
        b.writeln('  XATO: $e');
      }
      if (r.timeline.isNotEmpty) {
        b.writeln('  voqealar:');
        for (final t in r.timeline) {
          b.writeln('    $t');
        }
      }
    }
    return b.toString();
  }

  static String _size(Size? s) =>
      s == null ? '-' : '${s.width.toInt()}x${s.height.toInt()}';

  static String _state(DiagRecord r) {
    if (r.createError != null) return 'CREATE XATO';
    if (r.errors.isNotEmpty) return 'XATO';
    if (r.disposed) return 'yopilgan';
    if (!r.initialized) return 'KUTILMOQDA (initialized kelmadi)';
    if (r.completed) return 'tugagan';
    return r.playing == true ? "o'ynayapti" : 'tayyor';
  }
}

/// Faol o'rama (o'rnatilgan bo'lsa).
DiagVideoPlatform? get activeVideoDiag {
  final p = VideoPlayerPlatform.instance;
  return p is DiagVideoPlatform ? p : null;
}

/// `main()` da, `runApp` dan oldin. Takror chaqirish zararsiz; hech qachon
/// xato tashlamaydi (diagnostika ilovani yiqitmasligi shart).
void installVideoDiag() {
  try {
    final current = VideoPlayerPlatform.instance;
    if (current is DiagVideoPlatform) return;
    VideoPlayerPlatform.instance = DiagVideoPlatform(current);
  } catch (_) {}
}

/// Diagnostika oynasini ochadi (aylana ustini uzun bosish).
Future<void> showVideoDiag(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: const Color(0xFF101114),
    builder: (_) => const VideoDiagSheet(),
  );
}

/// Oyna ichi: matn + "Nusxa olish".
class VideoDiagSheet extends StatefulWidget {
  const VideoDiagSheet({super.key});

  @override
  State<VideoDiagSheet> createState() => _VideoDiagSheetState();
}

class _VideoDiagSheetState extends State<VideoDiagSheet> {
  Map<int, String> _pos = const {};
  bool _copied = false;

  @override
  void initState() {
    super.initState();
    final d = activeVideoDiag;
    if (d != null) {
      d.livePositions().then((p) {
        if (mounted) setState(() => _pos = p);
      });
    }
  }

  String _text() {
    final d = activeVideoDiag;
    return d == null
        ? 'VIDEO DIAGNOSTIKA\n(o\'rnatilmagan: installVideoDiag() chaqirilmagan)'
        : d.report(positions: _pos);
  }

  @override
  Widget build(BuildContext context) {
    final text = _text();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: .85,
      minChildSize: .4,
      maxChildSize: .95,
      builder: (_, scroll) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 8, 0),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'Video diagnostika',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                ),
                TextButton.icon(
                  key: const ValueKey('video-diag-copy'),
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: _text()));
                    if (mounted) setState(() => _copied = true);
                  },
                  icon: const Icon(Icons.copy_rounded, size: 16),
                  label: Text(_copied ? 'Nusxalandi' : 'Nusxa olish'),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              child: SelectableText(
                text,
                key: const ValueKey('video-diag-text'),
                style: const TextStyle(
                  color: Color(0xFFE6E6E6),
                  fontFamily: 'Courier',
                  fontFamilyFallback: ['monospace', 'Menlo'],
                  fontSize: 10.5,
                  height: 1.3,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Aylana (spinner) ustiga uzun bosishni qo'shadi. [HitTestBehavior.translucent]:
/// pastdagi vidjetlar (video bosilishi) o'z teginishini yo'qotmaydi — faqat
/// uzun bosish qo'shimcha tinglanadi.
class VideoDiagLongPress extends StatelessWidget {
  const VideoDiagLongPress({super.key, required this.child, this.size = 64});

  final Widget child;
  final double size;

  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.translucent,
    onLongPress: () => showVideoDiag(context),
    child: SizedBox(
      width: size,
      height: size,
      // Ko'rinish teginishni yutmasin (pastdagi video bosilishi ishlasin).
      child: Center(child: IgnorePointer(child: child)),
    ),
  );
}
