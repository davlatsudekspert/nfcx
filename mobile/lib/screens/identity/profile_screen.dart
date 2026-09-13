import 'package:flutter/material.dart' show RefreshIndicator, DefaultTabController, TabBar, TabBarView, Tab;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../business/business_stats.dart';
import '../business/product_detail.dart';
import '../orders/owner_orders.dart';
import 'edit_profile.dart';
import '../common/contact_actions.dart';
import '../common/top_bar.dart';
import '../content/post_detail.dart';
import '../nfc/qr_share.dart';

/// PROFIL — bitta skelet, to'rt kombinatsiya.
///
/// Ikki o'q handoff bo'yicha:
///   TIP    — shaxsiy (bio, kasb, havolalar) yoki biznes (muqova,
///            ish vaqti, manzil, katalog);
///   KO'RUVCHI — ega (Tahrirlash, Statistika, Post, Story; biznesda
///            yana Mahsulot va Buyurtmalar) yoki ommaviy (Obuna,
///            Ulashish va kontakt amallari).
///
/// EGA VOSITALARI OMMAVIY AMALLAR BILAN BIR XIL JOYDA turadi, shuning
/// uchun rol o'zgarganda maket qayta oqmaydi.
///
/// RUXSAT: bu yerdagi `isOwner` faqat KO'RINISH uchun. Har bir
/// o'zgartirish so'rovini server o'zi qaytadan tekshiradi.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.identity, this.code, this.companyId});

  /// O'z shaxsi bo'lsa — tayyor obyekt.
  final Identity? identity;

  /// Ommaviy shaxsiy profil.
  final String? code;

  /// Ommaviy biznes profil.
  final String? companyId;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Record? _record;
  Company? _company;
  List<Post> _posts = const [];
  List<Post> _stories = const [];
  List<Product> _catalog = const [];
  FollowStats _follow = const FollowStats();
  bool _loading = true;
  Object? _error;
  bool _busyFollow = false;

  bool get _isBusiness =>
      widget.companyId != null || (widget.identity?.isBusiness ?? false) || _company != null;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final state = AppScope.read(context);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final id = widget.identity;
      final businessId = widget.companyId ?? (id?.isBusiness == true ? id!.code : null);
      if (businessId != null) {
        final company = await state.repo.company(businessId);
        // Qolganlari ixtiyoriy: biri tushmasa ham profil ochilishi kerak.
        final results = await Future.wait([
          state.repo.companyCatalog(businessId).catchError((_) => <Product>[]),
          state.repo.companyPosts(businessId).catchError((_) => <Post>[]),
          state.repo.companyStories(businessId).catchError((_) => <Post>[]),
        ]);
        state.repo.companyEvent(businessId);
        if (!mounted) return;
        setState(() {
          _company = company;
          _catalog = company.items.isNotEmpty ? company.items : results[0] as List<Product>;
          _posts = results[1] as List<Post>;
          _stories = results[2] as List<Post>;
          _follow = FollowStats(followers: company.followers, isFollowing: company.following);
          _loading = false;
        });
        return;
      }

      final code = widget.code ?? id?.code;
      if (code == null || code.isEmpty) throw Exception('no_code');
      final record = await state.repo.record(code);
      final results = await Future.wait([
        state.repo.recordPosts(code).catchError((_) => <Post>[]),
        state.repo.recordStories(code).catchError((_) => <Post>[]),
        state.repo.followStats(code).catchError((_) => const FollowStats()),
      ]);
      // Ko'rishlar hisobi — FAQAT begona profilda. O'z profilingni
      // ochish statistikani shishirmasligi kerak.
      if (!state.ownsRecord(code)) state.repo.markView(code);
      if (!mounted) return;
      setState(() {
        _record = record;
        _posts = results[0] as List<Post>;
        _stories = results[1] as List<Post>;
        _follow = results[2] as FollowStats;
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

  Future<void> _toggleFollow() async {
    final code = _company?.id ?? _record?.code;
    if (code == null || _busyFollow) return;
    final wasFollowing = _follow.isFollowing;
    setState(() {
      _busyFollow = true;
      // Optimistik yangilanish — tugma darhol javob beradi. Xato
      // bo'lsa pastda qaytariladi.
      _follow = FollowStats(
        followers: _follow.followers + (wasFollowing ? -1 : 1),
        following: _follow.following,
        isFollowing: !wasFollowing,
      );
    });
    try {
      final repo = AppScope.read(context).repo;
      if (wasFollowing) {
        await repo.unfollow(code);
      } else {
        await repo.follow(code);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _follow = FollowStats(
              followers: _follow.followers + (wasFollowing ? 1 : -1),
              following: _follow.following,
              isFollowing: wasFollowing,
            ));
      }
    } finally {
      if (mounted) setState(() => _busyFollow = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final code = _company?.id ?? _record?.code ?? widget.code ?? widget.companyId ?? '';
    final isOwner = _isBusiness ? state.ownsCompany(code) : state.ownsRecord(code);

    if (_loading && _record == null && _company == null) {
      return _Frame(code: code, child: const _ProfileSkeleton());
    }
    if (_error != null && _record == null && _company == null) {
      return _Frame(
        code: code,
        child: ErrorState(humanError(_error), onRetry: _load),
      );
    }

    final tabs = _isBusiness
        ? const ['KATALOG', 'POSTLAR', 'STORY', 'HAQIDA']
        : const ['POSTLAR', 'STORY', 'HAQIDA'];

    return _Frame(
      code: code,
      child: DefaultTabController(
        length: tabs.length,
        child: RefreshIndicator(
          onRefresh: _load,
          color: C.champagne,
          backgroundColor: C.slate,
          child: NestedScrollView(
            headerSliverBuilder: (_, __) => [
              SliverToBoxAdapter(
                child: _Header(
                  record: _record,
                  company: _company,
                  follow: _follow,
                  isOwner: isOwner,
                  busyFollow: _busyFollow,
                  onFollow: _toggleFollow,
                  onShare: () {
                    final id = _company != null
                        ? Identity.business(_company!)
                        : Identity.personal(_record!);
                    shareIdentity(id);
                  },
                  onRefresh: _load,
                ),
              ),
              SliverToBoxAdapter(
                child: TabBar(
                  isScrollable: false,
                  indicatorColor: C.champagne,
                  indicatorWeight: 2,
                  dividerColor: C.hairline,
                  labelColor: C.offWhite,
                  unselectedLabelColor: C.muted,
                  labelStyle: T.statusLabel.copyWith(fontSize: 10.5, fontWeight: FontWeight.w700),
                  unselectedLabelStyle: T.statusLabel.copyWith(fontSize: 10.5),
                  tabs: [for (final t in tabs) Tab(height: 42, text: t)],
                ),
              ),
            ],
            body: TabBarView(
              children: [
                if (_isBusiness) _CatalogGrid(items: _catalog),
                _PostGrid(posts: _posts),
                _PostGrid(posts: _stories, empty: 'Hali story yo‘q.'),
                _About(record: _record, company: _company),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Profil skeleton'i — HAQIQIY maketning silueti: muqova, avatar,
/// uchta raqam, ism va amal tugmalari. Ma'lumot kelganda hech narsa
/// siljimaydi, chunki o'lchamlar bir xil.
class _ProfileSkeleton extends StatelessWidget {
  const _ProfileSkeleton();

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        children: const [
          SkeletonCard(aspect: 16 / 7),
          SizedBox(height: S.x16),
          Row(
            children: [
              Skeleton(width: 66, height: 66, radius: 33),
              SizedBox(width: S.x16),
              Expanded(child: Skeleton(height: 34)),
            ],
          ),
          SizedBox(height: S.x16),
          Skeleton(width: 170, height: 21),
          SizedBox(height: S.x8),
          Skeleton(width: 110, height: 13),
          SizedBox(height: S.x16),
          Skeleton(height: 48, radius: R.button),
        ],
      );
}

class _Frame extends StatelessWidget {
  const _Frame({required this.code, required this.child});
  final String code;
  final Widget child;

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: C.obsidian,
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              TopBar(title: code),
              Expanded(child: child),
            ],
          ),
        ),
      );
}

class _Header extends StatelessWidget {
  const _Header({
    required this.record,
    required this.company,
    required this.follow,
    required this.isOwner,
    required this.busyFollow,
    required this.onFollow,
    required this.onShare,
    required this.onRefresh,
  });

  final Record? record;
  final Company? company;
  final FollowStats follow;
  final bool isOwner;
  final bool busyFollow;
  final VoidCallback onFollow;
  final VoidCallback onShare;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final name = company?.name ?? record?.name ?? '';
    final code = company?.id ?? record?.code ?? '';
    final avatar = company?.logoUrl ?? record?.avatarUrl;
    final cover = company?.coverUrl ?? record?.bgUrl;
    final verified = company?.verified ?? record?.verified ?? false;
    final about = company?.about ?? record?.about ?? '';
    final role = company == null
        ? record?.role ?? ''
        : [company!.city, company!.address].where((s) => s.isNotEmpty).join(' · ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Muqova — biznesda 16:7, shaxsiyda ham bor bo'lsa ko'rsatiladi.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: AspectRatio(
            aspectRatio: 16 / 7,
            child: NetImage(cover, slotLabel: 'COVER 16:7', radius: R.card),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(S.gutter, S.x16, S.gutter, 0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Avatar(url: avatar, name: name, size: 66),
              const SizedBox(width: S.x16),
              Expanded(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _Stat(value: follow.followers, label: 'obunachi'),
                    if (company != null)
                      _Stat(value: company!.itemCount, label: 'mahsulot')
                    else
                      _Stat(value: follow.following, label: 'obuna'),
                    _Stat(value: company?.views ?? record?.views ?? 0, label: 'ko‘rish'),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(S.gutter, S.x16, S.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: T.profileName),
                  ),
                  if (verified) ...[
                    const SizedBox(width: 6),
                    const VerifiedBadge(),
                  ],
                ],
              ),
              const SizedBox(height: 5),
              Row(
                children: [
                  Text(code, style: T.code),
                  if (company?.isOpen != null) ...[
                    const SizedBox(width: S.x8),
                    StatusChip(
                      company!.isOpen! ? 'Ochiq' : 'Yopiq',
                      tone: company!.isOpen! ? StatusTone.ok : StatusTone.neutral,
                    ),
                    if (company!.hoursLabel.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Text(company!.hoursLabel, style: T.meta.copyWith(fontSize: 11)),
                    ],
                  ],
                ],
              ),
              if (role.isNotEmpty) ...[
                const SizedBox(height: 5),
                Text(role, style: T.caption),
              ],
              if (about.isNotEmpty) ...[
                const SizedBox(height: S.x8),
                Text(about, style: T.body),
              ],
            ],
          ),
        ),
        const SizedBox(height: S.x16),
        // AMAL SLOTLARI — ega va mehmon uchun bir xil joyda.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: isOwner
              ? _OwnerActions(
                  company: company,
                  record: record,
                  onShare: onShare,
                  onChanged: onRefresh,
                )
              : _PublicActions(
                  following: follow.isFollowing,
                  busy: busyFollow,
                  onFollow: onFollow,
                  onShare: onShare,
                  phone: company?.phone ?? record?.phone ?? '',
                  tg: company?.tg ?? record?.tg ?? '',
                  instagram: company?.instagram ?? record?.instagram ?? '',
                ),
        ),
        const SizedBox(height: S.x20),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final int value;
  final String label;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(compact(value), style: T.cardTitle.copyWith(fontSize: 16)),
          const SizedBox(height: 2),
          Text(label, style: T.caption.copyWith(fontSize: 10.5, color: C.muted)),
        ],
      );
}

/// EGA VOSITALARI.
///
/// Ishlamaydigan tugma QO'YILMAYDI: backend qo'llab-quvvatlamaydigan
/// amal (post/story yaratish — rasm yuklash oqimi hali yo'q) umuman
/// ko'rsatilmaydi. Bosilganda hech narsa qilmaydigan tugma
/// foydalanuvchini ishonchdan mahrum qiladi.
class _OwnerActions extends StatelessWidget {
  const _OwnerActions({
    required this.company,
    required this.record,
    required this.onShare,
    required this.onChanged,
  });

  final Company? company;
  final Record? record;
  final VoidCallback onShare;
  final VoidCallback onChanged;

  bool get isBusiness => company != null;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Row(
            children: [
              Expanded(
                child: SecondaryButton(
                  'Tahrirlash',
                  height: 44,
                  // Biznes profilini tahrirlash alohida oqim (katalog,
                  // ish vaqti, manzil) — u hali qurilmagan, shuning
                  // uchun faqat shaxsiy profilda faol.
                  onTap: record == null
                      ? null
                      : () async {
                          final saved = await push<bool>(
                            context,
                            (_) => EditProfileScreen(record: record!),
                          );
                          if (saved == true) onChanged();
                        },
                ),
              ),
              const SizedBox(width: S.x8),
              Expanded(
                child: SecondaryButton(
                  'Statistika',
                  height: 44,
                  onTap: isBusiness
                      ? () => push(context, (_) => BusinessStatsScreen(companyId: company!.id))
                      : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: S.x8),
          Row(
            children: [
              if (isBusiness) ...[
                Expanded(
                  child: GhostButton(
                    'Buyurtmalar',
                    onTap: () => push(
                      context,
                      (_) => OwnerOrdersScreen(
                        companyId: company!.id,
                        companyName: company!.name,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: S.x8),
              ],
              Press(
                onTap: onShare,
                child: Container(
                  width: 44, height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(R.button),
                    border: Border.all(color: C.hairline),
                  ),
                  child: const NIcon(Ico.share, size: 18, color: C.offWhite),
                ),
              ),
            ],
          ),
        ],
      );
}

class _PublicActions extends StatelessWidget {
  const _PublicActions({
    required this.following,
    required this.busy,
    required this.onFollow,
    required this.onShare,
    required this.phone,
    required this.tg,
    required this.instagram,
  });

  final bool following;
  final bool busy;
  final VoidCallback onFollow;
  final VoidCallback onShare;
  final String phone;
  final String tg;
  final String instagram;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Row(
            children: [
              Expanded(
                child: following
                    ? SecondaryButton('Obuna bo‘lingan', height: 48, onTap: busy ? null : onFollow)
                    : PrimaryButton('Obuna bo‘lish', loading: busy, onTap: busy ? null : onFollow),
              ),
              const SizedBox(width: S.x8),
              Press(
                onTap: onShare,
                child: Container(
                  width: 48, height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: C.slate,
                    borderRadius: BorderRadius.circular(R.button),
                    border: Border.all(color: C.warmHairline),
                  ),
                  child: const NIcon(Ico.share, size: 19, color: C.offWhite),
                ),
              ),
            ],
          ),
          const SizedBox(height: S.x12),
          // TASHQI KONTAKT — ichki messenjer YO'Q.
          ContactRow(phone: phone, telegram: tg, instagram: instagram),
        ],
      );
}

class _CatalogGrid extends StatelessWidget {
  const _CatalogGrid({required this.items});
  final List<Product> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const EmptyState('Katalogda hali mahsulot yo‘q.');
    }
    return GridView.builder(
      padding: const EdgeInsets.all(S.gutter),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: S.x12,
        mainAxisSpacing: S.x12,
        childAspectRatio: .74,
      ),
      itemCount: items.length,
      itemBuilder: (context, i) => ProductCard(product: items[i]),
    );
  }
}

class _PostGrid extends StatelessWidget {
  const _PostGrid({required this.posts, this.empty = 'Hali post yo‘q.'});
  final List<Post> posts;
  final String empty;

  @override
  Widget build(BuildContext context) {
    if (posts.isEmpty) return EmptyState(empty);
    return GridView.builder(
      padding: const EdgeInsets.all(3),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 3,
        mainAxisSpacing: 3,
        childAspectRatio: .8,
      ),
      itemCount: posts.length,
      itemBuilder: (context, i) => Press(
        onTap: () => push(context, (_) => PostDetailScreen(post: posts[i])),
        child: NetImage(
          posts[i].images.isEmpty ? null : posts[i].images.first,
          radius: 4,
          cacheWidth: 160,
          slotLabel: 'POST',
        ),
      ),
    );
  }
}

class _About extends StatelessWidget {
  const _About({required this.record, required this.company});
  final Record? record;
  final Company? company;

  @override
  Widget build(BuildContext context) {
    final rows = <({String label, String value})>[
      if ((company?.address ?? record?.address ?? '').isNotEmpty)
        (label: 'Manzil', value: company?.address ?? record!.address),
      if ((company?.city ?? record?.city ?? '').isNotEmpty)
        (label: 'Shahar', value: company?.city ?? record!.city),
      if ((company?.hoursLabel ?? '').isNotEmpty)
        (label: 'Ish vaqti', value: company!.hoursLabel),
      if ((company?.phone ?? record?.phone ?? '').isNotEmpty)
        (label: 'Telefon', value: company?.phone ?? record!.phone),
      if ((company?.website ?? record?.website ?? '').isNotEmpty)
        (label: 'Veb-sayt', value: company?.website ?? record!.website),
    ];
    final about = company?.about ?? record?.about ?? '';

    if (rows.isEmpty && about.isEmpty) {
      return const EmptyState('Ma‘lumot hali to‘ldirilmagan.');
    }
    return ListView(
      padding: const EdgeInsets.all(S.gutter),
      children: [
        if (about.isNotEmpty) ...[
          Surface(child: Text(about, style: T.body)),
          const SizedBox(height: S.x12),
        ],
        for (final r in rows) ...[
          Surface(
            padding: const EdgeInsets.symmetric(horizontal: S.x16, vertical: S.x12),
            shadow: E.e1,
            child: Row(
              children: [
                SizedBox(width: 96, child: Text(r.label, style: T.caption)),
                Expanded(
                  child: Text(r.value, style: T.cardTitle.copyWith(fontSize: 13)),
                ),
              ],
            ),
          ),
          const SizedBox(height: S.x8),
        ],
      ],
    );
  }
}
