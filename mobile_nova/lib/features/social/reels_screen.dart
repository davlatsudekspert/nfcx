import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../app/profile_context.dart';
import '../../app/providers.dart';
import '../../core/storage/secure_store.dart';
import 'comments.dart';
import 'engagement.dart';
import 'moderation.dart';

import '../../core/network/api_client.dart';
import '../../core/utils/sharing.dart';
import '../../data/models/models.dart';
import '../../data/repositories/saves_repository.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/widgets/id_plate.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../../routing/shell.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import '../profile/music_player.dart';
import '../../design/icons/nova_icons.dart';

/// Ovoz o'chirilganmi — BUTUN lenta uchun bitta holat.
///
/// Sahifa bo'yicha saqlansa, har silashda ovoz qaytadan yonib
/// ketardi. Bu yerda `autoDispose` ATAYLAB yo'q: ekrandan chiqib
/// qaytganda ham tanlov saqlanadi.
final reelsMutedProvider = StateProvider<bool>((_) => false);

/// Reels manbai — LENTA va O'Z VIDEOLARIM.
///
/// Ilgari bu yerda faqat `feed()` turardi. `/api/feed` esa OBUNA
/// bo'linganlarning kontentini beradi, shuning uchun o'z reelingni
/// joylab, Reels bo'limini ochganingda u yerda "Hozircha reels
/// yo'q" chiqardi — o'zingga obuna bo'lolmaysan. Hisobda obuna
/// yo'q bo'lsa bo'lim BUTUNLAY bo'sh turardi.
///
/// Endi faol profilning o'z videolari ham qo'shiladi. O'z
/// videolarini o'qishdagi xato YUTILADI: lenta kelgan bo'lsa
/// bo'lim baribir ishlashi kerak.
final reelsProvider = FutureProvider.autoDispose<List<Post>>((ref) async {
  final repo = ref.watch(socialRepositoryProvider);
  bool playable(Post p) => p.isVideo && p.mediaUrls.isNotEmpty;

  // `id` bo'yicha yig'iladi: bir video ikkala manbada ham
  // bo'lishi mumkin (o'z kompaniyangga obuna bo'lsang).
  final byId = <int, Post>{};

  final active = ref.watch(activeProfileProvider);
  if (active != null) {
    final mine = await repo.postsOf(active.code);
    mine.when(
      ok: (items) {
        for (final p in items.where(playable)) {
          byId[p.id] = p;
        }
      },
      err: (_) {},
    );
  }

  final res = await repo.feed();
  return res.when(
    ok: (items) {
      for (final p in items.where(playable)) {
        byId[p.id] = p;
      }
      return byId.values.toList();
    },
    // Lenta kelmasa — bu haqiqiy xato va ekran shuni ko'rsatishi
    // kerak. Lekin o'z videolarim kelgan bo'lsa ularni ko'rsatish
    // hech narsadan yaxshiroq.
    err: (e) => byId.isEmpty ? throw e : byId.values.toList(),
  );
});

/// Saqlangan reel'lar — SHU QURILMADA.
///
/// Serverda "saqlash" API'si yo'q. Shuning uchun saqlash telefon
/// xotirasida turadi va buni odamga aytamiz (snackbar) — soxta
/// "hisobingizga saqlandi" yo'q.
class SavedReels extends SyncedSaves {
  SavedReels(SavesRepository repo, Prefs prefs)
      : super(repo, SaveKind.reel,
            initial: prefs.savedReels, persist: prefs.setSavedReels);

  /// `true` — endi saqlangan.
  Future<bool> toggleReel(Post p) => toggle(likeKey(p));
}

/// Saqlangan Reels — HISOBGA bog'langan (`/api/saves`), telefon xotirasi
/// faqat kesh. Batafsil: `SyncedSaves`.
final savedReelsProvider = StateNotifierProvider<SavedReels, Set<String>>(
    (ref) => SavedReels(
        ref.watch(savesRepositoryProvider), ref.watch(prefsProvider)));

/// Vertikal Reels lentasi.
///
/// XOTIRA VA SILLIQLIK:
///   * bir vaqtda ko'pi bilan IKKI video kontrolleri yashaydi —
///     ko'rinib turgani va KEYINGISI (oldindan yuklangan, pauzada).
///     Silaganda keyingi video darhol boshlanadi, spinner kutilmaydi;
///   * qolganlari yo'q qilinadi — o'nta 1080p video RAM'ni to'ldirib
///     ilovani o'ldirardi;
///   * Reels tabidan chiqilganda (pastki navigatsiya) HAMMASI to'xtaydi
///     va yo'q qilinadi — boshqa bo'limda ovoz eshitilmaydi.
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
    // Reels — pastki navigatsiyaning 4-tabi (`HomeShell.tabRoutes`).
    final onReelsTab = ref.watch(activeTabProvider) == 3;
    final l = L.of(context);
    final reels = ref.watch(reelsProvider);

    return Scaffold(
      backgroundColor: Colors.black,
      extendBody: true,
      body: reels.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
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
                key: const ValueKey('reels-pager'),
                controller: _page,
                scrollDirection: Axis.vertical,
                // KEYINGI SAHIFA OLDINDAN QURILADI. Usiz `PageView`
                // faqat ko'rinayotgan sahifani quradi va "oldindan
                // yuklash" hech qachon ishga tushmasdi — har silashda
                // spinner kutilardi.
                allowImplicitScrolling: true,
                // CHEKSIZ AYLANISH (egasi, 2026-09): reels kam bo'lsa
                // ham oxiriga yetganda to'xtamaydi — boshidan davom
                // etadi. `itemCount` yo'q = cheksiz; sahifa raqami
                // ro'yxat uzunligiga bo'linib qoldiq olinadi.
                //
                // KALIT VIRTUAL RAQAM BILAN: bitta reel bo'lsa, qo'shni
                // sahifalar AYNAN bir post bo'ladi va faqat post
                // kaliti ikki marta takrorlanib xato berardi.
                itemCount: items.length == 1 ? 1 : null,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) => _ReelPage(
                  key: ValueKey('$i:${likeKey(items[i % items.length])}'),
                  post: items[i % items.length],
                  // KO'RINISH IKKI SHARTDAN IBORAT: bu sahifa
                  // ochiqmi VA Reels tabining O'ZI ko'rinyaptimi.
                  // Tablar yopilmaydi, faqat berkitiladi — usiz odam
                  // Profilda turib Reels ovozini eshitardi.
                  visible: i == _index && onReelsTab,
                  preload: i == _index + 1 && onReelsTab,
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
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Brend imzosi — Reels NFCSTORE'niki ekani bir qarashda.
                Text(
                  'NFCSTORE',
                  style: AppType.eyebrow(color: IdPlate.goldLight, size: 9)
                      .copyWith(shadows: const [
                    Shadow(color: Colors.black54, blurRadius: 8),
                  ]),
                ),
                Text(
                  l.navReels,
                  style: AppType.displayStyle(
                    color: Colors.white,
                    size: 25,
                    shadows: const [
                      Shadow(color: Colors.black54, blurRadius: 12)
                    ],
                  ),
                ),
              ],
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
  const _ReelPage({
    super.key,
    required this.post,
    required this.visible,
    this.preload = false,
  });

  final Post post;

  /// Ekranda — o'ynaydi.
  final bool visible;

  /// Keyingi sahifa — yuklanadi, lekin O'YNAMAYDI va ovozsiz turadi.
  final bool preload;

  @override
  ConsumerState<_ReelPage> createState() => _ReelPageState();
}

class _ReelPageState extends ConsumerState<_ReelPage> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _failed = false;

  /// Izohlar soni — varaqda yangi izoh yozilsa yangilanadi.
  int? _comments;

  /// Yurak "portlashi" — ikki marta bosilganda.
  bool _burst = false;

  /// Har bir ochish urinishining raqami.
  ///
  /// NIMA UCHUN. Video yuklanayotgan paytda odam pastki navigatsiya
  /// bilan boshqa tabga o'tsa, kontroller yo'q qilinadi — lekin
  /// eski `initialize()` davom etib, keyin YO'Q QILINGAN kontrollerga
  /// `play()` chaqirardi va sahifa "video ochilmadi" holatida QOTIB
  /// qolardi (qaytib kelganda ham). Raqam mos kelmasa natija
  /// tashlab yuboriladi.
  int _gen = 0;

  late final AudioOwner _owner;

  @override
  void initState() {
    super.initState();
    _owner = ref.read(audioOwnerProvider);
    _sync();
  }

  @override
  void didUpdateWidget(covariant _ReelPage old) {
    super.didUpdateWidget(old);
    if (old.visible != widget.visible || old.preload != widget.preload) {
      _sync();
    }
  }

  void _sync() {
    if (widget.visible || widget.preload) {
      _activate();
    } else {
      _release();
    }
  }

  Future<void> _activate() async {
    var c = _controller;
    if (c == null) {
      final gen = ++_gen;
      _failed = false;
      c = VideoPlayerController.networkUrl(
        Uri.parse(widget.post.mediaUrls.first),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );
      _controller = c;
      try {
        await c.initialize();
        if (gen != _gen || !mounted) return;
        await c.setLooping(true);
        _ready = true;
      } catch (_) {
        if (gen == _gen && mounted) setState(() => _failed = true);
        return;
      }
    }
    if (!mounted || _controller != c || !_ready) return;

    if (widget.visible) {
      // Video ovoz chiqaradi — u audio EGASI bo'ladi. Profil musiqasi
      // o'ynayotgan bo'lsa to'xtaydi: ikki manba birga ovoz chiqarmaydi.
      _owner.take(this, _pauseForOther);
      await c.setVolume(ref.read(reelsMutedProvider) ? 0 : 1);
      await c.play();
    } else {
      // Oldindan yuklangan: jim va pauzada, boshidan.
      await c.setVolume(0);
      await c.pause();
      await c.seekTo(Duration.zero);
    }
    if (mounted) setState(() {});
  }

  /// Ovozni o'chirish/yoqish — BUTUN lenta uchun.
  Future<void> _toggleMute() async {
    final next = !ref.read(reelsMutedProvider);
    ref.read(reelsMutedProvider.notifier).state = next;
    await _controller?.setVolume(next ? 0 : 1);
    if (mounted) setState(() {});
  }

  void _pauseForOther() {
    _controller?.pause();
    if (mounted) setState(() {});
  }

  void _release() {
    // Kontroller YO'Q QILINADI, faqat to'xtatilmaydi: to'xtatilgan
    // video ham dekoder va bufer xotirasini ushlab turadi.
    _gen++;
    final c = _controller;
    _controller = null;
    _ready = false;
    _failed = false;
    if (c != null) {
      c.pause().catchError((_) {});
      c.dispose();
    }
    _owner.release(this);
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _gen++;
    _controller?.dispose();
    // `ref.read` EMAS: `dispose()` da u istisno otadi.
    _owner.release(this);
    super.dispose();
  }

  /// MUALLIF PROFILIGA O'TISH — VIDEO TO'XTAYDI (egasi, 2026-09).
  ///
  /// Profil sahifasi Reels ustiga ochiladi, Reels tabi esa "faol"
  /// bo'lib qolaveradi — video orqada ovoz chiqarib o'ynardi.
  /// O'tishdan oldin pauza, qaytganda davom etadi (Instagram kabi).
  Future<void> _openAuthor() async {
    final p = widget.post;
    if (p.code.isEmpty) return;
    await _controller?.pause();
    _owner.release(this);
    if (mounted) setState(() {});
    if (!mounted) return;
    await context.push(Routes.author(p.code, company: p.isCompany));
    if (mounted) _sync();
  }

  void _togglePlay() {
    final c = _controller;
    if (c == null || !_ready) {
      // Xato bo'lgan video — bosilsa qayta urinish.
      if (_failed) {
        _release();
        _sync();
      }
      return;
    }
    setState(() => c.value.isPlaying ? c.pause() : c.play());
  }

  Future<void> _like({bool onlyOn = false}) async {
    final likes = ref.read(postLikesProvider.notifier);
    if (onlyOn && likes.of(widget.post).liked) return;
    final e = await likes.toggle(widget.post);
    if (e != null && mounted) _snack(describeError(L.of(context), e));
  }

  void _doubleTap() {
    setState(() => _burst = true);
    _like(onlyOn: true);
    Future<void>.delayed(const Duration(milliseconds: 650), () {
      if (mounted) setState(() => _burst = false);
    });
  }

  void _snack(String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _openComments() async {
    await showReelComments(
      context,
      widget.post,
      onTotal: (n) {
        if (mounted) setState(() => _comments = n);
      },
    );
  }

  Future<void> _save() async {
    final l = L.of(context);
    final on = await ref.read(savedReelsProvider.notifier).toggleReel(widget.post);
    if (mounted) _snack(on ? l.reelSavedLocal : l.reelUnsaved);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final p = widget.post;
    final muted = ref.watch(reelsMutedProvider);
    final like = ref.watch(postLikesProvider
        .select((m) => m[likeKey(p)] ?? (liked: p.liked, count: p.likes)));
    final saved = ref.watch(savedReelsProvider).contains(likeKey(p));
    final mine = ref.watch(isMineProvider(p.code));
    final following = ref.watch(followingOfProvider(p.code));
    final c = _controller;
    final playing = c != null && _ready && c.value.isPlaying;
    // Telefonning pastki tizim paneli (3 tugmali navigatsiya ~48 dp).
    // Ilgari hisobga olinmasdi: shunday telefonlarda muallif, NFC ID
    // va izoh pastki menyu ostida qolib ketardi (egasi, 2026-09 surat).
    final inset = MediaQuery.viewPaddingOf(context).bottom;

    return GestureDetector(
      onTap: _togglePlay,
      onDoubleTap: _doubleTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const ColoredBox(color: Colors.black),
          if (_ready && c != null)
            // `contain` — video HECH QACHON kesilmaydi (egasining
            // qoidasi, media_fit_test). 9:16 video uzun ekranda tepa va
            // pastda ingichka qora chiziq qoldiradi — bu kesishdan yaxshi.
            FittedBox(
              fit: BoxFit.contain,
              child: SizedBox(
                width: c.value.size.width,
                height: c.value.size.height,
                child: VideoPlayer(c),
              ),
            )
          else if (_failed)
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.videocam_off_rounded, size: 40, color: t.text3),
                  const SizedBox(height: Gap.sm),
                  Text(l.actionRetry,
                      style: const TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white70)),
                ],
              ),
            )
          else
            const Center(
              child: CircularProgressIndicator(
                  color: Colors.white70, strokeWidth: 2),
            ),
          // Pastdagi matn o'qilishi uchun gradient.
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.center,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: .72)
                    ],
                  ),
                ),
              ),
            ),
          ),
          // Pauza belgisi — odam bosganini ko'rsin.
          if (_ready && !playing && widget.visible)
            const IgnorePointer(
              child: Center(
                child: Icon(Icons.play_arrow_rounded,
                    size: 72, color: Colors.white70),
              ),
            ),
          IgnorePointer(
            child: Center(
              child: AnimatedScale(
                scale: _burst ? 1 : .4,
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeOutBack,
                child: AnimatedOpacity(
                  opacity: _burst ? 1 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(NovaIcons.liked,
                      size: 96, color: Colors.white),
                ),
              ),
            ),
          ),
          Positioned(
            right: 4,
            bottom: 132 + inset,
            child: Column(
              children: [
                _Action(
                  key: const ValueKey('reel-like'),
                  icon: like.liked
                      ? NovaIcons.liked
                      : NovaIcons.like,
                  label: formatCount(like.count),
                  tint: like.liked ? t.error : Colors.white,
                  semantic: l.postLike,
                  onTap: _like,
                ),
                const SizedBox(height: Gap.lg),
                _Action(
                  key: const ValueKey('reel-comments'),
                  icon: NovaIcons.comment,
                  label: formatCount(_comments ?? p.comments),
                  semantic: l.postComments,
                  onTap: _openComments,
                ),
                const SizedBox(height: Gap.lg),
                _Action(
                  key: const ValueKey('reel-save'),
                  icon: saved
                      ? NovaIcons.saved
                      : NovaIcons.save,
                  label: l.actionSave,
                  semantic: l.actionSave,
                  onTap: _save,
                ),
                const SizedBox(height: Gap.lg),
                _Action(
                  key: const ValueKey('reel-share'),
                  icon: NovaIcons.share,
                  label: l.actionShare,
                  semantic: l.actionShare,
                  onTap: () => p.code.isEmpty
                      ? shareText(p.text)
                      : shareLink(
                          '$kApiBase/${Uri.encodeComponent(p.code)}',
                          title: p.authorName),
                ),
                const SizedBox(height: Gap.lg),
                _Action(
                  icon: muted
                      ? NovaIcons.muted
                      : NovaIcons.sound,
                  // Yozuvsiz: "Ovozni o'chirish" ustunni kengaytirib,
                  // tor ekranda muallif ismini siqib qo'yardi.
                  label: '',
                  semantic: muted ? l.actionUnmute : l.actionMute,
                  onTap: _toggleMute,
                ),
                const SizedBox(height: Gap.lg),
                _Action(
                  key: const ValueKey('reel-more'),
                  icon: NovaIcons.more,
                  label: '',
                  semantic: l.reportTitle,
                  onTap: () => _showMore(context, p),
                ),
              ],
            ),
          ),
          Positioned(
            left: Gap.lg,
            right: 72,
            bottom: 112 + inset,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: PressableScale(
                        onTap: p.code.isEmpty ? null : _openAuthor,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Avatar(
                              url: p.authorAvatar,
                              initials: p.authorName.isEmpty
                                  ? 'N'
                                  : p.authorName.substring(0, 1).toUpperCase(),
                              size: 40,
                              // Nozik champagne halqa — NFCSTORE imzosi.
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
                    // Obuna — faqat begona muallifga.
                    if (!mine && p.code.isNotEmpty) ...[
                      const SizedBox(width: Gap.sm),
                      _FollowPill(
                        following: following,
                        onTap: () async {
                          final e = await ref
                              .read(followOverridesProvider.notifier)
                              .toggle(p.code,
                                  following: following,
                                  company: p.isCompany);
                          if (e != null && context.mounted) {
                            _snack(describeError(l, e));
                          }
                        },
                      ),
                    ],
                  ],
                ),
                if (p.code.isNotEmpty) ...[
                  const SizedBox(height: Gap.sm),
                  // NFC ID — REELS'NING NFCSTORE IDENTITETI (egasi, 2026-09:
                  // "Instagram nusxasi bo'lmasin"). Muallif shunchaki ism
                  // emas, NFC ID egasi: qora shisha kapsula, champagne
                  // hoshiya, oltin NFC belgisi va mono kod. Kompaniya
                  // bo'lsa — do'kon belgisi. Bosilsa muallif profili.
                  PressableScale(
                    key: const ValueKey('reel-id-chip'),
                    onTap: _openAuthor,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(9, 5, 11, 5),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: .38),
                        borderRadius: R.pill,
                        border: Border.all(
                            color: IdPlate.gold.withValues(alpha: .55),
                            width: .8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            p.isCompany
                                ? Icons.storefront_outlined
                                : Icons.nfc_rounded,
                            size: 13,
                            color: IdPlate.goldLight,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            p.code,
                            style: AppType.monoStyle(
                                color: Colors.white,
                                size: 11.5,
                                weight: FontWeight.w600,
                                letterSpacing: 1.4),
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
          // Ingichka progress — pastki navigatsiyadan yuqorida.
          if (_ready && c != null && widget.visible)
            Positioned(
              left: 0,
              right: 0,
              bottom: 96 + inset,
              child: IgnorePointer(
                child: VideoProgressIndicator(
                  c,
                  allowScrubbing: false,
                  padding: EdgeInsets.zero,
                  colors: VideoProgressColors(
                    playedColor: t.brand,
                    bufferedColor: Colors.white24,
                    backgroundColor: Colors.white10,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _showMore(BuildContext context, Post p) {
    final l = L.of(context);
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
              key: const ValueKey('reel-report'),
              leading: const Icon(Icons.flag_outlined),
              title: Text(l.reportTitle),
              onTap: () {
                Navigator.of(sheet).pop();
                showReportSheet(
                  context,
                  target: p.isCompany ? ReportTarget.companyPost : ReportTarget.post,
                  targetId: '${p.id}',
                  ownerCode: p.code,
                );
              },
            ),
            if (!ref.read(isMineProvider(p.code)) && p.code.isNotEmpty)
              ListTile(
                key: const ValueKey('reel-block'),
                leading: const Icon(Icons.block_rounded),
                title: Text(l.reelBlockAuthor),
                onTap: () async {
                  Navigator.of(sheet).pop();
                  final res = await ref.read(moderationRepositoryProvider).block(
                      p.isCompany ? BlockKind.company : BlockKind.record, p.code);
                  if (!context.mounted) return;
                  res.when(
                    ok: (_) {
                      _snack(l.reelBlocked);
                      ref.invalidate(reelsProvider);
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
}

/// Muallifga obuna — video ustida o'qiladigan shaffof kapsula.
class _FollowPill extends StatelessWidget {
  const _FollowPill({required this.following, required this.onTap});
  final bool following;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final label = following ? l.actionFollowing : l.actionFollow;
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        child: Container(
          key: const ValueKey('reel-follow'),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: following ? Colors.transparent : Colors.white,
            borderRadius: R.pill,
            border: Border.all(color: Colors.white.withValues(alpha: .7)),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: following ? Colors.white : Colors.black,
            ),
          ),
        ),
      ),
    );
  }
}

/// Reel izohlari — video ustidan ochiladigan varaq.
///
/// Ilgari izoh tugmasi alohida post ekraniga o'tardi va video
/// to'xtab, lenta joyi yo'qolardi. Endi varaq ochiladi, video orqada
/// qoladi. Manba o'sha `CommentsSection` — ikkinchi izoh tizimi yo'q.
Future<void> showReelComments(
  BuildContext context,
  Post p, {
  ValueChanged<int>? onTotal,
}) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.tokens.surfaceSolid,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (_) => _CommentsSheet(post: p, onTotal: onTotal),
  );
}

class _CommentsSheet extends ConsumerWidget {
  const _CommentsSheet({required this.post, this.onTotal});
  final Post post;
  final ValueChanged<int>? onTotal;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kind = post.isCompany ? 'company_post' : 'post';
    ref.listen(commentsProvider((kind: kind, id: post.id)), (_, next) {
      final total = next.valueOrNull?.total;
      if (total != null) onTotal?.call(total);
    });
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * .72),
        child: SingleChildScrollView(
          // Telefonning pastki paneli (jest chizig'i / 3 tugma) ostida
          // oxirgi izoh va "Javob berish" qolib ketmasin (egasi,
          // 2026-09 surat).
          padding: EdgeInsets.only(
              bottom: Gap.xl + MediaQuery.viewPaddingOf(context).bottom),
          child: CommentsSection(
            kind: kind,
            id: post.id,
            ownerCode: post.code,
          ),
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
    super.key,
    required this.icon,
    required this.label,
    required this.semantic,
    this.tint = Colors.white,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String semantic;
  final Color tint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: semantic,
        excludeSemantics: true,
        child: PressableScale(
        onTap: onTap,
        scale: .86,
        child: SizedBox(
        width: 60,
        child: Column(
          children: [
            Icon(icon, size: 28, color: tint, shadows: const [
              Shadow(color: Colors.black54, blurRadius: 10),
            ]),
            const SizedBox(height: 4),
            if (label.isNotEmpty)
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                  shadows: [Shadow(color: Colors.black54, blurRadius: 10)],
                ),
              ),
          ],
        ),
      ),
      ),
      );
}
