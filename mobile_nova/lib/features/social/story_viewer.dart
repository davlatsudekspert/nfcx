import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/states.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../home/widgets/avatar.dart';

final storiesOfProvider =
    FutureProvider.autoDispose.family<List<StoryItem>, String>((ref, code) async {
  final res = await ref.watch(socialRepositoryProvider).storiesOf(code);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Story ko'rish oynasi.
///
/// Chap/o'ng yarmiga tegish oldingi/keyingi story'ga o'tkazadi, bosib
/// turish esa taymerni to'xtatadi — bu shakl foydalanuvchiga tanish
/// bo'lgani uchun tanlangan, lekin ramka NFCSTORE vizual tilida:
/// kapsula shaklidagi progress va yumshoq gradient.
class StoryViewerScreen extends ConsumerStatefulWidget {
  const StoryViewerScreen({super.key, required this.code});

  final String code;

  @override
  ConsumerState<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends ConsumerState<StoryViewerScreen>
    with SingleTickerProviderStateMixin {
  static const _perStory = Duration(seconds: 5);

  late final AnimationController _progress = AnimationController(
    vsync: this,
    duration: _perStory,
  )..addStatusListener((s) {
      if (s == AnimationStatus.completed) _next();
    });

  int _index = 0;
  int _total = 0;

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  void _start() {
    _progress
      ..reset()
      ..forward();
  }

  void _next() {
    if (_index + 1 >= _total) {
      if (mounted) context.pop();
      return;
    }
    setState(() => _index++);
    _start();
  }

  void _prev() {
    if (_index == 0) {
      _start();
      return;
    }
    setState(() => _index--);
    _start();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final stories = ref.watch(storiesOfProvider(widget.code));

    return Scaffold(
      backgroundColor: Colors.black,
      body: stories.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: t.accent2, strokeWidth: 2),
        ),
        error: (e, __) => StatePanel.fromError(context, asAppError(e)),
        data: (items) {
          if (items.isEmpty) {
            return StatePanel(
              icon: Icons.auto_stories_outlined,
              title: l.stateEmpty,
              actionLabel: l.actionClose,
              onAction: () => context.pop(),
            );
          }
          if (_total != items.length) {
            _total = items.length;
            WidgetsBinding.instance.addPostFrameCallback((_) => _start());
          }
          final s = items[_index.clamp(0, items.length - 1)];

          return GestureDetector(
            onTapUp: (d) {
              final half = MediaQuery.sizeOf(context).width / 2;
              d.localPosition.dx < half ? _prev() : _next();
            },
            onLongPressStart: (_) => _progress.stop(),
            onLongPressEnd: (_) => _progress.forward(),
            onVerticalDragEnd: (d) {
              if ((d.primaryVelocity ?? 0) > 260) context.pop();
            },
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (s.mediaUrl.isEmpty)
                  DecoratedBox(
                    decoration: BoxDecoration(gradient: t.accentGradient),
                  )
                else
                  CachedNetworkImage(
                    imageUrl: s.mediaUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => ColoredBox(color: t.bg2),
                    errorWidget: (_, __, ___) => ColoredBox(color: t.bg2),
                  ),
                Positioned.fill(
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.center,
                          colors: [
                            Colors.black.withValues(alpha: .55),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                SafeArea(
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: Gap.md, vertical: Gap.sm),
                        child: Row(
                          children: [
                            for (var i = 0; i < items.length; i++)
                              Expanded(
                                child: Padding(
                                  padding: EdgeInsets.only(
                                      right: i == items.length - 1 ? 0 : 4),
                                  child: ClipRRect(
                                    borderRadius: R.pill,
                                    child: AnimatedBuilder(
                                      animation: _progress,
                                      builder: (_, __) => LinearProgressIndicator(
                                        value: i < _index
                                            ? 1
                                            : i == _index
                                                ? _progress.value
                                                : 0,
                                        minHeight: 2.5,
                                        backgroundColor:
                                            Colors.white.withValues(alpha: .3),
                                        valueColor: const AlwaysStoppedAnimation(
                                            Colors.white),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      Padding(
                        padding:
                            const EdgeInsets.symmetric(horizontal: Gap.lg),
                        child: Row(
                          children: [
                            Avatar(
                              url: s.authorAvatar,
                              initials: _initials(s.authorName, s.code),
                              size: 38,
                              onTap: () => context.push(Routes.user(s.code)),
                            ),
                            const SizedBox(width: Gap.sm),
                            Expanded(
                              child: Text(
                                s.authorName.isEmpty ? s.code : s.authorName,
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
                            IconButton(
                              onPressed: () => context.pop(),
                              icon: const Icon(Icons.close_rounded,
                                  color: Colors.white),
                              tooltip: l.actionClose,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _initials(String name, String fallback) {
    final s = name.trim().isEmpty ? fallback : name.trim();
    return (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
  }
}
