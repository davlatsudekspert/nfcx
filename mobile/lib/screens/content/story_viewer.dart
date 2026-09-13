import 'dart:async';
import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/buttons.dart';
import '../../design/components/media.dart';
import '../../design/components/states.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';

/// STORY KO'RUVCHI.
///
/// Handoff xatti-harakati:
///   - yuqorida segmentli progress, har rasmga 5 soniya;
///   - o'ngga tegish — oldinga, chapga — orqaga;
///   - UZOQ BOSISH — pauza (o'qish uchun);
///   - pastga surish — yopish.
class StoryViewerScreen extends StatefulWidget {
  const StoryViewerScreen({super.key, required this.code, this.isCompany = false});

  final String code;
  final bool isCompany;

  @override
  State<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends State<StoryViewerScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progress = AnimationController(
    vsync: this,
    duration: M.storySegment,
  )..addStatusListener((s) {
      if (s == AnimationStatus.completed) _next();
    });

  List<Post> _stories = const [];
  int _index = 0;
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = AppScope.read(context).repo;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = widget.isCompany
          ? await repo.companyStories(widget.code)
          : await repo.recordStories(widget.code);
      if (!mounted) return;
      setState(() {
        _stories = list;
        _loading = false;
      });
      if (list.isNotEmpty) _progress.forward(from: 0);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  void _next() {
    if (_index >= _stories.length - 1) {
      Navigator.of(context).maybePop();
      return;
    }
    setState(() => _index++);
    _progress.forward(from: 0);
  }

  void _prev() {
    if (_index == 0) {
      _progress.forward(from: 0);
      return;
    }
    setState(() => _index--);
    _progress.forward(from: 0);
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: C.backdrop,
        body: Center(child: Spinner()),
      );
    }
    if (_error != null || _stories.isEmpty) {
      return Scaffold(
        backgroundColor: C.backdrop,
        body: SafeArea(
          child: Center(
            child: _error != null
                ? ErrorState(humanError(_error), onRetry: _load)
                : const EmptyState(
                    'Story 24 soat turadi va keyin o‘zi o‘chadi.',
                    title: 'Story yo‘q',
                    icon: Ico.camera,
                  ),
          ),
        ),
      );
    }

    final story = _stories[_index];
    return Scaffold(
      backgroundColor: C.backdrop,
      body: GestureDetector(
        onTapUp: (d) {
          final w = MediaQuery.sizeOf(context).width;
          if (d.localPosition.dx < w * .32) {
            _prev();
          } else {
            _next();
          }
        },
        onLongPressStart: (_) => _progress.stop(),
        onLongPressEnd: (_) => _progress.forward(),
        onVerticalDragEnd: (d) {
          if ((d.primaryVelocity ?? 0) > 220) Navigator.of(context).maybePop();
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Story — to'liq ekran, shuning uchun chegara ekran eni
            // bo'yicha (NetImage ichidagi standart) qoladi: bundan
            // kattaroq dekodlash ko'zga ko'rinmaydi, lekin xotirani
            // yeydi.
            NetImage(
              story.images.isEmpty ? null : story.images.first,
              radius: 0,
              fit: BoxFit.contain,
              slotLabel: 'STORY MEDIA 9:16',
            ),
            // Yuqori va pastki qorong'i gradient — oq matn har qanday
            // rasm ustida o'qiladi.
            const Positioned(
              top: 0, left: 0, right: 0, height: 160,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter, end: Alignment.bottomCenter,
                    colors: [Color(0xB3000000), Color(0x00000000)],
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.x12, vertical: S.x8),
                    child: Row(
                      children: [
                        for (var i = 0; i < _stories.length; i++) ...[
                          if (i > 0) const SizedBox(width: 3),
                          Expanded(
                            child: SizedBox(
                              height: 2.5,
                              child: AnimatedBuilder(
                                animation: _progress,
                                builder: (_, __) => _Segment(
                                  fill: i < _index ? 1 : (i == _index ? _progress.value : 0),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.x16, vertical: S.x8),
                    child: Row(
                      children: [
                        Avatar(url: story.authorAvatar, name: story.authorName, size: 32),
                        const SizedBox(width: S.x8),
                        Expanded(
                          child: Text(
                            story.authorName.isEmpty ? widget.code : story.authorName,
                            style: T.cardTitle.copyWith(fontSize: 13),
                          ),
                        ),
                        GestureDetector(
                          onTap: () => Navigator.of(context).maybePop(),
                          behavior: HitTestBehavior.opaque,
                          child: const Padding(
                            padding: EdgeInsets.all(6),
                            child: NIcon(Ico.close, size: 18, color: C.offWhite),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  if (story.caption.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x20),
                      child: Text(
                        story.caption,
                        style: T.body.copyWith(color: C.offWhite),
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

class _Segment extends StatelessWidget {
  const _Segment({required this.fill});
  final double fill;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: Stack(
          children: [
            const Positioned.fill(child: ColoredBox(color: Color(0x4DFFFFFF))),
            FractionallySizedBox(
              widthFactor: fill.clamp(0.0, 1.0),
              child: const ColoredBox(color: C.offWhite),
            ),
          ],
        ),
      );
}
