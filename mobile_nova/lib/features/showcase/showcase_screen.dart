import 'dart:async';
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../app/profile_context.dart';
import '../../core/utils/external_link.dart';
import '../../core/utils/result.dart';
import '../../core/utils/sharing.dart';
import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/icons/nova_icons.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/id_plate.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../../routing/shell.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart' show formatCount;
import '../premium/boost_controller.dart' show iapBoostEnabledProvider;
import '../premium/boost_sheet.dart' show showBoostSheet;
import '../profile/music_player.dart';
import '../social/engagement.dart';
import '../social/image_viewer.dart';
import '../social/media_carousel.dart';
import '../social/media_frame.dart' show mediaImage;
import '../social/moderation.dart';
import '../social/music_picker.dart';
import '../social/pending_badge.dart';
import '../social/post_contact_bar.dart';
import '../social/reels_screen.dart'
    show
        ReelAction,
        ReelCaption,
        ReelFollowPill,
        ReelsPager,
        ReelViewsLabel,
        SavedReelsX,
        ViewSession,
        reelsHiddenProvider,
        reelsMutedProvider,
        savedReelsProvider,
        showReelComments;
import 'showcase_common.dart';

/// KO'RGAZMA — pastki menyuning 4-tabi (Reels o'rnida, 2026-10).
///
/// Vertikal sahifalar (`GET /api/showcase`, kursor bilan davomi); har
/// sahifa — 1–5 rasmli gorizontal karusel. Rasm `imageSeconds` dan keyin
/// o'zi almashadi (oxiridan boshiga), ekrandan chiqilganda, boshqa tabda
/// va ilova fonda turganda to'xtaydi. Kutubxona musiqasi — bitta audio
/// egasi orqali, boshqa ilova ovozi bilan aralashmaydi.
///
/// Uchinchi tomon kontenti (YouTube / Instagram) ichida O'YNAMAYDI —
/// faqat tugma, tashqarida ochiladi.

/// Ro'yxat shundan eski bo'lsa, tabga qaytilganda qayta yuklanadi
/// (Reels bilan bir xil qoida).
const kShowcaseStaleAfter = Duration(minutes: 10);

@visibleForTesting
DateTime Function() showcaseClock = DateTime.now;

/// Ko'rgazma davomi (keyingi sahifalar).
final showcasePagerProvider = Provider.autoDispose<ReelsPager>(
  (ref) => ReelsPager(),
);

/// Ko'rgazmada ko'rsatsa bo'ladimi: videosiz va rasmi bor.
bool showcasePlayable(Post p) =>
    !p.isVideo && !p.isStory && p.mediaUrls.isNotEmpty && (p.inShowcase);

/// KO'RGAZMA RO'YXATI — `/api/showcase`.
///
/// Eski server (manzil yo'q yoki xato) — lentadagi rasmli reel va
/// ko'rgazma postlari; u ham bo'lmasa xato paneli.
final showcaseProvider = FutureProvider.autoDispose<List<Post>>((ref) async {
  ref.keepAlive();
  final loadedAt = showcaseClock();
  ref.onResume(() {
    if (showcaseClock().difference(loadedAt) > kShowcaseStaleAfter) {
      ref.invalidateSelf();
    }
  });
  final repo = ref.watch(socialRepositoryProvider);
  // Profil almashsa (boshqa hisob) — boshqa ro'yxat.
  ref.watch(activeProfileProvider.select((p) => p?.code));
  var disposed = false;
  ref.onDispose(() => disposed = true);

  final pager = ref.watch(showcasePagerProvider)..detach();
  final first = await repo.showcasePage();
  final page = first.valueOrNull;
  if (page == null) {
    final feed = await repo.recentFeed();
    return feed.when(
      ok: (items) => items.where(showcasePlayable).toList(),
      err: (e) => throw first.errorOrNull ?? e,
    );
  }

  final seen = <String>{};
  final items = [
    for (final p in page.items)
      if (showcasePlayable(p) && seen.add(likeKey(p))) p,
  ];
  var cursor = page.nextCursor;
  Future<void> more() async {
    final r = await repo.showcasePage(cursor: cursor);
    if (disposed) return;
    final cur = ref.state.valueOrNull;
    if (cur == null) return;
    final next = r.valueOrNull;
    pager.hasMoreFlag = next?.hasMore ?? false;
    cursor = next?.nextCursor;
    final have = {for (final p in cur) likeKey(p)};
    final add = [
      for (final p in next?.items ?? const <Post>[])
        if (showcasePlayable(p) && have.add(likeKey(p))) p,
    ];
    ref.state = AsyncData([...cur, ...add]);
  }

  if (!disposed) pager.attach(more, hasMore: page.hasMore);
  return items;
});

class ShowcaseScreen extends ConsumerStatefulWidget {
  const ShowcaseScreen({super.key});

  @override
  ConsumerState<ShowcaseScreen> createState() => _ShowcaseScreenState();
}

class _ShowcaseScreenState extends ConsumerState<ShowcaseScreen> {
  final _page = PageController();
  int _index = 0;
  DateTime? _loadedAt;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  void _create() => context.push(Routes.showcaseCreate);

  /// Tabga qaytildi — ro'yxat eskirgan bo'lsa yangisi, boshidan.
  void _onEnter() {
    final at = _loadedAt;
    if (at == null || showcaseClock().difference(at) <= kShowcaseStaleAfter) {
      return;
    }
    _loadedAt = null;
    if (_page.hasClients) _page.jumpToPage(0);
    setState(() => _index = 0);
    ref.invalidate(showcaseProvider);
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final onTab = ref.watch(activeTabProvider.select((i) => i == kShowcaseTab));
    ref.listen<bool>(activeTabProvider.select((i) => i == kShowcaseTab), (
      prev,
      next,
    ) {
      if (next && prev == false) _onEnter();
    });
    ref.listen(showcaseProvider, (prev, next) {
      if (next is AsyncData && prev is! AsyncData) {
        _loadedAt = showcaseClock();
      }
    });
    final list = ref.watch(showcaseProvider);
    final pager = ref.watch(showcasePagerProvider);
    final hidden = ref.watch(reelsHiddenProvider);

    return Scaffold(
      backgroundColor: Colors.black,
      extendBody: true,
      body: list.when(
        skipLoadingOnReload: true,
        loading: () => const Center(
          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
        ),
        error: (e, __) => Stack(
          children: [
            StatePanel.fromError(
              context,
              asAppError(e),
              onRetry: () => ref.invalidate(showcaseProvider),
              onDark: true,
            ),
            _TopBar(onCreate: _create),
          ],
        ),
        data: (all) {
          final items = hidden.isEmpty
              ? all
              : all.where((p) => !hidden.contains(likeKey(p))).toList();
          if (items.isEmpty) {
            return Stack(
              children: [
                StatePanel(
                  key: const ValueKey('showcase-empty'),
                  icon: Icons.photo_library_outlined,
                  title: l.showcaseEmpty,
                  message: l.showcaseEmptyHint,
                  actionLabel: l.showcaseCreate,
                  onAction: _create,
                  onDark: true,
                ),
                _TopBar(onCreate: _create),
              ],
            );
          }
          // Element yashirildi / ro'yxat qisqardi — oxirgisiga.
          if (_index >= items.length) {
            final to = items.length - 1;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              if (_page.hasClients) _page.jumpToPage(to);
              setState(() => _index = to);
            });
          }
          return Stack(
            children: [
              PageView.builder(
                key: const ValueKey('showcase-pager'),
                controller: _page,
                scrollDirection: Axis.vertical,
                allowImplicitScrolling: true,
                itemCount: items.length,
                onPageChanged: (i) {
                  setState(() => _index = i);
                  pager.nearEnd(i, items.length);
                },
                itemBuilder: (context, i) => ShowcasePage(
                  key: ValueKey('showcase:${likeKey(items[i])}'),
                  post: items[i],
                  // Ikki shart: shu sahifa ochiq VA Ko'rgazma tabining
                  // o'zi ko'rinyapti (tablar yopilmaydi, berkitiladi).
                  visible: i == _index && onTab,
                ),
              ),
              _TopBar(onCreate: _create),
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
        padding: const EdgeInsets.symmetric(
          horizontal: Gap.lg,
          vertical: Gap.sm,
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                l.navShowcase,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppType.displayStyle(
                  color: Colors.white,
                  size: 24,
                  shadows: const [
                    Shadow(color: Colors.black54, blurRadius: 12),
                  ],
                ),
              ),
            ),
            NovaIconButton(
              key: const ValueKey('showcase-create'),
              icon: Icons.add_rounded,
              tooltip: l.showcaseCreate,
              onPressed: onCreate,
              filled: true,
            ),
          ],
        ),
      ),
    );
  }
}

/// Bitta ko'rgazma sahifasi — karusel, amallar ustuni va izoh.
class ShowcasePage extends ConsumerStatefulWidget {
  const ShowcasePage({super.key, required this.post, required this.visible});

  final Post post;

  /// Ekranda (sahifa ochiq va tab ko'rinyapti).
  final bool visible;

  @override
  ConsumerState<ShowcasePage> createState() => _ShowcasePageState();
}

class _ShowcasePageState extends ConsumerState<ShowcasePage>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  final _carousel = PageController();
  int _image = 0;
  AnimationController? _clock;
  VideoPlayerController? _music;
  bool _musicReady = false;
  late final AudioOwner _owner;

  /// Ustida boshqa ekran yo'q (`TickerMode`).
  bool _onStage = true;

  /// Ilova oldinda.
  bool _foreground = true;

  /// Rasm butun ekranda ochiq — karusel va musiqa to'xtaydi.
  bool _viewerOpen = false;

  bool _captionOpen = false;
  int? _comments;
  int? _views;
  late final ViewSession _viewSession = ViewSession(_sendView);

  Post get _p => widget.post;
  List<String> get _images => _p.mediaUrls;

  bool get _active => widget.visible && _onStage && _foreground && !_viewerOpen;

  @override
  void initState() {
    super.initState();
    _owner = ref.read(audioOwnerProvider);
    WidgetsBinding.instance.addObserver(this);
    final s = WidgetsBinding.instance.lifecycleState;
    _foreground =
        s == null ||
        s == AppLifecycleState.resumed ||
        s == AppLifecycleState.inactive;
    // Audio egaligi va ota holati — kadrdan keyin (build paytida emas).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _sync();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final on = TickerMode.of(context);
    if (on == _onStage) return;
    _onStage = on;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _onStage == on) _sync();
    });
  }

  @override
  void didUpdateWidget(covariant ShowcasePage old) {
    super.didUpdateWidget(old);
    // Kadrdan keyin: audio egaligi boshqa sahifani to'xtatadi va u
    // build paytida `setState` chaqira olmaydi.
    if (old.visible != widget.visible) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _sync();
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final fg =
        state == AppLifecycleState.resumed ||
        state == AppLifecycleState.inactive;
    if (fg == _foreground) return;
    _foreground = fg;
    if (mounted) _sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _viewSession.dispose();
    _clock?.dispose();
    _music?.dispose();
    _carousel.dispose();
    // `ref.read` EMAS: `dispose()` da u istisno otadi.
    _owner.release(this);
    super.dispose();
  }

  // ── KARUSEL SOATI ────────────────────────────────────────────────

  AnimationController get _slideClock => _clock ??= AnimationController(
    vsync: this,
    duration: Duration(seconds: _p.imageSeconds),
  )..addStatusListener(_onClock);

  void _onClock(AnimationStatus s) {
    if (s != AnimationStatus.completed || !mounted || !_active) return;
    final next = (_image + 1) % _images.length;
    if (_carousel.hasClients) {
      _carousel.animateToPage(
        next,
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
      );
    }
    // `onPageChanged` soatni qaytadan boshlaydi.
  }

  void _onImage(int i) {
    setState(() => _image = i);
    if (_images.length > 1 && _active) _slideClock.forward(from: 0);
  }

  // ── HOLAT ────────────────────────────────────────────────────────

  void _sync() {
    _armView();
    if (_active) {
      if (_images.length > 1) {
        final c = _slideClock;
        if (c.isCompleted) c.reset();
        if (!c.isAnimating) c.forward();
      }
      _playMusic();
    } else {
      _clock?.stop();
      if (!widget.visible) {
        _clock?.reset();
        _disposeMusic();
      } else {
        _music?.pause();
      }
      _owner.release(this);
    }
    if (mounted) setState(() {});
  }

  void _armView() =>
      _viewSession.update(onScreen: _active && _p.id > 0 && !_p.isStory);

  Future<void> _sendView() async {
    final res = await ref
        .read(socialRepositoryProvider)
        .recordView(_p.id, company: _p.isCompany);
    if (!mounted) return;
    if (res case Ok(:final value)) setState(() => _views = value);
  }

  void _pauseForOther() {
    _music?.pause();
    if (mounted) setState(() {});
  }

  Future<void> _playMusic() async {
    final m = _p.music;
    if (m == null || m.playUrl.isEmpty) return;
    _owner.take(this, _pauseForOther);
    var c = _music;
    if (c == null) {
      c = VideoPlayerController.networkUrl(
        Uri.parse(m.playUrl),
        // BITTA OVOZ: boshqa ilova (Spotify/YouTube) to'xtaydi.
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: false),
      );
      _music = c;
      try {
        await c.initialize();
        if (!mounted || _music != c) return;
        await c.setLooping(true);
        if (m.playFrom > Duration.zero) await c.seekTo(m.playFrom);
        _musicReady = true;
      } catch (_) {
        // Musiqa ochilmadi — sahifa jim davom etadi.
        return;
      }
    }
    if (!_musicReady || !mounted || _music != c || !_active) return;
    await c.setVolume(ref.read(reelsMutedProvider) ? 0 : 1);
    if (!mounted || _music != c || !_active) return;
    await c.play();
  }

  void _disposeMusic() {
    final m = _music;
    _music = null;
    _musicReady = false;
    if (m != null) {
      m.pause().catchError((_) {});
      m.dispose();
    }
  }

  Future<void> _toggleMute() async {
    final next = !ref.read(reelsMutedProvider);
    ref.read(reelsMutedProvider.notifier).state = next;
    if (_musicReady) await _music?.setVolume(next ? 0 : 1);
    if (mounted) setState(() {});
  }

  // ── AMALLAR ──────────────────────────────────────────────────────

  void _snack(String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _openViewer(int i) async {
    setState(() => _viewerOpen = true);
    _sync();
    await openImageViewer(context, _images, initial: i);
    if (!mounted) return;
    setState(() => _viewerOpen = false);
    _sync();
  }

  Future<void> _like() async {
    final e = await ref.read(postLikesProvider.notifier).toggle(_p);
    if (e != null && mounted) _snack(describeError(L.of(context), e));
  }

  Future<void> _save() async {
    final l = L.of(context);
    final on = await ref.read(savedReelsProvider.notifier).toggleReel(_p);
    if (mounted) _snack(on ? l.reelSavedLocal : l.reelUnsaved);
  }

  Future<void> _openMusic(MusicTrack track) async {
    _music?.pause();
    _clock?.stop();
    await showMusicUseSheet(context, track);
    if (mounted) _sync();
  }

  void _openAuthor() {
    if (_p.code.isEmpty) return;
    context.push(Routes.author(_p.code, company: _p.isCompany));
  }

  void _openProduct(PostCatalogItem item) =>
      context.push(Routes.catalogProduct(item.companyId, item.id));

  void _showMore() {
    final l = L.of(context);
    final p = _p;
    final mine = ref.read(isMineProvider(p.code));
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      showDragHandle: true,
      backgroundColor: context.tokens.surfaceSolid,
      builder: (sheet) => SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              key: const ValueKey('showcase-report'),
              leading: const Icon(Icons.flag_outlined),
              title: Text(l.reportTitle),
              onTap: () {
                Navigator.of(sheet).pop();
                showReportSheet(
                  context,
                  target: p.isCompany
                      ? ReportTarget.companyPost
                      : ReportTarget.post,
                  targetId: '${p.id}',
                  ownerCode: p.code,
                );
              },
            ),
            // KO'TARISH — faqat o'zimniki va mavjud kalit yoqilganda
            // (iPhone + `boostEnabled`), Reels'dagi bilan bir xil.
            if (mine && p.id > 0 && ref.read(iapBoostEnabledProvider))
              ListTile(
                key: const ValueKey('showcase-boost'),
                leading: const Icon(Icons.trending_up_rounded),
                title: Text(l.boostAction),
                onTap: () {
                  Navigator.of(sheet).pop();
                  showBoostSheet(context, ref, p);
                },
              ),
            if (!mine)
              ListTile(
                key: const ValueKey('showcase-not-interested'),
                leading: const Icon(Icons.visibility_off_outlined),
                title: Text(l.reelNotInterested),
                onTap: () {
                  Navigator.of(sheet).pop();
                  _snack(l.reelNotInterestedDone);
                  ref.read(socialRepositoryProvider).hideReel(p).ignore();
                  ref
                      .read(reelsHiddenProvider.notifier)
                      .update((s) => {...s, likeKey(p)});
                },
              ),
            if (!mine && p.code.isNotEmpty)
              ListTile(
                key: const ValueKey('showcase-block'),
                leading: const Icon(Icons.block_rounded),
                title: Text(l.reelBlockAuthor),
                onTap: () async {
                  Navigator.of(sheet).pop();
                  final res = await ref
                      .read(moderationRepositoryProvider)
                      .block(
                        p.isCompany ? BlockKind.company : BlockKind.record,
                        p.code,
                      );
                  if (!mounted) return;
                  res.when(
                    ok: (_) {
                      _snack(l.reelBlocked);
                      ref.invalidate(showcaseProvider);
                    },
                    err: (e) => _snack(describeError(l, e)),
                  );
                },
              ),
            const SizedBox(height: Gap.sm),
          ],
        ),
      ),
    );
  }

  // ── KO'RINISH ────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final p = _p;
    final like = ref.watch(
      postLikesProvider.select(
        (m) => m[likeKey(p)] ?? (liked: p.liked, count: p.likes),
      ),
    );
    final saved = ref.watch(savedReelsProvider).contains(likeKey(p));
    final mine = ref.watch(isMineProvider(p.code));
    final following = (mine || p.code.isEmpty)
        ? false
        : ref.watch(followingOfProvider(p.code));
    final muted = ref.watch(reelsMutedProvider);
    final navH = MediaQuery.paddingOf(context).bottom;
    final topH = MediaQuery.paddingOf(context).top;
    final link = showcaseLinkKind(p.linkUrl);
    final item = p.catalogItem;

    return Stack(
      fit: StackFit.expand,
      children: [
        const ColoredBox(color: Colors.black),
        PageView.builder(
          key: const ValueKey('showcase-carousel'),
          controller: _carousel,
          itemCount: _images.length,
          onPageChanged: _onImage,
          itemBuilder: (context, i) => GestureDetector(
            key: ValueKey('showcase-image-$i'),
            behavior: HitTestBehavior.opaque,
            onTap: () => _openViewer(i),
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Orqada xiralashgan nusxa, ustida rasm BUTUN (kesilmaydi).
                ImageFiltered(
                  imageFilter: ImageFilter.blur(sigmaX: 28, sigmaY: 28),
                  child: Opacity(
                    opacity: .55,
                    child: mediaImage(context, _images[i], fit: BoxFit.fill),
                  ),
                ),
                mediaImage(context, _images[i], fit: BoxFit.contain),
              ],
            ),
          ),
        ),
        // Pastdagi matn o'qilishi uchun gradient.
        IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.center,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: .75),
                ],
              ),
            ),
          ),
        ),
        if (_images.length > 1)
          Positioned(
            key: const ValueKey('showcase-dots'),
            left: 0,
            right: 0,
            top: topH + 64,
            child: IgnorePointer(
              child: Center(
                child: CarouselDots(count: _images.length, index: _image),
              ),
            ),
          ),
        Positioned(
          right: 4,
          bottom: navH + 30 - Gap.lg / 2,
          child: Column(
            children: [
              ReelAction(
                key: const ValueKey('showcase-like'),
                icon: like.liked ? NovaIcons.liked : NovaIcons.like,
                label: formatCount(like.count),
                tint: like.liked ? t.error : Colors.white,
                semantic: l.postLike,
                onTap: _like,
              ),
              ReelAction(
                key: const ValueKey('showcase-comments'),
                icon: NovaIcons.comment,
                label: formatCount(_comments ?? p.comments),
                semantic: l.postComments,
                onTap: () => showReelComments(
                  context,
                  p,
                  onTotal: (n) {
                    if (mounted) setState(() => _comments = n);
                  },
                ),
              ),
              ReelAction(
                key: const ValueKey('showcase-save'),
                icon: saved ? NovaIcons.saved : NovaIcons.save,
                label: l.actionSave,
                tint: saved ? t.goldOnDark(IdPlate.goldLight) : Colors.white,
                semantic: l.actionSave,
                onTap: _save,
              ),
              ReelAction(
                key: const ValueKey('showcase-share'),
                icon: NovaIcons.share,
                label: l.actionShare,
                semantic: l.actionShare,
                onTap: () => shareWithFeedback(
                  context,
                  contentShareText(
                    caption: [
                      p.title,
                      p.text,
                    ].where((e) => e.isNotEmpty).join('\n'),
                    code: p.code,
                    company: p.isCompany,
                    postId: p.id,
                  ),
                  subject: p.authorName,
                  copiedMessage: l.shareCopied,
                ),
              ),
              if (p.music != null)
                ReelAction(
                  key: const ValueKey('showcase-mute'),
                  icon: muted ? NovaIcons.muted : NovaIcons.sound,
                  label: '',
                  semantic: muted ? l.actionUnmute : l.actionMute,
                  onTap: _toggleMute,
                ),
              ReelAction(
                key: const ValueKey('showcase-more'),
                icon: NovaIcons.more,
                label: '',
                semantic: l.reportTitle,
                onTap: _showMore,
              ),
            ],
          ),
        ),
        Positioned(
          left: Gap.lg,
          right: 72,
          bottom: navH + 30,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _AuthorRow(
                post: p,
                mine: mine,
                following: following,
                views: _views ?? p.views,
                onAuthor: _openAuthor,
                onFollow: () async {
                  final e = await ref
                      .read(followOverridesProvider.notifier)
                      .toggle(
                        p.code,
                        following: following,
                        company: p.isCompany,
                      );
                  if (e != null && mounted) _snack(describeError(l, e));
                },
              ),
              if (p.pending) ...[
                const SizedBox(height: Gap.sm),
                const PendingBadge(onDark: true),
              ],
              if (p.featured) ...[
                const SizedBox(height: Gap.sm),
                _Pill(
                  key: const ValueKey('showcase-sponsored'),
                  text: l.feedSponsored,
                ),
              ],
              if (p.title.isNotEmpty) ...[
                const SizedBox(height: Gap.sm),
                Text(
                  p.title,
                  key: const ValueKey('showcase-title'),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    height: 1.25,
                    color: Colors.white,
                    shadows: [Shadow(color: Colors.black54, blurRadius: 8)],
                  ),
                ),
              ],
              if (p.priceUzs != null) ...[
                const SizedBox(height: 4),
                Text(
                  formatUzs(l, p.priceUzs!),
                  key: const ValueKey('showcase-price'),
                  style: AppType.monoStyle(
                    color: IdPlate.goldLight,
                    size: 15,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
              if (p.text.isNotEmpty) ...[
                const SizedBox(height: Gap.sm),
                ReelCaption(
                  text: p.text,
                  open: _captionOpen,
                  onToggle: () => setState(() => _captionOpen = !_captionOpen),
                ),
              ],
              if (p.music != null) ...[
                const SizedBox(height: Gap.sm),
                MusicChip(
                  key: const ValueKey('showcase-music'),
                  track: p.music!,
                  onDark: true,
                  onTap: () => _openMusic(p.music!),
                ),
              ],
              if (postContactActions(p).isNotEmpty) ...[
                const SizedBox(height: Gap.sm),
                PostContactBar(
                  key: const ValueKey('showcase-contact'),
                  post: p,
                  onDark: true,
                ),
              ],
              if (item != null || link != null) ...[
                const SizedBox(height: Gap.sm),
                Wrap(
                  spacing: Gap.sm,
                  runSpacing: 6,
                  children: [
                    if (item != null)
                      _CtaButton(
                        key: const ValueKey('showcase-product'),
                        icon: Icons.shopping_bag_outlined,
                        label: l.showcaseViewProduct,
                        primary: true,
                        onTap: () => _openProduct(item),
                      ),
                    if (link != null)
                      _CtaButton(
                        key: const ValueKey('showcase-link'),
                        icon: Icons.open_in_new_rounded,
                        label: showcaseLinkLabel(l, link),
                        onTap: () => openLink(p.linkUrl),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _AuthorRow extends StatelessWidget {
  const _AuthorRow({
    required this.post,
    required this.mine,
    required this.following,
    required this.views,
    required this.onAuthor,
    required this.onFollow,
  });

  final Post post;
  final bool mine;
  final bool following;
  final int views;
  final VoidCallback onAuthor;
  final VoidCallback onFollow;

  @override
  Widget build(BuildContext context) {
    final p = post;
    return Row(
      children: [
        Flexible(
          child: PressableScale(
            key: const ValueKey('showcase-author'),
            onTap: p.code.isEmpty ? null : onAuthor,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Avatar(
                  url: p.authorAvatar,
                  initials: p.authorName.isEmpty
                      ? 'N'
                      : p.authorName.substring(0, 1).toUpperCase(),
                  size: 36,
                  ringColor: IdPlate.gold.withValues(alpha: .8),
                  ringWidth: 1.4,
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
        ),
        if (!mine && p.code.isNotEmpty) ...[
          const SizedBox(width: Gap.sm),
          ReelFollowPill(following: following, onTap: onFollow),
        ],
        if (p.id > 0) ...[
          const SizedBox(width: Gap.sm),
          ReelViewsLabel(count: views),
        ],
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .18),
      borderRadius: R.pill,
    ),
    child: Text(
      text,
      style: const TextStyle(
        fontFamily: AppType.sans,
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
    ),
  );
}

/// "Mahsulotni ko'rish" (oltin) va "YouTube'da ochish" (qora shisha).
class _CtaButton extends StatelessWidget {
  const _CtaButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.primary = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final fg = primary ? Colors.black : Colors.white;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: PressableScale(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 40),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: primary
                  ? IdPlate.gold
                  : Colors.black.withValues(alpha: .38),
              borderRadius: R.pill,
              border: primary
                  ? null
                  : Border.all(color: Colors.white.withValues(alpha: .6)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: fg),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: fg,
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
}
