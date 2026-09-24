import 'package:flutter/material.dart';

import '../../design/theme/typography.dart';
import 'media_frame.dart' show mediaImage;

/// RASMNI KATTALASHTIRIB KO'RISH (egasi, 2026-09-24: "tovarni
/// ochganda rasmni ko'rish yo'q, bosganda kattalashtirish bo'lsin").
///
/// * ikki barmoq bilan — 4 baravargacha kattalashadi;
/// * ikki marta bosish — bosilgan joyga yaqinlashadi / qaytadi;
/// * bir nechta rasm bo'lsa — yon tomonga suriladi;
/// * pastga surish yoki "orqaga" — yopiladi.
///
/// Rasm kesilmaydi (`contain`) va ekranga mos sifatda ochiladi.
Future<void> openImageViewer(
  BuildContext context,
  List<String> urls, {
  int initial = 0,
}) {
  final list = urls.where((u) => u.isNotEmpty).toList();
  if (list.isEmpty) return Future.value();
  return Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder<void>(
      opaque: false,
      transitionDuration: const Duration(milliseconds: 200),
      reverseTransitionDuration: const Duration(milliseconds: 160),
      pageBuilder: (_, __, ___) => ImageViewer(
        urls: list,
        initial: initial.clamp(0, list.length - 1),
      ),
      transitionsBuilder: (_, a, __, child) =>
          FadeTransition(opacity: a, child: child),
    ),
  );
}

class ImageViewer extends StatefulWidget {
  const ImageViewer({super.key, required this.urls, this.initial = 0});

  final List<String> urls;
  final int initial;

  @override
  State<ImageViewer> createState() => _ImageViewerState();
}

class _ImageViewerState extends State<ImageViewer> {
  late final PageController _pages = PageController(initialPage: widget.initial);
  late int _index = widget.initial;

  /// Joriy rasm kattalashtirilganmi — shunda sahifalash va pastga surib
  /// yopish o'chadi, barmoq rasmni suradi.
  bool _zoomed = false;
  double _drag = 0;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final many = widget.urls.length > 1;
    final fade = (1 - _drag / 400).clamp(.35, 1.0);
    return Scaffold(
      key: const ValueKey('image-viewer'),
      backgroundColor: Colors.black.withValues(alpha: fade),
      body: GestureDetector(
        // Kattalashtirilganda surish rasmga tegishli.
        onVerticalDragUpdate: _zoomed
            ? null
            : (d) => setState(() => _drag = (_drag + d.delta.dy).clamp(0, 600)),
        onVerticalDragEnd: _zoomed
            ? null
            : (d) {
                if (_drag > 110 || (d.primaryVelocity ?? 0) > 700) {
                  Navigator.of(context).maybePop();
                } else {
                  setState(() => _drag = 0);
                }
              },
        child: Stack(
          fit: StackFit.expand,
          children: [
            Transform.translate(
              offset: Offset(0, _drag),
              child: PageView.builder(
                key: const ValueKey('image-viewer-pages'),
                controller: _pages,
                physics: _zoomed
                    ? const NeverScrollableScrollPhysics()
                    : const PageScrollPhysics(),
                itemCount: widget.urls.length,
                onPageChanged: (i) => setState(() {
                  _index = i;
                  _zoomed = false;
                }),
                itemBuilder: (_, i) => _ZoomImage(
                  key: ValueKey('zoom-$i'),
                  url: widget.urls[i],
                  onZoom: (z) {
                    if (i == _index && z != _zoomed) setState(() => _zoomed = z);
                  },
                ),
              ),
            ),
            // Yagona boshqaruv — yopish va sahifa raqami, nozik, TEPADA.
            Positioned(
              left: 0,
              right: 0,
              top: 0,
              child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(
                  children: [
                    IconButton(
                      key: const ValueKey('image-viewer-close'),
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.close_rounded,
                          color: Colors.white, size: 26),
                      tooltip: MaterialLocalizations.of(context)
                          .closeButtonTooltip,
                    ),
                    const Spacer(),
                    if (many)
                      Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: Text(
                          '${_index + 1} / ${widget.urls.length}',
                          style: const TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ZoomImage extends StatefulWidget {
  const _ZoomImage({super.key, required this.url, required this.onZoom});

  final String url;
  final ValueChanged<bool> onZoom;

  @override
  State<_ZoomImage> createState() => _ZoomImageState();
}

class _ZoomImageState extends State<_ZoomImage>
    with SingleTickerProviderStateMixin {
  final _tc = TransformationController();
  late final AnimationController _anim = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 220),
  );
  Animation<Matrix4>? _tween;
  Offset _tapAt = Offset.zero;

  @override
  void initState() {
    super.initState();
    _anim.addListener(() {
      final t = _tween;
      if (t != null) _tc.value = t.value;
    });
    _tc.addListener(_report);
  }

  bool _last = false;

  void _report() {
    final z = _tc.value.getMaxScaleOnAxis() > 1.01;
    if (z != _last) {
      setState(() => _last = z);
      widget.onZoom(z);
    }
  }

  @override
  void dispose() {
    _tc.removeListener(_report);
    _anim.dispose();
    _tc.dispose();
    super.dispose();
  }

  void _doubleTap() {
    final zoomed = _tc.value.getMaxScaleOnAxis() > 1.01;
    final Matrix4 end;
    if (zoomed) {
      end = Matrix4.identity();
    } else {
      const s = 2.5;
      final p = _tapAt;
      end = Matrix4.identity()
        ..translateByDouble(-p.dx * (s - 1), -p.dy * (s - 1), 0, 1)
        ..scaleByDouble(s, s, 1, 1);
    }
    _tween = Matrix4Tween(begin: _tc.value, end: end)
        .animate(CurvedAnimation(parent: _anim, curve: Curves.easeOutCubic));
    _anim.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onDoubleTapDown: (d) => _tapAt = d.localPosition,
      onDoubleTap: _doubleTap,
      child: InteractiveViewer(
        transformationController: _tc,
        minScale: 1,
        maxScale: 4,
        // Kattalashtirilmaganda bitta barmoq bilan surish sahifaga va
        // yopishga qoladi.
        panEnabled: _last,
        child: SizedBox.expand(
          child: mediaImage(context, widget.url, fit: BoxFit.contain),
        ),
      ),
    );
  }
}
