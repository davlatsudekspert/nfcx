import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../ui/widgets.dart';

class StoryViewerScreen extends StatefulWidget {
  const StoryViewerScreen({super.key, required this.bubble});

  final StoryBubble bubble;

  @override
  State<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends State<StoryViewerScreen> {
  late final PageController _pages;
  late List<StoryItem> _stories;
  int _index = 0;
  final Set<int> _viewed = <int>{};

  @override
  void initState() {
    super.initState();
    _pages = PageController();
    _stories = [...widget.bubble.stories];
    WidgetsBinding.instance.addPostFrameCallback((_) => _markViewed(0));
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _markViewed(int index) async {
    if (index < 0 || index >= _stories.length) return;
    final id = _stories[index].id;
    if (!_viewed.add(id)) return;
    try {
      await SessionScope.read(context).repo.viewStory(id);
    } catch (_) {}
  }

  Future<void> _toggleLike() async {
    if (_stories.isEmpty) return;
    final i = _index;
    final before = _stories[i];
    setState(() {
      _stories = [..._stories]
        ..[i] = before.copyWith(
          liked: !before.liked,
          likeCount: (before.likeCount + (before.liked ? -1 : 1))
              .clamp(0, 1 << 30),
        );
    });
    try {
      final r = await SessionScope.read(context).repo.likeStory(before.id);
      if (!mounted || i >= _stories.length) return;
      setState(() {
        _stories = [..._stories]
          ..[i] = _stories[i].copyWith(
            liked: r.liked,
            likeCount: r.count,
          );
      });
    } catch (_) {
      if (mounted && i < _stories.length) {
        setState(() => _stories = [..._stories]..[i] = before);
      }
    }
  }

  void _next() {
    if (_index >= _stories.length - 1) {
      Navigator.of(context).pop();
      return;
    }
    _pages.nextPage(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  void _previous() {
    if (_index <= 0) return;
    _pages.previousPage(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_stories.isEmpty) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: Text(
            'Story topilmadi.',
            style: TextStyle(color: Colors.white),
          ),
        ),
      );
    }

    final current = _stories[_index];

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          PageView.builder(
            controller: _pages,
            itemCount: _stories.length,
            onPageChanged: (value) {
              setState(() => _index = value);
              _markViewed(value);
            },
            itemBuilder: (context, i) => _StoryMedia(
              story: _stories[i],
              active: i == _index,
              onFinished: _next,
            ),
          ),
          const _StoryScrim(),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 18),
              child: Column(
                children: [
                  Row(
                    children: [
                      for (var i = 0; i < _stories.length; i++)
                        Expanded(
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            height: 2.6,
                            margin: EdgeInsets.only(
                              right: i == _stories.length - 1 ? 0 : 4,
                            ),
                            decoration: BoxDecoration(
                              color: i <= _index
                                  ? Colors.white
                                  : Colors.white.withValues(alpha: .28),
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      BrandAvatar(
                        url: widget.bubble.avatarUrl,
                        size: 39,
                        goldRing: true,
                        fallback: widget.bubble.name,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.bubble.name.isEmpty
                                  ? widget.bubble.code
                                  : widget.bubble.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              widget.bubble.code,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: .5),
                                fontFamily: 'IBMPlexMono',
                                fontSize: 8.6,
                                letterSpacing: .6,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(
                          Icons.close_rounded,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  if (current.caption.trim().isNotEmpty)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Padding(
                        padding: const EdgeInsets.only(
                          left: 8,
                          right: 64,
                          bottom: 14,
                        ),
                        child: Text(
                          current.caption.trim(),
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            height: 1.42,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 48,
                          padding: const EdgeInsets.symmetric(horizontal: 15),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: .08),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: .11),
                            ),
                          ),
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'NFCSTORE story',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: .62),
                              fontSize: 10.5,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 9),
                      InkWell(
                        borderRadius: BorderRadius.circular(999),
                        onTap: _toggleLike,
                        child: Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: .08),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white.withValues(alpha: .11),
                            ),
                          ),
                          child: Icon(
                            current.liked
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            color: current.liked
                                ? const Color(0xFFFF5261)
                                : Colors.white,
                            size: 22,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        current.likeCount.toString(),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: .72),
                          fontFamily: 'IBMPlexMono',
                          fontSize: 9,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Positioned.fill(
            top: 88,
            bottom: 88,
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: _previous,
                    child: const SizedBox.expand(),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: _next,
                    child: const SizedBox.expand(),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StoryMedia extends StatefulWidget {
  const _StoryMedia({
    required this.story,
    required this.active,
    required this.onFinished,
  });

  final StoryItem story;
  final bool active;
  final VoidCallback onFinished;

  @override
  State<_StoryMedia> createState() => _StoryMediaState();
}

class _StoryMediaState extends State<_StoryMedia> {
  VideoPlayerController? _video;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  @override
  void didUpdateWidget(covariant _StoryMedia oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.story.videoUrl != widget.story.videoUrl) {
      _video?.dispose();
      _video = null;
      _failed = false;
      _prepare();
      return;
    }
    _sync();
  }

  Future<void> _prepare() async {
    final url = widget.story.videoUrl;
    if ((url ?? '').isEmpty) return;
    final controller = VideoPlayerController.networkUrl(Uri.parse(url!));
    try {
      await controller.initialize();
      controller.setLooping(false);
      controller.addListener(_watchEnd);
      if (!mounted) {
        controller.dispose();
        return;
      }
      setState(() => _video = controller);
      _sync();
    } catch (_) {
      controller.dispose();
      if (mounted) setState(() => _failed = true);
    }
  }

  void _watchEnd() {
    final v = _video?.value;
    if (!widget.active || v == null || !v.isInitialized) return;
    if (v.duration > Duration.zero &&
        v.position >= v.duration - const Duration(milliseconds: 180)) {
      widget.onFinished();
    }
  }

  void _sync() {
    final c = _video;
    if (c == null || !c.value.isInitialized) return;
    if (widget.active) {
      c.play();
    } else {
      c.pause();
    }
  }

  @override
  void dispose() {
    _video?.removeListener(_watchEnd);
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final image = widget.story.imageUrl;
    if ((widget.story.videoUrl ?? '').isNotEmpty) {
      if (_failed) {
        return const Center(
          child: Icon(
            Icons.broken_image_outlined,
            color: Colors.white54,
            size: 40,
          ),
        );
      }
      final c = _video;
      if (c == null || !c.value.isInitialized) {
        return const Center(
          child: CircularProgressIndicator(
            color: Colors.white,
            strokeWidth: 1.7,
          ),
        );
      }
      return Center(
        child: AspectRatio(
          aspectRatio: c.value.aspectRatio == 0 ? 9 / 16 : c.value.aspectRatio,
          child: VideoPlayer(c),
        ),
      );
    }
    if ((image ?? '').isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: image!,
        fit: BoxFit.contain,
        placeholder: (_, __) => const Center(
          child: CircularProgressIndicator(
            color: Colors.white,
            strokeWidth: 1.7,
          ),
        ),
        errorWidget: (_, __, ___) => const Center(
          child: Icon(
            Icons.broken_image_outlined,
            color: Colors.white54,
            size: 40,
          ),
        ),
      );
    }
    return const Center(
      child: Icon(
        Icons.auto_awesome_outlined,
        color: Colors.white54,
        size: 46,
      ),
    );
  }
}

class _StoryScrim extends StatelessWidget {
  const _StoryScrim();

  @override
  Widget build(BuildContext context) => IgnorePointer(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withValues(alpha: .5),
                Colors.transparent,
                Colors.transparent,
                Colors.black.withValues(alpha: .72),
              ],
              stops: const [0, .22, .58, 1],
            ),
          ),
        ),
      );
}
