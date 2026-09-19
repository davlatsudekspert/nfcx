import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import '../profile/music_player.dart';

final reelsProvider = FutureProvider.autoDispose<List<Post>>((ref) async {
  final res = await ref.watch(socialRepositoryProvider).feed();
  return res.when(
    ok: (items) => items.where((p) => p.isVideo && p.mediaUrls.isNotEmpty).toList(),
    err: (e) => throw e,
  );
});

/// Vertikal Reels lentasi.
///
/// XOTIRA BOSHQARUVI: bir vaqtda FAQAT ko'rinib turgan video
/// yaratiladi va o'ynaydi. Qo'shni sahifalar `PageView` tomonidan
/// qurilsa ham, ularning kontrolleri `visible: false` bo'lgani uchun
/// hech narsa yuklamaydi. Shusiz o'nta 1080p video RAM'ni to'ldirib,
/// ilova o'lardi.
class ReelsScreen extends ConsumerStatefulWidget {
  const ReelsScreen({super.key});

  @override
  ConsumerState<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends ConsumerState<ReelsScreen> {
  final _page = PageController();
  int _index = 0;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final reels = ref.watch(reelsProvider);

    return Scaffold(
      backgroundColor: t.bg2,
      extendBody: true,
      body: reels.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: t.accent2, strokeWidth: 2),
        ),
        error: (e, __) => StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () => ref.invalidate(reelsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return Stack(
              children: [
                StatePanel(
                  icon: Icons.videocam_off_rounded,
                  title: l.reelsEmpty,
                  message: l.stateEmptyHint,
                  actionLabel: l.reelCreate,
                  onAction: () => context.push(Routes.reelCreate),
                ),
                _TopBar(onCreate: () => context.push(Routes.reelCreate)),
              ],
            );
          }
          return Stack(
            children: [
              PageView.builder(
                controller: _page,
                scrollDirection: Axis.vertical,
                itemCount: items.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) => _ReelPage(
                  post: items[i],
                  visible: i == _index,
                ),
              ),
              _TopBar(onCreate: () => context.push(Routes.reelCreate)),
            ],
          );
        },
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onCreate});
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.sm),
        child: Row(
          children: [
            Text(
              l.navReels,
              style: AppType.displayStyle(
                color: Colors.white,
                size: 25,
                shadows: const [Shadow(color: Colors.black54, blurRadius: 12)],
              ),
            ),
            const Spacer(),
            NovaIconButton(
              icon: Icons.add_rounded,
              tooltip: l.reelCreate,
              onPressed: onCreate,
              filled: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _ReelPage extends ConsumerStatefulWidget {
  const _ReelPage({required this.post, required this.visible});

  final Post post;
  final bool visible;

  @override
  ConsumerState<_ReelPage> createState() => _ReelPageState();
}

class _ReelPageState extends ConsumerState<_ReelPage> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _failed = false;
  bool _liked = false;
  int _likes = 0;

  @override
  void initState() {
    super.initState();
    _liked = widget.post.liked;
    _likes = widget.post.likes;
    if (widget.visible) _open();
  }

  @override
  void didUpdateWidget(covariant _ReelPage old) {
    super.didUpdateWidget(old);
    if (widget.visible && !old.visible) {
      _open();
    } else if (!widget.visible && old.visible) {
      _close();
    }
  }

  Future<void> _open() async {
    // Video ovoz chiqaradi — ya'ni u audio EGASI bo'ladi. Shu
    // paytda profil musiqasi ijro etilayotgan bo'lsa, u to'xtaydi:
    // ikki manba bir vaqtda ovoz chiqarmaydi.
    ref.read(audioOwnerProvider.notifier).take(this, _pauseForOther);

    if (_controller != null) {
      await _controller!.play();
      return;
    }
    final url = widget.post.mediaUrls.first;
    final c = VideoPlayerController.networkUrl(Uri.parse(url));
    _controller = c;
    try {
      await c.initialize();
      if (!mounted) return;
      await c.setLooping(true);
      await c.play();
      setState(() => _ready = true);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  /// Boshqa audio egalik olganda — videoni to'xtatamiz.
  void _pauseForOther() {
    _controller?.pause();
    if (mounted) setState(() {});
  }

  Future<void> _close() async {
    // Kontroller YO'Q QILINADI, faqat to'xtatilmaydi: to'xtatilgan
    // video ham dekoder va bufer xotirasini ushlab turadi.
    final c = _controller;
    _controller = null;
    _ready = false;
    await c?.pause();
    await c?.dispose();
    ref.read(audioOwnerProvider.notifier).release(this);
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _controller?.dispose();
    ref.read(audioOwnerProvider.notifier).release(this);
    super.dispose();
  }

  Future<void> _like() async {
    // Optimistik yangilanish: bosilgan zahoti raqam o'zgaradi. Xato
    // bo'lsa eski holatga qaytariladi.
    setState(() {
      _liked = !_liked;
      _likes += _liked ? 1 : -1;
    });
    final res = await ref.read(socialRepositoryProvider).like(widget.post.id);
    if (!mounted) return;
    res.when(
      ok: (_) {},
      err: (_) => setState(() {
        _liked = !_liked;
        _likes += _liked ? 1 : -1;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final p = widget.post;

    return GestureDetector(
      onTap: () {
        final c = _controller;
        if (c == null) return;
        setState(() => c.value.isPlaying ? c.pause() : c.play());
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: t.bg2),
          if (_ready && _controller != null)
            FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: _controller!.value.size.width,
                height: _controller!.value.size.height,
                child: VideoPlayer(_controller!),
              ),
            )
          else if (_failed)
            Center(
              child: Icon(Icons.videocam_off_rounded, size: 40, color: t.text3),
            )
          else
            Center(
              child: CircularProgressIndicator(color: t.accent2, strokeWidth: 2),
            ),
          // Pastdagi matn o'qilishi uchun gradient — videoning rangidan
          // qat'i nazar kontrast saqlanadi.
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.center,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black.withValues(alpha: .72)],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            right: Gap.md,
            bottom: 150,
            child: Column(
              children: [
                _Action(
                  icon: _liked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  label: formatCount(_likes),
                  tint: _liked ? t.error : Colors.white,
                  onTap: _like,
                ),
                const SizedBox(height: Gap.xl),
                _Action(
                  icon: Icons.mode_comment_outlined,
                  label: formatCount(p.comments),
                  onTap: () => context.push(Routes.post(p.id, code: p.code)),
                ),
                const SizedBox(height: Gap.xl),
                _Action(
                  icon: Icons.ios_share_rounded,
                  label: l.actionShare,
                  onTap: () => context.push(Routes.post(p.id, code: p.code)),
                ),
              ],
            ),
          ),
          Positioned(
            left: Gap.lg,
            right: 80,
            bottom: 120,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                PressableScale(
                  onTap: p.code.isEmpty ? null : () => context.push(Routes.user(p.code)),
                  child: Row(
                    children: [
                      Avatar(
                        url: p.authorAvatar,
                        initials: p.authorName.isEmpty
                            ? 'N'
                            : p.authorName.substring(0, 1).toUpperCase(),
                        size: 40,
                      ),
                      const SizedBox(width: Gap.sm),
                      Flexible(
                        child: Text(
                          p.authorName.isEmpty ? p.code : p.authorName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (p.code.isNotEmpty) ...[
                  const SizedBox(height: Gap.sm),
                  // NFC ID — Reels ham identity tizimining bir qismi
                  // ekanini ko'rsatadi; bu TikTok'da yo'q bog'lanish.
                  PressableScale(
                    onTap: () => context.push(Routes.user(p.code)),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .16),
                        borderRadius: R.pill,
                        border: Border.all(color: Colors.white.withValues(alpha: .3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.nfc_rounded, size: 13, color: Colors.white),
                          const SizedBox(width: 5),
                          Text(
                            p.code,
                            style: AppType.monoStyle(
                                color: Colors.white, size: 11, letterSpacing: 1.2),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                if (p.text.isNotEmpty) ...[
                  const SizedBox(height: Gap.sm),
                  Text(
                    p.text,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      height: 1.35,
                      color: Colors.white,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
    required this.icon,
    required this.label,
    this.tint = Colors.white,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Color tint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => PressableScale(
        onTap: onTap,
        child: Column(
          children: [
            Icon(icon, size: 28, color: tint, shadows: const [
              Shadow(color: Colors.black54, blurRadius: 10),
            ]),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                fontFamily: AppType.sans,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                shadows: [Shadow(color: Colors.black54, blurRadius: 10)],
              ),
            ),
          ],
        ),
      );
}
