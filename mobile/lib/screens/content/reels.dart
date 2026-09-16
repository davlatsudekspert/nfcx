import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/logo.dart';
import '../../design/components/media.dart';
import '../../design/components/nav_bar.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/video_view.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../home/home.dart' show CommentButton, LikeButton;
import 'comments_sheet.dart';
import '../common/share.dart';
import '../identity/profile_screen.dart';
import '../shell.dart';
import 'report_sheet.dart';

/// REELS — to'liq ekran vertikal lenta.
///
/// YORUG'LIK PASTDAN: bu ekranning o'z manbai va u boshqa
/// ekranlardan ajralib turadi.
///
/// MAJBURIY ELEMENTLAR (Google Play talabi va dizayn qoidasi):
/// orqaga tugmasi va "⋯" menyusi. Menyu ichida boshqa odamning
/// kontentida "Shikoyat qilish", o'z kontentingizda "O'chirish"
/// bo'ladi.
///
/// Reels TAB ILDIZI, ya'ni `Navigator.pop` qiladigan joyi yo'q —
/// orqaga tugmasi `ShellScope.goHome` ni chaqiradi.
class ReelsScreen extends StatefulWidget {
  const ReelsScreen({super.key});

  @override
  State<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends State<ReelsScreen> {
  final _pages = PageController();

  List<FeedEntry> _items = const [];
  int _page = 1;
  bool _hasMore = true;
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;
  int _index = 0;
  bool _loadedOnce = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_loadedOnce) {
      _loadedOnce = true;
      _load();
    }
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await AppScope.read(context).repo.feed(page: 1);
      if (!mounted) return;
      setState(() {
        _items = r.items;
        _hasMore = r.hasMore;
        _page = 1;
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

  /// Oxiridan ikki kadr qolganda keyingi sahifa yuklanadi — odam
  /// yuklanishni sezmaydi.
  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    _loadingMore = true;
    try {
      final r = await AppScope.read(context).repo.feed(page: _page + 1);
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...r.items];
        _hasMore = r.hasMore;
        _page += 1;
      });
    } catch (_) {
      // Keyingi sahifa kelmasa joriy lenta ishlashda davom etadi.
    } finally {
      _loadingMore = false;
    }
  }

  Future<void> _toggleLike(int i) async {
    final item = _items[i];
    if (!item.likeable) return;
    final repo = AppScope.read(context).repo;
    setState(() {
      _items = [..._items]..[i] = item.copyWith(
          liked: !item.liked,
          likeCount: item.likeCount + (item.liked ? -1 : 1),
        );
    });
    try {
      final r = item.isStory
          ? await repo.likeStory(item.id)
          : await repo.likePost(item.id);
      if (!mounted) return;
      setState(() {
        _items = [..._items]..[i] =
            _items[i].copyWith(liked: r.liked, likeCount: r.count);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _items = [..._items]..[i] = item);
    }
  }

  /// IZOHLAR VARAQASI.
  ///
  /// Varaqa yopilganda server bergan JAMI SON qaytadi va kadrdagi
  /// hisob shu bilan yangilanadi — odam izoh yozib, varaqani yopgach
  /// eski raqamni ko'rib qolmasligi kerak.
  Future<void> _openComments(int i) async {
    final item = _items[i];
    final total = await showCommentsSheet(
      context,
      targetKind: item.commentTarget,
      targetId: item.id,
      initialCount: item.commentCount,
    );
    if (!mounted || total == null) return;
    setState(() {
      // Ro'yxat orada o'zgargan bo'lishi mumkin (keyingi sahifa
      // yuklangan) — shuning uchun indeks emas, AYNAN o'sha kadr
      // qaytadan topiladi.
      final at = _items.indexWhere((x) => x.kind == item.kind && x.id == item.id);
      if (at >= 0) _items = [..._items]..[at] = _items[at].copyWith(commentCount: total);
    });
  }

  Future<void> _menu(FeedEntry item) async {
    final state = AppScope.read(context);
    final mine = item.isCompany
        ? state.ownsCompany(item.code)
        : state.ownsRecord(item.code);

    await showContentMenu(
      context,
      targetKind: item.isStory
          ? 'story'
          : (item.isCompany ? 'company_post' : 'post'),
      targetId: '${item.id}',
      ownerCode: item.code,
      owned: mine,
      onDeleted: () async {
        if (!mounted) return;
        setState(() => _items = [..._items]..removeWhere(
              (e) => e.id == item.id && e.kind == item.kind,
            ));
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _items.isEmpty) {
      return ScreenBackdrop(
        aura: Aura.reels,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: SkeletonCard(aspect: 9 / 19, radius: R.hero),
          ),
        ),
      );
    }

    if (_error != null && _items.isEmpty) {
      return ScreenBackdrop(
        aura: Aura.reels,
        child: SafeArea(
          child: Center(child: ErrorState(humanError(_error), detail: errorDetail(_error), onRetry: _load)),
        ),
      );
    }

    if (_items.isEmpty) {
      return ScreenBackdrop(
        aura: Aura.reels,
        child: SafeArea(
          child: Center(
            child: EmptyState(
              tr('Obuna bo‘lgan odamlaringiz video qo‘shsa, shu yerda '
                  'ko‘rinadi.'),
              title: tr('Reels hozircha bo‘sh'),
              icon: Ico.play,
            ),
          ),
        ),
      );
    }

    return ScreenBackdrop(
      aura: Aura.reels,
      child: Stack(
        children: [
          PageView.builder(
            controller: _pages,
            scrollDirection: Axis.vertical,
            itemCount: _items.length,
            onPageChanged: (i) {
              setState(() => _index = i);
              if (i >= _items.length - 2) _loadMore();
            },
            itemBuilder: (context, i) => _Reel(
              item: _items[i],
              // FAQAT KO'RINIB TURGAN KADR IJRO ETILADI. `PageView`
              // qo'shni kadrlarni oldindan quradi — busiz ikki
              // videoning ovozi birdan eshitilardi.
              active: i == _index,
              onLike: () => _toggleLike(i),
              onComment: () => _openComments(i),
              onMenu: () => _menu(_items[i]),
              onAuthor: () => push<void>(
                context,
                (_) => _items[i].isCompany
                    ? ProfileScreen(companyId: _items[i].code)
                    : ProfileScreen(code: _items[i].code),
              ),
            ),
          ),

          // TEPA SCRIM — sarlavha video ustida turadi, gradientsiz
          // u yorug' kadrda ko'rinmay qolardi.
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: IgnorePointer(
              child: Container(
                height: 160,
                decoration: BoxDecoration(gradient: C.topScrim),
              ),
            ),
          ),

          // TEPA QATOR — orqaga, brend, menyu. Media ustida
          // turgani uchun shisha tugmalar.
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(S.x16, S.x8, S.x16, 0),
                child: Row(
                  children: [
                    RoundButton(
                      Ico.back,
                      size: 42,
                      iconSize: 17,
                      glass: true,
                      onTap: () => ShellScope.maybeOf(context)?.goHome(),
                    ),
                    const Spacer(),
                    const BrandMark(size: 34),
                    const SizedBox(width: S.x8),
                    Text('Reels', style: T.cardTitle),
                    const Spacer(),
                    RoundButton(
                      Ico.more,
                      size: 42,
                      iconSize: 17,
                      glass: true,
                      onTap: () => _menu(_items[_index]),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────

class _Reel extends StatelessWidget {
  const _Reel({
    required this.item,
    required this.active,
    required this.onLike,
    required this.onComment,
    required this.onMenu,
    required this.onAuthor,
  });

  final FeedEntry item;
  final bool active;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onMenu;
  final VoidCallback onAuthor;

  @override
  Widget build(BuildContext context) {
    final video = (item.videoUrl ?? '').trim();
    final bottom = NavBar.inset(context);

    return Stack(
      fit: StackFit.expand,
      children: [
        // MEDIA.
        if (video.isNotEmpty)
          VideoView(
            url: video,
            poster: item.imageUrl,
            active: active,
            fit: BoxFit.cover,
          )
        else ...[
          // RASM QIRQILMAYDI.
          //
          // Reels kadri tik (9:19), lentadagi rasmlar esa ko'pincha
          // yotiq. `cover` ularni kattalashtirib chetini kesardi —
          // odamning boshi yoki mahsulotning yarmi kadrdan chiqib
          // ketardi. Shuning uchun asosiy rasm `contain`: u
          // BUTUNLIGICHA ko'rinadi.
          //
          // Yon tomonda qolgan bo'shliq qora chiziq bo'lib turmasin
          // deb, ORQADA O'SHA RASMNING O'ZI `cover` bilan
          // qoraytirilgan holda chiziladi — kadr to'la, diqqat esa
          // baribir o'rtadagi rasmda qoladi.
          NetImage(item.imageUrl, radius: 0, slotIcon: Ico.play),
          if ((item.imageUrl ?? '').trim().isNotEmpty) ...[
            const Positioned.fill(
              child: ColoredBox(color: Color(0xCC0B0805)),
            ),
            NetImage(item.imageUrl, radius: 0, fit: BoxFit.contain),
          ],
        ],

        // SUV BELGISI — markazda 10% shaffof brend.
        //
        // Medalyon EMAS, faqat BELGI: medalyonning quyuq yuzasi
        // shaffoflikda rasm ustida iflos dog' bo'lib ko'rinardi.
        const Center(child: LogoMark(size: 150, opacity: .10)),

        // PASTKI SCRIM — matn har qanday rasmda o'qilsin.
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            height: 320,
            decoration: BoxDecoration(gradient: C.bottomScrim),
          ),
        ),

        // O'NG USTUN — layk va ulashish.
        Positioned(
          right: S.x12,
          bottom: bottom + 96,
          child: Column(
            children: [
              LikeButton(
                liked: item.liked,
                count: item.likeCount,
                onTap: onLike,
                size: 28,
                // OQ — kadr ustida. `C.ink` yorug' mavzuda deyarli
                // qora bo'ladi va to'q videoda yo'qolardi.
                color: item.liked ? C.accent : const Color(0xFFFFFFFF),
                onMedia: true,
              ),
              const SizedBox(height: S.x20),
              // IZOH — yurak bilan ulashish orasida, xuddi boshqa
              // ilovalardagi tartibda: odam uni qidirmasdan topadi.
              CommentButton(
                count: item.commentCount,
                onTap: onComment,
                size: 28,
                color: const Color(0xFFFFFFFF),
                onMedia: true,
              ),
              const SizedBox(height: S.x20),
              RoundButton(
                Ico.share,
                size: 46,
                iconSize: 20,
                glass: true,
                onTap: () => shareText(
                  context,
                  profileUrl(context, item.code, company: item.isCompany),
                ),
              ),
            ],
          ),
        ),

        // PASTKI BLOK — izoh va muallif.
        Positioned(
          left: S.gutter,
          right: 72,
          bottom: bottom + S.x12,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (item.caption.trim().isNotEmpty) ...[
                Text(
                  item.caption,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: T.body.copyWith(color: C.ink, fontSize: 14),
                ),
                const SizedBox(height: S.x12),
              ],
              Press(
                onTap: onAuthor,
                minSize: 0,
                scale: .97,
                child: Row(
                  children: [
                    Avatar(
                      url: item.avatarUrl,
                      name: item.name,
                      size: 40,
                      square: item.isCompany,
                    ),
                    const SizedBox(width: S.x12),
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            item.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: T.cardTitle,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            ago(item.createdAt).toUpperCase(),
                            style: T.meta.copyWith(fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}


