import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../content/compose.dart';
import '../content/post_detail.dart';
import '../content/report_sheet.dart';

/// MENING KONTENTIM (dizayn 10a) — EGANING BOSHQARUV EKRANI.
///
/// NIMA UCHUN ALOHIDA EKRAN: ochiq profil BOSHQA ODAM ko'radigan
/// ko'rinish — u yerda "o'chirish" va "muddat tugashiga necha
/// qoldi" degan narsalar begona. Egaga esa aynan shular kerak:
/// qaysi story qachon yo'qoladi va qaysi postni olib tashlash
/// kerak. Ilgari buning yagona yo'li profil to'ridagi katakni
/// UZOQ BOSISH edi — uni hech kim topmasdi.
///
/// EKRAN FAOL SHAXSNIKI. Shaxs almashsa (`AppScope.active`) ro'yxat
/// qayta yuklanadi: shaxsiy ID va biznes profili butunlay boshqa
/// kontentga ega.
///
/// IZOH YO'Q: serverda izoh tizimi yo'q, shuning uchun bu yerda
/// faqat YURAK soni ko'rsatiladi.
class MyContentScreen extends StatefulWidget {
  const MyContentScreen({super.key});

  @override
  State<MyContentScreen> createState() => _MyContentScreenState();
}

class _MyContentScreenState extends State<MyContentScreen> {
  List<Post> _stories = const [];
  List<Post> _posts = const [];

  bool _loading = true;
  Object? _error;
  bool _loadedOnce = false;
  String? _loadedFor;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final code = AppScope.of(context).active?.code;
    if (!_loadedOnce || code != _loadedFor) {
      _loadedOnce = true;
      _loadedFor = code;
      _load();
    }
  }

  /// KESHDAGI RO'YXAT EKRANDA QOLADI — yuklash uni bo'shatmaydi.
  /// O'chirgandan keyin qayta yuklanganda ro'yxat "o'chib-yonib"
  /// ketmasligi kerak.
  Future<void> _load() async {
    final state = AppScope.read(context);
    final active = state.active;
    if (active == null) {
      setState(() {
        _stories = const [];
        _posts = const [];
        _loading = false;
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Shaxsiy ID va biznes profili uchun endpointlar boshqa —
      // oqim esa bir xil.
      final stories = active.isBusiness
          ? await state.repo.companyStories(active.code)
          : await state.repo.recordStories(active.code);
      final posts = active.isBusiness
          ? await state.repo.companyPosts(active.code)
          : await state.repo.recordPosts(active.code);
      if (!mounted) return;
      setState(() {
        _stories = stories;
        _posts = posts;
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

  Future<void> _compose(ComposeKind kind) async {
    final active = AppScope.read(context).active;
    if (active == null) return;
    final done = await push<bool>(
      context,
      (_) => ComposeScreen(
        code: active.code,
        kind: kind,
        company: active.isBusiness,
      ),
    );
    if (done == true && mounted) await _load();
  }

  /// "⋯" — bu yerda kontent DOIM o'zimizniki, ya'ni menyuda
  /// "O'chirish" chiqadi va "Shikoyat qilish" yo'qoladi.
  ///
  /// O'chirilgach ro'yxat qayta o'qiladi: mahalliy ro'yxatdan
  /// o'chirib qo'ya qolsak, server rad etgan holatda ekran bilan
  /// haqiqat ajralib ketardi.
  Future<void> _menu(Post item, {required bool story}) async {
    final active = AppScope.read(context).active;
    final company = active?.isBusiness ?? false;
    await showContentMenu(
      context,
      // KOMPANIYA KONTENTI BOSHQA ENDPOINTGA KETADI. To'rt
      // kombinatsiya: `story`, `company_story`, `post`,
      // `company_post` — `showContentMenu` ularni shu nom bo'yicha
      // to'g'ri endpointga yo'naltiradi.
      targetKind: story
          ? (company ? 'company_story' : 'story')
          : (company ? 'company_post' : 'post'),
      targetId: item.id,
      ownerCode: active?.code ?? '',
      owned: true,
      onDeleted: () {
        if (mounted) _load();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final active = AppScope.of(context).active;
    final busy = _loading && _stories.isEmpty && _posts.isEmpty;

    return ScreenBackdrop(
      aura: Aura.none,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(child: TopBar()),
            SliverToBoxAdapter(child: ScreenTitle(tr('Mening kontentim'))),

            // IKKI AMAL — bittasi asosiy. Story tez yo'qoladigan,
            // post esa qoladigan kontent: ekranda ikkalasi ham bir
            // bosishda ochilishi kerak.
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x24),
                child: Row(
                  children: [
                    Expanded(
                      child: PrimaryButton(
                        tr('Story qo‘shish'),
                        icon: Ico.plus,
                        // Yaltirash faqat ekrandagi YAGONA
                        // qahramon tugmada bo'ladi; bu yerda
                        // ikkita tugma yonma-yon turibdi.
                        sweep: false,
                        onTap: active == null
                            ? null
                            : () => _compose(ComposeKind.story),
                      ),
                    ),
                    const SizedBox(width: S.x12),
                    Expanded(
                      child: SecondaryButton(
                        tr('Post qo‘shish'),
                        icon: Ico.plus,
                        onTap: active == null
                            ? null
                            : () => _compose(ComposeKind.post),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            if (active == null)
              SliverToBoxAdapter(
                child: EmptyState(
                  tr('Kontent joylash uchun avval shaxs tanlang.'),
                  title: tr('Faol shaxs yo‘q'),
                  icon: Ico.user,
                ),
              )
            else if (_error != null && _stories.isEmpty && _posts.isEmpty)
              SliverToBoxAdapter(
                child: ErrorState(humanError(_error!), onRetry: _load),
              )
            else ...[
              // ── STORY ────────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    0,
                    S.gutter,
                    S.x12,
                  ),
                  child: SectionHeader(
                    tr('Faol storylarim'),
                    trailing: _HeaderMeta(
                      count: _stories.length,
                      note: tr('24 SOAT'),
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: busy
                    ? const Padding(
                        padding: EdgeInsets.symmetric(horizontal: S.gutter),
                        child: SkeletonStories(count: 4),
                      )
                    : _stories.isEmpty
                        ? EmptyState(
                            tr('Story 24 soatdan keyin o‘chadi. Birinchisini '
                                'hozir joylang.'),
                            title: tr('Hali story yo‘q'),
                            icon: Ico.image,
                            compact: true,
                            actionLabel: tr('Story qo‘shish'),
                            onAction: () => _compose(ComposeKind.story),
                          )
                        : _StoryStrip(
                            stories: _stories,
                            onMenu: (s) => _menu(s, story: true),
                            onAdd: () => _compose(ComposeKind.story),
                          ),
              ),

              // ── POST ─────────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x32,
                    S.gutter,
                    S.x12,
                  ),
                  child: SectionHeader(
                    tr('Postlarim'),
                    trailing: _HeaderMeta(count: _posts.length),
                  ),
                ),
              ),
              if (busy)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: S.gutter),
                    child: Column(
                      children: [
                        SkeletonRow(avatar: 64),
                        SizedBox(height: S.x12),
                        SkeletonRow(avatar: 64),
                      ],
                    ),
                  ),
                )
              else if (_posts.isEmpty)
                SliverToBoxAdapter(
                  child: EmptyState(
                    tr('Birinchi postingiz ochiq profilingizda ko‘rinadi.'),
                    title: tr('Hali post yo‘q'),
                    icon: Ico.image,
                    actionLabel: tr('Post qo‘shish'),
                    onAction: () => _compose(ComposeKind.post),
                  ),
                )
              else
                SliverList.separated(
                  itemCount: _posts.length,
                  separatorBuilder: (_, __) => const SizedBox(height: S.x12),
                  itemBuilder: (_, i) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: _PostRow(
                      post: _posts[i],
                      onMenu: () => _menu(_posts[i], story: false),
                      onOpen: () async {
                        await push<void>(
                          context,
                          (_) => PostDetailScreen(
                            post: _posts[i],
                            canDelete: true,
                          ),
                        );
                        if (mounted) await _load();
                      },
                    ),
                  ),
                ),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: S.x32)),
          ],
        ),
      ),
    );
  }
}

/// Bo'lim sarlavhasining o'ng chekkasi — son (mono) va ixtiyoriy
/// izoh ("24 SOAT").
class _HeaderMeta extends StatelessWidget {
  const _HeaderMeta({required this.count, this.note});

  final int count;
  final String? note;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$count', style: T.statValue.copyWith(fontSize: 15)),
          if ((note ?? '').isNotEmpty) ...[
            Text('  ·  ', style: T.meta),
            Text(note!, style: T.meta.copyWith(fontSize: 10)),
          ],
        ],
      );
}

// ─────────────────────────────────────────────────────────────
// STORY
// ─────────────────────────────────────────────────────────────

/// STORYNING TUGASH VAQTI.
///
/// MODELDA MUDDAT MAYDONI YO'Q. `Post` da faqat `createdAt` bor
/// (server istorya javobida `expiresAt` qaytarmaydi), shuning uchun
/// muddat SHU YERDA hisoblanadi: joylangan vaqt + 24 soat. Bu
/// serverdagi qoida bilan bir xil ("story 24 soatdan keyin
/// o'chadi"). Server kelajakda muddatni qaytara boshlasa, shu
/// funksiya o'zgaradi — ekranning qolgan qismi emas.
DateTime? _storyExpiry(Post story) =>
    story.createdAt?.add(const Duration(hours: 24));

const Duration _storyLife = Duration(hours: 24);

class _StoryStrip extends StatelessWidget {
  const _StoryStrip({
    required this.stories,
    required this.onMenu,
    required this.onAdd,
  });

  final List<Post> stories;
  final ValueChanged<Post> onMenu;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 140,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          itemCount: stories.length + 1,
          separatorBuilder: (_, __) => const SizedBox(width: S.x12),
          itemBuilder: (_, i) => i == stories.length
              ? _AddStoryTile(onTap: onAdd)
              : _StoryCard(
                  story: stories[i],
                  onMenu: () => onMenu(stories[i]),
                ),
        ),
      );
}

/// Bitta story — 104×140.
///
/// TEPADAGI CHIZIQ — QOLGAN VAQT. Rang bilan bir qatorda YOZUV ham
/// bor ("3 soat qoldi"): holat faqat rang bilan bildirilmaydi.
class _StoryCard extends StatelessWidget {
  const _StoryCard({required this.story, required this.onMenu});

  final Post story;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final expires = _storyExpiry(story);
    final left = expires == null
        ? Duration.zero
        : expires.difference(DateTime.now());
    final fraction = expires == null
        ? 1.0
        : (left.inSeconds / _storyLife.inSeconds).clamp(0.0, 1.0);

    return SizedBox(
      width: 104,
      height: 140,
      child: Stack(
        children: [
          Positioned.fill(
            child: NetImage(
              story.images.isEmpty ? null : story.images.first,
              radius: R.tile,
              slotIcon: story.videoUrl == null ? Ico.image : Ico.video,
            ),
          ),

          // Pastki qorayish — oq raqamlar rasm ustida o'qilsin.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: 64,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: C.bottomScrim,
                borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(R.tile),
                ),
              ),
            ),
          ),

          // QOLGAN VAQT CHIZIG'I.
          Positioned(
            left: S.x8,
            right: S.x8,
            top: S.x8,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: SizedBox(
                height: 3,
                width: double.infinity,
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: ColoredBox(
                        color: C.ink3.withValues(alpha: .55),
                      ),
                    ),
                    Positioned.fill(
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: fraction,
                          heightFactor: 1,
                          child: ColoredBox(color: C.accent),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          Positioned(
            right: 0,
            top: 0,
            child: RoundButton(
              Ico.more,
              glass: true,
              size: 30,
              iconSize: 15,
              onTap: onMenu,
            ),
          ),

          Positioned(
            left: S.x8,
            right: S.x8,
            bottom: S.x8,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    NIcon(Ico.heart, size: 12, color: C.ink, filled: true),
                    const SizedBox(width: 4),
                    Text(
                      compact(story.likes),
                      style: T.meta.copyWith(fontSize: 10, color: C.ink),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  remaining(expires),
                  style: T.meta.copyWith(fontSize: 9.5),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Oxirgi katak — yangi story. Uzuq chiziqli ramka uni kontentdan
/// ajratib turadi: bu rasm emas, JOY.
class _AddStoryTile extends StatelessWidget {
  const _AddStoryTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        child: SizedBox(
          width: 104,
          height: 140,
          child: CustomPaint(
            painter: _DashedTilePainter(color: C.line),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  NIcon(Ico.plus, size: 22, color: C.accent),
                  const SizedBox(height: 6),
                  Text(
                    tr('Story'),
                    style: T.meta.copyWith(fontSize: 10),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}

class _DashedTilePainter extends CustomPainter {
  _DashedTilePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(.75, .75, size.width - 1.5, size.height - 1.5),
      const Radius.circular(R.tile),
    );

    // Uzuq chiziq: 5 dp chiziq, 4 dp bo'shliq.
    for (final metric in (Path()..addRRect(rect)).computeMetrics()) {
      var start = 0.0;
      while (start < metric.length) {
        final end = (start + 5).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(start, end), paint);
        start = end + 4;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedTilePainter old) => old.color != color;
}

// ─────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────

class _PostRow extends StatelessWidget {
  const _PostRow({
    required this.post,
    required this.onMenu,
    required this.onOpen,
  });

  final Post post;
  final VoidCallback onMenu;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final caption = post.caption.trim();

    return Surface(
      padding: const EdgeInsets.all(S.x12),
      onTap: onOpen,
      child: Row(
        children: [
          NetImage(
            post.images.isEmpty ? null : post.images.first,
            width: 64,
            height: 64,
            radius: R.tile,
            slotIcon: post.videoUrl == null ? Ico.image : Ico.video,
          ),
          const SizedBox(width: S.x12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  caption.isEmpty ? tr('Izohsiz post') : caption,
                  style: T.cardTitle.copyWith(
                    color: caption.isEmpty ? C.ink2 : C.ink,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    NIcon(Ico.heart, size: 13, color: C.ink3),
                    const SizedBox(width: 5),
                    Text(compact(post.likes), style: T.meta),
                    Text('  ·  ', style: T.meta),
                    Text(
                      ago(post.createdAt).toUpperCase(),
                      style: T.meta.copyWith(fontSize: 10),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: S.x4),
          RoundButton(Ico.more, size: 36, iconSize: 16, onTap: onMenu),
        ],
      ),
    );
  }
}
