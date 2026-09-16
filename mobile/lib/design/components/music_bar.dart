import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

import '../../l10n/strings.dart';
import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'press.dart';
import 'surface.dart';

/// PROFIL MUSIQASI (prototip: "Yulduzlar ostida · Profil musiqasi · 1/3").
///
/// NIMA UCHUN BOR: karta egasi o'z profiliga qo'shiq qo'ya oladi —
/// bu serverda allaqachon bor (`musicUrls`, 5 tagacha), lekin
/// ilovada umuman ko'rsatilmasdi. Ya'ni odam saytda qo'shiq
/// qo'yardi, ilovada esa u yo'qolib qolardi.
///
/// NIMA UCHUN `video_player`: ilovada allaqachon shu paket bor
/// (Reels uchun) va u audio havolani ham ijro etadi. Alohida audio
/// kutubxona APK ni bekorga kattalashtirardi.
///
/// O'ZI BOSHLANMAYDI. Profil ochilishi bilan qo'shiq yangrashi —
/// odamni cho'chitadigan xatti-harakat: u jamoat joyida yoki
/// yig'ilishda bo'lishi mumkin. Shuning uchun faqat BOSILGANDA.
class MusicBar extends StatefulWidget {
  const MusicBar({super.key, required this.urls, this.title = ''});

  /// Qo'shiq havolalari — 1 dan 5 tagacha.
  final List<String> urls;

  /// Profil egasining ismi — qo'shiq nomi noma'lum bo'lganda
  /// sarlavha sifatida ishlatiladi.
  final String title;

  @override
  State<MusicBar> createState() => _MusicBarState();
}

class _MusicBarState extends State<MusicBar> {
  VideoPlayerController? _c;
  int _index = 0;
  bool _playing = false;
  bool _busy = false;

  @override
  void dispose() {
    _c?.removeListener(_onTick);
    _c?.dispose();
    super.dispose();
  }

  void _onTick() {
    final c = _c;
    if (c == null || !mounted) return;
    final playing = c.value.isPlaying;
    if (playing != _playing) setState(() => _playing = playing);

    // Qo'shiq tugadi — keyingisiga o'tadi (ro'yxat aylanadi).
    if (c.value.isInitialized &&
        !playing &&
        c.value.position >= c.value.duration &&
        c.value.duration > Duration.zero) {
      _skip();
    }
  }

  Future<void> _load(int i) async {
    final old = _c;
    old?.removeListener(_onTick);
    setState(() {
      _c = null;
      _playing = false;
      _index = i;
    });
    await old?.dispose();

    final c = VideoPlayerController.networkUrl(Uri.parse(widget.urls[i]));
    try {
      await c.initialize();
    } catch (_) {
      // Havola buzilgan bo'lsa jimgina to'xtaydi: profilni ochgan
      // odamga texnik xato ko'rsatishdan ma'no yo'q.
      await c.dispose();
      return;
    }
    if (!mounted) {
      await c.dispose();
      return;
    }
    c.addListener(_onTick);
    setState(() => _c = c);
    await c.play();
  }

  Future<void> _toggle() async {
    if (_busy) return;
    _busy = true;
    try {
      final c = _c;
      if (c == null) {
        await _load(_index);
      } else if (c.value.isPlaying) {
        await c.pause();
      } else {
        await c.play();
      }
    } finally {
      _busy = false;
    }
  }

  Future<void> _skip() async {
    if (widget.urls.length < 2) {
      await _c?.seekTo(Duration.zero);
      await _c?.play();
      return;
    }
    await _load((_index + 1) % widget.urls.length);
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.urls.length;
    final c = _c;
    final progress = c != null &&
            c.value.isInitialized &&
            c.value.duration > Duration.zero
        ? c.value.position.inMilliseconds / c.value.duration.inMilliseconds
        : 0.0;

    return Surface(
      padding: const EdgeInsets.all(S.x12),
      onTap: total > 1 ? _skip : null,
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: C.accent.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(R.status),
            ),
            alignment: Alignment.center,
            child: NIcon(Ico.music, size: 19, color: C.accent),
          ),
          const SizedBox(width: S.x12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.title.isEmpty ? tr('Profil musiqasi') : widget.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.cardTitle.copyWith(fontSize: 14),
                ),
                const SizedBox(height: 2),
                Text(
                  total > 1
                      ? '${tr('Profil musiqasi')} · ${_index + 1}/$total'
                      : tr('Profil musiqasi'),
                  style: T.caption.copyWith(fontSize: 12),
                ),
                if (progress > 0) ...[
                  const SizedBox(height: 7),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: SizedBox(
                      height: 3,
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: ColoredBox(color: C.line),
                          ),
                          FractionallySizedBox(
                            widthFactor: progress.clamp(0.0, 1.0),
                            child: ColoredBox(color: C.accent),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: S.x8),
          Press(
            onTap: _toggle,
            haptic: true,
            minSize: S.tap,
            scale: .9,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: C.actionFace,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: NIcon(
                _playing ? Ico.minus : Ico.play,
                size: 17,
                color: C.onAccent,
                filled: !_playing,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
