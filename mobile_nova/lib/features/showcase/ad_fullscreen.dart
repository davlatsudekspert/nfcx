import 'dart:async';

import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../core/media/audio_session.dart';
import '../../data/models/models.dart' show MusicTrack;
import '../../design/theme/typography.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/id_plate.dart';
import '../../l10n/gen/app_localizations.dart';
import '../profile/music_player.dart';
import '../social/fullscreen_video.dart' show immersiveVideoFit;
import '../social/media_frame.dart' show mediaImage;
import 'ad_video_loader.dart';

/// REKLAMA VIDEOSI — BUTUN EKRAN, OVOZ BILAN (egasi, 2026-10-10:
/// "to'liqroq chiqishi kerak, bosganda ekranga reklamani ustiga ovozli
/// bo'lib").
///
/// Ko'rgazmadagi video reklama sahifasida mediani bosish shu marshrutni
/// ochadi: qora fon, video ekranni to'ldiradi (tik 9:16 — `cover`,
/// yotiq — butun), ustida FAQAT kichik "×" (chap tepada), 🔊/🔇 (o'ng
/// tepada) va pastda BITTA tugma. Reklama roliklarida audio yo'q, shuning
/// uchun postning kutubxona MUSIQASI o'ynaydi (sahifadagi joyidan davom
/// etadi); musiqa bo'lmasa — videoning o'z ovozi.
///
/// Sahifa ochilganda o'zining video/musiqa pleerlarini pauzaga qo'yadi
/// (`_withSheet`), bu yerda esa o'z pleerlari quriladi: bitta kontrollerni
/// ikki joyda chizish iOS'da ishonchsiz. Yopilganda sahifa avvalgidek
/// davom etadi.
///
/// Natija: `true` — pastdagi tugma bosildi (sahifa yopilgach amalni
/// bajaradi), aks holda `null`.
Future<bool?> openAdFullscreenPlayer(
  BuildContext context, {
  required String videoUrl,
  String poster = '',
  MusicTrack? music,
  Duration? musicAt,
  String? ctaLabel,
  IconData? ctaIcon,
}) {
  return Navigator.of(context, rootNavigator: true).push<bool>(
    PageRouteBuilder<bool>(
      opaque: true,
      transitionDuration: const Duration(milliseconds: 200),
      reverseTransitionDuration: const Duration(milliseconds: 160),
      pageBuilder: (_, __, ___) => AdFullscreenPlayer(
        videoUrl: videoUrl,
        poster: poster,
        music: music,
        musicAt: musicAt,
        ctaLabel: ctaLabel,
        ctaIcon: ctaIcon,
      ),
      transitionsBuilder: (_, a, __, child) =>
          FadeTransition(opacity: a, child: child),
    ),
  );
}

class AdFullscreenPlayer extends ConsumerStatefulWidget {
  const AdFullscreenPlayer({
    super.key,
    required this.videoUrl,
    this.poster = '',
    this.music,
    this.musicAt,
    this.ctaLabel,
    this.ctaIcon,
  });

  final String videoUrl;
  final String poster;
  final MusicTrack? music;

  /// Sahifadagi musiqa pozitsiyasi — shu joydan davom etadi.
  final Duration? musicAt;
  /// Pastdagi YAGONA tugma (yo'q bo'lsa — chizilmaydi).
  final String? ctaLabel;
  final IconData? ctaIcon;

  @override
  ConsumerState<AdFullscreenPlayer> createState() => _AdFullscreenPlayerState();
}

class _AdFullscreenPlayerState extends ConsumerState<AdFullscreenPlayer> {
  VideoPlayerController? _v;
  VideoPlayerController? _m;
  bool _muted = false;
  bool _gone = false;
  late final AudioOwner _owner;

  bool get _hasMusic => (widget.music?.playUrl ?? '').isNotEmpty;

  @override
  void initState() {
    super.initState();
    _owner = ref.read(audioOwnerProvider);
    _start();
  }

  Future<void> _start() async {
    // Boshqa manba (sahifa musiqasi) to'xtaydi; egalik shu sahifada.
    _owner.take(this, _pauseAll);
    unawaited(_startVideo());
    if (_hasMusic) unawaited(_startMusic());
  }

  Future<void> _startVideo() async {
    final c = VideoPlayerController.networkUrl(
      Uri.parse(widget.videoUrl),
      // Musiqa bor: video fokusni olmaydi (Android'da musiqani to'xtatmasin).
      videoPlayerOptions: VideoPlayerOptions(
        mixWithOthers:
            _hasMusic && defaultTargetPlatform == TargetPlatform.android,
      ),
    );
    _v = c;
    try {
      await c.initialize().timeout(const Duration(seconds: 20));
      if (_gone || _v != c) return;
      await c.setLooping(true);
      // Musiqa bor — video ovozsiz; yo'q — o'z ovozi (audio izi bo'lsa).
      await c.setVolume(_hasMusic || _muted ? 0 : 1);
      if (_gone || _v != c) return;
      if (!_hasMusic) await claimPlayback();
      await c.play();
    } catch (_) {
      // Ochilmadi — poster qoladi (sahifa o'zi yopiladi).
    }
    if (mounted) setState(() {});
  }

  Future<void> _startMusic() async {
    final track = widget.music!;
    final m = VideoPlayerController.networkUrl(
      Uri.parse(track.playUrl),
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: false),
    );
    _m = m;
    try {
      await m.initialize().timeout(const Duration(seconds: 20));
      if (_gone || _m != m) return;
      await m.setLooping(true);
      final at = widget.musicAt ?? track.playFrom;
      if (at > Duration.zero) await m.seekTo(at);
      await m.setVolume(_muted ? 0 : 1);
      if (_gone || _m != m) return;
      await claimPlayback();
      if (_gone || _m != m) return;
      await m.play();
    } catch (_) {
      // Musiqa ochilmadi — video jim o'ynayveradi.
    }
    if (mounted) setState(() {});
  }

  /// Boshqa manba ovozni oldi.
  void _pauseAll() {
    _m?.pause();
    _v?.pause();
  }

  void _toggleMute() {
    setState(() => _muted = !_muted);
    final vol = _muted ? 0.0 : 1.0;
    if (_hasMusic) {
      _m?.setVolume(vol);
    } else {
      _v?.setVolume(vol);
    }
  }

  @override
  void dispose() {
    _gone = true;
    final v = _v;
    final m = _m;
    _v = null;
    _m = null;
    for (final c in [m, v]) {
      c?.setVolume(0);
      c?.pause().catchError((_) {});
      c?.dispose();
    }
    _owner.release(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final c = _v;
    final ready = c != null && c.value.isInitialized;
    final size = MediaQuery.sizeOf(context);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        key: const ValueKey('ad-fullscreen'),
        backgroundColor: Colors.black,
        body: Stack(
          fit: StackFit.expand,
          children: [
            if (ready)
              Center(
                child: FittedBox(
                  fit: immersiveVideoFit(c.value.size, size),
                  clipBehavior: Clip.hardEdge,
                  child: SizedBox(
                    width: c.value.size.width,
                    height: c.value.size.height,
                    child: VideoPlayer(
                      c,
                      key: const ValueKey('ad-fullscreen-player'),
                    ),
                  ),
                ),
              ),
            // Poster ilk kadr chizilguncha (pozitsiya > 0).
            if (widget.poster.isNotEmpty)
              PosterUntilPlaying(
                key: const ValueKey('ad-fullscreen-poster'),
                controller: ready ? c : null,
                child: Center(
                  child: mediaImage(context, widget.poster,
                      fit: immersiveVideoFit(const Size(9, 16), size)),
                ),
              ),
            AdVideoSpinner(
              key: const ValueKey('ad-fullscreen-loading'),
              loading: c == null || !c.value.isInitialized,
              controller: ready ? c : null,
            ),
            SafeArea(
              child: Stack(
                children: [
                  Positioned(
                    left: 6,
                    top: 6,
                    child: _RoundButton(
                      key: const ValueKey('ad-fullscreen-close'),
                      icon: Icons.close_rounded,
                      tooltip: l.actionClose,
                      onTap: () => Navigator.of(context).maybePop(),
                    ),
                  ),
                  Positioned(
                    right: 6,
                    top: 6,
                    child: _RoundButton(
                      key: const ValueKey('ad-fullscreen-mute'),
                      icon: _muted
                          ? Icons.volume_off_rounded
                          : Icons.volume_up_rounded,
                      tooltip: _muted ? l.showcaseAdUnmute : l.showcaseAdMute,
                      onTap: _toggleMute,
                    ),
                  ),
                  if (widget.ctaLabel != null)
                    Positioned(
                      left: 24,
                      right: 24,
                      bottom: 20,
                      child: Center(
                        child: _Cta(
                          key: const ValueKey('ad-fullscreen-cta'),
                          icon: widget.ctaIcon ?? Icons.open_in_new_rounded,
                          label: widget.ctaLabel!,
                          onTap: () => Navigator.of(context).pop(true),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: tooltip,
    excludeSemantics: true,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        width: 48,
        height: 48,
        child: Center(
          child: Container(
            width: 34,
            height: 34,
            decoration: const BoxDecoration(
              color: Color(0x99000000),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 20, color: Colors.white),
          ),
        ),
      ),
    ),
  );
}

class _Cta extends StatelessWidget {
  const _Cta({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    excludeSemantics: true,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
          decoration: BoxDecoration(color: IdPlate.gold, borderRadius: R.pill),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: Colors.black),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Colors.black,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
