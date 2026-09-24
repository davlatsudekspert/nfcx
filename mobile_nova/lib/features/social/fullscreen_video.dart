import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

/// TO'LIQ EKRANDA VIDEONI JOYLASH (Instagram).
///
/// Tik video (9:16) uzun telefonda ekranni TO'LDIRADI — tepa va pastda
/// qora chiziq qolmaydi; chetlardan kesilish 20% dan oshmagandagina.
/// Yotiq yoki kvadrat video esa BUTUN ko'rinadi (`contain`) — uni
/// to'ldirish yarmini kesib tashlardi.
BoxFit immersiveVideoFit(Size video, Size box) {
  if (video.isEmpty || box.isEmpty) return BoxFit.contain;
  final v = video.width / video.height;
  final b = box.width / box.height;
  final kept = v > b ? b / v : v / b;
  return kept >= .8 ? BoxFit.cover : BoxFit.contain;
}

/// Lentadagi video kontrollerini to'liq ekranga UZATISH.
///
/// Video QAYTA YUKLANMAYDI: o'sha kontroller o'sha joyidan davom etadi
/// (Instagram kabi). Lenta kartasi to'liq ekran ochiq turganda yo'q
/// bo'lib ketsa (ro'yxat qayta qurildi), kontroller egasiz qoladi —
/// [orphaned] belgilanadi va uni to'liq ekran sahifasi yopadi.
class VideoHandoff {
  VideoHandoff(this.controller);

  final VideoPlayerController controller;

  /// Lenta kartasi yo'q bo'ldi — kontrollerni sahifa yopadi.
  bool orphaned = false;
}

/// BELGILARSIZ TO'LIQ EKRAN (egasi, 2026-09-24: "lentada ham rolik
/// bosilsa to'liq ekran, belgilarsiz").
///
/// * video ekran markazida, tik video ekranni to'ldiradi;
/// * REELS BILAN BIR XIL (egasi, 2026-09-24: "yana bir bosganda joyiga
///   qaytmayapti — Reels'dagidek ishlasin"): BOSISH — lentaga qaytadi,
///   BOSIB TURISH — pauza, qo'yib yuborilsa davom etadi;
/// * tepaga yoki pastga surish, "orqaga" — ham yopiladi.
///
/// Telefonning tizim panellari YASHIRILMAYDI: `immersiveSticky` dan
/// qaytish Android'da oyna holatini boshlang'ich holatiga emas, boshqa
/// rejimga (panel kontent ustida) o'tkazardi. Fon qora, soat va batareya
/// Instagram'dagidek oq.
Future<void> openFullscreenVideo(BuildContext context, VideoHandoff h) {
  return Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder<void>(
      transitionDuration: const Duration(milliseconds: 200),
      reverseTransitionDuration: const Duration(milliseconds: 160),
      pageBuilder: (_, __, ___) => FullscreenVideo(handoff: h),
      transitionsBuilder: (_, a, __, child) =>
          FadeTransition(opacity: a, child: child),
    ),
  );
}

class FullscreenVideo extends StatefulWidget {
  const FullscreenVideo({super.key, required this.handoff});

  final VideoHandoff handoff;

  @override
  State<FullscreenVideo> createState() => _FullscreenVideoState();
}

class _FullscreenVideoState extends State<FullscreenVideo> {
  VideoPlayerController get _c => widget.handoff.controller;

  /// Surish masofasi (tepaga ham, pastga ham) — sahifa barmoq bilan
  /// birga siljiydi.
  double _drag = 0;

  /// Bosib turilgan paytda pauza — qo'yib yuborilsa davom etadimi.
  bool _wasPlaying = false;
  bool _holding = false;

  @override
  void initState() {
    super.initState();
    _c.addListener(_tick);
    _c.setVolume(1);
    _c.play();
  }

  bool? _playing;
  bool? _inited;

  /// Kontroller har pozitsiya o'zgarishida xabar beradi — sahifa
  /// faqat ko'rinish o'zgarganda (pauza/davom, ochildi) qayta chiziladi.
  void _tick() {
    final v = _c.value;
    if (v.isPlaying == _playing && v.isInitialized == _inited) return;
    _playing = v.isPlaying;
    _inited = v.isInitialized;
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _c.removeListener(_tick);
    if (widget.handoff.orphaned) {
      _c.setVolume(0);
      _c.pause();
      _c.dispose();
    }
    super.dispose();
  }

  void _close() => Navigator.of(context).maybePop();

  void _holdStart(LongPressStartDetails _) {
    _wasPlaying = _c.value.isPlaying;
    _c.pause();
    setState(() => _holding = true);
  }

  void _holdEnd(LongPressEndDetails _) {
    if (_wasPlaying) _c.play();
    setState(() => _holding = false);
  }

  @override
  Widget build(BuildContext context) {
    final v = _c.value;
    final fade = (1 - _drag.abs() / 400).clamp(.4, 1.0);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
      key: const ValueKey('video-fullscreen'),
      backgroundColor: Colors.black.withValues(alpha: fade),
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _close,
        onLongPressStart: _holdStart,
        onLongPressEnd: _holdEnd,
        onVerticalDragUpdate: (d) =>
            setState(() => _drag = (_drag + d.delta.dy).clamp(-600, 600)),
        onVerticalDragEnd: (d) {
          final v = (d.primaryVelocity ?? 0).abs();
          if (_drag.abs() > 110 || v > 700) {
            _close();
          } else {
            setState(() => _drag = 0);
          }
        },
        child: Transform.translate(
          offset: Offset(0, _drag),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (v.isInitialized && v.size.height > 0)
                Center(
                  child: FittedBox(
                    fit: immersiveVideoFit(v.size, MediaQuery.sizeOf(context)),
                    clipBehavior: Clip.hardEdge,
                    child: SizedBox(
                      width: v.size.width,
                      height: v.size.height,
                      child: VideoPlayer(_c),
                    ),
                  ),
                ),
              // Yagona belgi — faqat pauzada, odam bosganini bilsin.
              if (v.isInitialized && !v.isPlaying && !_holding)
                const IgnorePointer(
                  child: Center(
                    child: Icon(Icons.play_arrow_rounded,
                        size: 72, color: Colors.white70),
                  ),
                ),
            ],
          ),
        ),
      ),
    ),
    );
  }
}
