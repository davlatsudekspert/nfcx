import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

import '../tokens.dart';
import '../type.dart';
import 'buttons.dart';
import 'media.dart';
import '../../l10n/strings.dart';

/// VIDEO — istorya, post va Reels uchun.
///
/// NIMA UCHUN QO'SHILDI: server 2026-09 dan beri `videoUrl` ni
/// qaytaradi (istorya ham, post ham video bo'lishi mumkin), ilovada
/// esa video pleyer UMUMAN YO'Q edi. Natijada video istorya QORA
/// EKRAN bo'lib ochilardi: model `videoUrl` ni o'qirdi, lekin uni
/// chizadigan widget yo'q edi va ekran `imageUrl` ni (bo'sh satrni)
/// ko'rsatishga urinardi.
///
/// XULQ: o'zi boshlanadi, takrorlanadi, ovozi bor. Bu istorya uchun
/// odatiy: odam tugma qidirmaydi.
///
/// YIQILSA — QORA EKRAN EMAS. Video ochilmasa (formati
/// qo'llab-quvvatlanmasa, tarmoq uzilsa) muqova rasmi yoki aniq
/// yozuv ko'rsatiladi. Aynan shu holat oldin hech narsa aytmasdan
/// qora ekran berardi.
class VideoView extends StatefulWidget {
  const VideoView({
    super.key,
    required this.url,
    this.poster,
    this.fit = BoxFit.cover,
    this.autoPlay = true,
    this.loop = true,
    this.active = true,
  });

  final String url;

  /// Video ochilguncha (va ochilmasa) ko'rsatiladigan rasm.
  final String? poster;

  final BoxFit fit;
  final bool autoPlay;
  final bool loop;

  /// Kadr HOZIR ko'rinyaptimi. Reels'da `PageView` qo'shni kadrlarni
  /// oldindan quradi — busiz ekranda bitta video turgani holda
  /// ikkitasining ovozi birdan eshitilardi.
  final bool active;

  @override
  State<VideoView> createState() => _VideoViewState();
}

class _VideoViewState extends State<VideoView> {
  VideoPlayerController? _c;
  bool _ready = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _open();
  }

  @override
  void didUpdateWidget(VideoView old) {
    super.didUpdateWidget(old);
    // Reels'da bitta widget qayta ishlatilishi mumkin — manzil
    // o'zgarsa eski video qolib ketmasin.
    if (old.url != widget.url) {
      _c?.dispose();
      _c = null;
      _ready = false;
      _failed = false;
      _open();
      return;
    }
    if (old.active != widget.active) _sync();
  }

  /// Ko'rinmay qolganda video TO'XTAYDI va boshiga qaytadi: odam
  /// kadrga qaytganda uni o'rtasidan emas, boshidan ko'radi.
  void _sync() {
    final c = _c;
    if (c == null || !_ready) return;
    if (widget.active && widget.autoPlay) {
      c.play();
    } else {
      c.pause();
      c.seekTo(Duration.zero);
    }
  }

  Future<void> _open() async {
    final url = widget.url.trim();
    if (url.isEmpty) {
      setState(() => _failed = true);
      return;
    }
    final c = VideoPlayerController.networkUrl(Uri.parse(url));
    _c = c;
    try {
      await c.initialize();
      if (!mounted) {
        await c.dispose();
        return;
      }
      await c.setLooping(widget.loop);
      if (widget.autoPlay && widget.active) await c.play();
      setState(() => _ready = true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _failed = true);
    }
  }

  @override
  void dispose() {
    _c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;

    if (_failed) {
      // Muqova bo'lsa — u ko'rsatiladi; bo'lmasa aniq yozuv.
      // Ikkalasi ham qora ekrandan yaxshiroq.
      final poster = (widget.poster ?? '').trim();
      if (poster.isNotEmpty) {
        return NetImage(poster, radius: 0, fit: widget.fit, slotLabel: '');
      }
      return ColoredBox(
        color: C.placeholder,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: Text(
              tr('Videoni ochib bo‘lmadi.'),
              textAlign: TextAlign.center,
              style: T.caption,
            ),
          ),
        ),
      );
    }

    if (c == null || !_ready) {
      // Kutish paytida muqova ko'rinadi — ekran bo'sh qolmaydi.
      final poster = (widget.poster ?? '').trim();
      return Stack(
        fit: StackFit.expand,
        children: [
          if (poster.isNotEmpty)
            NetImage(poster, radius: 0, fit: widget.fit, slotLabel: '')
          else
            ColoredBox(color: C.placeholder),
          const Center(child: Spinner(size: 20)),
        ],
      );
    }

    return FittedBox(
      fit: widget.fit,
      clipBehavior: Clip.hardEdge,
      child: SizedBox(
        width: c.value.size.width,
        height: c.value.size.height,
        child: VideoPlayer(c),
      ),
    );
  }
}
