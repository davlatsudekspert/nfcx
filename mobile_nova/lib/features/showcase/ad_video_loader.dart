import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../social/reels_screen.dart' show reelsInitTimeout;

/// REKLAMA VIDEOSI PLEERI — Ko'rgazmadagi video reklama sahifasi va
/// Asosiydagi reklama kartasi uchun (egasi, TestFlight 332: "BOY777 va
/// LOL ni ko'rgazmada ochilsa musiqa bor, rolikni o'zi ishlamayapti").
///
/// Avval ikkala joyda ham pleer bir marta ochilardi: `initialize()`
/// xato bersa yoki 20 s da ulgurmasa, yiqilgan pleer qolar va sahifa
/// qayta qurilguncha video HECH QACHON boshlanmasdi (faqat poster).
/// Ko'rgazmada esa video yana musiqa pleeri to'liq yuklanishini (yana
/// 20 s gacha) kutardi. Endi:
///
/// * yiqilgan/ulgurmagan pleer DARHOL yo'q qilinadi, [kAdVideoRetryDelay]
///   dan keyin o'zi qayta ochiladi ([kAdVideoAutoRetries] marta), keyingi
///   har [play] ham qayta urinadi;
/// * o'ynashi kerak bo'lgan video tashqaridan to'xtatilsa (iOS audio
///   sessiyasi o'zgardi, uzilish, Android'da xato) — [kAdVideoGuardEvery]
///   da qaytadan `play()`; pleer xato holatida bo'lsa — yangisi;
/// * [loading] — poster ustidagi nozik aylana uchun.
class AdVideoLoader {
  AdVideoLoader({
    required this.url,
    required this.onChanged,
    this.mixWithOthers = _no,
    this.blocked = _no,
    this.beforePlay,
  });

  static bool _no() => false;

  /// Video manzili (pleer ochilayotgan paytdagi).
  final String Function() url;

  /// Holat o'zgardi (poster/video/aylana qayta chizilsin).
  final VoidCallback onChanged;

  /// `VideoPlayerOptions.mixWithOthers` (ochilayotgan paytdagi).
  final bool Function() mixWithOthers;

  /// `true` — pleer hozircha YARATILMAYDI, 50 ms dan keyin yana
  /// so'raladi (eng ko'pi ~2 s, keyin baribir ochiladi). Android'da
  /// `mixWithOthers` platformadagi umumiy belgi: musiqa pleeri
  /// ochilayotganda video ham ochilsa, musiqa videoning belgisi bilan
  /// yaratilib qolardi.
  final bool Function() blocked;

  /// `play()` dan oldin (ovoz balandligi, audio sessiya). `false` —
  /// hozir o'ynamaydi.
  final Future<bool> Function(VideoPlayerController c)? beforePlay;

  VideoPlayerController? _c;
  bool _ready = false;
  bool _want = false;
  bool _failed = false;
  bool _disposed = false;
  int _attempts = 0;
  int _autoRetries = 0;
  int _blockedTicks = 0;
  Timer? _wait;
  Timer? _retry;
  Timer? _guard;

  /// Tayyor pleer (aks holda poster ko'rinadi).
  VideoPlayerController? get controller => _ready ? _c : null;

  /// Oxirgi urinish yiqildi.
  bool get failed => _failed;

  /// O'ynashi kerak, lekin video hali yo'q: ochilmoqda yoki birozdan
  /// keyin o'zi qayta urinadi.
  bool get loading =>
      _want &&
      !_ready &&
      (_c != null ||
          _wait != null ||
          (_retry != null && _autoRetries < kAdVideoAutoRetries));

  /// Video o'ynashi kerak: pleer yo'q bo'lsa ochiladi, tayyor bo'lsa
  /// `play()`.
  void play() {
    if (_disposed) return;
    _want = true;
    _guard ??= Timer.periodic(kAdVideoGuardEvery, (_) => _check());
    if (_c == null) {
      // Yiqilgandan keyingi qisqa tanaffusda yangi pleer ochilmaydi
      // (Asosiyda har surishda chaqiriladi).
      if (_wait == null && _retry == null) _create();
      return;
    }
    if (_ready) _start();
  }

  /// Ustida boshqa ekran / tab yashirin — pleer turadi, pauzada.
  void pause() {
    _want = false;
    _stopGuard();
    _wait?.cancel();
    _wait = null;
    _c?.pause();
  }

  /// Sahifa ekrandan chiqdi — pleer yo'q qilinadi, hisob boshidan.
  void reset() {
    pause();
    _retry?.cancel();
    _retry = null;
    _drop();
    _failed = false;
    _attempts = 0;
    _autoRetries = 0;
    _blockedTicks = 0;
  }

  void dispose() {
    reset();
    _disposed = true;
  }

  /// Ijro tashqaridan to'xtatilgan bo'lishi mumkin (masalan, iOS audio
  /// sessiyasi musiqa uchun qayta olindi) — o'ynashi kerak bo'lsa, qaytadan.
  void resume() {
    if (_want && _ready) _start();
  }

  void _stopGuard() {
    _guard?.cancel();
    _guard = null;
  }

  void _drop() {
    final c = _c;
    _c = null;
    _ready = false;
    if (c != null) {
      c.pause().catchError((_) {});
      c.dispose();
    }
  }

  void _create() {
    if (_disposed || !_want || _c != null) return;
    if (_blockedTicks < 40 && blocked()) {
      _blockedTicks++;
      _wait = Timer(const Duration(milliseconds: 50), () {
        _wait = null;
        _create();
      });
      return;
    }
    _blockedTicks = 0;
    final c = VideoPlayerController.networkUrl(
      Uri.parse(url()),
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: mixWithOthers()),
    );
    _c = c;
    _failed = false;
    _attempts++;
    onChanged();
    _init(c);
  }

  Future<void> _init(VideoPlayerController c) async {
    try {
      // Qayta urinishda — sekin tarmoq ehtimoli katta, muddat uzunroq.
      await c.initialize().timeout(
        _attempts > 1 ? reelsInitTimeout * 2 : reelsInitTimeout,
      );
      if (_c != c) return;
      await c.setLooping(true);
      if (_c != c) return;
      _ready = true;
    } catch (_) {
      if (_c != c) return;
      _fail();
      return;
    }
    onChanged();
    await _start();
  }

  /// Pleer yo'q qilinadi (o'lik pleer qolmaydi), birozdan keyin yangisi.
  void _fail() {
    _drop();
    _failed = true;
    _retry?.cancel();
    _retry = Timer(kAdVideoRetryDelay, () {
      _retry = null;
      if (!_disposed &&
          _want &&
          _c == null &&
          _autoRetries < kAdVideoAutoRetries) {
        _autoRetries++;
        _create();
      }
      onChanged();
    });
    onChanged();
  }

  Future<void> _start() async {
    final c = _c;
    if (!_ready || c == null || !_want) return;
    final hook = beforePlay;
    if (hook != null && !await hook(c)) return;
    if (_c != c || !_want) return;
    await c.play();
  }

  void _check() {
    if (_disposed || !_want) return;
    final c = _c;
    if (c == null || !_ready) return;
    final v = c.value;
    if (v.hasError) {
      _fail();
    } else if (!v.isPlaying) {
      _start();
    }
  }
}

/// Yiqilgandan keyin shuncha kutib qayta ochiladi.
const kAdVideoRetryDelay = Duration(seconds: 3);

/// Sahifa ochiq turganda o'zi necha marta qayta urinadi (keyingisi —
/// sahifa/karta yana ko'ringanda).
const kAdVideoAutoRetries = 2;

/// O'ynashi kerak bo'lgan video to'xtab qolmaganini tekshirish oralig'i.
const kAdVideoGuardEvery = Duration(seconds: 2);

/// Poster ustidagi nozik "yuklanmoqda" aylanasi — video hali
/// boshlanmagan bo'lsa (ochilmoqda, qayta urinadi yoki birinchi kadrlar
/// kutilmoqda). Video yura boshlagach yo'qoladi.
class AdVideoSpinner extends StatelessWidget {
  const AdVideoSpinner({
    super.key,
    required this.loading,
    required this.controller,
  });

  /// Pleer hali tayyor emas ([AdVideoLoader.loading]).
  final bool loading;

  /// Tayyor pleer — birinchi kadrlar kelguncha (bufer) ham aylanadi.
  final VideoPlayerController? controller;

  static bool waiting(VideoPlayerValue v) =>
      v.position <= Duration.zero && (v.isBuffering || !v.isPlaying);

  @override
  Widget build(BuildContext context) {
    final c = controller;
    if (loading) return const _Ring();
    if (c == null) return const SizedBox.shrink();
    return ValueListenableBuilder<VideoPlayerValue>(
      valueListenable: c,
      builder: (_, v, __) =>
          waiting(v) ? const _Ring() : const SizedBox.shrink(),
    );
  }
}

class _Ring extends StatelessWidget {
  const _Ring();

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: Center(
      child: Container(
        width: 44,
        height: 44,
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: .35),
          shape: BoxShape.circle,
        ),
        child: const CircularProgressIndicator(
          strokeWidth: 2,
          color: Colors.white70,
        ),
      ),
    ),
  );
}
