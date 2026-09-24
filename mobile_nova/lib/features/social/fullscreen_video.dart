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
/// * video ekran markazida, hech narsa kesilmaydi (`contain`);
/// * telefonning tizim panellari ham yashiriladi;
/// * bosish — pauza/davom, pastga surish yoki "orqaga" — yopiladi.
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

  /// Pastga surish masofasi — sahifa barmoq bilan birga siljiydi.
  double _drag = 0;

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
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
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.manual,
        overlays: SystemUiOverlay.values);
    if (widget.handoff.orphaned) {
      _c.setVolume(0);
      _c.pause();
      _c.dispose();
    }
    super.dispose();
  }

  void _toggle() {
    _c.value.isPlaying ? _c.pause() : _c.play();
  }

  @override
  Widget build(BuildContext context) {
    final v = _c.value;
    final fade = (1 - _drag / 400).clamp(.4, 1.0);
    return Scaffold(
      key: const ValueKey('video-fullscreen'),
      backgroundColor: Colors.black.withValues(alpha: fade),
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _toggle,
        onVerticalDragUpdate: (d) =>
            setState(() => _drag = (_drag + d.delta.dy).clamp(0, 600)),
        onVerticalDragEnd: (d) {
          if (_drag > 120 || (d.primaryVelocity ?? 0) > 700) {
            Navigator.of(context).maybePop();
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
              if (v.isInitialized && !v.isPlaying)
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
    );
  }
}
