import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../design/tokens/nfc_tokens.dart';
import '../profile/music_player.dart';

/// Ichki video chizuvchi — istorya va post uchun BITTA joyda.
///
/// ## NIMA UCHUN KERAK BO'LDI
///
/// `Post.isVideo` ham, `StoryItem.isVideo` ham model tomonidan
/// TO'G'RI o'qilardi, lekin ekranlarning BIRORTASI ularni
/// ishlatmasdi: hamma narsa `CachedNetworkImage` bilan chizilardi.
///
/// Ya'ni video post ham, video istorya ham QO'YISH mumkin edi
/// (kompozitor `videoUrl` ni qabul qiladi va server saqlaydi), lekin
/// ko'rgan odam faqat siniq rasm belgisini ko'rardi. Hech qanday
/// xato chiqmasdi — `errorWidget` jimgina o'rnini egallardi.
///
/// ## KONTROLLER UMRI
///
/// Kontroller SHU vidjetga bog'langan. Ota-ekranda saqlansa, element
/// almashganda eski video dekoder va bufer xotirasini ushlab
/// qolardi. `ValueKey` bilan Flutter eski holatni tashlaydi, yangisi
/// quriladi, eskisi esa `dispose` da yopiladi.
///
/// ## OVOZ EGALIGI
///
/// Video ovoz chiqaradi, demak u audio EGASI bo'ladi. Shu paytda
/// profil musiqasi ijro etilayotgan bo'lsa — to'xtaydi. Reels'dagi
/// bilan bir xil qoida: ikki manba bir vaqtda ovoz chiqarmaydi.
class InlineVideo extends ConsumerStatefulWidget {
  const InlineVideo({
    super.key,
    required this.url,
    this.autoPlay = true,
    this.looping = false,
    this.onDuration,
    this.tapToToggle = false,
  });

  final String url;
  final bool autoPlay;
  final bool looping;

  /// Uzunlik ma'lum bo'lgach chaqiriladi (istoryada progress shunga
  /// moslanadi).
  final ValueChanged<Duration>? onDuration;

  /// Postda: bosish ijro/pauza. Istoryada bosish keyingisiga
  /// o'tkazadi, shuning uchun u yerda YOQILMAYDI.
  final bool tapToToggle;

  @override
  ConsumerState<InlineVideo> createState() => _InlineVideoState();
}

class _InlineVideoState extends ConsumerState<InlineVideo> {
  VideoPlayerController? _c;
  bool _ready = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _open();
  }

  Future<void> _open() async {
    final c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    _c = c;
    try {
      await c.initialize();
      if (!mounted) {
        await c.dispose();
        return;
      }
      await c.setLooping(widget.looping);
      if (widget.autoPlay) {
        ref.read(audioOwnerProvider.notifier).take(this, _pauseForOther);
        await c.play();
      }
      setState(() => _ready = true);
      widget.onDuration?.call(c.value.duration);
    } catch (_) {
      // Buzuq havola yoki qo'llab-quvvatlanmaydigan format — ilova
      // qulamaydi, o'rnida fon qoladi.
      if (mounted) setState(() => _failed = true);
    }
  }

  void _pauseForOther() {
    _c?.pause();
    if (mounted) setState(() {});
  }

  Future<void> _toggle() async {
    final c = _c;
    if (c == null || !_ready) return;
    if (c.value.isPlaying) {
      await c.pause();
    } else {
      ref.read(audioOwnerProvider.notifier).take(this, _pauseForOther);
      await c.play();
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    final c = _c;
    _c = null;
    ref.read(audioOwnerProvider.notifier).release(this);
    c?.pause();
    c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final c = _c;
    if (_failed) {
      return ColoredBox(
        color: t.surface2,
        child: Icon(Icons.videocam_off_rounded, size: 30, color: t.text3),
      );
    }
    if (!_ready || c == null) {
      return ColoredBox(color: t.surface2);
    }
    final video = FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: c.value.size.width,
        height: c.value.size.height,
        child: VideoPlayer(c),
      ),
    );
    if (!widget.tapToToggle) return video;
    return GestureDetector(
      onTap: _toggle,
      child: Stack(
        fit: StackFit.expand,
        children: [
          video,
          if (!c.value.isPlaying)
            const Center(
              child: Icon(Icons.play_circle_fill_rounded,
                  size: 54, color: Colors.white),
            ),
        ],
      ),
    );
  }
}
