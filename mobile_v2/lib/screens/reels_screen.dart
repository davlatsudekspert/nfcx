import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import 'profile_screen.dart';

class ReelsScreen extends StatefulWidget {
  const ReelsScreen({super.key});

  @override
  State<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends State<ReelsScreen> {
  final _controller = PageController();
  List<FeedItem> _items = const [];
  bool _loading = true;
  Object? _error;
  int _page = 1;
  bool _hasMore = true;
  bool _loadingMore = false;
  int _index = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loading && _items.isEmpty) _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await SessionScope.read(context).repo.feed(page: 1);
      if (!mounted) return;
      setState(() {
        _items = r.items;
        _page = 1;
        _hasMore = r.hasMore;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    _loadingMore = true;
    try {
      final r = await SessionScope.read(context).repo.feed(page: _page + 1);
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...r.items];
        _page += 1;
        _hasMore = r.hasMore;
      });
    } catch (_) {
    } finally {
      _loadingMore = false;
    }
  }

  Future<void> _toggleLike(int index) async {
    if (index < 0 || index >= _items.length) return;
    final original = _items[index];
    if (!original.likeable) return;

    setState(() {
      _items = [..._items]
        ..[index] = original.copyWith(
          liked: !original.liked,
          likeCount: original.likeCount + (original.liked ? -1 : 1),
        );
    });

    try {
      final repo = SessionScope.read(context).repo;
      final result = original.isStory
          ? await repo.likeStory(original.id)
          : await repo.likePost(original.id);
      if (!mounted) return;
      setState(() {
        final current = _items[index];
        _items = [..._items]
          ..[index] = current.copyWith(
            liked: result.liked,
            likeCount: result.count,
          );
      });
    } catch (_) {
      if (mounted) {
        setState(() => _items = [..._items]..[index] = original);
      }
    }
  }

  Future<void> _share(FeedItem item) async {
    final path = item.code.toLowerCase();
    await Share.share('https://nfcstore.uz/' + path);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    if (_loading && _items.isEmpty) {
      return Scaffold(
        body: Center(child: CircularProgressIndicator(strokeWidth: 1.8, color: p.accent)),
      );
    }

    if (_error != null && _items.isEmpty) {
      return Scaffold(
        body: Center(
          child: OutlinedButton(onPressed: _load, child: const Text('Qayta urinish')),
        ),
      );
    }

    if (_items.isEmpty) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Text('Reels hozircha bo‘sh.', style: Theme.of(context).textTheme.bodyMedium),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: PageView.builder(
        controller: _controller,
        scrollDirection: Axis.vertical,
        itemCount: _items.length,
        onPageChanged: (value) {
          setState(() => _index = value);
          if (value >= _items.length - 2) _loadMore();
        },
        itemBuilder: (context, i) {
          final item = _items[i];
          return Stack(
            fit: StackFit.expand,
            children: [
              _ReelMedia(item: item, active: i == _index),
              const _ReelScrim(),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 14, 90),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const Wordmark(compact: true),
                          const Spacer(),
                          RoundIcon(icon: Icons.add_rounded, size: 42, emphasis: true, onTap: () {}),
                        ],
                      ),
                      const Spacer(),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => ProfileScreen(code: item.code)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      BrandAvatar(
                                        url: item.avatarUrl,
                                        size: 36,
                                        goldRing: true,
                                        fallback: item.name,
                                      ),
                                      const SizedBox(width: 9),
                                      Expanded(
                                        child: Text(
                                          item.name,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13.5,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (item.caption.isNotEmpty) ...[
                                    const SizedBox(height: 10),
                                    Text(
                                      item.caption,
                                      maxLines: 3,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        color: Colors.white.withValues(alpha: .9),
                                        fontSize: 13,
                                        height: 1.35,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 9),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(alpha: .45),
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(color: Colors.white.withValues(alpha: .18)),
                                    ),
                                    child: Text(
                                      item.code,
                                      style: TextStyle(
                                        fontFamily: 'IBMPlexMono',
                                        color: p.heroInk,
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w600,
                                        letterSpacing: .7,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            children: [
                              _SideAction(
                                icon: item.liked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                                label: item.likeCount.toString(),
                                color: item.liked ? const Color(0xFFE85C55) : Colors.white,
                                onTap: item.likeable ? () => _toggleLike(i) : null,
                              ),
                              const SizedBox(height: 16),
                              const _SideAction(
                                icon: Icons.chat_bubble_outline_rounded,
                                label: '',
                                onTap: null,
                              ),
                              const SizedBox(height: 16),
                              _SideAction(
                                icon: Icons.ios_share_rounded,
                                label: 'Ulashish',
                                onTap: () => _share(item),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SideAction extends StatelessWidget {
  const _SideAction({
    required this.icon,
    required this.label,
    this.onTap,
    this.color = Colors.white,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: SizedBox(
          width: 56,
          child: Column(
            children: [
              Icon(icon, color: color, size: 29),
              if (label.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
      );
}

class _ReelScrim extends StatelessWidget {
  const _ReelScrim();

  @override
  Widget build(BuildContext context) => const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0x55000000),
              Color(0x00000000),
              Color(0x22000000),
              Color(0xBB000000),
            ],
            stops: [0, .28, .62, 1],
          ),
        ),
      );
}

class _ReelMedia extends StatefulWidget {
  const _ReelMedia({required this.item, required this.active});
  final FeedItem item;
  final bool active;

  @override
  State<_ReelMedia> createState() => _ReelMediaState();
}

class _ReelMediaState extends State<_ReelMedia> {
  VideoPlayerController? _video;

  @override
  void initState() {
    super.initState();
    _setup();
  }

  @override
  void didUpdateWidget(_ReelMedia oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item.videoUrl != widget.item.videoUrl) {
      _disposeVideo();
      _setup();
    } else {
      _sync();
    }
  }

  Future<void> _setup() async {
    final url = widget.item.videoUrl;
    if ((url ?? '').isEmpty) return;
    final controller = VideoPlayerController.networkUrl(Uri.parse(url!));
    _video = controller;
    try {
      await controller.initialize();
      await controller.setLooping(true);
      if (widget.active) await controller.play();
      if (mounted) setState(() {});
    } catch (_) {}
  }

  Future<void> _sync() async {
    final v = _video;
    if (v == null || !v.value.isInitialized) return;
    if (widget.active) {
      await v.play();
    } else {
      await v.pause();
    }
  }

  void _disposeVideo() {
    _video?.dispose();
    _video = null;
  }

  @override
  void dispose() {
    _disposeVideo();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final v = _video;
    if (v != null && v.value.isInitialized) {
      return FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: v.value.size.width,
          height: v.value.size.height,
          child: VideoPlayer(v),
        ),
      );
    }

    final image = widget.item.imageUrl;
    if ((image ?? '').isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: image!,
        fit: BoxFit.cover,
        errorWidget: (_, __, ___) => const ColoredBox(color: Color(0xFF111111)),
      );
    }

    return const ColoredBox(
      color: Color(0xFF111111),
      child: Center(
        child: Icon(Icons.play_circle_outline_rounded, color: Colors.white54, size: 70),
      ),
    );
  }
}
